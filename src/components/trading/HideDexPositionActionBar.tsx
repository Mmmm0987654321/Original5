import React,{useEffect,useRef,useState} from "react";
import {ChevronDown} from "lucide-react";

export type HideDexPositionSort="DEFAULT"|"SYMBOL"|"SIZE"|"PNL"|"ROI"|"RISK";
const OPTIONS:ReadonlyArray<{id:HideDexPositionSort;name:string}>=[
  {id:"DEFAULT",name:"Default"},
  {id:"SYMBOL",name:"Symbol"},
  {id:"SIZE",name:"Size"},
  {id:"PNL",name:"PnL"},
  {id:"ROI",name:"ROI"},
  {id:"RISK",name:"Risk Ratio"},
];
type Props={
 sort:HideDexPositionSort;
 onSort:(value:HideDexPositionSort)=>void;
 supportedSorts?:readonly HideDexPositionSort[];
 allExpanded:boolean;
 onToggleAll:()=>void;
 onCloseAll:()=>void;
 closeDisabled?:boolean;
};
/** Exact Original4 responsive positions action row, reused by both venues.
 * Parent owns all exchange-specific sorting and close handlers.
 */
export default function HideDexPositionActionBar({
 sort,onSort,supportedSorts,allExpanded,onToggleAll,onCloseAll,closeDisabled=false,
}:Props){
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   if(!open)return;
   const dismiss=(event:MouseEvent)=>{
     if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false);
   };
   document.addEventListener("mousedown",dismiss);
   return ()=>document.removeEventListener("mousedown",dismiss);
 },[open]);
 const chosen=OPTIONS.find(item=>item.id===sort);
 return <div className="flex items-center justify-between px-2.5 py-1.5 bg-brand-bg/50 border-b border-brand-border text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider relative">
   <div className="relative shrink-0" ref={ref}>
     <button type="button" onClick={()=>setOpen(value=>!value)}
       className="flex items-center gap-1 hover:text-brand-text transition-colors cursor-pointer"
       aria-label="Sort positions" aria-expanded={open}>
       <span>Sort By: {chosen?.name??"Default"}</span>
       <ChevronDown className="w-3 h-3 text-gray-500"/>
     </button>
     {open&&<div className="absolute left-0 mt-1.5 w-28 bg-brand-bg border border-brand-border rounded-lg shadow-xl z-30 p-0.5">
       {OPTIONS.map(option=>{
         const supported=!supportedSorts||supportedSorts.includes(option.id);
         return <button type="button" key={option.id} disabled={!supported}
           title={!supported?"This sort requires verified exchange data":undefined}
           onClick={()=>{if(supported){onSort(option.id);setOpen(false);}}}
           className={`w-full text-left px-2 py-1 text-[9px] rounded transition-colors font-bold ${sort===option.id?"text-cyan-400 bg-brand-overlay-normal":"text-gray-400 hover:text-brand-text"} disabled:opacity-40 disabled:cursor-not-allowed`}>
           {option.name}
         </button>;
       })}
     </div>}
   </div>
   <div className="flex items-center gap-3">
     <button type="button" onClick={onToggleAll}
       className="hover:text-brand-text transition-colors cursor-pointer">
       {allExpanded?"Collapse All":"Expand All"}
     </button>
     <button type="button" onClick={onCloseAll} disabled={closeDisabled}
       className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
       Close All
     </button>
   </div>
 </div>;
}
