import React from "react";
import { AlertTriangle, ArrowDownRight, ArrowRightLeft, ArrowUpRight, Check, ChevronRight, Copy, Eye, EyeOff, Layers, Wallet } from "lucide-react";

export type HideDexBalanceCard = {
 label: string;
 value: React.ReactNode;
 subtitle: React.ReactNode;
 icon: React.ReactNode;
 iconTone?: string;
};
export interface HideDexFundsOverviewProps {
 totalLabel: string;
 totalValue: React.ReactNode;
 approximateValue: React.ReactNode;
 accountLabel: string;
 accountModeLabel: string;
 walletAddress: string;
 walletDisplay: string;
 hideBalances: boolean;
 onToggleBalances?: () => void;
 addressCopied?: boolean;
 onCopyAddress: () => void;
 accountError?: string | null;
 extraHeaderAction?: React.ReactNode;
 depositLabel: string;
 depositSubtitle: string;
 withdrawLabel: string;
 withdrawSubtitle: string;
 onDeposit: () => void;
 onWithdraw: () => void;
 /** Disabled until a venue actually implements verified funding. */
 depositDisabled?: boolean;
 withdrawDisabled?: boolean;
 onTransfer?: () => void;
 transferLabel?: string;
 cards: readonly HideDexBalanceCard[];
}
/** Pure presentation from the original HideDex PortfolioPanel.
 * Both venues use this exact same markup. Actions, balances and account data
 * come only from the selected venue; there is no cross-exchange fallback.
 */
