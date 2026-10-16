/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, RefreshCw, Globe, Palette, Type, Sliders, Check, ChevronDown, Shield, Eye, Lock } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";
import { hasPrivacyPassword, setPrivacyPassword, verifyPrivacyPassword } from "../../lib/privacyPassword";
import { useTrustShield, TRUST_SHIELD_MODE_INFO, TRUST_SHIELD_DISPLAY_NOTICE } from "../../lib/TrustShieldManager";

// Theme profiles, including monochrome black and white options.
export interface ThemeProfile {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  accentColor: string; // Hex for preview
  bgPreview: string; // Hex for preview
  variables: Record<string, string>;
}

export const THEME_PROFILES: ThemeProfile[] = [
  {
    id: "cosmic-slate",
    name: "Cosmic Slate",
    emoji: "🌌",
    tagline: "Default Dark",
    description: "The original beautiful dark slate theme. Relaxed, deep contrast, with glowing green accents.",
    accentColor: "#00E878",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#00E878",
      "--accent-secondary": "rgba(0, 232, 120, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#00E878",
      "--color-loss": "#FF5C7A",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "hyper-gold",
    name: "Royal Yield",
    emoji: "👑",
    tagline: "Prestige Wealth",
    description: "Rich black-gold aesthetic. Radiates premium elite status and successful curation.",
    accentColor: "#FFD700",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#FFD700",
      "--accent-secondary": "rgba(255, 215, 0, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#00E878",
      "--color-loss": "#FF5C7A",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "neon-overdrive",
    name: "Dracula",
    emoji: "🧛",
    tagline: "Vampire Purple",
    description: "Deep Dracula purple. Iconic dark theme designed for ultimate readability.",
    accentColor: "#BD93F9",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#BD93F9",
      "--accent-secondary": "rgba(189, 147, 249, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#50fa7b",
      "--color-loss": "#ff5555",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "ocean-calm",
    name: "Tokyo Night",
    emoji: "🌌",
    tagline: "Neon Twilight",
    description: "High-octane teal and deep violet. Deeply immersive and visually arresting.",
    accentColor: "#7AA2F7",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#7AA2F7",
      "--accent-secondary": "rgba(122, 162, 247, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#9ece6a",
      "--color-loss": "#f7768e",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "emerald-bull",
    name: "Emerald Sovereign",
    emoji: "🐉",
    tagline: "Bullish Prosperity",
    description: "Deep emerald-jade. Evokes steady long-term compounding growth and green candles.",
    accentColor: "#10B981",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#10B981",
      "--accent-secondary": "rgba(16, 185, 129, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#10B981",
      "--color-loss": "#EF4444",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "crimson-venom",
    name: "Viper Crimson",
    emoji: "🐻",
    tagline: "Hyper Reactive",
    description: "Alert blood-red theme. Maximum attention lock for scalping and volatile swings.",
    accentColor: "#FF334B",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#FF334B",
      "--accent-secondary": "rgba(255, 51, 75, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#00FF88",
      "--color-loss": "#FF334B",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "tokyo-cyber",
    name: "Based Orange",
    emoji: "🍊",
    tagline: "Cyberpunk Amber",
    description: "High-octane neon amber and orange. Sophisticated, bold, and visually arresting.",
    accentColor: "#FF6B00",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#FF6B00",
      "--accent-secondary": "rgba(255, 107, 0, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#00FF99",
      "--color-loss": "#FF2B55",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "stealth-matte",
    name: "Stealth Carbon",
    emoji: "🕶️",
    tagline: "Total Neutrality",
    description: "Monochrome carbon shades. Eliminates psychological color biases completely.",
    accentColor: "#94A3B8",
    bgPreview: "#060608",
    variables: {
      "--bg-main": "#060608",
      "--bg-secondary": "#0c0d12",
      "--bg-card": "#12131a",
      "--bg-elevated": "#1a1b24",
      "--border-brand": "#1f212a",
      "--accent-primary": "#E4E4E7",
      "--accent-secondary": "rgba(255, 255, 255, 0.1)",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E2E8F0",
      "--text-muted": "#8e929e",
      "--divider-brand": "#1f212a",
      "--color-profit": "#A3E635",
      "--color-loss": "#F87171",
      "--bg-overlay-subtle": "rgba(255, 255, 255, 0.01)",
      "--bg-overlay-normal": "rgba(255, 255, 255, 0.03)",
      "--bg-overlay-active": "rgba(255, 255, 255, 0.07)"
    }
  },
  {
    id: "light",
    name: "Classic Light",
    emoji: "☀️",
    tagline: "Daylight Focus",
    description: "Light mode optimized for outdoors or well-lit rooms. Minimizes squinting.",
    accentColor: "#3B82F6",
    bgPreview: "#FFFFFF",
    variables: {
      "--bg-main": "#FFFFFF",
      "--bg-secondary": "#F8FAFC",
      "--bg-card": "#FFFFFF",
      "--bg-elevated": "#F1F5F9",
      "--border-brand": "#E2E8F0",
      "--accent-primary": "#3B82F6",
      "--accent-secondary": "#EFF6FF",
      "--text-primary": "#0A0F1D",
      "--text-secondary": "#334155",
      "--text-muted": "#64748B",
      "--divider-brand": "#E2E8F0",
      "--color-profit": "#10B981",
      "--color-loss": "#EF4444",
      "--bg-overlay-subtle": "rgba(15, 23, 42, 0.02)",
      "--bg-overlay-normal": "rgba(15, 23, 42, 0.05)",
      "--bg-overlay-active": "rgba(15, 23, 42, 0.1)"
    }
  },
  {
    id: "mono-light",
    name: "Mono White",
    emoji: "◻️",
    tagline: "Pure White & Black",
    description: "White surfaces, black type and minimal neutral gray.",
    accentColor: "#111111",
    bgPreview: "#FFFFFF",
    variables: {
      "--bg-main": "#FFFFFF",
      "--bg-secondary": "#FAFAFA",
      "--bg-card": "#FFFFFF",
      "--bg-elevated": "#F2F2F2",
      "--border-brand": "#D9D9D9",
      "--accent-primary": "#111111",
      "--accent-secondary": "#F0F0F0",
      "--text-primary": "#111111",
      "--text-secondary": "#303030",
      "--text-muted": "#707070",
      "--divider-brand": "#D9D9D9",
      "--color-profit": "#272727",
      "--color-loss": "#626262",
      "--bg-overlay-subtle": "rgba(0,0,0,0.02)",
      "--bg-overlay-normal": "rgba(0,0,0,0.05)",
      "--bg-overlay-active": "rgba(0,0,0,0.10)"
    }
  },
  {
    id: "mono-dark",
    name: "Mono Black",
    emoji: "◼️",
    tagline: "Pure Black & White",
    description: "Black surfaces, white type and minimal neutral gray.",
    accentColor: "#FAFAFA",
    bgPreview: "#050505",
    variables: {
      "--bg-main": "#050505",
      "--bg-secondary": "#0A0A0A",
      "--bg-card": "#101010",
      "--bg-elevated": "#191919",
      "--border-brand": "#303030",
      "--accent-primary": "#FAFAFA",
      "--accent-secondary": "#262626",
      "--text-primary": "#FAFAFA",
      "--text-secondary": "#D6D6D6",
      "--text-muted": "#9C9C9C",
      "--divider-brand": "#303030",
      "--color-profit": "#FAFAFA",
      "--color-loss": "#989898",
      "--bg-overlay-subtle": "rgba(255,255,255,0.02)",
      "--bg-overlay-normal": "rgba(255,255,255,0.05)",
      "--bg-overlay-active": "rgba(255,255,255,0.10)"
    }
  }
];

