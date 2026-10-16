import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Wallet, TrendingUp, Unlock, Lock, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown, X, ShieldCheck, Copy, Check, Eye, EyeOff, BarChart3 } from "lucide-react";
import { TrustShieldValue } from "../common/TrustShieldValue";
import {
  registerLighterTradingKey, reconnectLighterTradingKey, getActiveLighterSigner,
  clearLighterTradingKey, submitLighterOrder, withdrawLighterUsdc,
  getLighterSignedOpenOrders, cancelLighterSignedOrder,
  verifyLighterTradingKey, updateLighterPerpMargin, type LighterTradingIdentity,
} from "../../lib/lighterTrading";
import { depositLighterUsdcOnEthereum, depositLighterUsdcFromArbitrum, type LighterWalletProvider } from "../../lib/lighterFunding";
import TVChart from "./TVChart";
import MarketsPanel from "../dashboard/MarketsPanel";
import TradingAccountTabBar, { type TradingTabId } from "./TradingAccountTabBar";
import HideDexTradeSelectors, { type TradeOrderType } from "./HideDexTradeSelectors";
import type { TokenMetadata } from "../../types";
import MarketSelector, { renderAssetLogo } from "./MarketSelector";
import {
  getLighterAccountIndexes, getLighterMarkets, getLighterPublicAccounts,
  subscribeLighterBook,
  type LighterMarket, type LighterMarketFeed, type LighterPublicAccount,
} from "../../lib/lighterMarketData";

