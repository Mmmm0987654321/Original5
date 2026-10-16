export interface Candle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

const CANDLE_INTERVAL_MS: Record<string, number> = {
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

const CANDLE_MAX_LOOKBACK_MS = 5 * 365 * 86_400_000;

export async function fetchCandles(
  coin: string,
  interval: string = "1h",
  limit: number = 100,
  startTime?: number,
  endTime?: number
): Promise<{
  candles: Candle[];
  coin: string;
  interval: string;
}> {
  let effectiveLimit = limit;
  if (interval === "1M") {
    effectiveLimit = Math.min(effectiveLimit, 120);
  }

  const now = Date.now();
  const intervalMs = CANDLE_INTERVAL_MS[interval] ?? 3600000;
  const resolvedEndTime = endTime !== undefined ? endTime : now;
  let resolvedStartTime =
    startTime !== undefined
      ? startTime
      : resolvedEndTime - intervalMs * effectiveLimit;

  resolvedStartTime = Math.max(
    resolvedStartTime,
    now - CANDLE_MAX_LOOKBACK_MS
  );

  if (resolvedStartTime >= resolvedEndTime) {
    throw new Error("startTime must be less than endTime");
  }

  const response = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin,
        interval,
        startTime: resolvedStartTime,
        endTime: resolvedEndTime,
      },
    }),
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid candle data from Hyperliquid");
  }

  if (!response.ok || !Array.isArray(data)) {
    if (data && typeof data === "object" && data.error) {
      throw new Error(`Invalid candle data from Hyperliquid: ${data.error}`);
    }
    throw new Error("Invalid candle data from Hyperliquid");
  }

  const candles: Candle[] = data.map((candle: any) => ({
    t: Number(candle?.t ?? 0),
    o: String(candle?.o ?? "0"),
    h: String(candle?.h ?? "0"),
    l: String(candle?.l ?? "0"),
    c: String(candle?.c ?? "0"),
    v: String(candle?.v ?? "0"),
  }));

  return {
    candles,
    coin,
    interval,
  };
}
