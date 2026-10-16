import React from "react";
import { ChevronDown } from "lucide-react";

/** The original HideDex mobile market header, shared verbatim in structure.
 * Market identity, price and switch targets are passed by the chosen venue.
 */
export interface HideDexMobileMarketHeaderProps {
 logo?:React.ReactNode;
 ticker:string;
 modeLabel:string;
 priceLabel:string;
 change24h:number|null|undefined;
 onSelectMarket:()=>void;
 mode:"spot"|"perp";
 switchMode:"toggle"|"spot-only"|"perp-only";
 onSwitchMode:()=>void;
}
export default function HideDexMobileMarketHeader(p:HideDexMobileMarketHeaderProps) {
 const change=p.change24h;
 return <div
   className="md:hidden bg-brand-bg border border-brand-border rounded-xl p-1.5 mb-1.5 flex items-center justify-between gap-1.5 shadow-xl relative"
   id="terminal-mobile-trade-header">
   <button type="button" data-terminal-token-trigger="true" onClick={p.onSelectMarket}
     className="flex items-center gap-2 min-w-0 cursor-pointer text-left" id="mobile-trade-token-selector-trigger"
     aria-label="Select market">
     <div className="shrink-0">{p.logo}</div>
     <div className="min-w-0">
       <div className="flex items-center gap-1">
         <span className="font-display font-bold text-sm tracking-tight leading-none text-brand-text uppercase truncate">{p.ticker}</span>
         <ChevronDown className="w-3.5 h-3.5 text-brand-muted shrink-0"/>
       </div>
       <div className="mt-0.5 text-[9px] font-semibold tracking-wider leading-none text-accent">{p.modeLabel}</div>
     </div>
   </button>
   <div className="flex flex-col items-center justify-center min-w-0 px-1">
     <span className="font-mono font-bold text-xs text-brand-text leading-none whitespace-nowrap">{p.priceLabel}</span>
     <span className={`text-[9px] font-mono font-semibold mt-0.5 leading-none ${change===null||change===undefined||!Number.isFinite(change)?"text-brand-muted":change>=0?"text-success":"text-danger"}`}>
       {change===null||change===undefined||!Number.isFinite(change)?"--":(change>=0?"+":"")+change.toFixed(2)+"%"}
     </span>
   </div>
   {p.switchMode==="toggle" ?
     <button type="button" id="mobile-trade-spot-perp-toggle" role="switch"
       aria-checked={p.mode==="perp"} aria-label="Switch Spot and Perpetual"
       title={p.mode==="perp"?"Switch to Spot Market":"Switch to Perpetual Market"}
       onClick={p.onSwitchMode}
       className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${p.mode==="perp"?"bg-accent":"bg-brand-overlay-active"}`}>
       <div className={`w-4 h-4 rounded-full bg-brand-bg shadow transform transition-transform duration-200 ${p.mode==="perp"?"translate-x-4":"translate-x-0"}`}/>
     </button> :
     <div className="shrink-0 px-2 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-[9px] font-bold uppercase">
       {p.switchMode==="spot-only"?"SPOT":p.modeLabel}
     </div>}
 </div>;
}
