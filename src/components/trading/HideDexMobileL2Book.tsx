import React,{useMemo,useState} from "react";
import type {HideDexBookLevel} from "./HideDexOrderBookPanel";

/** Original HideDex screenshot's compact mobile L2 ladder for BOTH venues.
 * Groups only real provided depth levels; never creates synthetic orders.
 */
export default function HideDexMobileL2Book(p:{
 symbol:string; asks:readonly HideDexBookLevel[];bids:readonly HideDexBookLevel[];
 lastPrice:number|null;decimals:number;onSelectPrice?:(price:number)=>void;
}) {
 const [tick,setTick]=useState(0.1);
 const group=useMemo(()=>{
   const groupSide=(levels:readonly HideDexBookLevel[],side:"ask"|"bid")=>{
     const buckets=new Map<number,number>();
     for(const level of levels){
       if(!Number.isFinite(level.price)||level.price<=0||!Number.isFinite(level.size)||level.size<0)continue;
       const n=side==="ask"?Math.ceil(level.price/tick-1e-8):Math.floor(level.price/tick+1e-8);
       const price=Number((n*tick).toFixed(10));
       buckets.set(price,(buckets.get(price)??0)+level.size);
     }
     let total=0;
     const closest=[...buckets.entries()].sort((a,b)=>side==="ask"?a[0]-b[0]:b[0]-a[0]).slice(0,8);
     const rows=closest.map(([price,size])=>({price,size,total:(total+=size)}));
     return side==="ask"?rows.reverse():rows;
   };
   return {asks:groupSide(p.asks,"ask"),bids:groupSide(p.bids,"bid")};
 },[p.asks,p.bids,tick]);
 const maxTotal=Math.max(1,...group.asks.map(x=>x.total),...group.bids.map(x=>x.total));
 const bestAsk=group.asks.length?group.asks[group.asks.length-1].price:null;
 const bestBid=group.bids.length?group.bids[0].price:null;
 const spread=bestAsk!==null&&bestBid!==null?Math.max(0,bestAsk-bestBid):null;
 const last=p.lastPrice!=null&&Number.isFinite(p.lastPrice)&&p.lastPrice>0?p.lastPrice:bestBid;
 const dec=Math.min(8,Math.max(p.decimals,1));
 const row=(level:HideDexBookLevel,isAsk:boolean)=><button key={(isAsk?"a":"b")+level.price}
   type="button" onClick={()=>p.onSelectPrice?.(level.price)}
   className="relative grid grid-cols-[1.2fr_1fr_1fr] items-center gap-1 text-left text-[11px] font-mono w-full py-1 px-0.5 rounded overflow-hidden hover:bg-brand-overlay-subtle">
   <div aria-hidden className={`absolute right-0 inset-y-0 rounded-r pointer-events-none ${isAsk?"bg-rose-500/20":"bg-emerald-500/20"}`}
     style={{width:Math.min(100,Math.max(6,100*level.total/maxTotal))+"%"}}/>
   <span className={`z-10 font-bold truncate ${isAsk?"text-rose-400":"text-emerald-400"}`}>
     {level.price.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec})}
   </span>
   <span className="z-10 font-semibold text-right text-brand-text truncate">{level.size.toFixed(3)}</span>
   <span className="z-10 text-right text-brand-sub truncate">{level.total.toFixed(2)}</span>
 </button>;
 return <div data-mobile-l2-book="true" className="bg-brand-surface border border-brand-border rounded-xl p-3 shadow-md font-mono text-brand-text select-none">
   <div className="flex items-center justify-between border-b border-brand-border pb-2 gap-2">
     <strong className="font-sans font-black text-base">L2 BOOK</strong>
     <label className="sr-only" htmlFor="hidedex-l2-tick">Book price tick</label>
     <select id="hidedex-l2-tick" aria-label="Book price tick" value={tick}
       onChange={e=>setTick(Number(e.target.value))}
       className="bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-xs font-mono text-brand-text">
       {[0.01,0.1,1,2,5,10].map(t=><option key={t} value={t}>{t} tick</option>)}
     </select>
   </div>
   <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-1 text-[10px] font-bold text-brand-muted uppercase border-b border-brand-border py-2">
     <span>PRICE (USDC)</span><span className="text-right">SIZE ({p.symbol})</span><span className="text-right">TOTAL</span>
   </div>
   <div className="flex flex-col justify-end min-h-[175px] gap-0.5 py-1">
     {group.asks.length?group.asks.map(x=>row(x,true)):
       <span className="text-xs text-brand-muted py-8 text-center">Waiting for real sell orders…</span>}
   </div>
   <div className="border-y border-brand-border py-1.5 flex justify-between items-center gap-2">
     <span className="text-sm font-bold text-emerald-400">{last===null?"—":"↑ $"+last.toLocaleString(undefined,{maximumFractionDigits:8})}</span>
     <span className="text-brand-muted text-[10px]">SPREAD: {spread===null?"—":"$"+spread.toFixed(dec)}</span>
   </div>
   <div className="flex flex-col justify-start min-h-[175px] gap-0.5 py-1">
     {group.bids.length?group.bids.map(x=>row(x,false)):
       <span className="text-xs text-brand-muted py-8 text-center">Waiting for real buy orders…</span>}
   </div>
 </div>;
}
