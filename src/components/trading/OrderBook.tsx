/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import {
  useOrderBook,
} from "../../providers/WebSocketProvider";

interface OrderBookProps {
  symbol: string;
  marketCoin: string;
  currentPrice: number | null;
  onSelectPrice: (price: number) => void;
}

interface OrderBookRow {
  price: number;
  size: number;
  total: number;
}

function OrderBookComponent({
  symbol,
  marketCoin,
  currentPrice,
  onSelectPrice
}: OrderBookProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const limit = isMobile ? 8 : 14;

  const orderBook =
    useOrderBook(
      marketCoin
    );

  const [
    throttledBook,
    setThrottledBook
  ] =
    useState(
      orderBook
    );

  const latestBookRef =
    useRef(
      orderBook
    );

  useEffect(() => {
    latestBookRef.current =
      orderBook;
  }, [
    orderBook
  ]);

  useEffect(() => {
    const id =
      setInterval(() => {
        setThrottledBook(
          latestBookRef.current
        );
      }, 250);

    return () =>
      clearInterval(id);
  }, []);

  const [tickSize, setTickSize] = useState(0.1);
  const [flashType, setFlashType] = useState<"up" | "down" | null>(null);

  const l2AsksRef = useRef<HTMLDivElement>(null);
  const prevPriceRef = useRef<number | null>(currentPrice);
  const hasAutoScrolledRef = useRef<boolean>(false);

  useEffect(() => {
    hasAutoScrolledRef.current =
      false;
  }, [
    marketCoin,
    limit
  ]);

  const {
    bids,
    asks,
  } =
    useMemo(() => {
      const rawBids =
        (
          throttledBook?.bids ??
          []
        ).slice(
          0,
          limit
        );

      const rawAsks =
        (
          throttledBook?.asks ??
          []
        ).slice(
          0,
          limit
        );

      let bidAccum = 0;

      const mappedBids =
        rawBids.map(
          (level) => {
            const price =
              Number(
                level.px
              );

            const size =
              Number(
                level.sz
              );

            bidAccum +=
              size;

            return {
              price,
              size,
              total:
                bidAccum,
            };
          }
        );

      let askAccum = 0;

      const mappedAsks =
        rawAsks.map(
          (level) => {
            const price =
              Number(
                level.px
              );

            const size =
              Number(
                level.sz
              );

            askAccum +=
              size;

            return {
              price,
              size,
              total:
                askAccum,
            };
          }
        );

      return {
        bids:
          mappedBids,

        asks:
          mappedAsks.reverse(),
      };
    }, [
      throttledBook?.bids,
      throttledBook?.asks,
      limit,
    ]);

  useEffect(() => {
    if (asks.length > 0 && !hasAutoScrolledRef.current && l2AsksRef.current) {
      l2AsksRef.current.scrollTop = l2AsksRef.current.scrollHeight;
      hasAutoScrolledRef.current = true;
    }
  }, [asks]);

  // Flash color indicators on real price movement
  useEffect(() => {
    if (!currentPrice || currentPrice === prevPriceRef.current) return;
    const isUp = typeof prevPriceRef.current === "number" && currentPrice > prevPriceRef.current;
    prevPriceRef.current = currentPrice;
    setFlashType(isUp ? "up" : "down");
    const timeout = setTimeout(() => setFlashType(null), 300);
    return () => clearTimeout(timeout);
  }, [currentPrice]);

  const maxTotal = Math.max(
    bids[bids.length - 1]?.total || 1,
    asks[0]?.total || 1,
    1
  );

  const calculateSpread = () => {
    if (bids.length === 0 || asks.length === 0) return { spread: 0, percent: 0 };
    const lowestAsk = asks[asks.length - 1].price;
    const highestBid = bids[0].price;
    const spread = lowestAsk - highestBid;
    const percent = highestBid > 0 ? (spread / highestBid) * 100 : 0;
    return { spread, percent };
  };

  const { spread, percent } = calculateSpread();

  const formattedPrice = (price: number | null) => {
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return "--";
    return price.toLocaleString(undefined, {
      minimumFractionDigits: symbol === "PURR" ? 4 : 2,
      maximumFractionDigits: symbol === "PURR" ? 4 : 2,
    });
  };

  const formattedSize = (size: number) => {
    return size.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  const hasLevels = asks.length > 0 || bids.length > 0;

  return (
    <div className="bg-brand-bg/80 border border-brand-border rounded-2xl p-2 sm:p-2.5 flex flex-col h-auto sm:h-[550px] relative overflow-hidden">
      <div className="flex-grow flex flex-col min-h-0 sm:h-full overflow-hidden">
        {/* Title & tick controls */}
        <div className="flex items-center justify-between border-b border-brand-border pb-1.5 mb-1.5 sm:pb-2.5 sm:mb-2 flex-shrink-0 select-none">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-bold text-brand-text text-xs sm:text-sm uppercase tracking-wider">L2 Book</span>
          </div>
          <select
            value={tickSize}
            onChange={(e) => setTickSize(Number(e.target.value))}
            className="h-6 sm:h-7 bg-brand-surface dark:bg-black/60 border border-brand-border px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-mono text-gray-300 hover:text-brand-text focus:outline-none focus:border-accent cursor-pointer transition-colors"
          >
            <option value={0.01}>0.01 tick</option>
            <option value={0.1}>0.1 tick</option>
            <option value={1.0}>1.0 tick</option>
          </select>
        </div>

        {/* Labels header */}
        <div className="grid grid-cols-3 text-[10px] font-mono text-gray-500 font-bold mb-1 px-1.5 uppercase flex-shrink-0 select-none">
          <span>Price (USDC)</span>
          <span className="text-right">Size ({symbol.replace("-PERP", "").replace("-SPOT", "")})</span>
          <span className="text-right">Total</span>
        </div>

        {!hasLevels ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 font-mono text-xs text-brand-muted">
            <Loader2 className="w-5 h-5 animate-spin text-accent mb-2" />
            <span>Loading live L2 order book...</span>
          </div>
        ) : (
          <>
            {/* Asks (Sells) */}
            <div className="flex-initial sm:flex-1 flex flex-col justify-end overflow-hidden min-h-0 pr-1" id="l2-asks-scroll-container" ref={l2AsksRef}>
              <div className="space-y-0.5 w-full">
                {asks.map((ask, idx) => {
                  const depthPct = Math.min(100, Math.max(8, (ask.total / maxTotal) * 100));
                  return (
                     <div
                       key={`ask-${idx}`}
                       onClick={() => onSelectPrice(ask.price)}
                       className="grid grid-cols-3 text-xs font-mono py-0.5 px-1.5 rounded hover:bg-rose-500/10 cursor-pointer relative transition-colors group overflow-hidden"
                     >
                       <div
                         className="absolute right-0 top-0 bottom-0 bg-[#e2445c]/25 group-hover:bg-[#e2445c]/35 border-l-2 border-[#e2445c]/40 transition-all pointer-events-none rounded-r"
                         style={{ width: `${depthPct}%` }}
                       />
                       <span className="text-[#ff4d4d] font-bold relative z-10">{formattedPrice(ask.price)}</span>
                       <span className="text-right text-gray-200 relative z-10">{formattedSize(ask.size)}</span>
                       <span className="text-right text-gray-400 relative z-10">{ask.total.toFixed(2)}</span>
                     </div>
                  );
                })}
              </div>
            </div>

            {/* Mid market spread indicator */}
            <div className={`flex-shrink-0 my-0.5 py-1 border-y border-brand-border flex items-center justify-between px-2 font-mono transition-all duration-300 select-none ${
              flashType === "up" ? "bg-emerald-500/15 text-emerald-400" :
              flashType === "down" ? "bg-rose-500/15 text-rose-400" :
              "bg-brand-bg/50 text-white-absolute"
            }`}>
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                {flashType === "down" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0 ? `$${formattedPrice(currentPrice)}` : "--"}</span>
              </div>
              <span className="text-[9px] text-gray-500 font-semibold uppercase">
                {spread > 0 ? `Spread: $${spread.toFixed(2)} (${percent.toFixed(2)}%)` : "Spread: --"}
              </span>
            </div>

            {/* Bids (Buys) */}
            <div className="flex-initial sm:flex-1 flex flex-col justify-start overflow-hidden min-h-0 pr-1" id="l2-bids-scroll-container">
              <div className="space-y-0.5 w-full">
                {bids.map((bid, idx) => {
                  const depthPct = Math.min(100, Math.max(8, (bid.total / maxTotal) * 100));
                  return (
                    <div
                      key={`bid-${idx}`}
                      onClick={() => onSelectPrice(bid.price)}
                      className="grid grid-cols-3 text-xs font-mono py-0.5 px-1.5 rounded hover:bg-emerald-500/10 cursor-pointer relative transition-colors group overflow-hidden"
                    >
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-[#18c29c]/25 group-hover:bg-[#18c29c]/35 border-l-2 border-[#18c29c]/40 transition-all pointer-events-none rounded-r"
                        style={{ width: `${depthPct}%` }}
                      />
                      <span className="text-[#18c29c] font-bold relative z-10">{formattedPrice(bid.price)}</span>
                      <span className="text-right text-gray-200 relative z-10">{formattedSize(bid.size)}</span>
                      <span className="text-right text-gray-400 relative z-10">{bid.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(OrderBookComponent);
