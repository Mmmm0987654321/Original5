import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck } from "lucide-react";

/** Original HideDex Enable Trading / approval bottom sheet.
 * Both Hyperliquid and Lighter pass only the venue-specific approval body
 * and real authorization callbacks. No signing or key storage lives here.
 */
export default function HideDexTradingAuthorizationSheet(p:{
 title:string;
 onClose:()=>void;
 closeDisabled?:boolean;
 icon?:React.ReactNode;
 description?:React.ReactNode;
 children?:React.ReactNode;
 primaryLabel:React.ReactNode;
 onPrimary:()=>void;
 primaryDisabled?:boolean;
}){
 const close=()=>{if(!p.closeDisabled)p.onClose();};
 return <AnimatePresence>
   <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center sm:p-4">
     <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
       className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={close}/>
     <motion.div
       initial={{y:"100%",opacity:0}} animate={{y:0,opacity:1}}
       exit={{y:"100%",opacity:0}}
       transition={{type:"spring",damping:28,stiffness:320}}
       role="dialog" aria-modal="true" aria-label={p.title}
       className="relative w-full sm:max-w-md bg-brand-surface p-5 sm:p-6 rounded-t-[28px] rounded-b-none sm:rounded-2xl sm:rounded-b-2xl sm:border border-brand-border text-brand-text shadow-2xl z-50 max-h-[92vh] flex flex-col overflow-y-auto"
       id="confirm-signature-modal">
       <button onClick={close} disabled={p.closeDisabled} type="button"
         className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-brand-text hover:bg-brand-overlay-normal transition-colors cursor-pointer disabled:opacity-30"
         aria-label="Close"><X className="w-4 h-4"/></button>
       <div className="flex flex-col pt-1">
         <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-violet-500/10 border-violet-500/20 text-violet-400">
             {p.icon??<ShieldCheck className="w-5 h-5"/>}
           </div>
           <div className="flex-1 min-w-0 pr-6">
             <h2 className="font-sans text-base sm:text-lg font-bold text-brand-text tracking-tight">{p.title}</h2>
           </div>
         </div>
         {p.description}
         {p.children}
         <div className="w-full flex gap-3 mt-4 pt-1 pb-1 sm:pb-0">
           <button type="button" onClick={close} disabled={p.closeDisabled}
             className="flex-1 bg-brand-overlay-normal hover:bg-brand-overlay-active text-brand-sub hover:text-brand-text font-medium py-3 sm:py-2.5 rounded-xl border border-brand-border transition-all text-xs cursor-pointer disabled:opacity-50"
             id="cancel-sig-btn">Cancel</button>
           <button type="button" onClick={p.onPrimary} disabled={p.primaryDisabled}
             className="flex-[2] border border-brand-primary hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed font-extrabold py-3 sm:py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider font-mono"
             style={{backgroundColor:"var(--accent-primary)",color:"var(--bg-main)"}}
             id="sign-sig-btn">{p.primaryLabel}</button>
         </div>
       </div>
     </motion.div>
   </div>
 </AnimatePresence>;
}
