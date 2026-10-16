import React, { useEffect, useMemo, useState } from "react";
import TVChart from "./TVChart";
import {
  getLighterAccountIndexes, getLighterMarkets, getLighterPublicAccounts,
  subscribeLighterBook,
  type LighterMarket, type LighterMarketFeed, type LighterPublicAccount,
} from "../../lib/lighterMarketData";

type Section = "markets" | "trade" | "funds" | "account" | "orders";
type Kind = "perp" | "spot";
type Props = {
  walletAddress: string;
  section: Section;
  initialKind?: Kind;
  onSelectSection: (section: Section, marketKind?: Kind) => void;
};

const emptyBook: LighterMarketFeed = {
  status: "connecting", bids: [], asks: [], recentTradePrice: null,
};
function formatPrice(value: number | null | undefined, digits = 8): string {
  return value != null && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
}
function labelKind(kind: Kind) { return kind === "perp" ? "Perpetual" : "Spot"; }

/**
 * Lighter pages use HideDex's existing chart and the same market/order-panel
 * composition as the main terminal. Every number comes from Lighter mainnet.
 * No Hyperliquid wallet balance, signing method or order callback is imported.
 * Trade form is intentionally not executable until browser WASM signing and
 * per-wallet API-key registration can be verified end-to-end.
 */
