/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * HideDex - Official Landing Page
 * Matches official HideDex black & gold visual reference
 * Official Website: hidedex.com
 * Official Support: hidedex.com@gmail.com
 */

import React, { useState, useEffect, useCallback, useId } from "react";
import PublicInfoPage, { type PublicInfoSection } from "./PublicInfoPage";
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Zap, 
  ArrowRight, 
  Layers, 
  Lock, 
  Cpu, 
  BarChart3, 
  CheckCircle2, 
  Globe, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Gift, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink,
  Wallet,
  Activity,
  Award,
  Terminal,
  RefreshCw,
  HelpCircle,
  Mail,
  X
} from "lucide-react";
import { ActiveTab, TokenMetadata } from "../../types";
import { HideDexLogo } from "../common/HideDexLogo";
import { getHistoricalPnlTimeseries } from "../../lib/hyperliquid";
import { getLighterLifetimeVolumeUsd } from "../../lib/lighter";
import HideDexLandingPage from "./HideDexLandingPage";
import { useLanguage } from "../../lib/LanguageContext";


/* Self-contained Early Access dark palette. Never depend on the app's active
   light/dark profile: this enrollment modal must always remain legible. */
const HIDEDEX_EARLY_ACCESS_STYLES = `
#hidedex-early-access { background:#050608!important; color:#f1f6ff!important; color-scheme:dark; }
#hidedex-early-access .hidedex-ea-panel {
  background:#090b0f!important;
  color:#f1f6ff!important; border-color:#27374b!important;
}
#hidedex-early-access .hidedex-ea-subtitle,
#hidedex-early-access .hidedex-ea-muted { color:#b5c5d8!important; }
#hidedex-early-access .hidedex-ea-title,
#hidedex-early-access .hidedex-ea-label { color:#f3f7ff!important; }
#hidedex-early-access .hidedex-ea-close { color:#c2d0e1!important; }
#hidedex-early-access .hidedex-ea-volume {
  background:#11141a!important; border-color:#334357!important;
}
#hidedex-early-access .hidedex-ea-stat {
  background:#090c12!important; border-color:#34465c!important; min-width:0;
}
#hidedex-early-access .hidedex-ea-stat-title {
  color:#b8cadc!important; font-size:10px; white-space:normal!important;
  overflow:visible!important; text-overflow:clip!important; line-height:1.35;
  overflow-wrap:anywhere; min-height:27px; display:block;
}
#hidedex-early-access .hidedex-ea-input {
  background:#0e121a!important; border:1px solid #42546d!important;
  color:#f3f7ff!important; -webkit-text-fill-color:#f3f7ff!important;
  min-width:0; opacity:1!important;
}
#hidedex-early-access .hidedex-ea-input::placeholder {
  color:#9caec3!important; -webkit-text-fill-color:#9caec3!important;
  opacity:1!important;
}
#hidedex-early-access .hidedex-ea-input:focus {
  border-color:#6aa9ff!important; box-shadow:0 0 0 1px #6aa9ff50!important;
}
#hidedex-early-access .hidedex-ea-action {
  background:#1764cc!important; color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important; border:1px solid #4588f5!important;
}
#hidedex-early-access .hidedex-ea-action:hover { background:#1a58be!important; }
#hidedex-early-access .hidedex-ea-secondary {
  background:#1a2a40!important; color:#f1f6ff!important;
  border:1px solid #405775!important;
}
#hidedex-early-access .hidedex-ea-total { color:#76e8bd!important; }
#hidedex-early-access button { -webkit-tap-highlight-color:transparent; }
#hidedex-early-access button:focus:not(:focus-visible) { outline:none; box-shadow:none; }
@media (hover:hover) and (pointer:fine) {
  #hidedex-early-access button:focus-visible { outline:2px solid #75aaff;outline-offset:3px; }
}
#hidedex-early-access { position:fixed!important; inset:0!important; height:100dvh!important; overflow:hidden!important; overscroll-behavior:none!important; }
#hidedex-early-access .hidedex-ea-panel { overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
#hidedex-early-access .hidedex-ea-points { background:#0c1018!important; border-color:#354356!important; }
#hidedex-early-access .hidedex-ea-stat-title {
  font-size:9px!important; letter-spacing:-.045em!important;
  white-space:nowrap!important; overflow:hidden!important;
  text-overflow:clip!important; overflow-wrap:normal!important; min-height:18px!important;
}
@media (max-width:380px) {
  #hidedex-early-access .hidedex-ea-stat-title { font-size:8px!important; }
}
@media (max-width:767px) {
  #hidedex-early-access .hidedex-ea-panel { border:none!important; }
}

/* Redesigned mobile-first Early Access onboarding. Localized to modal only. */
#hidedex-early-access .hidedex-ea-panel{background:radial-gradient(ellipse at 25% 0%,#13273c 0%,#0a1019 34%,#070a10 74%)!important;border:1px solid #273c51!important;scrollbar-color:#32465b transparent}
#hidedex-early-access .hidedex-ea-eyebrow{font-size:10px;color:#83b8f9!important;letter-spacing:.15em;font-weight:800}
#hidedex-early-access .hidedex-ea-title{font-size:clamp(25px,5.5vw,31px)!important;line-height:1.15;letter-spacing:-.045em}
#hidedex-early-access .hidedex-ea-subtitle{font-size:13px!important;line-height:1.5!important;max-width:355px}
#hidedex-early-access .hidedex-ea-volume{background:linear-gradient(145deg,#101b29,#0c111b)!important;border:1px solid #2b425c!important;border-radius:18px!important}
#hidedex-early-access .hidedex-ea-stat{background:#0a1018!important;border:1px solid #283e56!important;border-radius:13px!important;min-width:0;min-height:113px}
#hidedex-early-access .hidedex-ea-venue-name{color:#f2f7ff!important;font-size:12px!important;font-weight:750;line-height:1.3;white-space:normal;overflow-wrap:break-word}
#hidedex-early-access .hidedex-ea-venue-logo{width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#182334;border:1px solid #36506c}
#hidedex-early-access .hidedex-ea-venue-logo img{width:22px;height:22px;object-fit:contain;border-radius:5px}
#hidedex-early-access .hidedex-ea-stat-value{color:#f3f8ff!important;font-size:clamp(16px,4.2vw,19px)!important;line-height:1.25;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:750;letter-spacing:-.035em;overflow-wrap:anywhere}
#hidedex-early-access .hidedex-ea-total-card{background:linear-gradient(90deg,#102c2e,#102129)!important;border:1px solid #235957!important;border-radius:13px!important}
#hidedex-early-access .hidedex-ea-total{color:#85eed1!important;font-weight:800;font-size:clamp(16px,4.3vw,20px)!important;white-space:normal;overflow-wrap:anywhere;letter-spacing:-.035em}
#hidedex-early-access .hidedex-ea-points{background:linear-gradient(115deg,#101c29,#10151f)!important;border:1px solid #2e435e!important;border-radius:18px!important}
#hidedex-early-access .hidedex-ea-reward-value{font-size:clamp(17px,4.5vw,21px)!important;line-height:1.3;letter-spacing:-.025em;overflow-wrap:anywhere;font-family:Inter,system-ui,sans-serif;font-weight:800}
#hidedex-early-access .hidedex-ea-input{min-height:49px!important;font-size:14px!important;border-radius:12px!important;padding:12px 14px!important}
#hidedex-early-access .hidedex-ea-label{font-size:12px!important;line-height:1.4;font-weight:700}
#hidedex-early-access .hidedex-ea-action{min-height:46px;font-size:13px!important;letter-spacing:.012em!important;border-radius:12px!important}
#hidedex-early-access .hidedex-ea-secondary{background:#162338!important;color:#dbeaff!important;-webkit-text-fill-color:#dbeaff!important;border:1px solid #395473!important}
#hidedex-early-access .hidedex-ea-close{background:#132031!important;border:1px solid #2d455f!important;border-radius:12px!important}
#hidedex-early-access .hidedex-ea-close:hover{background:#20314a!important;color:#fff!important}
@media(min-width:768px){#hidedex-early-access .hidedex-ea-panel{box-shadow:0 25px 80px #0009!important}}
@media(max-width:767px){#hidedex-early-access .hidedex-ea-panel{border:0!important;border-radius:0!important}}
`;

