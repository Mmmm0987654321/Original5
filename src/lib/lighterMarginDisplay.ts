/**
 * Read-only Lighter margin display formulas, never used for signing or sizing
 * trade transactions. A cross position's allocated_margin=0 is not proof that
 * it consumes zero initial margin or refunds $0 on close.
 */
import type { LighterPublicAccount } from "./lighterMarketData";

/** The /account positions fraction is a displayed percentage (5.00 => 5%);
 * legacy snapshots may expose basis-point ticks (500 => 5%).
 * Verify the resulting integer leverage against the current market cap.
 */
export function verifiedLighterLeverage(
  rawFraction: number | null | undefined,
  marketMaxLeverage: number | null | undefined
): number | null {
  if (rawFraction == null || !Number.isFinite(rawFraction) ||
      rawFraction <= 0 || !marketMaxLeverage || marketMaxLeverage <= 0) return null;
  const leverage = (rawFraction <= 100 ? 100 : 10000) / rawFraction;
  const rounded = Math.round(leverage);
  return rounded >= 1 && rounded <= marketMaxLeverage &&
    Math.abs(leverage - rounded) <= 0.01 ? rounded : null;
}

/** Snapshot requirement only. This is NOT isolated collateral, proceeds,
 * equity, or withdrawable balance. Recomputes from live notional and a
 * venue-verified position margin setting.
 */
export function lighterInitialRequirement(
  notionalUsd: number | null | undefined,
  verifiedLeverage: number | null | undefined
): number | null {
  if (notionalUsd == null || !Number.isFinite(notionalUsd) || notionalUsd <= 0 ||
      verifiedLeverage == null || !Number.isFinite(verifiedLeverage) ||
      verifiedLeverage < 1) return null;
  const amount = notionalUsd / verifiedLeverage;
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Cross-maintenance requirement divided by real cross asset value.
 * This is an ACCOUNT risk metric; do not label it position margin ratio.
 */
export function lighterCrossAccountMarginRatio(account: LighterPublicAccount): number | null {
  const equity = account.crossAssetValue;
  const requirement = account.crossMaintenanceMarginRequirement;
  if (equity == null || requirement == null ||
      !Number.isFinite(equity) || !Number.isFinite(requirement) ||
      equity <= 0 || requirement < 0) return null;
  const ratio = requirement / equity * 100;
  return Number.isFinite(ratio) && ratio >= 0 ? ratio : null;
}
