import React from "react";
/** Original HideDex Market Info popup. All prices/metrics are obtained only
 * from the selected venue; missing metrics remain unavailable.
 */
export default function HideDexMarketInfoDropdown(p:{
 ticker:string;mode:"spot"|"perp";priceLabel:string;
 change24h:number|null|undefined;
 fundingRate?:number|null;
 openInterestUsd?:number|null;
 badge?:React.ReactNode;
 onSwitch?:()=>void;
}){
 const isPerp=p.mode==="perp";
 const change=p.change24h;
 const knownChange=typeof change==="number" && Number.isFinite(change);
 const funding=p.fundingRate;
 const knownFunding=typeof funding==="number" && Number.isFinite(funding);
 const openInterest=p.openInterestUsd;
 const knownOI=typeof openInterest==="number" && Number.isFinite(openInterest);
 return <div data-market-info-dropdown="true" id="market-info-dropdown"
   className="absolute top-full mt-2 left-2 right-2 sm:left-auto sm:right-2 sm:w-80 max-w-[calc(100vw-24px)] bg-brand-surface border border-brand-border rounded-xl shadow-2xl z-[80] p-3.5 space-y-3">
   <div className="flex items-center justify-between border-b border-brand-border pb-1.5">
     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-sans">{p.ticker||"--"} Market Metrics</span>
     {p.badge ?? (p.onSwitch ? <button type="button" onClick={p.onSwitch}
       className="px-2 py-0.5 rounded bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border text-[9px] font-mono font-bold text-brand-text transition-colors">
       {isPerp?"PERP → Switch Spot":"SPOT → Switch Perp"}
     </button> : <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-bold uppercase">
       {isPerp?"PERP":"SPOT"}
     </span>)}
   </div>
   <div className="flex flex-col items-start gap-3 font-mono text-xs">
     <div className="border-b border-brand-border/20 pb-1.5">
       <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">Mark Price</span>
       <span className="text-emerald-400 font-extrabold text-sm block mt-0.5">{p.priceLabel}</span>
     </div>
     <div className="border-b border-brand-border/20 pb-1.5">
       <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">24H Change</span>
       <span className={"text-xs font-extrabold block mt-1 leading-none "+(knownChange ? change>=0?"text-emerald-400":"text-rose-400":"text-gray-400")}>
         {knownChange?(change>=0?"+":"")+change.toFixed(2)+"%":"—"}
       </span>
     </div>
     {isPerp && <div>
       <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">Funding Rate</span>
       <span className={"font-bold block mt-0.5 text-xs "+(knownFunding?funding>=0?"text-violet-400":"text-rose-400":"text-gray-400")}>
         {knownFunding?(funding>=0?"+":"")+funding.toFixed(4)+"%":"—"}
       </span>
     </div>}
     {isPerp && <div className="w-full border-t border-brand-border/20 pt-2">
       <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">Open Interest</span>
       <span className="text-indigo-400 font-bold block mt-0.5">
         {knownOI?"$"+(openInterest/1_000_000).toFixed(1)+"M":"—"}
       </span>
     </div>}
   </div>
 </div>;
}
