import React, { useEffect, useMemo, useState } from "react";
import {
  getLighterAccountIndexes, getLighterMarkets, getLighterPublicAccounts, subscribeLighterBook,
  type LighterMarket, type LighterMarketFeed, type LighterPublicAccount,
} from "../../lib/lighterMarketData";

/**
 * Lighter's isolated live-market preview. No Hyperliquid positions, balances or
 * order execution are passed into it. No order buttons are enabled until the
 * user's Lighter API key registration + official WASM signer have been verified.
 */
export default function LighterMarketPreview({
  walletAddress,
}: { walletAddress: string }) {
  const [markets, setMarkets] = useState<LighterMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [kind, setKind] = useState<"perp" | "spot">("perp");
  const [marketError, setMarketError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{ status: "loading" | "ready" | "error"; indexes: number[] }>({
    status: "loading", indexes: [],
  });
  const [publicAccounts, setPublicAccounts] = useState<LighterPublicAccount[] | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [feed, setFeed] = useState<LighterMarketFeed>({
    status: "connecting", bids: [], asks: [], recentTradePrice: null,
  });

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    getLighterMarkets(abort.signal).then(data => {
      if (abort.signal.aborted) return;
      setMarkets(data);
      setSelectedMarketId(data.find(x => x.kind === "perp")?.id ?? data[0]?.id ?? null);
      setMarketError(null);
    }).catch(err => {
      if (!abort.signal.aborted) setMarketError(err instanceof Error ? err.message : "Lighter markets unavailable");
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    setAccount({ status: "loading", indexes: [] });
    setPublicAccounts(null);
    setAccountError(null);
    if (!walletAddress) {
      setAccount({ status: "ready", indexes: [] });
      return () => abort.abort();
    }
    getLighterAccountIndexes(walletAddress, abort.signal).then(async indexes => {
      if (abort.signal.aborted) return;
      setAccount({ status: "ready", indexes });
      const snapshots = await getLighterPublicAccounts(indexes, abort.signal);
      if (!abort.signal.aborted) setPublicAccounts(snapshots);
    }).catch(error => {
      if (abort.signal.aborted) return;
      setAccountError(error instanceof Error ? error.message : "Lighter public account lookup failed");
      setAccount({ status: "error", indexes: [] });
    });
    return () => abort.abort();
  }, [walletAddress]);

  const available = useMemo(() => markets.filter(x => x.kind === kind), [markets, kind]);
  const selected = markets.find(x => x.id === selectedMarketId && x.kind === kind) ?? available[0];
  // Per Lighter: displayed price = wire price / multiplier,
  // displayed size = wire size * multiplier. This is not Hyperliquid math.
  const mul = selected?.multiplier && selected.multiplier > 0 ? selected.multiplier : 1;
  const formatLighterPrice = (raw: string) => {
    const n = Number(raw) / mul;
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 12 }) : "—";
  };
  const formatLighterSize = (raw: string) => {
    const n = Number(raw) * mul;
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 12 }) : "—";
  };
  useEffect(() => {
    if (!selected) return;
    setFeed({ status: "connecting", bids: [], asks: [], recentTradePrice: null });
    return subscribeLighterBook(selected.id, setFeed);
  }, [selected?.id]);

  return (
    <section className="w-full min-h-[70vh] bg-brand-bg text-brand-text p-3 sm:p-5" aria-label="Lighter mainnet markets">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold">Lighter</h1>
          <span className="rounded border border-brand-border bg-brand-surface px-2 py-1 text-[10px]">MAINNET · Live market data</span>
        </div>
        <span className="text-xs text-brand-muted">WebSocket: {feed.status}</span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => { setKind("perp"); setSelectedMarketId(null); }}
          className={`px-3 py-2 rounded-lg text-xs border border-brand-border ${kind==="perp" ? "bg-brand-surface font-bold" : "opacity-60"}`}>Perpetual</button>
        <button type="button" onClick={() => { setKind("spot"); setSelectedMarketId(null); }}
          className={`px-3 py-2 rounded-lg text-xs border border-brand-border ${kind==="spot" ? "bg-brand-surface font-bold" : "opacity-60"}`}>Spot</button>
        <select aria-label="Lighter market" value={selected?.id ?? ""} onChange={e => setSelectedMarketId(Number(e.target.value))}
          className="max-w-[170px] truncate rounded-lg border border-brand-border bg-brand-surface px-2 py-2 text-xs">
          {available.map(m => <option key={m.id} value={m.id}>{m.symbol}</option>)}
        </select>
      </div>

      {loading && <p role="status" className="text-sm text-brand-muted">Loading real Lighter markets…</p>}
      {marketError && <p role="alert" className="text-sm text-red-400">Lighter market data unavailable: {marketError}. No fallback to Hyperliquid data.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <div className="text-[11px] uppercase text-brand-muted">Selected market</div>
          <div className="mt-1 text-xl font-bold">{selected?.symbol ?? "—"} <span className="text-xs font-normal text-brand-muted">{kind === "perp" ? "Perpetual" : "Spot"}</span></div>
          <div className="mt-4 text-xs text-brand-muted">Latest Lighter trade price</div>
          <div className="mt-1 text-2xl font-mono font-bold">{feed.recentTradePrice ? formatLighterPrice(feed.recentTradePrice) : "Waiting for live trades…"}</div>
          <div className="border-t border-brand-border mt-6 pt-5">
            <h2 className="text-sm font-semibold">Trading authorization</h2>
            <p className="text-xs text-brand-muted leading-6 mt-2">
              Lighter uses a separately registered account API key and its own WASM transaction signer.
              This preview shows verified public market data only. Buy, Sell, Close, TP/SL,
              Deposit and Withdraw are not wired or enabled. No trades can be sent to Hyperliquid from this view.
            </p>
            <a href="https://app.lighter.xyz/" target="_blank" rel="noopener noreferrer"
              className="inline-block mt-3 rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold">
              Open official Lighter account setup ↗
            </a>
          </div>
          <div className="mt-6 text-xs text-brand-muted">
            {account.status === "loading" && "Looking up connected wallet on Lighter…"}
            {account.status === "error" && "Lighter wallet lookup failed; balance cannot be verified."}
            {account.status === "ready" && !walletAddress && "Connect a wallet to look up your Lighter account."}
            {account.status === "ready" && !!walletAddress && !account.indexes.length && "No Lighter account verified for this wallet."}
            {account.status === "ready" && account.indexes.length > 0 &&
              `Lighter account indexes: ${account.indexes.join(", ")}. Private balances and positions require their own verified account integration.`}
          </div>
          {accountError && <p role="alert" className="mt-2 text-xs text-red-400">{accountError}</p>}
          {publicAccounts && publicAccounts.length > 0 && (
            <div className="mt-5 border-t border-brand-border pt-4 space-y-3">
              <h2 className="text-sm font-semibold">Lighter public account state</h2>
              {publicAccounts.map(account => (
                <div key={account.index} className="rounded-lg border border-brand-border p-3 text-xs">
                  <div className="font-bold mb-2">Account #{account.index}</div>
                  <div>Available balance: <strong>{account.availableBalance === null ? "Unavailable" : account.availableBalance.toLocaleString()} </strong></div>
                  <div className="mt-1">Collateral: <strong>{account.collateral === null ? "Unavailable" : account.collateral.toLocaleString()}</strong></div>
                  <div className="mt-2 font-semibold">Open positions</div>
                  {!account.positions.length && <div className="text-brand-muted mt-1">No open positions reported</div>}
                  {account.positions.map((p, i) => (
                    <div key={i} className="mt-1 flex flex-wrap gap-2 justify-between border-t border-brand-border pt-1 font-mono text-[10px]">
                      <span>{p.symbol} {p.signedSize > 0 ? "LONG" : "SHORT"} {Math.abs(p.signedSize)}</span>
                      <span>Entry: {p.entryPrice ?? "—"}</span>
                      <span>PnL: {p.unrealizedPnl ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <h2 className="font-bold text-sm mb-3">Lighter Order Book</h2>
          <p className="text-xs text-brand-muted mb-3">Real streamed levels · {selected?.symbol ?? "—"}</p>
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-xs text-green-400 mb-2">Bids</div>
              {feed.bids.length ? feed.bids.map((l,i) =>
                <div key={i} className="flex justify-between gap-1 py-1 font-mono text-[10px]">
                  <span>{formatLighterPrice(l.price)}</span><span className="text-brand-muted">{formatLighterSize(l.size)}</span></div>
              ) : <p className="text-xs text-brand-muted">Waiting for book…</p>}</div>
            <div><div className="text-xs text-red-400 mb-2">Asks</div>
              {feed.asks.length ? feed.asks.map((l,i) =>
                <div key={i} className="flex justify-between gap-1 py-1 font-mono text-[10px]">
                  <span>{formatLighterPrice(l.price)}</span><span className="text-brand-muted">{formatLighterSize(l.size)}</span></div>
              ) : <p className="text-xs text-brand-muted">Waiting for book…</p>}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