export interface FontItem {
  name: string;
  family: string;
  category: "sans" | "serif" | "mono" | "display";
}

export const PREMIUM_FONTS: FontItem[] = [
  { name: "Inter", family: "Inter", category: "sans" },
  { name: "Space Grotesk", family: "Space Grotesk", category: "display" },
  { name: "Open Sans", family: "Open Sans", category: "sans" },
  { name: "Roboto", family: "Roboto", category: "sans" },
  { name: "Montserrat", family: "Montserrat", category: "sans" },
  { name: "Lato", family: "Lato", category: "sans" },
  { name: "Poppins", family: "Poppins", category: "sans" },
  { name: "Plus Jakarta Sans", family: "Plus Jakarta Sans", category: "sans" },
  { name: "DM Sans", family: "DM Sans", category: "sans" },
  { name: "Playfair Display", family: "Playfair Display", category: "serif" },
  { name: "Merriweather", family: "Merriweather", category: "serif" },
  { name: "Georgia", family: "Georgia", category: "serif" },
  { name: "JetBrains Mono", family: "JetBrains Mono", category: "mono" },
  { name: "Fira Code", family: "Fira Code", category: "mono" },
  { name: "Source Code Pro", family: "Source Code Pro", category: "mono" },
  { name: "IBM Plex Mono", family: "IBM Plex Mono", category: "mono" },
  { name: "Rubik", family: "Rubik", category: "sans" },
  { name: "Syne", family: "Syne", category: "display" },
  { name: "Outfit", family: "Outfit", category: "display" },
  { name: "Sora", family: "Sora", category: "sans" },
  { name: "Epilogue", family: "Epilogue", category: "sans" },
  { name: "Manrope", family: "Manrope", category: "sans" },
  { name: "Raleway", family: "Raleway", category: "sans" },
  { name: "Oswald", family: "Oswald", category: "sans" },
  { name: "Work Sans", family: "Work Sans", category: "sans" }
];

// Helper to inject Google Fonts dynamically in document head
const loadGoogleFont = (fontName: string) => {
  if (typeof window === "undefined" || !fontName) return;
  const fontId = `gf-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(fontId)) return;
  
  const link = document.createElement("link");
  link.id = fontId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
};

// Apply custom CSS variable settings to DOM
export const applyPreferencesToDOM = (
  themeId: string,
  fontSizePercent: number,
  headersFont: string = "Inter",
  numbersFont: string = "JetBrains Mono"
) => {
  const doc = document.documentElement;
  // Freeze palette-sensitive animations during the atomic theme commit.
  // They otherwise repaint old foreground/new background in separate frames.
  doc.classList.add("hidedex-theme-commit");
  const commitSequence = (Number(doc.dataset.hdxThemeCommit || "0") + 1);
  doc.dataset.hdxThemeCommit = String(commitSequence);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (doc.dataset.hdxThemeCommit === String(commitSequence)) {
      doc.classList.remove("hidedex-theme-commit");
    }
  }));

  // 1. Base Font Size (scales rem sizing instantly based on user input percentage!)
  doc.style.fontSize = `${fontSizePercent}%`;

  // Pre-load dynamic Google Fonts in the document
  loadGoogleFont(headersFont);
  loadGoogleFont(numbersFont);

  // 2. Set Fonts on DOM using fallback logic
  doc.style.setProperty("--font-sans", `"${headersFont}", ui-sans-serif, system-ui, sans-serif`);
  doc.style.setProperty("--font-display", `"${headersFont}", ui-sans-serif, system-ui, sans-serif`);
  doc.style.setProperty("--font-mono", `"${numbersFont}", ui-monospace, SFMono-Regular, monospace`);

  // 3. Theme CSS Properties
  const selectedTheme = THEME_PROFILES.find((t) => t.id === themeId) || THEME_PROFILES.find((t) => t.id === "light")!;
  Object.entries(selectedTheme.variables).forEach(([key, value]) => {
    doc.style.setProperty(key, value);
  });

  // Toggle .light classes correctly
  if (themeId === "light" || themeId === "mono-light") {
    doc.classList.add("light");
    doc.classList.remove("dark");
  } else {
    doc.classList.remove("light");
    doc.classList.add("dark");
  }
};

// Miniature Terminal layout representing a preview card for each theme in Theme Options (Screenshot 2 style)
function MiniTerminalPreview({ 
  themeId,
  accentColor, 
  bgPreview, 
  name, 
  tagline,
  isSelected, 
  onClick 
}: { 
  themeId: string;
  accentColor: string; 
  bgPreview: string; 
  name: string; 
  tagline: string;
  isSelected: boolean; 
  onClick: () => void;
}) {
  const isLight = themeId === "light" || themeId === "mono-light";
  const panelBg = themeId === "mono-dark" ? "#121212" : isLight ? "#F8FAFC" : "#111827";
  const borderCol = themeId === "mono-dark" ? "#444444" : isLight ? "#D0D5DD" : "#223247";

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border p-2.5 transition-all cursor-pointer select-none overflow-hidden flex flex-col justify-between h-[105px] ${
        isSelected
          ? "bg-brand-card"
          : "bg-brand-surface hover:bg-brand-card border-brand-border"
      }`}
      style={{
        borderColor: isSelected ? accentColor : "rgba(100, 116, 139, 0.3)",
        boxShadow: isSelected ? `0 0 10px ${accentColor}30, inset 0 0 12px ${accentColor}05` : "none"
      }}
    >
      <div className="flex-1 flex gap-2 h-full">
        {/* Left Side thick accent stripe */}
        <div className="w-1.5 h-full rounded-full" style={{ backgroundColor: accentColor }} />

        {/* Inner terminal mockup */}
        <div 
          className="flex-grow flex flex-col gap-1 rounded-lg p-1.5 border" 
          style={{ backgroundColor: bgPreview, borderColor: borderCol }}
        >
          {/* Mock Header Row */}
          <div className="flex justify-between items-center pb-1 border-b" style={{ borderColor: borderCol }}>
            <div className="flex gap-1">
              <div className="w-4 h-1 rounded-sm bg-gray-500/30" />
              <div className="w-3.5 h-1 rounded-sm bg-gray-500/15" />
            </div>
            <div className="flex gap-1 items-center">
              <div className="w-1 h-1 rounded-full bg-gray-500/30" />
              <span className="w-1.5 h-1 rounded-sm" style={{ backgroundColor: accentColor }} />
              <div className="w-1 h-1 rounded-full bg-gray-500/30" />
            </div>
          </div>

          {/* Mock Grid Panel layout */}
          <div className="flex-grow grid grid-cols-3 gap-1">
            <div className="col-span-2 rounded border p-0.5 flex flex-col justify-between" style={{ backgroundColor: panelBg, borderColor: borderCol }}>
              <div className="w-full h-1 bg-gray-500/15 rounded-sm" />
              <div className="w-3/4 h-1 bg-gray-500/10 rounded-sm" />
            </div>
            <div className="rounded border p-0.5 flex flex-col justify-between animate-pulse" style={{ backgroundColor: panelBg, borderColor: borderCol }}>
              <div className="w-full h-1 bg-gray-500/20 rounded-sm" />
              <div className="w-1/2 h-1 bg-gray-500/10 rounded-sm" />
            </div>
          </div>

          {/* Buy Sell Indicator Bars */}
          <div className="flex justify-end gap-1 mt-0.5">
            <div className="w-5 h-0.5 rounded-full bg-emerald-400/80 animate-pulse" />
            <div className="w-4 h-0.5 rounded-full bg-rose-400/80" />
          </div>
        </div>
      </div>

      {/* Theme Info Block */}
      <div className="flex justify-between items-center mt-1 px-1">
        <span className="text-[10px] font-black text-brand-text uppercase tracking-wide">{name}</span>
        <span className="text-[7px] text-brand-muted uppercase tracking-widest">{tagline}</span>
      </div>
    </div>
  );
}

