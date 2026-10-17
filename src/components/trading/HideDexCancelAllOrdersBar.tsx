import React from "react";
/** Original HideDex Open Orders Cancel All action row, shared by both exchanges.
 * The venue caller retains its own confirmation and signed cancellation logic.
 */
export default function HideDexCancelAllOrdersBar(p:{onCancelAll:()=>void;disabled?:boolean}){
 return <div className="flex items-center justify-end px-2.5 py-1.5 bg-brand-bg/50 border-b border-brand-border text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider relative">
   <button type="button" onClick={p.onCancelAll} disabled={p.disabled}
     className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-40">
     Cancel All
   </button>
 </div>;
}
