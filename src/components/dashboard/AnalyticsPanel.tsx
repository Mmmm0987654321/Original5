import React, { useMemo } from "react";
import { Activity, ReceiptText, BarChart3, TrendingUp } from "lucide-react";
import type { PnlTimeseries } from "../../lib/hyperliquid";

type Period = "day" | "week" | "month" | "allTime";
type Market = "all" | "spot" | "perps";
interface Props {
  period: Period;
  market: Market;
  pnlTimeseries?: PnlTimeseries | null;
  portfolioPnl?: number | null;
  walletConnected: boolean;
  walletAddress: string;
  fills: readonly unknown[];
  loading: boolean;
  failed: boolean;
  sensitiveHidden?: boolean;
  /** Optional venue-specific, already verified aggregates. The visual summary
   * is identical for Hyperliquid and Lighter; neither exchange reads the other's data. */
  venueStats?: {
    pnl: number | null;
    volume: number | null;
    fees: number | null;
    orders: number | null;
    pnlLabel?: string;
    volumeLabel?: string;
    feesLabel?: string;
    ordersLabel?: string;
  };
}
const usd = (value: number) => "$" + Math.abs(value).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const signedUsd = (value: number) => (value < 0 ? "-" : value > 0 ? "+" : "") + usd(value);

export default function AnalyticsPanel({
  period, market, pnlTimeseries = null, portfolioPnl = null,
  walletConnected, walletAddress, fills, loading, failed, sensitiveHidden = false,
  venueStats
}: Props) {
  const rawCombinedVolume = pnlTimeseries?.[period]?.vlm;
  const parsedCombinedVolume = rawCombinedVolume == null ? NaN : Number(rawCombinedVolume);
  const combinedVolume = Number.isFinite(parsedCombinedVolume) ? parsedCombinedVolume : null;
  const combinedPnl = portfolioPnl;
  const stats = useMemo(() => {
    const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : null;
    const cutoff = days === null ? 0 : Date.now() - days * 86400000;
    const rows = (Array.isArray(fills) ? fills : []).filter((item) => {
      if (!item || typeof item !== "object") return false;
      const f = item as Record<string, unknown>;
      const timestamp = Number(f.time);
      if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp < cutoff) return false;
      const coin = typeof f.coin === "string" ? f.coin : "";
      const isSpot = coin.startsWith("@") || coin.includes("/");
      return market === "all" || (market === "spot" ? isSpot : !!coin && !isSpot);
    }) as Record<string, unknown>[];

    let volume = 0, volumeCount = 0, pnl = 0, pnlCount = 0, fee = 0, feeCount = 0;
    const orders = new Set<string>();
    let ordersComplete = true;
    for (const f of rows) {
      const px = Number(f.px), sz = Number(f.sz);
      if (Number.isFinite(px) && px > 0 && Number.isFinite(sz) && sz > 0) {
        volume += px * sz;
        volumeCount++;
      }
      const p = f.closedPnl == null ? NaN : Number(f.closedPnl);
      if (Number.isFinite(p)) { pnl += p; pnlCount++; }
      // Native Hyperliquid perps settle fees in USDC; older fills may omit feeToken.
      // Never infer USDC for Spot or HIP-3 collateral with unknown fee currencies.
      const coin = typeof f.coin === "string" ? f.coin : "";
      const isSpot = coin.startsWith("@") || coin.includes("/") || f.isSpot === true;
      const isNativePerp = !!coin && !isSpot && !coin.includes(":");
      const reportedToken = typeof f.feeToken === "string" ? f.feeToken.trim().toUpperCase() : "";
      const feeToken = reportedToken || (isNativePerp ? "USDC" : "");
      const amount = f.fee == null ? NaN : Number(f.fee);
      if ((feeToken === "USDC" || feeToken.startsWith("USDC:")) && Number.isFinite(amount)) {
        fee += amount;
        feeCount++;
      }
      if ((typeof f.oid === "number" && Number.isFinite(f.oid)) ||
          (typeof f.oid === "string" && f.oid.trim() !== "")) {
        orders.add(String(f.oid));
      } else ordersComplete = false;
    }
    return {
      count: rows.length,
      volume: rows.length > 0 && volumeCount === rows.length ? volume : null,
      pnl: rows.length > 0 && pnlCount === rows.length ? pnl : null,
      fee: feeCount > 0 ? fee : null,
      orders: rows.length > 0 && ordersComplete ? orders.size : null
    };
  }, [fills, period, market]);

  // The official combined PnL/volume matches Hyperliquid Portfolio's period.
  // A Spot/Perps breakdown is only a recent-fill sample, not lifetime portfolio stats.
  const combined = market === "all";
  const displayVolume = combined ? combinedVolume : stats.volume;
  const displayPnl = combined ? combinedPnl : market === "perps" ? stats.pnl : null;
  const cards = venueStats ? [
    { title: venueStats.pnlLabel ?? "Trading PnL", value: venueStats.pnl === null ? "--" : signedUsd(venueStats.pnl), Icon: TrendingUp },
    { title: venueStats.volumeLabel ?? "Total Volume", value: venueStats.volume === null ? "--" : usd(venueStats.volume), Icon: BarChart3 },
    { title: venueStats.feesLabel ?? "Fees (USDC · loaded)", value: venueStats.fees === null ? "--" : usd(venueStats.fees), Icon: ReceiptText },
    { title: venueStats.ordersLabel ?? "Executed orders (loaded)", value: venueStats.orders === null ? "--" : venueStats.orders.toLocaleString(), Icon: Activity }
  ] : [
    { title: combined ? "Net PnL" : market === "spot" ? "Spot PnL (unavailable)" : "Closed PnL (loaded)",
      value: displayPnl === null ? "--" : signedUsd(displayPnl), Icon: TrendingUp },
    { title: combined ? "Total Volume" : "Volume (loaded)",
      value: displayVolume === null ? "--" : usd(displayVolume), Icon: BarChart3 },
    { title: "Fees (USDC · loaded)",
      value: stats.fee === null ? "--" : (stats.fee < 0 ? "-" : "") + usd(stats.fee), Icon: ReceiptText },
    { title: "Executed orders (loaded)",
      value: stats.orders === null ? "--" : stats.orders.toLocaleString(), Icon: Activity }
  ];
  return (
    <div className="space-y-2.5" id="analytics-panel-root">
      {!walletConnected || !walletAddress ? (
        <p className="text-xs text-brand-muted">Connect your wallet to view analytics.</p>
      ) : <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {cards.map(({ title, value, Icon }) => (
          <div key={title} className="bg-brand-overlay-subtle border border-brand-border/50 rounded-xl p-2.5 sm:p-3 min-w-0">
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-brand-muted">
              <Icon size={12} className="shrink-0"/>
              <span className="truncate">{title}</span>
            </div>
            <span className="text-sm sm:text-lg font-mono font-bold block mt-1 text-brand-text truncate">
              {sensitiveHidden ? "••••••" : loading && !fills.length && title.includes("loaded") ? "…" : value}
            </span>
          </div>
        ))}
      </div>}
      {failed && <p role="status" className="text-[10px] text-brand-muted">Recent fill history is temporarily unavailable.</p>}
    </div>
  );
}


