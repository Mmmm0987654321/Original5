import React from "react";
/** Single original action footer for positions on every exchange.
 * Trading mutations are supplied by the venue and are never mixed here.
 */
export default function HideDexPositionActions(p:{
 onTpSl:()=>void;
 onClose:()=>void;
 tpSlDisabled?:boolean;
 closeDisabled?:boolean;
}){
 return <>
   <button type="button" onClick={p.onTpSl} disabled={p.tpSlDisabled}
     className="w-full h-8 px-1 rounded-lg border bg-brand-overlay-subtle hover:bg-brand-overlay-normal border-brand-primary/30 hover:border-brand-primary/50 text-brand-primary text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-95 select-none disabled:opacity-40">
     TP/SL
   </button>
   <button type="button" onClick={p.onClose} disabled={p.closeDisabled}
     className="w-full h-8 px-1 rounded-lg border bg-brand-loss/10 hover:bg-brand-loss/20 border-brand-loss/30 hover:border-brand-loss/50 text-brand-loss text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 select-none disabled:opacity-40">
     Close
   </button>
 </>;
}
