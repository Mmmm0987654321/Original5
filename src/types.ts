/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ActiveTab {
  Landing = "landing",
  Markets = "markets",
  Spot = "spot",
  Perp = "perp",
  Portfolio = "portfolio",
  Leaderboard = "leaderboard",
  Referral = "referral",
  Blog = "blog",
  Support = "support",
  Legal = "legal",
  Profile = "profile",
  Dashboard = "dashboard",
  Orders = "orders",
  TradeHistory = "trade_history",
  Prediction = "prediction",
  Vaults = "vaults",
  Analytics = "analytics",
  Points = "points",
  EarlyAccess = "early_access",
}

// LEVERAGE_MAP removed - all leverage is retrieved dynamically from MarketRegistryService
export function getMaxLeverageForSymbol(symbol: string, maxLeverageFromMeta?: number): number {
  if (typeof maxLeverageFromMeta === "number" && maxLeverageFromMeta > 0) {
    return maxLeverageFromMeta;
  }
  return 0;
}

export function getPerpLeverageFormatted(symbol: string, maxLeverageFromMeta?: number): string {
  const lev = getMaxLeverageForSymbol(symbol, maxLeverageFromMeta);
  return lev > 0 ? `${lev}x` : "--";
}

export interface SpotAssetContext {
  markPx?: string | number | null;
  midPx?: string | number | null;
  prevDayPx?: string | number | null;
  dayNtlVlm?: string | number | null;
}

export interface TokenMetadata {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number | null;
  volume24h: number | null;
  openInterest?: number | null;
  fundingRate?: number | null;
  nextFundingIn?: string; // Perpetuals only
  high24h: number | null;
  low24h: number | null;
  maxLeverage?: number;
  category?: "perps" | "spot" | "stocks" | "commodities" | "indices" | "forex" | "pre_ipo";
  subcategory?:
    | "all"
    | "crypto"
    | "stocks"
    | "commodities"
    | "forex"
    | "indices"
    | "ai"
    | "defi"
    | "gaming"
    | "layer 1"
    | "layer 2"
    | "memes";
  fullName?: string;
  displayBaseAsset?: string;
  sourceCoin?: string;
  szDecimals?: number;
  isSpotOnly?: boolean;
  hasSpot?: boolean;
  spotSymbol?: string | null;
  growthMode?: boolean | null;
  deployerFeeScale?: number | null;
  spotCtx?: SpotAssetContext;
}

export interface Position {
  id: string;
  symbol: string;
  type: "LONG" | "SHORT";
  leverage: number;
  size: number; // in token unit
  entryPrice: number;
  markPrice: number;
  liqPrice: number;
  margin: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  isSpot?: boolean;
  fees?: number;
  funding?: number;
  marginRatio?: number;
  realizedPnl?: number;
  status?: "OPEN" | "CLOSED";
  openTime?: string;
  closeTime?: string;
  tpPrice?: number | null;
  slPrice?: number | null;
  sourceCoin?: string;
  rawSzi?: string;
  marginType?: "cross" | "isolated";
}

export interface OpenOrder {
  id: string;
  symbol: string;
  type:
    | "LIMIT"
    | "STOP_MARKET"
    | "TAKE_PROFIT"
    | "STOP_LIMIT"
    | "TAKE_LIMIT"
    | "SCALE"
    | "TWAP"
    | "TRIGGER"
    | "UNKNOWN";
  side: "BUY" | "SELL";
  price: number;
  size: number;
  filled?: number;
  remainingSize?: number;
  status: "OPEN" | "PARTIAL" | "CANCELLED" | "FILLED";
  timestamp: string;
  timestampMs?: number;
  reduceOnly?: boolean;
  timeInForce?: "GTC" | "IOC" | "ALO";
  sourceCoin?: string;
  isSpot?: boolean;
  dex?: string;
  oid?: number;
  cloid?: string | null;
  triggerPrice?: number;
  isTrigger?: boolean;
  tpsl?: "tp" | "sl";
}

export interface TradeHistoryItem {
  id: string;
  symbol: string;
  side: "BUY" | "SELL" | "LONG" | "SHORT";
  price: number;
  size: number;
  value: number;
  fee: number;
  timestamp: string;
  timestampMs?: number;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  openTime?: string;
  closeTime?: string;
  duration?: string;
  isSpot?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
}

export interface LeaderboardTrader {
  rank: number;
  address: string;
  pnlUSD: number;
  roi: number;
  volume30d: number;
}

export interface ReferralStat {
  code: string;
  totalReferees: number;
  totalVolume: number;
  totalEarnings: number;
}

export interface AppState {
  walletConnected: boolean;
  walletAddress: string;
  walletType: "MetaMask" | "Rabby" | "Coinbase" | "WalletConnect" | "Injected" | "ReadOnly" | "Phantom" | null;

  balanceUSDC: number;
  builderFeeApproved: boolean;
  selectedSymbol: string;
  activeTab: ActiveTab;
  currentSubLegalTab?: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  type: "ABOVE" | "BELOW";
  isActive: boolean;
  timestamp: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  avatarId: number;
  tier: "Standard" | "VIP" | "Pro" | "Institutional";
  antiPhishingCode: string;
}

export interface UserSettings {
  theme: "dark" | "light";
  language: "EN" | "HI" | "ES" | "ZH";
  pushEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
  orderFills: boolean;
  priceAlerts: boolean;
}

