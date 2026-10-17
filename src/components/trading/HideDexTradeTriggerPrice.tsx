import React from "react";
/** Original HideDex TP/SL price field. The venue owns all trigger validation
 * and order submission; this component only renders the same input.
 */
export default function HideDexTradeTriggerPrice(p:{
 kind:"tp"|"sl";value:string;
 onChange:(e:React.ChangeEvent<HTMLInputElement>)=>void;
 disabled?:boolean;
}){
 return <input
   type="number" step="any" inputMode="decimal" min="0"
   aria-label={p.kind==="tp"?"Take Profit trigger price":"Stop Loss trigger price"}
   value={p.value} onChange={p.onChange} disabled={p.disabled}
   className={`w-full h-[34px] md:h-[38px] bg-brand-surface border border-brand-border px-3 rounded-[10px] text-xs text-brand-text font-mono focus:outline-none transition-all placeholder:text-brand-muted placeholder:font-semibold placeholder:font-sans disabled:opacity-40 ${p.kind==="tp"?"focus:border-[#18c29c]/60":"focus:border-rose-500/50"}`}
   placeholder={p.kind==="tp"?"TP Price":"SL Price"}/>;
}
