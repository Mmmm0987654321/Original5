import React, { useState, useEffect } from "react";
import { useTrustShield, TrustShieldMode, TRUST_SHIELD_MODE_INFO, TRUST_SHIELD_DISPLAY_NOTICE } from "../../lib/TrustShieldManager";
import { hasPrivacyPassword, setPrivacyPassword, verifyPrivacyPassword } from "../../lib/privacyPassword";
import { Shield, Lock, Eye, EyeOff, Check, X, KeyRound, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TrustShieldPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrustShieldPopup: React.FC<TrustShieldPopupProps> = ({ isOpen, onClose }) => {
  const { setMode, setPopupSeen, mode: currentTrustShieldMode } = useTrustShield();
  const [selectedMode, setSelectedMode] = useState<TrustShieldMode | null>(null);


  // Freeze the screen behind this mobile fullscreen sheet.
  useEffect(() => {
    if (!isOpen) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prior; };
  }, [isOpen]);

  // View state: "modes" | "create" | "verify"
  const [view, setView] = useState<"modes" | "create" | "verify">("modes");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const hasPassword = hasPrivacyPassword();
      const savedMode = currentTrustShieldMode;
      
      setSelectedMode(savedMode);
      if (!hasPassword && (savedMode === "PRIVATE" || savedMode === "ANONYMOUS")) {
        setView("create");
      } else {
        setView("modes");
      }
      setPwError("");
      setPasswordInput("");
    }
  }, [isOpen, currentTrustShieldMode]);

  const handleClose = () => {
    // Closing never silently resets an already active mode.
    setPopupSeen(true);
    setView("modes");
    onClose();
  };

  const handleContinue = () => {
    if (!selectedMode) return;

    // Check if transition is protected (security decreases)
    const isTransitionProtected = 
      (currentTrustShieldMode === "ANONYMOUS" && (selectedMode === "PRIVATE" || selectedMode === "STANDARD")) ||
      (currentTrustShieldMode === "PRIVATE" && selectedMode === "STANDARD");

    const hasPassword = hasPrivacyPassword();


    if (isTransitionProtected && hasPassword) {
      // Transition is protected, must verify existing password first!
      setView("verify");
      setPasswordInput("");
      setPwError("");
    } else if (selectedMode === "STANDARD") {
      // Transition not protected, standard switch
      setMode("STANDARD");
      localStorage.setItem("trustShieldMode", "standard");
      localStorage.setItem("trust_shield_mode", "STANDARD");
      setPopupSeen(true);
      onClose();
    } else {
      // Transition is to PRIVATE or ANONYMOUS
      if (!hasPassword) {
        setView("create");
        setPasswordInput("");
        setPwError("");
      } else {
        // Password exists, transition is allowed without prompt (Standard -> Private/Anonymous)
        setMode(selectedMode);
        localStorage.setItem("trustShieldMode", selectedMode.toLowerCase());
        localStorage.setItem("trust_shield_mode", selectedMode);
        setPopupSeen(true);
        onClose();
      }
    }
  };

  const handleSaveAnonymousPassword = async () => {
    if (!passwordInput || passwordInput.length < 8) {
      setPwError("Password must be at least 8 characters long.");
      return;
    }
    // Save to local storage only, never send to any API or backend
    try {
      await setPrivacyPassword(passwordInput);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Unable to secure password.");
      return;
    }
    

    // Enable the selected mode (PRIVATE or ANONYMOUS)
    const targetMode = selectedMode || "PRIVATE";
    setMode(targetMode);
    localStorage.setItem("trustShieldMode", targetMode.toLowerCase());
    localStorage.setItem("trust_shield_mode", targetMode);
    
    // Automatically remember unlock for the current browser session and persistence
    localStorage.setItem("privacy_unlocked", "true");
    sessionStorage.setItem("funds_unlocked", "true");
    
    setPopupSeen(true);
    setView("modes");
    onClose();
  };

  const handleVerifyPassword = async () => {
    const authorized = await verifyPrivacyPassword(passwordInput).catch(() => false);
    if (authorized) {
      setMode(selectedMode!);
      localStorage.setItem("trustShieldMode", selectedMode!.toLowerCase());
      localStorage.setItem("trust_shield_mode", selectedMode!);
      

      localStorage.setItem("privacy_unlocked", "true");
      sessionStorage.setItem("funds_unlocked", "true");
      
      setPopupSeen(true);
      setView("modes");
      onClose();
    } else {
      setPwError("Incorrect password. Please try again.");
    }
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    const values = window.crypto.getRandomValues(new Uint8Array(18));
    const generated = Array.from(values, value => chars[value % chars.length]).join("");
    setPasswordInput(generated);
    setShowPassword(true);
    setPwError("");
  };

  const cards = ([
    { id: "STANDARD" as const, icon: Eye },
    { id: "PRIVATE" as const, icon: Shield },
    { id: "ANONYMOUS" as const, icon: Lock },
  ]).map(({ id, icon }) => ({
    id, icon, isPlaceholder: false, ...TRUST_SHIELD_MODE_INFO[id],
  }));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Dialog Container (Compact width: approx 450px) */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.28 }}
            role="dialog"
            aria-modal="true"
            aria-label="Trust Shield privacy settings"
            className="relative w-full h-[100dvh] max-h-[100dvh] md:h-auto md:max-h-[90dvh] md:max-w-[560px] bg-brand-surface text-brand-text border border-brand-border/80 rounded-t-[24px] md:rounded-2xl shadow-2xl px-5 pt-6 pb-[calc(20px+env(safe-area-inset-bottom))] md:p-6 overflow-y-auto overscroll-contain z-10 flex flex-col gap-5 text-left"
          >
            {/* Header */}
            <div className="flex items-start justify-between relative">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-black text-brand-text text-xl uppercase tracking-wide">
                    Trust Shield
                  </h3>
                </div>
                <p className="text-[13px] text-brand-text/75 leading-relaxed mt-2">
                  Choose which account details are shown in supported HideDex screens.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 text-gray-500 hover:text-brand-text hover:bg-brand-overlay-normal rounded-xl transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {view === "modes" ? (
                <motion.div
                  key="mode-list"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  className="flex flex-col flex-1 gap-3.5 relative min-h-0"
                >
                  {cards.map((card) => {
                    const Icon = card.icon;
                    const isSelected = selectedMode === card.id;
                    const isPlaceholder = card.isPlaceholder;

                    return (
                      <button
                        key={card.id}
                        type="button"
                        disabled={isPlaceholder}
                        onClick={() => {
                          if (!isPlaceholder) {
                            setSelectedMode(card.id);
                          }
                        }}
                        className={`w-full p-3 rounded-xl border transition-all text-left flex gap-3 group relative ${
                          isPlaceholder
                            ? "bg-brand-bg/20 border-brand-border/20 opacity-40 cursor-not-allowed"
                            : isSelected
                            ? "bg-brand-overlay-active border-accent shadow-md shadow-accent/5 cursor-pointer"
                            : "bg-brand-bg/40 border-brand-border/40 hover:border-brand-text/30 hover:bg-brand-overlay-subtle cursor-pointer"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 border transition-colors ${
                            isPlaceholder
                              ? "bg-brand-bg/50 border-brand-border/30 text-gray-600"
                              : isSelected
                              ? "bg-accent/10 border-accent/30 text-accent"
                              : "bg-brand-bg/80 border-brand-border/60 text-gray-500 group-hover:text-brand-text"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-black uppercase tracking-wider ${
                                isPlaceholder
                                  ? "text-gray-500"
                                  : isSelected
                                  ? "text-accent"
                                  : "text-brand-text"
                              }`}
                            >
                              {card.title}
                            </span>
                            {isPlaceholder ? (
                              <span className="text-[8px] bg-brand-border/40 text-gray-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                Placeholder
                              </span>
                            ) : isSelected ? (
                              <div className="w-4 h-4 rounded-full bg-accent text-brand-bg flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 stroke-[4px]" />
                              </div>
                            ) : null}
                          </div>
                          <span className="text-[12px] font-semibold text-brand-text/65 block">
                            {card.subtitle}
                          </span>
                          <p className="text-[12px] sm:text-[13px] text-brand-text/75 leading-snug font-normal mt-1.5">
                            {card.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  <p className="text-[11px] text-brand-muted leading-snug px-1">{TRUST_SHIELD_DISPLAY_NOTICE}</p>
                  {/* Buttons */}
                  <div className="flex gap-3 mt-auto sticky bottom-0 z-10 bg-brand-surface pt-3 pb-1">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-3.5 bg-brand-bg hover:bg-brand-overlay-subtle border border-brand-border text-brand-text font-bold text-[13px] uppercase tracking-wide rounded-xl transition-all cursor-pointer text-center"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={!selectedMode}
                      onClick={handleContinue}
                      className={`flex-1 py-3.5 font-black text-[13px] uppercase tracking-wide rounded-xl transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                        selectedMode
                          ? "bg-accent hover:opacity-90 text-brand-bg shadow-md shadow-accent/10"
                          : "bg-brand-overlay-normal text-gray-500 border border-brand-border/40 cursor-not-allowed"
                      }`}
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              ) : view === "create" ? (
                <motion.div
                  key="password-setup"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 font-sans"
                >
                  <div className="bg-brand-bg/60 border border-brand-border/60 rounded-xl p-3 flex gap-2.5 items-start">
                    <KeyRound className="w-4.5 h-4.5 text-accent shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-extrabold text-accent uppercase tracking-wider font-mono">Create Privacy Password</span>
                      <p className="text-[9px] text-gray-400 leading-relaxed font-normal">
                        Your password is verified using a salted, one-way local hash. Never use a wallet recovery phrase here.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 font-mono">
                        Create Local Password
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[9px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Generate Strong Password</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          setPwError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveAnonymousPassword();
                          }
                        }}
                        placeholder="Type password (minimum 8 chars)"
                        className="w-full bg-black/40 border border-brand-border hover:border-brand-text/30 rounded-xl pl-3 py-2 text-xs font-mono text-brand-text focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-text cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {pwError && (
                      <p className="text-[9px] font-mono font-bold text-rose-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{pwError}</span>
                      </p>
                    )}
                  </div>

                  {/* Password creation actions */}
                  <div className="flex gap-2.5 pt-1 relative">
                    <button
                      type="button"
                      onClick={() => {
                        setView("modes");
                        setPasswordInput("");
                        setPwError("");
                      }}
                      className="flex-1 py-3.5 bg-brand-bg hover:bg-brand-overlay-subtle border border-brand-border text-brand-text font-bold text-[13px] uppercase tracking-wide rounded-xl transition-all cursor-pointer text-center"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!passwordInput || passwordInput.length < 8}
                      onClick={handleSaveAnonymousPassword}
                      className={`flex-1 py-3.5 font-black text-[13px] uppercase tracking-wide rounded-xl transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                        passwordInput && passwordInput.length >= 8
                          ? "bg-accent hover:opacity-90 text-brand-bg shadow-md shadow-accent/10"
                          : "bg-brand-overlay-normal text-gray-500 border border-brand-border/40 cursor-not-allowed"
                      }`}
                    >
                      <span>Enable {selectedMode === "PRIVATE" ? "Private" : "Anonymous"}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="password-verify"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 font-sans"
                >
                  <div className="bg-brand-bg/60 border border-brand-border/60 rounded-xl p-3 flex gap-2.5 items-start">
                    <Lock className="w-4.5 h-4.5 text-accent shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-extrabold text-accent uppercase tracking-wider font-mono">Unlock {selectedMode === "PRIVATE" ? "Private" : "Anonymous"} Mode</span>
                      <p className="text-[9px] text-gray-400 leading-relaxed font-normal">
                        Please enter your local privacy password to unlock your secure session and activate {selectedMode === "PRIVATE" ? "Private" : "Anonymous"} Mode.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 font-mono">
                        Enter Privacy Password
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          setPwError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleVerifyPassword();
                          }
                        }}
                        placeholder="Enter password to unlock"
                        className="w-full bg-black/40 border border-brand-border hover:border-brand-text/30 rounded-xl pl-3 py-2 text-xs font-mono text-brand-text focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-text cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {pwError && (
                      <p className="text-[9px] font-mono font-bold text-rose-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{pwError}</span>
                      </p>
                    )}
                  </div>

                  {/* Password verification actions */}
                  <div className="flex gap-2.5 pt-1 relative">
                    <button
                      type="button"
                      onClick={() => {
                        setView("modes");
                        setPasswordInput("");
                        setPwError("");
                      }}
                      className="flex-1 py-3.5 bg-brand-bg hover:bg-brand-overlay-subtle border border-brand-border text-brand-text font-bold text-[13px] uppercase tracking-wide rounded-xl transition-all cursor-pointer text-center"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!passwordInput}
                      onClick={handleVerifyPassword}
                      className={`flex-1 py-3.5 font-black text-[13px] uppercase tracking-wide rounded-xl transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                        passwordInput
                          ? "bg-accent hover:opacity-90 text-brand-bg shadow-md shadow-accent/10"
                          : "bg-brand-overlay-normal text-gray-500 border border-brand-border/40 cursor-not-allowed"
                      }`}
                    >
                      <span>Unlock & Activate</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
