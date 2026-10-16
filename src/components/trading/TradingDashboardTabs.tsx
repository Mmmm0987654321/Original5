import TradingAccountTabBar from "./TradingAccountTabBar";
import HideDexPositionHeader from "./HideDexPositionHeader";
import HideDexPositionDetails from "./HideDexPositionDetails";
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
        {activeBottomTab === "BALANCES" && (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
              {dynamicBalances.items.map((item) => {
                const hasValueUSD = typeof item.valueUSD === "number" && Number.isFinite(item.valueUSD);
                const allocPercent = hasValueUSD && dynamicBalances.totalValue > 0 ? (item.valueUSD / dynamicBalances.totalValue) * 100 : null;
                let locked = 0;
                if (item.symbol === "USDC") {
                  locked = openOrders.filter(o => o.side === "BUY").reduce((sum, o) => sum + (o.price * o.size), 0);
                } else {
                  locked = openOrders.filter(o => o.symbol === item.symbol && o.side === "SELL").reduce((sum, o) => sum + o.size, 0);
                }
                const available =
                  spotAvailableBalances?.[item.symbol] !== undefined
                    ? spotAvailableBalances[item.symbol]
                    : Math.max(0, item.balance - locked);
                const isTop10 = ["BTC", "ETH", "SOL", "HYPE", "XRP", "AVAX", "SUI", "ARB", "OP", "ONDO"].includes(item.symbol.replace("-SPOT", "").replace("-USDC", "").toUpperCase());
                return (
                  <div key={item.symbol} className="bg-brand-card border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 shadow-md text-brand-sub">
                    <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2">
                      <div className="flex items-center gap-2">
                        {isTop10 && (
                          <div 
                            className="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                            style={{ backgroundColor: item.bgColor }}
                          >
                            {item.symbol === "BTC" ? "₿" : item.symbol === "ETH" ? "Ξ" : item.symbol === "XRP" ? "✕" : item.symbol.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-brand-text text-[12px]">{item.symbol}</span>
                          <span className="text-[9px] text-brand-muted block -mt-1">{item.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-brand-text font-bold text-[12px]">
                          {hasValueUSD ? `$${item.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                        </div>
                        {allocPercent !== null ? (
                          <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 px-1.5 py-0.2 rounded border border-brand-primary/15">
                            {allocPercent.toFixed(1)}% Alloc
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-brand-muted bg-brand-overlay-normal px-1.5 py-0.2 rounded border border-brand-border">
                            --
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-brand-sub font-mono">
                      <div>
                        <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Total</span>
                        <span className="font-semibold text-brand-text">
                          {item.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Available</span>
                        <span className="font-semibold text-brand-profit">
                          {available.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Locked</span>
                        <span className="font-semibold text-brand-muted">
                          {locked.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                    </div>
                    {item.symbol !== "USDC" && available > 0 && typeof onCloseSpotPosition === "function" && (
                      <div className="flex justify-end pt-2 border-t border-brand-divider/20">
                        <button
                          onClick={() => setSelectedCloseSpotSymbol(item.symbol)}
                          className="px-2.5 py-1 rounded bg-brand-loss/10 hover:bg-brand-loss/20 border border-brand-loss/30 hover:border-brand-loss/50 text-brand-loss text-[9px] font-extrabold uppercase tracking-wider transition-all duration-150 cursor-pointer active:scale-95 select-none"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
                    <th className="py-2.5">Asset</th>
                    <th className="py-2.5">Available Balance</th>
                    <th className="py-2.5">Locked Balance</th>
                    <th className="py-2.5">Total Balance</th>
                    <th className="py-2.5">USD Value</th>
                    <th className="py-2.5">Allocation</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
                  {dynamicBalances.items.map((item) => {
                    const hasValueUSD = typeof item.valueUSD === "number" && Number.isFinite(item.valueUSD);
                    const allocPercent = hasValueUSD && dynamicBalances.totalValue > 0 ? (item.valueUSD / dynamicBalances.totalValue) * 100 : null;
                    let locked = 0;
                    if (item.symbol === "USDC") {
                      locked = openOrders.filter(o => o.side === "BUY").reduce((sum, o) => sum + (o.price * o.size), 0);
                    } else {
                      locked = openOrders.filter(o => o.symbol === item.symbol && o.side === "SELL").reduce((sum, o) => sum + o.size, 0);
                    }
                    const available =
                      spotAvailableBalances?.[item.symbol] !== undefined
                        ? spotAvailableBalances[item.symbol]
                        : Math.max(0, item.balance - locked);
                    const isTop10 = ["BTC", "ETH", "SOL", "HYPE", "XRP", "AVAX", "SUI", "ARB", "OP", "ONDO"].includes(item.symbol.replace("-SPOT", "").replace("-USDC", "").toUpperCase());
                    return (
                      <tr key={item.symbol} className="hover:bg-brand-overlay-subtle transition-colors">
                        <td className="py-2.5 font-bold text-brand-text flex items-center gap-2">
                          {isTop10 && (
                            <div 
                              className="w-[20px] h-[20px] rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
                              style={{ backgroundColor: item.bgColor }}
                            >
                              {item.symbol === "BTC" ? "₿" : item.symbol === "ETH" ? "Ξ" : item.symbol === "XRP" ? "✕" : item.symbol.slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <span className="text-brand-text font-bold">{item.symbol}</span>
                            <span className="text-[9px] text-brand-muted block">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 font-semibold text-brand-profit">
                          {available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2.5 font-semibold text-brand-muted">
                          {locked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2.5 font-semibold text-brand-text">
                          {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2.5 font-bold text-brand-text">
                          {hasValueUSD ? `$${item.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                        </td>
                        <td className="py-2.5">
                          {allocPercent !== null ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-brand-sub">{allocPercent.toFixed(1)}%</span>
                              <div className="w-16 h-1.5 bg-brand-overlay-normal rounded-full overflow-hidden hidden sm:block">
                                <div className="h-full bg-brand-primary" style={{ width: `${allocPercent}%` }} />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-brand-muted">--</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {item.symbol !== "USDC" && available > 0 && typeof onCloseSpotPosition === "function" ? (
                            <button
                              onClick={() => setSelectedCloseSpotSymbol(item.symbol)}
                              className="px-2 py-0.5 rounded bg-brand-loss/10 hover:bg-brand-loss/20 border border-brand-loss/30 hover:border-brand-loss/50 text-brand-loss text-[9px] font-extrabold uppercase tracking-wider transition-all duration-150 cursor-pointer active:scale-95 select-none"
                            >
                              Close
                            </button>
                          ) : (
                            <span className="text-brand-muted text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

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

        {/* TAB 3: OPEN ORDERS */}
        {activeBottomTab === "OPEN_ORDERS" && (
          filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500 text-center">
              <Layers className="w-6 h-6 text-brand-text/5 mb-1" />
              <p className="text-[10px]">No open limit orders pending.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
                {filteredOrders.map((ord) => {
                  const isBuy = ord.side === "BUY";
                  const filledDisplay =
                    typeof ord.filled === 'number' &&
                    Number.isFinite(ord.filled)
                      ? `${ord.filled.toFixed(1)}%`
                      : '--';

                  const normalizeKey = (value?: string | null) =>
                    String(value ?? "").trim().toUpperCase();

                  const orderTpsl = ord.tpsl;
                  const orderTriggerPx = ord.triggerPrice;
                  const isTpSlOrder =
                    orderTpsl === "tp" ||
                    orderTpsl === "sl" ||
                    (
                      typeof orderTriggerPx === "number" &&
                      Number.isFinite(orderTriggerPx) &&
                      orderTriggerPx > 0
                    );

                  const orderCoin = ord.sourceCoin || ord.symbol;
                  const posForOrder = isTpSlOrder
                    ? positions.find(
                        (p) =>
                          normalizeKey(p.sourceCoin || p.symbol) ===
                          normalizeKey(orderCoin)
                      )
                    : undefined;

                  const rawSize =
                    typeof ord.size === "number" && Number.isFinite(ord.size)
                      ? ord.size
                      : 0;

                  const numericPositionSize =
                    typeof posForOrder?.size === "number" && Number.isFinite(posForOrder.size)
                      ? Math.abs(posForOrder.size)
                      : 0;

                  const rawPositionSize =
                    Math.abs(parseFloat(posForOrder?.rawSzi ?? "0")) || 0;

                  const positionSize =
                    numericPositionSize > 0
                      ? numericPositionSize
                      : rawPositionSize;

                  const displaySize =
                    isTpSlOrder && rawSize === 0 && positionSize > 0
                      ? positionSize
                      : rawSize;

                  const isExplicitPositionTpSl =
                    orderTpsl === "tp" ||
                    orderTpsl === "sl";

                  const rawRemaining =
                    typeof ord.remainingSize === "number" &&
                    Number.isFinite(ord.remainingSize)
                      ? Math.abs(ord.remainingSize)
                      : null;

                  const displayRemaining =
                    isExplicitPositionTpSl &&
                    rawSize === 0 &&
                    positionSize > 0 &&
                    (
                      rawRemaining === null ||
                      rawRemaining === 0
                    )
                      ? positionSize
                      : rawRemaining;

                  const remainingDisplay =
                    typeof displayRemaining === "number" &&
                    Number.isFinite(displayRemaining)
                      ? `${displayRemaining.toFixed(4)} ${ord.symbol}`
                      : "--";

                  const displayPrice =
                    isTpSlOrder &&
                    typeof orderTriggerPx === "number" &&
                    Number.isFinite(orderTriggerPx) &&
                    orderTriggerPx > 0
                      ? orderTriggerPx
                      : ord.price;

                  const displayType =
                    orderTpsl === "tp"
                      ? "Take Profit"
                      : orderTpsl === "sl"
                        ? "Stop Loss"
                        : ord.type;

                  return (
                    <div key={ord.id} className="bg-brand-card border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 shadow-md text-brand-sub">
                      <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[12px] text-brand-text">{ord.symbol}{ord.isSpot ? "-SPOT" : "-PERP"}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider ${
                            isBuy ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"
                          }`}>
                            {ord.side}
                          </span>
                          <span className="text-[9px] text-brand-muted font-bold bg-brand-overlay-subtle px-1.5 py-0.2 rounded border border-brand-border/30">
                            {displayType}
                          </span>
                        </div>
                        <button
                          onClick={() => onCancelOrder(ord.id)}
                          className="p-1 rounded text-brand-muted hover:text-brand-loss hover:bg-brand-loss/10 transition-colors cursor-pointer"
                          title="Cancel Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-brand-sub font-mono">
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">{isTpSlOrder ? "Trigger Price" : "Price"}</span>
                          <span className="font-semibold text-brand-text">${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Size</span>
                          <span className="font-semibold text-brand-text">{displaySize} {ord.symbol}</span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Filled / Remaining</span>
                          <span className="font-semibold text-brand-sub">
                            {filledDisplay} / {remainingDisplay}
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Time / Status</span>
                          <span className="font-semibold text-brand-sub flex items-center gap-1.5">
                            <span>{ord.timestamp}</span>
                            <span className="text-[8px] text-cyan-400 bg-cyan-400/10 px-1 rounded font-bold uppercase">{ord.status}</span>
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
                      <th className="py-2.5">Side</th>
                      <th className="py-2.5">Order Type</th>
                      <th className="py-2.5">Price</th>
                      <th className="py-2.5">Size</th>
                      <th className="py-2.5">Filled %</th>
                      <th className="py-2.5">Remaining</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Time</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
                    {filteredOrders.map((ord) => {
                      const isBuy = ord.side === "BUY";
                      const filledDisplay =
                        typeof ord.filled === 'number' &&
                        Number.isFinite(ord.filled)
                          ? `${ord.filled.toFixed(1)}%`
                          : '--';

                      const normalizeKey = (value?: string | null) =>
                        String(value ?? "").trim().toUpperCase();

                      const orderTpsl = ord.tpsl;
                      const orderTriggerPx = ord.triggerPrice;
                      const isTpSlOrder =
                        orderTpsl === "tp" ||
                        orderTpsl === "sl" ||
                        (
                          typeof orderTriggerPx === "number" &&
                          Number.isFinite(orderTriggerPx) &&
                          orderTriggerPx > 0
                        );

                      const orderCoin = ord.sourceCoin || ord.symbol;
                      const posForOrder = isTpSlOrder
                        ? positions.find(
                            (p) =>
                              normalizeKey(p.sourceCoin || p.symbol) ===
                              normalizeKey(orderCoin)
                          )
                        : undefined;

                      const rawSize =
                        typeof ord.size === "number" && Number.isFinite(ord.size)
                          ? ord.size
                          : 0;

                      const numericPositionSize =
                        typeof posForOrder?.size === "number" && Number.isFinite(posForOrder.size)
                          ? Math.abs(posForOrder.size)
                          : 0;

                      const rawPositionSize =
                        Math.abs(parseFloat(posForOrder?.rawSzi ?? "0")) || 0;

                      const positionSize =
                        numericPositionSize > 0
                          ? numericPositionSize
                          : rawPositionSize;

                      const displaySize =
                        isTpSlOrder && rawSize === 0 && positionSize > 0
                          ? positionSize
                          : rawSize;

                      const isExplicitPositionTpSl =
                        orderTpsl === "tp" ||
                        orderTpsl === "sl";

                      const rawRemaining =
                        typeof ord.remainingSize === "number" &&
                        Number.isFinite(ord.remainingSize)
                          ? Math.abs(ord.remainingSize)
                          : null;

                      const displayRemaining =
                        isExplicitPositionTpSl &&
                        rawSize === 0 &&
                        positionSize > 0 &&
                        (
                          rawRemaining === null ||
                          rawRemaining === 0
                        )
                          ? positionSize
                          : rawRemaining;

                      const remainingDisplay =
                        typeof displayRemaining === "number" &&
                        Number.isFinite(displayRemaining)
                          ? `${displayRemaining.toFixed(4)} ${ord.symbol}`
                          : "--";

                      const displayPrice =
                        isTpSlOrder &&
                        typeof orderTriggerPx === "number" &&
                        Number.isFinite(orderTriggerPx) &&
                        orderTriggerPx > 0
                          ? orderTriggerPx
                          : ord.price;

                      const displayType =
                        orderTpsl === "tp"
                          ? "Take Profit"
                          : orderTpsl === "sl"
                            ? "Stop Loss"
                            : ord.type;

                      return (
                        <tr key={ord.id} className="hover:bg-brand-overlay-subtle transition-colors">
                          <td className="py-2.5 font-bold text-brand-text">{ord.symbol}{ord.isSpot ? "-SPOT" : "-PERP"}</td>
                          <td className="py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isBuy ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>
                              {ord.side}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="text-[10px] text-brand-sub">{displayType}</span>
                          </td>
                          <td className="py-2.5 font-semibold text-brand-text">
                            <span className="flex items-center gap-1.5">
                              <span>${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                              {isTpSlOrder && (
                                <span className="text-[8px] px-1 py-0.2 rounded bg-violet-500/10 text-violet-400 font-bold border border-violet-500/20">
                                  Trigger
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 text-brand-text">{displaySize} {ord.symbol}</td>
                          <td className="py-2.5 text-brand-sub">{filledDisplay}</td>
                          <td className="py-2.5 text-brand-sub">{remainingDisplay}</td>
                          <td className="py-2.5">
                            <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded border border-cyan-400/20">
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-brand-muted">{ord.timestamp}</td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => onCancelOrder(ord.id)}
                              className="p-1 rounded text-brand-muted hover:text-brand-loss hover:bg-brand-loss/10 transition-colors cursor-pointer"
                              title="Cancel Order"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

        {/* TAB 5: TRADE_HISTORY */}
        {activeBottomTab === "TRADE_HISTORY" && !isFieldHidden("tradeHistory") && (
          (!walletConnected || tradeHistory.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-brand-muted text-center">
              <Layers className="w-6 h-6 text-brand-text/5 mb-2" />
              <p className="text-xs font-mono font-medium text-brand-sub">No historical trades found for this address.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden flex flex-col gap-3 w-full max-h-[360px] overflow-y-auto pr-1">
                {tradeHistory.slice(0, 15).map((hist) => {
                  const isBuy = hist.side === "BUY";
                  const feeVal = typeof hist.fee === 'number' && Number.isFinite(hist.fee) ? hist.fee : 0;
                  
                  const hasPnl = hist.pnl !== undefined;
                  const displayPnl = hasPnl && Number.isFinite(hist.pnl) ? hist.pnl! : 0;
                  const displayRoi =
                    typeof hist.pnlPercent === "number" &&
                    Number.isFinite(hist.pnlPercent)
                      ? hist.pnlPercent
                      : 0;

                  return (
                    <div key={hist.id} className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 shadow-md text-brand-sub">
                      <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[12px] text-brand-text">
                            {hist.isSpot === true ? `${hist.symbol}-SPOT` : `${hist.symbol}-PERP`}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider ${
                            isBuy ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"
                          }`}>
                            {hist.side}
                          </span>
                          <span className="text-[8px] text-brand-muted font-bold font-mono">
                            ID: {hist.id.slice(0, 6)}
                          </span>
                        </div>
                        
                        {/* Show Realized PNL & ROI */}
                        {(displayPnl !== 0) && (
                          <div className="text-right font-mono">
                            <span className={`text-[11px] font-bold block ${displayPnl >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
                              {displayPnl >= 0 ? "+" : ""}${displayPnl.toFixed(2)}
                            </span>
                            <span className={`text-[8px] font-bold block ${displayRoi >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
                              ROI: {displayRoi >= 0 ? "+" : ""}{displayRoi.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-brand-sub font-mono">
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Price</span>
                          <span className="font-semibold text-brand-text">${hist.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Size / Value</span>
                          <span className="font-semibold text-brand-text">
                            {hist.size} {hist.symbol} <span className="text-brand-muted text-[9px]">(${(hist.value).toFixed(1)})</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Fees Paid</span>
                          <span className="font-semibold text-brand-loss/80">${feeVal.toFixed(4)} USDC</span>
                        </div>
                        <div>
                          <span className="text-brand-muted block text-[8px] font-bold uppercase tracking-wider">Executed At</span>
                          <span className="font-semibold text-brand-sub">{hist.timestamp}</span>
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
                      <th className="py-2.5">ID</th>
                      <th className="py-2.5">Symbol</th>
                      <th className="py-2.5">Direction</th>
                      <th className="py-2.5">Size</th>
                      <th className="py-2.5">Price</th>
                      <th className="py-2.5">Value</th>
                      <th className="py-2.5">Realized PnL</th>
                      <th className="py-2.5">ROI</th>
                      <th className="py-2.5">Fees</th>
                      <th className="py-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-divider/30 text-brand-sub">
                    {tradeHistory.slice(0, 15).map((hist) => {
                      const isBuy = hist.side === "BUY";
                      const feeVal = typeof hist.fee === 'number' && Number.isFinite(hist.fee) ? hist.fee : 0;
                      const hasPnl = hist.pnl !== undefined;
                      const displayPnl = hasPnl && Number.isFinite(hist.pnl) ? hist.pnl! : 0;
                      const displayRoi =
                        typeof hist.pnlPercent === "number" &&
                        Number.isFinite(hist.pnlPercent)
                          ? hist.pnlPercent
                          : 0;

                      return (
                        <tr key={hist.id} className="hover:bg-brand-overlay-subtle transition-colors">
                          <td className="py-2.5 text-[10px] text-brand-muted">#{hist.id.slice(0, 6)}</td>
                          <td className="py-2.5 font-bold text-brand-text">
                            {hist.isSpot === true ? `${hist.symbol}-SPOT` : `${hist.symbol}-PERP`}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isBuy ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>
                              {hist.side}
                            </span>
                          </td>
                          <td className="py-2.5">{hist.size} {hist.symbol}</td>
                          <td className="py-2.5 font-semibold">${hist.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                          <td className="py-2.5 text-brand-sub">${hist.value.toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                          <td className={`py-2.5 font-bold ${displayPnl > 0 ? "text-pnl-profit" : displayPnl < 0 ? "text-pnl-loss" : "text-brand-muted"}`}>
                            {displayPnl !== 0 ? `${displayPnl >= 0 ? "+" : ""}$${displayPnl.toFixed(2)}` : "—"}
                          </td>
                          <td className={`py-2.5 font-bold ${displayRoi > 0 ? "text-pnl-profit" : displayRoi < 0 ? "text-pnl-loss" : "text-brand-muted"}`}>
                            {displayRoi !== 0 ? `${displayRoi >= 0 ? "+" : ""}${displayRoi.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2.5 text-brand-loss/80">${feeVal.toFixed(4)}</td>
                          <td className="py-2.5 text-right text-brand-muted">{hist.timestamp}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
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
