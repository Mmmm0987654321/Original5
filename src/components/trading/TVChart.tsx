import { getLighterCandles } from "../../lib/lighterMarketData";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useQuery,
} from "@tanstack/react-query";
import {
  fetchCandles,
} from "../../lib/api";
import {
  useLiveCandle,
} from "../../providers/WebSocketProvider";
import { 
  TrendingUp, 
  RefreshCw, 
  Layers, 
  BarChart3, 
  Maximize2, 
  Minimize2, 
  Activity, 
  Check,
  ChevronDown,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import KLineChartPane from "./KLineChartPane";
import {
  ChartTimezone,
} from "./ChartTimezone";
import type {
  ChartPriceLine,
} from "../../lib/chartLines";
import {
  ALL_CANDLE_INTERVALS,
  CHART_STYLE_OPTIONS,
  getSavedChartInterval,
  saveChartInterval,
  getSavedChartMode,
  saveChartMode,
  getSavedChartTimezone,
  saveChartTimezone,
  getShowHighLow,
  saveShowHighLow,
  getShowOhlcv,
  saveShowOhlcv,
  getShowPositionLines,
  saveShowPositionLines,
  getShowTradeMarkers,
  saveShowTradeMarkers,
  intervalLabel,
  type CandleInterval,
  type ChartMode,
} from "../../lib/chartPrefs";
import {
  resolveChartTimezone,
} from "../../lib/chartTimezone";
import {
  INDICATOR_PREFS_EVENT,
  loadIndicatorPrefs,
  maxEnabledAveragePeriod,
} from "../../lib/indicatorPrefs";
import type {
  KlineTradeMarker,
} from "../../lib/klineTradeMarkers";
import type {
  TradeHistoryItem,
} from "../../types";

function normalizeTradeMarkerSymbol(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/-PERP$/i, "")
    .replace(/-SPOT$/i, "")
    .replace(/\/USDC$/i, "");
}

interface TVChartProps {
  symbol: string;
  marketCoin: string;
  isSpot?: boolean;
  currentPrice: number | null;
  high24h?: number | null;
  low24h?: number | null;
  volume24h?: number | null;
  fundingRate?: number | null;
  openInterest?: number | null;
  change24h?: number | null;
  priceLines?: ChartPriceLine[];
  tradeHistory?: TradeHistoryItem[];
  toolbarHostId?: string;
  lighterMarketId?: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INITIAL_CHART_BARS = 600;
const HISTORY_PAGE_BARS = 500;
const HYPERLIQUID_MAX_RECENT_CANDLES = 5000;

function TVChartComponent({ 
  symbol, 
  marketCoin,
  isSpot,
  currentPrice,
  high24h,
  low24h,
  volume24h,
  fundingRate,
  openInterest,
  change24h,
  priceLines,
  tradeHistory = [],
  toolbarHostId,
  lighterMarketId,
}: TVChartProps) {
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!toolbarHostId || typeof document === "undefined") {
      setToolbarHost(null);
      return;
    }

