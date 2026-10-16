import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { recoverMessageAddress } from "npm:viem@2.38.0";
const URL=Deno.env.get("SUPABASE_URL")!, KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(URL,KEY,{auth:{persistSession:false}});
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const send=(o:unknown,code=200)=>new Response(JSON.stringify(o),{status:code,headers});
const valid=(w:unknown):w is string=>typeof w==="string"&&/^0x[a-f0-9]{40}$/i.test(w);
// Cheap, best-effort isolate-local throttling. No tables, IP history or external calls.
// Each Edge isolate has its own counters; this is NOT a globally distributed WAF.
const RL_WINDOW_MS=10*60*1000;
const RL_MAX_KEYS=4096;
const rlCounters=new Map<string,{hits:number,resetAt:number}>();
let rlChecks=0;
function withinQuota(key:string,max:number,now=Date.now()):boolean {
  if((++rlChecks&63)===0 || rlCounters.size>=RL_MAX_KEYS){
    for(const [k,v] of rlCounters)if(v.resetAt<=now)rlCounters.delete(k);
    // Bound memory if many distinct wallets/IPs hit a single isolate.
    while(rlCounters.size>=RL_MAX_KEYS)rlCounters.delete(rlCounters.keys().next().value!);
  }
  const current=rlCounters.get(key);
  if(!current || current.resetAt<=now){
    rlCounters.set(key,{hits:1,resetAt:now+RL_WINDOW_MS});return true;
  }
  if(current.hits>=max)return false;
  current.hits++;
  return true;
}
// Small signed-wallet JSON requests are typically < 500 bytes.
const MAX_BODY_BYTES=4096;
async function parseSmallJson(req:Request):Promise<unknown> {
  const claimed=Number(req.headers.get("content-length")||0);
  if(Number.isFinite(claimed) && claimed>MAX_BODY_BYTES)throw new Error("BODY_TOO_LARGE");
  const reader=req.body?.getReader();
  if(!reader)throw new Error("BAD_JSON");
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let bytes=0,raw="";
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    if(bytes>MAX_BODY_BYTES){reader.cancel().catch(()=>{});throw new Error("BODY_TOO_LARGE");}
    raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
  const parsed=JSON.parse(raw);
  if(!parsed || typeof parsed!=="object" || Array.isArray(parsed))throw new Error("BAD_JSON");
  return parsed;
}

