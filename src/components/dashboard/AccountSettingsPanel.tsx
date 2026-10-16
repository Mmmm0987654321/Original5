/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
} from "react";

import {
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

import TradingPreferencesModal
  from "../trading/TradingPreferencesModal";

import SupportPanel
  from "./SupportPanel";
import { useLanguage } from "../../lib/LanguageContext";

interface AccountSettingsPanelProps {
  walletConnected: boolean;
  onDisconnectWallet: () => void;

  initialSlippage: number;

  onApplySlippage: (
    value: number
  ) => void;
}

type AccountSection =
  | "SETTINGS"
  | "SUPPORT";

export default function AccountSettingsPanel({
  walletConnected,
  onDisconnectWallet,
  initialSlippage,
  onApplySlippage,
}: AccountSettingsPanelProps) {
  const { t } = useLanguage();
  const [activeSettingsTab, setActiveSettingsTab] = useState("TRADE_SETTING");
  const [
    section,
    setSection,
  ] =
    useState<AccountSection>(
      "SETTINGS"
    );

  return (
    <div
      className="w-full max-w-5xl mx-auto space-y-3"
      id="account-settings-page"
    >
      <div className="glass-panel rounded-2xl border border-brand-border overflow-hidden">
        <div className="flex items-center border-b border-brand-border bg-brand-surface">
          <button
            type="button"
            onClick={() =>
              setSection(
                "SETTINGS"
              )
            }
            className={`flex-1 min-h-[48px] px-3 flex items-center justify-center gap-2 text-sm font-semibold tracking-normal transition-all cursor-pointer border-b-2 ${
              section ===
              "SETTINGS"
                ? "text-accent border-accent bg-accent/5"
                : "text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-overlay-subtle"
            }`}
          >
            <Settings className="w-4 h-4" />

            {t("settings")}
          </button>

          <button
            type="button"
            onClick={() =>
              setSection(
                "SUPPORT"
              )
            }
            className={`flex-1 min-h-[48px] px-3 flex items-center justify-center gap-2 text-sm font-semibold tracking-normal transition-all cursor-pointer border-b-2 ${
              section ===
              "SUPPORT"
                ? "text-accent border-accent bg-accent/5"
                : "text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-overlay-subtle"
            }`}
          >
            <HelpCircle className="w-4 h-4" />

            {t("support")}
          </button>
        </div>

        <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-2">
          {section ===
          "SETTINGS" ? (
            <TradingPreferencesModal
              embedded
              onActiveTabChange={setActiveSettingsTab}
              initialSlippage={
                initialSlippage
              }
              onApplySlippage={
                onApplySlippage
              }
            />
          ) : (
            <SupportPanel
              initialTab="faq"
            />
          )}
        </div>
      </div>

      {walletConnected && section === "SETTINGS" && activeSettingsTab === "TRADE_SETTING" && (
        <button
          type="button"
          id="account-disconnect-wallet"
          onClick={
            onDisconnectWallet
          }
          className="w-full min-h-[46px] rounded-xl border border-brand-loss/25 bg-brand-loss/5 hover:bg-brand-loss/10 text-brand-loss font-semibold text-sm tracking-normal flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />

          {t("disconnect")}
        </button>
      )}
    </div>
  );
}