interface TradingPreferencesModalProps {
  onClose?: () => void;
  initialSlippage?: number;
  onApplySlippage?: (val: number) => void;
  embedded?: boolean;
  onActiveTabChange?: (tab: "TRADE_SETTING" | "TRUST_SHIELD" | "THEME" | "TEXT_STYLE") => void;
}

type TabType = "TRADE_SETTING" | "TRUST_SHIELD" | "THEME" | "TEXT_STYLE";

export default function TradingPreferencesModal({
  onClose,
  initialSlippage = 0.5,
  onApplySlippage,
  embedded = false,
  onActiveTabChange,
}: TradingPreferencesModalProps) {
  const { t } = useLanguage();
  const { mode: currentShieldMode, setMode: setShieldMode, resetPopupStatus } = useTrustShield();

  const closeSettings = () => {
    if (!embedded) {
      onClose?.();
    }
  };

  // Active Preference states inside the modal
  const [activeTab, setActiveTab] = useState<TabType>("TRADE_SETTING");
  const [resetFeedback, setResetFeedback] = useState<string>("");
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [selectedShieldMode, setSelectedShieldMode] = useState<typeof currentShieldMode>(currentShieldMode);

  const [newPassword, setNewPassword] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [isPasswordSet, setIsPasswordSet] = useState(() => {
    return hasPrivacyPassword();
  });

  // Compact password creation and updates states
  const [showCompactCreatePassword, setShowCompactCreatePassword] = useState(false);
  const [showCompactVerifyPassword, setShowCompactVerifyPassword] = useState(false);
  const [pendingShieldMode, setPendingShieldMode] = useState<typeof currentShieldMode | null>(null);
  const [compactPasswordInput, setCompactPasswordInput] = useState("");
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);
  const [compactPasswordError, setCompactPasswordError] = useState("");
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);

  // 1. Trade settings states
  const [slippage, setSlippage] = useState<number>(() => {
    const saved = localStorage.getItem("pref_slippage");
    return saved ? parseFloat(saved) : initialSlippage;
  });
  const [isCustomSlippage, setIsCustomSlippage] = useState<boolean>(() => {
    const saved = localStorage.getItem("pref_slippage");
    const val = saved ? parseFloat(saved) : 0.5;
    return ![0.1, 0.5, 1.0, 3.0].includes(val);
  });
  const [defaultOrderType, setDefaultOrderType] = useState<"MARKET" | "LIMIT">(() => {
    return (localStorage.getItem("pref_order_type") as "MARKET" | "LIMIT") || "MARKET";
  });
  const [defaultLeverage, setDefaultLeverage] = useState<number>(() => {
    const saved = localStorage.getItem("pref_leverage");
    return saved ? parseInt(saved) : 10;
  });
  const [reduceOnlyDefault, setReduceOnlyDefault] = useState<boolean>(() => {
    return localStorage.getItem("pref_reduce_only") === "true";
  });
  const [quickOrderConfirm, setQuickOrderConfirm] = useState<"ASK" | "SESSION" | "DEVICE">(() => {
    const saved = localStorage.getItem("pref_quick_order_confirm");
    if (saved === "ASK" || saved === "SESSION" || saved === "DEVICE") return saved;
    return "ASK";
  });

  // 3. Theme selection state
  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    return localStorage.getItem("pref_theme_id") || "light";
  });

  const handleSelectTheme = (themeId: string) => {
    // Theme cards are immediately interactive, including Mono Black / White.
    // Persist the complete theme ID (not only light/dark), and sync other
    // consumers such as the navbar without waiting for the bottom Apply button.
    setSelectedThemeId(themeId);
    localStorage.setItem("pref_theme_id", themeId);
    const variant = (themeId === "light" || themeId === "mono-light") ? "light" : "dark";
    localStorage.setItem("anon_theme", variant);
    applyPreferencesToDOM(themeId, fontSizePercent, headersFont, numbersFont);
    window.dispatchEvent(new Event("preferences-updated"));
  };

  // 4. Custom font dropdowns (Screenshot 1 Premium Font Style Customizer)
  const [headersFont, setHeadersFont] = useState<string>(() => {
    return localStorage.getItem("pref_headers_font") || "Inter";
  });
  const [numbersFont, setNumbersFont] = useState<string>(() => {
    return localStorage.getItem("pref_numbers_font") || "JetBrains Mono";
  });

  // Slider scaling size control (MUST retain)
  const [fontSizePercent, setFontSizePercent] = useState<number>(() => {
    const saved = localStorage.getItem("pref_font_size_percent");
    if (saved) return parseInt(saved);
    const oldSize = localStorage.getItem("pref_font_size");
    if (oldSize === "small") return 85;
    if (oldSize === "large") return 115;
    if (oldSize === "xlarge") return 130;
    return 100; // default (100%)
  });

  const handleSavePassword = async (pwd: string) => {
    if (!pwd || pwd.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    try { await setPrivacyPassword(pwd); }
    catch (error) { setPasswordError(error instanceof Error ? error.message : "Unable to save password"); return; }
    setIsPasswordSet(true);
    setNewPassword("");
    setPasswordError("");
    window.dispatchEvent(new CustomEvent("trading-notification", {
      detail: {
        title: "Password Set Successfully",
        description: "Your local privacy protection password has been configured.",
        type: "success"
      }
    }));
  };

  const handleCancelCompactCreate = () => {
    setShowCompactCreatePassword(false);
    setSelectedShieldMode(currentShieldMode);
    setPendingShieldMode(null);
    setShowGeneratedPassword(false);
  };

  const handleCompactSavePassword = async () => {
    if (!compactPasswordInput || compactPasswordInput.length < 8) {
      setCompactPasswordError("Password must be at least 8 characters long.");
      return;
    }
    try { await setPrivacyPassword(compactPasswordInput); }
    catch (error) { setCompactPasswordError(error instanceof Error ? error.message : "Unable to save password"); return; }
    if (pendingShieldMode && pendingShieldMode !== "STANDARD") {
      setShieldMode(pendingShieldMode);
      setSelectedShieldMode(pendingShieldMode);
    }
    setPendingShieldMode(null);
    setShowGeneratedPassword(false);
    setIsPasswordSet(true);
    setCompactPasswordInput("");
    setCompactPasswordError("");
    setShowCompactCreatePassword(false);

    // Automatically remember unlock for session
    localStorage.setItem("privacy_unlocked", "true");
    sessionStorage.setItem("funds_unlocked", "true");

    window.dispatchEvent(new CustomEvent("trading-notification", {
      detail: {
        title: "Password Set Successfully",
        description: "Your local privacy protection password has been configured.",
        type: "success"
      }
    }));
  };

  const handleCancelCompactVerify = () => {
    setShowCompactVerifyPassword(false);
    setPendingShieldMode(null);
    setCompactPasswordInput("");
    setCompactPasswordError("");
    // Revert selection back to active mode
    setSelectedShieldMode(currentShieldMode);
  };

  const handleCompactVerifyPassword = async () => {
    if (await verifyPrivacyPassword(compactPasswordInput).catch(() => false)) {
      if (pendingShieldMode) {
        setSelectedShieldMode(pendingShieldMode);
        setShieldMode(pendingShieldMode);
        
        // Automatically mark as unlocked so funds are visible
        localStorage.setItem("privacy_unlocked", "true");
        sessionStorage.setItem("funds_unlocked", "true");
      }
      setShowCompactVerifyPassword(false);
      setPendingShieldMode(null);
      setCompactPasswordInput("");
      setCompactPasswordError("");

      window.dispatchEvent(new CustomEvent("trading-notification", {
        detail: {
          title: "Session Authorized",
          description: "Privacy mode transition successfully authorized.",
          type: "success"
        }
      }));
    } else {
      setCompactPasswordError("Incorrect password. Please try again.");
    }
  };

  const handleUpdatePassword = async () => {
    const authorized = await verifyPrivacyPassword(currentPasswordInput).catch(() => false);
    if (!authorized) {
      setPasswordError("Enter your current password before changing it.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    try { await setPrivacyPassword(newPassword); }
    catch (error) { setPasswordError(error instanceof Error ? error.message : "Unable to save password"); return; }
    setIsPasswordSet(true);
    setNewPassword("");
    setCurrentPasswordInput("");
    setPasswordError("");
    setShowChangePasswordForm(false);

    window.dispatchEvent(new CustomEvent("trading-notification", {
      detail: {
        title: "Password Changed",
        description: "Your privacy protection password has been updated.",
        type: "success"
      }
    }));
  };

  // A mode tab selects a preview; no mode is activated until Apply Mode.
  const handleModeChange = (modeId: "STANDARD" | "PRIVATE" | "ANONYMOUS") => {
    setSelectedShieldMode(modeId);
  };

  const handleApplyPrivacyMode = () => {
    if (selectedShieldMode === currentShieldMode) return;
    const hasPassword = hasPrivacyPassword();
    const downgrade = (currentShieldMode === "ANONYMOUS" && selectedShieldMode !== "ANONYMOUS")
      || (currentShieldMode === "PRIVATE" && selectedShieldMode === "STANDARD");
    setPendingShieldMode(selectedShieldMode);
    setCompactPasswordInput("");
    setCompactPasswordError("");
    if (downgrade && hasPassword) {
      setShowCompactVerifyPassword(true);
    } else if (selectedShieldMode !== "STANDARD" && !hasPassword) {
      setShowGeneratedPassword(false);
      setShowCompactCreatePassword(true);
    } else {
      setShieldMode(selectedShieldMode);
      setPendingShieldMode(null);
    }
  };

  const generateLocalPrivacyPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    const bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    setCompactPasswordInput(Array.from(bytes, value => alphabet[value % alphabet.length]).join(""));
    setShowGeneratedPassword(true);
    setCompactPasswordError("");
  };

  // Sync selectedShieldMode with currentShieldMode on mount/change
  useEffect(() => {
    setSelectedShieldMode(currentShieldMode);
  }, [currentShieldMode]);

  // Trigger Google Font lazy-loading whenever dropdown selections change
  useEffect(() => {
    loadGoogleFont(headersFont);
    loadGoogleFont(numbersFont);
  }, [headersFont, numbersFont]);

  // Apply visual settings to local DOM on mount as safety check
  useEffect(() => {
    applyPreferencesToDOM(selectedThemeId, fontSizePercent, headersFont, numbersFont);
  }, []);

  const handleApplySettings = () => {
    // 1. Save all settings to localStorage for persistent configuration
    localStorage.setItem("pref_slippage", slippage.toString());
    localStorage.setItem("pref_order_type", defaultOrderType);
    localStorage.setItem("pref_leverage", defaultLeverage.toString());
    localStorage.setItem("pref_reduce_only", reduceOnlyDefault ? "true" : "false");
    localStorage.setItem("pref_quick_order_confirm", quickOrderConfirm);
    localStorage.setItem("pref_theme_id", selectedThemeId);
    localStorage.setItem("pref_font_size_percent", fontSizePercent.toString());
    localStorage.setItem("pref_headers_font", headersFont);
    localStorage.setItem("pref_numbers_font", numbersFont);

    // Privacy mode activation is handled solely by Apply Mode + password flow.

    // Save actual theme value used by navbar/app state
    localStorage.setItem("anon_theme", (selectedThemeId === "light" || selectedThemeId === "mono-light") ? "light" : "dark");

    // 2. Apply styling changes immediately on the DOM tree
    applyPreferencesToDOM(selectedThemeId, fontSizePercent, headersFont, numbersFont);

    // 4. Update callback slippage if defined
    if (onApplySlippage) {
      onApplySlippage(slippage);
    }

    // Trigger local events to notify charts or panels
    window.dispatchEvent(new Event("preferences-updated"));
    window.dispatchEvent(new CustomEvent("trading-notification", {
      detail: {
        title: "Preferences Applied",
        description: "Your terminal visual themes, font sizes, and trading settings were updated successfully.",
        type: "success"
      }
    }));

    if (!embedded) {
      onClose?.();
    }
  };

  const handleResetSettings = () => {
    setIsResetting(true);
    let feedbackStr = "";
    let descriptionStr = "";

    if (activeTab === "TRADE_SETTING") {
      setSlippage(0.5);
      setIsCustomSlippage(false);
      setDefaultOrderType("MARKET");
      setDefaultLeverage(10);
      setReduceOnlyDefault(false);
      setQuickOrderConfirm("ASK");
      feedbackStr = "Trade Reset! ✓";
      descriptionStr = "Trading parameters reverted to default config.";
    } else if (activeTab === "TRUST_SHIELD") {
      setSelectedShieldMode("STANDARD");
      feedbackStr = "Shield Reset! ✓";
      descriptionStr = "Trust Shield privacy mode reset to Standard.";
    } else if (activeTab === "THEME") {
      setSelectedThemeId("light");
      feedbackStr = "Theme Reset! ✓";
      descriptionStr = "Color scheme reverted to Cosmic Slate theme.";
    } else if (activeTab === "TEXT_STYLE") {
      setFontSizePercent(100);
      setHeadersFont("Inter");
      setNumbersFont("JetBrains Mono");
      feedbackStr = "Text Style Reset! ✓";
      descriptionStr = "Fonts and size scaling reverted to default Inter & JetBrains Mono.";
    }

    setResetFeedback(feedbackStr);

    window.dispatchEvent(new CustomEvent("trading-notification", {
      detail: {
        title: "Section Reset Successfully",
        description: `${descriptionStr} Click 'Apply Settings' to finalize and save these changes.`,
        type: "info"
      }
    }));

    // Revert button feedback after 1.5 seconds
    setTimeout(() => {
      setIsResetting(false);
      setResetFeedback("");
    }, 1500);
  };

  return (
    <div
      className={
        embedded
          ? "w-full"
          : "fixed inset-0 z-50 flex items-center justify-center p-4"
      }
    >
      {/* Semi-transparent backdrop with micro blurring */}
      {!embedded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onClose?.()}
          className="fixed inset-0 bg-[#07080e]/65 backdrop-blur-[2px]"
        />
      )}

      {/* Main Container - Styled beautifully matching screenshot aspect ratios */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className={
          embedded
            ? "relative w-full bg-transparent flex flex-col text-left font-sans overflow-visible"
            : "relative w-full max-w-[390px] sm:max-w-[540px] md:max-w-[660px] lg:max-w-[740px] bg-brand-card border border-brand-border rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden text-left font-sans h-[540px] sm:h-[580px] md:h-[640px] max-h-[90vh]"
        }
      >
        {/* Simple header without the decorative green dot or a nested header border */}
        {!embedded && <div className="flex items-center justify-between px-4 py-3.5 border-b border-brand-border bg-brand-surface">
          <div className="flex items-center gap-2 select-none">
            <h2 className="text-brand-text font-extrabold text-xs uppercase tracking-wider">
              {t("trading_settings")}
            </h2>
          </div>
          {!embedded && (
            <button
              onClick={() => onClose?.()}
              className="p-1.5 rounded text-brand-muted hover:text-brand-text hover:bg-brand-overlay-normal transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>}

        {/* Tab Navigation Row - 5 Buttons in user-specified order */}
        <div className={embedded ? "flex gap-1 overflow-x-auto scrollbar-none select-none px-1 pb-1 border-b border-brand-border/40" : "flex gap-0.5 overflow-x-auto scrollbar-none select-none border-b border-brand-border bg-brand-surface px-2.5"}>
          {[
            { id: "TRADE_SETTING" as const, label: embedded ? "Trading" : t("trade_setting"), icon: Sliders },
            { id: "TRUST_SHIELD" as const, label: embedded ? "Privacy" : t("privacy_trust"), icon: Shield },
            { id: "THEME" as const, label: t("theme"), icon: Palette },
            { id: "TEXT_STYLE" as const, label: embedded ? "Text" : t("text_style"), icon: Type },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); onActiveTabChange?.(tab.id); }}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-3 text-[11px] sm:text-xs font-semibold tracking-normal transition-all border-b-2 cursor-pointer relative shrink-0 whitespace-nowrap ${
                  isActive
                    ? "text-accent border-accent font-black"
                    : "text-brand-muted border-transparent hover:text-brand-text"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-brand-muted"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Middle Body View Container */}
        <div className={embedded ? "px-1.5 sm:px-3 py-3 bg-transparent text-brand-text select-none" : "flex-1 overflow-y-auto p-4 bg-brand-bg text-brand-text select-none"}>
          <AnimatePresence mode="wait">
            {activeTab === "TRADE_SETTING" && (
              <motion.div
                key="trade_setting"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-3.5 font-sans"
              >
                {/* 1. Slippage tolerance presets & Custom */}
                <div className="space-y-3 bg-brand-surface/60 rounded-2xl border border-brand-border p-4 sm:p-5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-text font-semibold">Slippage</span>
                    <span className="text-accent font-bold">{slippage.toFixed(1)}%</span>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[0.1, 0.5, 1.0, 3.0].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setSlippage(val);
                          setIsCustomSlippage(false);
                        }}
                        className={`min-h-[38px] py-2 rounded-lg text-[11px] sm:text-xs font-semibold tracking-normal border transition-all cursor-pointer ${
                          !isCustomSlippage && slippage === val
                            ? "bg-accent/10 text-accent border-accent"
                            : "bg-brand-card text-brand-muted border-brand-border hover:text-brand-text"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCustomSlippage(true)}
                      className={`min-h-[38px] py-2 rounded-lg text-[11px] sm:text-xs font-semibold tracking-normal border transition-all cursor-pointer ${
                        isCustomSlippage
                          ? "bg-accent/10 text-accent border-accent"
                          : "bg-brand-card text-brand-muted border-brand-border hover:text-brand-text"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {isCustomSlippage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2 pt-2"
                    >
                      <input
                        type="range"
                        min="0.1"
                        max="15.0"
                        step="0.1"
                        value={slippage}
                        onChange={(e) => setSlippage(parseFloat(e.target.value))}
                        className="w-full h-1 bg-brand-surface rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] text-brand-muted font-mono">
                        <span>0.1%</span>
                        <span>5.0%</span>
                        <span>10.0%</span>
                        <span>15.0%</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 2. Executions and Multipliers */}
                <div className="bg-brand-surface/60 rounded-2xl border border-brand-border p-4 sm:p-5 space-y-4">
                  <span className="text-sm text-brand-text font-semibold block">Order Defaults</span>

                  {/* Order Type */}
                  <div className="flex justify-between items-center gap-3 text-sm">
                    <div><span className="font-medium text-brand-text block">Order Type</span></div>
                    <div className="flex border border-brand-border rounded-lg overflow-hidden bg-brand-card p-0.5">
                      {["MARKET", "LIMIT"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDefaultOrderType(type as any)}
                          className={`px-3 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            defaultOrderType === type
                              ? "bg-accent text-neutral-950 font-black shadow"
                              : "text-brand-muted hover:text-brand-text"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reduce Only Default */}
                  <label className="flex items-center justify-between text-sm cursor-pointer hover:text-brand-text transition-colors">
                    <div><span className="font-medium text-brand-text">Reduce Only</span></div>
                    <input
                      type="checkbox"
                      checked={reduceOnlyDefault}
                      onChange={(e) => setReduceOnlyDefault(e.target.checked)}
                      className="w-4 h-4 bg-brand-card border border-brand-border rounded cursor-pointer accent-accent"
                    />
                  </label>
                </div>

              </motion.div>
            )}

            {activeTab === "TRUST_SHIELD" && (
              <motion.div
                key="trust_shield"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-3 font-sans pb-2"
              >
                {/* 1. Trust Shield */}
                <div className="space-y-2 bg-brand-surface/60 rounded-xl border border-brand-border p-3">
                  <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5 mb-1.5">
                    <span className="text-[9px] font-black text-brand-text uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-brand-sub" />
                      Trust Shield
                    </span>
                    <span className="text-[8px] text-brand-text font-extrabold uppercase bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border/50">
                      Active: {currentShieldMode}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "STANDARD" as const, name: "Standard", color: "hover:border-emerald-500/30" },
                      { id: "PRIVATE" as const, name: "Private", color: "hover:border-amber-500/30" },
                      { id: "ANONYMOUS" as const, name: "Anonymous", color: "hover:border-violet-500/30" }
                    ].map((m) => {
                      const isSel = selectedShieldMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleModeChange(m.id)}
                          className={`py-1.5 text-[9px] font-extrabold uppercase tracking-wider rounded-lg border cursor-pointer transition-all ${
                            isSel
                              ? "bg-accent/10 border-accent text-brand-text"
                              : `bg-brand-card border-brand-border text-brand-sub hover:text-brand-text ${m.color}`
                          }`}
                        >
                          {t(m.id.toLowerCase())}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shared source-backed details. Preview is not applied until Apply Mode. */}
                <div className="rounded-xl border border-brand-border bg-brand-surface/60 p-3 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-brand-text text-sm font-bold block">
                        {TRUST_SHIELD_MODE_INFO[selectedShieldMode].title}
                      </span>
                      <span className="text-brand-muted text-xs block mt-0.5">
                        {TRUST_SHIELD_MODE_INFO[selectedShieldMode].subtitle}
                      </span>
                    </div>
                    <span className="text-brand-muted text-[11px] shrink-0">
                      {selectedShieldMode === currentShieldMode ? "Active mode" : "Preview only"}
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-brand-text leading-snug">
                    {TRUST_SHIELD_MODE_INFO[selectedShieldMode].features.map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-brand-muted leading-snug">{TRUST_SHIELD_DISPLAY_NOTICE}</p>
                  <button type="button" onClick={handleApplyPrivacyMode}
                    className="w-full min-h-[42px] rounded-lg bg-accent text-brand-bg font-bold text-xs uppercase cursor-pointer hover:opacity-90">
                    {selectedShieldMode === currentShieldMode ? "Current Mode" : t("apply_mode")}
                  </button>
                  {selectedShieldMode !== "STANDARD" && !isPasswordSet && (
                    <p className="text-[9px] text-center text-brand-sub">A local password is requested only after Apply Mode.</p>
                  )}
                </div>
                {selectedShieldMode !== "STANDARD" && isPasswordSet && (
                  <div className="p-3 rounded-xl border border-brand-border bg-brand-surface/60 space-y-2">
                    <div className="text-emerald-400 text-[10px] font-bold flex gap-2 items-center">
                      <Lock className="w-4 h-4" /> Local privacy password configured
                    </div>
                    {showChangePasswordForm ? (
                      <form onSubmit={event => {event.preventDefault();void handleUpdatePassword();}} className="space-y-2">
                        <input type="password" value={currentPasswordInput}
                          onChange={event => setCurrentPasswordInput(event.target.value)}
                          placeholder="Current privacy password"
                          autoComplete="current-password"
                          className="w-full p-2 rounded-lg border border-brand-border bg-brand-card text-brand-text text-xs" />
                        <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)}
                          placeholder="New password (minimum 8 characters)"
                          className="w-full p-2 rounded-lg border border-brand-border bg-brand-card text-brand-text text-xs" />
                        {passwordError && <p className="text-rose-400 text-xs">{passwordError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {setShowChangePasswordForm(false);setNewPassword("");setCurrentPasswordInput("");setPasswordError("");}}
                            className="flex-1 py-2 rounded-lg border border-brand-border text-xs">Cancel</button>
                          <button type="submit" className="flex-1 py-2 rounded-lg bg-accent text-brand-bg text-xs">Save</button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" onClick={() => setShowChangePasswordForm(true)}
                        className="rounded-lg px-3 py-2 text-xs border border-brand-border text-brand-text">Change Password</button>
                    )}
                  </div>
                )}
                {/* 3. Clear Anonymous Data */}
                <div className="bg-brand-surface/60 rounded-xl border border-brand-border p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                    <span className="text-[9px] font-black text-brand-text uppercase tracking-wider flex items-center gap-1">
                      <X className="w-3.5 h-3.5 text-rose-500" />
                      Clear Local Site Data
                    </span>
                  </div>
                  <p className="text-xs text-brand-muted leading-snug">
                    Clear locally saved settings, privacy preferences and cached site data. This does not erase on-chain activity or Early Access records.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowClearDataConfirm(true)}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 font-extrabold text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                  >
                    Clear Local Data
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "THEME" && (
              <motion.div
                key="theme"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                <div className="border-b border-brand-border/50 pb-2 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-brand-sub uppercase tracking-wider">Theme Options</span>
                  <span className="text-[9px] text-brand-muted font-mono font-medium">Click card to preview theme</span>
                </div>

                {/* Premium Horizontal Mock-Terminal Theme Selection Cards (Screenshot 2 style) */}
                <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                  {[...THEME_PROFILES].sort((a, b) => {
                      const featured = ["light", "mono-light", "mono-dark"];
                      const ai = featured.indexOf(a.id);
                      const bi = featured.indexOf(b.id);
                      return (ai < 0 ? featured.length : ai) - (bi < 0 ? featured.length : bi);
                    }).map((theme) => {
                    const isSelected = selectedThemeId === theme.id;
                    return (
                      <MiniTerminalPreview
                        key={theme.id}
                        themeId={theme.id}
                        accentColor={theme.accentColor}
                        bgPreview={theme.bgPreview}
                        name={theme.name}
                        tagline={theme.tagline}
                        isSelected={isSelected}
                        onClick={() => handleSelectTheme(theme.id)}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === "TEXT_STYLE" && (
              <motion.div
                key="text_style"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                {/* Customize Fonts Header */}
                <div className="flex items-center gap-1.5 border-b border-brand-border/50 pb-2">
                  <Type className="w-4 h-4 text-violet-400" />
                  <span className="text-[11px] font-extrabold text-brand-text uppercase tracking-wider">Customize Fonts</span>
                </div>

                {/* Dropdowns side-by-side or stacked exactly like Screenshot 1 */}
                <div className="grid grid-cols-1 gap-3.5">
                  {/* Headers & Labels Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-brand-sub uppercase tracking-wide block">
                      Headers & Labels
                    </label>
                    <div className="relative">
                      <select
                        value={headersFont}
                        onChange={(e) => setHeadersFont(e.target.value)}
                        className="w-full bg-brand-surface border border-brand-border rounded-xl px-3.5 py-2.5 text-xs text-brand-text font-semibold cursor-pointer appearance-none hover:border-brand-border focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        style={{ fontFamily: headersFont }}
                      >
                        {PREMIUM_FONTS.map((font) => (
                          <option 
                            key={font.name} 
                            value={font.family} 
                            style={{ fontFamily: font.family }}
                            className="bg-brand-card text-brand-text py-2"
                          >
                            {font.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-3.5 w-3.5 h-3.5 text-brand-muted pointer-events-none" />
                    </div>
                  </div>

                  {/* Numbers & Data Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-brand-sub uppercase tracking-wide block">
                      Numbers & Data
                    </label>
                    <div className="relative">
                      <select
                        value={numbersFont}
                        onChange={(e) => setNumbersFont(e.target.value)}
                        className="w-full bg-brand-surface border border-brand-border rounded-xl px-3.5 py-2.5 text-xs text-brand-text font-semibold cursor-pointer appearance-none hover:border-brand-border focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        style={{ fontFamily: numbersFont }}
                      >
                        {PREMIUM_FONTS.map((font) => (
                          <option 
                            key={font.name} 
                            value={font.family} 
                            style={{ fontFamily: font.family }}
                            className="bg-brand-card text-brand-text py-2"
                          >
                            {font.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-3.5 w-3.5 h-3.5 text-brand-muted pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Live Preview Panel exactly matching the styled mock block from Screenshot 1 */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-brand-sub uppercase tracking-wide block">
                    Preview
                  </span>

                  <div 
                    className="rounded-2xl border border-brand-border p-4 shadow-xl relative overflow-hidden transition-all duration-300 bg-brand-surface"
                  >
                    <div className="space-y-3.5">
                      {/* Token Price Title row */}
                      <div className="flex justify-between items-baseline">
                        <div>
                          <span 
                            className="text-[15px] font-extrabold text-brand-text tracking-tight block"
                            style={{ fontFamily: headersFont }}
                          >
                            BTC/USD
                          </span>
                          <span 
                            className="text-[10px] text-brand-muted block font-medium"
                            style={{ fontFamily: headersFont }}
                          >
                            Bitcoin
                          </span>
                        </div>
                        <div className="text-right">
                          <span 
                            className="text-[15px] font-extrabold text-brand-text font-mono tracking-tight block"
                            style={{ fontFamily: numbersFont }}
                          >
                            $120,250.50
                          </span>
                          <span 
                            className="text-[10px] text-emerald-500 block font-bold"
                            style={{ fontFamily: numbersFont }}
                          >
                            +2.45%
                          </span>
                        </div>
                      </div>

                      {/* Mock Order Book segment */}
                      <div className="space-y-1.5">
                        <span 
                          className="text-[9px] font-extrabold text-brand-muted uppercase tracking-wider block"
                          style={{ fontFamily: headersFont }}
                        >
                          Order Book
                        </span>
                        
                        <div className="space-y-1 font-mono text-[10px]">
                          <div className="flex justify-between items-center text-rose-500">
                            <span style={{ fontFamily: numbersFont }}>43,251.00</span>
                            <span style={{ fontFamily: numbersFont }} className="text-brand-sub font-bold">1.25</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-500">
                            <span style={{ fontFamily: numbersFont }}>43,250.50</span>
                            <span style={{ fontFamily: numbersFont }} className="text-brand-sub font-bold">2.75</span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-500">
                            <span style={{ fontFamily: numbersFont }}>43,250.00</span>
                            <span style={{ fontFamily: numbersFont }} className="text-brand-sub font-bold">1.50</span>
                          </div>
                        </div>
                      </div>

                      {/* Mock Account segment */}
                      <div className="space-y-1.5 pt-1.5 border-t border-brand-border">
                        <span 
                          className="text-[9px] font-extrabold text-brand-muted uppercase tracking-wider block"
                          style={{ fontFamily: headersFont }}
                        >
                          Account
                        </span>
                        
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-center text-brand-text">
                            <span style={{ fontFamily: headersFont }} className="text-[10px]">Balance:</span>
                            <span style={{ fontFamily: numbersFont }} className="font-mono text-[11px] font-bold">$12,345.67</span>
                          </div>
                          <div className="flex justify-between items-center text-brand-text">
                            <span style={{ fontFamily: headersFont }} className="text-[10px]">PnL:</span>
                            <span style={{ fontFamily: numbersFont }} className="font-mono text-[11px] text-emerald-500 font-bold">+$234.56</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font Size Selector (Size slider MUST be preserved as requested) */}
                <div className="space-y-2 bg-brand-surface/60 rounded-xl border border-brand-border p-3">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-[10px] font-bold text-brand-text uppercase tracking-wide">Font Scale Size</span>
                      <span className="text-[8px] text-brand-muted block mt-0.5">Scale all text and layouts relative to default</span>
                    </div>
                    <span className="text-xs font-black text-violet-400 font-mono">{fontSizePercent}%</span>
                  </div>

                  {/* Granular Slider control */}
                  <div className="space-y-2.5">
                    <input
                      type="range"
                      min="70"
                      max="130"
                      step="1"
                      value={fontSizePercent}
                      onChange={(e) => setFontSizePercent(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-brand-surface rounded-lg appearance-none cursor-pointer accent-accent border border-brand-border/40"
                    />
                    <div className="flex justify-between text-[8px] text-brand-muted font-mono font-bold">
                      <span>70% (Compact)</span>
                      <span>100% (Default)</span>
                      <span>130% (Large)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer - Styled EXACTLY like screenshot with three buttons: reset, cancel, apply */}
        <div className={embedded ? "flex items-center justify-between gap-2 px-1.5 sm:px-3 py-3.5 bg-transparent border-t border-brand-border/40 select-none" : "flex items-center justify-between gap-2 p-3.5 bg-brand-surface border-t border-brand-border select-none"}>
          {/* RESET GENERAL / SETTINGS Button */}
          <button
            type="button"
            onClick={handleResetSettings}
            disabled={isResetting}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg border transition-all cursor-pointer select-none active:scale-95 duration-200 ${
              isResetting
                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 animate-pulse font-black shadow-[0_0_8px_rgba(245,158,11,0.15)] scale-[1.02]"
                : "border-brand-border hover:border-brand-border/80 text-brand-sub hover:text-brand-text font-bold hover:bg-brand-card"
            } text-xs sm:text-sm tracking-normal`}
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? "rotate-180 transition-transform duration-500" : ""}`} />
            <span>{resetFeedback || "Reset"}</span>
          </button>

          {/* Right Action buttons (Cancel / Apply) */}
          <div className="flex items-center gap-2">
            {!embedded && (
              <button
                type="button"
                onClick={() => onClose?.()}
                className="py-1.5 px-3 rounded-lg border border-brand-border hover:border-brand-border/80 text-brand-sub hover:text-brand-text font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer select-none"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleApplySettings}
              className="min-h-[40px] py-2 px-4 bg-accent hover:opacity-90 text-brand-bg font-semibold text-xs sm:text-sm tracking-normal rounded-lg shadow-sm transition-all cursor-pointer select-none active:scale-98"
            >
              {embedded ? "Save Settings" : t("apply_settings")}
            </button>
          </div>
        </div>

        {showClearDataConfirm && (
          <div className="absolute inset-0 bg-brand-card/95 backdrop-blur-md z-[110] flex flex-col justify-center p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 mx-auto">
              <Shield className="w-6 h-6 text-rose-400 animate-pulse" />
            </div>
            
            <div className="space-y-2 text-center">
              <h3 className="text-brand-text font-extrabold text-sm uppercase tracking-wider">
                Clear HideDex Browser Data?
              </h3>
              <p className="text-[10px] text-brand-sub leading-normal font-sans">
                This clears HideDex (hidedex.com) data saved in this browser, including your local settings, privacy preferences, saved layouts, local password and wallet session settings. It does not delete your server-side Early Access application or on-chain assets.
              </p>
            </div>

            <div className="space-y-2 font-mono">
              <button
                type="button"
                onClick={() => {
                  // Clear all local data
                  if (typeof window !== "undefined") {
                    localStorage.clear();
                    sessionStorage.clear();
                    if (window.indexedDB && window.indexedDB.databases) {
                      window.indexedDB.databases().then((dbs) => {
                        dbs.forEach((db) => {
                          if (db.name) {
                            window.indexedDB.deleteDatabase(db.name);
                          }
                        });
                      }).catch(() => {}).finally(() => {
                        window.location.reload();
                      });
                    } else {
                      // Fallback if databases() is not available
                      try {
                        window.indexedDB.deleteDatabase("MarketData");
                        window.indexedDB.deleteDatabase("localforage");
                      } catch (e) {}
                      window.location.reload();
                    }
                  }
                }}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-400 text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
              >
                Wipe Local Data & Reset App
              </button>
              <button
                type="button"
                onClick={() => setShowClearDataConfirm(false)}
                className="w-full py-2.5 bg-brand-surface hover:bg-brand-card border border-brand-border text-brand-sub hover:text-brand-text font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showCompactCreatePassword && (
          <div className="absolute inset-0 bg-brand-card/95 backdrop-blur-md z-[110] flex flex-col justify-center p-6 space-y-4 animate-in fade-in zoom-in duration-200 select-none">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 mx-auto">
              <Lock className="w-5 h-5" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-brand-text font-extrabold text-xs uppercase tracking-wider font-mono">
                Create Privacy Password
              </h3>
              <p className="text-[9px] text-brand-sub max-w-[280px] mx-auto leading-relaxed font-sans">
                A password is required to secure Private/Anonymous modes. Saved purely inside your browser.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCompactSavePassword(); }} className="space-y-3 font-mono">
              <div className="space-y-1">
                <input
                  type={showGeneratedPassword ? "text" : "password"}
                  value={compactPasswordInput}
                  onChange={(e) => {
                    setCompactPasswordInput(e.target.value);
                    setCompactPasswordError("");
                  }}
                  placeholder="Min 8 characters password"
                  className="w-full bg-brand-surface border border-brand-border focus:border-accent p-2.5 rounded-xl text-[11px] text-brand-text focus:outline-none placeholder:text-brand-muted text-center"
                  autoFocus
                />
                {compactPasswordError && (
                  <div className="text-[8px] text-rose-400 font-sans text-center">{compactPasswordError}</div>
                )}
                <button type="button" onClick={generateLocalPrivacyPassword}
                  className="w-full mt-2 py-2 rounded-lg border border-accent/50 text-accent font-bold text-xs">
                  Generate Strong Password
                </button>
                <p className="text-[9px] text-brand-muted mt-1">Keep a safe copy of this local privacy password.</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelCompactCreate}
                  className="flex-1 py-2 rounded-xl border border-brand-border text-brand-sub hover:text-brand-text font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-accent hover:opacity-90 text-brand-bg font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        )}

        {showCompactVerifyPassword && (
          <div className="absolute inset-0 bg-brand-card/95 backdrop-blur-md z-[110] flex flex-col justify-center p-6 space-y-4 animate-in fade-in zoom-in duration-200 select-none">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 mx-auto animate-pulse">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-brand-text font-extrabold text-xs uppercase tracking-wider font-mono">
                Enter Privacy Password
              </h3>
              <p className="text-[9px] text-brand-sub max-w-[280px] mx-auto leading-relaxed font-sans">
                Please enter your local security password to authorize changing privacy modes.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCompactVerifyPassword(); }} className="space-y-3 font-mono">
              <div className="space-y-1">
                <input
                  type="password"
                  value={compactPasswordInput}
                  onChange={(e) => {
                    setCompactPasswordInput(e.target.value);
                    setCompactPasswordError("");
                  }}
                  placeholder="••••••••"
                  className="w-full bg-brand-surface border border-brand-border focus:border-accent p-2.5 rounded-xl text-[11px] text-brand-text focus:outline-none placeholder:text-brand-muted text-center"
                  autoFocus
                />
                {compactPasswordError && (
                  <div className="text-[8px] text-rose-400 font-sans text-center">{compactPasswordError}</div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelCompactVerify}
                  className="flex-1 py-2 rounded-xl border border-brand-border text-brand-sub hover:text-brand-text font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-accent hover:opacity-90 text-brand-bg font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
