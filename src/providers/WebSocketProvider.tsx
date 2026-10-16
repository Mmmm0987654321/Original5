import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  normalizeDexPriceKey,
} from '../lib/priceKeys';
import {
  enabledHip3Dexes,
} from '../lib/hip3Dexes';

const HL_MAINNET_WS_URL =
  "wss://api.hyperliquid.xyz/ws";

const HIP3_DEXES =
  enabledHip3Dexes();

const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;
const PRICE_THROTTLE_MS = 500;
const ASSET_CTX_THROTTLE_MS = 500;
const ORDER_BOOK_THROTTLE_MS = 500; // Throttle order book updates to max ~2 per second
const ORDER_BOOK_MAX_LEVELS = 20; // Hard cap to reduce payload/allocs

const PRICE_OUTLIER_RATIO = 0.06;
const PRICE_OUTLIER_CONFIRM_RATIO = 0.01;
const PRICE_OUTLIER_HOLD_MAX_MS =
  2_000;

const STALE_MESSAGE_WATCHDOG_MS =
  15_000;
const STALE_MAIN_MIDS_MS = 15_000;
const STALENESS_CHECK_INTERVAL_MS =
  5_000;

interface PriceData {
  coin: string;
  price: string;
  change24h?: number;
  time: number;
}

const EMPTY_PRICES: Record<
  string,
  PriceData
> = Object.freeze({});

interface AssetCtxData {
  coin: string;
  markPx?: string;
  midPx?: string;
  oraclePx?: string;
  time: number;
  ctx?: any;
}

const EMPTY_ASSET_CTXS:
  Record<string, AssetCtxData> =
    Object.freeze({});

interface OrderBookLevel {
  px: string;
  sz: string;
  n?: number;
}

interface OrderBookData {
  coin: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  time: number;
}

interface OrderBookContextType {
  orderBooks: Record<string, OrderBookData>;
  subscribeOrderBook: (coin: string) => void;
  unsubscribeOrderBook: (coin: string) => void;
}

const OrderBookContext =
  createContext<OrderBookContextType | undefined>(
    undefined
  );

interface CandleData {
  coin: string;
  interval: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades?: number;
}

interface CandleContextType {
  candles: Record<string, CandleData>;
  subscribeCandle: (
    coin: string,
    interval: string
  ) => void;
  unsubscribeCandle: (
    coin: string,
    interval: string
  ) => void;
}

const CandleContext =
  createContext<
    CandleContextType |
    undefined
  >(undefined);

interface WebSocketStatusContextType {
  isConnected: boolean;
  connectionStatus:
    | "connecting"
    | "connected"
    | "disconnected"
    | "error";
  reconnect: () => void;
}

interface PricesRefContextType {
  pricesRef: React.MutableRefObject<
    Record<string, PriceData>
  >;
}

interface PricesActionsContextType {
  subscribe: (coins: string[]) => void;
  unsubscribe: (coins: string[]) => void;
  subscribeFlush: (onStoreChange: () => void) => () => void;
}

interface AssetCtxActionsContextType {
  subscribeAssetCtx:
    (coins: string[]) => void;

  unsubscribeAssetCtx:
    (coins: string[]) => void;

  subscribeFlush:
    (
      onStoreChange: () => void
    ) => () => void;
}

interface AssetCtxRefContextType {
  assetCtxsRef:
    React.MutableRefObject<
      Record<
        string,
        AssetCtxData
      >
    >;
}

const WebSocketStatusContext =
  createContext<
    WebSocketStatusContextType |
    undefined
  >(undefined);

const PricesRefContext =
  createContext<
    PricesRefContextType |
    undefined
  >(undefined);

const PricesActionsContext =
  createContext<
    PricesActionsContextType |
    undefined
  >(undefined);

const AssetCtxActionsContext =
  createContext<
    AssetCtxActionsContextType |
    undefined
  >(undefined);

const AssetCtxRefContext =
  createContext<
    AssetCtxRefContextType |
    undefined
  >(undefined);

function pickRecord<T>(
  all: Record<string, T>,
  coins: string[],
): Record<string, T> {
  const out: Record<string, T> = {};

  for (const coin of coins) {
    if (!coin) continue;

    const value = all[coin];

    if (value != null) {
      out[coin] = value;
    }
  }

  return out;
}

function priceSliceUnchanged(
  prev: Record<string, PriceData>,
  all: Record<string, PriceData>,
  coins: string[],
): boolean {
  for (const coin of coins) {
    if (!coin) continue;

    const a = prev[coin];
    const b = all[coin];

    if (a === b) continue;

    if (!a || !b) {
      return false;
    }

    if (
      a.price !== b.price ||
      a.time !== b.time
    ) {
      return false;
    }
  }

  return true;
}

function assetCtxSliceUnchanged(
  prev:
    Record<
      string,
      AssetCtxData
    >,
  all:
    Record<
      string,
      AssetCtxData
    >,
  coins: string[],
): boolean {
  for (const coin of coins) {
    if (!coin) continue;

    const a = prev[coin];
    const b = all[coin];

    if (a === b) continue;

    if (!a || !b) {
      return false;
    }

    if (
      a.markPx !== b.markPx ||
      a.midPx !== b.midPx ||
      a.oraclePx !==
        b.oraclePx ||
      a.time !== b.time
    ) {
      return false;
    }
  }

  return true;
}

function sendOrderBookSubscription(
  ws: WebSocket,
  method: 'subscribe' | 'unsubscribe',
  coin: string
) {
  ws.send(JSON.stringify({
    method,
    subscription: {
      type: 'l2Book',
      coin
    }
  }));

  ws.send(JSON.stringify({
    method,
    subscription: {
      type: 'l2Book',
      coin,
      fast: true
    }
  }));
}

function mergeOrderBookSide(
  incoming: OrderBookLevel[] | undefined,
  previous: OrderBookLevel[] | undefined,
  maxLevels: number,
) {
  const levels: OrderBookLevel[] = [];
  const seen = new Set<string>();

  [
    ...(incoming ?? []),
    ...(previous ?? [])
  ].forEach((level) => {
    const px =
      String(level?.px ?? '');

    if (
      !px ||
      seen.has(px)
    ) {
      return;
    }

    seen.add(px);
    levels.push(level);
  });

  return levels.slice(
    0,
    maxLevels
  );
}

