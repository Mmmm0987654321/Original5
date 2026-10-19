/** Aster official Futures V3 mainnet public data, never substituted from HL/Lighter. */
export const ASTER_FAPI="https://fapi.asterdex.com";
type Rec=Record<string,unknown>;
const rec=(x:unknown):Rec|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Rec:null;
const num=(x:unknown):number|null=>{const n=typeof x==="number"||typeof x==="string"&&x.trim()?Number(x):NaN;return Number.isFinite(n)?n:null;};
export type AsterMarket={symbol:string;base:string;quote:string;last:number|null;change24h:number|null;volume24h:number|null;tick:string;step:string;minQty:number|null;minNotional:number|null;maxLeverage:number|null;};
export type AsterLevel={price:number;size:number;total:number};
export type AsterCandle={time:number;open:number;high:number;low:number;close:number;volume:number};
export async function asterPublic(path:string,signal?:AbortSignal):Promise<unknown>{
 if(!path.startsWith("/fapi/v3/"))throw Error("Non-Aster market route");
 const response=await fetch(ASTER_FAPI+path,{signal,headers:{Accept:"application/json"}});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error("Aster market API HTTP "+response.status);
 if(rec(data)&&typeof rec(data)?.code==="number"&&Number(rec(data)?.code)<0)throw Error("Aster market API rejected the request");
 return data;
}
export async function getAsterMarkets(signal?:AbortSignal):Promise<AsterMarket[]>{
 const [info,allTicker]=await Promise.all([asterPublic("/fapi/v3/exchangeInfo",signal),asterPublic("/fapi/v3/ticker/24hr",signal)]);
 const meta=rec(info),tickers=Array.isArray(allTicker)?allTicker:[];
 if(!Array.isArray(meta?.symbols))throw Error("Aster exchangeInfo lacks symbols");
 const tickerMap=new Map<string,Rec>();
 for(const raw of tickers){const t=rec(raw);if(typeof t?.symbol==="string")tickerMap.set(t.symbol,t);}
 const markets:AsterMarket[]=[];
 for(const item of meta.symbols){const row=rec(item);if(!row||row.status!=="TRADING"||typeof row.symbol!=="string"||typeof row.baseAsset!=="string"||typeof row.quoteAsset!=="string"||row.quoteAsset!=="USDT"||row.symbol.startsWith("TEST"))continue;
  const tick=tickerMap.get(row.symbol);
  let priceTick="",sizeStep="",minQty:number|null=null,minNotional:number|null=null;
  for(const filter of Array.isArray(row.filters)?row.filters:[]){const f=rec(filter);
   if(f?.filterType==="PRICE_FILTER"&&typeof f.tickSize==="string")priceTick=f.tickSize;
   if((f?.filterType==="LOT_SIZE"||f?.filterType==="MARKET_LOT_SIZE")&&typeof f.stepSize==="string"){
    if(!sizeStep||f.filterType==="LOT_SIZE"){sizeStep=f.stepSize;minQty=num(f.minQty);}
   }
   if(f?.filterType==="MIN_NOTIONAL")minNotional=num(f.notional??f.minNotional);
  }
  if(!priceTick||!sizeStep||!num(priceTick)||!num(sizeStep))continue;
  markets.push({symbol:row.symbol,base:row.baseAsset,quote:row.quoteAsset,last:num(tick?.lastPrice),change24h:num(tick?.priceChangePercent),volume24h:num(tick?.quoteVolume),tick:priceTick,step:sizeStep,minQty,minNotional,maxLeverage:null});
 }
 return markets;
}
export async function getAsterDepth(symbol:string,signal?:AbortSignal):Promise<{asks:AsterLevel[];bids:AsterLevel[]}>{
 if(!/^[A-Z0-9]{3,32}$/.test(symbol))throw Error("Invalid Aster symbol");
 const data=rec(await asterPublic("/fapi/v3/depth?symbol="+encodeURIComponent(symbol)+"&limit=20",signal));
 const parse=(rows:unknown):AsterLevel[]=>{let total=0;return (Array.isArray(rows)?rows:[]).flatMap(v=>{
  const item=Array.isArray(v)?v:[],price=num(item[0]),size=num(item[1]);
  if(price===null||size===null||price<=0||size<0)return[];
  total+=size;return[{price,size,total}];
 });};
 return{asks:parse(data?.asks),bids:parse(data?.bids)};
}
export async function getAsterCandles(symbol:string,interval:string,limit=240,signal?:AbortSignal):Promise<AsterCandle[]>{
 if(!/^[A-Z0-9]{3,32}$/.test(symbol)||!/^(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|1w)$/.test(interval))throw Error("Invalid Aster candles request");
 const data=await asterPublic("/fapi/v3/klines?symbol="+encodeURIComponent(symbol)+"&interval="+interval+"&limit="+Math.min(500,Math.max(20,limit)),signal);
 if(!Array.isArray(data))throw Error("Aster candles unavailable");
 return data.flatMap(v=>{const x=Array.isArray(v)?v:[],time=num(x[0]),open=num(x[1]),high=num(x[2]),low=num(x[3]),close=num(x[4]),volume=num(x[5]);
  return time!==null&&open!==null&&high!==null&&low!==null&&close!==null&&volume!==null&&open>0&&high>0&&low>0&&close>0?[{time,open,high,low,close,volume}]:[];
 });
}
