/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { X, AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { Position } from "../../types";

interface ClosePositionModalProps {
  position: Position;
  onClose: () => void;
  onConfirmClose: (position: Position, closePercent: number) => Promise<void> | void;
  lighterMode?: boolean;
  verifiedUnrealizedPnl?: number | null;
  verifiedMargin?: number | null;
  /** Estimated initial-margin requirement released on cross partial close. Not a cash refund. */
  estimatedMarginRequirement?: number | null;
  verifiedMarkPrice?: boolean;
  /** Exchange-specific errors remain visible through the common top toast. */
  onError?: (message:string)=>void;
}

export default function ClosePositionModal({
  position,
  onClose,
  onConfirmClose,
  lighterMode=false,
  verifiedUnrealizedPnl=null,
  verifiedMargin=null,
  estimatedMarginRequirement=null,
  verifiedMarkPrice=false,
  onError,
}: ClosePositionModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [closePercent, setClosePercent] = useState<number>(100);

  const safeClosePercent = Math.min(100, Math.max(1, closePercent));

  // Proportional market close calculations
  const closeFraction = safeClosePercent / 100;
  const closingSize = position.size * closeFraction;
  const estimatedPnl = position.unrealizedPnl * closeFraction;
  const closedMargin = position.margin * closeFraction;
  const estReceive = Math.max(0, closedMargin + estimatedPnl);
  const hasPnl = !lighterMode || verifiedUnrealizedPnl !== null;
  // In CROSS mode Lighter returns allocated_margin: 0. This is not a $0
  // payout; initial margin remains shared collateral, not a wallet refund.
  const hasMargin = !lighterMode || (verifiedMargin !== null && verifiedMargin > 0);
  const showReleasedInitialMargin = lighterMode && !hasMargin &&
    estimatedMarginRequirement !== null &&
    Number.isFinite(estimatedMarginRequirement) && estimatedMarginRequirement >= 0;
  const hasRoi = (!lighterMode || (hasMargin && hasPnl)) &&
    Number.isFinite(position.unrealizedPnlPercent) && position.leverage > 0;

  const cleanSym = (position.symbol || "").replace("-PERP", "").replace("-SPOT", "").replace("-USDC", "").toUpperCase();
  
  let tokenBg = "bg-blue-500/20 border-blue-500/40 text-blue-400";
  let tokenChar = cleanSym.slice(0, 1) || "•";
  if (cleanSym === "BTC") {
    tokenBg = "bg-[#f7931a] text-white";
    tokenChar = "₿";
  } else if (cleanSym === "ETH") {
    tokenBg = "bg-[#627eea] text-white";
    tokenChar = "Ξ";
  } else if (cleanSym === "SOL") {
    tokenBg = "bg-[#9945ff] text-white";
    tokenChar = "S";
  } else if (cleanSym === "XRP") {
    tokenBg = "bg-[#23292f] border-slate-500 text-white";
    tokenChar = "✕";
  }

  const handleConfirmClose = async () => {
    if (isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await onConfirmClose(position, safeClosePercent);
      onClose();
    } catch (err: any) {
      const message=err?.message || "An unexpected error occurred.";
      // The original modal owns the one error surface; never raise a second Lighter toast.
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLong = position.type === "LONG";
  const displayLeverage = Number.isFinite(position.leverage) && position.leverage > 0 ? `${position.leverage}x` : "--";
  const marginModeStr = position.marginType === 'isolated' ? 'Isolated' : 'Cross';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 select-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-[#070b14]/75 backdrop-blur-sm"
      />

      {/* Main Content Modal Container */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-position-title"
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-[480px] bg-brand-bg border border-brand-border/70 rounded-none sm:rounded-3xl px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl z-10 flex flex-col gap-3 sm:gap-4 text-brand-text overflow-y-auto overscroll-contain scrollbar-none"
      >
        {/* Drag handle */}
        <div className="w-12 h-1 rounded-full bg-brand-border mx-auto -mt-1" />

        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 id="close-position-title" className="text-lg sm:text-xl font-bold text-brand-text tracking-tight">Close Position</h3>
            <p className="text-xs text-brand-sub mt-0.5 font-normal">Close at market price. Final execution price may vary.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-brand-surface border border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-overlay-normal transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Position Summary Card */}
        <div className="bg-brand-surface border border-brand-profit/25 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
          {/* Top Row of Card */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md shrink-0 ${tokenBg}`}>
                {tokenChar}
              </div>
              <span className="font-extrabold text-brand-text text-base tracking-tight">{cleanSym || position.symbol}</span>
              {(position.marginType || position.leverage > 0) && <span className="bg-brand-overlay-normal border border-brand-border text-brand-sub text-[11px] font-semibold px-2 py-0.5 rounded-md">
                {position.marginType ? marginModeStr : "—"} {displayLeverage}
              </span>}
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider ${
                isLong 
                  ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" 
                  : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"
              }`}>
                {position.type}
              </span>
              <span className={`font-bold text-base font-mono ${position.unrealizedPnl >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
                {hasRoi ? <>{position.unrealizedPnl >= 0 ? "+" : ""}{position.unrealizedPnlPercent.toFixed(1)}%</> : "—"}
              </span>
            </div>
          </div>

          {/* Bottom 3-Col Stats in Card */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-divider/30 font-mono">
            <div>
              <span className="text-brand-muted block text-[9px] font-bold uppercase tracking-wider">Entry Price</span>
              <span className="font-bold text-brand-text text-xs sm:text-[13px]">
                {lighterMode&&position.entryPrice<=0?"—":"$"+position.entryPrice.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:2})}
              </span>
            </div>
            <div>
              <span className="text-brand-muted block text-[9px] font-bold uppercase tracking-wider">{lighterMode&&!verifiedMarkPrice?"Last Trade Price (reference)":"Mark Price (Live)"}</span>
              <span className="font-bold text-brand-text text-xs sm:text-[13px]">
                {Number.isFinite(position.markPrice) && position.markPrice > 0
                  ? `$${position.markPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`
                  : "--"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-brand-muted block text-[9px] font-bold uppercase tracking-wider">PnL</span>
              <span className={`font-bold text-xs sm:text-[13px] ${position.unrealizedPnl >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
                {hasPnl?<>{position.unrealizedPnl >= 0 ? "+$" : "-$"}{Math.abs(position.unrealizedPnl).toFixed(2)}</>:"—"}
              </span>
            </div>
          </div>
        </div>

        {/* Order Type & Execution Price Form Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-brand-muted font-bold uppercase tracking-wider block">
              Order Type
            </label>
            <div className="bg-brand-surface border border-brand-border rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold text-brand-text">
              Market
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-brand-muted font-bold uppercase tracking-wider block">
              Execution Price
            </label>
            <div className="bg-brand-surface border border-brand-border rounded-xl py-2.5 px-3 text-xs sm:text-sm font-medium text-brand-sub truncate shadow-inner">
              Market price at execution
            </div>
          </div>
        </div>

        {/* Closing Size UI with Interactive Slider & Quick Percent Buttons */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">
              Closing Size
            </span>
            <span className="text-brand-profit font-bold text-xs font-mono">
              {safeClosePercent}% ({closingSize.toLocaleString(undefined, { maximumFractionDigits: 5 })} {cleanSym || position.symbol})
            </span>
          </div>

          <>{/* Interactive Range Control */}
          <div className="relative w-full flex items-center">
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={safeClosePercent}
              onChange={(e) => setClosePercent(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-brand-overlay-active accent-emerald-500 focus:outline-none disabled:opacity-50"
              style={{
                background: `linear-gradient(to right, rgb(16 185 129) 0%, rgb(16 185 129) ${safeClosePercent}%, rgba(255, 255, 255, 0.08) ${safeClosePercent}%, rgba(255, 255, 255, 0.08) 100%)`,
              }}
            />
          </div>

          {/* Quick Selection Buttons */}
          <div className="grid grid-cols-5 gap-1.5 pt-0.5">
            {[10, 20, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={isSubmitting}
                onClick={() => setClosePercent(pct)}
                className={`py-1 px-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold transition-all cursor-pointer text-center ${
                  safeClosePercent === pct
                    ? "bg-brand-profit/20 text-brand-profit border border-brand-profit/40 shadow-xs"
                    : "bg-brand-surface border border-brand-border text-brand-sub hover:text-brand-text hover:bg-brand-overlay-normal"
                } disabled:opacity-50`}
              >
                {pct}%
              </button>
            ))}
          </div></>
        </div>

        {/* Summary Metric Area */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-3.5 sm:p-4 space-y-2 text-xs font-mono text-brand-sub">
          <div className="flex items-center justify-between text-brand-sub">
            <span>Closing Amount</span>
            <span className="font-bold text-brand-text">
              {closingSize.toLocaleString(undefined, { maximumFractionDigits: 5 })} {cleanSym || position.symbol}
            </span>
          </div>

          <div className="flex items-center justify-between text-brand-sub">
            <span>Unrealized PnL (estimate)</span>
            <span className={`font-bold ${estimatedPnl >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
              {hasPnl ? (estimatedPnl >= 0 ? "+" : "")+"$"+estimatedPnl.toFixed(2) : "—"}
            </span>
          </div>


          <div className="flex items-center justify-between text-brand-muted">
            <span className="flex items-center gap-1">
              Trading Fee <HelpCircle className="w-3 h-3 text-brand-muted" />
            </span>
            <span className="text-brand-muted">Charged at execution</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-brand-divider/30">
            <span className="text-brand-sub">{showReleasedInitialMargin?
              "Est. Initial Margin Released":"Est. Proceeds (before fees)"}</span>
            <span className="font-bold text-brand-profit text-sm">
              {showReleasedInitialMargin ?
                "≈$"+(estimatedMarginRequirement! * closeFraction).toFixed(2)+" USDC" :
                hasMargin && hasPnl ? "$"+estReceive.toFixed(2)+" USDC" : "—"}
            </span>
          </div>

        </div>

        <p className="text-[11px] text-brand-muted leading-snug">{showReleasedInitialMargin
          ? "Estimated margin requirement released is not a cash payout. Cross collateral stays pooled; available balance, PnL and fees reconcile after the real fill."
          : "Estimates use current reference price and verified data when available; final fill price, fees and proceeds can differ."}</p>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug text-[11px]">{errorMsg}</span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="grid grid-cols-2 gap-3 pt-3 sticky bottom-0 z-20 bg-brand-bg border-t border-brand-border/50 -mx-4 px-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 sm:pb-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="py-3.5 px-4 rounded-2xl border border-brand-border bg-brand-surface hover:bg-brand-overlay-normal text-brand-text font-bold text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer text-center active:scale-[0.99]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClose}
            disabled={isSubmitting}
            className="py-3.5 px-4 bg-gradient-to-r from-[#ff0055] to-[#ff2a6d] hover:from-[#ff1a66] hover:to-[#ff3d7a] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-rose-500/25 transition-all cursor-pointer text-center active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Closing...
              </>
            ) : safeClosePercent === 100 ? (
              "Market Close"
            ) : (
              `Close ${safeClosePercent}%`
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

