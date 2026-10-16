import React from "react";
export type HideDexPerformancePeriod = "day"|"week"|"month"|"allTime";
export type HideDexPerformanceMarket = "all"|"spot"|"perps";
interface Props {
 period:HideDexPerformancePeriod;
 onPeriod:(v:HideDexPerformancePeriod)=>void;
 market:HideDexPerformanceMarket;
 onMarket:(v:HideDexPerformanceMarket)=>void;
 summary:React.ReactNode;
 chart:React.ReactNode;
}
/** The original Funds Analytics period/filter/summary/chart container.
 * Source data and its verification remain completely venue-specific.
 */
export default function HideDexFundsPerformance(p:Props){
 return <div className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs" id="performance-section">
   <h2 className="text-brand-text text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">Performance Analytics &amp; Fees</h2>
   <div className="flex items-center gap-1 mb-3 w-full min-w-0">
     <div className="flex flex-1 min-w-0 items-center justify-between gap-0.5 bg-brand-overlay-subtle p-0.5 rounded-lg border border-brand-border/40">
       {([{id:"day",label:"24H"},{id:"week",label:"7D"},{id:"month",label:"30D"},{id:"allTime",label:"All Time"}] as const).map(item=>
         <button type="button" key={item.id} onClick={()=>p.onPeriod(item.id)}
           className={`min-w-0 px-1 py-1 sm:px-2 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${p.period===item.id
             ?"bg-brand-surface text-brand-text shadow-xs border border-brand-border/60":"text-brand-muted hover:text-brand-text"}`}>
           {item.label}
         </button>)}
     </div>
     <select aria-label="Market type" value={p.market} onChange={e=>p.onMarket(e.target.value as HideDexPerformanceMarket)}
       className="shrink-0 w-[108px] sm:w-[128px] min-w-0 py-1.5 px-1 sm:px-2 rounded-lg border border-brand-border/60 bg-brand-overlay-subtle text-brand-text text-[10px] sm:text-xs font-bold cursor-pointer">
       <option value="all">Spot + Perps</option><option value="spot">Spot</option><option value="perps">Perps</option>
     </select>
   </div>
   {p.summary}
   <div className="mt-3 w-full">{p.chart}</div>
 </div>;
}
