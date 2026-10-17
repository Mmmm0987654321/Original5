import React from "react";
import {HideDexTradeGrid, HideDexOrderForm, HideDexTopMarketPane} from "./HideDexTradeLayout";

/** Entire ORIGINAL HideDex trading viewport structure.
 * This is the ONLY renderer of chart/order book pane + trade/order book
 * mobile grid + account tabs on Hyperliquid and Lighter.
 * Content and commands are venue-specific React nodes; no SDK is imported.
 */
export default function HideDexUnifiedTradeCanvas(p:{
 marketView:React.ReactNode;
 orderForm:React.ReactNode;
 orderBook:React.ReactNode;
 account:React.ReactNode;
}){
 return <>
   <HideDexTopMarketPane>{p.marketView}</HideDexTopMarketPane>
   <HideDexTradeGrid>
     <HideDexOrderForm>{p.orderForm}</HideDexOrderForm>
     {p.orderBook}
   </HideDexTradeGrid>
   {p.account}
 </>;
}
