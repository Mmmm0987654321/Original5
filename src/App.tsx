/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ActiveTab, 
  TokenMetadata, 
  Position, 
  OpenOrder, 
  TradeHistoryItem, 
  NotificationItem, 
  LeaderboardTrader,
  UserProfile,
  UserSettings,
} from "./types";

// Import custom components
import Navbar from "./components/layout/Navbar";
import BrowserAlertsControl from "./components/common/BrowserAlertsControl";
import { notifyBackgroundAccountEvent } from "./lib/browserNotifications";
import LeftSidebar from "./components/layout/LeftSidebar";
import GeneralDashboard from "./components/dashboard/GeneralDashboard";
import BuilderFeePopup from "./components/trading/BuilderFeePopup";
import TVChart from "./components/trading/TVChart";
import OrderBook from "./components/trading/OrderBook";
import RedesignedTerminal from "./components/trading/RedesignedTerminal";
import LighterMarketPreview from "./components/trading/LighterMarketPreview";
import AsterVenueAdapter from "./components/trading/AsterVenueAdapter";
import RecentTrades from "./components/trading/RecentTrades";
import PositionTable from "./components/trading/PositionTable";
import PortfolioPanel from "./components/dashboard/PortfolioPanel";
import MarketsPanel from "./components/dashboard/MarketsPanel";
import SupportPanel from "./components/dashboard/SupportPanel";
import LegalPanel from "./components/dashboard/LegalPanel";
import LandingPage from "./components/dashboard/LandingPage";
import HideDexPointsHub from "./components/dashboard/HideDexPointsHub";
import HideDexReferralPage from "./components/dashboard/HideDexReferralPage";
import {
  HIDEDEX_INVITE_CODE,hidedexReferralOverview,hidedexReferralCall,
  hidedexReferralExpire,hidedexReferralSession
} from "./lib/hidedexReferralClient";
import AccountSettingsPanel from "./components/dashboard/AccountSettingsPanel";
import { applyPreferencesToDOM } from "./components/trading/TradingPreferencesModal";
import { WalletConnectModal } from "./components/common/WalletConnectModal";

// Import beautiful premium icons
import { useTrustShield } from "./lib/TrustShieldManager";
import { TrustShieldPopup } from "./components/common/TrustShieldPopup";
import { 
  getCryptoAssetsFromHyperliquid,
  getRwaAssetsFromHyperliquid,
  getUserFills,
  getSpotClearinghouseState,
  getSpotSymbolMap,
  getUserDepositWithdrawalHistory,
  getOpenOrders,
  getUserFunding,
  getHistoricalPnlTimeseries,
  estimateRestingOrdersInitMarginUsd,
  type PnlTimeseries,
  type Eip1193Provider,
  clearTradingSetupState,
  getHyperliquidTradingState,
  isBuilderFeeApproved,
  isPooledAccountMode,
  isTradingSetupComplete,
  markTradingSetupComplete,
  ensureAgentKey,
  cancelOpenOrder,
  modifyOpenOrder,
  marketClosePosition,
  marketCloseSpotPosition,
  isRateLimitError,
  withdrawFromHyperliquid,
  transferUsdBetweenSpotAndPerp,
  placeReduceOnlyTpslTrigger,
  computeSpotUsdcOnlyUsd,
} from "./lib/hyperliquid";
import { useHyperliquidSpotStateStream } from "./hooks/useHyperliquidSpotStateStream";
import {
  arbitrum,
  mainnet,
  bsc,
} from "@reown/appkit/networks";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitNetwork,
  useAppKitState,
  useDisconnect,
} from "@reown/appkit/react";
import { useActiveEthereumWallet } from "./hooks/useActiveEthereumWallet";
import { getAddress } from "viem";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatUnits,
  parseUnits,
} from "ethers";
import { hip3DisplaySymbol } from "./lib/hip3Dexes";
import { useLiveAssetCtxs } from "./providers/WebSocketProvider";
import { 
  TrendingUp, 
  ArrowRight, 
  ShieldCheck, 
  Coins, 
  Layers, 
  Activity, 
  Users, 
  Sparkles, 
  Settings, 
  X, 
  AlertCircle,
  ExternalLink,
  HelpCircle,
  Terminal,
  ChevronRight,
  Zap,
  DollarSign,
  Wallet,
  User,
  Percent,
  Compass,
  Briefcase,
  UserPlus,
  Cpu,
  LogOut
} from "lucide-react";

interface ConnectionRequiredProps {
  tabName: string;
  onConnect: () => void;
}

function ConnectionRequired({ tabName, onConnect }: ConnectionRequiredProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto" id="connection-required-guard">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
        <Wallet className="w-6 h-6 text-indigo-400" />
      </div>
      <h2 className="text-base font-black text-brand-text uppercase tracking-wider mb-2">Wallet Connection Required</h2>
      <p className="text-xs text-gray-500 leading-relaxed mb-6">
        The <strong>{tabName}</strong> section requires a connected Web3 wallet. Connect your wallet to proceed.
      </p>
      <button
        onClick={onConnect}
        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-brand-text font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md cursor-pointer active:scale-98 transition-all"
      >
        Connect Secure Wallet
      </button>
    </div>
  );
}

function PrivateModeBlockedMessage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-brand-surface/40 border border-brand-border/60 rounded-2xl max-w-md mx-auto text-center my-12 space-y-3">
      <div className="p-3 bg-accent/10 border border-accent/20 rounded-full text-accent">
        <ShieldCheck className="w-8 h-8 animate-pulse" />
      </div>
      <h3 className="font-display font-black text-brand-text text-sm uppercase tracking-wider">
        This section is hidden in Private Mode
      </h3>
      <p className="text-[10px] text-gray-400 leading-normal font-sans">
        To access this feature, please switch back to Standard Mode under the Trust Shield settings.
      </p>
    </div>
  );
}

const ARBITRUM_NATIVE_USDC =
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const HYPERLIQUID_BRIDGE2 =
  "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7";

const ARBITRUM_CHAIN_ID = 42161;

const USDC_DECIMALS = 6;

const DEPOSIT_ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const SUPABASE_URL = "https://nqlzjregtvjspescfqcn.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const HIDEDEX_EARLY_ACCESS_API = `${SUPABASE_URL}/functions/v1/hidedex-early-access`;
// On a refresh of an active workspace, restore PUBLIC navigation immediately.
// Never use this UI preference as wallet authentication or Early Access approval.
function isWorkspaceReload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "reload" && (
      sessionStorage.getItem("hidedex_workspace_opened") === "1" ||
      !!sessionStorage.getItem("hidedex_active_trading_wallet") ||
      !!sessionStorage.getItem("hidedex_last_public_trading_tab")
    );
  } catch { return false; }
}
function safeReloadWorkspaceTab(): ActiveTab {
  try {
    const tab = sessionStorage.getItem("hidedex_last_public_trading_tab");
    if (tab && Object.values(ActiveTab).includes(tab as ActiveTab) &&
        tab !== ActiveTab.Landing && tab !== ActiveTab.Perp &&
        tab !== ActiveTab.Points && tab !== ActiveTab.Analytics) return tab as ActiveTab;
  } catch { /* ignored optional UI preference */ }
  return ActiveTab.Markets;
}


function loadOwnerFavoritesWithMigration(owner: string): string[] {
  if (typeof window === "undefined") {
    return ["BTC", "ETH", "SOL", "HYPE"];
  }

  const ownerKey = `favorites:${owner}`;
  try {
    const raw = localStorage.getItem(ownerKey);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((s) => String(s || "").trim().toUpperCase())
          .filter((s) => s.length > 0);
        const unique = Array.from(new Set(normalized));
        return unique.length > 0 ? unique : ["BTC", "ETH", "SOL", "HYPE"];
      }
    }
  } catch {
    /* ignore read errors */
  }

  // Legacy migration: try reading hl_market_favorites if owner-specific key does NOT exist
  try {
    const legacyRaw = localStorage.getItem("hl_market_favorites");
    if (legacyRaw !== null) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy)) {
        const normalizedLegacy = parsedLegacy
          .map((s) => String(s || "").trim().toUpperCase())
          .filter((s) => s.length > 0);
        const uniqueLegacy = Array.from(new Set(normalizedLegacy));
        if (uniqueLegacy.length > 0) {
          try {
            localStorage.setItem(ownerKey, JSON.stringify(uniqueLegacy));
          } catch {
            /* ignore write errors */
          }
          return uniqueLegacy;
        }
      }
    }
  } catch {
    /* ignore legacy read errors */
  }

  // Default fallback
  const defaultList = ["BTC", "ETH", "SOL", "HYPE"];
  try {
    localStorage.setItem(ownerKey, JSON.stringify(defaultList));
  } catch {
    /* ignore write errors */
  }
  return defaultList;
}

