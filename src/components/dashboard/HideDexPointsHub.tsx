import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck, Trophy } from "lucide-react";

type PointsSnapshot = {
  access_status?: string;
  points?: number | null;
  points_status?: string | null;
  x_username?: string | null;
  x_verification_status?: string | null;
  points_source?: string | null;
};

interface Props {
  walletAddress: string;
  apiUrl: string;
  onBack: () => void;
}

/** Full screen Points Hub, never a popup. Parent checks the live approved wallet first.
 * Status is read-only: no points, token allocations or verification are fabricated here.
 */
export default function HideDexPointsHub({walletAddress, apiUrl, onBack}: Props) {
  const [data, setData] = useState<PointsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const wallet = walletAddress.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
      setData(null);
      setLoading(false);
      setError("Connect the approved wallet to view your points.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"status",wallet}),
        signal,
      });
      const result: PointsSnapshot = await response.json();
      if (!response.ok || result?.access_status !== "granted") {
        if (!signal?.aborted) {
          setData(null);
          setError("Early Access approval could not be confirmed. Refresh or return to Markets.");
        }
        return;
      }
      if (!signal?.aborted) setData(result);
    } catch {
      if (!signal?.aborted) setError("Points information is temporarily unavailable. Try Refresh.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [walletAddress,apiUrl]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const points = data?.points;
  const actualSaved = typeof points === "number" && Number.isFinite(points);
  const status = data?.points_status === "verified" ? "Verified" : "Pending verification";
  const xStatus = data?.x_verification_status === "verified" ? "Verified" : "Pending verification";
  return (
    <section id="hidedex-points-hub" className="w-full max-w-5xl mx-auto min-h-[70dvh] px-3 sm:px-6 py-5 sm:py-8 space-y-5 text-brand-text">
      <div className="flex justify-between items-center gap-3">
        <button type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-muted hover:text-brand-text cursor-pointer rounded-lg px-2.5 py-2 border border-brand-border bg-brand-surface">
          <ArrowLeft className="w-4 h-4"/> Markets
        </button>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex gap-2 items-center rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-text disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}/> Refresh
        </button>
      </div>
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-brand-primary text-xs font-bold tracking-[0.18em] uppercase">
          <Trophy className="w-4 h-4"/> HideDex Rewards
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Points Hub</h1>
        <p className="text-sm text-brand-muted">Your saved Early Access reward status, directly from the registration system.</p>
      </header>
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-bold text-brand-sub"><ShieldCheck className="w-4 h-4 text-brand-primary"/> Approved wallet</span>
          <span className="font-mono text-[11px] text-brand-muted break-all">{walletAddress.slice(0,6)}…{walletAddress.slice(-6)}</span>
        </div>
        <div className="border-t border-brand-border/70 pt-4">
          <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">Saved Free Points</div>
          <div className="text-3xl sm:text-4xl font-mono font-extrabold text-brand-text mt-1">
            {loading ? "…" : actualSaved ? points!.toLocaleString(undefined,{maximumFractionDigits:2}) : "—"}
          </div>
          <div className="text-xs text-brand-muted mt-2">
            {loading ? "Loading saved rewards…" : actualSaved ? status : "No saved points found for this wallet."}
          </div>
        </div>
        {data?.x_username && (
          <div className="border-t border-brand-border/70 pt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-brand-sub">X {data.x_username}</span>
            <span className="inline-flex items-center gap-1 text-brand-muted">
              {xStatus === "Verified" && <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary"/>}{xStatus}
            </span>
          </div>
        )}
      </div>
      {error && <p role="status" className="rounded-xl bg-brand-overlay-subtle border border-brand-border px-3 py-3 text-xs text-brand-sub">{error}</p>}
      <p className="text-xs text-brand-muted leading-relaxed">Points are programme rewards, not a transferable token balance or a guaranteed future token allocation. No on-chain tokens are issued by this page.</p>
    </section>
  );
}
