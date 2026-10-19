/** New Aster Pro API V3 wallet/agent implementation. No legacy Aster source reused.
 * Official references: asterdex/API-demo futures-v3-demo and aster-code-demo.
 * No private key is ever sent to an API or placed in query strings/logs.
 */
import {BrowserProvider,Wallet,getAddress} from "ethers";
import {setAgentSecret,getAgentSecret} from "./asterFreshDeviceStore";
import {ASTER_FAPI} from "./asterMarketData";
export type AsterProvider={request:(arg:{method:string;params?:unknown[]})=>Promise<unknown>};
export type AsterAuthMode={order:"raw"|"ascii";withChain:boolean};
export type AsterIdentity={owner:string;agent:string;mode:AsterAuthMode|null;};
type AnyRow=Record<string,unknown>;
const row=(v:unknown):AnyRow|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as AnyRow:null;
const domain=(chainId:number)=>({name:"AsterSignTransaction",version:"1",chainId,verifyingContract:"0x0000000000000000000000000000000000000000"});
const types={Message:[{name:"msg",type:"string"}]};
const dbkey=(owner:string)=>"hidedex:aster:v3:"+getAddress(owner).toLowerCase();
const goodKey=(x:string)=>/^0x[0-9a-fA-F]{64}$/.test(x);
let lastNonce=0;
function nonce(){const next=Date.now()*1000;if(next<=lastNonce)lastNonce++;else lastNonce=next;return String(lastNonce);}
const err=(data:unknown,status:number):Error=>{
 const d=row(data);const code=d?.code!=null?String(d.code):"HTTP "+status;
 const reason=typeof d?.msg==="string"?d.msg:typeof d?.message==="string"?d.message:"Aster rejected request";
 return new Error("Aster "+code+": "+reason.slice(0,180).replace(/0x[0-9a-f]{64}/ig,"[redacted]"));
};
function rawMessage(params:Record<string,string>,mode:AsterAuthMode){
 const entries=Object.entries(params);if(mode.order==="ascii")entries.sort(([a],[b])=>a<b?-1:a>b?1:0);
 return entries.map(([key,value])=>key+"="+value).join("&");
}
async function send(path:string,method:"GET"|"POST"|"DELETE",params:Record<string,string>,secret:string,owner:string,mode:AsterAuthMode){
 if(!/^\/(fapi|api)\/v3\/[a-zA-Z\-/]+$/.test(path))throw Error("Invalid signed Aster route");
 const signer=new Wallet(secret);const input:Record<string,string>={...params};
 if(mode.withChain)input.asterChain="Mainnet";
 input.user=getAddress(owner);input.signer=signer.address;input.nonce=nonce();
 const signature=await signer.signTypedData(domain(1666),types,{msg:rawMessage(input,mode)});
 const body=new URLSearchParams({...input,signature}).toString();
 const host=path.startsWith("/api/v3/")?"https://sapi.asterdex.com":ASTER_FAPI;
 const response=await fetch(host+path+(method==="GET"?"?"+body:""),{
  method,headers:{Accept:"application/json",...(method!=="GET"?{"Content-Type":"application/x-www-form-urlencoded"}:{})},
  ...(method!=="GET"?{body}:{})
 });
 const payload:unknown=await response.json().catch(()=>null);
 const meta=row(payload);if(!response.ok||(typeof meta?.code==="number"&&meta.code<0))throw err(payload,response.status);
 return payload;
}
async function ownedSecret(owner:string):Promise<string|null>{
 const value=await getAgentSecret(dbkey(owner));
 if(!value)return null;
 if(!goodKey(value))throw Error("Stored Aster signer is invalid; do not re-authorize automatically.");
 return value;
}
export async function restoreAsterSigner(owner:string):Promise<AsterIdentity|null>{
 if(!/^0x[0-9a-fA-F]{40}$/.test(owner))return null;
 const secret=await ownedSecret(owner);return secret?{owner:getAddress(owner),agent:new Wallet(secret).address,mode:null}:null;
}
export async function authorizeAsterAgent(owner:string,provider:AsterProvider):Promise<AsterIdentity>{
 const address=getAddress(owner);
 if(await ownedSecret(owner))throw Error("Aster signer already stored. Verify existing authorization before creating another.");
 const currentChain=Number(BigInt(String(await provider.request({method:"eth_chainId"}))));
 if(currentChain!==56)await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x38"}]});
 if(Number(BigInt(String(await provider.request({method:"eth_chainId"}))))!==56)throw Error("Switch to BNB Chain (56) to approve Aster agent.");
 const wallet=new BrowserProvider(provider as any);
 const userSigner=await wallet.getSigner();
 if(getAddress(await userSigner.getAddress())!==address)throw Error("Wallet changed before Aster agent authorization.");
 const newAgent=Wallet.createRandom();
 const fields:Record<string,string|boolean|number>={
  agentName:"HideDex",agentAddress:newAgent.address,ipWhitelist:"",
  expired:Date.now()+30*86400000,canSpotTrade:true,canPerpTrade:true,canWithdraw:false,
  asterChain:"Mainnet",user:address,nonce:Number(nonce())
 };
 const msg:Record<string,unknown>={};const schema:Array<{name:string;type:string}>=[];
 for(const [key,value] of Object.entries(fields)){
  const name=key[0].toUpperCase()+key.slice(1);msg[name]=value;
  schema.push({name,type:typeof value==="boolean"?"bool":typeof value==="number"?"uint256":"string"});
 }
 const signature=await userSigner.signTypedData(domain(56),{ApproveAgent:schema},msg);
 const query=new URLSearchParams(Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,String(v)])));
 query.set("signature",signature);query.set("signatureChainId","56");
 const response=await fetch(ASTER_FAPI+"/fapi/v3/approveAgent?"+query.toString(),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"}});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok||(typeof row(data)?.code==="number"&&Number(row(data)?.code)<0))throw err(data,response.status);
 // Do not persist credentials unless server explicitly accepted registration.
 if(row(data)?.code!=null && !["200","0","000000"].includes(String(row(data)?.code)))throw err(data,response.status);
 await setAgentSecret(dbkey(owner),newAgent.privateKey);
 return {owner:address,agent:newAgent.address,mode:null};
}
export async function asterSignedRead(owner:string,path:string,params:Record<string,string>={}):Promise<{data:unknown;mode:AsterAuthMode}>{
 const secret=await ownedSecret(owner);if(!secret)throw Error("Enable Aster trading with your wallet first.");
 // These read-only attempts reconcile incompatible published canonicalizations.
 // NEVER retry a write/order/withdraw automatically.
 const modes:AsterAuthMode[]=[{order:"raw",withChain:false},{order:"ascii",withChain:false},{order:"raw",withChain:true},{order:"ascii",withChain:true}];
 let last:unknown=null;
 for(const mode of modes){
  try{return {data:await send(path,"GET",params,secret,owner,mode),mode};}
  catch(error){last=error;if(!/Aster (?:-1000|-1022):/.test(String(error)))throw error;}
 }
 throw last instanceof Error?last:Error("Aster signature verification failed.");
}
export async function asterSignedWrite(owner:string,mode:AsterAuthMode,path:string,method:"POST"|"DELETE",params:Record<string,string>):Promise<unknown>{
 const secret=await ownedSecret(owner);if(!secret)throw Error("Aster API signer unavailable.");
 return send(path,method,params,secret,owner,mode);
}
export async function asterReadAccount(owner:string):Promise<{identity:AsterIdentity;balance:unknown;account:unknown;positions:unknown;orders:unknown}>{
 const balance=await asterSignedRead(owner,"/fapi/v3/balance");
 const mode=balance.mode,secret=await ownedSecret(owner);if(!secret)throw Error("Aster trading signer missing");
 const [account,positions,orders]=await Promise.all([
  send("/fapi/v3/account","GET",{},secret,owner,mode),
  send("/fapi/v3/positionRisk","GET",{},secret,owner,mode),
  send("/fapi/v3/openOrders","GET",{},secret,owner,mode)]);
 return{identity:{owner:getAddress(owner),agent:new Wallet(secret).address,mode},balance:balance.data,account,positions,orders};
}
export const asterNumber=(x:unknown)=>{if((typeof x!=="number"&&typeof x!=="string")||String(x).trim()==="")return null;const n=Number(x);return Number.isFinite(n)?n:null;};

