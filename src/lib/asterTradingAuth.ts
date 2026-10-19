/**
 * Aster V3 mainnet agent authorization and one signed READ-only account API.
 * Trading, TP/SL, builder fees and withdrawals are deliberately NOT enabled.
 * Exact official EIP-712 registration from Aster V3 futures docs.
 * Aster private key only in memory or encrypted IndexedDB, never sent to API.
 */
import {Wallet,getAddress,verifyTypedData} from "ethers";
import {prepareAsterTradingAgentAuthorization,isAsterInitialDepositRequired} from "./asterAgentAuthorization";
import {rememberAsterAgent,readRememberedAsterAgent,type SavedAsterAgent} from "./asterDeviceKey";
import {ASTER_FUTURES_MAINNET} from "./asterMarketData";
export type AsterWalletProvider={request:(args:{method:string;params?:any[]})=>Promise<any>};
export type AsterIdentity={user:string;agent:string;expiresAtMs:number};
export type AsterAccountBalance={asset:string;balance:string;availableBalance:string|null};
let session:SavedAsterAgent|null=null;
let busy=false,lastNonce=0;
const RECORD_TYPE={Message:[{name:"msg",type:"string"}]};
const TRADE_DOMAIN={name:"AsterSignTransaction",version:"1",chainId:1666,
 verifyingContract:"0x0000000000000000000000000000000000000000"} as const;
function nonce():string{
 const n=Math.max(Date.now()*1000,lastNonce+1);
 if(!Number.isSafeInteger(n))throw new Error("Invalid Aster microsecond nonce");
 lastNonce=n;
 return String(n);
}
/** Sign an Aster V3 Futures USER_DATA query with the approved agent wallet.
 * Aster's official V3 authentication and Aster Code docs require BOTH the
 * owning master-wallet "user" AND the authorized agent "signer". Domain B
 * (chainId 1666) signs the read; chainId 56 is only for owner authorization.
 *
 * For Futures signed reads, follow Aster's v3 authentication guidance:
 * canonical ASCII-key sorted string parameters (no unsigned extras).
 * The URL-encoded request is exactly the EIP-712 message being signed.
 * No timestamp or management signatureChainId is added.
 * asterChain is a management parameter, not part of these USER_DATA reads.
 * No new agent, signature prompt, order, or transfer is created here.
 */
