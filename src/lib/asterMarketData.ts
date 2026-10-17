/**
 * HideDex Aster MAINNET public market adapter (V3).
 * Official references:
 * https://asterdex.github.io/aster-api-website/futures-v3/market-data/
 * https://asterdex.github.io/aster-api-website/spot-v3/general-info/
 *
 * This is NOT a trading signer. Public exchange metadata/quotes only.
 * No user accounts, keys, order writes, transfers or Hyperliquid fallback.
 * Aster Shield and 1001x have different execution systems: DO NOT
 * misrepresent them as V3 Spot/Perp or enable orders through these routes.
 */

export const ASTER_FUTURES_MAINNET="https://fapi.asterdex.com";
export const ASTER_SPOT_MAINNET="https://sapi.asterdex.com";

export type AsterMarketKind="perp"|"spot";
export interface AsterMarket {
  /** Stable opaque market key: no collisions between Spot and Perps. */
  id:string;
  /** EXACT Aster trade symbol, e.g. BTCUSDT (no inferred conversion). */
  symbol:string;
  baseAsset:string;
  quoteAsset:string;
  kind:AsterMarketKind;
  priceDecimals:number|null;
  quantityDecimals:number|null;
  tickSize:string|null;
  stepSize:string|null;
  minNotional:string|null;
  /** Latest Aster last trade. NULL when unavailable, never HL fallback. */
  lastPrice:number|null;
  change24hPercent:number|null;
  quoteVolume24h:number|null;
  high24h:number|null;
  low24h:number|null;
  fundingRate:number|null;
  nextFundingTimeMs:number|null;
  /** Authenticated market/bracket API required; never guess "125x". */
  maxLeverage:null;
}
export interface AsterBook{
  symbol:string;
  kind:AsterMarketKind;
  lastUpdateId:string|null;
  bids:Array<{price:string;size:string}>;
  asks:Array<{price:string;size:string}>;
}
export interface AsterCandle{
  openTimeMs:number;
  open:number;
  high:number;
  low:number;
  close:number;
  volume:number;
  closeTimeMs:number;
}

type Rec=Record<string,unknown>;
const asRecord=(v:unknown):Rec|null=>
  v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Rec:null;
