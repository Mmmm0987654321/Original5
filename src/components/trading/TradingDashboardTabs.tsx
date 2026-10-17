import TradingAccountTabBar from "./TradingAccountTabBar";
import HideDexPositionHeader from "./HideDexPositionHeader";
import HideDexPositionDetails from "./HideDexPositionDetails";
import HideDexTradeHistory from "./HideDexTradeHistory";
import HideDexOpenOrders, {type HideDexOpenOrderRow} from "./HideDexOpenOrders";
import HideDexBalancesView, {type HideDexBalanceItem} from "./HideDexBalancesView";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  ChevronDown, 
  Trash2, 
  Layers,
  Wallet,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  FileText,
  TrendingUp,
  Info,
  Share2
} from "lucide-react";
import { Position, OpenOrder, TradeHistoryItem, TokenMetadata } from "../../types";
import { useTrustShield } from "../../lib/TrustShieldManager";
import TpSlModal from "./TpSlModal";
import ClosePositionModal from "./ClosePositionModal";
import CloseAllConfirmationModal from "./CloseAllConfirmationModal";
import ShareCardPopup from "./share/ShareCardManager";

interface TradingDashboardTabsProps {
  symbol: string;
  currentToken: TokenMetadata;
  tokens: TokenMetadata[];
  balanceUSDC: number;
  tokenBalances?: Record<string, number>;
  spotAvailableBalances?: Record<string, number>;
  positions: Position[];
  openOrders: OpenOrder[];
  tradeHistory: TradeHistoryItem[];
  fundingHistory?: any[];
  onCancelOrder?: (id: string) => Promise<void> | void;
  onCancelAllOrders?: () => Promise<void> | void;
  onClosePosition?: (position: Position, closePercent: number) => Promise<void> | void;
  onCloseAllPositions?: () => Promise<void> | void;
  onCloseSpotPosition?: (symbol: string) => Promise<void> | void;
  onCloseAllSpotPositions?: () => Promise<void> | void;
  onSavePositionTpSl?: (position: Position, tpPrice: number | null, slPrice: number | null) => Promise<void> | void;
  onSelectToken: (symbol: string) => void;
  walletConnected?: boolean;
  setupComplete?: boolean;
  onSetupRequired?: () => void;
}

