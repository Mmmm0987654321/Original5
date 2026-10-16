/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTrustShield } from "../../lib/TrustShieldManager";
import { TrustShieldValue } from "../common/TrustShieldValue";
import { applyPreferencesToDOM } from "../trading/TradingPreferencesModal";
import { 
  Compass, 
  TrendingUp, 
  Briefcase, 
  Award, 
  UserPlus, 
  Globe, 
  Bell, 
  Settings, 
  Menu, 
  X, 
  ChevronDown,
  LayoutGrid,
  Wallet,
  Activity,
  LogOut,
  HelpCircle,
  Check,
  AlertCircle,
  Search,
  Sun,
  Moon,
  Zap,
  User,
  Trophy,
  ShieldCheck
} from "lucide-react";
import { ActiveTab, TokenMetadata, UserSettings } from "../../types";
import { useLanguage } from "../../lib/LanguageContext";
import { HideDexLogo } from "../common/HideDexLogo";
import { ALL_INDICATORS } from "../trading/IndicatorSheet";
import { DRAWING_SEARCH_ITEMS } from "../trading/KLineChartPane";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedExchange?: "hyperliquid" | "lighter";
  onSelectExchange?: (venue: "hyperliquid" | "lighter") => void;
  walletConnected: boolean;
  walletAddress: string;
  walletType: "MetaMask" | "Rabby" | "Coinbase" | "WalletConnect" | "Injected" | "ReadOnly" | "Phantom" | null;
  balanceUSDC: number;
  onConnectWallet: (type: "MetaMask" | "Rabby" | "Coinbase" | "WalletConnect" | "Injected" | "ReadOnly" | "Phantom") => void;
  onDisconnectWallet: () => void;
  topTokens: TokenMetadata[];
  onOpenSettings: () => void;
  onOpenPrivacyMode: () => void;
  notificationsCount: number;
  onOpenNotifications: () => void;
  chainId: number;
  onSwitchNetwork: (chainId: number) => void;
  onToggleMobileSidebar?: () => void;
  isSidebarOpen?: boolean;
  allTokens?: TokenMetadata[];
  onSelectToken?: (symbol: string) => void;
  showWalletModal: boolean;
  setShowWalletModal: (show: boolean) => void;
  userSettings?: UserSettings;
  onUpdateSettings?: (settings: Partial<UserSettings>) => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  selectedExchange = "hyperliquid",
  onSelectExchange,
  walletConnected,
  walletAddress,
  walletType,
  balanceUSDC,
  onConnectWallet,
  onDisconnectWallet,
  topTokens = [],
  onOpenSettings,
  onOpenPrivacyMode,
  notificationsCount,
  onOpenNotifications,
  chainId,
  onSwitchNetwork,
  onToggleMobileSidebar,
  isSidebarOpen,
  allTokens = [],
  onSelectToken,
  showWalletModal,
  setShowWalletModal,
  userSettings,
  onUpdateSettings,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [exchangeMenuOpen, setExchangeMenuOpen] = useState(false);
  const exchangeMenuRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const currentTheme = userSettings?.theme || "dark";
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  // Hide the compact exchange chooser when the user clicks away or presses Escape.
  useEffect(() => {
    if (!exchangeMenuOpen) return;
    const outside = (event: MouseEvent) => {
      if (!exchangeMenuRef.current?.contains(event.target as Node)) setExchangeMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExchangeMenuOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [exchangeMenuOpen]);

  // Handle outside click for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { mode: trustShieldMode, formatWalletAddress } = useTrustShield();

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    if (trustShieldMode === "ANONYMOUS" && addr.startsWith("0x")) {
      // Display-only short format. Wallet identity remains unchanged.
      return `${addr.slice(0, 4)}…${addr.slice(-3)}`;
    }
    if (addr.startsWith("0x")) {
      return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    }
    if (addr.length > 10) {
      return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    }
    return addr;
  };

  const getNetworkName = (id: number) => {
    return `Chain ${id}`;
  };

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Search is backed by existing live token catalog, implemented indicators,
  // actual drawing tools and real navigation/actions. No fake results.
  type SearchResult = {
    key: string;
    title: string;
    detail: string;
    kind: "Market" | "Indicator" | "Drawing tool" | "Page";
    query?: string;
    tab?: ActiveTab;
    action?: "settings" | "notifications" | "chart" | "orderbook";
  };
  const query = searchQuery.trim().toLowerCase();
  const searchResults = useMemo<SearchResult[]>(() => {
    const pages: SearchResult[] = [
      { key: "page-markets", title: "Markets", detail: "Browse all Spot & Perpetual assets", kind: "Page", tab: ActiveTab.Markets },
      { key: "page-trade", title: "Trade", detail: "Open trading terminal", kind: "Page", tab: ActiveTab.Perp },
      { key: "page-funds", title: "Funds", detail: "Balances, portfolio and analytics", kind: "Page", tab: ActiveTab.Portfolio },
      { key: "page-account", title: "Account", detail: "Account settings and privacy", kind: "Page", tab: ActiveTab.Profile },
      { key: "page-support", title: "Support & FAQ", detail: "Help and frequently asked questions", kind: "Page", tab: ActiveTab.Support },
      { key: "action-settings", title: "Settings", detail: "Trading preferences, privacy and theme", kind: "Page", action: "settings" },
      { key: "action-notifications", title: "Notifications", detail: "See in-app notifications", kind: "Page", action: "notifications" },
      { key: "action-chart", title: "Chart", detail: "Open live trading chart", kind: "Page", action: "chart" },
      { key: "action-orderbook", title: "Order Book", detail: "Open market depth", kind: "Page", action: "orderbook" },
    ];
    if (!query) return pages.slice(0, 6);
    const assets = (allTokens.length ? allTokens : topTokens)
      .filter(token => `${token.symbol} ${token.name} ${token.category || ""} ${token.sourceCoin || ""}`.toLowerCase().includes(query))
      .slice(0, 8)
      .map(token => ({
        key: `market-${token.symbol}`,
        title: token.symbol,
        detail: token.name || "Trade market",
        kind: "Market" as const,
        query: token.symbol,
      }));
    const indicators = ALL_INDICATORS
      .filter(ind => `${ind.name} ${ind.id} ${ind.alias || ""} indicator`.toLowerCase().includes(query))
      .slice(0, 6)
      .map(ind => ({
        key: `indicator-${ind.id}`,
        title: ind.name,
        detail: "Open implemented indicator",
        kind: "Indicator" as const,
        query: ind.name,
      }));
    const tools = DRAWING_SEARCH_ITEMS
      .filter(tool => `${tool.name} ${tool.id} ${tool.category} drawing tool`.toLowerCase().includes(query))
      .slice(0, 7)
      .map(tool => ({
        key: `drawing-${tool.categoryId}-${tool.id}`,
        title: tool.name,
        detail: `Chart tool · ${tool.category}`,
        kind: "Drawing tool" as const,
        query: tool.name,
      }));
    const actions = pages.filter(page => `${page.title} ${page.detail}`.toLowerCase().includes(query));
    return [...assets, ...indicators, ...tools, ...actions];
  }, [allTokens, topTokens, query]);

  const openSearchResult = (result: SearchResult) => {
    setSearchQuery("");
    setSearchFocused(false);
    if (result.kind === "Market" && result.query) {
      onSelectToken?.(result.query);
      setActiveTab(ActiveTab.Perp);
      return;
    }
    if ((result.kind === "Indicator" || result.kind === "Drawing tool") && result.query) {
      // Existing chart handles the real tool/indicator interactions.
      setActiveTab(ActiveTab.Perp);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("hidedex:global-view", { detail: { view: "chart" } }));
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("hidedex:global-chart-search", {
            detail: { kind: result.kind === "Indicator" ? "indicator" : "drawing", query: result.query },
          }));
        }, 100);
      }, 100);
      return;
    }
    if (result.action === "settings") { onOpenSettings(); return; }
    if (result.action === "notifications") { onOpenNotifications(); return; }
    if (result.action === "chart" || result.action === "orderbook") {
      setActiveTab(ActiveTab.Perp);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("hidedex:global-view", { detail: { view: result.action } }));
      }, 100);
      return;
    }
    if (result.tab) handleNavClick(result.tab);
  };

  useEffect(() => {
    const handleKeyboardSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
      if (event.key === "Escape") setSearchFocused(false);
    };
    document.addEventListener("keydown", handleKeyboardSearch);
    return () => document.removeEventListener("keydown", handleKeyboardSearch);
  }, []);

  const cycleTheme = () => {
    if (!onUpdateSettings) return;
    const next = currentTheme === "dark" ? "light" : "dark";
    // Commit palette synchronously in the same click; the App effect will
    // read this identical full profile and won't paint a half-switched theme.
    const profile = next === "light" ? "light" : "mono-dark";
    localStorage.setItem("pref_theme_id", profile);
    localStorage.setItem("anon_theme", next);
    applyPreferencesToDOM(
      profile,
      Number(localStorage.getItem("pref_font_size_percent") || 100),
      localStorage.getItem("pref_headers_font") || "Inter",
      localStorage.getItem("pref_numbers_font") || "JetBrains Mono"
    );
    onUpdateSettings({ theme: next });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-border bg-brand-bg/90 backdrop-blur-md">
      <div className="relative w-full flex h-14 items-center justify-between px-1.5 md:px-2.5">
        
        {/* Keep the brand visible even when sensitive account details are hidden. */}
        <div
          onClick={() => handleNavClick(ActiveTab.Landing)}
          className="flex items-center cursor-pointer group shrink-0"
          id="navbar-logo"
        >
          <HideDexLogo size={trustShieldMode === "ANONYMOUS" ? 28 : 32} showText={true} textSize={trustShieldMode === "ANONYMOUS" ? "text-xs sm:text-base" : "text-sm sm:text-base"} />
        </div>

        {/* Compact header venue switcher. Keep name/logo/wallet room on narrow phones.
            Venue switch is navigation only; never sign or send an order. */}
        {onSelectExchange && activeTab !== ActiveTab.Landing && (
          <div ref={exchangeMenuRef} className="relative ml-1 shrink-0 z-[75]" data-exchange-menu>
            <button type="button"
              aria-label={`Exchange: ${selectedExchange === "lighter" ? "Lighter" : "Hyperliquid"}. Change exchange`}
              title={selectedExchange === "lighter" ? "Lighter" : "Hyperliquid"}
              aria-haspopup="menu" aria-expanded={exchangeMenuOpen}
              onClick={() => setExchangeMenuOpen(open => !open)}
              className={`h-9 sm:h-10 inline-flex items-center justify-center gap-1 rounded-lg border px-2 text-brand-text transition-colors hover:bg-brand-overlay-normal ${exchangeMenuOpen ? "border-accent bg-brand-overlay-normal" : "border-brand-border bg-brand-surface"}`}>
              <span aria-hidden="true" className={`w-2 h-2 rounded-full ${selectedExchange === "lighter" ? "bg-sky-400" : "bg-emerald-400"}`}/>
              <span className="hidden min-[430px]:inline text-[10px] sm:text-xs font-semibold">{selectedExchange === "lighter" ? "Lighter" : "Hyperliquid"}</span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${exchangeMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {exchangeMenuOpen && (
              <div role="menu" aria-label="Select trading exchange"
                className="absolute top-full mt-2 left-0 max-[430px]:-left-20 w-[min(250px,calc(100vw-24px))] rounded-xl border border-brand-border bg-brand-surface shadow-2xl p-2 z-[100]">
                <p className="px-2 py-1.5 text-[10px] text-brand-muted font-semibold uppercase tracking-wider">Select Exchange</p>
                {([
                  { id: "hyperliquid", label: "Hyperliquid", hint: "Mainnet", dot: "bg-emerald-400" },
                  { id: "lighter", label: "Lighter", hint: "Mainnet · Integration preview", dot: "bg-sky-400" },
                ] as const).map(venue => (
                  <button type="button" role="menuitemradio"
                    aria-checked={selectedExchange === venue.id} key={venue.id}
                    onClick={() => { setExchangeMenuOpen(false); if (venue.id !== selectedExchange) onSelectExchange(venue.id); }}
                    className={`w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-brand-overlay-normal ${selectedExchange === venue.id ? "bg-brand-overlay-subtle" : ""}`}>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${venue.dot}`} />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-brand-text">{venue.label}</span>
                        <span className="block text-[10px] text-brand-muted">{venue.hint}</span>
                      </span>
                    </span>
                    {selectedExchange === venue.id && <Check className="w-4 h-4 text-accent shrink-0"/>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Centered command search, using only wired website features. */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-[min(38vw,360px)] min-w-[190px] z-[60]" ref={searchRef}>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-sm ${
            searchFocused
              ? "bg-brand-surface border-accent/60 ring-1 ring-accent/15"
              : "bg-brand-surface/70 border-brand-border hover:border-brand-text/25"
          }`}>
            <Search className="w-4 h-4 text-brand-muted shrink-0" />
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Search markets, indicators, chart tools and pages"
              placeholder="Search markets, indicators, tools..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(true); }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  e.preventDefault();
                  openSearchResult(searchResults[0]);
                }
                if (e.key === "Escape") setSearchFocused(false);
              }}
              className="bg-transparent text-xs text-brand-text placeholder:text-brand-muted focus:outline-none w-full min-w-0 font-sans font-medium"
            />
            {searchQuery ? (
              <button type="button" aria-label="Clear search" onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }} className="text-brand-muted hover:text-brand-text cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            ) : <span className="text-[10px] text-brand-muted/70 border border-brand-border rounded px-1.5 py-0.5 shrink-0">⌘ K</span>}
          </div>

          {searchFocused && (
            <div role="listbox" aria-label="Search results" className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-brand-bg border border-brand-border shadow-2xl overflow-hidden z-[100]">
              <div className="px-3 py-2 flex items-center justify-between border-b border-brand-border/60">
                <span className="text-[10px] font-semibold text-brand-muted">{query ? "Search results" : "Quick navigation"}</span>
                <span className="text-[10px] text-brand-muted">{searchResults.length} found</span>
              </div>
              <div className="max-h-[min(55dvh,360px)] overflow-y-auto p-1.5 space-y-0.5">
                {searchResults.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => openSearchResult(item)}
                    className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 hover:bg-brand-overlay-normal focus-visible:outline-accent transition-colors"
                  >
                    <span className="flex h-8 w-8 rounded-lg border border-brand-border bg-brand-surface items-center justify-center shrink-0 text-accent">
                      {item.kind === "Market" ? <Activity className="w-4 h-4" /> : item.kind === "Indicator" ? <TrendingUp className="w-4 h-4" /> : item.kind === "Drawing tool" ? <Zap className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-brand-text truncate">{item.title}</span>
                      <span className="text-[10px] text-brand-muted truncate">{item.detail}</span>
                    </span>
                    <span className="text-[9px] text-brand-muted shrink-0">{item.kind}</span>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <p className="p-4 text-xs text-brand-muted text-center">No matching markets, tools or features</p>
                )}
              </div>
              <div className="px-3 py-1.5 border-t border-brand-border/60 text-[10px] text-brand-muted">
                Enter to open · Esc to close
              </div>
            </div>
          )}
        </div>

        {/* Header Actions Container: right aligned in all privacy modes */}
        <div className="flex items-center gap-1 sm:gap-2.5 ml-auto shrink-0 min-w-0">
          
          {/* Extra Desktop-Only Actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            {/* Active Network Switcher */}
            <div className="relative">
              <button
                onClick={() => {
                  if (walletConnected) setNetworkDropdownOpen(!networkDropdownOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-mono transition-all ${
                  walletConnected
                    ? "bg-brand-surface hover:bg-brand-surface border-brand-border text-gray-200 cursor-pointer"
                    : "bg-brand-overlay-subtle border-transparent text-gray-500 cursor-not-allowed"
                }`}
              >
                <Globe className={`w-3.5 h-3.5 ${walletConnected ? "text-cyan-400" : "text-gray-600"}`} />
                <span>{walletConnected ? getNetworkName(chainId) : "Network"}</span>
                {walletConnected && <ChevronDown className="w-3 h-3 text-gray-500" />}
              </button>

              {walletConnected && networkDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNetworkDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-brand-bg p-1.5 shadow-2xl border border-brand-border z-50 animate-in fade-in slide-in-from-top-3 duration-100">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider px-2.5 py-1.5 border-b border-brand-border select-none">Current Network</p>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-300">
                      Chain {chainId}
                    </div>
                  </div>
                </>
              )}
            </div>


            {/* Notifications Button */}
            <button 
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl text-gray-400 hover:text-brand-text hover:bg-brand-overlay-normal border border-transparent hover:border-brand-border transition-all cursor-pointer"
              id="nav-notifications-btn"
            >
              <Bell className="w-4 h-4" />
              {notificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent ring-4 ring-brand-bg" />
              )}
            </button>
          </div>

          {/* Right Navigation Controls */}
          <div className="flex items-center gap-1 sm:gap-2.5">
            {/* 1. Wallet Button */}
            {walletConnected ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="relative shrink-0">
                  <button
                    onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                    className={`flex items-center gap-1 sm:gap-2 ${trustShieldMode === "ANONYMOUS" ? "px-1.5 sm:px-3" : "px-2 sm:px-3"} py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-accent/10 border border-accent/25 hover:border-accent text-[10px] sm:text-xs font-semibold transition-all cursor-pointer text-brand-text shadow-sm shrink-0`}
                    id="wallet-user-dropdown-btn"
                  >
                    <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[9px] sm:text-[11px] tracking-wide">
                      {formatAddress(walletAddress)}
                    </span>
                    <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400" />
                  </button>

                  {walletDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setWalletDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 sm:w-56 rounded-xl sm:rounded-2xl bg-brand-bg p-1.5 sm:p-2 shadow-2xl border border-brand-border z-50 animate-in fade-in slide-in-from-top-3 duration-100">
                        <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 border-b border-brand-border select-none">
                          <p className="text-[8px] sm:text-[9px] text-gray-400 font-bold tracking-wider uppercase">
                            {selectedExchange === "lighter" ? "Lighter Account" : "Ledger Balance"}
                          </p>
                          {selectedExchange === "lighter" ? (
                            <p className="text-xs text-brand-muted mt-1">See Lighter view for verified balances</p>
                          ) : (
                            <p className="text-xs sm:text-sm font-bold text-brand-text mt-0.5">
                              <TrustShieldValue
                                fieldKey="portfolio"
                                value={`${balanceUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
                              />
                            </p>
                          )}
                          <span className="text-[8px] sm:text-[9px] text-cyan-400 font-mono mt-1 block">
                            Wallet: {walletType}
                          </span>
                        </div>

                        {trustShieldMode !== "ANONYMOUS" && (
                          <div className="py-1">
                            <button 
                              onClick={() => { handleNavClick(ActiveTab.Profile); setWalletDropdownOpen(false); }}
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-gray-300 hover:text-brand-text hover:bg-brand-overlay-normal transition-all cursor-pointer font-semibold"
                            >
                              <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-400" />
                              Account & Balances
                            </button>
                          </div>
                        )}

                        <div className="py-1">
                          <div
                            className="flex w-full items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-gray-300 font-semibold cursor-default select-none opacity-80"
                          >
                            <div className="flex items-center gap-2">
                              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                              <span>Points Hub</span>
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              Upcoming
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-brand-border pt-1">
                          <button
                            onClick={() => { onDisconnectWallet(); setWalletDropdownOpen(false); }}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer font-semibold"
                          >
                            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Disconnect
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Disconnect Button */}
                <button
                  onClick={onDisconnectWallet}
                  className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 items-center justify-center border border-rose-500/15 hover:border-rose-500/30 ${trustShieldMode === "ANONYMOUS" ? "hidden sm:flex" : "flex"}`}
                  title="Disconnect Wallet"
                  id="quick-disconnect-btn"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-accent hover:opacity-90 text-brand-bg text-[10px] sm:text-xs font-bold transition-all active:scale-98 cursor-pointer select-none shrink-0"
                id="connect-wallet-btn"
              >
                Connect
              </button>
            )}

            {/* 3. Theme Toggle */}
            <button
              onClick={cycleTheme}
              className="flex items-center justify-center p-1.5 sm:p-2 rounded-xl border shadow-md transition-all active:scale-95 cursor-pointer shrink-0 group hover:brightness-125"
              style={{
                borderColor: "color-mix(in srgb, var(--accent-primary) 25%, var(--border-brand))",
                backgroundColor: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
                color: "var(--accent-primary)"
              }}
              title="Toggle Theme"
              id="theme-toggle"
            >
              {currentTheme === "dark" ? (
                <Moon className="w-4 h-4 group-hover:fill-current group-hover:scale-110 transition-all" strokeWidth={3.0} />
              ) : (
                <Sun className="w-4 h-4 group-hover:fill-current group-hover:scale-110 transition-all" strokeWidth={3.0} />
              )}
            </button>


            {/* Anonymous mode must never trap the user without a way to switch back.
                Opens the existing password-verified Trust Shield mode selector. */}
            {trustShieldMode === "ANONYMOUS" && (
              <button
                type="button"
                onClick={() => { setWalletDropdownOpen(false); onOpenPrivacyMode(); }}
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-all cursor-pointer shrink-0"
                title="Change Privacy Mode"
                aria-label="Change Privacy Mode"
                id="nav-change-privacy-mode"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            {/* 4. Sidebar Menu Button */}
            <button
              onClick={() => {
                if (onToggleMobileSidebar) {
                  onToggleMobileSidebar();
                } else {
                  setMobileMenuOpen(!mobileMenuOpen);
                }
              }}
              className="p-1.5 sm:p-2 rounded-xl border shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 group hover:brightness-125"
              style={{
                borderColor: "color-mix(in srgb, var(--accent-primary) 25%, var(--border-brand, #223247))",
                backgroundColor: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
                color: "var(--accent-primary)"
              }}
              id="mobile-menu-toggle"
              title="Menu"
            >
              {(isSidebarOpen || mobileMenuOpen) ? (
                <X className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" strokeWidth={3.0} />
              ) : (
                <Menu className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" strokeWidth={3.0} />
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-14 bg-brand-bg/95 backdrop-blur-lg border-b border-brand-border h-[calc(100vh-3.5rem)] z-40 overflow-y-auto p-4 flex flex-col justify-between">
          <div className="space-y-2">
            {[
              { id: ActiveTab.Dashboard, label: t("dashboard"), icon: LayoutGrid },
              { id: ActiveTab.Markets, label: t("markets"), icon: Compass },
              { id: ActiveTab.Perp, label: t("trade"), icon: Activity },
              { id: ActiveTab.Profile, label: "Account & Portfolio", icon: User },
            ].filter(item => !(trustShieldMode === "ANONYMOUS" && item.id === ActiveTab.Profile)).map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/15" 
                      : "text-gray-400 hover:text-brand-text hover:bg-brand-overlay-normal"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 pt-6 border-t border-brand-border">
            {walletConnected ? (
              <div className="bg-brand-surface border border-brand-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Balance</span>
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full uppercase">
                    {walletType}
                  </span>
                </div>
                <p className="text-xl font-bold text-brand-text mb-3">
                  {selectedExchange === "lighter" ? (
                    <span className="text-sm font-semibold text-brand-muted">Lighter balance: see Funds</span>
                  ) : (
                    <TrustShieldValue fieldKey="portfolio" value={`${balanceUSDC.toLocaleString()} USDC`} />
                  )}
                </p>
                <div className="flex gap-2 text-xs font-mono text-gray-400 bg-brand-overlay-subtle p-2.5 rounded-xl mb-3 items-center">
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  {formatAddress(walletAddress)}
                </div>

                <button
                  onClick={onDisconnectWallet}
                  className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold text-xs transition-all cursor-pointer"
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowWalletModal(true); setMobileMenuOpen(false); }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-brand-text font-semibold text-xs text-center block cursor-pointer"
              >
                Connect Wallet
              </button>
            )}

            <div className="flex items-center justify-around text-gray-400 text-[11px] py-2">
              {trustShieldMode !== "PRIVATE" && (
                <button onClick={() => { handleNavClick(ActiveTab.Support); }} className="flex items-center gap-1 hover:text-brand-text cursor-pointer">
                  <HelpCircle className="w-4 h-4" /> Support
                </button>
              )}
              {trustShieldMode !== "ANONYMOUS" && (
                <button onClick={() => { handleNavClick(ActiveTab.Profile); }} className="flex items-center gap-1 hover:text-brand-text cursor-pointer">
                  <Settings className="w-4 h-4" /> Profile
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
