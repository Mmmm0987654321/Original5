import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Wallet, TrendingUp, Unlock, Lock, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown, X, ShieldCheck, Copy, Check, Eye, EyeOff, BarChart3, Share2 } from "lucide-react";
import { TrustShieldValue } from "../common/TrustShieldValue";
import HideDexFundsOverview from "../dashboard/HideDexFundsOverview";
import HideDexAssetAllocation from "../dashboard/HideDexAssetAllocation";
import HideDexFundsPerformance, {type HideDexPerformancePeriod, type HideDexPerformanceMarket} from "../dashboard/HideDexFundsPerformance";
import HideDexFundsModalHeader from "../dashboard/HideDexFundsModalHeader";
import {HideDexFundingNetworkAsset,HideDexFundingDestination,HideDexFundingAmount,HideDexFundingPresets,HideDexFundingSubmit,HideDexFundingFeeCard} from "../dashboard/HideDexFundingFields";
import AnalyticsPanel, { DailyFillVolumeBars } from "../dashboard/AnalyticsPanel";
import HideDexPerformanceAreaChart from "../dashboard/HideDexPerformanceAreaChart";
import {getLighterPublicAnalytics,type LighterPublicAnalytics} from "../../lib/lighterPublicAnalytics";
import {
  registerLighterTradingKey, reconnectLighterTradingKey, getActiveLighterSigner,
  clearLighterTradingKey, submitLighterOrder, withdrawLighterUsdc,
  getLighterSignedOpenOrders, getLighterSignedTradeHistory, cancelLighterSignedOrder,
  verifyLighterTradingKey, updateLighterPerpMargin, setLighterPositionTriggers,
  lighterPositionTriggerKind, matchesLighterPositionTrigger, type LighterTradingIdentity,
} from "../../lib/lighterTrading";
import { depositLighterUsdcOnEthereum, depositLighterUsdcFromArbitrum, quoteLighterEthereumDepositNetworkFee, type LighterWalletProvider } from "../../lib/lighterFunding";
import TVChart from "./TVChart";
import TopOrderBookView from "./TopOrderBookView";
import MarketsPanel from "../dashboard/MarketsPanel";
import GeneralDashboard from "../dashboard/GeneralDashboard";
import TradingAccountTabBar, { type TradingTabId } from "./TradingAccountTabBar";
import HideDexUnifiedAccountPanel from "./HideDexUnifiedAccountPanel";
import HideDexTradingAuthorizationSheet from "./HideDexTradingAuthorizationSheet";
import HideDexPositionActionBar, {type HideDexPositionSort} from "./HideDexPositionActionBar";
import HideDexCancelAllOrdersBar from "./HideDexCancelAllOrdersBar";
import HideDexPositionHeader from "./HideDexPositionHeader";
import HideDexPositionCard from "./HideDexPositionCard";
import HideDexPositionDetails from "./HideDexPositionDetails";
import HideDexTradeHistory, {type HideDexHistoryRow} from "./HideDexTradeHistory";
import {rememberLighterSigner,readRememberedLighterSigner,forgetRememberedLighterSigner} from "../../lib/lighterDeviceKey";
import CloseAllConfirmationModal from "./CloseAllConfirmationModal";
import ClosePositionModal from "./ClosePositionModal";
import TpSlModal from "./TpSlModal";
import ShareCardPopup from "./share/ShareCardManager";
import type {Position} from "../../types";
import HideDexTradingToast from "./HideDexTradingToast";
import HideDexPlaceOrderButton from "./HideDexPlaceOrderButton";
import HideDexFundsDialogShell from "../dashboard/HideDexFundsDialogShell";
import HideDexOpenOrders, {type HideDexOpenOrderRow} from "./HideDexOpenOrders";
import HideDexBalancesView, {type HideDexBalanceItem} from "./HideDexBalancesView";
import HideDexTradeSelectors, { type TradeOrderType } from "./HideDexTradeSelectors";
import HideDexUnifiedMarketHeader from "./HideDexUnifiedMarketHeader";
import HideDexUnifiedTradeCanvas from "./HideDexUnifiedTradeCanvas";
import HideDexUnifiedMarketView from "./HideDexUnifiedMarketView";
import HideDexUnifiedOrderForm from "./HideDexUnifiedOrderForm";
import HideDexOrderSummary from "./HideDexOrderSummary";
import HideDexPositionActions from "./HideDexPositionActions";
import HideDexDisconnectedOverlay from "./HideDexDisconnectedOverlay";
import HideDexOrderBookPanel, {type HideDexBookLevel} from "./HideDexOrderBookPanel";
import {HideDexTradeGrid,HideDexOrderForm,HideDexTopMarketPane} from "./HideDexTradeLayout";
import {HideDexTradePercentPresets,HideDexTradeOptionToggle} from "./HideDexTradeOptions";
import HideDexTradeTriggerPrice from "./HideDexTradeTriggerPrice";
import HideDexTradeOutcomeInput from "./HideDexTradeOutcomeInput";
import HideDexMobileMarketHeader from "./HideDexMobileMarketHeader";
import HideDexDesktopMarketBar from "./HideDexDesktopMarketBar";
import HideDexMarketInfoDropdown from "./HideDexMarketInfoDropdown";
import { HideDexSideAndAvailability, HideDexBasicOrderInputs } from "./HideDexTradeEntry";
import { ActiveTab, type TokenMetadata } from "../../types";
import MarketSelector, { renderAssetLogo } from "./MarketSelector";
import {
  getLighterAccountIndexes, getLighterMarkets, getLighterPublicAccounts,
  subscribeLighterBook,
  type LighterMarket, type LighterMarketFeed, type LighterPublicAccount,
} from "../../lib/lighterMarketData";
import {verifiedLighterLeverage,lighterInitialRequirement,lighterCrossAccountMarginRatio,estimateLighterDraftLiq} from "../../lib/lighterMarginDisplay";

type Section = "dashboard" | "markets" | "trade" | "funds" | "account" | "orders";
type Kind = "perp" | "spot";
type Props = {
  walletAddress: string;
  getWalletProvider: () => Promise<LighterWalletProvider>;
  onConnectWallet: () => void;
  section: Section;
  initialKind?: Kind;
  onSelectSection: (section: Section, marketKind?: Kind) => void;
  onMarketCatalog?:(tokens:TokenMetadata[])=>void;
  watchlist?:readonly string[];
  onToggleFavorite?:(symbol:string)=>void;
  sidebarMarketRequest?:{symbol:string;nonce:number}|null;
  initialOrdersTab?: "OPEN_ORDERS"|"TRADE_HISTORY";
};

const emptyBook: LighterMarketFeed = {
  status: "connecting", bids: [], asks: [], recentTradePrice: null,
};
function formatPrice(value: number | null | undefined, digits = 8): string {
  return value != null && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
}
function labelKind(kind: Kind) { return kind === "perp" ? "Perpetual" : "Spot"; }

/**
 * Lighter pages use HideDex's existing chart and the same market/order-panel
 * composition as the main terminal. Every number comes from Lighter mainnet.
 * No Hyperliquid wallet balance, signing method or order callback is imported.
 * Trade form is intentionally not executable until browser WASM signing and
 * per-wallet API-key registration can be verified end-to-end.
 */