export function WebSocketProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    isConnected,
    setIsConnected,
  ] = useState(false);

  const [
    connectionStatus,
    setConnectionStatus,
  ] = useState<
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"
  >("disconnected");

  const [
    orderBooks,
    setOrderBooks
  ] = useState<
    Record<string, OrderBookData>
  >({});

  const [
    candles,
    setCandles
  ] = useState<
    Record<string, CandleData>
  >({});

  const orderBooksRef =
    useRef<
      Record<string, OrderBookData>
    >({});

  // Refcounted per-coin `bbo` subscriptions. allMids is moving to ~5s pushes,
  // which makes PortfolioTabs PnL step visibly during volatility. bbo pushes
  // on every block where the best bid/offer changes, so coins a screen is
  // actively watching (positions, open orders, the traded coin) keep
  // near-realtime marks while allMids remains the broad fallback.
  //
  // CRITICAL: HL hard-closes the ENTIRE socket (no error frame) on a bbo
  // subscription for a coin it doesn't recognize — verified live with
  // `scripts/ws_bbo_probe.mjs`: bare perps ("BTC") and spot ids ("@142") are
  // fine, but HIP-3 ("xyz:BTC"), token names ("UBTC") and pair names
  // ("UBTC/USDC") all kill the connection, which put the app in a reconnect
  // loop. liveCoins lists deliberately contain those variants as price
  // lookup keys, so we gate every bbo sub on the coin having appeared in the
  // main allMids frame (the server's own coin universe) and defer the rest.
  const bboSubs = useRef<Map<string, number>>(new Map()); // desired refcounts
  const bboActive = useRef<Set<string>>(new Set()); // subs actually on the wire
  const bboValidCoins = useRef<Set<string>>(new Set()); // keys seen in main allMids

  const orderBookSubs =
    useRef<Set<string>>(
      new Set()
    );

  const candleSubs =
    useRef<Set<string>>(
      new Set()
    );

  const orderBookLastUpdate =
    useRef<
      Record<string, number>
    >({});

  const orderBookPending =
    useRef<
      Record<string, OrderBookData>
    >({});

  const orderBookFlushInterval =
    useRef<
      ReturnType<typeof setInterval> |
      null
    >(null);

  useEffect(() => {
    orderBooksRef.current =
      orderBooks;
  }, [orderBooks]);

  const wsRef =
    useRef<WebSocket | null>(null);

  const reconnectTimeoutRef =
    useRef<
      ReturnType<typeof setTimeout> |
      null
    >(null);

  const heartbeatIntervalRef =
    useRef<
      ReturnType<typeof setInterval> |
      null
    >(null);

  const stableTimerRef =
    useRef<
      ReturnType<typeof setTimeout> |
      null
    >(null);

  const stalenessIntervalRef =
    useRef<
      ReturnType<typeof setInterval> |
      null
    >(null);

  const priceFlushTimeout =
    useRef<
      ReturnType<typeof setTimeout> |
      null
    >(null);

  const isSubscribed =
    useRef(false);

  const retryCount =
    useRef(0);

  const priceLastUpdate =
    useRef(0);

  const pricePending =
    useRef<
      Record<string, PriceData>
    >({});

  const acceptedPrices =
    useRef<
      Record<string, PriceData>
    >({});

  const hip3LastUpdate =
    useRef<
      Record<string, number>
    >({});

  const outlierCandidates =
    useRef<
      Record<
        string,
        {
          price: number;
          firstSeen: number;
        }
      >
    >({});

  const stablePricesRef =
    useRef<
      Record<string, PriceData>
    >({});

  const priceListenersRef =
    useRef(
      new Set<() => void>(),
    );

  const assetCtxSubs =
    useRef<
      Map<string, number>
    >(new Map());

  const assetCtxLastUpdate =
    useRef(0);

  const assetCtxPending =
    useRef<
      Record<
        string,
        AssetCtxData
      >
    >({});

  const assetCtxFlushTimeout =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(null);

  const stableAssetCtxsRef =
    useRef<
      Record<
        string,
        AssetCtxData
      >
    >({});

  const assetCtxListenersRef =
    useRef(
      new Set<() => void>()
    );

  const lastMessageAt =
    useRef(0);

  const lastMainMidsAt =
    useRef(0);

  const forceReconnectRef =
    useRef<() => void>(() => {});

  // Open bbo subs for desired coins that are safe to subscribe (see the
  // bboSubs comment above). Called when consumers subscribe, on (re)connect,
  // and when new coins show up in the main allMids frame.
  const reconcileBboSubs = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    bboSubs.current.forEach((_count, coin) => {
      if (bboActive.current.has(coin)) return;
      if (coin.includes(':') || coin.includes('/')) return; // HIP-3 / pair names: unsupported
      if (!bboValidCoins.current.has(coin)) return; // not (yet) in server's coin universe
      bboActive.current.add(coin);
      ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'bbo', coin }
      }));
    });
  }, []);

  const sendSubscription =
    useCallback(
      (
        replayAll = false
      ) => {
        if (
          wsRef.current?.readyState ===
            WebSocket.OPEN &&
          !isSubscribed.current
        ) {
          wsRef.current.send(
            JSON.stringify({
              method: "subscribe",
              subscription: {
                type: "allMids",
              },
            }),
          );

          HIP3_DEXES.forEach(
            (dex) => {
              wsRef.current?.send(
                JSON.stringify({
                  method:
                    'subscribe',
                  subscription: {
                    type:
                      'allMids',
                    dex,
                  },
                }),
              );
            },
          );

          isSubscribed.current = true;
        }

        if (
          replayAll &&
          wsRef.current?.readyState ===
            WebSocket.OPEN &&
          orderBookSubs.current.size > 0
        ) {
          orderBookSubs.current.forEach(
            (coin) => {
              const ws =
                wsRef.current;

              if (ws) {
                sendOrderBookSubscription(
                  ws,
                  'subscribe',
                  coin
                );
              }
            }
          );
        }

        if (
          replayAll &&
          wsRef.current?.readyState ===
            WebSocket.OPEN &&
          candleSubs.current.size > 0
        ) {
          candleSubs.current.forEach(
            (key) => {
              const [
                coin,
                interval
              ] =
                key.split('|');

              if (
                !coin ||
                !interval
              ) {
                return;
              }

              wsRef.current?.send(
                JSON.stringify({
                  method:
                    'subscribe',
                  subscription: {
                    type:
                      'candle',
                    coin,
                    interval
                  }
                })
              );
            }
          );
        }

        if (
          replayAll &&
          wsRef.current?.readyState ===
            WebSocket.OPEN &&
          assetCtxSubs.current.size > 0
        ) {
          assetCtxSubs.current.forEach(
            (_count, coin) => {
              wsRef.current?.send(
                JSON.stringify({
                  method: "subscribe",
                  subscription: {
                    type:
                      "activeAssetCtx",
                    coin,
                  },
                })
              );
            }
          );
        }
      },
      [],
    );

  const startHeartbeat =
    useCallback(() => {
      if (
        heartbeatIntervalRef.current
      ) {
        clearInterval(
          heartbeatIntervalRef.current,
        );
      }

      heartbeatIntervalRef.current =
        setInterval(() => {
          if (
            wsRef.current?.readyState ===
            WebSocket.OPEN
          ) {
            wsRef.current.send(
              JSON.stringify({
                method: "ping",
              }),
            );
          }
        }, HEARTBEAT_INTERVAL);
    }, []);

  const stopHeartbeat =
    useCallback(() => {
      if (
        heartbeatIntervalRef.current
      ) {
        clearInterval(
          heartbeatIntervalRef.current,
        );

        heartbeatIntervalRef.current =
          null;
      }
    }, []);

  const stopStalenessWatchdog =
    useCallback(() => {
      if (
        stalenessIntervalRef.current
      ) {
        clearInterval(
          stalenessIntervalRef.current,
        );

        stalenessIntervalRef.current =
          null;
      }
    }, []);

  const startStalenessWatchdog =
    useCallback(() => {
      stopStalenessWatchdog();

      stalenessIntervalRef.current =
        setInterval(() => {
          if (
            typeof document !==
              "undefined" &&
            document.visibilityState ===
              "hidden"
          ) {
            return;
          }

          const ws =
            wsRef.current;

          if (
            !ws ||
            ws.readyState !==
              WebSocket.OPEN
          ) {
            return;
          }

          const elapsed =
            Date.now() -
            lastMessageAt.current;

          if (
            elapsed >
            STALE_MESSAGE_WATCHDOG_MS
          ) {
            forceReconnectRef.current();
            return;
          }

          const mainMidsElapsed =
            Date.now() -
            lastMainMidsAt.current;

          if (
            mainMidsElapsed >
            STALE_MAIN_MIDS_MS
          ) {
            forceReconnectRef.current();
          }
        },
        STALENESS_CHECK_INTERVAL_MS);
    }, [
      stopStalenessWatchdog,
    ]);

  const queuePriceUpdate =
    useCallback(
      (
        coin: string,
        price: unknown,
        now: number,
        dex?: string | null,
      ) => {
        const key =
          dex
            ? normalizeDexPriceKey(
                coin,
                dex,
              )
            : String(coin || "");

        const nextPx =
          Number(price);

        if (
          !key ||
          !Number.isFinite(nextPx) ||
          nextPx <= 0
        ) {
          return;
        }

        const stuck =
          outlierCandidates.current[
            key
          ];

        if (
          stuck &&
          now - stuck.firstSeen >
            PRICE_OUTLIER_HOLD_MAX_MS
        ) {
          const promoted = {
            coin: key,
            price: String(
              stuck.price,
            ),
            time: now,
          };

          acceptedPrices.current[
            key
          ] = promoted;

          pricePending.current[
            key
          ] = promoted;

          delete outlierCandidates
            .current[key];
        }

        const prevRaw =
          acceptedPrices.current[
            key
          ]?.price;

        const prevPx =
          Number(prevRaw);

        if (
          Number.isFinite(prevPx) &&
          prevPx > 0
        ) {
          const jumpRatio =
            Math.abs(
              nextPx - prevPx,
            ) / prevPx;

          if (
            jumpRatio >
            PRICE_OUTLIER_RATIO
          ) {
            const candidate =
              outlierCandidates
                .current[key];

            const sameCandidate =
              candidate &&
              Math.abs(
                nextPx -
                  candidate.price,
              ) /
                candidate.price <=
                PRICE_OUTLIER_CONFIRM_RATIO;

            if (!sameCandidate) {
              outlierCandidates
                .current[key] = {
                price: nextPx,
                firstSeen: now,
              };

              return;
            }
          }
        }

        delete outlierCandidates
          .current[key];

        const next = {
          coin: key,
          price: String(price),
          time: now,
        };

        acceptedPrices.current[
          key
        ] = next;

        pricePending.current[
          key
        ] = next;
      },
      [],
    );

  const notifyPriceListeners =
    useCallback(() => {
      priceListenersRef.current
        .forEach(
          (listener) =>
            listener(),
        );
    }, []);

  const applyPriceFlush =
    useCallback(
      (
        pendingCopy: Record<
          string,
          PriceData
        >,
      ) => {
        if (
          Object.keys(
            pendingCopy,
          ).length === 0
        ) {
          return;
        }

        stablePricesRef.current = {
          ...stablePricesRef.current,
          ...pendingCopy,
        };

        notifyPriceListeners();
      },
      [notifyPriceListeners],
    );

  const flushPricesThrottled =
    useCallback(
      (now: number) => {
        if (
          now -
            priceLastUpdate.current >=
          PRICE_THROTTLE_MS
        ) {
          priceLastUpdate.current =
            now;

          const pendingCopy = {
            ...pricePending.current,
          };

          pricePending.current = {};

          applyPriceFlush(
            pendingCopy,
          );
        } else if (
          !priceFlushTimeout.current
        ) {
          priceFlushTimeout.current =
            setTimeout(() => {
              priceFlushTimeout.current =
                null;

              const flushNow =
                Date.now();

              priceLastUpdate.current =
                flushNow;

              const pendingCopy = {
                ...pricePending.current,
              };

              pricePending.current = {};

              applyPriceFlush(
                pendingCopy,
              );
            },
            PRICE_THROTTLE_MS -
              (
                now -
                priceLastUpdate.current
              ),
            );
        }
      },
      [applyPriceFlush],
    );

  const notifyAssetCtxListeners =
    useCallback(() => {
      assetCtxListenersRef.current
        .forEach(
          (listener) =>
            listener()
        );
    }, []);

  const applyAssetCtxFlush =
    useCallback(
      (
        pendingCopy:
          Record<
            string,
            AssetCtxData
          >
      ) => {
        if (
          Object.keys(
            pendingCopy
          ).length === 0
        ) {
          return;
        }

        stableAssetCtxsRef.current = {
          ...stableAssetCtxsRef
            .current,
          ...pendingCopy,
        };

        notifyAssetCtxListeners();
      },
      [
        notifyAssetCtxListeners
      ],
    );

  const flushAssetCtxsThrottled =
    useCallback(
      (now: number) => {
        if (
          now -
            assetCtxLastUpdate
              .current >=
          ASSET_CTX_THROTTLE_MS
        ) {
          assetCtxLastUpdate.current =
            now;

          const pendingCopy = {
            ...assetCtxPending
              .current,
          };

          assetCtxPending.current =
            {};

          applyAssetCtxFlush(
            pendingCopy
          );
        } else if (
          !assetCtxFlushTimeout
            .current
        ) {
          assetCtxFlushTimeout
            .current =
            setTimeout(() => {
              assetCtxFlushTimeout
                .current = null;

              const flushNow =
                Date.now();

              assetCtxLastUpdate
                .current =
                flushNow;

              const pendingCopy = {
                ...assetCtxPending
                  .current,
              };

              assetCtxPending
                .current = {};

              applyAssetCtxFlush(
                pendingCopy
              );
            },
            ASSET_CTX_THROTTLE_MS -
              (
                now -
                assetCtxLastUpdate
                  .current
              ),
            );
        }
      },
      [
        applyAssetCtxFlush
      ],
    );

  const connect =
    useCallback(() => {
      if (
        wsRef.current?.readyState ===
          WebSocket.OPEN ||
        wsRef.current?.readyState ===
          WebSocket.CONNECTING
      ) {
        return;
      }

      if (
        reconnectTimeoutRef.current
      ) {
        clearTimeout(
          reconnectTimeoutRef.current,
        );

        reconnectTimeoutRef.current =
          null;
      }

      setConnectionStatus(
        "connecting",
      );

      isSubscribed.current =
        false;

      try {
        const ws =
          new WebSocket(
            HL_MAINNET_WS_URL,
          );

        ws.onopen = () => {
          setIsConnected(true);

          setConnectionStatus(
            "connected",
          );

          acceptedPrices.current =
            {};

          outlierCandidates.current =
            {};

          hip3LastUpdate.current =
            {};

          // bbo subs from the previous socket died with it — let reconcile
          // re-open them on this connection.
          bboActive.current.clear();

          lastMessageAt.current =
            Date.now();

          lastMainMidsAt.current =
            Date.now();

          if (
            stableTimerRef.current
          ) {
            clearTimeout(
              stableTimerRef.current,
            );
          }

          stableTimerRef.current =
            setTimeout(() => {
              retryCount.current = 0;
            }, 15_000);

          setTimeout(() => {
            sendSubscription(true);
          }, 100);

          startHeartbeat();

          startStalenessWatchdog();

          if (
            orderBookFlushInterval.current
          ) {
            clearInterval(
              orderBookFlushInterval.current
            );
          }

          orderBookFlushInterval.current =
            setInterval(() => {
              const pending =
                orderBookPending.current;

              const keys =
                Object.keys(pending);

              if (keys.length > 0) {
                const now =
                  Date.now();

                setOrderBooks((prev) => {
                  const updated = {
                    ...prev
                  };

                  keys.forEach(
                    (key) => {
                      const lastUpdate =
                        orderBookLastUpdate
                          .current[key] ||
                        0;

                      if (
                        now - lastUpdate >=
                          ORDER_BOOK_THROTTLE_MS &&
                        pending[key]
                      ) {
                        updated[key] =
                          pending[key];

                        orderBookLastUpdate
                          .current[key] =
                          now;

                        delete pending[key];
                      }
                    }
                  );

                  return updated;
                });
              }
            }, ORDER_BOOK_THROTTLE_MS);
        };

        ws.onmessage = (
          event,
        ) => {
          lastMessageAt.current =
            Date.now();

          try {
            const data =
              JSON.parse(
                event.data,
              );

            if (
              data.method ===
              "pong"
            ) {
              return;
            }

            if (data.channel === 'error') {
              const errText =
                String(data.data ?? '');

              if (
                !errText.startsWith(
                  'Already subscribed'
                ) &&
                !errText.startsWith(
                  'Already unsubscribed'
                )
              ) {
                console.log(
                  '[WS] Server error frame:',
                  errText
                );
              }

              return;
            }

            if (
              data.channel ===
                "allMids" &&
              data.data?.mids
            ) {
              const mids =
                data.data.mids;

              const now =
                Date.now();

              const dex =
                typeof data.data?.dex ===
                  'string'
                  ? data.data.dex
                  : null;

              if (dex) {
                hip3LastUpdate.current[dex] = now;
              } else {
                lastMainMidsAt.current = now;

                // Main allMids keys (bare perps + @N spot ids) define the coin
                // universe bbo accepts. Learn them, then open any bbo subs that
                // were deferred waiting for validation.
                Object.keys(mids).forEach((coin) => bboValidCoins.current.add(coin));
                if (bboSubs.current.size > bboActive.current.size) {
                  reconcileBboSubs();
                }
              }

              Object.entries(
                mids,
              ).forEach(
                ([
                  coin,
                  price,
                ]) => {
                  queuePriceUpdate(
                    coin,
                    price,
                    now,
                    dex,
                  );
                },
              );

              flushPricesThrottled(
                now,
              );
            }

            // bbo pushes whenever the best bid/offer changes on a block — much
            // faster than the ~5s allMids cadence. Feed the bbo mid into the
            // same price map (same outlier filter + throttle) so PnL/marks for
            // actively-watched coins tick near-realtime; allMids stays the
            // broad fallback for everything else.
            if (data.channel === 'bbo' && data.data?.coin && Array.isArray(data.data?.bbo)) {
              const [bid, ask] = data.data.bbo as [OrderBookLevel | null, OrderBookLevel | null];
              const bidPx = Number(bid?.px);
              const askPx = Number(ask?.px);
              // Only use two-sided quotes; a one-sided book would skew the mid.
              if (Number.isFinite(bidPx) && Number.isFinite(askPx) && bidPx > 0 && askPx > 0) {
                const now = Date.now();
                queuePriceUpdate(String(data.data.coin), (bidPx + askPx) / 2, now, null);
                flushPricesThrottled(now);
              }
            }

            if (
              data.channel ===
                "activeAssetCtx" &&
              data.data?.coin
            ) {
              const payload =
                data.data;

              const coin =
                String(
                  payload.coin
                );

              const ctx =
                payload.ctx ??
                payload;

              const markPx =
                ctx?.markPx;

              const midPx =
                ctx?.midPx;

              const oraclePx =
                ctx?.oraclePx;

              const now =
                Date.now();

              assetCtxPending.current[
                coin
              ] = {
                coin,

                markPx:
                  markPx != null
                    ? String(markPx)
                    : undefined,

                midPx:
                  midPx != null
                    ? String(midPx)
                    : undefined,

                oraclePx:
                  oraclePx != null
                    ? String(oraclePx)
                    : undefined,

                time: now,

                ctx,
              };

              flushAssetCtxsThrottled(
                now
              );
            }

            if (
              data.channel === 'l2Book' &&
              data.data?.coin &&
              Array.isArray(
                data.data?.levels
              )
            ) {
              const [
                bidsRaw,
                asksRaw
              ] =
                data.data.levels as [
                  OrderBookLevel[],
                  OrderBookLevel[]
                ];

              const now =
                Date.now();

              const coinKey =
                data.data.coin;

              const lastUpdate =
                orderBookLastUpdate
                  .current[coinKey] ||
                0;

              const previousBook =
                orderBookPending
                  .current[coinKey] ??
                orderBooksRef
                  .current[coinKey];

              const newData:
                OrderBookData = {
                  coin: coinKey,

                  bids:
                    mergeOrderBookSide(
                      bidsRaw,
                      previousBook?.bids,
                      ORDER_BOOK_MAX_LEVELS
                    ),

                  asks:
                    mergeOrderBookSide(
                      asksRaw,
                      previousBook?.asks,
                      ORDER_BOOK_MAX_LEVELS
                    ),

                  time: now,
                };

              if (
                now - lastUpdate >=
                ORDER_BOOK_THROTTLE_MS
              ) {
                orderBookLastUpdate
                  .current[coinKey] =
                  now;

                orderBookPending
                  .current[coinKey] =
                  newData;

                setOrderBooks(
                  (prev) => ({
                    ...prev,
                    [coinKey]:
                      newData,
                  })
                );
              } else {
                orderBookPending
                  .current[coinKey] =
                  newData;
              }
            }

            if (
              data.channel === 'candle' &&
              data.data
            ) {
              const payload =
                data.data;

              const coin =
                payload?.coin;

              const interval =
                payload?.interval;

              const candlesArray =
                Array.isArray(payload)
                  ? payload
                  : Array.isArray(
                      payload?.candles
                    )
                    ? payload.candles
                    : null;

              if (
                coin &&
                interval &&
                Array.isArray(
                  candlesArray
                ) &&
                candlesArray.length > 0
              ) {
                const last =
                  candlesArray[
                    candlesArray.length -
                    1
                  ] as any;

                const timeRaw =
                  (last as any)?.t ??
                  (last as any)?.time ??
                  (last as any)
                    ?.timestamp;

                const timeNum =
                  Number(timeRaw);

                const time =
                  Number.isFinite(
                    timeNum
                  )
                    ? (
                        timeNum > 1e12
                          ? Math.floor(
                              timeNum /
                              1000
                            )
                          : timeNum >
                            1e10
                            ? Math.floor(
                                timeNum /
                                1000
                              )
                            : Math.floor(
                                timeNum
                              )
                      )
                    : null;

                const open =
                  parseFloat(
                    String(
                      (last as any)?.o ??
                      (last as any)?.open ??
                      ''
                    )
                  );

                const high =
                  parseFloat(
                    String(
                      (last as any)?.h ??
                      (last as any)?.high ??
                      ''
                    )
                  );

                const low =
                  parseFloat(
                    String(
                      (last as any)?.l ??
                      (last as any)?.low ??
                      ''
                    )
                  );

                const close =
                  parseFloat(
                    String(
                      (last as any)?.c ??
                      (last as any)?.close ??
                      ''
                    )
                  );

                const volume =
                  parseFloat(
                    String(
                      (last as any)?.v ??
                      (last as any)?.volume ??
                      '0'
                    )
                  );

                const trades =
                  Number(
                    (last as any)?.n ??
                    (last as any)?.trades ??
                    ''
                  );

                if (
                  Number.isFinite(
                    time ?? NaN
                  ) &&
                  Number.isFinite(open) &&
                  Number.isFinite(high) &&
                  Number.isFinite(low) &&
                  Number.isFinite(close)
                ) {
                  const key =
                    `${coin}|${interval}`;

                  setCandles(
                    (prev) => ({
                      ...prev,

                      [key]: {
                        coin,
                        interval,
                        time:
                          time as number,
                        open,
                        high,
                        low,
                        close,

                        volume:
                          Number.isFinite(
                            volume
                          )
                            ? volume
                            : 0,

                        trades:
                          Number.isFinite(
                            trades
                          )
                            ? trades
                            : undefined,
                      },
                    })
                  );
                }
              }
            }
          } catch {
          }
        };

        ws.onerror = () => {
          if (
            wsRef.current !== ws
          ) {
            return;
          }

          setConnectionStatus(
            "error",
          );
        };

        ws.onclose = () => {
          if (
            wsRef.current !== ws
          ) {
            return;
          }

          setIsConnected(false);

          setConnectionStatus(
            "disconnected",
          );

          wsRef.current = null;

          isSubscribed.current =
            false;

          stopHeartbeat();

          stopStalenessWatchdog();

          if (
            orderBookFlushInterval.current
          ) {
            clearInterval(
              orderBookFlushInterval.current
            );

            orderBookFlushInterval.current =
              null;
          }

          if (
            priceFlushTimeout.current
          ) {
            clearTimeout(
              priceFlushTimeout.current,
            );

            priceFlushTimeout.current =
              null;
          }

          if (
            assetCtxFlushTimeout.current
          ) {
            clearTimeout(
              assetCtxFlushTimeout.current
            );

            assetCtxFlushTimeout.current =
              null;
          }

          if (
            stableTimerRef.current
          ) {
            clearTimeout(
              stableTimerRef.current,
            );

            stableTimerRef.current =
              null;
          }

          if (
            typeof document !==
              "undefined" &&
            document.visibilityState ===
              "hidden"
          ) {
            return;
          }

          retryCount.current += 1;

          const delay = Math.min(
            RECONNECT_DELAY *
              Math.pow(
                2,
                retryCount.current -
                  1,
              ),
            60_000,
          );

          reconnectTimeoutRef.current =
            setTimeout(
              connect,
              delay,
            );
        };

        wsRef.current = ws;
      } catch {
        setConnectionStatus(
          "error",
        );
      }
    }, [
      flushAssetCtxsThrottled,
      flushPricesThrottled,
      queuePriceUpdate,
      reconcileBboSubs,
      sendSubscription,
      startHeartbeat,
      startStalenessWatchdog,
      stopHeartbeat,
      stopStalenessWatchdog,
    ]);

  const disconnect =
    useCallback(() => {
      if (
        reconnectTimeoutRef.current
      ) {
        clearTimeout(
          reconnectTimeoutRef.current,
        );

        reconnectTimeoutRef.current =
          null;
      }

      if (
        stableTimerRef.current
      ) {
        clearTimeout(
          stableTimerRef.current,
        );

        stableTimerRef.current =
          null;
      }

      if (
        orderBookFlushInterval.current
      ) {
        clearInterval(
          orderBookFlushInterval.current
        );

        orderBookFlushInterval.current =
          null;
      }

      if (
        priceFlushTimeout.current
      ) {
        clearTimeout(
          priceFlushTimeout.current,
        );

        priceFlushTimeout.current =
          null;
      }

      if (
        assetCtxFlushTimeout.current
      ) {
        clearTimeout(
          assetCtxFlushTimeout.current
        );

        assetCtxFlushTimeout.current =
          null;
      }

      stopHeartbeat();

      stopStalenessWatchdog();

      if (wsRef.current) {
        const ws =
          wsRef.current;

        wsRef.current = null;

        ws.close();
      }

      isSubscribed.current =
        false;

      setIsConnected(false);

      setConnectionStatus(
        "disconnected",
      );
    }, [
      stopHeartbeat,
      stopStalenessWatchdog,
    ]);

  const reconnect =
    useCallback(() => {
      retryCount.current = 0;

      disconnect();

      setTimeout(() => {
        connect();
      }, 100);
    }, [
      connect,
      disconnect,
    ]);

  useEffect(() => {
    forceReconnectRef.current =
      reconnect;
  }, [reconnect]);

  useEffect(() => {
    const onVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          disconnect();
        } else {
          retryCount.current = 0;
          connect();
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
    };
  }, [
    connect,
    disconnect,
  ]);

  useEffect(() => {
    const initTimeout =
      setTimeout(() => {
        connect();
      }, 500);

    return () => {
      clearTimeout(
        initTimeout,
      );

      disconnect();
    };
  }, []);

  const subscribeOrderBook =
    useCallback(
      (coin: string) => {
        if (!coin) return;

        orderBookSubs.current.add(
          coin
        );

        if (
          wsRef.current
            ?.readyState ===
          WebSocket.OPEN
        ) {
          sendOrderBookSubscription(
            wsRef.current,
            'subscribe',
            coin
          );
        }
      },
      [],
    );

  const unsubscribeOrderBook =
    useCallback(
      (coin: string) => {
        if (!coin) return;

        orderBookSubs.current.delete(
          coin
        );

        if (
          wsRef.current
            ?.readyState ===
          WebSocket.OPEN
        ) {
          sendOrderBookSubscription(
            wsRef.current,
            'unsubscribe',
            coin
          );
        }
      },
      [],
    );

  const subscribeCandle =
    useCallback(
      (
        coin: string,
        interval: string
      ) => {
        if (
          !coin ||
          !interval
        ) {
          return;
        }

        const key =
          `${coin}|${interval}`;

        candleSubs.current.add(
          key
        );

        if (
          wsRef.current
            ?.readyState ===
          WebSocket.OPEN
        ) {
          wsRef.current.send(
            JSON.stringify({
              method:
                'subscribe',
              subscription: {
                type:
                  'candle',
                coin,
                interval
              }
            })
          );
        }
      },
      [],
    );

  const unsubscribeCandle =
    useCallback(
      (
        coin: string,
        interval: string
      ) => {
        if (
          !coin ||
          !interval
        ) {
          return;
        }

        const key =
          `${coin}|${interval}`;

        candleSubs.current.delete(
          key
        );

        if (
          wsRef.current
            ?.readyState ===
          WebSocket.OPEN
        ) {
          wsRef.current.send(
            JSON.stringify({
              method:
                'unsubscribe',
              subscription: {
                type:
                  'candle',
                coin,
                interval
              }
            })
          );
        }
      },
      [],
    );

  const subscribePriceFlush =
    useCallback(
      (
        onStoreChange:
          () => void,
      ) => {
        priceListenersRef.current.add(
          onStoreChange,
        );

        return () => {
          priceListenersRef.current.delete(
            onStoreChange,
          );
        };
      },
      [],
    );

  // allMids covers every coin as a baseline; on top of that, refcount a `bbo`
  // subscription per requested coin so actively-watched coins (positions,
  // open orders, the traded coin) get block-speed price ticks. Call sites all
  // pass bounded lists (useLivePrices with position/order coins), so the sub
  // count stays small.
  const subscribe = useCallback((coins: string[]) => {
    sendSubscription();
    coins.filter(Boolean).forEach((coin) => {
      bboSubs.current.set(coin, (bboSubs.current.get(coin) ?? 0) + 1);
    });
    reconcileBboSubs();
  }, [reconcileBboSubs, sendSubscription]);

  const unsubscribe = useCallback((coins: string[]) => {
    coins.filter(Boolean).forEach((coin) => {
      const count = bboSubs.current.get(coin) ?? 0;
      if (count <= 1) {
        bboSubs.current.delete(coin);
        const wasActive = bboActive.current.delete(coin);
        if (wasActive && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            method: 'unsubscribe',
            subscription: { type: 'bbo', coin }
          }));
        }
      } else {
        bboSubs.current.set(coin, count - 1);
      }
    });
  }, []);

  const subscribeAssetCtx =
    useCallback(
      (
        coins: string[]
      ) => {
        const ws =
          wsRef.current;

        coins
          .filter(Boolean)
          .forEach(
            (coin) => {
              const count =
                assetCtxSubs
                  .current
                  .get(coin) ??
                0;

              assetCtxSubs.current
                .set(
                  coin,
                  count + 1
                );

              if (
                count === 0 &&
                ws?.readyState ===
                  WebSocket.OPEN
              ) {
                ws.send(
                  JSON.stringify({
                    method:
                      "subscribe",
                    subscription: {
                      type:
                        "activeAssetCtx",
                      coin,
                    },
                  })
                );
              }
            }
          );
      },
      [],
    );

  const unsubscribeAssetCtx =
    useCallback(
      (
        coins: string[]
      ) => {
        const ws =
          wsRef.current;

        coins
          .filter(Boolean)
          .forEach(
            (coin) => {
              const count =
                assetCtxSubs
                  .current
                  .get(coin) ??
                0;

              if (count <= 1) {
                assetCtxSubs.current
                  .delete(coin);

                if (
                  count === 1 &&
                  ws?.readyState ===
                    WebSocket.OPEN
                ) {
                  ws.send(
                    JSON.stringify({
                      method:
                        "unsubscribe",
                      subscription: {
                        type:
                          "activeAssetCtx",
                        coin,
                      },
                    })
                  );
                }
              } else {
                assetCtxSubs.current
                  .set(
                    coin,
                    count - 1
                  );
              }
            }
          );
      },
      [],
    );

  const subscribeAssetCtxFlush =
    useCallback(
      (
        onStoreChange:
          () => void
      ) => {
        assetCtxListenersRef.current
          .add(onStoreChange);

        return () => {
          assetCtxListenersRef.current
            .delete(
              onStoreChange
            );
        };
      },
      [],
    );

  const orderBookValue =
    useMemo(
      () => ({
        orderBooks,
        subscribeOrderBook,
        unsubscribeOrderBook,
      }),
      [
        orderBooks,
        subscribeOrderBook,
        unsubscribeOrderBook,
      ],
    );

  const candleValue =
    useMemo(
      () => ({
        candles,
        subscribeCandle,
        unsubscribeCandle,
      }),
      [
        candles,
        subscribeCandle,
        unsubscribeCandle,
      ],
    );

  const pricesRefValue =
    useMemo(
      () => ({
        pricesRef:
          stablePricesRef,
      }),
      [],
    );

  const assetCtxRefValue =
    useMemo(
      () => ({
        assetCtxsRef:
          stableAssetCtxsRef,
      }),
      [],
    );

  const pricesActionsValue = useMemo(
    () => ({ subscribe, unsubscribe, subscribeFlush: subscribePriceFlush }),
    [subscribe, unsubscribe, subscribePriceFlush],
  );

  const assetCtxActionsValue =
    useMemo(
      () => ({
        subscribeAssetCtx,
        unsubscribeAssetCtx,
        subscribeFlush:
          subscribeAssetCtxFlush,
      }),
      [
        subscribeAssetCtx,
        unsubscribeAssetCtx,
        subscribeAssetCtxFlush,
      ],
    );

  const statusValue =
    useMemo(
      () => ({
        isConnected,
        connectionStatus,
        reconnect,
      }),
      [
        isConnected,
        connectionStatus,
        reconnect,
      ],
    );

  return (
    <WebSocketStatusContext.Provider
      value={statusValue}
    >
      <PricesRefContext.Provider
        value={pricesRefValue}
      >
        <AssetCtxRefContext.Provider
          value={assetCtxRefValue}
        >
          <PricesActionsContext.Provider
            value={pricesActionsValue}
          >
            <OrderBookContext.Provider
              value={orderBookValue}
            >
              <CandleContext.Provider
                value={candleValue}
              >
                <AssetCtxActionsContext.Provider
                  value={
                    assetCtxActionsValue
                  }
                >
                  {children}
                </AssetCtxActionsContext.Provider>
              </CandleContext.Provider>
            </OrderBookContext.Provider>
          </PricesActionsContext.Provider>
        </AssetCtxRefContext.Provider>
      </PricesRefContext.Provider>
    </WebSocketStatusContext.Provider>
  );
}

