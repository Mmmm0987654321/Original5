import React from "react";
import { Layers } from "lucide-react";
export interface HideDexHistoryRow {
 id:string; symbol:string; side:"BUY"|"SELL"; isSpot:boolean;
 price:number; size:number; value:number;
 realizedPnl?:number|null; roi?:number|null; fee?:number|null; timestamp:string;
}
interface Props { items:readonly HideDexHistoryRow[] | null; noDataMessage?:string; }
/** Original responsive HideDex trade-history card/table presentation for both venues.
 * null items means records were never verified/loaded (not zero trades).
 */
export default function HideDexTradeHistory({items,noDataMessage}:Props){
 if(!items?.length) return <div className="flex flex-col items-center justify-center py-8 text-brand-muted text-center">
   <Layers className="w-6 h-6 text-brand-text/5 mb-2"/>
   <p className="text-xs font-mono font-medium text-brand-sub">
     {noDataMessage??(items===null?"Trade history not loaded for this exchange.":"No historical trades found for this address.")}
   </p>
 </div>;
 const price=(n:number)=>"$"+n.toLocaleString(undefined,{minimumFractionDigits:1});
 const pnl=(n:number|null|undefined)=>n!=null&&Number.isFinite(n)&&n!==0?(n>=0?"+$":"-$")+Math.abs(n).toFixed(2):"—";
 const roi=(n:number|null|undefined)=>n!=null&&Number.isFinite(n)&&n!==0?(n>=0?"+":"")+n.toFixed(1)+"%":"—";
 const fee=(n:number|null|undefined)=>n!=null&&Number.isFinite(n)?"$"+n.toFixed(4):"—";
 const rows=items.slice(0,15);
 return <>
   <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
     {rows.map(hist=><div key={hist.id}
       className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 shadow-md text-brand-sub">
       <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2">
         <div className="flex items-center gap-2">
           <span className="font-bold text-[12px] text-brand-text">{hist.symbol}-{hist.isSpot?"SPOT":"PERP"}</span>
           <span className={`px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider ${hist.side==="BUY"?
             "bg-brand-profit/10 text-brand-profit border border-brand-profit/20":"bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>{hist.side}</span>
           <span className="text-[8px] text-brand-muted font-bold font-mono">ID: {hist.id.slice(0,6)}</span>
         </div>
         {hist.realizedPnl!=null && hist.realizedPnl!==0 && <div className="text-right font-mono">
           <span className={`text-[11px] font-bold block ${hist.realizedPnl>=0?"text-pnl-profit":"text-pnl-loss"}`}>{pnl(hist.realizedPnl)}</span>
           <span className={`text-[8px] font-bold block ${hist.roi!=null&&hist.roi>=0?"text-pnl-profit":"text-pnl-loss"}`}>ROI: {roi(hist.roi)}</span>
         </div>}
       </div>
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-brand-sub font-mono">
         {[
           ["Price",price(hist.price)],
           ["Size / Value",hist.size+" "+hist.symbol+" ("+price(hist.value)+")"],
           ["Fees Paid",fee(hist.fee)],
           ["Executed At",hist.timestamp],
         ].map(([title,value])=><div key={title}>
           <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">{title}</span>
           <span className={`font-semibold ${title==="Fees Paid"?"text-brand-loss/80":title==="Executed At"?"text-brand-sub":"text-brand-text"}`}>{title==="Fees Paid"&&value!=="—"?value+" USDC":value}</span>
         </div>)}
       </div>
     </div>)}
   </div>
   <div className="hidden md:block max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent">
     <table className="w-full text-left border-collapse text-xs font-mono">
       <thead><tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
         {["ID","Symbol","Direction","Size","Price","Value","Realized PnL","ROI","Fees","Time"].map(name=>
           <th key={name} className={"py-2.5 "+(name==="Time"?"text-right":"")}>{name}</th>)}
       </tr></thead>
       <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
         {rows.map(hist=><tr key={hist.id} className="hover:bg-brand-overlay-subtle transition-colors">
           <td className="py-2.5 text-[10px] text-brand-muted">#{hist.id.slice(0,6)}</td>
           <td className="py-2.5 font-bold text-brand-text">{hist.symbol}-{hist.isSpot?"SPOT":"PERP"}</td>
           <td className="py-2.5"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${hist.side==="BUY"?"bg-brand-profit/10 text-brand-profit border border-brand-profit/20":"bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>{hist.side}</span></td>
           <td className="py-2.5">{hist.size} {hist.symbol}</td>
           <td className="py-2.5 font-semibold">{price(hist.price)}</td>
           <td className="py-2.5">{price(hist.value)}</td>
           <td className={`py-2.5 font-bold ${hist.realizedPnl!=null&&hist.realizedPnl>0?"text-pnl-profit":hist.realizedPnl!=null&&hist.realizedPnl<0?"text-pnl-loss":"text-brand-muted"}`}>{pnl(hist.realizedPnl)}</td>
           <td className={`py-2.5 font-bold ${hist.roi!=null&&hist.roi>0?"text-pnl-profit":hist.roi!=null&&hist.roi<0?"text-pnl-loss":"text-brand-muted"}`}>{roi(hist.roi)}</td>
           <td className="py-2.5 text-brand-loss/80">{fee(hist.fee)}</td>
           <td className="py-2.5 text-right text-brand-muted">{hist.timestamp}</td>
         </tr>)}
       </tbody>
     </table>
   </div>
 </>;
}