export default function HideDexFundsOverview(props: HideDexFundsOverviewProps) {
 return <>
   <div className="relative bg-brand-surface border border-brand-border/70 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 overflow-hidden shadow-sm" id="funds-hero-card">
     <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"/>
     <div className="relative flex items-center justify-between gap-2">
       <div className="flex items-center gap-1.5 sm:gap-2">
         <span className="text-[10px] sm:text-xs font-bold text-brand-muted uppercase tracking-wider">{props.totalLabel}</span>
         {props.onToggleBalances && <button type="button" onClick={props.onToggleBalances}
           className="p-1 rounded-md text-brand-muted hover:text-brand-text transition-colors cursor-pointer"
           title={props.hideBalances ? "Show Balances" : "Hide Balances"}
           id="toggle-balance-eye-btn">
           {props.hideBalances ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
         </button>}
       </div>
       <div className="flex items-center gap-1.5 sm:gap-2">
         {props.extraHeaderAction}
         <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-lg sm:rounded-xl bg-brand-overlay-subtle border border-brand-border/60 text-[11px] sm:text-xs font-semibold text-brand-text">
           <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent"/>
           <span>{props.accountLabel}</span>
         </div>
       </div>
     </div>
     <div className="relative mt-2 sm:mt-3">
       <div className="text-2xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-brand-text">{props.totalValue}</div>
       <div className="text-[11px] sm:text-sm font-mono font-medium text-brand-muted mt-0.5 sm:mt-1">{props.approximateValue}</div>
     </div>
     <div className="relative grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 mt-3 sm:mt-4">
       <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-brand-overlay-subtle border border-brand-border/50 min-w-0">
         <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent shrink-0">
           <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
         </div>
         <div className="min-w-0 flex-1">
           <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-brand-muted block truncate">Wallet Address</span>
           <div className="flex items-center gap-1 mt-0.5">
             <span className="text-xs font-mono font-bold text-brand-text truncate">{props.walletDisplay}</span>
             {props.walletAddress && <button type="button" onClick={props.onCopyAddress}
               className="text-brand-muted hover:text-brand-text transition-colors p-0.5 cursor-pointer shrink-0" title="Copy address" aria-label="Copy address">
               {props.addressCopied ? <Check className="w-3 h-3 text-success"/> : <Copy className="w-3 h-3"/>}
             </button>}
           </div>
         </div>
       </div>
       <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-brand-overlay-subtle border border-brand-border/50 min-w-0">
         <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent shrink-0">
           <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
         </div>
         <div className="min-w-0 flex-1">
           <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-brand-muted block truncate">Account Type</span>
           <span className="text-xs font-mono font-bold text-brand-text block mt-0.5 truncate">{props.accountModeLabel}</span>
         </div>
       </div>
     </div>
     {props.accountError && <div role="alert" className="relative flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl mt-2.5" id="portfolio-account-state-error">
       <AlertTriangle className="w-3.5 h-3.5 shrink-0"/>
       <span className="truncate" title={props.accountError}>{props.accountError}</span>
     </div>}
   </div>
   <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 sm:gap-3" id="funds-action-buttons-row">
     <button type="button" onClick={props.onDeposit}
       disabled={props.depositDisabled}
       title={props.depositDisabled?"Deposit authorization is not yet available for this exchange":undefined}
       className="disabled:opacity-40 disabled:cursor-not-allowed p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-accent text-brand-bg font-extrabold flex items-center justify-between transition-all hover:opacity-95 active:scale-[0.99] shadow-md cursor-pointer text-left group min-w-0"
       id="deposit-modal-trigger-btn">
       <div className="flex items-center gap-2 sm:gap-3 min-w-0">
         <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-brand-bg/15 border border-brand-bg/25 flex items-center justify-center shrink-0">
           <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-bg"/>
         </div>
         <div className="min-w-0">
           <span className="text-xs sm:text-sm font-black tracking-wider uppercase block truncate">{props.depositLabel}</span>
           <span className="text-[9px] sm:text-[11px] font-semibold opacity-90 truncate block">{props.depositSubtitle}</span>
         </div>
       </div>
       <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-75 shrink-0 transition-transform group-hover:translate-x-0.5 ml-1"/>
     </button>
     <button type="button" onClick={props.onWithdraw}
       disabled={props.withdrawDisabled}
       title={props.withdrawDisabled?"Withdrawal authorization is not yet available for this exchange":undefined}
       className="disabled:opacity-40 disabled:cursor-not-allowed p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-brand-surface border border-brand-border hover:bg-brand-overlay-normal text-brand-text font-extrabold flex items-center justify-between transition-all active:scale-[0.99] shadow-sm cursor-pointer text-left group min-w-0"
       id="withdraw-modal-trigger-btn">
       <div className="flex items-center gap-2 sm:gap-3 min-w-0">
         <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shrink-0">
           <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
         </div>
         <div className="min-w-0">
           <span className="text-xs sm:text-sm font-black tracking-wider uppercase block truncate">{props.withdrawLabel}</span>
           <span className="text-[9px] sm:text-[11px] font-medium text-brand-sub truncate block">{props.withdrawSubtitle}</span>
         </div>
       </div>
       <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-muted shrink-0 transition-transform group-hover:translate-x-0.5 ml-1"/>
     </button>
   </div>
   {props.onTransfer && <div className="flex justify-stretch sm:justify-end w-full">
     <button type="button" onClick={props.onTransfer}
       className="flex w-full sm:w-auto min-w-0 items-center justify-center gap-2 px-3 py-2.5 sm:py-2 rounded-xl bg-brand-surface border border-brand-border hover:bg-brand-overlay-normal text-[10px] sm:text-[11px] font-semibold text-brand-text transition-colors cursor-pointer text-center"
       id="transfer-modal-trigger-btn">
       <ArrowRightLeft className="w-4 h-4 shrink-0 text-accent"/>
       <span className="leading-tight">{props.transferLabel ?? "Transfer Spot / Perps"}</span>
     </button>
   </div>}
   <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 sm:gap-3" id="balances-grid-display">
     {props.cards.map((c,i) =>
       <div key={c.label+"-"+i}
         className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between hover:border-brand-border transition-colors shadow-xs min-w-0">
         <div className="flex items-center gap-2 mb-2">
           <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 ${c.iconTone || "text-accent"}`}>
             {c.icon}
           </div>
           <span className="min-w-0 text-[9px] sm:text-[11px] font-bold uppercase tracking-normal sm:tracking-wide text-brand-muted leading-tight whitespace-normal break-words">{c.label}</span>
         </div>
         <div>
           <div className="text-base sm:text-xl font-black font-mono text-brand-text truncate">{c.value}</div>
           <div className="text-[9px] sm:text-[11px] font-mono text-brand-muted mt-0.5 leading-tight line-clamp-2">{c.subtitle}</div>
         </div>
       </div>)}
   </div>
 </>;
}
