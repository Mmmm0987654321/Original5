/**
 * HideDex Lighter mainnet market-data adapter.
 * Public/read-only routes only. No keys, signing, execution, simulated balances,
 * synthetic PnL, or Hyperliquid data is ever sent through this adapter.
 * Reference: https://apidocs.lighter.xyz/docs/market-data
 */
export const LIGHTER_MAINNET = "https://mainnet.zklighter.elliot.ai";
export const LIGHTER_MAINNET_WS = "wss://mainnet.zklighter.elliot.ai/stream?readonly=true";

export type LighterMarket = {
  id: number;
  symbol: string;
  kind: "perp" | "spot";
  priceDecimals: number;
  sizeDecimals: number;
  maxLeverage: number | null;
  /** Official market maintenance threshold in basis points. */
  maintenanceMarginFractionBps: number | null;
  multiplier: number;
  lastTradePrice: number | null;
  /** Verified Lighter orderBookDetails mark_price; snapshot at last market refresh. */
  markPrice?: number | null;
  volume24hUsd: number | null;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
};
export type LighterLevel = { price: string; size: string };
export type LighterMarketFeed = {
  status: "connecting" | "live" | "disconnected";
  bids: LighterLevel[];
  asks: LighterLevel[];
  recentTradePrice: string | null;
};

