import React from "react";
import HideDexTradeSelectors from "./HideDexTradeSelectors";
import {HideDexSideAndAvailability,HideDexBasicOrderInputs} from "./HideDexTradeEntry";
import {HideDexTradePercentPresets,HideDexTradeOptionToggle} from "./HideDexTradeOptions";
import HideDexTradeTriggerPrice from "./HideDexTradeTriggerPrice";
import HideDexTradeOutcomeInput from "./HideDexTradeOutcomeInput";
import HideDexOrderSummary from "./HideDexOrderSummary";
import HideDexPlaceOrderButton from "./HideDexPlaceOrderButton";
import HideDexDisconnectedOverlay from "./HideDexDisconnectedOverlay";

type PriceField=React.ComponentProps<typeof HideDexTradeTriggerPrice>;
type OutcomeField=React.ComponentProps<typeof HideDexTradeOutcomeInput>;
type Toggle=React.ComponentProps<typeof HideDexTradeOptionToggle>;

export interface HideDexUnifiedOrderFormProps{
 connected:boolean;
 onConnect:()=>void;
 connectTitle?:string;
 onSubmit:React.FormEventHandler<HTMLFormElement>;
 selectors:React.ComponentProps<typeof HideDexTradeSelectors>;
 side:React.ComponentProps<typeof HideDexSideAndAvailability>;
 basic:React.ComponentProps<typeof HideDexBasicOrderInputs>|null;
 /** The Hyperliquid original stop/take type inputs; disabled on venues without verified support. */
 advancedFields?:React.ReactNode;
 equivalentText?:string|null;
 presets:React.ComponentProps<typeof HideDexTradePercentPresets>;
 options?:{
   visible:boolean;
   reduce?:Omit<Toggle,"kind">;
   reduceTooLarge?:boolean;
   tifGtc?:boolean;
   tpsl:Omit<Toggle,"kind">;
   tp?:{price:PriceField;outcome:OutcomeField};
   sl?:{price:PriceField;outcome:OutcomeField};
 };
 summary:React.ComponentProps<typeof HideDexOrderSummary>;
 place:Omit<React.ComponentProps<typeof HideDexPlaceOrderButton>,"children"> & {label:React.ReactNode};
}
/** ONE original HideDex order form JSX for Hyperliquid and Lighter.
 * Adapters only provide real data and venue-specific callbacks.
 * No API, wallet key, signing, fake prices, or other venue implementation here.
 */
export default function HideDexUnifiedOrderForm(p:HideDexUnifiedOrderFormProps){
 const opt=p.options;
 return <>
   {!p.connected&&<HideDexDisconnectedOverlay title={p.connectTitle} onConnect={p.onConnect}/>}
   <form onSubmit={p.onSubmit} className="flex flex-1 flex-col gap-2 md:gap-3">
     <HideDexTradeSelectors {...p.selectors}/>
     <HideDexSideAndAvailability {...p.side}/>
     {p.basic&&<HideDexBasicOrderInputs {...p.basic}/>}
     {p.advancedFields}
     {p.equivalentText&&<div className="text-right px-1 text-[8px] sm:text-[9px] font-mono text-gray-500 select-none">{p.equivalentText}</div>}
     <HideDexTradePercentPresets {...p.presets}/>
     {opt?.visible&&<div className="space-y-2 pt-2 px-0.5 border-t border-brand-border/35">
       <div className="flex items-start justify-between gap-2">
         <div className="min-w-0">
           {opt.reduce&&<div className="flex flex-col gap-1">
             <HideDexTradeOptionToggle kind="reduce" {...opt.reduce}/>
             {opt.reduceTooLarge&&<span className="text-[9px] text-pnl-loss font-mono font-bold">Reduce Only Too Large</span>}
           </div>}
         </div>
         {opt.tifGtc&&<div className="text-[9px] font-bold text-brand-muted uppercase tracking-wider select-none">TIF GTC</div>}
       </div>
       <div className="border-t border-brand-border/35 pt-2 space-y-2">
         <HideDexTradeOptionToggle kind="tpsl" {...opt.tpsl}/>
         {opt.tpsl.checked&&(opt.tp||opt.sl)&&
           <div className="grid grid-cols-2 gap-1.5 md:gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
             {opt.tp&&<>
               <div className="relative"><HideDexTradeTriggerPrice {...opt.tp.price}/></div>
               <HideDexTradeOutcomeInput {...opt.tp.outcome}/>
             </>}
             {opt.sl&&<>
               <div className="relative"><HideDexTradeTriggerPrice {...opt.sl.price}/></div>
               <HideDexTradeOutcomeInput {...opt.sl.outcome}/>
             </>}
           </div>}
       </div>
     </div>}
     <HideDexOrderSummary {...p.summary}/>
     <HideDexPlaceOrderButton {...p.place}>{p.place.label}</HideDexPlaceOrderButton>
   </form>
 </>;
}