function usePricesActions() {
  const context =
    useContext(
      PricesActionsContext,
    );

  if (
    context === undefined
  ) {
    throw new Error(
      "usePricesActions must be used within a WebSocketProvider",
    );
  }

  return context;
}

export function usePricesRef() {
  const context =
    useContext(
      PricesRefContext,
    );

  if (
    context === undefined
  ) {
    throw new Error(
      "usePricesRef must be used within a WebSocketProvider",
    );
  }

  return context.pricesRef;
}

function useAssetCtxActions() {
  const context =
    useContext(
      AssetCtxActionsContext
    );

  if (
    context === undefined
  ) {
    throw new Error(
      "useAssetCtxActions must be used within a WebSocketProvider"
    );
  }

  return context;
}

function useAssetCtxsRef() {
  const context =
    useContext(
      AssetCtxRefContext
    );

  if (
    context === undefined
  ) {
    throw new Error(
      "useAssetCtxsRef must be used within a WebSocketProvider"
    );
  }

  return context.assetCtxsRef;
}

export function useLiveAssetCtxs(
  coins: string[]
) {
  const {
    subscribeAssetCtx,
    unsubscribeAssetCtx,
    subscribeFlush,
  } =
    useAssetCtxActions();

  const assetCtxsRef =
    useAssetCtxsRef();

  const coinsKey =
    coins.join(",");

  const cacheRef =
    useRef<{
      coinsKey: string;
      map:
        Record<
          string,
          AssetCtxData
        >;
    }>({
      coinsKey: "",
      map:
        EMPTY_ASSET_CTXS,
    });

  useEffect(() => {
    const list =
      coinsKey
        ? coinsKey.split(",")
        : [];

    if (
      list.length === 0
    ) {
      return;
    }

    subscribeAssetCtx(
      list
    );

    return () =>
      unsubscribeAssetCtx(
        list
      );
  }, [
    coinsKey,
    subscribeAssetCtx,
    unsubscribeAssetCtx,
  ]);

  const getSnapshot =
    useCallback(() => {
      if (!coinsKey) {
        cacheRef.current = {
          coinsKey: "",
          map:
            EMPTY_ASSET_CTXS,
        };

        return EMPTY_ASSET_CTXS;
      }

      const list =
        coinsKey.split(",");

      const all =
        assetCtxsRef.current;

      const prev =
        cacheRef.current;

      if (
        prev.coinsKey ===
          coinsKey &&
        assetCtxSliceUnchanged(
          prev.map,
          all,
          list
        )
      ) {
        return prev.map;
      }

      const next =
        pickRecord(
          all,
          list
        );

      cacheRef.current = {
        coinsKey,
        map: next,
      };

      return next;
    }, [
      assetCtxsRef,
      coinsKey,
    ]);

  return useSyncExternalStore(
    subscribeFlush,
    getSnapshot,
    getSnapshot
  );
}