type Section = "markets" | "trade" | "funds" | "account" | "orders";
type Kind = "perp" | "spot";
type Props = {
  walletAddress: string;
  getWalletProvider: () => Promise<LighterWalletProvider>;
  section: Section;
  initialKind?: Kind;
  onSelectSection: (section: Section, marketKind?: Kind) => void;
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
  walletAddress, getWalletProvider, section, initialKind = "perp", onSelectSection,
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
  const [accountTab, setAccountTab] = useState<TradingTabId>("POSITIONS");
  const [expandedPositions, setExpandedPositions] = useState<Record<string, boolean>>({});
  const [positionSort, setPositionSort] = useState<"default" | "pnl" | "size">("default");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [marginSheetOpen, setMarginSheetOpen] = useState(false);
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [chosenLeverage, setChosenLeverage] = useState(1);
  const [marginBusy, setMarginBusy] = useState(false);
  const [marginStatus, setMarginStatus] = useState("");
  const [marginUpdateMarketId, setMarginUpdateMarketId] = useState<number | null>(null);
  const authPromptedWallet = useRef("");
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
  const [openOrdersError, setOpenOrdersError] = useState("");
  const [liveOrders, setLiveOrders] = useState<Awaited<ReturnType<typeof getLighterSignedOpenOrders>> | null>(null);

  useEffect(() => {
    if (!getActiveLighterSigner(walletAddress)) {
      clearLighterTradingKey();
      setTradingIdentity(null); setRecoveryKey(""); setLiveOrders(null);
    } else {
      setTradingIdentity(getActiveLighterSigner(walletAddress));
    }
    setTradingNotice("");
    setAuthSheetOpen(false);
    authPromptedWallet.current = "";
  }, [walletAddress]);

  // Use the same one-time bottom-sheet style as HideDex's existing Enable Trading flow.
  // Never auto-sign or send a transaction: the user must explicitly tap the primary action.
  useEffect(() => {
    if (section === "trade" && walletAddress && !tradingIdentity &&
        authPromptedWallet.current !== walletAddress) {
      authPromptedWallet.current = walletAddress;
      setAuthSheetOpen(true);
    }
  }, [section, walletAddress, tradingIdentity]);

  const beginLighterAuthorization = async () => {
    if (!walletAddress || tradingBusy) return;
    setTradingBusy(true); setTradingNotice("Generating a session-only Lighter trading key…");
    try {
      const { identity, recoveryKey: secret, txHash } = await registerLighterTradingKey({
        walletAddress, getWalletProvider,
      });
      setTradingIdentity(identity);
      setRecoveryKey(secret);
      setAuthSheetOpen(true); // Keep one-time backup visible only inside the secure sheet.
      setTradingNotice("Lighter registration submitted" + (txHash ? ": " + txHash : "") +
        ". Keep a secure backup of the API key below; this browser does not store it.");
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
      setExistingKey(""); setShowExistingKey(false);
      setAuthSheetOpen(false);
      setTradingNotice("Existing Lighter API key verified for this connected wallet.");
    } catch (e) {
      setTradingNotice(e instanceof Error ? e.message : "Trading key verification failed.");
    } finally { setTradingBusy(false); }
  };
  const submitTrade = async () => {
    if (!walletAddress || !selected || !tradingIdentity || tradingBusy) return;
    if (!marketPrice || feed.status !== "live" || !(sizeInCoin > 0) ||
        (reduceOnly && !hasReduciblePosition) ||
        (attachTpSl && (!takeProfit.trim() && !stopLoss.trim())) ||
        (orderType === "limit" && !(Number(limitPrice) > 0))) {
      setTradingNotice("Choose a live Lighter market with a valid order size and limit price.");
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
    if (!walletAddress || !tradingIdentity || tradingBusy) return;
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

  const submitMarginSettings = async () => {
    if (!walletAddress || !selected || kind !== "perp" || marginBusy) return;
    if (!tradingIdentity) {
      setMarginSheetOpen(false); setAuthSheetOpen(true); return;
    }
    if (!selected.maxLeverage || chosenLeverage > selected.maxLeverage || chosenLeverage < 1) {
      setMarginStatus("Lighter did not verify this leverage. No update sent."); return;
    }
    if (!window.confirm("UPDATE REAL LIGHTER MARGIN SETTINGS\\n" + selected.symbol +
      "\\n" + marginMode.toUpperCase() + " · " + chosenLeverage + "x\\nConfirm on Lighter mainnet?")) return;
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
      setMarginStatus(e instanceof Error ? e.message : "Lighter rejected leverage update.");
    } finally { setMarginBusy(false); }
  };

  const authorizationPanel = (
    <div className="space-y-2 text-xs sm:text-sm">
      {tradingIdentity ? <div className="flex justify-between gap-2 items-center border border-brand-border rounded-lg p-2">
        <span className="text-emerald-500 font-bold">Lighter signing key · Account #{tradingIdentity.accountIndex} · Slot {tradingIdentity.apiKeyIndex}</span>
        <button type="button" onClick={() => {
          clearLighterTradingKey(); setTradingIdentity(null); setRecoveryKey(""); setLiveOrders(null);
          setTradingNotice("Session key disconnected. Your registered key remains on Lighter.");
        }} className="underline text-brand-muted">Disconnect</button>
      </div> : <>
        <p className="text-brand-muted leading-relaxed">One wallet signature authorizes a personal key for Lighter mainnet orders and verified-wallet withdrawals. Review the request carefully. HideDex does not store the key.</p>
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

  const inputPrice = orderType === "limit" ? Number(limitPrice) : marketPrice;
  const inputAmount = Number(amount);
  const sizeInCoin = Number.isFinite(inputAmount) && inputAmount > 0 && inputPrice !== null && inputPrice > 0
    ? sizeUnit === "USD" ? inputAmount / inputPrice : inputAmount : 0;
  const orderValueUsd = sizeInCoin && inputPrice ? sizeInCoin * inputPrice : null;
  const hasReduciblePosition = Boolean(selected && tradingIdentity && publicAccounts?.some(a =>
    a.index === tradingIdentity.accountIndex && a.positions.some(p =>
      p.symbol === selected.symbol && (side === "sell" ? p.signedSize > 0 : p.signedSize < 0))));
  const bookLevels = (levels: LighterMarketFeed["bids"], sideName: "bid" | "ask") => {
    // Sum real exchange sizes into rounded price groups; never synthesize levels.
    const decimalPrecision = Math.min(10, selected?.priceDecimals ?? 2);
    const tick = Math.pow(10, -decimalPrecision) * bookGroup;
    const buckets = new Map<number, number>();
    for (const l of levels) {
      const px = displayPrice(l.price), sz = displaySize(l.size);
      if (px === null || sz === null || px <= 0 || sz < 0) continue;
      const key = Number(((sideName === "ask" ? Math.ceil(px / tick - 1e-7) : Math.floor(px / tick + 1e-7)) * tick).toFixed(decimalPrecision));
      buckets.set(key, (buckets.get(key) ?? 0) + sz);
    }
    const visible = [...buckets.entries()].sort((a,b) => sideName === "ask" ? a[0]-b[0] : b[0]-a[0]).slice(0, 14);
    const totalSize = Math.max(1, visible.reduce((sum, row) => sum + row[1], 0));
    let cumulative = 0;
    return <div className="space-y-0.5 w-full">
      {visible.length === 0 && <div className="py-2 text-[10px] text-brand-muted">Waiting for live {sideName}s…</div>}
      {visible.map((level, i) => {
        const [px, sz] = level;
        cumulative += Math.max(0, sz ?? 0);
        const depth = Math.max(0, Math.min(100, cumulative / totalSize * 100));
        const value = sz !== null && px !== null && orderBookSizeUnit === "USD" ? sz * px : sz;
        return <button type="button" key={px + "-" + i}
          onClick={() => { if (px !== null) setLimitPrice(String(px)); }}
          className="relative w-full grid grid-cols-2 gap-1 text-[9px] sm:text-[11px] font-mono py-1 text-left overflow-hidden rounded hover:bg-brand-overlay-subtle">
          <span aria-hidden="true" className={"absolute right-0 top-0 bottom-0 rounded-r pointer-events-none " +
            (sideName === "bid" ? "bg-emerald-500/20" : "bg-rose-500/20")} style={{ width: depth + "%" }}/>
          <span className={"relative z-10 font-bold " + (sideName === "bid" ? "text-emerald-500" : "text-rose-400")}>{formatPrice(px, selected?.priceDecimals ?? 8)}</span>
          <span className="relative z-10 text-right text-brand-text truncate">{value === null ? "—" :
            (orderBookSizeUnit === "USD" ? "$" : "") + formatPrice(value, orderBookSizeUnit === "USD" ? 2 : 5)}</span>
        </button>;
      })}
    </div>;
  };

  const lighterAssetCards = (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-3 space-y-2">
      <h3 className="text-xs font-bold">Lighter asset balances</h3>
      {publicAccounts === null
        ? <p className="text-xs text-brand-muted">{accountsLoading ? "Loading actual asset balances…" : "Connect wallet to check balances."}</p>
        : publicAccounts.some(a => a.assets === null)
          ? <p className="text-xs text-brand-muted">Assets unavailable from Lighter account response.</p>
          : publicAccounts.flatMap(a => (a.assets ?? []).map(asset =>
              <div key={a.index + ":" + asset.symbol}
                className="flex justify-between gap-3 py-2 border-t border-brand-border/50 text-[11px]">
                <div className="min-w-0">
                  <p className="font-semibold">{asset.symbol} <span className="text-brand-muted font-normal">· Account #{a.index}</span></p>
                  {asset.lockedBalance !== null && <p className="text-[10px] text-brand-muted">Locked: {formatPrice(asset.lockedBalance, 8)} {asset.symbol}</p>}
                </div>
                <div className="font-mono font-bold">{formatPrice(asset.balance, 8)}</div>
              </div>
            ))
          }
    </div>
  );

  const accountCards = (
    <div className="space-y-3">
      {!walletAddress && <p className="text-xs text-brand-muted">Connect your wallet to check registered Lighter accounts.</p>}
      {accountsLoading && <p className="text-xs text-brand-muted">Loading Lighter account state…</p>}
      {accountError && <p role="alert" className="text-xs text-rose-400">Lighter account lookup failed: {accountError}</p>}
      {publicAccounts !== null && publicAccounts.length === 0 &&
        <p className="text-xs text-brand-muted">No Lighter accounts found for this wallet.</p>}
      {publicAccounts?.map(account => (
        <div key={account.index} className="p-3 bg-brand-surface border border-brand-border rounded-xl">
          <h3 className="text-sm font-bold mb-3">Lighter Account #{account.index}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><p className="text-[10px] text-brand-muted">Available balance</p>
              <p className="font-mono text-base font-bold text-brand-text">{formatPrice(account.availableBalance)} USDC</p></div>
            <div><p className="text-[10px] text-brand-muted">Collateral</p>
              <p className="font-mono text-base font-bold text-brand-text">{formatPrice(account.collateral)} USDC</p></div>
          </div>
          <h4 className="text-xs font-bold border-t border-brand-border pt-3">Open positions</h4>
          {!account.positions.length && <p className="text-xs text-brand-muted mt-1">No open positions reported.</p>}
          {account.positions.map((position, i) => <div key={position.symbol + i}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] py-2 border-b border-brand-border/50">
              <span className="font-bold">{position.symbol}</span>
              <span>{position.signedSize >= 0 ? "LONG" : "SHORT"} {formatPrice(Math.abs(position.signedSize), 5)}</span>
              <span>Entry: {formatPrice(position.entryPrice)}</span>
              <span>PnL: {formatPrice(position.unrealizedPnl)}</span>
            </div>)}
        </div>
      ))}
    </div>
  );

  const knownPositionCount = publicAccounts === null ? undefined :
    publicAccounts.reduce((sum, acct) => sum + acct.positions.length, 0);
  const lighterAccountTabs = (
    <div className="bg-brand-bg border border-brand-border rounded-xl overflow-hidden shadow-xl" id="terminal-dashboard-panel-unified">
      <TradingAccountTabBar
        activeTab={accountTab}
        onSelect={setAccountTab}
        positionsCount={knownPositionCount}
        ordersCount={undefined}
      />
      <div className="p-2 md:p-3 min-h-[110px] overflow-y-auto overflow-x-hidden">
        {accountTab === "BALANCES" && <>{lighterAssetCards}{accountCards}</>}
        {accountTab === "POSITIONS" && (
          <div className="space-y-2">
            {accountsLoading && <p className="text-xs text-brand-muted">Checking Lighter positions…</p>}
            {accountError && <p className="text-xs text-rose-400">Unable to verify positions: {accountError}</p>}
            {publicAccounts !== null && knownPositionCount === 0 &&
              <p className="text-xs text-brand-muted">No open positions reported by connected Lighter accounts.</p>}
            {knownPositionCount !== undefined && knownPositionCount > 0 && (
              <div className="flex justify-between gap-2 items-center border-b border-brand-border pb-2 text-[10px] sm:text-xs text-brand-muted">
                <label>Sort By:
                  <select aria-label="Sort Lighter positions" value={positionSort}
                    onChange={e => setPositionSort(e.target.value as "default" | "pnl" | "size")}
                    className="ml-1 bg-brand-bg text-brand-text">
                    <option value="default">Default</option>
                    <option value="pnl">Unrealized PnL</option>
                    <option value="size">Position Size</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setExpandedPositions(Object.fromEntries(
                    (publicAccounts ?? []).flatMap(a => a.positions.map((p,i) => [a.index + ":" + p.symbol + ":" + i, true]))))}
                    className="text-brand-text">Expand All</button>
                  <button type="button" onClick={() => setExpandedPositions(Object.fromEntries(
                    (publicAccounts ?? []).flatMap(a => a.positions.map((p,i) => [a.index + ":" + p.symbol + ":" + i, false]))))}
                    className="text-rose-400">Close All</button>
                </div>
              </div>
            )}
            {(publicAccounts ?? []).flatMap(a => a.positions.map((p,i) => ({a,p,i})))
              .sort((x,y) => positionSort === "pnl" ? (y.p.unrealizedPnl ?? -Infinity)-(x.p.unrealizedPnl ?? -Infinity)
                : positionSort === "size" ? Math.abs(y.p.signedSize)-Math.abs(x.p.signedSize) : 0)
              .map(({a,p,i}) => {
                const key = a.index + ":" + p.symbol + ":" + i;
                const isExpanded = expandedPositions[key] ?? false;
                return <div key={key} className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden text-[11px]">
                  <button type="button" onClick={() => setExpandedPositions(v => ({...v,[key]: !(v[key] ?? false)}))}
                    aria-expanded={isExpanded}
                    className="w-full p-3 flex items-center justify-between gap-2 text-left">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-brand-muted">{isExpanded ? "⌄" : "›"}</span>
                      <span className="font-bold text-sm truncate">{p.symbol}-PERP</span>
                      <span className="rounded-md border border-brand-border bg-brand-overlay-subtle px-1.5 py-0.5 text-[9px] uppercase">{p.signedSize >= 0 ? "LONG" : "SHORT"}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={"block font-mono font-bold text-sm " + (p.unrealizedPnl === null ? "text-brand-muted" : p.unrealizedPnl < 0 ? "text-rose-400" : "text-emerald-400")}>
                        {p.unrealizedPnl === null ? "—" : (p.unrealizedPnl < 0 ? "-$" : "+$") + formatPrice(Math.abs(p.unrealizedPnl),2)}
                      </span>
                      <span className="block text-brand-muted text-[9px]">Lighter #{a.index}</span>
                    </span>
                  </button>
                  {isExpanded && <div className="p-3 border-t border-brand-border grid grid-cols-2 gap-3">
                    <div>Position Size<strong className="font-mono block text-brand-text">{formatPrice(Math.abs(p.signedSize),6)} {p.symbol}</strong></div>
                    <div>Entry Price<strong className="font-mono block text-brand-text">{formatPrice(p.entryPrice)}</strong></div>
                    <div>Unrealized PnL<strong className="font-mono block text-brand-text">{p.unrealizedPnl === null ? "—" : formatPrice(p.unrealizedPnl,2) + " USDC"}</strong></div>
                    <div>Margin / Leverage<strong className="font-mono block text-brand-muted">Not verified</strong></div>
                    <div className="col-span-2 flex items-center justify-between gap-2 border-t border-brand-border pt-3">
                      <span className="text-brand-muted">TP/SL: Native bracket support on new Perp orders</span>
                      <button type="button"
                        onClick={() => closeLighterPosition(a.index,p.symbol,p.signedSize)}
                        disabled={tradingBusy || !tradingIdentity || tradingIdentity.accountIndex !== a.index}
                        className="px-2 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 font-bold disabled:opacity-30 shrink-0">
                        Close 100%
                      </button>
                    </div>
                  </div>}
                </div>;
              })}
            {!walletAddress && <p className="text-xs text-brand-muted">Connect wallet to check Lighter positions.</p>}
          </div>
        )}
        {accountTab === "OPEN_ORDERS" && <div className="space-y-2 text-[11px]">
          {!tradingIdentity && <p className="text-brand-muted">Authorize this Lighter account in Trade to load its real open orders.</p>}
          {tradingIdentity && liveOrders === null && !openOrdersError &&
            <p className="text-brand-muted">Loading authenticated Lighter open orders…</p>}
          {openOrdersError && <p role="alert" className="text-rose-400">{openOrdersError}</p>}
          {liveOrders && liveOrders.length === 0 &&
            <p className="text-brand-muted">No open orders found for registered Lighter Account #{tradingIdentity?.accountIndex}.</p>}
          {liveOrders?.map((order,i) => {
            const marketId = Number(order.market_index ?? order.market_id);
            const m = markets.find(x => x.id === marketId);
            const orderIndex = Number(order.order_index);
            return <div key={String(marketId) + ":" + String(orderIndex) + ":" + i}
              className="rounded-xl border border-brand-border bg-brand-surface p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{m?.symbol ?? "Unknown market #" + marketId}
                  <span className="ml-2 text-brand-muted">{order.is_ask ? "SELL" : "BUY"}</span></p>
                <p className="font-mono text-brand-muted">Order #{Number.isSafeInteger(orderIndex) ? orderIndex : "—"} · Price: {order.price ?? "—"} · Remaining: {order.remaining_base_amount ?? "—"}</p>
              </div>
              <button type="button" onClick={() => cancelLighterOrder(marketId,orderIndex)}
                disabled={tradingBusy || !m || !Number.isSafeInteger(orderIndex)}
                className="shrink-0 rounded-lg border border-rose-500/40 text-rose-400 px-2 py-1 font-bold disabled:opacity-30">
                Cancel
              </button>
            </div>;
          })}
        </div>}
        {accountTab === "TRADE_HISTORY" && (
          <p className="text-xs text-brand-muted">Lighter fills and historical fees are not integrated.
            No Hyperliquid history or fabricated fills are shown.</p>
        )}
      </div>
    </div>
  );

  return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="lighter">
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
    {marginSheetOpen && (
      <div role="presentation" className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
        onMouseDown={e => { if(e.target === e.currentTarget && !marginBusy) setMarginSheetOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-label="Lighter margin and leverage settings"
          className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-brand-border bg-brand-bg p-4 space-y-4 max-h-[80dvh] overflow-y-auto">
          <div className="flex justify-between items-center"><h2 className="text-base font-bold">Margin & Leverage</h2>
            <button type="button" disabled={marginBusy} aria-label="Close margin settings" onClick={() => setMarginSheetOpen(false)}><X className="w-5 h-5"/></button>
          </div>
          <p className="text-xs text-brand-muted">{selected?.symbol ?? "No market"} ·
            Verified maximum: {selected?.maxLeverage ? selected.maxLeverage + "x" : "Unavailable"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["cross","isolated"] as const).map(mode => <button type="button" key={mode} disabled={marginBusy}
              onClick={() => setMarginMode(mode)} className={"rounded-xl border p-2.5 text-sm font-bold " +
                (marginMode === mode ? "border-accent text-accent bg-brand-overlay-normal" : "border-brand-border text-brand-text")}>
              {mode === "cross" ? "Cross" : "Isolated"}
            </button>)}
          </div>
          <p className="text-xs font-bold">Leverage: {chosenLeverage}x</p>
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,5,10,15,20,25,40,50,75,100].filter(x => selected?.maxLeverage && x <= selected.maxLeverage)
              .map(x => <button type="button" key={x} disabled={marginBusy}
                onClick={() => setChosenLeverage(x)}
                className={"rounded-lg border p-2 text-xs font-bold " +
                  (chosenLeverage === x ? "border-accent text-accent" : "border-brand-border")}>{x}x</button>)}
          </div>
          <p className="text-[11px] text-brand-muted">Changing leverage/margin sends a real signed transaction on Lighter. Selecting a value does not change the account until it is accepted and executed.</p>
          <button type="button" disabled={marginBusy || !tradingIdentity || !selected?.maxLeverage || chosenLeverage > selected.maxLeverage}
            onClick={submitMarginSettings} className="w-full p-3 bg-accent text-brand-bg rounded-xl font-bold text-sm disabled:opacity-40">
            {marginBusy ? "Submitting…" : "Confirm Lighter margin update"}
          </button>
          {!tradingIdentity && <button type="button" className="text-xs underline text-accent" onClick={() => {setMarginSheetOpen(false);setAuthSheetOpen(true);}}>
            Enable trading first
          </button>}
          {marginStatus && <p role="status" className="text-xs text-amber-500 break-all">{marginStatus}</p>}
        </section>
      </div>
    )}
    {marketSelectorOpen && (
      <MarketSelector
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
      {/* The same mobile terminal composition: selected coin, price, mode,
          then order form/book. The chart lives under Market on small screens. */}
      <div id="terminal-mobile-trade-header" className="md:hidden bg-brand-bg border border-brand-border rounded-xl p-1.5 mb-1.5 flex items-center justify-between gap-1.5 shadow-xl relative">
        <button type="button" onClick={() => setMarketSelectorOpen(true)} className="flex items-center gap-2 min-w-0 text-left" aria-label="Choose Lighter market">
          {selected && <span className="shrink-0">{renderAssetLogo(selected.symbol)}</span>}
          <span className="min-w-0">
            <span className="block font-display font-bold text-sm text-brand-text uppercase truncate">{selected?.symbol ?? "SELECT MARKET"}⌄</span>
            <span className="block text-[9px] font-semibold tracking-wider text-accent">{kind === "perp" ?
                (selected?.maxLeverage ? selected.maxLeverage + "x Perp" : "Perpetual") : "Spot"}</span>
          </span>
        </button>
        <span className="flex flex-col items-center min-w-0">
          <span className="font-mono font-bold text-xs text-brand-text whitespace-nowrap">{formatPrice(marketPrice)}</span>
          <span className={"text-[9px] font-mono font-semibold " +
            ((selected?.change24h ?? 0) >= 0 ? "text-success" : "text-danger")}>
            {selected?.change24h == null ? "—" : (selected.change24h >= 0 ? "+" : "") + formatPrice(selected.change24h, 2) + "%"}
          </span>
        </span>
        <button type="button" onClick={() => switchKind(kind === "perp" ? "spot" : "perp")}
          role="switch" aria-checked={kind === "spot"}
          aria-label="Switch Lighter Spot and Perpetual" title="Switch Lighter Spot / Perpetual"
          className="shrink-0 ml-auto w-11 h-6 flex items-center rounded-full bg-white p-0.5 border border-brand-border">
          <span className={"block w-5 h-5 bg-black rounded-full shadow transition-transform duration-150 " +
            (kind === "spot" ? "translate-x-5" : "translate-x-0")}/>
        </button>
      </div>
      <div id="terminal-unified-market-header" className="hidden md:block rounded-xl border border-brand-border bg-brand-surface p-2 mb-2">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            {selected && <span className="shrink-0">{renderAssetLogo(selected.symbol)}</span>}
            <button type="button" onClick={() => setMarketSelectorOpen(true)}
              aria-label="Choose Lighter market"
              className="border border-brand-border rounded-lg bg-brand-bg px-2 py-2 text-xs font-bold max-w-[160px] truncate">
              {selected?.symbol ?? "Choose market"}⌄
            </button>
            <span className="text-[10px] text-brand-muted">{kind === "perp" ?
              (selected?.maxLeverage ? selected.maxLeverage + "x Perp" : "Perpetual") : "Spot"}</span>
          </div>
          <div className="flex border border-brand-border rounded-lg overflow-hidden">
            <button type="button" onClick={() => setViewMode("chart")} className={"px-3 py-2 text-[10px] font-bold " + (viewMode === "chart" ? "bg-accent text-brand-bg" : "")}>CHART</button>
            <button type="button" onClick={() => setViewMode("orderbook")} className={"px-3 py-2 text-[10px] font-bold " + (viewMode === "orderbook" ? "bg-accent text-brand-bg" : "")}>ORDER BOOK</button>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div><div className="text-brand-muted">Last</div><strong>{formatPrice(marketPrice)}</strong></div>
            <div><div className="text-brand-muted">24h Vol</div><strong>{selected?.volume24hUsd == null ? "—" : "$" + formatPrice(selected.volume24hUsd, 2)}</strong></div>
            <div><div className="text-brand-muted">24h Change</div><strong>{formatPrice(selected?.change24h, 2)}</strong></div>
            <button type="button" role="switch" aria-checked={kind === "spot"}
              aria-label="Switch Lighter Spot and Perpetual" title="Switch Spot / Perpetual"
              onClick={() => switchKind(kind === "perp" ? "spot" : "perp")}
              className="ml-2 shrink-0 w-11 h-6 flex items-center bg-white rounded-full p-0.5">
              <span className={"w-5 h-5 block bg-black rounded-full transition-transform " + (kind === "spot" ? "translate-x-5" : "")}/>
            </button>
          </div>
        </div>
        {viewMode === "chart" && <div id="market-chart-toolbar-host" className="mt-2 min-h-[28px] w-full border-t border-brand-border" />}
      </div>
      <div id="terminal-top-chart-panel" className="hidden md:block mb-2 bg-brand-bg border border-brand-border rounded-xl p-1.5">
        {viewMode === "chart" ? selected ? <TVChart key={"lighter-chart-" + selected.id}
          symbol={selected.symbol} marketCoin="" lighterMarketId={selected.id}
          isSpot={kind === "spot"} currentPrice={marketPrice}
          high24h={selected.high24h} low24h={selected.low24h}
          volume24h={selected.volume24hUsd} change24h={selected.change24h}
          tradeHistory={[]} toolbarHostId="market-chart-toolbar-host"
        /> : <p className="p-5 text-xs text-brand-muted">Choose a Lighter market.</p> : (
          <div className="p-2">
            <h3 className="text-xs font-bold mb-3">Live Lighter Order Book · {selected?.symbol}</h3>
            <div className="grid grid-cols-2 gap-2"><div>{bookLevels(feed.bids, "bid")}</div><div>{bookLevels(feed.asks, "ask")}</div></div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-12 gap-1.5 md:gap-2 mb-1.5 items-stretch">
        <div id="terminal-order-form" className="col-span-7 min-w-0 bg-brand-bg border border-brand-border rounded-xl p-1.5 md:p-2.5 flex flex-col h-full shadow-lg relative gap-2">
          <HideDexTradeSelectors
            isPerp={kind === "perp"}
            orderType={orderType.toUpperCase() as TradeOrderType}
            availableOrderTypes={["MARKET","LIMIT"]}
            onOrderType={next => {if(next === "MARKET" || next === "LIMIT") setOrderType(next.toLowerCase() as "market"|"limit");}}
            marginMode={marginMode.toUpperCase() as "CROSS"|"ISOLATED"}
            onMarginMode={next => {setMarginMode(next.toLowerCase() as "cross"|"isolated");setMarginSheetOpen(true);}}
            leverage={chosenLeverage}
            maxLeverage={selected?.maxLeverage ?? null}
            onLeverage={next => {setChosenLeverage(next);setMarginSheetOpen(true);}}
            leverageDisabled={!selected?.maxLeverage}
          />
          <div className="flex bg-brand-overlay-subtle rounded-lg p-0.5 border border-brand-border">
            <button type="button" onClick={() => {setSide("buy");setReduceOnly(false);}} className={"flex-1 py-2 rounded-md font-bold text-[10px] md:text-xs " +
              (side === "buy" ? "bg-[#18c29c] text-[#030610]" : "text-brand-text")}>
              {kind === "perp" ? "LONG" : "BUY"}
            </button>
            <button type="button" onClick={() => {setSide("sell");setReduceOnly(false);}} className={"flex-1 py-2 rounded-md font-bold text-[10px] md:text-xs " +
              (side === "sell" ? "bg-[#f25c5c] text-white" : "text-brand-text")}>
              {kind === "perp" ? "SHORT" : "SELL"}
            </button>
          </div>
          <div className="flex justify-between text-[9px] sm:text-xs font-semibold text-brand-muted">
            <span>Avail. to Trade</span>
            <span className="font-mono text-brand-text">
              {publicAccounts && publicAccounts.every(a => a.availableBalance !== null)
                ? formatPrice(publicAccounts.reduce((sum,a)=>sum+(a.availableBalance??0),0),5)+" USDC" : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between border border-brand-border bg-brand-surface rounded-lg p-2 text-[10px]">
            <span className="font-bold text-brand-muted">PRICE</span>
            {orderType === "market" ? <span className="font-mono text-brand-text font-bold">Market Price</span> :
              <input value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                type="number" inputMode="decimal" min="0" placeholder="Limit price"
                className="bg-transparent text-right min-w-0 w-[60%] font-mono text-brand-text focus:outline-none" />}
          </div>
          <div className="flex items-center justify-between border border-brand-border bg-brand-surface rounded-lg p-2 text-[10px]">
            <label htmlFor="lighter-trade-size" className="font-bold text-brand-muted truncate">SIZE ({sizeUnit === "USD" ? "USDC" : selected?.symbol.split("/")[0] ?? "COIN"})</label>
            <div className="min-w-0 flex items-center justify-end gap-1">
              <input id="lighter-trade-size" value={amount} onChange={e => setAmount(e.target.value)}
                type="number" inputMode="decimal" min="0" placeholder="0.00"
                className="min-w-0 w-[54%] bg-transparent text-right font-mono text-brand-text focus:outline-none"/>
              <button type="button" className="shrink-0 border border-brand-border rounded px-1 py-1"
                onClick={() => {
                  if (inputPrice && inputPrice > 0 && inputAmount > 0)
                    setAmount(String(Number((sizeUnit === "USD" ? inputAmount / inputPrice : inputAmount * inputPrice).toFixed(6))));
                  else setAmount("");
                  setSizeUnit(v => v === "USD" ? "COIN" : "USD");
                }}>{sizeUnit === "USD" ? "USDC" : "COIN"}</button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[10,25,50,75,100].map(percent => <button type="button" key={percent}
              disabled={!marketPrice || !publicAccounts?.every(a=>a.availableBalance!==null)}
              onClick={() => {
                const available = publicAccounts?.reduce((sum,a)=>sum+(a.availableBalance??0),0)??0;
                const price = orderType==="limit" ? Number(limitPrice) : marketPrice;
                if (price && price>0 && available>0) setAmount(String(Number((sizeUnit === "USD"
                  ? available*percent/100 : available*percent/100/price).toFixed(6))));
              }} className="border border-brand-border rounded-lg py-1.5 text-[9px] font-bold text-brand-muted disabled:opacity-40">{percent}%</button>)}
          </div>
          {kind === "perp" && <>
            <div className="border-t border-brand-border pt-3 flex items-center gap-2">
              <input type="checkbox" checked={reduceOnly}
                disabled={!tradingIdentity || tradingBusy || !hasReduciblePosition}
                title={!hasReduciblePosition ? "Reduce Only requires a verified opposite-side open position" : ""}
                onChange={e => setReduceOnly(e.target.checked)} aria-label="Reduce Only" className="w-4 h-4"/>
              <span className="font-bold text-[10px] text-brand-muted">Reduce Only</span>
            </div>
            <div className="border-t border-brand-border pt-3 flex items-center gap-2">
              <input type="checkbox" checked={attachTpSl} disabled={!tradingIdentity || tradingBusy || reduceOnly}
                onChange={e => setAttachTpSl(e.target.checked)} aria-label="Attach TP/SL" className="w-4 h-4"/>
              <span className="font-bold text-[10px] text-brand-muted">Take Profit / Stop Loss</span>
            </div>
            {attachTpSl && !reduceOnly && <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-brand-muted">Take Profit (USDC)
                <input type="number" inputMode="decimal" min="0" placeholder="Trigger price"
                  value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
                  className="w-full min-w-0 bg-brand-surface border border-brand-border rounded p-1.5 text-brand-text"/>
              </label>
              <label className="text-[10px] text-brand-muted">Stop Loss (USDC)
                <input type="number" inputMode="decimal" min="0" placeholder="Trigger price"
                  value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                  className="w-full min-w-0 bg-brand-surface border border-brand-border rounded p-1.5 text-brand-text"/>
              </label>
              <p className="col-span-2 text-[9px] text-brand-muted">Lighter native atomic TP/SL is available only on supported perpetual entries.</p>
            </div>}
          </>}
          <div className="bg-brand-bg/50 border border-brand-border rounded-lg p-1.5 font-mono text-[9px] space-y-1 mt-auto">
            {kind === "perp" && <div className="flex justify-between text-brand-muted"><span>Liq. Price</span><span>—</span></div>}
            <div className="flex justify-between text-brand-muted"><span>Order Value</span>
              <span>{orderValueUsd !== null ? "$" + formatPrice(orderValueUsd, 2) : "—"}</span>
            </div>
            {kind === "perp" && <div className="flex justify-between text-brand-muted"><span>Margin</span><span>—</span></div>}
          </div>
          <button type="button" onClick={submitTrade}
            disabled={!tradingIdentity || tradingBusy || !selected || feed.status !== "live" || !(sizeInCoin > 0)}
            title={!tradingIdentity ? "Authorize your Lighter account below" : "Confirm a real Lighter mainnet order"}
            className={"w-full py-2 rounded-lg text-[10px] md:text-xs font-display font-black uppercase disabled:opacity-50 " +
              (side === "buy" ? "bg-[#18c29c] text-[#030610]" : "bg-[#f25c5c] text-white")}>
            {tradingBusy ? "Processing…" : "PLACE " + (side === "buy" ? (kind === "perp" ? "LONG" : "BUY") : (kind === "perp" ? "SHORT" : "SELL"))}
          </button>
          {!tradingIdentity && <button type="button" onClick={() => setAuthSheetOpen(true)}
            className="text-[10px] text-accent font-semibold py-1 underline">Enable trading</button>}
          {tradingNotice && <p role="status" className="text-[9px] text-amber-500 line-clamp-2 break-words">{tradingNotice}</p>}
        </div>
        <div id="terminal-order-book" className="col-span-5 min-w-0 self-start rounded-xl border border-brand-border bg-brand-bg p-1.5 sm:p-3">
          <div className="flex items-center justify-between gap-1 mb-2">
            <strong className="text-[9px] text-brand-muted uppercase">Price</strong>
            <button type="button" onClick={() => setOrderBookSizeUnit(v => v === "USD" ? "COIN" : "USD")}
              className="text-[9px] uppercase font-bold text-brand-muted">Size <span className="text-cyan-500 border border-brand-border rounded px-1">{orderBookSizeUnit === "USD" ? "$" : selected?.symbol ?? "COIN"}</span></button>
          </div>
          <div className="max-h-[470px] overflow-y-auto overflow-x-hidden">{bookLevels(feed.asks.slice(0, 10).reverse(), "ask")}
            <div className="text-center py-2 border-y border-brand-border font-mono text-[10px] text-accent">
              {formatPrice(marketPrice)}
              <span className="block text-[9px] uppercase text-brand-muted">Last price</span>
            </div>{bookLevels(feed.bids.slice(0, 10), "bid")}</div>
          <div className="mt-2 pt-2 border-t border-brand-border flex justify-between items-center text-[9px] font-bold text-brand-muted">
            <span>GROUP</span>
            <select aria-label="Lighter order book grouping" value={bookGroup} onChange={e => setBookGroup(Number(e.target.value))}
              className="bg-brand-bg border border-brand-border rounded px-1 py-1 text-brand-text">
              <option value={1}>1</option><option value={10}>10</option><option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>
      {lighterAccountTabs}
    </>}

    {section === "funds" && (() => {
      const verifiedCollateral = publicAccounts !== null && publicAccounts.every(a => a.collateral !== null)
        ? publicAccounts.reduce((total, a) => total + (a.collateral ?? 0), 0) : null;
      const verifiedAvailable = publicAccounts !== null && publicAccounts.every(a => a.availableBalance !== null)
        ? publicAccounts.reduce((total, a) => total + (a.availableBalance ?? 0), 0) : null;
      const showBalance = (value: number | null) =>
        <TrustShieldValue fieldKey="portfolio" value={hideBalance ? "••••••" : value === null ? "—" : formatPrice(value, 2) + " USDC"} hideEyeIcon />;
      const spotAssets = publicAccounts?.flatMap(a => a.assets ?? []) ?? [];
      const spotAvailable = publicAccounts !== null && publicAccounts.every(a => a.assets !== null)
        ? spotAssets.filter(a => a.symbol === "USDC").reduce((sum, a) => sum + a.balance, 0)
        : null;
      const unrealizedPnl = publicAccounts !== null && publicAccounts.every(a => a.positions.every(p => p.unrealizedPnl !== null))
        ? publicAccounts.flatMap(a => a.positions).reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0) : null;
      return <div id="funds-portfolio-container" className="space-y-2.5 sm:space-y-3 text-brand-text font-sans bg-brand-bg px-2.5 pt-1 pb-0 sm:px-4 sm:pt-2 sm:pb-2 rounded-3xl max-w-4xl mx-auto w-full">
        <div className="relative bg-brand-surface border border-brand-border/70 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 overflow-hidden shadow-sm" id="funds-hero-card">
          <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs font-bold text-brand-muted uppercase tracking-wider">TOTAL FUNDS</span>
              <button type="button" className="p-1 text-brand-muted" onClick={() => setHideBalance(x => !x)} aria-label={hideBalance ? "Show balances" : "Hide balances"}>
                {hideBalance ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
              </button>
            </div>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-brand-overlay-subtle border border-brand-border/60 text-[11px] font-semibold">
              <Layers className="w-3.5 h-3.5 text-accent" /> Lighter Account
            </span>
          </div>
          <div className="relative mt-2 sm:mt-3">
            <div className="text-2xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-brand-text">{showBalance(verifiedCollateral)}</div>
            <div className="text-[11px] sm:text-sm font-mono text-brand-muted mt-1">{hideBalance ? "≈ •••••" :
              verifiedCollateral === null ? "—" : "≈ " + formatPrice(verifiedCollateral, 2) + " USD"}</div>
          </div>
          <div className="relative grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 mt-3 sm:mt-4">
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-brand-overlay-subtle border border-brand-border/50 min-w-0">
              <Wallet className="w-5 h-5 shrink-0 text-accent" />
              <div className="min-w-0"><div className="text-[9px] uppercase font-bold text-brand-muted">WALLET ADDRESS</div>
                <div className="flex gap-1 items-center min-w-0">
                  <span className="text-xs font-bold font-mono truncate">{walletAddress ? walletAddress.slice(0, 6) + "…" : "Not connected"}</span>
                  {walletAddress && <button type="button" onClick={async () => {
                    try { await navigator.clipboard.writeText(walletAddress); setCopiedAddress(true); }
                    catch { setCopiedAddress(false); }
                  }} aria-label="Copy wallet address" className="text-brand-muted shrink-0">
                    {copiedAddress ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                  </button>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-brand-overlay-subtle border border-brand-border/50 min-w-0">
              <Layers className="w-5 h-5 shrink-0 text-accent"/>
              <div><div className="text-[9px] uppercase font-bold text-brand-muted">ACCOUNT TYPE</div>
                <div className="text-xs font-bold font-mono">Lighter</div>
              </div>
            </div>
          </div>
          {accountError && <p role="alert" className="mt-3 text-[10px] text-rose-400">{accountError}</p>}
        </div>
        <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 sm:gap-3" id="funds-action-buttons-row">
          <button type="button" onClick={() => { setFundsModal("deposit"); setFundingStatus(""); }}
            className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-accent text-brand-bg font-extrabold flex items-center justify-between shadow-md text-left group min-w-0">
            <div className="flex items-center gap-2 min-w-0"><ArrowUpRight className="w-5 h-5" />
              <div className="min-w-0"><div className="text-xs sm:text-sm uppercase font-black truncate">DEPOSIT</div>
                <div className="text-[9px] sm:text-[11px] opacity-90">Direct on HideDex</div></div>
            </div><ChevronRight className="w-4 h-4"/>
          </button>
          <button type="button" onClick={() => { setFundsModal("withdraw"); setFundingStatus(""); }}
            className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-brand-surface border border-brand-border text-brand-text font-extrabold flex items-center justify-between shadow-sm text-left group min-w-0">
            <div className="flex items-center gap-2 min-w-0"><ArrowDownRight className="w-5 h-5 text-accent"/>
              <div className="min-w-0"><div className="text-xs sm:text-sm uppercase font-black truncate">WITHDRAWAL</div>
                <div className="text-[9px] sm:text-[11px] text-brand-muted">Lighter authorization required</div></div>
            </div><ChevronRight className="w-4 h-4 text-brand-muted"/>
          </button>
        </div>
        <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 sm:gap-3" id="balances-grid-display">
          {[
            {title:"SPOT AVAILABLE",subtitle:"Lighter Spot USDC (separate)",value:spotAvailable,icon:<Wallet className="w-4 h-4"/>},
            {title:"PERPETUAL BALANCE",subtitle:"Verified Lighter Perp collateral",value:verifiedCollateral,icon:<TrendingUp className="w-4 h-4"/>},
            {title:"AVAILABLE FOR TRADE",subtitle:"Exchange-reported available balance",value:verifiedAvailable,icon:<Unlock className="w-4 h-4"/>},
            {title:"MARGIN IN TRADE",subtitle:"Locked margin not independently verified",value:null,icon:<Lock className="w-4 h-4"/>},
          ].map(row => <div key={row.title}
            className="bg-brand-surface border border-brand-border/60 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between shadow-xs min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex justify-center items-center text-accent">{row.icon}</span>
                <span className="text-[9px] sm:text-[11px] font-bold uppercase text-brand-muted leading-tight">{row.title}</span>
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-brand-text truncate">{showBalance(row.value)}</div>
              <div className="text-[9px] sm:text-[11px] font-mono text-brand-muted leading-tight">{row.subtitle}</div>
            </div>)}
        </div>
        <p className="text-xs text-brand-muted px-1 leading-relaxed">Spot assets and perpetual collateral are distinct. All numbers use Lighter account responses, not Hyperliquid data. Unknown margin or history fields are not estimated.</p>
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-3.5 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-black uppercase flex items-center gap-2"><Layers className="w-4 h-4 text-accent"/> ASSET ALLOCATION</h3>
          <div className="flex gap-4 sm:gap-6 items-center">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-[15px] sm:border-[19px] border-emerald-500 flex flex-col items-center justify-center shrink-0">
              <span className="text-[9px] text-brand-muted font-bold">PERP</span>
              <strong className="font-mono">{hideBalance ? "••••" : formatPrice(verifiedCollateral, 2)}</strong>
              <span className="text-[9px] text-brand-muted">USDC</span>
            </div>
            <div className="flex-1 min-w-0 space-y-3 text-[11px]">
              <div className="flex justify-between gap-2 border-b border-brand-border pb-2"><span className="text-brand-muted">Perp Collateral</span><strong>{showBalance(verifiedCollateral)}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-brand-muted">Spot USDC</span><strong>{showBalance(spotAvailable)}</strong></div>
              <p className="text-brand-muted">Other Spot asset quantities appear below; unsupported USD valuations are omitted.</p>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-3.5 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-black uppercase">PERFORMANCE ANALYTICS & FEES</h3>
          <p className="text-[11px] text-brand-muted flex gap-2 items-center"><BarChart3 className="w-4 h-4"/> Verified Lighter account data only</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[
              {label:"UNREALIZED PNL",value:unrealizedPnl === null ? "—" : (unrealizedPnl < 0 ? "-$" : "$") + formatPrice(Math.abs(unrealizedPnl),2)},
              {label:"TOTAL VOLUME",value:"—"},
              {label:"FEES (LOADED FILLS)",value:"—"},
              {label:"EXECUTED ORDERS",value:"—"}
            ].map(item => <div key={item.label} className="rounded-xl border border-brand-border p-3 min-w-0">
              <span className="block text-[10px] text-brand-muted font-bold uppercase truncate">{item.label}</span>
              <strong className="block text-lg font-mono mt-2">{hideBalance ? "••••" : item.value}</strong>
            </div>)}
          </div>
          <div className="h-32 sm:h-40 border border-dashed border-brand-border rounded-xl px-3 flex items-center justify-center text-xs text-center text-brand-muted">
            Verified Lighter equity timeseries has not been loaded. No fake PnL graph is drawn.
          </div>
        </section>
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-3.5 sm:p-5">
          <h3 className="text-sm sm:text-base font-black uppercase mb-2">DAILY TRADING VOLUME <span className="text-xs font-normal text-brand-muted">(LOADED FILLS)</span></h3>
          <p className="text-xs text-brand-muted">Verified Lighter historical fills are not yet loaded; volume is not estimated.</p>
        </section>
        {lighterAssetCards}
      </div>;
    })()}

    {fundsModal && section === "funds" && (
      <div role="presentation" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 sm:p-5"
        onMouseDown={event => { if (event.target === event.currentTarget && !fundingBusy) setFundsModal(null); }}>
        <section role="dialog" aria-modal="true" aria-label={fundsModal === "deposit" ? "Deposit to Lighter" : "Withdraw from Lighter"}
          className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface text-brand-text p-4 sm:p-5 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">{fundsModal === "deposit" ? "Deposit · Lighter" : "Withdrawal · Lighter"}</h2>
            <button type="button" disabled={fundingBusy} onClick={() => setFundsModal(null)} aria-label="Close"
              className="p-1.5 rounded-lg border border-brand-border disabled:opacity-50">✕</button>
          </div>
          {fundsModal === "deposit" ? <>
            <p className="text-xs text-brand-muted">Real USDC → Lighter Perps. Your connected wallet signs on HideDex; no external exchange page.</p>
            <label className="block text-xs font-semibold" htmlFor="lighter-deposit-network">Deposit network</label>
            <select id="lighter-deposit-network" value={depositNetwork} disabled={fundingBusy}
              onChange={event => { setDepositNetwork(event.target.value as "arbitrum" | "ethereum"); setFundingStatus(""); }}
              className="w-full bg-brand-bg border border-brand-border rounded-lg p-3 text-sm">
              <option value="arbitrum">Arbitrum One · Native USDC</option>
              <option value="ethereum">Ethereum Mainnet · USDC</option>
            </select>
            <label className="block text-xs font-semibold" htmlFor="lighter-deposit-amount">USDC amount (minimum {depositNetwork === "arbitrum" ? "5" : "1"})</label>
            <input id="lighter-deposit-amount" type="text" inputMode="decimal" autoComplete="off"
              value={depositAmount} disabled={fundingBusy} onChange={event => setDepositAmount(event.target.value)}
              placeholder="1.00" className="w-full bg-brand-bg border border-brand-border rounded-lg p-3 text-sm font-mono disabled:opacity-50"/>
            <p className="text-[11px] text-brand-muted">
              {depositNetwork === "arbitrum"
                ? "Requires Arbitrum native USDC and ETH gas. The official CCTP bridge may credit Lighter after 15–20 minutes."
                : "Requires Ethereum-mainnet USDC and ETH gas. An exact-amount USDC approval may be required."}
            </p>
            <button type="button" disabled={fundingBusy || !walletAddress || !depositAmount.trim()}
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
              }}
              className="w-full p-3 rounded-lg bg-accent text-brand-bg font-bold text-sm disabled:opacity-50">
              {fundingBusy ? "Confirm in wallet…" : "Deposit USDC"}
            </button>
          </> : <>
            <p className="text-xs text-brand-muted">Secure STANDARD USDC withdrawal to the L1 wallet that owns this Lighter account. No external website and no arbitrary recipient. Wallet and Lighter ownership are verified before submission.</p>
            {!tradingIdentity && <button type="button" onClick={() => setAuthSheetOpen(true)}
              className="text-xs font-bold text-accent underline">Enable Lighter trading to withdraw</button>}
            <label className="block text-xs font-bold" htmlFor="lighter-withdraw-amount">Withdrawal amount (USDC)</label>
            <input id="lighter-withdraw-amount" type="text" inputMode="decimal" autoComplete="off"
              disabled={!tradingIdentity || fundingBusy} value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)} placeholder="USDC amount"
              className="w-full border border-brand-border bg-brand-bg p-3 rounded-lg font-mono text-sm"/>
            <p className="text-[10px] text-brand-muted">Destination: {walletAddress || "Connect wallet"}. Network fees, account minimums and final timing are determined by Lighter.</p>
            <button type="button" disabled={!tradingIdentity || fundingBusy || !withdrawAmount.trim()}
              onClick={submitWithdrawal}
              className="w-full bg-accent text-brand-bg font-bold rounded-lg p-3 disabled:opacity-40">
              {fundingBusy ? "Submitting…" : "Confirm real Lighter withdrawal"}
            </button>
          </>}
          {fundingStatus && <p role="status" className="text-xs break-all rounded-lg border border-brand-border p-2">{fundingStatus}</p>}
        </section>
      </div>
    )}

    {section === "orders" && <div className="rounded-xl border border-brand-border bg-brand-bg p-3">
      {lighterAccountTabs}
    </div>}

  </div>;
}
