/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Star, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TokenMetadata, getPerpLeverageFormatted } from "../../types";
import { usePricesRef } from "../../providers/WebSocketProvider";
import { pickPrice } from "../../lib/priceKeys";
import { getOfficialTokenLogoCandidates } from "../../lib/tokenLogoData";
import { useLanguage } from "../../lib/LanguageContext";

const PRIMARY_MARKET_ORDER = {
  all: [
    "BTC",
    "ETH",
    "SOL",
    "SP500",
    "NDX100",
    "GOLD",
    "SILVER",
    "NVDA",
    "AAPL",
    "GOOGL",
    "MSFT",
    "AMZN",
    "HYPE",
    "OIL",
    "META",
    "TSLA",
    "ANTH",
    "XRP",
    "EUR",
    "JPY",
  ],

  stocks: [
    "NVDA",
    "AAPL",
    "TSLA",
    "ANTH",
    "GOOGL",
    "MSFT",
    "META",
    "AMZN",
    "SPCX",
    "CXMT",
    "UNITREE",
    "MRNA",
    "LITE",
    "MSTR",
    "COIN",
    "CRCL",
    "PLTR",
    "NFLX",
    "AVGO",
    "ORCL",
    "BABA",
    "RIVN",
    "MU",
    "INTC",
    "AMD",
    "CRWV",
    "CBRS",
    "MRVL",
    "IBM",
    "DELL",
    "HOOD",
    "PURRDAT",
    "TSM",
    "GME",
    "LLY",
    "SMSN",
    "SNDK",
    "SKHY",
  ],

  crypto: [
    "BTC",
    "ETH",
    "SOL",
    "HYPE",
    "XRP",
    "BNB",
    "DOGE",
    "ZEC",
    "SUI",
    "LINK",
    "AAVE",
    "NEAR",
    "XMR",
    "UNI",
    "ONDO",
    "ARB",
    "JUP",
    "GRAM",
    "TRX",
    "LTC",
    "BCH",
    "XLM",
    "HBAR",
    "ADA",
    "AVAX",
    "APT",
    "TAO",
    "ENA",
    "PUMP",
    "MON",
    "WLD",
    "XPL",
    "ZRO",
    "PYTH",
    "WLFI",
    "JTO",
    "LIT",
    "VIRTUAL",
    "VVV",
    "MEGA",
    "PONS",
    "ASTER",
  ],

  commodities: [
    "GOLD",
    "SILVER",
    "PLATINUM",
    "PALLADIUM",
    "COPPER",
    "OIL",
    "BRENTOIL",
    "NATGAS",
    "URNM",
  ],

  forex: [
    "EUR",
    "JPY",
  ],

  indices: [
    "SP500",
    "NDX100",
    "EWY",
    "DRAM",
  ],
} as const;

export function extractBaseSymbol(
  sym: string,
): string {
  if (!sym) return "";

  return sym
    .replace("-PERP", "")
    .replace("-SPOT", "")
    .replace("/USDC", "")
    .replace("-USDC", "")
    .toUpperCase();
}

export type MainCategory = "perps" | "spot";

export type PerpSubcategory =
  | "all"
  | "crypto"
  | "stocks"
  | "commodities"
  | "forex"
  | "indices";

export type SortField = "volume" | "symbol" | "price";
export type SortDirection = "asc" | "desc";

interface MarketSelectorProps {
  tokens: TokenMetadata[];
  selectedSymbol: string;
  onSelectToken: (
    symbol: string,
    mode: "spot" | "perp"
  ) => void;
  onClose: () => void;
  initialCategory?: MainCategory;
  favorites?: string[];
  onToggleFavorite?: (symbol: string) => void;
  externalPricesOnly?: boolean;
}

export function getDisplaySymbol(
  tok: TokenMetadata,
): string {
  const fallback =
    String(
      tok.name ||
      tok.symbol ||
      "",
    ).trim();

  const exactSourceCoin =
    String(
      tok.sourceCoin ||
      "",
    ).trim();

  /*
   * Native Perp sourceCoin:
   *
   * kSHIB
   * kPEPE
   * kBONK
   *
   * Preserve exact source casing when sourceCoin represents
   * the SAME ticker identity.
   *
   * Do NOT expose HIP-3 dex prefixes.
   * Do NOT expose Spot @ identifiers.
   */
  const sourceIsNativePerp =
    Boolean(
      exactSourceCoin,
    ) &&
    !exactSourceCoin.includes(
      ":",
    ) &&
    !exactSourceCoin.startsWith(
      "@",
    );

  const fallbackBase =
    extractBaseSymbol(
      fallback,
    );

  const sourceBase =
    extractBaseSymbol(
      exactSourceCoin,
    );

  if (
    sourceIsNativePerp &&
    sourceBase &&
    fallbackBase &&
    sourceBase ===
      fallbackBase
  ) {
    return exactSourceCoin;
  }

  return fallback;
}