const SUPABASE_URL = "https://nqlzjregtvjspescfqcn.supabase.co";
const EARLY_ACCESS_API = `${SUPABASE_URL}/functions/v1/hidedex-early-access`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

type EarlyAccessAccessState =
  | "idle"
  | "checking"
  | "none"
  | "pending"
  | "granted"
  | "error";

type WalletVolumeState = {
  hyperliquid: number | null;
  lighter: number | null;
  total: number | null;
  loading: boolean;
  error: string | null;
};

const formatVolumeDisplay = (val: number | null): string => {
  if (val === null) return "—";
  if (val === 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

interface LandingPageProps {
  tokens: TokenMetadata[];
  setActiveTab: (tab: ActiveTab) => void;
  walletConnected: boolean;
  onConnectWallet: () => void;
  onSignEarlyAccessMessage: (message: string) => Promise<string>;
  onVerifyLaunchApp: (wallet: string) => Promise<void>;
  showEarlyAccessOnMount?: boolean;
  onClosePerpEarlyAccess?: () => void;
  onDisconnectWallet?: () => void;
  walletAddress: string;
  accountValueUsd: number;
  withdrawableUsd: number;
  setSubLegalTab?: (tab: string) => void;
  onSelectToken?: (symbol: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  tokens = [],
  setActiveTab,
  walletConnected,
  onConnectWallet,
  onSignEarlyAccessMessage,
  onVerifyLaunchApp,
  showEarlyAccessOnMount = false,
  onClosePerpEarlyAccess,
  onDisconnectWallet,
  walletAddress,
  accountValueUsd,
  setSubLegalTab,
  onSelectToken
}) => {
  const { t } = useLanguage();
  // Early Access enrollment is handled by verified Supabase RPC only.
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [simulatedOrderType, setSimulatedOrderType] = useState<"buy" | "sell">("buy");
  const [simulatedLeverage, setSimulatedLeverage] = useState<number>(20);
  const [terminalTab, setTerminalTab] = useState<"book" | "chart" | "trades">("book");

  // Ephemeral wallet-app roundtrip flag. No Gmail, X handle or permission is stored.
  const earlyAccessReturnKey = "hidedex_ea_wallet_return";
  const [isEarlyAccessOpen, setIsEarlyAccessOpen] = useState(() => {
    if (showEarlyAccessOnMount) return true;
    try {
      const requestedAt = Number(sessionStorage.getItem(earlyAccessReturnKey));
      return Number.isFinite(requestedAt) && requestedAt > 0 &&
        Date.now() - requestedAt < 5 * 60_000;
    } catch { return false; }
  });
  const closeEarlyAccess = () => {
    try { sessionStorage.removeItem(earlyAccessReturnKey); } catch {}
    setIsEarlyAccessOpen(false);
    if (showEarlyAccessOnMount) onClosePerpEarlyAccess?.();
  };
  const handleEarlyAccessConnect = () => {
    try { sessionStorage.setItem(earlyAccessReturnKey, String(Date.now())); } catch {}
    onConnectWallet();
  };
  useEffect(() => {
    if (walletConnected) {
      try { sessionStorage.removeItem(earlyAccessReturnKey); } catch {}
    }
  }, [walletConnected]);

  // Freeze the document behind the fullscreen enrollment modal (Android too).
  // The form itself may scroll on small screens; the landing page never may.
  useEffect(() => {
    if (!isEarlyAccessOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const y = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEarlyAccess();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      window.scrollTo(0, y);
    };
  }, [isEarlyAccessOpen]);
  const [earlyAccessX, setEarlyAccessX] = useState("");
  const [earlyAccessEmail, setEarlyAccessEmail] = useState("");
  const [earlyAccessError, setEarlyAccessError] = useState("");
  const [earlyAccessState, setEarlyAccessState] =
    useState<EarlyAccessAccessState>("idle");
  const [earlyAccessQueuePosition, setEarlyAccessQueuePosition] =
    useState<number | null>(null);
  const [earlyAccessBusy, setEarlyAccessBusy] = useState(false);
  // UX history is stored per connected wallet, NOT an authorization credential.
  useEffect(() => {
    if (!walletConnected || !walletAddress) return;
    try { localStorage.setItem("hidedex_last_connected_wallet", walletAddress.toLowerCase()); }
    catch { /* Storage can be disabled. */ }
  }, [walletConnected, walletAddress]);
  const [earlyAccessPoints, setEarlyAccessPoints] = useState<number | null>(null);
  const [savedRegistrationVolume, setSavedRegistrationVolume] = useState<number | null>(null);
  const [earlyAccessPointsStatus, setEarlyAccessPointsStatus] = useState<"pending_verification" | "verified" | null>(null);
  // The public X post reference shows only the connected wallet's last ten hex characters.
  // Signed enrollment still preserves its independent server-issued verification code.
  const [xVerificationStatus, setXVerificationStatus] = useState<"pending" | "verified" | "rejected" | null>(null);
  const [registeredXUsername, setRegisteredXUsername] = useState<string | null>(null);
  const [xCopyFeedback, setXCopyFeedback] = useState<"copied" | "error" | null>(null);
  const [showXProofHelp, setShowXProofHelp] = useState(false);

  const [walletVolume, setWalletVolume] = useState<WalletVolumeState>({
    hyperliquid: null,
    lighter: null,
    total: null,
    loading: false,
    error: null,
  });


  // Real Supabase Edge endpoint: public status returns no Gmail, signup
  // requires an EVM wallet signature and awards points exclusively on the server.
  const callEarlyAccess = async (body: Record<string, unknown>) => {
    const response = await fetch(EARLY_ACCESS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Early Access request failed");
    return result;
  };

  const applyEarlyAccessRecord = (record: any) => {
    const status = record?.access_status;
    if (status === "granted" || status === "pending") {
      setEarlyAccessState(status);
      setEarlyAccessQueuePosition(Number.isFinite(Number(record.queue_position)) ? Number(record.queue_position) : null);
      const savedPoints = record.points === null || record.points === undefined ? null : Number(record.points);
      setEarlyAccessPoints(savedPoints !== null && Number.isFinite(savedPoints) ? savedPoints : null);
      const savedVolume = record.volume_total_usd === null || record.volume_total_usd === undefined ? null : Number(record.volume_total_usd);
      setSavedRegistrationVolume(savedVolume !== null && Number.isFinite(savedVolume) ? savedVolume : null);
      setEarlyAccessPointsStatus(record.points_status === "verified" ? "verified" : "pending_verification");
      setXVerificationStatus(record.x_verification_status === "verified" || record.x_verification_status === "rejected" ? record.x_verification_status : "pending");
      setRegisteredXUsername(typeof record.x_username === "string" ? record.x_username : null);
      setXCopyFeedback(null);
    } else {
      setEarlyAccessState("none");
      setEarlyAccessQueuePosition(null);
      setEarlyAccessPoints(null);
      setSavedRegistrationVolume(null);
      setEarlyAccessPointsStatus(null);
      setXVerificationStatus(null);
      setRegisteredXUsername(null);
      setXCopyFeedback(null);
    }
  };

  const checkEarlyAccessStatus = useCallback(async (targetWallet: string) => {
    if (!targetWallet) return;
    setEarlyAccessState("checking");
    setEarlyAccessError("");
    setEarlyAccessPoints(null);
    setSavedRegistrationVolume(null);
    setEarlyAccessPointsStatus(null);
    setXVerificationStatus(null);
    setRegisteredXUsername(null);
    setXCopyFeedback(null);
    try {
      const record = await callEarlyAccess({action:"status",wallet:targetWallet.toLowerCase()});
      applyEarlyAccessRecord(record);
      return record?.access_status as EarlyAccessAccessState;
    } catch {
      setEarlyAccessState("error");
      return "error" as EarlyAccessAccessState;
    }
  }, []);

  const fetchWalletVolumes = useCallback(async (targetWallet: string) => {
    if (!targetWallet) return;
    setWalletVolume((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [hlVol, lighterVol] = await Promise.all([
        getHistoricalPnlTimeseries(targetWallet as `0x${string}`)
          .then((history) => {
            // The same full portfolio allTime.vlm used in Funds, NOT referral contributions.
            const raw = history.allTime?.vlm;
            if (raw === undefined || raw === null || raw === "") return null;
            const value = Number(raw);
            return Number.isFinite(value) && value >= 0 ? value : null;
          }).catch(() => null),
        getLighterLifetimeVolumeUsd(targetWallet).catch(() => null),
      ]);

      // Only show a confirmed total when BOTH exchange reads succeeded.
      const totalVol: number | null =
        hlVol !== null && lighterVol !== null ? hlVol + lighterVol : null;

      setWalletVolume({
        hyperliquid: hlVol,
        lighter: lighterVol,
        total: totalVol,
        loading: false,
        error: null,
      });
    } catch {
      setWalletVolume((prev) => ({
        ...prev,
        loading: false,
        error: "Unable to retrieve wallet volume.",
      }));
    }
  }, []);

  // Parallel wallet-first flow on connection / modal open
  useEffect(() => {
    if (!isEarlyAccessOpen || !walletConnected || !walletAddress) {
      if (!walletConnected) {
        setEarlyAccessState("idle");
        setEarlyAccessQueuePosition(null);
        setEarlyAccessPoints(null);
        setSavedRegistrationVolume(null);
        setEarlyAccessPointsStatus(null);
        setXVerificationStatus(null);
        setRegisteredXUsername(null);
        setXCopyFeedback(null);
        setWalletVolume({
          hyperliquid: null,
          lighter: null,
          total: null,
          loading: false,
          error: null,
        });
      }
      return;
    }

    // Registration status comes FIRST. Never re-fetch/show live volume for saved applicants.
    let active = true;
    void checkEarlyAccessStatus(walletAddress).then(status => {
      if (active && status === "none") void fetchWalletVolumes(walletAddress);
    });
    return () => { active = false; };
  }, [isEarlyAccessOpen, walletConnected, walletAddress, checkEarlyAccessStatus, fetchWalletVolumes]);

  const activeProofCode = walletConnected && /^0x[0-9a-f]{40}$/i.test(walletAddress)
    ? `HDX-${walletAddress.slice(-10).toLowerCase()}` : null;
  const formReadyForXPost = Boolean(activeProofCode);
  // Preserve the owner's last approved post text and whitespace.
  const makeXPost = (code: string) => `Hidedex  Perp is Coming .

Get Free 0.1 to 10 points

For now access being given few people soon, but don't worry, you will get it soon.



Early Access is open www.Hidedex.com 



Go fill  X  Gamil wallet and wait for your total volume and point ${code}`;

  // Only Submit registers, through the existing wallet signature.
  const handleEarlyAccessSubmit = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    setEarlyAccessError("");

    if (!walletConnected || !walletAddress) {
      setEarlyAccessError("Please connect your wallet before submitting.");
      return;
    }

    const normalized = walletAddress.trim().toLowerCase();
    const xTrimmed = earlyAccessX.trim();
    const emailTrimmed = earlyAccessEmail.trim();

    if (!xTrimmed) {
      setEarlyAccessError("Please enter your X / Twitter username.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed) || !emailTrimmed.toLowerCase().endsWith("@gmail.com")) {
      setEarlyAccessError("Please provide a valid Gmail address ending with @gmail.com.");
      return;
    }

    setEarlyAccessBusy(true);

    try {
      const challenge = await callEarlyAccess({action:"challenge",wallet:normalized});
      const signature = await onSignEarlyAccessMessage(challenge.message);
      const record = await callEarlyAccess({
        action:"join",wallet:normalized,signature,
        x_username:xTrimmed,gmail:emailTrimmed.toLowerCase(),
      });
      applyEarlyAccessRecord(record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to submit Early Access right now.";
      setEarlyAccessError(msg);
    } finally {
      setEarlyAccessBusy(false);
    }
  };

  // Both Copy Post and Post on X consume this one identical string.
  const xPostText = activeProofCode ? makeXPost(activeProofCode) : "";
  const copyXVerificationPost = async () => {
    if (!xPostText) return;
    try {
      await navigator.clipboard.writeText(xPostText);
      setXCopyFeedback("copied");
    } catch {
      setXCopyFeedback("error");
    }
  };

  // Removed obsolete localStorage waitlist, random queue counter, and fake referral links.
  // Backend-issued queue positions are still shown from get_early_access_status.

  const handleTradeAsset = (symbol: string) => {
    if (onSelectToken) {
      onSelectToken(symbol);
    }
    setActiveTab(ActiveTab.Perp);
  };

  // Curated prominent tokens
  const showcaseSymbols = ["BTC", "ETH", "SOL", "HYPE", "SUI", "AVAX", "DOGE", "LINK", "ARB"];
  const showcaseTokens = showcaseSymbols.map(sym => {
    const found = tokens.find(t => t.symbol.toUpperCase() === sym || t.name.toUpperCase() === sym);
    if (found) return found;
    // High-fidelity fallback display
    const fallbackPrices: Record<string, { px: number; chg: number; vol: string }> = {
      BTC: { px: 94520.50, chg: 3.42, vol: "$482.1M" },
      ETH: { px: 3280.25, chg: 2.18, vol: "$310.8M" },
      SOL: { px: 198.60, chg: 5.74, vol: "$245.3M" },
      HYPE: { px: 28.45, chg: 12.60, vol: "$142.9M" },
      SUI: { px: 3.42, chg: 4.15, vol: "$88.4M" },
      AVAX: { px: 36.80, chg: -1.24, vol: "$64.2M" },
      DOGE: { px: 0.224, chg: 8.35, vol: "$120.5M" },
      LINK: { px: 18.90, chg: 1.85, vol: "$45.1M" },
      ARB: { px: 0.845, chg: -0.95, vol: "$32.7M" },
    };
    const fb = fallbackPrices[sym] || { px: 100, chg: 2.5, vol: "$10M" };
    return {
      name: sym,
      symbol: sym,
      markPx: fb.px,
      prevDayPx: fb.px / (1 + fb.chg / 100),
      volume24h: fb.vol,
      isSpot: false,
      maxLeverage: sym === "BTC" || sym === "ETH" ? 50 : 20
    } as unknown as TokenMetadata;
  });

  const faqs = [
    {
      q: "What is HideDex?",
      a: "HideDex (hidedex.com) provides a wallet-connected interface for spot and perpetual trading, with live market tools, charts, and order management. Trades are executed through the connected trading protocol, rather than by a custodial HideDex account."
    },
    {
      q: "Do I pay gas fees for placing and canceling orders?",
      a: "Trading orders normally use wallet signatures rather than individual blockchain gas transactions. Deposits, withdrawals and other on-chain actions may require network fees. Trading fees can also apply; review the applicable rates before confirming."
    },
    {
      q: "How are my deposited funds secured?",
      a: "HideDex uses a wallet-connected trading model. Review the underlying protocol and bridge details before depositing, and confirm the network, withdrawal conditions and transaction fees in your wallet."
    },
    {
      q: "What leverage is available on Perpetual contracts?",
      a: "HideDex supports up to 50x cross-margin and isolated-margin leverage on flagship assets like BTC and ETH, and up to 20x leverage on Layer 1s, altcoins, and trending ecosystem tokens."
    },
    {
      q: "What wallets are supported?",
      a: "HideDex supports MetaMask, Rabby, Coinbase Wallet, WalletConnect, Rainbow, Phantom (EVM), OKX Wallet, and any standard Web3 Ethereum wallet provider."
    },
    {
      q: "How can I contact official HideDex support?",
      a: "Our official support email is hidedex.com@gmail.com. We never ask for your private keys, seed phrases, or passwords."
    }
  ];

  // Open the public Spot workspace without inventing a Perp approval.
  // Signing and the server-granted Perp status are checked separately.
  const handleLaunchApp = async () => {
    if (earlyAccessBusy) return;
    setEarlyAccessError("");
    setEarlyAccessBusy(true);
    try {
      await onVerifyLaunchApp(walletAddress);
      setIsEarlyAccessOpen(false);
    } catch (err: unknown) {
      setEarlyAccessError(err instanceof Error ? err.message : "Unable to confirm access.");
      setIsEarlyAccessOpen(true);
    } finally {
      setEarlyAccessBusy(false);
    }
  };

  // Public pages are readable without the trading/early-access authorization gate.
  // Do not call setActiveTab or handleLaunchApp from these routes.
  const infoPath = typeof window !== "undefined" ? window.location.pathname.replace(/\/+$/, "") : "";
  if (infoPath === "/exchange-info" || infoPath === "/exchange-api" || infoPath === "/market-info" || infoPath === "/fees") {
    return <PublicInfoPage section={infoPath.slice(1) as PublicInfoSection} />;
  }
  if (infoPath === "/docs" || infoPath === "/whitepaper" || infoPath === "/resources" || infoPath === "/terms" || infoPath === "/risk" || infoPath === "/privacy" || infoPath === "/about" || infoPath === "/contact" ||
      infoPath === "/faq" || infoPath === "/markets" || infoPath === "/early-access") {
    return <PublicInfoPage section={infoPath.slice(1) as PublicInfoSection} />;
  }

  return (
    <div className="relative min-h-screen bg-[#08090D] text-gray-100 font-sans selection:bg-[#F5D061]/30 selection:text-white overflow-x-hidden">
      
      <HideDexLandingPage
        onEarlyAccess={() => setIsEarlyAccessOpen(true)}
        onLaunchApp={handleLaunchApp}
      />

      {/* EARLY ACCESS FULLSCREEN (MOBILE) / MODAL (DESKTOP) */}
      {isEarlyAccessOpen && (
        <div
          id="hidedex-early-access" className="fixed inset-0 z-[100] h-[100dvh] overflow-hidden overscroll-none bg-[#090B0F] dark:bg-[#090B0F] md:bg-black/80 md:flex md:items-center md:justify-center"
          onClick={closeEarlyAccess}
        >
          <style>{HIDEDEX_EARLY_ACCESS_STYLES}</style>
          <div
            className="hidedex-ea-panel relative w-screen h-[100dvh] max-w-none max-h-none rounded-none overflow-y-auto overscroll-contain bg-[#090d14] px-5 pt-6 pb-[max(32px,env(safe-area-inset-bottom))] text-white md:w-full md:max-w-[500px] md:h-auto md:max-h-[89dvh] md:rounded-[24px] md:p-6 md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inner Content Container */}
            <div className="w-full max-w-md mx-auto">
              {/* Top-Right X Close Button */}
              <button
                type="button"
                onClick={closeEarlyAccess}
                className="hidedex-ea-close absolute right-4 top-5 p-2 text-[#c2d0e1] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#74aaff]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Title */}
              <div className="hidedex-ea-header mb-5 pr-10 text-left">
                <p className="hidedex-ea-eyebrow mb-2 flex items-center gap-2 uppercase">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#71e4c5]" aria-hidden="true"/>
                  HideDex / Early Access
                </p>
                <h2 className="hidedex-ea-title font-black text-white">{t("early_access")}</h2>
                <p className="hidedex-ea-subtitle mt-2 text-[#b8c8dd]">
                  {t("join_early_access")} · Connect your wallet to check your exchange volume and join the waitlist.
                </p>
              </div>

              {/* Use the existing signed-in wallet disconnect path. */}
              {walletConnected && walletAddress && onDisconnectWallet && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[#35465b] bg-[#111923] px-2.5 py-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-[#c5d3e5]">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                  <button
                    type="button"
                    aria-label="Disconnect connected wallet"
                    onClick={async () => {
                      try {
                        await onDisconnectWallet();
                      } catch (err) {
                        setEarlyAccessError(err instanceof Error ? err.message : "Unable to disconnect wallet.");
                      }
                    }}
                    className="hidedex-ea-secondary shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#90b7fa]"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {/* Modal Content - Complete Form & Volume Shell */}
              <div className="space-y-4 text-left">
                {/* Live wallet volume is a pre-registration step ONLY. */}
                {(earlyAccessState === "none" || (!walletConnected && earlyAccessState === "idle")) && (
                <section className="hidedex-ea-volume p-4" aria-label="Exchange wallet volume">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[.15em] font-bold text-[#80a4c9]">VOLUME SNAPSHOT</p>
                      <h3 className="mt-1 text-[15px] font-bold tracking-tight text-[#eff5ff]">Your trading activity</h3>
                    </div>
                    {walletConnected && walletAddress && (
                      <button type="button"
                        onClick={() => void fetchWalletVolumes(walletAddress)}
                        disabled={walletVolume.loading}
                        className="hidedex-ea-secondary shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold disabled:opacity-50"
                        aria-label="Refresh wallet trading volume" title="Refresh Volume">
                        <RefreshCw className={`w-3.5 h-3.5 ${walletVolume.loading ? "animate-spin" : ""}`}/>
                        Refresh
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="hidedex-ea-stat p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="hidedex-ea-venue-logo" aria-hidden="true">
                          <img src="https://www.google.com/s2/favicons?domain=hyperliquid.xyz&sz=64"
                            width={22} height={22} alt="" decoding="async"/>
                        </span>
                        <span className="hidedex-ea-venue-name">Hyperliquid</span>
                      </div>
                      <div className="hidedex-ea-stat-value mt-3">
                        {!walletConnected ? "—"
                          : walletVolume.loading && walletVolume.hyperliquid === null ? "—"
                          : formatVolumeDisplay(walletVolume.hyperliquid)}
                      </div>
                      <p className="mt-1 text-[10px] text-[#8199b1]">Lifetime volume</p>
                    </div>
                    <div className="hidedex-ea-stat p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="hidedex-ea-venue-logo" aria-hidden="true">
                          <img src="https://www.google.com/s2/favicons?domain=lighter.exchange&sz=64"
                            width={22} height={22} alt="" decoding="async"/>
                        </span>
                        <span className="hidedex-ea-venue-name">Lighter</span>
                      </div>
                      <div className="hidedex-ea-stat-value mt-3">
                        {!walletConnected ? "—"
                          : walletVolume.loading && walletVolume.lighter === null ? "—"
                          : formatVolumeDisplay(walletVolume.lighter)}
                      </div>
                      <p className="mt-1 text-[10px] text-[#8199b1]">Lifetime volume</p>
                    </div>
                  </div>
                  <div className="hidedex-ea-total-card mt-2.5 flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[.09em] font-bold text-[#94d9ce]">Total Volume</p>
                      <p className="mt-0.5 text-[10px] text-[#aac1cf]">Hyperliquid + Lighter</p>
                    </div>
                    <div className="hidedex-ea-total text-right font-mono min-w-0">
                      {!walletConnected ? "—"
                        : walletVolume.loading && walletVolume.total === null ? "—"
                        : formatVolumeDisplay(walletVolume.total)}
                    </div>
                  </div>
                  {!walletConnected && (
                    <p className="hidedex-ea-muted mt-3 text-[11px] leading-relaxed">
                      Connect a wallet below to view your trading volume.
                    </p>
                  )}
                </section>
                )}

                {earlyAccessState === "none" && walletConnected && !walletVolume.loading &&
                  (walletVolume.hyperliquid === null || walletVolume.lighter === null) && (
                    <p className="mt-2 text-[10px] text-gray-400">
                      Combined volume unavailable until both exchange APIs respond. Please retry later.
                    </p>
                  )}

                {/* Always show the FREE POINTS section, but never expose any
                    numeric award before a successful wallet-signed signup.
                    Reconnect shows ONLY the points saved by the server. */}
                <div className="hidedex-ea-points p-4" aria-live="polite">
                  {walletConnected && (earlyAccessState === "pending" || earlyAccessState === "granted") && (
                    <div className="mb-3 pb-3 border-b border-[#344257]">
                      <div className="text-[10px] uppercase font-semibold tracking-wider text-[#b6c4d7]">Volume at verification · Hyperliquid + Lighter</div>
                      <div className="mt-1 text-xl font-mono font-black text-white">
                        {savedRegistrationVolume === null ? "Pending verification" : formatVolumeDisplay(savedRegistrationVolume)}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#e5edf9] uppercase">Free Points</span>
                    <span className="rounded-md border border-[#344257] px-2 py-0.5 text-[10px] font-medium text-[#b6c4d7]">
                      One-time reward
                    </span>
                  </div>
                  <div className="hidedex-ea-reward-value mt-2 text-[#f0f6ff]">
                    {walletConnected && (earlyAccessState === "pending" || earlyAccessState === "granted")
                      ? earlyAccessPointsStatus === "verified" && earlyAccessPoints !== null
                        ? `${earlyAccessPoints.toFixed(1)} Points`
                        : "Pending verification"
                      : earlyAccessState === "checking" && walletConnected
                      ? "Checking enrollment…"
                      : "Submit to unlock"}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#b6c4d7]">
                    {walletConnected && (earlyAccessState === "pending" || earlyAccessState === "granted")
                      ? "Volume and points are saved once after registration; they do not increase on reconnect."
                      : "Your volume is checked before registration. Free Points are awarded once after you submit X + Gmail."}
                  </p>
                </div>


                {/* Existing registrants see their persisted proof ID and review state. */}
                {walletConnected && (earlyAccessState === "pending" || earlyAccessState === "granted") && activeProofCode && (
                  <section className="rounded-xl border border-[#35465b] bg-[#101722] p-3.5 space-y-3" aria-label="X account verification">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs font-bold tracking-wide text-[#e6efff]">X Account Verification</h3>
                      <span className={xVerificationStatus === "verified" ? "text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 bg-emerald-500/10" :
                        xVerificationStatus === "rejected" ? "text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-500/40 text-rose-300 bg-rose-500/10" :
                        "text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-400/30 text-amber-200 bg-amber-400/10"}>
                        {xVerificationStatus === "verified" ? "Verified" : xVerificationStatus === "rejected" ? "Needs review" : "Pending manual review"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 border border-[#35465b] bg-[#0B0D10] rounded-lg px-3 py-2">
                        <span className="text-[9px] text-[#a8b6c7] block mb-0.5">Registered X username</span>
                        <span className="font-semibold text-xs text-white truncate block">{registeredXUsername || "—"}</span>
                      </div>
                      <button type="button" onClick={() => { void copyXVerificationPost(); }} disabled={!xPostText}
                        className="hidedex-ea-action inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg bg-[#2269c9] border border-[#3c7cdc] px-3 py-3 text-xs text-white font-bold disabled:opacity-50"
                        aria-label="Copy unique X verification post">
                        {xCopyFeedback === "copied" ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>}
                        {xCopyFeedback === "copied" ? "Copied" : "Copy Post"}
                      </button>
                    </div>
                    <div className="text-[11px] leading-5 text-[#c6d4e7] space-y-1">
                      <p>1. Copy the short post below.</p>
                      <p>2. Publish from <strong className="text-white">{registeredXUsername}</strong> on X. Keep your wallet-derived HDX ID unchanged.</p>
                      <p>3. HideDex will review it manually. Your waitlist position and verified-volume points are separate.</p>
                    </div>
                    <div className="border border-[#35465b] bg-[#070c13] rounded-lg p-2.5">
                      <div className="text-[10px] text-[#b6c4d7] mb-1">Unique ID: <span className="font-mono font-bold text-white">{activeProofCode}</span></div>
                      <textarea readOnly aria-label="Verification post text" rows={3} value={xPostText}
                        className="w-full bg-transparent text-xs text-[#e6efff] resize-none outline-none leading-relaxed select-text"/>
                    </div>
                    <a href={"https://twitter.com/intent/tweet?text=" + encodeURIComponent(xPostText)}
                       target="_blank" rel="noopener noreferrer"
                       className="inline-flex gap-1.5 items-center justify-center w-full rounded-xl border border-[#45668a] bg-[#172b43] text-white font-bold text-xs py-2.5 hover:bg-[#20416b]">
                       Post on X <ExternalLink className="w-3.5 h-3.5"/>
                    </a>
                    {xCopyFeedback === "error" && <p role="alert" className="text-xs text-amber-300">Copy was blocked. Long-press the post text to copy.</p>}
                  </section>
                )}

                {/* Status checks when wallet is connected */}
                {walletConnected && (
                  <>
                    {/* Checking status */}
                    {earlyAccessState === "checking" && (
                      <div className="flex items-center gap-2 py-3 px-1 text-xs text-gray-500 dark:text-gray-400">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                        <span>{t("checking_early_access")}</span>
                      </div>
                    )}

                    {/* Status check error: Retry button */}
                    {earlyAccessState === "error" && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-left space-y-2">
                        <div className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Status Check Error
                        </div>
                        <p className="text-xs text-gray-300 dark:text-gray-300">
                          Unable to verify your Early Access status right now.
                        </p>
                        <button
                          type="button"
                          onClick={() => void checkEarlyAccessStatus(walletAddress)}
                          className="hidedex-ea-secondary rounded-lg bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800 dark:bg-[#0B0D10] dark:text-white dark:hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          Retry Status
                        </button>
                      </div>
                    )}

                    {/* Privacy-first waitlist status: the queue number is not shown. */}
                    {earlyAccessState === "pending" && (
                      <div
                        className="hidedex-ea-pending rounded-xl border p-4 text-left space-y-2"
                        style={{ background: "#111720", borderColor: "#33465e" }}
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="inline-block w-2 h-2 shrink-0 rounded-full bg-[#61a9ff]" />
                          <span className="text-[13px] sm:text-sm font-bold tracking-[.02em]" style={{ color: "#e5efff" }}>
                            You're on the waitlist
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed" style={{ color: "#cbd7e7" }}>
                          Your application has been received. We'll let you know when access is granted.
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: "#a7bad0" }}>
                          Your position in the waitlist is hidden.
                        </p>
                      </div>
                    )}

                    {/* Approved wallet: high-contrast, centered status. */}
                    {earlyAccessState === "granted" && (
                      <div className="rounded-2xl border p-4 sm:p-5 space-y-3 text-center" style={{background:"#09221d",borderColor:"#245d50"}}>
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#38dfaa]" aria-hidden="true" />
                          <h3 className="text-[17px] sm:text-lg font-black tracking-wide uppercase" style={{color:"#7cf3cc"}}>
                            {t("access_granted")}
                          </h3>
                        </div>
                        <p className="mx-auto max-w-[300px] text-[13px] sm:text-sm leading-relaxed font-medium" style={{color:"#e4f5f0"}}>
                          Your wallet is approved. You can now start trading on HideDex.
                        </p>
                        <button type="button" onClick={() => void handleLaunchApp()} disabled={earlyAccessBusy}
                          className="hidedex-ea-action w-full rounded-xl px-4 py-3.5 text-sm font-extrabold tracking-wide text-white cursor-pointer disabled:opacity-70"
                          aria-label="Start trading with your approved wallet">
                          {earlyAccessBusy ? "Opening Trading…" : "START TRADING"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Show Steps 2 & 3 and Submit Button when not connected OR when wallet is connected but not yet submitted (earlyAccessState === "none") */}
                {(!walletConnected || earlyAccessState === "none") && (
                  <form
                    onSubmit={(e) => {
                      if (!walletConnected) {
                        e.preventDefault();
                        handleEarlyAccessConnect();
                      } else {
                        void handleEarlyAccessSubmit(e);
                      }
                    }}
                    className="hidedex-ea-form space-y-4 pt-1"
                  >
                    <div className="flex items-center gap-3 pb-1">
                      <span className="shrink-0 text-[10px] font-extrabold tracking-[.15em] text-[#8eadd0] uppercase">Join the waitlist</span>
                      <span className="h-px flex-1 bg-[#2a3e52]" aria-hidden="true"/>
                      <span className="shrink-0 text-[10px] text-[#829bb6]">3 simple steps</span>
                    </div>
                    {/* Step 1: X / Twitter Username and transparent manual proof instructions */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <label htmlFor="hidedex-x-username" className="hidedex-ea-label text-xs font-semibold text-gray-300">
                          1. X / Twitter Username <span className="text-emerald-500">*</span>
                        </label>
                        <button type="button" title="How X verification works" aria-label="About X account verification"
                          aria-expanded={showXProofHelp} onClick={() => setShowXProofHelp(v => !v)}
                          className="text-[#8db8ef] hover:text-white rounded-full p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8db8ef]">
                          <HelpCircle className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                      {showXProofHelp && (
                        <p className="mb-2 rounded-lg border border-[#39506e] bg-[#172234] px-2.5 py-2 text-[11px] leading-relaxed text-[#cbdcf2]">
                          To verify your X username, publish the unique HDX post from the account entered here.
                          HideDex checks it manually; until then X status is Pending.
                          Joining the waitlist and verified-volume points do not depend on X approval.
                          The X post alone never authorizes trading.
                        </p>
                      )}
                      <div className="flex gap-2 items-stretch">
                        <input id="hidedex-x-username" type="text" autoComplete="off" placeholder="@your_handle"
                          value={earlyAccessX}
                          onChange={(e) => { setEarlyAccessX(e.target.value); if (earlyAccessError) setEarlyAccessError(""); }}
                          className="hidedex-ea-input flex-1 min-w-0 rounded-xl border border-gray-800 bg-[#12151B] px-3 py-2.5 text-xs text-white placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"/>
                        {formReadyForXPost && earlyAccessState === "none" && (
                          <button type="button" onClick={() => { void copyXVerificationPost(); }}
                            title="Copy your wallet's X post without signing or registering"
                            className="hidedex-ea-action inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#216bd3] px-3 py-2 text-[11px] font-bold text-white">
                            {xCopyFeedback === "copied" ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>}
                            {xCopyFeedback === "copied" ? "Copied" : "Copy Post"}
                          </button>
                        )}
                      </div>
                    </div>
                    {walletConnected && earlyAccessState === "none" && xPostText && (
                      <div className="rounded-xl border border-[#35465b] bg-[#101722] p-3 space-y-2">
                        <textarea readOnly aria-label="Your X post" rows={3} value={xPostText}
                          className="w-full bg-transparent text-xs leading-relaxed text-[#e6efff] resize-none outline-none select-text" />
                        <a href={"https://twitter.com/intent/tweet?text=" + encodeURIComponent(xPostText)}
                           target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg border border-[#45668a] bg-[#172b43] text-xs font-bold text-white py-2">
                          Post on X <ExternalLink className="w-3.5 h-3.5"/>
                        </a>
                      </div>
                    )}
                    {xCopyFeedback === "error" && earlyAccessState === "none" && (
                      <p role="alert" className="text-xs text-amber-300">Copy blocked by browser. Long-press the post to copy.</p>
                    )}

                    {/* Step 2: Gmail Address */}
                    <div>
                      <label className="hidedex-ea-label block text-xs font-semibold text-gray-300 dark:text-gray-300 mb-1">
                        2. Gmail Address <span className="text-emerald-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="name@gmail.com"
                        value={earlyAccessEmail}
                        onChange={(e) => {
                          setEarlyAccessEmail(e.target.value);
                          if (earlyAccessError) setEarlyAccessError("");
                        }}
                        className="hidedex-ea-input w-full rounded-xl border border-gray-800 bg-[#12151B] px-3 py-2.5 text-xs text-white placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-800 dark:bg-[#12151B] dark:text-white dark:placeholder:text-gray-500"
                      />
                    </div>

                    {/* Step 3: Connect wallet / ownership proof */}
                    <div>
                      <label className="hidedex-ea-label block text-xs font-semibold text-gray-300 dark:text-gray-300 mb-1">
                        3. Wallet Address <span className="text-emerald-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="text" readOnly aria-label="Connected wallet for registration"
                          placeholder="Use Connect Wallet below"
                          value={walletConnected && walletAddress
                            ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)
                            : ""}
                          className="hidedex-ea-input flex-1 min-w-0 rounded-xl border border-gray-800 bg-[#12151B] px-3 py-2.5 text-xs font-mono text-gray-300 outline-none dark:border-gray-800 dark:bg-[#12151B] dark:text-gray-300" />
                        {walletConnected && walletAddress && (
                          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">Connected</span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#b6c4d7]">
                        One wallet can enroll once. Enrollment requires a free wallet-ownership signature.
                      </p>
                    </div>

                    {/* Error Message */}
                    {earlyAccessError && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                        {earlyAccessError}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type={walletConnected ? "submit" : "button"}
                      onClick={!walletConnected ? handleEarlyAccessConnect : undefined}
                      disabled={walletConnected && earlyAccessBusy}
                      className="hidedex-ea-action w-full rounded-xl bg-black py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-transform active:scale-[0.99] hover:bg-gray-900 disabled:opacity-60 dark:bg-[#0B0D10] dark:text-white dark:hover:bg-gray-800 cursor-pointer"
                    >
                      {!walletConnected
                        ? t("connect_wallet")
                        : earlyAccessBusy
                        ? "Submitting..."
                        : t("submit_early_access")}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