    setToolbarHost(document.getElementById(toolbarHostId));
  }, [toolbarHostId]);

  const [interval, setInterval] =
    useState<CandleInterval>(
      () =>
        getSavedChartInterval()
    );

  const [
    maxIndicatorPeriod,
    setMaxIndicatorPeriod,
  ] = useState(
    () =>
      maxEnabledAveragePeriod(
        loadIndicatorPrefs()
      )
  );

  useEffect(() => {
    const sync = () =>
      setMaxIndicatorPeriod(
        maxEnabledAveragePeriod(
          loadIndicatorPrefs()
        )
      );

    window.addEventListener(
      INDICATOR_PREFS_EVENT,
      sync
    );

    return () =>
      window.removeEventListener(
        INDICATOR_PREFS_EVENT,
        sync
      );
  }, []);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartType, setChartType] =
    useState<ChartMode>(
      () =>
        getSavedChartMode()
    );
  const [
    timezone,
    setTimezone,
  ] = useState(
    () =>
      resolveChartTimezone(
        getSavedChartTimezone()
      )
  );

  const [
    showHighLow,
    setShowHighLow,
  ] = useState(
    () =>
      getShowHighLow()
  );

  const [
    showOhlcv,
    setShowOhlcv,
  ] = useState(
    () =>
      getShowOhlcv()
  );

  const [
    showPositionLines,
    setShowPositionLines,
  ] = useState(
    () =>
      getShowPositionLines()
  );

  const [
    showTradeMarkers,
    setShowTradeMarkers,
  ] = useState(
    () =>
      getShowTradeMarkers()
  );

  const [
    timeframeMenuOpen,
    setTimeframeMenuOpen,
  ] = useState(false);

  const [
    chartDisplayMenu,
    setChartDisplayMenu,
  ] = useState<
    "timezone" |
    "settings" |
    null
  >(null);
  const [chartStylePickerOpen, setChartStylePickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [indicatorOpen, setIndicatorOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const isSpotMarket = isSpot === true || symbol.endsWith("-SPOT") || symbol.includes("/");

  const displayTicker = symbol.replace("-PERP", "").replace("-SPOT", "").replace("/USDC", "");

  const hlInterval =
    interval;

  const intervalMsValue =
    useMemo(() => {
      const intervalsMs:
        Record<string, number> = {
          "1m": 60000,
          "3m": 180000,
          "5m": 300000,
          "15m": 900000,
          "30m": 1800000,
          "1h": 3600000,
          "2h": 7200000,
          "4h": 14400000,
          "8h": 28800000,
          "12h": 43200000,
          "1d": 86400000,
          "3d": 259200000,
          "1w": 604800000,
          "1M": 2592000000,
        };

      return (
        intervalsMs[
          hlInterval
        ] ??
        3600000
      );
    }, [
      hlInterval
    ]);

  const initialHistoryBars =
    useMemo(() => {
      const indicatorBars =
        Math.max(
          1,
          Number.isFinite(
            maxIndicatorPeriod
          )
            ? Math.round(
                maxIndicatorPeriod
              )
            : 1
        ) +
        60 +
        200;

      return Math.min(
        1000,
        Math.max(
          INITIAL_CHART_BARS,
          indicatorBars
        )
      );
    }, [
      maxIndicatorPeriod,
    ]);

  const historyLookbackMs =
    useMemo(
      () =>
        initialHistoryBars *
        intervalMsValue,
      [
        initialHistoryBars,
        intervalMsValue,
      ]
    );

  const liveCandle =
    useLiveCandle(
      lighterMarketId !== undefined ? "" : marketCoin,
      hlInterval
    );

  const {
    data:
      candleData,
    isLoading:
      candlesLoading,
    isError: candlesError,
    error: candleFetchError,
  } =
    useQuery({
      queryKey: [
        "candles",
        lighterMarketId !== undefined ? "lighter" : "hyperliquid",
        lighterMarketId ?? marketCoin,
        hlInterval,
        initialHistoryBars,
        historyLookbackMs,
      ],

      queryFn:
        () => {
          const endTime =
            Date.now();

          const startTime =
            endTime -
            historyLookbackMs;

          return lighterMarketId !== undefined
            ? getLighterCandles(lighterMarketId, hlInterval, Math.max(startTime, endTime - 500 * intervalMsValue), endTime)
            : fetchCandles(marketCoin, hlInterval, initialHistoryBars, startTime, endTime);
        },

      enabled:
        lighterMarketId !== undefined || !!marketCoin,

      refetchInterval:
        lighterMarketId !== undefined ? 15_000 : false,

      refetchIntervalInBackground:
        false,

      gcTime:
        60_000,
    });

  const normalizeCandleTime =
    (
      raw: unknown
    ) => {
      const num =
        Number(raw);

      if (
        !Number.isFinite(
          num
        )
      ) {
        return null;
      }

      if (
        num > 1e12
      ) {
        return Math.floor(
          num / 1000
        );
      }

      if (
        num > 1e10
      ) {
        return Math.floor(
          num / 1000
        );
      }

      return Math.floor(
        num
      );
    };

  const mapApiCandles = (
    raw:
      any[]
  ): Candle[] => {
    const seen =
      new Set<number>();

    return raw
      .map((c) => {
        const time =
          normalizeCandleTime(
            c?.t
          );

        const open =
          parseFloat(
            String(c?.o ?? "")
          );

        const high =
          parseFloat(
            String(c?.h ?? "")
          );

        const low =
          parseFloat(
            String(c?.l ?? "")
          );

        const close =
          parseFloat(
            String(c?.c ?? "")
          );

        const volume =
          parseFloat(
            String(c?.v ?? "0")
          );

        if (
          !Number.isFinite(
            time ?? NaN
          ) ||
          !Number.isFinite(open) ||
          !Number.isFinite(high) ||
          !Number.isFinite(low) ||
          !Number.isFinite(close)
        ) {
          return null;
        }

        return {
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
        };
      })
      .filter(
        (
          candle
        ): candle is Candle =>
          candle !== null
      )
      .sort(
        (a, b) =>
          a.time -
          b.time
      )
      .filter(
        (candle) => {
          if (
            seen.has(
              candle.time
            )
          ) {
            return false;
          }

          seen.add(
            candle.time
          );

          return true;
        }
      );
  };

  const loadOlderCandles =
    useCallback(
      async (
        beforeTimestampMs:
          number
      ) => {
        if (
          (lighterMarketId === undefined && !marketCoin) ||
          !Number.isFinite(
            beforeTimestampMs
          )
        ) {
          return {
            candles: [],
            hasMore: false,
          };
        }

        const now =
          Date.now();

        const earliestAllowed =
          now -
          intervalMsValue *
            HYPERLIQUID_MAX_RECENT_CANDLES;

        const endTime =
          Math.floor(
            beforeTimestampMs
          ) -
          1;

        if (
          endTime <=
          earliestAllowed
        ) {
          return {
            candles: [],
            hasMore: false,
          };
        }

        const startTime =
          Math.max(
            earliestAllowed,
            endTime -
              intervalMsValue *
                HISTORY_PAGE_BARS
          );

        if (
          startTime >=
          endTime
        ) {
          return {
            candles: [],
            hasMore: false,
          };
        }

        const result =
          lighterMarketId !== undefined
            ? await getLighterCandles(lighterMarketId, hlInterval,
                Math.max(startTime, endTime - 500 * intervalMsValue), endTime)
            : await fetchCandles(marketCoin, hlInterval, HISTORY_PAGE_BARS, startTime, endTime);

        const page =
          mapApiCandles(
            result?.candles ??
            []
          );

        const oldestMs =
          page.length
            ? page[0].time *
              1000
            : endTime;

        return {
          candles:
            page,

          hasMore:
            page.length >
              0 &&
            oldestMs >
              earliestAllowed +
                intervalMsValue,
        };
      },
      [
        marketCoin,
        lighterMarketId,
        hlInterval,
        intervalMsValue,
      ]
    );

  useEffect(() => {
    const raw =
      candleData?.candles ??
      [];

    setCandles(
      mapApiCandles(
        raw
      )
    );
  }, [
    candleData?.candles,
  ]);

  useEffect(() => {
    if (
      !liveCandle
    ) {
      return;
    }

    const time =
      normalizeCandleTime(
        liveCandle.time
      );

    const open =
      Number(
        liveCandle.open
      );

    const high =
      Number(
        liveCandle.high
      );

    const low =
      Number(
        liveCandle.low
      );

    const close =
      Number(
        liveCandle.close
      );

    const volume =
      Number(
        liveCandle.volume
      );

    if (
      !Number.isFinite(
        time ?? NaN
      ) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      return;
    }

    const nextCandle:
      Candle = {
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
      };

    setCandles(
      (prev) => {
        if (
          prev.length === 0
        ) {
          return prev;
        }

        const last =
          prev[
            prev.length - 1
          ];

        if (
          nextCandle.time <
          last.time
        ) {
          return prev;
        }

        if (
          nextCandle.time ===
          last.time
        ) {
          const merged = {
            ...last,

            high:
              Math.max(
                last.high,
                nextCandle.high
              ),

            low:
              Math.min(
                last.low,
                nextCandle.low
              ),

            close:
              nextCandle.close,

            volume:
              Math.max(
                last.volume,
                nextCandle.volume
              ),
          };

          return [
            ...prev.slice(
              0,
              -1
            ),
            merged,
          ];
        }

        return [
          ...prev,
          nextCandle,
        ];
      }
    );
  }, [
    liveCandle
  ]);

  useEffect(() => {
    if (
      typeof currentPrice !==
        "number" ||
      !Number.isFinite(
        currentPrice
      ) ||
      currentPrice <= 0
    ) {
      return;
    }

    const intervalSec =
      Math.max(
        1,
        Math.floor(
          intervalMsValue /
          1000
        )
      );

    const nowSec =
      Math.floor(
        Date.now() /
        1000
      );

    const barTime =
      Math.floor(
        nowSec /
        intervalSec
      ) *
      intervalSec;

    const px =
      currentPrice;

    setCandles(
      (prev) => {
        if (
          prev.length === 0
        ) {
          return prev;
        }

        const last =
          prev[
            prev.length - 1
          ];

        if (
          last.time ===
          barTime
        ) {
          const merged:
            Candle = {
            ...last,

            open:
              Number.isFinite(
                last.open
              )
                ? last.open
                : px,

            high:
              Number.isFinite(
                last.high
              )
                ? Math.max(
                    last.high,
                    px
                  )
                : px,

            low:
              Number.isFinite(
                last.low
              )
                ? Math.min(
                    last.low,
                    px
                  )
                : px,

            close:
              px,

            volume:
              Number.isFinite(
                last.volume
              )
                ? last.volume
                : 0,
          };

          return [
            ...prev.slice(
              0,
              -1
            ),
            merged,
          ];
        }

        if (
          last.time <
          barTime
        ) {
          return [
            ...prev,

            {
              time:
                barTime,
              open:
                px,
              high:
                px,
              low:
                px,
              close:
                px,
              volume:
                0,
            },
          ];
        }

        return prev;
      }
    );
  }, [
    currentPrice,
    intervalMsValue
  ]);

  const tradeMarkers = useMemo<KlineTradeMarker[]>(() => {
    if (
      !Array.isArray(tradeHistory) ||
      !tradeHistory.length ||
      !Array.isArray(candles) ||
      !candles.length
    ) {
      return [];
    }

    const normSymbol = normalizeTradeMarkerSymbol(symbol);
    const normDisplay = normalizeTradeMarkerSymbol(displayTicker);
    const normMarketCoin = normalizeTradeMarkerSymbol(marketCoin);

    const candidates = new Set<string>();
    if (normSymbol) candidates.add(normSymbol);
    if (normDisplay) candidates.add(normDisplay);
    if (normMarketCoin) {
      candidates.add(normMarketCoin);
      if (normMarketCoin.includes(":")) {
        const tail = normMarketCoin.split(":").pop()?.trim();
        if (tail) candidates.add(tail);
      }
    }

    const candleBars: Array<{
      timeMs: number;
      low: number;
      high: number;
    }> = [];

    for (const c of candles) {
      if (!c) continue;
      const rawTime = Number(c.time);
      if (!Number.isFinite(rawTime) || rawTime <= 0) continue;
      const timeMs = rawTime < 1e12 ? rawTime * 1000 : rawTime;
      const low = Number(c.low);
      const high = Number(c.high);
      if (
        !Number.isFinite(low) ||
        !Number.isFinite(high) ||
        low <= 0 ||
        high <= 0
      ) {
        continue;
      }
      candleBars.push({
        timeMs,
        low,
        high,
      });
    }

    if (!candleBars.length) return [];

    // Find the LAST candle where candle.timeMs <= fillMs
    const findCandleForFill = (fillMs: number) => {
      let low = 0;
      let high = candleBars.length - 1;
      let bestIdx = -1;

      while (low <= high) {
        const mid = (low + high) >> 1;
        if (candleBars[mid].timeMs <= fillMs) {
          bestIdx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      return bestIdx >= 0 ? candleBars[bestIdx] : null;
    };

    const validEntries: Array<{
      fillMs: number;
      marker: KlineTradeMarker;
    }> = [];

    for (const trade of tradeHistory) {
      if (!trade) continue;

      // Spot / Perp check
      const tradeIsSpot = trade.isSpot === true;
      if (tradeIsSpot !== isSpotMarket) {
        continue;
      }

      // Symbol matching
      const rawTradeSym = normalizeTradeMarkerSymbol(trade.symbol);
      let matches = candidates.has(rawTradeSym);
      if (!matches && rawTradeSym.includes(":")) {
        const tail = rawTradeSym.split(":").pop()?.trim();
        if (tail && candidates.has(tail)) {
          matches = true;
        }
      }
      if (!matches) {
        continue;
      }

      // Real timestampMs only
      let fillMs = Number(trade.timestampMs);
      if (!Number.isFinite(fillMs) || fillMs <= 0) {
        continue;
      }
      if (fillMs < 1e12) {
        fillMs *= 1000;
      }

      // Real price only
      const fillPrice = Number(trade.price);
      if (!Number.isFinite(fillPrice) || fillPrice <= 0) {
        continue;
      }

      // Side
      const rawSide = String(trade.side || "").toUpperCase();
      let side: "BUY" | "SELL";
      if (rawSide === "BUY" || rawSide === "LONG") {
        side = "BUY";
      } else if (rawSide === "SELL" || rawSide === "SHORT") {
        side = "SELL";
      } else {
        continue;
      }

      // Find matching candle
      const candle = findCandleForFill(fillMs);
      if (!candle) {
        continue;
      }

      const value = side === "BUY" ? candle.low : candle.high;
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }

      validEntries.push({
        fillMs,
        marker: {
          id: String(trade.id),
          timestamp: candle.timeMs,
          value,
          side,
          fillPrice,
        },
      });
    }

    validEntries.sort((a, b) => a.fillMs - b.fillMs);
    const last80 = validEntries.slice(-80);
    return last80.map((e) => e.marker);
  }, [
    tradeHistory,
    candles,
    symbol,
    displayTicker,
    marketCoin,
    isSpotMarket,
  ]);

  const quickIntervals:
    CandleInterval[] = [
      "1m",
      "5m",
      "15m",
      "1h",
      "4h",
      "1d",
    ];

  const intervals =
    quickIntervals.includes(
      interval
    )
      ? quickIntervals
      : [
          interval,
          ...quickIntervals,
        ];

  const [userHeight, setUserHeight] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_chart_height");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 240 && parsed <= 800) return parsed;
      }
      if (window.innerWidth < 640) return 280;
    }
    return 380;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleHeightChange = (newH: number) => {
    const clamped = Math.min(Math.max(newH, 240), 800);
    setUserHeight(clamped);
    localStorage.setItem("user_chart_height", clamped.toString());
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = userHeight;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 240), 800);
      setUserHeight(newHeight);
      localStorage.setItem("user_chart_height", newHeight.toString());
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Chart rendering bounds
  const chartHeight = isFullscreen ? 580 : userHeight;

  const hasCandles = Array.isArray(candles) && candles.length > 0;

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toolbarControls = (
    <div className="w-full min-w-0 flex flex-nowrap items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none select-none text-xs py-0.5">
      <div className="w-full min-w-max flex flex-nowrap items-center justify-between gap-1 sm:gap-1.5">
        {/* Timeframe intervals: 5m, 15m, ... ▾ */}
        <div className="relative flex items-center gap-0.5 bg-brand-surface p-0.5 rounded-lg border border-brand-border shrink-0">
          <button
            type="button"
            onClick={() => {
              setInterval("5m");
              saveChartInterval("5m");
            }}
            className={`shrink-0 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
              interval === "5m"
                ? "border border-accent text-accent bg-accent/10 font-bold"
                : "text-brand-text hover:bg-brand-card"
            }`}
          >
            5m
          </button>

          <button
            type="button"
            onClick={() => {
              setInterval("15m");
              saveChartInterval("15m");
            }}
            className={`shrink-0 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
              interval === "15m"
                ? "border border-accent text-accent bg-accent/10 font-bold"
                : "text-brand-text hover:bg-brand-card"
            }`}
          >
            15m
          </button>

          <div className="h-3 w-px bg-brand-border/60 mx-0.5" />

          <button
            type="button"
            title="Choose chart timeframes"
            aria-expanded={timeframeMenuOpen}
            onClick={() => {
              setChartDisplayMenu(null);
              setTimeframeMenuOpen((open) => !open);
            }}
            className={`shrink-0 rounded-md px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 sm:gap-1 cursor-pointer ${
              timeframeMenuOpen || (interval !== "5m" && interval !== "15m")
                ? "border border-accent text-accent bg-accent/10"
                : "text-brand-text hover:bg-brand-card"
            }`}
          >
            <span>...</span>
            <span className="text-[8px] sm:text-[9px]">▼</span>
          </button>

          {timeframeMenuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close timeframes"
                onClick={() => setTimeframeMenuOpen(false)}
                className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[1px] touch-none sm:hidden"
              />

              <div className="fixed inset-x-0 bottom-0 z-[80] w-full rounded-t-2xl border border-b-0 border-brand-border bg-brand-bg p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl sm:absolute sm:left-0 sm:top-full sm:bottom-auto sm:z-40 sm:mt-1 sm:w-64 sm:max-w-[calc(100vw-1rem)] sm:rounded-xl sm:border-b sm:p-2">
                <div className="mb-3 flex items-center sm:hidden">
                  <span className="text-[14px] font-bold text-brand-text">
                    Timeframe
                  </span>

                  <button
                    type="button"
                    aria-label="Close timeframes"
                    onClick={() => setTimeframeMenuOpen(false)}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-sub hover:bg-brand-overlay-normal hover:text-brand-text"
                  >
                    <X size={17} />
                  </button>
                </div>

                <p className="mb-1.5 px-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-text">
                  Timeframes
                </p>

                <div className="grid grid-cols-4 gap-1">
                  {ALL_CANDLE_INTERVALS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setInterval(id);
                        saveChartInterval(id);
                        setTimeframeMenuOpen(false);
                        setChartDisplayMenu(null);
                      }}
                      className={`rounded-md px-1.5 py-1 text-[10px] font-semibold cursor-pointer transition-colors border ${
                        interval === id
                          ? "bg-accent/10 text-accent font-bold border-accent/40"
                          : "bg-brand-surface text-brand-text border-brand-border/50 hover:bg-brand-overlay-normal"
                      }`}
                    >
                      {id === "1d" ? "1D" : intervalLabel(id)}
                    </button>
                  ))}
                </div>

                <p className="mt-2 px-0.5 text-[9px] text-brand-sub">
                  Choose one active chart timeframe.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Single Chart Type Button & Picker */}
        <div className="relative shrink-0">
          <button
            type="button"
            aria-expanded={chartStylePickerOpen}
            onClick={() => {
              setTimeframeMenuOpen(false);
              setChartDisplayMenu(null);
              setChartStylePickerOpen((current) => !current);
            }}
            className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-0.5 ${
              chartStylePickerOpen
                ? "bg-brand-overlay-active text-accent"
                : "text-brand-sub hover:text-brand-text hover:bg-brand-overlay-normal"
            }`}
            title={`Chart type: ${CHART_STYLE_OPTIONS.find((o) => o.id === chartType)?.label || "Candles"}`}
          >
            <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <ChevronDown className="w-2.5 h-2.5 text-brand-muted" />
          </button>

          {chartStylePickerOpen ? (
            <>
              <button
                type="button"
                aria-label="Close chart style picker"
                onClick={() => setChartStylePickerOpen(false)}
                className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[1px] touch-none sm:hidden"
              />

              <div className="fixed inset-x-0 bottom-0 z-[80] w-full max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-b-0 border-brand-border bg-brand-bg p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-50 sm:mt-1 sm:w-56 sm:max-h-[70vh] sm:rounded-xl sm:border-b sm:p-2 sm:shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] sm:text-[12px] font-bold text-brand-text">
                    Chart Type
                  </span>
                  <button
                    type="button"
                    aria-label="Close chart style picker"
                    onClick={() => setChartStylePickerOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand-sub hover:bg-brand-overlay-normal hover:text-brand-text cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="space-y-1">
                  {CHART_STYLE_OPTIONS.map((opt) => {
                    const isSelected = chartType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setChartType(opt.id);
                          saveChartMode(opt.id);
                          setChartStylePickerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] sm:text-[11px] font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-brand-overlay-active text-accent font-semibold"
                            : "text-brand-text hover:bg-brand-overlay-normal hover:text-brand-text"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className={`w-3.5 h-3.5 ${isSelected ? "text-accent" : "text-brand-sub"}`} />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Timezone */}
        <div className="shrink-0">
          <ChartTimezone
            timezone={timezone}
            open={chartDisplayMenu === "timezone"}
            onToggle={() => {
              setTimeframeMenuOpen(false);
              setChartDisplayMenu((current) => current === "timezone" ? null : "timezone");
            }}
            onPick={(id) => {
              saveChartTimezone(id);
              setTimezone(id);
              setChartDisplayMenu(null);
            }}
          />
        </div>

        {/* Settings */}
        <div className="relative shrink-0">
          <button
            type="button"
            title="Chart display settings"
            aria-expanded={chartDisplayMenu === "settings"}
            onClick={() => {
              setTimeframeMenuOpen(false);
              setChartDisplayMenu((current) => current === "settings" ? null : "settings");
            }}
            className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
              chartDisplayMenu === "settings"
                ? "bg-brand-overlay-active text-accent"
                : "text-brand-sub hover:text-brand-text hover:bg-brand-overlay-normal"
            }`}
          >
            <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          {chartDisplayMenu === "settings" ? (
            <>
              <button
                type="button"
                aria-label="Close chart settings"
                onClick={() => setChartDisplayMenu(null)}
                className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[1px] touch-none sm:hidden"
              />

              <div className="fixed inset-x-0 bottom-0 z-[80] w-full rounded-t-2xl border border-b-0 border-brand-border bg-brand-bg p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-50 sm:mt-1 sm:w-56 sm:rounded-xl sm:border-b sm:p-2">
                <div className="mb-2 flex items-center sm:hidden">
                  <span className="text-[14px] font-bold text-brand-text">
                    Chart display
                  </span>

                  <button
                    type="button"
                    aria-label="Close chart settings"
                    onClick={() => setChartDisplayMenu(null)}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-sub hover:bg-brand-overlay-normal hover:text-brand-text"
                  >
                    <X size={17} />
                  </button>
                </div>

                <p className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wider text-brand-muted">
                  Display
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showHighLow;
                    saveShowHighLow(next);
                    setShowHighLow(next);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] hover:bg-brand-overlay-normal cursor-pointer"
                >
                  <span className="text-brand-sub">High / low labels</span>
                  <span className={showHighLow ? "font-bold text-accent" : "font-semibold text-brand-muted"}>
                    {showHighLow ? "On" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showOhlcv;
                    saveShowOhlcv(next);
                    setShowOhlcv(next);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] hover:bg-brand-overlay-normal cursor-pointer"
                >
                  <span className="text-brand-sub">OHLCV values</span>
                  <span className={showOhlcv ? "font-bold text-accent" : "font-semibold text-brand-muted"}>
                    {showOhlcv ? "On" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showPositionLines;
                    saveShowPositionLines(next);
                    setShowPositionLines(next);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] hover:bg-brand-overlay-normal cursor-pointer"
                >
                  <span className="text-brand-sub">Positions & orders</span>
                  <span className={showPositionLines ? "font-bold text-accent" : "font-semibold text-brand-muted"}>
                    {showPositionLines ? "On" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showTradeMarkers;
                    saveShowTradeMarkers(next);
                    setShowTradeMarkers(next);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] hover:bg-brand-overlay-normal cursor-pointer"
                >
                  <span className="text-brand-sub">Trade markers</span>
                  <span className={showTradeMarkers ? "font-bold text-accent" : "font-semibold text-brand-muted"}>
                    {showTradeMarkers ? "On" : "Off"}
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* Fullscreen toggle */}
        <button 
          type="button"
          onClick={toggleFullscreen}
          className="p-1 sm:p-1.5 rounded-lg text-brand-sub hover:text-brand-text hover:bg-brand-overlay-normal cursor-pointer transition-colors shrink-0"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Chart"}
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" /> : <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
        </button>

        {/* Separator before Indicators */}
        <div className="h-3 sm:h-4 w-px bg-brand-border/60 mx-0.5 shrink-0" />

        {/* Indicators button */}
        <button
          type="button"
          title="Indicators"
          onClick={() => setIndicatorOpen(true)}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-brand-surface hover:bg-brand-card border border-brand-border rounded-lg text-[10px] sm:text-[11px] font-semibold text-brand-text transition-colors cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Indicators</span>
        </button>
      </div>
    </div>
  );

  return (
    <div 
      ref={containerRef}
      className={`bg-brand-bg/80 border border-brand-border rounded-2xl p-1 sm:p-1.5 overflow-visible flex flex-col justify-between transition-all duration-300 ${
        isFullscreen 
          ? "fixed inset-2 z-50 bg-brand-bg/95 shadow-2xl border-[#003868]" 
          : "relative"
      }`}
      id="tradingview-chart-container"
    >
      {/* Fullscreen header controls bar */}
      {isFullscreen && (
        <div className="border-b border-brand-border pb-1.5 mb-1.5">
          {toolbarControls}
        </div>
      )}

      {/* Portaled toolbar when not fullscreen */}
      {!isFullscreen && toolbarHost && createPortal(toolbarControls, toolbarHost)}

      {/* Main Chart Area */}
      <div className="relative w-full flex-grow flex items-center justify-center bg-black/10 rounded-2xl overflow-hidden" style={{ height: `${chartHeight}px` }}>
        
        {/* Top-Left Market Badge: BTC/USDC + 24H Percentage Change */}
        <div className="absolute top-11 sm:top-12 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-surface/85 border border-brand-border/50 pointer-events-none select-none" id="tvchart-top-left-market-label">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-brand-text">
            {displayTicker}/USDC
          </span>
          {typeof change24h === "number" && Number.isFinite(change24h) ? (
            <span className={`text-[9px] sm:text-[10px] font-mono font-bold ${
              change24h > 0 ? "text-[#2DC08E]" : change24h < 0 ? "text-[#F92855]" : "text-gray-400"
            }`}>
              {change24h > 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          ) : (
            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-400">
              --
            </span>
          )}
        </div>

        {/* Skeleton loading state */}
        {candlesLoading ? (
          <div className="absolute inset-0 bg-brand-surface/90 flex flex-col items-center justify-center space-y-3 z-20">
            <Activity className="w-8 h-8 text-accent animate-spin" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Compiling contract feeds...</span>
          </div>
        ) : !hasCandles ? (
          /* Neutral No-Candle Placeholder */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 font-mono text-xs z-10">
            <Activity className="w-5 h-5 text-gray-600 mb-1 animate-pulse" />
            <span className="text-center px-3">{candlesError
              ? `Candle history unavailable: ${candleFetchError instanceof Error ? candleFetchError.message : "exchange API error"}`
              : "No recent exchange candles available for this market and interval"}</span>
          </div>
        ) : (
          <div className="relative h-full w-full">
            <KLineChartPane
              candles={candles}
              interval={interval}
              symbol={displayTicker}
              drawingStorageKey={lighterMarketId !== undefined ? `lighter:${lighterMarketId}:${symbol}` : symbol}
              timezone={timezone}
              chartMode={chartType}
              showHighLow={showHighLow}
              showOhlcv={showOhlcv}
              lines={
                isSpotMarket
                  ? []
                  : priceLines
              }
              showLines={
                !isSpotMarket &&
                showPositionLines
              }
              tradeMarkers={tradeMarkers}
              showTradeMarkers={showTradeMarkers}
              loadOlderCandles={
                loadOlderCandles
              }
              indicatorsOpen={indicatorOpen}
              onIndicatorsOpenChange={setIndicatorOpen}
            />
          </div>
        )}
      </div>

      {/* Drag-to-Resize Handle Bar (Interactive Drag Bar) */}
      {!isFullscreen && (
        <div
          onPointerDown={handlePointerDown}
          className="w-full py-1.5 my-0.5 flex items-center justify-center cursor-ns-resize group hover:bg-violet-500/20 active:bg-violet-500/30 rounded-lg transition-all select-none border border-brand-border/40 hover:border-violet-500/50 touch-none"
          title="Click and drag up/down to adjust chart height"
        >
          <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 group-hover:text-white transition-colors">
            <span className="text-[8px] font-bold">▲</span>
            <div className="w-24 h-1.5 bg-gray-700 group-hover:bg-violet-500 rounded-full transition-colors flex items-center justify-center shadow-xs">
              <div className="w-8 h-0.5 bg-gray-300 group-hover:bg-white rounded-full" />
            </div>
            <span className="text-[8px] font-bold">▼</span>
            <span className="hidden sm:inline text-[9px] text-gray-400 group-hover:text-violet-300 font-semibold ml-1">
              {isResizing ? `${userHeight}px` : "Drag height"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TVChartComponent);
