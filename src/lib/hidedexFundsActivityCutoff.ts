/**
 * HideDex Funds activity window: 22 Oct 2026, 00:00 IST.
 * This only filters analytics display; never modifies fills, balances, or positions.
 * Keep the cutoff timestamp absolute so device timezone cannot alter eligibility.
 */
export const HIDEDEX_FUNDS_ACTIVITY_START_MS = Date.parse("2026-10-21T18:30:00.000Z");

export function isHideDexFundsCutoffActive(now = Date.now()): boolean {
  return now >= HIDEDEX_FUNDS_ACTIVITY_START_MS;
}
