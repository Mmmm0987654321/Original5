import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/** Original HideDex order-type / margin / leverage controls.
 * Shared by Hyperliquid and Lighter. Execution, signing and permitted order
 * types are supplied by each venue; this component never places orders.
 */
export type TradeOrderType = "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET" | "TAKE_LIMIT" | "TAKE_MARKET";
export type TradeMarginMode = "CROSS" | "ISOLATED";
const TYPE_LABELS: Record<TradeOrderType,string> = {
 LIMIT:"Limit", MARKET:"Market", STOP_LIMIT:"Stop Limit", STOP_MARKET:"Stop Market",
 TAKE_LIMIT:"Take Limit", TAKE_MARKET:"Take Market",
};
export interface HideDexTradeSelectorsProps {
 isPerp: boolean;
 orderType: TradeOrderType;
 onOrderType: (next:TradeOrderType) => void;
 availableOrderTypes?: readonly TradeOrderType[];
 marginMode?: TradeMarginMode;
 onMarginMode?: (next:TradeMarginMode) => void;
 disabledMarginModes?: readonly TradeMarginMode[];
 leverage?: number;
 maxLeverage?: number | null;
 onLeverage?: (next:number) => void;
 leverageDisabled?: boolean;
 onApplySettings?:()=>void; settingsBusy?:boolean; settingsMessage?:string;
}
export default function HideDexTradeSelectors({
 isPerp,orderType,onOrderType,availableOrderTypes,
 marginMode = "CROSS",onMarginMode,disabledMarginModes=[],
 leverage=1,maxLeverage,onLeverage,leverageDisabled=false,
 onApplySettings,settingsBusy=false,settingsMessage,
}: HideDexTradeSelectorsProps) {
 const [popup,setPopup] = useState<"order"|"margin"|"leverage"|null>(null);
 const host = useRef<HTMLDivElement>(null);
 useEffect(() => {
   if (!popup) return;
   const close = (e:MouseEvent) => { if (host.current && !host.current.contains(e.target as Node)) setPopup(null); };
   document.addEventListener("pointerdown",close);
   return () => document.removeEventListener("pointerdown",close);
 },[popup]);
 useEffect(() => {setPopup(null);},[isPerp]);
 const options:TradeOrderType[] = isPerp ?
  ["LIMIT","MARKET","STOP_LIMIT","STOP_MARKET","TAKE_LIMIT","TAKE_MARKET"] : ["LIMIT","MARKET"];
 const canLeverage = isPerp && !leverageDisabled && !!onLeverage &&
   typeof maxLeverage === "number" && Number.isFinite(maxLeverage) && maxLeverage >= 1;
 const cap = canLeverage ? Math.max(1,Math.floor(maxLeverage!)) : null;
 const applyAction = onApplySettings && <div className="border-t border-brand-border/50 mt-1 pt-1.5 space-y-1">
   <p className="text-[9px] text-brand-muted">Draft settings; not active until signed and accepted.</p>
   <button type="button" disabled={settingsBusy || !cap} onClick={onApplySettings}
     className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-accent text-brand-bg disabled:opacity-40">
     {settingsBusy?"Submitting…":"Confirm real margin update"}
   </button>
   {settingsMessage && <p role="status" className="text-[9px] text-brand-muted break-all max-h-16 overflow-y-auto">{settingsMessage}</p>}
 </div>;
 return <div ref={host}
   className={`gap-1 md:gap-1.5 text-[10px] md:text-xs items-start ${isPerp
     ? "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.8fr)]" : "flex"}`}>
   <div className={isPerp ? "relative min-w-0" : "relative shrink-0"}>
     <button type="button" aria-label="Order type" aria-haspopup="menu" aria-expanded={popup==="order"}
       onClick={() => setPopup(x=>x==="order"?null:"order")}
       className={`flex items-center gap-1 px-1.5 py-1 bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border rounded-lg text-gray-300 font-bold hover:text-brand-text transition-colors ${isPerp ? "w-full min-w-0 justify-between":""}`}>
       <span className="text-[10px] truncate whitespace-nowrap">{TYPE_LABELS[orderType]}</span>
       <ChevronDown className="w-3 h-3 text-gray-500 shrink-0"/>
     </button>
     {popup==="order" && <div role="menu" className="absolute left-0 mt-1 w-28 bg-brand-bg border border-brand-border rounded-lg shadow-xl z-50 p-0.5">
       {options.map(t=>{
         const supported = !availableOrderTypes || availableOrderTypes.includes(t);
         return <button type="button" key={t} role="menuitem" disabled={!supported}
           title={!supported ? "This order type is not verified for this exchange" : undefined}
           onClick={() => {if(supported) {onOrderType(t);setPopup(null);}}}
           className={`w-full text-left px-2 py-1 text-[10px] rounded transition-colors font-bold ${orderType===t?"text-cyan-400 bg-brand-overlay-normal":"text-gray-400 hover:text-brand-text"} disabled:opacity-40 disabled:cursor-not-allowed`}>
           {TYPE_LABELS[t]}
         </button>;
       })}
     </div>}
   </div>
   {isPerp && <div className="relative min-w-0">
     <button type="button" disabled={!onMarginMode} onClick={() => setPopup(x=>x==="margin"?null:"margin")}
       aria-label="Cross or Isolated" aria-expanded={popup==="margin"}
       className="w-full min-w-0 justify-between flex items-center gap-1 px-1.5 py-1 bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border rounded-lg text-gray-300 font-bold hover:text-brand-text transition-colors disabled:opacity-50">
       <span className="capitalize text-[10px] truncate whitespace-nowrap">{marginMode.toLowerCase()}</span>
       <ChevronDown className="w-3 h-3 text-gray-500 shrink-0"/>
     </button>
     {popup==="margin" && <div role="menu" className={"absolute left-0 mt-1 "+(onApplySettings?"w-44":"w-24")+" bg-brand-bg border border-brand-border rounded-lg shadow-xl z-50 p-1"}>
       {(["CROSS","ISOLATED"] as const).map(mode=>
         <button type="button" role="menuitem" key={mode} disabled={disabledMarginModes.includes(mode)}
           onClick={() => {onMarginMode?.(mode);if(!onApplySettings)setPopup(null);}}
           className={`w-full text-left px-2 py-1 text-[10px] rounded transition-colors font-bold ${marginMode===mode?"text-cyan-400 bg-brand-overlay-normal":"text-gray-400 hover:text-brand-text"} disabled:opacity-40 disabled:cursor-not-allowed`}>{mode}</button>)}
       {applyAction}
     </div>}
   </div>}
   {isPerp && <div className="relative min-w-0">
     <button type="button" disabled={!canLeverage}
       onClick={() => setPopup(x=>x==="leverage"?null:"leverage")}
       aria-label="Leverage" aria-expanded={popup==="leverage"}
       className="w-full min-w-0 justify-between flex items-center gap-1 px-1.5 py-1 bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border rounded-lg text-gray-300 font-bold hover:text-brand-text transition-colors disabled:opacity-50">
       <span className="text-[10px] whitespace-nowrap">{cap ? leverage+"x" : "—x"}</span>
       <ChevronDown className="w-3 h-3 text-gray-500 shrink-0"/>
     </button>
     {popup==="leverage" && cap && <div className="absolute right-0 mt-1 w-44 bg-brand-bg border border-brand-border rounded-lg shadow-xl z-50 p-2.5 space-y-2">
       <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 font-mono">
         <span>Leverage Factor</span><span className="text-accent">{leverage}x</span>
       </div>
       <input type="range" min="1" max={cap} value={Math.min(cap,Math.max(1,leverage))}
         onChange={e=>onLeverage?.(Number(e.target.value))}
         className="w-full h-1 bg-brand-overlay-normal rounded cursor-pointer accent-accent"/>
       <div className="flex justify-between text-[8px] text-gray-500 font-mono"><span>1x</span><span>{cap}x Max</span></div>
       <div className="grid grid-cols-4 gap-1">
         {[2,5,10,cap].filter((v,i,arr)=>v<=cap && arr.indexOf(v)===i).map(v=>
           <button type="button" key={v}
             onClick={()=>{onLeverage?.(v);if(!onApplySettings)setPopup(null);}}
             className={`py-0.5 rounded text-[8px] text-center font-bold border ${leverage===v?"bg-accent/10 border-accent text-accent":"bg-brand-overlay-subtle border-brand-border text-gray-400 hover:text-brand-text"}`}>{v===cap?"Max":v+"x"}</button>)}
       </div>
       {applyAction}
     </div>}
   </div>}
 </div>;
}
