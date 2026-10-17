import React from "react";
/** Single original HideDex account panel shell on both venues.
 * Balances, positions, orders and modals use the existing trusted components;
 * each venue supplies only authoritative data and callbacks.
 */
export default function HideDexUnifiedAccountPanel(p:{
 tabs:React.ReactNode;
 actions?:React.ReactNode;
 children:React.ReactNode;
 modals?:React.ReactNode;
}){
 return <div className="bg-brand-bg border border-brand-border rounded-xl overflow-hidden shadow-xl"
   id="terminal-dashboard-panel-unified">
   {p.tabs}
   {p.actions}
   <div className="p-2 md:p-3 min-h-[110px] overflow-y-auto overflow-x-hidden relative">
     {p.children}
   </div>
   {p.modals}
 </div>;
}