type JsonRecord = Record<string, unknown>;
const record = (v: unknown): JsonRecord | null =>
  v && typeof v === "object" && !Array.isArray(v) ? v as JsonRecord : null;
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const finite = (v: unknown): number | null => {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (typeof v === "string" && !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function lighterPublicGet(path: string, signal?: AbortSignal): Promise<JsonRecord> {
  const response = await fetch(`${LIGHTER_MAINNET}${path}`, {
    method: "GET", signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Lighter API error ${response.status}`);
  const data = record(await response.json());
  if (!data || (typeof data.code === "number" && data.code !== 200))
    throw new Error("Invalid Lighter API response");
  return data;
}

export async function getLighterMarkets(signal?: AbortSignal): Promise<LighterMarket[]> {
  const data = await lighterPublicGet("/api/v1/orderBookDetails", signal);
  const result: LighterMarket[] = [];
  const add = (entry: unknown, kind: "perp" | "spot") => {
    const obj = record(entry);
    if (!obj || String(obj.status ?? "active").toLowerCase() !== "active") return;
    const id = finite(obj.market_id);
    const symbol = typeof obj.symbol === "string" ? obj.symbol.trim() : "";
    const pd = finite(obj.price_decimals);
    const sd = finite(obj.size_decimals);
    // Do not trade markets with unknown identifiers or numerical scaling.
    if (id === null || !Number.isInteger(id) || id < 0 || !symbol ||
        pd === null || sd === null || pd < 0 || sd < 0) return;
    const mult = finite(obj.multiplier);
    const f = finite(obj.min_initial_margin_fraction);
    const maintenanceFraction=finite(obj.maintenance_margin_fraction);
    const maxLeverage = kind === "perp" && f !== null && f > 0 && f <= 10000 ? Math.floor(10000 / f) : null;
    result.push({ id, symbol, kind, priceDecimals: pd, sizeDecimals: sd, maxLeverage,
      maintenanceMarginFractionBps:kind==="perp"&&maintenanceFraction!==null&&
        maintenanceFraction>0&&maintenanceFraction<10000?maintenanceFraction:null,
      multiplier: mult !== null && mult > 0 ? mult : 1,
      lastTradePrice: finite(obj.last_trade_price),
      markPrice: finite(obj.mark_price),
      volume24hUsd: finite(obj.daily_quote_token_volume),
      change24h: finite(obj.daily_price_change),
      high24h: finite(obj.daily_price_high),
      low24h: finite(obj.daily_price_low),
    });
  };
  list(data.order_book_details).forEach(m => add(m, "perp"));
  list(data.spot_order_book_details).forEach(m => add(m, "spot"));
  if (!result.length) throw new Error("Lighter returned no verifiable active markets");
  return result.sort((x, y) => x.kind.localeCompare(y.kind) || (y.volume24hUsd ?? -1) - (x.volume24hUsd ?? -1) || x.symbol.localeCompare(y.symbol));
}


/** Lighter mainnet OHLC only. Time query is seconds; returned candle t is ms. */
export async function getLighterCandles(
  marketId: number, resolution: string, startMs: number, endMs: number,
  signal?: AbortSignal
): Promise<{ candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> }> {
  if (!Number.isSafeInteger(marketId) || marketId < 0) throw new Error("Invalid Lighter market");
  const direct = new Set(["1m","5m","15m","30m","1h","4h","12h","1d","1w"]);
  const aggregateFrom: Record<string, string> = {
    "3m": "1m", "2h": "1h", "8h": "4h", "3d": "1d", "1M": "1d",
  };
  if (!direct.has(resolution) && !aggregateFrom[resolution]) {
    throw new Error("Unsupported Lighter chart timeframe: " + resolution);
  }
  // No relabeling: unsupported native intervals are aggregated from real Lighter OHLC.
  const validRes = aggregateFrom[resolution] ?? resolution;
  const end = Math.floor(endMs / 1000);
  const start = Math.max(0, Math.floor(startMs / 1000));
  if (end <= start) return { candles: [] };
  const spanSeconds = Math.max(60, end - start);

  type NormalizedCandle = { t: number; o: number; h: number; l: number; c: number; v: number };
  const loadWindow = async (from: number): Promise<NormalizedCandle[]> => {
    const query = new URLSearchParams({
      market_id: String(marketId),
      resolution: validRes,
      start_timestamp: String(from),
      end_timestamp: String(end),
      count_back: "500",
    });
    const data = await lighterPublicGet(`/api/v1/candles?${query.toString()}`, signal);
    const unique = new Map<number, NormalizedCandle>();
    for (const raw of list(data.c)) {
      const v = record(raw); if (!v) continue;
      const t = finite(v.t), o = finite(v.o), h = finite(v.h),
        l = finite(v.l), c = finite(v.c), vol = finite(v.v);
      if (t === null || o === null || h === null || l === null || c === null ||
          o <= 0 || h <= 0 || l <= 0 || c <= 0 || h < l) continue;
      if (t <= 0) continue;
      unique.set(t, { t, o, h, l, c, v: vol !== null && vol >= 0 ? vol : 0 });
    }
    return [...unique.values()].sort((x,y) => x.t-y.t).slice(-500);
  };

  // Low-volume Lighter markets can have fewer than two 5m bars in a short
  // window. Expand the REAL exchange OHLC lookback instead of generating or
  // copying Hyperliquid candles. This also avoids a chart with indicators
  // from older data but zero visible candlesticks.
  let candles = await loadWindow(start);
  if (candles.length < 30) {
    const earliest = Math.max(0, end - 90 * 86400);
    for (const factor of [6, 24]) {
      const from = Math.max(earliest, end - spanSeconds * factor);
      if (from >= start || from >= end) continue;
      const extended = await loadWindow(from);
      if (extended.length > candles.length) candles = extended;
      if (candles.length >= 30) break;
    }
  }
  if (!aggregateFrom[resolution]) return { candles };

  const intervalMs: Record<string, number> = {
    "3m": 180_000, "2h": 7_200_000, "8h": 28_800_000, "3d": 259_200_000,
  };
  const groupTime = (t: number) => {
    if (resolution === "1M") {
      const d = new Date(t);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    return Math.floor(t / intervalMs[resolution]) * intervalMs[resolution];
  };
  const grouped = new Map<number, NormalizedCandle>();
  for (const item of candles) {
    const time = groupTime(item.t);
    const old = grouped.get(time);
    if (!old) grouped.set(time, { ...item, t: time });
    else grouped.set(time, {
      t: time, o: old.o, h: Math.max(old.h, item.h),
      l: Math.min(old.l, item.l), c: item.c, v: old.v + item.v,
    });
  }
  // Only real, returned exchange bars contribute. Missing candles are never invented.
  return { candles: [...grouped.values()].sort((a, b) => a.t - b.t) };
}

export async function getLighterAccountIndexes(walletAddress: string, signal?: AbortSignal): Promise<number[]> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return [];
  const r = await fetch(
    `${LIGHTER_MAINNET}/api/v1/accountsByL1Address?l1_address=${encodeURIComponent(walletAddress)}`,
    { signal, headers: { Accept: "application/json" } }
  );
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`Lighter accounts lookup HTTP ${r.status}`);
  const d = record(await r.json());
  if (!d) throw new Error("Invalid Lighter account response");
  if (d.code === 21100) return [];
  if (typeof d.code === "number" && d.code !== 200)
    throw new Error(`Lighter account lookup failed: ${d.code}`);
  const found = new Set<number>();
  const read = (obj: unknown) => {
    const o = record(obj);
    const id = finite(o ? (o.index ?? o.account_index) : obj);
    if (id !== null && Number.isInteger(id) && id >= 0) found.add(id);
  };
  list(d.sub_accounts ?? d.accounts).forEach(read);
  if (d.master_account) read(d.master_account);
  return [...found];
}


export type LighterPublicPosition = {
  symbol: string;
  signedSize: number;
  entryPrice: number | null;
  unrealizedPnl: number | null;
  liquidationPrice: number | null;
  allocatedMargin: number | null;
};
export type LighterPublicAsset = {
  symbol: string;
  balance: number;
  lockedBalance: number | null;
  marginBalance: number | null;
};
/** Real per-market settings from /account, even when a position is flat. */
export type LighterPublicMarginSetting = {
  marketId:number;
  initialMarginFraction:number;
  marginMode:"cross"|"isolated";
};
export type LighterPublicAccount = {
  index: number;
  availableBalance: number | null;
  collateral: number | null;
  /** Exchange-reported account-wide cross-margin risk inputs, not position margin. */
  crossAssetValue: number | null;
  crossInitialMarginRequirement: number | null;
  crossMaintenanceMarginRequirement: number | null;
  positions: LighterPublicPosition[];
  marginSettings: LighterPublicMarginSetting[];
  assets: LighterPublicAsset[] | null;
};

/** Public GET /api/v1/account, normalized from official DetailedAccount model.
 * Authentication is not needed; no private state or arbitrary key material.
 */
export async function getLighterPublicAccounts(
  indexes: number[], signal?: AbortSignal
): Promise<LighterPublicAccount[]> {
  if (!indexes.length) return [];
  const responses = await Promise.all(indexes.map(async index => {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid Lighter account index");
    const data = await lighterPublicGet(`/api/v1/account?by=index&value=${index}`, signal);
    const entries = list(data.accounts);
    const account = entries.map(record).find(a => finite(a?.index ?? a?.account_index) === index);
    if (!account) throw new Error(`Missing public Lighter account ${index}`);
    const positions: LighterPublicPosition[] = [];
    const marginSettings: LighterPublicMarginSetting[] = [];
    for (const raw of list(account.positions)) {
      const o = record(raw); if (!o || typeof o.symbol !== "string") continue;
      const marketId=finite(o.market_id ?? o.market_index);
      const fraction=finite(o.initial_margin_fraction);
      const marginMode=finite(o.margin_mode);
      // Keep the exchange's margin configuration even for zero-size rows;
      // do not invent an open position or a leverage from missing values.
      if(marketId!==null&&Number.isSafeInteger(marketId)&&marketId>=0&&
         fraction!==null&&fraction>0&&
         (marginMode===0||marginMode===1)){
        marginSettings.push({marketId,initialMarginFraction:fraction,
          marginMode:marginMode===0?"cross":"isolated"});
      }
      const size = finite(o.position);
      const sign = finite(o.sign);
      if (size === null || sign === null || size === 0 || sign === 0) continue;
      const entry = finite(o.avg_entry_price), pnl = finite(o.unrealized_pnl);
      positions.push({
        symbol: o.symbol,
        signedSize: Math.abs(size) * (sign < 0 ? -1 : 1),
        entryPrice: entry, unrealizedPnl: pnl,
        liquidationPrice: finite(o.liquidation_price),
        allocatedMargin: finite(o.allocated_margin),
      });
    }
    const assets: LighterPublicAsset[] | null = Array.isArray(account.assets)
      ? list(account.assets).flatMap(raw => {
          const item = record(raw);
          const symbol = typeof item?.symbol === "string" ? item.symbol.trim() : "";
          const balance = finite(item?.balance);
          if (!symbol || balance === null) return [];
          return [{
            symbol, balance,
            lockedBalance: finite(item?.locked_balance),
            marginBalance: finite(item?.margin_balance),
          }];
        })
      : null;
    return {
      index,
      availableBalance: finite(account.available_balance),
      collateral: finite(account.collateral),
      crossAssetValue: finite(account.cross_asset_value),
      crossInitialMarginRequirement: finite(account.cross_initial_margin_requirement),
      crossMaintenanceMarginRequirement: finite(account.cross_maintenance_margin_requirement),
      positions, marginSettings, assets,
    };
  }));
  return responses;
}

function normalizedLevel(v: unknown): LighterLevel | null {
  const o = record(v);
  if (!o) return null;
  const price = finite(o.price), size = finite(o.size);
  return price !== null && price > 0 && size !== null && size >= 0
    ? { price: String(o.price), size: String(o.size) } : null;
}

/** Per Lighter docs: update levels replace quantities; 0 removes the level.
 * begin_nonce must match previous nonce, otherwise resubscribe for a snapshot.
 */
export function subscribeLighterBook(
  marketId: number, onUpdate: (value: LighterMarketFeed) => void
): () => void {
  const bids = new Map<string, string>(), asks = new Map<string, string>();
  let ws: WebSocket | null = null, closed = false, nonce = -1, tradePrice: string | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  // Preserve every exchange delta in the maps; throttle only React rendering
  // to avoid jitter/flickering on high-frequency mainnet books.
  let frameTimer: ReturnType<typeof setTimeout> | undefined;
  let queuedStatus: LighterMarketFeed["status"] = "connecting";
  let lastPaint = 0;
  const paint = () => {
    frameTimer = undefined;
    if (closed) return;
    lastPaint = Date.now();
    const levels = (src: Map<string, string>, desc: boolean) =>
      [...src.entries()].sort((x, y) => desc ? Number(y[0])-Number(x[0]) : Number(x[0])-Number(y[0]))
        .slice(0, 16).map(([price, size]) => ({ price, size }));
    onUpdate({ status: queuedStatus, bids: levels(bids, true), asks: levels(asks, false), recentTradePrice: tradePrice });
  };
  const emit = (status: LighterMarketFeed["status"]) => {
    if (closed) return;
    queuedStatus = status;
    if (status !== "live") {
      if (frameTimer) clearTimeout(frameTimer);
      frameTimer = undefined;
      paint();
      return;
    }
    if (frameTimer) return;
    const delay = Math.max(0, 250 - (Date.now() - lastPaint));
    frameTimer = setTimeout(paint, delay);
  };
  const channel = `order_book/${marketId}`;
  const reset = () => {
    bids.clear(); asks.clear(); nonce = -1;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "unsubscribe", channel }));
      ws.send(JSON.stringify({ type: "subscribe", channel }));
    }
  };
  const apply = (book: unknown, snapshot: boolean) => {
    const o = record(book); if (!o) return;
    const next = finite(o.nonce);
    if (next === null) return;
    if (!snapshot && (nonce < 0 || finite(o.begin_nonce) !== nonce)) { reset(); return; }
    if (snapshot) { bids.clear(); asks.clear(); }
    for (const [src, raw] of [[bids, o.bids], [asks, o.asks]] as const) {
      for (const entry of list(raw)) {
        const lv = normalizedLevel(entry);
        if (!lv) continue;
        if (Number(lv.size) === 0) src.delete(lv.price);
        else src.set(lv.price, lv.size);
      }
    }
    nonce = next; emit("live");
  };
  const open = () => {
    if (closed) return;
    emit("connecting");
    try { ws = new WebSocket(LIGHTER_MAINNET_WS); }
    catch { retry = setTimeout(open, 3000); return; }
    const socket = ws;
    socket.onopen = () => {
      if (closed) return;
      socket.send(JSON.stringify({ type: "subscribe", channel }));
      socket.send(JSON.stringify({ type: "subscribe", channel: `trade/${marketId}` }));
      ping = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 60000);
    };
    socket.onmessage = event => {
      if (closed) return;
      try {
        const msg = record(JSON.parse(String(event.data))); if (!msg) return;
        const typ = String(msg.type ?? "");
        if (typ === "subscribed/order_book" || typ === "update/order_book")
          apply(msg.order_book, typ === "subscribed/order_book");
        if (typ === "update/trade") {
          const trades = list(msg.trades ?? msg.trade);
          const trade = record(trades[0] ?? msg.trade);
          const px = finite(trade?.price);
          if (px !== null && px > 0) { tradePrice = String(px); emit("live"); }
        }
      } catch { /* Ignore malformed upstream frames; nonce gap resyncs the book. */ }
    };
    socket.onclose = () => {
      if (ping) clearInterval(ping);
      if (closed) return;
      nonce = -1; bids.clear(); asks.clear(); emit("disconnected");
      retry = setTimeout(open, 3000);
    };
    socket.onerror = () => { socket.close(); };
  };
  open();
  return () => {
    closed = true;
    if (frameTimer) clearTimeout(frameTimer);
    if (ping) clearInterval(ping);
    if (retry) clearTimeout(retry);
    if (ws) { ws.onclose = null; ws.close(); }
  };
}
