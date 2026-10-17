import React from "react";
import {motion} from "motion/react";
import HideDexFundsModalHeader from "./HideDexFundsModalHeader";

/** Original4 / Hyperliquid Funds dialog structure, one UI for both exchanges.
 * Content, destination and submission remain exchange-owned.
 */
export default function HideDexFundsDialogShell(p:{
  deposit:boolean;onClose:()=>void;busy?:boolean;subtitle?:string;children:React.ReactNode;
}){
 const safeClose=()=>{if(!p.busy)p.onClose();};
 return <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
   <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
     className="absolute inset-0" onClick={safeClose}/>
   <motion.div role="dialog" aria-modal="true"
     aria-label={p.deposit?"Deposit Collateral":"Withdraw Assets"}
     initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
     transition={{type:"spring",duration:0.25}}
     className="relative bg-brand-surface border-0 sm:border border-brand-border rounded-none sm:rounded-[24px] w-screen sm:w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-[32rem] shadow-2xl flex flex-col overflow-hidden pt-safe pb-safe">
     <HideDexFundsModalHeader deposit={p.deposit} disabled={p.busy}
       onClose={safeClose} subtitle={p.subtitle}/>
     <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] space-y-4">
       {p.children}
     </div>
   </motion.div>
 </div>;
}
