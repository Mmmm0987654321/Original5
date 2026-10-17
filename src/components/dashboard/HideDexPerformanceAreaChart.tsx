import React from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { EyeOff, TrendingUp } from "lucide-react";
import type { HideDexPerformancePeriod } from "./HideDexFundsPerformance";

type Point={timestamp:number;value:number};
type Props={
  period:HideDexPerformancePeriod;
  data:readonly Point[];
  label:string;
  hidden?:boolean;
  loading?:boolean;
  emptyMessage?:string;
};
/** Same HideDex Funds area-graph geometry and tooltip as PortfolioPanel.
 * Content (trading PnL vs equity) is labeled by the verified venue adapter.
 */
export default function HideDexPerformanceAreaChart({
  period,data,label,hidden=false,loading=false,emptyMessage,
}:Props){
  if(hidden||data.length<2) return (
    <div className="h-[180px] sm:h-[220px] w-full rounded-xl bg-brand-overlay-subtle/50 border border-brand-border/40 flex flex-col items-center justify-center text-center p-4">
      {hidden?<EyeOff className="w-6 h-6 text-brand-muted mb-2"/>:
        <TrendingUp className="w-6 h-6 text-brand-muted/60 mb-2"/>}
      <span className="text-xs font-semibold text-brand-muted">
        {hidden?"Performance hidden":loading?"Loading performance history…":
          emptyMessage??"No verified performance history yet"}
      </span>
    </div>
  );
  return <div className="h-[180px] sm:h-[220px] w-full select-none funds-performance-chart"
      style={{WebkitTapHighlightColor:"transparent"}}>
    <style>{`
      #performance-section .funds-performance-chart .recharts-wrapper:focus,
      #performance-section .funds-performance-chart .recharts-surface:focus,
      #performance-section .funds-performance-chart .recharts-wrapper *:focus {
        outline:none !important;
        -webkit-tap-highlight-color:transparent;
      }
    `}</style>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart accessibilityLayer={false} data={[...data]}
        margin={{top:10,right:10,left:-20,bottom:0}}>
        <XAxis dataKey="timestamp"
          tickFormatter={(ts:number)=>{
            const date=new Date(ts);
            if(!Number.isFinite(date.getTime()))return "";
            if(period==="day")return date.toLocaleTimeString(undefined,{
              hour:"2-digit",minute:"2-digit",hour12:false,
            });
            if(period==="week"||period==="month")return date.toLocaleDateString(undefined,{
              month:"short",day:"numeric",
            });
            return date.toLocaleDateString(undefined,{month:"short",year:"2-digit"});
          }}
          tick={{fontSize:9,fill:"var(--text-muted)"}} tickLine={false}
          axisLine={{stroke:"var(--divider-brand)"}} minTickGap={25}/>
        <YAxis domain={["auto","auto"]}
          tickFormatter={(val:number)=>{
            if(Math.abs(val)>=1_000_000)return "$"+(val/1_000_000).toFixed(1)+"M";
            if(Math.abs(val)>=1_000)return "$"+(val/1_000).toFixed(1)+"k";
            return "$"+val.toFixed(0);
          }}
          tick={{fontSize:9,fill:"var(--text-muted)"}} tickLine={false}
          axisLine={false} width={50}/>
        <Tooltip content={({active,payload}:any)=>{
          if(!active||!payload?.length)return null;
          const point=payload[0]?.payload as Point|undefined;
          if(!point||!Number.isFinite(point.value))return null;
          return <div className="bg-brand-surface/95 border border-brand-border/80 backdrop-blur-md rounded-xl p-2.5 shadow-xl text-xs space-y-1">
            <div className="text-[10px] text-brand-muted font-mono">
              {new Date(point.timestamp).toLocaleString(undefined,{
                month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-brand-sub text-[11px]">{label}:</span>
              <span className="font-mono font-bold text-brand-text text-xs">
                {"$"+point.value.toLocaleString(undefined,{
                  minimumFractionDigits:2,maximumFractionDigits:2,
                })}
              </span>
            </div>
          </div>;
        }}/>
        <Area type="monotone" dataKey="value"
          stroke="var(--accent-primary)" strokeWidth={2}
          fill="var(--accent-primary)" fillOpacity={0.12}
          isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
