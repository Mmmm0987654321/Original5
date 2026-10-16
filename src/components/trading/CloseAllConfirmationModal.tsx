import React, { useState } from "react";
import { motion } from "motion/react";
import { X, ListChecks, ClipboardCheck, Loader2 } from "lucide-react";

interface CloseAllConfirmationModalProps {
  action?: "close_positions" | "cancel_orders" | "close_spot" | "close_all_spot";
  symbol?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

/** Shared confirmation surface only; no order/close execution logic is changed. */
export default function CloseAllConfirmationModal({
  action = "close_positions", symbol, onClose, onConfirm
}: CloseAllConfirmationModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const labels = {
    close_positions: {
      title: "Close All Positions",
      description: "Close all open perpetual positions at market price. Execution prices can vary.",
      notes: ["Spot assets will not be sold.", "Open orders are not automatically cancelled."],
      confirm: "Close Positions"
    },
    cancel_orders: {
      title: "Cancel All Orders",
      description: "Cancel all open orders in the selected trading account.",
      notes: ["Existing positions will remain open.", "Orders already filled cannot be cancelled."],
      confirm: "Cancel All Orders"
    },
    close_spot: {
      title: `Sell ${symbol || "Selected"} Spot Balance`,
      description: `Sell the available ${symbol || "selected asset"} spot balance at market price.`,
      notes: ["Assets reserved by open orders will not be sold.", "Execution price and proceeds may vary."],
      confirm: "Sell Available"
    },
    close_all_spot: {
      title: "Close All Spot Balances",
      description: "Sell eligible available spot assets at market price.",
      notes: ["USDC and assets reserved by open orders are excluded.", "Small unsellable balances may remain.", "Perpetual positions will not be closed."],
      confirm: "Sell Spot Assets"
    },
  }[action];
  const confirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 font-sans" role="presentation">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
        onClick={() => { if (!submitting) onClose(); }}
      />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bulk-confirm-title"
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.16 }}
        className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5 shadow-2xl text-brand-text"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            {action === "cancel_orders"
              ? <ListChecks className="w-5 h-5 text-accent" aria-hidden="true" />
              : <ClipboardCheck className="w-5 h-5 text-accent" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="bulk-confirm-title" className="font-bold text-base sm:text-lg leading-tight">{labels.title}</h2>
            <p className="text-xs sm:text-sm text-brand-muted leading-relaxed mt-1">{labels.description}</p>
          </div>
          <button type="button" aria-label="Close dialog" disabled={submitting} onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-overlay-normal disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 p-3 rounded-xl border border-brand-border/70 bg-brand-overlay-subtle">
          <ul className="list-disc pl-4 space-y-1.5 text-xs sm:text-sm text-brand-sub leading-relaxed">
            {labels.notes.map(note => <li key={note}>{note}</li>)}
          </ul>
        </div>
        <p className="mt-3 text-[11px] font-medium text-amber-500/90">Review before continuing. Completed trades cannot be undone.</p>
        {error && <p role="alert" className="mt-2 text-xs text-brand-loss">{error}</p>}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button type="button" onClick={onClose} disabled={submitting}
            className="min-h-11 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm font-semibold hover:bg-brand-overlay-normal disabled:opacity-50">
            Back
          </button>
          <button type="button" onClick={() => { void confirm(); }} disabled={submitting}
            className="min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#16130e] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Processing…" : labels.confirm}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