export default function LighterMarketPreview({
  walletAddress, getWalletProvider, onConnectWallet, section, initialKind = "perp", onSelectSection,
  onMarketCatalog,watchlist=[],onToggleFavorite,sidebarMarketRequest,initialOrdersTab,
}: Props) {
  const [markets, setMarkets] = useState<LighterMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [lastPerpMarketId, setLastPerpMarketId] = useState<number | null>(null);
  const [lastSpotMarketId, setLastSpotMarketId] = useState<number | null>(null);
  const [marketSelectorOpen, setMarketSelectorOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [publicAccounts, setPublicAccounts] = useState<LighterPublicAccount[] | null>(null);
  const [feed, setFeed] = useState<LighterMarketFeed>(emptyBook);
  const [viewMode, setViewMode] = useState<"chart" | "orderbook">("chart");
  const [accountTab, setAccountTab] = useState<TradingTabId>(()=>section==="orders" ? initialOrdersTab??"OPEN_ORDERS" : "POSITIONS");
  // Original4 has distinct Orders and Trade History pages; use the same intended
  // selected tab when navigating directly, without remounting a signer or wallet.
  useEffect(()=>{
    if(section==="orders") setAccountTab(initialOrdersTab??"OPEN_ORDERS");
  },[section,initialOrdersTab]);
  const [expandedPositions, setExpandedPositions] = useState<Record<string, boolean>>({});
  const [closeAllPositionsOpen,setCloseAllPositionsOpen]=useState(false);
  const [pendingBulkClose,setPendingBulkClose]=useState<{
    accountIndex:number;positions:Array<{symbol:string;signedSize:number}>;
  }|null>(null);
  const [cancelAllOrdersOpen,setCancelAllOrdersOpen]=useState(false);
  const [restoringSavedSigner,setRestoringSavedSigner]=useState(false);
  const [positionSort, setPositionSort] = useState<HideDexPositionSort>("DEFAULT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  // One automatic prompt per wallet per mounted visit; a dismissed sheet
  // only reopens on an explicit Place action with a valid order size.
  const promptedWallets=useRef<Set<string>>(new Set());
  const [signerRestore,setSignerRestore]=useState<{
    wallet:string;complete:boolean;hasSaved:boolean;
  }>({wallet:"",complete:false,hasSaved:false});
  const [isMarketInfoOpen, setIsMarketInfoOpen] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState<HideDexPerformancePeriod>("day");
  const [performanceMarket, setPerformanceMarket] = useState<HideDexPerformanceMarket>("all");
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [chosenLeverage, setChosenLeverage] = useState(1);
  const [marginBusy, setMarginBusy] = useState(false);
  const [, setMarginStatus] = useState("");
  const acknowledgedMarginRef=useRef<string|null>(null);
  const latestMarginRequestRef=useRef<string|null>(null);
  const marginFlightRef=useRef<Promise<boolean>|null>(null);
  const marginRetryUntilRef=useRef(0);
  const [marginIntent,setMarginIntent]=useState<{
    key:string;marketId:number;leverage:number;mode:"cross"|"isolated";attempt:number;
  }|null>(null);
  const [amount, setAmount] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"USD" | "COIN">("USD");
  const [hideBalance, setHideBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [bookGroup, setBookGroup] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [orderBookSizeUnit, setOrderBookSizeUnit] = useState<"USD" | "COIN">("USD");
  const [fundsModal, setFundsModal] = useState<"deposit" | "withdraw" | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositFeeQuote, setDepositFeeQuote] = useState<string|null>(null);
  const [depositNetwork, setDepositNetwork] = useState<"arbitrum" | "ethereum">("arbitrum");
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingStatus, setFundingStatus] = useState("");
  const [accountReload, setAccountReload] = useState(0);
  const [tradingIdentity, setTradingIdentity] = useState<LighterTradingIdentity | null>(
    () => getActiveLighterSigner(walletAddress));
  const [tradingBusy, setTradingBusy] = useState(false);
  const [tradingNotice, setTradingNotice] = useState("");
  const [noticeKind,setNoticeKind]=useState<"success"|"error"|"pending">("success");
  const [noticeTitle,setNoticeTitle]=useState("Lighter");
  const [awaitingFill,setAwaitingFill]=useState<{
    accountIndex:number;marketId:number;symbol:string;
    side:"buy"|"sell";since:number;txHash?:string;kind:"perp"|"spot";
  }|null>(null);
  const [uncertainPosition,setUncertainPosition]=useState<{
    accountIndex:number;symbol:string;previousSize:number;
  }|null>(null);
  // State reconciliation uses read-only Lighter endpoints. No signed order is
  // ever re-sent by a timeout or a refresh.
  const refreshTimersRef=useRef<number[]>([]);
  const loadedAccountWalletRef=useRef("");
  const refreshAfterLighterWrite=()=>{
    refreshTimersRef.current.forEach(id=>window.clearTimeout(id));
    refreshTimersRef.current=[];
    setAccountReload(v=>v+1);
    for(const wait of [1700,4300,9000]){
      refreshTimersRef.current.push(window.setTimeout(()=>setAccountReload(v=>v+1),wait));
    }
  };
  useEffect(()=>()=>refreshTimersRef.current.forEach(id=>window.clearTimeout(id)),[]);
  const [shareTarget,setShareTarget]=useState<{accountIndex:number;symbol:string;signedSize:number}|null>(null);
  const [tpSlTarget,setTpSlTarget]=useState<{accountIndex:number;symbol:string;signedSize:number}|null>(null);
  const [singleCloseTarget,setSingleCloseTarget]=useState<{
    accountIndex:number;symbol:string;signedSize:number;
  }|null>(null);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [attachTpSl, setAttachTpSl] = useState(false);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [tpUnit,setTpUnit] = useState<"%"|"$">("%");
  const [slUnit,setSlUnit] = useState<"%"|"$">("%");
  const [tpGainInput,setTpGainInput] = useState("");
  const [slLossInput,setSlLossInput] = useState("");
  const [showTpUnitDropdown,setShowTpUnitDropdown] = useState(false);
  const [showSlUnitDropdown,setShowSlUnitDropdown] = useState(false);
  const [openOrdersError, setOpenOrdersError] = useState("");
  const [liveOrders, setLiveOrders] = useState<Awaited<ReturnType<typeof getLighterSignedOpenOrders>> | null>(null);
  const [liveFills,setLiveFills]=useState<Awaited<ReturnType<typeof getLighterSignedTradeHistory>>|null>(null);
  const [fillsLoading,setFillsLoading]=useState(false);
  const [fillsError,setFillsError]=useState("");
  const [publicAnalytics,setPublicAnalytics]=useState<LighterPublicAnalytics|null>(null);
  const [publicAnalyticsError,setPublicAnalyticsError]=useState("");
  const [publicAnalyticsLoading,setPublicAnalyticsLoading]=useState(false);

  useEffect(() => {
    let stopped=false;
    const activeSigner=getActiveLighterSigner(walletAddress);
    if(!activeSigner)clearLighterTradingKey();
    setTradingIdentity(activeSigner);
    setRecoveryKey("");setLiveOrders(null);setLiveFills(null);
    setTradingNotice("");setAuthSheetOpen(false);
    const normalizedWallet=walletAddress.toLowerCase();
    setSignerRestore({wallet:normalizedWallet,complete:false,hasSaved:Boolean(activeSigner)});
    setRestoringSavedSigner(Boolean(walletAddress&&!activeSigner));
    if(!walletAddress || activeSigner){
      setRestoringSavedSigner(false);
      setSignerRestore({wallet:normalizedWallet,complete:true,hasSaved:Boolean(activeSigner)});
      return;
    }
    // The device keeps only encrypted API-key ciphertext. Verify the decrypted
    // key with Lighter every time; do not open an authorization popup.
    readRememberedLighterSigner(walletAddress).then(async saved=>{
      if(stopped)return;
      setSignerRestore({wallet:normalizedWallet,complete:false,hasSaved:Boolean(saved)});
      if(!saved)return;
      const identity=await reconnectLighterTradingKey({
        walletAddress,accountIndex:saved.accountIndex,apiKeyIndex:saved.apiKeyIndex,
        apiPrivateKey:saved.apiPrivateKey,
      });
      if(!stopped)setTradingIdentity(identity);
      else clearLighterTradingKey();
    }).catch(()=>{
      // No stored/valid signer: user can authorize once explicitly.
      // A public account is still readable without trading registration.
      if(!stopped)setTradingIdentity(null);
    }).finally(()=>{
      if(!stopped){
        setRestoringSavedSigner(false);
        setSignerRestore(previous=>previous.wallet===normalizedWallet?
          {...previous,complete:true}:previous);
      }
    });
    return ()=>{stopped=true;};
  },[walletAddress]);

  // Wait for the local signer lookup to finish before opening a sheet. A saved
  // device key gets a silent verification attempt; never auto-register a new
  // key just because the verification endpoint is temporarily unavailable.
  useEffect(()=>{
    if(section!=="trade"||!walletAddress||!signerRestore.complete||
      signerRestore.wallet!==walletAddress.toLowerCase()||
      signerRestore.hasSaved||restoringSavedSigner||tradingIdentity)return;
    const key=walletAddress.toLowerCase();
    if(promptedWallets.current.has(key))return;
    promptedWallets.current.add(key);
    setAuthSheetOpen(true);
  },[section,walletAddress,signerRestore,restoringSavedSigner,tradingIdentity]);

  // Keep transaction/status feedback out of the Trade layout and dismiss
  // automatically; the modal retains registration/recovery instructions.
  useEffect(() => {
    if (!tradingNotice || authSheetOpen || uncertainPosition || awaitingFill) return;
    const id=window.setTimeout(()=>setTradingNotice(""),8000);
    return ()=>window.clearTimeout(id);
  },[tradingNotice,authSheetOpen,uncertainPosition,awaitingFill]);

  const beginLighterAuthorization = async () => {
    if (!walletAddress || tradingBusy) return;
    setTradingBusy(true); setTradingNotice("");
    try {
      const { identity, recoveryKey: secret } = await registerLighterTradingKey({
        walletAddress, getWalletProvider,
      });
      setTradingIdentity(identity);
      try {
        localStorage.setItem("hidedex:lighter:key-ref:"+walletAddress.toLowerCase(), JSON.stringify({
          accountIndex:identity.accountIndex,apiKeyIndex:identity.apiKeyIndex,
        }));
      } catch { /* Optional public reference only; key remains memory-only. */ }
      setRecoveryKey(secret); // Backup remains accessible if the user opens settings.
      try {
        await rememberLighterSigner(walletAddress,{
          accountIndex:identity.accountIndex,apiKeyIndex:identity.apiKeyIndex,apiPrivateKey:secret,
        });
        setAuthSheetOpen(false);
        setTradingNotice("Lighter enabled. Signing key encrypted on this browser device. "+
          "Save a separate backup; cleared browser data requires reconnecting.");
      } catch {
        // Never silently lose the only copy of a withdrawal-capable key.
        setAuthSheetOpen(true);
        setTradingNotice("Local encrypted storage unavailable. Please save your Lighter recovery key securely.");
      }
      setAccountReload(v => v + 1);
    } catch (e) {
      setTradingNotice(e instanceof Error ? e.message : "Lighter authorization failed.");
    } finally { setTradingBusy(false); }
  };
  const submitTrade = async () => {
    if (!walletAddress || !selected || tradingBusy) return;
    if(uncertainPosition){
      setNoticeKind("pending");
      setTradingNotice("Previous Lighter order is still being verified. Avoid duplicate trades; check Positions/Orders.");
      return;
    }
    if (!marketPrice || feed.status !== "live" || !(sizeInCoin > 0) ||
        (reduceOnly && !hasReduciblePosition) ||
        (attachTpSl && (!takeProfit.trim() && !stopLoss.trim())) ||
        (orderType === "limit" && !(Number(limitPrice) > 0))) {
      setTradingNotice("Choose a live Lighter market with a valid order size and limit price.");
      return;
    }
    if (!tradingIdentity) {
      setTradingNotice("");
      setAuthSheetOpen(true);
      return;
    }
    if(kind==="perp"&&accountsLoading){
      setTradingNotice("Checking existing Lighter leverage. Try Place again shortly.");
      return;
    }
    // Check the real per-market setting before attempting any margin write.
    if(kind==="perp"&&(chosenLeverage>1||latestMarginRequestRef.current!==null)){
      const request={key:marginKey(selected.id,chosenLeverage,marginMode),
        marketId:selected.id,leverage:chosenLeverage,mode:marginMode,attempt:0};
      if(!await applyLighterMargin(request)){
        setTradingNotice(acknowledgedMarginRef.current===request.key?
          "Waiting for Lighter to confirm "+request.leverage+"x "+request.mode+" leverage. No order sent; account will refresh automatically.":
          "Lighter has not confirmed the requested leverage. No order sent. "+
          (marginRetryUntilRef.current>Date.now()?"Wait for the API rate-limit cooldown.":"Check your Lighter account settings."));
        return;
      }
    }
    // Place LONG/SHORT is already an explicit user action, exactly like
    // Hyperliquid's original terminal. Do not open Android's native dialog.
    const previousSize=publicAccounts?.find(a=>a.index===tradingIdentity.accountIndex)
      ?.positions.find(p=>p.symbol===selected.symbol)?.signedSize??0;
    const fillTarget={accountIndex:tradingIdentity.accountIndex,marketId:selected.id,
      symbol:selected.symbol,side,since:Date.now()-1500,kind};
    setTradingBusy(true);setNoticeKind("pending");
    setNoticeTitle(selected.symbol+" "+(kind==="perp"?"Perpetual":"Spot")+" "+(side==="buy"?"Buy":"Sell")+" Order — Submitting...");
    setTradingNotice("Quantity: ~"+formatPrice(sizeInCoin,8)+" "+selected.symbol+
      "\nValue: "+formatPrice(sizeInCoin*marketPrice,2)+" USDC");
    try {
      const tx = await submitLighterOrder({
        walletAddress, market: selected, side, type: orderType,
        coinSize: sizeInCoin, limitPrice: Number(limitPrice),
        referencePrice: marketPrice, reduceOnly,
        takeProfit:attachTpSl && takeProfit.trim() ? Number(takeProfit) : undefined,
        stopLoss:attachTpSl && stopLoss.trim() ? Number(stopLoss) : undefined,
      });
      setNoticeKind("success");
      setNoticeTitle(selected.symbol+" "+(kind==="perp"?"Perpetual":"Spot")+
        " "+(side==="buy"?"Buy":"Sell")+" Order Submitted");
      setAwaitingFill({...fillTarget,txHash:tx});
      setTradingNotice("Quantity: ~"+formatPrice(sizeInCoin,8)+" "+selected.symbol+
        "\nValue: "+formatPrice(sizeInCoin*marketPrice,2)+" USDC");
      setAmount("");
      refreshAfterLighterWrite();
    } catch (e) {
      const message=e instanceof Error?e.message:String(e);
      if(/didn['’]t use volume quota/i.test(message)){
        // An ambiguous sendTx response is NOT proof of a rejected order:
        // reconcile Lighter's actual position before another manual order.
        setUncertainPosition({accountIndex:tradingIdentity.accountIndex,
          symbol:selected.symbol,previousSize});
        setAwaitingFill(fillTarget);
        // No second oversized status toast. Keep the uncertainty guard and
        // reconcile real signer-owned fills / positions / open orders quietly.
        // Never retry a signed order from a timer.
        setTradingNotice("");
        refreshAfterLighterWrite();
      }else{
        setNoticeKind("error");
        setTradingNotice(message||"Lighter rejected order.");
      }
    } finally { setTradingBusy(false); }
  };
  const submitWithdrawal = async () => {
    if (!walletAddress || !tradingIdentity || fundingBusy) return;
    const n = Number(withdrawAmount);
    if (!Number.isFinite(n) || n <= 0) { setFundingStatus("Enter a valid USDC amount."); return; }
    // The shared Funds withdrawal sheet shows amount and verified destination;
    // its Withdraw Assets button is the explicit approval, not a second popup.
    setFundingBusy(true); setFundingStatus("Verifying Lighter owner and available USDC…");
    try {
      const tx = await withdrawLighterUsdc({ walletAddress, amount: withdrawAmount });
      setFundingStatus("Lighter accepted a secure Ethereum withdrawal request: " + tx + ". Settlement to your owner wallet is pending; check withdrawal history before retrying.");
      setWithdrawAmount(""); setAccountReload(v => v + 1);
    } catch (e) {
      const message=e instanceof Error?e.message:String(e);
      if(/collateral|withdrawable|invalid route type/i.test(message)){
        // A rejected or uncertain withdrawal must not be re-signed
        // automatically. Refresh only the exchange account state.
        refreshAfterLighterWrite();
        try {
          const [latest]=await getLighterPublicAccounts([tradingIdentity.accountIndex]);
          if(latest)setPublicAccounts(previous=>previous?.map(a=>
            a.index===latest.index?latest:a)??[latest]);
        }catch{/* A failed account read cannot verify a debit or credit. */}
      }
      setFundingStatus(message||"Lighter withdrawal is not verified. Check withdrawal history before retrying.");
    } finally { setFundingBusy(false); }
  };

  const closeLighterPosition = async (accountIndex: number, symbol: string, signedSize: number, closePercent: number) => {
    // The shared modal calls this only after the user's final approval.
    // If wallet or signer changes while it is open, fail visibly, never close it.
    if (!walletAddress || tradingBusy || !tradingIdentity)
      throw new Error("Reconnect the authorized Lighter wallet to close this position.");
    if (accountIndex !== tradingIdentity.accountIndex)
      throw new Error("Select the verified signer for this Lighter subaccount.");
    const m = markets.find(row => row.kind === "perp" && row.symbol === symbol);
    if (!m || !Number.isFinite(signedSize) || signedSize === 0 ||
        !(m.lastTradePrice && m.lastTradePrice > 0))
      throw new Error("Cannot verify a live Lighter market and size for this close.");
    // Re-read the REAL signer account before closing. Never send an obsolete
    // full-close size from a stale card or a second close for a flat position.
    const [latestAccount]=await getLighterPublicAccounts([accountIndex]);
    if(!latestAccount)
      throw new Error("Lighter account verification unavailable. No close was sent.");
    const latest=latestAccount.positions.find(p=>p.symbol===symbol);
    if(!latest){
      setTradingNotice("");
      refreshAfterLighterWrite();
      return;
    }
    if(Math.sign(latest.signedSize)!==Math.sign(signedSize)||
       Math.abs(latest.signedSize)>Math.abs(signedSize)+1e-10)
      throw new Error("The position changed since this Close panel opened. Refreshing before another close.");
    // Each percent close uses the latest verified real account size and native
    // Lighter market size precision; reduce-only prevents a position reversal.
    if(!Number.isInteger(closePercent)||closePercent<1||closePercent>100)
      throw new Error("Invalid closing percentage.");
    const fullSize=Math.abs(latest.signedSize);
    const step=Math.pow(10,-m.sizeDecimals);
    const rounded=closePercent===100?fullSize:
      Math.floor((fullSize*closePercent/100+step*1e-7)/step)*step;
    const coinSize=Number(rounded.toFixed(Math.min(12,Math.max(0,m.sizeDecimals))));
    if(!(coinSize>0)||coinSize>fullSize+step*1e-6)
      throw new Error("Close amount is below the verified Lighter minimum size.");
    setTradingNotice(""); // ClosePositionModal owns the spinner.
    setTradingBusy(true);
    try {
      const tx = await submitLighterOrder({
        walletAddress, market:m, side:signedSize > 0 ? "sell":"buy",
        type:"market", coinSize, referencePrice:m.lastTradePrice, reduceOnly:true,
      });
      // The shared ClosePositionModal spinner remains active until the
      // real Lighter account confirms the requested reduction (or full flat).
      let verifiedClosed=false;
      for(const delay of [900,1600,2600,3900]){
        await new Promise<void>(resolve=>window.setTimeout(resolve,delay));
        try{
          const [accountAfter]=await getLighterPublicAccounts([accountIndex]);
          if(accountAfter){
            const after=accountAfter.positions.find(x=>x.symbol===symbol);
            const afterSize=after?Math.abs(after.signedSize):0;
            const expectedRemaining=Math.max(0,fullSize-coinSize);
            // Never mistake a flipped or increased position for a successful close.
            if((!after || Math.sign(after.signedSize)===Math.sign(latest.signedSize)) &&
               afterSize<=expectedRemaining+step*0.5){
              verifiedClosed=true;break;
            }
          }
        }catch{/* Only authoritative reads; never resend a signed close. */}
      }
      refreshAfterLighterWrite();
      if(!verifiedClosed)
        throw new Error("Close submitted but final Lighter position reduction is not verified yet. Check Positions before another close.");
      setTradingNotice("");
    } catch (e) {
      const message=e instanceof Error?e.message:String(e);
      if(/didn['’]t use volume quota/i.test(message)){
        setNoticeKind("pending");
        setUncertainPosition({accountIndex,symbol,previousSize:latest.signedSize});
        setTradingNotice(""); // Shared modal retains ambiguous-status error.
        refreshAfterLighterWrite();
        throw new Error("Close status pending verification. Do not repeat: waiting for live Lighter positions.");
      }
      setNoticeKind("error");
      setTradingNotice(message||"Lighter close rejected.");
      refreshAfterLighterWrite();
      throw e;
    } finally { setTradingBusy(false); }
  };

  /** One confirmation submits exactly one reduce-only close per verified market.
   * The signer requires serialized writes; two close requests are not an atomic
   * exchange order. Ambiguous responses are reconciled with READS, not retried.
   */
  const closeAllLighterPositions=async():Promise<void>=>{
    if(!walletAddress||!tradingIdentity||tradingBusy||pendingBulkClose)
      throw new Error("A Lighter close is already processing. Wait for live position verification.");
    setTradingBusy(true);
    let submitted=0;
    let targets:Array<{symbol:string;signedSize:number}>=[];
    let signerIndex=tradingIdentity.accountIndex;
    const issues:string[]=[];
    try{
      const owned=await getLighterAccountIndexes(walletAddress);
      if(!owned.includes(signerIndex))
        throw new Error("Unverified Lighter signer account. No orders sent.");
      const allAccounts=await getLighterPublicAccounts(owned);
      if(allAccounts.some(a=>a.index!==signerIndex&&a.positions.length>0))
        throw new Error("Other Lighter subaccounts have positions. Select their authorized signer separately.");
      const account=allAccounts.find(a=>a.index===signerIndex);
      if(!account?.positions.length){
        setCloseAllPositionsOpen(false);
        return;
      }
      const catalog=await getLighterMarkets();
      targets=account.positions.map(({symbol,signedSize})=>({symbol,signedSize}));
      if(targets.some(t=>!Number.isFinite(t.signedSize)||t.signedSize===0||
        !catalog.some(m=>m.kind==="perp"&&m.symbol===t.symbol&&m.lastTradePrice&&m.lastTradePrice>0)))
        throw new Error("An open position is missing a verified market or close size. No orders sent.");
      // One user approval covers ALL positions in this verified signer account.
      setPendingBulkClose({accountIndex:signerIndex,positions:targets});
      for(const target of targets){
        const market=catalog.find(m=>m.kind==="perp"&&m.symbol===target.symbol);
        if(!market?.lastTradePrice)continue; // preflight verified these
        try{
          // Revalidate each position before signing, so a filled/changed
          // position cannot be accidentally closed twice.
          const [fresh]=await getLighterPublicAccounts([signerIndex]);
          const active=fresh?.positions.find(p=>p.symbol===target.symbol);
          if(!fresh) {issues.push(target.symbol);continue;}
          if(!active)continue; // Already flat.
          if(Math.sign(active.signedSize)!==Math.sign(target.signedSize)||
             Math.abs(active.signedSize)>Math.abs(target.signedSize)+1e-10){
            issues.push(target.symbol);continue;
          }
          await submitLighterOrder({
            walletAddress,market,side:active.signedSize>0?"sell":"buy",
            type:"market",coinSize:Math.abs(active.signedSize),
            referencePrice:market.lastTradePrice,reduceOnly:true,
          });
          submitted++;
        }catch(error){
          // Lighter may report a volume-quota note after accepting a write.
          // This never justifies a second signed close for the same symbol.
          issues.push(target.symbol);
        }
      }
      // Confirm whether ALL targeted positions are flat using exchange reads.
      // Reconciliation remains read-only even if an SDK response was ambiguous.
      for(const delay of [800,1700,3000,4500]){
        await new Promise<void>(resolve=>window.setTimeout(resolve,delay));
        try{
          const [latest]=await getLighterPublicAccounts([signerIndex]);
          if(latest){
            setPublicAccounts(current=>current?.map(a=>a.index===latest.index?latest:a)??[latest]);
            if(targets.every(t=>!latest.positions.some(p=>p.symbol===t.symbol&&
              Math.abs(p.signedSize)>1e-10))){
              setPendingBulkClose(null);
              setTradingNotice("");
              setCloseAllPositionsOpen(false);
              return;
            }
          }
        }catch{/* A read failure is never a reason to resend signed closes. */}
      }
      // Keep the confirmation view safe while pending and allow account
      // refreshes to close it automatically when all positions turn flat.
      throw new Error("Close requests processed for "+targets.length+
        " positions. Verification is still pending for some. The list refreshes automatically; no repeat close was sent.");
    }catch(error){
      if(!targets.length){
        setPendingBulkClose(null);
        throw error;
      }
      // Protect users from raw SDK JSON and misleading partial success.
      if(submitted===0&&issues.length===0)setPendingBulkClose(null);
      if(error instanceof Error && error.message.startsWith("Close requests processed"))throw error;
      throw new Error("Some Lighter positions are not yet verified closed. Check the live Positions list before another close; no automatic duplicate order was sent.");
    }finally{
      refreshAfterLighterWrite();
      setTradingBusy(false);
    }
  };

  /** Confirmed user action; cancel only orders belonging to the verified
   * active Lighter signer account. No other wallet or venue is affected.
   */
  const cancelAllLighterOrders = async ():Promise<void> => {
    if(!walletAddress||!tradingIdentity||tradingBusy)
      throw new Error("Authorize the correct Lighter signer before cancelling orders.");
    setTradingBusy(true);
    let acceptedCount=0;
    try {
      const owned=await getLighterAccountIndexes(walletAddress);
      if(!owned.includes(tradingIdentity.accountIndex))
        throw new Error("Lighter signing account ownership could not be verified.");
      const live=await getLighterSignedOpenOrders(walletAddress);
      if(!live.length)throw new Error("No active Lighter orders remain.");
      const catalog=await getLighterMarkets();
      const targets=live.map(order=>{
        const marketIndex=Number(order.market_index??order.market_id);
        const orderIndex=Number(order.order_index);
        const market=catalog.find(item=>item.id===marketIndex);
        return {market,orderIndex};
      });
      if(targets.some(row=>!row.market || !Number.isSafeInteger(row.orderIndex) || row.orderIndex<0))
        throw new Error("Unverified Lighter order identifier: no cancellations sent.");
      for(const {market,orderIndex} of targets){
        if(!market)throw new Error("Lighter market no longer verified.");
        await cancelLighterSignedOrder({walletAddress,market,orderIndex});
        acceptedCount++;
      }
      // The live Open Orders count/list confirms the result without a toast.
      setTradingNotice("");
    }catch(e){
      throw new Error((acceptedCount?acceptedCount+" cancellations already accepted. ":"")+
        (e instanceof Error?e.message:"Cancel All failed."));
    }finally{
      refreshAfterLighterWrite();
      setTradingBusy(false);
    }
  };

  const requestLighterPositionClose = (accountIndex:number,symbol:string,signedSize:number) => {
    if(!walletAddress||tradingBusy)return;
    if(!tradingIdentity){setTradingNotice("");setAuthSheetOpen(true);return;}
    if(tradingIdentity.accountIndex!==accountIndex){
      setTradingNotice("Select the Lighter signer for this account first.");return;
    }
    const market=markets.find(row=>row.kind==="perp"&&row.symbol===symbol);
    if(!market||!(market.lastTradePrice&&market.lastTradePrice>0)||
      !Number.isFinite(signedSize)||signedSize===0){
      setTradingNotice("Verified position and market are required to close.");return;
    }
    setSingleCloseTarget({accountIndex,symbol,signedSize});
  };

  const cancelLighterOrder = async (marketId: number, orderIndex: number) => {
    const m = markets.find(row => row.id === marketId);
    if (!m || !Number.isSafeInteger(orderIndex) || orderIndex < 0 ||
        !walletAddress || !tradingIdentity || tradingBusy) return;
    // The row's explicit Cancel button uses the original HideDex action.
    setTradingBusy(true); setOpenOrdersError("");
    try {
      // Cancellation status belongs in the Orders list, never a success toast.
      await cancelLighterSignedOrder({walletAddress,market:m,orderIndex});
      setTradingNotice("");
      setOpenOrdersError("");
    } catch(e) {
      const message=e instanceof Error?e.message:String(e);
      setOpenOrdersError(/didn['’]t use volume quota|ratelimit/i.test(message)?
        "Lighter order status is uncertain. Checking Open Orders automatically; do not resend yet.":message);
    } finally {
      // Even if the signed API responds with a quota note, never require a
      // manual page refresh and never replay the user's signed cancellation.
      refreshAfterLighterWrite();
      setTradingBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress || !tradingIdentity || (accountTab !== "OPEN_ORDERS" && accountTab !== "POSITIONS")) {
      setLiveOrders(null);setOpenOrdersError("");
      return;
    }
    getLighterSignedOpenOrders(walletAddress).then(rows => {
      if(!cancelled) {setLiveOrders(rows);setOpenOrdersError("");}
    }).catch(e => {
      if(!cancelled) {
        // Retain the last verified snapshot, but mark it STALE and disable
        // new cancellations until a fresh authenticated read succeeds.
        const message=e instanceof Error?e.message:String(e);
        setOpenOrdersError(/didn['’]t use volume quota|ratelimit/i.test(message)?
          "Lighter Open Orders temporarily rate-limited. Last verified list may be stale; automatic refresh is scheduled.":
          "Lighter Open Orders temporarily unavailable. Last verified list may be stale: "+message);
      }
    });
    return () => {cancelled = true;};
  },[walletAddress,tradingIdentity,accountTab,accountReload]);

  // Read real signer-owned trade fills after a submitted/ambiguous order even
  // when the user stays on the Trade tab. Never substitute Hyperliquid fills.
  useEffect(()=>{
    let stale=false;
    if(!walletAddress||!tradingIdentity||
      (accountTab!=="TRADE_HISTORY" && section!=="funds" && !awaitingFill)){
      setFillsLoading(false);return;
    }
    setFillsLoading(true);
    getLighterSignedTradeHistory(walletAddress).then(result=>{
      if(stale)return;
      setLiveFills(result);setFillsError("");
      if(!awaitingFill||result.accountIndex!==awaitingFill.accountIndex)return;
      const sameAccountFill=result.trades.find(fill=>{
        const ask=fill.ask_account_id===result.accountIndex;
        const bid=fill.bid_account_id===result.accountIndex;
        if(ask===bid||Number(fill.market_id)!==awaitingFill.marketId||
          (ask?"sell":"buy")!==awaitingFill.side)return false;
        const ts=Number(fill.timestamp);
        const millis=ts<1e11?ts*1000:ts;
        return Number.isFinite(millis)&&millis>=awaitingFill.since;
      });
      if(sameAccountFill){
        const hashMatch=Boolean(awaitingFill.txHash&&sameAccountFill.tx_hash &&
          sameAccountFill.tx_hash.toLowerCase()===awaitingFill.txHash.toLowerCase());
        setAwaitingFill(null);
        setUncertainPosition(null);
        // Fill is reconciled to account history silently. Hyperliquid's
        // original single submitted-order toast is retained; no second popup.
      }
    }).catch(e=>{
      if(!stale)setFillsError(e instanceof Error?e.message:"Lighter fills unavailable.");
    }).finally(()=>{if(!stale)setFillsLoading(false);});
    return ()=>{stale=true;};
  },[walletAddress,tradingIdentity,accountTab,section,accountReload,awaitingFill]);

  // A successful response can contain {"ratelimit":"didn't use volume quota"}:
  // this is informational, NOT an HTTP 429. Only real quota failures qualify.
  const isRealLighterRateLimit=(error:unknown):boolean=>{
    const candidate=error as {status?:unknown;httpStatus?:unknown;code?:unknown}|null;
    if(candidate?.status===429||candidate?.httpStatus===429||
       candidate?.code===23000)return true;
    const raw=error instanceof Error?error.message:String(error??"");
    if(/didn['’]t use volume quota/i.test(raw))return false;
    return /(?:\b429\b|\b23000\b|too many requests|rate.?limit (?:reached|exceeded)|rate.?limited|quota (?:exceeded|exhausted))/i.test(raw);
  };
  const readableMarginError=(error:unknown):string=>{
    const raw=error instanceof Error?error.message:String(error??"");
    if(isRealLighterRateLimit(error))
      return "Lighter temporarily rejected this margin request due to an API limit. No automatic retries will be made.";
    if(/didn['’]t use volume quota/i.test(raw))
      return "Lighter returned a volume-quota note, not a confirmed margin transaction. Check the active account leverage before retrying.";
    return raw.replace(/\\n/g,"\n").trim()||
      "Lighter margin update was not confirmed by the exchange.";
  };


  /** Only server-reported per-market leverage for the current signed account.
   * Account API fraction can appear as percent (5.00 => 20x) or bps
   * (500 => 20x). Validate against venue market cap; unknown stays unknown.
   */
  const verifiedMarketMargin=(marketId:number):{
    leverage:number;mode:"cross"|"isolated";
  }|null=>{
    if(!tradingIdentity)return null;
    const account=publicAccounts?.find(a=>a.index===tradingIdentity.accountIndex);
    const setting=account?.marginSettings.find(m=>m.marketId===marketId);
    const market=markets.find(m=>m.kind==="perp"&&m.id===marketId);
    if(!setting||!market?.maxLeverage)return null;
    const leverage=verifiedLighterLeverage(setting.initialMarginFraction,market.maxLeverage);
    return leverage===null?null:{leverage,mode:setting.marginMode};
  };

  const marginKey=(marketId:number,leverage:number,mode:"cross"|"isolated")=>
    walletAddress.toLowerCase()+":"+String(tradingIdentity?.accountIndex??"unknown")+
    ":"+marketId+":"+leverage+":"+mode;

  const queueMarginUpdate=(leverage:number,mode:"cross"|"isolated")=>{
    if(kind!=="perp"||!selected||!selected.maxLeverage||
      !Number.isSafeInteger(leverage)||leverage<1||leverage>selected.maxLeverage)return;
    const request={key:marginKey(selected.id,leverage,mode),
      marketId:selected.id,leverage,mode,attempt:0};
    latestMarginRequestRef.current=request.key;
    setMarginIntent(request);
    setMarginStatus("");
  };

  // A single Lighter mainnet signed update, using the already-authorized
  // memory signer (restored from locally encrypted IndexedDB on refresh).
  const applyLighterMargin=async(request:{
    key:string;marketId:number;leverage:number;mode:"cross"|"isolated";attempt:number;
  }):Promise<boolean>=>{
    if(acknowledgedMarginRef.current===request.key){
      // An accepted signed update may still be settling. Do not claim
      // leverage is active or send a second signed margin update.
      const verified=verifiedMarketMargin(request.marketId);
      if(verified?.leverage===request.leverage&&verified.mode===request.mode)
        return true;
      setAccountReload(v=>v+1);
      setMarginStatus("Waiting for Lighter to confirm the selected leverage.");
      return false;
    }
    if(marginFlightRef.current){
      // A different margin update is already signed and in flight.
      // Never launch an overlapping nonce write or use a stale snapshot.
      await marginFlightRef.current;
      return acknowledgedMarginRef.current===request.key;
    }
    const current=verifiedMarketMargin(request.marketId);
    if(current?.leverage===request.leverage&&current.mode===request.mode){
      // Active setting belongs to this exact wallet/account/market.
      // Do not waste a transaction or block a normal order after reload.
      acknowledgedMarginRef.current=request.key;
      latestMarginRequestRef.current=request.key;
      setMarginStatus("");
      return true;
    }
    if(!walletAddress||!tradingIdentity||restoringSavedSigner){
      if(!restoringSavedSigner)setAuthSheetOpen(true);
      return false;
    }
    const market=markets.find(m=>m.kind==="perp"&&m.id===request.marketId);
    if(!market||selected?.id!==market.id||
      request.key!==marginKey(market.id,request.leverage,request.mode)||
      !market.maxLeverage||request.leverage>market.maxLeverage)return false;
    if(Date.now()<marginRetryUntilRef.current)return false;
    const task=(async()=>{
      setMarginBusy(true);
      try{
        await updateLighterPerpMargin({
          walletAddress,market,leverage:request.leverage,marginMode:request.mode,
        });
        // Transaction ACK is NOT proof of on-chain completion. Never claim a
        // rejected/stale request applied the new market settings.
        if(latestMarginRequestRef.current===request.key||
           (latestMarginRequestRef.current===null&&
            selected?.id===request.marketId&&chosenLeverage===request.leverage&&
            marginMode===request.mode)){
          // Prevent repeat signed leverage requests while account state
          // catches up. Placement remains blocked until verified setting.
          acknowledgedMarginRef.current=request.key;
          setMarginStatus("Lighter accepted the leverage update. Waiting for account confirmation.");
        }
        setAccountReload(v=>v+1);
        return false;
      }catch(error){
        const text=error instanceof Error?error.message:String(error);
        if(/didn['’]t use volume quota/i.test(text) && tradingIdentity){
          // The note may accompany a transaction that reached Lighter.
          // ONE read-only account reconciliation, no signed retry.
          await new Promise<void>(resolve=>window.setTimeout(resolve,1200));
          try {
            const [freshAccount]=await getLighterPublicAccounts([tradingIdentity.accountIndex]);
            const setting=freshAccount?.marginSettings.find(x=>x.marketId===request.marketId);
            if(setting?.marginMode===request.mode){
              const fraction=setting.initialMarginFraction;
              const leverage=(fraction<=100?100:10000)/fraction;
              if(Number.isFinite(leverage)&&Math.abs(leverage-request.leverage)<=0.01){
                acknowledgedMarginRef.current=request.key;
                setPublicAccounts(current=>current?.map(a=>
                  a.index===freshAccount!.index?freshAccount!:a)??[freshAccount!]);
                setMarginStatus("");
                setTradingNotice("");
                return true; // verified exchange setting; NOT inferred from message
              }
            }
          }catch{/* Read-only check unavailable; do not claim success. */}
        }
        if(isRealLighterRateLimit(error))
          marginRetryUntilRef.current=Date.now()+60000;
        if(latestMarginRequestRef.current===request.key){
          const message=readableMarginError(error);
          setMarginStatus(message);
          setNoticeKind(/didn['’]t use volume quota/i.test(text)?"pending":"error");
          setTradingNotice(message);
          refreshAfterLighterWrite();
        }
        return false;
      }finally{setMarginBusy(false);}
    })();
    marginFlightRef.current=task;
    try{return await task;}
    finally{if(marginFlightRef.current===task)marginFlightRef.current=null;}
  };

  // The API key is generated by the real Lighter onboarding SDK, never
  // manually pasted in a second trading popup. Preserve one-time recovery.
  const authorizationPanel = recoveryKey ? (
    <div className="rounded-xl border border-amber-500/40 p-3 space-y-3">
      <p className="text-amber-500 text-xs font-bold">
        Save a separate recovery backup securely. This API key permits trades and withdrawals.
      </p>
      <input type="password" readOnly value={recoveryKey}
        aria-label="One-time Lighter trading key backup"
        className="w-full p-2 rounded border border-brand-border bg-brand-bg"/>
      <button type="button" onClick={async()=>{
        try{
          await navigator.clipboard.writeText(recoveryKey);
          setTradingNotice("Recovery key copied. Keep it in a secure password manager.");
        }catch{setTradingNotice("Clipboard unavailable. Save the key securely before leaving.");}
      }} className="underline text-accent text-xs">Copy recovery key</button>
    </div>
  ) : null;

  // Market/Funds/Account navigation must not reset the user's selected Lighter spot/perp kind.
  // Explicit Trade routing is the only place where App's chosen mode takes precedence.
  useEffect(() => {
    if (section === "trade" && initialKind !== kind) {
      setKind(initialKind);
      setSelectedMarketId(initialKind === "spot" ? lastSpotMarketId : lastPerpMarketId);
    }
  // Do not overwrite manual selection when remaining in the same trade section.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKind, section]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    getLighterMarkets(ac.signal).then(rows => {
      if (ac.signal.aborted) return;
      setMarkets(rows);
      setMarketError(null);
      setSelectedMarketId(current =>
        current !== null && rows.some(row => row.id === current && row.kind === kind)
          ? current : kind === "perp"
            ? (rows.find(row => row.kind === "perp" && row.symbol === "BTC")?.id
              ?? rows.find(row => row.kind === "perp")?.id ?? null)
            : null
      );
    }).catch(error => {
      if (!ac.signal.aborted) setMarketError(error instanceof Error ? error.message : "Lighter markets unavailable");
    }).finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    // Background polling must keep the previous verified account snapshot
    // visible. Clear only when the connected wallet actually changes.
    const normalizedWallet=walletAddress.toLowerCase();
    if(loadedAccountWalletRef.current!==normalizedWallet){
      loadedAccountWalletRef.current=normalizedWallet;
      setPublicAccounts(null);
      setAccountsLoading(true);
    }else if(publicAccounts===null)setAccountsLoading(true);
    if (!walletAddress) { setAccountsLoading(false); return () => ac.abort(); }
    getLighterAccountIndexes(walletAddress, ac.signal).then(indexes =>
      getLighterPublicAccounts(indexes, ac.signal)
    ).then(items => {
      if(!ac.signal.aborted){setPublicAccounts(items);setAccountError(null);}
    }).catch(error => {
      if (!ac.signal.aborted) setAccountError(error instanceof Error ? error.message : "Lighter account unavailable");
    }).finally(() => { if (!ac.signal.aborted) setAccountsLoading(false); });
    return () => ac.abort();
  }, [walletAddress, accountReload]);

  // Public volume and cumulative trade PnL need no trading authorization.
  // This is per verified L1-owned Lighter account, not exchange-wide volume.
  useEffect(()=>{
    let stopped=false;
    const controller=new AbortController();
    setPublicAnalytics(null);setPublicAnalyticsError("");
    if(!walletAddress||section!=="funds"){
      setPublicAnalyticsLoading(false);return ()=>controller.abort();
    }
    setPublicAnalyticsLoading(true);
    getLighterPublicAnalytics(walletAddress,performancePeriod,controller.signal)
      .then(value=>{if(!stopped){setPublicAnalytics(value);setPublicAnalyticsError("");}})
      .catch(error=>{
        if(!stopped&&!controller.signal.aborted){
          setPublicAnalyticsError(error instanceof Error?error.message:"Lighter public volume unavailable.");
        }
      }).finally(()=>{if(!stopped)setPublicAnalyticsLoading(false);});
    return ()=>{stopped=true;controller.abort();};
  },[walletAddress,section,performancePeriod]);

  // Fee preview is READ ONLY and conditional on the existing Ethereum
  // allowance. Missing allowance / different network means wallet will quote
  // approval + deposit gas at signing; never fabricate a zero fee.
  useEffect(()=>{
    setDepositFeeQuote(null);
    if(fundsModal!=="deposit"||depositNetwork!=="ethereum"||
       !walletAddress||!depositAmount.trim())return;
    let cancelled=false;
    const timer=window.setTimeout(()=>{
      quoteLighterEthereumDepositNetworkFee({
        walletAddress,amount:depositAmount,getWalletProvider
      }).then(value=>{if(!cancelled)setDepositFeeQuote(value);})
        .catch(()=>{if(!cancelled)setDepositFeeQuote(null);});
    },750);
    return ()=>{cancelled=true;window.clearTimeout(timer);};
  },[fundsModal,depositNetwork,depositAmount,walletAddress,getWalletProvider]);

  // Keep Lighter balances, collateral and positions fresh even when the
  // user makes a transaction outside HideDex. Read-only refresh; no signing.
  useEffect(() => {
    if (!walletAddress) return;
    // Controlled live read-only refresh; no frequent writes or reloads.
    const interval = window.setInterval(() => setAccountReload(n => n + 1), 20_000);
    return () => window.clearInterval(interval);
  }, [walletAddress]);

  useEffect(()=>{
    if(!pendingBulkClose||!publicAccounts)return;
    const latest=publicAccounts.find(a=>a.index===pendingBulkClose.accountIndex);
    if(!latest)return;
    if(pendingBulkClose.positions.every(t=>
      !latest.positions.some(p=>p.symbol===t.symbol&&Math.abs(p.signedSize)>1e-10))){
      setPendingBulkClose(null);
      setCloseAllPositionsOpen(false);
      setTradingNotice("");
    }
  },[pendingBulkClose,publicAccounts]);

  useEffect(()=>{
    if(!uncertainPosition||!publicAccounts)return;
    const account=publicAccounts.find(a=>a.index===uncertainPosition.accountIndex);
    if(!account)return;
    const current=account.positions.find(p=>p.symbol===uncertainPosition.symbol)?.signedSize??0;
    if(Math.abs(current-uncertainPosition.previousSize)>1e-10){
      setUncertainPosition(null);
      // Account sync updates the shared card silently; no second close toast.
      setTradingNotice("");
    }
  },[publicAccounts,uncertainPosition]);

  useEffect(()=>{
    if(!uncertainPosition)return;
    const id=window.setTimeout(()=>{
      setUncertainPosition(null);
      setNoticeKind("pending");
      setNoticeTitle("Lighter Order");
      setTradingNotice("Order verification is delayed. Check Positions or Trade History before submitting another order.");
    },30000);
    return ()=>window.clearTimeout(id);
  },[uncertainPosition]);

  useEffect(()=>{
    if(!awaitingFill)return;
    const id=window.setTimeout(()=>{
      // No automatic duplicate order, no second Lighter-only status popup.
      setAwaitingFill(null);
    },35000);
    return ()=>window.clearTimeout(id);
  },[awaitingFill]);

  const available = useMemo(() => markets.filter(market => market.kind === kind), [markets, kind]);
  const selected = useMemo(
    () => available.find(row => row.id === selectedMarketId),
    [available, selectedMarketId]
  );
  useEffect(() => {
    setFeed({ ...emptyBook });
    if (!selected || (section !== "trade" && section !== "markets")) return;
    return subscribeLighterBook(selected.id, next => setFeed(next));
  }, [selected?.id, section]);

  // No per-pixel network writes. Slider release / chip selection starts at
  // most one debounced signed request. A failed request is NOT retried
  // automatically and can never authorize a real order.
  useEffect(()=>{
    // Read the real account setting before consuming a signed leverage update.
    if(!marginIntent||kind!=="perp"||!selected||accountsLoading||
       marginIntent.marketId!==selected.id)return;
    const wait=Math.max(650,marginRetryUntilRef.current-Date.now());
    const timer=window.setTimeout(async()=>{
      const req=marginIntent;
      if(latestMarginRequestRef.current!==req.key)return;
      const ok=await applyLighterMargin(req);
      if(latestMarginRequestRef.current!==req.key)return;
      // A rejected request must never be sent again just because the timer
      // fires. The user may explicitly choose a setting after recovery.
      setMarginIntent(null);
    },wait);
    return ()=>window.clearTimeout(timer);
  },[marginIntent?.key,marginIntent?.attempt,selected?.id,kind,
     tradingIdentity?.accountIndex,walletAddress,restoringSavedSigner,accountsLoading]);

  useEffect(()=>{
    latestMarginRequestRef.current=null;
    acknowledgedMarginRef.current=null;
    setMarginIntent(null);
    setMarginStatus("");
  },[selectedMarketId,kind,walletAddress,tradingIdentity?.accountIndex]);

  // Display exchange-side settings instead of resetting to an unrelated
  // local slider default on refresh/market switch. Respect pending user edits.
  useEffect(()=>{
    if(kind!=="perp"||!selected||!tradingIdentity||
      latestMarginRequestRef.current!==null||marginFlightRef.current)return;
    const current=verifiedMarketMargin(selected.id);
    if(!current)return;
    setChosenLeverage(current.leverage);
    setMarginMode(current.mode);
  },[publicAccounts,selected?.id,kind,tradingIdentity?.accountIndex]);

  // Never inherit a 50x draft from BTC when selecting an unrelated market,
  // and never retain a slider choice above an updated market risk cap.
  useEffect(()=>{
    if(kind!=="perp"||!selected?.maxLeverage)return;
    setChosenLeverage(v=>Math.max(1,Math.min(v,selected.maxLeverage!)));
  },[kind,selected?.id,selected?.maxLeverage]);

  const multiplier = selected?.multiplier && selected.multiplier > 0 ? selected.multiplier : 1;
  const displayPrice = (raw: string) => {
    const n = Number(raw) / multiplier;
    return Number.isFinite(n) ? n : null;
  };
  const displaySize = (raw: string) => {
    const n = Number(raw) * multiplier;
    return Number.isFinite(n) ? n : null;
  };
  const lastPrice = feed.recentTradePrice
    ? displayPrice(feed.recentTradePrice) : selected?.lastTradePrice ?? null;
  const marketPrice = lastPrice !== null && lastPrice > 0 ? lastPrice : null;
  const hasSpotMarkets = markets.some(m => m.kind === "spot");
  const lighterTokens = useMemo<TokenMetadata[]>(() =>
    markets.map(m => ({
      symbol: m.kind === "spot" ? m.symbol + "-SPOT" : m.symbol,
      name: m.symbol,
      price: m.lastTradePrice,
      change24h: m.change24h,
      volume24h: m.volume24hUsd,
      high24h: m.high24h,
      low24h: m.low24h,
      openInterest: m.kind === "perp" ? null : undefined,
      maxLeverage:m.kind==="perp"&&m.maxLeverage!==null?m.maxLeverage:undefined,
      isSpotOnly: m.kind === "spot",
      hasSpot: m.kind === "spot",
      spotSymbol: m.kind === "spot" ? m.symbol : undefined,
      category: m.kind === "spot" ? "spot" : "perps",
      displayBaseAsset: m.symbol,
      sourceCoin: m.symbol,
    })), [markets]);
  const lighterSelectedSymbol = selected
    ? selected.kind === "spot" ? selected.symbol + "-SPOT" : selected.symbol
    : "";
  useEffect(()=>{onMarketCatalog?.(lighterTokens);},[lighterTokens,onMarketCatalog]);


  const chooseMarket = (m: LighterMarket, navigate: boolean) => {
    setSelectedMarketId(m.id);
    setKind(m.kind);
    if (m.kind === "spot") setLastSpotMarketId(m.id);
    else setLastPerpMarketId(m.id);
    setMarketSelectorOpen(false);
    const saved=verifiedMarketMargin(m.id);
    setChosenLeverage(saved?.leverage??1);
    setMarginMode(saved?.mode??"cross");
    setAmount("");
    setLimitPrice("");
    setBookGroup(1);
    setReduceOnly(false);
    latestMarginRequestRef.current=null;
    acknowledgedMarginRef.current=null;
    setMarginIntent(null);
    setMarginStatus("");
    setOrderTypeOpen(false);
    if (navigate) onSelectSection("trade", m.kind);
  };
  useEffect(()=>{
    if(!sidebarMarketRequest||!markets.length)return;
    const market=markets.find(m=>(m.kind==="spot"?m.symbol+"-SPOT":m.symbol)===sidebarMarketRequest.symbol);
    if(market)chooseMarket(market,true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sidebarMarketRequest?.nonce,markets]);
  const switchKind = (next: Kind) => {
    if (next === kind) return;
    const current = selected;
    if (current) {
      if (kind === "spot") setLastSpotMarketId(current.id);
      else setLastPerpMarketId(current.id);
    }
    // Never silently replace BTC with LIT/USDC (or any unrelated symbol).
    // Use same-base market if supported; otherwise the user's prior selection.
    const sameBase = current?.symbol.split("/")[0].toUpperCase();
    const matching = sameBase && markets.find(m =>
      m.kind === next && m.symbol.split("/")[0].toUpperCase() === sameBase);
    const remembered = next === "spot" ? lastSpotMarketId : lastPerpMarketId;
    const nextMarket = matching ?? markets.find(m => m.kind === next && m.id === remembered);
    setKind(next);
    setSelectedMarketId(nextMarket?.id ?? null);
    const currentSetting=nextMarket?.kind==="perp"?verifiedMarketMargin(nextMarket.id):null;
    setChosenLeverage(currentSetting?.leverage??1);
    setMarginMode(currentSetting?.mode??"cross");
    setAmount("");
    setLimitPrice("");
    setReduceOnly(false);
    latestMarginRequestRef.current=null;
    acknowledgedMarginRef.current=null;
    setMarginIntent(null);
    setOrderTypeOpen(false);
    if (!nextMarket) setMarketSelectorOpen(true);
    if (section === "trade") onSelectSection("trade", next);
  };

  const signedAccount = publicAccounts?.find(account=>account.index===tradingIdentity?.accountIndex) ?? null;
  // Public read-only balance for a single verified account may be displayed
  // before signing, but never combine independent subaccounts for order sizing.
  const displayTradingAccount = signedAccount ?? (publicAccounts?.length===1 ? publicAccounts[0] : null);
  // Never present PERP collateral as SPOT purchasing power. Use verified
  // unlocked quote balance belonging to this specific Lighter subaccount.
  const selectedQuote = selected?.symbol.split("/")[1]?.toUpperCase() ?? null;
  const spotQuote = kind==="spot" && displayTradingAccount?.assets !== null
    ? displayTradingAccount?.assets?.find(asset=>asset.symbol.toUpperCase()===selectedQuote)
    : undefined;
  const availableForMarket = kind==="perp"
    ? displayTradingAccount?.availableBalance ?? null
    : selectedQuote==="USDC" && spotQuote && spotQuote.lockedBalance!==null
      ? Math.max(0,spotQuote.balance-spotQuote.lockedBalance) : null;
  const inputPrice = orderType === "limit" ? Number(limitPrice) : marketPrice;
  // Original4 presentation: gain/loss fields represent *price change* from
  // the selected entry/limit reference, never execution PnL or guaranteed fill.
  const lighterTargetRef = inputPrice != null && Number.isFinite(inputPrice) && inputPrice>0 ? inputPrice : null;
  const fromLighterPrice=(value:string,kind:"tp"|"sl",unit:"%"|"$"):string=>{
    const trigger=Number(value);
    if(!value.trim()||!Number.isFinite(trigger)||lighterTargetRef===null)return "";
    const direction=side==="buy"?1:-1;
    const change=(trigger-lighterTargetRef)*(kind==="tp"?direction:-direction);
    return (unit==="%"?100*change/lighterTargetRef:change).toFixed(2);
  };
  const toLighterPrice=(value:string,kind:"tp"|"sl",unit:"%"|"$"):string=>{
    const v=Number(value);
    if(!value.trim()||!Number.isFinite(v)||lighterTargetRef===null)return "";
    const direction=side==="buy"?1:-1;
    const change=(unit==="%"?lighterTargetRef*v/100:v)*(kind==="tp"?direction:-direction);
    const result=lighterTargetRef+change;
    const decimals=Math.min(8,Math.max(2,selected?.priceDecimals??2));
    return Number.isFinite(result)&&result>0?result.toFixed(decimals):"";
  };
  const inputAmount = Number(amount);
  const sizeInCoin = Number.isFinite(inputAmount) && inputAmount > 0 && inputPrice !== null && inputPrice > 0
    ? sizeUnit === "USD" ? inputAmount / inputPrice : inputAmount : 0;
  const orderValueUsd = sizeInCoin && inputPrice ? sizeInCoin * inputPrice : null;
  // The selected leverage is a preview, never a claim that Lighter accepted
  // a new margin setting. The order submit path independently verifies it.
  const activeMargin = kind==="perp"&&selected?verifiedMarketMargin(selected.id):null;
  const previewMargin = kind==="perp"&&selected?.maxLeverage&&chosenLeverage>=1&&
    chosenLeverage<=selected.maxLeverage?
      lighterInitialRequirement(orderValueUsd,chosenLeverage):null;
  const previewMarginConfirmed = activeMargin?.leverage===chosenLeverage &&
    activeMargin.mode===marginMode;
  // Calculations are indicative, not exchange liquidation guarantees.
  // Only market orders with an exchange-verified active margin setting and
  // risk/account inputs can produce a scenario; no future limit-order guess.
  const draftLiqPrice=kind==="perp"&&orderType==="market"&&selected&&
    previewMarginConfirmed&&!reduceOnly?
    estimateLighterDraftLiq({
      side,marketSymbol:selected.symbol,price:marketPrice,
      notionalUsd:orderValueUsd,marginMode,
      confirmedLeverage:activeMargin?.leverage??null,
      maintenanceFractionBps:selected.maintenanceMarginFractionBps,
      account:signedAccount,
    }):null;
  const hasReduciblePosition = Boolean(selected && tradingIdentity && publicAccounts?.some(a =>
    a.index === tradingIdentity.accountIndex && a.positions.some(p =>
      p.symbol === selected.symbol && (side === "sell" ? p.signedSize > 0 : p.signedSize < 0))));
  const makeLighterBookRows = (levels:LighterMarketFeed["bids"],side:"bid"|"ask"):HideDexBookLevel[] => {
    const decimals=Math.min(10,selected?.priceDecimals??2);
    const tick=Math.pow(10,-decimals)*bookGroup;
    const map=new Map<number,number>();
    for(const row of levels) {
      const p=displayPrice(row.price),sz=displaySize(row.size);
      if(p===null||sz===null||p<=0||sz<0)continue;
      const bucket=(side==="ask"?Math.ceil(p/tick-1e-7):Math.floor(p/tick+1e-7))*tick;
      const key=Number(bucket.toFixed(decimals));
      map.set(key,(map.get(key)??0)+sz);
    }
    let cumulative=0;
    const limit=(typeof window!=="undefined"&&window.innerWidth<640)?8:14;
    const sorted=[...map.entries()].sort((a,b)=>side==="ask"?a[0]-b[0]:b[0]-a[0]).slice(0,limit);
    return sorted.map(([price,size])=>({price,size,total:(cumulative+=size)}));
  };

  const lighterBalanceRows: HideDexBalanceItem[] | null = publicAccounts===null ? null :
    publicAccounts.flatMap(account=>{
      // Spot USDC and Perp collateral are different ledger routes. Do not
      // double-count them, but also do not add a second empty USDC card.
      // Nonzero / locked Spot balances remain individually visible.
      const assets=account.assets?.filter(asset=>
        asset.balance>0 || (asset.lockedBalance!==null && asset.lockedBalance>0)
      ).map(asset=>({
        id:account.index+":"+asset.symbol+":spot",symbol:asset.symbol,
        name:"Spot · Lighter Account #"+account.index,
        total:asset.balance,locked:asset.lockedBalance,
        available:asset.lockedBalance===null?null:Math.max(0,asset.balance-asset.lockedBalance),
        // USDC is USD-denominated. Non-USDC spot balances have no
        // verified USD valuation here and must remain unknown.
        valueUsd:asset.symbol.toUpperCase()==="USDC"?asset.balance:null,
        allocationPercent:null,color:"#2775ca",
      } satisfies HideDexBalanceItem)) ?? [];
      return [
        {id:account.index+":perp",symbol:"USDC",name:"Perp Collateral · Account #"+account.index,
          total:account.collateral,available:account.availableBalance,locked:null,
          valueUsd:account.collateral,allocationPercent:null,color:"#2775ca"} satisfies HideDexBalanceItem,
        ...assets
      ];
    });

  const knownPositionCount = publicAccounts === null ? undefined :
    publicAccounts.reduce((sum, acct) => sum + acct.positions.length, 0);
  const lighterFillRows:HideDexHistoryRow[]|null=liveFills===null?null:
    liveFills.trades.flatMap((fill,index)=>{
      const ask=fill.ask_account_id===liveFills.accountIndex;
      const bid=fill.bid_account_id===liveFills.accountIndex;
      if(ask===bid)return []; // Never attribute another account's fill to this wallet.
      const price=Number(fill.price),size=Number(fill.size);
      if(!Number.isFinite(price)||price<=0||!Number.isFinite(size)||size<=0)return [];
      const market=markets.find(m=>m.id===fill.market_id);
      const pnlRaw=ask?fill.ask_account_pnl:fill.bid_account_pnl;
      const pnl=pnlRaw==null||String(pnlRaw).trim()===""?null:Number(pnlRaw);
      const isMaker=typeof fill.is_maker_ask==="boolean"?ask===fill.is_maker_ask:null;
      const feeRaw=isMaker===null?null:isMaker?fill.maker_fee:fill.taker_fee;
      const rawFee=feeRaw==null?null:Number(feeRaw);
      // Nonzero raw fee units are not independently verified as USDC: show —.
      const time=Number(fill.timestamp),ms=time<1e11?time*1000:time;
      const usd=fill.usd_amount==null?null:Number(fill.usd_amount);
      return [{
        id:String(fill.trade_id??fill.tx_hash??"fill")+":"+liveFills.accountIndex+":"+index,
        symbol:market?.symbol??"Market #"+fill.market_id,
        side:ask?"SELL" as const:"BUY" as const,
        isSpot:market?market.kind==="spot":null,
        price,size,value:usd!==null&&Number.isFinite(usd)&&usd>0?usd:price*size,
        realizedPnl:pnl!==null&&Number.isFinite(pnl)?pnl:null,
        roi:null,fee:rawFee===0?0:null,
        timestamp:Number.isFinite(ms)&&ms>0?new Date(ms).toLocaleString():"—",
      }];
    });
  // The Lighter /trades response is account-authenticated. Count ONLY rows whose
  // ask/bid account ID matches this signer; allTime is still limited by the
  // endpoint's most recent 50 fills, not the wallet's lifetime.
  const lighterStats=useMemo(()=>{
    if(!liveFills)return null;
    const days=performancePeriod==="day"?1:performancePeriod==="week"?7:
      performancePeriod==="month"?30:null;
    const cutoff=days===null?0:Date.now()-days*86400000;
    const trades=liveFills.trades.flatMap(fill=>{
      const ask=fill.ask_account_id===liveFills.accountIndex;
      const bid=fill.bid_account_id===liveFills.accountIndex;
      if(ask===bid)return [];
      const market=markets.find(m=>m.id===fill.market_id);
      if(performanceMarket!=="all" &&
        (!market||(performanceMarket==="spot")!==(market.kind==="spot")))return [];
      const t=Number(fill.timestamp);
      const time=t<1e11?t*1000:t;
      if(!Number.isFinite(time)||time<=0||time<cutoff)return [];
      const price=Number(fill.price),size=Number(fill.size),quoted=Number(fill.usd_amount);
      const amount=fill.usd_amount!=null&&Number.isFinite(quoted)&&quoted>0?quoted:
        Number.isFinite(price)&&price>0&&Number.isFinite(size)&&size>0?price*size:null;
      const maker=typeof fill.is_maker_ask==="boolean"?ask===fill.is_maker_ask:null;
      const rawFee=maker===null?null:maker?fill.maker_fee:fill.taker_fee;
      const fee=rawFee==null?null:Number(rawFee);
      const extra=fill as unknown as Record<string,unknown>;
      const id=ask?extra.ask_id:extra.bid_id;
      return [{time,volumeUsd:amount,fee:fee===0?0:null,
        orderId:(typeof id==="number"||typeof id==="string")&&String(id)!==""?String(id):null}];
    });
    const completeVolume=trades.every(x=>x.volumeUsd!==null);
    const completeFees=trades.every(x=>x.fee!==null);
    const completeOrders=trades.every(x=>x.orderId!==null);
    return {
      count:trades.length,
      volume:completeVolume?trades.reduce((sum,x)=>sum+(x.volumeUsd??0),0):null,
      fee:completeFees?trades.reduce((sum,x)=>sum+(x.fee??0),0):null,
      orders:completeOrders?new Set(trades.map(x=>x.orderId)).size:null,
      chartFills:trades.filter(x=>x.volumeUsd!==null).map(x=>({
        time:x.time,volumeUsd:x.volumeUsd!,px:1,sz:x.volumeUsd!,
      })),
    };
  },[liveFills,markets,performancePeriod,performanceMarket,accountReload]);

  const lighterClosePosition:Position|null=useMemo(()=>{
    if(!singleCloseTarget)return null;
    const account=publicAccounts?.find(a=>a.index===singleCloseTarget.accountIndex);
    const p=account?.positions.find(p=>p.symbol===singleCloseTarget.symbol&&
      p.signedSize===singleCloseTarget.signedSize);
    if(!p)return null;
    const market=markets.find(m=>m.kind==="perp"&&m.symbol===p.symbol);
    const setting=account?.marginSettings.find(m=>m.marketId===market?.id);
    const leverage=verifiedLighterLeverage(setting?.initialMarginFraction,market?.maxLeverage)??0;
    return {
      id:singleCloseTarget.accountIndex+":"+p.symbol,
      symbol:p.symbol,type:p.signedSize>0?"LONG":"SHORT",
      size:Math.abs(p.signedSize),leverage,
      entryPrice:p.entryPrice??0,
      markPrice:market?.markPrice??market?.lastTradePrice??0,
      liqPrice:p.liquidationPrice??0,
      margin:p.allocatedMargin??0,unrealizedPnl:p.unrealizedPnl??0,
      unrealizedPnlPercent:p.allocatedMargin!==null&&p.allocatedMargin>0&&p.unrealizedPnl!==null?
        100*p.unrealizedPnl/p.allocatedMargin:0,
      marginType:setting?.marginMode,
    };
  },[singleCloseTarget,publicAccounts,markets]);

  const lighterAccountTabs = (
    <HideDexUnifiedAccountPanel
      tabs={<>      <TradingAccountTabBar
        activeTab={accountTab}
        onSelect={setAccountTab}
        showFundingHistory={true}
        positionsCount={knownPositionCount}
        ordersCount={liveOrders?.length}
      />
</>}
      actions={<>
      {accountTab==="POSITIONS" && <HideDexPositionActionBar
        sort={positionSort}
        onSort={setPositionSort}
        supportedSorts={["DEFAULT","SYMBOL","SIZE","PNL"]}
        allExpanded={Boolean(knownPositionCount) &&
          (publicAccounts??[]).flatMap(a=>a.positions.map((p,i)=>a.index+":"+p.symbol+":"+i))
            .every(key=>expandedPositions[key]??false)}
        onToggleAll={()=>{
          const keys=(publicAccounts??[]).flatMap(a=>a.positions.map((p,i)=>a.index+":"+p.symbol+":"+i));
          const expand=!keys.every(key=>expandedPositions[key]??false);
          setExpandedPositions(Object.fromEntries(keys.map(key=>[key,expand])));
        }}
        onCloseAll={()=>{if(!tradingIdentity){setAuthSheetOpen(true);return;}setCloseAllPositionsOpen(true);}}
        closeDisabled={tradingBusy||knownPositionCount===0}
      />}
      {accountTab==="OPEN_ORDERS" && liveOrders!==null && liveOrders.length>0 &&
        <HideDexCancelAllOrdersBar disabled={tradingBusy||!tradingIdentity||!!openOrdersError}
          onCancelAll={()=>setCancelAllOrdersOpen(true)}/>}
</>}
    >
        {accountTab === "BALANCES" && <HideDexBalancesView
          items={publicAccounts?.some(a=>a.assets===null)?null:lighterBalanceRows}
          unavailableMessage={accountsLoading?"Loading verified Lighter balances…":
            accountError?"Lighter balances unavailable: "+accountError:
            "Lighter account assets are not verified or have not loaded."}
        />}
        {accountTab === "POSITIONS" && (
          <div className="flex flex-col gap-3 w-full pr-1 overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent" id="positions-card-container">
            {accountsLoading && <p className="text-xs text-brand-muted">Checking Lighter positions…</p>}
            {accountError && <p className="text-xs text-rose-400">Unable to verify positions: {accountError}</p>}
            {(publicAccounts ?? []).flatMap(a => a.positions.map((p,i) => ({a,p,i})))
              .sort((x,y) => positionSort === "PNL" ? (y.p.unrealizedPnl ?? -Infinity)-(x.p.unrealizedPnl ?? -Infinity)
                : positionSort === "SIZE" ? Math.abs(y.p.signedSize)-Math.abs(x.p.signedSize)
                : positionSort === "SYMBOL" ? x.p.symbol.localeCompare(y.p.symbol) : 0)
              .map(({a,p,i}) => {
                const key = a.index + ":" + p.symbol + ":" + i;
                const isExpanded = expandedPositions[key] ?? false;
                const positionMarket=markets.find(m=>m.kind==="perp"&&m.symbol===p.symbol);
                const positionSetting=a.marginSettings.find(x=>x.marketId===positionMarket?.id);
                const verifiedPositionLev=verifiedLighterLeverage(
                  positionSetting?.initialMarginFraction,positionMarket?.maxLeverage);
                const positionReferencePrice=positionMarket?.markPrice&&positionMarket.markPrice>0?
                  positionMarket.markPrice:positionMarket?.lastTradePrice&&positionMarket.lastTradePrice>0?
                    positionMarket.lastTradePrice:p.entryPrice;
                const marginRequirement=lighterInitialRequirement(
                  positionReferencePrice&&positionReferencePrice>0?
                    Math.abs(p.signedSize)*positionReferencePrice:null,verifiedPositionLev);
                const verifiedAllocatedMargin=p.allocatedMargin!==null&&p.allocatedMargin>0?
                  p.allocatedMargin:null;
                const accountCrossMarginRatio=positionSetting?.marginMode==="cross"?
                  lighterCrossAccountMarginRatio(a):null;
                return <HideDexPositionCard key={key}>
                  <HideDexPositionHeader
                    shareAction={<button type="button"
                      onClick={event=>{event.preventDefault();event.stopPropagation();
                        setShareTarget({accountIndex:a.index,symbol:p.symbol,signedSize:p.signedSize});}}
                      className="p-1 rounded bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 hover:text-violet-300 border border-violet-500/10 hover:border-violet-500/30 transition-all duration-150 cursor-pointer active:scale-95"
                      title="Share Position"><Share2 className="w-3 h-3"/></button>}
                    symbol={p.symbol}
                    side={p.signedSize>=0?"LONG":"SHORT"}
                    isExpanded={isExpanded}
                    onToggle={()=>setExpandedPositions(v=>({...v,[key]:!(v[key]??false)}))}
                    marginLabel={positionSetting?.marginMode==="isolated"?"Isolated":
                      positionSetting?.marginMode==="cross"?"Cross":null}
                    leverageLabel={verifiedPositionLev!==null?verifiedPositionLev+"x":null}
                    pnl={p.unrealizedPnl}
                    roi={p.unrealizedPnl!==null&&p.allocatedMargin!==null&&p.allocatedMargin>0
                      ?100*p.unrealizedPnl/p.allocatedMargin:null}

                  />
                  {isExpanded && <HideDexPositionDetails
                    left={[
                      {label:"Position Size",value:formatPrice(Math.abs(p.signedSize),6)+" "+p.symbol,
                        hint:p.entryPrice>0 ? "($"+formatPrice(Math.abs(p.signedSize)*p.entryPrice,1)+")" : undefined},
                      {label:"Entry Price",value:p.entryPrice>0?"$"+formatPrice(p.entryPrice):"—"},
                      {label:accountCrossMarginRatio!==null?
                          "Account Margin Ratio":"Margin Ratio",
                        value:accountCrossMarginRatio!==null?
                          formatPrice(accountCrossMarginRatio,2)+"%":"—",
                        tone:accountCrossMarginRatio!==null?"profit":"muted"},
                      {label:"Liquidation Price",
                        value:p.liquidationPrice!==null&&p.liquidationPrice>0 ?
                          "$"+formatPrice(p.liquidationPrice,4):"—",
                        tone:p.liquidationPrice!==null&&p.liquidationPrice>0?"loss":"muted"},
                    ]}
                    right={[
                      {label:verifiedAllocatedMargin!==null?"Margin":"Initial Margin (est.)",
                        value:verifiedAllocatedMargin!==null?
                          "$"+formatPrice(verifiedAllocatedMargin,4):
                          marginRequirement!==null?"≈$"+formatPrice(marginRequirement,4):"—",
                        tone:verifiedAllocatedMargin!==null||marginRequirement!==null?"profit":"muted"},
                      {label:(()=>{
                        const m=markets.find(x=>x.kind==="perp"&&x.symbol===p.symbol);
                        return m?.markPrice&&m.markPrice>0?"Mark Price":"Last Price";
                      })(),value:(()=>{
                        const m=markets.find(x=>x.kind==="perp"&&x.symbol===p.symbol);
                        const px=m?.markPrice&&m.markPrice>0?m.markPrice:m?.lastTradePrice;
                        return px&&px>0?"$"+formatPrice(px,2):"—";
                      })()},
                      {label:"TP / SL Target",value:(()=>{
                        const market=markets.find(m=>m.kind==="perp"&&m.symbol===p.symbol);
                        const orders=tradingIdentity?.accountIndex===a.index&&market?
                          liveOrders?.filter(o=>matchesLighterPositionTrigger(
                            o,market.id,p.signedSize>0))??[]:[];
                        const tp=orders.find(o=>lighterPositionTriggerKind(o)==="tp");
                        const sl=orders.find(o=>lighterPositionTriggerKind(o)==="sl");
                        const targetLabel=(label:string,order:typeof tp)=>
                          order?label+" $"+formatPrice(Number(order.trigger_price),4):"";
                        return !tradingIdentity||liveOrders===null||openOrdersError?"—":
                          tp||sl?[targetLabel("TP",tp),targetLabel("SL",sl)].filter(Boolean).join(" · "):
                          "Not set";
                      })(),tone:"muted"},
                    ]}
                    actions={<HideDexPositionActions
                      onTpSl={()=>setTpSlTarget({accountIndex:a.index,symbol:p.symbol,signedSize:p.signedSize})}
                      onClose={()=>requestLighterPositionClose(a.index,p.symbol,p.signedSize)}
                      tpSlDisabled={tradingBusy} closeDisabled={tradingBusy}
                    />}
                  />}
                </HideDexPositionCard>;
              })}
            {!walletAddress && <p className="text-xs text-brand-muted">Connect wallet to check Lighter positions.</p>}
            {walletAddress && !accountsLoading && !accountError && knownPositionCount===0 &&
              <div className="flex flex-col items-center justify-center py-6 text-gray-500 text-center">
                <Layers className="w-6 h-6 text-brand-text/5 mb-1"/>
                <p className="text-[10px]">No active positions held.</p>
              </div>}
          </div>
        )}
        {accountTab === "OPEN_ORDERS" && <>
          {openOrdersError && <p role="alert" className="text-xs text-rose-400 mb-2">{openOrdersError}</p>}
          <HideDexOpenOrders
            orders={!tradingIdentity || liveOrders===null ? null : liveOrders.map((order,i)=>{
              const marketId=Number(order.market_index??order.market_id);
              const market=markets.find(m=>m.id===marketId);
              const index=Number(order.order_index);
              const symbol=market?.symbol??"Unknown";
              const triggerPx=Number(order.trigger_price);
              const hasTrigger=order.trigger_price!=null&&Number.isFinite(triggerPx)&&triggerPx>0;
              const initial=Number(order.initial_base_amount??order.base_amount);
              const remaining=Number(order.remaining_base_amount);
              const filledPercent=Number.isFinite(initial)&&initial>0&&
                Number.isFinite(remaining)&&remaining>=0&&remaining<=initial ?
                (100*(initial-remaining)/initial).toFixed(1)+"%":"—";
              return {
                id:marketId+":"+index+":"+i,symbol,isSpot:market?.kind==="spot",
                side:order.is_ask?"SELL":"BUY",
                orderType:String(order.order_type??order.type??"Limit"),
                priceLabel:hasTrigger?String(order.trigger_price):String(order.price??"—"),
                trigger:hasTrigger,
                sizeLabel:String(order.initial_base_amount??order.base_amount??"—"),
                filledLabel:filledPercent,remainingLabel:String(order.remaining_base_amount??"—"),
                status:typeof order.status==="string"&&order.status.trim()?order.status:"Open",
                timestamp:"—",
                canCancel:!!market && Number.isSafeInteger(index)&&index>=0 &&
                  !tradingBusy && !openOrdersError,
              } satisfies HideDexOpenOrderRow;
            })}
            unavailableMessage={!tradingIdentity ? "Enable Lighter trading to load authenticated open orders."
              : openOrdersError || "Loading authenticated Lighter open orders…"}
            onCancel={ord=>{
              const parts=ord.id.split(":");
              cancelLighterOrder(Number(parts[0]),Number(parts[1]));
            }}
          />
        </>}
        {accountTab === "FUNDING_HISTORY" && (
          <div className="flex flex-col items-center justify-center py-8 text-brand-muted text-center">
            <Layers className="w-6 h-6 text-brand-text/5 mb-2"/>
            <p className="text-xs font-mono font-medium text-brand-sub">
              Verified Lighter account funding-history records are not loaded.
            </p>
          </div>
        )}
        {accountTab === "TRADE_HISTORY" && <div>

          <HideDexTradeHistory items={lighterFillRows}
            noDataMessage={!walletAddress?"Connect wallet to load Lighter fills.":
              !tradingIdentity?(restoringSavedSigner?"Restoring saved Lighter account history…":"Lighter account history requires an authorized key."):
              fillsError||(fillsLoading?"Loading authenticated Lighter fills…":
              lighterFillRows===null?"Lighter history unavailable.":
              "No recent fills returned for this signer account.")}/>
        </div>}
    </HideDexUnifiedAccountPanel>
  );

  return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="lighter">
    {tradingNotice && !authSheetOpen && <HideDexTradingToast
      type={tradingBusy||fundingBusy||marginBusy?"pending":
        /(?:fail|reject|error|invalid|unavailable|rate.?limit|cannot|unable|not verified|not confirmed|did not|does not match|mismatch|not accepted|no order sent|not permitted|no orders sent|not authorized|insufficient|too many requests|expired)/i.test(tradingNotice)
          ?"error":noticeKind}
      title={noticeTitle}
      message={tradingNotice}
      onClose={()=>setTradingNotice("")}
    />}
    {authSheetOpen && <HideDexTradingAuthorizationSheet
      title="Enable Trading"
      onClose={()=>setAuthSheetOpen(false)}
      closeDisabled={tradingBusy||Boolean(recoveryKey)}
      primaryDisabled={!walletAddress||tradingBusy}
      primaryLabel={tradingBusy?"CHECK YOUR WALLET":
        tradingIdentity?(recoveryKey?"I HAVE SECURELY SAVED MY KEY":"CONTINUE TRADING"):
        "SIGN TO ENABLE TRADING →"}
      onPrimary={()=>{
        if(tradingIdentity){
          setRecoveryKey("");setAuthSheetOpen(false);
        }else void beginLighterAuthorization();
      }}
      description={!tradingIdentity?<div className="my-2">
        <p className="text-brand-sub text-sm sm:text-[15px] leading-relaxed">
          Confirm the one-time wallet authorization to activate trading on HideDex (hidedex.com).
        </p>
        <p className="text-brand-sub text-xs sm:text-sm mt-2 leading-relaxed">
          This Lighter key authorizes trades and verified-wallet withdrawals.
          Review the wallet request before confirming. The key is saved encrypted on this browser device.
        </p>
      </div>:undefined}
    >
      {authorizationPanel}
      {tradingNotice&&<p role="status" className="text-xs text-amber-500 break-all mt-2">
        {tradingNotice}
      </p>}
    </HideDexTradingAuthorizationSheet>}
    {marketSelectorOpen && (
      <MarketSelector
        favorites={[...watchlist]}
        onToggleFavorite={onToggleFavorite}
        tokens={lighterTokens}
        selectedSymbol={lighterSelectedSymbol}
        onClose={() => setMarketSelectorOpen(false)}
        onSelectToken={(symbol, marketKind) => {
          const row = lighterTokens.find(t => t.symbol === symbol &&
            (marketKind === "spot" ? t.isSpotOnly : !t.isSpotOnly));
          const m = markets.find(m => m.symbol === row?.sourceCoin &&
            m.kind === marketKind);
          if (m) chooseMarket(m, section === "trade");
        }}
        initialCategory={kind === "spot" ? "spot" : "perps"}
        externalPricesOnly={true}
      />
    )}
    {marketError && <div role="alert" className="mb-2 p-3 border border-rose-500/40 rounded-lg text-xs text-rose-400">
      Lighter market API unavailable: {marketError}. Hyperliquid prices are never substituted.
    </div>}
    {!loading && !marketError && !hasSpotMarkets && kind === "spot" && (
      <p role="status" className="mb-2 p-2 text-[11px] rounded-lg border border-amber-500/40 text-brand-muted">
        No verified active Lighter Spot markets were returned. Hyperliquid markets are never substituted.
      </p>
    )}
    {section === "dashboard" && (() => {
      const accounts=publicAccounts;
      const verifiedCollateral=accounts!==null && accounts.length>0 &&
        accounts.every(a=>a.collateral!==null)
          ? accounts.reduce((sum,a)=>sum+(a.collateral??0),0) : null;
      const positionsCount=accounts!==null ? accounts.reduce((sum,a)=>sum+a.positions.length,0) : null;
      return <GeneralDashboard
        tokens={lighterTokens}
        balanceUSDC={verifiedCollateral??0}
        balanceKnown={verifiedCollateral!==null}
        balanceLabel="Perp Collateral"
        nodeConnected={feed.status==="live"}
        positionsCount={positionsCount}
        walletAddress={walletAddress}
        setActiveTab={next => {
          if(next===ActiveTab.Markets)onSelectSection("markets");
          else if(next===ActiveTab.Spot)onSelectSection("trade","spot");
          else if(next===ActiveTab.Perp)onSelectSection("trade","perp");
        }}
        onSelectToken={(symbol,marketKind)=>{
          const match=lighterTokens.find(t=>t.symbol===symbol);
          const market=markets.find(m=>m.symbol===match?.sourceCoin && m.kind===marketKind);
          if(market)chooseMarket(market,true);
        }}
      />;
    })()}
    {section === "markets" && (
      <MarketsPanel
        tokens={lighterTokens}
        selectedSymbol={lighterSelectedSymbol}
        setSelectedSymbol={sym => {
          const match = lighterTokens.find(t => t.symbol === sym);
          if (match) {
            const market = markets.find(m => m.symbol === match.sourceCoin &&
              (m.kind === (match.isSpotOnly ? "spot" : "perp")));
            if (market) chooseMarket(market, false);
          }
        }}
        onSelectToken={(sym, marketKind) => {
          const found = lighterTokens.find(t => t.symbol === sym);
          const market = markets.find(m => m.symbol === found?.sourceCoin &&
            m.kind === (marketKind === "spot" ? "spot" : "perp"));
          if (market) chooseMarket(market, true);
        }}
        walletConnected={Boolean(walletAddress)}
        balanceUSDC={publicAccounts?.reduce((sum,a) => sum + (a.availableBalance ?? 0), 0) ?? 0}
        positions={[]}
        openOrders={[]}
        tradeHistory={[]}
        lighterMarketId={selected?.id}
        lighterLastPrice={marketPrice}
        lighterBook={feed}
        lighterMultiplier={selected?.multiplier}
        lighterPriceDecimals={selected?.priceDecimals}
        lighterAccountSummary={lighterAccountTabs}
      />
    )}

    {section === "trade" && <>
      {!selected && <p role="status" className="mb-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-muted">
        No matching {kind === "spot" ? "Spot" : "Perp"} market is selected. Choose an actual Lighter market before trading.
        <button type="button" onClick={() => setMarketSelectorOpen(true)} className="ml-2 underline text-accent">Select market</button>
      </p>}
      <HideDexUnifiedMarketHeader
        mobile={{
          logo:selected?renderAssetLogo(selected.symbol):null,
          ticker:selected?.symbol??"SELECT MARKET",
          modeLabel:kind==="perp"?(selected?.maxLeverage?selected.maxLeverage+"x Perp":"Perpetual"):"Spot",
          priceLabel:formatPrice(marketPrice),
          change24h:selected?.change24h,
          onSelectMarket:()=>setMarketSelectorOpen(true),
          mode:kind,
          switchMode:"toggle",
          onSwitchMode:()=>switchKind(kind==="perp"?"spot":"perp"),
        }}
        desktop={{
          logo:selected?renderAssetLogo(selected.symbol):null,
          ticker:selected?.symbol??"SELECT MARKET",
          sublabel:kind==="perp"?(selected?.maxLeverage?selected.maxLeverage+"x Perpetual":"Perpetual"):"Spot Asset",
          onMarket:()=>setMarketSelectorOpen(true),
          view:viewMode,
          onView:setViewMode,
          marketInfoOpen:isMarketInfoOpen,
          onMarketInfo:()=>setIsMarketInfoOpen(v=>!v),
        }}
        info={{
          ticker:selected?.symbol??"--",
          mode:kind,
          priceLabel:marketPrice===null?"—":"$"+formatPrice(marketPrice,Math.min(8,selected?.priceDecimals??2)),
          change24h:selected?.change24h,
          fundingRate:null,
          openInterestUsd:null,
          onSwitch:hasSpotMarkets&&selected?()=>switchKind(kind==="perp"?"spot":"perp"):undefined,
        }}
        showChartToolbar={viewMode==="chart"}
      />
      <HideDexUnifiedTradeCanvas
        marketView={<HideDexUnifiedMarketView
          view={viewMode}
          chart={selected?<TVChart key={"lighter-chart-"+selected.id}
            symbol={selected.symbol} marketCoin="" lighterMarketId={selected.id}
            isSpot={kind==="spot"} currentPrice={marketPrice}
            high24h={selected.high24h} low24h={selected.low24h}
            volume24h={selected.volume24hUsd} change24h={selected.change24h}
            tradeHistory={[]} toolbarHostId="market-chart-toolbar-host"/>:
            <p className="p-5 text-xs text-brand-muted">Choose a Lighter market.</p>}
          orderBook={selected&&lighterTokens.find(t=>t.symbol===lighterSelectedSymbol)?
            <TopOrderBookView symbol={selected.symbol.split("/")[0]}
              currentToken={{...lighterTokens.find(t=>t.symbol===lighterSelectedSymbol)!,price:marketPrice}}
              asks={makeLighterBookRows(feed.asks,"ask").reverse()}
              bids={makeLighterBookRows(feed.bids,"bid")}
              priceDecimals={Math.min(8,selected.priceDecimals)}
              onSelectPrice={price=>setLimitPrice(String(price))}/>:
            <p className="p-5 text-xs text-brand-muted">Choose a Lighter market.</p>}
        />}
        orderForm={<HideDexUnifiedOrderForm
          connected={!!walletAddress}
          onConnect={onConnectWallet}
          onSubmit={event=>event.preventDefault()}
          selectors={{
            isPerp:kind==="perp",
            orderType:orderType.toUpperCase() as TradeOrderType,
            availableOrderTypes:["MARKET","LIMIT"],
            onOrderType:next=>{if(next==="MARKET"||next==="LIMIT")setOrderType(next.toLowerCase() as "market"|"limit");},
            marginMode:marginMode.toUpperCase() as "CROSS"|"ISOLATED",
            onMarginMode:next=>{
              const mode=next.toLowerCase() as "cross"|"isolated";
              setMarginMode(mode);queueMarginUpdate(chosenLeverage,mode);
            },
            leverage:chosenLeverage,
            maxLeverage:selected?.maxLeverage??null,
            onLeverage:next=>setChosenLeverage(next),
            onLeverageCommit:next=>queueMarginUpdate(next,marginMode),
            leverageDisabled:!selected?.maxLeverage,
          }}
          side={{
            isPerp:kind==="perp",
            side:side==="buy"?"BUY":"SELL",
            onSide:next=>{setSide(next==="BUY"?"buy":"sell");setReduceOnly(false);},
            available:availableForMarket!==null?formatPrice(availableForMarket,5)+" USDC":"—",
          }}
          basic={{
            type:orderType==="market"?"MARKET":"LIMIT",
            price:limitPrice,onPrice:setLimitPrice,midPrice:marketPrice,
            size:amount,onSize:setAmount,
            sizeUnit:sizeUnit==="USD"?"USDC":selected?.symbol.split("/")[0]??"COIN",
            onToggleUnit:()=>{
              if(inputPrice&&inputPrice>0&&inputAmount>0)
                setAmount(String(Number((sizeUnit==="USD"?inputAmount/inputPrice:inputAmount*inputPrice).toFixed(6))));
              else setAmount("");
              setSizeUnit(v=>v==="USD"?"COIN":"USD");
            },
          }}
          presets={{
            disabled:!marketPrice||availableForMarket===null,
            onSelect:percent=>{
              const available=availableForMarket??0;
              const price=orderType==="limit"?Number(limitPrice):marketPrice;
              const notional=available*percent/100*(kind==="perp"?chosenLeverage:1);
              if(price&&price>0&&notional>0)setAmount(String(Number((sizeUnit==="USD"
                ?notional:notional/price).toFixed(sizeUnit==="USD"?6:10))));
            },
          }}
          options={{
            visible:kind==="perp",
            reduce:{
              checked:reduceOnly,
              disabled:!tradingIdentity||tradingBusy||!hasReduciblePosition,
              title:!hasReduciblePosition?"Reduce Only requires a verified opposite-side position":undefined,
              onChange:setReduceOnly,
            },
            tpsl:{checked:attachTpSl,disabled:tradingBusy||reduceOnly,onChange:setAttachTpSl},
            tp:!reduceOnly?{
              price:{kind:"tp",value:takeProfit,
                onChange:e=>{setTakeProfit(e.target.value);setTpGainInput(fromLighterPrice(e.target.value,"tp",tpUnit));},
                disabled:tradingBusy},
              outcome:{kind:"tp",value:tpGainInput,unit:tpUnit,open:showTpUnitDropdown,
                onToggle:()=>setShowTpUnitDropdown(v=>!v),
                onUnit:next=>{setTpUnit(next);setTpGainInput(fromLighterPrice(takeProfit,"tp",next));setShowTpUnitDropdown(false);},
                onChange:value=>{setTpGainInput(value);setTakeProfit(toLighterPrice(value,"tp",tpUnit));},
                disabled:tradingBusy},
            }:undefined,
            sl:!reduceOnly?{
              price:{kind:"sl",value:stopLoss,
                onChange:e=>{setStopLoss(e.target.value);setSlLossInput(fromLighterPrice(e.target.value,"sl",slUnit));},
                disabled:tradingBusy},
              outcome:{kind:"sl",value:slLossInput,unit:slUnit,open:showSlUnitDropdown,
                onToggle:()=>setShowSlUnitDropdown(v=>!v),
                onUnit:next=>{setSlUnit(next);setSlLossInput(fromLighterPrice(stopLoss,"sl",next));setShowSlUnitDropdown(false);},
                onChange:value=>{setSlLossInput(value);setStopLoss(toLighterPrice(value,"sl",slUnit));},
                disabled:tradingBusy},
            }:undefined,
          }}
          summary={{
            isPerp:kind==="perp",
            // The estimate is a live scenario, NOT an exact liquidation or
            // an existing position's liq. Unknown data stays unavailable.
            liquidationLabel:"New Order Liq.",
            liquidation:draftLiqPrice!==null?"≈$"+formatPrice(draftLiqPrice,4):"—",
            orderValue:orderValueUsd!==null?"$"+formatPrice(orderValueUsd,2):"—",
            margin:previewMargin!==null?
              "≈$"+formatPrice(previewMargin,4):"—",
          }}
          place={{
            type:"button",onClick:submitTrade,side:side==="buy"?"BUY":"SELL",
            busy:tradingBusy,
            disabled:tradingBusy||!walletAddress||!selected||feed.status!=="live"||!(sizeInCoin>0),
            label:tradingBusy?"Processing…":"PLACE "+(side==="buy"?(kind==="perp"?"LONG":"BUY"):(kind==="perp"?"SHORT":"SELL")),
          }}
        />}
        orderBook={<>
        <HideDexOrderBookPanel
          asks={makeLighterBookRows(feed.asks,"ask").reverse()}
          bids={makeLighterBookRows(feed.bids,"bid")}
          midPrice={marketPrice}
          midLabel="Last Price"
          sizeUnit={orderBookSizeUnit}
          baseSymbol={selected?.symbol.split("/")[0] ?? "COIN"}
          onToggleSizeUnit={() => setOrderBookSizeUnit(v=>v==="USD"?"COIN":"USD")}
          onSelectPrice={price => setLimitPrice(String(price))}
          formatPrice={price => formatPrice(price,Math.min(8,selected?.priceDecimals??2))}
          formatSize={(price,size) => {
            const v = orderBookSizeUnit === "USD" ? price*size : size;
            return (orderBookSizeUnit === "USD" ? "$" : "") + formatPrice(v,orderBookSizeUnit==="USD"?2:5);
          }}
          group={String(bookGroup)}
          groupOptions={["1","10","100"]}
          onGroup={v => setBookGroup(Number(v))}
          shrinkOnTpSl={attachTpSl && !reduceOnly}
        />
</>}
        account={lighterAccountTabs}
      />
    </>}

    {section === "funds" && (() => {
      const verifiedCollateral = publicAccounts !== null && publicAccounts.length > 0 && publicAccounts.every(a => a.collateral !== null)
        ? publicAccounts.reduce((total, a) => total + (a.collateral ?? 0), 0) : null;
      const verifiedAvailable = publicAccounts !== null && publicAccounts.length > 0 && publicAccounts.every(a => a.availableBalance !== null)
        ? publicAccounts.reduce((total, a) => total + (a.availableBalance ?? 0), 0) : null;
      const showBalance = (value: number | null) =>
        <TrustShieldValue fieldKey="portfolio" value={hideBalance ? "••••••" : value === null ? "—" : formatPrice(value, 2) + " USDC"} hideEyeIcon />;
      // Account collateral and wallet Spot USDC are distinct Lighter balances.
      // Available Spot must exclude genuine locked funds, never include them.
      const spotAssets = publicAccounts?.flatMap(a => a.assets ?? []) ?? [];
      const spotReady = publicAccounts !== null && publicAccounts.length > 0 &&
        publicAccounts.every(a => a.assets !== null);
      const usdcAssets = spotAssets.filter(a => a.symbol.toUpperCase() === "USDC");
      const spotTotalUsdc = spotReady
        ? usdcAssets.reduce((sum,a)=>sum+a.balance,0) : null;
      const spotAvailable = spotReady && usdcAssets.every(a=>a.lockedBalance!==null)
        ? usdcAssets.reduce((sum,a)=>sum+Math.max(0,a.balance-(a.lockedBalance??0)),0) : null;
      // Non-USDC Spot assets cannot be valued at arbitrary $1. Show unknown
      // combined total unless every non-USDC holding is actually zero.
      const unvaluedSpotAssets = spotAssets.some(a=>a.symbol.toUpperCase()!=="USDC" && a.balance>0);
      const combinedUsdc = verifiedCollateral!==null && spotTotalUsdc!==null && !unvaluedSpotAssets
        ? verifiedCollateral+spotTotalUsdc : null;
      const combinedPct = combinedUsdc!==null && combinedUsdc>0;
      const unrealizedPnl = publicAccounts !== null && publicAccounts.length > 0 && publicAccounts.every(a => a.positions.every(p => p.unrealizedPnl !== null))
        ? publicAccounts.flatMap(a => a.positions).reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0) : null;
      return <div id="funds-portfolio-container" className="space-y-3 sm:space-y-4 text-brand-text font-sans bg-brand-bg px-3 pt-2 pb-2 sm:p-4 sm:pb-8 rounded-3xl max-w-4xl mx-auto w-full">
        <HideDexFundsOverview
          totalLabel="TOTAL FUNDS"
          totalValue={showBalance(combinedUsdc)}
          approximateValue={hideBalance ? "≈ ••••••" : combinedUsdc === null ? "—" : "≈ " + formatPrice(combinedUsdc,2) + " USD (USDC-only)"}
          accountLabel="Lighter Account"
          accountModeLabel="Lighter"
          walletAddress={walletAddress}
          walletDisplay={walletAddress ? walletAddress.slice(0,6) + "…" + walletAddress.slice(-3) : "Not connected"}
          hideBalances={hideBalance}
          onToggleBalances={() => setHideBalance(x => !x)}
          addressCopied={copiedAddress}
          onCopyAddress={async () => {
            try { await navigator.clipboard.writeText(walletAddress); setCopiedAddress(true); }
            catch {setCopiedAddress(false);}
          }}
          accountError={accountError}
          depositLabel="Deposit"
          depositSubtitle="Add funds"
          withdrawLabel="Withdrawal"
          withdrawSubtitle="Send funds"
          onDeposit={() => {setFundsModal("deposit");setFundingStatus("");}}
          onWithdraw={() => {setFundsModal("withdraw");setFundingStatus("");}}
          cards={[
            {label:"Spot Available",value:showBalance(spotAvailable),subtitle:"Lighter Spot USDC (separate)",
              icon:<Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>},
            {label:"Perpetual Balance",value:showBalance(verifiedCollateral),subtitle:"Verified Lighter Perp collateral",
              icon:<TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>,iconTone:"text-success"},
            {label:"Available for Trade",value:showBalance(verifiedAvailable),subtitle:"Exchange-reported available balance",
              icon:<Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>},
            {label:"Margin in Trade",value:showBalance(null),subtitle:"Locked margin not independently verified",
              icon:<Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>,iconTone:"text-amber-500"},
          ]}
        />
        <HideDexAssetAllocation
          totalLabel="TOTAL"
          totalValue={hideBalance ? "••••" : combinedUsdc===null ? "—" : formatPrice(combinedUsdc,2)}
          chartValues={hideBalance || !combinedPct ? [] : [
            {value:verifiedCollateral??0,color:"#18c29c"},
            {value:spotTotalUsdc??0,color:"#717b8b"},
          ]}
          rows={[
            {label:"Perp Collateral",color:"#18c29c",amount:showBalance(verifiedCollateral),
              percentage:hideBalance||!combinedPct?null:100*(verifiedCollateral??0)/combinedUsdc!},
            {label:"Spot USDC",color:"#717b8b",amount:showBalance(spotTotalUsdc),
              percentage:hideBalance||!combinedPct?null:100*(spotTotalUsdc??0)/combinedUsdc!},
          ]}
        />
        <HideDexFundsPerformance
          period={performancePeriod}
          onPeriod={setPerformancePeriod}
          market={performanceMarket}
          onMarket={setPerformanceMarket}
          summary={<AnalyticsPanel
            period={performancePeriod}
            market={performanceMarket}
            walletConnected={Boolean(walletAddress)}
            walletAddress={walletAddress}
            fills={[]}
            loading={publicAnalyticsLoading || fillsLoading}
            failed={Boolean(publicAnalyticsError || fillsError)}
            sensitiveHidden={hideBalance}
            venueStats={{
              // Lighter publishes cumulative trading PnL observations, not a
              // verified equity series. Show their selected-window change ONLY.
              pnl:performanceMarket==="all" && publicAnalytics &&
                publicAnalytics.tradePnlSeries.length >= 2 ?
                publicAnalytics.tradePnlSeries[publicAnalytics.tradePnlSeries.length-1].value -
                publicAnalytics.tradePnlSeries[0].value : null,
              volume:performanceMarket==="all"
                ? (publicAnalytics?.volumeUsd ?? null)
                : (lighterStats?.volume ?? null),
              fees:lighterStats?.fee ?? null,
              orders:lighterStats?.orders ?? null,
              pnlLabel:"Trading PnL (Lighter)",
              volumeLabel:performanceMarket==="all"?"Total Volume":"Volume (loaded fills)",
              feesLabel:"Fees (USDC · loaded)",
              ordersLabel:"Executed orders (loaded)",
            }}
          />}
          chart={<HideDexPerformanceAreaChart
            period={performancePeriod}
            data={performanceMarket==="all" && publicAnalytics ?
              publicAnalytics.tradePnlSeries.map(point=>({
                timestamp:point.time,value:point.value,
              })) : []}
            label="Trading PnL"
            hidden={hideBalance}
            loading={publicAnalyticsLoading}
            emptyMessage={performanceMarket!=="all"?
              "Spot/Perps historical breakdown is not verified for Lighter.":
              publicAnalyticsError || "No verified Lighter trading PnL history for this period."}
          />}
        />
        <DailyFillVolumeBars
          fills={performanceMarket==="all" && publicAnalytics ?
            publicAnalytics.buckets.map(row=>({time:row.time,volumeUsd:row.volumeUsd})):
            lighterStats?.chartFills??[]}
          period={performancePeriod}
          walletConnected={Boolean(walletAddress)}
          sensitiveHidden={hideBalance}
          sourceLabel={performanceMarket==="all" && publicAnalytics?"Lighter public account volume":"loaded fills"}
          unavailableMessage={!walletAddress?undefined:
            performanceMarket==="all"?
              (publicAnalyticsLoading?"Loading public Lighter volume…":
               publicAnalyticsError||(!publicAnalytics?"Lighter public volume unavailable.":undefined)):
            restoringSavedSigner?"Restoring saved Lighter data…":
            !tradingIdentity?"Lighter fills require a verified account key.":
            fillsError||(!liveFills?"Loading verified Lighter fills…":undefined)}
        />
      </div>;
    })()}

    {fundsModal && section === "funds" && (
      <HideDexFundsDialogShell deposit={fundsModal==="deposit"}
        busy={fundingBusy} onClose={()=>setFundsModal(null)}
        subtitle={fundsModal==="deposit"
          ?"Add real USDC to your Lighter account directly from HideDex."
          :"Withdraw verified Lighter USDC to your original connected wallet."}>
          {fundsModal === "deposit" ? <>
            <p className="text-xs text-brand-muted">Real USDC → Lighter Perps. Your connected wallet signs on HideDex; no external exchange page.</p>
            <HideDexFundingNetworkAsset
              network={depositNetwork==="arbitrum"?"Arbitrum One":"Ethereum Mainnet"}
              chainId={depositNetwork==="arbitrum"?42161:1}
              options={[{value:"arbitrum",label:"Arbitrum One"},{value:"ethereum",label:"Ethereum Mainnet"}]}
              value={depositNetwork} disabled={fundingBusy}
              onNetworkChange={v=>{setDepositNetwork(v as "arbitrum"|"ethereum");setFundingStatus("");}}
            />
            <HideDexFundingAmount id="lighter-deposit-amount" amount={depositAmount}
              onAmount={setDepositAmount} disabled={fundingBusy}
              minLabel={`Minimum deposit: ${depositNetwork==="arbitrum"?5:1} USDC`}/>
            <p className="text-[11px] text-brand-muted">
              {depositNetwork === "arbitrum"
                ? "Requires Arbitrum native USDC and ETH gas. The official CCTP bridge may credit Lighter after 15–20 minutes."
                : "Requires Ethereum-mainnet USDC and ETH gas. An exact-amount USDC approval may be required."}
            </p>
            <HideDexFundingFeeCard deposit
              fee={depositNetwork==="ethereum"
                ?depositFeeQuote??"Wallet quotes ETH gas at confirmation"
                :"Wallet quotes Arbitrum gas; CCTP fee not quoted"}
              receive={depositNetwork==="ethereum"&&
                /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(depositAmount.trim())&&
                Number(depositAmount)>=1
                  ?Number(depositAmount).toLocaleString("en-US",{maximumFractionDigits:6})+
                    " USDC (direct credit, gas separate)"
                  :"—"}
            />
            <HideDexFundingSubmit deposit busy={fundingBusy}
              disabled={!walletAddress||!Number.isFinite(Number(depositAmount))||
                Number(depositAmount)<(depositNetwork==="arbitrum"?5:1)||
                !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(depositAmount.trim())}
              label="Deposit Collateral"
              onClick={async () => {
                if (fundingBusy) return;
                setFundingBusy(true);
                setFundingStatus("");
                try {
                  const depositFn = depositNetwork === "arbitrum"
                    ? depositLighterUsdcFromArbitrum : depositLighterUsdcOnEthereum;
                  await depositFn({
                    walletAddress, amount: depositAmount, getWalletProvider,
                    onStage: setFundingStatus,
                  });
                  setAccountReload(value => value + 1);
                  setDepositAmount("");
                } catch (error) {
                  setFundingStatus(error instanceof Error ? error.message : "Deposit failed. Verify wallet transactions.");
                } finally {
                  setFundingBusy(false);
                }
              }} />
          </> : <>
            <p className="text-xs text-brand-muted">Secure STANDARD USDC withdrawal to the L1 wallet that owns this Lighter account. No external website and no arbitrary recipient. Wallet and Lighter ownership are verified before submission.</p>
            {!tradingIdentity && <button type="button" onClick={() => setAuthSheetOpen(true)}
              className="text-xs font-bold text-accent underline">Enable Lighter trading to withdraw</button>}
            <HideDexFundingNetworkAsset network="Ethereum Mainnet · Secure Withdrawal" chainId={1} />
            <HideDexFundingDestination address={walletAddress}/>
            <HideDexFundingAmount id="lighter-withdraw-amount" amount={withdrawAmount}
              onAmount={setWithdrawAmount} disabled={!tradingIdentity||fundingBusy}
              balanceLabel="Perps Trading Available"
              balance={displayTradingAccount?.availableBalance==null?"—":formatPrice(displayTradingAccount.availableBalance,4)+" USDC"}
              minLabel="Minimum secure withdrawal: 1 USDC. Destination: your account owner wallet on Ethereum."/>
            <p className="text-[10px] text-brand-muted">Destination: {walletAddress || "Connect wallet"}. Secure withdrawal sends Perps USDC to the Ethereum owner wallet, subject to exchange collateral checks. Trading available balance is NOT a guaranteed withdrawal ceiling. Lighter usually claims the Ethereum exit; a manual claim may need ETH gas. No verified secure fee quote is available.</p>
            <HideDexFundingFeeCard deposit={false}
              fee="No verified secure fee quote"
              receive={/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(withdrawAmount.trim()) &&
                Number(withdrawAmount)>=1 &&
                displayTradingAccount?.availableBalance!==null &&
                displayTradingAccount?.availableBalance!==undefined &&
                Number(withdrawAmount)<=displayTradingAccount.availableBalance
                  ?Number(withdrawAmount).toLocaleString("en-US",{maximumFractionDigits:6})+
                    " USDC (gross, not net)"
                  :"—"}/>
            <p className="text-[10px] text-brand-muted">
              Gross amount only: final net received and any manual Ethereum claim gas
              are not quoted here. A withdrawal remains subject to real Lighter collateral rules.
            </p>
            <HideDexFundingSubmit deposit={false} busy={fundingBusy}
              disabled={!tradingIdentity||!withdrawAmount.trim()||
                !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(withdrawAmount.trim())||
                Number(withdrawAmount)<1||
                displayTradingAccount?.availableBalance==null||
                Number(withdrawAmount)>displayTradingAccount.availableBalance}
              onClick={submitWithdrawal}
              label="Withdraw Assets"/>
          </>}
          {fundingStatus && <p role="status" className="text-xs break-all rounded-lg border border-brand-border p-2">{fundingStatus}</p>}
      </HideDexFundsDialogShell>
    )}

    {shareTarget&&(()=> {
      const account=publicAccounts?.find(a=>a.index===shareTarget.accountIndex);
      const p=account?.positions.find(x=>x.symbol===shareTarget.symbol&&x.signedSize===shareTarget.signedSize);
      if(!p)return null;
      const market=markets.find(m=>m.kind==="perp"&&m.symbol===p.symbol);
      const setting=account?.marginSettings.find(x=>x.marketId===market?.id);
      const lev=verifiedLighterLeverage(setting?.initialMarginFraction,market?.maxLeverage);
      return <ShareCardPopup isOpen onClose={()=>setShareTarget(null)}
        walletAddress={walletAddress} verifiedOnly positionData={{
          symbol:p.symbol,type:p.signedSize>0?"LONG":"SHORT",
          size:Math.abs(p.signedSize),entryPrice:p.entryPrice,
          markPrice:market?.markPrice??null,margin:p.allocatedMargin,
          leverage:lev,
          unrealizedPnl:p.unrealizedPnl,unrealizedPnlPercent:null,
        }}/>;
    })()}
    {tpSlTarget&&(()=>{
      const account=publicAccounts?.find(a=>a.index===tpSlTarget.accountIndex);
      const position=account?.positions.find(p=>p.symbol===tpSlTarget.symbol&&p.signedSize===tpSlTarget.signedSize);
      const market=markets.find(m=>m.kind==="perp"&&m.symbol===tpSlTarget.symbol);
      if(!position||!market)return null;
      // Use verified per-account margin settings for the original modal.
      // Unavailable values remain unknown and never become synthetic PnL.
      const setting=account.marginSettings.find(x=>x.marketId===market.id);
      const leverage=verifiedLighterLeverage(setting?.initialMarginFraction,market.maxLeverage)??0;
      const modalPosition:Position={
        id:account!.index+":"+position.symbol,symbol:position.symbol,
        type:position.signedSize>0?"LONG":"SHORT",size:Math.abs(position.signedSize),
        leverage,entryPrice:position.entryPrice??0,
        markPrice:market.markPrice??market.lastTradePrice??0,
        liqPrice:position.liquidationPrice??0,
        margin:position.allocatedMargin??0,unrealizedPnl:position.unrealizedPnl??0,
        unrealizedPnlPercent:position.allocatedMargin!==null&&position.allocatedMargin>0&&
          position.unrealizedPnl!==null?100*position.unrealizedPnl/position.allocatedMargin:0,
        marginType:setting?.marginMode,
      };
      return <TpSlModal position={modalPosition} priceOnly
        openOrders={tradingIdentity?.accountIndex===account.index && liveOrders?
          liveOrders.flatMap(o=>{
            const orderMarketId=Number(o.market_index??o.market_id);
            const kind=lighterPositionTriggerKind(o);
            const triggerPx=Number(o.trigger_price);
            const oid=Number(o.order_index);
            if(orderMarketId!==market.id||!kind||
               !matchesLighterPositionTrigger(o,market.id,position.signedSize>0)||
               !Number.isFinite(triggerPx)||triggerPx<=0)return [];
            return [{
              id:market.id+":"+oid,symbol:position.symbol,
              sourceCoin:position.symbol,type:kind==="tp"?"TAKE_PROFIT":"STOP_MARKET",
              side:position.signedSize>0?"SELL":"BUY",price:triggerPx,
              size:0,status:"OPEN",timestamp:"—",reduceOnly:o.reduce_only===true,
              tpsl:kind,triggerPrice:triggerPx,
              ...(Number.isSafeInteger(oid)&&oid>=0?{oid}:{}),
            } as import("../../types").OpenOrder];
          }):[]}
        onCancelOrder={async id=>{
          const oid=Number(id.split(":").pop());
          if(Number.isSafeInteger(oid)&&oid>=0)await cancelLighterOrder(market.id,oid);
        }}
        onClose={()=>setTpSlTarget(null)} tradingEnabled={!!tradingIdentity}
        onSetupRequired={()=>setAuthSheetOpen(true)}
        onSave={async(tp,sl)=>{
          if(!tradingIdentity||tradingIdentity.accountIndex!==tpSlTarget.accountIndex)
            throw new Error("Select the verified Lighter signer for this account.");
          try{
            await setLighterPositionTriggers({
              walletAddress,market,signedSize:tpSlTarget.signedSize,
              takeProfit:tp,stopLoss:sl,
            });
            setTpSlTarget(null);
          }finally{
            // A partial or ambiguous write also needs immediate real account
            // reconciliation. Never resend a signed trigger on any timer.
            refreshAfterLighterWrite();
            try{
              const orders=await getLighterSignedOpenOrders(walletAddress);
              setLiveOrders(orders);
              setOpenOrdersError("");
            }catch{/* Timed account refresh remains scheduled. */}
          }
        }}/>;
    })()}
    {singleCloseTarget&&lighterClosePosition&&<ClosePositionModal
      position={lighterClosePosition}
      lighterMode
      verifiedMarkPrice={Boolean(markets.find(m=>m.kind==="perp"&&
        m.symbol===singleCloseTarget.symbol)?.markPrice)}
      onError={message=>{
        setNoticeKind(/pending|verif|inconclusive/i.test(message)?"pending":"error");
        setNoticeTitle("Lighter Close Position");
        setTradingNotice(message);
      }}
      verifiedUnrealizedPnl={publicAccounts
        ?.find(a=>a.index===singleCloseTarget.accountIndex)?.positions
        .find(p=>p.symbol===singleCloseTarget.symbol&&
          p.signedSize===singleCloseTarget.signedSize)?.unrealizedPnl??null}
      verifiedMargin={(()=>{
        const p=publicAccounts?.find(a=>a.index===singleCloseTarget.accountIndex)
          ?.positions.find(p=>p.symbol===singleCloseTarget.symbol&&
            p.signedSize===singleCloseTarget.signedSize);
        return p&&p.allocatedMargin!==null&&p.allocatedMargin>0?
          p.allocatedMargin:null;
      })()}
      estimatedMarginRequirement={(()=>{
        const a=publicAccounts?.find(a=>a.index===singleCloseTarget.accountIndex);
        const p=a?.positions.find(p=>p.symbol===singleCloseTarget.symbol&&
          p.signedSize===singleCloseTarget.signedSize);
        const market=markets.find(m=>m.kind==="perp"&&m.symbol===singleCloseTarget.symbol);
        const setting=a?.marginSettings.find(x=>x.marketId===market?.id);
        const leverage=verifiedLighterLeverage(setting?.initialMarginFraction,market?.maxLeverage);
        const price=market?.markPrice&&market.markPrice>0?market.markPrice:market?.lastTradePrice;
        return lighterInitialRequirement(p&&price?Math.abs(p.signedSize)*price:null,leverage);
      })()}
      onClose={()=>setSingleCloseTarget(null)}
      onConfirmClose={async(_position,closePercent)=>{
        const target=singleCloseTarget;
        if(!target)throw new Error("Verified position is unavailable.");
        await closeLighterPosition(target.accountIndex,target.symbol,target.signedSize,closePercent);
      }}
    />}
    {closeAllPositionsOpen&&<CloseAllConfirmationModal action="close_positions"
      onClose={()=>setCloseAllPositionsOpen(false)}
      onConfirm={closeAllLighterPositions}/>}
    {cancelAllOrdersOpen&&<CloseAllConfirmationModal action="cancel_orders"
      onClose={()=>setCancelAllOrdersOpen(false)}
      onConfirm={cancelAllLighterOrders}/>}
    {section === "orders" && <div className="rounded-xl border border-brand-border bg-brand-bg p-3">
      {lighterAccountTabs}
    </div>}

  </div>;
}