async function signAsterFuturesRead(
 signed:SavedAsterAgent,fields:Record<string,string>={}
):Promise<URLSearchParams>{
 const params:Record<string,string>={
  ...fields,nonce:nonce(),user:signed.user,signer:signed.agent,
 };
 // Canonical order is ASCII-key sorted, per official Aster v3 auth skill.
 // Reuse this exact string for BOTH the EIP-712 digest and HTTP query.
 const query=new URLSearchParams(
  Object.entries(params).sort(([a],[b])=>a<b?-1:a>b?1:0)
 );
 const wallet=new Wallet(signed.privateKey);
 if(getAddress(wallet.address)!==getAddress(signed.agent))
  throw new Error("Local Aster agent signing key does not match approved agent.");
 const signature=await wallet.signTypedData(TRADE_DOMAIN,RECORD_TYPE,{msg:query.toString()});
 if(getAddress(verifyTypedData(
   TRADE_DOMAIN,RECORD_TYPE,{msg:query.toString()},signature
 ))!==getAddress(signed.agent))
  throw new Error("Local Aster EIP-712 signer verification failed.");
 query.set("signature",signature);
 return query;
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
/** EIP-1193 providers should return a 0x chain ID, but some WalletConnect
 * adapters expose a decimal, numeric, CAIP-2 or {chainId} result instead.
 * Accept only well-formed, positive safe integers; never guess a network.
 */
function normalizeWalletChainId(raw:unknown):number|null{
 if(typeof raw==="number")return Number.isSafeInteger(raw)&&raw>0?raw:null;
 if(typeof raw==="bigint")
  return raw>0n&&raw<=BigInt(Number.MAX_SAFE_INTEGER)?Number(raw):null;
 if(typeof raw==="string"){
  const value=raw.trim();
  const matched=value.match(/^eip155:([1-9][0-9]*)$/i);
  const candidate=matched?matched[1]:value;
  if(!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(candidate))return null;
  try{
   const id=BigInt(candidate);
   return id>0n&&id<=BigInt(Number.MAX_SAFE_INTEGER)?Number(id):null;
  }catch{return null;}
 }
 if(raw!==null&&typeof raw==="object"&&"chainId" in raw)
  return normalizeWalletChainId((raw as {chainId:unknown}).chainId);
 return null;
}

/** Read after an approved switch, allowing WalletConnect chain state to settle.
 * These are three READS only — no repeated wallet prompts or sign attempts.
 */
async function verifiedWalletChainId(wallet:AsterWalletProvider,tries=1):Promise<number|null>{
 for(let i=0;i<tries;i++){
  try{
   const id=normalizeWalletChainId(await wallet.request({method:"eth_chainId"}));
   if(id===56||i===tries-1)return id;
  }catch{
   if(i===tries-1)return null;
  }
  await new Promise<void>(resolve=>setTimeout(resolve,300));
 }
 return null;
}

/** Explicit user click invokes this; signature is never triggered on render.
 * EIP-712 owner signature authorizes Spot and Perp trading but NOT withdrawals.
 */
export async function registerAsterTradingAgent(args:{
 walletAddress:string;getWalletProvider:()=>Promise<AsterWalletProvider>;
 onSwitchToBsc:()=>Promise<void>;
 getReownChainId:()=>number|null;
}):Promise<AsterIdentity>{
 if(busy)throw new Error("Wait for the current Aster authorization");
 busy=true;
 try{
  const user=getAddress(args.walletAddress);
  if(currentAsterAgent(user))throw new Error("Aster agent already enabled on this device");
  const saved=await readRememberedAsterAgent(user);
  if(saved?.approved)throw new Error("Existing Aster agent found. Reconnect it rather than registering another.");
  if(saved&&!saved.approved)throw new Error("Previous Aster authorization status is uncertain. Do not register another agent automatically; review agents in Aster.");
  let native=await args.getWalletProvider();
  // Check the real wallet provider AND Reown's active EVM session. Some
  // WalletConnect mobile connectors keep eth_chainId on an older provider
  // even after Reown's approved switch. Neither signal alone authorizes
  // an agent: we also require a verified chain-56 owner EIP-712 signature.
  let providerChain=await verifiedWalletChainId(native);
  let reownChain=args.getReownChainId();
  if(providerChain!==56&&reownChain!==56){
    try{
      await args.onSwitchToBsc();
    }catch(error){
      const reason=error instanceof Error?error.message:String(error);
      const code=parseRecord(error)?.code;
      if(code===4001||/rejected|denied|cancelled|canceled/i.test(reason))
        throw new Error("BNB Smart Chain network switch was declined. No Aster signature was requested.");
      throw new Error("Unable to switch to BNB Smart Chain through your wallet. Select BNB Smart Chain (56) in the wallet and retry. No agent was registered.");
    }
    // A mobile wallet can suspend the browser while confirming the switch.
    // Re-read the live provider AND latest Reown chain after returning.
    for(let i=0;i<16;i++){
      await new Promise<void>(resolve=>setTimeout(resolve,650));
      try{
        native=await args.getWalletProvider();
        providerChain=await verifiedWalletChainId(native);
      }catch{/* WalletConnect may reconnect its provider after network switch. */}
      reownChain=args.getReownChainId();
      if(providerChain===56||reownChain===56)break;
    }
  }
  if(providerChain!==56&&reownChain!==56)
    throw new Error("BNB Smart Chain (56) was not confirmed in your wallet or Reown session. Open your wallet, select BNB Smart Chain and retry. No Aster signature or registration was sent.");

  // Account ownership is checked on the CURRENT provider both before and
  // after consent; no chain-switch result can impersonate an owner.
  const checkWalletOwner=async()=>{
    const accounts:unknown=await native.request({method:"eth_accounts"});
    if(!Array.isArray(accounts)||typeof accounts[0]!=="string"||
       getAddress(accounts[0])!==user)
      throw new Error("Connected wallet account changed. No Aster agent registered.");
  };
  await checkWalletOwner();
  const agent=Wallet.createRandom();
  const expiresAtMs=Date.now()+30*24*60*60*1000;
  const auth=prepareAsterTradingAgentAuthorization({
   userAddress:user,agentAddress:agent.address,
   expiresAtMs,nowMs:Date.now(),agentName:"HideDex"
  });
  // Request EIP-712 v4 directly on the connected EIP-1193 provider, avoiding
  // ethers BrowserProvider network cache if Reown has just switched chains.
  // Aster's exact domain.chainId remains 56; mismatched wallets can refuse.
  const typedData={
    domain:auth.eip712.domain,
    types:{
      EIP712Domain:[
        {name:"name",type:"string"},
        {name:"version",type:"string"},
        {name:"chainId",type:"uint256"},
        {name:"verifyingContract",type:"address"}
      ],
      ...auth.eip712.types
    },
    primaryType:auth.eip712.primaryType,
    message:auth.eip712.message
  };
  const signature:unknown=await native.request({
    method:"eth_signTypedData_v4",params:[user,JSON.stringify(typedData)]
  });
  if(typeof signature!=="string"||!/^0x[0-9a-f]+$/i.test(signature))
    throw new Error("Wallet did not return a valid Aster EIP-712 signature.");
  const recovered=getAddress(verifyTypedData(
    auth.eip712.domain,auth.eip712.types,auth.eip712.message,signature
  ));
  await checkWalletOwner();
  if(recovered!==user)
    throw new Error("Aster owner signature did not match the connected wallet.");
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
 const body=await signAsterFuturesRead(signed);
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

/** Account-specific Aster Futures risk tiers. Source:
 * GET /fapi/v3/leverageBrackets (USER_DATA). No public token-wise max exists.
 * This is a READ ONLY signature and cannot change margin or leverage.
 */
export type AsterVerifiedLeverage={
 symbol:string;maxLeverage:number;
 brackets:Array<{initialLeverage:number;notionalFloor:number;notionalCap:number}>;
};
export async function getAsterVerifiedLeverageBrackets(
 wallet:string,symbol:string,signal?:AbortSignal
):Promise<AsterVerifiedLeverage>{
 if(!/^[A-Z0-9_]{2,50}$/.test(symbol))throw new Error("Invalid Aster market");
 const signed=active(wallet);
 const query=await signAsterFuturesRead(signed,{symbol});
 const res=await fetch(ASTER_FUTURES_MAINNET+"/fapi/v3/leverageBrackets?"+query.toString(),{
  method:"GET",headers:{Accept:"application/json"},signal,cache:"no-store"
 });
 const response:unknown=await res.json();
 if(isAsterInitialDepositRequired(response))
  throw new Error("Aster requires a main-wallet deposit before authenticated leverage limits can be read.");
 const err=apiError(response);
 if(!res.ok||err)throw new Error(err??"Aster leverage brackets unavailable (HTTP "+res.status+")");
 const result=Array.isArray(response)?
  response.find(x=>parseRecord(x)?.symbol===symbol):response;
 const row=parseRecord(result);
 if(!row||row.symbol!==symbol||!Array.isArray(row.brackets))
  throw new Error("Unverified Aster leverage bracket response");
 const brackets=row.brackets.map((value:unknown)=>{
  const b=parseRecord(value);
  const lev=Number(b?.initialLeverage),floor=Number(b?.notionalFloor),cap=Number(b?.notionalCap);
  if(!Number.isSafeInteger(lev)||lev<1||lev>1000||
     !Number.isFinite(floor)||floor<0||!Number.isFinite(cap)||cap<=floor)
    throw new Error("Invalid Aster leverage risk tier");
  return {initialLeverage:lev,notionalFloor:floor,notionalCap:cap};
 });
 if(!brackets.length)throw new Error("Missing Aster leverage risk tiers");
 // Minimum-notional bracket determines max initial leverage; higher notionals
 // may have lower maximums and must be checked against trade size later.
 const minimumTier=[...brackets].sort((a,b)=>a.notionalFloor-b.notionalFloor)[0];
 if(minimumTier.notionalFloor!==0)
  throw new Error("Aster leverage bracket does not cover zero notional");
 return {symbol,maxLeverage:minimumTier.initialLeverage,brackets};
}

/** One read-only signed request for all active Aster perpetual symbols.
 * One catalog fetch rather than a rate-limit-triggering request per row.
 * The 1x..max leverage shown is the minimum notional tier; full size tiers
 * MUST be enforced when real order execution is implemented later.
 */
export async function getAsterAllVerifiedLeverageBrackets(
 wallet:string,signal?:AbortSignal
):Promise<Record<string,AsterVerifiedLeverage>>{
 const signed=active(wallet);
 const query=await signAsterFuturesRead(signed);
 const res=await fetch(ASTER_FUTURES_MAINNET+"/fapi/v3/leverageBrackets?"+query.toString(),{
  method:"GET",headers:{Accept:"application/json"},signal,cache:"no-store"
 });
 const body:unknown=await res.json();
 if(isAsterInitialDepositRequired(body))
  throw new Error("Aster requires an initial deposit before leverage brackets can be verified.");
 const err=apiError(body);
 if(!res.ok||err)throw new Error(err??"Aster leverage brackets unavailable (HTTP "+res.status+")");
 if(!Array.isArray(body))throw new Error("Aster returned no verified symbol brackets");
 const result:Record<string,AsterVerifiedLeverage>={};
 for(const item of body){
  const row=parseRecord(item),symbol=row?.symbol;
  if(typeof symbol!=="string"||! /^[A-Z0-9_]{2,50}$/.test(symbol)||!Array.isArray(row?.brackets))
   continue;
  const data:Array<{initialLeverage:number;notionalFloor:number;notionalCap:number}>=[];
  for(const item of row.brackets){
   const b=parseRecord(item),lev=Number(b?.initialLeverage),
     floor=Number(b?.notionalFloor),cap=Number(b?.notionalCap);
   if(!Number.isSafeInteger(lev)||lev<1||lev>1000||
      !Number.isFinite(floor)||floor<0||!Number.isFinite(cap)||cap<=floor)
    continue;
   data.push({initialLeverage:lev,notionalFloor:floor,notionalCap:cap});
  }
  const first=data.sort((a,b)=>a.notionalFloor-b.notionalFloor)[0];
  if(first?.notionalFloor!==0)continue;
  result[symbol]={symbol,maxLeverage:first.initialLeverage,brackets:data};
 }
 if(!Object.keys(result).length)throw new Error("No valid Aster leverage brackets were returned");
 return result;
}

/** Exactly one user-triggered read-only request. The report intentionally
 * excludes the private key, signature, signed message and complete URL.
 * Uses the SAME production signing helper as getAsterFuturesBalances.
 */
export type AsterReadDiagnostic={
 outcome:"accepted"|"rejected"|"invalid-response"|"network-error"|"local-error";
 endpoint:string;agentMasked:string;fieldOrder:string;
 nonceAgeSeconds:number|null;nonceValid:boolean;signerVerified:boolean;
 httpStatus:number|null;exchangeCode:string|null;exchangeMessage:string|null;
 clockSkewSeconds:number|null;
};
export async function diagnoseAsterBalanceRead(
 owner:string,signal?:AbortSignal
):Promise<AsterReadDiagnostic>{
 const result:AsterReadDiagnostic={
  outcome:"local-error",endpoint:"GET "+ASTER_FUTURES_MAINNET+"/fapi/v3/balance",
  agentMasked:"unverified",fieldOrder:"unavailable",nonceAgeSeconds:null,
  nonceValid:false,signerVerified:false,httpStatus:null,
  exchangeCode:null,exchangeMessage:null,clockSkewSeconds:null
 };
 try{
  const saved=active(owner);
  result.agentMasked=saved.agent.slice(0,6)+"…"+saved.agent.slice(-4);
  const signed=await signAsterFuturesRead(saved);
  const signature=signed.get("signature");
  const unsigned=new URLSearchParams(signed);
  unsigned.delete("signature");
  const keys=Array.from(unsigned.keys());
  result.fieldOrder=keys.join(" → ");
  const n=unsigned.get("nonce")??"";
  if(/^\d{15,17}$/.test(n)){
   const delta=(Date.now()*1000-Number(n))/1_000_000;
   if(Number.isFinite(delta)){
    result.nonceAgeSeconds=Math.round(delta*10)/10;
    result.nonceValid=Math.abs(delta)<=60;
   }
  }
  result.signerVerified=Boolean(signature)&&
   getAddress(verifyTypedData(TRADE_DOMAIN,RECORD_TYPE,{msg:unsigned.toString()},signature!))===
    getAddress(saved.agent);
  if(!result.nonceValid||!result.signerVerified||
     keys.join(",")!=="nonce,signer,user"||
     unsigned.get("user")!==saved.user||unsigned.get("signer")!==saved.agent){
   result.exchangeMessage="Local signing or nonce validation failed; request not sent";
   return result;
  }
  // Only ONE GET. Not a signing-format experiment, and never an order.
  const response=await fetch(ASTER_FUTURES_MAINNET+"/fapi/v3/balance?"+signed.toString(),{
   method:"GET",signal,headers:{Accept:"application/json"},cache:"no-store"
  });
  result.httpStatus=response.status;
  const serverDate=response.headers.get("date");
  if(serverDate){
   const time=Date.parse(serverDate);
   if(Number.isFinite(time))
    result.clockSkewSeconds=Math.round((Date.now()-time)/1000);
  }
  let json:unknown;
  try{json=await response.json();}
  catch{
   result.outcome="invalid-response";
   result.exchangeMessage="API returned non-JSON response";
   return result;
  }
  const error=parseRecord(json);
  if(typeof error?.code==="string"||typeof error?.code==="number")
   result.exchangeCode=String(error.code).slice(0,22);
  // Never echo unknown raw server text: it might include a URL or signature.
  if(typeof error?.msg==="string"){
   const msg=error.msg.trim().slice(0,130);
   result.exchangeMessage=/^[a-zA-Z0-9 _.,:()'-]+$/.test(msg)?msg:
    "Exchange message omitted for privacy";
  }
  if(response.ok&&Array.isArray(json)){
   result.outcome="accepted";
   result.exchangeMessage="Signed balance read accepted";
  }else if(!response.ok||result.exchangeCode!==null){
   result.outcome="rejected";
   if(!result.exchangeMessage)result.exchangeMessage="Exchange rejected request";
  }else{
   result.outcome="invalid-response";
   result.exchangeMessage="Unexpected response shape";
  }
 }catch(err){
  if(signal?.aborted)throw err;
  // Exceptions can contain signed URLs; never display exception.message.
  result.outcome=result.signerVerified?"network-error":"local-error";
  result.exchangeMessage=result.signerVerified?
   "Browser blocked or could not read the request (network/CORS)":
   "Local signature check failed; no request sent";
 }
 return result;
}
