/**
 * Read-only official Aster Chain RPC account query.
 * Official docs: https://asterdex.github.io/aster-api-website/rpc/endpoints/
 * Returns account-level Perp wallet assets; Shield collateral is NOT identified.
 * Never derive Shield order quantities, leverage or spendable margin from this.
 */
export interface AsterChainPerpWallet{
 assets:Array<{asset:string;balance:string}>;
 privacy:"enabled"|"disabled"|null;
}
const isObject=(x:unknown):x is Record<string,unknown>=>
 typeof x==="object"&&x!==null&&!Array.isArray(x);
const decimal=(x:unknown):string|null=>{
 if(typeof x!=="number"&&typeof x!=="string")return null;
 const value=String(x);
 if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))return null;
 if(!Number.isFinite(Number(value)))return null;
 return value;
};
export async function readAsterChainPerpWallet(address:string,signal?:AbortSignal):Promise<AsterChainPerpWallet>{
 if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw Error("Connect a valid Aster wallet.");
 const response=await fetch("https://tapi.asterdex.com/info",{
  method:"POST",
  headers:{"Content-Type":"application/json","Accept":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method:"aster_getBalance",params:[address,"latest"]}),
  signal
 });
 if(!response.ok)throw Error("Aster Chain balance RPC returned HTTP "+response.status);
 const payload:unknown=await response.json().catch(()=>null);
 if(!isObject(payload)||!isObject(payload.result))throw Error("Aster RPC account data unavailable.");
 const result=payload.result;
 if(typeof result.address!=="string"||result.address.toLowerCase()!==address.toLowerCase())
  throw Error("Aster RPC balance response wallet mismatch.");
 if(!Array.isArray(result.perpAssets))throw Error("Aster RPC did not provide verified Perp assets.");
 const assets:Array<{asset:string;balance:string}>=[];
 for(const raw of result.perpAssets){
  if(!isObject(raw)||typeof raw.asset!=="string"||!/^[A-Z0-9]{2,20}$/.test(raw.asset))
   throw Error("Aster RPC returned malformed asset identity.");
  const balance=decimal(raw.walletBalance);
  if(balance===null)throw Error("Aster RPC returned malformed asset balance.");
  if(assets.some(item=>item.asset===raw.asset))throw Error("Aster RPC duplicated an asset balance.");
  assets.push({asset:raw.asset,balance});
 }
 return {assets,privacy:result.accountPrivacy==="enabled"||result.accountPrivacy==="disabled"?result.accountPrivacy:null};
}
/** Render the exact decimal digits supplied by RPC (no invented rounding). */
export function formatAsterChainAmount(amount:string):string{
 if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount))return "—";
 const negative=amount.startsWith("-");
 const [whole,fract]=amount.replace(/^-/, "").split(".");
 return (negative?"-":"")+whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")+(fract===undefined?"":"."+fract);
}
