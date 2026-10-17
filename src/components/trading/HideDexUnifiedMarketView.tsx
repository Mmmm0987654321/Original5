import React from "react";
/** The single HideDex Chart / Order Book / Trades view switch.
 * Each exchange only supplies its real market content; no venue-specific
 * chart host or alternative orderbook UI can be rendered by this component.
 */
export default function HideDexUnifiedMarketView(p:{
 view:"chart"|"orderbook"|"trades";
 chart:React.ReactNode;
 orderBook:React.ReactNode;
 trades?:React.ReactNode;
}){
 if(p.view==="chart")return <>{p.chart}</>;
 if(p.view==="orderbook")return <>{p.orderBook}</>;
 return <>{p.trades??p.chart}</>;
}
