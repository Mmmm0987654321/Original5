/** Public referral overview: a connected wallet address selects only a public invitation
 * alias and redacted aggregate statistics. This is NEVER wallet authentication.
 * Shared in-flight promise prevents a duplicate request on connect + sidebar open. */
export type HideDexReferralInvite = {
 wallet_masked:string;
 joined_at:string;
 qualification:"qualified"|"pending_verification"|"below_threshold";
};
export type HideDexReferralOverview = {
 wallet:string;
 referral_code:string;
 applied_referral_code:string|null;
 total_invited:number;
 qualified_in_shown:number;
 shown_invites:number;
 qualification_volume_usd:number;
 reward_points_configured:boolean;
 invitees:HideDexReferralInvite[];
 attribution_requires_signed_enrollment?:boolean;
};
export const HIDEDEX_REFERRAL_API="https://nqlzjregtvjspescfqcn.supabase.co/functions/v1/hidedex-referrals";
export const HIDEDEX_INVITE_CODE=/^(?:[A-Z2-9]{8}|HDX-[A-Z2-9]{8}|[0-9]{6})$/;

const active=new Map<string,Promise<HideDexReferralOverview>>();
const memo=new Map<string,{until:number;data:HideDexReferralOverview}>();

export async function hidedexReferralCall(data:Record<string,unknown>):Promise<any>{
 const response=await fetch(HIDEDEX_REFERRAL_API,{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(data),cache:"no-store"
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof result?.error==="string"?result.error:"Referral service unavailable");
 return result;
}

export function hidedexReferralOverview(wallet:string,force=false):Promise<HideDexReferralOverview>{
 const address=wallet.trim().toLowerCase();
 if(!/^0x[a-f0-9]{40}$/.test(address))return Promise.reject(new Error("Connect a valid wallet."));
 const cached=memo.get(address);
 if(!force && cached && cached.until>Date.now())return Promise.resolve(cached.data);
 const inflight=active.get(address);if(inflight)return inflight;
 const request=hidedexReferralCall({action:"overview",wallet:address})
   .then((data:HideDexReferralOverview)=>{
     if(typeof data?.referral_code!=="string"||!HIDEDEX_INVITE_CODE.test(data.referral_code))
       throw new Error("Could not load referral code.");
     memo.set(address,{until:Date.now()+30000,data});return data;
   }).finally(()=>active.delete(address));
 active.set(address,request);
 return request;
}

export function hidedexReferralExpire(wallet:string):void{
 memo.delete(wallet.trim().toLowerCase());
}

export function hidedexReferralSession(wallet:string):string|null{
 const address=wallet.trim().toLowerCase();
 try{
  const raw=sessionStorage.getItem("hidedex_referral_auth_v1_"+address);
  const obj=JSON.parse(raw||"null");
  if(typeof obj?.token==="string"&&/^[0-9a-f]{64}$/.test(obj.token)
   && Number(obj?.expiresAt)>Date.now()+30000)return obj.token;
 }catch{ /* Secure storage may be blocked */ }
 return null;
}
