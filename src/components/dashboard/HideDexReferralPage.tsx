import React, { useEffect, useState } from "react";
import { ArrowLeft, Copy, Link2, Users, CheckCircle2, Gift, Loader2 } from "lucide-react";
import {
  HIDEDEX_INVITE_CODE,
  hidedexReferralCall,
  hidedexReferralOverview,
  hidedexReferralExpire,
  hidedexReferralSession,
  type HideDexReferralOverview,
} from "../../lib/hidedexReferralClient";

type Props={
 walletAddress:string;walletConnected:boolean;onConnectWallet:()=>void;
 onEarlyAccess:()=>void;onBack:()=>void;
};
const pendingKey="hidedex_pending_invite_code";
const pendingWalletKey=(w:string)=>"hidedex_referral_pending_wallet_"+w;
const rewardTiers=[{n:1,p:0.1},{n:2,p:0.2},{n:5,p:0.5},{n:10,p:1},{n:50,p:6},{n:100,p:15}];

/** Read-only invite overview opens directly after wallet connection.
 * No referral-specific wallet signatures are requested, including on Apply.
 * Referrals are only confirmed with a pre-existing authenticated session or
 * the signed Early Access registration flow; otherwise a code stays pending.
 */
export default function HideDexReferralPage({
 walletAddress,walletConnected,onConnectWallet,onEarlyAccess,onBack
}:Props){
 const wallet=walletAddress.trim().toLowerCase();
 const valid=walletConnected&&/^0x[a-f0-9]{40}$/.test(wallet);
 const [profile,setProfile]=useState<HideDexReferralOverview|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [pendingSaved,setPendingSaved]=useState("");
 const [claimBusy,setClaimBusy]=useState(false);
 const [checkBusy,setCheckBusy]=useState(false);
 const [input,setInput]=useState(()=>{
  try {
   const param=new URLSearchParams(window.location.search).get("ref")||"";
   const saved=sessionStorage.getItem(pendingKey)||"";
   const code=(param||saved).trim().toUpperCase();
   return HIDEDEX_INVITE_CODE.test(code)?code:"";
  }catch{return "";}
 });

 useEffect(()=>{
  let alive=true;
  setProfile(null);setError("");setMessage("");setLoading(!!valid);
  try{const code=localStorage.getItem(pendingWalletKey(wallet))||"";
    setPendingSaved(HIDEDEX_INVITE_CODE.test(code)?code:"");}catch{setPendingSaved("");}
  if(valid){
   void hidedexReferralOverview(wallet).then(data=>{
    if(alive)setProfile(data);
   }).catch(err=>{
    if(alive)setError(err instanceof Error?err.message:"Could not load referral.");
   }).finally(()=>{if(alive)setLoading(false);});
  }
  return ()=>{alive=false;};
 },[wallet,valid]);

 const refresh=async()=>{
  hidedexReferralExpire(wallet);
  const result=await hidedexReferralOverview(wallet,true);
  setProfile(result);
  return result;
 };

 const apply=async()=>{
  const code=input.trim().toUpperCase();
  if(!HIDEDEX_INVITE_CODE.test(code)){setError("Enter a valid referral code.");return;}
  if(!valid||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   // Connecting a wallet is not proof of ownership. Referral pages never
   // request a signature; pending codes are completed on a signed Early Access
   // event or through a verified session that already exists.
   const token=hidedexReferralSession(wallet);
   if(!token){
    try{sessionStorage.setItem(pendingKey,code);localStorage.setItem(pendingWalletKey(wallet),code);}
    catch{setError("Cannot save on this device. Use the code during signed Early Access registration.");return;}
    setPendingSaved(code);
    setMessage("Saved on this device; permanent linking awaits verified Early Access enrollment.");
    return;
   }
   await hidedexReferralCall({action:"apply",wallet,token,referral_code:code});
   try{sessionStorage.removeItem(pendingKey);localStorage.removeItem(pendingWalletKey(wallet));}catch{}
   setPendingSaved("");
   await refresh();
   setMessage("Referral linked successfully.");
  }catch(e){
   setError(e instanceof Error?e.message:"Could not apply referral.");
  }finally{setBusy(false);}
 };

 const checkQualification=async()=>{
  if(!valid||checkBusy)return;
  const token=hidedexReferralSession(wallet);
  if(!token){setError("Verification needs an existing signed Early Access session.");return;}
  setCheckBusy(true);setError("");setMessage("");
  try{
   const checked=await hidedexReferralCall({action:"refresh_qualification",wallet,token});
   await refresh();
   setMessage(checked.checked
     ? "Checked "+checked.checked+" invites; "+checked.updated+" updated."
     : "No referrals are due for another check yet.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to check trades.");}
  finally{setCheckBusy(false);}
 };
 const claimRewards=async()=>{
  if(!valid||claimBusy||!profile||Number(profile.claimable_points)<=0)return;
  const token=hidedexReferralSession(wallet);
  if(!token){setError("Claim needs an existing verified Early Access session. No referral signature will open.");return;}
  setClaimBusy(true);setError("");setMessage("");
  try{const r=await hidedexReferralCall({action:"claim",wallet,token});
      await refresh();setMessage(Number(r.newly_claimed_points)>0
        ?Number(r.newly_claimed_points).toFixed(2)+" Airdrop Points claimed."
        :"No additional qualified points to claim.");}
  catch(e){setError(e instanceof Error?e.message:"Claim unavailable.");}
  finally{setClaimBusy(false);}
 };
 const ownCode=profile?.referral_code??"";
 const shareLink=ownCode?"https://hidedex.com/?ref="+encodeURIComponent(ownCode):"";
 const copy=async(value:string)=>{
  try{await navigator.clipboard.writeText(value);setError("");setMessage("Copied.");}
  catch{setError("Copy unavailable. Long-press to select the code.");}
 };
 return <section id="hidedex-referrals" className="w-full max-w-4xl mx-auto px-2 sm:px-6 py-3 sm:py-7 space-y-4 text-brand-text">
   <button type="button" onClick={onBack} className="inline-flex gap-2 items-center border border-brand-border rounded-lg bg-brand-surface text-xs text-brand-sub px-3 py-2 hover:text-brand-text">
    <ArrowLeft size={15}/> Markets
   </button>
   <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex justify-center items-center text-brand-primary"><Users size={19}/></div>
    <div><h1 className="text-xl sm:text-2xl font-extrabold">Referrals</h1><p className="text-xs text-brand-muted">Share • Earn • Claim</p></div>
   </div>
   {!valid
    ? <div className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-3">
      <p className="text-sm text-brand-sub">Connect your wallet to see your unique referral code.</p>
      <button type="button" onClick={onConnectWallet} className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-black">Connect Wallet</button>
     </div>
    : loading
    ? <div className="flex items-center gap-2 rounded-xl border border-brand-border p-5 text-xs text-brand-muted" role="status"><Loader2 size={16} className="animate-spin"/> Loading your referral code…</div>
    : profile
    ? <>
       <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">Your referral code</h2></div>
        <div className="flex items-center gap-2">
         <div className="flex-1 min-w-0 bg-brand-bg border border-brand-border rounded-lg px-3 py-3 font-mono text-lg tracking-wider font-bold select-all">{ownCode}</div>
         <button type="button" onClick={()=>void copy(ownCode)} className="inline-flex gap-1.5 items-center px-3 py-3 rounded-lg bg-brand-primary text-black font-semibold text-xs"><Copy size={14}/> Copy</button>
        </div>
        <div className="flex items-center gap-2">
         <div className="flex-1 min-w-0 bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-[11px] font-mono truncate select-all text-brand-sub">{shareLink}</div>
         <button type="button" onClick={()=>void copy(shareLink)} className="inline-flex gap-1.5 items-center px-3 py-2.5 rounded-lg border border-brand-border text-xs"><Link2 size={13}/> Link</button>
        </div>
       </div>
       <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4"><p className="text-[10px] text-brand-muted">Registered invites</p><div className="mt-1 text-2xl font-mono font-bold">{profile.total_invited}</div></div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4"><p className="text-[10px] text-brand-muted">Qualified referrals</p><div className="mt-1 text-2xl font-mono font-bold text-brand-primary">{profile.qualified_total}</div></div>
       </div>
       <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Gift size={16}/> Referral rewards <span className="ml-auto text-[10px] text-brand-muted">15 points max</span></h2>
         <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {rewardTiers.map(t=><div key={t.n} className={`rounded-lg border p-2 text-center text-[10px] ${profile.qualified_total>=t.n?"border-brand-primary/40 bg-brand-primary/10":"border-brand-border"}`}>
            <div className="font-bold">{t.n} invites</div><div className="mt-0.5 text-brand-muted">{t.p} pts</div>
          </div>)}
         </div>
         <div className="flex items-center justify-between gap-2 border-b border-brand-border/60 pb-3">
          <div><p className="text-[10px] text-brand-muted">Claimable</p><p className="text-lg font-mono font-bold text-brand-primary">{Number(profile.claimable_points||0).toFixed(2)} pts</p><p className="text-[10px] text-brand-muted">Claimed {Number(profile.claimed_points||0).toFixed(2)} · Earned {Number(profile.potential_points||0).toFixed(2)}</p></div>
          <button type="button" onClick={()=>void claimRewards()} disabled={claimBusy||Number(profile.claimable_points)<=0} className="px-4 py-2.5 rounded-lg bg-brand-primary text-xs font-bold text-black disabled:opacity-40">{claimBusy?"Claiming…":"Claim"}</button>
         </div>
         <button type="button" disabled={checkBusy||profile.total_invited===0} onClick={()=>void checkQualification()}
           className="text-[11px] text-brand-primary underline disabled:opacity-40 text-left self-start">
           {checkBusy?"Checking…":"Check new trading activity"}
         </button>
         <h3 className="text-xs font-bold">Apply a referral code</h3>
        {profile.applied_referral_code
         ? <p className="text-xs text-brand-sub inline-flex items-center gap-1.5"><CheckCircle2 size={15} className="text-brand-primary"/> Applied: <strong className="font-mono text-brand-text">{profile.applied_referral_code.startsWith("HDX-")?profile.applied_referral_code.slice(4):profile.applied_referral_code}</strong></p>
         : <>
          <p className="text-xs text-brand-muted">{pendingSaved ? "Saved on this device: "+pendingSaved+" (pending verification)." : "Enter a code to link or save for registration."}</p>
          <div className="flex gap-2">
           <input aria-label="Referral code" value={input} onChange={e=>setInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,12))}
             placeholder="Referral code" maxLength={12} className="flex-1 min-w-0 rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 font-mono text-sm text-brand-text outline-none focus:border-brand-primary"/>
           <button type="button" disabled={busy||!HIDEDEX_INVITE_CODE.test(input.trim().toUpperCase())} onClick={()=>void apply()}
             className="rounded-lg bg-brand-primary px-4 text-black text-xs font-semibold disabled:opacity-50">
            {busy?<Loader2 size={15} className="animate-spin"/>:hidedexReferralSession(wallet)?"Apply":pendingSaved===input.trim().toUpperCase()?"Saved":"Save"}
           </button>
          </div>
         </>}
       </div>
       <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5 space-y-3">
        <div className="flex justify-between items-center"><h2 className="text-sm font-bold">Your invites</h2><span className="text-[10px] text-brand-muted">{profile.total_invited} total</span></div>
        {profile.invitees.length===0?<p className="text-xs text-brand-muted py-3">No registered invites yet.</p>:
         <div className="space-y-1.5">
          {profile.invitees.map((invite,i)=><div key={i} className="flex items-center justify-between gap-2 border-b border-brand-border/50 py-2 text-xs">
            <span className="font-mono text-brand-sub">{invite.wallet_masked}</span>
            <span className={invite.qualification==="qualified"?"text-brand-primary":"text-brand-muted"}>
             {invite.qualification==="qualified"?"Qualified":invite.qualification==="below_threshold"?"Below $100":"Pending verification"}
            </span>
          </div>)}
         </div>}
        {profile.total_invited>profile.shown_invites&&<p className="text-[11px] text-brand-muted">Showing latest {profile.shown_invites} invites.</p>}
       </div>
       <p className="text-[11px] text-brand-muted">Only $100 in verified trading after referral linking counts. Claim in 0.1-point steps, up to 15 total.</p>
      </>
    : <div className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-2">
       <p className="text-xs text-brand-muted">Referral details are temporarily unavailable.</p>
       <button type="button" onClick={()=>{setLoading(true);void refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));}} className="text-xs text-brand-primary">Try again</button>
      </div>}
   {(error||message)&&<p role="status" aria-live="polite" className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-sub">{error||message}</p>}
 </section>;
}
