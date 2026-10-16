/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * HideDex Official Logo Component
 * Matches official HideDex gold geometric branding
 */

import React from "react";

interface HideDexLogoProps {
  size?: number | string;
  showText?: boolean;
  textSize?: string;
  className?: string;
}

export const HideDexLogo: React.FC<HideDexLogoProps> = ({
  size = 32,
  showText = true,
  textSize = "text-lg",
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* User-supplied original HideDex artwork, locally hosted (21.7 KB). */}
      <img
        src="/hidedex-logo.webp"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        decoding="async"
        className="shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
      />

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-black tracking-wider uppercase text-brand-text font-sans ${textSize}`}
            style={{ letterSpacing: "0.08em" }}
          >
            HIDEDEX
          </span>
        </div>
      )}
    </div>
  );
};

export default HideDexLogo;