export default function TradingDashboardTabs({
  symbol,
  currentToken,
  tokens,
  balanceUSDC,
  tokenBalances,
  spotAvailableBalances,
  positions,
  openOrders,
  tradeHistory,
  fundingHistory = [],
  onCancelOrder = () => {},
  onCancelAllOrders,
  onClosePosition,
  onCloseAllPositions = () => {},
  onCloseSpotPosition,
  onCloseAllSpotPositions,
  onSavePositionTpSl,
  onSelectToken,
  walletConnected = false,
  setupComplete = true,
  onSetupRequired,
}: TradingDashboardTabsProps) {
  const { mode: trustShieldMode, isFieldHidden } = useTrustShield();
  // Listen to visual preference/theme changes to adjust button text color contrast instantly
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pref_theme_id") || "cosmic-slate";
    }
    return "cosmic-slate";
  });

  useEffect(() => {
    const handlePrefUpdate = () => {
      setActiveThemeId(localStorage.getItem("pref_theme_id") || "cosmic-slate");
    };
    window.addEventListener("preferences-updated", handlePrefUpdate);
    return () => {
      window.removeEventListener("preferences-updated", handlePrefUpdate);
    };
  }, []);

  const getButtonTextStyle = (themeId: string) => {
    if (themeId === "light") {
      return "#FFFFFF"; // White text on Blue button in light mode
    }
    if (themeId === "cosmic-slate" || themeId === "classic-gold") {
      return "#040812"; // Black text on high-vibrancy Green/Gold button backgrounds
    }
    if (themeId === "stealth-matte") {
      return "#060608"; // Black text on carbon neutral accent color
    }
    return "#FFFFFF"; // White text on other theme accents (purple, red, Tokyo blue, emerald)
  };

  // Bottom Tabs
  const [activeBottomTab, setActiveBottomTab] = useState<
    "BALANCES" | "POSITIONS" | "OPEN_ORDERS" | "TRADE_HISTORY" | "FUNDING_HISTORY"
  >(() => {
    const isSpot = symbol.endsWith("-SPOT") || currentToken?.category === "spot";
    return isSpot ? "BALANCES" : "POSITIONS";
  });

  useEffect(() => {
    const isSpot = symbol.endsWith("-SPOT") || currentToken?.category === "spot";
    if (isSpot) {
      setActiveBottomTab("BALANCES");
    } else {
      setActiveBottomTab("POSITIONS");
    }
  }, [symbol]);

  useEffect(() => {
    if (trustShieldMode === "PRIVATE" || trustShieldMode === "ANONYMOUS") {
      if (
        activeBottomTab === "TRADE_HISTORY" ||
        activeBottomTab === "FUNDING_HISTORY"
      ) {
        setActiveBottomTab("POSITIONS");
      }
    }
  }, [trustShieldMode, activeBottomTab]);

  useEffect(() => {
    if (
      activeBottomTab ===
        "FUNDING_HISTORY"
    ) {
      const isSpot =
        symbol.endsWith(
          "-SPOT"
        ) ||
        currentToken?.category ===
          "spot";

      setActiveBottomTab(
        isSpot
          ? "BALANCES"
          : "POSITIONS"
      );
    }
  }, [
    activeBottomTab,
    symbol,
    currentToken?.category,
  ]);

  // Sorting and expanding state for Positions list
  const [sortBy, setSortBy] = useState<"DEFAULT" | "SYMBOL" | "SIZE" | "PNL" | "ROI" | "RISK">("DEFAULT");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [expandedPositionIds, setExpandedPositionIds] = useState<Record<string, boolean>>({});

  // TP/SL Modal state
  const [selectedTpSlPosition, setSelectedTpSlPosition] = useState<Position | null>(null);
  // Close Position Modal state
  const [selectedClosePosition, setSelectedClosePosition] = useState<Position | null>(null);
  // Share Position Card state
  const [selectedSharePosition, setSelectedSharePosition] = useState<Position | null>(null);
  // Close All confirmation modal state
  const [showCloseAllModal, setShowCloseAllModal] = useState<boolean>(false);
  // Cancel All confirmation modal state
  const [showCancelAllModal, setShowCancelAllModal] = useState<boolean>(false);
  // Close Spot Position Modal state
  const [selectedCloseSpotSymbol, setSelectedCloseSpotSymbol] = useState<string | null>(null);
  // Close All Spot confirmation modal state
  const [showCloseAllSpotModal, setShowCloseAllSpotModal] = useState<boolean>(false);

  const handleOpenTpSlModal = (pos: Position) => {
    setSelectedTpSlPosition(pos);
  };

  const handleSaveTpSl = async (tpPrice: number | null, slPrice: number | null) => {
    if (!selectedTpSlPosition) return;
    if (onSavePositionTpSl) {
      await onSavePositionTpSl(selectedTpSlPosition, tpPrice, slPrice);
    }
    setSelectedTpSlPosition(null);
  };

  const handleConfirmCloseAll = async () => {
    await onCloseAllPositions();
  };

  const handleConfirmCancelAll = async () => {
    if (onCancelAllOrders) {
      await onCancelAllOrders();
    }
  };

  const handleConfirmCloseSpot = async () => {
    if (!selectedCloseSpotSymbol || !onCloseSpotPosition) return;
    await onCloseSpotPosition(selectedCloseSpotSymbol);
    setSelectedCloseSpotSymbol(null);
  };

  const handleConfirmCloseAllSpot = async () => {
    if (onCloseAllSpotPositions) {
      await onCloseAllSpotPositions();
    }
  };

  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close sort dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPositions = positions;
  const filteredOrders = openOrders;

  // Sorted positions using useMemo
  const sortedPositions = useMemo(() => {
    if (sortBy === "DEFAULT") return filteredPositions;
    return [...filteredPositions].sort((a, b) => {
      if (sortBy === "SYMBOL") {
        return a.symbol.localeCompare(b.symbol);
      } else if (sortBy === "SIZE") {
        return b.size - a.size;
      } else if (sortBy === "PNL") {
        return b.unrealizedPnl - a.unrealizedPnl;
      } else if (sortBy === "ROI") {
        return b.unrealizedPnlPercent - a.unrealizedPnlPercent;
      } else if (sortBy === "RISK") {
        const getRisk = (p: Position) => {
          if (p.liqPrice <= 0) return p.leverage;
          const dist = Math.abs(p.markPrice - p.liqPrice) / p.markPrice;
          return p.leverage / (dist + 0.01);
        };
        return getRisk(b) - getRisk(a);
      }
      return 0;
    });
  }, [filteredPositions, sortBy]);

  // Dynamically compute balances and allocations
  const dynamicBalances = useMemo(() => {
    const list = [];
    
    const spotUsdc =
      tokenBalances?.USDC !== undefined
        ? tokenBalances["USDC"]
        : 0;

    const totalUsdc = balanceUSDC || 0;

    let totalValue = totalUsdc;

    // First item is USDC
    list.push({
      symbol: "USDC",
      name: "USD Coin (Unified)",
      balance: totalUsdc,
      price: 1,
      valueUSD: totalUsdc,
      color: "bg-[#2775ca]",
      bgColor: "#2775ca"
    });

    // Other registry tokens
    const seenSymbols = new Set<string>(["USDC"]);
    tokens.forEach(tok => {
      if (seenSymbols.has(tok.symbol)) return;
      seenSymbols.add(tok.symbol);

      // Exclude perpetual contract assets from Balances (Spot only)
      const isPerp = tok.openInterest !== undefined || tok.category === "perps" || tok.name.toLowerCase().includes("perpetual") || tok.name.toLowerCase().includes("perp");
      if (isPerp) return;

      const bal = tokenBalances?.[tok.symbol] || 0;
      
      // Filter: Only show token if its balance is greater than 0
      if (bal <= 0) return;

      const isRealPrice = typeof tok.price === "number" && Number.isFinite(tok.price);
      const price = isRealPrice ? tok.price : null;
      const valUSD = isRealPrice ? bal * tok.price : null;
      if (valUSD !== null) {
        totalValue += valUSD;
      }
      
      let bgColor = "#2a2e3f";
      if (tok.symbol === "BTC") bgColor = "#f7931a";
      else if (tok.symbol === "ETH") bgColor = "#627eea";
      else if (tok.symbol === "SOL") bgColor = "#9945ff";
      else if (tok.symbol === "PURR") bgColor = "#e654bf";
      else if (tok.symbol === "ARB") bgColor = "#1e80ea";

      list.push({
        symbol: tok.symbol,
        name: tok.name,
        balance: bal,
        price,
        valueUSD: valUSD,
        color: `bg-[${bgColor}]`,
        bgColor
      });
    });

    return {
      items: list,
      totalValue
    };
  }, [balanceUSDC, tokenBalances, tokens]);

  const hasAvailableSpotToClose = useMemo(() => {
    return dynamicBalances.items.some(
      (item) => item.symbol !== "USDC" && (spotAvailableBalances?.[item.symbol] ?? 0) > 0
    );
  }, [dynamicBalances.items, spotAvailableBalances]);

  // Funding History data derived from real user funding query
  const fundingHistoryData = useMemo(() => {
    if (
      !walletConnected ||
      !Array.isArray(fundingHistory) ||
      fundingHistory.length === 0
    ) {
      return [];
    }

    const safeNum = (value: any) => {
      const n =
        typeof value === 'number'
          ? value
          : parseFloat(
              String(value ?? ''),
            );

      return Number.isFinite(n)
        ? n
        : NaN;
    };

    const normalizeTimeMs =
      (value: any) => {
        const raw =
          safeNum(value);

        if (!Number.isFinite(raw)) {
          return NaN;
        }

        return raw < 1e12
          ? raw * 1000
          : raw;
      };

    return fundingHistory
      .map((f: any, index: number) => {
        const coin = String(
          f?.coin ??
          f?.symbol ??
          f?.asset ??
          f?.market ??
          ''
        );

        if (!coin) {
          return null;
        }

        const timeMs =
          normalizeTimeMs(
            f?.time ??
            f?.timestamp,
          );

        if (!Number.isFinite(timeMs)) {
          return null;
        }

        const payment =
          safeNum(
            f?.funding ??
            f?.fundingUsd ??
            f?.amount ??
            f?.delta ??
            f?.pnl ??
            f?.fundingPayment ??
            f?.usd ??
            f?.value,
          );

        if (!Number.isFinite(payment)) {
          return null;
        }

        const id = String(
          f?.hash ??
          f?.id ??
          `${coin}:${timeMs}:${index}`
        );

        return {
          id,
          symbol: coin,
          payment,
          time:
            new Date(timeMs)
              .toLocaleString(),
          timestampMs: timeMs,
          rate: null,
          total: null,
        };
      })
      .filter(
        (item) =>
          item !== null,
      )
      .sort(
        (a, b) =>
          b!.timestampMs -
          a!.timestampMs,
      );
  }, [walletConnected, fundingHistory]);

  return (
    <div className="bg-brand-bg border border-brand-border rounded-xl overflow-hidden shadow-xl" id="terminal-dashboard-panel-unified">
      
      <TradingAccountTabBar
        activeTab={activeBottomTab as "BALANCES" | "POSITIONS" | "OPEN_ORDERS" | "TRADE_HISTORY"}
        onSelect={setActiveBottomTab}
        positionsCount={filteredPositions.length}
        ordersCount={filteredOrders.length}
        isFieldHidden={isFieldHidden}
      />

      {/* Sub-Header Row: Balances - Close All Spot */}
      {activeBottomTab === "BALANCES" && typeof onCloseAllSpotPositions === "function" && hasAvailableSpotToClose === true && (
        <div className="flex items-center justify-end px-2.5 py-1.5 bg-brand-bg/50 border-b border-brand-border text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider relative">
          <button 
            onClick={() => {
              setShowCloseAllSpotModal(true);
            }}
            className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            Close All Spot
          </button>
        </div>
      )}

      {/* Sub-Header Row: Sort by, Expand All, Close All */}
      {activeBottomTab === "POSITIONS" && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-brand-bg/50 border-b border-brand-border text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider relative">
          <div className="relative shrink-0" ref={sortDropdownRef}>
            <button 
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 hover:text-brand-text transition-colors cursor-pointer"
            >
              <span>Sort By: {
                sortBy === "DEFAULT" ? "Default" :
                sortBy === "SYMBOL" ? "Symbol" :
                sortBy === "SIZE" ? "Size" :
                sortBy === "ROI" ? "ROI" :
                sortBy === "RISK" ? "Risk Ratio" :
                "PnL"
              }</span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {showSortDropdown && (
              <div className="absolute left-0 mt-1.5 w-28 bg-brand-bg border border-brand-border rounded-lg shadow-xl z-30 p-0.5">
                {[
                  { id: "DEFAULT" as const, name: "Default" },
                  { id: "SYMBOL" as const, name: "Symbol" },
                  { id: "SIZE" as const, name: "Size" },
                  { id: "PNL" as const, name: "PnL" },
                  { id: "ROI" as const, name: "ROI" },
                  { id: "RISK" as const, name: "Risk Ratio" }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSortBy(s.id);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-2 py-1 text-[9px] rounded transition-colors font-bold ${
                      sortBy === s.id ? "text-cyan-400 bg-brand-overlay-normal" : "text-gray-400 hover:text-brand-text"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const nextVal = !isAllExpanded;
                setIsAllExpanded(nextVal);
                const updated: Record<string, boolean> = {};
                positions.forEach(p => { updated[p.id] = nextVal; });
                setExpandedPositionIds(updated);
              }}
              className="hover:text-brand-text transition-colors cursor-pointer"
            >
              {isAllExpanded ? "Collapse All" : "Expand All"}
            </button>
            <button 
              onClick={() => {
                setShowCloseAllModal(true);
              }}
              className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              Close All
            </button>
          </div>
        </div>
      )}

      {/* Sub-Header Row: Open Orders - Cancel All */}
      {activeBottomTab === "OPEN_ORDERS" && filteredOrders.length > 0 && (
        <div className="flex items-center justify-end px-2.5 py-1.5 bg-brand-bg/50 border-b border-brand-border text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider relative">
          <button 
            onClick={() => {
              setShowCancelAllModal(true);
            }}
            className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            Cancel All
          </button>
        </div>
      )}

      {/* Dynamic Inner Tab View Table */}
      <div className="p-2 md:p-3 min-h-[110px] overflow-y-auto overflow-x-hidden relative">
        {/* TAB 1: BALANCES */}
        {activeBottomTab === "BALANCES" && <HideDexBalancesView
          items={dynamicBalances.items.map(item => {
            const valueUsd=typeof item.valueUSD==="number" && Number.isFinite(item.valueUSD)?item.valueUSD:null;
            const pct=valueUsd!==null && dynamicBalances.totalValue>0 ?
              100*valueUsd/dynamicBalances.totalValue:null;
            const locked=item.symbol==="USDC"
              ? openOrders.filter(o=>o.side==="BUY").reduce((n,o)=>n+o.price*o.size,0)
              : openOrders.filter(o=>o.symbol===item.symbol&&o.side==="SELL").reduce((n,o)=>n+o.size,0);
            const available=spotAvailableBalances?.[item.symbol]!==undefined
              ? spotAvailableBalances[item.symbol] : Math.max(0,item.balance-locked);
            const canClose=item.symbol!=="USDC" && available>0 && typeof onCloseSpotPosition==="function";
            return {
              id:item.symbol,symbol:item.symbol,name:item.name,total:item.balance,
              available,locked,valueUsd,allocationPercent:pct,color:item.bgColor,
              canClose,onClose:canClose ? ()=>setSelectedCloseSpotSymbol(item.symbol) : undefined,
            } satisfies HideDexBalanceItem;
          })}
        />}

        {/* TAB 2: POSITIONS */}
        {activeBottomTab === "POSITIONS" && (
          filteredPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500 text-center">
              <Layers className="w-6 h-6 text-brand-text/5 mb-1" />
              <p className="text-[10px]">No active positions held.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full pr-1 overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent" id="positions-card-container">
              {sortedPositions.map((pos) => {
                const isLong = pos.type === "LONG";
                const positionValue = pos.size * pos.markPrice;
                const marginRatio = pos.marginRatio !== undefined ? pos.marginRatio : 0;
                const isExpanded = expandedPositionIds[pos.id] === true;

                // Static background colors for token logo dot to prevent dynamic visual pollution
                let logoColor = "#2775ca";
                if (pos.symbol === "BTC") logoColor = "#f7931a";
                else if (pos.symbol === "ETH") logoColor = "#627eea";
                else if (pos.symbol === "SOL") logoColor = "#9945ff";

                return (
                  <div 
                    key={pos.id}
                    className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 md:p-4 transition-all duration-150 shadow-md flex flex-col gap-2.5 w-full text-xs font-mono text-brand-sub"
                    id={`pos-card-${pos.id}`}
                  >
                    <HideDexPositionHeader
                      symbol={pos.symbol}
                      side={pos.type}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedPositionIds(prev => ({...prev,[pos.id]:!isExpanded}))}
                      marginLabel={pos.marginType==="isolated"?"Isolated":pos.marginType==="cross"?"Cross":"--"}
                      leverageLabel={Number.isFinite(pos.leverage) && pos.leverage>0 ? pos.leverage+"x" : "--"}
                      pnl={pos.unrealizedPnl}
                      roi={pos.unrealizedPnlPercent}
                      shareAction={!isFieldHidden("sharePosition") && <button
                        type="button"
                        onClick={e => {e.preventDefault();e.stopPropagation();setSelectedSharePosition(pos);}}
                        id={`share-pos-btn-${pos.id}`}
                        className="p-1 rounded bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 hover:text-violet-300 border border-violet-500/10 hover:border-violet-500/30 transition-all duration-150 cursor-pointer active:scale-95"
                        title="Share Position">
                        <Share2 className="w-3 h-3"/>
                      </button>}
                    />

                    {isExpanded && (
                      <HideDexPositionDetails
                        left={[
                          {label:"Position Size",value:`${pos.size} ${pos.symbol}`,
                            hint:`($${(pos.size*pos.entryPrice).toLocaleString(undefined,{maximumFractionDigits:1})})`},
                          {label:"Entry Price",value:"$"+pos.entryPrice.toLocaleString(undefined,{minimumFractionDigits:1})},
                          {label:"Margin Ratio",value:marginRatio.toFixed(2)+"%",
                            tone:marginRatio>80?"loss":marginRatio>50?"normal":"profit"},
                          {label:"Liquidation Price",value:pos.liqPrice>0?"$"+pos.liqPrice.toLocaleString(undefined,{minimumFractionDigits:1}):"None",tone:"loss"},
                        ]}
                        right={[
                          {label:"Margin",value:"$"+pos.margin.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})},
                          {label:"Mark Price",value:Number.isFinite(pos.markPrice)&&pos.markPrice>0 ?
                            "$"+pos.markPrice.toLocaleString(undefined,{minimumFractionDigits:1}):"--"},
                          {label:"TP / SL Target",value:(() => {
                                  const posKey = pos.sourceCoin || pos.symbol;
                                  const matchingTriggers = posKey
                                    ? openOrders.filter((order) => {
                                        if (order.isSpot === true) return false;
                                        if (order.tpsl !== "tp" && order.tpsl !== "sl") return false;
                                        const ordKey = order.sourceCoin || order.symbol;
                                        return (
                                          String(ordKey ?? "").trim().toUpperCase() ===
                                          String(posKey ?? "").trim().toUpperCase()
                                        );
                                      })
                                    : [];

                                  if (matchingTriggers.length === 0) {
                                    return <span className="text-brand-muted font-medium">Not set</span>;
                                  }

                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      {matchingTriggers.map((trig) => {
                                        const isTp = trig.tpsl === "tp";
                                        const hasPrice = typeof trig.triggerPrice === "number" && Number.isFinite(trig.triggerPrice);
                                        const priceStr = hasPrice ? `$${trig.triggerPrice!.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : "--";

                                        return (
                                          <div key={trig.id} className="flex items-center gap-1.5">
                                            <span className={isTp ? "text-brand-profit" : "text-brand-loss"}>
                                              {isTp ? "TP" : "SL"}: {priceStr}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()},
                        ]}
                        actions={<>
                          <button type="button" onClick={()=>handleOpenTpSlModal(pos)}
                            className="w-full h-8 px-1 rounded-lg border bg-brand-overlay-subtle hover:bg-brand-overlay-normal border-brand-primary/30 hover:border-brand-primary/50 text-brand-primary text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-95 select-none">
                            TP/SL
                          </button>
                          <button type="button" onClick={()=>setSelectedClosePosition(pos)}
                            className="w-full h-8 px-1 rounded-lg border bg-brand-loss/10 hover:bg-brand-loss/20 border-brand-loss/30 hover:border-brand-loss/50 text-brand-loss text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 select-none">
                            Close
                          </button>
                        </>}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* TAB 3: OPEN ORDERS — one shared original responsive UI */}
        {activeBottomTab==="OPEN_ORDERS" && <HideDexOpenOrders
          orders={filteredOrders.map(ord=>{
            const normalize=(s?:string|null)=>String(s??"").trim().toUpperCase();
            const trigger=ord.tpsl==="tp" || ord.tpsl==="sl" ||
              (typeof ord.triggerPrice==="number" && Number.isFinite(ord.triggerPrice) && ord.triggerPrice>0);
            const pos=trigger ? positions.find(p=>normalize(p.sourceCoin||p.symbol)===normalize(ord.sourceCoin||ord.symbol)) : undefined;
            const positionSize=(pos && Number.isFinite(pos.size) && pos.size>0 ? pos.size : Math.abs(parseFloat(pos?.rawSzi??"0"))) || 0;
            const size=trigger && ord.size===0 && positionSize>0?positionSize:ord.size;
            const remain=ord.tpsl && ord.size===0 && positionSize>0 && (!ord.remainingSize || ord.remainingSize===0)
              ? positionSize : ord.remainingSize;
            const price=trigger && typeof ord.triggerPrice==="number" && Number.isFinite(ord.triggerPrice)
              ? ord.triggerPrice:ord.price;
            const type=ord.tpsl==="tp"?"Take Profit":ord.tpsl==="sl"?"Stop Loss":ord.type;
            return {
              id:ord.id,symbol:ord.symbol,isSpot:ord.isSpot===true,side:ord.side,
              orderType:type,priceLabel:Number.isFinite(price)?"$"+price.toLocaleString(undefined,{minimumFractionDigits:1}):"—",
              trigger,sizeLabel:Number.isFinite(size)?String(size)+" "+ord.symbol:"—",
              filledLabel:Number.isFinite(ord.filled)?ord.filled.toFixed(1)+"%":"--",
              remainingLabel:typeof remain==="number" && Number.isFinite(remain)?Math.abs(remain).toFixed(4)+" "+ord.symbol:"--",
              status:ord.status,timestamp:ord.timestamp,canCancel:Boolean(onCancelOrder),
            } satisfies HideDexOpenOrderRow;
          })}
          onCancel={ord=>onCancelOrder?.(ord.id)}
        />}

        {/* TAB 5: TRADE_HISTORY — original shared UI for both venues */}
        {activeBottomTab==="TRADE_HISTORY" && !isFieldHidden("tradeHistory") && (
          <HideDexTradeHistory
            items={walletConnected ? tradeHistory.map(hist=>({
              id:hist.id,symbol:hist.symbol,side:hist.side,isSpot:hist.isSpot===true,
              price:hist.price,size:hist.size,value:hist.value,
              realizedPnl:hist.pnl,roi:hist.pnlPercent,fee:hist.fee,timestamp:hist.timestamp
            })) : []}
          />
        )}

        {/* TAB 6: FUNDING_HISTORY */}
        {activeBottomTab === "FUNDING_HISTORY" && !isFieldHidden("fundingHistory") && (
          fundingHistoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-brand-muted text-center">
              <Layers className="w-6 h-6 text-brand-text/5 mb-2" />
              <p className="text-xs font-mono font-medium text-brand-sub">No funding records</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
                {fundingHistoryData.map((f) => {
                  const isPositive = f.payment >= 0;
                  return (
                    <div key={f.id} className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2 transition-all duration-150 shadow-md text-brand-sub">
                      <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2">
                        <span className="font-bold text-[12px] text-brand-text">{f.symbol}-PERP</span>
                        <span className="text-[10px] text-brand-muted font-medium">{f.time}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-brand-sub font-mono">
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Funding Rate</span>
                          <span className="font-semibold text-brand-sub">
                            --
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Funding Payment</span>
                          <span className={`font-bold ${isPositive ? "text-pnl-profit" : "text-pnl-loss"}`}>
                            {isPositive ? "+" : "-"}${Math.abs(f.payment).toFixed(4)} USDC
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
                      <th className="py-2.5">Symbol</th>
                      <th className="py-2.5">Hourly Rate</th>
                      <th className="py-2.5">Annualized Rate</th>
                      <th className="py-2.5">Estimated Payment</th>
                      <th className="py-2.5">Running Total</th>
                      <th className="py-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
                    {fundingHistoryData.map((f) => {
                      const isPositive = f.payment >= 0;
                      return (
                        <tr key={f.id} className="hover:bg-brand-overlay-subtle transition-colors">
                          <td className="py-2.5 font-bold text-brand-text">{f.symbol}-PERP</td>
                          <td className="py-2.5 font-semibold text-brand-sub">
                            --
                          </td>
                          <td className="py-2.5 text-xs text-brand-sub">
                            --
                          </td>
                          <td className={`py-2.5 font-bold ${isPositive ? "text-pnl-profit" : "text-pnl-loss"}`}>
                            {isPositive ? "+" : "-"}${Math.abs(f.payment).toFixed(4)} USDC
                          </td>
                          <td className="py-2.5 text-xs font-semibold text-brand-sub">
                            --
                          </td>
                          <td className="py-2.5 text-right text-brand-muted">{f.time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

      </div>

      {/* TAKE PROFIT / STOP LOSS MODAL */}
      {selectedTpSlPosition && (
        <TpSlModal
          position={selectedTpSlPosition}
          openOrders={openOrders}
          onClose={() => setSelectedTpSlPosition(null)}
          onSave={handleSaveTpSl}
          tradingEnabled={setupComplete}
          onSetupRequired={onSetupRequired}
          onCancelOrder={onCancelOrder}
        />
      )}

      {/* CLOSE POSITION MODAL */}
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

      {/* CLOSE ALL CONFIRMATION MODAL */}
      {showCloseAllModal && (
        <CloseAllConfirmationModal
          action="close_positions"
          onClose={() => setShowCloseAllModal(false)}
          onConfirm={handleConfirmCloseAll}
        />
      )}

      {/* CANCEL ALL CONFIRMATION MODAL */}
      {showCancelAllModal && (
        <CloseAllConfirmationModal
          action="cancel_orders"
          onClose={() => setShowCancelAllModal(false)}
          onConfirm={handleConfirmCancelAll}
        />
      )}

      {/* CLOSE SPOT POSITION CONFIRMATION MODAL */}
      {selectedCloseSpotSymbol && (
        <CloseAllConfirmationModal
          action="close_spot"
          symbol={selectedCloseSpotSymbol}
          onClose={() => setSelectedCloseSpotSymbol(null)}
          onConfirm={handleConfirmCloseSpot}
        />
      )}

      {/* CLOSE ALL SPOT CONFIRMATION MODAL */}
      {showCloseAllSpotModal && (
        <CloseAllConfirmationModal
          action="close_all_spot"
          onClose={() => setShowCloseAllSpotModal(false)}
          onConfirm={handleConfirmCloseAllSpot}
        />
      )}

      {/* SHARE POSITION CARD MODAL */}
      {selectedSharePosition && (
        <ShareCardPopup
          isOpen={!!selectedSharePosition}
          onClose={() => setSelectedSharePosition(null)}
          positionData={selectedSharePosition}
          walletAddress={""}
        />
      )}
    </div>
  );
}
