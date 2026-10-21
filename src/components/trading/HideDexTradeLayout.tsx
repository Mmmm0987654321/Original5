import React from "react";

/** One original HideDex terminal geometry for both exchange adapters.
 * No signing, market data, order execution or exchange state is implemented here.
 */
export function HideDexTradeGrid({children}:{children:React.ReactNode}) {
  return <div id="terminal-trade-grid" className="grid grid-cols-12 gap-1.5 md:gap-2 mb-1.5 items-stretch w-full min-w-0" style={{display:"grid"}}>{children}</div>;
}
export function HideDexOrderForm({children}:{children:React.ReactNode}) {
  return <div id="terminal-order-form"
    className="col-span-7 min-w-0 bg-brand-bg border border-brand-border rounded-xl p-1.5 md:p-2.5 flex flex-col h-full shadow-lg relative">
    {children}
  </div>;
}

/** Original desktop/tablet chart and Order Book host shared by all venues. */
export function HideDexTopMarketPane({children}:{children:React.ReactNode}) {
  return <div id="terminal-top-chart-panel"
    className="hidden md:block mb-1.5 md:mb-2 bg-brand-bg border border-brand-border rounded-xl p-1 md:p-2 shadow-xl overflow-visible">
    {children}
  </div>;
}