/** Withdrawal permission is a separately requested, owner-signed escalation.
 * The initial trading agent is always created without withdrawal access.
 * Never use the API agent's signature in place of the owner's signature.
 */
export async function grantAsterWithdrawPermission(owner:string,provider:AsterProvider):Promise<void>{
 const secret=await ownedSecret(owner);if(!secret)throw Error("Authorize Aster trading first");
 const address=getAddress(owner), agent=new Wallet(secret).address;
 const chain=Number(BigInt(String(await provider.request({method:"eth_chainId"}))));
 if(chain!==56)await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x38"}]});
 if(Number(BigInt(String(await provider.request({method:"eth_chainId"}))))!==56)throw Error("BNB Chain is required to update Aster permissions.");
 const signer=await (new BrowserProvider(provider as any)).getSigner();
 if(getAddress(await signer.getAddress())!==address)throw Error("Wallet changed before permission request");
 const fields:Record<string,string|boolean|number>={
  agentAddress:agent,canSpotTrade:true,canPerpTrade:true,canWithdraw:true,
  asterChain:"Mainnet",user:address,nonce:Number(nonce())
 };
 const msg:Record<string,unknown>={},schema:Array<{name:string;type:string}>=[];
 for(const [k,v] of Object.entries(fields)){
  const key=k[0].toUpperCase()+k.slice(1);msg[key]=v;
  schema.push({name:key,type:typeof v==="boolean"?"bool":typeof v==="number"?"uint256":"string"});
 }
 const signature=await signer.signTypedData(domain(56),{UpdateAgent:schema},msg);
 const params=new URLSearchParams(Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,String(v)])));
 params.set("signature",signature);params.set("signatureChainId","56");
 const response=await fetch(ASTER_FAPI+"/fapi/v3/updateAgent?"+params.toString(),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"}});
 const result:unknown=await response.json().catch(()=>null);
 const status=row(result)?.code;
 if(!response.ok||(status!=null&&!["200","0","000000"].includes(String(status))))throw err(result,response.status);
}

