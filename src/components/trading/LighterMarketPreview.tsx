import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Wallet, TrendingUp, Unlock, Lock, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown, X, ShieldCheck, Copy, Check, Eye, EyeOff, BarChart3 } from "lucide-react";
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
  verifyLighterTradingKey, updateLighterPerpMargin, type LighterTradingIdentity,
} from "../../lib/lighterTrading";
import { depositLighterUsdcOnEthereum, depositLighterUsdcFromArbitrum, type LighterWalletProvider } from "../../lib/lighterFunding";
import TVChart from "./TVChart";
import TopOrderBookView from "./TopOrderBookView";
import MarketsPanel from "../dashboard/MarketsPanel";
import GeneralDashboard from "../dashboard/GeneralDashboard";
import TradingAccountTabBar, { type TradingTabId } from "./TradingAccountTabBar";
import HideDexPositionActionBar, {type HideDexPositionSort} from "./HideDexPositionActionBar";
import HideDexPositionHeader from "./HideDexPositionHeader";
import HideDexPositionDetails from "./HideDexPositionDetails";
import HideDexTradeHistory, {type HideDexHistoryRow} from "./HideDexTradeHistory";
import {rememberLighterSigner,readRememberedLighterSigner,forgetRememberedLighterSigner} from "../../lib/lighterDeviceKey";
import CloseAllConfirmationModal from "./CloseAllConfirmationModal";
import HideDexOpenOrders, {type HideDexOpenOrderRow} from "./HideDexOpenOrders";
import HideDexBalancesView, {type HideDexBalanceItem} from "./HideDexBalancesView";
import HideDexTradeSelectors, { type TradeOrderType } from "./HideDexTradeSelectors";
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
  const [marginStatus, setMarginStatus] = useState("");
  const [marginUpdateMarketId, setMarginUpdateMarketId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"USD" | "COIN">("USD");
  const [hideBalance, setHideBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [bookGroup, setBookGroup] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [orderBookSizeUnit, setOrderBookSizeUnit] = useState<"USD" | "COIN">("USD");
  const [fundsModal, setFundsModal] = useState<"deposit" | "withdraw" | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNetwork, setDepositNetwork] = useState<"arbitrum" | "ethereum">("arbitrum");
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingStatus, setFundingStatus] = useState("");
  const [accountReload, setAccountReload] = useState(0);
  const [tradingIdentity, setTradingIdentity] = useState<LighterTradingIdentity | null>(
    () => getActiveLighterSigner(walletAddress));
  const [tradingBusy, setTradingBusy] = useState(false);
  const [tradingNotice, setTradingNotice] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showExistingKey, setShowExistingKey] = useState(false);
  const [existingKey, setExistingKey] = useState("");
  const [existingAccountIndex, setExistingAccountIndex] = useState("");
  const [existingApiKeyIndex, setExistingApiKeyIndex] = useState("");
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
    if (!tradingNotice || authSheetOpen) return;
    const id=window.setTimeout(()=>setTradingNotice(""),8000);
    return ()=>window.clearTimeout(id);
  },[tradingNotice,authSheetOpen]);

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
  const reconnectExistingLighterKey = async () => {
    if (!walletAddress || tradingBusy) return;
    setTradingBusy(true); setTradingNotice("");
    try {
      const identity = await reconnectLighterTradingKey({
        walletAddress, accountIndex: Number(existingAccountIndex),
        apiKeyIndex: Number(existingApiKeyIndex), apiPrivateKey: existingKey.trim(),
      });
      setTradingIdentity(identity);
      try {
        await rememberLighterSigner(walletAddress,{
          accountIndex:identity.accountIndex,apiKeyIndex:identity.apiKeyIndex,
          apiPrivateKey:existingKey.trim(),
        });
      } catch { /* Signing stays in volatile memory when storage is unavailable. */ }
      setExistingKey(""); setShowExistingKey(false);
      setAuthSheetOpen(false);
      try { localStorage.setItem("hidedex:lighter:key-ref:"+walletAddress.toLowerCase(),JSON.stringify({
        accountIndex:identity.accountIndex,apiKeyIndex:identity.apiKeyIndex,
      })); } catch { /* Continue without storing a public reference. */ }
      setTradingNotice("Existing Lighter API key verified for this connected wallet.");
    } catch (e) {
      setTradingNotice(e instanceof Error ? e.message : "Trading key verification failed.");
    } finally { setTradingBusy(false); }
  };
  const submitTrade = async () => {
    if (!walletAddress || !selected || tradingBusy) return;
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
    // A slider change is only a draft; do not send a leveraged-sized order
    // when its requested on-chain margin setting was rejected or not applied.
    if(kind==="perp"&&chosenLeverage>1&&marginUpdateMarketId!==selected.id){
      setTradingNotice("Confirm the real Lighter margin update before placing an order sized at "+
        chosenLeverage+"x. Your selected leverage is only a draft.");
      return;
    }
    const orderSide = side === "buy" ? (kind === "perp" ? "LONG" : "BUY") : (kind === "perp" ? "SHORT" : "SELL");
    if (!window.confirm("LIVE LIGHTER MAINNET " + orderSide + " " + selected.symbol +
      "\nSize: " + sizeInCoin + "\nType: " + orderType +
      "\nApprox. value: $" + formatPrice(orderValueUsd, 2) +
      (attachTpSl ? "\nTP: " + (takeProfit || "none") + "\nSL: " + (stopLoss || "none") : "") +
      "\nProceed with a REAL signed order?")) return;
    setTradingBusy(true); setTradingNotice("Signing and submitting real Lighter mainnet order…");
    try {
      const tx = await submitLighterOrder({
        walletAddress, market: selected, side, type: orderType,
        coinSize: sizeInCoin, limitPrice: Number(limitPrice),
        referencePrice: marketPrice, reduceOnly,
        takeProfit:attachTpSl && takeProfit.trim() ? Number(takeProfit) : undefined,
        stopLoss:attachTpSl && stopLoss.trim() ? Number(stopLoss) : undefined,
      });
      setTradingNotice("Lighter accepted order. Transaction: " + tx + ". Confirm fills in Positions/Orders.");
      setAmount("");
      setAccountReload(v => v + 1);
    } catch (e) {
      setTradingNotice(e instanceof Error ? e.message : "Lighter rejected order.");
    } finally { setTradingBusy(false); }
  };
  const submitWithdrawal = async () => {
    if (!walletAddress || !tradingIdentity || fundingBusy) return;
    const n = Number(withdrawAmount);
    if (!Number.isFinite(n) || n <= 0) { setFundingStatus("Enter a valid USDC amount."); return; }
    if (!window.confirm("REAL LIGHTER MAINNET WITHDRAWAL\n" + withdrawAmount +
      " USDC to the ORIGINAL wallet: " + walletAddress +
      "\nNo arbitrary destination. Proceed?")) return;
    setFundingBusy(true); setFundingStatus("Verifying Lighter owner and available USDC…");
    try {
      const tx = await withdrawLighterUsdc({ walletAddress, amount: withdrawAmount });
      setFundingStatus("Lighter accepted standard withdrawal: " + tx + ". Final settlement may take time.");
      setWithdrawAmount(""); setAccountReload(v => v + 1);
    } catch (e) {
      setFundingStatus(e instanceof Error ? e.message : "Lighter withdrawal failed.");
    } finally { setFundingBusy(false); }
  };

  const closeLighterPosition = async (accountIndex: number, symbol: string, signedSize: number) => {
    if (!walletAddress || tradingBusy) return;
    if (!tradingIdentity) {
      // Original HideDex behavior: request signing through the bottom sheet
      // only after the user explicitly selects Close. Never auto-close.
      setTradingNotice("");
      setAuthSheetOpen(true);
      return;
    }
    if (accountIndex !== tradingIdentity.accountIndex) {
      setTradingNotice("Select the registered signer for this Lighter subaccount before closing.");
      return;
    }
    const m = markets.find(row => row.kind === "perp" && row.symbol === symbol);
    if (!m || !Number.isFinite(signedSize) || !signedSize || !(m.lastTradePrice && m.lastTradePrice > 0)) {
      setTradingNotice("Cannot verify a live Lighter market and size for this close.");
      return;
    }
    const coinSize = Math.abs(signedSize);
    if (!window.confirm("REAL LIGHTER MAINNET CLOSE POSITION\n" + m.symbol +
      "\nEntire size: " + coinSize + "\nReduce-only market order, max 2% slippage bound. Proceed?")) return;
    setTradingBusy(true); setTradingNotice("Checking actual position and sending reduce-only close…");
    try {
      const tx = await submitLighterOrder({
        walletAddress, market:m, side:signedSize > 0 ? "sell":"buy",
        type:"market", coinSize, referencePrice:m.lastTradePrice, reduceOnly:true,
      });
      setTradingNotice("Lighter accepted close order: " + tx + ". Await position refresh.");
      setAccountReload(v => v + 1);
    } catch (e) { setTradingNotice(e instanceof Error ? e.message : "Lighter close rejected."); }
    finally { setTradingBusy(false); }
  };

  /** Original4 confirmation surface calls this only on explicit user approval. */
  const closeAllLighterPositions=async():Promise<void>=>{
    if(!walletAddress||!tradingIdentity||tradingBusy)
      throw new Error("Reconnect the appropriate Lighter signer first.");
    setTradingBusy(true);
    let accepted=0;
    try{
      const indexes=await getLighterAccountIndexes(walletAddress);
      if(!indexes.includes(tradingIdentity.accountIndex))
        throw new Error("Unverified Lighter signer account. No orders sent.");
      const allAccounts=await getLighterPublicAccounts(indexes);
      if(allAccounts.some(a=>a.index!==tradingIdentity.accountIndex&&a.positions.length>0))
        throw new Error("Other Lighter subaccounts still have positions. Close separately with each account signer.");
      const account=allAccounts.find(a=>a.index===tradingIdentity.accountIndex);
      if(!account?.positions.length)throw new Error("No verified Lighter positions remain.");
      const catalog=await getLighterMarkets();
      const targets=account.positions.map(pos=>({
        pos,market:catalog.find(m=>m.kind==="perp"&&m.symbol===pos.symbol),
      }));
      if(targets.some(t=>!t.market?.lastTradePrice||t.market.lastTradePrice<=0||
        !Number.isFinite(t.pos.signedSize)||t.pos.signedSize===0))
        throw new Error("At least one open position has no verified market/size/price. No orders sent.");
      for(const {pos,market} of targets){
        if(!market?.lastTradePrice)throw new Error("Market no longer verified.");
        await submitLighterOrder({
          walletAddress,market,side:pos.signedSize>0?"sell":"buy",
          type:"market",coinSize:Math.abs(pos.signedSize),
          referencePrice:market.lastTradePrice,reduceOnly:true,
        });
        accepted++;
      }
      setTradingNotice("Lighter accepted "+accepted+" reduce-only closes. Verify final fills in Positions.");
    }catch(e){
      throw new Error((accepted?accepted+" orders already accepted. ":"")+
        (e instanceof Error?e.message:"Close All failed."));
    }finally{setAccountReload(v=>v+1);setTradingBusy(false);}
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
      setTradingNotice("Lighter accepted "+acceptedCount+" cancellations. Refresh the open orders list to verify.");
    }catch(e){
      throw new Error((acceptedCount?acceptedCount+" cancellations already accepted. ":"")+
        (e instanceof Error?e.message:"Cancel All failed."));
    }finally{
      setAccountReload(value=>value+1);
      setTradingBusy(false);
    }
  };

  const cancelLighterOrder = async (marketId: number, orderIndex: number) => {
    const m = markets.find(row => row.id === marketId);
    if (!m || !Number.isSafeInteger(orderIndex) || orderIndex < 0 ||
        !walletAddress || !tradingIdentity || tradingBusy) return;
    if (!window.confirm("CANCEL LIVE LIGHTER ORDER #" + orderIndex + " on " + m.symbol + "?")) return;
    setTradingBusy(true); setOpenOrdersError("");
    try {
      const tx = await cancelLighterSignedOrder({walletAddress,market:m,orderIndex});
      setTradingNotice("Lighter accepted cancel: " + tx);
      setAccountReload(v => v + 1);
    } catch(e) {setOpenOrdersError(e instanceof Error ? e.message:"Cancel rejected.");}
    finally {setTradingBusy(false);}
  };

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress || !tradingIdentity || accountTab !== "OPEN_ORDERS") {
      setLiveOrders(null);setOpenOrdersError("");
      return;
    }
    getLighterSignedOpenOrders(walletAddress).then(rows => {
      if(!cancelled) {setLiveOrders(rows);setOpenOrdersError("");}
    }).catch(e => {
      if(!cancelled) {setLiveOrders(null);setOpenOrdersError(e instanceof Error ? e.message:"Lighter open orders unavailable.");}
    });
    return () => {cancelled = true;};
  },[walletAddress,tradingIdentity,accountTab,accountReload]);

  useEffect(()=>{
    let stale=false;
    setLiveFills(null);setFillsError("");
    if(!walletAddress||!tradingIdentity||
      (accountTab!=="TRADE_HISTORY" && section!=="funds")){
      setFillsLoading(false);return;
    }
    setFillsLoading(true);
    getLighterSignedTradeHistory(walletAddress).then(result=>{
      if(!stale){setLiveFills(result);setFillsError("");}
    }).catch(e=>{
      if(!stale){setLiveFills(null);setFillsError(e instanceof Error?e.message:"Lighter fills unavailable.");}
    }).finally(()=>{if(!stale)setFillsLoading(false);});
    return ()=>{stale=true;};
  },[walletAddress,tradingIdentity,accountTab,section,accountReload]);

  // Keep SDK rate-limit JSON/escaped responses out of the user-facing popup.
  // A rejected margin update must not look like an applied leverage setting.
  const readableMarginError=(error:unknown):string=>{
    const raw=error instanceof Error?error.message:String(error??"");
    if(/rate.?limit|ratelimit|volume quota|429|too many requests/i.test(raw))
      return "Lighter API rate limit reached. Wait and retry the margin update; leverage was not confirmed.";
    return raw.replace(/\\n/g,"\n").trim()||"Lighter rejected leverage update.";
  };

  const submitMarginSettings = async () => {
    if (!walletAddress || !selected || kind !== "perp" || marginBusy) return;
    if (!tradingIdentity) {
      setAuthSheetOpen(true); return;
    }
    if (!selected.maxLeverage || chosenLeverage > selected.maxLeverage || chosenLeverage < 1) {
      setMarginStatus("Lighter did not verify this leverage. No update sent."); return;
    }
    if (!window.confirm("UPDATE REAL LIGHTER MARGIN SETTINGS\n" + selected.symbol +
      "\n" + marginMode.toUpperCase() + " · " + chosenLeverage + "x\nConfirm on Lighter mainnet?")) return;
    setMarginBusy(true); setMarginStatus("Submitting signed Lighter margin update…");
    try {
      const tx = await updateLighterPerpMargin({
        walletAddress, market: selected, leverage: chosenLeverage, marginMode,
      });
      setMarginUpdateMarketId(selected.id);
      setMarginStatus("Lighter accepted settings transaction " + tx +
        ". Execution must be confirmed on Lighter; the displayed choice is not a verified active setting.");
      setAccountReload(v => v + 1);
    } catch(e) {
      setMarginUpdateMarketId(null);
      setMarginStatus(readableMarginError(e));
    } finally { setMarginBusy(false); }
  };

  const authorizationPanel = (
    <div className="space-y-2 text-xs sm:text-sm">
      {tradingIdentity ? <div className="flex justify-between gap-2 items-center border border-brand-border rounded-lg p-2">
        <span className="text-emerald-500 font-bold">Lighter signing key · Account #{tradingIdentity.accountIndex} · Slot {tradingIdentity.apiKeyIndex}</span>
        <button type="button" onClick={async () => {
          await forgetRememberedLighterSigner(walletAddress).catch(()=>{});
          try{localStorage.removeItem("hidedex:lighter:key-ref:"+walletAddress.toLowerCase());}catch{}
          clearLighterTradingKey(); setTradingIdentity(null); setRecoveryKey(""); setLiveOrders(null); setLiveFills(null);
          setTradingNotice("Session key disconnected. Your registered key remains on Lighter.");
        }} className="underline text-brand-muted">Disconnect</button>
      </div> : <>
        <p className="text-brand-muted leading-relaxed">One wallet signature authorizes a personal key for Lighter mainnet orders and verified-wallet withdrawals. Review the request carefully. This browser saves the key encrypted locally on this device.</p>
        <div className="grid grid-cols-[1fr_1.9fr] gap-2 pt-2">
          <button type="button" disabled={tradingBusy} onClick={() => setAuthSheetOpen(false)}
            className="rounded-xl border border-brand-border bg-brand-surface px-2 py-3 font-bold text-brand-muted disabled:opacity-40">Cancel</button>
          <button type="button" disabled={!walletAddress || tradingBusy} onClick={beginLighterAuthorization}
            className="rounded-xl bg-white text-black px-2 py-3 font-black tracking-wide text-[11px] sm:text-xs disabled:opacity-40">
            {tradingBusy ? "SIGNING…" : "SIGN TO ENABLE TRADING →"}
          </button>
        </div>
        <button type="button" className="underline text-brand-muted" onClick={() => setShowExistingKey(v => !v)}>
          {showExistingKey ? "Hide" : "Reconnect an existing Lighter API key"}
        </button>
        {showExistingKey && <div className="space-y-2 rounded-lg border border-brand-border p-2">
          <div className="grid grid-cols-2 gap-1">
            <input type="number" value={existingAccountIndex} onChange={e => setExistingAccountIndex(e.target.value)}
              placeholder="Account index" aria-label="Lighter account index" className="min-w-0 bg-brand-bg border border-brand-border p-2 rounded"/>
            <input type="number" value={existingApiKeyIndex} onChange={e => setExistingApiKeyIndex(e.target.value)}
              placeholder="API key slot (4+)" aria-label="Lighter API key index" className="min-w-0 bg-brand-bg border border-brand-border p-2 rounded"/>
          </div>
          <input type="password" autoComplete="off" value={existingKey} onChange={e => setExistingKey(e.target.value)}
            placeholder="Existing API private key (only entered here)" aria-label="Existing Lighter API private key"
            className="w-full bg-brand-bg border border-brand-border p-2 rounded"/>
          <button type="button" disabled={tradingBusy || !existingKey.trim()} onClick={reconnectExistingLighterKey}
            className="rounded bg-brand-overlay-normal p-2 font-bold disabled:opacity-40">Verify & reconnect</button>
        </div>}
      </>}
      {recoveryKey && <div className="rounded-xl border border-amber-500/40 p-3 space-y-3">
        <p className="text-amber-500 font-bold">Save this API key securely now: it will disappear on reload. It permits trades and secure withdrawals.</p>
        <input type="password" readOnly value={recoveryKey} aria-label="One-time Lighter trading key backup"
          className="w-full p-2 rounded border border-brand-border bg-brand-bg"/>
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(recoveryKey);
            setTradingNotice("API key copied. Store it in a secure password manager, not in chats.");
          } catch { setTradingNotice("Clipboard unavailable. Save the key securely before leaving."); }
        }} className="underline text-accent">Copy recovery key</button>
        <button type="button" onClick={() => setRecoveryKey("")} className="ml-3 underline text-brand-muted">Hide backup</button>
      </div>}
    </div>
  );


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
    setPublicAccounts(null);
    setAccountError(null);
    if (!walletAddress) { setAccountsLoading(false); return () => ac.abort(); }
    setAccountsLoading(true);
    getLighterAccountIndexes(walletAddress, ac.signal).then(indexes =>
      getLighterPublicAccounts(indexes, ac.signal)
    ).then(items => {
      if (!ac.signal.aborted) setPublicAccounts(items);
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

  // Keep Lighter balances, collateral and positions fresh even when the
  // user makes a transaction outside HideDex. Read-only refresh; no signing.
  useEffect(() => {
    if (!walletAddress) return;
    const interval = window.setInterval(() => setAccountReload(n => n + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [walletAddress]);

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
    setAmount("");
    setLimitPrice("");
    setBookGroup(1);
    setReduceOnly(false);
    setMarginUpdateMarketId(null);
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
    setAmount("");
    setLimitPrice("");
    setReduceOnly(false);
    setMarginUpdateMarketId(null);
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
      const assets=account.assets?.map(asset=>({
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

  const lighterAccountTabs = (
    <div className="bg-brand-bg border border-brand-border rounded-xl overflow-hidden shadow-xl" id="terminal-dashboard-panel-unified">
      <TradingAccountTabBar
        activeTab={accountTab}
        onSelect={setAccountTab}
        showFundingHistory={true}
        positionsCount={knownPositionCount}
        ordersCount={liveOrders?.length}
      />

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
      {accountTab==="OPEN_ORDERS" && liveOrders!==null && liveOrders.length>0 && (
        <div className="flex items-center justify-end px-2.5 py-1.5 bg-brand-bg/50 border-b border-brand-border text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider relative">
          <button type="button"
            disabled={tradingBusy || !tradingIdentity}
            onClick={()=>setCancelAllOrdersOpen(true)}
            className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-40">
            Cancel All
          </button>
        </div>
      )}
      <div className="p-2 md:p-3 min-h-[110px] overflow-y-auto overflow-x-hidden">
        {accountTab === "BALANCES" && <HideDexBalancesView
          items={publicAccounts?.some(a=>a.assets===null)?null:lighterBalanceRows}
          unavailableMessage={accountsLoading?"Loading verified Lighter balances…":
            accountError?"Lighter balances unavailable: "+accountError:
            "Lighter account assets are not verified or have not loaded."}
        />}
        {accountTab === "POSITIONS" && (
          <div className="space-y-2">
            {accountsLoading && <p className="text-xs text-brand-muted">Checking Lighter positions…</p>}
            {accountError && <p className="text-xs text-rose-400">Unable to verify positions: {accountError}</p>}
            {(publicAccounts ?? []).flatMap(a => a.positions.map((p,i) => ({a,p,i})))
              .sort((x,y) => positionSort === "PNL" ? (y.p.unrealizedPnl ?? -Infinity)-(x.p.unrealizedPnl ?? -Infinity)
                : positionSort === "SIZE" ? Math.abs(y.p.signedSize)-Math.abs(x.p.signedSize)
                : positionSort === "SYMBOL" ? x.p.symbol.localeCompare(y.p.symbol) : 0)
              .map(({a,p,i}) => {
                const key = a.index + ":" + p.symbol + ":" + i;
                const isExpanded = expandedPositions[key] ?? false;
                return <div key={key} className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 md:p-4 transition-all duration-150 shadow-md flex flex-col gap-2.5 w-full text-xs font-mono text-brand-sub">
                  <HideDexPositionHeader
                    symbol={p.symbol}
                    side={p.signedSize>=0?"LONG":"SHORT"}
                    isExpanded={isExpanded}
                    onToggle={()=>setExpandedPositions(v=>({...v,[key]:!(v[key]??false)}))}
                    marginLabel={null}
                    leverageLabel={null}
                    pnl={p.unrealizedPnl}
                    roi={null}
                    shareAction={!isExpanded && <button type="button"
                      onClick={event=>{event.preventDefault();event.stopPropagation();closeLighterPosition(a.index,p.symbol,p.signedSize);}}
                      disabled={tradingBusy}
                      title={!tradingIdentity?"Tap to enable trading for this position":tradingIdentity.accountIndex!==a.index?"Select signer for this account":"Close real Lighter position"}
                      className="px-2 py-1 rounded border border-brand-loss/40 bg-brand-loss/10 text-brand-loss text-[9px] font-extrabold uppercase disabled:opacity-40">
                      Close
                    </button>}
                  />
                  {isExpanded && <HideDexPositionDetails
                    left={[
                      {label:"Position Size",value:formatPrice(Math.abs(p.signedSize),6)+" "+p.symbol,
                        hint:p.entryPrice>0 ? "($"+formatPrice(Math.abs(p.signedSize)*p.entryPrice,1)+")" : undefined},
                      {label:"Entry Price",value:p.entryPrice>0?"$"+formatPrice(p.entryPrice):"—"},
                      {label:"Margin Ratio",value:"—",tone:"muted"},
                      {label:"Liquidation Price",
                        value:p.liquidationPrice!==null&&p.liquidationPrice>0 ?
                          "$"+formatPrice(p.liquidationPrice,4):"—",tone:"muted"},
                    ]}
                    right={[
                      {label:"Margin",
                        value:p.allocatedMargin!==null&&p.allocatedMargin>=0 ?
                          "$"+formatPrice(p.allocatedMargin,4):"—",tone:"muted"},
                      {label:"Mark Price",value:"—",tone:"muted"},
                      {label:"TP / SL Target",value:"Not verified",tone:"muted"},
                    ]}
                    actions={<>
                      <button type="button" disabled title="Existing-position TP/SL attachment is not verified for Lighter"
                        className="w-full h-8 px-1 rounded-lg border bg-brand-overlay-subtle border-brand-primary/30 text-brand-primary text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest disabled:opacity-40">
                        TP/SL
                      </button>
                      <button type="button" onClick={()=>closeLighterPosition(a.index,p.symbol,p.signedSize)}
                        disabled={tradingBusy}
                        className="w-full h-8 px-1 rounded-lg border bg-brand-loss/10 hover:bg-brand-loss/20 border-brand-loss/30 text-brand-loss text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest disabled:opacity-40">
                        Close
                      </button>
                    </>}
                  />}
                </div>;
              })}
            {!walletAddress && <p className="text-xs text-brand-muted">Connect wallet to check Lighter positions.</p>}
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
                canCancel:!!market && Number.isSafeInteger(index)&&index>=0 && !tradingBusy,
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
      </div>
    </div>
  );

  return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="lighter">
    {tradingNotice && !authSheetOpen && (
      <div role="status" aria-live="polite"
        className="fixed bottom-[94px] right-3 left-3 sm:left-auto sm:max-w-sm z-[150] flex items-start justify-between gap-2 rounded-xl bg-brand-surface border border-brand-border p-3 shadow-2xl text-xs text-brand-text break-words">
        <span className="line-clamp-3">{tradingNotice}</span>
        <button type="button" aria-label="Dismiss notice" onClick={()=>setTradingNotice("")}
          className="shrink-0 rounded border border-brand-border px-2 py-1">×</button>
      </div>
    )}
    {authSheetOpen && (
      <div role="presentation" className="fixed inset-0 z-[160] flex items-end justify-center bg-black/75 backdrop-blur-[2px]"
        onMouseDown={e => { if (e.target === e.currentTarget && !tradingBusy && !recoveryKey) setAuthSheetOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-label="Enable Lighter trading"
          className="w-full max-w-lg rounded-t-[30px] border border-brand-border bg-brand-bg p-5 pb-[max(22px,env(safe-area-inset-bottom))] shadow-2xl space-y-5 max-h-[85dvh] overflow-y-auto">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-brand-border bg-brand-surface"><ShieldCheck className="w-6 h-6"/></span>
            <h2 className="font-black text-xl flex-1 text-brand-text">Enable Trading</h2>
            <button type="button" aria-label="Close enable trading" disabled={tradingBusy || Boolean(recoveryKey)}
              onClick={() => setAuthSheetOpen(false)}
              className="p-1.5 disabled:opacity-30"><X className="w-5 h-5"/></button>
          </div>
          {!tradingIdentity && <p className="text-sm text-brand-muted leading-relaxed">
            Confirm the one-time wallet authorization to activate Lighter mainnet trading on HideDex.
            This trading key can authorize orders and withdrawals to your verified wallet.
            Review the wallet request before confirming.
          </p>}
          {authorizationPanel}
          {tradingNotice && <p role="status" className="text-xs text-amber-500 break-all">{tradingNotice}</p>}
          {tradingIdentity && !recoveryKey && <button type="button"
            className="w-full bg-white text-black rounded-xl p-3 text-sm font-extrabold"
            onClick={() => setAuthSheetOpen(false)}>Continue trading</button>}
          {recoveryKey && <button type="button" className="w-full bg-white text-black rounded-xl p-3 text-sm font-bold"
            onClick={() => {setRecoveryKey("");setAuthSheetOpen(false);}}>
            I have securely saved my key
          </button>}
        </section>
      </div>
    )}
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
      <HideDexMobileMarketHeader
        logo={selected ? renderAssetLogo(selected.symbol) : null}
        ticker={selected?.symbol ?? "SELECT MARKET"}
        modeLabel={kind==="perp" ? (selected?.maxLeverage ? selected.maxLeverage + "x Perp" : "Perpetual") : "Spot"}
        priceLabel={formatPrice(marketPrice)}
        change24h={selected?.change24h}
        onSelectMarket={() => setMarketSelectorOpen(true)}
        mode={kind}
        switchMode="toggle"
        onSwitchMode={() => switchKind(kind==="perp"?"spot":"perp")}
      />
      <div id="terminal-unified-market-header"
        className="hidden md:block relative glass-panel rounded-xl border border-brand-border bg-brand-surface py-1.5 px-2 sm:px-2.5 select-none shadow-sm mb-1.5 md:mb-2">
        <HideDexDesktopMarketBar
          logo={selected ? renderAssetLogo(selected.symbol) : null}
          ticker={selected?.symbol??"SELECT MARKET"}
          sublabel={kind==="perp" ? (selected?.maxLeverage ? selected.maxLeverage+"x Perpetual":"Perpetual") : "Spot Asset"}
          onMarket={()=>setMarketSelectorOpen(true)}
          view={viewMode}
          onView={setViewMode}
          marketInfoOpen={isMarketInfoOpen}
          onMarketInfo={()=>setIsMarketInfoOpen(v=>!v)}

        />
        {isMarketInfoOpen && <HideDexMarketInfoDropdown
          ticker={selected?.symbol??"--"}
          mode={kind}
          priceLabel={marketPrice===null?"—":"$"+formatPrice(marketPrice,Math.min(8,selected?.priceDecimals??2))}
          change24h={selected?.change24h}
          fundingRate={null}
          openInterestUsd={null}
          onSwitch={hasSpotMarkets&&selected?()=>switchKind(kind==="perp"?"spot":"perp"):undefined}
        />}
        {viewMode==="chart" && <>
          <div className="w-full h-px bg-brand-border/60 my-1 sm:my-1.5"/>
          <div id="market-chart-toolbar-host" className="w-full min-w-0 flex items-center min-h-[28px] border-b border-brand-border/40"/>
        </>}
      </div>
      <HideDexTopMarketPane>
        {viewMode === "chart" ? selected ? <TVChart key={"lighter-chart-" + selected.id}
          symbol={selected.symbol} marketCoin="" lighterMarketId={selected.id}
          isSpot={kind === "spot"} currentPrice={marketPrice}
          high24h={selected.high24h} low24h={selected.low24h}
          volume24h={selected.volume24hUsd} change24h={selected.change24h}
          tradeHistory={[]} toolbarHostId="market-chart-toolbar-host"
        /> : <p className="p-5 text-xs text-brand-muted">Choose a Lighter market.</p> : (
          selected && lighterTokens.find(t=>t.symbol===lighterSelectedSymbol) ?
          <TopOrderBookView
            symbol={selected.symbol.split("/")[0]}
            currentToken={{...lighterTokens.find(t=>t.symbol===lighterSelectedSymbol)!,price:marketPrice}}
            asks={makeLighterBookRows(feed.asks,"ask").reverse()}
            bids={makeLighterBookRows(feed.bids,"bid")}
            priceDecimals={Math.min(8,selected.priceDecimals)}
            onSelectPrice={price=>setLimitPrice(String(price))}
          /> : <p className="p-5 text-xs text-brand-muted">Choose a Lighter market.</p>
        )}
      </HideDexTopMarketPane>
      <HideDexTradeGrid>
        <HideDexOrderForm>
          {!walletAddress && (
            <div className="absolute inset-0 bg-brand-bg/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-2 text-center rounded-xl">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-1.5">
                <Wallet className="w-4 h-4 text-indigo-400"/>
              </div>
              <h4 className="font-sans font-bold text-brand-text text-[10px] md:text-xs uppercase tracking-wider mb-0.5">Not Connected</h4>
              <p className="text-[9px] md:text-[10px] text-gray-500 max-w-[180px] leading-snug mb-2.5">Connect your wallet to trade.</p>
              <button type="button" onClick={onConnectWallet}
                className="w-full max-w-[130px] py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-brand-text shadow-lg cursor-pointer transition-all active:scale-98">
                Connect
              </button>
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 md:gap-3">
          <HideDexTradeSelectors
            isPerp={kind === "perp"}
            orderType={orderType.toUpperCase() as TradeOrderType}
            availableOrderTypes={["MARKET","LIMIT"]}
            onOrderType={next => {if(next === "MARKET" || next === "LIMIT") setOrderType(next.toLowerCase() as "market"|"limit");}}
            marginMode={marginMode.toUpperCase() as "CROSS"|"ISOLATED"}
            onMarginMode={next => {setMarginMode(next.toLowerCase() as "cross"|"isolated");setMarginUpdateMarketId(null);setMarginStatus("");}}
            leverage={chosenLeverage}
            maxLeverage={selected?.maxLeverage ?? null}
            onLeverage={next => {setChosenLeverage(next);setMarginUpdateMarketId(null);setMarginStatus("");}}
            onApplySettings={submitMarginSettings}
            settingsBusy={marginBusy}
            settingsMessage={marginStatus}
            leverageDisabled={!selected?.maxLeverage}
          />
          <HideDexSideAndAvailability
            isPerp={kind==="perp"}
            side={side==="buy"?"BUY":"SELL"}
            onSide={next=>{setSide(next==="BUY"?"buy":"sell");setReduceOnly(false);}}
            available={availableForMarket !== null
              ? formatPrice(availableForMarket,5)+" USDC" : "—"}
          />
                    <HideDexBasicOrderInputs
            type={orderType==="market"?"MARKET":"LIMIT"}
            price={limitPrice}
            onPrice={setLimitPrice}
            midPrice={marketPrice}
            size={amount}
            onSize={setAmount}
            sizeUnit={sizeUnit==="USD"?"USDC":selected?.symbol.split("/")[0] ?? "COIN"}
            onToggleUnit={()=>{
              if(inputPrice && inputPrice>0 && inputAmount>0)
                setAmount(String(Number((sizeUnit==="USD"?inputAmount/inputPrice:inputAmount*inputPrice).toFixed(6))));
              else setAmount("");
              setSizeUnit(v=>v==="USD"?"COIN":"USD");
            }}
          />
          <HideDexTradePercentPresets
            disabled={!marketPrice || availableForMarket === null}
            onSelect={percent => {
              const available=availableForMarket??0;
              const price=orderType==="limit"?Number(limitPrice):marketPrice;
              // Like the Original4 perp percentage presets, margin × chosen
              // leverage gives a *draft* notional. Spot never uses leverage.
              // Real execution still requires Lighter to accept the margin update.
              const notional=available*percent/100*(kind==="perp"?chosenLeverage:1);
              if(price&&price>0&&notional>0)setAmount(String(Number((sizeUnit==="USD"
                ? notional:notional/price).toFixed(sizeUnit==="USD"?6:10))));
            }}
          />
          {kind === "perp" && <>
            <div className="border-t border-brand-border/35 pt-2 px-0.5">
              <HideDexTradeOptionToggle kind="reduce" checked={reduceOnly}
                disabled={!tradingIdentity || tradingBusy || !hasReduciblePosition}
                title={!hasReduciblePosition?"Reduce Only requires a verified opposite-side position":undefined}
                onChange={setReduceOnly}/>
            </div>
            <div className="border-t border-brand-border/35 pt-2">
              <HideDexTradeOptionToggle kind="tpsl" checked={attachTpSl}
                disabled={tradingBusy || reduceOnly}
                onChange={setAttachTpSl}/>
            </div>
            {attachTpSl && !reduceOnly && <div className="grid grid-cols-2 gap-1.5 md:gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative"><HideDexTradeTriggerPrice kind="tp" value={takeProfit}
                onChange={e=>{setTakeProfit(e.target.value);setTpGainInput(fromLighterPrice(e.target.value,"tp",tpUnit));}}
                disabled={tradingBusy}/></div>
              <HideDexTradeOutcomeInput kind="tp" value={tpGainInput} unit={tpUnit}
                open={showTpUnitDropdown} onToggle={()=>setShowTpUnitDropdown(v=>!v)}
                onUnit={next=>{setTpUnit(next);setTpGainInput(fromLighterPrice(takeProfit,"tp",next));setShowTpUnitDropdown(false);}}
                onChange={value=>{setTpGainInput(value);setTakeProfit(toLighterPrice(value,"tp",tpUnit));}}
                disabled={tradingBusy}/>
              <div className="relative"><HideDexTradeTriggerPrice kind="sl" value={stopLoss}
                onChange={e=>{setStopLoss(e.target.value);setSlLossInput(fromLighterPrice(e.target.value,"sl",slUnit));}}
                disabled={tradingBusy}/></div>
              <HideDexTradeOutcomeInput kind="sl" value={slLossInput} unit={slUnit}
                open={showSlUnitDropdown} onToggle={()=>setShowSlUnitDropdown(v=>!v)}
                onUnit={next=>{setSlUnit(next);setSlLossInput(fromLighterPrice(stopLoss,"sl",next));setShowSlUnitDropdown(false);}}
                onChange={value=>{setSlLossInput(value);setStopLoss(toLighterPrice(value,"sl",slUnit));}}
                disabled={tradingBusy}/>
            </div>}
          </>}
          <div className="bg-brand-bg/50 border border-brand-border rounded-lg p-1.5 text-[9px] md:text-[10px] font-mono space-y-0.5 mt-auto">
            {kind === "perp" && <div className="flex justify-between text-brand-muted"><span>Liq. Price</span><span>—</span></div>}
            <div className="flex justify-between text-brand-muted"><span>Order Value</span>
              <span>{orderValueUsd !== null ? "$" + formatPrice(orderValueUsd, 2) : "—"}</span>
            </div>
            {kind === "perp" && <div className="flex justify-between text-brand-muted"><span>Margin</span><span>—</span></div>}
          </div>
          <button type="button" onClick={submitTrade}
            disabled={tradingBusy || !walletAddress || !selected || feed.status !== "live" || !(sizeInCoin > 0)}
            title={!tradingIdentity ? "Fill the order and tap Place to enable trading" : "Confirm a real Lighter mainnet order"}
            className={"w-full py-2 rounded-lg text-[10px] md:text-xs font-display font-black uppercase disabled:opacity-50 " +
              (side === "buy" ? "bg-[#18c29c] text-[#030610]" : "bg-[#f25c5c] text-white")}>
            {tradingBusy ? "Processing…" : "PLACE " + (side === "buy" ? (kind === "perp" ? "LONG" : "BUY") : (kind === "perp" ? "SHORT" : "SELL"))}
          </button>
          </div>
        </HideDexOrderForm>
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
      </HideDexTradeGrid>
      {lighterAccountTabs}
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
      <div role="presentation" className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs"
        onMouseDown={event=>{if(event.target===event.currentTarget&&!fundingBusy)setFundsModal(null);}}>
        <section role="dialog" aria-modal="true" aria-label={fundsModal==="deposit"?"Deposit to Lighter":"Withdraw from Lighter"}
          className="relative bg-brand-surface border-0 sm:border border-brand-border rounded-none sm:rounded-[24px] w-screen sm:w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-[32rem] shadow-2xl flex flex-col overflow-hidden pt-safe pb-safe">
          <HideDexFundsModalHeader deposit={fundsModal==="deposit"} disabled={fundingBusy}
            onClose={()=>setFundsModal(null)}
            subtitle={fundsModal==="deposit"
              ?"Add real USDC to your Lighter account directly from HideDex."
              :"Withdraw verified Lighter USDC to your original connected wallet."}/>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] space-y-4">
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
            <HideDexFundingFeeCard deposit fee={null} receive={null}/>
            <HideDexFundingSubmit deposit busy={fundingBusy}
              disabled={!walletAddress||!depositAmount.trim()}
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
            <HideDexFundingNetworkAsset network="Lighter settlement" />
            <HideDexFundingDestination address={walletAddress}/>
            <HideDexFundingAmount id="lighter-withdraw-amount" amount={withdrawAmount}
              onAmount={setWithdrawAmount} disabled={!tradingIdentity||fundingBusy}
              balanceLabel="Available Balance"
              balance={displayTradingAccount?.availableBalance==null?"—":formatPrice(displayTradingAccount.availableBalance,4)+" USDC"}/>
            <p className="text-[10px] text-brand-muted">Destination: {walletAddress || "Connect wallet"}. Network fees, account minimums and final timing are determined by Lighter.</p>
            <HideDexFundingFeeCard deposit={false} fee={null} receive={null}/>
            <HideDexFundingSubmit deposit={false} busy={fundingBusy}
              disabled={!tradingIdentity||!withdrawAmount.trim()} onClick={submitWithdrawal}
              label="Withdraw Assets"/>
          </>}
          {fundingStatus && <p role="status" className="text-xs break-all rounded-lg border border-brand-border p-2">{fundingStatus}</p>}
          </div>
        </section>
      </div>
    )}

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
