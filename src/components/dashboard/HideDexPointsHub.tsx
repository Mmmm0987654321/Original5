import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Trophy, Wallet, CheckCircle2 } from "lucide-react";

type Rewards = {
 access_status?:string;
 registration_complete?:boolean;
 points?:number|string|null;
 points_status?:string|null;
 referral_claimed_points?:number|string|null;
 total_airdrop_points?:number|string|null;
 volume_total_usd?:number|string|null;
};
type Props={walletAddress:string;apiUrl:string;onBack:()=>void;onConnectWallet:()=>void;onEarlyAccess:()=>void};
const amount=(x:unknown)=>{
 const v=Number(x);
 return x===null||x===undefined||!Number.isFinite(v)||v<0?0:v;
};

/** Public rewards overview with one status request and no approval lookup.
 *  Unregistered wallets show zero and may still navigate around the app.
 */
export default function HideDexPointsHub({walletAddress,apiUrl,onBack,onConnectWallet,onEarlyAccess}:Props){
 const wallet=walletAddress.trim().toLowerCase();
 const connected=/^0x[0-9a-f]{40}$/.test(wallet);
 const [data,setData]=useState<Rewards|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const read=useCallback(async(signal:AbortSignal)=>{
   if(!connected){setData(null);setLoading(false);setError("");return;}
   setLoading(true);setError("");
   try{
    const res=await fetch(apiUrl,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"status",wallet}),signal});
    const body:Rewards=await res.json();
    if(!res.ok)throw Error("Points balance is temporarily unavailable.");
    if(!signal.aborted)setData(body);
   }catch(e){
    if(!signal.aborted)setError(e instanceof Error?e.message:"Points temporarily unavailable.");
   }finally{if(!signal.aborted)setLoading(false);}
 },[apiUrl,wallet,connected]);
 useEffect(()=>{
  const c=new AbortController();void read(c.signal);
  return ()=>c.abort();
 },[read]);
 const trading=amount(data?.points);
 const social=amount(data?.referral_claimed_points);
 const total=Math.round((trading+social)*100)/100;
 const registered=!!data?.registration_complete;
 const verified=data?.points_status==="verified";
 const f=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits:1});
 return <section id="hidedex-airdrop-points" className="w-full max-w-3xl mx-auto px-2 sm:px-5 py-3 sm:py-6 space-y-3 text-brand-text">
   <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-sub"><ArrowLeft size={15}/> Markets</button>
   <div className="flex items-center gap-2">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-primary"><Trophy size={18}/></div>
    <div><h1 className="text-lg sm:text-xl font-bold">Airdrop Points</h1>
     <p className="text-[11px] text-brand-muted">Trading + Social Referral</p></div>
   </div>
   {!connected?<div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-3">
     <p className="text-xs text-brand-muted">Connect a wallet to view your saved rewards. Early Access approval is not required.</p>
     <button type="button" onClick={onConnectWallet} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary text-black font-semibold px-4 py-2.5 text-xs"><Wallet size={14}/> Connect Wallet</button>
    </div>:<>
     <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-brand-muted">Total Airdrop Points</p>
      <div className="flex items-center justify-between gap-2 mt-1">
       <div className="text-3xl sm:text-4xl font-mono font-bold tabular-nums">{loading?"…":f(total)}</div>
       {registered?<span className="inline-flex items-center gap-1 text-[10px] text-brand-primary"><CheckCircle2 size={13}/> Registered</span>:
          <span className="text-[10px] text-brand-muted">Not enrolled</span>}
      </div>
      <p className="text-[10px] text-brand-muted mt-2 font-mono">{wallet.slice(0,6)}…{wallet.slice(-4)}</p>
     </div>
     <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
       <p className="text-[11px] font-semibold text-brand-muted">Trading Points</p>
       <div className="mt-2 text-2xl font-mono font-bold">{loading?"…":f(trading)}</div>
       <p className="mt-2 text-[10px] text-brand-muted">{registered?(verified?"Verified Early Access":"Verification pending"):"Join Early Access"}</p>
      </div>
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
       <p className="text-[11px] font-semibold text-brand-muted">Social Referral Points</p>
       <div className="mt-2 text-2xl font-mono font-bold text-brand-primary">{loading?"…":f(social)}</div>
       <p className="mt-2 text-[10px] text-brand-muted">Claimed referral rewards</p>
      </div>
     </div>
     {!registered && !loading && !error && <button type="button" onClick={onEarlyAccess} className="rounded-lg border border-brand-primary/40 px-4 py-2.5 text-xs font-semibold text-brand-primary">Join Early Access</button>}
     {!!data?.volume_total_usd && registered && <p className="text-[11px] text-brand-muted">Recorded trading volume: ${amount(data.volume_total_usd).toLocaleString(undefined,{maximumFractionDigits:2})}</p>}
    </>}
   {error&&<p role="status" className="rounded-lg border border-brand-border bg-brand-surface p-3 text-xs text-brand-muted">{error}</p>}
   <p className="text-[10px] text-brand-muted">Programme points are not transferable tokens or guaranteed token allocations.</p>
 </section>;
}
