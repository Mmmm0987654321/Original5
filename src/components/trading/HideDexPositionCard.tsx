import React from "react";
/** The single original HideDex position-card surface shared by
 * Hyperliquid and Lighter. Venues supply verified numbers and actions.
 * Do not synthesize unknown leverage, ROI, margin or price.
 */
export default function HideDexPositionCard({
  children,id,
}:{
  children:React.ReactNode;
  id?:string;
}){
  return <div
    id={id}
    className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 md:p-4 transition-all duration-150 shadow-md flex flex-col gap-2.5 w-full text-xs font-mono text-brand-sub">
    {children}
  </div>;
}
