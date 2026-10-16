import React from "react";

export interface HideDexSideAndAvailabilityProps {
 isPerp:boolean;
 side:"BUY"|"SELL";
 onSide:(side:"BUY"|"SELL")=>void;
 available:React.ReactNode;
}
/** Original HideDex Long/Short switch + Avail. to Trade, shared by all venues. */
export function HideDexSideAndAvailability({isPerp,side,onSide,available}:HideDexSideAndAvailabilityProps) {
 return <>
   <div className="flex bg-brand-overlay-subtle rounded-lg p-0.5 border border-brand-border">
     <button type="button" onClick={()=>onSide("BUY")}
       className={`flex-1 py-1.5 rounded-md text-[10px] md:text-xs font-black tracking-wider uppercase transition-all duration-150 cursor-pointer ${side==="BUY"
         ?"bg-[#18c29c] text-[#030610] shadow-md shadow-[#18c29c]/10"
         :"text-gray-400 hover:text-brand-text"}`}>{isPerp?"Long":"Buy"}</button>
     <button type="button" onClick={()=>onSide("SELL")}
       className={`flex-1 py-1.5 rounded-md text-[10px] md:text-xs font-black tracking-wider uppercase transition-all duration-150 cursor-pointer ${side==="SELL"
         ?"bg-[#f25c5c] text-brand-text shadow-md shadow-[#f25c5c]/10"
         :"text-gray-400 hover:text-brand-text"}`}>{isPerp?"Short":"Sell"}</button>
   </div>
   <div className="flex justify-between items-center text-[9px] md:text-[10px] text-gray-500 font-bold px-1">
     <span>Avail. to Trade</span><span className="font-mono text-gray-300">{available}</span>
   </div>
 </>;
}

export interface HideDexBasicOrderInputsProps {
 type:"MARKET"|"LIMIT";
 price:string;
 onPrice:(s:string)=>void;
 midPrice:number|null|undefined;
 size:string;
 onSize:(s:string)=>void;
 sizeUnit:string;
 onToggleUnit:()=>void;
}
/** Original HideDex PRICE / SIZE pair for supported market + limit trades. */
export function HideDexBasicOrderInputs(p:HideDexBasicOrderInputsProps) {
 return <>
   <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
     <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider w-12 md:w-16 shrink-0 select-none">Price</span>
     {p.type==="MARKET" ?
       <input type="text" disabled value="Market Price"
         className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-gray-500 min-w-0 text-[11px] md:text-xs select-none cursor-not-allowed"/> :
       <input type="number" step="any" value={p.price} onChange={e=>p.onPrice(e.target.value)}
         placeholder="0.00" className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-brand-text min-w-0 text-[11px] md:text-xs"/>}
     {p.type!=="MARKET" && <button type="button"
       onClick={()=>{if(p.midPrice!==null && Number.isFinite(p.midPrice) && Number(p.midPrice)>0)p.onPrice(String(p.midPrice));}}
       className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[8px] md:text-[9px] font-black uppercase hover:bg-accent/20 transition-colors shrink-0 cursor-pointer">Mid</button>}
   </div>
   <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
     <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0 select-none">Size ({p.sizeUnit})</span>
     <input type="number" step="any" value={p.size} onChange={e=>p.onSize(e.target.value)}
       placeholder="0.00" className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-brand-text min-w-0 text-[11px] md:text-xs"/>
     <div className="flex items-center select-none shrink-0">
       <button type="button" onClick={p.onToggleUnit}
         className="text-[8px] md:text-[9px] font-black uppercase bg-brand-overlay-normal hover:bg-brand-overlay-active border border-brand-border px-1.5 py-0.5 rounded text-gray-300 transition-colors cursor-pointer">{p.sizeUnit}</button>
     </div>
   </div>
 </>;
}
