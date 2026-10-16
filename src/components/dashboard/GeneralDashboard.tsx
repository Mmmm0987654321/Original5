/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTrustShield } from "../../lib/TrustShieldManager";
import { TrustShieldValue } from "../common/TrustShieldValue";
import { 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Activity, 
  Coins, 
  Zap, 
  LineChart,
  Network
} from "lucide-react";
import { TokenMetadata, ActiveTab } from "../../types";

interface GeneralDashboardProps {
  tokens: TokenMetadata[];
  balanceUSDC: number;
  walletAddress: string;
  positionsCount: number;
  onSelectToken: (symbol: string, mode: "spot" | "perp") => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export default function GeneralDashboard({
  tokens,
  balanceUSDC,
  walletAddress,
  positionsCount,
  onSelectToken,
  setActiveTab,
}: GeneralDashboardProps) {
  const { formatWalletAddress } = useTrustShield();

  const sortedGainers = [...tokens].sort(
    (a, b) => (b.change24h ?? 0) - (a.change24h ?? 0)
  );
  const topMovers = sortedGainers.slice(0, 3);
  const bottomMovers = [...tokens]
    .sort(
      (a, b) => (a.change24h ?? 0) - (b.change24h ?? 0)
    )
    .slice(0, 3);

  const formatAddress = (addr: string) => {
    if (!addr) return "Not Connected";
    return formatWalletAddress(addr);
  };

  return (
    <div className="space-y-2 text-gray-200" id="general-dashboard-panel">
      {/* Overview stats header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-brand-border pb-1.5">
        <div>
          <h1 className="font-sans font-medium text-2xl text-brand-text tracking-tight">Console Overview</h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time market rates & decentralized clearing account metrics.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-brand-overlay-subtle border border-brand-border px-4 py-2 rounded-2xl text-xs font-mono">
          <Network className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-gray-400">Node Sync:</span>
          <span className="text-emerald-400 font-bold">Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        
        {/* Left Col: Account stats card & Quick access */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-gradient-to-br from-[#0c0f1c] to-[#060810] border border-violet-500/10 rounded-xl p-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full filter blur-xl pointer-events-none" />
            
            <h3 className="font-sans text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
              Clearing Account
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Wallet Balance</span>
                <span className="text-2xl font-bold text-brand-text font-mono">
                  <TrustShieldValue
                    fieldKey="portfolio"
                    value={`$${balanceUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />{" "}
                  <span className="text-xs text-gray-400">USDC</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-border text-xs">
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Active Positions</span>
                  <span className="font-mono text-brand-text font-bold">{positionsCount}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Gateway Address</span>
                  <span className="font-mono text-violet-400 font-bold block truncate">{formatAddress(walletAddress)}</span>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button 
                  onClick={() => setActiveTab(ActiveTab.Perp)}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white-absolute font-bold text-xs uppercase tracking-wider transition-all text-center cursor-pointer border border-brand-border"
                >
                  Trade Perps
                </button>
                <button 
                  onClick={() => setActiveTab(ActiveTab.Spot)}
                  className="flex-1 py-2.5 rounded-xl bg-brand-overlay-normal hover:bg-brand-overlay-normal text-gray-300 font-bold text-xs uppercase tracking-wider transition-all text-center cursor-pointer border border-brand-border"
                >
                  Trade Spot
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Token screener & movers */}
        <div className="lg:col-span-2 space-y-2">
          
          {/* Active Markets screener list */}
          <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-sans text-xs font-bold text-brand-text uppercase tracking-wider flex items-center gap-1.5">
                <LineChart className="w-4 h-4 text-violet-400" /> Active Trade Desks
              </h3>
              <button 
                onClick={() => setActiveTab(ActiveTab.Markets)}
                className="text-[10px] text-violet-400 hover:text-brand-text uppercase font-bold tracking-wider cursor-pointer"
              >
                All Markets &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-brand-border text-[10px] uppercase font-bold tracking-wider">
                    <th className="pb-1.5 font-semibold">Symbol</th>
                    <th className="pb-1.5 font-semibold text-right">Oracle Price</th>
                    <th className="pb-1.5 font-semibold text-right">24h Change</th>
                    <th className="pb-1.5 font-semibold text-right">24h Volume</th>
                    <th className="pb-1.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/3 font-mono">
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-500 font-sans">
                        No active markets available
                      </td>
                    </tr>
                  ) : (
                    tokens.map((token) => (
                      <tr key={token.symbol} className="hover:bg-brand-overlay-subtle transition-colors">
                        <td className="py-1.5 font-semibold text-brand-text">{token.symbol}</td>
                        <td className="py-1.5 text-right text-gray-100">
                          {typeof token.price === "number" && Number.isFinite(token.price)
                            ? `$${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "--"}
                        </td>
                        <td className={`py-1.5 text-right font-bold ${
                          typeof token.change24h === "number" && Number.isFinite(token.change24h)
                            ? (token.change24h >= 0 ? "text-emerald-400" : "text-rose-500")
                            : "text-gray-400"
                        }`}>
                          {typeof token.change24h === "number" && Number.isFinite(token.change24h)
                            ? `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(2)}%`
                            : "--"}
                        </td>
                        <td className="py-1.5 text-right text-gray-400">
                          {typeof token.volume24h === "number" && Number.isFinite(token.volume24h)
                            ? `$${token.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : "--"}
                        </td>
                        <td className="py-1.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => onSelectToken(token.symbol, "perp")}
                              className="px-2 py-1 rounded bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white-absolute text-[10px] font-bold uppercase transition-all cursor-pointer"
                            >
                              Perp
                            </button>
                            <button
                              onClick={() => onSelectToken(token.symbol, "spot")}
                              className="px-2 py-1 rounded bg-brand-overlay-normal hover:bg-white/15 text-gray-300 hover:text-brand-text text-[10px] font-bold uppercase transition-all cursor-pointer border border-brand-border"
                            >
                              Spot
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top movers grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Gainers */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
              <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1 mb-1.5">
                <TrendingUp className="w-3 h-3" /> Top Gainers
              </span>
              <div className="space-y-2 text-xs font-mono">
                {topMovers.length === 0 ? (
                  <div className="py-2 text-center text-xs text-gray-500 font-sans">--</div>
                ) : (
                  topMovers.map((t) => (
                    <div key={t.symbol} className="flex justify-between items-center py-1">
                      <span className="font-bold text-brand-text">{t.symbol}</span>
                      <div className="text-right">
                        <span className="text-gray-200">
                          {typeof t.price === "number" && Number.isFinite(t.price)
                            ? `$${t.price.toLocaleString()}`
                            : "--"}
                        </span>
                        <span className={`font-bold ml-2 ${
                          typeof t.change24h === "number" && Number.isFinite(t.change24h)
                            ? (t.change24h >= 0 ? "text-emerald-400" : "text-rose-500")
                            : "text-gray-400"
                        }`}>
                          {typeof t.change24h === "number" && Number.isFinite(t.change24h)
                            ? `${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%`
                            : "--"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Losers */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
              <span className="text-[9px] uppercase font-bold tracking-widest text-rose-400 flex items-center gap-1 mb-1.5">
                <TrendingDown className="w-3 h-3" /> Top Decliners
              </span>
              <div className="space-y-2 text-xs font-mono">
                {bottomMovers.length === 0 ? (
                  <div className="py-2 text-center text-xs text-gray-500 font-sans">--</div>
                ) : (
                  bottomMovers.map((t) => (
                    <div key={t.symbol} className="flex justify-between items-center py-1">
                      <span className="font-bold text-brand-text">{t.symbol}</span>
                      <div className="text-right">
                        <span className="text-gray-200">
                          {typeof t.price === "number" && Number.isFinite(t.price)
                            ? `$${t.price.toLocaleString()}`
                            : "--"}
                        </span>
                        <span className={`font-bold ml-2 ${
                          typeof t.change24h === "number" && Number.isFinite(t.change24h)
                            ? (t.change24h >= 0 ? "text-emerald-400" : "text-rose-500")
                            : "text-gray-400"
                        }`}>
                          {typeof t.change24h === "number" && Number.isFinite(t.change24h)
                            ? `${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%`
                            : "--"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