/** Spot v3 uses the same Pro API Message domain but the separate sapi host.
 * Unknown public/credential state is not upgraded into a successful permission.
 */
export async function asterSignedSpotRead(owner:string,path:string,params:Record<string,string>={}):Promise<{data:unknown;mode:AsterAuthMode}>{
 if(!path.startsWith("/api/v3/"))throw Error("Invalid Aster Spot query");
 const secret=await ownedSecret(owner);if(!secret)throw Error("Authorize your Aster signer first");
 const modes:AsterAuthMode[]=[{order:"raw",withChain:false},{order:"ascii",withChain:false},{order:"raw",withChain:true},{order:"ascii",withChain:true}];
 let last:unknown=null;
 for(const mode of modes){try{return {data:await send(path,"GET",params,secret,owner,mode),mode};}
 catch(error){last=error;if(!/Aster (?:-1000|-1022):/.test(String(error)))throw error;}}
 throw last instanceof Error?last:Error("Aster Spot signer not verified");
}
export async function asterSignedSpotWrite(owner:string,mode:AsterAuthMode,path:string,method:"POST"|"DELETE",params:Record<string,string>):Promise<unknown>{
 if(!path.startsWith("/api/v3/"))throw Error("Invalid Spot action");
 const secret=await ownedSecret(owner);if(!secret)throw Error("Aster Spot signer unavailable");
 return send(path,method,params,secret,owner,mode);
}
