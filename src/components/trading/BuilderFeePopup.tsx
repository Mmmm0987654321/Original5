/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, AlertCircle, ShieldCheck, Zap, Layers, X } from "lucide-react";
import HideDexTradingAuthorizationSheet from "./HideDexTradingAuthorizationSheet";
import {
  inspectSeamlessSetupStatus,
  markTradingSetupComplete,
  runSeamlessSetupStepwise,
  type Eip1193Provider,
  type SeamlessStepId,
} from "../../lib/hyperliquid";
import {
  isHlSigningChainError,
  isWalletUserRejectedRequest,
} from "../../lib/hlWalletChain";
import { onVisibilityStateChange } from "../../lib/appVisibility";

export interface BuilderFeePopupProps {
  isOpen: boolean;

  /**
   * Authenticated SIWE trading/master wallet address.
   */
  tradingAddress: `0x${string}`;

  /**
   * Address currently connected through Reown/AppKit.
   */
  connectedAddress: string | null;

  /**
   * Resolve current real EIP-1193 wallet provider.
   * Must throw if the wallet session is unavailable.
   */
  getProvider: () => Promise<Eip1193Provider>;

  /**
   * Align external wallet to Hyperliquid signing network
   * before the first EIP-712 setup signature.
   */
  ensureSigningChain: () => Promise<void>;

  /**
   * User closes/dismisses setup.
   */
  onClose: () => void;

  /**
   * All setup requirements confirmed on-chain.
   */
  onComplete: () => void;

  /**
   * Parent keeps setup mounted while WalletConnect
   * request/confirmation is active.
   */
  onRunningChange?: (running: boolean) => void;
}

type StepUiState = "pending" | "signing" | "done";

const STEP_ORDER: SeamlessStepId[] = [
  "agent",
  "builderFee",
  "accountMode",
];

