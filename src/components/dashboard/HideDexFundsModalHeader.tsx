import React from "react";
import { ArrowUpRight, Coins, X } from "lucide-react";
/** Original HideDex Deposit/Withdrawal modal heading for all exchanges. */
export default function HideDexFundsModalHeader(p:{
 deposit:boolean; onClose:()=>void; disabled?:boolean;
 subtitle?:string;
}){
 return <div className="p-4 sm:p-6 pb-2 sm:pb-3 shrink-0">
   <div className="flex items-center justify-between">
     <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shadow-xs">
       {p.deposit?<Coins className="w-5 h-5"/>:<ArrowUpRight className="w-5 h-5"/>}
     </div>
     <button type="button" onClick={p.onClose} disabled={p.disabled}
       className="w-9 h-9 rounded-full bg-brand-overlay-subtle hover:bg-brand-overlay-normal text-brand-muted hover:text-brand-text flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
       id="modal-close-btn" aria-label="Close">
       <X className="w-4 h-4"/>
     </button>
   </div>
   <h3 className="text-xl sm:text-2xl font-bold text-brand-text tracking-tight mt-3">
     {p.deposit?"Deposit Collateral":"Withdraw Assets"}
   </h3>
   <p className="text-xs sm:text-sm text-brand-sub mt-1">
     {p.subtitle??(p.deposit?"Add funds to your HideDex trading account.":"Withdraw your assets to your connected wallet.")}
   </p>
 </div>;
}
