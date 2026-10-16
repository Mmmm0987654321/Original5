import React from "react";
import { ChevronDown } from "lucide-react";

export interface HideDexPositionHeaderProps {
 symbol:string;
 side:"LONG"|"SHORT";
 isExpanded:boolean;
 onToggle:()=>void;
 marginLabel?:string|null;
 leverageLabel?:string|null;
 pnl:number|null|undefined;
 roi:number|null|undefined;
 shareAction?:React.ReactNode;
}
/** Original terminal Position Card header reused by both venues.
 * A missing exchange metric remains an em dash; never synthesize ROI/leverage.
 */
export default function HideDexPositionHeader(p:HideDexPositionHeaderProps){
 const colors:Record<string,string>={BTC:"#f7931a",ETH:"#627eea",SOL:"#9945ff"};
 const logoColor=colors[p.symbol]??"#2775ca";
 const knownPnl=p.pnl!==null&&p.pnl!==undefined&&Number.isFinite(p.pnl);
 const knownRoi=p.roi!==null&&p.roi!==undefined&&Number.isFinite(p.roi);
 return <div onClick={p.onToggle}
   className="flex items-center justify-between cursor-pointer select-none pb-1.5">
   <div className="flex items-center gap-2 min-w-0">
     <ChevronDown className={`w-3.5 h-3.5 text-brand-muted transition-transform duration-200 shrink-0 ${p.isExpanded?"rotate-180 text-brand-primary":""}`}/>
     <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:logoColor}}/>
     <span className="font-bold text-[13px] text-brand-text tracking-tight truncate">{p.symbol}-PERP</span>
     <span className={`px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider ${p.side==="LONG"?
       "bg-brand-profit/10 text-brand-profit border border-brand-profit/20":
       "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>{p.side}</span>
     <span className="text-[9px] text-brand-muted font-bold bg-brand-overlay-subtle px-1.5 py-0.2 rounded border border-brand-border/30">
       {p.marginLabel??"--"} {p.leverageLabel??"--"}
     </span>
   </div>
   <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
     {p.shareAction}
     <div className="text-right flex flex-col items-end shrink-0 select-none">
       <span className={`text-[13px] font-bold tracking-tight leading-none ${knownPnl&&Number(p.pnl)>=0?"text-pnl-profit":"text-pnl-loss"}`}>
         {knownPnl ? ((Number(p.pnl)>=0?"+$":"-$")+Math.abs(Number(p.pnl)).toFixed(2)) : "—"}
       </span>
       <span className={`text-[9px] font-bold mt-1 leading-none ${knownRoi&&Number(p.roi)>=0?"text-pnl-profit":"text-pnl-loss"}`}>
         {knownRoi?"ROI: "+(Number(p.roi)>=0?"+":"")+Number(p.roi).toFixed(2)+"%":""}
       </span>
     </div>
   </div>
 </div>;
}