export default function BuilderFeePopup({
  isOpen,
  tradingAddress,
  connectedAddress,
  getProvider,
  ensureSigningChain,
  onClose,
  onComplete,
  onRunningChange,
}: BuilderFeePopupProps) {
  const [stepStates, setStepStates] = useState<Record<SeamlessStepId, StepUiState>>({
    agent: "pending",
    builderFee: "pending",
    accountMode: "pending",
  });

  const [inspecting, setInspecting] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSignedAny, setHasSignedAny] = useState(false);
  const [showAccountModeStep, setShowAccountModeStep] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const cancelledRef = useRef(false);
  const singleStepStopRef = useRef(false);
  const runningRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onRunningChangeRef = useRef(onRunningChange);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onRunningChangeRef.current = onRunningChange;
  }, [onRunningChange]);

  useEffect(() => {
    if (awaitingConfirm) {
      onRunningChangeRef.current?.(true);
    }
  }, [awaitingConfirm]);

  const markStep = useCallback(
    (step: SeamlessStepId, state: StepUiState) => {
      setStepStates((prev) =>
        prev[step] === state
          ? prev
          : {
              ...prev,
              [step]: state,
            }
      );
    },
    []
  );

  const ownerMismatch =
    !!connectedAddress &&
    connectedAddress.toLowerCase() !== tradingAddress.toLowerCase();

  const applyStatusToUi = useCallback((status: { agent: boolean; builderFee: boolean; accountMode: boolean }) => {
    setStepStates((prev) => ({
      agent: status.agent ? "done" : prev.agent,
      builderFee: status.builderFee ? "done" : prev.builderFee,
      accountMode: status.accountMode ? "done" : prev.accountMode,
    }));
    setShowAccountModeStep((prev) => prev || !status.accountMode);
  }, []);

  // Initial inspect on open
  useEffect(() => {
    if (!isOpen) return;

    if (runningRef.current || awaitingConfirm) {
      return;
    }

    let aborted = false;

    cancelledRef.current = false;

    setError(null);
    setHasSignedAny(false);

    setStepStates({
      agent: "pending",
      builderFee: "pending",
      accountMode: "pending",
    });

    setShowAccountModeStep(false);
    setAwaitingConfirm(false);
    setInspecting(true);

    void (async () => {
      try {
        const status = await inspectSeamlessSetupStatus(tradingAddress);

        if (aborted || runningRef.current) {
          return;
        }

        setStepStates({
          agent: status.agent ? "done" : "pending",
          builderFee: status.builderFee ? "done" : "pending",
          accountMode: status.accountMode ? "done" : "pending",
        });

        setShowAccountModeStep(!status.accountMode);

        if (status.allComplete) {
          onCompleteRef.current();
        }
      } catch {
        // Source behavior:
        // inspection failure is non-fatal.
      } finally {
        if (!aborted) {
          setInspecting(false);
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [isOpen, tradingAddress, awaitingConfirm]);

  // Auto confirm loop when awaiting confirmation on HL
  useEffect(() => {
    if (!isOpen || !awaitingConfirm) {
      return;
    }

    let stopped = false;

    const poll = async () => {
      try {
        const status = await inspectSeamlessSetupStatus(tradingAddress);

        if (stopped) return;

        applyStatusToUi(status);

        if (status.allComplete) {
          stopped = true;

          setAwaitingConfirm(false);
          setError(null);

          onRunningChangeRef.current?.(false);

          await markTradingSetupComplete().catch(() => {
            /* source intentionally ignores storage errors */
          });

          onCompleteRef.current();
        }
      } catch {
        // transient Hyperliquid/network error:
        // keep polling
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, 3000);

    void poll();

    const unsubscribe = onVisibilityStateChange((visible) => {
      if (visible) {
        void poll();
      }
    });

    return () => {
      stopped = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, [isOpen, awaitingConfirm, tradingAddress, applyStatusToUi]);

  const reconcileAfterWalletError = useCallback(async (): Promise<
    "complete" | "progress" | "none"
  > => {
    setAwaitingConfirm(true);
    setError(null);

    const baseline = await new Promise<Record<SeamlessStepId, StepUiState>>(
      (resolve) => {
        setStepStates((prev) => {
          resolve(prev);
          return prev;
        });
      }
    );

    const deadline = Date.now() + 10_000;

    let sawNewProgress = false;

    let last = await inspectSeamlessSetupStatus(tradingAddress).catch(
      () => null
    );

    while (!cancelledRef.current) {
      if (last) {
        applyStatusToUi(last);

        if (
          (last.agent && baseline.agent !== "done") ||
          (last.builderFee && baseline.builderFee !== "done") ||
          (last.accountMode && baseline.accountMode !== "done")
        ) {
          sawNewProgress = true;
        }

        if (last.allComplete) {
          setAwaitingConfirm(false);

          onRunningChangeRef.current?.(false);

          await markTradingSetupComplete().catch(() => {
            /* ignore */
          });

          onCompleteRef.current();

          return "complete";
        }
      }

      if (Date.now() >= deadline) {
        break;
      }

      await new Promise((r) => setTimeout(r, 1_500));

      last = await inspectSeamlessSetupStatus(tradingAddress).catch(
        () => last
      );
    }

    setAwaitingConfirm(false);

    if (!sawNewProgress) {
      onRunningChangeRef.current?.(false);
    }

    return sawNewProgress ? "progress" : "none";
  }, [tradingAddress, applyStatusToUi]);

  const handleRun = async () => {
    if (runningRef.current) return;

    if (ownerMismatch) {
      setError(
        "Connected wallet does not match your account. Reconnect the wallet you signed in with, then try again."
      );
      return;
    }

    cancelledRef.current = false;
    singleStepStopRef.current = false;

    runningRef.current = true;
    setRunning(true);
    onRunningChangeRef.current?.(true);

    setError(null);

    let keepParentPinned = false;

    try {
      const provider = await getProvider();

      if (!cancelledRef.current) {
        await ensureSigningChain();
      }

      const result = await runSeamlessSetupStepwise({
        userWalletProvider: provider,
        userAddress: tradingAddress,
        confirmTimeoutMs: 60_000,
        isCancelled: () => cancelledRef.current || singleStepStopRef.current,
        onStep: (step, phase) => {
          if (step === "accountMode") {
            setShowAccountModeStep(true);
          }

          if (phase === "signing") {
            setHasSignedAny(true);
            markStep(step, "signing");
          } else if (phase === "done") {
            markStep(step, "done");
            singleStepStopRef.current = true;
          }
        },
      });

      if (result.confirmed || result.phase === "complete") {
        onCompleteRef.current();
      } else if (!cancelledRef.current && result.phase === "hl_confirm") {
        applyStatusToUi(result.status);
        setAwaitingConfirm(true);
        keepParentPinned = true;
      } else if (!cancelledRef.current) {
        try {
          const freshStatus = await inspectSeamlessSetupStatus(tradingAddress);
          applyStatusToUi(freshStatus);
          if (freshStatus.allComplete) {
            await markTradingSetupComplete().catch(() => {});
            onCompleteRef.current();
            return;
          }
        } catch {
          applyStatusToUi(result.status);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (isWalletUserRejectedRequest(err) || /reject|denied|cancel/i.test(msg)) {
        if (msg === "__setup_cancelled__") {
          return;
        }
        setError("Signature declined. You can resume anytime.");
        return;
      }

      if (msg === "__approve_timeout__") {
        try {
          const status = await inspectSeamlessSetupStatus(tradingAddress);
          if (status) {
            applyStatusToUi(status);
            if (status.allComplete) {
              await markTradingSetupComplete().catch(() => {
                /* ignore */
              });
              onCompleteRef.current();
              return;
            }
            if (status.agent || status.builderFee) {
              keepParentPinned = true;
              return;
            }
          }
        } catch {
          /* ignore */
        }
        setError(
          "Your wallet didn't return the signature. If you already signed, tap continue. If a request is still loading in the wallet, dismiss it, then try again."
        );
        return;
      }

      if (isHlSigningChainError(err)) {
        setError(
          "Your wallet is on a different network than this request. Dismiss the failed prompt, then tap continue."
        );
        return;
      }

      // Other wallet error: reconcile first
      const recovered = await reconcileAfterWalletError();
      if (recovered === "complete" || cancelledRef.current) {
        return;
      }

      if (recovered === "progress") {
        keepParentPinned = true;
        return;
      }

      if (/session|expired|not ready|no active/i.test(msg)) {
        setError("Wallet session expired. Reconnect your wallet and try again.");
      } else {
        const cleanMsg = msg ? msg.replace(/0x[a-fA-F0-9]{64}/g, "[redacted]").trim() : "";
        setError(cleanMsg ? `Setup could not be completed: ${cleanMsg}` : "Setup could not be completed. Please try again.");
      }
    } finally {
      // Reset only still-signing steps without overwriting done steps
      setStepStates((prev) => ({
        agent: prev.agent === "signing" ? "pending" : prev.agent,
        builderFee: prev.builderFee === "signing" ? "pending" : prev.builderFee,
        accountMode: prev.accountMode === "signing" ? "pending" : prev.accountMode,
      }));

      runningRef.current = false;
      setRunning(false);

      if (!keepParentPinned && !cancelledRef.current) {
        onRunningChangeRef.current?.(false);
      } else if (keepParentPinned) {
        onRunningChangeRef.current?.(true);
      }
    }
  };

  const handleClose = () => {
    cancelledRef.current = true;
    singleStepStopRef.current = true;
    runningRef.current = false;
    setRunning(false);
    onRunningChangeRef.current?.(false);
    onClose();
  };

  if (!isOpen) return null;

  const allDone =
    stepStates.agent === "done" &&
    stepStates.builderFee === "done" &&
    (!showAccountModeStep || stepStates.accountMode === "done");

  const activeStep: SeamlessStepId | null =
    stepStates.agent !== "done"
      ? "agent"
      : stepStates.builderFee !== "done"
      ? "builderFee"
      : showAccountModeStep && stepStates.accountMode !== "done"
      ? "accountMode"
      : null;

  if (allDone || !activeStep) return null;

  const isVerifying = awaitingConfirm || inspecting;
  const isWalletRequest = running && !isVerifying;
  const showButtonLoader = isVerifying || isWalletRequest;
  const buttonLoaderLabel = isWalletRequest ? "CHECK YOUR WALLET" : "VERIFYING...";

  const primaryButtonLabel =
    activeStep === "agent"
      ? "SIGN TO ENABLE TRADING"
      : activeStep === "builderFee"
      ? "APPROVE TRADING"
      : "ENABLE UNIFIED TRADING";

  return (
    <HideDexTradingAuthorizationSheet
      title={activeStep==="agent"?"Enable Trading":
        activeStep==="builderFee"?"Approve Trading":"Enable Unified Trading"}
      icon={activeStep==="accountMode"?<Layers className="w-5 h-5"/>:
        <ShieldCheck className="w-5 h-5"/>}
      onClose={handleClose}
      primaryDisabled={running||inspecting||ownerMismatch||awaitingConfirm||allDone}
      onPrimary={handleRun}
      primaryLabel={showButtonLoader?
        <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0"/>
          <span>{buttonLoaderLabel}</span></>:
        <><span>{primaryButtonLabel}</span><ArrowRight className="w-3.5 h-3.5 shrink-0"/></>}
    >
            {/* Description & Details for Agent */}
            {activeStep === "agent" && (
              <div className="my-2">
                <p className="text-brand-sub text-sm sm:text-[15px] leading-relaxed">
                  Confirm the one-time wallet authorization to activate trading on HideDex (hidedex.com).
                </p>
                <p className="text-brand-sub text-xs sm:text-sm mt-2 leading-relaxed">
                  This permission allows orders to be submitted from your account. Review the wallet request before confirming.
                </p>
              </div>
            )}

            {/* Description & Details for Builder Fee */}
            {activeStep === "builderFee" && (
              <div className="my-2">
                <p className="text-brand-sub text-sm sm:text-[15px] leading-relaxed">
                  Review the trading approval in your wallet. It also authorizes the trading service fee, up to the maximum shown below.
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-overlay-normal border border-brand-border text-xs text-brand-sub font-mono">
                  <span>Maximum trading fee:</span>
                  <span className="text-brand-text font-semibold">0.1%</span>
                </div>
              </div>
            )}

            {/* Description & Details for Unified Trading */}
            {activeStep === "accountMode" && (
              <div className="my-2">
                <p className="text-brand-sub text-sm sm:text-[15px] leading-relaxed">
                  Complete one final wallet confirmation to finish setting up trading on HideDex.
                </p>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 my-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Owner mismatch warning */}
            {ownerMismatch && (
              <div className="flex items-start gap-2.5 p-3 my-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-snug">
                  Connected wallet does not match your account. Reconnect the wallet you signed in with, then try again.
                </span>
              </div>
            )}

            {/* Verifying on Hyperliquid indicator */}
            {awaitingConfirm && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 my-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Checking trading approval…</span>
              </div>
            )}


    </HideDexTradingAuthorizationSheet>
  );
}
