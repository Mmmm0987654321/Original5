/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import HideDexMobileL2Book from "./HideDexMobileL2Book";
import { TokenMetadata } from "../../types";

interface TopOrderBookViewProps {
  symbol: string;
  currentToken: TokenMetadata;
  asks: { price: number; size: number; total: number }[];
  bids: { price: number; size: number; total: number }[];
  onSelectPrice?: (price: number) => void;
  priceDecimals?: number;
  quoteSymbol?:string;
}

export const TopOrderBookView: React.FC<TopOrderBookViewProps> = React.memo(({
  symbol,
  currentToken,
  asks,
  bids,
  onSelectPrice,
  priceDecimals,
  quoteSymbol="USDC",
}) => {
  const isPurr = symbol.toUpperCase() === "PURR";
  const decimals = priceDecimals !== undefined && Number.isInteger(priceDecimals) && priceDecimals >= 0 && priceDecimals <= 12 ? priceDecimals : isPurr ? 4 : 2;

  const hasAsks = asks.length > 0;
  const hasBids = bids.length > 0;

  const hasPrice = typeof currentToken.price === "number" && Number.isFinite(currentToken.price);
  const topAsk = hasAsks ? asks[asks.length - 1]?.price : (hasPrice ? currentToken.price : null);
  const topBid = hasBids ? bids[0]?.price : (hasPrice ? currentToken.price : null);
  const spread = (hasAsks && hasBids && topAsk !== null && topBid !== null) ? Math.max(0, topAsk - topBid) : 0;
  const spreadPercent = (hasAsks && hasBids && topAsk !== null && topAsk > 0) ? (spread / topAsk) * 100 : 0;

  const maxAskTotal = asks[0]?.total || 1;
  const maxBidTotal = bids[bids.length - 1]?.total || 1;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const levelLimit = isMobile ? 6 : 10;

  return (<>
    <div className="md:hidden">
      <HideDexMobileL2Book symbol={symbol} asks={asks} bids={bids}
        lastPrice={hasPrice ? currentToken.price : null} decimals={decimals}
        onSelectPrice={onSelectPrice}/>
    </div>
    <div className="hidden md:block">
    <div className="w-full bg-brand-surface text-brand-text rounded-xl p-3 sm:p-4 font-mono border border-brand-border shadow-md min-h-[380px] flex flex-col justify-between select-none">
      {/* Top Info Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-brand-border text-xs">
        <div className="flex items-center gap-3">
          <span className="font-sans font-black text-brand-text text-sm sm:text-base">
            ORDER BOOK <span className="text-brand-sub font-medium">({symbol}/{quoteSymbol})</span>
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-brand-sub font-semibold">
            <span>Spread: <strong className="text-brand-text">{spread > 0 ? `$${spread.toFixed(decimals)} (${spreadPercent.toFixed(3)}%)` : "--"}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Live Depth
          </span>
        </div>
      </div>

      {/* Main Order Book Grid (2 Columns: Asks Left / Bids Right on Tablet/Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 flex-grow min-h-0">
        {/* ASKS (SELL ORDERS) */}
        <div className="flex flex-col bg-brand-bg rounded-xl p-2.5 sm:p-3 border border-brand-border min-h-0">
          <div className="flex items-center justify-between text-[11px] font-sans font-bold text-brand-sub uppercase tracking-wider pb-2 border-b border-brand-border mb-1.5">
            <span className="text-rose-600 dark:text-rose-400 font-black">Asks (Sell)</span>
            <span>Size ({symbol})</span>
            <span>Total ({quoteSymbol})</span>
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[260px] pr-1 scrollbar-thin">
            {hasAsks ? (
              asks.slice(0, levelLimit).map((ask, i) => {
                const depthPct = Math.min(100, (ask.total / maxAskTotal) * 100);
                return (
                  <div
                    key={`top-ask-${i}`}
                    onClick={() => onSelectPrice?.(ask.price)}
                    className="relative flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-brand-overlay-normal cursor-pointer group transition-colors"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/15 dark:bg-rose-500/20 group-hover:bg-rose-500/30 transition-colors pointer-events-none rounded-r"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="text-rose-600 dark:text-rose-400 font-bold z-10">${ask.price.toFixed(decimals)}</span>
                    <span className="text-brand-text font-semibold z-10">{ask.size.toFixed(3)}</span>
                    <span className="text-brand-sub text-[11px] font-medium z-10">${(ask.price * ask.size).toFixed(1)}</span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-brand-muted font-sans">
                Connecting to live L2 order book...
              </div>
            )}
          </div>
        </div>

        {/* BIDS (BUY ORDERS) */}
        <div className="flex flex-col bg-brand-bg rounded-xl p-2.5 sm:p-3 border border-brand-border min-h-0">
          <div className="flex items-center justify-between text-[11px] font-sans font-bold text-brand-sub uppercase tracking-wider pb-2 border-b border-brand-border mb-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-black">Bids (Buy)</span>
            <span>Size ({symbol})</span>
            <span>Total ({quoteSymbol})</span>
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[260px] pr-1 scrollbar-thin">
            {hasBids ? (
              bids.slice(0, levelLimit).map((bid, i) => {
                const depthPct = Math.min(100, (bid.total / maxBidTotal) * 100);
                return (
                  <div
                    key={`top-bid-${i}`}
                    onClick={() => onSelectPrice?.(bid.price)}
                    className="relative flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-brand-overlay-normal cursor-pointer group transition-colors"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 dark:bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors pointer-events-none rounded-r"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold z-10">${bid.price.toFixed(decimals)}</span>
                    <span className="text-brand-text font-semibold z-10">{bid.size.toFixed(3)}</span>
                    <span className="text-brand-sub text-[11px] font-medium z-10">${(bid.price * bid.size).toFixed(1)}</span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-brand-muted font-sans">
                Connecting to live L2 order book...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex items-center justify-between pt-2.5 border-t border-brand-border text-[11px] sm:text-xs text-brand-sub">
        <div className="flex items-center gap-2">
          <span>Mark Price: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{typeof currentToken.price === "number" && Number.isFinite(currentToken.price) ? `$${currentToken.price.toFixed(decimals)}` : "--"}</strong></span>
        </div>
        <div className="text-[10px] text-brand-muted font-sans">
          Click any price row to fill order price
        </div>
      </div>
    </div>
    </div>
  </>);
});

export default TopOrderBookView;
