import React, { useEffect, useMemo, useState } from "react";
import { Layers, Wallet, TrendingUp, Unlock, Lock, ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { TrustShieldValue } from "../common/TrustShieldValue";
import TVChart from "./TVChart";
import MarketsPanel from "../dashboard/MarketsPanel";
import TradingAccountTabBar, { type TradingTabId } from "./TradingAccountTabBar";
import type { TokenMetadata } from "../../types";
import { renderAssetLogo } from "./MarketSelector";
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
  const [accountTab, setAccountTab] = useState<TradingTabId>("POSITIONS");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  // Market/Funds/Account navigation must not reset the user's selected Lighter spot/perp kind.
  // Explicit Trade routing is the only place where App's chosen mode takes precedence.
  useEffect(() => {
    if (section === "trade") setKind(initialKind);
  }, [initialKind, section]);

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
  const lighterTokens = useMemo<TokenMetadata[]>(() =>
    markets.map(m => ({
      symbol: m.kind === "spot" ? m.symbol + "-SPOT" : m.symbol,
      name: m.symbol,
      price: m.lastTradePrice,
      change24h: m.change24h,
      volume24h: m.volume24hUsd,
      high24h: m.high24h,
      low24h: m.low24h,
      openInterest: m.kind === "perp" ? null : undefined,
      isSpotOnly: m.kind === "spot",
      category: m.kind === "spot" ? "spot" : "perps",
      displayBaseAsset: m.symbol,
      sourceCoin: m.symbol,
    })), [markets]);
  const lighterSelectedSymbol = selected
    ? selected.kind === "spot" ? selected.symbol + "-SPOT" : selected.symbol
    : "";


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

  const knownPositionCount = publicAccounts === null ? undefined :
    publicAccounts.reduce((sum, acct) => sum + acct.positions.length, 0);
  const lighterAccountTabs = (
    <div className="bg-brand-bg border border-brand-border rounded-xl overflow-hidden shadow-xl" id="terminal-dashboard-panel-unified">
      <TradingAccountTabBar
        activeTab={accountTab}
        onSelect={setAccountTab}
        positionsCount={knownPositionCount}
        ordersCount={undefined}
      />
      <div className="p-2 md:p-3 min-h-[110px] overflow-y-auto overflow-x-hidden">
        {accountTab === "BALANCES" && accountCards}
        {accountTab === "POSITIONS" && (
          <div className="space-y-2">
            {accountsLoading && <p className="text-xs text-brand-muted">Checking Lighter positions…</p>}
            {accountError && <p className="text-xs text-rose-400">Unable to verify positions: {accountError}</p>}
            {publicAccounts !== null && knownPositionCount === 0 &&
              <p className="text-xs text-brand-muted">No open positions reported by connected Lighter accounts.</p>}
            {publicAccounts?.flatMap(acct => acct.positions.map((p, index) => (
              <div key={acct.index + ":" + p.symbol + ":" + index}
                className="bg-brand-card border border-brand-border/60 rounded-xl p-3 text-[11px]">
                <div className="flex items-center justify-between gap-2 border-b border-brand-border pb-2 mb-2">
                  <strong>{p.symbol} · {p.signedSize > 0 ? "LONG" : "SHORT"}</strong>
                  <span className="font-mono">Account #{acct.index}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <p>Size <strong className="block font-mono">{formatPrice(Math.abs(p.signedSize), 6)}</strong></p>
                  <p>Entry <strong className="block font-mono">{formatPrice(p.entryPrice)}</strong></p>
                  <p>Unrealized PnL <strong className="block font-mono">{formatPrice(p.unrealizedPnl)}</strong></p>
                  <p className="text-brand-muted">TP/SL and Close require verified Lighter signing</p>
                </div>
              </div>
            )))}
            {!walletAddress && <p className="text-xs text-brand-muted">Connect wallet to check Lighter positions.</p>}
          </div>
        )}
        {accountTab === "OPEN_ORDERS" && (
          <p className="text-xs text-brand-muted">Open orders have not been verified from Lighter's account API.
            Cancel actions are disabled until account authorization is implemented.</p>
        )}
        {accountTab === "TRADE_HISTORY" && (
          <p className="text-xs text-brand-muted">Lighter fills and historical fees are not integrated.
            No Hyperliquid history or fabricated fills are shown.</p>
        )}
      </div>
    </div>
  );

  return <div className="w-full min-w-0 text-brand-text pb-6" data-exchange="lighter">
    {marketError && <div role="alert" className="mb-2 p-3 border border-rose-500/40 rounded-lg text-xs text-rose-400">
      Lighter market API unavailable: {marketError}. Hyperliquid prices are never substituted.
    </div>}
    {section === "markets" && (
      <MarketsPanel
        tokens={lighterTokens}
        selectedSymbol={lighterSelectedSymbol}
        setSelectedSymbol={sym => {
          const match = lighterTokens.find(t => t.symbol === sym);
          if (match) {
            const market = markets.find(m => m.symbol === match.sourceCoin &&
              (m.kind === (match.isSpotOnly ? "spot" : "perp")));
            if (market) chooseMarket(market, false);
          }
        }}
        onSelectToken={(sym, marketKind) => {
          const found = lighterTokens.find(t => t.symbol === sym);
          const market = markets.find(m => m.symbol === found?.sourceCoin &&
            m.kind === (marketKind === "spot" ? "spot" : "perp"));
          if (market) chooseMarket(market, true);
        }}
        walletConnected={Boolean(walletAddress)}
        balanceUSDC={publicAccounts?.reduce((sum,a) => sum + (a.availableBalance ?? 0), 0) ?? 0}
        positions={[]}
        openOrders={[]}
        tradeHistory={[]}
        lighterMarketId={selected?.id}
        lighterLastPrice={marketPrice}
        lighterBook={feed}
        lighterMultiplier={selected?.multiplier}
        lighterPriceDecimals={selected?.priceDecimals}
        lighterAccountSummary={lighterAccountTabs}
      />
    )}

    {section === "trade" && <>
      <div id="terminal-unified-market-header" className="rounded-xl border border-brand-border bg-brand-surface p-2 mb-2">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            {selected && <span className="shrink-0">{renderAssetLogo(selected.symbol)}</span>}
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
      {lighterAccountTabs}
    </>}

    {section === "funds" && (() => {
      const verifiedCollateral = publicAccounts !== null && publicAccounts.every(a => a.collateral !== null)
        ? publicAccounts.reduce((total, a) => total + (a.collateral ?? 0), 0) : null;
      const verifiedAvailable = publicAccounts !== null && publicAccounts.every(a => a.availableBalance !== null)
        ? publicAccounts.reduce((total, a) => total + (a.availableBalance ?? 0), 0) : null;
      const showBalance = (value: number | null) =>
        <TrustShieldValue fieldKey="portfolio" value={value === null ? "—" : formatPrice(value, 6) + " USDC"} hideEyeIcon />;
      return <div id="funds-portfolio-container" className="space-y-3 sm:space-y-4 text-brand-text font-sans bg-brand-bg px-3 pt-2 pb-2 sm:p-4 sm:pb-8 rounded-3xl max-w-4xl mx-auto w-full">
        <div className="relative bg-brand-surface border border-brand-border/70 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 overflow-hidden shadow-sm" id="funds-hero-card">
          <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-brand-muted uppercase tracking-wider">TOTAL FUNDS</span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-brand-overlay-subtle border border-brand-border/60 text-[11px] font-semibold">
              <Layers className="w-3.5 h-3.5 text-accent" /> Lighter Account
            </span>
          </div>
          <div className="relative mt-2 sm:mt-3">
            <div className="text-2xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-brand-text">{showBalance(verifiedCollateral)}</div>
            <div className="text-[11px] sm:text-sm font-mono text-brand-muted mt-1">Verified Lighter collateral · USDC</div>
          </div>
          <div className="relative grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 mt-3 sm:mt-4">
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-brand-overlay-subtle border border-brand-border/50 min-w-0">
              <Wallet className="w-5 h-5 shrink-0 text-accent" />
              <div className="min-w-0"><div className="text-[9px] uppercase font-bold text-brand-muted">WALLET ADDRESS</div>
                <div className="text-xs font-bold font-mono truncate">{walletAddress ? walletAddress.slice(0, 8) + "…" : "Not connected"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-brand-overlay-subtle border border-brand-border/50 min-w-0">
              <Layers className="w-5 h-5 shrink-0 text-accent"/>
              <div><div className="text-[9px] uppercase font-bold text-brand-muted">ACCOUNT TYPE</div>
                <div className="text-xs font-bold font-mono">Lighter</div>
              </div>
            </div>
          </div>
          {accountError && <p role="alert" className="mt-3 text-[10px] text-rose-400">{accountError}</p>}
        </div>
        <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 sm:gap-3" id="funds-action-buttons-row">
          <a href="https://app.lighter.xyz/" target="_blank" rel="noopener noreferrer"
            className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-accent text-brand-bg font-extrabold flex items-center justify-between shadow-md text-left group min-w-0">
            <div className="flex items-center gap-2 min-w-0"><ArrowUpRight className="w-5 h-5" />
              <div className="min-w-0"><div className="text-xs sm:text-sm uppercase font-black truncate">DEPOSIT</div>
                <div className="text-[9px] sm:text-[11px] opacity-90">Official Lighter ↗</div></div>
            </div><ChevronRight className="w-4 h-4"/>
          </a>
          <a href="https://app.lighter.xyz/" target="_blank" rel="noopener noreferrer"
            className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-brand-surface border border-brand-border text-brand-text font-extrabold flex items-center justify-between shadow-sm text-left group min-w-0">
            <div className="flex items-center gap-2 min-w-0"><ArrowDownRight className="w-5 h-5 text-accent"/>
              <div className="min-w-0"><div className="text-xs sm:text-sm uppercase font-black truncate">WITHDRAWAL</div>
                <div className="text-[9px] sm:text-[11px] text-brand-muted">Official Lighter ↗</div></div>
            </div><ChevronRight className="w-4 h-4 text-brand-muted"/>
          </a>
        </div>
        <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 sm:gap-3" id="balances-grid-display">
          {[
            {title:"SPOT AVAILABLE",subtitle:"Separate Lighter spot balance not verified",value:null,icon:<Wallet className="w-4 h-4"/>},
            {title:"PERPETUAL COLLATERAL",subtitle:"Verified Lighter collateral",value:verifiedCollateral,icon:<TrendingUp className="w-4 h-4"/>},
            {title:"AVAILABLE FOR TRADE",subtitle:"Exchange-reported available balance",value:verifiedAvailable,icon:<Unlock className="w-4 h-4"/>},
            {title:"MARGIN IN TRADE",subtitle:"Locked margin not independently verified",value:null,icon:<Lock className="w-4 h-4"/>},
          ].map(row => <div key={row.title}
            className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between shadow-xs min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex justify-center items-center text-accent">{row.icon}</span>
                <span className="text-[9px] sm:text-[11px] font-bold uppercase text-brand-muted leading-tight">{row.title}</span>
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-brand-text truncate">{showBalance(row.value)}</div>
              <div className="text-[9px] sm:text-[11px] font-mono text-brand-muted leading-tight">{row.subtitle}</div>
            </div>)}
        </div>
        <p className="text-[10px] text-brand-muted px-1">Lighter account amounts only. Unsupported spot/margin details remain unavailable—not estimated or copied from Hyperliquid. Deposit and withdrawal open the official exchange until HideDex Lighter signing is verified.</p>
        {accountCards}
      </div>;
    })()}

    {section === "orders" && <div className="rounded-xl border border-brand-border bg-brand-bg p-3">
      {lighterAccountTabs}
    </div>}

  </div>;
}
