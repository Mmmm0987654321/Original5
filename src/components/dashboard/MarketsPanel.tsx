/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronDown, 
  Search, 
  Star, 
  RefreshCw, 
  X, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Activity, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  Layers, 
  Settings, 
  Eye, 
  EyeOff,
  Wallet,
  Coins
} from "lucide-react";
import { TokenMetadata, ActiveTab, Position, OpenOrder, TradeHistoryItem, getPerpLeverageFormatted } from "../../types";
import { getSpotAssetData } from "../../lib/hyperliquid";
import { useLiveAssetCtxs, useLivePrices } from "../../providers/WebSocketProvider";

import TVChart from "../trading/TVChart";
import OrderBook from "../trading/OrderBook";
import TradingDashboardTabs from "../trading/TradingDashboardTabs";
import MarketSelector, {
  renderAssetLogo,
} from "../trading/MarketSelector";
import ClosePositionModal from "../trading/ClosePositionModal";

interface MarketsPanelProps {
  tokens: TokenMetadata[];
  onSelectToken: (symbol: string, mode: "spot" | "perp" | "prediction") => void;
  setActiveTab?: (tab: ActiveTab) => void;
  watchlist?: string[];
  onToggleWatchlist?: (symbol: string) => void;
  
  // Custom trading states passed from parent
  selectedSymbol?: string;
  setSelectedSymbol?: (symbol: string) => void;
  positions?: Position[];
  openOrders?: OpenOrder[];
  tradeHistory?: TradeHistoryItem[];
  fundingHistory?: any[];
  onCancelOrder?: (id: string) => Promise<void> | void;
  onCancelAllOrders?: () => Promise<void> | void;
  onClosePosition?: (position: Position, closePercent: number) => Promise<void> | void;
  onCloseAllPositions?: () => Promise<void> | void;
  spotAvailableBalances?: Record<string, number>;
  onCloseSpotPosition?: (baseSymbol: string) => Promise<void> | void;
  onCloseAllSpotPositions?: () => Promise<void> | void;
  onModifyOrder?: (id: string, newPrice: number, newSize: number) => void;
  balanceUSDC?: number;
  walletConnected?: boolean;
  tokenBalances?: Record<string, number>;
  walletAddress?: string;
  onConnectWallet?: () => void;
  setupComplete?: boolean;
  hasBalance?: boolean;
  onSetupRequired?: () => void;
  onSelectOrderBookPrice?: (price: number, mode: "spot" | "perp") => void;
}

