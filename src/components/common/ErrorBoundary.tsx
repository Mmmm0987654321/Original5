/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCw, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled HideDex interface error:", error, errorInfo);
  }

  private handleRecover = () => {
    // Automatic error recovery by clearing local storage caches and performing visual refresh
    try {
      localStorage.removeItem("aether_web3_session");
    } catch (e) {
      // Ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-brand-text font-mono" id="aether-recovery-boundary">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-violet-500 to-amber-500" />
          
          <div className="max-w-md w-full glass-panel rounded-3xl p-6 md:p-8 border border-rose-500/20 text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-brand-text">Unable to display this page</h1>
              <p className="text-xs text-gray-400 leading-relaxed">
                HideDex (hidedex.com) encountered a display error. Reload to try again. If this happens repeatedly, contact support.
              </p>
            </div>

            <div className="bg-brand-overlay-subtle border border-brand-border rounded-xl p-3.5 text-[11px] text-rose-300 text-left max-h-[120px] overflow-y-auto break-words leading-relaxed font-mono">
              <span className="font-bold block text-red-400 mb-1">Error details:</span>
              {this.state.error?.toString() || "Unknown core engine fault."}
            </div>

            <button
              onClick={this.handleRecover}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white-absolute font-bold text-xs rounded-xl transition-all shadow-lg shadow-rose-500/15 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              Reload HideDex
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
