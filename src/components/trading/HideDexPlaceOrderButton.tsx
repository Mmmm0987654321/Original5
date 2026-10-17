import React from "react";
/** The original HideDex Place order control, shared unchanged by both venues.
 * Venue parents own validation, signing and submit handlers.
 */
type Props={
  type:"submit"|"button";
  onClick?:React.MouseEventHandler<HTMLButtonElement>;
  disabled:boolean;
  side:"BUY"|"SELL";
  busy?:boolean;
  tapped?:boolean;
  children:React.ReactNode;
};
export default function HideDexPlaceOrderButton({
  type,onClick,disabled,side,busy=false,tapped=false,children,
}:Props){
  return <button type={type} onClick={onClick} disabled={disabled}
    className={`w-full py-2 rounded-lg text-[10px] md:text-xs font-display font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${tapped ? "scale-[0.98] brightness-[0.92] ring-2 ring-inset ring-white/50" : ""} ${busy ? "disabled:opacity-100 disabled:cursor-default" : "disabled:opacity-50 disabled:cursor-not-allowed"} ${
      side === "BUY"
        ? "bg-[#18c29c] hover:bg-[#15b390] text-[#030610] shadow-md shadow-[#18c29c]/10"
        : "bg-[#f25c5c] hover:bg-[#e05252] text-brand-text shadow-md shadow-[#f25c5c]/10"
    }`}>
    {children}
  </button>;
}