export default function App() {
  // Global States
  const { mode, popupSeen } = useTrustShield();
  const {
    data: cryptoData,
    isLoading: cryptoLoading,
    isFetched: cryptoFetched,
    isFetching: cryptoFetching,
    isError: cryptoError,
    error: cryptoErrorMsg,
    refetch: refetchCrypto,
    isRefetching: isRefetchingCrypto,
  } = useQuery({
    queryKey: ['crypto-assets'],
    queryFn: getCryptoAssetsFromHyperliquid,
    retry: 3,
    retryDelay: (attempt) =>
      Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    refetchInterval: 30_000,
  });

  const {
    data: rwaData,
  } = useQuery({
    queryKey: ['assets'],
    queryFn: getRwaAssetsFromHyperliquid,
    refetchInterval: 30_000,
  });
  const [showTrustShieldPopup, setShowTrustShieldPopup] = useState(false);
  const orderSubmissionInFlightRef =
    useRef(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletType, setWalletType] = useState<"MetaMask" | "Rabby" | "Coinbase" | "WalletConnect" | "Injected" | "ReadOnly" | "Phantom" | null>(null);

  // Official Reown Hooks
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { address: appKitAddress, isConnected: appKitConnected, status: appKitStatus } = useAppKitAccount({
    namespace: "eip155",
  });
  const { open: appKitModalOpen } = useAppKitState();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");
  const { chainId: appKitChainId, switchNetwork } = useAppKitNetwork();

  // Unified Active Ethereum Wallet Hook
  const activeWallet = useActiveEthereumWallet();

  const [walletConnectPending, setWalletConnectPending] = useState(false);
  const connectInFlightRef = useRef(false);
  const pendingUserConnectRef = useRef(false);
  const appKitModalSeenRef = useRef(false);
  const [isAwaitingSignature, setIsAwaitingSignature] = useState(false);

  // Synchronize chainId from the REAL useAppKitNetwork().chainId when it is a valid numeric EVM chain
  useEffect(() => {
    if (appKitChainId && typeof appKitChainId === 'number' && Number.isFinite(appKitChainId)) {
      setChainId(appKitChainId);
    } else if (appKitChainId && typeof appKitChainId === 'string') {
      const parsed = parseInt(appKitChainId, 10);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        setChainId(parsed);
      }
    }
  }, [appKitChainId]);

  // Detect Reown modal cancellation
  useEffect(() => {
    if (appKitModalOpen) {
      if (pendingUserConnectRef.current) {
        appKitModalSeenRef.current = true;
      }
    } else {
      if (
        pendingUserConnectRef.current &&
        appKitModalSeenRef.current &&
        !appKitConnected &&
        appKitStatus === "disconnected" &&
        !connectInFlightRef.current
      ) {
        pendingUserConnectRef.current = false;
        setWalletConnectPending(false);
        setWalletModalError("Wallet connection cancelled");
        appKitModalSeenRef.current = false;
      }
    }
  }, [appKitModalOpen, appKitConnected, appKitStatus]);

  // TEMPORARY REOWN-ONLY WALLET CONNECTION & SESSION RESTORATION FLOW
  // Connects and restores external wallet only after verifying real walletProvider accounts match appKitAddress.
  useEffect(() => {
    if (!appKitConnected || !appKitAddress || !walletProvider) {
      if (walletConnected && !pendingUserConnectRef.current && !connectInFlightRef.current) {
        setWalletConnected(false);
        setWalletAddress("");
        setWalletType(null);
      }
      return;
    }

    let isSubscribed = true;

    const verifyAndConnect = async () => {
      // If already connected with the same verified address and not awaiting user connect, skip
      if (
        walletConnected &&
        walletAddress.toLowerCase() === appKitAddress.toLowerCase() &&
        !pendingUserConnectRef.current
      ) {
        return;
      }

      if (connectInFlightRef.current) return;
      connectInFlightRef.current = true;
      setWalletModalError(null);

      try {
        const normalizedAppKit = getAddress(appKitAddress);

        const accounts = (await walletProvider.request({
          method: "eth_accounts",
        })) as string[] | undefined;

        const firstAccount = accounts && accounts.length > 0 ? accounts[0] : null;
        if (!firstAccount) {
          throw new Error("No accounts returned from wallet provider.");
        }

        const normalizedFirst = getAddress(firstAccount);
        if (normalizedFirst.toLowerCase() !== normalizedAppKit.toLowerCase()) {
          throw new Error("Connected wallet account changed. Please reconnect your wallet and try again.");
        }

        if (!isSubscribed) return;

        setWalletConnected(true);
        setWalletAddress(normalizedAppKit);
        setWalletType("WalletConnect");
        setWalletModalError(null);
        setShowWalletModal(false);

        if (pendingUserConnectRef.current) {
          pendingUserConnectRef.current = false;
          setWalletConnectPending(false);
          appKitModalSeenRef.current = false;
          // Connecting a wallet on Early Access must never open Trust Shield.
          // The user's first approved Start Trading entry handles this prompt.
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error("[Reown] Direct external wallet verification error:", err);
        const errorMsg =
          err?.message ||
          err?.shortMessage ||
          (typeof err === "string" ? err : "Wallet verification failed");

        if (pendingUserConnectRef.current) {
          await disconnect({
            namespace: "eip155",
          }).catch(() => {});

          setWalletConnected(false);
          setWalletAddress("");
          setWalletType(null);
          setWalletModalError(errorMsg);
          pendingUserConnectRef.current = false;
          setWalletConnectPending(false);
          appKitModalSeenRef.current = false;
          setShowWalletModal(true);
        } else {
          // Stale session with invalid/mismatched account
          await disconnect({
            namespace: "eip155",
          }).catch(() => {});
          setWalletConnected(false);
          setWalletAddress("");
          setWalletType(null);
        }
      } finally {
        if (isSubscribed) {
          connectInFlightRef.current = false;
          setIsAwaitingSignature(false);
        }
      }
    };

    verifyAndConnect();

    return () => {
      isSubscribed = false;
    };
  }, [
    appKitConnected,
    appKitAddress,
    walletProvider,
    walletConnected,
    walletAddress,
    popupSeen,
    disconnect,
  ]);

  // One verified, in-memory session per connected wallet. Never trust
  // localStorage, query strings or a public status GET to unlock the app.
  const [requestedTab, setActiveTab] = useState<ActiveTab>(
    () => isWorkspaceReload() ? safeReloadWorkspaceTab() : ActiveTab.Landing
  );
  const [selectedExchange, setSelectedExchange] = useState<"hyperliquid" | "lighter" | "aster">(() => {
    try { const s=sessionStorage.getItem("hidedex_exchange"); return s==="lighter"||s==="aster"?s:"hyperliquid"; }
    catch { return "hyperliquid"; }
  });
  useEffect(() => {
    try { sessionStorage.setItem("hidedex_exchange", selectedExchange); } catch { /* Private browsing */ }
  }, [selectedExchange]);
  const [launchVerifiedWallet, setLaunchVerifiedWallet] = useState<string | null>(null);
  // Public terminal access is UI navigation, never Early Access approval.
  const [publicWorkspaceOpened, setPublicWorkspaceOpened] = useState(isWorkspaceReload);
  // One non-authorizing overview lookup is shared between wallet connection and
  // the Referral page. No wallet signature, token approval or modal is opened.
  // Wallet connection alone never creates permanent signed referral attribution.
  useEffect(() => {
    if(!walletConnected)return;
    const wallet=walletAddress.trim().toLowerCase();
    if(!/^0x[a-f0-9]{40}$/.test(wallet))return;
    void hidedexReferralOverview(wallet).catch(()=>{ /* Referral UI handles outages. */ });
    // A previously signed wallet-scoped session allows genuinely automatic
    // referral attribution. Without proof the code remains pending until signup
    // or a user-initiated signed Apply; don't attribute by wallet string alone.
    const token=hidedexReferralSession(wallet);
    let code="";
    try{code=(sessionStorage.getItem("hidedex_pending_invite_code")||"").trim().toUpperCase();}catch{}
    if(!token||!HIDEDEX_INVITE_CODE.test(code))return;
    let cancelled=false;
    void hidedexReferralCall({action:"apply",wallet,token,referral_code:code}).then(()=>{
      if(cancelled)return;
      try{sessionStorage.removeItem("hidedex_pending_invite_code");}catch{}
      hidedexReferralExpire(wallet);
    }).catch(()=>{ /* Keep the code for explicit Apply if another code exists. */ });
    return ()=>{cancelled=true;};
  },[walletConnected,walletAddress]);

  const [pointsNotice, setPointsNotice] = useState("");
  // A referral URL does not automatically credit anyone. It only remembers the
  // invited code until the registered wallet explicitly verifies and applies it.
  useEffect(() => {
    try {
      const code=(new URLSearchParams(window.location.search).get("ref")||"").trim().toUpperCase();
      if (HIDEDEX_INVITE_CODE.test(code)) sessionStorage.setItem("hidedex_pending_invite_code",code);
    } catch { /* Browsers without session storage can still type a code. */ }
  }, []);
  const [pointsChecking, setPointsChecking] = useState(false);
  useEffect(() => {
    if (!pointsNotice) return;
    const timer = window.setTimeout(() => setPointsNotice(""), 5500);
    return () => window.clearTimeout(timer);
  }, [pointsNotice]);
  const [showPerpAccessSheet, setShowPerpAccessSheet] = useState(false);
  const [earlyAccessRequestedFromPerp, setEarlyAccessRequestedFromPerp] = useState(false);
  // Local storage remembers previously opened UX, never access authorization.
  const [lastTradingWallet, setLastTradingWallet] = useState<string>(() => {
    try { return localStorage.getItem("hidedex_last_trading_wallet")?.toLowerCase() ?? ""; }
    catch { return ""; }
  });
  // Only a refresh of an already-open trading tab may resume the workspace.
  // A fresh visit, even with a remembered wallet, must show Landing immediately.
  // This is a UI hint only: the backend must still re-approve the connected wallet.
  const [refreshTradingWallet, setRefreshTradingWallet] = useState<string>(() => {
    try {
      const nav = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav?.type === "reload"
        ? sessionStorage.getItem("hidedex_active_trading_wallet")?.toLowerCase() ?? ""
        : "";
    } catch { return ""; }
  });
  // Reown reconnects asynchronously only for a genuine trading-tab refresh.
  const [restoreGraceElapsed, setRestoreGraceElapsed] = useState(false);
  useEffect(() => {
    if (!refreshTradingWallet || refreshTradingWallet !== lastTradingWallet) {
      setRestoreGraceElapsed(true);
      return;
    }
    setRestoreGraceElapsed(false);
    // Prevent an indefinitely stalled restored wallet from blanking the landing page.
    const timer = window.setTimeout(() => setRestoreGraceElapsed(true), 5000);
    return () => window.clearTimeout(timer);
  }, [lastTradingWallet, refreshTradingWallet]);
  const hasTradingAccess = publicWorkspaceOpened || (
    walletConnected && !!walletAddress &&
    launchVerifiedWallet === walletAddress.trim().toLowerCase()
  );
  // Every tab/route renderer uses the effective tab, so a URL or child
  // Exchange selection persists across Market, Trade, Funds and Account tabs.
  // A tab change must never silently switch trading venues.

  // Public Spot/market pages are accessible without wallet; signing still requires
  // a real wallet, and Perp entry uses separate server-granted approval.
  const activeTab: ActiveTab = hasTradingAccess ? requestedTab : ActiveTab.Landing;
  const isPublicLanding = activeTab === ActiveTab.Landing;
  const mainContentRef = useRef<HTMLElement>(null);

  // Reset the shared scroll viewport when opening a different screen.
  // Mobile browsers may also scroll the document instead of the main panel.
  useLayoutEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [activeTab]);


  // Homepage never waits for access verification. Only an existing trading-tab
  // refresh performs the background access lookup; Launch App checks separately.
  // The result lives only in React memory; browser storage is not a grant.
  const [connectedAccess, setConnectedAccess] = useState<{
    wallet: string; status: "none" | "pending" | "granted"; checkedAt: number;
  } | null>(null);
  const [accessLookupState, setAccessLookupState] =
    useState<"idle" | "checking" | "ready" | "error">("idle");
  // Spot is public; Perpetual entries are approved only by an authenticated
  // connected wallet plus the current server-reported Early Access status.
  const hasPerpApproval = hasTradingAccess && walletConnected &&
    connectedAccess?.wallet === walletAddress.trim().toLowerCase() &&
    connectedAccess.status === "granted";
  useEffect(() => {
    setShowPerpAccessSheet(activeTab === ActiveTab.Perp && !hasPerpApproval);
  }, [activeTab, hasPerpApproval, selectedExchange]);
  useEffect(() => {
    const wallet = walletAddress.trim().toLowerCase();
    if ((!publicWorkspaceOpened && (!refreshTradingWallet || wallet !== refreshTradingWallet)) ||
        !walletConnected || !/^0x[0-9a-f]{40}$/.test(wallet)) {
      setConnectedAccess(null);
      setAccessLookupState("idle");
      return;
    }
    let cancelled = false;
    setConnectedAccess(null);
    setAccessLookupState("checking");
    void (async () => {
      try {
        const response = await fetch(HIDEDEX_EARLY_ACCESS_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "access", wallet }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.wallet !== wallet ||
            !["none", "pending", "granted"].includes(data.access_status)) {
          if (!cancelled) setAccessLookupState("error");
          return;
        }
        if (!cancelled) {
          setConnectedAccess({wallet, status: data.access_status, checkedAt: Date.now()});
          setAccessLookupState("ready");
        }
      } catch {
        if (!cancelled) setAccessLookupState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [walletConnected, walletAddress, refreshTradingWallet, publicWorkspaceOpened]);

  // Restore a previously opened wallet workspace after a current server check.
  // Unapproved wallets may resume Spot but must not resume Perpetual entries.
  useEffect(() => {
    if (!refreshTradingWallet || !walletConnected || !walletAddress || !lastTradingWallet) return;
    const wallet = walletAddress.trim().toLowerCase();
    if (wallet !== refreshTradingWallet || wallet !== lastTradingWallet || connectedAccess?.wallet !== wallet ||
        launchVerifiedWallet === wallet) return;
    let preferredTab: ActiveTab = ActiveTab.Markets;
    try {
      const previousTab = localStorage.getItem("hidedex_last_trading_tab_" + wallet);
      if (previousTab && previousTab !== ActiveTab.Landing &&
          Object.values(ActiveTab).includes(previousTab as ActiveTab)) {
        preferredTab = previousTab === ActiveTab.Analytics ? ActiveTab.Portfolio : previousTab as ActiveTab;
      }
    } catch { /* storage may be blocked */ }
    setLaunchVerifiedWallet(wallet);
    setActiveTab(connectedAccess.status !== "granted" && preferredTab === ActiveTab.Perp
      ? ActiveTab.Spot : preferredTab);
    // Refresh does not request trading signatures or reopen Trust Shield.
  }, [walletConnected, walletAddress, lastTradingWallet, refreshTradingWallet, connectedAccess, launchVerifiedWallet]);

  useEffect(() => {
    if (requestedTab !== ActiveTab.Landing || !hasTradingAccess) return;
    try { sessionStorage.removeItem("hidedex_workspace_opened"); } catch {}
  }, [requestedTab, hasTradingAccess]);

  // Remember user-selected screens for a future public entry. This is only
  // navigation history; it cannot unlock Perpetual or authorize a trade.
  useEffect(() => {
    if (!hasTradingAccess || requestedTab === ActiveTab.Landing) return;
    try {
      sessionStorage.setItem("hidedex_last_public_trading_tab", requestedTab);
      sessionStorage.setItem("hidedex_workspace_opened", "1");
      const wallet = walletAddress.trim().toLowerCase();
      if (walletConnected && /^0x[0-9a-f]{40}$/.test(wallet)) {
        localStorage.setItem("hidedex_last_trading_wallet", wallet);
        localStorage.setItem("hidedex_last_trading_tab_" + wallet, requestedTab);
      }
    } catch { /* nonessential UX cache */ }
  }, [hasTradingAccess, requestedTab, walletConnected, walletAddress]);

  // Treat saved wallet as a UI-only restore hint, never as access authorization.
  // Keep the neutral boot shell visible throughout Reown/provider restoration and
  // the granted wallet's server lookup, even if the initial grace time has elapsed.
  // Only a valid hasTradingAccess session may show app screens.
  const restoringSavedWallet =
    !!refreshTradingWallet && refreshTradingWallet === lastTradingWallet && !hasTradingAccess &&
    !restoreGraceElapsed &&
    ((!walletConnected &&
      (appKitStatus === "connecting" ||
       appKitConnected ||
       appKitAddress?.toLowerCase() === lastTradingWallet ||
       !walletConnected)) ||
     (walletConnected && walletAddress.trim().toLowerCase() === lastTradingWallet &&
       (accessLookupState === "idle" ||
        accessLookupState === "checking" ||
        (accessLookupState === "ready" &&
         connectedAccess?.wallet === lastTradingWallet &&
         connectedAccess.status === "granted"))));
  const resumingTradingSession = restoringSavedWallet;

  const readOnlyHlAddress =
    selectedExchange === "hyperliquid" && hasTradingAccess && walletConnected &&
    /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
      ? (walletAddress as `0x${string}`)
      : null;

  const liveSpotStream =
    useHyperliquidSpotStateStream(
      readOnlyHlAddress ??
      undefined
    );

  const normalizedTradingAddress =
    selectedExchange === "hyperliquid" && hasTradingAccess && walletConnected && walletAddress
      ? (() => {
          try {
            return getAddress(walletAddress);
          } catch {
            return null;
          }
        })()
      : null;

  const {
    data: hyperliquidTradingState,
    isLoading: hyperliquidTradingStateLoading,
    isError: hyperliquidTradingStateError,
    error: hyperliquidTradingStateErrorObject,
    isFetched: hyperliquidTradingStateFetched,
    refetch: refetchHyperliquidTradingState,
  } = useQuery({
    queryKey: ["hl_trading_state", normalizedTradingAddress],
    queryFn: () => getHyperliquidTradingState(normalizedTradingAddress!),
    enabled: walletConnected && !!normalizedTradingAddress,
    staleTime: 5_000,
    refetchInterval: 30_000,
  });

  const hyperliquidTradingStateReady =
    !hyperliquidTradingStateLoading &&
    !hyperliquidTradingStateError &&
    !!hyperliquidTradingState;

  const realAccountValueUsd =
    hyperliquidTradingStateReady &&
    typeof hyperliquidTradingState?.accountValueUsd === "number" &&
    Number.isFinite(hyperliquidTradingState.accountValueUsd)
      ? hyperliquidTradingState.accountValueUsd
      : 0;

  const realWithdrawableUsd =
    hyperliquidTradingStateReady &&
    typeof hyperliquidTradingState?.withdrawableUsd === "number" &&
    Number.isFinite(hyperliquidTradingState.withdrawableUsd)
      ? hyperliquidTradingState.withdrawableUsd
      : 0;

  const realSpotUsdcBalanceUsd =
    hyperliquidTradingStateReady &&
    typeof hyperliquidTradingState?.spotUsdcBalanceUsd === "number" &&
    Number.isFinite(hyperliquidTradingState.spotUsdcBalanceUsd)
      ? hyperliquidTradingState.spotUsdcBalanceUsd
      : 0;

  // Real Read-Only Hyperliquid Queries
  const {
    data: userFillsData,
    isLoading: userFillsLoading,
    isError: userFillsError,
    refetch: refetchUserFills,
  } = useQuery({
    queryKey: ['hl_user_fills_history', readOnlyHlAddress],
    queryFn: () => getUserFills(readOnlyHlAddress!),
    enabled: !!readOnlyHlAddress,
    refetchInterval: 15_000,
  });

  const {
    data: spotClearinghouseState,
    isFetched: spotClearinghouseStateFetched,
    refetch: refetchSpotClearinghouseState,
  } = useQuery({
    queryKey: ['hl_spot_state', readOnlyHlAddress],
    queryFn: () => getSpotClearinghouseState(readOnlyHlAddress!),
    enabled: !!readOnlyHlAddress,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });

  const effectiveSpotClearinghouseState =
    liveSpotStream.isConnected &&
    liveSpotStream.spotState
      ? liveSpotStream.spotState
      : spotClearinghouseState;

  const effectiveSpotUsdcBalanceUsd =
    effectiveSpotClearinghouseState
      ? computeSpotUsdcOnlyUsd(
          effectiveSpotClearinghouseState
        )
      : realSpotUsdcBalanceUsd;

  const { data: spotSymbolMap } = useQuery({
    queryKey: ['hl_spot_symbol_map'],
    queryFn: () => getSpotSymbolMap(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: hlLedger = [],
    refetch: refetchDepositWithdrawHistory,
  } = useQuery({
    queryKey: ['hl_deposit_withdraw_history', readOnlyHlAddress],
    queryFn: () =>
      getUserDepositWithdrawalHistory(readOnlyHlAddress!),
    enabled: !!readOnlyHlAddress,
    refetchInterval: 30_000,
  });

  const {
    data: rawOpenOrders,
    refetch: refetchOpenOrders,
  } = useQuery({
    queryKey: ['hl_open_orders', readOnlyHlAddress],
    queryFn: () => getOpenOrders(readOnlyHlAddress!),
    enabled: !!readOnlyHlAddress,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });

  const { data: userFundingData = [] } = useQuery({
    queryKey: ['hl_user_funding', readOnlyHlAddress],
    queryFn: () => getUserFunding(readOnlyHlAddress!),
    enabled: !!readOnlyHlAddress,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: pnlTimeseries } = useQuery({
    queryKey: ['hl_pnl_timeseries', readOnlyHlAddress],
    queryFn: () =>
      getHistoricalPnlTimeseries(readOnlyHlAddress!),
    enabled: !!readOnlyHlAddress,
    refetchInterval: 60_000,
  });

  const [chainId, setChainId] = useState(42161);

  const [tradingSetupComplete, setTradingSetupComplete] = useState(false);
  // Distinguish initial refresh/verification from genuinely missing permissions.
  const [setupRestoreCheckedAddress, setSetupRestoreCheckedAddress] = useState<string | null>(null);
  const [setupVerifiedAddress, setSetupVerifiedAddress] = useState<string | null>(null);
  const [tradingSetupRequested, setTradingSetupRequested] = useState(false);
  const [tradingSetupDismissed, setTradingSetupDismissed] = useState(false);
  const [tradingSetupBusy, setTradingSetupBusy] = useState(false);

  // Wait until this connected wallet's local state has been read.
  // Never grant trading from an unverified browser cache.
  useEffect(() => {
    setSetupRestoreCheckedAddress(null);
    setSetupVerifiedAddress(null);
    setTradingSetupComplete(false);
    if (!walletConnected || !normalizedTradingAddress) return;
    let cancelled = false;
    void isTradingSetupComplete().catch(() => false).then(() => {
      if (!cancelled) setSetupRestoreCheckedAddress(normalizedTradingAddress.toLowerCase());
    });
    return () => { cancelled = true; };
  }, [walletConnected, normalizedTradingAddress]);

  // Confirm agent, builder approval and account mode using real Hyperliquid state.
  // Only after confirmation may the setup modal automatically appear.
  useEffect(() => {
    if (!walletConnected || !normalizedTradingAddress ||
        setupRestoreCheckedAddress !== normalizedTradingAddress.toLowerCase() ||
        !hyperliquidTradingStateReady) return;

    const walletKey = normalizedTradingAddress.toLowerCase();
    if (!hyperliquidTradingState?.isAgentActive) {
      setTradingSetupComplete(false);
      setSetupVerifiedAddress(walletKey);
      return;
    }
    if (hyperliquidTradingState.accountAbstractionMode == null) return;

    let aborted = false;
    void (async () => {
      try {
        const approved = await isBuilderFeeApproved(normalizedTradingAddress);
        if (aborted) return;
        const valid = approved &&
          isPooledAccountMode(hyperliquidTradingState.accountAbstractionMode);
        setTradingSetupComplete(valid);
        setSetupVerifiedAddress(walletKey);
        if (valid) void markTradingSetupComplete().catch(() => {});
      } catch {
        // Temporary API errors are not evidence of revoked permissions.
        // Never reopen signing purely because a verification request failed.
      }
    })();
    return () => { aborted = true; };
  }, [
    walletConnected,
    normalizedTradingAddress,
    setupRestoreCheckedAddress,
    hyperliquidTradingStateReady,
    hyperliquidTradingState?.isAgentActive,
    hyperliquidTradingState?.accountAbstractionMode,
  ]);

  // Dismissal remains session-scoped; new wallet requires a new check.
  useEffect(() => {
    setTradingSetupDismissed(false);
    setTradingSetupBusy(false);
    setTradingSetupRequested(false);
  }, [normalizedTradingAddress]);

  // Only offer Hyperliquid signing on the actual Spot/Perp terminal.
  // A zero-balance user may still configure trading permissions voluntarily.
  const isTradeTerminalActive = hasTradingAccess &&
    (activeTab === ActiveTab.Spot || (activeTab === ActiveTab.Perp && hasPerpApproval));
  const showTradingSetup =
    isTradeTerminalActive &&
    !!normalizedTradingAddress &&
    !showTrustShieldPopup &&
    !tradingSetupComplete &&
    !tradingSetupDismissed &&
    // Show authorisation only on an explicit button click, not automatically at startup.
    (tradingSetupRequested || tradingSetupBusy);

  const requestTradingSetup = useCallback(() => {
    setTradingSetupDismissed(false);
    setTradingSetupRequested(true);
  }, []);

  const getTradingSetupProvider = useCallback(async (): Promise<Eip1193Provider> => {
    return activeWallet.getProvider();
  }, [activeWallet]);

  // Aster-only bridge: Reown WalletConnect can switch an approved network through
  // useAppKitNetwork.switchNetwork while its EIP-1193 provider may NOT expose
  // wallet_switchEthereumChain. Never change Hyperliquid/Lighter providers.
  // Authenticate the owner again and verify the actual provider chain before
  // authorizing any Aster signature, deposit, or withdrawal.
  const getAsterWalletProvider = useCallback(async () => {
    await getTradingSetupProvider(); // Reject a disconnected or changed wallet.
    const expectedOwner = activeWallet.address?.toLowerCase();
    if (!expectedOwner) throw new Error("Reconnect your wallet before enabling Aster trading.");
    return {
      request: async ({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> => {
        if (method !== "wallet_switchEthereumChain") {
          const provider = await getTradingSetupProvider();
          return provider.request({ method, ...(params ? { params } : {}) });
        }

        const rawTarget = (params?.[0] as { chainId?: unknown } | undefined)?.chainId;
        if (typeof rawTarget !== "string") throw new Error("Aster requested an invalid wallet chain.");
        let targetId: bigint;
        try { targetId = BigInt(rawTarget); }
        catch { throw new Error("Aster requested an invalid wallet chain."); }
        const targetNetwork =
          targetId === 56n ? bsc :
          targetId === 42161n ? arbitrum :
          targetId === 1n ? mainnet : null;
        if (!targetNetwork) throw new Error("Unsupported Aster funding network.");

        const verifiedChain = async (): Promise<boolean> => {
          const provider = await getTradingSetupProvider();
          const chainId = await provider.request({ method: "eth_chainId" });
          const accounts = await provider.request({ method: "eth_accounts" }) as string[] | undefined;
          if (!Array.isArray(accounts) || typeof accounts[0] !== "string" ||
              accounts[0].toLowerCase() !== expectedOwner) {
            throw new Error("Connected wallet changed. Reconnect before authorizing Aster.");
          }
          return BigInt(String(chainId)) === targetId;
        };
        if (await verifiedChain()) return null;
        try {
          await switchNetwork(targetNetwork);
        } catch {
          throw new Error(
            "WalletConnect could not switch networks. Open your wallet, select " +
            (targetId === 56n ? "BNB Smart Chain" : targetNetwork.name) +
            ", then try again."
          );
        }

        // Some WalletConnect wallets apply a network change asynchronously.
        // Verify on-chain wallet provider state, not just Reown's UI selection.
        for (let i = 0; i < 16; i++) {
          try {
            if (await verifiedChain()) return null;
          } catch (e) {
            if (String(e).includes("Connected wallet changed")) throw e;
          }
          await new Promise<void>(resolve => setTimeout(resolve, 350));
        }
        throw new Error(
          "Your wallet did not confirm the network switch. Select " +
          (targetId === 56n ? "BNB Smart Chain (56)" : targetNetwork.name) +
          " in your wallet, then retry Enable Trading."
        );
      },
    };
  }, [activeWallet.address, getTradingSetupProvider, switchNetwork]);

  const HL_SIGNING_CHAIN_ALIGN_TIMEOUT_MS = 6_000;
  const HL_SIGNING_CHAIN_SETTLE_MS = 750;

  const ensureTradingSigningChain = useCallback(async (): Promise<void> => {
    if (activeWallet.kind === "external" && appKitConnected) {
      try {
        const switched = await Promise.race([
          Promise.resolve(switchNetwork(arbitrum)).then(() => true),
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), HL_SIGNING_CHAIN_ALIGN_TIMEOUT_MS);
          }),
        ]);

        if (switched) {
          await new Promise((resolve) =>
            setTimeout(resolve, HL_SIGNING_CHAIN_SETTLE_MS)
          );
        }
      } catch {
        // PRIMARY behavior:
        // chain alignment is best-effort.
      }
    }
  }, [activeWallet.kind, appKitConnected, switchNetwork]);

  const handleTradingSetupComplete = useCallback(() => {
    setTradingSetupComplete(true);
    setSetupVerifiedAddress(normalizedTradingAddress?.toLowerCase() ?? null);
    setTradingSetupRequested(false);
    setTradingSetupDismissed(false);
    setTradingSetupBusy(false);

    void refetchHyperliquidTradingState();
  }, [refetchHyperliquidTradingState, normalizedTradingAddress]);

  const handleTradingSetupClose = useCallback(() => {
    setTradingSetupBusy(false);
    setTradingSetupRequested(false);
    setTradingSetupDismissed(true);
  }, []);

  const handlePerpOrderSuccess = useCallback(async () => {
    await Promise.all([
      refetchHyperliquidTradingState(),
      refetchOpenOrders(),
      refetchUserFills(),
    ]);
  }, [
    refetchHyperliquidTradingState,
    refetchOpenOrders,
    refetchUserFills,
  ]);

  const handleSpotOrderSuccess = useCallback(async () => {
    await Promise.allSettled([
      refetchHyperliquidTradingState(),
      refetchOpenOrders(),
      refetchUserFills(),
      refetchSpotClearinghouseState(),
    ]);
  }, [
    refetchHyperliquidTradingState,
    refetchOpenOrders,
    refetchUserFills,
    refetchSpotClearinghouseState,
  ]);
  const [selectedSymbol, setSelectedSymbol] = useState("");

  useEffect(() => {
    // Even when switching between two still-connected accounts, discard the
    // old wallet's proof and require a fresh server-signed launch approval.
    setLaunchVerifiedWallet(null);
    setConnectedAccess(null);
    setActiveTab(tab => publicWorkspaceOpened
      ? (tab === ActiveTab.Perp ? ActiveTab.Spot : tab)
      : ActiveTab.Landing);
  }, [walletConnected, walletAddress]);

  useEffect(() => {
    const checkAndRedirect = () => {
      // Markets is a deliberate destination for new visitors and returning
      // users. Never redirect it into Perpetual on larger screens.

      if (
        mode === "ANONYMOUS" &&
        activeTab === ActiveTab.Profile
      ) {
        setActiveTab(hasPerpApproval ? ActiveTab.Perp : ActiveTab.Spot);
      }
    };

    checkAndRedirect();

    if (typeof window !== "undefined") {
      window.addEventListener(
        "resize",
        checkAndRedirect
      );

      const mediaQuery =
        window.matchMedia(
          "(min-width: 640px)"
        );

      const handleMediaChange = (
        e: MediaQueryListEvent
      ) => {
        // A viewport change must never move a visitor off Markets.
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener(
          "change",
          handleMediaChange
        );
      }

      return () => {
        window.removeEventListener(
          "resize",
          checkAndRedirect
        );

        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener(
            "change",
            handleMediaChange
          );
        }
      };
    }
  }, [
    mode,
    activeTab,
    hasPerpApproval
  ]);

  // Handle URL direct routing checks for trade-history, leaderboard, analytics, referral, order-history, funding-history, twap-history
  useEffect(() => {
    const checkUrl = () => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname.toLowerCase().replace("/", "");
      const hash = window.location.hash.toLowerCase().replace("#", "");
      const search = window.location.search.toLowerCase();
      
      const target = path || hash || (search.includes("tab=") ? search.split("tab=")[1] : "");
      
      if (target.includes("trade-history") || target.includes("trade_history")) {
        setActiveTab(ActiveTab.TradeHistory);
      } else if (target.includes("leaderboard")) {
        setActiveTab(ActiveTab.Leaderboard);
      } else if (target.includes("analytics")) {
        setActiveTab(ActiveTab.Portfolio);
      } else if (target.includes("referral")) {
        setActiveTab(ActiveTab.Referral);
      } else if (target.includes("order-history") || target.includes("order_history")) {
        setActiveTab(ActiveTab.Orders);
      } else if (target.includes("funding-history") || target.includes("funding_history") || target.includes("twap-history") || target.includes("twap_history")) {
        // Since funding history, twap history are in portfolios/vaults/etc., we can set ActiveTab to Portfolio or leave it
      }
    };
    checkUrl();
    window.addEventListener("popstate", checkUrl);
    window.addEventListener("hashchange", checkUrl);
    return () => {
      window.removeEventListener("popstate", checkUrl);
      window.removeEventListener("hashchange", checkUrl);
    };
  }, []);
  const [selectedSubLegalTab, setSelectedSubLegalTab] = useState("terms");
  const [selectedPricePreset, setSelectedPricePreset] = useState<number | undefined>(undefined);

  const handleMarketOrderBookPriceSelect = (
    price: number,
    mode: "spot" | "perp"
  ) => {
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }

    setSelectedPricePreset(price);
    setActiveTab(mode === "spot" ? ActiveTab.Spot : ActiveTab.Perp);
  };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [walletModalError, setWalletModalError] = useState<string | null>(null);

  // User Profile, Settings, Alerts, & Searches State (Phase 3 requirements)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    let savedNick = "Pro Trader #888";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user_profile_nickname");
      if (stored) savedNick = stored;
    }
    return {
      displayName: savedNick,
      email: "hidedex.com@gmail.com",
      avatarId: 1,
      antiPhishingCode: "",
      tier: "Standard",
    };
  });

  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    let savedTheme: "dark" | "light" = "dark";
    if (typeof window !== "undefined") {
      // The full theme ID is authoritative; a monochrome profile must not
      // be collapsed back into Classic Light by stale anon_theme state.
      const fullThemeId = localStorage.getItem("pref_theme_id");
      const stored = localStorage.getItem("anon_theme");
      if (fullThemeId) {
        savedTheme = (fullThemeId === "light" || fullThemeId === "mono-light") ? "light" : "dark";
      } else if (stored === "dark" || stored === "light") {
        savedTheme = stored;
      }
    }
    return {
      theme: savedTheme,
      language: "EN",
      pushEnabled: true,
      emailEnabled: true,
      soundEnabled: true,
      orderFills: true,
      priceAlerts: true,
    };
  });

  const favoritesOwner =
    walletAddress
      ? String(walletAddress).toLowerCase()
      : "guest";

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    return loadOwnerFavoritesWithMigration(favoritesOwner);
  });

  const loadedFavoritesOwnerRef = useRef<string>(favoritesOwner);
  const skipFavoritesPersistRef = useRef(false);

  // Load owner favorites when favoritesOwner changes
  useEffect(() => {
    if (loadedFavoritesOwnerRef.current === favoritesOwner) {
      return;
    }
    const loaded = loadOwnerFavoritesWithMigration(favoritesOwner);
    skipFavoritesPersistRef.current = true;
    loadedFavoritesOwnerRef.current = favoritesOwner;
    setWatchlist(loaded);
  }, [favoritesOwner]);

  // Persist favorites changes for current owner
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadedFavoritesOwnerRef.current !== favoritesOwner) {
      return;
    }

    if (skipFavoritesPersistRef.current) {
      skipFavoritesPersistRef.current = false;
      return;
    }

    try {
      localStorage.setItem(`favorites:${favoritesOwner}`, JSON.stringify(watchlist));
    } catch {
      /* ignore localStorage write errors */
    }
  }, [watchlist, favoritesOwner]);

  const handleToggleWatchlist = useCallback((symbol: string) => {
    const normalized = String(symbol || "").toUpperCase();
    if (!normalized) return;
    setWatchlist((prev) =>
      prev.includes(normalized)
        ? prev.filter((s) => s !== normalized)
        : [...prev, normalized]
    );
  }, []);



  // One original Watchlist UI; market favorites remain exchange- and wallet-scoped.
  const lighterFavoritesKey="favorites:lighter:"+favoritesOwner;
  const readLighterFavorites=(key:string):string[]=>{
    try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x.filter((v):v is string=>typeof v==="string"):[];}
    catch{return [];}
  };
  const [lighterWatchlist,setLighterWatchlist]=useState<string[]>(()=>readLighterFavorites(lighterFavoritesKey));
  const [lighterSidebarTokens,setLighterSidebarTokens]=useState<TokenMetadata[]>([]);
  const [lighterMarketRequest,setLighterMarketRequest]=useState<{symbol:string;nonce:number}|null>(null);
  const lighterOwnerRef=useRef(lighterFavoritesKey);
  const skipLighterPersist=useRef(false);
  useEffect(()=>{
    if(lighterOwnerRef.current===lighterFavoritesKey)return;
    lighterOwnerRef.current=lighterFavoritesKey;
    skipLighterPersist.current=true;
    setLighterWatchlist(readLighterFavorites(lighterFavoritesKey));
  },[lighterFavoritesKey]);
  useEffect(()=>{
    if(lighterOwnerRef.current!==lighterFavoritesKey)return;
    if(skipLighterPersist.current){skipLighterPersist.current=false;return;}
    try{localStorage.setItem(lighterFavoritesKey,JSON.stringify(lighterWatchlist));}catch{}
  },[lighterFavoritesKey,lighterWatchlist]);
  const toggleLighterFavorite=useCallback((symbol:string)=>{
    const id=String(symbol||"").toUpperCase();if(!id)return;
    setLighterWatchlist(prev=>prev.includes(id)?prev.filter(s=>s!==id):[...prev,id]);
  },[]);
  const onLighterCatalog=useCallback((rows:TokenMetadata[])=>{
    setLighterSidebarTokens(prev=>{
      if(prev.length===rows.length&&prev.every((x,i)=>x.symbol===rows[i].symbol&&x.price===rows[i].price))return prev;
      return rows;
    });
  },[]);

  // Settings State
  const [slippageTolerance, setSlippageTolerance] = useState<number>(() => {
    if (typeof window === "undefined") return 0.5;

    try {
      const raw = localStorage.getItem("pref_slippage");
      const parsed = raw !== null ? Number(raw) : NaN;

      return Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // System Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Token Market Stats
  const [tokens, setTokens] = useState<TokenMetadata[]>([]);

  useEffect(() => {
    const cryptoAssets =
      Array.isArray(
        cryptoData?.assets
      )
        ? cryptoData.assets
        : [];

    const rwaAssets =
      Array.isArray(
        rwaData?.assets
      )
        ? rwaData.assets
        : [];

    if (cryptoAssets.length === 0 && rwaAssets.length === 0) {
      return;
    }

    const parseNullableSourceNumber = (
      value: string | null,
    ): number | null => {
      if (value === null) {
        return null;
      }

      const parsed = parseFloat(value);

      return Number.isFinite(parsed)
        ? parsed
        : null;
    };

    const mappedCryptoTokens: TokenMetadata[] =
      cryptoAssets.map((asset) => {
        const price =
          parseNullableSourceNumber(asset.markPx);

        const volume24h =
          parseNullableSourceNumber(asset.dayNtlVlm);

        const rawOpenInterest =
          parseNullableSourceNumber(asset.openInterest);

        const rawFunding =
          parseNullableSourceNumber(asset.funding);

        const openInterest =
          rawOpenInterest !== null &&
          price !== null
            ? rawOpenInterest * price
            : null;

        const fundingRate =
          rawFunding !== null
            ? rawFunding * 100
            : null;

        const isSpotOnly =
          asset.isSpotOnly === true;

        return {
          sourceCoin: asset.coin,
          symbol: isSpotOnly
            ? `${asset.symbol}-SPOT`
            : asset.symbol,
          name: asset.symbol,
          fullName: asset.name,
          displayBaseAsset: asset.symbol,

          price,

          change24h:
            typeof asset.change24h === "number" &&
            Number.isFinite(asset.change24h)
              ? asset.change24h
              : null,

          volume24h,

          openInterest:
            isSpotOnly
              ? null
              : openInterest,

          fundingRate:
            isSpotOnly
              ? null
              : fundingRate,

          high24h: null,
          low24h: null,

          maxLeverage: asset.maxLeverage,

          category:
            isSpotOnly
              ? "spot"
              : "perps",

          subcategory:
            isSpotOnly
              ? "all"
              : "crypto",

          szDecimals: asset.szDecimals,
          isSpotOnly,
          hasSpot: asset.hasSpot === true,
          spotSymbol:
            asset.spotSymbol ?? null,
          spotCtx: asset.spotCtx ?? undefined,
        };
      });

    const mappedRwaTokens: TokenMetadata[] =
      rwaAssets.map((asset) => {
        const price =
          parseNullableSourceNumber(
            asset.markPx
          );

        const volume24h =
          parseNullableSourceNumber(
            asset.dayNtlVlm
          );

        const rawOpenInterest =
          parseNullableSourceNumber(
            asset.openInterest
          );

        const rawFunding =
          parseNullableSourceNumber(
            asset.funding
          );

        const openInterest =
          rawOpenInterest !== null &&
          price !== null
            ? rawOpenInterest * price
            : null;

        const fundingRate =
          rawFunding !== null
            ? rawFunding * 100
            : null;

        const subcategory:
          TokenMetadata["subcategory"] =
          asset.category === "stock"
            ? "stocks"
            : asset.category === "commodity"
            ? "commodities"
            : asset.category === "forex"
            ? "forex"
            : asset.category === "index"
            ? "indices"
            : "all";

        return {
          sourceCoin:
            asset.coin,

          symbol:
            asset.isSpotOnly === true
              ? `${
                  asset.uiSymbol ||
                  asset.symbol
                }-SPOT`
              : (
                  asset.uiSymbol ||
                  asset.symbol
                ),

          name:
            asset.symbol,

          fullName:
            asset.name,

          displayBaseAsset:
            asset.symbol,

          price,

          change24h:
            typeof asset.change24h ===
            "number" &&
            Number.isFinite(
              asset.change24h
            )
              ? asset.change24h
              : null,

          volume24h,

          openInterest:
            asset.isSpotOnly === true
              ? null
              : openInterest,

          fundingRate:
            asset.isSpotOnly === true
              ? null
              : fundingRate,

          high24h:
            null,

          low24h:
            null,

          maxLeverage:
            asset.maxLeverage,

          category:
            asset.isSpotOnly === true
              ? "spot"
              : "perps",

          subcategory:
            asset.isSpotOnly === true
              ? "all"
              : subcategory,

          szDecimals:
            asset.szDecimals,

          isSpotOnly:
            asset.isSpotOnly === true,

          hasSpot:
            asset.hasSpot === true,

          spotSymbol:
            asset.spotSymbol ?? null,

          growthMode:
            asset.growthMode ?? null,

          deployerFeeScale:
            asset.deployerFeeScale ?? null,

          spotCtx:
            asset.spotCtx ?? undefined,
        };
      });

    const mappedTokens:
      TokenMetadata[] = [
      ...mappedCryptoTokens,
      ...mappedRwaTokens,
    ];

    setTokens(mappedTokens);

    setSelectedSymbol((current) =>
      current ||
      mappedTokens[0]?.symbol ||
      ""
    );
  }, [cryptoData, rwaData]);
  const [registryStatus, setRegistryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [registryError, setRegistryError] = useState<string | null>(null);

  // Current selected active token metadata
  const currentToken: TokenMetadata | null = React.useMemo(() => {
    return tokens.find((t) => t.symbol === selectedSymbol) || tokens[0] || null;
  }, [tokens, selectedSymbol]);

  // Derive unique position coins for live asset context subscription
  const positionCoins = useMemo(() => {
    if (!hyperliquidTradingState?.positions || !Array.isArray(hyperliquidTradingState.positions)) {
      return [];
    }

    const uniqueCoins = new Set<string>();
    for (const row of hyperliquidTradingState.positions) {
      const rawCoin = row?.coin ? String(row.coin).trim() : "";
      if (!rawCoin) continue;

      const sziNum = parseFloat(String(row?.szi ?? "0"));
      if (!Number.isFinite(sziNum) || sziNum === 0) continue;

      uniqueCoins.add(rawCoin);
    }

    return Array.from(uniqueCoins);
  }, [hyperliquidTradingState?.positions]);

  const livePositionAssetCtxs = useLiveAssetCtxs(positionCoins);

  // Real Hyperliquid Perpetual Positions derived strictly from trading state
  const positions: Position[] = useMemo(() => {
    if (!hyperliquidTradingState?.positions || !Array.isArray(hyperliquidTradingState.positions)) {
      return [];
    }

    const safeNum = (x: any) => {
      const n =
        typeof x === 'number'
          ? x
          : parseFloat(String(x ?? ''));

      return Number.isFinite(n)
        ? n
        : NaN;
    };

    return hyperliquidTradingState.positions
      .map((row: any): Position | null => {
        const rawCoin = row?.coin ? String(row.coin).trim() : "";
        if (!rawCoin) return null;

        const sziNum = parseFloat(String(row?.szi ?? "0"));
        if (!Number.isFinite(sziNum) || sziNum === 0) return null;

        const isLong = sziNum > 0;
        const size = Math.abs(sziNum);
        const entryPxNum = safeNum(row?.entryPx);
        const entryPrice = Number.isFinite(entryPxNum) ? entryPxNum : 0;
        const liqPrice = row?.liquidationPx != null ? parseFloat(String(row.liquidationPx)) || 0 : 0;

        const snapshotPnl = safeNum(row?.unrealizedPnl);
        const snapshotRoe = safeNum(row?.returnOnEquity);
        const snapshotRoePct = Number.isFinite(snapshotRoe) ? snapshotRoe * 100 : NaN;

        const liveMarkRaw = livePositionAssetCtxs?.[rawCoin]?.markPx;
        const parsedLiveMark = liveMarkRaw ? parseFloat(liveMarkRaw) : NaN;

        const positionValueNum = row?.positionValue != null ? parseFloat(String(row.positionValue)) : NaN;
        const marginUsedNum = safeNum(row?.marginUsed);

        // Snapshot mark fallback: abs(positionValue) / abs(szi) when valid
        const snapshotMarkFallback =
          Number.isFinite(positionValueNum) &&
          Math.abs(positionValueNum) > 0 &&
          size > 0
            ? Math.abs(positionValueNum) / size
            : NaN;

        const markPxNum =
          Number.isFinite(parsedLiveMark) && parsedLiveMark > 0
            ? parsedLiveMark
            : snapshotMarkFallback;

        const markPrice =
          Number.isFinite(markPxNum)
            ? markPxNum
            : 0;

        const posValueUsd =
          Number.isFinite(markPxNum)
            ? size * markPxNum
            : (
                Number.isFinite(positionValueNum)
                  ? Math.abs(positionValueNum)
                  : NaN
              );

        // Exact PRIMARY Live Signed PnL Formula
        const liveSignedPnl =
          Number.isFinite(markPxNum) &&
          Number.isFinite(entryPxNum) &&
          Number.isFinite(sziNum)
            ? (
                markPxNum -
                entryPxNum
              ) * sziNum
            : NaN;

        // Unrealized PnL: use liveSignedPnl when finite, fallback to snapshot
        const unrealizedPnl =
          Number.isFinite(liveSignedPnl)
            ? liveSignedPnl
            : (
                Number.isFinite(snapshotPnl)
                  ? snapshotPnl
                  : 0
              );

        // Exact PRIMARY Live ROE Formula
        const livePerpRoePct =
          Number.isFinite(liveSignedPnl) &&
          Number.isFinite(marginUsedNum) &&
          marginUsedNum > 0
            ? (
                liveSignedPnl /
                marginUsedNum
              ) * 100
            : NaN;

        // Unrealized PnL Percent: use livePerpRoePct when finite, fallback to snapshot
        const unrealizedPnlPercent =
          Number.isFinite(livePerpRoePct)
            ? livePerpRoePct
            : (
                Number.isFinite(snapshotRoePct)
                  ? snapshotRoePct
                  : 0
              );

        // Leverage derivation
        let leverage = 0;
        const rawLev = row?.leverage;
        if (rawLev != null) {
          if (typeof rawLev === "object" && rawLev?.value != null) {
            leverage = parseFloat(String(rawLev.value)) || 0;
          } else {
            leverage = parseFloat(String(rawLev)) || 0;
          }
        }
        if ((!leverage || !Number.isFinite(leverage) || leverage <= 0) &&
            Number.isFinite(posValueUsd) && posValueUsd > 0 &&
            Number.isFinite(marginUsedNum) && marginUsedNum > 0) {
          leverage = posValueUsd / marginUsedNum;
        }

        const marginType: "cross" | "isolated" = row?.marginType === "isolated" ? "isolated" : "cross";
        const margin = Number.isFinite(marginUsedNum) ? marginUsedNum : 0;

        const displaySymbol = hip3DisplaySymbol(rawCoin);

        return {
          id: rawCoin,
          symbol: displaySymbol,
          type: isLong ? "LONG" : "SHORT",
          leverage:
            Number.isFinite(leverage) && leverage > 0
              ? Math.max(1, Math.round(leverage))
              : 0,
          size,
          entryPrice,
          markPrice,
          liqPrice,
          margin,
          unrealizedPnl,
          unrealizedPnlPercent,
          sourceCoin: rawCoin,
          rawSzi: String(row.szi),
          marginType,
          status: "OPEN",
        };
      })
      .filter((p): p is Position => p !== null);
  }, [hyperliquidTradingState?.positions, livePositionAssetCtxs]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    USDC: 0,
  });

  // Synchronize openOrders with real open orders query
  useEffect(() => {
    if (!readOnlyHlAddress || !Array.isArray(rawOpenOrders)) {
      setOpenOrders([]);
      return;
    }

    const mappedOrders = rawOpenOrders
      .map((row: any, index: number): OpenOrder | null => {
        const raw = row as any;

        const order =
          raw?.order ??
          raw?.o ??
          raw;

        const rawCoin = String(
          order?.coin ??
          raw?.coin ??
          ''
        );

        if (!rawCoin) {
          return null;
        }

        const rawDex =
          typeof (raw?._dex ?? order?._dex) === 'string'
            ? String(raw?._dex ?? order?._dex).trim()
            : '';

        let canonicalSourceCoin = rawCoin;
        if (
          rawDex &&
          rawCoin &&
          !rawCoin.includes(':') &&
          !rawCoin.startsWith('@')
        ) {
          canonicalSourceCoin = `${rawDex}:${rawCoin}`;
        }

        let displaySymbol = rawCoin;

        if (
          rawCoin.startsWith('@') &&
          spotSymbolMap?.bySymbol?.[rawCoin]?.baseCoin
        ) {
          displaySymbol =
            spotSymbolMap.bySymbol[rawCoin].baseCoin;
        } else {
          displaySymbol =
            hip3DisplaySymbol(canonicalSourceCoin);
        }

        const isSpotOrder =
          rawCoin.startsWith('@') ||
          !!(
            order?.isSpot ??
            raw?.isSpot
          );

        const rawSide =
          order?.side ??
          raw?.side;

        const side: "BUY" | "SELL" =
          rawSide === 'B'
            ? 'BUY'
            : 'SELL';

        const isPositionTpsl =
          (
            order?.isPositionTpsl ??
            raw?.isPositionTpsl ??
            raw?.order?.isPositionTpsl
          ) === true;

        const rawLimitPrice =
          order?.limitPx ??
          order?.orderType?.limitPx ??
          order?.limitPrice ??
          order?.p ??
          order?.px ??
          order?.price ??
          raw?.limitPx ??
          raw?.p ??
          raw?.order?.limitPx ??
          raw?.order?.p;

        const limitPriceNumber =
          Number(rawLimitPrice);

        const limitPrice =
          Number.isFinite(limitPriceNumber)
            ? limitPriceNumber
            : null;

        const rawTpsl =
          order?.tpsl ??
          order?.trigger?.tpsl ??
          order?.t?.trigger?.tpsl ??
          order?.orderType?.trigger?.tpsl ??
          raw?.tpsl ??
          raw?.trigger?.tpsl ??
          raw?.t?.trigger?.tpsl ??
          raw?.orderType?.trigger?.tpsl ??
          raw?.order?.tpsl ??
          raw?.order?.trigger?.tpsl ??
          raw?.order?.t?.trigger?.tpsl ??
          raw?.order?.orderType?.trigger?.tpsl;

        const orderTypeRaw =
          order?.orderType ??
          raw?.orderType;

        const orderTypeLabel =
          typeof orderTypeRaw === "string"
            ? orderTypeRaw.trim().toLowerCase()
            : "";

        let orderTpsl: "tp" | "sl" | undefined = undefined;
        if (rawTpsl === 'tp' || rawTpsl === 'sl') {
          orderTpsl = rawTpsl;
        } else if (isPositionTpsl) {
          if (orderTypeLabel.includes('take profit')) {
            orderTpsl = 'tp';
          } else if (orderTypeLabel.includes('stop')) {
            orderTpsl = 'sl';
          }
        }

        const rawTriggerPrice =
          order?.triggerPx ??
          order?.trigger?.triggerPx ??
          order?.t?.trigger?.triggerPx ??
          order?.orderType?.trigger?.triggerPx ??
          raw?.triggerPx ??
          raw?.trigger?.triggerPx ??
          raw?.t?.trigger?.triggerPx ??
          raw?.orderType?.trigger?.triggerPx ??
          raw?.order?.triggerPx ??
          raw?.order?.trigger?.triggerPx ??
          raw?.order?.t?.trigger?.triggerPx ??
          raw?.order?.orderType?.trigger?.triggerPx;

        const triggerPriceNumber =
          Number(rawTriggerPrice);

        const triggerPrice =
          Number.isFinite(triggerPriceNumber)
            ? triggerPriceNumber
            : null;

        const isTriggerFlag =
          (
            order?.isTrigger ??
            raw?.isTrigger
          ) === true ||
          (
            triggerPrice !== null &&
            triggerPrice > 0
          ) ||
          (
            typeof orderTypeRaw === 'object' &&
            orderTypeRaw?.trigger != null
          );

        const price =
          isTriggerFlag &&
          triggerPrice !== null
            ? triggerPrice
            : limitPrice;

        if (price === null) {
          return null;
        }

        let type: OpenOrder["type"] =
          "UNKNOWN";

        if (orderTpsl === 'tp') {
          type = "TAKE_PROFIT";
        } else if (orderTpsl === 'sl') {
          type = "STOP_MARKET";
        } else if (isTriggerFlag) {
          type = "TRIGGER";
        } else if (
          typeof orderTypeRaw === 'string' &&
          orderTypeRaw.toLowerCase().includes('twap')
        ) {
          type = "TWAP";
        } else if (
          typeof orderTypeRaw === 'string' &&
          orderTypeRaw.toLowerCase().includes('limit')
        ) {
          type = "LIMIT";
        } else if (
          typeof orderTypeRaw === 'object' &&
          orderTypeRaw?.limit
        ) {
          type = "LIMIT";
        }

        const remainingRaw = Number(
          order?.sz ??
          raw?.sz
        );

        const originalRaw = Number(
          order?.origSz ??
          raw?.origSz
        );

        const remainingSize =
          Number.isFinite(remainingRaw)
            ? Math.abs(remainingRaw)
            : undefined;

        const originalSize =
          Number.isFinite(originalRaw) &&
          Math.abs(originalRaw) > 0
            ? Math.abs(originalRaw)
            : undefined;

        const size =
          originalSize ??
          remainingSize;

        if (size === undefined) {
          return null;
        }

        let filled:
          number | undefined;

        if (
          originalSize !== undefined &&
          remainingSize !== undefined &&
          originalSize > 0
        ) {
          filled =
            Math.max(
              0,
              Math.min(
                100,
                (
                  (
                    originalSize -
                    remainingSize
                  ) /
                  originalSize
                ) *
                  100,
              ),
            );
        }

        const oidNumber =
          Number(
            raw?.oid ??
            order?.oid
          );

        const oid =
          Number.isFinite(oidNumber)
            ? oidNumber
            : undefined;

        const cloidRaw =
          order?.cloid ??
          order?.c ??
          raw?.cloid ??
          raw?.c ??
          null;

        const cloid =
          cloidRaw != null
            ? String(cloidRaw)
            : null;

        const rawTimestamp =
          Number(
            order?.timestamp ??
            raw?.timestamp ??
            order?.time ??
            raw?.time ??
            0
          );

        const timestampMs =
          Number.isFinite(rawTimestamp)
            ? rawTimestamp
            : 0;

        const timestamp =
          timestampMs > 0
            ? new Date(
                timestampMs,
              ).toLocaleString()
            : '--';

        const reduceOnly =
          !!(
            order?.reduceOnly ??
            order?.isReduce ??
            order?.r ??
            order?.orderType
              ?.reduceOnly ??
            order?.t?.reduceOnly
          );

        const rawTif =
          order?.tif ??
          order?.t?.limit?.tif ??
          raw?.tif ??
          raw?.t?.limit?.tif;

        let timeInForce:
          "GTC" |
          "IOC" |
          "ALO" |
          undefined;

        const tif =
          String(
            rawTif ?? ''
          ).toLowerCase();

        if (tif === 'gtc') {
          timeInForce = 'GTC';
        } else if (tif === 'ioc') {
          timeInForce = 'IOC';
        } else if (tif === 'alo') {
          timeInForce = 'ALO';
        }

        const id =
          oid !== undefined
            ? String(oid)
            : cloid
              ? cloid
              : `${rawCoin}:${timestampMs}:${index}`;

        return {
          id,
          oid,
          cloid,
          sourceCoin: canonicalSourceCoin,
          symbol: displaySymbol,
          isSpot: isSpotOrder,
          dex:
            rawDex || undefined,
          type,
          side,
          price,
          size,
          remainingSize,
          filled,
          status: "OPEN",
          timestamp,
          timestampMs,
          reduceOnly,
          timeInForce,
          triggerPrice:
            triggerPrice ??
            undefined,
          isTrigger: isTriggerFlag,
          tpsl:
            orderTpsl === 'tp' ||
            orderTpsl === 'sl'
              ? orderTpsl
              : undefined,
        };
      })
      .filter(
        (row): row is OpenOrder =>
          row !== null,
      );

    setOpenOrders(mappedOrders);
  }, [readOnlyHlAddress, rawOpenOrders, spotSymbolMap]);

  const lockedOrderMarginUsd = useMemo(
    () =>
      estimateRestingOrdersInitMarginUsd(
        Array.isArray(rawOpenOrders) ? rawOpenOrders : [],
      ),
    [rawOpenOrders],
  );

  // PART B: Synchronize tradeHistory with real user fills query
  useEffect(() => {
    if (!readOnlyHlAddress || !Array.isArray(userFillsData) || userFillsData.length === 0) {
      setTradeHistory([]);
      return;
    }

    const safeNum = (x: any) => {
      const n =
        typeof x === 'number'
          ? x
          : parseFloat(String(x ?? ''));

      return Number.isFinite(n)
        ? n
        : NaN;
    };

    const sortedFills = [...userFillsData].sort((a: any, b: any) => {
      const timeA = Number(a.time ?? a.timestamp ?? 0);
      const timeB = Number(b.time ?? b.timestamp ?? 0);
      return timeB - timeA;
    });

    const mapped: TradeHistoryItem[] = sortedFills.map((fill: any, index: number) => {
      const coin = String(
        fill.coin ??
        fill.symbol ??
        fill.asset ??
        '--'
      );

      const isSpotFill =
        coin.startsWith('@') ||
        !!(fill?.isSpot);

      let displayCoin = coin;

      if (
        coin.startsWith('@') &&
        spotSymbolMap?.bySymbol?.[coin]?.baseCoin
      ) {
        displayCoin =
          spotSymbolMap.bySymbol[coin].baseCoin;
      }

      const sideRaw = String(
        fill.side ??
        fill.dir ??
        fill.orderSide ??
        ''
      ).toLowerCase();

      const isBuy =
        sideRaw === 'b' ||
        sideRaw === 'buy' ||
        sideRaw === 'long';

      const side: "BUY" | "SELL" = isBuy ? 'BUY' : 'SELL';

      const pxNum = safeNum(
        fill.px ??
        fill.price ??
        fill.fillPx
      );

      const szNum = safeNum(
        fill.sz ??
        fill.size ??
        fill.qty
      );

      let feeNum = NaN;

      const directFee =
        fill.fee ??
        fill.feeUsd ??
        fill.fees ??
        fill.feeAmount ??
        fill.feeAmt ??
        fill.feeValue ??
        fill.feePaid;

      if (directFee != null) {
        feeNum = safeNum(directFee);
      }

      if (!Number.isFinite(feeNum)) {
        const nestedFee =
          fill.closedPnl?.fee ??
          fill.closedPnl?.feeUsd ??
          fill.fee?.fee ??
          fill.fee?.feeUsd ??
          fill.fee?.amount ??
          fill.fee?.value;

        if (nestedFee != null) {
          feeNum = safeNum(nestedFee);
        }
      }

      if (
        !Number.isFinite(feeNum) &&
        isSpotFill
      ) {
        const spotFee =
          fill.spotFee ??
          fill.spotFeeUsd ??
          fill.order?.fee ??
          fill.fill?.fee ??
          fill.spot?.fee;

        if (spotFee != null) {
          feeNum = safeNum(spotFee);
        }
      }

      if (
        Number.isFinite(feeNum) &&
        isSpotFill &&
        fill.feeToken &&
        fill.feeToken !== 'USDC'
      ) {
        if (Number.isFinite(pxNum)) {
          feeNum =
            feeNum *
            pxNum;
        }
      }

      const pnlNum = safeNum(
        fill.pnl ??
        fill.realizedPnl ??
        fill.pnlUsd ??
        fill.closedPnl ??
        fill.realizedPnlUsd ??
        fill.pnlValue
      );

      const netPnlNum =
        Number.isFinite(pnlNum)
          ? pnlNum -
            (
              Number.isFinite(feeNum)
                ? feeNum
                : 0
            )
          : (
              Number.isFinite(feeNum)
                ? -feeNum
                : NaN
            );

      const tradeValueUsd =
        Number.isFinite(pxNum) &&
        Number.isFinite(szNum)
          ? Math.abs(
              pxNum * szNum
            )
          : NaN;

      const pnlPercentForShare =
        Number.isFinite(netPnlNum) &&
        Number.isFinite(tradeValueUsd) &&
        tradeValueUsd > 0
          ? (
              netPnlNum /
              tradeValueUsd
            ) * 100
          : 0;

      const price =
        Number.isFinite(pxNum)
          ? pxNum
          : 0;

      const size =
        Number.isFinite(szNum)
          ? szNum
          : 0;

      const value =
        Number.isFinite(tradeValueUsd)
          ? tradeValueUsd
          : 0;

      const fee =
        Number.isFinite(feeNum)
          ? feeNum
          : 0;

      const pnl =
        Number.isFinite(netPnlNum)
          ? netPnlNum
          : undefined;

      const pnlPercent = pnlPercentForShare;

      const rawTime = Number(
        fill.time ??
        fill.timestamp ??
        0
      );

      const timestampMs =
        Number.isFinite(rawTime)
          ? rawTime
          : 0;

      const timestamp =
        timestampMs > 0
          ? new Date(timestampMs).toLocaleString()
          : 'N/A';

      const id = String(
        fill.oid ??
        fill.tid ??
        `${coin}:${timestampMs}:${index}`
      );

      return {
        id,
        symbol: displayCoin,
        side,
        price,
        size,
        value,
        fee,
        timestamp,
        timestampMs,
        pnl,
        pnlPercent,
        isSpot: isSpotFill,
      };
    });

    setTradeHistory(mapped);
  }, [readOnlyHlAddress, userFillsData, spotSymbolMap]);

  // PART C: Synchronize tokenBalances with real spot clearinghouse state query
  useEffect(() => {
    if (!readOnlyHlAddress || !effectiveSpotClearinghouseState?.balances || !Array.isArray(effectiveSpotClearinghouseState.balances) || effectiveSpotClearinghouseState.balances.length === 0) {
      setTokenBalances({ USDC: 0 });
      return;
    }

    const balances: Record<string, number> = {
      USDC: 0,
    };

    for (const balance of effectiveSpotClearinghouseState.balances) {
      const rawTotal = Number(
        balance?.total ?? 0
      );

      const total =
        Number.isFinite(rawTotal)
          ? rawTotal
          : 0;

      let symbol = '';

      const rawCoin =
        String(balance?.coin ?? '').trim();

      if (rawCoin) {
        symbol = rawCoin.toUpperCase();
      } else if (
        balance?.token != null &&
        spotSymbolMap?.byToken?.[
          String(balance.token)
        ]
      ) {
        symbol =
          spotSymbolMap.byToken[
            String(balance.token)
          ];
      }

      if (!symbol) {
        continue;
      }

      balances[symbol] = total;
    }

    setTokenBalances(balances);
  }, [readOnlyHlAddress, effectiveSpotClearinghouseState, spotSymbolMap]);

  const spotAvailableBalances = useMemo<Record<string, number>>(() => {
    if (
      !readOnlyHlAddress ||
      !effectiveSpotClearinghouseState?.balances ||
      !Array.isArray(effectiveSpotClearinghouseState.balances) ||
      effectiveSpotClearinghouseState.balances.length === 0
    ) {
      return { USDC: 0 };
    }

    const available: Record<string, number> = {
      USDC: 0,
    };

    for (const balance of effectiveSpotClearinghouseState.balances) {
      const rawTotal = Number(balance?.total ?? 0);
      const rawHold = Number(balance?.hold ?? 0);
      const total = Number.isFinite(rawTotal) ? rawTotal : 0;
      const hold = Number.isFinite(rawHold) ? rawHold : 0;
      const avail = Math.max(0, total - hold);

      let symbol = '';
      const rawCoin = String(balance?.coin ?? '').trim();

      if (rawCoin) {
        symbol = rawCoin.toUpperCase();
      } else if (
        balance?.token != null &&
        spotSymbolMap?.byToken?.[String(balance.token)]
      ) {
        symbol = spotSymbolMap.byToken[String(balance.token)];
      }

      if (!symbol) {
        continue;
      }

      available[symbol] = avail;
    }

    return available;
  }, [readOnlyHlAddress, effectiveSpotClearinghouseState, spotSymbolMap]);

  const spotBalancesHydrated =
    !readOnlyHlAddress ||
    !!(
      liveSpotStream
        .isConnected &&
      liveSpotStream
        .spotState
    ) ||
    spotClearinghouseStateFetched;

  // Top Leaderboard Traders Seed data
  const leaderboardTraders: LeaderboardTrader[] = [];

  // Function to initialize or reload market registry safely
  const handleReloadMarkets = async () => {
  };

  // Redirect away from Profile in Anonymous mode
  useEffect(() => {
    if (mode === "ANONYMOUS" && activeTab === ActiveTab.Profile) {
      setActiveTab(ActiveTab.Perp);
    }
  }, [mode, activeTab]);

  // Load saved visual preferences on startup
  useEffect(() => {
    const savedTheme = localStorage.getItem("pref_theme_id") || "mono-dark";
    const savedSizeStr = localStorage.getItem("pref_font_size_percent");
    let savedSizeNum = 100;
    if (savedSizeStr) {
      savedSizeNum = parseInt(savedSizeStr);
    } else {
      // Backward compatibility mapping for old string layout options
      const oldSize = localStorage.getItem("pref_font_size");
      if (oldSize === "small") savedSizeNum = 85;
      else if (oldSize === "large") savedSizeNum = 115;
      else if (oldSize === "xlarge") savedSizeNum = 130;
    }
    const savedHeadersFont = localStorage.getItem("pref_headers_font") || "Inter";
    const savedNumbersFont = localStorage.getItem("pref_numbers_font") || "JetBrains Mono";
    const savedSlippage = localStorage.getItem("pref_slippage");
    if (savedSlippage) {
      setSlippageTolerance(parseFloat(savedSlippage));
    }

    // Set the state theme initially to match the stored theme
    const stateTheme = (savedTheme === "light" || savedTheme === "mono-light") ? "light" : "dark";
    setUserSettings(prev => ({ ...prev, theme: stateTheme }));

    applyPreferencesToDOM(savedTheme, savedSizeNum, savedHeadersFont, savedNumbersFont);
  }, []);

  // Sync theme changes with the DOM and localStorage
  useEffect(() => {
    const isLight = userSettings.theme === "light";
    const existingThemeId = localStorage.getItem("pref_theme_id") || "mono-dark";
    const existingIsLight = existingThemeId === "light" || existingThemeId === "mono-light";
    // Preserve the chosen exact profile when it belongs to the requested mode.
    // Only the navbar's explicit light/dark toggle changes the theme family.
    const targetThemeId = (isLight === existingIsLight)
      ? existingThemeId
      : (isLight ? "light" : "mono-dark");

    // Save actual values to localStorage
    localStorage.setItem("anon_theme", userSettings.theme);
    localStorage.setItem("pref_theme_id", targetThemeId);

    // Get current font sizes and custom fonts
    const savedSizeStr = localStorage.getItem("pref_font_size_percent");
    let savedSizeNum = 100;
    if (savedSizeStr) {
      savedSizeNum = parseInt(savedSizeStr);
    } else {
      const oldSize = localStorage.getItem("pref_font_size");
      if (oldSize === "small") savedSizeNum = 85;
      else if (oldSize === "large") savedSizeNum = 115;
      else if (oldSize === "xlarge") savedSizeNum = 130;
    }

    const savedHeadersFont = localStorage.getItem("pref_headers_font") || "Inter";
    const savedNumbersFont = localStorage.getItem("pref_numbers_font") || "JetBrains Mono";

    applyPreferencesToDOM(targetThemeId, savedSizeNum, savedHeadersFont, savedNumbersFont);
  }, [userSettings.theme]);

  // Settings theme cards emit this after saving their full profile ID.
  // Keep the navbar light/dark state in sync without overwriting mono themes.
  useEffect(() => {
    const syncProfile = () => {
      const themeId = localStorage.getItem("pref_theme_id") || "mono-dark";
      const next = (themeId === "light" || themeId === "mono-light") ? "light" : "dark";
      setUserSettings(prev => prev.theme === next ? prev : { ...prev, theme: next });
    };
    window.addEventListener("preferences-updated", syncProfile);
    return () => window.removeEventListener("preferences-updated", syncProfile);
  }, []);

  // Listen for custom notifications from modular components (e.g., ClosePositionModal)
  useEffect(() => {
    const handleCustomNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const { title, description, type } = customEvent.detail;
        addNotification(title, description, type || "info");
      }
    };
    window.addEventListener("trading-notification", handleCustomNotification);
    return () => {
      window.removeEventListener("trading-notification", handleCustomNotification);
    };
  }, []);

  // Real On-Chain Wallet Balance Fetching (ETH & USDC)
  const [realWalletUsdc, setRealWalletUsdc] = useState<number>(0);

  const refreshRealWalletUsdc =
  useCallback(async () => {
    if (
      !walletConnected ||
      !normalizedTradingAddress
    ) {
      setRealWalletUsdc(0);
      return;
    }

    const paddedAddress =
      normalizedTradingAddress
        .toLowerCase()
        .replace("0x", "")
        .padStart(64, "0");

    const callData =
      `0x70a08231${paddedAddress}`;

    /*
     * OLD TESTED SOURCE BEHAVIOR:
     * Public Arbitrum RPC first.
     *
     * This avoids Trust Wallet /
     * WalletConnect provider-specific
     * eth_call failures in in-app browsers.
     */
    const rpcUrls = [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.llamarpc.com",
    ];

    for (
      const rpcUrl of rpcUrls
    ) {
      try {
        const response =
          await fetch(
            rpcUrl,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
                  method: "eth_call",
                  params: [
                    {
                      to:
                        ARBITRUM_NATIVE_USDC,
                      data:
                        callData,
                    },
                    "latest",
                  ],
                }),
            }
          );

        if (!response.ok) {
          continue;
        }

        const result =
          await response.json();

        if (
          result?.result &&
          result.result !==
            "0x"
        ) {
          const raw =
            BigInt(
              result.result
            );

          const parsed =
            Number(
              formatUnits(
                raw,
                USDC_DECIMALS
              )
            );

          if (
            Number.isFinite(
              parsed
            )
          ) {
            setRealWalletUsdc(
              parsed
            );

            return;
          }
        }
      } catch {
        // Try next RPC.
      }
    }

    /*
     * Existing Reown provider remains
     * the fallback if public RPC reads fail.
     */
    try {
      const eip1193 =
        await getTradingSetupProvider();

      const provider =
        new BrowserProvider(
          eip1193 as any
        );

      const usdc =
        new Contract(
          ARBITRUM_NATIVE_USDC,
          DEPOSIT_ERC20_ABI,
          provider
        );

      const raw =
        await usdc.balanceOf(
          normalizedTradingAddress
        );

      const parsed =
        Number(
          formatUnits(
            raw,
            USDC_DECIMALS
          )
        );

      setRealWalletUsdc(
        Number.isFinite(
          parsed
        )
          ? parsed
          : 0
      );
    } catch {
      setRealWalletUsdc(0);
    }
  }, [
    walletConnected,
    normalizedTradingAddress,
    getTradingSetupProvider,
  ]);

  useEffect(() => {
    void refreshRealWalletUsdc();
  }, [
    refreshRealWalletUsdc,
    chainId,
  ]);

  const handleConnectWallet = async () => {
    if (pendingUserConnectRef.current || connectInFlightRef.current) return;
    pendingUserConnectRef.current = true;
    setWalletConnectPending(true);
    setWalletModalError(null);
    appKitModalSeenRef.current = false;
    setShowWalletModal(false);
    try {
      await open({
        view: "Connect",
        namespace: "eip155",
      });
    } catch (err: any) {
      pendingUserConnectRef.current = false;
      setWalletConnectPending(false);
      appKitModalSeenRef.current = false;
      setShowWalletModal(true);
      setWalletModalError(err?.message || "Failed to open wallet selector");
    }
  };

  const handleConnectPrivy = async () => {
    // Dormant in temporary Reown-only mode
    setWalletModalError("Privy login is temporarily disabled in Reown-only mode.");
  };

  const handleCloseWalletModal = useCallback(async () => {
    pendingUserConnectRef.current = false;
    connectInFlightRef.current = false;
    appKitModalSeenRef.current = false;
    setWalletConnectPending(false);
    setWalletModalError(null);
    setShowWalletModal(false);

    if (appKitConnected && !walletConnected) {
      await disconnect({
        namespace: "eip155",
      }).catch(() => {});
    }
  }, [appKitConnected, walletConnected, disconnect]);

  const handleDisconnectWallet = async () => {
    setWalletConnectPending(false);
    pendingUserConnectRef.current = false;
    connectInFlightRef.current = false;
    appKitModalSeenRef.current = false;

    // Disconnect must NOT ignore agent-clear failure
    await clearTradingSetupState();

    if (appKitConnected) {
      await disconnect({
        namespace: "eip155",
      }).catch(() => {
        // External wallet disconnect failure is intentionally ignored.
      });
    }

    // Explicit disconnect ends this tab's trading-resume intent.
    try {
      sessionStorage.removeItem("hidedex_active_trading_wallet");
      sessionStorage.removeItem("hidedex_workspace_opened");
      sessionStorage.removeItem("hidedex_last_public_trading_tab");
    } catch { /* optional UI hints */ }
    setRefreshTradingWallet("");
    setLaunchVerifiedWallet(null);
    setWalletConnected(false);
    setWalletAddress("");
    setWalletType(null);
    setActiveTab(publicWorkspaceOpened ? ActiveTab.Spot : ActiveTab.Landing);
    setTradingSetupComplete(false);
    setSetupRestoreCheckedAddress(null);
    setSetupVerifiedAddress(null);
    setTradingSetupRequested(false);
    setTradingSetupDismissed(false);
    setTradingSetupBusy(false);
    setWalletConnectPending(false);
    setShowWalletModal(false);

  };

  const handleSwitchNetwork = async (newId: number) => {
    const network =
      newId === 42161
        ? arbitrum
        : newId === 1
          ? mainnet
          : null;

    if (!network) return;

    await switchNetwork(network);
  };

  // Helper notification adder
  const addNotification = (title: string, description: string, type: "info" | "success" | "warning" | "error") => {
    const newNotif: NotificationItem = {
      id: Math.random().toString(),
      title,
      description,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setNotifications((prev) => [newNotif, ...prev]);
    void notifyBackgroundAccountEvent(title, description, type);
  };

  // Real Open-Order Cancel Handler
  const handleCancelOpenOrder = useCallback(async (id: string) => {
    const order = openOrders.find((o) => o.id === id);
    if (!order) {
      addNotification("Cancel Failed", "Order not found.", "error");
      return;
    }

    if (!order.sourceCoin || typeof order.oid !== "number") {
      addNotification("Cancel Failed", "Order missing valid source coin or order ID.", "error");
      return;
    }

    try {
      const { agentPrivateKey } = await ensureAgentKey();
      if (!agentPrivateKey) {
        throw new Error("No agent private key available");
      }

      await cancelOpenOrder({
        agentPrivateKey: agentPrivateKey as `0x${string}`,
        symbol: order.sourceCoin,
        oid: order.oid,
      });

      addNotification("Order Cancelled", `Order #${order.oid} for ${order.symbol} has been cancelled.`, "success");
      await refetchOpenOrders();
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "Failed to cancel order";
      addNotification("Cancel Failed", msg, "error");
    }
  }, [openOrders, refetchOpenOrders]);

  // Real Cancel All Open Orders Handler (Authoritative Primary Parity)
  const handleCancelAllOpenOrders = useCallback(async (): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      return;
    }

    try {
      const { agentPrivateKey } = await ensureAgentKey();
      if (!agentPrivateKey) {
        throw new Error("No agent private key available");
      }

      for (const order of openOrders) {
        const symbol = order.sourceCoin;
        const oid = order.oid;
        if (!symbol || typeof oid !== "number" || !Number.isFinite(oid)) {
          continue;
        }

        await cancelOpenOrder({
          agentPrivateKey: agentPrivateKey as `0x${string}`,
          symbol,
          oid,
        });
      }

      addNotification(
        "Cancelled all orders",
        "Cancelled all orders",
        "success"
      );
      await refetchOpenOrders();
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "Cancel all failed";
      addNotification("Cancel all failed", msg, "error");
    }
  }, [walletConnected, walletAddress, openOrders, refetchOpenOrders]);

  // Real Open-Order Modify Handler (Regular Limit + TP/SL Trigger Orders)
  const handleModifyOpenOrder = useCallback(async (id: string, newPrice: number, newSize: number) => {
    const order = openOrders.find((o) => o.id === id);
    if (!order) {
      const errorMsg = "Order not found.";
      addNotification("Modify Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    if (!order.sourceCoin || typeof order.oid !== "number") {
      const errorMsg = "Order missing valid source coin or order ID.";
      addNotification("Modify Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const rawOrder = Array.isArray(rawOpenOrders)
      ? rawOpenOrders.find((r: any) => Number(r?.oid ?? r?.order?.oid) === order.oid)
      : null;

    const triggerPx =
      typeof order.triggerPrice === "number"
        ? order.triggerPrice
        : (rawOrder?.triggerPx != null ? parseFloat(rawOrder.triggerPx) : NaN);

    const isTriggerFlag =
      order.isTrigger === true ||
      (rawOrder?.isTrigger ?? rawOrder?.order?.isTrigger) === true ||
      (
        Number.isFinite(triggerPx) &&
        triggerPx > 0
      );

    const isRegularLimit =
      order.type === "LIMIT" &&
      !isTriggerFlag;

    const isTriggerEligible =
      isTriggerFlag &&
      Number.isFinite(triggerPx) &&
      triggerPx > 0;

    const isModifiable =
      isRegularLimit ||
      isTriggerEligible;

    if (!isModifiable) {
      const errorMsg = "This order type cannot be modified.";
      addNotification("Modify Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const rawReduceOnly = !!(
      rawOrder?.order?.reduceOnly ??
      rawOrder?.order?.isReduce ??
      rawOrder?.order?.r ??
      rawOrder?.reduceOnly ??
      rawOrder?.isReduce ??
      rawOrder?.r ??
      order.reduceOnly
    );

    const rawCloid =
      rawOrder?.order?.cloid ??
      rawOrder?.order?.c ??
      rawOrder?.cloid ??
      rawOrder?.c ??
      order.cloid ??
      null;

    const orderTpsl =
      order.tpsl ||
      (rawOrder?.tpsl === "tp" || rawOrder?.tpsl === "sl" ? rawOrder.tpsl : undefined) ||
      (rawOrder?.order?.tpsl === "tp" || rawOrder?.order?.tpsl === "sl" ? rawOrder.order.tpsl : undefined);

    try {
      const { agentPrivateKey } = await ensureAgentKey();
      if (!agentPrivateKey) {
        throw new Error("No agent private key available");
      }

      await modifyOpenOrder({
        agentPrivateKey: agentPrivateKey as `0x${string}`,
        symbol: order.sourceCoin,
        oid: order.oid,
        side: order.side === "BUY" ? "buy" : "sell",
        sizeUnits: newSize,
        limitPx: newPrice,
        reduceOnly: rawReduceOnly,
        cloid: rawCloid,
        isTrigger: isTriggerFlag,
        tpsl: orderTpsl,
      });

      addNotification("Order Modified", `Order #${order.oid} for ${order.symbol} has been updated.`, "success");
      await refetchOpenOrders();
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "Failed to modify order";
      addNotification("Modify Failed", msg, "error");
      throw err;
    }
  }, [openOrders, rawOpenOrders, refetchOpenOrders]);

  // Real Perpetual Market Close Position Handler
  const handleClosePerpPosition = useCallback(async (
    position: Position,
    closePercent: number
  ): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      const errorMsg = "Wallet not connected. Please connect your wallet to close positions.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    if (
      typeof closePercent !== "number" ||
      !Number.isFinite(closePercent) ||
      closePercent <= 0 ||
      closePercent > 100
    ) {
      const errorMsg = "Invalid close percentage specified. Close aborted for safety.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const perpSymbol = position.sourceCoin;
    if (!perpSymbol) {
      const errorMsg = "Position missing valid source coin.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const perpSzi = position.rawSzi;
    if (!perpSzi || perpSzi === "0") {
      const errorMsg = "Position has invalid size.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const rawSziNum = Number(position.rawSzi);
    if (!Number.isFinite(rawSziNum) || rawSziNum === 0) {
      const errorMsg = "Position has invalid size.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const safeClosePercent = Math.min(
      100,
      Math.max(1, closePercent)
    );

    const closeSziNum =
      rawSziNum * (safeClosePercent / 100);

    if (!Number.isFinite(closeSziNum) || closeSziNum === 0) {
      const errorMsg = "Calculated close size is invalid.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const agentKey = await ensureAgentKey();
    if (!agentKey?.agentPrivateKey) {
      const errorMsg = "No agent private key available. Please complete trading setup.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    // Retry logic: max 2 attempts, wait 6000ms if isRateLimitError
    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await marketClosePosition({
          agentPrivateKey: agentKey.agentPrivateKey,
          symbol: perpSymbol,
          szi: String(closeSziNum),
          oraclePx: undefined,
        });

        // Real post-processing
        await handlePerpOrderSuccess();
        if (safeClosePercent >= 100) {
          addNotification("Position Closed", `Closed ${position.symbol} position`, "success");
        } else {
          addNotification("Position Reduced", `Closed ${safeClosePercent}% of ${position.symbol} position`, "success");
        }
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt === 1 && isRateLimitError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          continue;
        }
        break;
      }
    }

    const msg = lastError?.message ? String(lastError.message) : "Failed to close position";
    addNotification("Close Position Failed", msg, "error");
    throw new Error(msg);
  }, [walletConnected, walletAddress, handlePerpOrderSuccess]);

  // Real Perpetual Market Close All Positions Handler
  const handleCloseAllPerpPositions = useCallback(async (): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      const errorMsg = "Wallet not connected. Please connect your wallet to close positions.";
      addNotification("Close All Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const validTargets = positions.filter((p) => {
      if (!p.sourceCoin || !p.rawSzi) return false;
      const sziNum = parseFloat(p.rawSzi);
      return Number.isFinite(sziNum) && sziNum !== 0;
    });

    if (validTargets.length === 0) {
      return;
    }

    const agentKey = await ensureAgentKey();
    if (!agentKey?.agentPrivateKey) {
      const errorMsg = "No agent private key available. Please complete trading setup.";
      addNotification("Close All Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    let failureCount = 0;

    for (let i = 0; i < validTargets.length; i++) {
      const target = validTargets[i];

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await marketClosePosition({
            agentPrivateKey: agentKey.agentPrivateKey,
            symbol: target.sourceCoin,
            szi: target.rawSzi,
            oraclePx: undefined,
          });
          break;
        } catch (err: any) {
          const tag = attempt === 2 ? "final" : "retrying";
          console.warn(`[CloseAll] Failed to close ${target.sourceCoin} (${tag}): ${err?.message ?? err}`);

          if (attempt === 2) {
            failureCount++;
            break;
          }

          const wasRateLimited = isRateLimitError(err);
          await new Promise((resolve) => setTimeout(resolve, wasRateLimited ? 6000 : 350));
        }
      }
    }

    await handlePerpOrderSuccess();

    if (failureCount === 0) {
      addNotification("Positions Closed", "All perpetual positions closed", "success");
    } else if (failureCount < validTargets.length) {
      addNotification("Positions Partially Closed", `Closed ${validTargets.length - failureCount} of ${validTargets.length} positions`, "warning");
    } else {
      addNotification("Close All Failed", "Failed to close positions", "error");
    }
  }, [walletConnected, walletAddress, positions, handlePerpOrderSuccess]);

  // Helper for deriving eligible real spot close targets (authoritative primary-source backed)
  const getEligibleSpotCloseTargets = useCallback((isCloseAll: boolean = true): Array<{
    base: string;
    symbol: string;
    sizeUnits: string;
    referencePx?: number;
  }> => {
    if (
      !effectiveSpotClearinghouseState?.balances ||
      !Array.isArray(effectiveSpotClearinghouseState.balances) ||
      !spotSymbolMap
    ) {
      return [];
    }

    const targets: Array<{
      base: string;
      symbol: string;
      sizeUnits: string;
      referencePx?: number;
    }> = [];

    const SPOT_DUST_USD = 1;

    for (const balance of effectiveSpotClearinghouseState.balances) {
      let base = String(balance?.coin ?? '').trim().toUpperCase();
      if (!base && balance?.token != null && spotSymbolMap?.byToken?.[String(balance.token)]) {
        base = String(spotSymbolMap.byToken[String(balance.token)]).trim().toUpperCase();
      }

      if (!base || base === 'USDC') {
        continue;
      }

      const rawTotal = Number(balance?.total ?? 0);
      const rawHold = Number(balance?.hold ?? 0);
      const total = Number.isFinite(rawTotal) ? rawTotal : 0;
      const hold = Number.isFinite(rawHold) ? rawHold : 0;
      const available = Math.max(0, total - hold);

      if (available <= 0) {
        continue;
      }

      const spotSymbol = spotSymbolMap?.byBase?.[base];
      if (!spotSymbol) {
        continue;
      }

      const szDecimals =
        spotSymbolMap?.szDecimalsBySymbol?.[spotSymbol] ??
        spotSymbolMap?.szDecimalsByBase?.[base];

      if (typeof szDecimals === 'number' && Number.isFinite(szDecimals)) {
        const minLot = Math.pow(10, -szDecimals);
        if (Number.isFinite(minLot) && minLot > 0 && available < minLot) {
          continue;
        }
      }

      const markPrice =
        spotSymbolMap?.markPxBySymbol?.[spotSymbol] ??
        spotSymbolMap?.markPxByBase?.[base];

      if (isCloseAll && typeof markPrice === 'number' && Number.isFinite(markPrice) && markPrice > 0) {
        const valueUsd = available * markPrice;
        if (valueUsd < SPOT_DUST_USD) {
          continue;
        }
      }

      targets.push({
        base,
        symbol: spotSymbol,
        sizeUnits: String(available),
        referencePx: typeof markPrice === 'number' && Number.isFinite(markPrice) && markPrice > 0 ? markPrice : undefined,
      });
    }

    return targets;
  }, [effectiveSpotClearinghouseState, spotSymbolMap]);

  // Real Spot Market Close Single Position Handler
  const handleCloseSpotPosition = useCallback(async (baseSymbol: string): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      const errorMsg = "Wallet not connected. Please connect your wallet to close positions.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const eligibleTargets = getEligibleSpotCloseTargets(false);
    const target = eligibleTargets.find(
      (t) => t.base.toUpperCase() === String(baseSymbol ?? '').trim().toUpperCase()
    );

    if (!target) {
      const errorMsg = "No sellable spot balance available.";
      addNotification("Close Failed", errorMsg, "error");
      return;
    }

    const agentKey = await ensureAgentKey();
    if (!agentKey?.agentPrivateKey) {
      const errorMsg = "No agent private key available. Please complete trading setup.";
      addNotification("Close Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await marketCloseSpotPosition({
          agentPrivateKey: agentKey.agentPrivateKey,
          symbol: target.symbol,
          sizeUnits: target.sizeUnits,
          referencePx: target.referencePx,
        });

        await handleSpotOrderSuccess();
        addNotification("Spot Position Closed", `Closed ${target.base} spot position`, "success");
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt === 1 && isRateLimitError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          continue;
        }
        break;
      }
    }

    const msg = lastError?.message ? String(lastError.message) : "Failed to close spot position";
    addNotification("Close Spot Failed", msg, "error");
    throw new Error(msg);
  }, [walletConnected, walletAddress, getEligibleSpotCloseTargets, handleSpotOrderSuccess]);

  // Real Spot Market Close All Positions Handler
  const handleCloseAllSpotPositions = useCallback(async (): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      const errorMsg = "Wallet not connected. Please connect your wallet to close positions.";
      addNotification("Close All Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    const eligibleTargets = getEligibleSpotCloseTargets();
    if (eligibleTargets.length === 0) {
      addNotification("Close All Spot", "No sellable spot balances.", "info");
      return;
    }

    const agentKey = await ensureAgentKey();
    if (!agentKey?.agentPrivateKey) {
      const errorMsg = "No agent private key available. Please complete trading setup.";
      addNotification("Close All Failed", errorMsg, "error");
      throw new Error(errorMsg);
    }

    let successCount = 0;
    let failureCount = 0;

    for (const target of eligibleTargets) {
      try {
        await marketCloseSpotPosition({
          agentPrivateKey: agentKey.agentPrivateKey,
          symbol: target.symbol,
          sizeUnits: target.sizeUnits,
          referencePx: target.referencePx,
        });
        successCount++;
      } catch (err: any) {
        failureCount++;
        console.warn(`[CloseAllSpot] Failed to close ${target.symbol}: ${err?.message ?? err}`);
      }
    }

    await handleSpotOrderSuccess();

    if (failureCount === 0) {
      addNotification("Spot Positions Closed", "All eligible spot positions closed", "success");
    } else if (successCount > 0) {
      addNotification("Spot Positions Partially Closed", `Closed ${successCount} of ${eligibleTargets.length} spot positions`, "warning");
    } else {
      addNotification("Close All Spot Failed", "Failed to close spot positions", "error");
    }
  }, [walletConnected, walletAddress, getEligibleSpotCloseTargets, handleSpotOrderSuccess]);

  // Real Perpetual Position TP/SL Trigger Handler
  const handleSavePositionTpSl = useCallback(
    async (
      position: Position,
      tpPrice: number | null,
      slPrice: number | null
    ): Promise<void> => {
      if (!position?.sourceCoin) {
        const errorMsg = "Position missing valid source coin.";
        addNotification("TP/SL Failed", errorMsg, "error");
        throw new Error(errorMsg);
      }
      if (!position.size || position.size <= 0) {
        const errorMsg = "Position has invalid size.";
        addNotification("TP/SL Failed", errorMsg, "error");
        throw new Error(errorMsg);
      }
      if (!Number.isFinite(position.markPrice) || position.markPrice <= 0) {
        const errorMsg = "Position has invalid mark price.";
        addNotification("TP/SL Failed", errorMsg, "error");
        throw new Error(errorMsg);
      }

      const hasTp = typeof tpPrice === "number" && Number.isFinite(tpPrice) && tpPrice > 0;
      const hasSl = typeof slPrice === "number" && Number.isFinite(slPrice) && slPrice > 0;

      if (!hasTp && !hasSl) {
        const errorMsg = "Enter TP and/or SL trigger price";
        addNotification("TP/SL Failed", errorMsg, "error");
        throw new Error(errorMsg);
      }

      const { agentPrivateKey } = await ensureAgentKey();
      if (!agentPrivateKey) {
        const errorMsg = "No agent private key available. Please complete trading setup.";
        addNotification("TP/SL Failed", errorMsg, "error");
        throw new Error(errorMsg);
      }

      if (Array.isArray(rawOpenOrders)) {
        const existingTriggers = rawOpenOrders
          .map((item: any) => {
            const raw = item;
            const o = raw?.order ?? raw?.o ?? raw;
            const rawCoin = String(o?.coin ?? raw?.coin ?? "");
            const rawDex = typeof (raw?._dex ?? o?._dex) === "string" ? String(raw?._dex ?? o?._dex).trim() : "";
            let canonicalCoin = rawCoin;
            if (rawDex && rawCoin && !rawCoin.includes(":") && !rawCoin.startsWith("@")) {
              canonicalCoin = `${rawDex}:${rawCoin}`;
            }
            const rawTpsl =
              o?.tpsl ??
              o?.trigger?.tpsl ??
              o?.t?.trigger?.tpsl ??
              o?.orderType?.trigger?.tpsl ??
              raw?.tpsl ??
              raw?.trigger?.tpsl ??
              raw?.t?.trigger?.tpsl ??
              raw?.orderType?.trigger?.tpsl ??
              raw?.order?.tpsl ??
              raw?.order?.trigger?.tpsl ??
              raw?.order?.t?.trigger?.tpsl ??
              raw?.order?.orderType?.trigger?.tpsl;
            const oid = o?.oid ?? raw?.oid;
            const rawTriggerPx =
              o?.triggerPx ??
              o?.trigger?.triggerPx ??
              o?.t?.trigger?.triggerPx ??
              o?.orderType?.trigger?.triggerPx ??
              raw?.triggerPx ??
              raw?.trigger?.triggerPx ??
              raw?.t?.trigger?.triggerPx ??
              raw?.orderType?.trigger?.triggerPx ??
              raw?.order?.triggerPx ??
              raw?.order?.trigger?.triggerPx ??
              raw?.order?.t?.trigger?.triggerPx ??
              raw?.order?.orderType?.trigger?.triggerPx;
            const triggerPx = Number(rawTriggerPx ?? 0);
            const isPositionTpsl =
              (o?.isPositionTpsl ?? raw?.isPositionTpsl ?? raw?.order?.isPositionTpsl) === true;
            const orderTypeRaw = o?.orderType ?? raw?.orderType ?? raw?.order?.orderType;
            const orderTypeLabel =
              typeof orderTypeRaw === "string" ? orderTypeRaw.trim().toLowerCase() : "";

            let finalTpsl: "tp" | "sl" | undefined = undefined;
            if (rawTpsl === "tp" || rawTpsl === "sl") {
              finalTpsl = rawTpsl;
            } else if (isPositionTpsl) {
              if (orderTypeLabel.includes("take profit")) {
                finalTpsl = "tp";
              } else if (orderTypeLabel.includes("stop")) {
                finalTpsl = "sl";
              }
            }

            return {
              coin: canonicalCoin,
              rawCoin,
              oid,
              triggerPx,
              tpsl: finalTpsl,
            };
          })
          .filter(
            (o: any) =>
              String(o.coin).trim().toUpperCase() === String(position.sourceCoin).trim().toUpperCase() &&
              (o.tpsl === "tp" || o.tpsl === "sl") &&
              o.oid != null
          );

        if (hasTp) {
          const oldTps = existingTriggers.filter((o: any) => o.tpsl === "tp");
          for (const oldTp of oldTps) {
            try {
              await cancelOpenOrder({
                agentPrivateKey: agentPrivateKey as `0x${string}`,
                symbol: oldTp.coin,
                oid: Number(oldTp.oid),
              });
            } catch {
              // tolerate stale-oid cancellation failure during replacement step
            }
          }
        }

        if (hasSl) {
          const oldSls = existingTriggers.filter((o: any) => o.tpsl === "sl");
          for (const oldSl of oldSls) {
            try {
              await cancelOpenOrder({
                agentPrivateKey: agentPrivateKey as `0x${string}`,
                symbol: oldSl.coin,
                oid: Number(oldSl.oid),
              });
            } catch {
              // tolerate stale-oid cancellation failure during replacement step
            }
          }
        }
      }

      const sizeUsd = position.size * position.markPrice;
      const entrySide: "long" | "short" = position.type === "LONG" ? "long" : "short";

      if (hasTp && tpPrice) {
        await placeReduceOnlyTpslTrigger({
          agentPrivateKey: agentPrivateKey as `0x${string}`,
          symbol: position.sourceCoin,
          entrySide,
          sizeUsd,
          oraclePx: position.markPrice,
          triggerPx: tpPrice,
          tpsl: "tp",
        });
      }

      if (hasSl && slPrice) {
        await placeReduceOnlyTpslTrigger({
          agentPrivateKey: agentPrivateKey as `0x${string}`,
          symbol: position.sourceCoin,
          entrySide,
          sizeUsd,
          oraclePx: position.markPrice,
          triggerPx: slPrice,
          tpsl: "sl",
        });
      }

      await refetchOpenOrders();
      addNotification("TP/SL Placed", `Updated TP/SL triggers for ${position.symbol}-PERP`, "success");
    },
    [rawOpenOrders, refetchOpenOrders]
  );

  const portfolioTradingStateReady =
    !readOnlyHlAddress
      ? false
      : hyperliquidTradingStateReady;

  const portfolioAccountModeKnown =
    portfolioTradingStateReady &&
    hyperliquidTradingState?.accountAbstractionMode != null;

  const portfolioIsPooledAccount = isPooledAccountMode(
    hyperliquidTradingState?.accountAbstractionMode
  );

  const portfolioAccountStateError = hyperliquidTradingStateError
    ? (hyperliquidTradingStateErrorObject as any)?.message || "Hyperliquid account data failed to load."
    : null;
  const portfolioWithdrawableUsd =
    portfolioTradingStateReady
      ? Math.max(
          0,
          Number(
            hyperliquidTradingState
              ?.withdrawableUsd ??
              0
          )
        )
      : 0;
  const portfolioSpotAvailableUsdc = spotBalancesHydrated
    ? Math.max(0, Number(spotAvailableBalances["USDC"] ?? 0))
    : 0;
  const rawMainPerpTransferAvailable =
    hyperliquidTradingState
      ?.perpWithdrawableByDex
      ?.[
        ""
      ];
  const portfolioMainPerpTransferAvailableUsd =
    portfolioTradingStateReady &&
    Number.isFinite(
      Number(
        rawMainPerpTransferAvailable
      )
    )
      ? Math.max(
          0,
          Number(
            rawMainPerpTransferAvailable
          )
        )
      : 0;

  const handlePortfolioDeposit =
    async (amount: number) => {
      if (
        !walletConnected ||
        !normalizedTradingAddress
      ) {
        throw new Error(
          "Active wallet not connected"
        );
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "Invalid deposit amount"
        );
      }

      if (amount < 6) {
        throw new Error(
          "Minimum deposit amount is 6 USDC."
        );
      }

      /*
       * Current website already has this existing
       * Reown chain-alignment function.
       */
      await ensureTradingSigningChain();

      /*
       * Get a fresh wallet provider AFTER
       * the network switch attempt.
       */
      const eip1193 =
        await getTradingSetupProvider();

      const chainIdHex =
        await eip1193.request({
          method: "eth_chainId",
        });

      const chainId =
        typeof chainIdHex === "string"
          ? parseInt(chainIdHex, 16)
          : Number(chainIdHex);

      /*
       * Deposit is a direct ERC20 transaction.
       * Never execute on a different chain.
       */
      if (
        chainId !==
        ARBITRUM_CHAIN_ID
      ) {
        throw new Error(
          "Please switch your wallet network to Arbitrum One (Chain ID 42161) to deposit."
        );
      }

      const provider =
        new BrowserProvider(
          eip1193 as any
        );

      const signer =
        await provider.getSigner();

      const signerAddress =
        getAddress(
          await signer.getAddress()
        );

      const activeAddress =
        getAddress(
          normalizedTradingAddress
        );

      if (
        signerAddress !==
        activeAddress
      ) {
        throw new Error(
          "Connected wallet signer does not match the active wallet."
        );
      }

      const amountUnits =
        parseUnits(
          amount.toString(),
          USDC_DECIMALS
        );

      const usdc =
        new Contract(
          ARBITRUM_NATIVE_USDC,
          DEPOSIT_ERC20_ABI,
          signer
        );

      /*
       * EXACT old tested deposit action:
       *
       * Native USDC.transfer(
       *   Hyperliquid Bridge2,
       *   amount
       * )
       */
      const tx =
        await usdc.transfer(
          HYPERLIQUID_BRIDGE2,
          amountUnits
        );

      let receipt:
        Awaited<
          ReturnType<
            JsonRpcProvider["waitForTransaction"]
          >
        > = null;

      let receiptWaitError:
        unknown = null;

      const receiptRpcUrls = [
        "https://arb1.arbitrum.io/rpc",
        "https://arbitrum.llamarpc.com",
      ];

      for (
        const rpcUrl of receiptRpcUrls
      ) {
        const receiptProvider =
          new JsonRpcProvider(
            rpcUrl,
            ARBITRUM_CHAIN_ID
          );

        try {
          receipt =
            await receiptProvider
              .waitForTransaction(
                tx.hash,
                1,
                90000
              );

          if (receipt) {
            break;
          }
        } catch (error) {
          receiptWaitError =
            error;
        } finally {
          receiptProvider.destroy();
        }
      }

      if (!receipt) {
        if (
          receiptWaitError
          instanceof Error
        ) {
          throw receiptWaitError;
        }

        throw new Error(
          "Deposit transaction was sent, but confirmation could not be verified. Please check the transaction in your wallet before trying again."
        );
      }

      if (
        !receipt ||
        receipt.status !== 1
      ) {
        throw new Error(
          "Deposit transaction failed on Arbitrum."
        );
      }

      /*
       * Refresh REAL state only.
       * Never fake Hyperliquid credit.
       */
      await Promise.allSettled([
        refreshRealWalletUsdc(),
        refetchHyperliquidTradingState(),
        refetchDepositWithdrawHistory(),
      ]);
    };

  const handlePortfolioWithdraw = async (amountUsd: string) => {
    if (!walletConnected || !normalizedTradingAddress) {
      throw new Error("Active wallet not connected");
    }

    const rawAmount = amountUsd.trim();
    const parsed = Number(rawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Invalid withdrawal amount");
    }
    if (parsed > portfolioWithdrawableUsd + 0.01) {
      throw new Error(`Amount exceeds withdrawable balance of ${portfolioWithdrawableUsd.toFixed(2)} USDC`);
    }

    const provider = await getTradingSetupProvider();
    if (!provider) {
      throw new Error("EIP-1193 wallet provider not found. Please reconnect your wallet.");
    }

    await ensureTradingSigningChain();

    await withdrawFromHyperliquid({
      userWalletProvider: provider,
      userAddress: normalizedTradingAddress,
      destination: normalizedTradingAddress,
      amountUsd: rawAmount,
    });

    await Promise.allSettled([
      refetchHyperliquidTradingState(),
      refetchDepositWithdrawHistory(),
    ]);

    addNotification(
      "Withdrawal Submitted",
      "Withdrawal submitted to your connected wallet.",
      "success"
    );
  };

  const handlePortfolioSpotPerpTransfer = async (args: {
    amountUsd: string;
    toPerp: boolean;
  }) => {
    if (!walletConnected || !normalizedTradingAddress) {
      throw new Error("Active wallet not connected");
    }

    const amount = Number(args.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid transfer amount");
    }
    if (amount < 1) {
      throw new Error("Minimum transfer amount is 1 USDC");
    }
    if (portfolioIsPooledAccount) {
      throw new Error("Unified balances do not need spot/perp transfers.");
    }

    const available = args.toPerp
      ? portfolioSpotAvailableUsdc
      : portfolioMainPerpTransferAvailableUsd;

    if (amount > available + 1e-9) {
      throw new Error(
        `Amount exceeds available ${args.toPerp ? "Spot" : "Perpetual"} balance of ${available.toFixed(2)} USDC`
      );
    }

    const provider = await getTradingSetupProvider();
    if (!provider) {
      throw new Error("EIP-1193 wallet provider not found. Please reconnect your wallet.");
    }

    await transferUsdBetweenSpotAndPerp({
      userWalletProvider: provider,
      userAddress: normalizedTradingAddress,
      amountUsd: amount.toFixed(2),
      toPerp: args.toPerp,
    });

    await Promise.allSettled([
      refetchHyperliquidTradingState(),
      refetchSpotClearinghouseState(),
    ]);

    addNotification(
      "Transfer Submitted",
      "Spot / Perp transfer submitted successfully.",
      "success"
    );
  };

  const handleSelectTokenFromScreener = (symbol: string, mode: "spot" | "perp") => {
    setSelectedSymbol(symbol);
    setActiveTab(mode === "perp" ? ActiveTab.Perp : ActiveTab.Spot);
  };

  const openPointsHub = async () => {
    if (pointsChecking) return;
    const wallet = walletAddress.trim().toLowerCase();
    if (!walletConnected || !/^0x[0-9a-f]{40}$/.test(wallet)) {
      setPointsNotice("Connect your wallet and join Early Access to open Points Hub.");
      return;
    }
    setPointsChecking(true);
    try {
      const response = await fetch(HIDEDEX_EARLY_ACCESS_API, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"access",wallet}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.wallet !== wallet ||
          !["none","pending","granted"].includes(data.access_status)) {
        setPointsNotice("Could not verify Early Access approval. Please try again.");
        return;
      }
      if (!walletConnected || walletAddress.trim().toLowerCase() !== wallet) return;
      setConnectedAccess({wallet,status:data.access_status,checkedAt:Date.now()});
      setAccessLookupState("ready");
      if (data.access_status !== "granted") {
        setPointsNotice("Points Hub is for approved Early Access wallets. Join Early Access to unlock.");
        return;
      }
      setPointsNotice("");
      setPublicWorkspaceOpened(true);
      setActiveTab(ActiveTab.Points);
    } catch {
      setPointsNotice("Connection failed. Please try again to check Early Access.");
    } finally {
      setPointsChecking(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-brand-bg text-gray-100 flex flex-col justify-between selection:bg-[#F5D061]/20">
      {pointsNotice && (
        <div role="status" aria-live="polite"
          className="fixed z-[310] top-[72px] left-3 right-3 sm:left-auto sm:right-5 sm:max-w-sm rounded-xl border border-brand-border bg-brand-surface px-4 py-3 shadow-xl text-brand-text text-xs font-semibold flex items-start gap-3">
          <span className="flex-1">{pointsNotice}</span>
          <button type="button" onClick={() => setPointsNotice("")}
            aria-label="Dismiss notice" className="text-brand-muted hover:text-brand-text">✕</button>
        </div>
      )}
      {/* Header bar navigation (Hidden on Public Landing) */}
      {!isPublicLanding && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedExchange={selectedExchange}
          onSelectExchange={(venue) => {
            // Exchange switch never executes any order, transfer, setup signature or funding action.
            setSelectedExchange(venue);
            if (activeTab !== ActiveTab.Markets && activeTab !== ActiveTab.Spot &&
                activeTab !== ActiveTab.Perp && activeTab !== ActiveTab.Portfolio &&
                activeTab !== ActiveTab.Profile && activeTab !== ActiveTab.Dashboard) {
              setActiveTab(ActiveTab.Perp);
            }
          }}
          walletConnected={walletConnected}
          walletAddress={walletAddress}
          walletType={walletType}
          balanceUSDC={realAccountValueUsd}
          onConnectWallet={() => setShowWalletModal(true)}
          onDisconnectWallet={handleDisconnectWallet}
          topTokens={tokens.slice(0, 4)}
          onOpenSettings={() => setActiveTab(ActiveTab.Profile)}
          onRequestPoints={() => { void openPointsHub(); }}
          onOpenPrivacyMode={() => setShowTrustShieldPopup(true)}
          notificationsCount={notifications.length}
          onOpenNotifications={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
          chainId={chainId}
          onSwitchNetwork={handleSwitchNetwork}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          isSidebarOpen={mobileSidebarOpen}
          showWalletModal={showWalletModal}
          setShowWalletModal={setShowWalletModal}
          userSettings={userSettings}
          onUpdateSettings={(s) => setUserSettings((prev) => ({ ...prev, ...s }))}
        />
      )}

      {/* Global notifications overlay box dropdown (Hidden on Public Landing) */}
      {!isPublicLanding && showNotificationsDropdown && (
        <div className="relative max-w-7xl mx-auto w-full px-4 sm:px-6">
          <div className="absolute right-4 top-1 w-80 rounded-2xl glass-panel p-4 border border-brand-border shadow-2xl z-40 max-h-[400px] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-brand-border pb-2 mb-3">
              <span className="text-xs font-bold text-brand-text uppercase tracking-wider">HideDex Logs</span>
              <button 
                onClick={() => setNotifications([])}
                className="text-[10px] text-gray-500 hover:text-brand-text"
              >
                Clear all
              </button>
            </div>
            
            <BrowserAlertsControl />
            {notifications.length === 0 ? (
              <p className="text-[11px] text-gray-500 py-6 text-center">No active notifications</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="text-xs space-y-0.5 bg-brand-surface/60 p-2.5 rounded-xl border border-brand-border">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-brand-text">{n.title}</span>
                      <span className="text-[9px] text-gray-500">{n.timestamp}</span>
                    </div>
                    <p className="text-gray-400 text-[10px] leading-relaxed">{n.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Main Layout Area */}
      <div className={`flex-grow flex flex-col ${!isPublicLanding ? "md:flex-row" : ""} w-full overflow-hidden`}>
        {/* Left Sidebar Navigation (Hidden on Public Landing) */}
        {!isPublicLanding && (
          <LeftSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenSettings={() => setActiveTab(ActiveTab.Profile)}
            onRequestPoints={() => { void openPointsHub(); }}
            onRequestEarlyAccess={() => {
              setEarlyAccessRequestedFromPerp(false);
              setActiveTab(ActiveTab.EarlyAccess);
            }}
            walletAddress={walletAddress}
            balanceUSDC={realAccountValueUsd}
            selectedExchange={selectedExchange}
            onDisconnectWallet={handleDisconnectWallet}
            isMobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            watchlist={selectedExchange === "lighter" ? lighterWatchlist : selectedExchange === "aster" ? [] : watchlist}
            onToggleWatchlist={selectedExchange === "lighter" ? toggleLighterFavorite : selectedExchange === "aster" ? ()=>{} : handleToggleWatchlist}
            onSelectToken={(symbol) => {
              if(selectedExchange==="hyperliquid")setSelectedSymbol(symbol);
              else if(selectedExchange==="lighter"&&lighterSidebarTokens.some(t=>t.symbol===symbol))
                setLighterMarketRequest(prev=>({symbol,nonce:(prev?.nonce??0)+1}));
            }}
            tokens={selectedExchange === "lighter" ? lighterSidebarTokens : selectedExchange === "aster" ? [] : tokens}
          />
        )}


        {/* Main Panel content viewport */}
        <main ref={mainContentRef} className={`flex-grow w-full overflow-y-auto ${isPublicLanding ? "p-0 pb-0" : "p-1.5 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-16"} bg-brand-bg`}>
          
          {/* LANDING / HOME DASHBOARD PAGE */}
          {activeTab === ActiveTab.Landing && resumingTradingSession && (
            <div className="min-h-[85dvh] w-full bg-brand-bg" role="status" aria-label="Checking saved wallet session">
              <div className="h-[2px] w-full bg-brand-border/30 overflow-hidden">
                <div className="h-full w-1/3 bg-brand-primary animate-pulse" />
              </div>
            </div>
          )}
          {(activeTab === ActiveTab.EarlyAccess || (activeTab === ActiveTab.Landing && !resumingTradingSession)) && (
            <LandingPage
              tokens={tokens}
              setActiveTab={setActiveTab}
              walletConnected={walletConnected}
              onConnectWallet={() => setShowWalletModal(true)}
              onSignEarlyAccessMessage={async (message: string): Promise<string> => {
                const ethereumProvider = await getTradingSetupProvider();
                const provider = new BrowserProvider(ethereumProvider as any);
                const signer = await provider.getSigner();
                if (getAddress(await signer.getAddress()) !== getAddress(walletAddress)) {
                  throw new Error("Active wallet does not match signing wallet.");
                }
                return signer.signMessage(message);
              }}
              onDisconnectWallet={handleDisconnectWallet}
              walletAddress={walletAddress}
              showEarlyAccessOnMount={earlyAccessRequestedFromPerp}
              embeddedEarlyAccessPage={activeTab === ActiveTab.EarlyAccess}
              onCloseEarlyAccessPage={() => setActiveTab(ActiveTab.Markets)}
              onClosePerpEarlyAccess={() => {
                setEarlyAccessRequestedFromPerp(false);
                setActiveTab(ActiveTab.Markets);
              }}
              onVerifyLaunchApp={async (wallet: string): Promise<void> => {
                // Start Trading opens public Spot; this NEVER grants Perpetual.
                const currentWallet = walletAddress.trim().toLowerCase();
                if (walletConnected && wallet &&
                    wallet.trim().toLowerCase() !== currentWallet) {
                  throw new Error("Connected wallet mismatch. Please reconnect.");
                }
                // First visit opens Markets with its real chart. Returning
                // visitors keep a safe saved screen; Perpetual still requires
                // a fresh server grant.
                let entryTab = ActiveTab.Markets;
                try {
                  const walletIsValid = walletConnected && /^0x[0-9a-f]{40}$/.test(currentWallet);
                  const previous = walletIsValid
                    ? localStorage.getItem("hidedex_last_trading_tab_" + currentWallet)
                    : sessionStorage.getItem("hidedex_last_public_trading_tab");
                  if (previous && previous !== ActiveTab.Landing &&
                      Object.values(ActiveTab).includes(previous as ActiveTab)) {
                    const next = previous as ActiveTab;
                    if (next !== ActiveTab.Perp ||
                        (hasPerpApproval && connectedAccess?.wallet === currentWallet &&
                         Date.now() - connectedAccess.checkedAt < 60_000)) {
                      entryTab = next;
                    }
                  }
                } catch { /* Default to Markets when storage is blocked. */ }
                setPublicWorkspaceOpened(true);
                try { sessionStorage.setItem("hidedex_workspace_opened", "1"); } catch {}
                setEarlyAccessRequestedFromPerp(false);
                setActiveTab(entryTab);
                if (walletConnected && /^0x[0-9a-f]{40}$/.test(currentWallet)) {
                  try {
                    localStorage.setItem("hidedex_last_trading_wallet", currentWallet);
                    if (entryTab === ActiveTab.Markets) {
                      // Preserve any existing user's last chosen screen.
                      const key = "hidedex_last_trading_tab_" + currentWallet;
                      if (!localStorage.getItem(key)) localStorage.setItem(key, entryTab);
                    }
                    sessionStorage.setItem("hidedex_active_trading_wallet", currentWallet);
                  } catch { /* UX restore hints are optional; never permission. */ }
                  setLastTradingWallet(currentWallet);
                  setLaunchVerifiedWallet(currentWallet);
                }
              }}
              accountValueUsd={realAccountValueUsd}
              withdrawableUsd={realWithdrawableUsd}
              setSubLegalTab={setSelectedSubLegalTab}
              onSelectToken={(sym) => setSelectedSymbol(sym)}
            />
          )}

          {/* GENERAL DASHBOARD PAGE */}
          {selectedExchange === "hyperliquid" && activeTab === ActiveTab.Dashboard && (
            walletConnected ? (
              <GeneralDashboard
                tokens={tokens}
                balanceUSDC={realAccountValueUsd}
                walletAddress={walletAddress}
                positionsCount={positions.length}
                onSelectToken={handleSelectTokenFromScreener}
                setActiveTab={setActiveTab}
              />
            ) : (
              <ConnectionRequired tabName="Dashboard" onConnect={() => setShowWalletModal(true)} />
            )
          )}

          {/* MARKETS TABLE SCREEN */}
          {activeTab === ActiveTab.Markets && selectedExchange === "hyperliquid" && (
            <MarketsPanel 
              tokens={tokens} 
              onSelectToken={(sym) => setSelectedSymbol(sym)} 
              selectedSymbol={selectedSymbol}
              setSelectedSymbol={setSelectedSymbol}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              positions={positions}
              openOrders={openOrders}
              tradeHistory={tradeHistory}
              fundingHistory={userFundingData}
              balanceUSDC={effectiveSpotUsdcBalanceUsd}
              walletConnected={walletConnected}
              tokenBalances={tokenBalances}
              walletAddress={walletAddress}
              onConnectWallet={() => setShowWalletModal(true)}
              onCancelOrder={handleCancelOpenOrder}
              onCancelAllOrders={handleCancelAllOpenOrders}
              onClosePosition={handleClosePerpPosition}
              onCloseAllPositions={handleCloseAllPerpPositions}
              spotAvailableBalances={spotAvailableBalances}
              onCloseSpotPosition={handleCloseSpotPosition}
              onCloseAllSpotPositions={handleCloseAllSpotPositions}
              setupComplete={
                tradingSetupComplete
              }
              hasBalance={
                hyperliquidTradingState?.hasBalance ?? false
              }
              onSetupRequired={
                requestTradingSetup
              }
              onSelectOrderBookPrice={
                handleMarketOrderBookPriceSelect
              }
            />
          )}

          {/* SPOT & PERPETUAL TRADING VIEW TERMINAL */}
          {(activeTab === ActiveTab.Spot || activeTab === ActiveTab.Perp) && selectedExchange === "hyperliquid" && currentToken && (
            <RedesignedTerminal
              key="trading-terminal"
              symbol={selectedSymbol}
              isPerp={activeTab === ActiveTab.Perp}
              perpTradingApproved={hasPerpApproval}
              pricePreset={selectedPricePreset}
              onPricePresetConsumed={() => setSelectedPricePreset(undefined)}
              currentToken={currentToken}
              tokens={tokens}
              balanceUSDC={effectiveSpotUsdcBalanceUsd}
              tokenBalances={tokenBalances}
              walletAddress={walletAddress}
              onConnectWallet={() => setShowWalletModal(true)}
              positions={positions}
              openOrders={openOrders}
              hyperliquidOpenOrders={
                Array.isArray(
                  rawOpenOrders
                )
                  ? rawOpenOrders
                  : []
              }
              tradeHistory={tradeHistory}
              fundingHistory={userFundingData}
              setupComplete={
                tradingSetupComplete
              }
              hasBalance={
                hyperliquidTradingState?.hasBalance ?? false
              }
              onSetupRequired={
                requestTradingSetup
              }
              getUserWalletProvider={
                getTradingSetupProvider
              }
              tradingAddress={
                normalizedTradingAddress
              }
              perpInitialMarginAvailableByDex={
                hyperliquidTradingState
                  ?.perpInitialMarginAvailableByDex
              }
              perpWithdrawableByDex={
                hyperliquidTradingState
                  ?.perpWithdrawableByDex
              }
              unifiedSpotTransferableUsd={
                hyperliquidTradingState
                  ?.unifiedSpotTransferableUsd
              }
              accountAbstractionMode={
                hyperliquidTradingState
                  ?.accountAbstractionMode ??
                null
              }
              mainDexAvailableUsdc={
                hyperliquidTradingState
                  ?.perpWithdrawableByDex?.[""] ??
                0
              }
              onOrderSuccess={
                handlePerpOrderSuccess
              }
              onCancelOrder={
                handleCancelOpenOrder
              }
              onCancelAllOrders={
                handleCancelAllOpenOrders
              }
              onClosePosition={
                handleClosePerpPosition
              }
              onCloseAllPositions={
                handleCloseAllPerpPositions
              }
              spotAvailableBalances={
                spotAvailableBalances
              }
              onCloseSpotPosition={
                handleCloseSpotPosition
              }
              onCloseAllSpotPositions={
                handleCloseAllSpotPositions
              }
              onSavePositionTpSl={
                handleSavePositionTpSl
              }
              withdrawableUsd={
                hyperliquidTradingState
                  ?.withdrawableUsd ??
                0
              }
              hyperliquidPositions={
                hyperliquidTradingState
                  ?.positions ??
                []
              }
              accountValueUsd={
                hyperliquidTradingState
                  ?.accountValueUsd ??
                0
              }
              perpCrossAccountValueByDex={
                hyperliquidTradingState
                  ?.perpCrossAccountValueByDex
              }
              perpCrossMaintenanceMarginUsedByDex={
                hyperliquidTradingState
                  ?.perpCrossMaintenanceMarginUsedByDex
              }
              spotUsdcBalanceUsd={
                hyperliquidTradingState
                  ?.spotUsdcBalanceUsd ??
                0
              }
              totalIsolatedMarginUsedUsd={
                hyperliquidTradingState
                  ?.totalIsolatedMarginUsedUsd ??
                0
              }
              totalCrossMaintenanceMarginUsedUsd={
                hyperliquidTradingState
                  ?.totalCrossMaintenanceMarginUsedUsd ??
                0
              }
              totalCrossInitialMarginUsedUsd={
                hyperliquidTradingState
                  ?.totalCrossInitialMarginUsedUsd ??
                0
              }
              totalCrossPositionValueUsd={
                hyperliquidTradingState
                  ?.totalCrossPositionValueUsd ??
                0
              }
              spotUsdcHoldUsd={
                hyperliquidTradingState
                  ?.spotUsdcHoldUsd ??
                0
              }
              tradingStateReady={
                hyperliquidTradingStateReady
              }
              spotBalancesHydrated={spotBalancesHydrated}
              slippageTolerance={slippageTolerance}
              onSpotOrderSuccess={handleSpotOrderSuccess}
              onSelectToken={(sym) => setSelectedSymbol(sym)}
              setIsPerp={(val) => setActiveTab(val ? ActiveTab.Perp : ActiveTab.Spot)}
            />
          )}

          {selectedExchange === "lighter" && (
            activeTab === ActiveTab.Markets || activeTab === ActiveTab.Dashboard ||
            activeTab === ActiveTab.Spot || activeTab === ActiveTab.Perp ||
            activeTab === ActiveTab.Portfolio ||
            activeTab === ActiveTab.Orders || activeTab === ActiveTab.TradeHistory
          ) && (
            <LighterMarketPreview
              onMarketCatalog={onLighterCatalog}
              watchlist={lighterWatchlist}
              onToggleFavorite={toggleLighterFavorite}
              sidebarMarketRequest={lighterMarketRequest}
              walletAddress={walletConnected ? walletAddress : ""}
              getWalletProvider={getTradingSetupProvider}
              onConnectWallet={() => setShowWalletModal(true)}
              initialOrdersTab={activeTab===ActiveTab.TradeHistory?"TRADE_HISTORY":"OPEN_ORDERS"}
              section={
                activeTab === ActiveTab.Dashboard ? "dashboard" :
                activeTab === ActiveTab.Markets ? "markets" :
                activeTab === ActiveTab.Portfolio ? "funds" :
                activeTab === ActiveTab.Profile ? "account" :
                activeTab === ActiveTab.Orders || activeTab === ActiveTab.TradeHistory ? "orders" :
                "trade"
              }
              initialKind={activeTab === ActiveTab.Spot ? "spot" : "perp"}
              perpTradingApproved={hasPerpApproval}
              onSelectSection={(section, marketKind) => setActiveTab(
                section === "dashboard" ? ActiveTab.Dashboard :
                section === "markets" ? ActiveTab.Markets :
                section === "funds" ? ActiveTab.Portfolio :
                section === "account" ? ActiveTab.Profile :
                marketKind === "spot" ? ActiveTab.Spot : ActiveTab.Perp
              )}
            />
          )}

          {selectedExchange==="aster" && (
            activeTab===ActiveTab.Markets||activeTab===ActiveTab.Dashboard||
            activeTab===ActiveTab.Spot||activeTab===ActiveTab.Perp||
            activeTab===ActiveTab.Portfolio||activeTab===ActiveTab.Orders||
            activeTab===ActiveTab.TradeHistory
          ) && <AsterVenueAdapter
            walletAddress={walletConnected?walletAddress:""}
            getWalletProvider={getAsterWalletProvider}
            onConnectWallet={()=>setShowWalletModal(true)}
            initialKind={activeTab===ActiveTab.Spot?"spot":"perp"}
            perpTradingApproved={hasPerpApproval}
            section={activeTab===ActiveTab.Dashboard?"dashboard":
              activeTab===ActiveTab.Markets?"markets":
              activeTab===ActiveTab.Portfolio?"funds":
              activeTab===ActiveTab.Orders||activeTab===ActiveTab.TradeHistory?"orders":"trade"}
            initialOrdersTab={activeTab===ActiveTab.TradeHistory?"TRADE_HISTORY":"OPEN_ORDERS"}
            onSelectSection={(section,mode)=>setActiveTab(
              section==="markets"?ActiveTab.Markets:
              section==="funds"?ActiveTab.Portfolio:
              section==="dashboard"?ActiveTab.Dashboard:
              section==="orders"?ActiveTab.Orders:
              mode==="spot"?ActiveTab.Spot:ActiveTab.Perp)}
          />}

          {/* PORTFOLIO BALANCE SCREEN */}
          {selectedExchange === "hyperliquid" && activeTab === ActiveTab.Portfolio && (
            walletConnected ? (
              <PortfolioPanel
                walletConnected={walletConnected}
                walletAddress={walletAddress}
                balanceUSDC={realWithdrawableUsd}
                realWalletUsdc={realWalletUsdc}
                onDeposit={
                  handlePortfolioDeposit
                }
                onWithdraw={handlePortfolioWithdraw}
                onTransferUsdBetweenSpotAndPerp={handlePortfolioSpotPerpTransfer}
                withdrawableUsd={portfolioWithdrawableUsd}
                perpAccountValueUsd={portfolioTradingStateReady ? hyperliquidTradingState?.perpAccountValueUsd : undefined}
                spotAvailableUsdc={portfolioSpotAvailableUsdc}
                mainPerpTransferAvailableUsd={portfolioMainPerpTransferAvailableUsd}
                isPooledAccount={portfolioIsPooledAccount}
                accountModeKnown={portfolioAccountModeKnown}
                accountValueUsd={portfolioTradingStateReady ? hyperliquidTradingState?.accountValueUsd : undefined}
                accountStateError={portfolioAccountStateError}
                tradingStateReady={portfolioTradingStateReady}
                spotBalancesHydrated={spotBalancesHydrated}
                positionsCount={positions.length}
                tokens={tokens}
                tokenBalances={tokenBalances}
                positions={positions}
                openOrders={openOrders}
                lockedOrderMarginUsd={lockedOrderMarginUsd}
                pnlTimeseries={pnlTimeseries}
                userFills={Array.isArray(userFillsData) ? userFillsData : []}
                userFillsLoading={userFillsLoading}
                userFillsError={userFillsError}
                hlLedger={hlLedger}
              />
            ) : (
              <ConnectionRequired tabName="Portfolio" onConnect={() => setShowWalletModal(true)} />
            )
          )}

          {/* Support & FAQ. Legacy bookmarked Blog tab resolves to real FAQ, never fabricated posts. */}
          {(activeTab === ActiveTab.Blog || activeTab === ActiveTab.Support) && (
            <SupportPanel initialTab="faq" />
          )}

          {/* LEGAL PAGES WITH INTEGRATED ROUTER SUB-TABS */}
          {activeTab === ActiveTab.Legal && (
            <LegalPanel activeSection={selectedSubLegalTab} />
          )}

          {/* Points is its own screen, never an overlay. Approval is rechecked on opening. */}
          {activeTab === ActiveTab.Points && (hasPerpApproval
            ? <HideDexPointsHub walletAddress={walletAddress}
                apiUrl={HIDEDEX_EARLY_ACCESS_API}
                onBack={() => setActiveTab(ActiveTab.Markets)}/>
            : <div className="max-w-xl mx-auto p-6 text-sm text-brand-muted">
                Points Hub requires approved Early Access.
                <button type="button" onClick={() => setActiveTab(ActiveTab.Markets)}
                  className="ml-3 text-brand-primary underline">Back to Markets</button>
              </div>)}

          {/* Wallet-signed referral attribution and post-enrollment referral application. */}
          {activeTab === ActiveTab.Referral && (
            <HideDexReferralPage key={walletAddress.trim().toLowerCase()}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              onConnectWallet={() => setShowWalletModal(true)}
              onSignMessage={async (message:string):Promise<string> => {
                const provider = await getTradingSetupProvider();
                const signer = await new BrowserProvider(provider as any).getSigner();
                if (!walletConnected || getAddress(await signer.getAddress()) !== getAddress(walletAddress)) {
                  throw new Error("Connected wallet does not match signing wallet.");
                }
                return signer.signMessage(message);
              }}
              onEarlyAccess={() => {
                setEarlyAccessRequestedFromPerp(false);
                setActiveTab(ActiveTab.EarlyAccess);
              }}
              onBack={() => setActiveTab(ActiveTab.Markets)}
            />
          )}

          {/* ACCOUNT & SETTINGS PAGE */}
          {(selectedExchange === "hyperliquid" || selectedExchange === "lighter" || selectedExchange === "aster") && activeTab === ActiveTab.Profile && (
            <AccountSettingsPanel
              walletConnected={walletConnected}
              onDisconnectWallet={handleDisconnectWallet}
              initialSlippage={slippageTolerance}
              onApplySlippage={(value) => setSlippageTolerance(value)}
            />
          )}

          {/* ORDERS MANAGER PAGE */}
          {selectedExchange === "hyperliquid" && activeTab === ActiveTab.Orders && (
            walletConnected ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1.5 border-b border-brand-border pb-4">
                  <h1 className="text-xl font-bold font-sans text-brand-text uppercase tracking-wider">Trigger Orders</h1>
                  <p className="text-xs text-gray-500">View and manage your active stops, limits, and take-profit thresholds routing via HideDex Gateway.</p>
                </div>
                <PositionTable
                  isPerp={true}
                  positions={positions}
                  openOrders={openOrders}
                  tradeHistory={tradeHistory}
                  initialTab="OPEN_ORDERS"
                  onCancelOrder={handleCancelOpenOrder}
                  onModifyOrder={handleModifyOpenOrder}
                  onClosePosition={handleClosePerpPosition}
                  onSavePositionTpSl={handleSavePositionTpSl}
                />
              </div>
            ) : (
              <ConnectionRequired tabName="Orders" onConnect={() => setShowWalletModal(true)} />
            )
          )}

          {/* TRADE HISTORY LEDGER PAGE */}
          {selectedExchange === "hyperliquid" && activeTab === ActiveTab.TradeHistory && (
            mode === "PRIVATE" ? (
              <PrivateModeBlockedMessage />
            ) : walletConnected ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1.5 border-b border-brand-border pb-4">
                  <h1 className="text-xl font-bold font-sans text-brand-text uppercase tracking-wider">Settled Audits</h1>
                  <p className="text-xs text-gray-500">Comprehensive cryptographic ledger of all filled, cancelled, or closed positions processed by HideDex nodes.</p>
                </div>
                <PositionTable
                  isPerp={true}
                  positions={positions}
                  openOrders={openOrders}
                  tradeHistory={tradeHistory}
                  initialTab="HISTORY"
                  onClosePosition={handleClosePerpPosition}
                  onSavePositionTpSl={handleSavePositionTpSl}
                />
              </div>
            ) : (
              <ConnectionRequired tabName="Trade History" onConnect={() => setShowWalletModal(true)} />
            )
          )}

        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation (Hidden on Public Landing) */}
      {!isPublicLanding && (
        <div className="md:hidden fixed bottom-[max(6px,env(safe-area-inset-bottom,0px))] left-1.5 right-1.5 z-40 h-12 bg-brand-bg/95 backdrop-blur-lg border border-brand-border rounded-lg px-2 flex items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.6)]">
          {/* Market */}
          <button
            onClick={() => setActiveTab(ActiveTab.Markets)}
            id="mobile-nav-markets"
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer h-full ${
              activeTab === ActiveTab.Markets 
                ? "text-[#38bcfc] font-bold shadow-[0_-10px_20px_rgba(0,56,104,0.15)]" 
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Market</span>
          </button>

          {/* Trade */}
          <button
            onClick={() => setActiveTab(ActiveTab.Perp)}
            id="mobile-nav-trade"
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer h-full ${
              activeTab === ActiveTab.Perp || activeTab === ActiveTab.Spot
                ? "text-[#38bcfc] font-bold shadow-[0_-10px_20px_rgba(0,56,104,0.15)]" 
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Trade</span>
          </button>

          {/* Funds (Only visible after wallet connection) */}
          {walletConnected && (
            <button
              onClick={() => setActiveTab(ActiveTab.Portfolio)}
              id="mobile-nav-funds"
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer h-full ${
                activeTab === ActiveTab.Portfolio
                  ? "text-[#38bcfc] font-bold shadow-[0_-10px_20px_rgba(0,56,104,0.15)]" 
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Funds</span>
            </button>
          )}

          {/* Account */}
          {mode !== "ANONYMOUS" && (
            <button
              onClick={() => setActiveTab(ActiveTab.Profile)}
              id="mobile-nav-account"
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer h-full ${
                activeTab === ActiveTab.Profile 
                  ? "text-[#38bcfc] font-bold shadow-[0_-10px_20px_rgba(0,56,104,0.15)]" 
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Account</span>
            </button>
          )}
        </div>
      )}


      {/* Read-only Perp charts remain visible until the wallet is approved.
          This is an entry gate, not an exchange API permission. */}
      {showPerpAccessSheet && activeTab === ActiveTab.Perp && !hasPerpApproval && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center" role="presentation">
          <button type="button" aria-label="Dismiss Perpetual access notice"
            className="absolute inset-0 bg-black/55"
            onClick={() => setShowPerpAccessSheet(false)}/>
          <div role="dialog" aria-modal="true" aria-labelledby="perp-access-title"
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-brand-border bg-brand-surface px-5 pt-5 pb-[max(26px,env(safe-area-inset-bottom))] text-brand-text shadow-2xl">
            <button type="button" aria-label="Close" onClick={() => setShowPerpAccessSheet(false)}
              className="absolute top-3 right-3 rounded-lg p-1.5 text-brand-muted hover:text-brand-text"><X className="h-5 w-5"/></button>
            <h2 id="perp-access-title" className="pr-8 text-lg font-bold">Perpetual Trading — Early Access</h2>
            <p className="mt-2 text-sm leading-6 text-brand-sub">
              Explore Perpetual markets and charts freely. New Perpetual trades on Hyperliquid,
              Lighter and Aster require an approved Early Access wallet. Spot trading is open
              to connected wallets, subject to the exchanges' normal signing and balance requirements.
            </p>
            <button type="button" onClick={() => {
              setShowPerpAccessSheet(false);
              setEarlyAccessRequestedFromPerp(false);
              setActiveTab(ActiveTab.EarlyAccess);
            }} className="mt-5 w-full rounded-xl bg-accent py-3 text-sm font-extrabold text-brand-bg">
              Join Early Access
            </button>
            <button type="button" onClick={() => {
              setShowPerpAccessSheet(false);
              setActiveTab(ActiveTab.Spot);
            }} className="mt-2 w-full rounded-xl border border-brand-border py-3 text-sm font-bold text-brand-text">
              Continue with Spot
            </button>
          </div>
        </div>
      )}

      {/* Wallet Selector Modal (Compact, real Web3 wallet gateway with mobile deep links) */}
      <WalletConnectModal
        isOpen={showWalletModal}
        onClose={handleCloseWalletModal}
        walletState={{
          connected: walletConnected,
          address: walletAddress,
          walletType: walletType,
          chainId: chainId,
          error: walletModalError,
          isSimulated: false,
        }}
        onConnect={handleConnectWallet}
        onConnectPrivy={handleConnectPrivy}
        onDisconnect={handleDisconnectWallet}
        isAwaitingSignature={isAwaitingSignature}
        connecting={walletConnectPending}
      />

      <TrustShieldPopup
        isOpen={hasTradingAccess && showTrustShieldPopup}
        onClose={() => setShowTrustShieldPopup(false)}
      />

      {/* Hyperliquid Trading Setup & Builder Fee Approval Modal.
          No agent-key, builder-fee or account-mode approval before a wallet
          has been granted Early Access and has opened the trading app. */}
      {selectedExchange === "hyperliquid" && isTradeTerminalActive && normalizedTradingAddress && (
        <BuilderFeePopup
          isOpen={showTradingSetup}
          tradingAddress={
            normalizedTradingAddress
          }
          connectedAddress={
            appKitAddress ?? null
          }
          getProvider={
            getTradingSetupProvider
          }
          ensureSigningChain={
            ensureTradingSigningChain
          }
          onClose={
            handleTradingSetupClose
          }
          onComplete={
            handleTradingSetupComplete
          }
          onRunningChange={
            setTradingSetupBusy
          }
        />
      )}

    </div>
  );
}
