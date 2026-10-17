/**
 * Aster V3 mainnet agent authorization and one signed READ-only account API.
 * Trading, TP/SL, builder fees and withdrawals are deliberately NOT enabled.
 * Exact official EIP-712 registration from Aster V3 futures docs.
 * Aster private key only in memory or encrypted IndexedDB, never sent to API.
 */
import {BrowserProvider,Wallet,getAddress,verifyTypedData} from "ethers";
import {prepareAsterTradingAgentAuthorization,isAsterInitialDepositRequired} from "./asterAgentAuthorization";
import {rememberAsterAgent,readRememberedAsterAgent,type SavedAsterAgent} from "./asterDeviceKey";
import {ASTER_FUTURES_MAINNET} from "./asterMarketData";
export type AsterWalletProvider={request:(args:{method:string;params?:unknown[]|object})=>Promise<unknown>};
export type AsterIdentity={user:string;agent:string;expiresAtMs:number};
export type AsterAccountBalance={asset:string;balance:string;availableBalance:string|null};
let session:SavedAsterAgent|null=null;
let busy=false,lastNonce=0;
const RECORD_TYPE={Message:[{name:"msg",type:"string"}]} as const;
const TRADE_DOMAIN={name:"AsterSignTransaction",version:"1",chainId:1666,
 verifyingContract:"0x0000000000000000000000000000000000000000"} as const;
function nonce():string{
 const n=Math.max(Date.now()*1000,lastNonce+1);
 if(!Number.isSafeInteger(n))throw new Error("Invalid Aster microsecond nonce");
 lastNonce=n;
 return String(n);
}
function parseRecord(x:unknown):Record<string,unknown>|null{
 return !!x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;
}
function apiError(x:unknown):string|null{
 const row=parseRecord(x);
 if(!row||row.code===undefined)return null;
 if(row.code===200||row.code==="200")return null;
 return "Aster error "+String(row.code)+": "+String(row.msg??"Request not accepted");
}
function identity(s:SavedAsterAgent):AsterIdentity{
 return {user:s.user,agent:s.agent,expiresAtMs:s.expiresAtMs};
}
export function currentAsterAgent(wallet:string):AsterIdentity|null{
 if(!wallet||!session||!session.approved||Date.now()>=session.expiresAtMs)return null;
 try{return session.user===getAddress(wallet)?identity(session):null;}catch{return null;}
}
export function clearAsterSession():void{session=null;}
/** Only the active user wallet may be restored. The browser record is encrypted. */
export async function reconnectAsterAgent(wallet:string):Promise<AsterIdentity|null>{
 const user=getAddress(wallet);
 session=null;
 const saved=await readRememberedAsterAgent(user);
 if(!saved||!saved.approved||saved.user!==user)return null;
 session=saved;
 return identity(saved);
}
function active(wallet:string):SavedAsterAgent{
 const user=getAddress(wallet);
 if(!session||!session.approved||session.user!==user||Date.now()>=session.expiresAtMs)
  throw new Error("Enable Aster trading for this connected wallet before reading account data");
 return session;
}
/** Explicit user click invokes this; signature is never triggered on render.
 * EIP-712 owner signature authorizes Spot and Perp trading but NOT withdrawals.
 */
export async function registerAsterTradingAgent(args:{
 walletAddress:string;getWalletProvider:()=>Promise<AsterWalletProvider>;
}):Promise<AsterIdentity>{
 if(busy)throw new Error("Wait for the current Aster authorization");
 busy=true;
 try{
  const user=getAddress(args.walletAddress);
  if(currentAsterAgent(user))throw new Error("Aster agent already enabled on this device");
  const saved=await readRememberedAsterAgent(user);
  if(saved?.approved)throw new Error("Existing Aster agent found. Reconnect it rather than registering another.");
  if(saved&&!saved.approved)throw new Error("Previous Aster authorization status is uncertain. Do not register another agent automatically; review agents in Aster.");
  const native=await args.getWalletProvider();
  const browser=new BrowserProvider(native as any);
  const ownerSigner=await browser.getSigner();
  if(getAddress(await ownerSigner.getAddress())!==user)
   throw new Error("Connected wallet changed. No agent registered.");
  const agent=Wallet.createRandom();
  const expiresAtMs=Date.now()+30*24*60*60*1000;
  const auth=prepareAsterTradingAgentAuthorization({
   userAddress:user,agentAddress:agent.address,
   expiresAtMs,nowMs:Date.now(),agentName:"HideDex"
  });
  // The owner signs the exact registration message per the official docs.
  const signature=await ownerSigner.signTypedData(
    auth.eip712.domain,auth.eip712.types,auth.eip712.message
  );
  const recovered=getAddress(verifyTypedData(
    auth.eip712.domain,auth.eip712.types,auth.eip712.message,signature
  ));
  if(recovered!==user||getAddress(await ownerSigner.getAddress())!==user)
   throw new Error("Owner signature does not match the connected wallet");
  // Save a PENDING encrypted record before sending any API write.
  // On an uncertain response never create a second agent automatically.
  const draft:SavedAsterAgent={user,agent:agent.address,
   privateKey:agent.privateKey,expiresAtMs,approved:false};
  await rememberAsterAgent(draft);
  const form=new URLSearchParams({...auth.params,signature});
  const res=await fetch(ASTER_FUTURES_MAINNET+auth.endpoint,{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
   body:form.toString(),cache:"no-store"
  });
  const data:unknown=await res.json();
  const err=apiError(data);
  if(!res.ok||err)throw new Error(err??"Aster rejected agent registration (HTTP "+res.status+")");
  const row=parseRecord(data);
  if(!row||(row.code!==200&&row.code!=="200")||
    String(row.msg??"").toLowerCase()!=="success")
    throw new Error("Aster registration response unverified. Do not retry automatically.");
  const granted={...draft,approved:true};
  await rememberAsterAgent(granted);
  session=granted;
  return identity(granted);
 }finally{busy=false;}
}

/** Signed user data read; never write an exchange order, transfer or withdrawal.
 * Returns a verified list, or throws so UI renders UNAVAILABLE, not $0.
 */
export async function getAsterFuturesBalances(wallet:string,signal?:AbortSignal):Promise<AsterAccountBalance[]>{
 const signed=active(wallet);
 const body=new URLSearchParams({
  user:signed.user,signer:signed.agent,nonce:nonce(),
 });
 const sig=await new Wallet(signed.privateKey).signTypedData(
  TRADE_DOMAIN,RECORD_TYPE,{msg:body.toString()}
 );
 body.set("signature",sig);
 const res=await fetch(ASTER_FUTURES_MAINNET+"/fapi/v3/balance?"+body.toString(),{
  method:"GET",headers:{Accept:"application/json"},cache:"no-store",signal
 });
 const json:unknown=await res.json();
 if(isAsterInitialDepositRequired(json))
  throw new Error("Aster requires one successful main-wallet deposit before signed account queries (-5050).");
 const err=apiError(json);
 if(!res.ok||err)throw new Error(err??"Aster balances unavailable (HTTP "+res.status+")");
 if(!Array.isArray(json))throw new Error("Aster returned unverified futures balance data");
 return json.map(v=>{
  const row=parseRecord(v);
  if(!row||typeof row.asset!=="string"||typeof row.balance!=="string")
   throw new Error("Invalid authenticated Aster balance response");
  const available=typeof row.availableBalance==="string"?row.availableBalance:null;
  return {asset:row.asset,balance:row.balance,availableBalance:available};
 });
}
