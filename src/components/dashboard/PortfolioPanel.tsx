/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import HideDexFundsOverview from "./HideDexFundsOverview";
import HideDexAssetAllocation from "./HideDexAssetAllocation";
import { 
  Wallet, 
  Eye, 
  EyeOff, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRightLeft, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Coins, 
  Lock, 
  Unlock, 
  History, 
  TrendingUp, 
  Info,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  QrCode,
  Network,
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Sparkles,
  Layers,
  Trash2,
  RefreshCw
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { TokenMetadata, Position, OpenOrder } from "../../types";
import { useTrustShield } from "../../lib/TrustShieldManager";
import AnalyticsPanel, { DailyFillVolumeBars } from "./AnalyticsPanel";
import { hasPrivacyPassword, verifyPrivacyPassword, clearPrivacyPassword } from "../../lib/privacyPassword";
import { getOfficialTokenLogoCandidates } from "../../lib/tokenLogoData";
import { useLanguage } from "../../lib/LanguageContext";
import { 
  type PnlTimeseries,
  lastPnlHistoryValue,
  windowPnlHistoryDelta
} from "../../lib/hyperliquid";

export interface HyperliquidNetwork {
  id: string;
  name: string;
  chain: string;
  icon?: string;
}

export interface HyperliquidToken {
  symbol: string;
  name: string;
  icon?: string;
  decimals: number;
  supportedNetworkIds?: string[];
}

export interface HyperliquidAccountStatus {
  isActive: boolean;
  isActivated?: boolean;
  userAddress: string;
  marginSummary: any;
  crossMarginSummary: any;
  withdrawable: string;
}

export interface HyperliquidTransaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "WITHDRAW";
  symbol: string;
  amount: number;
  estimatedReceive?: number;
  fee?: number;
  status: "SIGNING" | "BROADCASTING" | "CONFIRMED" | "FAILED" | "PENDING";
  confirmationCount?: number;
  totalConfirmationsRequired?: number;
  timestamp: string;
  hash?: string;
  txHash?: string;
  networkId?: string;
  explorerUrl?: string;
}

interface PortfolioPanelProps {
  walletConnected: boolean;
  walletAddress: string;
  balanceUSDC: number; // Perpetual cash balance
  realWalletUsdc?: number; // Real connected Web3 wallet USDC balance on Arbitrum
  onDeposit: (amount: number) => Promise<void> | void;
  onWithdraw: (amountUsd: string) => Promise<void> | void;
  onTransferUsdBetweenSpotAndPerp?: (args: {
    amountUsd: string;
    toPerp: boolean;
  }) => Promise<void> | void;
  withdrawableUsd?: number;
  spotAvailableUsdc?: number;
  perpAccountValueUsd?: number;
  mainPerpTransferAvailableUsd?: number;
  isPooledAccount?: boolean;
  accountModeKnown?: boolean;
  accountValueUsd?: number;
  accountStateError?: string | null;
  tradingStateReady?: boolean;
  spotBalancesHydrated?: boolean;
  positionsCount: number;
  tokens: TokenMetadata[];
  tokenBalances: Record<string, number>;
  positions?: Position[];
  openOrders?: OpenOrder[];
  onCancelOrder?: (id: string) => void;
  hlLedger?: any[];
  pnlTimeseries?: PnlTimeseries | null;
  userFills?: readonly unknown[];
  userFillsLoading?: boolean;
  userFillsError?: boolean;
  lockedOrderMarginUsd?: number;
}


/**
 * Resolve the holding's icon from the existing exact Hyperliquid token-logo
 * catalog. Keep actual balance/quantity identity unchanged, and never show an
 * unrelated logo if all URLs fail. Remote assets add no binary bundle size.
 */
function HoldingAssetLogo({
  symbol,
  sourceCoin,
  compact = false,
}: {
  symbol: string;
  sourceCoin?: string;
  compact?: boolean;
}) {
  const canonicalSymbol = String(symbol || "").trim().toUpperCase();
  const candidates = useMemo(() => {
    const urls = getOfficialTokenLogoCandidates(canonicalSymbol, sourceCoin);
    if (canonicalSymbol === "USDC") {
      const officialUsdcFallback =
        "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xaf88d065e77c8cC2239327C5EDb3A432268e5831/logo.png";
      if (!urls.includes(officialUsdcFallback)) urls.push(officialUsdcFallback);
    }
    return urls;
  }, [canonicalSymbol, sourceCoin]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    setSourceIndex(0);
    setLoaded(null);
  }, [canonicalSymbol, sourceCoin]);

  const src = candidates[sourceIndex] ?? null;
  return (
    <span
      className={`relative shrink-0 inline-flex items-center justify-center overflow-hidden rounded-full border border-brand-border/50 bg-brand-surface ${compact ? "w-5 h-5" : "w-7 h-7 sm:w-8 sm:h-8"}`}
      title={canonicalSymbol}
      aria-label={`${canonicalSymbol} token logo`}
    >
      {canonicalSymbol === "USDC" ? (
        <svg viewBox="0 0 32 32" aria-hidden="true" className="absolute inset-0 w-full h-full">
          <circle cx="16" cy="16" r="15" fill="#2775CA" />
          <path d="M16 7v18M20.3 11.2c-1.1-1.1-2.5-1.7-4.3-1.7-2.6 0-4.4 1.2-4.4 3.2 0 1.9 1.4 2.7 4.5 3.4 3.1.7 4.5 1.6 4.5 3.5 0 1.9-1.7 3.1-4.5 3.1-1.9 0-3.5-.6-4.7-1.8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M9 10.5a9.5 9.5 0 0 0 0 11M23 10.5a9.5 9.5 0 0 1 0 11" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        </svg>
      ) : (
        <span className="font-bold text-brand-text font-sans text-[9px] sm:text-[10px] uppercase">
          {canonicalSymbol.slice(0, compact ? 2 : 3)}
        </span>
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-contain ${loaded === src ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(src)}
          onError={() => {
            setLoaded(null);
            setSourceIndex(current => current + 1);
          }}
        />
      )}
    </span>
  );
}

const MIN_DEPOSIT_USDC = 6;
const MIN_WITHDRAWAL_USDC = 6;
const WITHDRAWAL_FEE_USDC = 1;

