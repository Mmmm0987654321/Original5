import React from "react";
import { ShareCardConfig, SHARE_CARD_PRESETS } from "./ShareCardTemplates";
import { Eye, LayoutGrid, Palette, ToggleLeft, ToggleRight, Trash2, Monitor } from "lucide-react";

interface ShareCardSettingsProps {
  config: ShareCardConfig;
  onChange: (newConfig: ShareCardConfig) => void;
}

export default function ShareCardSettings({ config, onChange }: ShareCardSettingsProps) {
  const updateConfig = (key: keyof ShareCardConfig, value: any) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  const toggleField = (key: keyof ShareCardConfig) => {
    updateConfig(key, !config[key]);
  };

  const handlePresetSelect = (presetId: string) => {
    onChange({
      ...config,
      presetId,
      customBgColor: "",
      customAccentColor: "",
      customBorderRadius: "",
    });
  };

  const logoPositions: { value: ShareCardConfig["logoPosition"]; label: string }[] = [
    { value: "top-left", label: "Top Left" },
    { value: "top-right", label: "Top Right" },
    { value: "bottom-left", label: "Bottom Left" },
    { value: "bottom-right", label: "Bottom Right" },
  ];

  return (
    <div className="flex flex-col gap-5 text-xs font-mono text-brand-text bg-brand-surface/40 p-4 rounded-xl border border-brand-border/60 max-h-[550px] overflow-y-auto scrollbar-thin">
      
      {/* SECTION 1: EXPORT FORMAT */}
      <div className="flex flex-col gap-2">
        <label className="text-brand-muted text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5 text-emerald-400" />
          Export Canvas Layout
        </label>
        <p className="text-[9px] text-brand-muted -mt-1">
          Auto detects device and defaults to Portrait on mobile, Landscape on desktop.
        </p>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {[
            { value: "auto", label: "Auto" },
            { value: "portrait", label: "Portrait" },
            { value: "square", label: "Square" },
            { value: "landscape", label: "Landscape" },
          ].map((fmt) => (
            <button
              key={fmt.value}
              id={`format-btn-${fmt.value}`}
              onClick={() => updateConfig("exportFormat", fmt.value)}
              className={`py-2 px-1 rounded-lg text-center transition-all duration-150 cursor-pointer text-[9px] sm:text-[10px] uppercase font-bold border ${
                config.exportFormat === fmt.value
                  ? "bg-accent/10 border-accent text-brand-text"
                  : "bg-brand-card hover:bg-brand-surface border-brand-border/40 text-brand-muted"
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 2: THEMES */}
      <div className="flex flex-col gap-2 border-t border-brand-border/30 pt-4">
        <label className="text-brand-muted text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5 text-violet-400" />
          Select Card Theme
        </label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {SHARE_CARD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all duration-150 cursor-pointer ${
                config.presetId === preset.id
                  ? "bg-accent/10 border-accent text-brand-text font-black"
                  : "bg-brand-card hover:bg-brand-surface border-brand-border/40 hover:border-brand-border text-brand-muted"
              }`}
            >
              <span className="text-[11px]">{preset.name}</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-3 h-3 rounded-full border border-white/10" style={{ background: preset.bgColor || "#000" }} />
                <span className="w-3 h-3 rounded-full border border-white/10" style={{ background: preset.accentColor || "#fff" }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 3: SHOW / HIDE FIELDS */}
      <div className="flex flex-col gap-2 border-t border-brand-border/30 pt-4">
        <label className="text-brand-muted text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          Show / Hide Fields
        </label>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1.5">
          {[
            { key: "showUsername" as const, label: "Username" },
            { key: "showWallet" as const, label: "Wallet Address" },
            { key: "showSize" as const, label: "Position Size" },
            { key: "showEntryPrice" as const, label: "Entry Price" },
            { key: "showMarkPrice" as const, label: "Mark Price" },
            { key: "showVolume" as const, label: "Total Volume" },
            { key: "showMargin" as const, label: "Margin Value" },
            { key: "showPnlDollar" as const, label: "PnL ($)" },
            { key: "showPnlPercent" as const, label: "PnL (%)" },
            { key: "showLeverage" as const, label: "Leverage" },
            { key: "showDate" as const, label: "Date" },
            { key: "showTime" as const, label: "Time" },
            { key: "showWatermark" as const, label: "Watermark" },
          ].map((field) => (
            <button
              key={field.key}
              onClick={() => toggleField(field.key)}
              className="flex items-center justify-between py-1 px-1.5 hover:bg-white/5 rounded transition-colors text-left"
            >
              <span className="text-brand-text">{field.label}</span>
              {config[field.key] ? (
                <ToggleRight className="w-6 h-6 text-accent cursor-pointer" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-600 cursor-pointer" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 4: VISUAL DESIGN CONTROLS */}
      <div className="flex flex-col gap-3 border-t border-brand-border/30 pt-4">
        <label className="text-brand-muted text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          Custom Visual Styling
        </label>

        {/* Logo Position */}
        <div className="flex flex-col gap-1.5">
          <span className="text-brand-muted text-[11px]">Logo Position</span>
          <div className="grid grid-cols-2 gap-1.5">
            {logoPositions.map((pos) => (
              <button
                key={pos.value}
                onClick={() => updateConfig("logoPosition", pos.value)}
                className={`py-1.5 px-2 rounded-md border text-center transition-all duration-150 cursor-pointer text-[10px] ${
                  config.logoPosition === pos.value
                    ? "bg-violet-600/10 border-violet-500 text-white font-bold"
                    : "bg-brand-card hover:bg-brand-surface border-brand-border/40 text-brand-muted"
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Colors & Radius */}
        <div className="space-y-3 mt-1.5">
          {/* Custom Background Color */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-brand-text text-[11px]">Custom Background</span>
              <span className="text-[9px] text-brand-muted">Override gradient</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.customBgColor || "#090e1a"}
                onChange={(e) => updateConfig("customBgColor", e.target.value)}
                className="w-7 h-7 bg-transparent rounded border border-brand-border cursor-pointer"
              />
              {config.customBgColor && (
                <button
                  onClick={() => updateConfig("customBgColor", "")}
                  className="p-1 hover:bg-white/5 rounded text-rose-400 cursor-pointer animate-fadeIn"
                  title="Clear Custom Background"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Custom Accent Color */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-brand-text text-[11px]">Custom Accent</span>
              <span className="text-[9px] text-brand-muted">Glows & Highlights</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.customAccentColor || "#00E878"}
                onChange={(e) => updateConfig("customAccentColor", e.target.value)}
                className="w-7 h-7 bg-transparent rounded border border-brand-border cursor-pointer"
              />
              {config.customAccentColor && (
                <button
                  onClick={() => updateConfig("customAccentColor", "")}
                  className="p-1 hover:bg-white/5 rounded text-rose-400 cursor-pointer animate-fadeIn"
                  title="Clear Custom Accent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Custom Border Radius */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-brand-text">Border Corner Radius</span>
              <span className="text-brand-muted font-bold">
                {config.customBorderRadius || "Theme Default"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="32"
              step="4"
              value={config.customBorderRadius ? parseInt(config.customBorderRadius) : 16}
              onChange={(e) => updateConfig("customBorderRadius", `${e.target.value}px`)}
              className="w-full accent-violet-500 bg-brand-border rounded h-1 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