/** Visual-only daily volume bars from actual recently loaded wallet fills.
 * Respects the Funds period; never labels this sample as complete lifetime data.
 */
export function DailyFillVolumeBars({
  fills, period, walletConnected, sensitiveHidden = false, unavailableMessage, sourceLabel = "loaded fills"
}: {
  fills: readonly unknown[];
  period: Period;
  walletConnected: boolean;
  sensitiveHidden?: boolean;
  unavailableMessage?: string;
  sourceLabel?: string;
}) {
  const bars = useMemo(() => {
    const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : null;
    const cutoff = days === null ? 0 : Date.now() - days * 86400000;
    const byDay = new Map<string, number>();
    for (const input of fills) {
      if (!input || typeof input !== "object") continue;
      const f = input as Record<string, unknown>;
      const timestamp = Number(f.time);
      const px = Number(f.px);
      const sz = Number(f.sz);
      const reportedUsd = f.volumeUsd == null ? null : Number(f.volumeUsd);
      const amount = reportedUsd!==null&&Number.isFinite(reportedUsd)&&reportedUsd>=0
        ? reportedUsd : px * sz;
      if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp < cutoff ||
          !Number.isFinite(amount) || amount < 0) continue;
      const day = new Date(timestamp).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + amount);
    }
    return [...byDay].map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [fills, period]);
  const max = Math.max(1, ...bars.map(x => x.amount));
  return (
    <section id="funds-daily-volume" className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
      <h3 className="text-brand-text text-[11px] sm:text-xs font-bold uppercase tracking-wider">
        Daily Trading Volume <span className="text-brand-muted font-normal">(UTC · {sourceLabel})</span>
      </h3>
      {sensitiveHidden ? (
        <p className="text-xs text-brand-muted">Hidden by privacy settings.</p>
      ) : unavailableMessage ? (
        <p className="text-xs text-brand-muted">{unavailableMessage}</p>
      ) : !walletConnected ? (
        <p className="text-xs text-brand-muted">Connect your wallet to see daily volume.</p>
      ) : bars.length === 0 ? (
        <p className="text-xs text-brand-muted">No fills in this period.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
          {bars.map(row => (
            <div key={row.day} className="grid grid-cols-[86px_minmax(0,1fr)_90px] sm:grid-cols-[100px_minmax(0,1fr)_110px] gap-2 items-center">
              <span className="text-[11px] text-brand-muted font-mono tabular-nums">{row.day}</span>
              <div className="h-2 bg-brand-overlay-normal rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-text" style={{ width: (100 * row.amount / max) + "%" }} />
              </div>
              <span className="text-[11px] text-brand-text font-mono text-right tabular-nums whitespace-nowrap">
                {"$" + row.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