const SUBCATEGORIES: { id: PerpSubcategory; name: string; icon?: string }[] = [
  { id: "all", name: "All" },
  { id: "crypto", name: "Crypto", icon: "crypto" },
  { id: "stocks", name: "Stocks", icon: "stocks" },
  { id: "commodities", name: "Commodities", icon: "commodities" },
  { id: "forex", name: "Forex", icon: "forex" },
  { id: "indices", name: "Indices", icon: "indices" },
];

export function tokenMatchesSubcategory(tok: TokenMetadata, sub: PerpSubcategory): boolean {
  if (sub === "all") return true;
  const tokenSub = (tok.subcategory || "").toLowerCase().trim();
  const tokenCat = (tok.category || "").toLowerCase().trim();
  const baseSym = extractBaseSymbol(tok.symbol);

  if (tokenSub === sub.toLowerCase().trim() || tokenCat === sub.toLowerCase().trim()) {
    return true;
  }

  // Fallback categorization based on PRIMARY_MARKET_ORDER lists
  if (sub === "crypto" && (PRIMARY_MARKET_ORDER.crypto as readonly string[]).includes(baseSym)) return true;
  if (sub === "stocks" && (PRIMARY_MARKET_ORDER.stocks as readonly string[]).includes(baseSym)) return true;
  if (sub === "commodities" && (PRIMARY_MARKET_ORDER.commodities as readonly string[]).includes(baseSym)) return true;
  if (sub === "forex" && (PRIMARY_MARKET_ORDER.forex as readonly string[]).includes(baseSym)) return true;
  if (sub === "indices" && (PRIMARY_MARKET_ORDER.indices as readonly string[]).includes(baseSym)) return true;

  return false;
}

