import React from "react";
/** Exactly one original compact order-summary UI.
 * Callers must pass authoritative values, or an em dash for missing data.
 */
export default function HideDexOrderSummary(p:{
 isPerp:boolean;
 liquidation:string;
 /** Optional truthful qualifier when showing an existing position, not a future-order estimate. */
 liquidationLabel?:string;
 orderValue:string;
 margin:string;
}){
 return <div className="bg-brand-bg/50 border border-brand-border rounded-lg p-1.5 text-[9px] md:text-[10px] font-mono space-y-0.5 mt-auto">
   {p.isPerp&&<div className="flex justify-between text-gray-500 font-bold">
     <span>{p.liquidationLabel??"Liq. Price"}</span><span className="text-gray-300 font-semibold">{p.liquidation}</span>
   </div>}
   <div className="flex justify-between text-gray-500 font-bold">
     <span>Order Value</span><span className="text-gray-300 font-semibold">{p.orderValue}</span>
   </div>
   {p.isPerp&&<div className="flex justify-between text-gray-500 font-bold">
     <span>Margin</span><span className="text-gray-300 font-semibold">{p.margin}</span>
   </div>}
 </div>;
}
