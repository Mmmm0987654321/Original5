/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Compass, 
  Activity, 
  Briefcase, 
  Layers, 
  History, 
  UserPlus, 
  LayoutGrid, 
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  User,
  Info,
  Star,
  Trophy
} from "lucide-react";
import { ActiveTab } from "../../types";
import { useLanguage } from "../../lib/LanguageContext";
import { useTrustShield } from "../../lib/TrustShieldManager";
import { TrustShieldValue } from "../common/TrustShieldValue";
import { HideDexLogo } from "../common/HideDexLogo";

interface LeftSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
  walletAddress: string;
  balanceUSDC: number;
  selectedExchange?: "hyperliquid" | "lighter" | "aster";
  onDisconnectWallet: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  watchlist?: string[];
  onToggleWatchlist?: (symbol: string) => void;
  onSelectToken?: (symbol: string) => void;
  tokens?: any[];
}

export default function LeftSidebar({
  activeTab,
  setActiveTab,
  onOpenSettings,
  walletAddress,
  balanceUSDC,
  selectedExchange = "hyperliquid",
  onDisconnectWallet,
  isMobileOpen = false,
  onCloseMobile,
  watchlist = [],
  onToggleWatchlist,
  onSelectToken,
  tokens = [],
}: LeftSidebarProps) {
  const { mode: trustShieldMode } = useTrustShield();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showWatchlistPopup, setShowWatchlistPopup] = useState(false);
  const { t } = useLanguage();
  
  const menuItems = [
    { id: ActiveTab.Profile, label: "Account", icon: User, desc: "Manage profile & alerts" },
    { id: ActiveTab.Portfolio, label: "Fund", icon: Briefcase, desc: "Wallet & portfolio balance" },
    { id: ActiveTab.Points, label: "Points", badge: "Upcoming", icon: Trophy, desc: "Rewards program upcoming" },
    { id: ActiveTab.Markets, label: "Market", icon: Compass, desc: "Global asset screener" },
    { id: ActiveTab.Perp, label: "Trade", icon: Activity, desc: "Leverage trading desk" },
  ].filter(item => !(item.id === ActiveTab.Profile && trustShieldMode === "ANONYMOUS"));

  const handleItemClick = (id: ActiveTab) => {
    if (id === ActiveTab.Points) {
      // Upcoming only - click does nothing
      return;
    }
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "Not Connected";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const sidebarContent = (
    <div className={`h-full flex flex-col justify-between bg-brand-bg/95 backdrop-blur-md border-r border-brand-border text-brand-sub font-sans transition-all duration-300 ${
      isCollapsed ? "w-16 p-2" : "w-64 p-3.5"
    }`} id="left-exchange-sidebar">
      <div className="flex flex-col flex-1 min-h-0 space-y-3">
        
        {/* Brand Header */}
        <div className={`flex items-center gap-2 border-b border-brand-border pb-3 shrink-0 ${
          isCollapsed ? "justify-center" : "px-1"
        }`}>
          <HideDexLogo size={28} showText={!isCollapsed} textSize="text-xs" />
        </div>

        {/* User Account Quick glance (Only if wallet connected) */}
        {walletAddress ? (
          <div className={`bg-brand-overlay-subtle border border-brand-border rounded-xl transition-all duration-300 shrink-0 ${
            isCollapsed ? "p-1.5 flex flex-col items-center justify-center gap-1.5" : "p-2.5 space-y-1"
          }`}>
            {isCollapsed ? (
              <div className="relative group">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-surface border border-brand-border px-2 py-1 rounded text-[10px] font-mono text-brand-text opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  {formatAddress(walletAddress)} ({selectedExchange !== "hyperliquid" ? <span className="text-brand-muted font-mono">—</span> : <TrustShieldValue fieldKey="portfolio" value={`${balanceUSDC.toFixed(2)}`} hideEyeIcon />})
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[8px] animate-in fade-in">
                  <span className="text-brand-muted font-bold uppercase tracking-wider">SECURE NODE</span>
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[10px] font-mono font-bold text-brand-text block truncate animate-in fade-in">
                  {formatAddress(walletAddress)}
                </div>
                <div className="flex justify-between items-center text-[9px] text-brand-sub font-mono pt-1 border-t border-brand-border animate-in fade-in">
                  <span>Bal:</span>
                  <span className="text-accent font-bold">
                    {selectedExchange !== "hyperliquid" ? <span className="text-brand-muted font-mono">—</span> : <TrustShieldValue fieldKey="portfolio" value={`${balanceUSDC.toFixed(2)}`} hideEyeIcon />}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          !isCollapsed && (
            <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-2.5 text-center animate-in fade-in shrink-0">
              <p className="text-[9px] text-brand-muted leading-normal">Connect a wallet to trade and manage portfolio.</p>
            </div>
          )
        )}

        {/* Flat Compact Navigation List - No Scrollbars */}
        <div className="shrink-0 space-y-1">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id || (item.id === ActiveTab.Perp && activeTab === ActiveTab.Spot);
            return (
              <button
                key={idx}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center rounded-lg text-left transition-all group relative ${
                  item.id === ActiveTab.Points ? "cursor-default opacity-85" : "cursor-pointer"
                } ${
                  isCollapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5"
                } ${
                  isSelected 
                    ? "bg-accent/5 text-accent border border-accent/15 shadow-sm shadow-accent/5" 
                    : "hover:bg-brand-overlay-subtle text-brand-sub hover:text-brand-text border border-transparent"
                }`}
                title={isCollapsed ? (item.badge ? `${item.label} (${item.badge})` : item.label) : undefined}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-r-md" />
                )}
                <Icon className={`w-3.5 h-3.5 shrink-0 transition-all ${
                  isSelected ? "text-accent scale-105" : "text-brand-muted group-hover:text-brand-text group-hover:scale-105"
                }`} />
                {!isCollapsed && (
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold leading-none">{item.label}</span>
                      {item.badge && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 ml-1">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] text-brand-muted tracking-wide font-normal group-hover:text-brand-sub truncate mt-0.5">{item.desc}</div>
                  </div>
                )}
              </button>
            );
          })}

          {/* Watchlist Section (Standard Mode Only) - Connected with Main Navigation */}
          {trustShieldMode === "STANDARD" && (
            <button
              onClick={() => setShowWatchlistPopup(true)}
              className={`w-full flex items-center rounded-lg text-left transition-all group relative cursor-pointer ${
                isCollapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5"
              } hover:bg-brand-overlay-subtle text-brand-sub hover:text-brand-text border border-transparent`}
              title={isCollapsed ? "My Watchlist" : undefined}
              id="sidebar-watchlist-trigger"
            >
              <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 group-hover:scale-105" />
              {!isCollapsed && (
                <div className="flex-grow min-w-0 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-extrabold leading-none">My Watchlist</div>
                    <div className="text-[8px] text-brand-muted tracking-wide font-normal group-hover:text-brand-sub truncate mt-0.5">Your starred assets</div>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-brand-overlay-normal text-brand-text px-1.5 py-0.5 rounded border border-brand-border/40 ml-1">
                    {watchlist.length}
                  </span>
                </div>
              )}
            </button>
          )}
        </div>

        {/* Spacer pushing footers to bottom */}
        <div className="flex-1 min-h-0" />

      </div>

      {/* Sidebar footers */}
      <div className="space-y-1.5 pt-4 border-t border-brand-border">
        
        {/* Support & FAQ button */}
        <button
          onClick={() => {
            setActiveTab(ActiveTab.Support);
            if (onCloseMobile) onCloseMobile();
          }}
          className={`w-full flex items-center rounded-xl text-left transition-all cursor-pointer ${
            activeTab === ActiveTab.Support
              ? "bg-violet-600/15 text-violet-400 border border-violet-500/15 shadow-sm shadow-violet-500/5"
              : "hover:bg-brand-overlay-subtle text-brand-sub hover:text-brand-text border border-transparent"
          } ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          title={isCollapsed ? "Support & FAQ" : undefined}
          id="sidebar-support-trigger"
        >
          <HelpCircle className={`w-4 h-4 ${activeTab === ActiveTab.Support ? "text-violet-400" : "text-brand-muted group-hover:text-brand-text"}`} />
          {!isCollapsed && <div className="text-xs font-bold">Support & FAQ</div>}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center rounded-xl text-left hover:bg-brand-overlay-subtle text-brand-sub hover:text-brand-text transition-all cursor-pointer ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          title={isCollapsed ? "Global Settings" : undefined}
          id="sidebar-settings-trigger"
        >
          <Settings className="w-4 h-4 text-brand-muted group-hover:text-brand-text" />
          {!isCollapsed && <div className="text-xs font-bold">Settings</div>}
        </button>

        {/* Disconnect button (Only if wallet connected) */}
        {walletAddress && (
          <button
            onClick={onDisconnectWallet}
            className={`w-full flex items-center rounded-xl text-left hover:bg-rose-950/20 text-brand-sub hover:text-rose-500 dark:hover:text-rose-400 transition-all cursor-pointer border border-transparent ${
              isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
            }`}
            title={isCollapsed ? "Disconnect" : undefined}
            id="sidebar-disconnect-trigger"
          >
            <LogOut className="w-4 h-4 text-brand-muted hover:text-rose-500 dark:hover:text-rose-400" />
            {!isCollapsed && <div className="text-xs font-bold">Disconnect</div>}
          </button>
        )}

        {/* Collapse Toggle Button (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex w-full items-center justify-center py-2 text-brand-muted hover:text-brand-text hover:bg-brand-overlay-subtle rounded-xl transition-all cursor-pointer"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          id="sidebar-collapse-toggle"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Small version brand */}
        {!isCollapsed && (
          <div className="text-center text-[9px] text-brand-muted font-mono pt-1">
            ANON LIQ v4.2 • SYNCED
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Unified Overlay Drawer for All Viewports */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={onCloseMobile}
          />
          {/* Sidebar Drawer Container */}
          <div className="relative w-64 h-full flex flex-col z-50 animate-in slide-in-from-left duration-200">
            <div className="h-full w-full">
              {React.cloneElement(sidebarContent, { className: "h-full flex flex-col justify-between bg-brand-bg/95 backdrop-blur-md border-r border-brand-border p-4 text-brand-sub font-sans w-64 shadow-2xl" })}
            </div>
            <button
              onClick={onCloseMobile}
              className="absolute top-4 -right-12 p-2 rounded-xl bg-brand-bg border border-brand-border text-brand-sub hover:text-brand-text shadow-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Watchlist Popup Modal */}
      {showWatchlistPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowWatchlistPopup(false)} />
          <div className="relative bg-brand-bg border border-brand-border text-brand-text rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400 border border-amber-500/20">
                  <Star className="w-4 h-4 fill-amber-500 dark:fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-brand-text">My Watchlist</h3>
                  <p className="text-[9px] text-brand-sub font-mono">STANDARDIZED ON-CHAIN WATCHLIST</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWatchlistPopup(false)}
                className="p-1.5 rounded-xl text-brand-sub hover:text-brand-text hover:bg-brand-overlay-normal transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {watchlist.length === 0 ? (
              <div className="text-center py-8 text-brand-sub text-xs font-mono">
                Your watchlist is empty.<br />
                Star assets in the Market tab to add them here.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {watchlist.map((symbol) => {
                  const token = tokens.find((t) => t.symbol === symbol);
                  const cleanSym = symbol.replace("-SPOT", "").replace("SPOT-", "").replace("-USDC", "").replace("/USDC", "").toUpperCase();
                  const isTop10 = ["BTC", "ETH", "SOL", "HYPE", "XRP", "AVAX", "SUI", "ARB", "OP", "ONDO"].includes(cleanSym);

                  return (
                    <div
                      key={symbol}
                      className="flex items-center justify-between bg-brand-surface hover:bg-brand-card border border-brand-border hover:border-success/40 p-2.5 rounded-xl transition-all cursor-pointer"
                      onClick={() => {
                        if (onSelectToken) onSelectToken(symbol);
                        setActiveTab(ActiveTab.Perp);
                        setShowWatchlistPopup(false);
                        if (onCloseMobile) onCloseMobile();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isTop10 && (
                          <div className="w-6 h-6 rounded-full bg-brand-card border border-brand-border flex items-center justify-center font-bold text-xs font-mono text-brand-text shrink-0">
                            {cleanSym === "BTC" ? "₿" : cleanSym === "ETH" ? "Ξ" : cleanSym === "XRP" ? "✕" : cleanSym.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-black text-brand-text">{symbol}</div>
                          <div className="text-[9px] text-brand-sub font-mono font-bold">Standard Asset</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-mono text-brand-text font-bold">
                            {token && typeof token.price === "number" && Number.isFinite(token.price)
                              ? `$${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "--"}
                          </div>
                          <div className={`text-[9px] font-mono font-bold ${
                            token && typeof token.change24h === "number" && Number.isFinite(token.change24h)
                              ? (token.change24h >= 0 ? "text-emerald-600 dark:text-[#00E878]" : "text-rose-600 dark:text-[#FF5C7A]")
                              : "text-brand-sub"
                          }`}>
                            {token && typeof token.change24h === "number" && Number.isFinite(token.change24h)
                              ? `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(2)}%`
                              : "--"}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleWatchlist) onToggleWatchlist(symbol);
                          }}
                          className="text-brand-sub hover:text-rose-500 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 p-1 rounded-lg transition-all cursor-pointer"
                          title="Remove from Watchlist"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
