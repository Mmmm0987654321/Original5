/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  User, 
  Settings, 
  Bell, 
  Volume2, 
  Sun, 
  Star, 
  BellRing, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  TrendingUp,
  Search,
  Check,
  UserCheck,
  Wallet,
  Briefcase,
  Layers,
  History,
  Coins,
  Users,
  HelpCircle,
  LogOut,
  Sparkles,
  Clock,
  Trophy
} from "lucide-react";
import { UserProfile, UserSettings, PriceAlert, TokenMetadata, Position, OpenOrder, TradeHistoryItem } from "../../types";
import { useTrustShield } from "../../lib/TrustShieldManager";
import PortfolioPanel from "./PortfolioPanel";
import PositionTable from "../trading/PositionTable";
import SupportPanel from "./SupportPanel";

interface ProfilePanelProps {
  profile: UserProfile;
  settings: UserSettings;
  priceAlerts: PriceAlert[];
  watchlist: string[];
  recentSearches: string[];
  tokens: TokenMetadata[];
  tokenBalances: Record<string, number>;
  onUpdateProfile: (p: Partial<UserProfile>) => void;
  onUpdateSettings: (s: Partial<UserSettings>) => void;
  onAddPriceAlert: (symbol: string, price: number, type: "ABOVE" | "BELOW") => void;
  onTogglePriceAlert: (id: string) => void;
  onDeletePriceAlert: (id: string) => void;
  onToggleWatchlist: (symbol: string) => void;
  onClearRecentSearches: () => void;
  onSelectToken: (symbol: string) => void;

  // Wallet, Portfolio, Orders & Earn integration props
  walletConnected: boolean;
  walletAddress: string;
  walletType: "MetaMask" | "Rabby" | "Coinbase" | "WalletConnect" | "Injected" | "ReadOnly" | "Phantom" | null;

  balanceUSDC: number;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onAddBalance?: (amt: number) => void;
  onDeductBalance?: (amt: number) => void;
  onWithdraw?: (amountUsd: string) => Promise<void> | void;
  onTransferUsdBetweenSpotAndPerp?: (args: {
    amountUsd: string;
    toPerp: boolean;
  }) => Promise<void> | void;
  withdrawableUsd?: number;
  spotAvailableUsdc?: number;
  mainPerpTransferAvailableUsd?: number;
  isPooledAccount?: boolean;
  tradingStateReady?: boolean;
  spotBalancesHydrated?: boolean;
  onAddNotification?: (title: string, desc: string, type: "info" | "success" | "warning" | "error") => void;

  positions: Position[];
  openOrders: OpenOrder[];
  tradeHistory: TradeHistoryItem[];
  onCancelOrder?: (id: string) => Promise<void> | void;
  onClosePosition?: (position: Position) => Promise<void> | void;
  onModifyOrder?: (id: string, newPrice: number, newSize: number) => Promise<void> | void;
  onSavePositionTpSl?: (position: Position, tpPrice: number | null, slPrice: number | null) => Promise<void> | void;
}

