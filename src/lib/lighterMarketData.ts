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
  multiplier: number;
  lastTradePrice: number | null;
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
    result.push({ id, symbol, kind, priceDecimals: pd, sizeDecimals: sd,
      multiplier: mult !== null && mult > 0 ? mult : 1,
      lastTradePrice: finite(obj.last_trade_price),
      volume24hUsd: finite(obj.daily_quote_token_volume),
      change24h: finite(obj.daily_price_change),
      high24h: finite(obj.daily_price_high),
      low24h: finite(obj.daily_price_low),
    });
  };
  list(data.order_book_details).forEach(m => add(m, "perp"));
  list(data.spot_order_book_details).forEach(m => add(m, "spot"));
  if (!result.length) throw new Error("Lighter returned no verifiable active markets");
  return result.sort((x, y) => x.kind.localeCompare(y.kind) || x.symbol.localeCompare(y.symbol));
}


/** Lighter mainnet OHLC only. Time query is seconds; returned candle t is ms. */
export async function getLighterCandles(
  marketId: number, resolution: string, startMs: number, endMs: number,
  signal?: AbortSignal
): Promise<{ candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> }> {
  if (!Number.isSafeInteger(marketId) || marketId < 0) throw new Error("Invalid Lighter market");
  const allowed = new Set(["1m","5m","15m","30m","1h","4h","12h","1d","1w"]);
  if (!allowed.has(resolution)) throw new Error("Lighter does not provide " + resolution + " candles");
  const validRes = resolution;
  const start = Math.max(0, Math.floor(startMs / 1000));
  const end = Math.floor(endMs / 1000);
  if (end <= start) return { candles: [] };
  const query = new URLSearchParams({
    market_id: String(marketId), resolution: validRes,
    start_timestamp: String(start), end_timestamp: String(end), count_back: "500",
  });
  const data = await lighterPublicGet(`/api/v1/candles?${query.toString()}`, signal);
  const candles = list(data.c).map(raw => {
    const v = record(raw); if (!v) return null;
    const t = finite(v.t), o = finite(v.o), h = finite(v.h),
      l = finite(v.l), c = finite(v.c), vol = finite(v.v);
    if (t === null || o === null || h === null || l === null || c === null ||
        o <= 0 || h <= 0 || l <= 0 || c <= 0 || h < l) return null;
    return { t, o, h, l, c, v: vol !== null && vol >= 0 ? vol : 0 };
  }).filter((v): v is NonNullable<typeof v> => v !== null);
  return { candles };
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
};
export type LighterPublicAccount = {
  index: number;
  availableBalance: number | null;
  collateral: number | null;
  positions: LighterPublicPosition[];
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
    for (const raw of list(account.positions)) {
      const o = record(raw); if (!o || typeof o.symbol !== "string") continue;
      const size = finite(o.position);
      const sign = finite(o.sign);
      if (size === null || sign === null || size === 0 || sign === 0) continue;
      const entry = finite(o.avg_entry_price), pnl = finite(o.unrealized_pnl);
      positions.push({
        symbol: o.symbol,
        signedSize: Math.abs(size) * (sign < 0 ? -1 : 1),
        entryPrice: entry, unrealizedPnl: pnl,
      });
    }
    return {
      index,
      availableBalance: finite(account.available_balance),
      collateral: finite(account.collateral),
      positions,
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

  const emit = (status: LighterMarketFeed["status"]) => {
    if (closed) return;
    const levels = (src: Map<string, string>, desc: boolean) =>
      [...src.entries()].sort((x, y) => desc ? Number(y[0])-Number(x[0]) : Number(x[0])-Number(y[0]))
        .slice(0, 16).map(([price, size]) => ({ price, size }));
    onUpdate({ status, bids: levels(bids, true), asks: levels(asks, false), recentTradePrice: tradePrice });
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
    if (ping) clearInterval(ping);
    if (retry) clearTimeout(retry);
    if (ws) { ws.onclose = null; ws.close(); }
  };
}