// Fallback Logo Renderer Component for Market Selector
function renderFallbackAssetLogo(base: string) {
  switch (base) {
    case "BTC":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f7931a] flex items-center justify-center font-sans font-black text-white text-xs select-none shadow shadow-[#f7931a]/30 shrink-0">
          ₿
        </div>
      );
    case "ETH":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#627eea] flex items-center justify-center select-none shadow shadow-[#627eea]/30 shrink-0">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-current" viewBox="0 0 784.37 1277.39">
            <path d="M392.07 0L383.5 29.11V874.74L392.07 883.29L784.13 651.54L392.07 0Z" fill="white" fillOpacity="0.6"/>
            <path d="M392.07 0L0 651.54L392.07 883.29V472.33V0Z" fill="white"/>
            <path d="M392.07 956.52L387.24 962.41V1253.52L392.07 1277.38L784.37 724.89L392.07 956.52Z" fill="white" fillOpacity="0.6"/>
            <path d="M392.07 1277.38V956.52L0 724.89L392.07 1277.38Z" fill="white"/>
            <path d="M392.07 883.29L784.13 651.54L392.07 472.33V883.29Z" fill="white" fillOpacity="0.2"/>
            <path d="M0 651.54L392.07 883.29V472.33L0 651.54Z" fill="white" fillOpacity="0.6"/>
          </svg>
        </div>
      );
    case "SOL":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#9945ff] via-[#00c2ff] to-[#14f195] flex items-center justify-center select-none shadow shadow-purple-500/30 shrink-0 p-1">
          <div className="w-full h-full flex flex-col justify-between py-0.5">
            <div className="h-0.5 bg-white rounded-full w-full" />
            <div className="h-0.5 bg-white rounded-full w-4/5 ml-auto" />
            <div className="h-0.5 bg-white rounded-full w-full" />
          </div>
        </div>
      );
    case "SP500":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#e50914] flex items-center justify-center font-sans font-black text-white text-[10px] tracking-tight select-none shadow shadow-red-500/30 shrink-0">
          500
        </div>
      );
    case "NDX100":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1b365d] border border-blue-400/40 flex items-center justify-center relative overflow-hidden select-none shadow shadow-blue-600/30 shrink-0">
          <div className="absolute inset-0 flex flex-col justify-center">
            <div className="h-0.5 bg-red-600 w-full" />
            <div className="h-0.5 bg-white w-full" />
            <div className="h-0.5 bg-red-600 w-full" />
            <div className="h-0.5 bg-white w-full" />
            <div className="h-0.5 bg-red-600 w-full" />
          </div>
          <div className="absolute top-0 left-0 w-3 h-3 bg-[#0a2342] flex items-center justify-center">
            <span className="text-white text-[7px] leading-none">★</span>
          </div>
        </div>
      );
    case "GOLD":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-[#e5b73b] to-[#996e11] border border-amber-300/40 flex items-center justify-center select-none shadow shadow-amber-500/30 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-3 h-1 bg-[#fff3be] rounded-xs shadow-sm transform -skew-x-12" />
            <div className="w-4 h-1 bg-[#ffd700] rounded-xs shadow-sm transform -skew-x-12" />
          </div>
        </div>
      );
    case "SILVER":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-[#cfd9df] to-[#5b6a7a] border border-slate-300/40 flex items-center justify-center select-none shadow shadow-slate-400/30 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-3 h-1 bg-[#ffffff] rounded-xs shadow-sm transform -skew-x-12" />
            <div className="w-4 h-1 bg-[#e2e8f0] rounded-xs shadow-sm transform -skew-x-12" />
          </div>
        </div>
      );
    case "NVDA":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#76b900] flex items-center justify-center font-sans select-none shadow shadow-[#76b900]/30 shrink-0 p-1">
          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
            <path d="M8.7 5.8c-2.4.7-4.2 2.6-4.7 5.1-.3 1.3-.2 2.7.4 3.9.7 1.5 2 2.7 3.6 3.2 1.4.4 2.9.3 4.2-.3 2.1-1 3.5-3.1 3.7-5.5.1-1.3-.2-2.7-.9-3.8l-1.9 1.4c.5.8.7 1.7.6 2.6-.2 1.6-1.1 2.9-2.5 3.5-.9.4-1.9.4-2.8.1-1.1-.4-1.9-1.2-2.4-2.2-.4-.9-.5-1.8-.3-2.7.3-1.6 1.4-2.8 2.9-3.3 1.3-.4 2.7-.2 3.8.5l1.9-1.4C13.2 5.7 10.9 5.2 8.7 5.8z"/>
          </svg>
        </div>
      );
    case "AAPL":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-surface border border-brand-border/60 flex items-center justify-center select-none shadow-xs shrink-0 p-1.5">
          <svg className="w-4 h-4 text-brand-text fill-current" viewBox="0 0 170 170">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-6.19-9.58-10.9-20.17-14.13-31.78-3.23-11.6-4.85-22.37-4.85-32.31 0-14.56 3.63-26.68 10.89-36.36 7.26-9.68 16.5-14.59 27.72-14.73 4.8 0 10.22 1.34 16.27 4.02 6.05 2.68 10.05 4.07 12 4.07 1.57 0 5.77-1.48 12.61-4.43 6.84-2.96 12.7-4.22 17.58-3.79 13.51 1.06 24.16 6.3 31.96 15.72-12.08 7.33-18.01 17.38-17.8 30.15.22 10.03 4.02 18.42 11.41 25.17 7.39 6.75 16.25 10.51 26.58 11.29-2.35 6.94-5.23 13.49-8.63 19.64zM119.22 33.64c0-7.23 2.6-13.9 7.81-20.02 5.21-6.12 11.65-10.01 19.33-11.66.45 1.57.67 3.19.67 4.87 0 7.38-2.73 14.28-8.2 20.7-5.46 6.42-12.18 10.37-20.14 11.86-.44-1.89-.67-3.81-.67-5.75z"/>
          </svg>
        </div>
      );
    case "TSLA":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#e82127] flex items-center justify-center font-sans font-black text-white text-[11px] select-none shadow shadow-red-500/30 shrink-0">
          T
        </div>
      );
    case "HYPE":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#a3e635] flex items-center justify-center font-sans font-black text-[#030610] text-[11px] select-none shadow shadow-[#a3e635]/30 shrink-0">
          H
        </div>
      );
    case "XRP":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1e2329] border border-[#00aae4]/50 flex items-center justify-center font-sans font-black text-[#00aae4] text-[10px] select-none shadow shadow-[#00aae4]/30 shrink-0">
          ✕
        </div>
      );
    case "AVAX":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#e84142] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#e84142]/30 shrink-0">
          A
        </div>
      );
    case "SUI":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#4ca2ff] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#4ca2ff]/30 shrink-0">
          S
        </div>
      );
    case "ARB":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#28a0f0] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#28a0f0]/30 shrink-0">
          A
        </div>
      );
    case "OP":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#ff0420] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#ff0420]/30 shrink-0">
          O
        </div>
      );
    case "ONDO":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1e3a8a] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#1e3a8a]/30 shrink-0">
          O
        </div>
      );
    case "BNB":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f3ba2f] flex items-center justify-center font-sans font-black text-[#1e2026] text-[10px] select-none shadow shadow-[#f3ba2f]/30 shrink-0">
          B
        </div>
      );
    case "DOGE":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#c2a633] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#c2a633]/30 shrink-0">
          Ð
        </div>
      );
    case "LINK":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#375bd2] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-[#375bd2]/30 shrink-0">
          ⬡
        </div>
      );
    case "EUR":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#003399] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-blue-800/30 shrink-0">
          €
        </div>
      );
    case "JPY":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#bc002d] flex items-center justify-center font-sans font-black text-white text-[10px] select-none shadow shadow-red-700/30 shrink-0">
          ¥
        </div>
      );
    case "OIL":
      return (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1f2937] border border-gray-600 flex items-center justify-center select-none shadow shrink-0">
          <span className="text-amber-400 text-[10px]">🛢</span>
        </div>
      );
    default: {
      const label =
        base
          .replace(
            /[^A-Z0-9]/g,
            ""
          )
          .slice(0, 3) ||
        "?";

      return (
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-black/10 flex items-center justify-center font-sans font-black text-slate-900 text-[9px] sm:text-[10px] uppercase select-none shrink-0 shadow-sm"
          title={base}
        >
          {label}
        </div>
      );
    }
  }
}

