import React from "react";
import {AlertTriangle, ArrowLeft, ExternalLink, LockKeyhole, ShieldAlert, Wallet} from "lucide-react";

/**
 * Aster 1001x is a distinct on-chain perps venue. It is NOT Aster Pro V3.
 * No 1001x order sender, ABI, contract address, oracle or account model has
 * been independently verified for HideDex. Never route these actions through
 * Aster Pro's /fapi/v3/order, balances, positions, or withdrawal handlers.
 *
 * This page fails closed until a separate, reviewed on-chain adapter exists.
 */
export default function Aster1001xPanel({
  walletAddress, perpTradingApproved, onConnectWallet, onReturnToPro,
}: {
  walletAddress: string;
  perpTradingApproved: boolean;
  onConnectWallet: () => void;
  onReturnToPro: () => void;
}) {
  const shortWallet = walletAddress
    ? walletAddress.slice(0, 6) + "…" + walletAddress.slice(-4)
    : null;

  return (
    <section className="w-full min-w-0 space-y-3" aria-label="Aster 1001x on-chain trading" data-aster-mode="1001x">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-brand-text">Aster 1001x</h2>
            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              EXECUTION NOT CONNECTED
            </span>
          </div>
          <p className="text-xs text-brand-muted">Separate on-chain perpetual trading mode — not Aster Pro or Spot</p>
        </div>
        <button type="button" onClick={onReturnToPro}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-overlay-subtle px-3 text-xs font-bold text-brand-text hover:bg-brand-overlay-normal">
          <ArrowLeft className="h-3.5 w-3.5"/> Return to Perpetual
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,330px)]">
        <div className="min-h-[280px] rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-text">
            <ShieldAlert className="h-4 w-4 text-amber-400"/> 1001x price and positions
          </div>
          <p className="mt-3 text-sm leading-6 text-brand-sub">
            Live 1001x oracle prices, supported pairs, position balances and order history are not
            independently connected. Showing Aster Pro quotes or positions here would be misleading.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Oracle price", "Unavailable"],
              ["Supported markets", "Unverified"],
              ["Open positions", "Not connected"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-brand-border bg-brand-overlay-subtle p-3">
                <span className="block text-[10px] text-brand-muted">{label}</span>
                <span className="mt-1 block break-words text-xs font-bold text-brand-text">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"/>
            <p className="text-xs leading-5 text-brand-sub">
              Aster 1001x uses on-chain contracts and oracle-verified execution. It can require
              separate collateral, approvals and gas; deposits to Aster Pro must never be treated
              as available 1001x collateral. Extreme leverage creates a high risk of liquidation.
            </p>
          </div>
        </div>

        <aside className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5" aria-label="1001x order status">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-text">
            <LockKeyhole className="h-4 w-4 text-brand-muted"/> 1001x Trading
          </div>
          <p className="mt-2 text-xs leading-5 text-brand-muted">
            Market, Limit, Take Profit, Stop Loss, Close and collateral transfers require a
            verified 1001x-specific smart-contract adapter. No order is sent from this panel.
          </p>
          <div className="mt-4 rounded-xl border border-brand-border bg-brand-overlay-subtle p-3">
            <p className="text-[11px] font-semibold text-brand-sub">Connected wallet</p>
            <p className="mt-1 break-all font-mono text-xs text-brand-text">{shortWallet || "Not connected"}</p>
          </div>
          {!shortWallet && (
            <button type="button" onClick={onConnectWallet}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-overlay-normal px-4 py-3 text-xs font-bold text-brand-text hover:border-accent">
              <Wallet className="h-4 w-4"/> Connect Wallet
            </button>
          )}
          {!perpTradingApproved && (
            <p className="mt-3 text-xs leading-5 text-amber-300">
              HideDex Perpetual Early Access approval is also required for trading.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled title="Unverified 1001x on-chain execution"
              className="cursor-not-allowed rounded-xl border border-brand-border bg-brand-overlay-subtle py-3 text-xs font-bold text-brand-muted opacity-75">LONG — UNAVAILABLE</button>
            <button type="button" disabled title="Unverified 1001x on-chain execution"
              className="cursor-not-allowed rounded-xl border border-brand-border bg-brand-overlay-subtle py-3 text-xs font-bold text-brand-muted opacity-75">SHORT — UNAVAILABLE</button>
          </div>
          <p role="status" className="mt-3 text-[11px] leading-5 text-brand-muted">
            Live trading remains disabled rather than submitting a normal Aster Pro order or
            creating a signature for an unverified contract.
          </p>
        </aside>
      </div>
      <p className="px-1 text-[11px] text-brand-muted">
        Official 1001x documentation:
        {" "}
        <a href="https://docs.asterdex.com/trading/1001x/direct-contract-interaction"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-accent underline underline-offset-2">
          Contract interaction reference <ExternalLink className="h-3 w-3"/>
        </a>
      </p>
    </section>
  );
}
