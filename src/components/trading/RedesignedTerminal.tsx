/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  ChevronDown, 
  Info, 
  HelpCircle, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  RefreshCw, 
  Layers, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Sliders,
  DollarSign,
  Search,
  Star
} from "lucide-react";
import { Position, OpenOrder, TradeHistoryItem, TokenMetadata, getPerpLeverageFormatted } from "../../types";
import { useQuery } from "@tanstack/react-query";
import {
  useLiveAssetCtxs,
  useLivePrices,
  useOrderBook,
} from "../../providers/WebSocketProvider";
import {
  getSpotAssetData,
  getPerpMarginTiers,
  getPerpMarginSupport,
  canUseCrossOnAsset,
  prewarmOrderCaches,
  type Eip1193Provider,
  type HyperliquidAbstractionMode,
  type HyperliquidTradingState,
  ensureAgentKey,
  placeOrder,
  placeSpotOrder,
  placeReduceOnlyTpslTrigger,
  getPerpOrderAcceptanceError,
  isWalletTypedDataSigningError,
  isPooledAccountMode,
  getUserFees,
  getHip3FeeParams,
  parseFeeRateDecimal,
  getBuilderFeeTenthsBps,
  getSpotBuilderFeeTenthsBps,
  isOrderAvailableHydrated,
} from "../../lib/hyperliquid";
import {
  computeProtocolFeeRates,
  DEFAULT_PERP_MAKER_RATE,
  DEFAULT_PERP_TAKER_RATE,
  DEFAULT_SPOT_MAKER_RATE,
  DEFAULT_SPOT_TAKER_RATE,
  parseDeployerFeeScale,
  resolveBaseFeeRate,
} from "../../lib/hip3Fees";
import {
  buildMaintenanceSchedule,
  estimateLiqPriceCross,
  estimateLiqPriceIsolated,
} from "../../lib/hlMargin";
import { useTrustShield } from "../../lib/TrustShieldManager";
import { useLanguage } from "../../lib/LanguageContext";
import TradingDashboardTabs from "./TradingDashboardTabs";
import HideDexTradingToast from "./HideDexTradingToast";
import HideDexTradeSelectors, { type TradeOrderType } from "./HideDexTradeSelectors";
import HideDexOrderBookPanel from "./HideDexOrderBookPanel";
import {HideDexTradeGrid,HideDexOrderForm,HideDexTopMarketPane} from "./HideDexTradeLayout";
import {HideDexTradePercentPresets,HideDexTradeOptionToggle} from "./HideDexTradeOptions";
import HideDexTradeTriggerPrice from "./HideDexTradeTriggerPrice";
import HideDexTradeOutcomeInput from "./HideDexTradeOutcomeInput";
import HideDexMobileMarketHeader from "./HideDexMobileMarketHeader";
import HideDexDesktopMarketBar from "./HideDexDesktopMarketBar";
import HideDexMarketInfoDropdown from "./HideDexMarketInfoDropdown";
import { HideDexSideAndAvailability, HideDexBasicOrderInputs } from "./HideDexTradeEntry";
import MarketSelector, {
  renderAssetLogo,
} from "./MarketSelector";
import ShareCardPopup from "./share/ShareCardManager";
import TVChart from "./TVChart";
import {
  buildChartLines,
} from "../../lib/chartLines";
import TopOrderBookView from "./TopOrderBookView";
import TopTradesView, { LiveTradeItem } from "./TopTradesView";

interface RedesignedTerminalProps {
  symbol: string;
  isPerp: boolean;
  currentToken: TokenMetadata;
  tokens: TokenMetadata[];
  balanceUSDC: number;
  walletAddress: string;
  onConnectWallet: () => void;
  positions: Position[];
  openOrders: OpenOrder[];
  hyperliquidOpenOrders: any[];
  tradeHistory: TradeHistoryItem[];
  fundingHistory?: any[];
  tokenBalances?: Record<string, number>;
  spotAvailableBalances?: Record<string, number>;
  spotBalancesHydrated?: boolean;
  slippageTolerance?: number;
  onSelectToken: (symbol: string) => void;
  setIsPerp: (isPerp: boolean) => void;
  setupComplete: boolean;
  hasBalance: boolean;
  onSetupRequired: () => void;
  getUserWalletProvider: () => Promise<Eip1193Provider>;
  tradingAddress: `0x${string}` | null;
  perpInitialMarginAvailableByDex?: Record<string, number>;
  perpWithdrawableByDex?: Record<string, number>;
  unifiedSpotTransferableUsd?: number;
  accountAbstractionMode: HyperliquidAbstractionMode | null;
  mainDexAvailableUsdc: number;
  onOrderSuccess: () => void | Promise<void>;
  onSpotOrderSuccess?: () => Promise<void> | void;
  onCancelOrder?: (id: string) => Promise<void> | void;
  onCancelAllOrders?: () => Promise<void> | void;
  onClosePosition?: (position: Position, closePercent: number) => Promise<void> | void;
  onCloseAllPositions?: () => Promise<void> | void;
  onCloseSpotPosition?: (baseSymbol: string) => Promise<void> | void;
  onCloseAllSpotPositions?: () => Promise<void> | void;
  onSavePositionTpSl?: (position: Position, tpPrice: number | null, slPrice: number | null) => Promise<void> | void;
  withdrawableUsd: number;
  accountValueUsd: number;
  hyperliquidPositions: HyperliquidTradingState["positions"];
  perpCrossAccountValueByDex?: Record<string, number>;
  perpCrossMaintenanceMarginUsedByDex?: Record<string, number>;
  spotUsdcBalanceUsd: number;
  totalIsolatedMarginUsedUsd: number;
  totalCrossMaintenanceMarginUsedUsd: number;
  totalCrossInitialMarginUsedUsd: number;
  totalCrossPositionValueUsd: number;
  spotUsdcHoldUsd: number;
  tradingStateReady: boolean;
  pricePreset?: number;
  onPricePresetConsumed?: () => void;
}

function getSavedMarginTypeForWeb(
  owner: string,
  symbol: string,
  supportsCross: boolean
): "cross" | "isolated" {
  try {
    if (typeof window === "undefined") return "isolated";
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    const key = `leveragePrefs:hl:${owner || "guest"}`;
    const raw = localStorage.getItem(key);
    if (!raw) return "isolated";

    const prefs = JSON.parse(raw);
    if (!prefs || typeof prefs !== "object") return "isolated";

    let marginType: string | undefined;
    if (
      normalizedSymbol &&
      prefs.bySymbol &&
      typeof prefs.bySymbol === "object" &&
      prefs.bySymbol[normalizedSymbol] &&
      typeof prefs.bySymbol[normalizedSymbol] === "object"
    ) {
      marginType = prefs.bySymbol[normalizedSymbol].marginType;
    }

    if (!marginType) {
      marginType = prefs.lastMarginType;
    }

    if (marginType !== "cross" && marginType !== "isolated") {
      return "isolated";
    }

    if (marginType === "cross" && !supportsCross) {
      return "isolated";
    }

    return marginType;
  } catch {
    return "isolated";
  }
}

function saveMarginTypeForWeb(
  owner: string,
  symbol: string,
  marginType: "cross" | "isolated",
  supportsCross: boolean
): void {
  try {
    if (typeof window === "undefined") return;
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    const key = `leveragePrefs:hl:${owner || "guest"}`;
    const finalMarginType: "cross" | "isolated" =
      marginType === "cross" && !supportsCross ? "isolated" : marginType;

    let prefs: Record<string, any> = {};
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          prefs = parsed;
        }
      } catch {
        prefs = {};
      }
    }

    const existingBySymbol =
      prefs.bySymbol && typeof prefs.bySymbol === "object" && !Array.isArray(prefs.bySymbol)
        ? prefs.bySymbol
        : {};

    const existingSymbolPrefs =
      normalizedSymbol &&
      existingBySymbol[normalizedSymbol] &&
      typeof existingBySymbol[normalizedSymbol] === "object" &&
      !Array.isArray(existingBySymbol[normalizedSymbol])
        ? existingBySymbol[normalizedSymbol]
        : {};

    prefs.bySymbol = {
      ...existingBySymbol,
      ...(normalizedSymbol
        ? {
            [normalizedSymbol]: {
              ...existingSymbolPrefs,
              marginType: finalMarginType,
            },
          }
        : {}),
    };

    prefs.lastMarginType = finalMarginType;

    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    /* ignore storage errors, never throw */
  }
}