// Preserve successfully loaded OFFICIAL image identity across Spot/Perps mounts.
// Never show a synthetic coin logo while the official asset image is in flight.
const confirmedOfficialLogoUrls = new Map<string, string>();

function OfficialAssetLogo({
  base,
  srcCandidates,
  fallback,
  eager = false,
}: {
  base: string;
  srcCandidates:
    readonly string[];
  fallback:
    React.ReactNode;
  eager?: boolean;
}) {
  const candidateKey = srcCandidates.join("|");
  const [sourceIndex, setSourceIndex] = useState(() => {
    const cached = confirmedOfficialLogoUrls.get(candidateKey);
    return cached ? Math.max(0, srcCandidates.indexOf(cached)) : 0;
  });
  const [loadedSrc, setLoadedSrc] = useState<string | null>(
    () => confirmedOfficialLogoUrls.get(candidateKey) || null
  );

  useEffect(() => {
    const cached = confirmedOfficialLogoUrls.get(candidateKey);
    setSourceIndex(cached ? Math.max(0, srcCandidates.indexOf(cached)) : 0);
    setLoadedSrc(cached || null);
  }, [candidateKey]);

  const src =
    srcCandidates[
      sourceIndex
    ];

  if (!src) {
    return (
      <>
        {fallback}
      </>
    );
  }

  return (
    <div
      className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-black/10 shadow-sm flex items-center justify-center shrink-0 overflow-hidden"
      title={base}
    >
      {/* Neutral loading surface only; never flash a different/fake logo. */}
      {loadedSrc !== src && (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-overlay-subtle" aria-hidden="true">
          <span className="w-3 h-3 rounded-full bg-brand-border/70" />
        </div>
      )}
      <img
        key={src}
        src={src}
        alt={`${base} logo`}
        className={`absolute inset-0 w-full h-full object-contain p-1 transition-none ${loadedSrc === src ? "opacity-100" : "opacity-0"}`}
        draggable={false}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        onLoad={() => {
          confirmedOfficialLogoUrls.set(candidateKey, src);
          setLoadedSrc(src);
        }}
        onError={() => {
          setLoadedSrc(null);
          setSourceIndex(current => current + 1);
        }}
      />
    </div>
  );
}

// Logo Renderer Component for Market Selector
export function renderAssetLogo(
  sym: string,
  displayBase?: string,
  sourceCoin?: string,
  eager = false,
) {
  const raw =
    String(
      displayBase ||
      sym ||
      ""
    );

  const afterDex =
    raw.includes(":")
      ? (
          raw
            .split(":")
            .pop() ||
          raw
        )
      : raw;

  const base =
    extractBaseSymbol(
      afterDex
    );

  const fallback =
    renderFallbackAssetLogo(
      base.toUpperCase()
    );

  const officialLogoUrls =
    getOfficialTokenLogoCandidates(
      base,
      sourceCoin,
    );

  if (officialLogoUrls.length === 0) {
    return fallback;
  }

  return (
    <OfficialAssetLogo
      base={base}
      srcCandidates={officialLogoUrls}
      fallback={fallback}
      eager={eager}
    />
  );
}

