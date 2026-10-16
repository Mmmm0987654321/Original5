export interface ShareCardPreset {
  id: string;
  name: string;
  bgGradient: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  borderRadius: string; // e.g., '12px'
  fontFamily: string; // e.g., 'font-sans' or 'font-mono'
  showPattern: boolean;
  glassy: boolean;
  gridLines: boolean;
}

export const SHARE_CARD_PRESETS: ShareCardPreset[] = [
  {
    id: "dark-pro",
    name: "Dark Professional",
    bgGradient: "linear-gradient(135deg, #090e1a 0%, #171c2a 100%)",
    bgColor: "#090e1a",
    accentColor: "#00E878", // default green, will adjust to green/red based on PnL
    textColor: "#ffffff",
    mutedTextColor: "#94a3b8",
    borderColor: "#1e293b",
    borderRadius: "16px",
    fontFamily: "Inter, sans-serif",
    showPattern: true,
    glassy: false,
    gridLines: false,
  },
  {
    id: "light-pro",
    name: "Light Professional",
    bgGradient: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    bgColor: "#f8fafc",
    accentColor: "#10b981",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    borderColor: "#cbd5e1",
    borderRadius: "16px",
    fontFamily: "Inter, sans-serif",
    showPattern: false,
    glassy: false,
    gridLines: false,
  },
  {
    id: "glass-theme",
    name: "Glass Theme",
    bgGradient: "radial-gradient(circle at top left, #3b0764, #03001e 60%, #1e1b4b 100%)",
    bgColor: "#03001e",
    accentColor: "#d946ef",
    textColor: "#ffffff",
    mutedTextColor: "#a21caf",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: "24px",
    fontFamily: "Outfit, Inter, sans-serif",
    showPattern: false,
    glassy: true,
    gridLines: false,
  },
  {
    id: "minimal",
    name: "Minimal Theme",
    bgGradient: "linear-gradient(180deg, #000000 0%, #0c0c0c 100%)",
    bgColor: "#000000",
    accentColor: "#ffffff",
    textColor: "#ffffff",
    mutedTextColor: "#737373",
    borderColor: "#262626",
    borderRadius: "4px",
    fontFamily: "JetBrains Mono, monospace",
    showPattern: false,
    glassy: false,
    gridLines: true,
  },
  {
    id: "exchange-style",
    name: "Exchange Style",
    bgGradient: "linear-gradient(180deg, #0b0e11 0%, #1e2329 100%)",
    bgColor: "#0b0e11",
    accentColor: "#f0b90b", // Binance-yellow vibe
    textColor: "#eaecef",
    mutedTextColor: "#848e9c",
    borderColor: "#2b3139",
    borderRadius: "8px",
    fontFamily: "Inter, sans-serif",
    showPattern: true,
    glassy: false,
    gridLines: true,
  }
];

export interface ShareCardData {
  symbol: string;
  type: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  markPrice: number;
  margin: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  walletAddress: string;
  username: string;
  date: string;
  time: string;
  tradeId?: string;
}

export interface ShareCardConfig {
  showUsername: boolean;
  showWallet: boolean;
  showMargin: boolean;
  showSize: boolean;
  showEntryPrice: boolean;
  showMarkPrice: boolean;
  showVolume: boolean;
  showPnlDollar: boolean;
  showPnlPercent: boolean;
  showLeverage: boolean;
  showDate: boolean;
  showTime: boolean;
  showWatermark: boolean;
  
  presetId: string;
  customBgColor: string;
  customAccentColor: string;
  customBorderRadius: string; // e.g., '12px'
  logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  exportFormat: "auto" | "portrait" | "square" | "landscape";
}

export const DEFAULT_CONFIG: ShareCardConfig = {
  showUsername: true,
  showWallet: true,
  showMargin: true,
  showSize: true,
  showEntryPrice: true,
  showMarkPrice: true,
  showVolume: true,
  showPnlDollar: true,
  showPnlPercent: true,
  showLeverage: true,
  showDate: true,
  showTime: true,
  showWatermark: false, // Default without watermark per user request, toggle easily available
  
  presetId: "dark-pro",
  customBgColor: "",
  customAccentColor: "",
  customBorderRadius: "",
  logoPosition: "top-left",
  exportFormat: "auto",
};