const number=(v:unknown):number|null=>{
  if(typeof v!=="number"&&typeof v!=="string")return null;
  if(typeof v==="string"&&!v.trim())return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const positive=(v:unknown):number|null=>{
  const n=number(v);return n!==null&&n>0?n:null;
};
const string=(v:unknown):string=>typeof v==="string"?v.trim():"";
function safeSymbol(s:string){
  if(!/^[A-Z0-9_]{2,50}$/.test(s))throw new Error("Invalid Aster mainnet symbol");
  return s;
}
function host(kind:AsterMarketKind){return kind==="spot"?ASTER_SPOT_MAINNET:ASTER_FUTURES_MAINNET;}
function prefix(kind:AsterMarketKind){return kind==="spot"?"/api/v3":"/fapi/v3";}

/** Browser public endpoints: no signature, no secret and no automatic retries. */
async function publicGet(kind:AsterMarketKind,path:string,signal?:AbortSignal):Promise<unknown>{
  if(!path.startsWith(prefix(kind)+"/"))throw new Error("Unsupported Aster API path");
  const res=await fetch(host(kind)+path,{
    method:"GET",signal,headers:{Accept:"application/json"},
  });
  if(!res.ok)throw new Error("Aster "+kind+" API HTTP "+res.status);
  const body:unknown=await res.json();
  const err=asRecord(body);
  if(err&&number(err.code)!==null&&number(err.code)!==200)
    throw new Error("Aster "+kind+" API code "+String(err.code));
  return body;
}

function filterValue(row:Rec,type:string,field:string):string|null{
  const filters=Array.isArray(row.filters)?row.filters:[];
  for(const x of filters){
    const f=asRecord(x);
    if(f&&f.filterType===type){
      const v=string(f[field]);
      return v||null;
    }
  }
  return null;
}
function exchangeSymbols(data:unknown):Rec[]{
  const result=asRecord(data);
  if(!result||!Array.isArray(result.symbols))throw new Error("Invalid Aster V3 exchangeInfo");
  return result.symbols.map(asRecord).filter((x):x is Rec=>x!==null);
}

/** One mainnet catalog snapshot. No synthetic max leverage or fake pairs. */
export async function getAsterMarkets(kind:AsterMarketKind,signal?:AbortSignal):Promise<AsterMarket[]>{
  const root=prefix(kind);
  // Use exchangeInfo as market authority; a ticker alone cannot create a market.
  const [exchange,ticker]=await Promise.all([
    publicGet(kind,root+"/exchangeInfo",signal),
    publicGet(kind,root+"/ticker/24hr",signal),
  ]);
  const quotes=new Map<string,Rec>();
  for(const item of Array.isArray(ticker)?ticker:[ticker]){
    const t=asRecord(item);const symbol=t&&string(t.symbol);
    if(symbol&&t)quotes.set(symbol,t);
  }
  const output:AsterMarket[]=[];
  const seen=new Set<string>();
  for(const row of exchangeSymbols(exchange)){
    const symbol=string(row.symbol),base=string(row.baseAsset),quote=string(row.quoteAsset);
    if(row.status!=="TRADING"||!symbol||!base||!quote||
      symbol.startsWith("TEST")||! /^[A-Z0-9_]{2,50}$/.test(symbol))continue;
    const id=kind+":"+symbol;
    if(seen.has(id))continue;
    seen.add(id);
    const t=quotes.get(symbol);
    const precision=number(row.pricePrecision);
    const quantityPrecision=number(row.quantityPrecision);
    const daily=number(t?.priceChangePercent);
    const fund=number(t?.lastFundingRate);
    output.push({
      id,symbol,baseAsset:base,quoteAsset:quote,kind,
      priceDecimals:precision!==null&&Number.isInteger(precision)&&precision>=0&&precision<=18?precision:null,
      quantityDecimals:quantityPrecision!==null&&Number.isInteger(quantityPrecision)&&quantityPrecision>=0&&quantityPrecision<=18?quantityPrecision:null,
      tickSize:filterValue(row,"PRICE_FILTER","tickSize"),
      stepSize:filterValue(row,"LOT_SIZE","stepSize"),
      minNotional:filterValue(row,"MIN_NOTIONAL","notional")??
        filterValue(row,"MIN_NOTIONAL","minNotional")??
        filterValue(row,"NOTIONAL","minNotional"),
      lastPrice:positive(t?.lastPrice),
      change24hPercent:daily,
      quoteVolume24h:number(t?.quoteVolume),
      high24h:positive(t?.highPrice),
      low24h:positive(t?.lowPrice),
      fundingRate:fund,
      nextFundingTimeMs:null,
      maxLeverage:null,
    });
  }
  if(!output.length)throw new Error("No verified active Aster "+kind+" markets");
  return output;
}

/** Preserve both universes independently, even when a base asset matches. */
export async function getAsterSpotAndPerps(signal?:AbortSignal):Promise<AsterMarket[]>{
  const [perps,spots]=await Promise.all([
    getAsterMarkets("perp",signal),getAsterMarkets("spot",signal),
  ]);
  return [...perps,...spots];
}

/** Orderbook size is base-asset quantity. Numeric raw levels are not estimated. */
export async function getAsterBook(
  kind:AsterMarketKind,symbol:string,limit:5|10|20|50|100=20,
  signal?:AbortSignal
):Promise<AsterBook>{
  safeSymbol(symbol);
  const response=asRecord(await publicGet(kind,prefix(kind)+
    "/depth?symbol="+encodeURIComponent(symbol)+"&limit="+limit,signal));
  if(!response||!Array.isArray(response.bids)||!Array.isArray(response.asks))
    throw new Error("Invalid Aster V3 depth snapshot");
  const decode=(rows:unknown[]):Array<{price:string;size:string}>=>rows.flatMap(v=>{
    if(!Array.isArray(v)||v.length<2)return [];
    const p=string(v[0]),s=string(v[1]);
    return positive(p)!==null&&number(s)!==null&&number(s)!>=0?
      [{price:p,size:s}]:[];
  });
  return {
    kind,symbol,
    lastUpdateId:response.lastUpdateId===undefined?null:String(response.lastUpdateId),
    bids:decode(response.bids),
    asks:decode(response.asks),
  };
}

export async function getAsterCandles(
  kind:AsterMarketKind,symbol:string,
  interval:"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w",
  limit=300,signal?:AbortSignal
):Promise<AsterCandle[]>{
  safeSymbol(symbol);
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error("Invalid Aster candle limit");
  const data=await publicGet(kind,prefix(kind)+
    "/klines?symbol="+encodeURIComponent(symbol)+"&interval="+interval+
    "&limit="+limit,signal);
  if(!Array.isArray(data))throw new Error("Invalid Aster V3 candles");
  return data.flatMap(v=>{
    if(!Array.isArray(v)||v.length<7)return [];
    const start=number(v[0]),o=positive(v[1]),h=positive(v[2]),
      l=positive(v[3]),c=positive(v[4]),volume=number(v[5]),end=number(v[6]);
    if(start===null||end===null||o===null||h===null||l===null||
      c===null||volume===null||volume<0||h<l)return [];
    return [{openTimeMs:start,open:o,high:h,low:l,close:c,volume,closeTimeMs:end}];
  });
}
