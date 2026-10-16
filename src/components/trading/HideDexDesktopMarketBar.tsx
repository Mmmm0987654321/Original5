import React from "react";
import { ChevronDown } from "lucide-react";

type HideDexDesktopMarketBarProps = {
  logo:React.ReactNode; ticker:string; sublabel:string;
  onMarket:()=>void; view:"chart"|"orderbook";
  onView:(mode:"chart"|"orderbook")=>void;
  marketInfoOpen:boolean; onMarketInfo:()=>void;
  rightAddon?:React.ReactNode;
};
/** Extracted exact original market-bar presentation: venue handlers remain separate. */
export default function HideDexDesktopMarketBar(p:HideDexDesktopMarketBarProps){
 return <div className="flex flex-nowrap items-stretch justify-between gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-none">
   <div className="relative shrink-0 flex items-stretch">
     <button type="button" data-terminal-token-trigger="true" onClick={p.onMarket}
       className="h-11 sm:h-12 flex items-center gap-1.5 sm:gap-2.5 bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border px-2 sm:px-3 rounded-lg cursor-pointer transition-all select-none whitespace-nowrap"
       id="token-selector-trigger">
       <div className="shrink-0">{p.logo}</div>
       <div className="text-left">
         <div className="flex items-center gap-1 sm:gap-1.5">
           <span className="font-display font-bold text-brand-text text-xs sm:text-sm tracking-tight uppercase leading-none">{p.ticker}</span>
           <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400"/>
         </div>
         <span className="text-[7px] sm:text-[8px] text-accent font-mono font-bold uppercase tracking-wider block leading-none mt-0.5">{p.sublabel}</span>
       </div>
     </button>
   </div>
   <div className="h-11 sm:h-12 flex items-stretch bg-brand-surface p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-brand-border select-none shrink-0"
     id="trading-view-mode-tabs">
     {(["chart","orderbook"] as const).map(mode=><button type="button" key={mode}
       onClick={()=>p.onView(mode)}
       className={`h-full flex items-center justify-center px-2.5 sm:px-4 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${p.view===mode?"bg-accent text-brand-bg font-black shadow-sm":"text-brand-text hover:bg-brand-overlay-subtle"}`}>
       {mode==="chart"?"CHART":"ORDER BOOK"}
     </button>)}
   </div>
   <div className="flex items-stretch gap-1.5 sm:gap-2 select-none shrink-0">
     <button type="button" onClick={p.onMarketInfo}
       className="h-11 sm:h-12 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 text-[9px] sm:text-xs font-bold text-brand-text bg-brand-surface hover:bg-brand-overlay-subtle rounded-lg border border-brand-border transition-all select-none uppercase tracking-wider cursor-pointer shadow-sm whitespace-nowrap"
       id="market-info-toggle-btn">
       {p.marketInfoOpen?"▲":"▼"} Market Info
     </button>
     {p.rightAddon}
   </div>
 </div>;
}