export default function PortfolioPanel({
  walletConnected,
  walletAddress,
  balanceUSDC,
  realWalletUsdc = 0,
  onDeposit,
  onWithdraw,
  onTransferUsdBetweenSpotAndPerp,
  withdrawableUsd = 0,
  spotAvailableUsdc = 0,
  perpAccountValueUsd,
  mainPerpTransferAvailableUsd = 0,
  isPooledAccount = false,
  accountModeKnown = false,
  accountValueUsd,
  accountStateError = null,
  tradingStateReady = false,
  spotBalancesHydrated = false,
  positionsCount,
  tokens,
  tokenBalances,
  positions = [],
  openOrders = [],
  onCancelOrder,
  hlLedger = [],
  pnlTimeseries = null,
  userFills = [],
  userFillsLoading = false,
  userFillsError = false,
  lockedOrderMarginUsd = 0,
}: PortfolioPanelProps) {
  
  const { t } = useLanguage();
  const hyperliquidAccountModeLabel =
    !tradingStateReady || !accountModeKnown
      ? "--"
      : isPooledAccount
        ? "Unified"
        : "Standard";

  // Copy-address visual feedback
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Load networks and tokens dynamically
  const [supportedNetworks, setSupportedNetworks] = useState<HyperliquidNetwork[]>([]);
  const [supportedTokens, setSupportedTokens] = useState<HyperliquidToken[]>([]);

  // Selected Network & Token inside Modals
  const [selectedNetwork, setSelectedNetwork] = useState<HyperliquidNetwork | null>(null);
  const [selectedToken, setSelectedToken] = useState<HyperliquidToken | null>(null);

  useEffect(() => {
    const network: HyperliquidNetwork = {
      id: "arbitrum",
      name: "Arbitrum One",
      chain: "arbitrum",
    };

    const token: HyperliquidToken = {
      symbol: "USDC",
      name: "USD Coin (Arbitrum Native)",
      decimals: 6,
      supportedNetworkIds: [
        "arbitrum",
      ],
    };

    setSupportedNetworks([
      network,
    ]);

    setSupportedTokens([
      token,
    ]);

    setSelectedNetwork(
      network
    );

    setSelectedToken(
      token
    );
  }, []);

  // Real-time USDC wallet balance state for in-app browser refresh
  const [localSpotUsdc, setLocalSpotUsdc] = useState<number | null>(null);
  const displayWalletUsdc = localSpotUsdc !== null ? localSpotUsdc : realWalletUsdc;

  // Trust Shield integration
  const { mode: trustShieldMode, isFieldHidden, toggleTempReveal, formatWalletAddress, setMode } = useTrustShield();
  const hideBalances = isFieldHidden("portfolio");

  // Local Funds lock state for Private & Anonymous Mode
  const [fundsUnlocked, setFundsUnlocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("privacy_unlocked") === "true" || sessionStorage.getItem("funds_unlocked") === "true";
    }
    return false;
  });

  const hasPassword = hasPrivacyPassword();
  const isLocked = (trustShieldMode === "PRIVATE" || trustShieldMode === "ANONYMOUS") && hasPassword && !fundsUnlocked;

  const [showFundsUnlockPopup, setShowFundsUnlockPopup] = useState(isLocked);

  // Sync state with changes to isLocked
  useEffect(() => {
    if (isLocked) {
      setShowFundsUnlockPopup(true);
    } else {
      setShowFundsUnlockPopup(false);
    }
  }, [isLocked]);

  const [passwordAttempt, setPasswordAttempt] = useState("");
  const [showPasswordAttempt, setShowPasswordAttempt] = useState(false);
  const [pwError, setPwError] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetPassword = () => {
    // 1. Clear privacy password and unlock status
    clearPrivacyPassword();
    localStorage.removeItem("privacy_unlocked");
    sessionStorage.removeItem("funds_unlocked");
    setFundsUnlocked(false);

    // 2. Clear local encrypted trade, order, twap, and activity caches
    localStorage.removeItem("exchange_trade_history");
    localStorage.removeItem("exchange_open_orders");
    localStorage.removeItem("exchange_order_history");
    localStorage.removeItem("exchange_funding_history");
    localStorage.removeItem("exchange_twap_history");
    localStorage.removeItem("exchange_admin_activity_logs");

    // 3. Reset Trust Shield mode to Standard!
    setMode("STANDARD");

    setShowResetConfirm(false);
    setPasswordAttempt("");
    setPwError("");

    window.dispatchEvent(new CustomEvent("trading-notification", {
      detail: {
        title: "Trust Shield Reset",
        description: "Privacy password cleared and mode reset to Standard.",
        type: "success"
      }
    }));
  };

  // Sync state with sessionStorage changes or mode changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      setFundsUnlocked(localStorage.getItem("privacy_unlocked") === "true" || sessionStorage.getItem("funds_unlocked") === "true");
    }
  }, [trustShieldMode]);

  const handleUnlock = async () => {
    const authorized = await verifyPrivacyPassword(passwordAttempt).catch(() => false);
    if (!authorized) {
      setPwError("Incorrect password. Please try again.");
      return;
    }
    localStorage.setItem("privacy_unlocked", "true");
    sessionStorage.setItem("funds_unlocked", "true");
    setFundsUnlocked(true);
    setShowFundsUnlockPopup(false);
    setPwError("");
    setPasswordAttempt("");
  };

  // Modal active states
  const [activeModal, setActiveModal] = useState<"DEPOSIT" | "WITHDRAW" | "TRANSFER" | null>(null);
  const [depositMode] = useState<"DIRECT_BRIDGE">("DIRECT_BRIDGE");
  const [amount, setAmount] = useState<string>("");
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [transferDirection, setTransferDirection] = useState<"spot_to_perp" | "perp_to_spot">("spot_to_perp");
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (activeModal === "TRANSFER" && isPooledAccount) {
      setActiveModal(null);
      setAmount("");
    }
  }, [activeModal, isPooledAccount]);

  useEffect(() => {
    if (activeModal === "DEPOSIT" || activeModal === "WITHDRAW") {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [activeModal]);

  const customHistory: HyperliquidTransaction[] = useMemo(() => {
    if (!Array.isArray(hlLedger) || hlLedger.length === 0) return [];
    const mapped: HyperliquidTransaction[] = [];
    hlLedger.forEach((update: any, index: number) => {
      const delta = update?.delta || {};
      const rawType = String(delta.type || '').toLowerCase();
      if (rawType !== 'deposit' && rawType !== 'withdraw' && rawType !== 'withdrawal') {
        return;
      }
      const type: "DEPOSIT" | "WITHDRAW" = (rawType === 'withdraw' || rawType === 'withdrawal') ? "WITHDRAW" : "DEPOSIT";
      const amount = Number(delta.usdc ?? 0);
      const timestampMs = Number(update.time ?? 0);
      const hash = String(update.hash ?? '');
      const formattedTimestamp = timestampMs > 0 ? new Date(timestampMs).toLocaleString() : 'N/A';

      mapped.push({
        id: hash || `${type}:${timestampMs}:${index}`,
        type,
        symbol: "USDC",
        amount,
        fee: 0,
        status: "CONFIRMED",
        timestamp: formattedTimestamp,
        hash,
        txHash: hash,
        networkId: "Hyperliquid",
      });
    });
    return mapped;
  }, [hlLedger]);

  const toggleHideBalances = () => {
    toggleTempReveal("portfolio");
  };

  // Disconnected action handlers (clean frontend shell)
  const handleOnboardingActivation = async () => {};

  // Copy to clipboard helper
  const handleCopyAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Filter tokens based on selected network compatibility
  const tokensForSelectedNetwork = useMemo(() => {
    if (!selectedNetwork) return supportedTokens;
    return supportedTokens.filter(t => t.supportedNetworkIds.includes(selectedNetwork.id));
  }, [selectedNetwork, supportedTokens]);

  // Auto-populate withdrawal destination address when modal opens
  useEffect(() => {
    if (activeModal === "WITHDRAW" && walletAddress && !destinationAddress) {
      setDestinationAddress(walletAddress);
    }
  }, [activeModal, walletAddress, destinationAddress]);

  // Adjust selected token if compatibility changes
  useEffect(() => {
    if (selectedNetwork && selectedToken) {
      const isSupported = selectedToken.supportedNetworkIds.includes(selectedNetwork.id);
      if (!isSupported && tokensForSelectedNetwork.length > 0) {
        setSelectedToken(tokensForSelectedNetwork[0]);
      }
    }
  }, [selectedNetwork, tokensForSelectedNetwork, selectedToken]);

  // --- REAL-TIME CALCULATIONS ---
  const spotUSDC = tokenBalances["USDC"] !== undefined ? tokenBalances["USDC"] : 0;

  const spotHoldingsList = useMemo(() => {
    return Object.entries(tokenBalances).map(([symbol, quantity]) => {
      const token = tokens.find(t => t.symbol === symbol);
      const price =
        typeof token?.price === "number" &&
        Number.isFinite(token.price)
          ? token.price
          : null;
      return {
        symbol,
        name: token ? token.name : symbol,
        sourceCoin: token?.sourceCoin,
        quantity,
        price,
        valueUSD:
          price !== null
            ? quantity * price
            : null
      };
    });
  }, [tokenBalances, tokens]);

  const spotAltcoinsUSDValue = useMemo(() => {
    return spotHoldingsList.reduce((sum, item) => {
      if (item.symbol.toUpperCase() === "USDC") {
        return sum;
      }

      if (
        typeof item.valueUSD === "number" &&
        Number.isFinite(item.valueUSD)
      ) {
        return sum + item.valueUSD;
      }

      return sum;
    }, 0);
  }, [spotHoldingsList]);

  const totalSpotBalance = spotUSDC + spotAltcoinsUSDValue;
  // Official Hyperliquid equity and available-to-trade are different values.
  // Do not build an account value by recomputing unrealized PnL from token prices.
  const realPerpEquity =
    typeof perpAccountValueUsd === "number" && Number.isFinite(perpAccountValueUsd)
      ? perpAccountValueUsd
      : null;
  const totalPortfolioValue = isPooledAccount
    ? totalSpotBalance
    : totalSpotBalance + (realPerpEquity ?? 0);
  const availablePerpBalance = Math.max(0, Number(withdrawableUsd) || 0);

  const lockedPositionMargin = useMemo(() => {
    return (positions || []).reduce((sum, pos) => sum + pos.margin, 0);
  }, [positions]);

  const lockedOrderMargin =
    Number.isFinite(
      lockedOrderMarginUsd,
    )
      ? Math.max(
          0,
          lockedOrderMarginUsd,
        )
      : 0;

  const totalLockedBalance = lockedPositionMargin + lockedOrderMargin;

  const shouldHideBalances = hideBalances || isLocked;

  // Format Helper
  const formatAmount = (val: number, isCurrency: boolean = true, decimals: number = 2) => {
    if (shouldHideBalances) return "••••••";
    const formatted = val.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
    return isCurrency ? `${formatted} USDC` : formatted;
  };

  const formatApproxUSD = (val: number | null) => {
    if (shouldHideBalances) return "≈ ••••••";
    if (val === null || typeof val !== "number" || !Number.isFinite(val)) return "--";
    return `≈ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  };

  // Disconnected service layer dispatchers
  const handleDepositSubmit =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      setTxErrorMessage("");

      if (
        !walletConnected ||
        !walletAddress
      ) {
        setTxErrorMessage(
          "Please connect a Web3 wallet first to execute deposit."
        );
        return;
      }

      const amt =
        parseFloat(amount);

      if (
        !Number.isFinite(amt) ||
        amt <= 0
      ) {
        setTxErrorMessage(
          "Please enter a valid deposit amount."
        );
        return;
      }

      if (amt < MIN_DEPOSIT_USDC) {
        setTxErrorMessage(
          `Minimum deposit amount is ${MIN_DEPOSIT_USDC} USDC.`
        );
        return;
      }

      if (
        !selectedNetwork ||
        !selectedToken
      ) {
        setTxErrorMessage(
          "Please select network and token."
        );
        return;
      }

      if (
        selectedNetwork.id !==
          "arbitrum" ||
        selectedToken.symbol !==
          "USDC"
      ) {
        setTxErrorMessage(
          "Deposit supports Arbitrum Native USDC only."
        );
        return;
      }

      setIsDepositing(true);

      try {
        /*
         * Part 1 performs the real tested
         * Native USDC -> Bridge2 transaction.
         */
        await onDeposit(
          amt
        );

        setAmount("");
      } catch (
        err: any
      ) {
        setTxErrorMessage(
          err?.message
            ? String(err.message)
            : "Deposit transaction failed."
        );
      } finally {
        setIsDepositing(false);
      }
    };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxErrorMessage("");

    if (!walletConnected || !walletAddress) {
      setTxErrorMessage("Wallet not connected");
      return;
    }

    if (!tradingStateReady) {
      setTxErrorMessage("Trading state is loading, please wait...");
      return;
    }

    const trimmed = amount.trim();
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setTxErrorMessage("Please enter a valid withdrawal amount");
      return;
    }

    if (parsed < MIN_WITHDRAWAL_USDC) {
      setTxErrorMessage(
        `Minimum withdrawal amount is ${MIN_WITHDRAWAL_USDC} USDC`
      );
      return;
    }

    if (parsed > withdrawableUsd + 0.01) {
      setTxErrorMessage(`Amount exceeds withdrawable balance of ${withdrawableUsd.toFixed(2)} USDC`);
      return;
    }

    setIsWithdrawing(true);
    try {
      await onWithdraw(trimmed);
      setAmount("");
      setActiveModal(null);
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "Failed to execute withdrawal";
      setTxErrorMessage(msg);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxErrorMessage("");

    if (!walletConnected || !walletAddress) {
      setTxErrorMessage("Wallet not connected");
      return;
    }

    const isHydrated =
      transferDirection === "spot_to_perp"
        ? spotBalancesHydrated
        : tradingStateReady;

    if (!isHydrated) {
      setTxErrorMessage("Balance data is still loading, please wait...");
      return;
    }

    const trimmed = amount.trim();
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setTxErrorMessage("Please enter a valid transfer amount");
      return;
    }

    if (parsed < 1) {
      setTxErrorMessage("Minimum transfer amount is 1 USDC");
      return;
    }

    const available =
      transferDirection === "spot_to_perp"
        ? spotAvailableUsdc
        : mainPerpTransferAvailableUsd;

    if (parsed > available + 1e-9) {
      setTxErrorMessage(
        `Amount exceeds available ${transferDirection === "spot_to_perp" ? "Spot" : "Perpetual"} balance of ${available.toFixed(2)} USDC`
      );
      return;
    }

    if (!onTransferUsdBetweenSpotAndPerp) {
      setTxErrorMessage("Transfer handler not available");
      return;
    }

    setIsTransferring(true);
    try {
      await onTransferUsdBetweenSpotAndPerp({
        amountUsd: trimmed,
        toPerp: transferDirection === "spot_to_perp",
      });
      setAmount("");
      setActiveModal(null);
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "Failed to execute transfer";
      setTxErrorMessage(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  // Real holdings list for Holdings section (non-zero holdings + USDC primary)
  const nonZeroHoldings = useMemo(() => {
    const list: Array<{
      symbol: string;
      name: string;
      quantity: number;
      price: number | null;
      valueUSD: number | null;
      isUsdc?: boolean;
      sourceCoin?: string;
    }> = [];

    // 1. USDC primary holding
    const usdcTotal = isPooledAccount
      ? Math.max(spotUSDC, balanceUSDC)
      : (spotUSDC + balanceUSDC);

    list.push({
      symbol: "USDC",
      name: "USD Coin",
      quantity: usdcTotal,
      price: 1.0,
      valueUSD: usdcTotal,
      isUsdc: true,
    });

    // 2. Altcoin holdings with quantity > 0
    spotHoldingsList.forEach((holding) => {
      if (holding.symbol.toUpperCase() === "USDC") return;
      if (typeof holding.quantity === "number" && holding.quantity > 0.000001) {
        list.push({
          symbol: holding.symbol,
          name: holding.name,
          sourceCoin: holding.sourceCoin,
          quantity: holding.quantity,
          price: holding.price,
          valueUSD: holding.valueUSD,
        });
      }
    });

    return list;
  }, [isPooledAccount, spotUSDC, balanceUSDC, spotHoldingsList]);

  // Real Asset Allocation Total (USDC Collateral + Non-USDC Spot Altcoins)
  const allocationTotal = useMemo(() => {
    return Math.max(0, spotUSDC) + Math.max(0, spotAltcoinsUSDValue);
  }, [spotUSDC, spotAltcoinsUSDValue]);

  // Visual Assets Allocation Data from real holdings only (excludes unrealized PnL)
  const assetDistributionData = useMemo(() => {
    const usdcVal = Math.max(0, spotUSDC);
    const altcoinsVal = Math.max(0, spotAltcoinsUSDValue);
    const total = usdcVal + altcoinsVal;

    return [
      {
        name: "USDC Collateral",
        value: usdcVal,
        displayVal: usdcVal,
        pct: total > 0 ? (usdcVal / total) * 100 : 0,
        color: "#10b981", // emerald / success
      },
      {
        name: "Spot Altcoins",
        value: altcoinsVal,
        displayVal: altcoinsVal,
        pct: total > 0 ? (altcoinsVal / total) * 100 : 0,
        color: "#6b7280", // slate / neutral
      },
    ];
  }, [spotUSDC, spotAltcoinsUSDValue]);

  const pieChartData = useMemo(() => {
    return assetDistributionData.filter((d) => d.value > 0);
  }, [assetDistributionData]);

  // Real performance timeseries data for Performance card
  const [performancePeriod, setPerformancePeriod] = useState<"day" | "week" | "month" | "allTime">("day");
  const [performanceMarket, setPerformanceMarket] = useState<"all" | "spot" | "perps">("all");

  const selectedPerformanceEntry = pnlTimeseries?.[performancePeriod] ?? null;

  const selectedNetPnl = useMemo(() => {
    if (!selectedPerformanceEntry?.pnlHistory) return null;
    if (performancePeriod === "allTime") {
      return lastPnlHistoryValue(selectedPerformanceEntry.pnlHistory);
    }
    return windowPnlHistoryDelta(selectedPerformanceEntry.pnlHistory);
  }, [selectedPerformanceEntry, performancePeriod]);

  const selectedPerformanceVolume = useMemo(() => {
    if (!selectedPerformanceEntry?.vlm) return null;
    const num = parseFloat(selectedPerformanceEntry.vlm);
    return Number.isFinite(num) ? num : null;
  }, [selectedPerformanceEntry]);

  const equityChartData = useMemo(() => {
    if (
      !selectedPerformanceEntry?.accountValueHistory ||
      !Array.isArray(selectedPerformanceEntry.accountValueHistory)
    ) {
      return [];
    }
    const points: { timestamp: number; value: number }[] = [];
    for (const item of selectedPerformanceEntry.accountValueHistory) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const t = Number(item[0]);
      const v = Number(item[1]);
      if (Number.isFinite(t) && Number.isFinite(v)) {
        points.push({ timestamp: t, value: v });
      }
    }
    return points;
  }, [selectedPerformanceEntry]);

  return (
    <div className="space-y-3 sm:space-y-4 text-brand-text font-sans bg-brand-bg px-3 pt-2 pb-2 sm:p-4 sm:pb-8 rounded-3xl max-w-4xl mx-auto w-full" id="funds-dashboard-master">
      
      <AnimatePresence mode="wait">
        {isLocked ? (
          <motion.div 
            key="dashboard-locked"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-brand-surface border border-brand-border/60 rounded-3xl p-6 sm:p-10 text-center max-w-lg mx-auto space-y-5 shadow-xl relative overflow-hidden"
            id="hl-locked-portfolio-container"
          >
            {/* Visual aesthetic backgrounds */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/5 rounded-full blur-2xl" />
            
            <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 relative">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-accent bg-accent/10 px-3 py-1 rounded-full">
                Security Shield Active
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-brand-text tracking-tight">
                {t("funds_locked")}
              </h2>
              <p className="text-xs text-brand-muted max-w-sm mx-auto leading-relaxed">
                This privacy mode masks supported balances and account details on your screen. It does not encrypt blockchain records or hide on-chain activity.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowFundsUnlockPopup(true)}
                className="w-full max-w-xs py-3 bg-accent hover:opacity-90 text-brand-bg font-bold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mx-auto"
                id="main-unlock-funds-btn"
              >
                <Unlock className="w-4 h-4" />
                <span>{t("unlock_funds")}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="dashboard-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3 sm:space-y-4"
          >
            <HideDexFundsOverview
              totalLabel={t("total_funds")}
              totalValue={!tradingStateReady
                ? (shouldHideBalances ? "••••••" : "--")
                : formatAmount(typeof accountValueUsd === "number" && Number.isFinite(accountValueUsd)
                  ? accountValueUsd : totalPortfolioValue,true)}
              approximateValue={!tradingStateReady
                ? (shouldHideBalances ? "≈ ••••••" : "--")
                : formatApproxUSD(typeof accountValueUsd === "number" && Number.isFinite(accountValueUsd)
                  ? accountValueUsd : totalPortfolioValue)}
              accountLabel={hyperliquidAccountModeLabel + " Account"}
              accountModeLabel={hyperliquidAccountModeLabel}
              walletAddress={walletAddress}
              walletDisplay={walletAddress ? formatWalletAddress(walletAddress) : "Not Connected"}
              hideBalances={hideBalances}
              onToggleBalances={trustShieldMode !== "PRIVATE" ? toggleHideBalances : undefined}
              addressCopied={copiedText}
              onCopyAddress={() => handleCopyAddress(walletAddress)}
              extraHeaderAction={(trustShieldMode === "PRIVATE" || trustShieldMode === "ANONYMOUS") &&
                <button type="button"
                  onClick={() => {
                    if(fundsUnlocked) {
                      localStorage.removeItem("privacy_unlocked");
                      sessionStorage.removeItem("funds_unlocked");
                      setFundsUnlocked(false);
                    }
                    setShowFundsUnlockPopup(true);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg sm:rounded-xl cursor-pointer shadow-xs"
                  id="hero-lock-funds-btn">
                  <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3"/>
                  {fundsUnlocked ? "Lock" : "Unlock"}
                </button>}
              accountError={walletConnected ? accountStateError : undefined}
              depositLabel={t("deposit")}
              depositSubtitle={t("add_funds")}
              withdrawLabel={t("withdrawal")}
              withdrawSubtitle={t("send_funds")}
              onDeposit={() => {
                if(isLocked) {setShowFundsUnlockPopup(true);return;}
                setActiveModal("DEPOSIT");
              }}
              onWithdraw={() => {
                if(isLocked) {setShowFundsUnlockPopup(true);return;}
                setActiveModal("WITHDRAW");
              }}
              onTransfer={tradingStateReady && accountModeKnown && !isPooledAccount ? () => {
                if(isLocked) {setShowFundsUnlockPopup(true);return;}
                setActiveModal("TRANSFER");
              } : undefined}
              transferLabel={t("transfer_spot_perps")}
              cards={[
                {label:"Spot Available",value:spotBalancesHydrated ? formatAmount(Math.max(0,spotAvailableUsdc)) : (shouldHideBalances ? "••••••" : "--"),
                  subtitle:<>Total Spot (incl. holds + altcoins): {spotBalancesHydrated ? formatAmount(totalSpotBalance) : (shouldHideBalances ? "••••••" : "--")}</>,
                  icon:<Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>},
                {label:t("perpetual_balance"),value:tradingStateReady && realPerpEquity !== null ? formatAmount(realPerpEquity) : (shouldHideBalances ? "••••••" : "--"),
                  subtitle:<>Perp equity (HL); available: {tradingStateReady ? formatAmount(availablePerpBalance) : (shouldHideBalances ? "••••••" : "--")}</>,
                  icon:<TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>,iconTone:"text-success"},
                {label:t("available_for_trade"),value:tradingStateReady ? formatAmount(availablePerpBalance) : (shouldHideBalances ? "••••••" : "--"),
                  subtitle:"Main Perp available; HIP-3 market limits may differ",
                  icon:<Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>},
                {label:t("in_trade"),value:formatAmount(totalLockedBalance),
                  subtitle:`Pos: ${formatAmount(lockedPositionMargin,false)} | Ord: ${formatAmount(lockedOrderMargin,false)}`,
                  icon:<Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>,iconTone:"text-amber-500"},
              ]}
              note={<>Available = spendable USDC after exchange holds/margin. Total Spot includes held funds and assets;
                Perpetual Equity includes open-position PnL. These amounts are not supposed to be equal.</>}
            />

            <HideDexAssetAllocation
              totalLabel="TOTAL"
              totalValue={shouldHideBalances ? "••••" : formatAmount(allocationTotal,false)}
              chartValues={shouldHideBalances ? [] : pieChartData}
              rows={assetDistributionData.map((row,index)=>({
                label:row.name,color:row.color,amount:formatAmount(row.displayVal),
                percentage:shouldHideBalances ? null : row.pct,
                logo:index===0 ? <HoldingAssetLogo symbol="USDC" compact/> : undefined,
              }))}
            />

            {/* PERFORMANCE CARD */}
            <div className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs" id="performance-section">
              <h2 className="text-brand-text text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">
                Performance Analytics &amp; Fees
              </h2>
              {/* Single compact row: 24H / 7D / 30D / All Time / Market selector. */}
              <div className="flex items-center gap-1 mb-3 w-full min-w-0">
                <div className="flex flex-1 min-w-0 items-center justify-between gap-0.5 bg-brand-overlay-subtle p-0.5 rounded-lg border border-brand-border/40">
                  {(
                    [
                      { id: "day", label: "24H" },
                      { id: "week", label: "7D" },
                      { id: "month", label: "30D" },
                      { id: "allTime", label: "All Time" },
                    ] as const
                  ).map((p) => {
                    const isActive = performancePeriod === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPerformancePeriod(p.id)}
                        className={`min-w-0 px-1 py-1 sm:px-2 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          isActive
                            ? "bg-brand-surface text-brand-text shadow-xs border border-brand-border/60"
                            : "text-brand-muted hover:text-brand-text"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <select
                  aria-label="Market type"
                  value={performanceMarket}
                  onChange={(event) => setPerformanceMarket(event.target.value as "all" | "spot" | "perps")}
                  className="shrink-0 w-[108px] sm:w-[128px] min-w-0 py-1.5 px-1 sm:px-2 rounded-lg border border-brand-border/60 bg-brand-overlay-subtle text-brand-text text-[10px] sm:text-xs font-bold cursor-pointer"
                >
                  <option value="all">Spot + Perps</option>
                  <option value="spot">Spot</option>
                  <option value="perps">Perps</option>
                </select>
              </div>

              {/* One compact performance/fees summary. Existing equity chart untouched. */}
              <AnalyticsPanel
                walletConnected={walletConnected}
                walletAddress={walletAddress}
                fills={userFills}
                loading={userFillsLoading}
                failed={userFillsError}
                pnlTimeseries={pnlTimeseries}
                portfolioPnl={selectedNetPnl}
                period={performancePeriod}
                market={performanceMarket}
                sensitiveHidden={shouldHideBalances}
              />

              {/* Equity History Chart */}
              <div className="mt-3 w-full">
                {shouldHideBalances ? (
                  <div className="h-[180px] sm:h-[220px] w-full rounded-xl bg-brand-overlay-subtle/50 border border-brand-border/40 flex flex-col items-center justify-center text-center p-4">
                    <EyeOff className="w-6 h-6 text-brand-muted mb-2" />
                    <span className="text-xs font-semibold text-brand-muted">
                      Performance hidden
                    </span>
                  </div>
                ) : !pnlTimeseries || equityChartData.length === 0 ? (
                  <div className="h-[180px] sm:h-[220px] w-full rounded-xl bg-brand-overlay-subtle/50 border border-brand-border/40 flex flex-col items-center justify-center text-center p-4">
                    <TrendingUp className="w-6 h-6 text-brand-muted/60 mb-2" />
                    <span className="text-xs font-semibold text-brand-muted">
                      No performance history yet
                    </span>
                  </div>
                ) : (
                  <div className="h-[180px] sm:h-[220px] w-full select-none funds-performance-chart" style={{ WebkitTapHighlightColor: "transparent" }}>
                    <style>{`
                      #performance-section .funds-performance-chart .recharts-wrapper:focus,
                      #performance-section .funds-performance-chart .recharts-surface:focus,
                      #performance-section .funds-performance-chart .recharts-wrapper *:focus {
                        outline: none !important;
                        -webkit-tap-highlight-color: transparent;
                      }
                    `}</style>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        accessibilityLayer={false}
                        data={equityChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(ts: number) => {
                            try {
                              const d = new Date(ts);
                              if (performancePeriod === "day") {
                                return d.toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                });
                              }
                              if (performancePeriod === "week" || performancePeriod === "month") {
                                return d.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                });
                              }
                              return d.toLocaleDateString(undefined, {
                                month: "short",
                                year: "2-digit",
                              });
                            } catch {
                              return "";
                            }
                          }}
                          tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--divider-brand)" }}
                          minTickGap={25}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tickFormatter={(val: number) => {
                            if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
                            if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
                            return `$${val.toFixed(0)}`;
                          }}
                          tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                          tickLine={false}
                          axisLine={false}
                          width={50}
                        />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0]?.payload;
                            if (!data) return null;
                            const d = new Date(data.timestamp);
                            return (
                              <div className="bg-brand-surface/95 border border-brand-border/80 backdrop-blur-md rounded-xl p-2.5 shadow-xl text-xs space-y-1">
                                <div className="text-[10px] text-brand-muted font-mono">
                                  {d.toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-brand-sub text-[11px]">Equity:</span>
                                  <span className="font-mono font-bold text-brand-text text-xs">
                                    ${Number(data.value).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="var(--accent-primary)"
                          strokeWidth={2}
                          fill="var(--accent-primary)"
                          fillOpacity={0.12}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Last Funds section: visual daily executed trading volume, replacing Holdings. */}
            <DailyFillVolumeBars
              fills={userFills}
              period={performancePeriod}
              walletConnected={walletConnected}
              sensitiveHidden={shouldHideBalances}
            />

          </motion.div>
        )}
      </AnimatePresence>

      {/* --- COMPACT PASSWORD UNLOCK MODAL OVERLAY --- */}
      <AnimatePresence>
        {isLocked && showFundsUnlockPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative bg-brand-surface border border-brand-border/80 rounded-2xl max-w-[360px] md:max-w-[460px] w-full p-5 sm:p-7 shadow-2xl flex flex-col space-y-4 font-sans"
              id="funds-lock-screen-modal"
            >
              <button
                onClick={() => setShowFundsUnlockPopup(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-brand-text cursor-pointer p-1 rounded-lg hover:bg-brand-overlay-normal border border-transparent"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mx-auto w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                <Lock className="w-5 h-5" />
              </div>

              <div className="space-y-1 text-center">
                <h3 className="text-base font-bold text-brand-text tracking-tight">
                  Unlock Funds Portal
                </h3>
                <p className="text-[11px] text-brand-muted leading-relaxed">
                  Enter your local display privacy password to reveal balances in this browser.
                </p>
              </div>

              {/* Reset Password form or Verify Password form */}
              {showResetConfirm ? (
                <div className="space-y-3" id="funds-reset-view">
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Reset Password?</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      Resetting deletes the local privacy password and clears browser-cached trade, order and activity data. On-chain history is not affected.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-2 bg-brand-bg hover:bg-brand-overlay-subtle border border-brand-border text-gray-400 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5" id="funds-verify-view">
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 font-mono">
                      Security Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordAttempt ? "text" : "password"}
                        value={passwordAttempt}
                        onChange={(e) => {
                          setPasswordAttempt(e.target.value);
                          setPwError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleUnlock();
                          }
                        }}
                        placeholder="••••••••••••"
                        className="w-full bg-brand-bg border border-brand-border hover:border-brand-text/30 rounded-xl pl-3 pr-10 py-3 text-sm text-brand-text focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all text-left"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordAttempt(!showPasswordAttempt)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-text cursor-pointer"
                      >
                        {showPasswordAttempt ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {pwError && (
                      <p className="text-[9px] font-mono font-bold text-rose-400 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{pwError}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleUnlock();
                    }}
                    className="w-full py-3 bg-accent hover:opacity-90 active:scale-[0.98] text-brand-bg font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Verify & Unlock</span>
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="text-xs font-medium text-brand-muted hover:text-brand-text underline cursor-pointer"
                    >
                      Forgot / Reset Password?
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- RE-DESIGNED ASYNCHRONOUS TRANSACTION DIALOGS --- */}
      <AnimatePresence>
        {activeModal && (() => {
          const isFundsActionModal =
            activeModal === "DEPOSIT" ||
            activeModal === "WITHDRAW";

          if (isFundsActionModal) {
            const isDeposit = activeModal === "DEPOSIT";
            const parsedAmount = parseFloat(amount);
            const estimatedDepositReceive =
              Number.isFinite(parsedAmount) && parsedAmount >= MIN_DEPOSIT_USDC
                ? parsedAmount
                : 0;
            const parsedWithdrawAmount = Number(amount);
            const estimatedWithdrawalReceive =
              Number.isFinite(parsedWithdrawAmount) && parsedWithdrawAmount >= MIN_WITHDRAWAL_USDC
                ? Math.max(0, parsedWithdrawAmount - WITHDRAWAL_FEE_USDC)
                : 0;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
                {/* Backdrop */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0" 
                  onClick={() => setActiveModal(null)} 
                />

                {/* Dialog Panel: Mobile Full Screen + Desktop Centered Modal */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: "spring", duration: 0.25 }}
                  className="relative bg-brand-surface border-0 sm:border border-brand-border rounded-none sm:rounded-[24px] w-screen sm:w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-[32rem] shadow-2xl flex flex-col overflow-hidden pt-safe pb-safe"
                >
                  {/* Header */}
                  <div className="p-4 sm:p-6 pb-2 sm:pb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shadow-xs">
                        {isDeposit ? (
                          <Coins className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={() => setActiveModal(null)}
                        className="w-9 h-9 rounded-full bg-brand-overlay-subtle hover:bg-brand-overlay-normal text-brand-muted hover:text-brand-text flex items-center justify-center transition-colors cursor-pointer"
                        id="modal-close-btn"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-brand-text tracking-tight mt-3">
                      {isDeposit ? "Deposit Collateral" : "Withdraw Assets"}
                    </h3>
                    <p className="text-xs sm:text-sm text-brand-sub mt-1">
                      {isDeposit
                        ? "Add funds to your HideDex trading account."
                        : "Withdraw your assets to your connected wallet."}
                    </p>
                  </div>

                  {/* Scrollable Content Container */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] space-y-4">
                    {/* Disconnected Notice if applicable */}
                    {(!walletConnected || !walletAddress) && (
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs p-3 rounded-xl flex items-center gap-2 font-mono">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Wallet not connected. Connect your wallet to proceed.</span>
                      </div>
                    )}

                    {/* Error Message */}
                    {txErrorMessage && (
                      <div className="bg-brand-loss/10 border border-brand-loss/30 text-brand-loss text-xs p-3 rounded-xl flex items-center gap-2 font-mono">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="leading-tight">{txErrorMessage}</span>
                      </div>
                    )}

                    {isDeposit ? (
                      /* DEPOSIT FORM */
                      <form onSubmit={handleDepositSubmit} className="space-y-4" id="hl-deposit-form">
                        {/* 1. Network */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-brand-sub uppercase tracking-wider block">
                            Network
                          </label>
                          <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent">
                                <Network className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-sm text-brand-text">Arbitrum One</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-brand-sub">
                              <span className="text-[11px] font-mono">Chain ID: <strong className="text-brand-text">42161</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Asset Token */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-brand-sub uppercase tracking-wider block">
                            Asset Token
                          </label>
                          <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono text-xs">
                                $
                              </div>
                              <div>
                                <span className="font-bold text-sm text-brand-text">USDC</span>
                                <span className="text-xs text-brand-muted font-normal ml-1.5 hidden sm:inline">USD Coin</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. Amount */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px] font-semibold text-brand-sub">
                            <label className="uppercase tracking-wider">Amount</label>
                            <span className="font-mono">
                              Wallet Balance: <strong className="text-brand-text">{walletConnected ? displayWalletUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} USDC</strong>
                            </span>
                          </div>
                          <div className="rounded-xl border border-brand-border bg-brand-bg px-3.5 py-2.5 flex items-center justify-between focus-within:border-accent transition-colors">
                            <input
                              type="number"
                              step="any"
                              value={amount}
                              onChange={(e) => {
                                setAmount(e.target.value);
                                setTxErrorMessage("");
                              }}
                              placeholder="Min 6 USDC"
                              className="w-full bg-transparent text-xl sm:text-2xl font-bold font-mono text-brand-text placeholder:text-brand-muted/40 focus:outline-none"
                              autoFocus
                              required
                            />
                            <span className="text-sm font-bold font-mono text-brand-sub pl-2 shrink-0 select-none">
                              USDC
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted">
                            Minimum deposit is {MIN_DEPOSIT_USDC} USDC.
                          </p>
                        </div>

                        {/* 4. Presets */}
                        <div className="grid grid-cols-4 gap-2">
                          {[25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setAmount(((displayWalletUsdc * pct) / 100).toFixed(2));
                                setTxErrorMessage("");
                              }}
                              className="py-2 rounded-lg text-xs font-bold font-mono border border-brand-border bg-brand-overlay-subtle hover:bg-brand-overlay-normal text-brand-text transition-colors cursor-pointer text-center"
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>

                        {/* 5. Deposit Fee Card */}
                        <div className="rounded-xl border border-brand-border/60 bg-brand-overlay-subtle p-3 space-y-2 font-mono text-xs">
                          <div className="flex items-center justify-between text-brand-sub">
                            <div className="flex items-center gap-1.5">
                              <Coins className="w-3.5 h-3.5 text-brand-muted" />
                              <span>Deposit Fee</span>
                              <Info className="w-3 h-3 text-brand-muted/70" />
                            </div>
                            <span className="text-brand-text font-bold">0.00 USDC</span>
                          </div>
                          <div className="flex items-center justify-between text-brand-text border-t border-brand-border/40 pt-2">
                            <div className="flex items-center gap-1.5">
                              <ArrowDownRight className="w-3.5 h-3.5 text-accent" />
                              <span>Est. Receive</span>
                              <Info className="w-3 h-3 text-brand-muted/70" />
                            </div>
                            <span className="text-accent font-bold text-sm">
                              {estimatedDepositReceive.toFixed(2)} USDC
                            </span>
                          </div>
                        </div>

                        {/* 6. Primary CTA */}
                        <button
                          type="submit"
                          disabled={Boolean(
                            isDepositing ||
                            !amount ||
                            !Number.isFinite(parseFloat(amount)) ||
                            parseFloat(amount) < MIN_DEPOSIT_USDC
                          )}
                          className="w-full py-3.5 px-4 rounded-xl bg-accent hover:opacity-90 active:scale-[0.99] text-brand-bg font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                        >
                          {isDepositing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-4 h-4" />
                              <span>Deposit Collateral</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    ) : (
                      /* WITHDRAW FORM */
                      <form onSubmit={handleWithdrawalSubmit} className="space-y-4" id="hl-withdrawal-form">
                        {/* 1. Network */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-brand-sub uppercase tracking-wider block">
                            Network
                          </label>
                          <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent">
                                <Network className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-sm text-brand-text">Arbitrum One</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-brand-sub">
                              <span className="text-[11px] font-mono">Chain ID: <strong className="text-brand-text">42161</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Asset Token */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-brand-sub uppercase tracking-wider block">
                            Asset Token
                          </label>
                          <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono text-xs">
                                $
                              </div>
                              <div>
                                <span className="font-bold text-sm text-brand-text">USDC</span>
                                <span className="text-xs text-brand-muted font-normal ml-1.5 hidden sm:inline">USD Coin</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. Destination Wallet */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px] font-semibold text-brand-sub">
                            <label className="uppercase tracking-wider">Destination Wallet</label>
                            <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[10px]">
                              Connected
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            </span>
                          </div>
                          <div className="rounded-xl border border-brand-border bg-brand-overlay-subtle p-3 flex items-center justify-between select-none">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-brand-overlay-normal border border-brand-border/60 flex items-center justify-center text-accent shrink-0">
                                <Wallet className="w-4 h-4" />
                              </div>
                              <span className="font-mono text-sm font-bold text-brand-text truncate">
                                {walletAddress || "No wallet connected"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 4. Amount */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px] font-semibold text-brand-sub">
                            <label className="uppercase tracking-wider">Amount</label>
                            <span className="font-mono">
                              Available Balance: <strong className="text-brand-text">{tradingStateReady ? formatAmount(withdrawableUsd) : "--"}</strong>
                            </span>
                          </div>
                          <div className="rounded-xl border border-brand-border bg-brand-bg px-3.5 py-2.5 flex items-center justify-between focus-within:border-accent transition-colors">
                            <input
                              type="number"
                              step="any"
                              value={amount}
                              onChange={(e) => {
                                setAmount(e.target.value);
                                setTxErrorMessage("");
                              }}
                              placeholder="Min 6 USDC"
                              className="w-full bg-transparent text-xl sm:text-2xl font-bold font-mono text-brand-text placeholder:text-brand-muted/40 focus:outline-none"
                              required
                            />
                            <span className="text-sm font-bold font-mono text-brand-sub pl-2 shrink-0 select-none">
                              USDC
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted">
                            Minimum withdrawal is {MIN_WITHDRAWAL_USDC} USDC.
                          </p>
                        </div>

                        {/* 5. Presets */}
                        <div className="grid grid-cols-4 gap-2">
                          {[25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                if (!tradingStateReady) return;
                                if (pct === 100) {
                                  setAmount(String(Math.floor(withdrawableUsd * 100) / 100));
                                } else {
                                  setAmount(((withdrawableUsd * pct) / 100).toFixed(2));
                                }
                                setTxErrorMessage("");
                              }}
                              className="py-2 rounded-lg text-xs font-bold font-mono border border-brand-border bg-brand-overlay-subtle hover:bg-brand-overlay-normal text-brand-text transition-colors cursor-pointer text-center"
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>

                        {/* 6. Network Fee & Est Receive */}
                        <div className="rounded-xl border border-brand-border/60 bg-brand-overlay-subtle p-3 space-y-2 font-mono text-xs">
                          <div className="flex items-center justify-between text-brand-sub">
                            <div className="flex items-center gap-1.5">
                              <Coins className="w-3.5 h-3.5 text-brand-muted" />
                              <span>Network Fee</span>
                              <Info className="w-3 h-3 text-brand-muted/70" />
                            </div>
                            <span className="text-brand-text font-bold">{WITHDRAWAL_FEE_USDC.toFixed(2)} USDC</span>
                          </div>
                          <div className="flex items-center justify-between text-brand-text border-t border-brand-border/40 pt-2">
                            <div className="flex items-center gap-1.5">
                              <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
                              <span>Est. Receive</span>
                              <Info className="w-3 h-3 text-brand-muted/70" />
                            </div>
                            <span className="text-accent font-bold text-sm">
                              {estimatedWithdrawalReceive.toFixed(2)} USDC
                            </span>
                          </div>
                        </div>

                        {/* 7. Primary CTA */}
                        <button
                          type="submit"
                          disabled={Boolean(
                            isWithdrawing ||
                            !tradingStateReady ||
                            !amount ||
                            !Number.isFinite(Number(amount)) ||
                            Number(amount) < MIN_WITHDRAWAL_USDC ||
                            Number(amount) > withdrawableUsd + 0.01
                          )}
                          className="w-full py-3.5 px-4 rounded-xl bg-accent hover:opacity-90 active:scale-[0.99] text-brand-bg font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                        >
                          {isWithdrawing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-4 h-4" />
                              <span>Withdraw Assets</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          }

          /* TRANSFER MODAL (Unchanged) */
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0" 
                onClick={() => setActiveModal(null)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ type: "spring", duration: 0.25 }}
                className="relative bg-brand-surface border border-brand-border rounded-2xl max-w-[390px] sm:max-w-[520px] md:max-w-[620px] lg:max-w-[700px] w-full p-4 sm:p-7 shadow-2xl flex flex-col max-h-[88vh] md:max-h-[92vh] overflow-hidden"
              >
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-3.5 right-3.5 p-1 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-overlay-normal cursor-pointer z-10"
                  id="modal-close-btn"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="overflow-y-auto pr-0.5 space-y-3.5 scrollbar-thin flex-1 max-h-full">
                  {/* --- COMPACT TRANSFER SCREEN --- */}
                  <form onSubmit={handleTransferSubmit} className="space-y-3.5" id="hl-transfer-form">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-brand-primary font-bold uppercase tracking-widest block font-mono">
                        Instant Internal Clearing House Transfer
                      </span>
                      <h3 className="text-base font-black text-brand-text tracking-tight">
                        Transfer Assets
                      </h3>
                    </div>

                    {txErrorMessage && (
                      <div className="bg-brand-loss/10 border border-brand-loss/30 text-brand-loss text-[10px] p-2 rounded-lg flex gap-1.5 items-center font-mono">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="leading-tight">{txErrorMessage}</span>
                      </div>
                    )}

                    {/* Transfer direction toggle */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">
                        Transfer Direction
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-brand-bg p-0.5 rounded-lg border border-brand-border">
                        <button
                          type="button"
                          onClick={() => {
                            setTransferDirection("spot_to_perp");
                            setAmount("");
                            setTxErrorMessage("");
                          }}
                          className={`py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${transferDirection === "spot_to_perp" ? "bg-brand-overlay-normal text-brand-primary" : "text-brand-muted hover:text-brand-text"}`}
                        >
                          Spot → Perpetual
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferDirection("perp_to_spot");
                            setAmount("");
                            setTxErrorMessage("");
                          }}
                          className={`py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${transferDirection === "perp_to_spot" ? "bg-brand-overlay-normal text-brand-primary" : "text-brand-muted hover:text-brand-text"}`}
                        >
                          Perpetual → Spot
                        </button>
                      </div>
                    </div>

                    {/* SOURCE/DESTINATION INFO */}
                    <div className="bg-brand-bg/40 border border-brand-border/40 p-2.5 rounded-lg flex items-center justify-between text-[10px] font-mono">
                      <div>
                        <span className="text-[8px] text-brand-muted block uppercase font-bold leading-none mb-1">Source Available</span>
                        <span className="text-brand-text font-bold">
                          {transferDirection === "spot_to_perp"
                            ? (spotBalancesHydrated ? `${formatAmount(spotAvailableUsdc)} USDC` : "--")
                            : (tradingStateReady ? `${formatAmount(mainPerpTransferAvailableUsd)} USDC` : "--")}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                      <div className="text-right">
                        <span className="text-[8px] text-brand-muted block uppercase font-bold leading-none mb-1">Dest Balance</span>
                        <span className="text-brand-text font-bold">
                          {transferDirection === "spot_to_perp" ? formatAmount(perpCashBalance) : formatAmount(spotUSDC)} USDC
                        </span>
                      </div>
                    </div>

                    {/* AMOUNT INPUT */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">
                        Transfer Amount (USDC)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setTxErrorMessage("");
                          }}
                          placeholder="0.00"
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-brand-text focus:outline-none focus:border-brand-primary pr-12"
                          autoFocus
                          required
                        />
                        <span className="absolute right-2.5 top-1.5 text-[10px] font-mono font-bold text-brand-muted">USDC</span>
                      </div>
                    </div>

                    {/* PRESET PERCENTAGES */}
                    <div className="flex gap-1">
                      {[25, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            const isHydrated = transferDirection === "spot_to_perp" ? spotBalancesHydrated : tradingStateReady;
                            if (!isHydrated) return;
                            const sourceMax = transferDirection === "spot_to_perp" ? spotAvailableUsdc : mainPerpTransferAvailableUsd;
                            if (pct === 100) {
                              setAmount(Math.max(0, sourceMax - 0.01).toFixed(2));
                            } else {
                              setAmount(((sourceMax * pct) / 100).toFixed(2));
                            }
                            setTxErrorMessage("");
                          }}
                          className="flex-1 py-1 rounded-md text-[9px] font-mono font-bold bg-brand-bg hover:bg-brand-overlay-normal border border-brand-border/60 text-brand-text transition-colors cursor-pointer text-center"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        isTransferring ||
                        !(transferDirection === "spot_to_perp" ? spotBalancesHydrated : tradingStateReady) ||
                        !amount ||
                        Number(amount) < 1 ||
                        Number(amount) > (transferDirection === "spot_to_perp" ? spotAvailableUsdc : mainPerpTransferAvailableUsd) + 1e-9
                      }
                      className="w-full py-2.5 bg-brand-overlay-active hover:bg-brand-overlay-active border border-brand-primary/50 hover:border-brand-primary text-brand-primary font-black text-xs uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-98 cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTransferring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isTransferring ? "Transferring..." : "Transfer Instantly"}</span>
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>



    </div>
  );
}