/**
 * Live prices for a coin list. Re-renders only when one of the subscribed
 * coins' price/time actually changes — not on every global mid flush.
 * Safe for PortfolioTabs with many positions/orders at once.
 */
export function useLivePrices(coins: string[]) {
  const { subscribe, unsubscribe, subscribeFlush } = usePricesActions();
  const pricesRef = usePricesRef();

  // Key the effect on CONTENT, not array identity — subscribe() now opens a
  // refcounted bbo sub per coin, so identity churn from a non-memoized caller
  // must not translate into WS subscribe/unsubscribe spam.
  const coinsKey = coins.join(',');
  const cacheRef = useRef<{ coinsKey: string; map: Record<string, PriceData> }>({
    coinsKey: '',
    map: EMPTY_PRICES,
  });

  useEffect(() => {
    const list = coinsKey ? coinsKey.split(',') : [];
    if (list.length === 0) return;
    subscribe(list);
    return () => unsubscribe(list);
  }, [coinsKey, subscribe, unsubscribe]);

  const getSnapshot = useCallback(() => {
    if (!coinsKey) {
      cacheRef.current = { coinsKey: '', map: EMPTY_PRICES };
      return EMPTY_PRICES;
    }
    const list = coinsKey.split(',');
    const all = pricesRef.current;
    const prev = cacheRef.current;
    if (prev.coinsKey === coinsKey && priceSliceUnchanged(prev.map, all, list)) {
      return prev.map;
    }
    const next = pickRecord(all, list);
    cacheRef.current = { coinsKey, map: next };
    return next;
  }, [coinsKey, pricesRef]);

  return useSyncExternalStore(subscribeFlush, getSnapshot, getSnapshot);
}

