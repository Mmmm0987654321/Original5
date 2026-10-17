/** Lighter public per-account analytics. No API key, signing, orders or Hyperliquid.
 * Source: GET /api/v1/pnl and public L1-address account discovery.
 * volume is Lighter's reported bucket volume; trade_pnl is a cumulative
 * reported trading-PnL observation (never reconstructed account equity).
 */
import {getLighterAccountIndexes,lighterPublicGet} from "./lighterMarketData";

export type LighterVolumePeriod="day"|"week"|"month"|"allTime";
export type LighterPublicAnalytics={
  volumeUsd:number;
  buckets:readonly {time:number;volumeUsd:number}[];
  tradePnlSeries:readonly {time:number;value:number}[];
  accountCount:number;
};
const numeric=(n:unknown):number|null=>{
  if(typeof n!=="number"&&typeof n!=="string")return null;
  if(typeof n==="string"&&!n.trim())return null;
  const x=Number(n);
  return Number.isFinite(x)?x:null;
};

export async function getLighterPublicAnalytics(
  walletAddress:string,period:LighterVolumePeriod,signal?:AbortSignal
):Promise<LighterPublicAnalytics>{
  if(!/^0x[a-fA-F0-9]{40}$/.test(walletAddress))
    throw new Error("Connect a valid L1 wallet to load Lighter analytics.");
  const indexes=await getLighterAccountIndexes(walletAddress,signal);
  if(indexes.length===0)return {volumeUsd:0,buckets:[],tradePnlSeries:[],accountCount:0};
  const end=Math.floor(Date.now()/1000);
  const seconds=period==="day"?86400:period==="week"?7*86400:
    period==="month"?30*86400:null;
  const from=seconds===null?1737072000:end-seconds;
  const resolution=period==="day"||period==="week"?"1h":"1d";
  const data=await Promise.all(indexes.map(async index=>{
    const query=new URLSearchParams({
      by:"index",value:String(index),resolution,
      start_timestamp:String(from),end_timestamp:String(end),
      count_back:"0",ignore_transfers:"false",
    });
    const result=await lighterPublicGet("/api/v1/pnl?"+query.toString(),signal);
    if(!Array.isArray(result.pnl))throw new Error("Lighter did not return verified PnL series for account "+index);
    const observations=new Map<number,{volume:number;pnl:number|null}>();
    for(const entry of result.pnl){
      if(!entry || typeof entry!=="object")continue;
      const row=entry as Record<string,unknown>;
      const rawTime=numeric(row.timestamp);
      const t=rawTime===null?null:(rawTime>1e11?rawTime:rawTime*1000);
      if(t===null||!Number.isFinite(t)||t<from*1000||t>end*1000)continue;
      const volume=numeric(row.volume);
      if(volume===null||volume<0)
        throw new Error("Lighter volume bucket is missing or invalid for account "+index);
      observations.set(t,{volume,pnl:numeric(row.trade_pnl)});
    }
    return observations;
  }));
  if(data.some(observations=>observations.size===0))
    throw new Error("Lighter returned no verifiable volume observations for this period.");
  const combined=new Map<number,number>();
  for(const observations of data){
    for(const [t,row] of observations)combined.set(t,(combined.get(t)??0)+row.volume);
  }
  const buckets=[...combined].map(([time,volumeUsd])=>({time,volumeUsd})).sort((a,b)=>a.time-b.time);
  const completeTradePnlTimes=[...data[0].keys()].filter(t=>data.every(map=>map.get(t)?.pnl!==null&&
    map.get(t)?.pnl!==undefined));
  const tradePnlSeries=completeTradePnlTimes.map(time=>({
    time,value:data.reduce((sum,map)=>sum+(map.get(time)?.pnl??0),0),
  })).sort((a,b)=>a.time-b.time);
  return {
    volumeUsd:buckets.reduce((sum,row)=>sum+row.volumeUsd,0),
    buckets,tradePnlSeries,accountCount:indexes.length,
  };
}
