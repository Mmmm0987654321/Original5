import React from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";

export type HideDexToastKind="pending"|"success"|"error";
type Props={
  type:HideDexToastKind;
  title?:string;
  message:string;
  onClose:()=>void;
};
/** Original HideDex trading toast: ONE shared visual for Hyperliquid & Lighter.
 * The venue determines truth/acceptance; this component performs no execution.
 */
export default function HideDexTradingToast({type,title,message,onClose}:Props){
 return <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 z-[180] pointer-events-auto w-auto sm:w-[380px] max-w-[calc(100vw-24px)] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200"
   id="terminal-order-toast" role="status" aria-live="polite" aria-busy={type==="pending"}>
   <div className="p-3.5 sm:p-4 rounded-2xl border border-brand-border bg-brand-card text-brand-text flex items-start gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
     <span className={`mt-0.5 p-1.5 shrink-0 rounded-full ${type==="pending"?"bg-brand-primary/10 text-brand-primary":type==="success"?"bg-brand-profit/10 text-brand-profit":"bg-brand-loss/10 text-brand-loss"}`}>
       {type==="pending"?<LoaderCircle className="w-[20px] h-[20px] animate-spin" aria-hidden="true"/>:
         type==="success"?<CheckCircle2 className="w-[20px] h-[20px]" aria-hidden="true"/>:
         <AlertCircle className="w-[18px] h-[18px]" aria-hidden="true"/>}
     </span>
     <div className="flex-1 min-w-0 pr-1">
       <div className="text-[10px] uppercase tracking-wide font-extrabold text-brand-muted mb-1">HideDex</div>
       {title&&<div className="text-[13px] sm:text-sm font-bold text-brand-text mb-1 leading-snug break-words">{title}</div>}
       <div className="text-[12px] sm:text-[13px] text-brand-sub break-words whitespace-pre-line leading-relaxed">{message}</div>
     </div>
     <button type="button" onClick={onClose}
       className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-overlay-normal transition-colors shrink-0 cursor-pointer" title="Close" aria-label="Dismiss notification">
       <X className="w-3.5 h-3.5"/>
     </button>
   </div>
 </div>;
}
