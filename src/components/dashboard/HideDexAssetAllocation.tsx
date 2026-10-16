import React from "react";
import { Coins } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
export type AllocationRow = {
 label:string; amount:React.ReactNode; percentage?:number|null;
 color:string; logo?:React.ReactNode;
};
export interface HideDexAssetAllocationProps {
 rows:readonly AllocationRow[];
 chartValues?:readonly {value:number;color:string}[];
 totalLabel:string;
 totalValue:React.ReactNode;
 totalUnit?:string;
 footnote?:React.ReactNode;
}
/** Original Funds asset-allocation layout; never infers missing USD valuations. */
export default function HideDexAssetAllocation(p:HideDexAssetAllocationProps){
 const chart=(p.chartValues??[]).filter(x=>Number.isFinite(x.value)&&x.value>0);
 return <div className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs" id="asset-allocation-section">
   <div className="flex items-center justify-between mb-2.5 sm:mb-3">
     <h3 className="text-brand-text text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
       <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent"/>Asset Allocation
     </h3>
   </div>
   <div className="grid grid-cols-[100px_minmax(0,1fr)] sm:grid-cols-[125px_minmax(0,1fr)] gap-3 sm:gap-6 items-center">
     <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] relative flex items-center justify-center shrink-0 select-none">
       {chart.length>0 ?
         <ResponsiveContainer width="100%" height="100%">
           <PieChart><Pie data={chart} cx="50%" cy="50%" innerRadius={36} outerRadius={48}
             paddingAngle={chart.length>1?2:0} dataKey="value" strokeWidth={0}>
             {chart.map((entry,index)=><Cell key={index} fill={entry.color}/>)}
           </Pie></PieChart>
         </ResponsiveContainer> :
         <div className="w-[96px] h-[96px] sm:w-[110px] sm:h-[110px] rounded-full border-4 border-brand-border/40"/>}
       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
         <span className="text-[7px] sm:text-[8px] text-brand-muted font-bold uppercase tracking-wider">{p.totalLabel}</span>
         <span className="text-[11px] sm:text-xs font-black text-brand-text font-mono truncate max-w-[85px]">{p.totalValue}</span>
         <span className="text-[7px] sm:text-[8px] text-brand-muted font-mono font-bold">{p.totalUnit??"USDC"}</span>
       </div>
     </div>
     <div className="flex-1 w-full space-y-1.5 sm:space-y-2 font-mono text-[11px] sm:text-xs min-w-0">
       {p.rows.map((row,i)=><div key={i} className="flex items-center justify-between py-1 border-b border-brand-border/20 last:border-b-0">
         <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
           {row.logo??<span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:row.color}}/>}
           <span className="text-brand-sub font-sans text-[11px] sm:text-xs truncate">{row.label}</span>
         </div>
         <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
           <span className="font-bold text-brand-text text-[11px] sm:text-xs">{row.amount}</span>
           <span className="w-10 sm:w-12 text-right text-brand-muted font-semibold text-[10px] sm:text-xs">
             {row.percentage==null?"--%":row.percentage.toFixed(1)+"%"}
           </span>
         </div>
       </div>)}
     </div>
   </div>
   {p.footnote && <p className="pt-2 text-[10px] leading-relaxed text-brand-muted">{p.footnote}</p>}
 </div>;
}