export default function LighterMarketPreview({
  walletAddress, section, initialKind = "perp", onSelectSection,
}: Props) {
  const [markets, setMarkets] = useState<LighterMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [publicAccounts, setPublicAccounts] = useState<LighterPublicAccount[] | null>(null);
  const [feed, setFeed] = useState<LighterMarketFeed>(emptyBook);
  const [viewMode, setViewMode] = useState<"chart" | "orderbook">("chart");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  useEffect(() => { setKind(initialKind); }, [initialKind]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    getLighterMarkets(ac.signal).then(rows => {
      if (ac.signal.aborted) return;
      setMarkets(rows);
      setMarketError(null);
      setSelectedMarketId(current =>
        current !== null && rows.some(row => row.id === current)
          ? current : (rows.find(row => row.kind === "perp")?.id ?? rows[0]?.id ?? null)
      );
    }).catch(error => {
      if (!ac.signal.aborted) setMarketError(error instanceof Error ? error.message : "Lighter markets unavailable");
    }).finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setPublicAccounts(null);
    setAccountError(null);
    if (!walletAddress) { setAccountsLoading(false); return () => ac.abort(); }
    setAccountsLoading(true);
    getLighterAccountIndexes(walletAddress, ac.signal).then(indexes =>
      getLighterPublicAccounts(indexes, ac.signal)
    ).then(items => {
      if (!ac.signal.aborted) setPublicAccounts(items);
    }).catch(error => {
      if (!ac.signal.aborted) setAccountError(error instanceof Error ? error.message : "Lighter account unavailable");
    }).finally(() => { if (!ac.signal.aborted) setAccountsLoading(false); });
    return () => ac.abort();
  }, [walletAddress]);

  const available = useMemo(() => markets.filter(market => market.kind === kind), [markets, kind]);
  const selected = useMemo(
    () => available.find(row => row.id === selectedMarketId) ?? available[0],
    [available, selectedMarketId]
  );
  useEffect(() => {
    setFeed({ ...emptyBook });
    if (!selected || (section !== "trade" && section !== "markets")) return;
    return subscribeLighterBook(selected.id, next => setFeed(next));
  }, [selected?.id, section]);

  const multiplier = selected?.multiplier && selected.multiplier > 0 ? selected.multiplier : 1;
  const displayPrice = (raw: string) => {
    const n = Number(raw) / multiplier;
    return Number.isFinite(n) ? n : null;
  };
  const displaySize = (raw: string) => {
    const n = Number(raw) * multiplier;
    return Number.isFinite(n) ? n : null;
  };
  const lastPrice = feed.recentTradePrice
    ? displayPrice(feed.recentTradePrice) : selected?.lastTradePrice ?? null;
  const marketPrice = lastPrice !== null && lastPrice > 0 ? lastPrice : null;

  const chooseMarket = (m: LighterMarket, navigate: boolean) => {
    setSelectedMarketId(m.id);
    setKind(m.kind);
    setAmount("");
    setLimitPrice("");
    if (navigate) onSelectSection("trade", m.kind);
  };
  const switchKind = (next: Kind) => {
    setKind(next);
    setSelectedMarketId(markets.find(m => m.kind === next)?.id ?? null);
    setAmount("");
    setLimitPrice("");
  };

  const bookLevels = (levels: LighterMarketFeed["bids"], sideName: "bid" | "ask") => (
    <div className="space-y-0.5">
      {levels.length === 0 && <div className="py-2 text-[10px] text-brand-muted">Waiting for live {sideName}s…</div>}
      {levels.slice(0, 14).map((level, i) => {
        const px = displayPrice(level.price);
        const sz = displaySize(level.size);
        return <button type="button" key={level.price + "-" + i}
          onClick={() => { if (px !== null) setLimitPrice(String(px)); }}
          className="grid grid-cols-2 w-full gap-1 text-[9px] sm:text-[11px] font-mono py-1 text-left hover:bg-brand-overlay-subtle rounded">
          <span className={sideName === "bid" ? "text-emerald-500" : "text-rose-400"}>{formatPrice(px)}</span>
          <span className="text-right text-brand-muted truncate">{formatPrice(sz, 4)}</span>
        </button>;
      })}
    </div>
  );

  const accountCards = (
    <div className="space-y-3">
      {!walletAddress && <p className="text-xs text-brand-muted">Connect your wallet to check registered Lighter accounts.</p>}
      {accountsLoading && <p className="text-xs text-brand-muted">Loading Lighter account state…</p>}
      {accountError && <p role="alert" className="text-xs text-rose-400">Lighter account lookup failed: {accountError}</p>}
      {publicAccounts !== null && publicAccounts.length === 0 &&
        <p className="text-xs text-brand-muted">No Lighter accounts found for this wallet.</p>}
      {publicAccounts?.map(account => (
        <div key={account.index} className="p-3 bg-brand-surface border border-brand-border rounded-xl">
          <h3 className="text-sm font-bold mb-3">Lighter Account #{account.index}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><p className="text-[10px] text-brand-muted">Available balance</p>
              <p className="font-mono text-base font-bold text-brand-text">{formatPrice(account.availableBalance)} USDC</p></div>
            <div><p className="text-[10px] text-brand-muted">Collateral</p>
              <p className="font-mono text-base font-bold text-brand-text">{formatPrice(account.collateral)} USDC</p></div>
          </div>
          <h4 className="text-xs font-bold border-t border-brand-border pt-3">Open positions</h4>
          {!account.positions.length && <p className="text-xs text-brand-muted mt-1">No open positions reported.</p>}
          {account.positions.map((position, i) => <div key={position.symbol + i}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] py-2 border-b border-brand-border/50">
              <span className="font-bold">{position.symbol}</span>
              <span>{position.signedSize >= 0 ? "LONG" : "SHORT"} {formatPrice(Math.abs(position.signedSize), 5)}</span>
              <span>Entry: {formatPrice(position.entryPrice)}</span>
              <span>PnL: {formatPrice(position.unrealizedPnl)}</span>
            </div>)}
        </div>
      ))}
    </div>
  );

  return <div className="w-full min-w-0 text-brand-text pb-6" data-exchange="lighter">
    {marketError && <div role="alert" className="mb-2 p-3 border border-rose-500/40 rounded-lg text-xs text-rose-400">
      Lighter market API unavailable: {marketError}. Hyperliquid prices are never substituted.
    </div>}
    <div className="flex items-center justify-between gap-2 mb-2 px-2 py-2 bg-brand-surface border border-brand-border rounded-xl">
      <div><span className="font-semibold text-xs sm:text-sm">Lighter Mainnet</span>
        <p className="text-[9px] text-brand-muted">Only Lighter market/account data</p></div>
      <span className={"text-[10px] rounded-lg border border-brand-border px-2 py-1 " +
        (feed.status === "live" ? "text-emerald-500" : "text-brand-muted")}>
        {section === "trade" || section === "markets" ? "Order Book: " + feed.status : "Lighter"}
      </span>
    </div>

    {section === "markets" && <div className="border border-brand-border rounded-xl bg-brand-bg p-3">
      <div className="flex justify-between items-center gap-2 mb-3">
        <h2 className="font-bold text-sm sm:text-base">Markets</h2>
        <span className="text-[10px] text-brand-muted">{markets.length} Lighter mainnet markets</span>
      </div>
      <div className="flex gap-2 mb-3">
        {(["perp", "spot"] as const).map(k => <button key={k} type="button" onClick={() => switchKind(k)}
          className={"px-3 py-1.5 rounded-lg text-xs border border-brand-border " +
            (kind === k ? "text-accent font-bold bg-brand-overlay-subtle" : "text-brand-muted")}>
          {labelKind(k)}</button>)}
      </div>
      {loading && <p className="text-xs text-brand-muted">Loading Lighter markets…</p>}
      <div className="overflow-auto max-h-[65vh]">
        <table className="w-full min-w-[350px] text-xs">
          <thead><tr className="border-b border-brand-border text-brand-muted text-left">
            <th className="p-2">Market</th><th className="p-2 text-right">Last price</th><th className="p-2 text-right">24h Volume</th><th className="p-2 text-right">24h Change</th>
          </tr></thead>
          <tbody>{available.map(m => <tr key={m.id} className="border-b border-brand-border/40 cursor-pointer hover:bg-brand-overlay-subtle"
            onClick={() => chooseMarket(m, true)}>
              <td className="p-2 font-semibold">{m.symbol}</td>
              <td className="p-2 font-mono text-right">{formatPrice(m.lastTradePrice)}</td>
              <td className="p-2 font-mono text-right">{m.volume24hUsd === null ? "—" : "$" + formatPrice(m.volume24hUsd, 2)}</td>
              <td className="p-2 font-mono text-right">{m.change24h === null ? "—" : formatPrice(m.change24h, 3)}</td>
            </tr>)}</tbody>
        </table>
      </div>
    </div>}

    {section === "trade" && <>
      <div id="terminal-unified-market-header" className="rounded-xl border border-brand-border bg-brand-surface p-2 mb-2">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <select value={selected?.id ?? ""} aria-label="Lighter symbol" onChange={e => {
              const m = available.find(x => x.id === Number(e.target.value)); if (m) chooseMarket(m, false);
            }} className="border border-brand-border rounded-lg bg-brand-bg px-2 py-2 text-xs font-bold max-w-[140px]">
              {available.map(m => <option key={m.id} value={m.id}>{m.symbol}</option>)}
            </select>
            <button type="button" onClick={() => switchKind(kind === "perp" ? "spot" : "perp")}
              className="text-[10px] border border-brand-border px-2 py-2 rounded-lg">
              {labelKind(kind)} ▾
            </button>
          </div>
          <div className="flex border border-brand-border rounded-lg overflow-hidden">
            <button type="button" onClick={() => setViewMode("chart")} className={"px-3 py-2 text-[10px] font-bold " + (viewMode === "chart" ? "bg-accent text-brand-bg" : "")}>CHART</button>
            <button type="button" onClick={() => setViewMode("orderbook")} className={"px-3 py-2 text-[10px] font-bold " + (viewMode === "orderbook" ? "bg-accent text-brand-bg" : "")}>ORDER BOOK</button>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div><div className="text-brand-muted">Last</div><strong>{formatPrice(marketPrice)}</strong></div>
            <div><div className="text-brand-muted">24h Vol</div><strong>{selected?.volume24hUsd == null ? "—" : "$" + formatPrice(selected.volume24hUsd, 2)}</strong></div>
            <div><div className="text-brand-muted">24h Change</div><strong>{formatPrice(selected?.change24h, 2)}</strong></div>
          </div>
        </div>
        {viewMode === "chart" && <div id="market-chart-toolbar-host" className="mt-2 min-h-[28px] w-full border-t border-brand-border" />}
      </div>
      <div id="terminal-top-chart-panel" className="mb-2 bg-brand-bg border border-brand-border rounded-xl p-1.5">
        {viewMode === "chart" ? selected ? <TVChart key={"lighter-chart-" + selected.id}
          symbol={selected.symbol} marketCoin="" lighterMarketId={selected.id}
          isSpot={kind === "spot"} currentPrice={marketPrice}
          high24h={selected.high24h} low24h={selected.low24h}
          volume24h={selected.volume24hUsd} change24h={selected.change24h}
          tradeHistory={[]} toolbarHostId="market-chart-toolbar-host"
        /> : <p className="p-5 text-xs text-brand-muted">Choose a Lighter market.</p> : (
          <div className="p-2">
            <h3 className="text-xs font-bold mb-3">Live Lighter Order Book · {selected?.symbol}</h3>
            <div className="grid grid-cols-2 gap-2"><div>{bookLevels(feed.bids, "bid")}</div><div>{bookLevels(feed.asks, "ask")}</div></div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-12 gap-1.5 md:gap-2 mb-2 items-stretch">
        <div id="terminal-order-form" className="col-span-7 min-w-0 rounded-xl border border-brand-border bg-brand-bg p-1.5 sm:p-3 space-y-2">
          <h3 className="text-xs sm:text-sm font-bold">Place Order · {labelKind(kind)}</h3>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => setSide("buy")} className={"text-[10px] py-2 rounded font-bold border border-brand-border " +
              (side === "buy" ? "bg-emerald-500 text-black" : "text-brand-muted")}>{kind === "perp" ? "Long" : "Buy"}</button>
            <button type="button" onClick={() => setSide("sell")} className={"text-[10px] py-2 rounded font-bold border border-brand-border " +
              (side === "sell" ? "bg-rose-500 text-white" : "text-brand-muted")}>{kind === "perp" ? "Short" : "Sell"}</button>
          </div>
          <label className="block text-[10px] font-semibold">Order type
            <select value={orderType} onChange={e => setOrderType(e.target.value as "market" | "limit")}
              className="block w-full mt-1 rounded-lg bg-brand-surface border border-brand-border p-2 text-xs">
              <option value="market">Market</option><option value="limit">Limit</option>
            </select></label>
          {orderType === "limit" && <label className="block text-[10px] font-semibold">Limit price
            <input type="number" inputMode="decimal" min="0" value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
              placeholder="Price" className="mt-1 w-full min-w-0 rounded-lg bg-brand-surface border border-brand-border p-2 text-xs" /></label>}
          <label className="block text-[10px] font-semibold">Size ({selected?.symbol ?? "coin"})
            <input type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Quantity" className="mt-1 w-full min-w-0 rounded-lg bg-brand-surface border border-brand-border p-2 text-xs" /></label>
          <p className="text-[9px] text-brand-muted">Estimated notional: {marketPrice && Number(amount) > 0 ?
            "$" + formatPrice((orderType === "limit" && Number(limitPrice) > 0 ? Number(limitPrice) : marketPrice) * Number(amount), 2)
            : "—"}</p>
          <button type="button" disabled aria-disabled="true"
            title="Lighter API key authorization and official WASM signer are not configured"
            className="w-full p-2 rounded-lg bg-brand-overlay-normal border border-brand-border text-[10px] font-bold text-brand-muted cursor-not-allowed">
            {side === "buy" ? "Place Long / Buy" : "Place Short / Sell"} — Signer required
          </button>
          <p className="text-[9px] text-amber-500 leading-relaxed">
            Real Lighter order signing is not connected. Orders cannot be submitted here. No Hyperliquid order will be sent.
          </p>
          <a href="https://app.lighter.xyz/" target="_blank" rel="noopener noreferrer"
            className="inline-block text-[10px] text-accent underline">Trade via official Lighter ↗</a>
        </div>
        <div id="terminal-order-book" className="col-span-5 min-w-0 rounded-xl border border-brand-border bg-brand-bg p-1.5 sm:p-3">
          <div className="text-xs font-bold mb-2">Order Book</div>
          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono font-bold border-b border-brand-border pb-2 mb-1">
            <span>Bid</span><span className="text-right">Size</span></div>
          <div className="max-h-[340px] overflow-auto">{bookLevels(feed.asks.slice(0, 7).reverse(), "ask")}
            <div className="text-center py-2 border-y border-brand-border font-mono text-[10px] text-accent">
              {formatPrice(marketPrice)}
            </div>{bookLevels(feed.bids.slice(0, 7), "bid")}</div>
        </div>
      </div>
      <div id="trading-dashboard-tabs" className="rounded-xl border border-brand-border bg-brand-bg p-3">
        <div className="flex gap-3 items-center border-b border-brand-border pb-2 mb-3">
          <h3 className="text-xs font-bold">Positions / Orders</h3>
          <button type="button" onClick={() => onSelectSection("funds")} className="text-[10px] text-accent underline">Full account ↗</button>
        </div>
        {accountCards}
        <p className="text-[10px] text-brand-muted mt-3">
          Lighter cancellation and TP/SL actions require verified signing and are not enabled yet.
        </p>
      </div>
    </>}

    {(section === "funds" || section === "account" || section === "orders") && <div className="space-y-3">
      <div className="border border-brand-border rounded-xl bg-brand-surface p-3">
        <h2 className="text-base font-bold mb-2">{section === "funds" ? "Lighter Funds" : section === "account" ? "Lighter Account" : "Lighter Positions & Orders"}</h2>
        {section === "funds" && <p className="text-xs text-brand-muted mb-3">Exchange-specific balances and collateral. Hyperliquid holdings are not included.</p>}
        {accountCards}
      </div>
      {section === "orders" && <div className="border border-brand-border rounded-xl p-3 text-xs text-brand-muted">
        Verified open-order details, cancellation and execution history require additional Lighter account integration.
        No order status is fabricated.
      </div>}
      {section === "funds" && <div className="border border-brand-border rounded-xl p-3">
        <div className="font-bold text-xs mb-2">Deposit / Withdrawal</div>
        <p className="text-xs text-brand-muted mb-2">Lighter-specific funding authorization is not integrated in HideDex yet. Do not use Hyperliquid funding routes.</p>
        <a href="https://app.lighter.xyz/" target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
          Open official Lighter for deposit / withdrawal ↗
        </a>
      </div>}
    </div>}
  </div>;
}
