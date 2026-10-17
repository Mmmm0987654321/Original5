import React from "react";
import {ChevronDown} from "lucide-react";
/** Original4 Gain % / Gain $ and Loss % / Loss $ input, now used by both
 * venues. Pure presentation; never computes or sends a trade or estimated PnL.
 */
export default function HideDexTradeOutcomeInput(p:{
 kind:"tp"|"sl";
 value:string;
 onChange:(value:string)=>void;
 unit:"%"|"$";
 open:boolean;
 onToggle:()=>void;
 onUnit:(unit:"%"|"$")=>void;
 disabled?:boolean;
}) {
 const tp=p.kind==="tp";
 return <div className="relative">
   <div className={`flex h-[34px] md:h-[38px] bg-brand-surface border border-brand-border ${tp?
     "focus-within:border-[#18c29c]/60":"focus-within:border-rose-500/50"
   } rounded-[10px] overflow-hidden transition-all px-3 items-center justify-between`}>
     <input type="number" step="any" inputMode="decimal" value={p.value}
       disabled={p.disabled} onChange={e=>p.onChange(e.target.value)}
       className="w-full min-w-0 bg-transparent text-xs text-brand-text font-mono focus:outline-none placeholder:text-brand-muted placeholder:font-semibold placeholder:font-sans pr-1 disabled:opacity-40"
       aria-label={tp?"Take Profit target gain":"Stop Loss target loss"}
       placeholder={tp?(p.unit==="%"?"Gain %":"Gain $"):(p.unit==="%"?"Loss %":"Loss $")}/>
     <button type="button" onClick={p.onToggle} disabled={p.disabled}
       className="flex items-center gap-1 text-[10px] font-bold text-brand-sub hover:text-brand-text transition-colors cursor-pointer select-none">
       <span className="text-xs font-semibold text-brand-sub">{p.unit==="%"?"%":"$"}</span>
       <ChevronDown className={`w-3 h-3 text-brand-muted transition-transform ${p.open?"rotate-180":""}`}/>
     </button>
   </div>
   {p.open && <>
     <button type="button" className="fixed inset-0 z-35 cursor-default" aria-label="Close unit selector" onClick={p.onToggle}/>
     <div className="absolute right-0 top-[40px] w-[50px] bg-brand-card border border-brand-border rounded-[10px] shadow-2xl z-50 flex flex-col py-1 divide-y divide-brand-border/50 animate-in fade-in duration-100">
       {(["$","%"] as const).map(unit=><button key={unit} type="button"
         onClick={()=>p.onUnit(unit)}
         className={`w-full py-1.5 text-[10px] font-bold text-center cursor-pointer transition-colors ${
           p.unit===unit?(tp?"text-[#4bf2c6]":"text-[#18c29c]"):"text-brand-sub hover:text-brand-text"}`}>
         {unit}
       </button>)}
     </div>
   </>}
 </div>;
}
