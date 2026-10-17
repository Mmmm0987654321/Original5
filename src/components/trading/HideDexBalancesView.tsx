import React from "react";
export type HideDexBalanceItem = {
 id:string;
 symbol:string;
 name:string;
 total:number|null;
 available:number|null;
 locked:number|null;
 valueUsd:number|null;
 allocationPercent:number|null;
 color?:string;
 canClose?:boolean;
 onClose?:()=>void;
};
const fmt=(n:number|null,max=4):string =>
 n===null || !Number.isFinite(n) ? "—" :
 n.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:max});
/** Exact same original HideDex BALANCES mobile cards + desktop table for both venues.
 * Unknown metrics stay unavailable, never inferred from a different exchange.
 */
export default function HideDexBalancesView({items,unavailableMessage}:{
 items:readonly HideDexBalanceItem[]|null;
 unavailableMessage?:string;
}){
 if(items===null) return <p className="text-xs text-brand-muted py-5 text-center">
   {unavailableMessage??"Verified balances are not loaded for this wallet."}
 </p>;
 if(!items.length) return <p className="text-xs text-brand-muted py-5 text-center">No balances reported for this wallet.</p>;
 const action=(item:HideDexBalanceItem)=>item.canClose && item.onClose ? <button
   type="button" onClick={item.onClose}
   className="px-2.5 py-1 rounded bg-brand-loss/10 hover:bg-brand-loss/20 border border-brand-loss/30 hover:border-brand-loss/50 text-brand-loss text-[9px] font-extrabold uppercase tracking-wider transition-all duration-150 cursor-pointer active:scale-95 select-none">
   Close
 </button> : <span className="text-brand-muted text-[10px]">—</span>;
 return <>
   <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
     {items.map(item=><div key={item.id}
       className="bg-brand-card border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 shadow-md text-brand-sub">
       <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2 gap-2">
         <div className="flex items-center gap-2 min-w-0">
           <div aria-hidden="true"
             className="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
             style={{backgroundColor:item.color??"#2775ca"}}>{item.symbol==="BTC"?"₿":item.symbol==="ETH"?"Ξ":item.symbol.charAt(0)}</div>
           <div className="min-w-0">
             <span className="font-bold text-brand-text text-[12px] block truncate">{item.symbol}</span>
             <span className="text-[9px] text-brand-muted block -mt-1 truncate">{item.name}</span>
           </div>
         </div>
         <div className="text-right shrink-0">
           <div className="text-brand-text font-bold text-[12px]">{item.valueUsd!==null ? "$"+fmt(item.valueUsd,2):"—"}</div>
           <span className="text-[9px] font-bold text-brand-muted bg-brand-overlay-normal px-1.5 rounded border border-brand-border">
             {item.allocationPercent!==null && Number.isFinite(item.allocationPercent) ? item.allocationPercent.toFixed(1)+"% Alloc":"—"}
           </span>
         </div>
       </div>
       <div className="grid grid-cols-3 gap-2 text-[10px] text-brand-sub font-mono">
         {([["Total",item.total],["Available",item.available],["Locked",item.locked]] as const).map(([label,value])=>
           <div key={label}>
             <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">{label}</span>
             <span className={"font-semibold "+(label==="Available"?"text-brand-profit":label==="Locked"?"text-brand-muted":"text-brand-text")}>{fmt(value)}</span>
           </div>)}
       </div>
       {item.canClose && item.onClose && <div className="flex justify-end pt-2 border-t border-brand-divider/20">{action(item)}</div>}
     </div>)}
   </div>
   <div className="hidden md:block max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent">
     <table className="w-full text-left border-collapse text-xs font-mono">
       <thead><tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
         {["Asset","Available Balance","Locked Balance","Total Balance","USD Value","Allocation","Actions"].map(name=>
           <th key={name} className={"py-2.5 "+(name==="Actions"?"text-right":"")}>{name}</th>)}
       </tr></thead>
       <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
         {items.map(item=><tr key={item.id} className="hover:bg-brand-overlay-subtle transition-colors">
           <td className="py-2.5 font-bold text-brand-text">
             <div className="flex items-center gap-2">
               <span className="w-5 h-5 rounded-full shrink-0 text-white font-bold text-xs flex items-center justify-center"
                 style={{backgroundColor:item.color??"#2775ca"}}>{item.symbol.charAt(0)}</span>
               <div><span className="text-brand-text font-bold">{item.symbol}</span>
                 <span className="text-[9px] text-brand-muted block">{item.name}</span></div>
             </div>
           </td>
           <td className="py-2.5 font-semibold text-brand-profit">{fmt(item.available)}</td>
           <td className="py-2.5 font-semibold text-brand-muted">{fmt(item.locked)}</td>
           <td className="py-2.5 font-semibold text-brand-text">{fmt(item.total)}</td>
           <td className="py-2.5 font-bold text-brand-text">{item.valueUsd!==null?"$"+fmt(item.valueUsd,2):"—"}</td>
           <td className="py-2.5 text-brand-muted">{item.allocationPercent!==null&&Number.isFinite(item.allocationPercent)?item.allocationPercent.toFixed(1)+"%":"—"}</td>
           <td className="py-2.5 text-right">{action(item)}</td>
         </tr>)}
       </tbody>
     </table>
   </div>
 </>;
}
