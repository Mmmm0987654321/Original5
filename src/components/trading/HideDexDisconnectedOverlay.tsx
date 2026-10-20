import React from "react";
import {Wallet} from "lucide-react";
/** The original not-connected order-form overlay. Never venue-specific. */
export default function HideDexDisconnectedOverlay(p:{
  title?:string;
  onConnect:()=>void;
}){
 return <div className="absolute inset-0 bg-brand-bg/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-2 text-center rounded-xl">
   <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-1.5">
     <Wallet className="w-4 h-4 text-indigo-400"/>
   </div>
   <h4 className="font-sans font-bold text-brand-text text-[10px] md:text-xs uppercase tracking-wider mb-0.5">{p.title??"Not Connected"}</h4>
   <p className="text-[9px] md:text-[10px] text-gray-500 max-w-[180px] leading-snug mb-2.5">Connect your wallet to trade.</p>
   <button type="button" onClick={p.onConnect} aria-label="Connect wallet to trade"
     className="w-full max-w-[130px] min-h-9 px-3 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-lg bg-accent hover:brightness-110 border border-brand-border shadow-md cursor-pointer transition-all active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
     style={{color:"var(--accent-foreground, #101010)"}}>
     Connect
   </button>
 </div>;
}
