import React from "react";

export type HideDexPositionDetailField = {
 label:string;
 value:React.ReactNode;
 hint?:React.ReactNode;
 tone?:"normal"|"muted"|"loss"|"profit";
};
export default function HideDexPositionDetails(p:{
 left:readonly HideDexPositionDetailField[];
 right:readonly HideDexPositionDetailField[];
 actions?:React.ReactNode;
}){
 const render=(field:HideDexPositionDetailField,index:number)=>
   <div className="flex flex-col" key={field.label+"-"+index}>
     <span className="text-brand-muted uppercase text-[8px] sm:text-[9px] font-bold tracking-wider">{field.label}</span>
     <span className={`font-bold text-[11px] sm:text-[12px] mt-0.5 leading-tight ${field.tone==="muted"?"text-brand-muted":field.tone==="loss"?"text-brand-loss":field.tone==="profit"?"text-brand-profit":"text-brand-text"}`}>
       {field.value}
     </span>
     {field.hint && <span className="text-[10px] text-brand-muted font-normal mt-0.5">{field.hint}</span>}
   </div>;
 return <div className="flex flex-col gap-3 pt-2.5 border-t border-brand-divider/30 animate-fadeIn duration-150">
   <div className="grid grid-cols-2 gap-x-8 sm:gap-x-12 text-[10.5px] w-full px-0.5">
     <div className="space-y-3">{p.left.map(render)}</div>
     <div className="flex flex-col gap-y-3 pt-0">{p.right.map(render)}</div>
   </div>
   {p.actions && <div className="grid grid-cols-2 gap-1.5 border-t border-brand-divider/30 pt-2 mt-0.5">{p.actions}</div>}
 </div>;
}
