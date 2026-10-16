/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TokenMetadata } from "../../types";

export interface LiveTradeItem {
  time: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  total: number;
  id: string;
}

interface TopTradesViewProps {
  symbol: string;
  currentToken: TokenMetadata;
  liveTrades: LiveTradeItem[];
}

export const TopTradesView: React.FC<TopTradesViewProps> = React.memo(({
  symbol,
  currentToken,
  liveTrades,
}) => {
  const isPurr = symbol.toUpperCase() === "PURR";
  const decimals = isPurr ? 4 : 2;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const maxTrades = isMobile ? 20 : 40;
  const displayedTrades = liveTrades.slice(0, maxTrades);

  return (
    <div className="w-full bg-brand-surface text-brand-text rounded-xl p-3 sm:p-4 font-mono border border-brand-border shadow-md min-h-[380px] flex flex-col justify-between select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-brand-border text-xs">
        <div className="flex items-center gap-3">
          <span className="font-sans font-black text-brand-text text-sm sm:text-base">
            RECENT TRADES <span className="text-brand-sub font-medium">({symbol}/USDC)</span>
          </span>
        </div>
      </div>

      {/* Trades Table */}
      <div className="my-2 flex-grow min-h-0 flex flex-col bg-brand-bg rounded-xl p-2.5 sm:p-3 border border-brand-border">
        {/* Column Headers */}
        <div className="grid grid-cols-5 text-[11px] font-sans font-bold text-brand-sub uppercase tracking-wider pb-2 border-b border-brand-border mb-1.5">
          <span>Time</span>
          <span>Side</span>
          <span className="text-right">Price ($)</span>
          <span className="text-right">Size ({symbol})</span>
          <span className="text-right">Value ($)</span>
        </div>

        {/* Trades Rows */}
        <div className="space-y-1 overflow-y-auto max-h-[280px] pr-1 scrollbar-thin">
          {displayedTrades.length > 0 ? (
            displayedTrades.map((t, idx) => {
              const isBuy = t.side === "BUY";
              return (
                <div
                  key={`top-trade-${t.id}-${idx}`}
                  className="grid grid-cols-5 text-xs py-1 px-1.5 rounded hover:bg-brand-overlay-normal transition-colors items-center font-mono"
                >
                  <span className="text-brand-sub text-[11px] font-medium">{t.time}</span>
                  <div>
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                        isBuy
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {t.side}
                    </span>
                  </div>
                  <span className={`text-right font-bold ${isBuy ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    ${t.price.toFixed(decimals)}
                  </span>
                  <span className="text-right text-brand-text font-bold">{t.size.toFixed(3)}</span>
                  <span className="text-right text-brand-sub text-[11px] font-medium">${t.total.toFixed(2)}</span>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-brand-muted text-xs">
              Waiting for live market trades...
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-2.5 border-t border-brand-border text-[11px] sm:text-xs text-brand-sub">
        <div className="flex items-center gap-3">
          <span>24h Vol: <strong className="text-brand-text font-bold">{typeof currentToken?.volume24h === "number" && Number.isFinite(currentToken.volume24h) ? `$${currentToken.volume24h.toLocaleString()}` : "--"}</strong></span>
        </div>
      </div>
    </div>
  );
});

export default TopTradesView;
