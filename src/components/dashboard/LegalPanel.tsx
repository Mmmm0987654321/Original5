/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { FileText, ShieldAlert, KeyRound, Eye } from "lucide-react";

interface LegalPanelProps {
  activeSection?: string;
}

export default function LegalPanel({ activeSection = "terms" }: LegalPanelProps) {
  const [subLegalTab, setSubLegalTab] = useState<string>(activeSection);

  useEffect(() => {
    if (activeSection) {
      setSubLegalTab(activeSection);
    }
  }, [activeSection]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6" id="legal-documents-panel">
      {/* Sidebar Controls */}
      <div className="md:col-span-1 space-y-2">
        <div className="glass-panel rounded-2xl p-2.5 space-y-1">
          <button
            onClick={() => setSubLegalTab("terms")}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
              subLegalTab === "terms" ? "bg-brand-overlay-normal text-violet-400 font-bold" : "text-gray-400 hover:text-brand-text hover:bg-brand-overlay-subtle"
            }`}
          >
            <FileText className="w-4 h-4" />
            Terms of Service
          </button>

          <button
            onClick={() => setSubLegalTab("privacy")}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
              subLegalTab === "privacy" ? "bg-brand-overlay-normal text-violet-400 font-bold" : "text-gray-400 hover:text-brand-text hover:bg-brand-overlay-subtle"
            }`}
          >
            <Eye className="w-4 h-4" />
            Privacy Protocols
          </button>

          <button
            onClick={() => setSubLegalTab("disclaimer")}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
              subLegalTab === "disclaimer" ? "bg-brand-overlay-normal text-violet-400 font-bold" : "text-gray-400 hover:text-brand-text hover:bg-brand-overlay-subtle"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Risk Disclaimer
          </button>

          <button
            onClick={() => setSubLegalTab("cookies")}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
              subLegalTab === "cookies" ? "bg-brand-overlay-normal text-violet-400 font-bold" : "text-gray-400 hover:text-brand-text hover:bg-brand-overlay-subtle"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Cookie Policy
          </button>
        </div>
      </div>

      {/* Main Documents Content Panel */}
      <div className="md:col-span-3 glass-panel rounded-3xl p-6 border border-brand-border font-sans leading-relaxed text-gray-300 text-xs md:text-sm space-y-6">
        {subLegalTab === "terms" && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg text-brand-text">1. Terms of Service (Sewa ke Niyam)</h3>
            <p className="text-gray-400">
              HideDex website (hidedex.com) ko use karne se pehle kripya niyam aur sharto ko dhyan se padhein. Is website ka upayog karke aap sahmat hote hain ki aap cryptocurrency assets aur automated margin contracts trading se jude sabhi risks ko achhe se samajhte hain.
            </p>
            <h4 className="font-semibold text-brand-text mt-4">1.1 Registration and Builder Fee Signatures</h4>
            <p className="text-gray-400">
              HideDex platform trading services use karne ke liye aapko gasless wallet signature pass karna hoga jo hamare Partner Builder Protocol Fee ko approve karta hai. Yeh interface monetization aur gas bundling operations ko enable karta hai.
            </p>
            <h4 className="font-semibold text-brand-text mt-4">1.2 Prohibited Jurisdictions</h4>
            <p className="text-gray-400">
              Sanyukt Rajya America (USA), Canada, aur anya un deshon ke nagrik jahan perpetual leverages contracts forbidden hain, unko is platform ko use karne ki anumati nahi hai. Kisi bhi VPN bypass ke liye user khud zimmedar hoga.
            </p>
          </div>
        )}

        {subLegalTab === "privacy" && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg text-brand-text">2. Privacy Protocols (Nijata Niti)</h3>
            <p className="text-gray-400">
              Early Access registration ke dauran HideDex wallet address, X username aur Gmail address collect aur store karta hai. Connected wallet aur trading data protocol integrations se aa sakta hai. Hum seed phrase ya private key nahi maangte. Full privacy details: hidedex.com/privacy.
            </p>
            <h4 className="font-semibold text-brand-text mt-4">2.1 Blockchain Data and Transparency</h4>
            <p className="text-gray-400">
              Wallet trading operations supported protocols, including Hyperliquid, ke through process hote hain. Public on-chain activity interface privacy mode se erase nahi hoti.
            </p>
          </div>
        )}

        {subLegalTab === "disclaimer" && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg text-rose-400">3. Financial Risk Disclaimer (Risk Chetavni)</h3>
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-xs">
                Perpetuals leverage aur futures contract trading mein extreme level of risk shamil hai. Volatility ke dauran margin shortfalls hone par aapka pura collateral balance liquidate ho sakta hai. Kripya apna wahi fund invest karein jiske nuksaan se aapko financial crisis na ho.
              </p>
            </div>
            <p className="text-gray-400 mt-4">
              HideDex kisi bhi trading decision, profit, loss, ya server connectivity failures ke liye financial and legal roop se accountable nahi hai. Decentralized protocols ko completely use karna aapki personal choice aur research par nirbhar hai.
            </p>
          </div>
        )}

        {subLegalTab === "cookies" && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg text-brand-text">4. Cookie Management (Cookie Niti)</h3>
            <p className="text-gray-400">
              HideDex platform aapke trading preferences (jaise leverage sizing preferences, selected currency charts metrics, aur notifications dismissal history) ko save karne ke liye localized client-side cookies ya browser state buffers (localStorage) use karta hai.
            </p>
            <h4 className="font-semibold text-brand-text mt-4">4.1 Analytics Cookies</h4>
            <p className="text-gray-400">
              Hum platform optimizations aur UI/UX improvements ke liye completely anonymous analytics metadata read karte hain, isme kisi bhi wallet seed key ya individual values ko intercept nahi kiya jata.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