export default function MarketSelector({
  tokens,
  selectedSymbol,
  onSelectToken,
  onClose,
  initialCategory,
  favorites = [],
  onToggleFavorite,
  externalPricesOnly = false,
}: MarketSelectorProps) {
  const pricesRef = usePricesRef();
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<MainCategory>(
    initialCategory ?? "perps"
  );
  const [activeSubcategory, setActiveSubcategory] = useState<PerpSubcategory>("all");
  // Perpetuals and Spot have independent list scroll positions.
  // Reusing one scroll container made Spot jump to the Perps offset.
  const categoryScrollTop = useRef<Record<MainCategory, number>>({
    perps: 0,
    spot: 0,
  });
  const marketListRef = useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (marketListRef.current) {
      marketListRef.current.scrollTop = categoryScrollTop.current[activeCategory];
    }
  }, [activeCategory]);


  // Default sort is 24H Volume High -> Low as required by PART 5
  const [sortField, setSortField] = useState<SortField>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getSourceMarketSymbol = useCallback(
    (tok: TokenMetadata): string =>
      String(
        tok.displayBaseAsset ||
        tok.sourceCoin ||
        extractBaseSymbol(tok.symbol) ||
        ""
      ).toUpperCase(),
    []
  );

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const toggleFavorite = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(sym);
  };

  // Header sort toggle handler - explicit event stopPropagation so it NEVER closes popup
  const handleHeaderSort = (field: SortField, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sortField === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      // Symbol defaults to A -> Z (asc), numeric fields default to High -> Low (desc)
      setSortDirection(field === "symbol" ? "asc" : "desc");
    }
  };

  const combinedTokens = useMemo(() => {
    return tokens || [];
  }, [tokens]);

  const getPrice = useCallback((tok: TokenMetadata): number | null => {
    if (externalPricesOnly) return typeof tok.price === "number" && Number.isFinite(tok.price) && tok.price > 0 ? tok.price : null;
    if (activeCategory === "spot") {
      // Display the same exact Spot-pair midpoint as the trading terminal.
      // markPx is an index/mark estimate, not necessarily the current tradable price.
      const mid = Number(tok.spotCtx?.midPx);
      if (Number.isFinite(mid) && mid > 0) return mid;

      const exactSpotSymbol = String(tok.spotSymbol || "").trim();
      if (exactSpotSymbol) {
        const live = Number(pickPrice(pricesRef.current, {
          coin: exactSpotSymbol,
          symbol: exactSpotSymbol,
        }));
        if (Number.isFinite(live) && live > 0) return live;
      }

      // If midpoint / exact-pair quote is unavailable, show the mark as fallback.
      // Never borrow a Perp or a similarly named Spot ticker.
      const mark = Number(tok.spotCtx?.markPx);
      return Number.isFinite(mark) && mark > 0 ? mark : null;
    }

    const livePriceRaw = pickPrice(pricesRef.current, {
      coin: tok.sourceCoin,
      symbol: tok.symbol,
      isHip3: String(tok.sourceCoin || "").includes(":"),
    });
    const parsedLivePrice =
      livePriceRaw !== undefined && livePriceRaw !== null
        ? parseFloat(String(livePriceRaw))
        : NaN;
    return typeof parsedLivePrice === "number" &&
      Number.isFinite(parsedLivePrice) &&
      parsedLivePrice > 0
      ? parsedLivePrice
      : typeof tok.price === "number" &&
        Number.isFinite(tok.price) &&
        tok.price > 0
      ? tok.price
      : null;
  }, [activeCategory, pricesRef, externalPricesOnly]);

  const getVolume = useCallback((tok: TokenMetadata): number | null => {
    if (activeCategory === "spot") {
      if (tok.spotCtx?.dayNtlVlm !== undefined && tok.spotCtx.dayNtlVlm !== null) {
        const parsed = parseFloat(String(tok.spotCtx.dayNtlVlm));
        if (Number.isFinite(parsed) && !isNaN(parsed) && parsed >= 0) return parsed;
      }
      return null;
    }
    const v = tok.volume24h;
    if (typeof v === "number" && !isNaN(v) && v >= 0) return v;
    return null;
  }, [activeCategory]);

  // Spot 24H change calculated from real current Spot price and prevDayPx (PART 11)
  const getChange24h = useCallback(
    (tok: TokenMetadata): number | null => {
      if (activeCategory === "spot") {
        const current = getPrice(tok);
        const prevRaw = tok.spotCtx?.prevDayPx;
        const prev =
          prevRaw !== undefined && prevRaw !== null
            ? parseFloat(String(prevRaw))
            : NaN;
        if (
          current !== null &&
          Number.isFinite(current) &&
          current > 0 &&
          Number.isFinite(prev) &&
          prev > 0
        ) {
          return ((current - prev) / prev) * 100;
        }
        return null;
      }

      return typeof tok.change24h === "number" && Number.isFinite(tok.change24h)
        ? tok.change24h
        : null;
    },
    [activeCategory, getPrice]
  );

  // Dynamic filtering & sorting using real raw numeric data (PART 6, 9)
  const filteredTokens = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // 1. Initial Filtering
    const baseFiltered = combinedTokens.filter((tok) => {
      // Favorites filter
      if (showFavoritesOnly && !favorites.includes(tok.symbol)) {
        return false;
      }

      // Search query filter
      if (q) {
        const searchable = [
          tok.symbol,
          tok.name,
          tok.fullName,
          tok.sourceCoin,
        ]
          .map((value) =>
            String(
              value || ""
            ).toLowerCase()
          );

        if (
          !searchable.some(
            (value) =>
              value.includes(q)
          )
        ) {
          return false;
        }
      }

      // Category filter (Strictly PERPS vs SPOT)
      if (
        activeCategory ===
        "spot"
      ) {
        const hasRealSpot =
          (
            tok.hasSpot ===
              true ||
            tok.isSpotOnly ===
              true
          ) &&
          Boolean(
            tok.spotSymbol
          );

        if (!hasRealSpot) {
          return false;
        }
      } else {
        if (tok.isSpotOnly === true || tok.category === "spot") {
          return false;
        }
      }

      // Subcategory filter (For PERPS tab)
      if (activeCategory === "perps" && activeSubcategory !== "all") {
        if (!tokenMatchesSubcategory(tok, activeSubcategory)) {
          return false;
        }
      }

      return true;
    });

    // 2. Sorting based on selected sortField (Symbol A-Z/Z-A, Price High-Low/Low-High, Volume High-Low/Low-High)
    return [...baseFiltered].sort((a, b) => {
      if (sortField === "symbol") {
        const symA = (activeCategory === "spot" ? String(a.symbol || a.name || "").replace(/-SPOT$/i, "") : getDisplaySymbol(a)).toUpperCase();
        const symB = (activeCategory === "spot" ? String(b.symbol || b.name || "").replace(/-SPOT$/i, "") : getDisplaySymbol(b)).toUpperCase();
        const cmp = symA.localeCompare(symB);
        return sortDirection === "asc" ? cmp : -cmp;
      }

      if (sortField === "price") {
        const pxA = getPrice(a);
        const pxB = getPrice(b);
        const numA = pxA !== null && Number.isFinite(pxA) ? pxA : null;
        const numB = pxB !== null && Number.isFinite(pxB) ? pxB : null;
        if (numA === null && numB === null) return 0;
        if (numA === null) return 1; // missing goes to bottom
        if (numB === null) return -1;
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      // sortField === "volume" (Default: High -> Low)
      const volA = getVolume(a);
      const volB = getVolume(b);
      const numA = volA !== null && Number.isFinite(volA) ? volA : null;
      const numB = volB !== null && Number.isFinite(volB) ? volB : null;
      if (numA === null && numB === null) return 0;
      if (numA === null) return 1; // missing goes to bottom
      if (numB === null) return -1;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [
    combinedTokens,
    searchQuery,
    activeCategory,
    activeSubcategory,
    showFavoritesOnly,
    favorites,
    sortField,
    sortDirection,
    getSourceMarketSymbol,
    getPrice,
    getVolume,
  ]);

  const formatVolume = (vol: number | undefined | null) => {
    if (vol === undefined || vol === null || isNaN(vol) || vol < 0) return "--";
    if (vol === 0) return "0";
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(1)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toFixed(0);
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) return "--";
    if (price < 0.0001) return price.toExponential(2);
    if (price < 1) return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (price < 100) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change: number | null | undefined) => {
    if (change === null || change === undefined || !Number.isFinite(change)) return "--";
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  const content = (
    <div
      data-market-selector-portal="true"
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Modal: Fullscreen on mobile, centered modal on desktop */}
      <div
        className="fixed inset-0 h-[100dvh] w-screen sm:relative sm:inset-auto sm:h-[620px] sm:max-h-[85vh] sm:w-[500px] sm:max-w-[500px] bg-brand-bg text-brand-text border-0 sm:border border-brand-border rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 pt-safe pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Select Market + Subtitle + Close Button */}
        <div className="px-3.5 sm:px-5 pt-3 pb-1 sm:pt-4 sm:pb-1.5 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-brand-text tracking-tight leading-tight">
              {t("select_market")}
            </h2>
            <p className="text-[10px] sm:text-xs text-brand-sub mt-0.5 font-normal">
              {t("choose_asset")}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-brand-surface border border-brand-border text-brand-sub hover:text-brand-text flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-3"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Row + Favorites Star Button */}
        <div className="px-3.5 sm:px-5 py-1 flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="relative flex-1 bg-brand-surface border border-brand-border rounded-xl flex items-center px-2.5 py-1.5 sm:py-2 transition-colors focus-within:border-emerald-500 dark:focus-within:border-emerald-400 h-[38px] sm:h-[44px]">
            <Search className="w-3.5 h-3.5 text-brand-muted shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={t("search_market")}
              className="w-full bg-transparent text-[11px] sm:text-xs text-brand-text placeholder:text-brand-muted focus:outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
                className="text-brand-muted hover:text-brand-text text-xs cursor-pointer ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFavoritesOnly(!showFavoritesOnly);
            }}
            className={`w-[38px] h-[38px] sm:w-[44px] sm:h-[44px] rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              showFavoritesOnly
                ? "bg-amber-400/15 border-amber-400/50 text-amber-500 dark:text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                : "bg-brand-surface border-brand-border text-brand-sub hover:text-brand-text"
            }`}
            title="Toggle Favorites"
          >
            <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${showFavoritesOnly ? "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" : ""}`} />
          </button>
        </div>

        {/* Tabs: Perpetuals & Spot */}
        <div className="px-3.5 sm:px-5 py-0.5 sm:py-1 shrink-0">
          <div className="bg-brand-surface border border-brand-border rounded-xl p-0.5 sm:p-1 flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCategory("perps");
                setActiveSubcategory("all");
              }}
              className={`flex-1 py-1.5 sm:py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeCategory === "perps"
                  ? "border-2 border-accent text-brand-text bg-brand-card shadow-xs"
                  : "text-brand-text hover:bg-brand-overlay-normal border border-transparent"
              }`}
            >
              {t("perp")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCategory("spot");
              }}
              className={`flex-1 py-1.5 sm:py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeCategory === "spot"
                  ? "border-2 border-accent text-brand-text bg-brand-card shadow-xs"
                  : "text-brand-text hover:bg-brand-overlay-normal border border-transparent"
              }`}
            >
              {t("spot")}
            </button>
          </div>
        </div>

        {/* Categories filter Perpetuals only. Never switch Spot to Perps from a hidden category chip. */}
        {activeCategory === "perps" && (
        <div className="px-3.5 sm:px-5 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none shrink-0 select-none">
          {SUBCATEGORIES.map((sub) => {
            const isActive = activeSubcategory === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeCategory !== "perps") {
                    setActiveCategory("perps");
                  }
                  setActiveSubcategory(sub.id);
                }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? "bg-accent text-brand-bg font-bold shadow-sm border border-accent"
                    : "bg-brand-surface border border-brand-border text-brand-text hover:bg-brand-overlay-normal hover:border-accent/50"
                }`}
              >
                {sub.icon === "crypto" && (
                  <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#f7931a] flex items-center justify-center text-white text-[7px] sm:text-[8px] font-black leading-none shrink-0">
                    ₿
                  </span>
                )}
                {sub.icon === "stocks" && (
                  <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${isActive ? "text-black" : "text-cyan-600 dark:text-cyan-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                    <polyline points="16 7 22 7 22 13"/>
                  </svg>
                )}
                {sub.icon === "commodities" && (
                  <div className="flex flex-col items-center gap-0.2 shrink-0">
                    <div className={`w-2.5 sm:w-3 h-1 rounded-xs ${isActive ? "bg-black" : "bg-amber-500 dark:bg-amber-400"} transform -skew-x-12`} />
                  </div>
                )}
                {sub.icon === "forex" && (
                  <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${isActive ? "text-black" : "text-violet-600 dark:text-violet-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h4l3 8 4-16 3 8h4"/>
                  </svg>
                )}
                {sub.icon === "indices" && (
                  <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${isActive ? "text-black" : "text-blue-600 dark:text-blue-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="4"/>
                    <line x1="12" y1="20" x2="12" y2="10"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                )}
                <span>{t({all:"filter_all",crypto:"filter_crypto",stocks:"filter_stocks",commodities:"filter_commodities",forex:"filter_forex",indices:"filter_indices"}[sub.id])}</span>
              </button>
            );
          })}
        </div>
        )}

        {/* Table Header: Symbol | Last Price | 24H Vol with Real Interactive Sort Buttons */}
        <div className="px-3.5 sm:px-5 pt-1.5 pb-1 grid grid-cols-12 text-[10px] sm:text-xs font-semibold text-brand-text select-none shrink-0 border-b border-brand-border">
          <button
            type="button"
            onClick={(e) => handleHeaderSort("symbol", e)}
            className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-brand-text transition-colors text-left"
          >
            <span className="text-brand-text">
              {t("symbol")}
            </span>
            {sortField === "symbol" ? (
              sortDirection === "asc" ? (
                <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
              ) : (
                <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
              )
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-muted" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => handleHeaderSort("price", e)}
            className="col-span-4 flex items-center justify-end gap-1 cursor-pointer hover:text-brand-text transition-colors text-right"
          >
            <span className="text-brand-text">
              {t("last_price")}
            </span>
            {sortField === "price" ? (
              sortDirection === "asc" ? (
                <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
              ) : (
                <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
              )
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-muted" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => handleHeaderSort("volume", e)}
            className="col-span-3 flex items-center justify-end gap-1 cursor-pointer hover:text-brand-text transition-colors text-right"
          >
            <span className="text-brand-text">
              {t("volume_24h")}
            </span>
            {sortField === "volume" ? (
              sortDirection === "asc" ? (
                <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
              ) : (
                <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
              )
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-muted" />
            )}
          </button>
        </div>

        {/* Independent Perp/Spot scroll positions, never a shared offset. */}
        <div
          key={activeCategory}
          ref={marketListRef}
          onScroll={(event) => {
            categoryScrollTop.current[activeCategory] = event.currentTarget.scrollTop;
          }}
          className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-5 py-1 space-y-1 scrollbar-thin"
        >
          {filteredTokens.length === 0 ? (
            <div className="py-16 text-center text-brand-muted text-xs font-mono">
              {t("no_live_markets")}
            </div>
          ) : (
            filteredTokens.map((tok) => {
              const isFavorite = favorites.includes(tok.symbol);
              const cleanTokSymbol = extractBaseSymbol(tok.symbol);
              const cleanSelected = extractBaseSymbol(selectedSymbol);
              const isSelected =
                tok.symbol === selectedSymbol ||
                cleanTokSymbol === cleanSelected;
              const isSpot = activeCategory === "spot";
              const leverage = getPerpLeverageFormatted(tok.symbol, tok.maxLeverage);
              // Spot display must use the resolved ticker, never raw sourceCoin/spotSymbol.
              const displayTicker = isSpot
                ? String(tok.symbol || tok.name || "").trim().replace(/-SPOT$/i, "").toUpperCase()
                : getDisplaySymbol(tok);

              const livePrice = getPrice(tok);
              const effectiveVol = getVolume(tok);
              const formattedPrice = formatPrice(livePrice);
              const formattedVol = formatVolume(effectiveVol);
              const change24h = getChange24h(tok);
              const isPositive = typeof change24h === "number" && change24h >= 0;
              const formattedChange = formatChange(change24h);

              return (
                <div
                  key={tok.symbol}
                  onClick={() => {
                    onSelectToken(
                      tok.symbol,
                      activeCategory === "spot" ? "spot" : "perp"
                    );
                    onClose();
                  }}
                  className={`grid grid-cols-12 items-center px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "border border-accent bg-accent/10 text-brand-text"
                      : "border border-transparent bg-transparent text-brand-text hover:bg-brand-surface"
                  }`}
                >
                  {/* Left Column: Star + Logo + Symbol / Leverage */}
                  <div className="col-span-5 flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(tok.symbol, e)}
                      className={`p-0.5 rounded hover:bg-brand-overlay-normal transition-colors cursor-pointer shrink-0 ${
                        isFavorite
                          ? "text-amber-500 dark:text-amber-400"
                          : isSelected
                          ? "text-accent"
                          : "text-brand-text/60 hover:text-brand-text"
                      }`}
                      title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isFavorite ? "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" : ""
                        }`}
                      />
                    </button>

                    {renderAssetLogo(
                      tok.symbol,
                      tok.displayBaseAsset,
                      tok.sourceCoin,
                    )}

                    <div className="flex flex-col min-w-0 ml-0.5">
                      <span className="text-xs sm:text-sm font-bold tracking-tight leading-tight text-brand-text truncate">
                        {displayTicker}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-accent leading-tight block mt-0.5 whitespace-nowrap">
                        {isSpot ? t("spot") : `${leverage} ${t("perp_short")}`}
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: Last Price + 24H Change */}
                  <div className="col-span-4 text-right flex flex-col justify-center">
                    <span className="font-semibold text-xs sm:text-sm text-brand-text leading-tight">
                      {formattedPrice}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-medium leading-tight mt-0.5 ${
                        change24h === null
                          ? "text-brand-muted"
                          : isPositive
                          ? "text-emerald-600 dark:text-[#00e599]"
                          : "text-rose-600 dark:text-[#ff4d6d]"
                      }`}
                    >
                      {formattedChange}
                    </span>
                  </div>

                  {/* Right Column: 24H Volume */}
                  <div className="col-span-3 text-right flex items-center justify-end">
                    <span className="text-[10px] sm:text-xs font-semibold text-brand-text">
                      {formattedVol}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