export default function MarketsPanel({
  tokens = [],
  onSelectToken,
  setActiveTab,
  watchlist,
  onToggleWatchlist,
  selectedSymbol = "",
  setSelectedSymbol = () => {},
  positions = [],
  openOrders = [],
  tradeHistory = [],
  fundingHistory = [],
  onCancelOrder = () => {},
  onCancelAllOrders = () => {},
  onClosePosition = () => {},
  onCloseAllPositions = () => {},
  spotAvailableBalances,
  onCloseSpotPosition,
  onCloseAllSpotPositions,
  onModifyOrder = () => {},
  balanceUSDC = 0,
  walletConnected = false,
  tokenBalances,
  walletAddress = "",
  onConnectWallet = () => {},
  setupComplete = false,
  hasBalance = false,
  onSetupRequired = () => {},
  onSelectOrderBookPrice = () => {},
}: MarketsPanelProps) {
  // Navigation tabs inside the terminal
  const [activeCenterTab, setActiveCenterTab] = useState<"CHART" | "ORDER_BOOK">("CHART");

  // Close Position Modal state
  const [selectedClosePosition, setSelectedClosePosition] = useState<Position | null>(null);

  // Coin selection dropdown state
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Market info dropdown state
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const infoDropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside of asset selector
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInsideMarketSelector =
        target instanceof Element &&
        target.closest('[data-market-selector-portal="true"]');

      if (
        !isInsideMarketSelector &&
        selectorRef.current &&
        !selectorRef.current.contains(e.target as Node)
      ) {
        setIsSelectorOpen(false);
      }
    };
    if (isSelectorOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSelectorOpen]);

  // Handle click outside of info dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInsideInfoDropdown =
        target instanceof Element &&
        Boolean(target.closest('[data-market-info-dropdown="true"]'));

      if (
        !isInsideInfoDropdown &&
        infoDropdownRef.current &&
        !infoDropdownRef.current.contains(e.target as Node)
      ) {
        setIsInfoOpen(false);
      }
    };
    if (isInfoOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInfoOpen]);

  // Find currently active token safely from live tokens list
  const currentToken: TokenMetadata | null = React.useMemo(() => {
    return tokens.find((t) => t.symbol === selectedSymbol) || tokens[0] || null;
  }, [tokens, selectedSymbol]);

  const chartIsSpot =
    currentToken?.isSpotOnly ===
    true;

  const chartMarketCoin =
    React.useMemo(() => {
      if (!currentToken) {
        return "";
      }

      if (
        currentToken.isSpotOnly ===
        true
      ) {
        return currentToken
          .spotSymbol
          ? String(
              currentToken
                .spotSymbol
            )
          : "";
      }

      if (
        currentToken
          .displayBaseAsset
      ) {
        return String(
          currentToken
            .displayBaseAsset
        );
      }

      if (
        currentToken
          .sourceCoin
      ) {
        return String(
          currentToken
            .sourceCoin
        );
      }

      return "";
    }, [
      currentToken,
    ]);

  const {
    data:
      marketsSpotAssetData,
  } = useQuery({
    queryKey: [
      "hl_spot_asset",
      chartMarketCoin,
    ],

    queryFn:
      () =>
        getSpotAssetData(
          chartMarketCoin
        ),

    enabled:
      chartIsSpot &&
      !!chartMarketCoin,

    staleTime:
      10_000,

    refetchInterval:
      30_000,
  });

  const chartCandleCoin =
    React.useMemo(() => {
      if (chartIsSpot) {
        return marketsSpotAssetData?.spotSymbol || "";
      }
      return currentToken?.sourceCoin || "";
    }, [
      chartIsSpot,
      marketsSpotAssetData?.spotSymbol,
      currentToken?.sourceCoin,
    ]);

  const marketsLiveCoins =
    React.useMemo(
      () => {
        const coins:
          string[] = [];

        if (
          chartIsSpot
        ) {
          if (
            marketsSpotAssetData
              ?.spotSymbol
          ) {
            coins.push(
              String(
                marketsSpotAssetData
                  .spotSymbol
              )
            );
          }
        } else if (
          chartMarketCoin
        ) {
          coins.push(
            String(
              chartMarketCoin
            )
          );
        }

        const uniq: string[] =
          Array.from(
            new Set(coins)
          ).filter(Boolean) as string[];

        uniq.sort();

        return uniq;
      },
      [
        chartIsSpot,
        chartMarketCoin,
        marketsSpotAssetData
          ?.spotSymbol,
      ],
    );

  const marketsLivePrices =
    useLivePrices(
      marketsLiveCoins
    );

  const [
    marketsPriceNow,
    setMarketsPriceNow,
  ] =
    useState(
      () => Date.now()
    );

  useEffect(() => {
    const id =
      setInterval(
        () =>
          setMarketsPriceNow(
            Date.now()
          ),
        2_000,
      );

    return () =>
      clearInterval(id);
  }, []);

  const getFreshMarketsLivePrice =
    React.useCallback(
      (
        coin?:
          string |
          null,
      ) => {
        if (!coin) {
          return undefined;
        }

        const live =
          marketsLivePrices?.[
            coin
          ];

        if (
          !live?.price ||
          !live.time
        ) {
          return undefined;
        }

        return (
          marketsPriceNow -
            live.time <=
          10_000
        )
          ? live.price
          : undefined;
      },
      [
        marketsLivePrices,
        marketsPriceNow,
      ],
    );

  const marketsLiveAssetCtxs =
    useLiveAssetCtxs(
      !chartIsSpot &&
      chartMarketCoin
        ? [
            chartMarketCoin
          ]
        : []
    );

  const marketsCurrentPrice =
    React.useMemo(
      () => {
        let raw:
          unknown = "";

        if (
          chartIsSpot
        ) {
          const spotKey =
            marketsSpotAssetData
              ?.spotSymbol;

          const liveSpot =
            getFreshMarketsLivePrice(
              spotKey
            );

          raw =
            liveSpot ??
            marketsSpotAssetData
              ?.midPx ??
            marketsSpotAssetData
              ?.markPx ??
            "";
        } else {
          raw =
            marketsLiveAssetCtxs?.[
              chartMarketCoin
            ]?.markPx ??
            getFreshMarketsLivePrice(
              chartMarketCoin
            ) ??
            "";
        }

        const value =
          parseFloat(
            String(raw)
          );

        return (
          Number.isFinite(
            value
          ) &&
          value > 0
        )
          ? value
          : null;
      },
      [
        chartIsSpot,
        chartMarketCoin,
        marketsSpotAssetData
          ?.spotSymbol,
        marketsSpotAssetData
          ?.midPx,
        marketsSpotAssetData
          ?.markPx,
        marketsLiveAssetCtxs,
        getFreshMarketsLivePrice,
      ],
    );

  const isCurrentTokenPerp = currentToken?.openInterest !== undefined;

  // Switch active token
  const handleSelectAsset = (
    symbol: string,
    mode: "spot" | "perp"
  ) => {
    setSelectedSymbol(symbol);
    setIsSelectorOpen(false);
    onSelectToken(symbol, mode);
  };

  return (
    <div className="w-full space-y-1.5" id="trading-terminal-markets-container">
      {/* 1. TOP INTERACTIVE HEADER SECTION: ONE compact upper market panel */}
      <div className="relative glass-panel rounded-xl border border-brand-border bg-brand-surface py-1.5 px-2 sm:px-2.5 select-none shadow-sm" id="trading-terminal-markets-container-header">
        
        {/* ROW 1: [ BTC ] [ CHART ] [ ORDER BOOK ] [ MARKET INFO ] */}
        <div className="flex flex-nowrap items-stretch justify-between gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-none">
          {/* Left Side: Selected Coin Display with Dropdown trigger */}
          <div className="relative shrink-0 flex items-stretch" ref={selectorRef}>
            <div 
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className="h-11 sm:h-12 flex items-center gap-1.5 sm:gap-2.5 bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border hover:border-brand-border px-2 sm:px-3 rounded-lg cursor-pointer transition-all select-none whitespace-nowrap"
              id="coin-selector-trigger"
            >
              {/* Logo */}
              {currentToken && (
                <div className="shrink-0 scale-75 sm:scale-90 origin-center">
                  {renderAssetLogo(
                    currentToken.symbol,
                    currentToken.displayBaseAsset,
                    currentToken.sourceCoin,
                    true, // Top market header logo should load immediately.
                  )}
                </div>
              )}
              
              {/* Symbols */}
              <div className="text-left">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="font-display font-bold text-brand-text text-xs sm:text-sm tracking-tight uppercase leading-none">
                    {currentToken?.name || (currentToken ? (isCurrentTokenPerp ? `${currentToken.symbol}-USDC` : currentToken.symbol) : (selectedSymbol || "--"))}
                  </span>
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                </div>
                <span className="text-[7px] sm:text-[8px] text-accent font-mono font-bold uppercase tracking-wider block leading-none mt-0.5">
                  {isCurrentTokenPerp ? `${getPerpLeverageFormatted(currentToken?.symbol || "", currentToken?.maxLeverage)} Perpetual` : "Spot Asset"}
                </span>
              </div>
            </div>

            {/* ASSET SELECTOR MODAL / BOTTOM SHEET */}
            {isSelectorOpen && (
              <MarketSelector
                tokens={tokens}
                selectedSymbol={selectedSymbol}
                onSelectToken={handleSelectAsset}
                onClose={() => setIsSelectorOpen(false)}
                favorites={watchlist ?? []}
                onToggleFavorite={onToggleWatchlist}
              />
            )}
          </div>

          {/* Middle: CHART | ORDER BOOK Segmented Control */}
          <div className="h-11 sm:h-12 flex items-stretch bg-brand-surface p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-brand-border select-none shrink-0" id="trading-view-mode-tabs">
            {(["CHART", "ORDER_BOOK"] as const).map((tab) => {
              const isTabActive = activeCenterTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveCenterTab(tab)}
                  className={`h-full flex items-center justify-center px-2.5 sm:px-4 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    isTabActive 
                      ? "bg-accent text-brand-bg font-black shadow-sm" 
                      : "text-brand-text hover:text-brand-text hover:bg-brand-overlay-subtle"
                  }`}
                >
                  {tab.replace("_", " ")}
                </button>
              );
            })}
          </div>

          {/* Right Side: Market Information with dropdown trigger */}
          <div className="flex items-stretch gap-1.5 sm:gap-2 select-none shrink-0">
            {/* Market Info Dropdown Button */}
            <div className="relative flex items-stretch" ref={infoDropdownRef}>
              <button
                onClick={() => setIsInfoOpen(!isInfoOpen)}
                className="h-11 sm:h-12 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 text-[9px] sm:text-xs font-bold text-brand-text hover:text-brand-text bg-brand-surface hover:bg-brand-overlay-subtle rounded-lg border border-brand-border transition-all select-none uppercase tracking-wider cursor-pointer shadow-sm whitespace-nowrap"
              >
                <span>{isInfoOpen ? "▲" : "▼"} Market Info</span>
              </button>
            </div>
          </div>
        </div>

        {/* Market Info Dropdown Card */}
        <AnimatePresence>
          {isInfoOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.12 }}
              data-market-info-dropdown="true"
              className="absolute top-full mt-2 left-2 right-2 sm:left-auto sm:right-2 sm:w-80 bg-brand-surface border border-brand-border rounded-xl shadow-2xl z-[80] p-3.5 space-y-3"
              id="market-info-dropdown"
            >
              <div className="flex items-center justify-between border-b border-brand-border pb-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-sans">
                  {currentToken?.symbol || "--"} Market Metrics
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">
                  HideDex Live Markets
                </span>
              </div>

              <div className="flex flex-col items-start gap-3 font-mono text-xs">
                {/* Current Price / Mark Price */}
                <div className="border-b border-brand-border/20 pb-1.5">
                  <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">Mark Price</span>
                  <span className="text-success font-extrabold text-sm block mt-0.5">
                    {typeof marketsCurrentPrice === "number" && Number.isFinite(marketsCurrentPrice)
                      ? `$${marketsCurrentPrice.toLocaleString(undefined, { minimumFractionDigits: currentToken?.symbol === "PURR" ? 4 : 2 })}` 
                      : "--"}
                  </span>
                </div>

                {/* 24H Change */}
                <div className="border-b border-brand-border/20 pb-1.5">
                  <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">24H Change</span>
                  <span className={`text-xs font-extrabold flex items-center gap-0.5 mt-1 leading-none ${
                    typeof currentToken?.change24h === "number" && Number.isFinite(currentToken.change24h)
                      ? (currentToken.change24h >= 0 ? "text-emerald-400" : "text-rose-500") 
                      : "text-gray-400"
                  }`}>
                    {typeof currentToken?.change24h === "number" && Number.isFinite(currentToken.change24h)
                      ? `${currentToken.change24h >= 0 ? "+" : ""}${currentToken.change24h.toFixed(2)}%` 
                      : "--"}
                  </span>
                </div>

                {/* Funding rate is only defined for perpetual markets. */}
                {isCurrentTokenPerp && (
                <div className="border-t border-brand-border/20 pt-2">
                  <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">Funding Rate</span>
                  <span className={`font-bold block mt-0.5 text-xs ${
                    typeof currentToken?.fundingRate === "number" && Number.isFinite(currentToken.fundingRate)
                      ? (currentToken.fundingRate >= 0 ? "text-violet-400" : "text-rose-400")
                      : "text-gray-400"
                  }`}>
                    {typeof currentToken?.fundingRate === "number" && Number.isFinite(currentToken.fundingRate)
                      ? `${currentToken.fundingRate >= 0 ? "+" : ""}${currentToken.fundingRate.toFixed(4)}%`
                      : "--"}
                  </span>
                </div>
                )}

                {/* Open Interest (if Perp) */}
                {isCurrentTokenPerp && (
                  <div className="w-full border-t border-brand-border/20 pt-2">
                    <span className="text-gray-500 block text-[9px] font-sans font-bold uppercase tracking-wider leading-tight">Open Interest</span>
                    <span className="text-indigo-400 font-bold block mt-0.5">
                      {typeof currentToken?.openInterest === "number" && Number.isFinite(currentToken.openInterest)
                        ? `$${(currentToken.openInterest / 1_000_000).toFixed(1)}M`
                        : "--"}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Below ROW 1: thin divider and ROW 2 host for chart toolbar */}
        {activeCenterTab === "CHART" && (
          <>
            <div className="w-full h-px bg-brand-border/60 my-1 sm:my-1.5" />
            <div id="market-chart-toolbar-host" className="w-full flex items-center min-h-[28px]" />
          </>
        )}

      </div>

      {/* 2. MAIN WORKSPACE AREA BASED ON SELECTED TOP TAB */}
      
      {/* CASE A: CHART TAB (DEFAULT ACTIVE) */}
      {activeCenterTab === "CHART" && (
        <div className="w-full space-y-2 sm:space-y-2.5">
          {/* Full Width Trading Chart - Max available area with no extra gap */}
          <div className="w-full bg-brand-surface border border-brand-border rounded-xl p-0.5 shadow-xl overflow-hidden" id="desktop-main-chart">
            <TVChart 
              symbol={selectedSymbol} 
              marketCoin={chartCandleCoin}
              isSpot={chartIsSpot}
              currentPrice={marketsCurrentPrice}
              high24h={currentToken?.high24h ?? null}
              low24h={currentToken?.low24h ?? null}
              volume24h={currentToken?.volume24h ?? null}
              fundingRate={currentToken?.fundingRate ?? null}
              openInterest={currentToken?.openInterest ?? null}
              change24h={currentToken?.change24h ?? null}
              tradeHistory={tradeHistory}
              toolbarHostId="market-chart-toolbar-host"
            />
          </div>

          {/* BOTTOM SECTION: POSITIONS / OPEN ORDERS / HISTORY TABS */}
          <div className="w-full bg-brand-surface border border-brand-border rounded-xl p-1.5 shadow-lg">
            <TradingDashboardTabs
              symbol={selectedSymbol}
              currentToken={currentToken}
              tokens={tokens}
              balanceUSDC={balanceUSDC}
              tokenBalances={tokenBalances}
              positions={positions}
              openOrders={openOrders}
              tradeHistory={tradeHistory}
              fundingHistory={fundingHistory}
              onCancelOrder={onCancelOrder}
              onCancelAllOrders={onCancelAllOrders}
              onClosePosition={onClosePosition}
              onCloseAllPositions={onCloseAllPositions}
              spotAvailableBalances={spotAvailableBalances}
              onCloseSpotPosition={onCloseSpotPosition}
              onCloseAllSpotPositions={onCloseAllSpotPositions}
              onSelectToken={(s) => onSelectToken(s, "spot")}
              walletConnected={walletConnected}
            />
          </div>
        </div>
      )}

      {/* CASE B: ORDER BOOK TAB */}
      {activeCenterTab === "ORDER_BOOK" && (
        <div className="w-full space-y-2 sm:space-y-2.5">
          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-12 bg-brand-surface border border-brand-border rounded-xl p-3 shadow-lg">
              <OrderBook 
                symbol={selectedSymbol} 
                marketCoin={chartMarketCoin}
                currentPrice={marketsCurrentPrice} 
                onSelectPrice={(price) => {
                  onSelectOrderBookPrice(
                    price,
                    chartIsSpot ? "spot" : "perp"
                  );
                }} 
              />
            </div>
          </div>
          <div className="w-full bg-brand-surface border border-brand-border rounded-xl p-1.5 shadow-lg">
            <TradingDashboardTabs
              symbol={selectedSymbol}
              currentToken={currentToken}
              tokens={tokens}
              balanceUSDC={balanceUSDC}
              tokenBalances={tokenBalances}
              positions={positions}
              openOrders={openOrders}
              tradeHistory={tradeHistory}
              fundingHistory={fundingHistory}
              onCancelOrder={onCancelOrder}
              onCancelAllOrders={onCancelAllOrders}
              onClosePosition={onClosePosition}
              onCloseAllPositions={onCloseAllPositions}
              spotAvailableBalances={spotAvailableBalances}
              onCloseSpotPosition={onCloseSpotPosition}
              onCloseAllSpotPositions={onCloseAllSpotPositions}
              onSelectToken={(s) => onSelectToken(s, "spot")}
              walletConnected={walletConnected}
            />
          </div>
        </div>
      )}

      {selectedClosePosition && (
        <ClosePositionModal
          position={positions.find(p => p.id === selectedClosePosition.id) || selectedClosePosition}
          onClose={() => setSelectedClosePosition(null)}
          onConfirmClose={(pos, closePercent) => {
            if (onClosePosition) {
              return onClosePosition(pos, closePercent);
            }
          }}
        />
      )}

    </div>
  );
}
