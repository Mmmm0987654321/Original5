import React, { useState } from 'react';
import { X, AlertCircle, LogOut, Globe, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { WalletState } from '../../lib/web3';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletState: WalletState;
  onConnect: () => Promise<void>;
  onConnectPrivy?: () => Promise<void> | void;
  onDisconnect: () => Promise<void> | void;
  isAwaitingSignature?: boolean;
  connecting?: boolean;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({
  isOpen,
  onClose,
  walletState,
  onConnect,
  onConnectPrivy,
  onDisconnect,
  isAwaitingSignature = false,
  connecting = false,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [privyConnecting, setPrivyConnecting] = useState(false);

  if (!isOpen) return null;

  const displayError = errorMsg || walletState.error;

  const walletTypeDisplay =
    walletState.walletType === "Injected"
      ? "Privy Wallet"
      : walletState.walletType === "WalletConnect"
        ? "External Wallet"
        : walletState.walletType || "External Wallet";

  const handleOpenAppKit = async () => {
    setErrorMsg(null);
    try {
      await onConnect();
    } catch (err: any) {
      setErrorMsg(err?.message || "Connection failed");
    }
  };

  const handleOpenPrivy = async () => {
    setErrorMsg(null);
    if (!onConnectPrivy) return;
    setPrivyConnecting(true);
    try {
      await onConnectPrivy();
    } catch (err: any) {
      setErrorMsg(err?.message || "Privy connection failed");
    } finally {
      setPrivyConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setErrorMsg(null);
    setDisconnecting(true);
    try {
      await onDisconnect();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  const isBusy = connecting || privyConnecting;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative isolate w-full max-w-[460px] bg-[#0c1424] border border-[#1d2d4d] p-6 sm:p-6 rounded-3xl text-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(23,68,148,0.15)] z-[201] space-y-6"
        style={{ backgroundColor: "#0c1424", color: "#f8fafc", borderColor: "#1d2d4d" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Circular Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-[#162238] border border-[#233554] hover:bg-[#1f2f4c] hover:border-blue-400/40 transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
          style={{ color: "#e2e8f0" }}
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Top Area: Header with Wallet Icon & Titles */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#182847] to-[#0c1629] border border-[#243c68] flex items-center justify-center shadow-lg shadow-black/40 shrink-0">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 11C4 8.79086 5.79086 7 8 7H24C26.2091 7 28 8.79086 28 11V23C28 25.2091 26.2091 27 24 27H8C5.79086 27 4 25.2091 4 23V11Z" fill="url(#wallet_body_grad)" stroke="#38bdf8" strokeWidth="1" />
              <path d="M4 12C4 9.79086 5.79086 8 8 8H24C26.2091 8 28 9.79086 28 12V14H4V12Z" fill="url(#wallet_top_grad)" fillOpacity="0.9" />
              <path d="M20 15H27C27.5523 15 28 15.4477 28 16V20C28 20.5523 27.5523 21 27 21H20C19.4477 21 19 20.5523 19 20V16C19 15.4477 19.4477 15 20 15Z" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
              <circle cx="23.5" cy="18" r="1.5" fill="#ffffff" />
              <defs>
                <linearGradient id="wallet_body_grad" x1="4" y1="7" x2="28" y2="27" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0ea5e9" />
                  <stop offset="1" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id="wallet_top_grad" x1="4" y1="8" x2="28" y2="14" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              <span className="text-white">Connect </span>
              <span className="text-[#f5a623]">Wallet</span>
            </h3>
            <p className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase leading-relaxed whitespace-pre-line"
              style={{ color: "#cbd5e1" }}>
              CONNECT YOUR WALLET TO{"\n"}TRADE, SWAP AND EXPLORE
            </p>
          </div>
        </div>

        {displayError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug text-[11px]">{displayError}</span>
          </div>
        )}

        {/* ALREADY CONNECTED STATE */}
        {walletState.connected ? (
          <div className="p-4 bg-[#111c33]/80 border border-blue-500/20 rounded-2xl space-y-3 text-left">
            <div className="space-y-1">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected ({walletTypeDisplay})
              </span>
              <p className="text-xs font-mono text-white font-bold truncate">
                {walletState.address}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-rose-500/30 disabled:opacity-50"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Disconnecting...
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" /> Disconnect Wallet
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* MAIN ACTION CARD: CONNECT EXTERNAL WALLET */}
            <button
              type="button"
              onClick={handleOpenAppKit}
              disabled={isBusy}
              className="w-full p-4 sm:p-5 bg-gradient-to-r from-[#111e38] to-[#0e1930] hover:from-[#142444] hover:to-[#111d38] border border-[#1f355e] hover:border-blue-500/40 rounded-2xl transition-all duration-200 cursor-pointer shadow-lg shadow-black/40 flex items-center justify-between gap-3 text-left group active:scale-[0.99] disabled:cursor-wait"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] border border-blue-400/30 flex items-center justify-center shrink-0 shadow-md text-white">
                  {connecting ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[1.8]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm sm:text-base tracking-tight transition-colors"
                    style={{ color: "#ffffff" }}>
                    {connecting ? "Connecting Wallet..." : "Connect External Wallet"}
                  </div>
                  <div className="text-[12px] sm:text-[13px] leading-relaxed mt-1"
                    style={{ color: "#cbd5e1" }}>
                    Trust Wallet, MetaMask, OKX,{"\n"}WalletConnect & more
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1e40af] group-hover:bg-[#2563eb] flex items-center justify-center shrink-0 shadow-md text-white transition-colors">
                <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
              </div>
            </button>

            {/* STATUS MESSAGE DURING CONNECTION */}
            {connecting && (
              <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-xl text-xs flex items-center gap-2 text-left animate-pulse">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-sky-400" />
                <span className="leading-snug text-[11px]">
                  {isAwaitingSignature
                    ? "Confirm the sign-in request in your wallet"
                    : "Connecting Wallet..."}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};




