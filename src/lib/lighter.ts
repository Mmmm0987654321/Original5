/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * HideDex - Lighter Public API Volume Integration (Read-Only)
 */

const LIGHTER_BASE_URL = "https://mainnet.zklighter.elliot.ai";

/**
 * Fetches the lifetime volume across all master and sub-accounts for an L1 address on Lighter.
 * Read-only public REST API. Does not require private keys, signatures, or API keys.
 * 
 * Returns number if successfully retrieved (including 0 if wallet has no accounts / trades).
 * Returns null if network error, API failure, or response structure cannot be interpreted.
 */
export async function getLighterLifetimeVolumeUsd(
  l1Address: string
): Promise<number | null> {
  const trimmed = l1Address?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // 1. Resolve every Lighter account belonging to the L1 wallet
    const accountsRes = await fetch(
      `${LIGHTER_BASE_URL}/api/v1/accountsByL1Address?l1_address=${encodeURIComponent(trimmed)}`
    );

    if (!accountsRes.ok) {
      return null;
    }

    const accountsData = await accountsRes.json();
    if (!accountsData || typeof accountsData !== "object") {
      return null;
    }

    // Must unambiguously have sub_accounts or accounts property
    if (!("sub_accounts" in accountsData) && !("accounts" in accountsData)) {
      return null;
    }

    const accountIndexes = new Set<number>();

    // Extract sub_accounts
    const rawSubAccounts = Array.isArray(accountsData.sub_accounts)
      ? accountsData.sub_accounts
      : Array.isArray(accountsData.accounts)
        ? accountsData.accounts
        : null;

    if (rawSubAccounts) {
      for (const item of rawSubAccounts) {
        if (typeof item === "number" && Number.isInteger(item) && item >= 0) {
          accountIndexes.add(item);
        } else if (item && typeof item === "object") {
          const idx =
            item.index ??
            item.account_index ??
            item.sub_account_index ??
            item.accountIndex;
          const parsed = typeof idx === "number" ? idx : parseInt(String(idx), 10);
          if (Number.isInteger(parsed) && parsed >= 0) {
            accountIndexes.add(parsed);
          }
        }
      }
    }

    // Extract master account if present
    if (accountsData.master_account && typeof accountsData.master_account === "object") {
      const masterIdx =
        accountsData.master_account.index ??
        accountsData.master_account.account_index;
      const parsed = typeof masterIdx === "number" ? masterIdx : parseInt(String(masterIdx), 10);
      if (Number.isInteger(parsed) && parsed >= 0) {
        accountIndexes.add(parsed);
      }
    }

    // If wallet has no accounts on Lighter, confirmed lifetime volume is 0
    if (accountIndexes.size === 0) {
      return 0;
    }

    const startTimestamp = 1737072000;
    const endTimestamp = Math.floor(Date.now() / 1000);

    let totalVolume = 0;

    // Fetch PnL/volume for every returned account in parallel
    const pnlPromises = Array.from(accountIndexes).map(async (accountIdx) => {
      const url = `${LIGHTER_BASE_URL}/api/v1/pnl?by=index&value=${accountIdx}&resolution=1d&start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&count_back=0&ignore_transfers=false`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch Lighter PnL for account ${accountIdx}`);
      }
      const data = await res.json();
      return data;
    });

    const pnlResults = await Promise.all(pnlPromises);

    for (const pnlData of pnlResults) {
      if (!pnlData || typeof pnlData !== "object" || !Array.isArray(pnlData.pnl)) {
        return null;
      }

      for (const entry of pnlData.pnl) {
        if (!entry || typeof entry !== "object") continue;
        const rawVol = entry.volume;
        const vol =
          typeof rawVol === "number"
            ? rawVol
            : typeof rawVol === "string"
              ? parseFloat(rawVol)
              : NaN;

        if (Number.isFinite(vol) && vol >= 0) {
          totalVolume += vol;
        }
      }
    }

    return Number.isFinite(totalVolume) ? totalVolume : null;
  } catch {
    return null;
  }
}
