/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";

interface RecentTradesProps {
  symbol: string;
  currentPrice: number | null;
}

interface Trade {
  id: string;
  time: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
}

function RecentTradesComponent({ symbol, currentPrice }: RecentTradesProps) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    setTrades([]);
  }, [symbol]);

  const formattedPrice = (price: number) => {
    return price.toLocaleString(undefined, {
      minimumFractionDigits: symbol === "PURR" ? 4 : 2,
      maximumFractionDigits: symbol === "PURR" ? 4 : 2,
    });
  };

  const formattedSize = (size: number) => {
    return size.toLocaleString(undefined, {
      minimumFractionDigits: symbol === "PURR" ? 1 : 4,
      maximumFractionDigits: symbol === "PURR" ? 2 : 4,
    });
  };

  return (
    <div className="bg-brand-bg/80 border border-brand-border rounded-2xl p-2 sm:p-2.5 flex flex-col h-[550px] relative overflow-hidden">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-brand-border pb-2 mb-2 flex-shrink-0 select-none">
          <span className="font-display font-bold text-brand-text text-xs sm:text-sm uppercase tracking-wider">Live Trades</span>
        </div>

        <div className="grid grid-cols-3 text-[10px] font-mono text-gray-500 font-bold mb-1 px-1.5 uppercase flex-shrink-0 select-none">
          <span>Price (USDC)</span>
          <span className="text-right">Size ({symbol})</span>
          <span className="text-right">Time</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-0">
          <div className="space-y-0.5">
            {trades.map((trade, idx) => (
              <div
                key={`trade-${idx}`}
                className="grid grid-cols-3 text-xs font-mono py-0.5 px-1.5 rounded hover:bg-brand-overlay-subtle transition-colors align-center"
              >
                <span className={trade.side === "BUY" ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                  ${formattedPrice(trade.price)}
                </span>
                <span className="text-right text-gray-300">
                  {formattedSize(trade.size)}
                </span>
                <span className="text-right text-gray-500 text-[11px]">
                  {trade.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(RecentTradesComponent);
