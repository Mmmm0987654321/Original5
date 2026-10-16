import React from "react";
import { Layers, Trash2 } from "lucide-react";
export type HideDexOpenOrderRow = {
 id:string; symbol:string; isSpot:boolean; side:"BUY"|"SELL";
 orderType:string; priceLabel:string; trigger:boolean; sizeLabel:string;
 filledLabel:string; remainingLabel:string; status:string; timestamp:string;
 canCancel:boolean;
};
export default function HideDexOpenOrders({
 orders,onCancel,unavailableMessage,emptyMessage
}:{
 orders:readonly HideDexOpenOrderRow[]|null;
 onCancel:(order:HideDexOpenOrderRow)=>void;
 unavailableMessage?:string;
 emptyMessage?:string;
}){
 if(!orders?.length) return <div className="flex flex-col items-center justify-center py-6 text-gray-500 text-center">
   <Layers className="w-6 h-6 text-brand-text/5 mb-1"/>
   <p className="text-[10px]">{orders===null ? (unavailableMessage??"Open orders not loaded.") : (emptyMessage??"No open limit orders pending.")}</p>
 </div>;
 return <>
   <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
     {orders.map(ord=><div key={ord.id} className="bg-brand-card border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 shadow-md text-brand-sub">
       <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2">
         <div className="flex items-center gap-2">
           <span className="font-bold text-[12px] text-brand-text">{ord.symbol}{ord.isSpot?"-SPOT":"-PERP"}</span>
           <span className={`px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider ${ord.side==="BUY"?
             "bg-brand-profit/10 text-brand-profit border border-brand-profit/20":"bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>{ord.side}</span>
           <span className="text-[9px] text-brand-muted font-bold bg-brand-overlay-subtle px-1.5 py-0.2 rounded border border-brand-border/30">{ord.orderType}</span>
         </div>
         <button type="button" onClick={()=>onCancel(ord)} disabled={!ord.canCancel}
           className="p-1 rounded text-brand-muted hover:text-brand-loss hover:bg-brand-loss/10 transition-colors cursor-pointer disabled:opacity-30" title="Cancel Order">
           <Trash2 className="w-3.5 h-3.5"/>
         </button>
       </div>
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-brand-sub font-mono">
         {[
           [ord.trigger?"Trigger Price":"Price",ord.priceLabel],
           ["Size",ord.sizeLabel],
           ["Filled / Remaining",ord.filledLabel+" / "+ord.remainingLabel],
           ["Time / Status",ord.timestamp+" · "+ord.status],
         ].map(([label,value])=><div key={label}>
           <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">{label}</span>
           <span className="font-semibold text-brand-text">{value}</span>
         </div>)}
       </div>
     </div>)}
   </div>
   <div className="hidden md:block max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent">
     <table className="w-full text-left border-collapse text-xs font-mono">
       <thead><tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
         {["Symbol","Side","Order Type","Price","Size","Filled %","Remaining","Status","Time","Actions"].map(label=>
           <th key={label} className={`py-2.5 ${label==="Actions"?"text-right":""}`}>{label}</th>)}
       </tr></thead>
       <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
         {orders.map(ord=><tr key={ord.id} className="hover:bg-brand-overlay-subtle transition-colors">
           <td className="py-2.5 font-bold text-brand-text">{ord.symbol}{ord.isSpot?"-SPOT":"-PERP"}</td>
           <td className="py-2.5">{ord.side}</td>
           <td className="py-2.5">{ord.orderType}</td>
           <td className="py-2.5 font-semibold text-brand-text">{ord.priceLabel}
             {ord.trigger && <span className="text-violet-400 text-[8px] ml-1">Trigger</span>}</td>
           <td className="py-2.5">{ord.sizeLabel}</td>
           <td className="py-2.5">{ord.filledLabel}</td>
           <td className="py-2.5">{ord.remainingLabel}</td>
           <td className="py-2.5 text-cyan-400">{ord.status}</td>
           <td className="py-2.5 text-brand-muted">{ord.timestamp}</td>
           <td className="py-2.5 text-right"><button type="button" onClick={()=>onCancel(ord)}
             disabled={!ord.canCancel} title="Cancel Order"
             className="p-1 rounded text-brand-muted hover:text-brand-loss hover:bg-brand-loss/10 disabled:opacity-30">
             <Trash2 className="w-3.5 h-3.5 inline"/></button></td>
         </tr>)}
       </tbody>
     </table>
   </div>
 </>;
}
