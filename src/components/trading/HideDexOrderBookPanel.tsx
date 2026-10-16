import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type HideDexBookLevel = {price:number;size:number;total:number};
export interface HideDexOrderBookPanelProps {
 asks: readonly HideDexBookLevel[];
 bids: readonly HideDexBookLevel[];
 midPrice: number | null | undefined;
 midLabel: string;
 sizeUnit: "USD" | "COIN";
 baseSymbol: string;
 onToggleSizeUnit: () => void;
 onSelectPrice: (price:number) => void;
 formatPrice: (price:number) => string;
 formatMidPrice?: (price:number) => string;
 formatSize: (price:number,size:number) => string;
 asksContainerRef?: React.Ref<HTMLDivElement>;
 group: string;
 groupOptions: readonly string[];
 onGroup: (group:string) => void;
 flashingPrices?: Record<string, "BUY"|"SELL"|string>;
 shrinkOnTpSl?: boolean;
}
/** One original HideDex two-column depth ladder for both venues.
 * All quantities/prices and click handlers come from the selected exchange.
 */
export default function HideDexOrderBookPanel(props:HideDexOrderBookPanelProps) {
 const [showGroup,setShowGroup]=useState(false);
 const rootRef=useRef<HTMLDivElement>(null);
 const maxTotal=Math.max(1,props.asks[props.asks.length-1]?.total||0,
   props.bids[props.bids.length-1]?.total||0,10);
 const displayRows=(rows:readonly HideDexBookLevel[],side:"BUY"|"SELL")=>
   <div className="space-y-0.5 w-full">
     {rows.map((row,idx) => {
       const depthPercent=Math.min(100,Math.max(8,(row.total/maxTotal)*100));
       const isFlashing=props.flashingPrices?.[row.price.toString()]===side;
       const isBuy=side==="BUY";
       return <button key={side+"-"+row.price+"-"+idx} type="button"
         onClick={()=>props.onSelectPrice(row.price)}
         className={`w-full grid grid-cols-2 text-[9px] md:text-[11px] font-mono py-0.5 rounded transition-all text-left relative overflow-hidden group ${isBuy?"hover:bg-emerald-500/10":"hover:bg-rose-500/10"} ${isFlashing?(isBuy?"bg-emerald-500/30 text-emerald-300 font-extrabold ring-1 ring-emerald-500/50":"bg-rose-500/30 text-rose-300 font-extrabold ring-1 ring-rose-500/50"):""}`}>
         <div aria-hidden="true" className={`absolute right-0 top-0 bottom-0 border-l-2 pointer-events-none rounded-r ${isBuy?"bg-[#18c29c]/25 border-[#18c29c]/40 group-hover:bg-[#18c29c]/35":"bg-[#e2445c]/25 border-[#e2445c]/40 group-hover:bg-[#e2445c]/35"}`}
           style={{width:depthPercent+"%"}}/>
         <span className={`font-bold z-10 pl-0.5 ${isBuy?"text-[#18c29c]":"text-[#ff4d4d]"}`}>{props.formatPrice(row.price)}</span>
         <span className="text-right text-gray-200 font-semibold z-10 pr-0.5 truncate">{props.formatSize(row.price,row.size)}</span>
       </button>;
     })}
   </div>;
 return <div ref={rootRef} id="terminal-order-book"
   className={`col-span-5 bg-brand-bg border border-brand-border rounded-xl p-1.5 md:p-2.5 flex flex-col justify-between shadow-lg relative ${props.shrinkOnTpSl?"self-start h-auto md:self-stretch md:h-full":"h-full"}`}>
   <div className={`flex flex-col min-h-0 overflow-hidden ${props.shrinkOnTpSl?"h-auto md:flex-grow md:h-full":"flex-grow h-full"}`}>
     <div className="grid grid-cols-2 text-[8px] md:text-[10px] font-sans font-black uppercase tracking-wider text-gray-500 border-b border-brand-border pb-1 md:pb-1.5 mb-1 md:mb-1.5 flex-shrink-0 items-center">
       <span>Price</span>
       <button type="button" onClick={props.onToggleSizeUnit}
         className="text-right hover:text-brand-text transition-colors flex items-center justify-end gap-0.5 cursor-pointer select-none"
         title="Toggle Size in USD / Coins">
         <span>Size</span>
         <span className="text-[7px] md:text-[8px] font-mono text-cyan-400 bg-cyan-500/10 px-1 rounded border border-cyan-500/30">
           {props.sizeUnit==="USD" ? "$" : props.baseSymbol}
         </span>
       </button>
     </div>
     <div ref={props.asksContainerRef} className="flex-1 flex flex-col justify-end overflow-hidden min-h-0 pr-0.5" id="orderbook-asks-container">
       {displayRows(props.asks,"SELL")}
     </div>
     <div className="border-y border-brand-border py-1 my-0.5 text-center flex flex-col items-center justify-center bg-brand-bg/50 rounded-lg flex-shrink-0" id="orderbook-spread-row">
       <span className="font-mono font-bold text-xs md:text-base text-[#18c29c] leading-none">
         {props.midPrice != null && props.midPrice>0 ? "$"+(props.formatMidPrice?.(props.midPrice) ?? props.formatPrice(props.midPrice)) : "--"}
       </span>
       <span className="text-[7px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{props.midLabel}</span>
     </div>
     <div className="flex-1 flex flex-col justify-start overflow-hidden min-h-0 pr-0.5" id="orderbook-bids-container">
       {displayRows(props.bids,"BUY")}
     </div>
   </div>
   <div className="border-t border-brand-border pt-1 md:pt-2 flex justify-between items-center text-[9px] md:text-xs">
     <span className="text-gray-500 font-bold uppercase tracking-wider">Group</span>
     <div className="relative shrink-0">
       <button type="button" onClick={()=>setShowGroup(v=>!v)} aria-label="Orderbook grouping"
         aria-expanded={showGroup}
         className="flex items-center gap-1 px-1.5 py-0.5 bg-brand-overlay-subtle border border-brand-border rounded text-gray-300 hover:text-brand-text transition-colors font-mono font-bold">
         <span>{props.group}</span><ChevronDown className="w-3 h-3 text-gray-500"/>
       </button>
       {showGroup && <div className="absolute right-0 bottom-full mb-1 w-20 bg-brand-bg border border-brand-border rounded-lg shadow-xl z-30 p-0.5">
         {props.groupOptions.map(option=><button key={option} type="button"
           onClick={()=>{props.onGroup(option);setShowGroup(false);}}
           className={`w-full text-left px-1.5 py-1 text-[9px] rounded font-mono font-bold ${props.group===option?"text-cyan-400 bg-brand-overlay-normal":"text-gray-400 hover:text-brand-text"}`}>{option}</button>)}
       </div>}
     </div>
   </div>
 </div>;
}
