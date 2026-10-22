import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, Trophy } from "lucide-react";

type PointsSnapshot = {
  access_status?: string;
  points?: number | string | null;
  points_status?: string | null;
  volume_total_usd?: number | string | null;
  volume_source?: string | null;
  points_source?: string | null;
  x_username?: string | null;
  x_verification_status?: string | null;
};
interface Props { walletAddress: string; apiUrl: string; onBack: () => void; }

/** Dedicated HideDex Airdrop Points page. Only the authenticated registration
 * service defines rewards; no guessed balances, rank, dates, or token values.
 */
export default function HideDexPointsHub({ walletAddress, apiUrl, onBack }: Props) {
  const [data,setData] = useState<PointsSnapshot | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const readPoints = useCallback(async (signal:AbortSignal) => {
    const wallet = walletAddress.trim().toLowerCase();
    if(!/^0x[0-9a-f]{40}$/.test(wallet)){
      setLoading(false);setData(null);setError("Connect an approved Early Access wallet.");return;
    }
    setLoading(true);setError("");
    try {
      const response = await fetch(apiUrl,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"status",wallet}),
        signal,
      });
      const result:PointsSnapshot = await response.json();
      if (!response.ok || result?.access_status !== "granted") {
        if(!signal.aborted){setData(null);setError("Could not verify your Early Access rewards.");}
        return;
      }
      if(!signal.aborted)setData(result);
    } catch {
      if(!signal.aborted){setData(null);setError("Rewards are temporarily unavailable.");}
    } finally {
      if(!signal.aborted)setLoading(false);
    }
  },[walletAddress,apiUrl]);
  useEffect(()=>{
    const controller=new AbortController();
    void readPoints(controller.signal);
    return ()=>controller.abort();
  },[readPoints]);

  const rawPoints = data?.points == null ? null : Number(data.points);
  const points = rawPoints!==null&&Number.isFinite(rawPoints)&&rawPoints>=0 ? rawPoints : null;
  const rawVolume = data?.volume_total_usd==null?null:Number(data.volume_total_usd);
  const volume = rawVolume!==null&&Number.isFinite(rawVolume)&&rawVolume>=0?rawVolume:null;
  const pointsVerified = data?.points_status==="verified";
  const xVerified = data?.x_verification_status==="verified";
  return <section id="hidedex-airdrop-points" className="w-full max-w-3xl mx-auto px-2 sm:px-5 py-3 sm:py-6 space-y-3 text-brand-text">
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-sub hover:text-brand-text cursor-pointer">
        <ArrowLeft size={15}/> Markets
      </button>
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-brand-muted"><ShieldCheck size={13}/> Early Access</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-primary"><Trophy size={18}/></div>
      <div>
        <h1 className="text-lg sm:text-xl font-bold leading-tight">Airdrop Points</h1>
        <p className="text-[11px] text-brand-muted">HideDex Rewards</p>
      </div>
    </div>
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Your saved points</p>
          <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight">{loading?"…":points===null?"—":points.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
        <span className={`shrink-0 px-2 py-1 rounded-md border text-[10px] font-semibold ${pointsVerified?"bg-emerald-500/10 border-emerald-500/25 text-emerald-400":"border-brand-border text-brand-muted"}`}>
          {loading?"Checking":pointsVerified?"Verified":"Pending"}
        </span>
      </div>
      <div className="mt-4 pt-3 border-t border-brand-border/70 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-brand-muted">Registered wallet</div>
          <div className="mt-1 font-mono font-semibold text-brand-text">{walletAddress.slice(0,6)}…{walletAddress.slice(-6)}</div>
        </div>
        <div>
          <div className="text-[10px] text-brand-muted">Eligible trading volume</div>
          <div className="mt-1 font-mono font-semibold tabular-nums text-brand-text">{loading?"…":volume===null?"—":"$"+volume.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
      </div>
    </div>
    {data?.x_username && <div className="flex justify-between items-center gap-3 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-xs">
      <span className="truncate text-brand-sub">X <strong className="text-brand-text">{data.x_username}</strong></span>
      <span className="flex items-center gap-1 font-semibold text-brand-muted">{xVerified&&<CheckCircle2 className="text-emerald-400" size={14}/>} {xVerified?"Verified":"Pending"}</span>
    </div>}
    {error && <p role="status" className="rounded-lg border border-brand-border bg-brand-surface p-3 text-xs text-brand-muted">{error}</p>}
    <p className="text-[10px] leading-relaxed text-brand-muted">Programme points only. Token distribution and conversion are not guaranteed.</p>
  </section>;
}
