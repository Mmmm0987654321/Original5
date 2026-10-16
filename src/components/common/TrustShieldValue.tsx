import React from "react";
import { useTrustShield } from "../../lib/TrustShieldManager";
import { Eye, EyeOff } from "lucide-react";

interface TrustShieldValueProps {
  fieldKey: string;
  value: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  hideEyeIcon?: boolean;
}

export const TrustShieldValue: React.FC<TrustShieldValueProps> = ({
  fieldKey,
  value,
  fallback = "••••••••",
  className = "",
  containerClassName = "inline-flex items-center gap-1",
  hideEyeIcon = false,
}) => {
  const { isFieldHidden, tempRevealed, toggleTempReveal, mode } = useTrustShield();
  const isHidden = isFieldHidden(fieldKey);
  const isTempRevealed = tempRevealed[fieldKey];
  const shouldHideEye = hideEyeIcon || mode === "PRIVATE";

  // Fields that are support temporary reveal in active modes
  const isRevealable = mode === "ANONYMOUS" || (mode === "PRIVATE" && ["portfolio", "balance", "tradeHistory", "positionHistory", "orderHistory", "fundingHistory"].includes(fieldKey));

  if (isHidden) {
    return (
      <span className={containerClassName}>
        <span className={`${className} opacity-50 select-none`}>{fallback}</span>
        {!shouldHideEye && isRevealable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleTempReveal(fieldKey);
            }}
            className="p-0.5 text-gray-500 hover:text-accent hover:bg-accent/10 rounded transition-colors cursor-pointer shrink-0"
            title="Click to reveal temporarily"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }

  if (isTempRevealed) {
    return (
      <span className={containerClassName}>
        <span className={className}>{value}</span>
        {!shouldHideEye && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleTempReveal(fieldKey);
            }}
            className="p-0.5 text-accent hover:bg-accent/10 rounded transition-colors cursor-pointer shrink-0"
            title="Click to hide again"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
};
