import React from "react";

/** Same original HideDex percentage buttons for every trading venue.
 * The exchange-specific handlers still calculate and validate real order size.
 */
export function HideDexTradePercentPresets({onSelect,disabled=false,selected=0}:{
 onSelect:(value:10|25|50|75|100)=>void;
 disabled?:boolean;
 selected?:number;
}){
 return <div className="grid grid-cols-5 gap-1 pt-0.5">
   {([10,25,50,75,100] as const).map(percent=><button type="button"
     key={percent} disabled={disabled}
     onClick={()=>{if(!disabled)onSelect(percent);}}
     className={`py-1 text-center border rounded-lg text-[9px] md:text-[10px] font-mono font-bold transition-all ${disabled?
       "opacity-35 cursor-not-allowed bg-brand-overlay-subtle/50 border-brand-border/40 text-gray-600":
       selected===percent?"bg-[#18c29c]/10 text-[#18c29c] border-[#18c29c] cursor-pointer":
       "bg-brand-overlay-subtle border-brand-border text-gray-400 hover:text-brand-text hover:bg-brand-overlay-normal cursor-pointer"}`}>
     {percent}%
   </button>)}
 </div>;
}
/** Original Reduce Only and TP/SL toggle visuals used for both exchanges. */
export function HideDexTradeOptionToggle(p:{
 kind:"reduce"|"tpsl";
 checked:boolean;
 disabled?:boolean;
 onChange:(checked:boolean)=>void;
 title?:string;
}) {
 if(p.kind==="reduce") return <label title={p.title}
   className={`min-h-[32px] px-2.5 rounded-lg border inline-flex items-center justify-center gap-1.5 select-none transition-all text-[10px] md:text-xs font-black ${p.disabled?"opacity-40 cursor-not-allowed": "cursor-pointer"} ${p.checked?
     "bg-[#18c29c] hover:bg-[#15b390] border-[#18c29c] text-[#030610] shadow-md shadow-[#18c29c]/10":
     "bg-brand-surface hover:bg-brand-overlay-normal border-brand-border hover:border-[#18c29c]/60 text-brand-text"}`}>
   <input type="checkbox" checked={p.checked} disabled={p.disabled}
     aria-label="Reduce Only" onChange={e=>p.onChange(e.target.checked)} className="sr-only"/>
   <span aria-hidden="true" className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center text-[10px] leading-none font-black ${p.checked?
     "bg-[#030610]/10 border-[#030610]/30 text-[#030610]":"bg-brand-bg border-brand-border text-transparent"}`}>✓</span>
   <span className="whitespace-nowrap">Reduce Only</span>
 </label>;
 return <label title={p.title}
   className={`flex items-center gap-2.5 select-none group py-0.5 ${p.disabled?"opacity-40 cursor-not-allowed":"cursor-pointer"}`}>
   <input type="checkbox" checked={p.checked} disabled={p.disabled} onChange={e=>p.onChange(e.target.checked)}
     aria-label="Take Profit / Stop Loss" className="sr-only"/>
   <span aria-hidden="true"
     className={`w-[18px] h-[18px] shrink-0 rounded-[5px] border-[1.8px] transition-all flex items-center justify-center ${p.checked?
       "border-[#18c29c] bg-[#18c29c]/10":"border-brand-border bg-brand-surface group-hover:border-[#18c29c]/60"}`}>
     {p.checked && <span className="w-[8px] h-[8px] rounded-[1.5px] bg-[#18c29c]"/>}
   </span>
   <span className="text-[11px] md:text-[12px] font-bold text-brand-text tracking-wide font-sans">
     Take Profit / Stop Loss
   </span>
 </label>;
}
