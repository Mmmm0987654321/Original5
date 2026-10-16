import React, { useState, useEffect, useRef } from "react";
import { ShareCardData, ShareCardConfig, DEFAULT_CONFIG, SHARE_CARD_PRESETS } from "./ShareCardTemplates";
import { renderShareCardToCanvas, exportCanvasAsPNG } from "./ShareCardRenderer";
import { useTrustShield } from "../../../lib/TrustShieldManager";
import ShareCardSettings from "./ShareCardSettings";
import { X, Download, Share2, CheckCircle, Sliders } from "lucide-react";

interface ShareCardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  positionData?: any; // Active or closed position from trading engine/Hyperliquid
  walletAddress?: string;
}

export default function ShareCardPopup({
  isOpen,
  onClose,
  positionData,
  walletAddress = "",
}: ShareCardPopupProps) {
  const { formatWalletAddress } = useTrustShield();
  const [config, setConfig] = useState<ShareCardConfig>(DEFAULT_CONFIG);
  const [tempConfig, setTempConfig] = useState<ShareCardConfig>(DEFAULT_CONFIG);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // Default to false so only the card preview is shown on open
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-generate current date and time
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Track window resizing for auto layout mode detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update dates on open
  useEffect(() => {
    if (isOpen) {
      const d = new Date();
      setCurrentDate(d.toISOString().slice(0, 10));
      setCurrentTime(d.toLocaleTimeString([], { hour12: false }));
      
      // Auto adjust default preset based on Light Mode / Dark Mode of system
      const isSystemLight = document.documentElement.classList.contains("light") || localStorage.getItem("anon_theme") === "light";
      const initialConfig = {
        ...DEFAULT_CONFIG,
        presetId: isSystemLight ? "light-pro" : "dark-pro"
      };
      setConfig(initialConfig);
      setTempConfig(initialConfig);
    }
  }, [isOpen]);

  // Compute active layout mode for aspect ratio class
  const layoutMode: "portrait" | "square" | "landscape" =
    config.exportFormat !== "auto"
      ? (config.exportFormat as "portrait" | "square" | "landscape")
      : windowWidth < 640
      ? "portrait"
      : windowWidth < 1024
      ? "square"
      : "landscape";

  // Render canvas whenever inputs change
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      // Short delay ensures fonts and styles are parsed in context
      const renderTimeout = setTimeout(() => {
        if (canvasRef.current) {
          renderShareCardToCanvas(canvasRef.current, data, config, windowWidth);
        }
      }, 50);
      return () => clearTimeout(renderTimeout);
    }
  }, [isOpen, config, windowWidth, currentDate, currentTime]);

  if (!isOpen) return null;

  // Build the unified data object
  const data: ShareCardData = {
    symbol: positionData?.symbol || "BTC",
    type: positionData?.type || "LONG",
    size: positionData?.size || 1.25,
    entryPrice: positionData?.entryPrice || 91250.0,
    markPrice: positionData?.markPrice || 92433.5,
    margin: positionData?.margin || 5700.0,
    leverage: positionData?.leverage || 20,
    unrealizedPnl: positionData?.unrealizedPnl ?? 1479.38,
    unrealizedPnlPercent: positionData?.unrealizedPnlPercent ?? 25.95,
    walletAddress: formatWalletAddress(walletAddress || positionData?.walletAddress || ""),
    username: positionData?.username || "Trader_Hyper",
    date: currentDate,
    time: currentTime,
  };

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      if (canvasRef.current) {
        // Render with high quality
        renderShareCardToCanvas(canvasRef.current, data, config, windowWidth);
        // Download files
        exportCanvasAsPNG(canvasRef.current, data.symbol);
        setIsExporting(false);
        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 3000);
      } else {
        setIsExporting(false);
      }
    }, 150);
  };

  const handleOpenSettings = () => {
    setTempConfig({ ...config });
    setShowSettings(true);
  };

  const handleApplySettings = () => {
    setConfig({ ...tempConfig });
    setShowSettings(false);
  };

  const handleCancelSettings = () => {
    setShowSettings(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm select-none font-sans overflow-y-auto">
      <div 
        id="share-card-container"
        className="relative w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-brand-bg text-brand-text border border-brand-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-fadeIn my-auto max-h-[95vh]"
      >
        
        {/* INTERACTIVE LIVE PREVIEW PANEL */}
        <div className="p-4 sm:p-6 flex flex-col justify-between items-center bg-brand-surface/25 min-w-0">
          
          <div className="w-full flex items-center justify-between mb-3 sm:mb-4 pb-2 border-b border-brand-border/30">
            <div className="flex flex-col">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-accent" />
                Share Position Card
              </h2>
              <span className="text-[9px] text-brand-muted font-mono uppercase mt-0.5">
                {layoutMode} Layout Mode
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenSettings}
                id="toggle-share-settings-btn"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-border/60 hover:border-brand-border bg-brand-surface/80 hover:bg-brand-surface text-gray-300 transition-all duration-150 cursor-pointer active:scale-95 text-[10px] sm:text-xs font-mono font-bold"
              >
                <Sliders className="w-3.5 h-3.5 text-accent" />
                Customize Card
              </button>
              
              <button
                onClick={onClose}
                id="close-share-card-btn-left"
                className="p-1.5 hover:bg-white/10 rounded-lg text-brand-muted hover:text-brand-text transition-colors cursor-pointer border border-transparent hover:border-brand-border/40"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas rendering is styled beautifully to look like a frame preview */}
          <div className="w-full flex-1 flex items-center justify-center py-2 px-1 min-h-[260px] sm:min-h-[340px] overflow-hidden">
            <canvas
              ref={canvasRef}
              id="share-card-preview-canvas"
              className={`w-full h-auto max-h-[45vh] sm:max-h-[50vh] object-contain rounded-xl border border-brand-border/80 shadow-2xl transition-all duration-300 ${
                layoutMode === "portrait"
                  ? "max-w-[250px] sm:max-w-[320px]"
                  : layoutMode === "square"
                  ? "max-w-[300px] sm:max-w-[360px]"
                  : "max-w-[420px] sm:max-w-[460px]"
              }`}
            />
          </div>

          {/* Primary CTA Action Download Row */}
          <div className="w-full flex flex-col gap-2 mt-4 sm:mt-5">
            <button
              onClick={handleDownload}
              disabled={isExporting}
              id="download-share-card-btn"
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-brand-text hover:opacity-90 text-brand-bg font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-lg shadow-brand-border/30 active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Rendering Image..." : "Download High-Res PNG"}
            </button>
            {showExportSuccess && (
              <div className="text-[10px] text-emerald-400 font-bold font-mono text-center flex items-center justify-center gap-1.5 mt-1 animate-pulse">
                <CheckCircle className="w-3.5 h-3.5" /> High-Resolution PNG Saved Successfully!
              </div>
            )}
          </div>
        </div>

      </div>

      {/* OVERLAY CARD CUSTOMIZER POPUP MODAL (Z-60 overlay sitting cleanly on top) */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl bg-brand-bg text-brand-text border border-brand-border/85 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-brand-border/60 bg-brand-surface/40">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-accent" />
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-brand-text">
                  Card Customizer Settings
                </h3>
              </div>
              <button
                onClick={handleCancelSettings}
                className="p-1.5 hover:bg-white/10 rounded-lg text-brand-muted hover:text-brand-text transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content (Scrollable settings panel) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin bg-brand-bg">
              <ShareCardSettings config={tempConfig} onChange={setTempConfig} />
            </div>

            {/* Footer with Apply and Cancel buttons */}
            <div className="p-4 border-t border-brand-border/60 bg-brand-surface/40 flex items-center justify-end gap-3">
              <button
                onClick={handleCancelSettings}
                className="px-4 py-2 rounded-xl border border-brand-border/60 hover:bg-brand-surface text-brand-text text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                onClick={handleApplySettings}
                className="px-5 py-2 rounded-xl bg-brand-text hover:opacity-90 text-brand-bg text-xs font-black uppercase tracking-wider shadow-lg shadow-brand-border/30 transition-all duration-150 cursor-pointer active:scale-95"
              >
                Apply Changes
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export const ShareCardManager = {
  Popup: ShareCardPopup
};
export { ShareCardPopup as ShareCardPopupComponent };
