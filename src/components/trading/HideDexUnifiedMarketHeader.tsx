import React from "react";
import HideDexMobileMarketHeader from "./HideDexMobileMarketHeader";
import HideDexDesktopMarketBar from "./HideDexDesktopMarketBar";
import HideDexMarketInfoDropdown from "./HideDexMarketInfoDropdown";

/** ONE original HideDex market-header renderer for every exchange.
 * All exchange-specific data, onClick actions and market selection remain caller-owned.
 * The Lighter trading page must never implement its own market-header JSX.
 */
export default function HideDexUnifiedMarketHeader(p:{
  mobile:React.ComponentProps<typeof HideDexMobileMarketHeader>;
  desktop:React.ComponentProps<typeof HideDexDesktopMarketBar>;
  info:React.ComponentProps<typeof HideDexMarketInfoDropdown>;
  showChartToolbar:boolean;
}){
  return <>
    <HideDexMobileMarketHeader {...p.mobile}/>
    <div className="hidden md:block relative glass-panel rounded-xl border border-brand-border bg-brand-surface py-1.5 px-2 sm:px-2.5 select-none shadow-sm mb-1.5 md:mb-2" id="terminal-unified-market-header">
      <HideDexDesktopMarketBar {...p.desktop}/>
      {p.desktop.marketInfoOpen && <HideDexMarketInfoDropdown {...p.info}/>}
      {p.showChartToolbar && <>
        <div className="w-full h-px bg-brand-border/60 my-1 sm:my-1.5"/>
        <div id="market-chart-toolbar-host" className="w-full min-w-0 flex items-center min-h-[28px] border-b border-brand-border/40"/>
      </>}
    </div>
  </>;
}