// Fixed, non-cumulative tiers; exactly ONE award based on total verified USD
// across both exchanges at registration time. Reconnect never adds points.
function score(v:number):number {
 if(v>=50000000)return 12;
 if(v>=30000000)return 8;
 if(v>=20000000)return 7;
 if(v>=15000000)return 6;
 if(v>=10000000)return 5;
 if(v>=5000000)return 3;
 if(v>=1000000)return 2;
 if(v>=100000)return 1;
 return v===0?0:0.1;
}
// Retry transient upstream failures only, with strictly bounded work per invocation.
// A non-2xx or invalid response is UNKNOWN, never a verified zero-volume wallet.
async function verifiedFetch(url:string, init:RequestInit={}, timeoutMs=10000):Promise<Response|null>{
 for(let attempt=0;attempt<2;attempt++){
  try {
   const r=await fetch(url,{...init,signal:AbortSignal.timeout(timeoutMs)});
   if(r.ok)return r;
   if(![429,500,502,503,504].includes(r.status))return null;
  }catch{}
  if(attempt===0)await new Promise(resolve=>setTimeout(resolve,350+Math.floor(Math.random()*300)));
 }
 return null;
}
const cachedVolume=(n:unknown):number|null=>{
 if(n===null||n===undefined)return null;
 const v=Number(n);return Number.isFinite(v)&&v>=0?v:null;
};
async function hl(w:string):Promise<number|null>{
 for(const t of [{type:"portfolio",user:w}]){
  try {const r=await verifiedFetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(t)},10000);
   if(!r)continue;const d=await r.json();const n=t.type==="referral"?Number(d?.cumVlm):Array.isArray(d)?Number(d.find((x:any)=>Array.isArray(x)&&x[0]==="allTime")?.[1]?.vlm):NaN;
   if(Number.isFinite(n)&&n>=0)return n;
  }catch{}
 }return null;
}
async function lighter(w:string):Promise<number|null>{
 const base="https://mainnet.zklighter.elliot.ai";
 try{
  const r=await verifiedFetch(base+"/api/v1/accountsByL1Address?l1_address="+encodeURIComponent(w),{},10000);
  if(!r)return null;const d=await r.json();if(!Array.isArray(d?.sub_accounts)&&!Array.isArray(d?.accounts))return null;
  const accounts=new Set<number>();
  for(const item of (Array.isArray(d.sub_accounts)?d.sub_accounts:d.accounts)){
   const n=Number(typeof item==="object"?(item?.index??item?.account_index??item?.sub_account_index??item?.accountIndex):item);
   if(Number.isInteger(n)&&n>=0)accounts.add(n);
  }
  if(d.master_account){const n=Number(d.master_account.index??d.master_account.account_index);if(Number.isInteger(n)&&n>=0)accounts.add(n);}
  let total=0;for(const i of accounts){
   const qs=new URLSearchParams({by:"index",value:String(i),resolution:"1d",start_timestamp:"1737072000",end_timestamp:String(Math.floor(Date.now()/1000)),count_back:"0",ignore_transfers:"false"});
   const p=await verifiedFetch(base+"/api/v1/pnl?"+qs.toString(),{},12000);
   if(!p)return null;const data=await p.json();if(!Array.isArray(data?.pnl))return null;
   for(const entry of data.pnl){const v=Number(entry?.volume);if(Number.isFinite(v)&&v>=0)total+=v;}
  }
  return total;
 }catch{return null;}
}
// A user-facing, non-transactional ownership proof. Both endpoints MUST
// use this exact function: even one punctuation change breaks verification.
function earlyAccessOwnershipMessage(wallet:string, nonce:string):string {
 return [
  "HideDex Early Access",
  "",
  "Confirm registration for this wallet.",
  "Wallet: "+wallet,
  "Request ID: "+nonce,
  "",
  "Free signature only. No payment, token approval, or trading permission."
 ].join("\n");
}
// Accept an in-flight challenge signed before the message copy was shortened.
// The exact wallet and nonce must still match; all other checks stay unchanged.
function legacyEarlyAccessOwnershipMessage(wallet:string, nonce:string):string {
 return [
  "HideDex — Verify Wallet Ownership",
  "",
  "Please sign this free message to confirm you control the connected wallet.",
  "This verifies ownership for Early Access registration only.",
  "",
  "Wallet Address: "+wallet,
  "One-Time Verification Code: "+nonce,
  "",
  "No blockchain transaction, token transfer, or trading permission is requested."
 ].join("\n");
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return send({error:"Method not allowed"},405);
 if(!req.headers.get("content-type")?.toLowerCase().includes("application/json"))return send({error:"JSON content type required"},415);
 // Best-effort per-IP ceiling before parsing or touching the database.
 const forwarded=(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"").trim();
 const clientIp=forwarded.length<=64 && /^[0-9a-fA-F.:]+$/.test(forwarded)?forwarded:"";
 if(clientIp && !withinQuota("ip:"+clientIp,240))return send({error:"Too many requests. Try again later."},429);
 let d:any;
 try{d=await parseSmallJson(req);}catch(e){return String(e).includes("BODY_TOO_LARGE")?send({error:"Request too large"},413):send({error:"Invalid JSON"},400);}
 if(!valid(d.wallet))return send({error:"Invalid wallet address"},400);
 const wallet=d.wallet.toLowerCase();
 // Per-wallet/action ceilings protect proof issuance, signature challenges and
 // exchange-volume refreshes without creating DB rows or paid-service calls.
 const limits:Record<string,number>={access:120,status:45,proof:18,challenge:20,join:10,launch_challenge:30,verify_launch:30};
 const action=typeof d.action==="string"?d.action:"";
 if(!withinQuota("wallet:"+wallet+":"+action,limits[action]??20))return send({error:"Too many requests for this wallet. Try again later."},429);
 // Fast, read-only access decision. Never run exchange volume refresh on a
 // trading launch request: verification can take many seconds for pending points.
 if(d.action==="access"){
  const {data,error}=await db.from("hidedex_early_access")
   .select("access_status").eq("wallet_address",wallet).maybeSingle();
  if(error)return send({error:"Early Access status temporarily unavailable"},503);
  return send({wallet,access_status:data?.access_status??"none"});
 }
 // A reserved public ID never grants wallet access, points or X verification.
 if(d.action==="proof"){
  const {data:code,error}=await db.rpc("hidedex_reserve_x_proof_code",{p_wallet:wallet});
  if(error||typeof code!=="string")return send({error:"X proof code temporarily unavailable"},503);
  return send({x_verification_code:code});
 }
 if(d.action==="status"){
  const {data:prior,error:priorError}=await db.from("hidedex_early_access")
   .select("id,points_status,last_volume_attempt_at,volume_retry_count,volume_hyperliquid_usd,volume_lighter_usd")
   .eq("wallet_address",wallet).maybeSingle();
  if(priorError)return send({error:"Status temporarily unavailable"},503);
  if(prior?.points_status==="pending_verification"){
   const prev=prior.last_volume_attempt_at?new Date(prior.last_volume_attempt_at).getTime():0;
   const attempts=Math.max(0,Number(prior.volume_retry_count)||0);
   // Durable per-wallet backoff: 1,2,4,...64 minutes. No polling loop or invented volume.
   const waitMs=Math.min(60000*Math.pow(2,Math.min(attempts,6)),3840000);
   if(!prev||Date.now()-prev>=waitMs){
    let claim=db.from("hidedex_early_access")
      .update({last_volume_attempt_at:new Date().toISOString(),volume_retry_count:Math.min(attempts+1,16)})
      .eq("id",prior.id).eq("points_status","pending_verification").eq("volume_retry_count",attempts);
    claim=prior.last_volume_attempt_at?claim.eq("last_volume_attempt_at",prior.last_volume_attempt_at):claim.is("last_volume_attempt_at",null);
    const {data:lock}=await claim.select("id").maybeSingle();
    if(lock){
     // Persist successful upstream reads, including confirmed 0. Only retry missing exchange data.
     const knownH=cachedVolume(prior.volume_hyperliquid_usd),knownL=cachedVolume(prior.volume_lighter_usd);
     const [a,b]=await Promise.all([knownH!==null?Promise.resolve(knownH):hl(wallet),knownL!==null?Promise.resolve(knownL):lighter(wallet)]);
     const patch:Record<string,unknown>={};
     if(a!==null)patch.volume_hyperliquid_usd=Math.round(a*100)/100;
     if(b!==null)patch.volume_lighter_usd=Math.round(b*100)/100;
     if(a!==null&&b!==null&&Number.isFinite(a+b)&&a+b>=0){
      const total=Math.round((a+b)*100)/100;
      Object.assign(patch,{volume_total_usd:total,points:score(a+b),points_status:"verified",volume_verified_at:new Date().toISOString(),volume_retry_count:0});
     }
     if(Object.keys(patch).length)await db.from("hidedex_early_access").update(patch).eq("id",prior.id).eq("points_status","pending_verification");
    }
   }
  }
  const {data,error}=await db.from("hidedex_early_access").select("id,access_status,points,points_status,volume_total_usd,x_verification_code,x_verification_status,x_username").eq("wallet_address",wallet).maybeSingle();
  if(error)return send({error:"Status temporarily unavailable"},503);
  if(!data)return send({access_status:"none"});
  const {count}=await db.from("hidedex_early_access").select("id",{count:"exact",head:true}).lte("id",data.id);
  // The code is a public proof identifier, NOT authentication or an X API credential.
   // Only privileged staff can change verification status in the database.
   return send({access_status:data.access_status,queue_position:count??null,points:data.points,points_status:data.points_status,volume_total_usd:data.volume_total_usd,x_verification_code:data.x_verification_code,x_verification_status:data.x_verification_status,x_username:data.x_username});
 }
 // A launch approval is an authenticated, short-lived wallet-ownership
 // challenge. Merely reading a granted status or editing localStorage is
 // never sufficient to open the frontend trading app.
 if(d.action==="launch_challenge"){
  const {data:record,error}=await db.from("hidedex_early_access").select("access_status").eq("wallet_address",wallet).maybeSingle();
  if(error)return send({error:"Approval check unavailable"},503);
  if(record?.access_status!=="granted")return send({error:"Your wallet has not been approved for trading yet"},403);
  const nonce=crypto.randomUUID(),expires=new Date(Date.now()+10*60*1000).toISOString();
  const {error:saveError}=await db.from("hidedex_early_access_challenges").upsert({wallet_address:wallet,nonce,expires_at:expires},{onConflict:"wallet_address"});
  if(saveError)return send({error:"Verification challenge unavailable"},503);
  return send({message:"HideDex Launch App access verification\\nWallet: "+wallet+"\\nNonce: "+nonce+"\\nNo blockchain transaction is requested.",expires_at:expires});
 }
 if(d.action==="verify_launch"){
  if(typeof d.signature!=="string"||!/^0x[a-fA-F0-9]{130}$/.test(d.signature))return send({error:"Wallet signature required"},401);
  const {data:record,error}=await db.from("hidedex_early_access").select("access_status").eq("wallet_address",wallet).maybeSingle();
  if(error)return send({error:"Approval check unavailable"},503);
  if(record?.access_status!=="granted")return send({error:"Your wallet is not approved"},403);
  const {data:challenge,error:chError}=await db.from("hidedex_early_access_challenges").select("nonce,expires_at").eq("wallet_address",wallet).maybeSingle();
  if(chError||!challenge||new Date(challenge.expires_at).getTime()<Date.now())return send({error:"Verification expired; try again"},401);
  const message="HideDex Launch App access verification\\nWallet: "+wallet+"\\nNonce: "+challenge.nonce+"\\nNo blockchain transaction is requested.";
  try {
   const recovered=(await recoverMessageAddress({message,signature:d.signature as `0x${string}`})).toLowerCase();
   if(recovered!==wallet)return send({error:"Signature does not match connected wallet"},401);
  }catch{return send({error:"Invalid wallet verification signature"},401);}
  const {data:consumed,error:delError}=await db.from("hidedex_early_access_challenges").delete().eq("wallet_address",wallet).eq("nonce",challenge.nonce).select("nonce").maybeSingle();
  if(delError||!consumed)return send({error:"Verification already used"},409);
  return send({access_status:"granted",wallet});
 }
 if(d.action==="challenge"){
  const nonce=crypto.randomUUID(),expires=new Date(Date.now()+10*60*1000).toISOString();
  const {error}=await db.from("hidedex_early_access_challenges").upsert({wallet_address:wallet,nonce,expires_at:expires},{onConflict:"wallet_address"});
  if(error)return send({error:"Challenge unavailable"},503);
  return send({message:earlyAccessOwnershipMessage(wallet,nonce),expires_at:expires});
 }
 if(d.action!=="join")return send({error:"Unknown action"},400);
 const x=String(d.x_username||"").trim().toLowerCase().replace(/^@/,""),gmail=String(d.gmail||"").trim().toLowerCase();
 if(!/^[a-z0-9_]{1,15}$/.test(x)||!/^[^\s@]+@gmail\.com$/.test(gmail))return send({error:"Valid X username and Gmail required"},400);
 if(typeof d.signature!=="string"||!/^0x[a-fA-F0-9]{130}$/.test(d.signature))return send({error:"Wallet signature required"},401);
 const {data:existing}=await db.from("hidedex_early_access").select("wallet_address").eq("wallet_address",wallet).maybeSingle();
 if(existing)return send({error:"This wallet is already enrolled. Reconnect to view status."},409);
 const {data:challenge,error:chErr}=await db.from("hidedex_early_access_challenges").select("nonce,expires_at").eq("wallet_address",wallet).maybeSingle();
 if(chErr||!challenge||new Date(challenge.expires_at).getTime()<Date.now())return send({error:"Challenge expired. Try again."},401);
 const messages=[
  earlyAccessOwnershipMessage(wallet,challenge.nonce),
  legacyEarlyAccessOwnershipMessage(wallet,challenge.nonce)
 ];
 let signatureMatches=false;
 for(const message of messages){
  try{
   const recovered=(await recoverMessageAddress({message,signature:d.signature as `0x${string}`})).toLowerCase();
   if(recovered===wallet){signatureMatches=true;break;}
  }catch{ /* Not signed for this exact message. */ }
 }
 if(!signatureMatches)return send({error:"Invalid wallet signature"},401);
 // Consume challenge before any insert; same wallet cannot replay it.
 const {data:consumed,error:delErr}=await db.from("hidedex_early_access_challenges").delete().eq("wallet_address",wallet).eq("nonce",challenge.nonce).select("nonce").maybeSingle();
 if(delErr||!consumed)return send({error:"Signature already used"},409);
 // Signed enrollment reuses the pre-signature public ID for this wallet.
 const {data:proofCode,error:proofError}=await db.rpc("hidedex_reserve_x_proof_code",{p_wallet:wallet});
 if(proofError||typeof proofCode!=="string")return send({error:"Unique X proof code unavailable"},503);
 const {data:row,error:insertErr}=await db.from("hidedex_early_access").insert({wallet_address:wallet,x_username:"@"+x,gmail,x_verification_code:proofCode}).select("id,access_status,points_status,x_verification_code,x_verification_status,x_username").single();
 if(insertErr)return send({error:insertErr.code==="23505"?"Wallet, Gmail or X username already registered":"Enrollment temporarily unavailable"},insertErr.code==="23505"?409:503);
 const [a,b]=await Promise.all([hl(wallet),lighter(wallet)]);
 // Partial verified cache is durable: successful 0 is not a failed fetch.
 const patch:Record<string,unknown>={last_volume_attempt_at:new Date().toISOString(),volume_retry_count:1};
 if(a!==null)patch.volume_hyperliquid_usd=Math.round(a*100)/100;
 if(b!==null)patch.volume_lighter_usd=Math.round(b*100)/100;
 if(a!==null&&b!==null&&Number.isFinite(a+b)&&a+b>=0){
  const total=a+b;
  Object.assign(patch,{volume_total_usd:Math.round(total*100)/100,volume_verified_at:new Date().toISOString(),points_status:"verified",points:score(total),volume_retry_count:0});
 }
 await db.from("hidedex_early_access").update(patch).eq("id",row.id).eq("points_status","pending_verification");
 const {data:record}=await db.from("hidedex_early_access").select("access_status,points,points_status,volume_total_usd,x_verification_code,x_verification_status,x_username").eq("id",row.id).single();
 const {count}=await db.from("hidedex_early_access").select("id",{count:"exact",head:true}).lte("id",row.id);
 return send({access_status:record?.access_status??"pending",points:record?.points??null,points_status:record?.points_status??"pending_verification",volume_total_usd:record?.volume_total_usd??null,queue_position:count??null,x_verification_code:record?.x_verification_code??row.x_verification_code,x_verification_status:record?.x_verification_status??"pending",x_username:record?.x_username??row.x_username},201);
});