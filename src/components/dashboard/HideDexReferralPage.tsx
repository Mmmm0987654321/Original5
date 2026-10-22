import React, { useEffect, useState } from "react";
import { ArrowLeft, Copy, Link2, Users, ShieldCheck, CheckCircle2, Gift, Loader2 } from "lucide-react";

type ReferralInvite = {wallet_masked:string;joined_at:string;qualification:"qualified"|"pending_verification"|"below_threshold"};
type Profile = {referral_code:string;applied_referral_code:string|null;total_invited:number;qualified_in_shown:number;shown_invites:number;qualification_volume_usd:number;invitees:ReferralInvite[];reward_points_configured:boolean};
type Props = {walletAddress:string;walletConnected:boolean;onConnectWallet:()=>void;onSignMessage:(message:string)=>Promise<string>;onEarlyAccess:()=>void;onBack:()=>void};

const API="https://nqlzjregtvjspescfqcn.supabase.co/functions/v1/hidedex-referrals";
const CODE_PATTERN=/^(?:[0-9]{6}|HDX-[A-Z2-9]{8})$/;
const SESSION_PREFIX="hidedex_referral_auth_v1_";
const pendingReferralKey="hidedex_pending_invite_code";
async function callApi(data:Record<string,unknown>):Promise<any>{
 const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),cache:"no-store"});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof result?.error==="string"?result.error:"Referral service unavailable");
 return result;
}
export default function HideDexReferralPage({walletAddress,walletConnected,onConnectWallet,onSignMessage,onEarlyAccess,onBack}:Props){
 const wallet=walletAddress.trim().toLowerCase();
 const [token,setToken]=useState("");
 const [profile,setProfile]=useState<Profile|null>(null);
 const [input,setInput]=useState(()=>{
  if(typeof window==="undefined")return "";
  try {
   const url=new URLSearchParams(window.location.search).get("ref")||"";
   const saved=sessionStorage.getItem(pendingReferralKey)||"";
   const code=(url||saved).trim().toUpperCase();
   return CODE_PATTERN.test(code)?code:"";
  } catch {return "";}
 });
 const [busy,setBusy]=useState(walletConnected);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const refresh=async(sessionToken:string)=>{
  const result=await callApi({action:"profile",wallet,token:sessionToken});
  setProfile(result as Profile);
 };
 // One ownership signature creates a 12-hour, wallet-scoped session.
 // Re-entering this page and refreshing the browser only require one profile read.
 const verify=async()=>{
  if(!walletConnected||!/^0x[a-f0-9]{40}$/.test(wallet))return;
  setError("");setMessage("");setBusy(true);
  try{
   let cachedToken="";
   try{
    const saved=JSON.parse(sessionStorage.getItem(SESSION_PREFIX+wallet)||"null");
    if(typeof saved?.token==="string" && /^[a-f0-9]{64}$/.test(saved.token)
       && Number(saved.expiresAt)>Date.now()+30000)cachedToken=saved.token;
   }catch{ /* No accessible previous session. */ }
   if(cachedToken){
    try{
     await refresh(cachedToken);
     setToken(cachedToken);
     return;
    }catch(err){
     if(!(err instanceof Error)||!/verify this wallet again/i.test(err.message))throw err;
     try{sessionStorage.removeItem(SESSION_PREFIX+wallet);}catch{}
    }
   }
   // A connected wallet address alone is NOT proof of ownership.
   // Start the one necessary signature directly, without another Verify button.
   const challenge=await callApi({action:"challenge",wallet});
   const signature=await onSignMessage(challenge.message);
   if(walletAddress.trim().toLowerCase()!==wallet)throw new Error("Wallet changed during verification");
   const session=await callApi({action:"authenticate",wallet,signature});
   if(typeof session.token!=="string" || !/^[a-f0-9]{64}$/.test(session.token))
    throw new Error("Wallet verification did not complete");
   try{
    sessionStorage.setItem(SESSION_PREFIX+wallet,JSON.stringify({
      token:session.token,expiresAt:Date.now()+Math.min(43200,Number(session.expires_in_seconds)||43200)*1000
    }));
   }catch{}
   setToken(session.token);
   await refresh(session.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not load referrals");}
  finally{setBusy(false);}
 };
 useEffect(()=>{
   setProfile(null);setToken("");setError("");setMessage("");
   if(walletConnected && /^0x[a-f0-9]{40}$/.test(wallet)) void verify();
   // This effect depends only on the connected wallet identity, not render callbacks.
 },[wallet,walletConnected]);
 const apply=async()=>{
  const code=input.trim().toUpperCase();
  if(!CODE_PATTERN.test(code)){setError("Enter a valid 6-digit referral code.");return;}
  if(!token||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   await callApi({action:"apply",wallet,token,referral_code:code});
   try{sessionStorage.removeItem(pendingReferralKey);}catch{}
   setMessage("Referral linked successfully.");
   await refresh(token);
  }catch(e){setError(e instanceof Error?e.message:"Could not apply referral");}
  finally{setBusy(false);}
 };
 const ownCode=profile?.referral_code??"";
 const shareLink=ownCode?"https://hidedex.com/?ref="+encodeURIComponent(ownCode):"";
 const copy=async(value:string)=>{
  try{await navigator.clipboard.writeText(value);setError("");setMessage("Copied to clipboard.");}
  catch{setError("Copy unavailable. Select the code manually.");}
 };
 return <section className="w-full max-w-4xl mx-auto px-2 sm:px-6 py-3 sm:py-7 space-y-4 text-brand-text">
   <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-brand-sub hover:text-brand-text"><ArrowLeft size={15}/> Markets</button>
   <div className="flex items-center gap-3">
    <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary"><Users size={19}/></div>
    <div><h1 className="text-xl sm:text-2xl font-extrabold leading-tight">Invite & Referrals</h1><p className="text-xs text-brand-muted">Share your link. Track real registered invites.</p></div>
   </div>
   {!walletConnected||!/^0x[a-f0-9]{40}$/.test(wallet)
     ? <div className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-3"><p className="text-sm text-brand-sub">Connect a wallet to see your personal referral code.</p><button type="button" onClick={onConnectWallet} className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-black">Connect Wallet</button></div>
     : !profile
     ? <div className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-3">
         <div className="flex items-center gap-2 text-brand-text font-semibold text-sm"><ShieldCheck size={17}/> Secure referral dashboard</div>
         <p className="text-xs leading-relaxed text-brand-muted">{busy?"Opening your referral dashboard…":"Your referral dashboard uses your connected wallet. A free signature is needed only when no valid verification session exists."}</p>
         {busy
          ? <div role="status" className="inline-flex items-center gap-2 text-brand-primary text-xs font-semibold"><Loader2 size={15} className="animate-spin"/> Connecting securely…</div>
          : error && !/join hidedex|registration/i.test(error)
            ? <button type="button" onClick={()=>void verify()} className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-semibold text-black">Retry</button>
            : null}
         {error.toLowerCase().includes("join hidedex")||error.toLowerCase().includes("registration")?<button type="button" onClick={onEarlyAccess} className="ml-2 border border-brand-border px-3 py-2.5 rounded-lg text-xs">Join Early Access</button>:null}
       </div>
     : <>
       <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5 space-y-3">
         <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">Your referral code</h2><span className="text-[10px] text-brand-muted">Unique to your registered wallet</span></div>
         <div className="flex items-center gap-2"><div className="flex-1 min-w-0 rounded-lg border border-brand-border bg-brand-bg px-3 py-3 font-mono font-bold text-base tracking-wider select-all">{ownCode}</div><button type="button" onClick={()=>void copy(ownCode)} className="inline-flex gap-1.5 items-center rounded-lg bg-brand-primary px-3 py-3 text-black text-xs font-semibold"><Copy size={14}/> Copy</button></div>
         <div className="flex items-center gap-2"><div className="flex-1 min-w-0 rounded-lg border border-brand-border bg-brand-bg p-2.5 text-[11px] font-mono text-brand-sub truncate select-all">{shareLink}</div><button type="button" onClick={()=>void copy(shareLink)} className="shrink-0 border border-brand-border rounded-lg px-3 py-2.5 text-xs inline-flex items-center gap-1.5"><Link2 size={13}/> Link</button></div>
       </div>
       <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4"><p className="text-[10px] text-brand-muted">Registered invites</p><div className="mt-1 text-2xl font-mono font-bold">{profile.total_invited}</div></div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4"><p className="text-[10px] text-brand-muted">Qualified (shown)</p><div className="mt-1 text-2xl font-mono font-bold text-brand-primary">{profile.qualified_in_shown}</div></div>
       </div>
       <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Gift size={16}/> Apply a referral</h2>
        {profile.applied_referral_code
         ? <p className="text-xs text-brand-sub flex items-center gap-2"><CheckCircle2 size={15} className="text-brand-primary"/> Applied: <strong className="font-mono text-brand-text">{profile.applied_referral_code}</strong></p>
         : <><p className="text-xs text-brand-muted">Joined without a referral? You can add one now. You can apply only one code to this wallet.</p>
           <div className="flex gap-2"><input type="text" aria-label="Referral code" value={input} onChange={e=>setInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,12))} placeholder="6-digit code" maxLength={12} inputMode="numeric"
              className="flex-1 min-w-0 rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 font-mono text-sm text-brand-text outline-none focus:border-brand-primary"/>
             <button type="button" onClick={()=>void apply()} disabled={busy||!CODE_PATTERN.test(input.trim().toUpperCase())} className="rounded-lg bg-brand-primary text-black font-semibold px-4 text-xs disabled:opacity-50">Apply</button></div></>}
       </div>
       <div className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5 space-y-3">
        <div className="flex justify-between items-center"><h2 className="text-sm font-bold">Your invites</h2><span className="text-[10px] text-brand-muted">{profile.total_invited} total</span></div>
        {profile.invitees.length===0?<p className="text-xs text-brand-muted py-3">No registered invites yet. Share your link to invite friends.</p>:
        <div className="space-y-1.5">{profile.invitees.map((p,i)=><div key={i} className="flex justify-between items-center gap-3 border-b border-brand-border/50 py-2 text-xs">
          <span className="font-mono text-brand-sub">{p.wallet_masked}</span>
          <span className={p.qualification==="qualified"?"text-brand-primary":"text-brand-muted"}>{p.qualification==="qualified"?"Qualified":p.qualification==="below_threshold"?"Below $100":"Pending verification"}</span>
        </div>)}</div>}
        {profile.total_invited>profile.shown_invites&&<p className="text-[11px] text-brand-muted">Showing the most recent {profile.shown_invites} invites.</p>}
       </div>
       <p className="text-[11px] leading-relaxed text-brand-muted">Qualification requires at least $100 in verified recorded trading volume. Extra referral points are not currently configured.</p>
      </>}
   {(error||message)&&<p role="status" aria-live="polite" className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-sub">{error||message}</p>}
 </section>;
}
