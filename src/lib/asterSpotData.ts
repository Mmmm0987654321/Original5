/** Aster Spot V3 production ONLY. No cross-venue prices, no test markets. */
import type {AsterMarket,AsterLevel,AsterCandle} from "./asterMarketData";
const BASE="https://sapi.asterdex.com";
type Rec=Record<string,unknown>;
const obj=(v:unknown):Rec|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Rec:null;
const val=(v:unknown):number|null=>{const n=typeof v==="string"||typeof v==="number"?Number(v):NaN;return Number.isFinite(n)?n:null};
async function get(path:string,signal?:AbortSignal):Promise<unknown>{
 if(!/^\/api\/v3\/[a-zA-Z0-9/?=&]+$/.test(path))throw Error("Invalid Aster Spot route");
 const response=await fetch(BASE+path,{headers:{Accept:"application/json"},signal});
 const payload:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error("Aster Spot mainnet HTTP "+response.status);
 const x=obj(payload);if(typeof x?.code==="number"&&x.code<0)throw Error("Aster Spot mainnet API "+x.code);
 return payload;
}
export async function getAsterSpotMarkets(signal?:AbortSignal):Promise<AsterMarket[]>{
 const [raw,stats]=await Promise.all([get("/api/v3/exchangeInfo",signal),get("/api/v3/ticker/24hr",signal)]);
 const info=obj(raw),tickers=Array.isArray(stats)?stats:[],mapped=new Map<string,Rec>();
 for(const t of tickers){const r=obj(t);if(typeof r?.symbol==="string")mapped.set(r.symbol,r);}
 if(!Array.isArray(info?.symbols))throw Error("Aster Spot exchangeInfo unavailable");
 const output:AsterMarket[]=[];
 for(const v of info.symbols){const r=obj(v);if(!r||r.status!=="TRADING"||typeof r.symbol!=="string"||
  typeof r.baseAsset!=="string"||typeof r.quoteAsset!=="string"||r.quoteAsset!=="USDT"||r.symbol.startsWith("TEST"))continue;
  const ticker=mapped.get(r.symbol);
  let tick="",step="",minimum:number|null=null,minNotional:number|null=null;
  for(const rawFilter of Array.isArray(r.filters)?r.filters:[]){const f=obj(rawFilter);
   if(f?.filterType==="PRICE_FILTER"&&typeof f.tickSize==="string")tick=f.tickSize;
   if(f?.filterType==="LOT_SIZE"&&typeof f.stepSize==="string"){step=f.stepSize;minimum=val(f.minQty);}
   if(f?.filterType==="MIN_NOTIONAL")minNotional=val(f.minNotional??f.notional);
  }
  if(!tick||!step||!val(tick)||!val(step))continue;
  output.push({symbol:r.symbol,base:r.baseAsset,quote:r.quoteAsset,last:val(ticker?.lastPrice),
   change24h:val(ticker?.priceChangePercent),volume24h:val(ticker?.quoteVolume),
   tick,step,minQty:minimum,minNotional,maxLeverage:null});
 }
 return output;
}
export async function getAsterSpotDepth(symbol:string,signal?:AbortSignal):Promise<{asks:AsterLevel[];bids:AsterLevel[]}>{
 if(!/^[A-Z0-9]{3,32}$/.test(symbol))throw Error("Invalid Aster Spot symbol");
 const data=obj(await get("/api/v3/depth?symbol="+symbol+"&limit=20",signal));
 const parse=(l:unknown):AsterLevel[]=>{let sum=0;return (Array.isArray(l)?l:[]).flatMap(item=>{
  const a=Array.isArray(item)?item:[],price=val(a[0]),size=val(a[1]);
  if(price===null||size===null||price<=0||size<0)return[];
  sum+=size;return[{price,size,total:sum}];
 });};
 return{asks:parse(data?.asks),bids:parse(data?.bids)};
}
export async function getAsterSpotCandles(symbol:string,interval:string,limit=300):Promise<AsterCandle[]>{
 if(!/^[A-Z0-9]{3,32}$/.test(symbol)||!/^(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|1w)$/.test(interval))throw Error("Invalid Spot candle request");
 const data=await get("/api/v3/klines?symbol="+symbol+"&interval="+interval+"&limit="+Math.min(Math.max(limit,20),500));
 if(!Array.isArray(data))throw Error("Aster Spot candles unavailable");
 return data.flatMap(item=>{const x=Array.isArray(item)?item:[],time=val(x[0]),open=val(x[1]),high=val(x[2]),low=val(x[3]),close=val(x[4]),volume=val(x[5]);
  return time!==null&&open!==null&&high!==null&&low!==null&&close!==null&&volume!==null&&open>0&&high>0&&low>0&&close>0?
   [{time,open,high,low,close,volume}]:[];
 });
}
