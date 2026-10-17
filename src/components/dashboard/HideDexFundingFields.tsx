import React from "react";
import {Network,Wallet,Coins,Info,ArrowRight,ArrowDownRight,ArrowUpRight,Loader2} from "lucide-react";
export type FundingNetworkOption={value:string;label:string};
export function HideDexFundingNetworkAsset({
 network,chainId,options,value,onNetworkChange,disabled=false
}:{
 network:string;chainId?:string|number;
 options?:readonly FundingNetworkOption[];value?:string;onNetworkChange?:(v:string)=>void;disabled?:boolean;
}){
 return <div className="space-y-4">
   <div className="space-y-1.5">
     <label className="text-[11px] font-semibold text-brand-sub uppercase tracking-wider block" htmlFor={options?"hidedex-funds-network":undefined}>Network</label>
     <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between gap-2">
       <div className="flex items-center gap-2.5 min-w-0">
         <div className="w-8 h-8 rounded-lg bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent shrink-0"><Network className="w-4 h-4"/></div>
         {options && onNetworkChange ?
           <select id="hidedex-funds-network" aria-label="Deposit network"
             disabled={disabled} value={value} onChange={e=>onNetworkChange(e.target.value)}
             className="min-w-0 max-w-full bg-transparent font-bold text-sm text-brand-text outline-none cursor-pointer disabled:opacity-50">
             {options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
           </select> :
           <span className="font-bold text-sm text-brand-text truncate">{network}</span>}
       </div>
       {chainId != null && <span className="text-[11px] font-mono text-brand-sub shrink-0">Chain ID: <strong className="text-brand-text">{chainId}</strong></span>}
     </div>
   </div>
   <div className="space-y-1.5">
     <span className="text-[11px] font-semibold text-brand-sub uppercase tracking-wider block">Asset Token</span>
     <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between">
       <div className="flex items-center gap-2.5">
         <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono text-xs">$</div>
         <div><span className="font-bold text-sm text-brand-text">USDC</span>
           <span className="text-xs text-brand-muted font-normal ml-1.5 hidden sm:inline">USD Coin</span></div>
       </div>
     </div>
   </div>
 </div>;
}
export function HideDexFundingDestination({address}:{address:string}){
 return <div className="space-y-1.5">
   <div className="flex justify-between items-center text-[11px] font-semibold text-brand-sub">
     <span className="uppercase tracking-wider">Destination Wallet</span>
     <span className="text-emerald-400 font-bold font-mono text-[10px]">{address?"Connected":"Not Connected"}</span>
   </div>
   <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center gap-2.5 min-w-0">
     <div className="w-8 h-8 rounded-lg bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent shrink-0"><Wallet className="w-4 h-4"/></div>
     <span className="font-mono text-sm font-bold text-brand-text truncate">{address||"No wallet connected"}</span>
   </div>
 </div>;
}
export function HideDexFundingAmount({
 id,amount,onAmount,balanceLabel,balance,minLabel,disabled=false,placeholder="0.00",autoFocus=false
}:{
 id:string;amount:string;onAmount:(s:string)=>void;
 balanceLabel?:string;balance?:React.ReactNode;minLabel?:string;
 disabled?:boolean;placeholder?:string;autoFocus?:boolean;
}){
 return <div className="space-y-1.5">
   <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-brand-sub">
     <label htmlFor={id} className="uppercase tracking-wider">Amount</label>
     {balanceLabel && <span className="font-mono text-right truncate">{balanceLabel}: <strong className="text-brand-text">{balance??"—"}</strong></span>}
   </div>
   <div className="rounded-xl border border-brand-border bg-brand-bg px-3.5 py-2.5 flex items-center justify-between focus-within:border-accent transition-colors">
     <input id={id} type="number" step="any" inputMode="decimal" autoComplete="off" required autoFocus={autoFocus} disabled={disabled}
       value={amount} onChange={e=>onAmount(e.target.value)} placeholder={placeholder}
       className="w-full min-w-0 bg-transparent text-xl sm:text-2xl font-bold font-mono text-brand-text placeholder:text-brand-muted/40 focus:outline-none disabled:opacity-50"/>
     <span className="text-sm font-bold font-mono text-brand-sub pl-2 shrink-0 select-none">USDC</span>
   </div>
   {minLabel && <p className="text-xs text-brand-muted">{minLabel}</p>}
 </div>;
}
export function HideDexFundingPresets({available,onPercent,disabled=false}:{
 available:number|null;onPercent:(percent:25|50|75|100)=>void;disabled?:boolean;
}){
 return <div className="grid grid-cols-4 gap-2">
   {([25,50,75,100] as const).map(percent=><button key={percent} type="button"
     disabled={disabled || available===null || !Number.isFinite(available) || available<=0}
     onClick={()=>onPercent(percent)}
     className="py-2 rounded-lg text-xs font-bold font-mono border border-brand-border bg-brand-overlay-subtle hover:bg-brand-overlay-normal text-brand-text transition-colors cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed">
     {percent}%
   </button>)}
 </div>;
}
/** Exact Original4 funding primary action visuals, separate transaction handlers. */
export function HideDexFundingSubmit({deposit,busy=false,disabled=false,onClick,submit=false,label}:{
 deposit:boolean;busy?:boolean;disabled?:boolean;onClick?:()=>void;submit?:boolean;label?:string;
}){
 return <button type={submit?"submit":"button"} onClick={onClick} disabled={busy||disabled}
   className="w-full py-3.5 px-4 rounded-xl bg-accent hover:opacity-90 active:scale-[0.99] text-brand-bg font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none">
   {busy ? <><Loader2 className="w-4 h-4 animate-spin"/><span>Submitting...</span></>
     : <>{deposit?<ArrowDownRight className="w-4 h-4"/>:<ArrowUpRight className="w-4 h-4"/>}
       <span>{label??(deposit?"Deposit Collateral":"Withdraw Assets")}</span>
       <ArrowRight className="w-4 h-4"/></>}
 </button>;
}
/** Original4 two-row network fee and estimated receive card.
 * Unknown Lighter fees/estimates remain unavailable, never invented.
 */
export function HideDexFundingFeeCard(p:{
 deposit:boolean;fee?:string|null;receive?:string|null;
}){
 return <div className="rounded-xl border border-brand-border/60 bg-brand-overlay-subtle p-3 space-y-2 font-mono text-xs">
   <div className="flex items-center justify-between text-brand-sub">
     <div className="flex items-center gap-1.5">
       <Coins className="w-3.5 h-3.5 text-brand-muted"/>
       <span>{p.deposit?"Deposit Fee":"Network Fee"}</span>
       <Info className="w-3 h-3 text-brand-muted/70"/>
     </div>
     <span className="text-brand-text font-bold">{p.fee??"—"}</span>
   </div>
   <div className="flex items-center justify-between text-brand-text border-t border-brand-border/40 pt-2">
     <div className="flex items-center gap-1.5">
       {p.deposit?<ArrowDownRight className="w-3.5 h-3.5 text-accent"/>:<ArrowUpRight className="w-3.5 h-3.5 text-accent"/>}
       <span>Est. Receive</span><Info className="w-3 h-3 text-brand-muted/70"/>
     </div>
     <span className="text-accent font-bold text-sm">{p.receive??"—"}</span>
   </div>
 </div>;
}
