import React from "react";

/** One original HideDex terminal geometry for both exchange adapters.
 * No signing, market data, order execution or exchange state is implemented here.
 */
export function HideDexTradeGrid({children}:{children:React.ReactNode}) {
  return <div className="grid grid-cols-12 gap-1.5 md:gap-2 mb-1.5 items-start">{children}</div>;
}
export function HideDexOrderForm({children}:{children:React.ReactNode}) {
  return <div id="terminal-order-form"
    className="col-span-7 min-w-0 self-start bg-brand-bg border border-brand-border rounded-xl p-1.5 md:p-2.5 flex flex-col gap-2 shadow-lg relative">
    {children}
  </div>;
}
