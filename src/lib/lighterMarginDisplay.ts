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

/**
 * Display-only liquidation scenario for an UNFILLED Lighter market order.
 * NOT Lighter's liquidation engine: ignores execution/slippage fees, tier
 * changes, funding, other markets' price movement and future collateral moves.
 * Returns null unless exchange-maintenance data and account/margin state are
 * available. Never use this for order signing, margin or close decisions.
 */
export function estimateLighterDraftLiq(input:{
  side:"buy"|"sell";
  marketSymbol:string;
  price:number|null;
  notionalUsd:number|null;
  marginMode:"cross"|"isolated";
  confirmedLeverage:number|null;
  maintenanceFractionBps:number|null;
  account:LighterPublicAccount|null;
}):number|null{
  const {side,marketSymbol,price,notionalUsd,marginMode,
    confirmedLeverage,maintenanceFractionBps,account}=input;
  if(!price||!Number.isFinite(price)||price<=0||
     !notionalUsd||!Number.isFinite(notionalUsd)||notionalUsd<=0||
     !confirmedLeverage||!Number.isFinite(confirmedLeverage)||confirmedLeverage<1||
     maintenanceFractionBps===null||maintenanceFractionBps<=0||
     !Number.isFinite(maintenanceFractionBps)||!account)return null;
  const mmr=maintenanceFractionBps/10000;
  if(mmr<=0||mmr>=0.5)return null;
  // Same-market merges/reversals require a native portfolio engine, not
  // a newly opened independent-position estimate.
  if(account.positions.some(p=>p.symbol===marketSymbol))return null;
  const size=notionalUsd/price;
  const initialMargin=notionalUsd/confirmedLeverage;
  if(!(size>0)||!Number.isFinite(size)||
     account.availableBalance===null||
     !Number.isFinite(account.availableBalance)||
     initialMargin>account.availableBalance+1e-8)return null;
  let result:number;
  if(marginMode==="isolated"){
    // Isolated assumption: only initial-margin USD is committed, and
    // liquidation occurs at this market's current maintenance fraction.
    result=side==="buy"?(notionalUsd-initialMargin)/(size*(1-mmr)):
      (notionalUsd+initialMargin)/(size*(1+mmr));
  }else{
    const equity=account.crossAssetValue;
    const maintenance=account.crossMaintenanceMarginRequirement;
    if(equity===null||maintenance===null||
       !Number.isFinite(equity)||!Number.isFinite(maintenance)||
       equity<=0||maintenance<0||
       equity<=maintenance+mmr*notionalUsd)return null;
    // Scenario ONLY: all *other* market prices stay constant; the new
    // position adds price-dependent maintenance on its single market.
    result=side==="buy"?
      (maintenance-equity+notionalUsd)/(size*(1-mmr)):
      (equity+notionalUsd-maintenance)/(size*(1+mmr));
  }
  // Don't present impossible or already-breached prices as actionable.
  if(!Number.isFinite(result)||result<=0||
     (side==="buy"&&result>=price)||(side==="sell"&&result<=price))return null;
  return result;
}
