import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronDown } from "lucide-react";
import { Position, OpenOrder } from "../../types";

interface TpSlModalProps {
  position: Position;
  openOrders: OpenOrder[];
  onClose: () => void;
  onSave: (tpPrice: number | null, slPrice: number | null) => Promise<void> | void;
  priceOnly?:boolean;
  tradingEnabled?: boolean;
  onSetupRequired?: () => void;
  onCancelOrder?: (id: string) => Promise<void> | void;
}

export default function TpSlModal({ 
  position, 
  openOrders = [], 
  onClose, 
  onSave, 
  tradingEnabled = true,
  onSetupRequired,
  onCancelOrder,
  priceOnly=false,
}: TpSlModalProps) {
  const isLong = position.type === "LONG";
  const entryPrice = position.entryPrice;
  const size = position.size;
  const leverage = position.leverage;
  // Missing venue leverage must not cause division by zero or fabricated ROI.
  // When unavailable, percentage target refers to the entry-price movement.
  const targetLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const hasVerifiedLeverage = Number.isFinite(leverage) && leverage > 0;

  // Unit modes: "PRICE" | "PERCENT" | "PNL"
  const [tpMode, setTpMode] = useState<"PRICE" | "PERCENT" | "PNL">("PERCENT");
  const [slMode, setSlMode] = useState<"PRICE" | "PERCENT" | "PNL">("PERCENT");

  // Input string values
  const [tpInput, setTpInput] = useState<string>("");
  const [slInput, setSlInput] = useState<string>("");

  // Dropdown open states
  const [showTpDropdown, setShowTpDropdown] = useState(false);
  const [showSlDropdown, setShowSlDropdown] = useState(false);

  // Theme support
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pref_theme_id") || "cosmic-slate";
    }
    return "cosmic-slate";
  });

  useEffect(() => {
    const handlePrefUpdate = () => {
      setActiveThemeId(localStorage.getItem("pref_theme_id") || "cosmic-slate");
    };
    window.addEventListener("preferences-updated", handlePrefUpdate);
    return () => {
      window.removeEventListener("preferences-updated", handlePrefUpdate);
    };
  }, []);

  const getButtonTextStyle = (themeId: string) => {
    if (
      themeId === "cosmic-slate" ||
      themeId === "hyper-gold" ||
      themeId === "stealth-matte"
    ) {
      return "var(--bg-main, #040812)";
    }
    return "#FFFFFF";
  };

  // The parent refreshes account/market data with new position objects.
  // Only reset an editor when switching to a genuinely different position,
  // never when Lighter quotes or account snapshots update.
  useEffect(() => {
    setTpInput("");
    setSlInput("");
    setSaveError("");
  }, [position.id, position.symbol, position.type]);

  // Existing real position triggers derived from openOrders matching sourceCoin (PRIMARY PARITY)
  const existingPosTriggers = useMemo(() => {
    const posKey = position.sourceCoin || position.symbol;
    if (!posKey) {
      return [];
    }
    const normPosKey = String(posKey).trim().toUpperCase();

    return openOrders.filter((order) => {
      if (order.isSpot === true) return false;
      if (order.tpsl !== "tp" && order.tpsl !== "sl") return false;
      const ordKey = order.sourceCoin || order.symbol;
      return String(ordKey ?? "").trim().toUpperCase() === normPosKey;
    });
  }, [openOrders, position.sourceCoin, position.symbol]);

  // Helper to convert TP price to other metrics
  const getTpMetricsForPrice = (priceVal: number) => {
    const diff = isLong ? priceVal - entryPrice : entryPrice - priceVal;
    const pnl = diff * size;
    const percent = (entryPrice > 0 ? diff / entryPrice : 0) * 100 * targetLeverage;
    return { pnl, percent };
  };

  // Helper to convert SL price to other metrics
  const getSlMetricsForPrice = (priceVal: number) => {
    const diff = isLong ? entryPrice - priceVal : priceVal - entryPrice;
    const pnl = diff * size;
    const percent = (entryPrice > 0 ? diff / entryPrice : 0) * 100 * targetLeverage;
    return { pnl, percent };
  };

  // Compute actual numeric TP price based on current input and mode
  const getCalculatedTpPrice = (): number | null => {
    if (!tpInput || isNaN(parseFloat(tpInput))) return null;
    const val = parseFloat(tpInput);

    if (tpMode === "PRICE") {
      return val;
    } else if (tpMode === "PERCENT") {
      const change = (val / 100) / targetLeverage;
      return isLong ? entryPrice * (1 + change) : entryPrice * (1 - change);
    } else { // PNL mode
      const diff = val / size;
      return isLong ? entryPrice + diff : entryPrice - diff;
    }
  };

  // Compute actual numeric SL price based on current input and mode
  const getCalculatedSlPrice = (): number | null => {
    if (!slInput || isNaN(parseFloat(slInput))) return null;
    const val = parseFloat(slInput);

    if (slMode === "PRICE") {
      return val;
    } else if (slMode === "PERCENT") {
      const change = (val / 100) / targetLeverage;
      return isLong ? entryPrice * (1 - change) : entryPrice * (1 + change);
    } else { // PNL mode
      const diff = val / size;
      return isLong ? entryPrice - diff : entryPrice + diff;
    }
  };

  // When changing TP Mode, convert current input value to keep in sync
  const handleTpModeChange = (newMode: "PRICE" | "PERCENT" | "PNL") => {
    const currentPrice = getCalculatedTpPrice();
    setTpMode(newMode);
    setShowTpDropdown(false);

    if (!currentPrice) {
      setTpInput("");
      return;
    }

    if (newMode === "PRICE") {
      setTpInput(currentPrice.toFixed(2));
    } else if (newMode === "PERCENT") {
      const metrics = getTpMetricsForPrice(currentPrice);
      setTpInput(Math.abs(metrics.percent).toFixed(1));
    } else {
      const metrics = getTpMetricsForPrice(currentPrice);
      setTpInput(Math.abs(metrics.pnl).toFixed(2));
    }
  };

  // When changing SL Mode, convert current input value to keep in sync
  const handleSlModeChange = (newMode: "PRICE" | "PERCENT" | "PNL") => {
    const currentPrice = getCalculatedSlPrice();
    setSlMode(newMode);
    setShowSlDropdown(false);

    if (!currentPrice) {
      setSlInput("");
      return;
    }

    if (newMode === "PRICE") {
      setSlInput(currentPrice.toFixed(2));
    } else if (newMode === "PERCENT") {
      const metrics = getSlMetricsForPrice(currentPrice);
      setSlInput(Math.abs(metrics.percent).toFixed(1));
    } else {
      const metrics = getSlMetricsForPrice(currentPrice);
      setSlInput(Math.abs(metrics.pnl).toFixed(2));
    }
  };

  // Handle Save
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState("");
  const handleSave = async () => {
    if (!tradingEnabled) {
      // Release the sheet so the real wallet setup modal can appear on top.
      onClose();
      onSetupRequired?.();
      return;
    }
    if (!tpInput.trim() && !slInput.trim()) return;
    const tpPrice = getCalculatedTpPrice();
    const slPrice = getCalculatedSlPrice();
    if(saving)return;
    if((tpInput.trim()&&(!Number.isFinite(tpPrice)||!tpPrice||tpPrice<=0))||
       (slInput.trim()&&(!Number.isFinite(slPrice)||!slPrice||slPrice<=0))){
      setSaveError("Enter a valid positive trigger price.");return;
    }
    setSaving(true);setSaveError("");
    try{await onSave(tpPrice,slPrice);}catch(e){
      setSaveError(e instanceof Error?e.message:"Lighter TP/SL was not accepted.");
    }finally{setSaving(false);}
  };

  const currentTpPrice = getCalculatedTpPrice();
  const currentSlPrice = getCalculatedSlPrice();

  const tpMetrics = currentTpPrice ? getTpMetricsForPrice(currentTpPrice) : null;
  const slMetrics = currentSlPrice ? getSlMetricsForPrice(currentSlPrice) : null;

  // Preset helper
  const applyTpPreset = (percentVal: number) => {
    setTpMode("PERCENT");
    setTpInput(percentVal.toString());
  };

  const applySlPreset = (percentVal: number) => {
    setSlMode("PERCENT");
    setSlInput(percentVal.toString());
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[3px] font-sans p-0 sm:p-4">
      {/* Premium highly compact popup wrapper */}
      <div role="dialog" aria-modal="true" aria-labelledby="tpsl-sheet-title"
      className="bg-brand-card border border-brand-border/80 rounded-t-2xl rounded-b-none sm:rounded-2xl w-full max-w-none sm:max-w-[520px] max-h-[72dvh] sm:max-h-[85dvh] p-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-5 shadow-2xl relative animate-in slide-in-from-bottom-4 duration-200 text-brand-text overflow-y-auto overscroll-contain">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-brand-muted hover:text-brand-text transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title Block with custom branding circle */}
        <div className="flex items-center gap-2.5 mb-3.5 pr-6">
          <div className="w-[20px] h-[20px] rounded bg-brand-primary/10 border border-brand-primary flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
          </div>
          <h3 id="tpsl-sheet-title" className="text-base sm:text-lg font-bold tracking-tight text-brand-text">
            TP / SL Order Settings
          </h3>
        </div>

        {/* Info label subheader (Micro-dense) */}
        <div className="mb-3 px-1 py-1 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted border-b border-brand-divider/20 pb-2">
          <span className="flex items-center gap-1.5 font-bold">
            <span>{position.symbol}-PERP</span>
            <span className={`px-1 py-0.2 rounded text-[8px] font-black tracking-wider ${isLong ? "bg-emerald-500/10 text-brand-profit border border-emerald-500/20" : "bg-rose-500/10 text-brand-loss border border-rose-500/20"}`}>
              {position.type}
            </span>
            {hasVerifiedLeverage&&<span>{leverage}x</span>}
          </span>
          <span className="font-semibold">Entry Price: ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
        </div>

        {/* TP / SL Inputs */}
        <div className="space-y-2.5">
          
          {/* Take Profit Card Block */}
          <div className="relative flex flex-col gap-1">
            <div className="bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border/50 focus-within:border-brand-primary/80 rounded-xl p-2.5 flex justify-between items-center transition-all">
              <div className="flex-1 flex flex-col mr-2">
                <span className="text-[11px] font-semibold text-brand-muted">
                  {tpMode === "PRICE" ? "Profit Price" : tpMode === "PERCENT" ? "Profit %" : "Profit USD"}
                </span>
                <input
                  type="number"
                  step="any"
                  value={tpInput}
                  onChange={(e) => setTpInput(e.target.value)}
                  placeholder={tpMode === "PRICE" ? "None" : "0.00"}
                  className="w-full bg-transparent border-none text-sm font-bold font-mono text-brand-text focus:outline-none placeholder-brand-muted/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none mt-0.5"
                />
              </div>

              {/* Dropdown Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTpDropdown(!showTpDropdown);
                    setShowSlDropdown(false);
                  }}
                  className="bg-brand-overlay-normal border border-brand-border/40 hover:bg-brand-overlay-active rounded-lg px-2.5 py-1 text-[11px] font-bold text-brand-text flex items-center gap-1 cursor-pointer transition-all select-none min-w-[105px] h-8 justify-between"
                >
                  <span>
                    {tpMode === "PRICE" ? "Profit Price" : tpMode === "PERCENT" ? "Profit %" : "Profit USD"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-brand-muted shrink-0" />
                </button>

                {showTpDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-brand-card border border-brand-border/80 rounded-lg shadow-2xl overflow-hidden py-1 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => handleTpModeChange("PERCENT")}
                      className={`w-full px-2.5 py-2 text-left text-[11px] font-semibold transition-colors block cursor-pointer ${
                        tpMode === "PERCENT"
                          ? "bg-brand-primary/10 text-brand-primary font-bold"
                          : "hover:bg-brand-overlay-normal text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      Profit %
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTpModeChange("PNL")}
                      className={`w-full px-2.5 py-2 text-left text-[11px] font-semibold transition-colors block cursor-pointer ${
                        tpMode === "PNL"
                          ? "bg-brand-primary/10 text-brand-primary font-bold"
                          : "hover:bg-brand-overlay-normal text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      Profit USD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTpModeChange("PRICE")}
                      className={`w-full px-2.5 py-2 text-left text-[11px] font-semibold transition-colors block cursor-pointer ${
                        tpMode === "PRICE"
                          ? "bg-brand-primary/10 text-brand-primary font-bold"
                          : "hover:bg-brand-overlay-normal text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      Profit Price
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stop Loss Card Block */}
          <div className="relative flex flex-col gap-1">
            <div className="bg-brand-overlay-subtle hover:bg-brand-overlay-normal border border-brand-border/50 focus-within:border-brand-loss/80 rounded-xl p-2.5 flex justify-between items-center transition-all">
              <div className="flex-1 flex flex-col mr-2">
                <span className="text-[11px] font-semibold text-brand-muted">
                  {slMode === "PRICE" ? "Loss Price" : slMode === "PERCENT" ? "Loss %" : "Loss USD"}
                </span>
                <input
                  type="number"
                  step="any"
                  value={slInput}
                  onChange={(e) => setSlInput(e.target.value)}
                  placeholder={slMode === "PRICE" ? "None" : "0.00"}
                  className="w-full bg-transparent border-none text-sm font-bold font-mono text-brand-text focus:outline-none placeholder-brand-muted/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none mt-0.5"
                />
              </div>

              {/* Dropdown Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSlDropdown(!showSlDropdown);
                    setShowTpDropdown(false);
                  }}
                  className="bg-brand-overlay-normal border border-brand-border/40 hover:bg-brand-overlay-active rounded-lg px-2.5 py-1 text-[11px] font-bold text-brand-text flex items-center gap-1 cursor-pointer transition-all select-none min-w-[105px] h-8 justify-between"
                >
                  <span>
                    {slMode === "PRICE" ? "Loss Price" : slMode === "PERCENT" ? "Loss %" : "Loss USD"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-brand-muted shrink-0" />
                </button>

                {showSlDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-brand-card border border-brand-border/80 rounded-lg shadow-2xl overflow-hidden py-1 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => handleSlModeChange("PERCENT")}
                      className={`w-full px-2.5 py-2 text-left text-[11px] font-semibold transition-colors block cursor-pointer ${
                        slMode === "PERCENT"
                          ? "bg-brand-primary/10 text-brand-primary font-bold"
                          : "hover:bg-brand-overlay-normal text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      Loss %
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSlModeChange("PNL")}
                      className={`w-full px-2.5 py-2 text-left text-[11px] font-semibold transition-colors block cursor-pointer ${
                        slMode === "PNL"
                          ? "bg-brand-primary/10 text-brand-primary font-bold"
                          : "hover:bg-brand-overlay-normal text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      Loss USD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSlModeChange("PRICE")}
                      className={`w-full px-2.5 py-2 text-left text-[11px] font-semibold transition-colors block cursor-pointer ${
                        slMode === "PRICE"
                          ? "bg-brand-primary/10 text-brand-primary font-bold"
                          : "hover:bg-brand-overlay-normal text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      Loss Price
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Existing Real Triggers Section (PRIMARY PARITY) */}
        {existingPosTriggers.length > 0 && (
          <div className="mt-2.5 bg-brand-overlay-subtle rounded-xl p-2.5 border border-brand-border/40 space-y-1.5 font-mono text-[10px]">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-brand-muted block">
              Existing TP / SL
            </span>
            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5">
              {existingPosTriggers.map((ord) => {
                const isTp = ord.tpsl === "tp";
                const hasFinitePrice = typeof ord.triggerPrice === "number" && Number.isFinite(ord.triggerPrice);
                const priceDisplay = hasFinitePrice
                  ? `$${ord.triggerPrice!.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                  : "--";
                const canCancel = typeof ord.oid === "number" && Number.isFinite(ord.oid);

                return (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between py-1 px-2 rounded-lg bg-brand-card border border-brand-border/30"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1 py-0.2 rounded text-[8px] font-black tracking-wider uppercase ${
                          isTp
                            ? "bg-emerald-500/10 text-brand-profit border border-emerald-500/20"
                            : "bg-rose-500/10 text-brand-loss border border-rose-500/20"
                        }`}
                      >
                        {ord.tpsl?.toUpperCase()}
                      </span>
                      <span className="text-brand-text font-bold text-[10px]">
                        @ {priceDisplay}
                      </span>
                    </div>

                    {canCancel && onCancelOrder && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (typeof ord.oid !== "number" || !Number.isFinite(ord.oid)) return;
                          await onCancelOrder(ord.id);
                        }}
                        className="text-[9px] font-bold text-brand-loss hover:text-brand-loss/80 bg-brand-loss/10 hover:bg-brand-loss/20 px-2 py-0.5 rounded border border-brand-loss/20 transition-all cursor-pointer select-none"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic calculations summary (micro-compact size) */}
        <div className="mt-3 bg-brand-overlay-subtle rounded-xl p-3 border border-brand-border/40 space-y-2 text-xs">
          {/* Take Profit Live Analysis */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-brand-muted font-bold text-[9px] uppercase tracking-wider">Take Profit Target</span>
              <span className="text-brand-profit font-extrabold text-[11px]">
                {currentTpPrice ? `$${currentTpPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : "Not Set"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-brand-divider/10 pt-1">
              <div className="flex justify-between">
                <span className="text-brand-muted">Est. Profit:</span>
                <span className="text-brand-profit font-bold">
                  {tpMetrics && entryPrice>0 && size>0 ? `+$${tpMetrics.pnl.toFixed(2)}` : "--"}
                </span>
              </div>
              <div className="flex justify-between border-l border-brand-divider/10 pl-2">
                <span className="text-brand-muted">ROI:</span>
                <span className="text-brand-profit font-bold">
                  {hasVerifiedLeverage && tpMetrics ? `+${tpMetrics.percent.toFixed(1)}%` : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Stop Loss Live Analysis */}
          <div className="space-y-1 pt-2 border-t border-brand-divider/20">
            <div className="flex justify-between items-center">
              <span className="text-brand-muted font-bold text-[9px] uppercase tracking-wider">Stop Loss Target</span>
              <span className="text-brand-loss font-extrabold text-[11px]">
                {currentSlPrice ? `$${currentSlPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : "Not Set"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-brand-divider/10 pt-1">
              <div className="flex justify-between">
                <span className="text-brand-muted">Est. Loss:</span>
                <span className="text-brand-loss font-bold">
                  {slMetrics && entryPrice>0 && size>0 ? `-$${Math.abs(slMetrics.pnl).toFixed(2)}` : "--"}
                </span>
              </div>
              <div className="flex justify-between border-l border-brand-divider/10 pl-2">
                <span className="text-brand-muted">ROI:</span>
                <span className="text-brand-loss font-bold">
                  {hasVerifiedLeverage && slMetrics ? `-${Math.abs(slMetrics.percent).toFixed(1)}%` : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>



        {/* Quick Percent Buttons Side-By-Side Layout (dense styling) */}
        <div className="grid grid-cols-2 gap-3 border-t border-brand-divider/10 pt-2.5 mt-2.5">
          {/* TP Presets */}
          <div className="space-y-1">
            <span className="text-[8px] text-brand-muted uppercase font-bold tracking-wider block text-center">TP Presets</span>
            <div className="grid grid-cols-4 gap-0.5">
              {[10, 25, 50, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyTpPreset(p)}
                  className="py-0.5 bg-brand-overlay-subtle border border-brand-profit/20 hover:border-brand-profit hover:bg-brand-profit/10 text-brand-profit rounded text-[9px] font-bold transition-all cursor-pointer text-center"
                >
                  +{p}%
                </button>
              ))}
            </div>
          </div>

          {/* SL Presets */}
          <div className="space-y-1 border-l border-brand-divider/10 pl-3">
            <span className="text-[8px] text-brand-muted uppercase font-bold tracking-wider block text-center">SL Presets</span>
            <div className="grid grid-cols-4 gap-0.5">
              {[5, 10, 25, 50].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applySlPreset(p)}
                  className="py-0.5 bg-brand-overlay-subtle border border-brand-loss/20 hover:border-brand-loss hover:bg-brand-loss/10 text-brand-loss rounded text-[9px] font-bold transition-all cursor-pointer text-center"
                >
                  -{p}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {saveError&&<p role="alert" className="text-xs text-brand-loss mt-2">{saveError}</p>}
        {!tradingEnabled && (
          <div className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-brand-text">
            Trading is not enabled. Use Enable Trading to complete wallet setup.
          </div>
        )}
        {/* Actions stay visible above phone navigation */}
        <div className="flex gap-2.5 mt-3.5 border-t border-brand-divider/10 pt-3 sticky bottom-0 z-20 bg-brand-card pb-1">
          <button
            onClick={onClose}
            type="button"
            className="flex-1 py-1.5 h-8.5 rounded-xl border border-brand-border bg-brand-overlay-subtle text-brand-sub hover:text-brand-text hover:bg-brand-overlay-normal font-bold text-xs transition-all cursor-pointer active:scale-95 text-center flex items-center justify-center select-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            type="button"
            disabled={saving||(tradingEnabled && !tpInput.trim() && !slInput.trim())}
            className="flex-1 min-h-11 rounded-xl bg-brand-primary font-bold text-sm transition-all cursor-pointer active:scale-95 text-center flex items-center justify-center select-none hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "#101318" }}
          >
            {saving?"Saving TP/SL…":tradingEnabled ? "Confirm TP / SL" : "Enable Trading"}
          </button>
        </div>

      </div>
    </div>
  );
}