export default function RedesignedTerminal({
  symbol,
  isPerp,
  currentToken,
  tokens,
  balanceUSDC,
  tokenBalances,
  spotAvailableBalances,
  spotBalancesHydrated,
  slippageTolerance = 0.5,
  walletAddress,
  onConnectWallet,
  positions,
  openOrders,
  hyperliquidOpenOrders,
  tradeHistory,
  fundingHistory = [],
  onSelectToken,
  setIsPerp,
  setupComplete,
  hasBalance,
  onSetupRequired,
  getUserWalletProvider,
  tradingAddress,
  perpInitialMarginAvailableByDex,
  perpWithdrawableByDex,
  unifiedSpotTransferableUsd,
  accountAbstractionMode,
  mainDexAvailableUsdc,
  onOrderSuccess,
  onSpotOrderSuccess,
  onCancelOrder,
  onCancelAllOrders,
  onClosePosition,
  onCloseAllPositions,
  onCloseSpotPosition,
  onCloseAllSpotPositions,
  onSavePositionTpSl,
  withdrawableUsd,
  accountValueUsd,
  hyperliquidPositions,
  perpCrossAccountValueByDex,
  perpCrossMaintenanceMarginUsedByDex,
  spotUsdcBalanceUsd,
  totalIsolatedMarginUsedUsd,
  totalCrossMaintenanceMarginUsedUsd,
  totalCrossInitialMarginUsedUsd,
  totalCrossPositionValueUsd,
  spotUsdcHoldUsd,
  tradingStateReady,
  pricePreset,
  onPricePresetConsumed,
}: RedesignedTerminalProps) {
  const { t } = useLanguage();
  const effectiveSlippageBps =
    Math.round(
      Math.max(
        0,
        Number.isFinite(slippageTolerance)
          ? slippageTolerance
          : 0.5
      ) * 100
    );

  const perpOrderCoin =
    String(
      currentToken?.sourceCoin ||
      symbol ||
      ""
    );

  const perpDexKey =
    perpOrderCoin.includes(":")
      ? perpOrderCoin.split(":")[0]
      : "";

  const targetDexMarginAvailableUsd =
    perpInitialMarginAvailableByDex?.[
      perpDexKey
    ] ?? 0;

  const isHlPooledAccount =
    isPooledAccountMode(
      accountAbstractionMode
    );

  useEffect(() => {
    if (
      !isPerp ||
      !perpOrderCoin
    ) {
      return;
    }

    void prewarmOrderCaches(
      perpOrderCoin
    ).catch(() => {});
  }, [
    isPerp,
    perpOrderCoin,
  ]);

  const { isFieldHidden, mode } = useTrustShield();
  const hasPassword = typeof window !== "undefined" && !!localStorage.getItem("privacyPasswordHash");
  const fundsUnlocked = typeof window !== "undefined" && (localStorage.getItem("privacy_unlocked") === "true" || sessionStorage.getItem("funds_unlocked") === "true");
  const isLockedMode = (mode === "PRIVATE" || mode === "ANONYMOUS") && hasPassword && !fundsUnlocked;
  // --- UI Layout and Input States ---
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET" | "TAKE_LIMIT" | "TAKE_MARKET">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pref_order_type");
      if (saved === "LIMIT") return "LIMIT";
      if (saved === "MARKET") return "MARKET";
    }
    return "MARKET";
  });
  const marginOwner =
    walletAddress
      ? walletAddress.toLowerCase()
      : "guest";
  const [marginMode, setMarginMode] = useState<"CROSS" | "ISOLATED">("ISOLATED");
  const [leverage, setLeverage] = useState<number>(20);

  const marginTiersCoin =
    isPerp
      ? perpOrderCoin
      : "";

  const {
    data: marginTiers,
  } = useQuery({
    queryKey: [
      "hl_margin_tiers",
      marginTiersCoin,
    ],
    queryFn: () =>
      getPerpMarginTiers(
        marginTiersCoin
      ),
    enabled:
      isPerp &&
      !!marginTiersCoin,
    staleTime:
      5 * 60 * 1000,
  });

  const {
    data: marginSupport,
  } = useQuery({
    queryKey: [
      "hl_margin_support",
      marginTiersCoin,
    ],

    queryFn: () =>
      getPerpMarginSupport(
        marginTiersCoin
      ),

    enabled:
      isPerp &&
      !!marginTiersCoin,

    staleTime:
      5 * 60 * 1000,
  });

  const effectiveSupportsCross =
    !!marginSupport?.supportsCross &&
    canUseCrossOnAsset(
      perpOrderCoin.includes(":"),
      accountAbstractionMode
    );

  const maxLeverageFromTiers =
    useMemo(() => {
      if (
        !marginTiers ||
        marginTiers.length === 0
      ) {
        return 0;
      }

      return Math.max(
        ...marginTiers.map(
          (tier) =>
            Number(
              tier.maxLeverage
            ) || 0
        )
      );
    }, [marginTiers]);

  const maxLeverage =
    Math.max(
      1,
      currentToken?.maxLeverage ??
      0,
      maxLeverageFromTiers ||
      0,
    );

  useEffect(() => {
    setLeverage(
      (cur) =>
        Math.min(
          Math.max(1, cur),
          maxLeverage,
        )
    );
  }, [maxLeverage]);

  const { data: userFees } = useQuery({
    queryKey: [
      "hl_user_fees",
      tradingAddress,
    ],
    queryFn: () =>
      getUserFees(
        tradingAddress!
      ),
    enabled:
      !!tradingAddress,
    staleTime:
      60_000,
  });

  const {
    data: hip3FeeParams,
  } = useQuery({
    queryKey: [
      "hl_hip3_fee_params",
      perpOrderCoin,
    ],
    queryFn: () =>
      getHip3FeeParams(
        perpOrderCoin
      ),
    enabled:
      isPerp &&
      !!perpOrderCoin &&
      perpOrderCoin.includes(":"),
    staleTime:
      30_000,
    refetchInterval:
      60_000,
  });

  const perpTakerFeeRate =
    resolveBaseFeeRate(
      parseFeeRateDecimal(
        userFees?.userCrossRate
      ),
      DEFAULT_PERP_TAKER_RATE
    );

  const perpMakerFeeRate =
    resolveBaseFeeRate(
      parseFeeRateDecimal(
        userFees?.userAddRate
      ),
      DEFAULT_PERP_MAKER_RATE
    );

  const spotTakerFeeRate =
    resolveBaseFeeRate(
      parseFeeRateDecimal(
        (userFees as any)
          ?.userSpotCrossRate
      ),
      DEFAULT_SPOT_TAKER_RATE
    );

  const spotMakerFeeRate =
    resolveBaseFeeRate(
      parseFeeRateDecimal(
        (userFees as any)
          ?.userSpotAddRate
      ),
      DEFAULT_SPOT_MAKER_RATE
    );

  const referralDiscount =
    parseFeeRateDecimal(
      (userFees as any)
        ?.activeReferralDiscount
    );

  const resolvedDeployerFeeScale =
    hip3FeeParams
      ?.deployerFeeScale ??
    parseDeployerFeeScale(
      currentToken
        ?.deployerFeeScale,
      1
    );

  const resolvedGrowthMode =
    hip3FeeParams
      ?.growthMode ??
    !!currentToken?.growthMode;

  const protocolFees =
    computeProtocolFeeRates({
      takerRate:
        isPerp
          ? perpTakerFeeRate
          : spotTakerFeeRate,

      makerRate:
        isPerp
          ? perpMakerFeeRate
          : spotMakerFeeRate,

      activeReferralDiscount:
        referralDiscount,

      kind:
        isPerp ? "perp" : "spot",

      isHip3:
        isPerp &&
        !!perpDexKey,

      deployerFeeScale:
        resolvedDeployerFeeScale,

      growthMode:
        resolvedGrowthMode,
    });
  
  const [priceInput, setPriceInput] = useState<string>("");
  const [sizeInput, setSizeInput] = useState<string>("");
  const [sizeUnit, setSizeUnit] = useState<string>("USDC");
  const [selectedPercentage, setSelectedPercentage] = useState<number>(0);

  // Trigger Order Type Form Fields
  const [stopTriggerPrice, setStopTriggerPrice] = useState<string>("");
  const [takeTriggerPrice, setTakeTriggerPrice] = useState<string>("");

  const [isTpSlEnabled, setIsTpSlEnabled] = useState<boolean>(false);
  const [tpUnit, setTpUnit] = useState<"%" | "$">("%");
  const [slUnit, setSlUnit] = useState<"%" | "$">("%");
  const [tpPriceInput, setTpPriceInput] = useState<string>("");
  const [slPriceInput, setSlPriceInput] = useState<string>("");
  const [tpGainInput, setTpGainInput] = useState<string>("");
  const [slLossInput, setSlLossInput] = useState<string>("");
  const [showTpUnitDropdown, setShowTpUnitDropdown] = useState<boolean>(false);
  const [showSlUnitDropdown, setShowSlUnitDropdown] = useState<boolean>(false);
  
  const [reduceOnly, setReduceOnly] = useState<boolean>(() => {
    if (typeof window !== "undefined" && isPerp) {
      return localStorage.getItem("pref_reduce_only") === "true";
    }
    return false;
  });
  const [tif, setTif] = useState<string>("GTC");

  useEffect(() => {
    if (!isPerp && tif !== "GTC") {
      setTif("GTC");
    }
  }, [isPerp, tif]);

  // Aggregated depth factor
  const [aggregation, setAggregation] = useState<string>("1");
  const [
    orderBookSizeUnit,
    setOrderBookSizeUnit,
  ] = useState<
    "USD" | "COIN"
  >("USD");

  // Dropdown visibility
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  
  const [showOrderTypeDropdown, setShowOrderTypeDropdown] = useState(false);
  const [showMarginDropdown, setShowMarginDropdown] = useState(false);
  const [showLeverageDropdown, setShowLeverageDropdown] = useState(false);
  const [showAggregationDropdown, setShowAggregationDropdown] = useState(false);

  // Sorting and expanding state for Positions list
  const [sortBy, setSortBy] = useState<"SYMBOL" | "SIZE" | "PNL">("SYMBOL");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [expandedPositionIds, setExpandedPositionIds] = useState<Record<string, boolean>>({});
  // Share Position Card state
  const [selectedSharePosition, setSelectedSharePosition] = useState<Position | null>(null);

  // Top View Mode (CHART, ORDER BOOK, TRADES) for Desktop/Tablet/Laptop
  const [topViewMode, setTopViewMode] = useState<"chart" | "orderbook" | "trades">("chart");

  // Search navigation uses the same real chart/orderbook views.
  useEffect(() => {
    const onGlobalView = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string }>).detail;
      if (detail?.view === "chart" || detail?.view === "orderbook" || detail?.view === "trades") {
        setTopViewMode(detail.view);
      }
    };
    window.addEventListener("hidedex:global-view", onGlobalView);
    return () => window.removeEventListener("hidedex:global-view", onGlobalView);
  }, []);
  const [liveTrades, setLiveTrades] = useState<LiveTradeItem[]>([]);
  const tradesBatchBufferRef = useRef<LiveTradeItem[]>([]);

  // Stream live market trades for the selected symbol with 250ms batching
  useEffect(() => {
    setLiveTrades([]);
    tradesBatchBufferRef.current = [];
  }, [symbol]);

  // For order placement message/status feedback
  const [placeStatus, setPlaceStatus] = useState<{
    type: "pending" | "success" | "error" | null;
    title?: string;
    message: string;
  }>({ type: null, title: "", message: "" });
  const placeStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (placeStatusTimeoutRef.current) {
      clearTimeout(placeStatusTimeoutRef.current);
      placeStatusTimeoutRef.current = null;
    }

    if (placeStatus.type === "success") {
      placeStatusTimeoutRef.current = setTimeout(() => {
        setPlaceStatus({ type: null, title: "", message: "" });
        placeStatusTimeoutRef.current = null;
      }, 3000);
    } else if (placeStatus.type === "error") {
      placeStatusTimeoutRef.current = setTimeout(() => {
        setPlaceStatus({ type: null, title: "", message: "" });
        placeStatusTimeoutRef.current = null;
      }, 4500);
    }

    return () => {
      if (placeStatusTimeoutRef.current) {
        clearTimeout(placeStatusTimeoutRef.current);
        placeStatusTimeoutRef.current = null;
      }
    };
  }, [placeStatus.type, placeStatus.message, placeStatus.title]);

  const [
    isPlacingOrder,
    setIsPlacingOrder,
  ] = useState(false);

  const orderSubmitGuardRef =
    useRef(false);

  // Keep the normal Buy/Sell button label and show a one-second press
  // acknowledgement. Order progress stays exclusively in the top toast.
  const [orderButtonTapped, setOrderButtonTapped] = useState(false);
  const orderButtonTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (orderButtonTapTimerRef.current !== null) {
        clearTimeout(orderButtonTapTimerRef.current);
      }
    };
  }, []);
  const showOrderButtonTap = () => {
    if (orderButtonTapTimerRef.current !== null) {
      clearTimeout(orderButtonTapTimerRef.current);
    }
    setOrderButtonTapped(true);
    orderButtonTapTimerRef.current = setTimeout(() => {
      setOrderButtonTapped(false);
      orderButtonTapTimerRef.current = null;
    }, 1000);
  };

  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const marketInfoRef = useRef<HTMLDivElement>(null);
  const [isMarketInfoOpen, setIsMarketInfoOpen] = useState(false);
  const orderTypeDropdownRef = useRef<HTMLDivElement>(null);
  const marginDropdownRef = useRef<HTMLDivElement>(null);
  const leverageDropdownRef = useRef<HTMLDivElement>(null);
  const aggDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const terminalAsksRef = useRef<HTMLDivElement>(null);

  // Sync sizeUnit with symbol when symbol changes
  useEffect(() => {
    setSizeUnit("USDC");
    setPriceInput("");
    setSizeInput("");
    setSelectedPercentage(0);

    const savedOrderType = localStorage.getItem("pref_order_type");
    if (savedOrderType === "LIMIT" || savedOrderType === "MARKET") {
      setOrderType(savedOrderType);
    } else {
      setOrderType("MARKET");
    }

    const reduceOnlyPreference =
      localStorage.getItem("pref_reduce_only") === "true";
    setReduceOnly(
      isPerp
        ? reduceOnlyPreference
        : false
    );

    // Dynamic Leverage Clamping:
    const maxAllowed = maxLeverage;
    const savedSymbolLeverage = localStorage.getItem(`leverage_${symbol}`);
    const generalPreference = localStorage.getItem("pref_leverage");
    let chosenLeverage = savedSymbolLeverage 
      ? parseInt(savedSymbolLeverage) 
      : (generalPreference ? parseInt(generalPreference) : 20);

    if (chosenLeverage > maxAllowed) {
      chosenLeverage = maxAllowed;
    }
    setLeverage(chosenLeverage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, isPerp, maxLeverage]);

  // One-shot price preset consumption (e.g. from MarketsPanel order book row click)
  useEffect(() => {
    if (
      typeof pricePreset !== "number" ||
      !Number.isFinite(pricePreset) ||
      pricePreset <= 0
    ) {
      return;
    }

    setPriceInput(pricePreset.toString());
    setSelectedPercentage(0);
    onPricePresetConsumed?.();
  }, [pricePreset, onPricePresetConsumed]);

  // Live listener for Trading Preferences updates
  useEffect(() => {
    const handlePreferencesUpdated = () => {
      const savedOrderType = localStorage.getItem("pref_order_type");
      if (savedOrderType === "LIMIT" || savedOrderType === "MARKET") {
        setOrderType(savedOrderType);
      }

      const reduceOnlyPreference =
        localStorage.getItem("pref_reduce_only") === "true";
      setReduceOnly(isPerp ? reduceOnlyPreference : false);
    };

    window.addEventListener("preferences-updated", handlePreferencesUpdated);
    return () => {
      window.removeEventListener("preferences-updated", handlePreferencesUpdated);
    };
  }, [isPerp]);

  const currentHlPosition =
    useMemo(() => {
      if (!isPerp) {
        return null;
      }

      const normalize =
        (value?: string) =>
          (value ?? "")
            .toLowerCase();

      const candidates = [
        perpOrderCoin,
        currentToken?.sourceCoin,
        symbol,
      ]
        .filter(Boolean)
        .map((value) =>
          normalize(
            String(value)
          )
        );

      const pos =
        hyperliquidPositions.find(
          (row) =>
            candidates.includes(
              normalize(
                String(
                  row?.coin ?? ""
                )
              )
            )
        );

      if (!pos) {
        return null;
      }

      const rawSize =
        parseFloat(
          String(
            pos?.szi ?? 0
          )
        );

      if (
        !Number.isFinite(rawSize) ||
        rawSize === 0
      ) {
        return null;
      }

      const side:
        "long" | "short" =
        rawSize >= 0
          ? "long"
          : "short";

      const entryPx =
        parseFloat(
          String(
            pos?.entryPx ?? 0
          )
        );

      const levObj: any =
        pos?.leverage;

      const leverageValue =
        typeof levObj === "object" &&
        levObj?.value != null
          ? parseFloat(
              String(
                levObj.value
              )
            )
          : parseFloat(
              String(
                levObj ?? ""
              )
            );

      const positionLeverage =
        Number.isFinite(
          leverageValue
        )
          ? leverageValue
          : undefined;

      const parsedMarginUsed =
        parseFloat(
          String(
            pos?.marginUsed ?? ""
          )
        );

      const marginUsedUsd =
        Number.isFinite(
          parsedMarginUsed
        )
          ? parsedMarginUsed
          : undefined;

      const positionValue =
        parseFloat(
          String(
            pos?.positionValue ??
            ""
          )
        );

      const markPx =
        Number.isFinite(
          positionValue
        ) &&
        positionValue > 0
          ? Math.abs(
              positionValue
            ) /
            Math.abs(rawSize)
          : undefined;

      const marginType =
        pos?.marginType as
          | "cross"
          | "isolated"
          | undefined;

      const parsedLiquidationPx =
        parseFloat(
          String(
            pos?.liquidationPx ??
            ""
          )
        );

      return {
        entryPx,
        side,
        sizeUnits:
          Math.abs(rawSize),
        leverage:
          positionLeverage,
        marginUsedUsd,
        markPx,
        marginType,
        liquidationPx:
          Number.isFinite(
            parsedLiquidationPx
          ) &&
          parsedLiquidationPx > 0
            ? parsedLiquidationPx
            : undefined,
      };
    }, [
      isPerp,
      hyperliquidPositions,
      perpOrderCoin,
      currentToken?.sourceCoin,
      symbol,
    ]);

  const restingOrderLockForCoin =
    useMemo(() => {
      if (!isPerp) {
        return null;
      }

      const normalize =
        (value?: string) =>
          (value ?? "")
            .toLowerCase();

      const candidates = [
        perpOrderCoin,
        currentToken?.sourceCoin,
        symbol,
      ]
        .filter(Boolean)
        .map((value) =>
          normalize(
            String(value)
          )
        );

      const matchingOrders =
        (
          hyperliquidOpenOrders ??
          []
        ).filter(
          (o: any) => {
            if (!o) {
              return false;
            }

            if (o.reduceOnly) {
              return false;
            }

            if (o.isTrigger) {
              return false;
            }

            if (
              o.isPositionTpsl
            ) {
              return false;
            }

            return candidates.includes(
              normalize(
                String(
                  o?.coin ?? ""
                )
              )
            );
          }
        );

      if (
        matchingOrders.length ===
        0
      ) {
        return null;
      }

      let lockedMarginType:
        | "cross"
        | "isolated"
        | undefined;

      let lockedLeverage:
        number | undefined;

      for (
        const o of
        matchingOrders
      ) {
        let mt:
          | "cross"
          | "isolated"
          | undefined;

        if (
          o?.marginType ===
            "cross" ||
          o?.marginType ===
            "isolated"
        ) {
          mt =
            o.marginType;
        } else if (
          o?.isCross === true
        ) {
          mt = "cross";
        } else if (
          o?.isCross === false
        ) {
          mt = "isolated";
        }

        if (
          mt &&
          !lockedMarginType
        ) {
          lockedMarginType =
            mt;
        }

        const rawLev =
          o?.leverage;

        let lev:
          number | undefined;

        if (
          rawLev != null
        ) {
          const parsed =
            typeof rawLev ===
              "object"
              ? parseFloat(
                  String(
                    rawLev?.value ??
                      "0"
                  )
                )
              : parseFloat(
                  String(
                    rawLev
                  )
                );

          if (
            Number.isFinite(
              parsed
            ) &&
            parsed > 0
          ) {
            lev =
              Math.round(
                parsed
              );
          }
        }

        if (
          lev != null &&
          lockedLeverage ==
            null
        ) {
          lockedLeverage =
            lev;
        }

        if (
          lockedMarginType &&
          lockedLeverage !=
            null
        ) {
          break;
        }
      }

      if (
        !lockedMarginType &&
        lockedLeverage ==
          null
      ) {
        return null;
      }

      return {
        marginType:
          lockedMarginType,

        leverage:
          lockedLeverage,

        count:
          matchingOrders.length,
      };
    }, [
      isPerp,
      hyperliquidOpenOrders,
      perpOrderCoin,
      currentToken?.sourceCoin,
      symbol,
    ]);

  useEffect(() => {
    if (!isPerp) {
      return;
    }

    const lockedTo =
      currentHlPosition
        ?.marginType ??
      restingOrderLockForCoin
        ?.marginType;

    if (!lockedTo) {
      return;
    }

    const lockedMode =
      lockedTo === "cross"
        ? "CROSS"
        : "ISOLATED";

    if (
      marginMode !==
      lockedMode
    ) {
      setMarginMode(
        lockedMode
      );
    }
  }, [
    isPerp,
    currentHlPosition
      ?.marginType,
    restingOrderLockForCoin
      ?.marginType,
    marginMode,
  ]);

  useEffect(() => {
    if (!isPerp) {
      return;
    }

    let lockedLeverage:
      number | undefined;

    if (
      marginMode ===
        "ISOLATED" &&
      Number.isFinite(
        currentHlPosition
          ?.leverage
      ) &&
      (
        currentHlPosition
          ?.leverage ??
        0
      ) > 0
    ) {
      lockedLeverage =
        Math.max(
          1,
          Math.round(
            currentHlPosition!
              .leverage!
          )
        );
    } else {
      const currentMarginType:
        | "cross"
        | "isolated" =
        marginMode ===
          "CROSS"
          ? "cross"
          : "isolated";

      if (
        restingOrderLockForCoin
          ?.leverage != null &&
        restingOrderLockForCoin
          ?.marginType ===
          currentMarginType
      ) {
        lockedLeverage =
          Math.max(
            1,
            restingOrderLockForCoin
              .leverage
          );
      }
    }

    if (
      lockedLeverage &&
      leverage !==
        lockedLeverage
    ) {
      setLeverage(
        lockedLeverage
      );
    }
  }, [
    isPerp,
    currentHlPosition
      ?.leverage,
    restingOrderLockForCoin
      ?.leverage,
    restingOrderLockForCoin
      ?.marginType,
    marginMode,
    leverage,
  ]);

  const lockedMarginType =
    currentHlPosition
      ?.marginType ??
    restingOrderLockForCoin
      ?.marginType ??
    null;

  const lockedMarginMode =
    lockedMarginType ===
      "cross"
      ? "CROSS"
      : lockedMarginType ===
        "isolated"
      ? "ISOLATED"
      : null;

  useEffect(() => {
    if (!isPerp) {
      return;
    }

    if (lockedMarginMode) {
      return;
    }

    if (!marginSupport) {
      return;
    }

    if (
      marginMode === "CROSS" &&
      !effectiveSupportsCross
    ) {
      setMarginMode(
        "ISOLATED"
      );
    }
  }, [
    isPerp,
    lockedMarginMode,
    marginSupport,
    effectiveSupportsCross,
    marginMode,
  ]);

  // Primary margin mode persistence: load saved margin preference for current coin
  useEffect(() => {
    if (!isPerp || !perpOrderCoin || !marginSupport) {
      return;
    }

    if (lockedMarginMode) {
      return;
    }

    const savedType = getSavedMarginTypeForWeb(
      marginOwner,
      perpOrderCoin,
      effectiveSupportsCross
    );

    const targetMode = savedType === "cross" ? "CROSS" : "ISOLATED";
    setMarginMode(targetMode);
  }, [
    isPerp,
    perpOrderCoin,
    marginSupport,
    lockedMarginMode,
    effectiveSupportsCross,
    marginOwner,
  ]);

  const currentMarginType =
    marginMode === "CROSS"
      ? "cross"
      : "isolated";

  const isLeverageLocked =
    !!(
      isPerp &&
      (
        (
          marginMode ===
            "ISOLATED" &&
          Number.isFinite(
            currentHlPosition
              ?.leverage
          ) &&
          (
            currentHlPosition
              ?.leverage ??
            0
          ) > 0
        ) ||
        (
          restingOrderLockForCoin
            ?.leverage != null &&
          restingOrderLockForCoin
            ?.marginType ===
            currentMarginType
        )
      )
    );

  useEffect(() => {
    if (
      !isPerp ||
      !currentHlPosition
    ) {
      setReduceOnly(
        false
      );
    }
  }, [
    isPerp,
    currentHlPosition,
  ]);

  // Reset orderType to standard Limit/Market if Spot Mode is toggled
  useEffect(() => {
    if (!isPerp) {
      if (orderType !== "LIMIT" && orderType !== "MARKET") {
        setOrderType("LIMIT");
      }
    }
  }, [isPerp, orderType]);

  // Handle outside click to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isInsideMarketSelector =
        target instanceof Element &&
        target.closest('[data-market-selector-portal="true"]');
      const isTokenTrigger =
        target instanceof Element &&
        Boolean(
          target.closest(
            '[data-terminal-token-trigger="true"]'
          )
        );

      if (
        !isInsideMarketSelector &&
        !isTokenTrigger &&
        tokenDropdownRef.current &&
        !tokenDropdownRef.current.contains(
          target
        )
      ) {
        setShowTokenDropdown(false);
      }
      const isInsideInfoDropdown =
        target instanceof Element &&
        Boolean(target.closest('[data-market-info-dropdown="true"]'));

      if (!isInsideInfoDropdown && marketInfoRef.current && !marketInfoRef.current.contains(target)) {
        setIsMarketInfoOpen(false);
      }
      if (orderTypeDropdownRef.current && !orderTypeDropdownRef.current.contains(target)) {
        setShowOrderTypeDropdown(false);
      }
      if (marginDropdownRef.current && !marginDropdownRef.current.contains(target)) {
        setShowMarginDropdown(false);
      }
      if (leverageDropdownRef.current && !leverageDropdownRef.current.contains(target)) {
        setShowLeverageDropdown(false);
      }
      if (aggDropdownRef.current && !aggDropdownRef.current.contains(target)) {
        setShowAggregationDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSpotOnly =
    currentToken?.isSpotOnly === true;

  // Strip the routing-only suffix from visible labels; preserve the real trading symbol.
  const headerTickerRaw = String(currentToken?.symbol || currentToken?.name || symbol || "");
  const headerTicker = isPerp ? headerTickerRaw : headerTickerRaw.replace(/-SPOT$/i, "");

  const spotPair = useMemo(
    () =>
      currentToken?.spotSymbol ||
      currentToken?.displayBaseAsset ||
      currentToken?.sourceCoin ||
      symbol ||
      "",
    [
      currentToken?.spotSymbol,
      currentToken?.displayBaseAsset,
      currentToken?.sourceCoin,
      symbol,
    ]
  );

  const {
    data: spotAssetData,
  } = useQuery({
    queryKey: [
      "hl_spot_asset",
      spotPair,
    ],
    queryFn: () =>
      getSpotAssetData(spotPair),
    enabled: !!spotPair,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Hyperliquid subscriptions require the real market identifier.
  // HIP-3 markets are dex-prefixed (e.g. xyz:SYMBOL); displayBaseAsset is UI-only.
  // Orders already route via sourceCoin; keep data subscriptions on the same ID.
  const perpOrderBookCoin =
    useMemo(
      () => String(
        currentToken?.sourceCoin ||
        currentToken?.displayBaseAsset ||
        symbol ||
        ""
      ).trim(),
      [
        currentToken?.sourceCoin,
        currentToken?.displayBaseAsset,
        symbol,
      ],
    );

  const orderBookCoin =
    useMemo(() => {
      if (!isPerp) {
        return (
          spotAssetData?.spotSymbol ||
          currentToken?.spotSymbol ||
          currentToken?.displayBaseAsset ||
          ""
        );
      }

      return perpOrderBookCoin;
    }, [
      isPerp,
      spotAssetData?.spotSymbol,
      currentToken?.spotSymbol,
      currentToken?.displayBaseAsset,
      perpOrderBookCoin,
    ]);

  const chartCandleCoin =
    useMemo(() => {
      if (isPerp) {
        return currentToken?.sourceCoin || "";
      }
      return spotAssetData?.spotSymbol || "";
    }, [
      isPerp,
      currentToken?.sourceCoin,
      spotAssetData?.spotSymbol,
    ]);

  const orderBook =
    useOrderBook(
      orderBookCoin
    );

  const liveCoins =
    useMemo(
      () => {
        const coins:
          string[] = [];

        if (
          isPerp &&
          !isSpotOnly &&
          perpOrderBookCoin
        ) {
          coins.push(
            String(
              perpOrderBookCoin
            )
          );
        }

        if (
          !isPerp &&
          spotAssetData
            ?.spotSymbol
        ) {
          coins.push(
            String(
              spotAssetData
                .spotSymbol
            )
          );
        }

        const uniq =
          (Array.from(
            new Set(coins)
          ).filter(Boolean) as string[]);

        uniq.sort();

        return uniq;
      },
      [
        isPerp,
        isSpotOnly,
        perpOrderBookCoin,
        spotAssetData
          ?.spotSymbol,
      ],
    );

  const livePrices =
    useLivePrices(
      liveCoins
    );

  const [
    priceNow,
    setPriceNow,
  ] = useState(
    () => Date.now()
  );

  useEffect(() => {
    const id =
      setInterval(
        () =>
          setPriceNow(
            Date.now()
          ),
        2_000,
      );

    return () =>
      clearInterval(id);
  }, []);

  const getFreshLivePrice =
    useCallback(
      (
        coin?:
          string |
          null,
      ) => {
        if (!coin) {
          return undefined;
        }

        const live =
          livePrices?.[
            coin
          ];

        if (
          !live?.price ||
          !live.time
        ) {
          return undefined;
        }

        return (
          priceNow -
            live.time <=
          10_000
        )
          ? live.price
          : undefined;
      },
      [
        livePrices,
        priceNow,
      ],
    );

  const spotCurrentPrice =
    useMemo(() => {
      const spotKey =
        spotAssetData?.spotSymbol;

      const liveSpot =
        getFreshLivePrice(
          spotKey
        );

      const raw =
        liveSpot ??
        spotAssetData?.midPx ??
        spotAssetData?.markPx ??
        "";

      const value =
        parseFloat(
          String(raw)
        );

      return (
        Number.isFinite(
          value
        ) &&
        value > 0
      )
        ? value
        : null;
    }, [
      getFreshLivePrice,
      spotAssetData?.spotSymbol,
      spotAssetData?.midPx,
      spotAssetData?.markPx,
    ]);

  const liveAssetCtxs =
    useLiveAssetCtxs(
      isPerp &&
      !isSpotOnly &&
      perpOrderBookCoin
        ? [
            perpOrderBookCoin
          ]
        : []
    );

  const perpCurrentPrice =
    useMemo(() => {
      // Pick the first positive real market price. A HIP-3 subscription
      // may return an empty/zero mark for illiquid, halted or inactive books;
      // that must not suppress a valid Hyperliquid registry snapshot.
      const candidates = [
        liveAssetCtxs?.[perpOrderBookCoin]?.markPx,
        getFreshLivePrice(perpOrderBookCoin),
        currentToken?.price,
      ];
      for (const raw of candidates) {
        if (raw === null || raw === undefined || raw === "") continue;
        const value = Number(raw);
        if (Number.isFinite(value) && value > 0) return value;
      }
      return null;
    }, [
      liveAssetCtxs,
      perpOrderBookCoin,
      getFreshLivePrice,
      currentToken?.price,
    ]);

  const realCurrentPrice =
    isPerp
      ? perpCurrentPrice
      : spotCurrentPrice;

  const chartPriceLines =
    useMemo(
      () =>
        isPerp
          ? buildChartLines({
              coin:
                perpOrderCoin,
              positions,
              orders:
                openOrders,
              mark:
                realCurrentPrice,
            })
          : [],
      [
        isPerp,
        perpOrderCoin,
        positions,
        openOrders,
        realCurrentPrice,
      ],
    );

  const spotMarkPx =
    currentToken?.spotCtx?.markPx !== undefined && currentToken.spotCtx.markPx !== null
      ? parseFloat(String(currentToken.spotCtx.markPx))
      : null;

  const spotPrevDayPx =
    currentToken?.spotCtx?.prevDayPx !== undefined && currentToken.spotCtx.prevDayPx !== null
      ? parseFloat(String(currentToken.spotCtx.prevDayPx))
      : null;

  const spotDayNtlVlm =
    currentToken?.spotCtx?.dayNtlVlm !== undefined && currentToken.spotCtx.dayNtlVlm !== null
      ? parseFloat(String(currentToken.spotCtx.dayNtlVlm))
      : null;

  const spotChange24h =
    spotMarkPx !== null && spotPrevDayPx !== null && spotPrevDayPx > 0
      ? ((spotMarkPx - spotPrevDayPx) / spotPrevDayPx) * 100
      : null;

  const effectiveChange24h = isPerp
    ? currentToken.change24h
    : (spotChange24h !== null && Number.isFinite(spotChange24h) ? spotChange24h : null);

  const effectiveVolume24h = isPerp
    ? currentToken.volume24h
    : (spotDayNtlVlm !== null && Number.isFinite(spotDayNtlVlm) ? spotDayNtlVlm : null);

  const effectiveFundingRate = isPerp ? currentToken.fundingRate : null;
  const effectiveOpenInterest = isPerp ? currentToken.openInterest : null;

  const validEnteredPrice = parseFloat(priceInput) > 0 ? parseFloat(priceInput) : null;
  const basePrice = orderType === "MARKET"
    ? realCurrentPrice
    : (validEnteredPrice ?? realCurrentPrice);

  // Sync TP and SL targets dynamically when basePrice or orderSide changes
  useEffect(() => {
    if (basePrice === null || typeof basePrice !== "number" || !Number.isFinite(basePrice) || basePrice <= 0) return;
    
    // Recalculate TP Price if gain value is present
    if (tpGainInput) {
      const gainVal = parseFloat(tpGainInput);
      if (!isNaN(gainVal)) {
        if (tpUnit === "%") {
          const targetPrice = orderSide === "BUY"
            ? basePrice * (1 + gainVal / 100)
            : basePrice * (1 - gainVal / 100);
          setTpPriceInput(targetPrice.toFixed(2));
        } else {
          const targetPrice = orderSide === "BUY"
            ? basePrice + gainVal
            : basePrice - gainVal;
          setTpPriceInput(targetPrice.toFixed(2));
        }
      }
    }
    
    // Recalculate SL Price if loss value is present
    if (slLossInput) {
      const lossVal = parseFloat(slLossInput);
      if (!isNaN(lossVal)) {
        if (slUnit === "%") {
          const targetPrice = orderSide === "BUY"
            ? basePrice * (1 - lossVal / 100)
            : basePrice * (1 + lossVal / 100);
          setSlPriceInput(targetPrice.toFixed(2));
        } else {
          const targetPrice = orderSide === "BUY"
            ? basePrice - lossVal
            : basePrice + lossVal;
          setSlPriceInput(targetPrice.toFixed(2));
        }
      }
    }
  }, [basePrice, orderSide]);

  const handleTpUnitChange = (newUnit: "%" | "$") => {
    setTpUnit(newUnit);
    const tpVal = parseFloat(tpPriceInput);
    if (!isNaN(tpVal) && basePrice !== null && basePrice > 0) {
      if (newUnit === "%") {
        const pct = orderSide === "BUY"
          ? ((tpVal - basePrice) / basePrice) * 100
          : ((basePrice - tpVal) / basePrice) * 100;
        setTpGainInput(pct.toFixed(2));
      } else {
        const diff = orderSide === "BUY"
          ? tpVal - basePrice
          : basePrice - tpVal;
        setTpGainInput(diff.toFixed(2));
      }
    }
  };

  const handleSlUnitChange = (newUnit: "%" | "$") => {
    setSlUnit(newUnit);
    const slVal = parseFloat(slPriceInput);
    if (!isNaN(slVal) && basePrice !== null && basePrice > 0) {
      if (newUnit === "%") {
        const pct = orderSide === "BUY"
          ? ((basePrice - slVal) / basePrice) * 100
          : ((slVal - basePrice) / basePrice) * 100;
        setSlLossInput(pct.toFixed(2));
      } else {
        const diff = orderSide === "BUY"
          ? basePrice - slVal
          : slVal - basePrice;
        setSlLossInput(diff.toFixed(2));
      }
    }
  };

  // --- Order Book Centralized Subscription & Real-Time Hydration ---
  // Visual order book shows exactly six authentic price levels per side on both venues.
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const limit = isMobile ? 8 : 14;

  const {
    asks,
    bids,
  } = useMemo(() => {
    const rawBids =
      orderBook?.bids ??
      [];

    const rawAsks =
      orderBook?.asks ??
      [];

    let bidAccum = 0;

    const mappedBids =
      [...rawBids]
        .filter(b => Number.isFinite(Number(b.px)) && Number(b.px)>0)
        .sort((a,b)=>Number(b.px)-Number(a.px))
        .slice(0, limit)
        .map((b) => {
          const price =
            Number(b.px);

          const size =
            Number(b.sz);

          bidAccum += size;

          return {
            price,
            size,
            total: bidAccum,
          };
        });

    let askAccum = 0;

    const mappedAsks =
      [...rawAsks]
        .filter(a => Number.isFinite(Number(a.px)) && Number(a.px)>0)
        .sort((a,b)=>Number(a.px)-Number(b.px))
        .slice(0, limit)
        .map((a) => {
          const price =
            Number(a.px);

          const size =
            Number(a.sz);

          askAccum += size;

          return {
            price,
            size,
            total: askAccum,
          };
        });

    return {
      bids:
        mappedBids,

      asks:
        mappedAsks.reverse(),
    };
  }, [
    orderBook?.bids,
    orderBook?.asks,
    limit,
  ]);

  const [activeFlashingPrices, setActiveFlashingPrices] = useState<Record<string, "BUY" | "SELL">>({});

  const canToggleSpot =
    useMemo(() => {
      if (isSpotOnly) {
        return true;
      }

      const spotSymbol =
        spotAssetData
          ?.spotSymbol ||
        currentToken
          ?.spotSymbol ||
        null;

      return (
        currentToken
          ?.hasSpot ===
          true &&
        Boolean(
          spotSymbol
        )
      );
    }, [
      isSpotOnly,
      spotAssetData
        ?.spotSymbol,
      currentToken
        ?.hasSpot,
      currentToken
        ?.spotSymbol,
    ]);

  useEffect(() => {
    if (
      isSpotOnly &&
      isPerp
    ) {
      setIsPerp(false);
    }
  }, [
    isSpotOnly,
    isPerp,
    setIsPerp,
  ]);

  useEffect(() => {
    if (
      !isPerp &&
      !canToggleSpot &&
      !isSpotOnly
    ) {
      setIsPerp(true);
    }
  }, [
    canToggleSpot,
    isSpotOnly,
    isPerp,
    setIsPerp,
  ]);

  // Auto-scroll terminal orderbook asks container to bottom so spread is centered
  useEffect(() => {
    if (terminalAsksRef.current) {
      terminalAsksRef.current.scrollTop = terminalAsksRef.current.scrollHeight;
    }
  }, [asks]);

  // --- Calculations ---
  const isStopOrder =
    orderType === "STOP_MARKET" ||
    orderType === "STOP_LIMIT";

  const isTakeOrder =
    orderType === "TAKE_MARKET" ||
    orderType === "TAKE_LIMIT";

  const isTriggerOrder =
    isStopOrder ||
    isTakeOrder;

  const isLimitStyleTrigger =
    orderType === "STOP_LIMIT" ||
    orderType === "TAKE_LIMIT";

  const isMarketStyleTrigger =
    orderType === "STOP_MARKET" ||
    orderType === "TAKE_MARKET";

  const isAttachedTpSlParentOrder =
    isPerp &&
    !isTriggerOrder &&
    (
      orderType === "MARKET" ||
      orderType === "LIMIT"
    );

  useEffect(() => {
    if (
      isAttachedTpSlParentOrder
    ) {
      return;
    }

    if (isTpSlEnabled) {
      setIsTpSlEnabled(false);
    }

    if (tpPriceInput) {
      setTpPriceInput("");
    }

    if (slPriceInput) {
      setSlPriceInput("");
    }

    if (tpGainInput) {
      setTpGainInput("");
    }

    if (slLossInput) {
      setSlLossInput("");
    }
  }, [
    isAttachedTpSlParentOrder,
    isTpSlEnabled,
    tpPriceInput,
    slPriceInput,
    tpGainInput,
    slLossInput,
  ]);

  const isTakerOrder =
    orderType === "MARKET" ||
    orderType === "STOP_MARKET" ||
    orderType === "TAKE_MARKET";

  const protocolFeeRate =
    isTakerOrder
      ? protocolFees.takerRate
      : protocolFees.makerRate;

  const builderFeeRate =
    isPerp
      ? getBuilderFeeTenthsBps() * 0.00001
      : getSpotBuilderFeeTenthsBps() * 0.00001;

  const totalFeeRate =
    protocolFeeRate +
    builderFeeRate;

  const transferablePerpUsd =
    useMemo(() => {
      if (!isPerp) return 0;

      const byDex =
        perpWithdrawableByDex ??
        {};

      return Object.entries(
        byDex
      ).reduce(
        (
          sum,
          [dex, value]
        ) => {
          if (
            dex ===
            perpDexKey
          ) {
            return sum;
          }

          const n =
            typeof value ===
            "number"
              ? value
              : parseFloat(
                  String(
                    value ?? ""
                  )
                );

          return (
            sum +
            (
              Number.isFinite(n) &&
              n > 0
                ? n
                : 0
            )
          );
        },
        0
      );
    }, [
      isPerp,
      perpDexKey,
      perpWithdrawableByDex,
    ]);

  const isHip3Order =
    isPerp &&
    !!perpDexKey;

  const hlPerpOrderAvailableUsdRaw =
    (() => {
      if (!isPerp) {
        return withdrawableUsd;
      }

      if (!isHlPooledAccount) {
        return Number.isFinite(
          targetDexMarginAvailableUsd
        )
          ? Math.max(
              0,
              targetDexMarginAvailableUsd
            ) +
            transferablePerpUsd
          : withdrawableUsd;
      }

      if (isHip3Order) {
        const targetDexBalance =
          Number.isFinite(
            targetDexMarginAvailableUsd
          )
            ? Math.max(
                0,
                targetDexMarginAvailableUsd
              )
            : 0;

        return (
          (
            unifiedSpotTransferableUsd ??
            0
          ) +
          targetDexBalance
        );
      }

      return withdrawableUsd;
    })();

  const lastKnownOrderAvailableRef =
    useRef<number | null>(
      null
    );

  const orderAvailableHydrated =
    isOrderAvailableHydrated({
      accountAbstractionMode,
      isHip3Order,
      spotBalancesHydrated:
        tradingStateReady,
    });

  if (
    orderAvailableHydrated &&
    Number.isFinite(
      hlPerpOrderAvailableUsdRaw
    )
  ) {
    lastKnownOrderAvailableRef.current =
      Math.max(
        0,
        hlPerpOrderAvailableUsdRaw
      );
  }

  const showOrderAvailableAmount =
    orderAvailableHydrated ||
    lastKnownOrderAvailableRef
      .current != null;

  const availableUsd =
    orderAvailableHydrated
      ? hlPerpOrderAvailableUsdRaw
      : (
          lastKnownOrderAvailableRef
            .current ??
          0
        );

  const maxUsableMarginUsd =
    useMemo(() => {
      const BUFFER_FACTOR =
        0.995;

      const a =
        Math.max(
          0,
          availableUsd
        );

      const L =
        Math.max(
          1,
          leverage
        );

      const denom =
        1 +
        totalFeeRate * L;

      if (denom <= 0) {
        return 0;
      }

      return Math.max(
        0,
        (a / denom) *
          BUFFER_FACTOR
      );
    }, [
      availableUsd,
      leverage,
      totalFeeRate,
    ]);

  const validEnteredPriceNum = Number(priceInput) > 0 ? Number(priceInput) : null;
  const currentPriceNum =
    (
      orderType === "MARKET" ||
      orderType === "STOP_MARKET" ||
      orderType === "TAKE_MARKET"
    )
      ? realCurrentPrice
      : (
          validEnteredPriceNum ??
          realCurrentPrice
        );
  const sizeNum = Number(sizeInput) || 0;
  
  // Real dynamic available balance in terms of active unit
  const spotBaseCoin =
    String(
      spotAssetData?.baseCoin ||
      currentToken?.displayBaseAsset ||
      ""
    ).toUpperCase();

  const spotAvailableUsdc =
    spotAvailableBalances?.USDC ?? 0;

  const spotAvailableBase =
    spotAvailableBalances?.[spotBaseCoin] ?? 0;

  const spotSzDecimals =
    spotAssetData?.szDecimals ?? 0;

  const sizeBaseUnit = useMemo(() => {
    const raw = isPerp
      ? (
          currentToken?.displayBaseAsset ||
          currentToken?.sourceCoin ||
          symbol
        )
      : (
          spotBaseCoin ||
          currentToken?.displayBaseAsset ||
          currentToken?.sourceCoin ||
          symbol
        );

    return String(raw || symbol)
      .toUpperCase()
      .replace(/\/USDC$/i, "")
      .replace(/-USDC$/i, "")
      .replace(/-(PERP|SPOT)$/i, "");
  }, [
    isPerp,
    spotBaseCoin,
    currentToken?.displayBaseAsset,
    currentToken?.sourceCoin,
    symbol,
  ]);

  const sizeDecimals = useMemo(() => {
    const raw = isPerp
      ? currentToken?.szDecimals
      : spotSzDecimals;

    const parsed = Number(raw);

    return Number.isFinite(parsed)
      ? Math.max(0, Math.min(8, Math.trunc(parsed)))
      : 4;
  }, [
    isPerp,
    currentToken?.szDecimals,
    spotSzDecimals,
  ]);

  const formatBaseSize = useCallback((
    value: number
  ) => {
    if (!Number.isFinite(value)) return "";

    const fixed =
      value.toFixed(sizeDecimals);

    if (sizeDecimals === 0) {
      return fixed;
    }

    return fixed.replace(/\.?0+$/, "");
  }, [sizeDecimals]);

  const sizeEquivalentText = useMemo(() => {
    const raw = Number(sizeInput);
    const px = currentPriceNum;

    if (
      !Number.isFinite(raw) ||
      raw <= 0 ||
      px === null ||
      !Number.isFinite(px) ||
      px <= 0
    ) {
      return null;
    }

    if (sizeUnit === "USDC") {
      return `≈ ${formatBaseSize(raw / px)} ${sizeBaseUnit}`;
    }

    return `≈ ${(raw * px).toFixed(2)} USDC`;
  }, [
    sizeInput,
    sizeUnit,
    currentPriceNum,
    sizeBaseUnit,
    formatBaseSize,
  ]);

  const spotBuyAvailableUsd =
    isHlPooledAccount
      ? Math.max(
          spotAvailableUsdc,
          Math.max(
            0,
            withdrawableUsd -
              spotUsdcHoldUsd
          )
        )
      : spotAvailableUsdc;

  const spotBuyMaxUsableUsd =
    useMemo(() => {
      const BUFFER_FACTOR =
        0.995;

      const denom =
        1 +
        totalFeeRate;

      if (denom <= 0) {
        return 0;
      }

      return Math.max(
        0,
        (
          spotBuyAvailableUsd /
          denom
        ) *
          BUFFER_FACTOR
      );
    }, [
      spotBuyAvailableUsd,
      totalFeeRate,
    ]);

  let availToTradeVal = 0;
  let availToTradeUnit = "USDC";

  if (!isPerp) {
    if (orderSide === "BUY") {
      availToTradeVal = spotBuyAvailableUsd;
      availToTradeUnit = "USDC";
    } else {
      availToTradeVal = spotAvailableBase;
      availToTradeUnit = spotBaseCoin || symbol;
    }
  } else {
    availToTradeVal = availableUsd;
    availToTradeUnit = "USDC";
  }

  // Order value
  const orderValue = sizeUnit === "USDC" ? sizeNum : (currentPriceNum !== null ? sizeNum * currentPriceNum : null);
  
  const sizeUsd =
    typeof orderValue ===
    "number" &&
    Number.isFinite(
      orderValue
    ) &&
    orderValue > 0
      ? orderValue
      : 0;

  const marginRequired =
    !isPerp
      ? sizeUsd
      : leverage > 0
      ? sizeUsd /
        leverage
      : 0;

  const estFeeUsd =
    isPerp &&
    sizeUsd > 0
      ? sizeUsd *
        totalFeeRate
      : 0;

  const notEnoughMargin =
    isPerp &&
    marginRequired +
      estFeeUsd >
      availableUsd +
        1e-9;

  const existingNotional =
    useMemo(() => {
      if (
        !currentHlPosition ||
        !Number.isFinite(
          realCurrentPrice
        ) ||
        (
          realCurrentPrice ??
          0
        ) <= 0
      ) {
        return 0;
      }

      return (
        Math.abs(
          currentHlPosition
            .sizeUnits
        ) *
        (
          realCurrentPrice as
            number
        )
      );
    }, [
      currentHlPosition,
      realCurrentPrice,
    ]);

  const reduceOnlyEligibleLong =
    isPerp &&
    existingNotional > 0 &&
    currentHlPosition
      ?.side === "short" &&
    Number.isFinite(
      sizeUsd
    ) &&
    sizeUsd > 0 &&
    sizeUsd <=
      existingNotional +
        1e-9;

  const reduceOnlyEligibleShort =
    isPerp &&
    existingNotional > 0 &&
    currentHlPosition
      ?.side === "long" &&
    Number.isFinite(
      sizeUsd
    ) &&
    sizeUsd > 0 &&
    sizeUsd <=
      existingNotional +
        1e-9;

  const roAvailable =
    isPerp &&
    !!currentHlPosition;

  const roTooLarge =
    reduceOnly &&
    existingNotional > 0 &&
    sizeUsd >
      existingNotional +
        1e-9;

  const roDisablesLong =
    reduceOnly &&
    (
      currentHlPosition
        ?.side === "long" ||
      roTooLarge
    );

  const roDisablesShort =
    reduceOnly &&
    (
      currentHlPosition
        ?.side === "short" ||
      roTooLarge
    );

  const PERP_MIN_USABLE_USD =
    1;

  const noPerpBudget =
    isPerp &&
    showOrderAvailableAmount &&
    Number.isFinite(
      availableUsd
    ) &&
    availableUsd <
      PERP_MIN_USABLE_USD;

  const notEnoughMarginLongEffective =
    (
      notEnoughMargin &&
      !reduceOnlyEligibleLong
    ) ||
    (
      noPerpBudget &&
      !reduceOnlyEligibleLong
    );

  const notEnoughMarginShortEffective =
    (
      notEnoughMargin &&
      !reduceOnlyEligibleShort
    ) ||
    (
      noPerpBudget &&
      !reduceOnlyEligibleShort
    );

  const currentTradeSide:
    "long" | "short" =
    orderSide === "BUY"
      ? "long"
      : "short";

  const reduceOnlyEligible =
    currentTradeSide ===
      "long"
      ? reduceOnlyEligibleLong
      : reduceOnlyEligibleShort;

  const notEnoughMarginEffectiveSide =
    currentTradeSide ===
      "long"
      ? notEnoughMarginLongEffective
      : notEnoughMarginShortEffective;

  const currentRoDisabled =
    currentTradeSide ===
      "long"
      ? roDisablesLong
      : roDisablesShort;

  const reduceOnlyEffective =
    reduceOnly ||
    reduceOnlyEligible;

  const liquidationPrice =
    useMemo(() => {
      if (
        !isPerp ||
        !marginTiers ||
        marginTiers.length === 0 ||
        !Number.isFinite(
          currentPriceNum ?? NaN
        ) ||
        (currentPriceNum ?? 0) <= 0 ||
        !Number.isFinite(sizeUsd) ||
        sizeUsd <= 0
      ) {
        return null;
      }

      const safe =
        (
          value:
            number |
            null |
            undefined
        ) =>
          Number.isFinite(
            value ?? NaN
          )
            ? Number(value)
            : 0;

      /*
       * This matches PRIMARY TradeSimulator:
       *
       * MARKET / STOP_MARKET / TAKE_MARKET:
       *   currentPriceNum = live price
       *
       * LIMIT / STOP_LIMIT / TAKE_LIMIT:
       *   currentPriceNum = entered limit price
       */
      const px =
        currentPriceNum as number;

      const lev =
        Math.max(
          1,
          safe(leverage)
        );

      const orderSizeUnits =
        sizeUsd / px;

      if (
        !Number.isFinite(
          orderSizeUnits
        ) ||
        orderSizeUnits <= 0
      ) {
        return null;
      }

      const existing =
        currentHlPosition;

      const orderSzi =
        (
          currentTradeSide ===
          "long"
            ? 1
            : -1
        ) *
        orderSizeUnits;

      const existingSzi =
        existing
          ? (
              existing.side ===
              "long"
                ? 1
                : -1
            ) *
            safe(
              existing.sizeUnits
            )
          : 0;

      const combinedSzi =
        existingSzi +
        orderSzi;

      const combinedAbsSzi =
        Math.abs(
          combinedSzi
        );

      if (
        combinedAbsSzi <= 0
      ) {
        return null;
      }

      const combinedSide:
        "long" | "short" =
        combinedSzi >= 0
          ? "long"
          : "short";

      /*
       * PRIMARY combined-entry rules:
       *
       * new position      -> order price
       * same side add     -> weighted average
       * partial reduction -> existing entry
       * exact close       -> no remaining position
       * side flip         -> new order price
       */
      let combinedEntryPx =
        px;

      if (
        existingSzi === 0
      ) {
        combinedEntryPx =
          px;
      } else if (
        orderSzi === 0
      ) {
        combinedEntryPx =
          safe(
            existing?.entryPx
          );
      } else if (
        Math.sign(
          existingSzi
        ) ===
        Math.sign(
          orderSzi
        )
      ) {
        combinedEntryPx =
          (
            Math.abs(
              existingSzi
            ) *
              safe(
                existing?.entryPx
              ) +
            Math.abs(
              orderSzi
            ) *
              px
          ) /
          Math.max(
            1e-9,
            combinedAbsSzi
          );
      } else if (
        Math.abs(
          orderSzi
        ) <
        Math.abs(
          existingSzi
        )
      ) {
        combinedEntryPx =
          safe(
            existing?.entryPx
          );
      } else if (
        Math.abs(
          orderSzi
        ) >
        Math.abs(
          existingSzi
        )
      ) {
        combinedEntryPx =
          px;
      }

      /*
       * PRIMARY computes effective isolated leverage after combining
       * the current position with the hypothetical order.
       */
      const existingNotional =
        Math.abs(
          existingSzi
        ) *
        safe(
          existing?.entryPx
        );

      const existingLev =
        Math.max(
          1,
          safe(
            existing?.leverage ??
            lev
          )
        );

      const existingMargin =
        Number.isFinite(
          existing
            ?.marginUsedUsd ??
          NaN
        ) &&
        (
          existing
            ?.marginUsedUsd ??
          0
        ) > 0
          ? safe(
              existing
                ?.marginUsedUsd
            )
          : existingNotional /
            existingLev;

      const orderNotional =
        Math.abs(
          orderSzi
        ) *
        px;

      let totalInitialMargin =
        0;

      if (
        existingSzi === 0
      ) {
        totalInitialMargin =
          orderNotional /
          lev;
      } else if (
        Math.sign(
          existingSzi
        ) ===
        Math.sign(
          orderSzi
        )
      ) {
        totalInitialMargin =
          existingMargin +
          orderNotional /
            lev;
      } else if (
        Math.abs(
          orderSzi
        ) <
        Math.abs(
          existingSzi
        )
      ) {
        const remainingRatio =
          (
            Math.abs(
              existingSzi
            ) -
            Math.abs(
              orderSzi
            )
          ) /
          Math.max(
            1e-9,
            Math.abs(
              existingSzi
            )
          );

        totalInitialMargin =
          existingMargin *
          remainingRatio;
      } else if (
        Math.abs(
          orderSzi
        ) ===
        Math.abs(
          existingSzi
        )
      ) {
        totalInitialMargin =
          0;
      } else {
        const remainingUnits =
          Math.abs(
            orderSzi
          ) -
          Math.abs(
            existingSzi
          );

        totalInitialMargin =
          (
            remainingUnits *
            px
          ) /
          lev;
      }

      const combinedNotional =
        combinedAbsSzi *
        combinedEntryPx;

      const effectiveLev =
        totalInitialMargin > 0
          ? Math.max(
              1,
              combinedNotional /
                totalInitialMargin
            )
          : lev;

      const schedule =
        buildMaintenanceSchedule(
          marginTiers
        );

      if (
        schedule.length === 0
      ) {
        return null;
      }

      /*
       * PRIMARY cross-anchor behavior.
       *
       * Existing real CROSS liquidationPx is used as the
       * authoritative same-asset pool anchor.
       */
      const existingCrossAnchor =
        existing &&
        existing.marginType ===
          "cross" &&
        Number.isFinite(
          existing.sizeUnits
        ) &&
        existing.sizeUnits > 0
          ? {
              side:
                existing.side,

              sizeUnits:
                existing
                  .sizeUnits,

              liquidationPx:
                Number.isFinite(
                  existing
                    .liquidationPx ??
                  NaN
                )
                  ? (
                      existing
                        .liquidationPx as number
                    )
                  : 0,

              markPx:
                Number.isFinite(
                  existing.markPx ??
                  NaN
                )
                  ? existing.markPx
                  : undefined,
            }
          : undefined;

      /*
       * PRIMARY pool rules:
       *
       * unifiedAccount / portfolioMargin:
       *   equity =
       *     spotUSDC
       *     - total isolated margin
       *
       *   maintenance =
       *     total cross maintenance
       *
       * Standard/default:
       *   use the selected dex's authoritative
       *   cross account value + maintenance.
       */
      const effectiveCrossEquity =
        isHlPooledAccount
          ? Math.max(
              0,
              safe(
                spotUsdcBalanceUsd
              ) -
                safe(
                  totalIsolatedMarginUsedUsd
                )
            )
          : Math.max(
              0,
              safe(
                perpCrossAccountValueByDex?.[
                  perpDexKey
                ]
              )
            );

      const effectiveCrossMaintUsed =
        isHlPooledAccount
          ? Math.max(
              0,
              safe(
                totalCrossMaintenanceMarginUsedUsd
              )
            )
          : Math.max(
              0,
              safe(
                perpCrossMaintenanceMarginUsedByDex?.[
                  perpDexKey
                ]
              )
            );

      const hasCrossEquity =
        effectiveCrossEquity >
        0;

      const hasPoolMaint =
        (
          isHlPooledAccount
            ? Number.isFinite(
                totalCrossMaintenanceMarginUsedUsd ??
                NaN
              )
            : (
                Number.isFinite(
                  perpCrossMaintenanceMarginUsedByDex?.[
                    perpDexKey
                  ] ??
                  NaN
                ) &&
                (
                  perpCrossMaintenanceMarginUsedByDex?.[
                    perpDexKey
                  ] ??
                  -1
                ) >= 0
              )
        ) &&
        hasCrossEquity;

      const liq =
        marginMode ===
        "CROSS"
          ? (
              existingCrossAnchor ||
              hasCrossEquity
            )
            ? estimateLiqPriceCross({
                markPx:
                  px,

                side:
                  combinedSide,

                sizeUnits:
                  combinedAbsSzi,

                existing:
                  existingCrossAnchor,

                accountValueUsd:
                  effectiveCrossEquity,

                crossMaintenanceMarginUsedUsd:
                  hasPoolMaint
                    ? effectiveCrossMaintUsed
                    : undefined,

                schedule,
              })
            : null
          : estimateLiqPriceIsolated({
              entryPx:
                combinedEntryPx,

              side:
                combinedSide,

              sizeUnits:
                combinedAbsSzi,

              leverage:
                effectiveLev,

              schedule,
            });

      return liq === null
        ? null
        : Math.max(
            0,
            liq
          );
    }, [
      isPerp,
      marginTiers,
      currentPriceNum,
      sizeUsd,
      leverage,
      currentTradeSide,
      currentHlPosition,
      marginMode,
      isHlPooledAccount,
      spotUsdcBalanceUsd,
      totalIsolatedMarginUsedUsd,
      totalCrossMaintenanceMarginUsedUsd,
      perpCrossAccountValueByDex,
      perpCrossMaintenanceMarginUsedByDex,
      perpDexKey,
    ]);

  const isAdvancedOrderType = orderType === "STOP_LIMIT" || orderType === "STOP_MARKET" || orderType === "TAKE_LIMIT" || orderType === "TAKE_MARKET";

  // --- Percentage slider trigger ---
  const handlePercentagePreset = (pct: number) => {
    setSelectedPercentage(pct);
    if (pct === 0) {
      setSizeInput("");
      return;
    }
    
    if (!isPerp) {
      if (orderSide === "BUY") {
        const usdcToSpend =
          spotBuyMaxUsableUsd *
          (pct / 100);
        if (sizeUnit === "USDC") {
          setSizeInput(usdcToSpend > 0 ? usdcToSpend.toFixed(2) : "");
        } else {
          if (currentPriceNum !== null && currentPriceNum > 0) {
            const sizeInUnits = usdcToSpend / currentPriceNum;
            const minLot = Math.pow(10, -sizeDecimals);
            const truncated = sizeDecimals > 0 ? Math.floor(sizeInUnits / minLot) * minLot : Math.floor(sizeInUnits);
            setSizeInput(truncated > 0 ? formatBaseSize(truncated) : "");
          }
        }
      } else {
        const tokensToSell = spotAvailableBase * (pct / 100);
        if (sizeUnit === "USDC") {
          if (currentPriceNum !== null && currentPriceNum > 0) {
            const notional = tokensToSell * currentPriceNum;
            setSizeInput(notional > 0 ? notional.toFixed(2) : "");
          }
        } else {
          const minLot = Math.pow(10, -sizeDecimals);
          const truncated = sizeDecimals > 0 ? Math.floor(tokensToSell / minLot) * minLot : Math.floor(tokensToSell);
          setSizeInput(truncated > 0 ? formatBaseSize(truncated) : "");
        }
      }
    } else {
      if (
        !showOrderAvailableAmount
      ) {
        return;
      }

      const basis =
        maxUsableMarginUsd *
        (pct / 100);

      const nextSizeUsd =
        basis *
        Math.max(
          1,
          leverage
        );

      if (
        sizeUnit === "USDC"
      ) {
        setSizeInput(
          nextSizeUsd > 0
            ? nextSizeUsd.toFixed(2)
            : ""
        );
      } else if (
        currentPriceNum !== null &&
        currentPriceNum > 0
      ) {
        const baseVal = nextSizeUsd / currentPriceNum;
        setSizeInput(
          baseVal > 0
            ? formatBaseSize(baseVal)
            : ""
        );
      }
    }
  };

  // --- Toggle Trade Size Unit (USDC <-> Base coin) with number conversion ---
  const handleToggleSizeUnit = () => {
    const nextUnit =
      sizeUnit === "USDC"
        ? sizeBaseUnit
        : "USDC";

    const currentVal = Number(sizeInput);

    if (sizeInput && Number.isFinite(currentVal) && currentVal > 0) {
      if (
        currentPriceNum === null ||
        !Number.isFinite(currentPriceNum) ||
        currentPriceNum <= 0
      ) {
        return;
      }

      if (sizeUnit === "USDC") {
        // Converting from USDC to base coin
        const baseValue = currentVal / currentPriceNum;
        setSizeInput(formatBaseSize(baseValue));
        setSizeUnit(sizeBaseUnit);
      } else {
        // Converting from base coin to USDC
        const usdcValue = currentVal * currentPriceNum;
        setSizeInput(usdcValue.toFixed(2));
        setSizeUnit("USDC");
      }
    } else {
      setSizeUnit(nextUnit);
    }
    setSelectedPercentage(0);
  };

  // --- Percentage size calculate eligibility guard ---
  const canCalculatePercentageSize = useMemo(() => {
    if (!walletAddress) return false;
    if (!isPerp) {
      if (orderSide === "BUY") {
        return spotBuyMaxUsableUsd > 0 && (sizeUnit === "USDC" || (currentPriceNum !== null && currentPriceNum > 0));
      } else {
        return spotAvailableBase > 0 && (sizeUnit !== "USDC" || (currentPriceNum !== null && currentPriceNum > 0));
      }
    } else {
      if (!showOrderAvailableAmount || maxUsableMarginUsd <= 0) return false;
      if (sizeUnit !== "USDC" && (!currentPriceNum || currentPriceNum <= 0)) return false;
      return true;
    }
  }, [
    walletAddress,
    isPerp,
    orderSide,
    spotBuyMaxUsableUsd,
    spotAvailableBase,
    sizeUnit,
    currentPriceNum,
    showOrderAvailableAmount,
    maxUsableMarginUsd,
  ]);

  // --- Order Book row click sets price ---
  const handleOrderBookRowClick = (price: number) => {
    setPriceInput(price.toString());
  };

  // --- Submit Order Execution ---
  const handleSubmitOrder = async (
    e?: React.FormEvent,
    confirmationApproved = false
  ) => {
    e?.preventDefault();

    setPlaceStatus({
      type: null,
      message: "",
    });

    if (!walletAddress) {
      onConnectWallet();
      return;
    }

    if (!setupComplete) {
      setPlaceStatus({
        type: "error",
        message: "Trading is not enabled. Complete wallet trading setup to continue.",
      });
      onSetupRequired();
      return;
    }

    if (!isPerp) {
      const isSupportedSpotOrder =
        !isPerp &&
        !!spotAssetData?.spotSymbol &&
        (
          orderType === "MARKET" ||
          (
            orderType === "LIMIT" &&
            tif === "GTC"
          )
        );

      if (!isSupportedSpotOrder) {
        return;
      }

      if (
        orderSubmitGuardRef.current ||
        isPlacingOrder
      ) {
        return;
      }

      if (!spotBalancesHydrated) {
        return;
      }

      if (!spotAssetData?.spotSymbol) {
        setPlaceStatus({
          type: "error",
          message: "Spot asset unavailable for trading",
        });
        return;
      }

      const submittedLimitPx =
        orderType === "LIMIT"
          ? Number(priceInput)
          : undefined;

      if (
        orderType === "LIMIT" &&
        (
          !Number.isFinite(
            submittedLimitPx
          ) ||
          (
            submittedLimitPx ??
            0
          ) <= 0
        )
      ) {
        setPlaceStatus({
          type: "error",
          message:
            "Enter a limit price",
        });
        return;
      }

      if (
        orderType === "MARKET" &&
        (
          !Number.isFinite(
            realCurrentPrice
          ) ||
          (
            realCurrentPrice ??
            0
          ) <= 0
        )
      ) {
        setPlaceStatus({
          type: "error",
          message:
            "Market price unavailable. Please try a limit order.",
        });
        return;
      }

      const rawEnteredSize =
        Number(sizeInput);

      if (
        !Number.isFinite(
          rawEnteredSize
        ) ||
        rawEnteredSize <= 0
      ) {
        setPlaceStatus({
          type: "error",
          message:
            "Enter a valid order size",
        });
        return;
      }

      const effectivePrice =
        orderType === "LIMIT"
          ? (submittedLimitPx as number)
          : (realCurrentPrice as number);

      if (!effectivePrice || effectivePrice <= 0) {
        setPlaceStatus({
          type: "error",
          message:
            "Invalid price for order calculation",
        });
        return;
      }

      let calculatedSizeUnits: number;
      let calculatedSizeUsd: number;

      if (sizeUnit === "USDC") {
        calculatedSizeUsd =
          rawEnteredSize;
        calculatedSizeUnits =
          rawEnteredSize /
          effectivePrice;
      } else {
        calculatedSizeUnits =
          rawEnteredSize;
        calculatedSizeUsd =
          rawEnteredSize *
          effectivePrice;
      }

      const spotMinSizeUnits =
        Math.pow(
          10,
          -spotSzDecimals
        );

      const spotSizePow =
        Math.pow(
          10,
          spotSzDecimals
        );

      const spotSizeUnitsRounded =
        spotSizePow > 0
          ? Math.floor(
              calculatedSizeUnits *
              spotSizePow
            ) /
            spotSizePow
          : 0;

      const spotSlippageBps = effectiveSlippageBps;

      const spotPxForCheck =
        orderType === "LIMIT"
          ? (submittedLimitPx as number)
          : effectivePrice *
            (
              orderSide === "BUY"
                ? 1 +
                  spotSlippageBps /
                    10000
                : 1 -
                  spotSlippageBps /
                    10000
            );

      const spotNotionalRounded =
        spotSizeUnitsRounded *
        spotPxForCheck;

      const spotMinUsdRequired =
        spotMinSizeUnits > 0 &&
        spotPxForCheck > 0
          ? Math.ceil(
              10 /
              spotPxForCheck /
              spotMinSizeUnits
            ) *
            spotMinSizeUnits *
            spotPxForCheck
          : 10;

      if (
        spotSizeUnitsRounded <
          spotMinSizeUnits ||
        spotNotionalRounded +
          1e-9 <
          spotMinUsdRequired
      ) {
        setPlaceStatus({
          type: "error",
          message:
            "Order must have minimum value of $10.",
        });
        return;
      }

      const spotOrderEstFeeUsd =
        calculatedSizeUsd > 0
          ? calculatedSizeUsd *
            totalFeeRate
          : 0;

      if (orderSide === "BUY") {
        if (
          calculatedSizeUsd +
            spotOrderEstFeeUsd >
          spotBuyAvailableUsd +
            1e-9
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "Margin insufficient",
          });
          return;
        }
      } else {
        const spotSellBaseTolerance =
          Math.max(
            spotMinSizeUnits,
            1e-9
          );

        if (
          spotSizeUnitsRounded >
          spotAvailableBase +
            spotSellBaseTolerance
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "Not enough spot balance to sell",
          });
          return;
        }
      }

      // Immediately show the same top-right toast while the real order
      // is being sent. The displayed quantity/notional are requested values,
      // never a fabricated execution fill.
      const spotDisplayQty = orderSide === "SELL"
        ? Math.min(spotSizeUnitsRounded, spotAvailableBase)
        : spotSizeUnitsRounded;
      const spotOrderSummary =
        `Quantity: ~${spotDisplayQty.toLocaleString("en-US", { maximumFractionDigits: 10 })} ${symbol}\nValue: ${calculatedSizeUsd.toFixed(2)} USDC`;

      try {
        orderSubmitGuardRef.current =
          true;
        setIsPlacingOrder(true);
        setPlaceStatus({
          type: "pending",
          title: `${symbol} Spot ${orderSide === "BUY" ? "Buy" : "Sell"} Order — Submitting...`,
          message: spotOrderSummary,
        });

        const {
          agentPrivateKey,
          agentAddress,
        } =
          await ensureAgentKey();

        if (
          !agentPrivateKey ||
          !agentAddress
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "Agent key not ready",
          });
          return;
        }

        const result =
          await placeSpotOrder({
            agentPrivateKey:
              agentPrivateKey as
                `0x${string}`,

            symbol:
              spotAssetData.spotSymbol,

            side:
              orderSide === "BUY"
                ? "buy"
                : "sell",

            orderType:
              orderType === "LIMIT"
                ? "limit"
                : "market",

            sizeUsd:
              calculatedSizeUsd,

            sizeUnits:
              orderSide === "SELL"
                ? Math.min(
                    spotSizeUnitsRounded,
                    spotAvailableBase
                  )
                : undefined,

            referencePx:
              realCurrentPrice ??
              undefined,

            limitPx:
              orderType === "LIMIT"
                ? submittedLimitPx
                : undefined,

            slippageBps:
              effectiveSlippageBps,
          });

        const acceptanceError =
          getPerpOrderAcceptanceError(
            result
          );

        if (acceptanceError) {
          setPlaceStatus({
            type: "error",
            message:
              acceptanceError,
          });
          return;
        }

        setPlaceStatus({
          type: "success",
          title: `${symbol} Spot ${orderSide === "BUY" ? "Buy" : "Sell"} Order Submitted`,
          message: spotOrderSummary,
        });

        setSizeInput("");
        setPriceInput("");
        setSelectedPercentage(0);

        // Confirmation already came from the exchange. Refresh balances,
        // open orders and fills in the background; do not hold the submit
        // button on "Submitting..." while read-only queries are loading.
        // A refresh failure must not turn an accepted order into a fake failure.
        void Promise.resolve()
          .then(() => onSpotOrderSuccess ? onSpotOrderSuccess() : onOrderSuccess?.())
          .catch(() => { /* periodic data refresh can recover */ });
      } catch (err: any) {
        setPlaceStatus({
          type: "error",
          message:
            err?.message
              ? String(
                  err.message
                )
              : "Spot order failed",
        });
      } finally {
        setIsPlacingOrder(false);
        orderSubmitGuardRef.current =
          false;
      }

      return;
    }

    const isSupportedPerpOrder =
      isPerp &&
      (
        orderType === "MARKET" ||
        (
          orderType === "LIMIT" &&
          tif === "GTC"
        ) ||
        orderType ===
          "STOP_MARKET" ||
        orderType ===
          "STOP_LIMIT" ||
        orderType ===
          "TAKE_MARKET" ||
        orderType ===
          "TAKE_LIMIT"
      );

    if (!isSupportedPerpOrder) {
      return;
    }

    if (
      orderSubmitGuardRef.current ||
      isPlacingOrder
    ) {
      return;
    }

    const submittedLimitPx =
      (
        orderType === "LIMIT" ||
        orderType ===
          "STOP_LIMIT" ||
        orderType ===
          "TAKE_LIMIT"
      )
        ? Number(priceInput)
        : undefined;

    const submittedTriggerPx =
      isStopOrder
        ? Number(
            stopTriggerPrice
          )
        : isTakeOrder
        ? Number(
            takeTriggerPrice
          )
        : undefined;

    if (
      (
        orderType === "LIMIT" ||
        isLimitStyleTrigger
      ) &&
      (
        !Number.isFinite(
          submittedLimitPx
        ) ||
        (
          submittedLimitPx ??
          0
        ) <= 0
      )
    ) {
      setPlaceStatus({
        type: "error",
        message:
          "Enter a limit price",
      });

      return;
    }

    if (
      isTriggerOrder &&
      (
        !Number.isFinite(
          submittedTriggerPx
        ) ||
        (
          submittedTriggerPx ??
          0
        ) <= 0
      )
    ) {
      setPlaceStatus({
        type: "error",
        message:
          "Enter a stop price",
      });

      return;
    }

    if (
      isTriggerOrder &&
      Number.isFinite(
        realCurrentPrice
      ) &&
      (
        realCurrentPrice ??
        0
      ) > 0
    ) {
      const triggerPx =
        submittedTriggerPx as number;

      const referencePx =
        realCurrentPrice as number;

      if (isStopOrder) {
        if (
          orderSide === "BUY" &&
          triggerPx <=
            referencePx
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "For long stop orders, trigger must be above current price.",
          });

          return;
        }

        if (
          orderSide === "SELL" &&
          triggerPx >=
            referencePx
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "For short stop orders, trigger must be below current price.",
          });

          return;
        }
      }

      if (isTakeOrder) {
        if (
          orderSide === "BUY" &&
          triggerPx >=
            referencePx
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "For long take orders, trigger must be below current price.",
          });

          return;
        }

        if (
          orderSide === "SELL" &&
          triggerPx <=
            referencePx
        ) {
          setPlaceStatus({
            type: "error",
            message:
              "For short take orders, trigger must be above current price.",
          });

          return;
        }
      }
    }

    if (
      reduceOnly &&
      roTooLarge
    ) {
      setPlaceStatus({
        type: "error",
        message:
          "Reduce Only Too Large",
      });

      return;
    }

    if (
      reduceOnly &&
      currentHlPosition &&
      currentTradeSide ===
        currentHlPosition.side
    ) {
      return;
    }

    if (
      notEnoughMarginEffectiveSide
    ) {
      setPlaceStatus({
        type: "error",
        message:
          "Margin insufficient",
      });

      return;
    }

    const submittedTpPx =
      Number(
        tpPriceInput
      );

    const submittedSlPx =
      Number(
        slPriceInput
      );

    const hasAttachedTp =
      isAttachedTpSlParentOrder &&
      isTpSlEnabled &&
      Number.isFinite(
        submittedTpPx
      ) &&
      submittedTpPx > 0;

    const hasAttachedSl =
      isAttachedTpSlParentOrder &&
      isTpSlEnabled &&
      Number.isFinite(
        submittedSlPx
      ) &&
      submittedSlPx > 0;

    const attachedTpSlEntryPx =
      orderType === "LIMIT" &&
      Number.isFinite(
        submittedLimitPx
      ) &&
      (
        submittedLimitPx ??
        0
      ) > 0
        ? submittedLimitPx as number
        : (
            realCurrentPrice ??
            0
          );

    // The Perp form can be entered in USDC or coin units. Use the
    // submitted form's reference price for an indicative coin quantity;
    // actual fills may differ and are never claimed before confirmation.
    const perpReferencePrice = currentPriceNum ?? 0;
    const perpDisplayQty = sizeUnit === "USDC"
      ? (perpReferencePrice > 0 ? sizeUsd / perpReferencePrice : 0)
      : Number(sizeInput);
    const perpOrderSummary =
      `Quantity: ${Number.isFinite(perpDisplayQty) && perpDisplayQty > 0
        ? `~${perpDisplayQty.toLocaleString("en-US", { maximumFractionDigits: 10 })}`
        : "—"} ${symbol}\nValue: ${sizeUsd.toFixed(2)} USDC`;

    try {
      orderSubmitGuardRef.current =
        true;

      setIsPlacingOrder(true);
      setPlaceStatus({
        type: "pending",
        title: `${symbol} Perpetual ${orderSide === "BUY" ? "Buy" : "Sell"} Order — Submitting...`,
        message: perpOrderSummary,
      });

      const {
        agentPrivateKey,
        agentAddress,
      } =
        await ensureAgentKey();

      if (
        !agentPrivateKey ||
        !agentAddress
      ) {
        setPlaceStatus({
          type: "error",
          message:
            "Agent key not ready",
        });
        return;
      }

      const isHip3 =
        perpOrderCoin.includes(":");

      const getFreshProvider =
        async () =>
          await getUserWalletProvider()
            .catch(() => undefined);

      const hyperliquidOrderType:
        | "market"
        | "limit"
        | "stop_market"
        | "stop_limit"
        | "take_market"
        | "take_limit" =
        orderType === "MARKET"
          ? "market"
          : orderType === "LIMIT"
          ? "limit"
          : orderType ===
            "STOP_MARKET"
          ? "stop_market"
          : orderType ===
            "STOP_LIMIT"
          ? "stop_limit"
          : orderType ===
            "TAKE_MARKET"
          ? "take_market"
          : "take_limit";

      const submitPerpOrder = (
        provider:
          Eip1193Provider |
          undefined
      ) =>
        placeOrder({
          agentPrivateKey:
            agentPrivateKey as
              `0x${string}`,

          symbol:
            perpOrderCoin,

          side:
            orderSide === "BUY"
              ? "long"
              : "short",

          orderType:
            hyperliquidOrderType,

          sizeUsd,

          oraclePx:
            realCurrentPrice ?? 0,

          referencePx:
            realCurrentPrice ??
            undefined,

          limitPx:
            (
              orderType === "LIMIT" ||
              isLimitStyleTrigger
            )
              ? submittedLimitPx
              : undefined,

          triggerPx:
            isTriggerOrder
              ? submittedTriggerPx
              : undefined,

          reduceOnly:
            reduceOnlyEffective,

          leverage,

          isCross:
            marginMode === "CROSS",

          marginSupport:
            marginSupport ??
            undefined,

          userWalletProvider:
            provider,

          userAddress:
            tradingAddress ??
            undefined,

          targetDexMarginAvailableUsd,

          perpWithdrawableByDex,

          unifiedSpotPoolFreeUsd:
            isHlPooledAccount
              ? unifiedSpotTransferableUsd
              : undefined,

          accountAbstractionMode:
            accountAbstractionMode ??
            null,

          slippageBps:
            effectiveSlippageBps,

          mainDexAvailableUsdc,
        });

      const provider =
        await getFreshProvider();

      let result: any;

      try {
        result =
          await submitPerpOrder(
            provider
          );
      } catch (err: any) {
        if (
          !isHip3 ||
          !isWalletTypedDataSigningError(
            err
          )
        ) {
          throw err;
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              350
            )
        );

        const refreshedProvider =
          await getFreshProvider();

        try {
          result =
            await submitPerpOrder(
              refreshedProvider ??
              provider
            );
        } catch (
          retryErr: any
        ) {
          if (
            isWalletTypedDataSigningError(
              retryErr
            )
          ) {
            throw new Error(
              "Wallet signer is reconnecting. Please try again in a moment."
            );
          }

          throw retryErr;
        }
      }

      const acceptanceError =
        getPerpOrderAcceptanceError(
          result
        );

      if (acceptanceError) {
        setPlaceStatus({
          type: "error",
          message:
            acceptanceError,
        });

        return;
      }

      if (isTriggerOrder) {
        setStopTriggerPrice("");
        setTakeTriggerPrice("");
      }

      if (
        isAttachedTpSlParentOrder
      ) {
        setIsTpSlEnabled(false);
        setTpPriceInput("");
        setSlPriceInput("");
        setTpGainInput("");
        setSlLossInput("");
      }

      setPlaceStatus({
        type: "success",
        title: `${symbol} Perpetual ${orderSide === "BUY" ? "Buy" : "Sell"} Order Submitted`,
        message: perpOrderSummary,
      });

      setSizeInput("");
      setPriceInput("");
      setSelectedPercentage(0);

      if (hasAttachedTp || hasAttachedSl) {
        try {
          if (hasAttachedTp) {
            await placeReduceOnlyTpslTrigger({
              agentPrivateKey:
                agentPrivateKey as
                  `0x${string}`,

              symbol:
                perpOrderCoin,

              entrySide:
                orderSide === "BUY"
                  ? "long"
                  : "short",

              sizeUsd,

              oraclePx:
                attachedTpSlEntryPx,

              triggerPx:
                submittedTpPx,

              tpsl:
                "tp",
            });
          }

          if (hasAttachedSl) {
            await placeReduceOnlyTpslTrigger({
              agentPrivateKey:
                agentPrivateKey as
                  `0x${string}`,

              symbol:
                perpOrderCoin,

              entrySide:
                orderSide === "BUY"
                  ? "long"
                  : "short",

              sizeUsd,

              oraclePx:
                attachedTpSlEntryPx,

              triggerPx:
                submittedSlPx,

              tpsl:
                "sl",
            });
          }
        } catch (e: any) {
          setPlaceStatus({
            type: "error",
            message:
              e?.message
                ? String(
                    e.message
                  )
                : "Failed to set TP/SL",
          });
        }
      }

      // Order is accepted. Read-only account refresh must not keep
      // the submit button busy or make an accepted order look rejected.
      void Promise.resolve()
        .then(() => onOrderSuccess())
        .catch(() => { /* periodic data refresh can recover */ });
    } catch (err: any) {
      setPlaceStatus({
        type: "error",
        message:
          err?.message
            ? String(
                err.message
              )
            : "Order failed",
      });
    } finally {
      setIsPlacingOrder(false);

      orderSubmitGuardRef.current =
        false;
    }
  };

  // --- Positions Sort and Filters ---
  const filteredPositions = positions;
  const filteredOrders = openOrders;

  // Sorted positions using useMemo
  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      if (sortBy === "SYMBOL") {
        return a.symbol.localeCompare(b.symbol);
      } else if (sortBy === "SIZE") {
        return b.size - a.size;
      } else if (sortBy === "PNL") {
        return b.unrealizedPnl - a.unrealizedPnl;
      }
      return 0;
    });
  }, [filteredPositions, sortBy]);

  // Dynamically compute balances and allocations
  const dynamicBalances = useMemo(() => {
    const list = [];
    let totalValue = balanceUSDC;

    // First item is USDC
    list.push({
      symbol: "USDC",
      name: "USD Coin",
      balance: balanceUSDC,
      price: 1,
      valueUSD: balanceUSDC,
      color: "bg-cyan-400"
    });

    // Other registry tokens
    const seenSymbols = new Set<string>(["USDC"]);
    tokens.forEach(tok => {
      if (seenSymbols.has(tok.symbol)) return;
      seenSymbols.add(tok.symbol);

      // Exclude perpetual contract assets from Balances (Spot only)
      const isPerp = tok.openInterest !== undefined || tok.category === "perps" || tok.name.toLowerCase().includes("perpetual") || tok.name.toLowerCase().includes("perp");
      if (isPerp) return;

      const bal = tokenBalances?.[tok.symbol] || 0;
      if (bal <= 0) return;

      const isRealTokPrice = typeof tok.price === "number" && Number.isFinite(tok.price);
      const tokPrice = isRealTokPrice ? tok.price : null;
      const valUSD = isRealTokPrice ? bal * tok.price : null;
      if (valUSD !== null) {
        totalValue += valUSD;
      }
      
      let color = "bg-gradient-to-tr from-cyan-500 to-indigo-600";
      if (tok.symbol === "BTC") color = "bg-[#f7931a]";
      else if (tok.symbol === "ETH") color = "bg-[#627eea]";
      else if (tok.symbol === "SOL") color = "bg-[#9945ff]";
      else if (tok.symbol === "PURR") color = "bg-[#14f195]";
      else if (tok.symbol === "ARB") color = "bg-[#1e80ea]";

      list.push({
        symbol: tok.symbol,
        name: tok.name,
        balance: bal,
        price: tokPrice,
        valueUSD: valUSD,
        color
      });
    });

    return {
      items: list,
      totalValue
    };
  }, [balanceUSDC, tokenBalances, tokens]);

  // Volume Formatter
  const formatVolume = (vol: number) => {
    if (vol >= 1000000000) return `$${(vol / 1000000000).toFixed(1)}B`;
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const orderBookBaseLabel =
    String(
      symbol || "COIN"
    )
      .split("/")[0]
      .split("-")[0]
      .toUpperCase();

  const mobileTradeMarketLeverage =
    getPerpLeverageFormatted(
      currentToken?.symbol ||
        symbol ||
        "",
      currentToken?.maxLeverage
    );

  const formatTerminalOrderBookSize = (
    price: number,
    size: number
  ): string => {
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(size) ||
      size < 0
    ) {
      return "--";
    }

    if (
      orderBookSizeUnit ===
      "USD"
    ) {
      const usd =
        price * size;

      if (
        usd >= 1_000_000
      ) {
        return `$${(
          usd /
          1_000_000
        ).toFixed(2)}M`;
      }

      if (
        usd >= 1_000
      ) {
        return `$${(
          usd /
          1_000
        ).toFixed(1)}K`;
      }

      return `$${usd.toLocaleString(
        undefined,
        {
          minimumFractionDigits:
            usd >= 100
              ? 0
              : 2,

          maximumFractionDigits:
            2,
        }
      )}`;
    }

    return size.toLocaleString(
      undefined,
      {
        minimumFractionDigits:
          0,

        maximumFractionDigits:
          6,
      }
    );
  };

  return (
    <div className="flex flex-col w-full text-brand-text font-sans selection:bg-cyan-500/30 select-none pb-2.5" id="unified-trading-terminal">
      
      {/* Shared original HideDex trading toast, same markup for both venues. */}
      {placeStatus.type && <HideDexTradingToast
        type={placeStatus.type}
        title={placeStatus.title}
        message={placeStatus.message}
        onClose={()=>{
          if(placeStatusTimeoutRef.current){
            clearTimeout(placeStatusTimeoutRef.current);
            placeStatusTimeoutRef.current=null;
          }
          setPlaceStatus({type:null,title:"",message:""});
        }}
      />}

      <HideDexMobileMarketHeader
        logo={renderAssetLogo(symbol,currentToken?.displayBaseAsset,currentToken?.sourceCoin)}
        ticker={headerTicker}
        modeLabel={isPerp ? mobileTradeMarketLeverage + " Perp" : "Spot"}
        priceLabel={typeof realCurrentPrice === "number" && Number.isFinite(realCurrentPrice) && realCurrentPrice>0
          ? realCurrentPrice.toLocaleString(undefined,{minimumFractionDigits:symbol==="PURR"?4:2}) : "--"}
        change24h={effectiveChange24h}
        onSelectMarket={() => setShowTokenDropdown(v=>!v)}
        mode={isPerp?"perp":"spot"}
        switchMode={isSpotOnly?"spot-only":canToggleSpot?"toggle":"perp-only"}
        onSwitchMode={() => setIsPerp(!isPerp)}
      />

      {/* 1. TOP INTERACTIVE HEADER SECTION: ONE unified compact upper market panel */}
      <div className="hidden md:block relative glass-panel rounded-xl border border-brand-border bg-brand-surface py-1.5 px-2 sm:px-2.5 select-none shadow-sm mb-1.5 md:mb-2" id="terminal-unified-market-header">
        
        <HideDexDesktopMarketBar
          logo={renderAssetLogo(symbol,currentToken?.displayBaseAsset,currentToken?.sourceCoin)}
          ticker={headerTicker}
          sublabel={isPerp ? leverage + "x Perpetual" : "Spot Asset"}
          onMarket={()=>setShowTokenDropdown(v=>!v)}
          view={topViewMode==="orderbook"?"orderbook":"chart"}
          onView={setTopViewMode}
          marketInfoOpen={isMarketInfoOpen}
          onMarketInfo={()=>setIsMarketInfoOpen(v=>!v)}
        />

        {isMarketInfoOpen && <HideDexMarketInfoDropdown
          ticker={headerTicker}
          mode={isPerp?"perp":"spot"}
          priceLabel={typeof realCurrentPrice==="number"&&Number.isFinite(realCurrentPrice)&&realCurrentPrice>0
            ? "$"+realCurrentPrice.toLocaleString(undefined,{minimumFractionDigits:symbol==="PURR"?4:2}) : "—"}
          change24h={effectiveChange24h}
          fundingRate={isPerp?effectiveFundingRate:null}
          openInterestUsd={isPerp?effectiveOpenInterest:null}
          onSwitch={canToggleSpot?()=>setIsPerp(!isPerp):undefined}
          badge={isSpotOnly?<span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[9px] font-bold uppercase">SPOT</span>:undefined}
        />}

        {/* Below ROW 1: thin divider and ROW 2 host for chart toolbar */}
        {topViewMode === "chart" && (
          <>
            <div className="w-full h-px bg-brand-border/60 my-1 sm:my-1.5" />
            <div id="market-chart-toolbar-host" className="w-full min-w-0 flex items-center min-h-[28px] border-b border-brand-border/40" />
          </>
        )}
      </div>

      {/* SHARED TRADE MARKET SELECTOR — MOBILE + DESKTOP */}
      {showTokenDropdown && (
        <MarketSelector
          tokens={tokens}
          selectedSymbol={symbol}
          onSelectToken={(sym, mode) => {
            onSelectToken(sym);
            setIsPerp(
              mode === "perp"
            );
          }}
          initialCategory={
            isPerp
              ? "perps"
              : "spot"
          }
          onClose={() =>
            setShowTokenDropdown(
              false
            )
          }
        />
      )}

      {/* 2.5 FEATURED VIEW PANEL AT TOP (Matching laptop/desktop/tablet layout, hidden on mobile) */}
      <HideDexTopMarketPane>
        {topViewMode === "chart" && (
          <TVChart
            symbol={symbol}
            marketCoin={chartCandleCoin}
            isSpot={!isPerp}
            currentPrice={realCurrentPrice}
            high24h={currentToken.high24h}
            low24h={currentToken.low24h}
            volume24h={effectiveVolume24h}
            fundingRate={effectiveFundingRate}
            openInterest={effectiveOpenInterest}
            change24h={effectiveChange24h}
            priceLines={chartPriceLines}
            tradeHistory={tradeHistory}
            toolbarHostId="market-chart-toolbar-host"
          />
        )}

        {topViewMode === "orderbook" && (
          <TopOrderBookView
            symbol={symbol}
            currentToken={{
              ...currentToken,
              price: realCurrentPrice,
            }}
            asks={asks}
            bids={bids}
            onSelectPrice={(p) => setPriceInput(p.toString())}
          />
        )}

        {topViewMode === "trades" && (
          <TopTradesView
            symbol={symbol}
            currentToken={currentToken}
            liveTrades={liveTrades}
          />
        )}
      </HideDexTopMarketPane>

      {/* 3. TWO-COLUMN SPLIT PANEL LAYOUT (Order Form Left | Order Book Right - Side by Side even on Mobile!) */}
      <HideDexTradeGrid>
        
        {/* LEFT COLUMN: COMPACT ORDER PLACEMENT PANEL (7 of 12 cols) */}
        <HideDexOrderForm>
          
          {/* Locked Overlay: Wallet Not Connected */}
          {!walletAddress && (
            <div className="absolute inset-0 bg-brand-bg/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-2 text-center rounded-xl">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-1.5">
                <Wallet className="w-4 h-4 text-indigo-400" />
              </div>
              <h4 className="font-sans font-bold text-brand-text text-[10px] md:text-xs uppercase tracking-wider mb-0.5">{t("not_connected")}</h4>
              <p className="text-[9px] md:text-[10px] text-gray-500 max-w-[180px] leading-snug mb-2.5">
                Connect your wallet to trade.
              </p>
              <button
                type="button"
                onClick={onConnectWallet}
                className="w-full max-w-[130px] py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-brand-text shadow-lg cursor-pointer transition-all active:scale-98"
              >
                Connect
              </button>
            </div>
          )}

          <form onSubmit={handleSubmitOrder} className="flex flex-1 flex-col gap-2 md:gap-3">
            
            {/* The exact same original HideDex selectors are used by both venues. */}
            <HideDexTradeSelectors
              isPerp={isPerp}
              orderType={orderType as TradeOrderType}
              onOrderType={next => setOrderType(next)}
              marginMode={marginMode}
              onMarginMode={next => {
                setMarginMode(next);
                saveMarginTypeForWeb(marginOwner, perpOrderCoin,
                  next === "CROSS" ? "cross" : "isolated", effectiveSupportsCross);
              }}
              disabledMarginModes={[
                ...(!effectiveSupportsCross ? ["CROSS" as const] : []),
                ...(lockedMarginMode ? (["CROSS","ISOLATED"] as const).filter(m => m !== lockedMarginMode) : []),
              ]}
              leverage={leverage}
              maxLeverage={maxLeverage}
              leverageDisabled={isLeverageLocked}
              onLeverage={next => {setLeverage(next); localStorage.setItem(`leverage_${symbol}`, String(next));}}
            />

            <HideDexSideAndAvailability
              isPerp={isPerp}
              side={orderSide}
              onSide={setOrderSide}
              available={isFieldHidden("balance")
                ? `•••• ${availToTradeUnit}`
                : isPerp && !showOrderAvailableAmount ? "--"
                : !isPerp && !spotBalancesHydrated ? "--"
                : `${availToTradeVal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:availToTradeUnit==="USDC"?2:4})} ${availToTradeUnit}`}
            />
                        {/* Conditional input panels based on selected orderType */}
            {(orderType === "LIMIT" || orderType === "MARKET") && (
              <HideDexBasicOrderInputs
                type={orderType}
                price={priceInput}
                onPrice={v => {setPriceInput(v);setSelectedPercentage(0);}}
                midPrice={realCurrentPrice}
                size={sizeInput}
                onSize={v => {setSizeInput(v);setSelectedPercentage(0);}}
                sizeUnit={sizeUnit}
                onToggleUnit={handleToggleSizeUnit}
              />
            )}

            {(orderType === "STOP_LIMIT" || orderType === "TAKE_LIMIT") && (
              <div className="space-y-1.5">
                {/* Trigger Price */}
                <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
                  <span className="text-[9px] md:text-[10px] text-cyan-400 font-bold uppercase tracking-wider w-16 shrink-0 select-none">
                    Trigger Price
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={orderType === "STOP_LIMIT" ? stopTriggerPrice : takeTriggerPrice}
                    onChange={(e) => {
                      if (orderType === "STOP_LIMIT") {
                        setStopTriggerPrice(e.target.value);
                      } else {
                        setTakeTriggerPrice(e.target.value);
                      }
                    }}
                    className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-[#18c29c] min-w-0 text-[11px] md:text-xs"
                    placeholder={typeof realCurrentPrice === "number" && Number.isFinite(realCurrentPrice) && realCurrentPrice > 0 ? realCurrentPrice.toString() : "--"}
                  />
                  <span className="text-[8px] text-cyan-400 font-bold uppercase select-none">USDC</span>
                </div>

                {/* Limit Price */}
                <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
                  <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider w-16 shrink-0 select-none">
                    Limit Price
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={priceInput}
                    onChange={(e) => {
                      setPriceInput(e.target.value);
                      setSelectedPercentage(0);
                    }}
                    className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-brand-text min-w-0 text-[11px] md:text-xs"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof realCurrentPrice === "number" && Number.isFinite(realCurrentPrice) && realCurrentPrice > 0) {
                        setPriceInput(realCurrentPrice.toString());
                      }
                    }}
                    className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[8px] md:text-[9px] font-black uppercase hover:bg-accent/20 transition-colors shrink-0 cursor-pointer"
                  >
                    Mid
                  </button>
                </div>

                {/* Size */}
                <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
                  <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0 select-none">
                    Size ({sizeUnit})
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={sizeInput}
                    onChange={(e) => {
                      setSizeInput(e.target.value);
                      setSelectedPercentage(0);
                    }}
                    className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-brand-text min-w-0 text-[11px] md:text-xs"
                    placeholder="0.00"
                  />
                  <div className="flex items-center select-none shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleSizeUnit}
                      className="text-[8px] md:text-[9px] font-black uppercase bg-brand-overlay-normal hover:bg-brand-overlay-active border border-brand-border px-1.5 py-0.5 rounded text-gray-300 transition-colors cursor-pointer"
                    >
                      {sizeUnit}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(orderType === "STOP_MARKET" || orderType === "TAKE_MARKET") && (
              <div className="space-y-1.5">
                {/* Trigger Price */}
                <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
                  <span className="text-[9px] md:text-[10px] text-cyan-400 font-bold uppercase tracking-wider w-16 shrink-0 select-none">
                    Trigger Price
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={orderType === "STOP_MARKET" ? stopTriggerPrice : takeTriggerPrice}
                    onChange={(e) => {
                      if (orderType === "STOP_MARKET") {
                        setStopTriggerPrice(e.target.value);
                      } else {
                        setTakeTriggerPrice(e.target.value);
                      }
                    }}
                    className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-[#18c29c] min-w-0 text-[11px] md:text-xs"
                    placeholder={typeof realCurrentPrice === "number" && Number.isFinite(realCurrentPrice) && realCurrentPrice > 0 ? realCurrentPrice.toString() : "--"}
                  />
                  <span className="text-[8px] text-cyan-400 font-bold uppercase select-none">USDC</span>
                </div>

                {/* Price Display */}
                <div className="flex items-center bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 opacity-60 gap-1.5 select-none cursor-not-allowed">
                  <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider w-16 shrink-0">
                    Price
                  </span>
                  <span className="text-right flex-grow font-mono font-bold text-gray-400 text-[11px] md:text-xs">
                    Market Price
                  </span>
                </div>

                {/* Size */}
                <div className="flex items-center bg-brand-bg border border-brand-border hover:border-brand-border rounded-lg px-2.5 py-1 md:py-1.5 focus-within:border-cyan-500/50 transition-all gap-1.5">
                  <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0 select-none">
                    Size ({sizeUnit})
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={sizeInput}
                    onChange={(e) => {
                      setSizeInput(e.target.value);
                      setSelectedPercentage(0);
                    }}
                    className="bg-transparent text-right flex-grow font-mono font-bold outline-none text-brand-text min-w-0 text-[11px] md:text-xs"
                    placeholder="0.00"
                  />
                  <div className="flex items-center select-none shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleSizeUnit}
                      className="text-[8px] md:text-[9px] font-black uppercase bg-brand-overlay-normal hover:bg-brand-overlay-active border border-brand-border px-1.5 py-0.5 rounded text-gray-300 transition-colors cursor-pointer"
                    >
                      {sizeUnit}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Equivalent Size Helper */}
            {sizeEquivalentText && (
              <div className="text-right px-1 text-[8px] sm:text-[9px] font-mono text-gray-500 select-none">
                {sizeEquivalentText}
              </div>
            )}

            <HideDexTradePercentPresets
              disabled={!canCalculatePercentageSize}
              selected={selectedPercentage}
              onSelect={handlePercentagePreset}
            />

            {/* Options block (Reduce Only, Take Profit, Stop Loss, TIF) */}
            {isAttachedTpSlParentOrder && (
              <div className="space-y-2 pt-2 px-0.5 border-t border-brand-border/35">
                <div className="flex items-start justify-between gap-2">
                  {/* Reduce Only checkbox */}
                  {roAvailable ? (
                    <div className="flex flex-col gap-1 min-w-0">
                      <HideDexTradeOptionToggle kind="reduce" checked={reduceOnly}
                        onChange={setReduceOnly}/>

                      {roTooLarge && (
                        <span className="text-[9px] text-pnl-loss font-mono font-bold">
                          Reduce Only Too Large
                        </span>
                      )}
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* TIF (Fixed GTC) */}
                  {orderType === "LIMIT" && (
                    <div className="text-[9px] font-bold text-brand-muted uppercase tracking-wider select-none">
                      TIF GTC
                    </div>
                  )}
                </div>

                {/* Premium Take Profit / Stop Loss Section */}
                <div className="border-t border-brand-border/35 pt-2 space-y-2">
                  <HideDexTradeOptionToggle kind="tpsl"
                    checked={isTpSlEnabled} onChange={setIsTpSlEnabled}/>

                  {isTpSlEnabled && (
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Take Profit Target Price */}
                      <div className="relative">
                        <HideDexTradeTriggerPrice kind="tp"

                          value={tpPriceInput}
                          onChange={(e) => {
                            setTpPriceInput(e.target.value);
                            const tpVal = parseFloat(e.target.value);
                            if (!isNaN(tpVal) && basePrice > 0) {
                              if (tpUnit === "%") {
                                const pct = orderSide === "BUY"
                                  ? ((tpVal - basePrice) / basePrice) * 100
                                  : ((basePrice - tpVal) / basePrice) * 100;
                                setTpGainInput(pct.toFixed(2));
                              } else {
                                const diff = orderSide === "BUY"
                                  ? tpVal - basePrice
                                  : basePrice - tpVal;
                                setTpGainInput(diff.toFixed(2));
                              }
                            } else {
                              setTpGainInput("");
                            }
                          }}

                        />
                      </div>

                      {/* Original4 Gain Percentage/Dollar Input with Dropdown */}
                      <HideDexTradeOutcomeInput kind="tp" value={tpGainInput} unit={tpUnit}
                        open={showTpUnitDropdown} onToggle={()=>setShowTpUnitDropdown(v=>!v)}
                        onUnit={unit=>{handleTpUnitChange(unit);setShowTpUnitDropdown(false);}}
                        onChange={value=>{
                          setTpGainInput(value);
                          const gainVal=parseFloat(value);
                          if(!isNaN(gainVal)&&basePrice>0) {
                            const targetPrice=tpUnit==="%"
                              ? (orderSide==="BUY"?basePrice*(1+gainVal/100):basePrice*(1-gainVal/100))
                              : (orderSide==="BUY"?basePrice+gainVal:basePrice-gainVal);
                            setTpPriceInput(targetPrice.toFixed(2));
                          } else setTpPriceInput("");
                        }}/>
                      
                      {/* Stop Loss Target Price */}
                      <div className="relative">
                        <HideDexTradeTriggerPrice kind="sl"

                          value={slPriceInput}
                          onChange={(e) => {
                            setSlPriceInput(e.target.value);
                            const slVal = parseFloat(e.target.value);
                            if (!isNaN(slVal) && basePrice > 0) {
                              if (slUnit === "%") {
                                const pct = orderSide === "BUY"
                                  ? ((basePrice - slVal) / basePrice) * 100
                                  : ((slVal - basePrice) / basePrice) * 100;
                                setSlLossInput(pct.toFixed(2));
                              } else {
                                const diff = orderSide === "BUY"
                                  ? basePrice - slVal
                                  : slVal - basePrice;
                                setSlLossInput(diff.toFixed(2));
                              }
                            } else {
                              setSlLossInput("");
                            }
                          }}

                        />
                      </div>

                      {/* Original4 Loss Percentage/Dollar Input with Dropdown */}
                      <HideDexTradeOutcomeInput kind="sl" value={slLossInput} unit={slUnit}
                        open={showSlUnitDropdown} onToggle={()=>setShowSlUnitDropdown(v=>!v)}
                        onUnit={unit=>{handleSlUnitChange(unit);setShowSlUnitDropdown(false);}}
                        onChange={value=>{
                          setSlLossInput(value);
                          const lossVal=parseFloat(value);
                          if(!isNaN(lossVal)&&basePrice>0) {
                            const targetPrice=slUnit==="%"
                              ? (orderSide==="BUY"?basePrice*(1-lossVal/100):basePrice*(1+lossVal/100))
                              : (orderSide==="BUY"?basePrice-lossVal:basePrice+lossVal);
                            setSlPriceInput(targetPrice.toFixed(2));
                          } else setSlPriceInput("");
                        }}/>

                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Calculations and limits stats list */}
            <div className="bg-brand-bg/50 border border-brand-border rounded-lg p-1.5 text-[9px] md:text-[10px] font-mono space-y-0.5 mt-auto">
              {isPerp && (
                <div className="flex justify-between text-gray-500 font-bold">
                  <span>Liq. Price</span>
                  <span className="text-gray-300 font-semibold">
                    {liquidationPrice ? `$${liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : "N/A"}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 font-bold">
                <span>Order Value</span>
                <span className="text-gray-300 font-semibold">
                  {typeof orderValue === "number" && Number.isFinite(orderValue) && orderValue > 0
                    ? `$${orderValue.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                    : "--"}
                </span>
              </div>
              {isPerp && (
                <div className="flex justify-between text-gray-500 font-bold">
                  <span>Margin</span>
                  <span className="text-gray-300 font-semibold">
                    {marginRequired > 0 ? `$${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : "N/A"}
                  </span>
                </div>
              )}
            </div>

            {/* Action Placement Button */}
            <button
              type="submit"
              onClick={showOrderButtonTap}
              disabled={(() => {
                if (isPlacingOrder) return true;
                if (isPerp) {
                  if (sizeUsd <= 0) return true;
                  if (notEnoughMarginEffectiveSide) return true;
                  if (currentRoDisabled) return true;
                  return false;
                } else {
                  if (!spotBalancesHydrated) return true;
                  if (!spotAssetData?.spotSymbol) return true;
                  if (orderType !== "MARKET" && !(orderType === "LIMIT" && tif === "GTC")) return true;
                  const rawSize = Number(sizeInput);
                  if (!Number.isFinite(rawSize) || rawSize <= 0) return true;
                  const effectivePrice = orderType === "LIMIT" ? Number(priceInput) : realCurrentPrice;
                  if (!effectivePrice || effectivePrice <= 0) return true;
                  const calculatedUnits = sizeUnit === "USDC" ? rawSize / effectivePrice : rawSize;
                  const calculatedUsd = sizeUnit === "USDC" ? rawSize : rawSize * effectivePrice;
                  const spotMinSizeUnits = Math.pow(10, -spotSzDecimals);
                  const spotSizePow = Math.pow(10, spotSzDecimals);
                  const spotSizeUnitsRounded = spotSizePow > 0 ? Math.floor(calculatedUnits * spotSizePow) / spotSizePow : 0;
                  const spotSlippageBps = 50;
                  const spotPxForCheck = orderType === "LIMIT" ? (Number(priceInput) || 0) : effectivePrice * (orderSide === "BUY" ? 1 + spotSlippageBps / 10000 : 1 - spotSlippageBps / 10000);
                  const spotNotionalRounded = spotSizeUnitsRounded * spotPxForCheck;
                  const spotMinUsdRequired = spotMinSizeUnits > 0 && spotPxForCheck > 0 ? Math.ceil(10 / spotPxForCheck / spotMinSizeUnits) * spotMinSizeUnits * spotPxForCheck : 10;
                  if (spotSizeUnitsRounded < spotMinSizeUnits || spotNotionalRounded + 1e-9 < spotMinUsdRequired) return true;
                  const spotOrderEstFeeUsd = calculatedUsd > 0 ? calculatedUsd * totalFeeRate : 0;
                  if (orderSide === "BUY") {
                    if (calculatedUsd + spotOrderEstFeeUsd > spotBuyAvailableUsd + 1e-9) return true;
                  } else {
                    const spotSellBaseTolerance = Math.max(spotMinSizeUnits, 1e-9);
                    if (spotSizeUnitsRounded > spotAvailableBase + spotSellBaseTolerance) return true;
                  }
                  return false;
                }
              })()}
              className={`w-full py-2 rounded-lg text-[10px] md:text-xs font-display font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${orderButtonTapped ? "scale-[0.98] brightness-[0.92] ring-2 ring-inset ring-white/50" : ""} ${isPlacingOrder ? "disabled:opacity-100 disabled:cursor-default" : "disabled:opacity-50 disabled:cursor-not-allowed"} ${
                orderSide === "BUY"
                  ? "bg-[#18c29c] hover:bg-[#15b390] text-[#030610] shadow-md shadow-[#18c29c]/10"
                  : "bg-[#f25c5c] hover:bg-[#e05252] text-brand-text shadow-md shadow-[#f25c5c]/10"
              }`}
            >
              {isPlacingOrder
                ? `Place ${orderSide === "BUY" ? (isPerp ? "Long" : "Buy") : (isPerp ? "Short" : "Sell")}`
                : isPerp && reduceOnly && currentRoDisabled
                ? roTooLarge
                  ? "Reduce Only Too Large"
                  : currentHlPosition?.side === "long"
                  ? "Reduce Only: Short only"
                  : currentHlPosition?.side === "short"
                  ? "Reduce Only: Long only"
                  : "Reduce Only"
                : isPerp && notEnoughMarginEffectiveSide
                ? "Margin insufficient"
                : !isPerp && !spotBalancesHydrated
                ? "Loading balances..."
                : !isPerp && orderSide === "BUY" && ((sizeUnit === "USDC" ? Number(sizeInput) : Number(sizeInput) * (basePrice ?? 0)) + ((sizeUnit === "USDC" ? Number(sizeInput) : Number(sizeInput) * (basePrice ?? 0)) * totalFeeRate) > spotBuyAvailableUsd + 1e-9)
                ? "Margin insufficient"
                : !isPerp && orderSide === "SELL" && ((sizeUnit === "USDC" ? Number(sizeInput) / (basePrice ?? 1) : Number(sizeInput)) > spotAvailableBase + Math.max(Math.pow(10, -spotSzDecimals), 1e-9))
                ? "Not enough spot balance to sell"
                : !isPerp && (orderValue !== null && orderValue > 0 && orderValue < 10)
                ? "Min Order $10"
                : `Place ${orderSide === "BUY" ? (isPerp ? "Long" : "Buy") : (isPerp ? "Short" : "Sell")}`}
            </button>
          </form>
        </HideDexOrderForm>

        <HideDexOrderBookPanel
          asks={asks}
          bids={bids}
          midPrice={realCurrentPrice}
          midLabel="Mark Price"
          sizeUnit={orderBookSizeUnit}
          baseSymbol={orderBookBaseLabel}
          onToggleSizeUnit={() => setOrderBookSizeUnit(v=>v==="USD"?"COIN":"USD")}
          onSelectPrice={handleOrderBookRowClick}
          formatPrice={p => p.toLocaleString(undefined,{minimumFractionDigits:symbol==="PURR"?3:1})}
          formatSize={(p,size)=>formatTerminalOrderBookSize(p,size)}
          formatMidPrice={p=>p.toLocaleString(undefined,{minimumFractionDigits:symbol==="PURR"?4:2})}
          asksContainerRef={terminalAsksRef}
          group={aggregation}
          groupOptions={["0.01","0.1","1","2","5","10"]}
          onGroup={setAggregation}
          flashingPrices={activeFlashingPrices}
          shrinkOnTpSl={isTpSlEnabled}
        />
      </HideDexTradeGrid>

      {/* 4. BOTTOM TABS: POSITIONS, OPEN ORDERS, BALANCES, TRADE HISTORY (Unified Component) */}
      <TradingDashboardTabs
        symbol={symbol}
        currentToken={currentToken}
        tokens={tokens}
        balanceUSDC={balanceUSDC}
        tokenBalances={tokenBalances}
        spotAvailableBalances={spotAvailableBalances}
        positions={positions}
        openOrders={openOrders}
        tradeHistory={tradeHistory}
        fundingHistory={fundingHistory}
        onCancelOrder={onCancelOrder}
        onCancelAllOrders={onCancelAllOrders}
        onClosePosition={onClosePosition}
        onCloseAllPositions={onCloseAllPositions}
        onCloseSpotPosition={onCloseSpotPosition}
        onCloseAllSpotPositions={onCloseAllSpotPositions}
        onSavePositionTpSl={onSavePositionTpSl}
        onSelectToken={onSelectToken}
        walletConnected={!!walletAddress}
        setupComplete={setupComplete}
        onSetupRequired={onSetupRequired}
      />

      {/* SHARE POSITION CARD MODAL */}
      {selectedSharePosition && (
        <ShareCardPopup
          isOpen={!!selectedSharePosition}
          onClose={() => setSelectedSharePosition(null)}
          positionData={selectedSharePosition}
          walletAddress={walletAddress}
        />
      )}


    </div>
  );
}
