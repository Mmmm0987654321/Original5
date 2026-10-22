/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from "react";
export type TrustShieldMode = "STANDARD" | "PRIVATE" | "ANONYMOUS";

// Source-backed local display descriptions shared by popup and Settings.
// Mode behavior is defined by isFieldHidden; these strings grant no security.
export const TRUST_SHIELD_MODE_INFO: Record<TrustShieldMode, {
  title: string; subtitle: string; description: string; features: readonly string[];
}> = {
  STANDARD: {
    title: "Standard Mode", subtitle: "Normal display",
    description: "No Trust Shield masking in supported screens. Balances and available histories display normally.",
    features: [
      "Balances and portfolio values are not masked by Trust Shield",
      "Supported history and analytics fields remain visible",
      "Wallet addresses use short format in the UI in all modes"
    ]
  },
  PRIVATE: {
    title: "Private Mode", subtitle: "Hide selected details",
    description: "Masks balances until local unlock. Hides supported histories, analytics, profile and sharing fields.",
    features: [
      "Balances and portfolio values masked until local unlock",
      "Supported trade, position, order and funding history hidden",
      "Supported analytics, profile, sharing and export fields hidden"
    ]
  },
  ANONYMOUS: {
    title: "Anonymous Mode", subtitle: "Hide more account details",
    description: "Masks balances until local unlock. Hides supported histories, analytics, profile and account details.",
    features: [
      "Balances and portfolio values masked until local unlock",
      "Supported trade, order and funding history and analytics hidden",
      "Additional supported profile, account and sharing fields hidden"
    ]
  }
};
export const TRUST_SHIELD_DISPLAY_NOTICE =
  "Display privacy only. Wallet activity and transactions remain publicly traceable on-chain.";

const StorageAdapter = {
  getMode: (): TrustShieldMode => {
    if (typeof window === "undefined") return "STANDARD";
    return (localStorage.getItem("aether_trust_shield_mode") as TrustShieldMode) || "STANDARD";
  },
  setMode: (mode: TrustShieldMode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_trust_shield_mode", mode);
    }
  },
  getPopupSeen: (): boolean => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("aether_trust_shield_popup_seen") === "true";
  },
  setPopupSeen: (seen: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_trust_shield_popup_seen", seen ? "true" : "false");
    }
  },
  getHidePortfolioPrivate: (): boolean => {
    if (typeof window === "undefined") return true;
    const val = localStorage.getItem("aether_trust_shield_hide_portfolio");
    return val === null ? true : val === "true";
  },
  setHidePortfolioPrivate: (hide: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_trust_shield_hide_portfolio", hide ? "true" : "false");
    }
  }
};

interface TrustShieldContextProps {
  mode: TrustShieldMode;
  popupSeen: boolean;
  hidePortfolioPrivate: boolean;
  tempRevealed: Record<string, boolean>;
  setMode: (mode: TrustShieldMode) => void;
  setPopupSeen: (seen: boolean) => void;
  setHidePortfolioPrivate: (hide: boolean) => void;
  toggleTempReveal: (key: string) => void;
  isFieldHidden: (key: string) => boolean;
  formatWalletAddress: (address: string) => string;
  resetAll: () => void;
  resetPopupStatus: () => void;
}

const TrustShieldContext = createContext<TrustShieldContextProps | undefined>(undefined);

export const TrustShieldProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<TrustShieldMode>(() => {
    return StorageAdapter.getMode();
  });

  const [popupSeen, setPopupSeenState] = useState<boolean>(() => {
    return StorageAdapter.getPopupSeen();
  });

  const [hidePortfolioPrivate, setHidePortfolioPrivateState] = useState<boolean>(() => {
    return StorageAdapter.getHidePortfolioPrivate();
  });

  // Memory state for temporary session-based reveals
  const [tempRevealed, setTempRevealed] = useState<Record<string, boolean>>({});

  const setMode = (newMode: TrustShieldMode) => {
    // A reveal in Standard/another privacy mode must never leak into a new mode.
    setTempRevealed({});
    setModeState(newMode);
    StorageAdapter.setMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.removeItem("privacy_unlocked");
      sessionStorage.removeItem("funds_unlocked");
      window.dispatchEvent(new CustomEvent("trust-shield-mode-changed", { detail: { mode: newMode } }));
    }
  };

  const setPopupSeen = (seen: boolean) => {
    setPopupSeenState(seen);
    StorageAdapter.setPopupSeen(seen);
  };

  const setHidePortfolioPrivate = (hide: boolean) => {
    setHidePortfolioPrivateState(hide);
    StorageAdapter.setHidePortfolioPrivate(hide);
  };

  const toggleTempReveal = (key: string) => {
    setTempRevealed((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isFieldHidden = (key: string): boolean => {
    // If temporarily revealed in this session, it's not hidden
    if (tempRevealed[key]) return false;

    if (mode === "STANDARD") {
      return false;
    }

    const isUnlocked = typeof window !== "undefined" && (
      localStorage.getItem("privacy_unlocked") === "true" || 
      sessionStorage.getItem("funds_unlocked") === "true"
    );

    if (mode === "PRIVATE") {
      // In private mode:
      // If locked, portfolio and balance are hidden. If unlocked, they are visible!
      if (key === "portfolio" || key === "balance" || key === "balances") {
        return !isUnlocked;
      }
      // - Trade, Position, Order, Funding history, referral, etc. are hidden completely
      if (
        [
          "tradeHistory",
          "positionHistory",
          "orderHistory",
          "fundingHistory",
          "twapHistory",
          "leaderboard",
          "analytics",
          "shareCard",
          "sharePosition",
          "referral",
          "profile",
          "exportCsv",
          "downloadHistory"
        ].includes(key)
      ) {
        return true;
      }
      return false;
    }

    if (mode === "ANONYMOUS") {
      // In anonymous mode:
      // If locked, portfolio and balance are hidden. If unlocked, they are visible!
      if (key === "portfolio" || key === "balance" || key === "balances") {
        return !isUnlocked;
      }
      // In anonymous mode, historical, settings, analytical and profile panels are hidden completely
      return [
        "tradeHistory",
        "orderHistory",
        "fundingHistory",
        "twapHistory",
        "leaderboard",
        "analytics",
        "referral",
        "sharePosition",
        "profile",
        "userName",
        "accountInfo",
        "shareCard",
        "fundingBottom"
      ].includes(key);
    }

    return false;
  };

  const formatWalletAddress = (address: string): string => {
    if (!address) return "";
    
    // Always show the short address format (e.g. 0x3C44...93BC) for all modes,
    // including STANDARD, PRIVATE, and ANONYMOUS.
    if (address.length > 10) {
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    return address;
  };

  const resetAll = () => {
    setMode("STANDARD");
    setHidePortfolioPrivate(true);
    setTempRevealed({});
  };

  const resetPopupStatus = () => {
    setPopupSeen(false);
  };

  return (
    <TrustShieldContext.Provider
      value={{
        mode,
        popupSeen,
        hidePortfolioPrivate,
        tempRevealed,
        setMode,
        setPopupSeen,
        setHidePortfolioPrivate,
        toggleTempReveal,
        isFieldHidden,
        formatWalletAddress,
        resetAll,
        resetPopupStatus,
      }}
    >
      {children}
    </TrustShieldContext.Provider>
  );
};

export const useTrustShield = () => {
  const context = useContext(TrustShieldContext);
  if (!context) {
    throw new Error("useTrustShield must be used within a TrustShieldProvider");
  }
  return context;
};