export default function ProfilePanel({
  profile,
  settings,
  priceAlerts,
  watchlist,
  recentSearches,
  tokens,
  tokenBalances,
  onUpdateProfile,
  onUpdateSettings,
  onAddPriceAlert,
  onTogglePriceAlert,
  onDeletePriceAlert,
  onToggleWatchlist,
  onClearRecentSearches,
  onSelectToken,

  walletConnected,
  walletAddress,
  walletType,
  balanceUSDC,
  onConnectWallet,
  onDisconnectWallet,
  onAddBalance,
  onDeductBalance,
  onWithdraw,
  onTransferUsdBetweenSpotAndPerp,
  withdrawableUsd,
  spotAvailableUsdc,
  mainPerpTransferAvailableUsd,
  isPooledAccount,
  tradingStateReady,
  spotBalancesHydrated,
  onAddNotification,

  positions,
  openOrders,
  tradeHistory,
  onCancelOrder = () => {},
  onClosePosition = () => {},
  onModifyOrder = () => {},
  onSavePositionTpSl,
}: ProfilePanelProps) {
  const [activeProfileTab, setActiveProfileTab] = useState<
    "WALLET" | "PORTFOLIO" | "ORDERS" | "HISTORY" | "REFERRAL" | "SECURITY" | "SETTINGS" | "SUPPORT" | "WATCHLIST"
  >("SETTINGS");
  
  const { 
    mode: trustShieldMode, 
    setMode: setTrustShieldMode, 
    hidePortfolioPrivate, 
    setHidePortfolioPrivate, 
    resetAll: resetTrustShield, 
    resetPopupStatus: resetTrustShieldPopup 
  } = useTrustShield();

  // Price alert input state
  const [alertSymbol, setAlertSymbol] = useState(tokens[0]?.symbol || "BTC");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertType, setAlertType] = useState<"ABOVE" | "BELOW">("ABOVE");

  // Profile forms state
  const [dispName, setDispName] = useState(profile.displayName || "Pro Trader #888");
  const [emailStr, setEmailStr] = useState(profile.email);
  const [phishCode, setPhishCode] = useState(profile.antiPhishingCode);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      displayName: dispName,
      email: emailStr,
      antiPhishingCode: phishCode,
    });
    localStorage.setItem("user_profile_nickname", dispName);
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(alertPrice);
    if (!isNaN(priceNum) && priceNum > 0) {
      onAddPriceAlert(alertSymbol, priceNum, alertType);
      setAlertPrice("");
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "Not Connected";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Verified real assets distribution based on actual on-chain balances
  const assetDistribution = useMemo(() => {
    const list: { name: string; ticker: string; amount: number; price: number; value: number; color: string }[] = [];

    // USDC balance
    const usdcVal = balanceUSDC || (tokenBalances && tokenBalances["USDC"]) || 0;
    if (usdcVal > 0) {
      list.push({
        name: "USDC Collateral",
        ticker: "USDC",
        amount: usdcVal,
        price: 1.00,
        value: usdcVal,
        color: "#2DE0C4",
      });
    }

    // Other real token balances
    if (tokenBalances) {
      Object.entries(tokenBalances).forEach(([sym, amt]) => {
        if (sym === "USDC" || amt <= 0) return;
        const meta = tokens.find((t) => t.symbol === sym);
        const price = meta?.price || 0;
        const color = sym === "BTC" ? "#f59e0b" : sym === "ETH" ? "#a78bfa" : sym === "SOL" ? "#06b6d4" : "#ec4899";
        list.push({
          name: meta?.name || sym,
          ticker: sym,
          amount: amt,
          price,
          value: amt * price,
          color,
        });
      });
    }

    return list;
  }, [balanceUSDC, tokenBalances, tokens]);

  const totalAssetVal = useMemo(() => {
    return assetDistribution.reduce((acc, curr) => acc + curr.value, 0);
  }, [assetDistribution]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-2" id="personal-profile-portal">
      {/* Sidebar navigation rail */}
      <div className="lg:col-span-1 space-y-2">
        {/* Short Profile Overview Card */}
        <div className="glass-panel rounded-xl p-4 text-center space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
          
          <div className="relative mx-auto w-20 h-20 rounded-full border border-violet-500/20 bg-violet-950/10 flex items-center justify-center select-none overflow-hidden text-violet-400">
            <User className="w-10 h-10" />
          </div>

          <div>
            <h3 className="font-display font-bold text-brand-text text-base leading-snug">{profile.displayName || "Pro Trader #888"}</h3>
          </div>
        </div>

        {/* Navigation panel selection tabs in exact requested order */}
        <div className="glass-panel rounded-xl p-1.5 flex flex-col space-y-0.5">
          <button
            id="account-tab-settings"
            onClick={() => setActiveProfileTab("SETTINGS")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer border ${
              activeProfileTab === "SETTINGS" 
                ? "bg-violet-600/15 text-violet-400 border-violet-500/15 shadow-sm shadow-violet-500/5" 
                : "text-gray-400 hover:text-white-absolute hover:bg-brand-overlay-subtle border-transparent"
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            Profile & Settings
          </button>

          <div
            className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between text-amber-400/80 bg-brand-overlay-subtle/50 border border-transparent cursor-default select-none"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Points Hub</span>
            </div>
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
              Upcoming
            </span>
          </div>

          <button
            id="account-tab-support"
            onClick={() => setActiveProfileTab("SUPPORT")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer border ${
              activeProfileTab === "SUPPORT" 
                ? "bg-violet-600/15 text-violet-400 border-violet-500/15 shadow-sm shadow-violet-500/5" 
                : "text-gray-400 hover:text-white-absolute hover:bg-brand-overlay-subtle border-transparent"
            }`}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            Support & FAQ
          </button>

          {walletConnected && (
            <button
              onClick={onDisconnectWallet}
              id="account-btn-disconnect"
              className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer border border-transparent mt-2 pt-3 border-t border-brand-border"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Disconnect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Main active panel section */}
      <div className="lg:col-span-3">
        
        {/* WALLET & BALANCES TAB */}
        {activeProfileTab === "WALLET" && (
          <div className="glass-panel rounded-xl p-3.5 space-y-3 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-violet-400" />
                Cryptographic Node Connection
              </h3>
              <p className="text-xs text-gray-400 mt-1">Configure your Web3 wallet link, verify collateral deposits, or clear connections.</p>
            </div>

            {walletConnected ? (
              <div className="space-y-6">
                {/* Connected status banner */}
                <div className="bg-brand-surface/80 border border-emerald-500/20 p-4.5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 block">Arbitrum Node Linked</span>
                      <span className="text-xs font-mono font-bold text-brand-text block mt-0.5">{formatAddress(walletAddress)}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">Linked via: <strong className="text-violet-400">{walletType || "Metamask"}</strong></span>
                    </div>
                  </div>
                  
                  <button
                    onClick={onDisconnectWallet}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Disconnect Node
                  </button>
                </div>

                {/* Account Balances Grid */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">On-Chain Clearance Balances</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-brand-overlay-subtle border border-brand-border p-4 rounded-xl space-y-1">
                      <span className="text-[9px] text-gray-500 uppercase font-black block">Total Net Value</span>
                      <span className="text-lg font-mono font-bold text-brand-text block">${totalAssetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-brand-overlay-subtle border border-brand-border p-4 rounded-xl space-y-1">
                      <span className="text-[9px] text-gray-500 uppercase font-black block">Free Collateral</span>
                      <span className="text-lg font-mono font-bold text-cyan-400 block">${balanceUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-brand-overlay-subtle border border-brand-border p-4 rounded-xl space-y-1">
                      <span className="text-[9px] text-gray-500 uppercase font-black block">Positions Value</span>
                      <span className="text-lg font-mono font-bold text-violet-400 block">${(totalAssetVal - balanceUSDC).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Asset list */}
                  <div className="border border-brand-border rounded-xl overflow-hidden mt-4">
                    <div className="grid grid-cols-3 bg-black/40 px-4 py-2 text-[9px] text-gray-500 font-bold uppercase">
                      <span>Asset / Protocol</span>
                      <span className="text-center">Balance Amount</span>
                      <span className="text-right">Estimated USDC Value</span>
                    </div>
                    <div className="divide-y divide-brand-border">
                      {assetDistribution.length > 0 ? (
                        assetDistribution.map((asset, idx) => (
                          <div key={idx} className="grid grid-cols-3 px-4 py-3 text-xs font-mono items-center hover:bg-brand-overlay-subtle transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                              <div>
                                <span className="text-brand-text font-bold block">{asset.ticker}</span>
                                <span className="text-[9px] text-gray-500 font-sans block">{asset.name}</span>
                              </div>
                            </div>
                            <span className="text-center font-bold text-gray-300">
                              {asset.ticker === "USDC" ? asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : asset.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.ticker}
                            </span>
                            <span className="text-right text-brand-text font-bold">
                              ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-brand-muted font-sans">
                          No active assets or deposited collateral found in connected wallet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mx-auto">
                  <Wallet className="w-8 h-8" />
                </div>
                <div className="max-w-sm mx-auto space-y-2">
                  <h4 className="text-sm font-bold text-brand-text">Cryptographic Node Connection Required</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Link your decentralized Web3 wallet to authorize clearing actions, track on-chain assets, and manage risk portfolios on the exchange.
                  </p>
                </div>
                <button
                  onClick={onConnectWallet}
                  className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white-absolute font-bold text-xs rounded-xl shadow-lg shadow-violet-500/10 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Secure Wallet
                </button>
              </div>
            )}
          </div>
        )}

        {/* PORTFOLIO & ASSETS ANALYTICS */}
        {activeProfileTab === "PORTFOLIO" && (
          <div>
            {walletConnected ? (
              <PortfolioPanel
                walletConnected={walletConnected}
                walletAddress={walletAddress}
                balanceUSDC={balanceUSDC}
                onDeposit={onAddBalance || (() => {})}
                onWithdraw={onWithdraw || (() => {})}
                onTransferUsdBetweenSpotAndPerp={onTransferUsdBetweenSpotAndPerp}
                withdrawableUsd={withdrawableUsd}
                spotAvailableUsdc={spotAvailableUsdc}
                mainPerpTransferAvailableUsd={mainPerpTransferAvailableUsd}
                isPooledAccount={isPooledAccount}
                tradingStateReady={tradingStateReady}
                spotBalancesHydrated={spotBalancesHydrated}
                positionsCount={positions.length}
                tokens={tokens}
                tokenBalances={tokenBalances}
              />
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mx-auto">
                  <Briefcase className="w-6 h-6" />
                </div>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Please connect your Web3 wallet to track visual metrics, bridge collateral, and review asset allocations.
                </p>
                <button onClick={onConnectWallet} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white-absolute text-xs font-bold cursor-pointer">
                  Connect Secure Wallet
                </button>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE TRIGGER ORDERS */}
        {activeProfileTab === "ORDERS" && (
          <div className="glass-panel rounded-2xl p-6 space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1.5 border-b border-brand-border pb-4">
              <h1 className="text-xl font-bold font-sans text-brand-text uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-400" />
                Trigger Orders
              </h1>
              <p className="text-xs text-gray-500">Review your open orders, stop-loss and take-profit settings on HideDex.</p>
            </div>
            
            {walletConnected ? (
              <PositionTable
                isPerp={true}
                positions={positions}
                openOrders={openOrders}
                tradeHistory={tradeHistory}
                onCancelOrder={onCancelOrder}
                onClosePosition={onClosePosition}
                onModifyOrder={onModifyOrder}
                onSavePositionTpSl={onSavePositionTpSl}
                initialTab="OPEN_ORDERS"
              />
            ) : (
              <div className="text-center py-12 space-y-4">
                <p className="text-xs text-gray-400">Please connect your Web3 wallet to manage trigger limit orders.</p>
                <button onClick={onConnectWallet} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white-absolute text-xs font-bold cursor-pointer">
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        )}

        {/* TRADE HISTORY AUDITS */}
        {activeProfileTab === "HISTORY" && (
          <div className="glass-panel rounded-2xl p-6 space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1.5 border-b border-brand-border pb-4">
              <h1 className="text-xl font-bold font-sans text-brand-text uppercase tracking-wider flex items-center gap-2">
                <History className="w-5 h-5 text-violet-400" />
                Settled Audits
              </h1>
              <p className="text-xs text-gray-500">Review your filled, cancelled and closed orders on HideDex.</p>
            </div>

            {walletConnected ? (
              <PositionTable
                isPerp={true}
                positions={positions}
                openOrders={openOrders}
                tradeHistory={tradeHistory}
                onCancelOrder={onCancelOrder}
                onClosePosition={onClosePosition}
                onModifyOrder={onModifyOrder}
                onSavePositionTpSl={onSavePositionTpSl}
                initialTab="HISTORY"
              />
            ) : (
              <div className="text-center py-12 space-y-4">
                <p className="text-xs text-gray-400">Please connect your Web3 wallet to view trade logs.</p>
                <button onClick={onConnectWallet} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white-absolute text-xs font-bold cursor-pointer">
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        )}

        {/* PROFILE SETTINGS & CORE PREFERENCES */}
        {activeProfileTab === "SETTINGS" && (
          <div className="glass-panel rounded-2xl p-6 space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-violet-400" />
                HideDex (hidedex.com) Settings & Profile
              </h3>
              <p className="text-xs text-gray-400 mt-1">Configure your personal visual settings, choose display names, and language locale.</p>
            </div>

            {/* Profile fields Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Display Nickname</label>
                <input
                  type="text"
                  value={dispName}
                  onChange={(e) => setDispName(e.target.value)}
                  className="w-full bg-brand-bg/80 border border-brand-border focus:border-violet-500 p-3 rounded-xl text-xs text-brand-text font-medium focus:outline-none"
                  placeholder="Trader nickname"
                  required
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white-absolute text-xs font-bold transition-all shadow-md shadow-violet-500/10 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Save Profile Parameters
              </button>
            </form>

            {/* Theme Settings Selector */}
            <div className="pt-4 border-t border-brand-border">
              <div className="bg-brand-surface/60 border border-brand-border p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-violet-400" />
                  Visual Theme Skins
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: "dark" })}
                    className={`p-3.5 rounded-xl text-left border flex flex-col space-y-1 transition-all cursor-pointer ${
                      settings.theme === "dark" 
                        ? "bg-violet-600/15 border-violet-500/50 text-brand-text font-bold shadow-sm" 
                        : "bg-brand-overlay-subtle border-brand-border/60 text-gray-400 hover:text-brand-text hover:bg-brand-overlay-normal"
                    }`}
                  >
                    <span className="font-bold text-xs text-brand-text">Theme 1: Dark Mode</span>
                    <span className="text-[10px] text-gray-400 leading-snug">Classic Dark Mode with optimized contrast & low eye strain.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: "light" })}
                    className={`p-3.5 rounded-xl text-left border flex flex-col space-y-1 transition-all cursor-pointer ${
                      settings.theme === "light" 
                        ? "bg-emerald-500/10 border-emerald-500/50 text-brand-text font-bold shadow-sm" 
                        : "bg-brand-overlay-subtle border-brand-border/60 text-gray-400 hover:text-brand-text hover:bg-brand-overlay-normal"
                    }`}
                  >
                    <span className="font-bold text-xs text-brand-text">Theme 2: Light Mode</span>
                    <span className="text-[10px] text-gray-400 leading-snug">Crisp Light Mode with high contrast & clean background.</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Notification triggers toggle section */}
            <div className="border-t border-brand-border pt-4 space-y-4">
              <h4 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-violet-400" />
                Notification Push Triggers
              </h4>
              <div className="text-xs font-semibold">
                <div className="flex items-center justify-between bg-brand-overlay-subtle p-3.5 rounded-xl border border-brand-border">
                  <div>
                    <span className="text-brand-text block">Website Upgrades & System Announcements</span>
                    <span className="text-[10px] text-gray-500 font-normal">Receive updates when new features or upgrades are scheduled or deployed.</span>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Instructions & Guidelines for Website Upgrades & Notifications */}
              <div className="bg-brand-surface/60 border border-brand-border rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-brand-text flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  Website Upgrade & System Notification Instructions
                </h5>
                <div className="space-y-2 text-[11px] text-gray-400 leading-relaxed font-normal">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <p>
                      <strong className="text-brand-text font-semibold">Scheduled Maintenance:</strong> Maintenance and system upgrades are announced in advance. Active positions and orders remain secure on-chain during upgrades.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <p>
                      <strong className="text-brand-text font-semibold">Real-Time Feature Rollouts:</strong> When new exchange features, perpetual markets, or protocol enhancements go live, an in-app banner and bell notification will notify you instantly.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <p>
                      <strong className="text-brand-text font-semibold">Security & Protocol Bulletins:</strong> Critical security advisories, risk management adjustments, and node status reports will be delivered through priority popups.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <p>
                      <strong className="text-brand-text font-semibold">Notification Controls:</strong> Toggle the switch above to enable or mute automatic popups and audio chimes for non-critical system updates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MY WATCHLIST TAB */}
        {activeProfileTab === "WATCHLIST" && (
          <div className="glass-panel rounded-2xl p-6 space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                My Watchlist
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Manage your favorite assets. Star or unstar assets to keep track of their latest prices directly.
              </p>
            </div>

            {/* List all available tokens with star triggers */}
            {tokens.filter((t) => watchlist.includes(t.symbol)).length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs font-mono">
                Aapka watchlist khali hai. Kisi asset ko watchlist mein jodne ke liye market list mein star icon par click karein.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {tokens
                  .filter((token) => watchlist.includes(token.symbol))
                  .map((token) => {
                    const isWatchlisted = watchlist.includes(token.symbol);
                    return (
                      <div 
                        key={token.symbol}
                        className="p-4 rounded-xl bg-brand-surface/60 border border-brand-border flex items-center justify-between hover:bg-brand-overlay-subtle transition-colors group"
                      >
                        <div 
                          className="cursor-pointer space-y-1 flex-1 min-w-0 pr-2"
                          onClick={() => onSelectToken(token.symbol)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-brand-text">{token.symbol}/USDC</span>
                          </div>
                          <span className="text-[10px] text-gray-500 block truncate">{token.name}</span>
                          <span className="text-xs font-mono font-bold text-brand-text block mt-1">
                            {typeof token.price === "number" && Number.isFinite(token.price)
                              ? `$${token.price.toLocaleString(undefined, { minimumFractionDigits: token.symbol === "PURR" ? 4 : 2 })}`
                              : "--"}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWatchlist(token.symbol);
                          }}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex-shrink-0 ${
                            isWatchlisted 
                              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20" 
                              : "bg-brand-overlay-subtle border-transparent text-gray-500 hover:text-gray-300 hover:bg-brand-overlay-normal"
                          }`}
                          title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                        >
                          <Star className={`w-4 h-4 ${isWatchlisted ? "fill-yellow-500" : ""}`} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* SECURITY & PRICE ALERTS */}
        {activeProfileTab === "SECURITY" && (
          <div className="glass-panel rounded-2xl p-6 space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                Anti-Phishing Security
              </h3>
              <p className="text-xs text-gray-400 mt-1">Configure security phrases, register price target monitors, and check favorited tokens.</p>
            </div>

            <div className="space-y-4 border-b border-brand-border pb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Anti-Phishing Security Code</label>
                <div className="relative">
                  <input
                    type="text"
                    value={phishCode}
                    onChange={(e) => setPhishCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full bg-brand-bg/80 border border-brand-border focus:border-violet-500 p-3 rounded-xl text-xs text-brand-text font-mono uppercase focus:outline-none tracking-widest"
                    placeholder="e.g. SECURE12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-gray-500 uppercase">10 chars max</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                  This custom security code will be present in all automated email notifications to prevent phish attempts.
                </p>
                <button
                  type="button"
                  onClick={() => onUpdateProfile({ antiPhishingCode: phishCode })}
                  className="mt-2 px-3 py-1.5 bg-violet-600/25 border border-violet-500/20 text-violet-400 rounded-xl text-[10px] font-bold hover:bg-violet-600/30 transition-all cursor-pointer"
                >
                  Apply Security Code
                </button>
              </div>
            </div>

            {/* Privacy Mode Settings */}
            <div className="space-y-3 border-b border-brand-border pb-6">
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Privacy Password Settings</h4>
                <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                  Reset your privacy password or update protection layers. Resetting your privacy password will delete the local password, lock the funds portal, and revert your Trust Shield back to Standard Mode.
                </p>
              </div>
              <div className="bg-brand-bg/80 border border-brand-border p-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-[11px] font-bold text-brand-text">
                  Status: <span className="text-violet-400 font-mono uppercase">{localStorage.getItem("privacyPasswordHash") ? "PASSWORD SET" : "NOT SET"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("privacyPasswordHash");
                    localStorage.removeItem("privacy_unlocked");
                    sessionStorage.removeItem("funds_unlocked");
                    setTrustShieldMode("STANDARD");
                    if (onAddNotification) {
                      onAddNotification("Password Reset Successful", "Privacy password has been cleared and reverted to Standard Mode.", "success");
                    }
                  }}
                  disabled={!localStorage.getItem("privacyPasswordHash")}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
                  id="reset-privacy-password-btn"
                >
                  Reset Privacy Password
                </button>
              </div>
            </div>

            {/* Set price alert Form */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">Set Gasless Price Target</h4>
              <form onSubmit={handleCreateAlert} className="bg-brand-surface/60 border border-brand-border p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase block">Asset Pair</label>
                  <select
                    value={alertSymbol}
                    onChange={(e) => setAlertSymbol(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-xs text-brand-text font-mono focus:outline-none"
                  >
                    {tokens.map((t) => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}/USDC</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase block">Trigger Condition</label>
                  <div className="grid grid-cols-2 bg-brand-bg p-0.5 rounded-lg border border-brand-border">
                    <button
                      type="button"
                      onClick={() => setAlertType("ABOVE")}
                      className={`py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${
                        alertType === "ABOVE" ? "bg-violet-600 text-white-absolute" : "text-gray-400 hover:text-white-absolute"
                      }`}
                    >
                      Goes Above
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlertType("BELOW")}
                      className={`py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${
                        alertType === "BELOW" ? "bg-violet-600 text-white-absolute" : "text-gray-400 hover:text-white-absolute"
                      }`}
                    >
                      Goes Below
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase block">Target Price (USDC)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-brand-text font-mono focus:outline-none focus:border-violet-500"
                      required
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-mono">USDC</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white-absolute font-bold text-xs rounded-lg transition-all shadow-md shadow-violet-500/10 cursor-pointer"
                >
                  Configure Alert
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUPPORT & FAQ */}
        {activeProfileTab === "SUPPORT" && (
          <SupportPanel initialTab="faq" />
        )}

      </div>
    </div>
  );
}