export function useLivePrice(
  coin: string,
) {
  const prices =
    useLivePrices(
      coin
        ? [coin]
        : [],
    );

  return coin
    ? prices[coin]
    : undefined;
}

export function useWebSocketStatus() {
  const context =
    useContext(
      WebSocketStatusContext,
    );

  if (
    context === undefined
  ) {
    throw new Error(
      "useWebSocketStatus must be used within a WebSocketProvider",
    );
  }

  return context;
}

export function useOrderBook(
  coin: string
) {
  const {
    orderBooks,
    subscribeOrderBook,
    unsubscribeOrderBook,
  } =
    useOrderBooks();

  useEffect(() => {
    if (!coin) return;

    subscribeOrderBook(
      coin
    );

    return () =>
      unsubscribeOrderBook(
        coin
      );
  }, [
    coin,
    subscribeOrderBook,
    unsubscribeOrderBook,
  ]);

  const orderBook =
    useMemo(
      () =>
        orderBooks[coin],
      [
        orderBooks,
        coin
      ]
    );

  return orderBook;
}

export function useOrderBooks() {
  const context =
    useContext(
      OrderBookContext
    );

  if (
    context === undefined
  ) {
    throw new Error(
      'useOrderBooks must be used within a WebSocketProvider'
    );
  }

  return context;
}

export function useLiveCandle(
  coin: string,
  interval: string
) {
  const {
    candles,
    subscribeCandle,
    unsubscribeCandle
  } =
    useCandles();

  useEffect(() => {
    if (
      !coin ||
      !interval
    ) {
      return;
    }

    subscribeCandle(
      coin,
      interval
    );

    return () =>
      unsubscribeCandle(
        coin,
        interval
      );
  }, [
    coin,
    interval,
    subscribeCandle,
    unsubscribeCandle
  ]);

  const key =
    `${coin}|${interval}`;

  return candles[key];
}

export function useCandles() {
  const context =
    useContext(
      CandleContext
    );

  if (
    context === undefined
  ) {
    throw new Error(
      'useCandles must be used within a WebSocketProvider'
    );
  }

  return context;
}


