/// <reference types="vite/client" />
import { ExchangeClient, HttpTransport, HttpRequestError, TransportError, InfoClient } from '@nktkas/hyperliquid';
import { SymbolConverter, formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseTypedDataChainMismatch, isWalletUserRejectedRequest } from './hlWalletChain';
import { onVisibilityStateChange } from './appVisibility';
import type { MarginTier } from './hlMargin';
import {
  isGrowthModeEnabled,
  parseDeployerFeeScale,
} from './hip3Fees';
import {
  enabledHip3Dexes,
} from './hip3Dexes';
import {
  setAgentSecret,
  getAgentSecret,
  deleteAgentSecret,
} from './webAgentSecretStore';

type Hex = `0x${string}`;

const __DEV__ = import.meta.env.DEV;

function hlInfoFetch(
  init: RequestInit
): Promise<Response> {
  return fetch(
    "https://api.hyperliquid.xyz/info",
    init
  );
}

const ANONYMOUS_LIQUID_BUILDER_ADDRESS = "0xa985010C2949c55e0bda6006855C66Ca087f533e" as const;

const ANONYMOUS_LIQUID_BUILDER_FEE_TENTHS_BPS = 10 as const;

export const HL_BUILDER_MAX_FEE_RATE = '0.1%' as const;

export function getBuilderAddress(): string {
  return ANONYMOUS_LIQUID_BUILDER_ADDRESS;
}

export function getSpotBuilderFeeTenthsBps(): number {
  return ANONYMOUS_LIQUID_BUILDER_FEE_TENTHS_BPS;
}

export function getBuilderFeeTenthsBps(): number {
  return ANONYMOUS_LIQUID_BUILDER_FEE_TENTHS_BPS;
}

function createAgentExchangeClient(agentPrivateKey: Hex, vaultAddress?: Hex) {
  const agentAccount = privateKeyToAccount(agentPrivateKey);
  return new ExchangeClient({
    transport: getHlTransport(),
    wallet: agentAccount,
    ...(vaultAddress ? { defaultVaultAddress: vaultAddress } : {}),
  });
}

const AGENT_PK_KEY_BASE = 'hl_agent_pk_v1';
const AGENT_ADDR_KEY_BASE = 'hl_agent_addr_v1';
const SETUP_COMPLETE_KEY_BASE = 'hl_setup_complete_v1';

export async function isTradingSetupComplete(): Promise<boolean> {
  const existing = await getAgentSecret(SETUP_COMPLETE_KEY_BASE);
  return existing === '1';
}

export async function markTradingSetupComplete(): Promise<void> {
  await setAgentSecret(SETUP_COMPLETE_KEY_BASE, '1');
}

export async function clearTradingSetupState(): Promise<void> {
  await Promise.all([
    deleteAgentSecret(AGENT_PK_KEY_BASE),
    deleteAgentSecret(AGENT_ADDR_KEY_BASE),
    deleteAgentSecret(SETUP_COMPLETE_KEY_BASE),
  ]);
}

export async function ensureAgentKey(): Promise<{
  agentPrivateKey: Hex;
  agentAddress: Hex;
}> {
  const [storedPk, storedAddr] = await Promise.all([
    getAgentSecret(AGENT_PK_KEY_BASE),
    getAgentSecret(AGENT_ADDR_KEY_BASE),
  ]);

  if (storedPk && storedAddr) {
    return {
      agentPrivateKey: storedPk as Hex,
      agentAddress: storedAddr as Hex,
    };
  }

  const agentPrivateKey = generatePrivateKey();
  const account = privateKeyToAccount(agentPrivateKey);
  const agentAddress = account.address as Hex;

  await Promise.all([
    setAgentSecret(AGENT_PK_KEY_BASE, agentPrivateKey),
    setAgentSecret(AGENT_ADDR_KEY_BASE, agentAddress),
  ]);

  return {
    agentPrivateKey,
    agentAddress,
  };
}

export async function rotateAgentKey(): Promise<{
  agentPrivateKey: Hex;
  agentAddress: Hex;
}> {
  const agentPrivateKey = generatePrivateKey();
  const account = privateKeyToAccount(agentPrivateKey);
  const agentAddress = account.address as Hex;

  await Promise.all([
    setAgentSecret(AGENT_PK_KEY_BASE, agentPrivateKey),
    setAgentSecret(AGENT_ADDR_KEY_BASE, agentAddress),
  ]);

  return {
    agentPrivateKey,
    agentAddress,
  };
}

export async function getStoredAgentAddress(): Promise<Hex | null> {
  const storedAddr = await getAgentSecret(AGENT_ADDR_KEY_BASE);
  if (!storedAddr) {
    return null;
  }
  return storedAddr as Hex;
}

type HyperliquidMainnetBucket = {
  transport: HttpTransport | null;
  info: InfoClient | null;

  converterPromise: Promise<SymbolConverter> | null;
  metaPromise: Promise<any> | null;
  metaFetchedAt: number;
  hip3MetaCache: Map<string, { promise: Promise<any>; fetchedAt: number }>;
  perpDexsPromise: Promise<any> | null;
  lastLeverageCache: Map<string, { leverage: number; isCross: boolean; timestamp: number }>;
  usdcTokenPromise: Promise<string> | null;

  mainPerpMetaAndAssetCtxs: any | null;
  mainPerpMetaAndAssetCtxsFetchedAt: number;
  mainPerpMetaAndAssetCtxsPromise: Promise<any> | null;

  spotMetaAndAssetCtxs: any | null;
  spotMetaAndAssetCtxsFetchedAt: number;
  spotMetaAndCtxsPromise: Promise<any> | null;
};

const mainnetBucket: HyperliquidMainnetBucket = {
  transport: null,
  info: null,

  converterPromise: null,
  metaPromise: null,
  metaFetchedAt: 0,
  hip3MetaCache: new Map(),
  perpDexsPromise: null,
  lastLeverageCache: new Map(),
  usdcTokenPromise: null,

  mainPerpMetaAndAssetCtxs: null,
  mainPerpMetaAndAssetCtxsFetchedAt: 0,
  mainPerpMetaAndAssetCtxsPromise: null,

  spotMetaAndAssetCtxs: null,
  spotMetaAndAssetCtxsFetchedAt: 0,
  spotMetaAndCtxsPromise: null,
};

const MAIN_PERP_META_CACHE_TTL_MS = 10_000;
const HIP3_DEXES =
  enabledHip3Dexes();

class AnonymousLiquidWebHttpTransport extends HttpTransport {
  async request<T>(endpoint: 'info' | 'exchange' | 'explorer', payload: unknown, signal?: AbortSignal): Promise<T> {
    if (endpoint !== 'exchange' && endpoint !== 'info') {
      return super.request(endpoint, payload, signal);
    }

    try {
      const signals: AbortSignal[] = [];
      if (this.timeout) {
        if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
          signals.push((AbortSignal as any).timeout(this.timeout));
        } else {
          const controller = new AbortController();
          setTimeout(() => {
            try {
              controller.abort(new DOMException('Signal timed out.', 'TimeoutError'));
            } catch {
              controller.abort();
            }
          }, this.timeout);
          signals.push(controller.signal);
        }
      }
      if (signal) {
        signals.push(signal);
      }

      let requestSignal: AbortSignal | undefined = undefined;
      if (signals.length === 1) {
        requestSignal = signals[0];
      } else if (signals.length > 1) {
        if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).any === 'function') {
          requestSignal = (AbortSignal as any).any(signals);
        } else {
          const controller = new AbortController();
          for (const s of signals) {
            if (s.aborted) {
              controller.abort(s.reason);
              break;
            }
            s.addEventListener('abort', () => controller.abort(s.reason), { once: true, signal: controller.signal });
          }
          requestSignal = controller.signal;
        }
      }

      const url =
        endpoint === 'exchange'
          ? 'https://api.hyperliquid.xyz/exchange'
          : 'https://api.hyperliquid.xyz/info';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: requestSignal,
      });

      if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) {
        const clone = response.clone();
        const body = await response.text().catch(() => undefined);
        throw new HttpRequestError({ response: clone, message: body });
      }

      const clone = response.clone();
      const body = await response.json();
      if (body?.type === 'error') {
        throw new HttpRequestError({ response: clone, message: body?.message });
      }

      return body as T;
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }
      throw new HttpRequestError(undefined, { cause: error });
    }
  }
}

export function getHlTransport(): HttpTransport {
  if (!mainnetBucket.transport) {
    mainnetBucket.transport = new AnonymousLiquidWebHttpTransport({
      isTestnet: false,
    });
  }
  return mainnetBucket.transport;
}

export function getHlInfoClient(): InfoClient {
  if (!mainnetBucket.info) {
    mainnetBucket.info = new InfoClient({
      transport: getHlTransport(),
    });
  }
  return mainnetBucket.info;
}

export type Eip1193Provider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

/**
 * Minimal viem JSON-RPC account adapter compatible with @nktkas/hyperliquid signing.
 * Uses Privy's embedded wallet provider underneath.
 */
export function createViemJsonRpcAccount(args: { provider: Eip1193Provider; address: Hex }) {
  const { provider, address } = args;
  return {
    async getAddresses() {
      return [address];
    },
    async getChainId() {
      const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
      return parseInt(chainIdHex, 16);
    },
    async signTypedData(params: {
      domain: { name: string; version: string; chainId: number; verifyingContract: Hex };
      types: Record<string, { name: string; type: string }[]>;
      primaryType: string;
      message: Record<string, unknown>;
    }) {
      // Hyperliquid SDK already gives domain/types/primaryType/message.
      // Most wallets expect EIP712Domain included.
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ...params.types,
        },
        domain: params.domain,
        primaryType: params.primaryType,
        message: params.message,
      };

      return (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      })) as Hex;
    },
  };
}

function getHlExchangeSignatureChainId(): `0x${string}` {
  return '0xa4b1';
}

function normalizeHexChainId(hex: string): `0x${string}` | null {
  if (!/^0x[0-9a-fA-F]+$/.test(hex)) return null;
  try {
    return `0x${BigInt(hex).toString(16)}` as `0x${string}`;
  } catch {
    return null;
  }
}

/**
 * `signatureChainId` for user-signed HL actions. Hyperliquid accepts any id as
 * long as it matches the EIP-712 domain; wallets require it to match their
 * selected network.
 *
 * Embedded Privy providers answer `eth_chainId` with the wallet's real chain.
 * WalletConnect/AppKit providers answer with the dapp-session default chain
 * (Arbitrum) — NOT the network selected inside MetaMask — which is why external
 * flows call `ensureExternalWalletOnHlSigningChain()` first to move the wallet
 * onto Arbitrum before any typed-data prompt (same requirement as HL's own UI).
 */
async function readWalletSignatureChainId(
  provider: Eip1193Provider,
): Promise<`0x${string}`> {
  try {
    const hex = await provider.request({ method: 'eth_chainId' });
    if (typeof hex === 'string') {
      const normalized = normalizeHexChainId(hex);
      if (normalized) return normalized;
    }
  } catch {
    /* wallet may not answer; use env fallback */
  }
  return getHlExchangeSignatureChainId();
}

async function createUserExchangeClient(
  provider: Eip1193Provider,
  address: Hex,
  chainIdOverride?: `0x${string}`,
) {
  const wallet = createViemJsonRpcAccount({ provider, address });
  const signatureChainId = chainIdOverride ?? (() => readWalletSignatureChainId(provider));
  return new ExchangeClient({
    transport: getHlTransport(),
    wallet,
    signatureChainId,
  });
}

async function withUserSignedExchange<T>(
  provider: Eip1193Provider,
  address: Hex,
  fn: (exchange: ExchangeClient) => Promise<T>,
): Promise<T> {
  const run = (chain?: `0x${string}`) =>
    createUserExchangeClient(provider, address, chain).then(fn);

  try {
    return await run();
  } catch (err) {
    // Backstop only (e.g. the user declined the network-switch request): retry
    // ONCE on the chain the wallet says it is actually on. Never loop — every
    // extra attempt is another wallet round-trip the user has to sit through.
    const mismatch = parseTypedDataChainMismatch(err);
    if (!mismatch?.active) throw err;
    if (__DEV__) {
      console.log('[hl] EIP-712 chain mismatch; single retry on wallet chain', mismatch);
    }
    return await run(mismatch.active);
  }
}

export type HyperliquidAbstractionMode =
  | 'unifiedAccount'
  | 'portfolioMargin'
  | 'disabled'
  | 'default'
  | 'dexAbstraction';

export function isPooledAccountMode(
  mode: HyperliquidAbstractionMode | null | undefined,
): boolean {
  return mode === 'unifiedAccount' || mode === 'portfolioMargin';
}

export async function getUserAbstractionMode(
  userAddress: Hex,
): Promise<HyperliquidAbstractionMode | null> {
  try {
    const response = await hlInfoFetch( {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userAbstraction', user: userAddress }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data === 'string') return data as HyperliquidAbstractionMode;
    return null;
  } catch {
    return null;
  }
}

export type HlExtraAgent = {
  name: string;
  address: Hex;
  validUntil: number | null;
};

export async function listHlExtraAgents(userAddress: Hex): Promise<HlExtraAgent[]> {
  const response = await hlInfoFetch({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "extraAgents",
      user: userAddress,
    }),
  });

  if (!response.ok) {
    throw new Error(`extraAgents request failed: ${response.status}`);
  }

  const res = await response.json();
  if (!Array.isArray(res)) return [];
  const now = Date.now();
  return res
    .map((a: any) => {
      const rawValidUntil = a?.validUntil;
      const validUntil =
        rawValidUntil == null
          ? null
          : Number(rawValidUntil);
      return {
        name: String(a?.name ?? ""),
        address: a?.address as Hex,
        validUntil,
      };
    })
    .filter((a) => {
      if (!a.name || !a.address) return false;
      if (a.validUntil === null) return true;
      return Number.isFinite(a.validUntil) && a.validUntil > now;
    });
}

export interface HlSubAccount {
  name: string;
  subAccountUser: Hex;
  master: Hex;
}

export async function listHlSubAccounts(userAddress: Hex): Promise<HlSubAccount[]> {
  const info = getHlInfoClient();
  const res = await (info as any).subAccounts({ user: userAddress });
  if (!Array.isArray(res)) return [];
  return res.map((s: any) => ({
    name: String(s.name),
    subAccountUser: s.subAccountUser as Hex,
    master: s.master as Hex,
  }));
}

export async function switchAccountAbstractionToUnified(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
}): Promise<void> {
  const exchange = await createUserExchangeClient(args.userWalletProvider, args.userAddress);
  await (exchange as any).userSetAbstraction({
    user: args.userAddress,
    abstraction: 'unifiedAccount',
  });
}

export async function createHlSubAccount(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  /** 1-16 chars, unique per master. */
  name: string;
}): Promise<Hex> {
  const exchange = await createUserExchangeClient(args.userWalletProvider, args.userAddress);
  await (exchange as any).createSubAccount({ name: args.name });

  // HL reflects new sub-accounts in /info immediately after the L1 action acks.
  const subs = await listHlSubAccounts(args.userAddress);
  const match = subs.find((s) => s.name === args.name);
  if (!match) {
    throw new Error('Sub-account created but not yet visible. Try again in a few seconds.');
  }
  return match.subAccountUser;
}

export async function ensureSubAccountUnified(args: {
  userWalletProvider: Eip1193Provider;
  /** Master wallet that signs. */
  userAddress: Hex;
  subAccountAddress: Hex;
}): Promise<void> {
  const info = getHlInfoClient();
  let mode: string | null = null;
  try {
    const raw = await (info as any).userAbstraction({ user: args.subAccountAddress });
    mode =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? String((raw as any).abstraction ?? (raw as any).type ?? '') || null
          : null;
  } catch {
    mode = null;
  }
  if (mode === 'unifiedAccount' || mode === 'portfolioMargin') return;

  const exchange = await createUserExchangeClient(args.userWalletProvider, args.userAddress);
  await (exchange as any).userSetAbstraction({
    user: args.subAccountAddress,
    abstraction: 'unifiedAccount',
  });
}

export async function transferUsdToSubAccount(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  subAccountAddress: Hex;
  usd: number;
  /** true = master → sub-account, false = sub-account → master. */
  isDeposit: boolean;
}): Promise<void> {
  if (!(args.usd > 0) || !Number.isFinite(args.usd)) {
    throw new Error('Transfer amount must be positive');
  }
  const tokenSpec = await getUsdcTokenSpec();
  const amount = args.usd.toFixed(6).replace(/\.?0+$/, '');
  if (!(Number(amount) > 0)) throw new Error('Transfer amount must be positive');

  const exchange = await createUserExchangeClient(args.userWalletProvider, args.userAddress);

  if (args.isDeposit) {
    await (exchange as any).sendAsset({
      destination: args.subAccountAddress,
      sourceDex: 'spot',
      destinationDex: 'spot',
      token: tokenSpec,
      amount,
      fromSubAccount: '',
    });
  } else {
    await (exchange as any).sendAsset({
      destination: args.userAddress,
      sourceDex: 'spot',
      destinationDex: 'spot',
      token: tokenSpec,
      amount,
      fromSubAccount: args.subAccountAddress,
    });
  }
}

export async function getApprovedBuilderFeeTenths(userAddress: Hex): Promise<number> {
  const builder = getBuilderAddress();
  const response = await hlInfoFetch({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "maxBuilderFee",
      user: userAddress,
      builder,
    }),
  });

  if (!response.ok) {
    throw new Error(`maxBuilderFee request failed: ${response.status}`);
  }

  const value = await response.json();
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`maxBuilderFee returned invalid value: ${String(value)}`);
  }
  return n;
}

export async function isBuilderFeeApproved(
  userAddress: Hex,
  requiredTenths?: number,
): Promise<boolean> {
  const required = Number.isFinite(requiredTenths) && (requiredTenths as number) > 0
    ? (requiredTenths as number)
    : Math.max(getBuilderFeeTenthsBps(), getSpotBuilderFeeTenthsBps());
  const approved = await getApprovedBuilderFeeTenths(userAddress);
  return approved >= required;
}

export async function setupTradingAccount(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  agentAddress: Hex;
  /** Deprecated/ignored: HIP-3 trading no longer requires enabling dex abstraction on the agent. */
  agentPrivateKey?: Hex;
}): Promise<void> {
  const { userWalletProvider: provider, userAddress } = args;

  // 1) Approve the agent (API wallet) for one-tap trading.
  await withUserSignedExchange(provider, userAddress, (exchange) =>
    exchange.approveAgent({
      agentAddress: args.agentAddress,
      agentName: 'Anonymous Liquid'
    }),
  );

  // 2) Approve builder fee cap for the active builder address (10 bps).
  await withUserSignedExchange(provider, userAddress, (exchange) =>
    exchange.approveBuilderFee({
      builder: getBuilderAddress() as Hex,
      maxFeeRate: HL_BUILDER_MAX_FEE_RATE,
    }),
  );

  // 3) Move app users into HL's recommended consumer mode.
  const currentMode = await getUserAbstractionMode(args.userAddress).catch(() => null);
  if (!isPooledAccountMode(currentMode)) {
    await withUserSignedExchange(provider, userAddress, (exchange) =>
      (exchange as any).userSetAbstraction({
        user: args.userAddress,
        abstraction: 'unifiedAccount',
      }),
    );
  }
}

// ============================================================================
// Global Nonce Manager for Hyperliquid API calls
// ============================================================================
// Hyperliquid uses timestamps (ms) as nonces. Each nonce must be unique and
// greater than previously used nonces. This manager ensures monotonic nonces
// even when multiple calls happen in the same millisecond.
let _lastUsedNonce = 0;
let _withdrawMutexLock = false;

/**
 * Get a unique, monotonically increasing nonce for Hyperliquid API calls.
 * Ensures each nonce is at least 1ms greater than the last, with a small random offset.
 */
function getUniqueNonce(): number {
  const now = Date.now();
  // Ensure nonce is strictly greater than last used, with 1-10ms random offset to avoid collisions
  const randomOffset = Math.floor(Math.random() * 10) + 1;
  const nonce = Math.max(now, _lastUsedNonce + 1) + randomOffset;
  _lastUsedNonce = nonce;
  return nonce;
}

/**
 * Check if an error is a nonce-related error from Hyperliquid.
 */
function isNonceError(error: any): boolean {
  const msg = String(error?.message || error?.shortMessage || error || '').toLowerCase();
  return msg.includes('nonce') || 
         msg.includes('already been used') || 
         msg.includes('stale') ||
         msg.includes('expired');
}

export async function withdrawFromHyperliquid(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  destination: Hex;
  amountUsd: string; // "12.3"
}): Promise<void> {
  // Mutex lock to prevent concurrent withdrawal attempts (which can cause nonce collisions)
  if (_withdrawMutexLock) {
    throw new Error('A withdrawal is already in progress. Please wait.');
  }
  
  _withdrawMutexLock = true;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;
  
  try {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Force a fresh nonce by ensuring we're past the last used timestamp
        const freshNonce = getUniqueNonce();
        console.log(`[Withdraw] Attempt ${attempt}/${MAX_RETRIES}, nonce: ${freshNonce}`);
        
        // The SDK generates its own nonce, but we've updated _lastUsedNonce to ensure
        // any subsequent calls will use a higher nonce. Adding a small delay helps
        // ensure the SDK's Date.now() call gets a fresh timestamp.
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Same user-signed path as approveAgent: WalletConnect/MetaMask will
        // reject the typed-data if signatureChainId ≠ the wallet's selected
        // network. Callers should have already switched to Arbitrum; this
        // wrapper is the one-shot mismatch backstop.
        await withUserSignedExchange(args.userWalletProvider, args.userAddress, (exchange) =>
          exchange.withdraw3({ destination: args.destination, amount: args.amountUsd }),
        );
        console.log(`[Withdraw] Success on attempt ${attempt}`);
        return; // Success!
        
      } catch (error: any) {
        lastError = error;
        const errorMsg = String(error?.message || error?.shortMessage || error || '');
        console.warn(`[Withdraw] Attempt ${attempt} failed: ${errorMsg}`);
        
        // If it's a nonce error, we can retry
        if (isNonceError(error) && attempt < MAX_RETRIES) {
          console.log(`[Withdraw] Nonce error detected, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        
        // For non-nonce errors or final attempt, throw immediately
        throw error;
      }
    }
    
    // If we exhausted all retries
    throw lastError || new Error('Withdrawal failed after max retries');
    
  } finally {
    _withdrawMutexLock = false;
  }
}

export type PerpMarginSupport = {
  symbol: string;
  supportsCross: boolean;
  onlyIsolated: boolean;
  marginMode?: 'strictIsolated' | 'noCross';
};

function safeNum(x: string | number | null | undefined): number {
  if (x === null || x === undefined) return 0;
  const n = typeof x === 'number' ? x : parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

export type PlaceOrderInput = {
  agentPrivateKey: Hex;
  symbol: string;
  side: 'long' | 'short';
  // UX order types. Trigger orders map to HL's `tpsl` field:
  //   stop_*   → tpsl='sl' (loss-direction trigger: buy above mid, sell below)
  //   take_*   → tpsl='tp' (profit-direction trigger: buy below mid, sell above)
  // Matches HL's official rule from gitbook.io/hyperliquid-docs and the
  // @nktkas/hyperliquid SDK. HL's server does the direction validation
  // against the mid price; we pre-validate client-side for a cleaner UX.
  orderType:
    | 'market'
    | 'limit'
    | 'stop_market'
    | 'stop_limit'
    | 'take_market'
    | 'take_limit';
  // Display inputs (USD)
  sizeUsd: number;
  oraclePx: number;
  // For limit / stop_limit / take_limit
  limitPx?: number;
  // For stop_* / take_* (the price at which the trigger fires)
  triggerPx?: number;
  // Optional mid/mark reference price for stop validation
  referencePx?: number;
  // Slippage used for "market" style IOC pricing (e.g. 0.005 = 0.5%)
  slippageBps?: number;
  reduceOnly?: boolean;
  leverage?: number;
  isCross?: boolean;
  // Optional: pass margin support from the caller to avoid redundant API call
  marginSupport?: PerpMarginSupport | null;
  // Optional: skip leverage update if caller knows it's already set
  skipLeverageUpdate?: boolean;

  // ── JIT funding for Standard-mode perp DEX balances ─────────────────────
  // In Standard mode USDC is siloed per perp DEX. If the target DEX lacks
  // opening margin but another DEX has withdrawable USDC, `placeOrder` can
  // automatically sendAsset the shortfall before placing the order.
  /** User's Privy embedded wallet provider, required for signing the JIT sendAsset. */
  userWalletProvider?: Eip1193Provider;
  /** User address (same wallet that signs the sendAsset). */
  userAddress?: Hex;
  /** Latest target DEX initial-margin room (`marginSummary.accountValue - totalMarginUsed`). */
  targetDexMarginAvailableUsd?: number;
  /** Per-dex free/withdrawable USDC available as transfer sources (Standard mode). */
  perpWithdrawableByDex?: Record<string, number>;
  /**
   * Unified / portfolioMargin source budget for JIT funding of HIP-3 orders.
   * HL only accepts `sendAsset(sourceDex: "spot", destinationDex: "<dex>")`
   * for unified accounts; this field is the spot-USDC pool minus the margin
   * already reserved by isolated and cross positions, i.e. how much can be
   * safely moved out of spot to seed a HIP-3 dex.
   *
   * Computed by callers as:
   *   `spotUsdcBalanceUsd − totalIsolatedMarginUsedUsd − totalCrossMaintenanceMarginUsedUsd`
   */
  unifiedSpotPoolFreeUsd?: number;
  /** Latest HIP-3 dex USDC balance (from `allDexsClearinghouseState` stream). */
  hip3DexBalanceUsd?: number;
  /** Latest main-dex perp USDC balance minus margin already in use. */
  mainDexAvailableUsdc?: number;
  /** User's account-abstraction mode — controls how JIT sources funds. */
  accountAbstractionMode?: HyperliquidAbstractionMode | null;
  /**
   * Trade as this HL sub-account. Device-agent signs; SDK sets
   * `defaultVaultAddress` (HL: subs have no keys — master/agent + vaultAddress).
   * JIT sendAsset uses the same sub via `fromSubAccount` so HIP-3 seeding
   * stays inside that book (Main collateral never moves).
   */
  vaultAddress?: Hex;
};

export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === 'string'
      ? err
      : ((err as any)?.message ?? (err as any)?.toString?.() ?? '');
  if (!msg) return false;
  const s = String(msg).toLowerCase();
  return (
    s.includes('429') ||
    s.includes('rate limit') ||
    s.includes('rate-limit') ||
    s.includes('too many requests') ||
    s.includes('throttled')
  );
}

export function isHlRateLimitError(err: any): boolean {
  if (!err) return false;
  if (err.status === 429 || err.code === 429) return true;
  const msg = String(err?.message ?? err ?? '');
  return /(^|[^\d])429([^\d]|$)/.test(msg) || /rate.?limit/i.test(msg);
}

export function isWalletTypedDataSigningError(err: unknown): boolean {
  const msg =
    typeof err === 'string'
      ? err
      : ((err as any)?.message ?? (err as any)?.shortMessage ?? (err as any)?.toString?.() ?? '');
  if (!msg) return false;
  const s = String(msg).toLowerCase();
  return (
    s.includes('view wallet') ||
    (s.includes('sign typed data') || s.includes('signtypeddata') || s.includes('eth_signtypeddata')) &&
      (s.includes('failed') || s.includes('unable') || s.includes('not supported') || s.includes('unsupported'))
  );
}

export function getPerpOrderAcceptanceError(result: any): string | null {
  if (!result || typeof result !== 'object') {
    return 'Order was not accepted by Hyperliquid.';
  }

  if (result.status === 'err') {
    return String(result.response ?? result.error ?? 'Order was rejected by Hyperliquid.');
  }

  const statuses = result?.response?.data?.statuses;
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return 'Hyperliquid did not return an accepted order status.';
  }

  const first = statuses[0];
  if (!first || typeof first !== 'object') {
    return 'Hyperliquid returned an invalid order status.';
  }

  if ('error' in first) {
    return String((first as any).error || 'Order was rejected by Hyperliquid.');
  }

  if ('filled' in first || 'resting' in first) {
    return null;
  }

  return `Hyperliquid returned an unknown order status: ${JSON.stringify(first)}`;
}

const META_CACHE_TTL_MS = 5 * 60 * 1000;
const LEVERAGE_CACHE_TTL_MS = 60_000;

async function getMetaCached() {
  const b = mainnetBucket;
  const now = Date.now();
  if (!b.metaPromise || (now - b.metaFetchedAt) > META_CACHE_TTL_MS) {
    const promise = getHlInfoClient()
      .meta()
      .catch((err) => {
        if (b.metaPromise === promise) {
          b.metaPromise = null;
          b.metaFetchedAt = 0;
        }
        throw err;
      });
    b.metaPromise = promise;
    b.metaFetchedAt = now;
  }
  return b.metaPromise;
}

async function getHip3MetaCached(
  dexName: string,
  options?: { forceRefresh?: boolean },
): Promise<any> {
  const b = mainnetBucket;
  const now = Date.now();
  const cached = b.hip3MetaCache.get(dexName);
  const stale = !cached || (now - cached.fetchedAt) > META_CACHE_TTL_MS;
  if (options?.forceRefresh || stale) {
    const promise = (async () => {
      const r = await hlInfoFetch( {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta', dex: dexName }),
      });
      if (!r.ok) {
        throw new Error(`HIP-3 meta fetch failed for ${dexName}: ${r.status}`);
      }
      const json = await r.json();
      if (!json || !Array.isArray(json?.universe)) {
        throw new Error(`HIP-3 meta response missing universe for ${dexName}`);
      }
      return json;
    })().catch((err) => {
      const current = b.hip3MetaCache.get(dexName);
      if (current && current.promise === promise) b.hip3MetaCache.delete(dexName);
      throw err;
    });
    b.hip3MetaCache.set(dexName, { promise, fetchedAt: now });
  }
  return b.hip3MetaCache.get(dexName)!.promise;
}

async function getPerpDexsCached(options?: { forceRefresh?: boolean }): Promise<any> {
  const b = mainnetBucket;
  if (options?.forceRefresh || !b.perpDexsPromise) {
    const promise = (async () => {
      const r = await hlInfoFetch( {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'perpDexs' }),
      });
      if (!r.ok) throw new Error(`perpDexs fetch failed: ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json)) throw new Error('perpDexs response is not an array');
      return json;
    })().catch((err) => {
      if (b.perpDexsPromise === promise) b.perpDexsPromise = null;
      throw err;
    });
    b.perpDexsPromise = promise;
  }
  return b.perpDexsPromise;
}

export async function getSymbolConverter(): Promise<SymbolConverter> {
  const b = mainnetBucket;
  if (!b.converterPromise) {
    const promise = SymbolConverter.create({ transport: getHlTransport() }).catch((err) => {
      if (b.converterPromise === promise) b.converterPromise = null;
      throw err;
    });
    b.converterPromise = promise;
  }
  return b.converterPromise;
}

async function getAssetIdAndMeta(symbol: string): Promise<{ assetId: number; szDecimals: number; maxLeverage?: number; onlyIsolated?: boolean }> {
  const isHip3 = symbol.includes(':');
  
  if (isHip3) {
    const dexName = symbol.split(':')[0];
    const coinName = symbol;
    let meta = await getHip3MetaCached(dexName);
    let universe = (meta?.universe ?? []) as Array<any>;
    let assetIndex = universe.findIndex((u: any) => u?.name === coinName);
    if (assetIndex === -1) {
      meta = await getHip3MetaCached(dexName, { forceRefresh: true });
      universe = (meta?.universe ?? []) as Array<any>;
      assetIndex = universe.findIndex((u: any) => u?.name === coinName);
    }
    if (assetIndex === -1) {
      throw new Error(`Unknown HIP-3 symbol for Hyperliquid: ${symbol}`);
    }
    let dexes = await getPerpDexsCached();
    let dexIndex = Array.isArray(dexes)
      ? dexes.findIndex((d: any) => d?.name === dexName || d?.dex === dexName)
      : -1;
    if (dexIndex < 0) {
      dexes = await getPerpDexsCached({ forceRefresh: true });
      dexIndex = Array.isArray(dexes)
        ? dexes.findIndex((d: any) => d?.name === dexName || d?.dex === dexName)
        : -1;
    }
    if (dexIndex < 0) {
      throw new Error(`Unknown HIP-3 dex for Hyperliquid: ${dexName}`);
    }
    const entry = universe[assetIndex] ?? {};
    return {
      assetId: 100000 + dexIndex * 10000 + assetIndex,
      szDecimals: entry?.szDecimals ?? 0,
      maxLeverage: Number(entry?.maxLeverage),
      onlyIsolated: !!entry?.onlyIsolated || entry?.marginMode === 'strictIsolated' || entry?.marginMode === 'noCross',
    };
  } else {
    const converter = await getSymbolConverter();
    const meta = await getMetaCached();
    const universe = (meta?.universe ?? []) as Array<any>;
    const normalized = symbol.toUpperCase();
    const aliases = [
      normalized,
      normalized.replace(/-PERP$/, ''),
      normalized.replace(/-USD$/, ''),
    ].filter(Boolean);
    for (const candidate of aliases) {
      const assetId = converter.getAssetId(candidate);
      if (assetId !== undefined) {
        const entry = universe.find((u: any) => u?.name === candidate) ?? {};
        const szDecimals = entry?.szDecimals ?? (converter.getSzDecimals(candidate) ?? 0);
        const maxLeverage = Number(entry?.maxLeverage);
        const onlyIsolated =
          !!entry?.onlyIsolated || entry?.marginMode === 'strictIsolated' || entry?.marginMode === 'noCross';
        return { assetId, szDecimals, maxLeverage, onlyIsolated };
      }
    }
    throw new Error(`Unknown symbol for Hyperliquid: ${symbol}`);
  }
}

export async function getPerpMarginSupport(symbol: string): Promise<PerpMarginSupport | null> {
  const isHip3 = symbol.includes(':');
  const dexName = isHip3 ? symbol.split(':')[0].toLowerCase() : null;

  let meta: any;
  if (dexName) {
    meta = await getHip3MetaCached(dexName);
  } else {
    meta = await getMetaCached();
  }

  const symUpper = symbol.toUpperCase();
  const coinUpper = isHip3 ? symbol.split(':')[1].toUpperCase() : symUpper;
  const uni = (meta?.universe ?? []) as Array<any>;
  const entry = uni.find((u) => {
    const n = String(u?.name ?? '').toUpperCase();
    return (
      n === symUpper ||
      (isHip3 && (n === coinUpper || n === `${dexName}:${coinUpper}`.toUpperCase()))
    );
  });
  if (!entry) return null;

  const onlyIsolated = !!entry.onlyIsolated || entry.marginMode === 'strictIsolated';
  const noCross = entry.marginMode === 'noCross';
  const supportsCross = !(onlyIsolated || noCross);

  return {
    symbol,
    supportsCross,
    onlyIsolated,
    marginMode: entry.marginMode,
  };
}

export async function getUsdcTokenSpec(): Promise<string> {
  const b = mainnetBucket;
  if (b.usdcTokenPromise) return b.usdcTokenPromise;
  b.usdcTokenPromise = (async () => {
    const data = await getSpotMetaAndAssetCtxsCached();
    const meta = Array.isArray(data) ? data[0] : data;
    const tokens: any[] = meta?.tokens ?? [];
    const usdc = tokens.find((t) => String(t?.name ?? '').toUpperCase() === 'USDC');
    if (!usdc || !usdc.tokenId) {
      throw new Error('Could not resolve USDC token spec from HL spotMeta');
    }
    return `USDC:${usdc.tokenId}`;
  })().catch((err) => {
    b.usdcTokenPromise = null;
    throw err;
  });
  return b.usdcTokenPromise;
}

export async function transferPerpDexUsdc(args: {
  userWalletProvider: Eip1193Provider;
  /** Master wallet that signs (subs have no keys). */
  userAddress: Hex;
  sourceDex: string;
  destinationDex: string;
  amountUsd: number;
  /**
   * When set, debit/credit this HL sub-account (SDK `fromSubAccount` +
   * destination = sub). Master-signed; never pulls Main spot into the sub's
   * dex — keeps Dedicated risk isolated. See HL sendAsset / CoreWriter
   * sendAsset (subAccount ≠ zero ⇒ transfer from sub).
   */
  fromSubAccount?: Hex;
}): Promise<void> {
  if (!Number.isFinite(args.amountUsd) || args.amountUsd <= 0) return;
  if (args.sourceDex === args.destinationDex) return;

  const tokenSpec = await getUsdcTokenSpec();
  const exchange = await createUserExchangeClient(args.userWalletProvider, args.userAddress);

  const sub = args.fromSubAccount;
  const destUser = sub ?? args.userAddress;
  const destDex = args.destinationDex;
  const before = destDex === 'spot'
    ? null
    : await readPerpDexAccountValueUsd(destUser, destDex).catch(() => null);

  const send = () =>
    (exchange as any).sendAsset({
      // Self-transfer on the book that owns the balances.
      destination: destUser,
      sourceDex: args.sourceDex,
      destinationDex: args.destinationDex,
      token: tokenSpec,
      amount: args.amountUsd.toFixed(6).replace(/\.?0+$/, ''),
      fromSubAccount: sub ?? '',
    });

  const isLanded = async () => {
    if (before == null || destDex === 'spot') return false;
    const now = await readPerpDexAccountValueUsd(destUser, destDex);
    return now + 0.02 >= before + args.amountUsd * 0.95;
  };

  try {
    await waitForWalletSignedAction({ sign: send, isLanded });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === '__approve_timeout__' && (await isLanded().catch(() => false))) {
      return;
    }
    if (msg === '__approve_timeout__') {
      throw new Error(
        'Wallet did not return the funding signature. If you already signed, wait a moment and try the order again.',
      );
    }
    throw err;
  }
}

async function readPerpDexAccountValueUsd(user: Hex, dex: string): Promise<number> {
  const info = getHlInfoClient();
  const st = dex
    ? await info.clearinghouseState({ user, dex })
    : await info.clearinghouseState({ user });
  return safeNum((st as any)?.marginSummary?.accountValue);
}

export async function ensurePerpDexFunded(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  targetDex: string;
  requiredUsdc: number;
  currentTargetAvailableUsdc: number;
  withdrawableByDex: Record<string, number>;
  /**
   * Route transfers through spot rather than perp-to-perp. REQUIRED for
   * unified / portfolioMargin accounts: HL rejects direct perp-to-perp
   * `sendAsset` in those modes ("unified account only accept sending assets
   * through spot"). When set, every funding leg uses `sourceDex: "spot"` and
   * the source budget is the spot USDC balance. The `withdrawableByDex` map
   * is then ignored — pass `spotSourceUsd` as the per-call source amount.
   */
  spotSourceUsd?: number;
  bufferFraction?: number;
  /** Dedicated book: run JIT inside this sub only (see {@link transferPerpDexUsdc}). */
  fromSubAccount?: Hex;
}): Promise<{ transferred: number }> {
  // `requiredUsdc` is the new position's initial margin (= notional / leverage).
  // The 2% buffer covers taker fees + slippage at fill, since fees are deducted
  // from the destination dex's pool right after the order fills.
  const buffer = args.bufferFraction ?? 0.02;
  const targetMinimum = args.requiredUsdc * (1 + buffer);
  let remaining = targetMinimum - args.currentTargetAvailableUsdc;
  if (remaining <= 0) return { transferred: 0 };

  // Unified / portfolioMargin path — HL routes via spot.
  if (typeof args.spotSourceUsd === 'number') {
    const available = Math.max(0, args.spotSourceUsd);
    if (__DEV__) {
      try {
        // eslint-disable-next-line no-console
        console.log('[JITFunding:spot]', {
          targetDex: args.targetDex,
          requiredUsdc: args.requiredUsdc,
          targetMinimum,
          currentTargetAvailableUsdc: args.currentTargetAvailableUsdc,
          remaining,
          spotSourceAvailable: available,
        });
      } catch {}
    }
    if (available < remaining - 0.01) {
      // Backstop — the slider/Max in the trade UIs already mutes the action
      // buttons when transferable hits $0 (HL's `max(initial, 0.10×notional)`
      // rule, see Margining docs). This branch is hit only when something
      // bypasses the UI gate (e.g. a stale state, a programmatic trigger).
      // Keep the message short and let the UI do the explaining.
      throw new Error('Margin insufficient');
    }
    const amount = Math.min(available, Math.ceil(remaining * 100) / 100);
    if (amount > 0.01) {
      // One transparent retry on transient 429s. HL throttles rate-limited
      // addresses to "1 action / 10 seconds" (see HL Rate limits docs), so a
      // single ~11 s retry is enough to recover most cases that aren't the
      // user genuinely burning through their address-based budget.
      const tryOnce = async (): Promise<void> => {
        await transferPerpDexUsdc({
          userWalletProvider: args.userWalletProvider,
          userAddress: args.userAddress,
          sourceDex: 'spot',
          destinationDex: args.targetDex,
          amountUsd: amount,
          fromSubAccount: args.fromSubAccount,
        });
      };
      try {
        try {
          await tryOnce();
        } catch (firstErr: any) {
          if (isHlRateLimitError(firstErr)) {
            if (__DEV__) {
              try {
                // eslint-disable-next-line no-console
                console.warn('[JITFunding:spot] 429 — waiting 11s for HL cooldown', {
                  amount,
                  targetDex: args.targetDex,
                });
              } catch {}
            }
            await new Promise((r) => setTimeout(r, 11_000));
            await tryOnce();
          } else {
            throw firstErr;
          }
        }
      } catch (err: any) {
        if (__DEV__) {
          try {
            // eslint-disable-next-line no-console
            console.warn('[JITFunding:spot] transfer rejected', {
              amount,
              targetDex: args.targetDex,
              error: err?.message ?? String(err),
            });
          } catch {}
        }
        if (isHlRateLimitError(err)) {
          throw new Error('Hyperliquid is rate limiting your account. Wait ~10 seconds and try again.');
        }
        throw new Error(
          err?.message?.includes('insufficient')
            ? 'Margin insufficient'
            : (err?.message ?? 'Failed to fund target perp dex for this order'),
        );
      }
      // Give HL's user-state stream + matcher time to see the new equity
      // before we submit the order. 600ms keeps the flow responsive while
      // avoiding "insufficient margin" rejections from a stale snapshot.
      await new Promise((r) => setTimeout(r, 600));
      return { transferred: amount };
    }
    return { transferred: 0 };
  }

  // Standard mode — HL allows perp-to-perp, sources are siloed per dex.
  const sources = Object.entries(args.withdrawableByDex)
    .map(([dex, value]) => ({ dex, value: safeNum(value) }))
    .filter((s) => s.dex !== args.targetDex && s.value > 0.01)
    .sort((a, b) => {
      if (a.dex === '' && b.dex !== '') return -1;
      if (a.dex !== '' && b.dex === '') return 1;
      return b.value - a.value;
    });

  const totalAvailable = sources.reduce((sum, s) => sum + s.value, 0);
  if (totalAvailable < remaining - 0.01) {
    throw new Error(
      `Not enough free USDC to fund this order. Need ~$${remaining.toFixed(2)} more in transferable perp balances.`,
    );
  }

  let transferred = 0;
  for (const source of sources) {
    if (remaining <= 0.01) break;
    const amount = Math.min(source.value, Math.ceil(remaining * 100) / 100);
    if (amount <= 0.01) continue;
    await transferPerpDexUsdc({
      userWalletProvider: args.userWalletProvider,
      userAddress: args.userAddress,
      sourceDex: source.dex,
      destinationDex: args.targetDex,
      amountUsd: amount,
      fromSubAccount: args.fromSubAccount,
    });
    transferred += amount;
    remaining -= amount;
  }

  // Let HL's user-state stream and matcher see the transfer before the order.
  await new Promise((r) => setTimeout(r, 400));
  return { transferred };
}

export async function getMainPerpMetaAndAssetCtxsCached(): Promise<any> {
  const now = Date.now();

  if (
    mainnetBucket.mainPerpMetaAndAssetCtxs !== null &&
    now - mainnetBucket.mainPerpMetaAndAssetCtxsFetchedAt <
      MAIN_PERP_META_CACHE_TTL_MS
  ) {
    return mainnetBucket.mainPerpMetaAndAssetCtxs;
  }

  if (mainnetBucket.mainPerpMetaAndAssetCtxsPromise) {
    return mainnetBucket.mainPerpMetaAndAssetCtxsPromise;
  }

  const stale = mainnetBucket.mainPerpMetaAndAssetCtxs;

  const promise = hlInfoFetch({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'metaAndAssetCtxs',
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Hyperliquid info request failed: ${response.status}`,
        );
      }
      return response.json();
    })
    .then((data) => {
      mainnetBucket.mainPerpMetaAndAssetCtxs = data;
      mainnetBucket.mainPerpMetaAndAssetCtxsFetchedAt =
        Date.now();
      return data;
    })
    .catch((error) => {
      if (stale !== null) {
        return stale;
      }
      throw error;
    })
    .finally(() => {
      if (
        mainnetBucket.mainPerpMetaAndAssetCtxsPromise ===
        promise
      ) {
        mainnetBucket.mainPerpMetaAndAssetCtxsPromise =
          null;
      }
    });

  mainnetBucket.mainPerpMetaAndAssetCtxsPromise = promise;

  return promise;
}

export async function getSpotMetaAndAssetCtxsCached(): Promise<any> {
  const now = Date.now();
  const b = mainnetBucket;

  if (
    b.spotMetaAndAssetCtxs !== null &&
    now - b.spotMetaAndAssetCtxsFetchedAt < 10_000
  ) {
    return b.spotMetaAndAssetCtxs;
  }

  if (b.spotMetaAndCtxsPromise) {
    return b.spotMetaAndCtxsPromise;
  }

  const stale = b.spotMetaAndAssetCtxs;

  const promise = hlInfoFetch({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Hyperliquid spot info request failed: ${response.status}`,
        );
      }
      return response.json();
    })
    .then((data) => {
      b.spotMetaAndAssetCtxs = data;
      b.spotMetaAndAssetCtxsFetchedAt = Date.now();
      return data;
    })
    .catch((error) => {
      if (stale !== null) {
        return stale;
      }
      throw error;
    })
    .finally(() => {
      if (b.spotMetaAndCtxsPromise === promise) {
        b.spotMetaAndCtxsPromise = null;
      }
    });

  b.spotMetaAndCtxsPromise = promise;

  return promise;
}

/**
 * Match Spot context to the exact market. The PRIMARY HyperTrade source
 * uses the exact coin identifier, with positional fallback for older arrays.
 */
function getSpotContextForMarket(
  market: any,
  universePosition: number,
  contexts: any[],
  byCoin?: Map<string, any>,
): any {
  if (!Array.isArray(contexts)) return {};
  const marketName = String(market?.name ?? "").trim().toUpperCase();
  const rawIndex = market?.index;
  const indexNumber = Number(rawIndex);
  const marketIndex =
    rawIndex !== null && rawIndex !== undefined &&
    Number.isInteger(indexNumber) && indexNumber >= 0
      ? indexNumber : universePosition;
  const identifier = `@${marketIndex}`;
  const found = byCoin
    ? (byCoin.get(marketName) ?? byCoin.get(identifier))
    : contexts.find((context: any) => {
        const coin = String(context?.coin ?? "").trim().toUpperCase();
        return Boolean(coin) && (coin === marketName || coin === identifier);
      });
  if (found) return found;
  // Never attribute a different labeled context to this market.
  if (contexts.some((context: any) =>
    String(context?.coin ?? "").trim().length > 0)) {
    return {};
  }
  // Unlabeled responses match the spot metadata universe by position.
  return contexts[universePosition] ?? {};
}

async function resolveSpotSymbol(baseOrPair: string): Promise<string> {
  const data = await getSpotMetaAndAssetCtxsCached();
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Failed to load spot metadata');
  }
  const meta = data[0];
  const universe = meta?.universe ?? [];
  const tokens = meta?.tokens ?? [];
  const universeNames = new Set(universe.map((u: any) => String(u?.name ?? '').toUpperCase()));

  const raw = String(baseOrPair ?? '').toUpperCase();

  if (universeNames.has(raw)) return raw;
  const direct = raw.includes('/') ? raw : `${raw}/USDC`;
  if (universeNames.has(direct)) return direct;

  // HL docs note some spot assets are remapped (e.g., UBTC/USDC on mainnet).
  const prefixed = raw.startsWith('U') ? raw : `U${raw}`;
  const prefixedPair = prefixed.includes('/') ? prefixed : `${prefixed}/USDC`;
  if (universeNames.has(prefixedPair)) return prefixedPair;

  const unprefixed = raw.startsWith('U') ? raw.slice(1) : raw;
  const unprefixedPair = unprefixed.includes('/') ? unprefixed : `${unprefixed}/USDC`;
  if (universeNames.has(unprefixedPair)) return unprefixedPair;

  // Fallback: resolve by token indices for cases where universe name is "@index".
  const usdcIndex = tokens.find((t: any) => String(t?.name ?? '').toUpperCase() === 'USDC')?.index;
  // Prefer U-wrapped HL spot tokens before the bare symbol when resolving from a
  // perp ticker. Mainnet has both `MON` (@129, wrong $) and `UMON` (@243, Monad);
  // perp MON tracks UMON — matching `MON` first would show the junk spot book.
  const ru = String(raw).toUpperCase();
  const candidateNames: string[] = [];
  if (ru.startsWith('U')) {
    candidateNames.push(ru, ru.length > 1 ? ru.slice(1) : '');
  } else {
    candidateNames.push(`U${ru}`, ru);
  }
  candidateNames.push(ru.startsWith('W') ? ru.slice(1) : `W${ru}`);
  const uniqueCandidates = Array.from(
    new Set(candidateNames.filter(Boolean).map((v) => String(v).toUpperCase())),
  );
  const baseIndex = (() => {
    for (const name of uniqueCandidates) {
      const token = tokens.find((t: any) => String(t?.name ?? '').toUpperCase() === name);
      if (token && Number.isFinite(token.index)) return token.index;
    }
    // Non-canonical tokens may have a trailing digit suffix (e.g. XAUT0)
    for (const name of uniqueCandidates) {
      const token = tokens.find(
        (t: any) => {
          const tName = String(t?.name ?? '').toUpperCase();
          return tName.startsWith(name) && tName.length <= name.length + 1;
        },
      );
      if (token && Number.isFinite(token.index)) return token.index;
    }
    return null;
  })();
  
  if (Number.isFinite(usdcIndex) && Number.isFinite(baseIndex)) {
    const entry = universe.find(
      (u: any) =>
        Array.isArray(u?.tokens) &&
        u.tokens.length >= 2 &&
        u.tokens[0] === baseIndex &&
        u.tokens[1] === usdcIndex,
    );
    if (entry?.name) {

      return String(entry.name).toUpperCase();
    }
  }

  throw new Error(`Spot symbol not found: ${baseOrPair}`);
}

async function getSpotAssetIdAndMeta(spotSymbol: string): Promise<{ assetId: number; szDecimals: number; pxDecimals?: number }> {
  const data = await getSpotMetaAndAssetCtxsCached();
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Failed to load spot metadata');
  }
  const meta = data[0];
  const assetCtxs = data[1] ?? [];
  const universe = meta?.universe ?? [];
  const tokens = meta?.tokens ?? [];
  const idx = universe.findIndex((u: any) => String(u?.name ?? '').toUpperCase() === spotSymbol.toUpperCase());
  if (idx < 0) {
    throw new Error(`Spot symbol not found: ${spotSymbol}`);
  }
  const entry = universe[idx] ?? {};
  const entryIndex = Number(entry?.index);
  const ctx = getSpotContextForMarket(entry, idx, assetCtxs);
  const baseTokenIndex = Array.isArray(entry?.tokens) ? entry.tokens[0] : undefined;
  const token = tokens.find((t: any) => t?.index === baseTokenIndex) ?? {};
  const entrySzDecimals = Number(entry?.szDecimals ?? entry?.szDec);
  const ctxSzDecimals = Number(ctx?.szDecimals ?? ctx?.szDec);
  const entryPxDecimals = Number(entry?.pxDecimals ?? entry?.priceDecimals ?? entry?.pxDec);
  const ctxPxDecimals = Number(ctx?.pxDecimals ?? ctx?.priceDecimals ?? ctx?.pxDec);
  const tokenSzDecimals = Number(token?.szDecimals);
  const szDecimals = Number.isFinite(entrySzDecimals)
    ? entrySzDecimals
    : Number.isFinite(ctxSzDecimals)
      ? ctxSzDecimals
      : Number.isFinite(tokenSzDecimals)
        ? tokenSzDecimals
        : 0;
  // Per HL docs: spot asset id = 10000 + index in spotMeta.universe
  const assetId = 10000 + (Number.isFinite(entryIndex) ? entryIndex : idx);
  const pxDecimals = Number.isFinite(entryPxDecimals)
    ? entryPxDecimals
    : Number.isFinite(ctxPxDecimals)
      ? ctxPxDecimals
      : undefined;
  return { assetId, szDecimals, pxDecimals };
}

export async function getSpotAssetData(baseSymbolOrPair: string): Promise<{
  spotSymbol: string;
  markPx?: number;
  midPx?: number;
  assetId: number;
  szDecimals: number;
  pxDecimals?: number;
  baseCoin?: string;
}> {
  const spotSymbol = await resolveSpotSymbol(baseSymbolOrPair);
  const data = await getSpotMetaAndAssetCtxsCached();
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Failed to load spot metadata');
  }
  const meta = data[0];
  const assetCtxs = data[1] ?? [];
  const universe = meta?.universe ?? [];
  const tokens = meta?.tokens ?? [];
  const idx = universe.findIndex((u: any) => String(u?.name ?? '').toUpperCase() === spotSymbol.toUpperCase());
  if (idx < 0) {
    throw new Error(`Spot symbol not found: ${spotSymbol}`);
  }
  const entry = universe[idx] ?? {};
  const ctx = getSpotContextForMarket(entry, idx, assetCtxs);
  const baseTokenIndex = Array.isArray(entry?.tokens) ? entry.tokens[0] : undefined;
  const token = tokens.find((t: any) => t?.index === baseTokenIndex) ?? {};
  const { assetId, szDecimals, pxDecimals } = await getSpotAssetIdAndMeta(spotSymbol);
  return {
    spotSymbol,
    markPx: Number(ctx?.markPx),
    midPx: Number(ctx?.midPx),
    assetId,
    szDecimals,
    pxDecimals,
    baseCoin: token?.name ? String(token.name).toUpperCase() : undefined,
  };
}

export async function getSpotSymbolMap(): Promise<{
  bySymbol: Record<string, { baseCoin: string }>;
  byBase: Record<string, string>;
  byToken: Record<string, string>;
  markPxBySymbol: Record<string, string>;
  markPxByBase: Record<string, string>;
  szDecimalsBySymbol: Record<string, number>;
  szDecimalsByBase: Record<string, number>;
}> {
  const data = await getSpotMetaAndAssetCtxsCached();
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Failed to load spot metadata');
  }
  const meta = data[0];
  const assetCtxs = data[1] ?? [];
  const universe = meta?.universe ?? [];
  const tokens = meta?.tokens ?? [];
  const usdcIndex = tokens.find((t: any) => String(t?.name ?? '').toUpperCase() === 'USDC')?.index;
  const bySymbol: Record<string, { baseCoin: string }> = {};
  const byBase: Record<string, string> = {};
  const byToken: Record<string, string> = {};
  const markPxBySymbol: Record<string, string> = {};
  const markPxByBase: Record<string, string> = {};
  // szDecimals is HL's spot lot precision (min sellable = 10^-szDecimals base
  // units). UI uses this to detect unsellable dust and avoid showing a Close
  // button that would just throw "Size too small".
  const szDecimalsBySymbol: Record<string, number> = {};
  const szDecimalsByBase: Record<string, number> = {};
  tokens.forEach((token: any) => {
    const index = token?.index;
    const name = String(token?.name ?? '').toUpperCase();
    if (index != null && name) byToken[String(index)] = name;
  });
  (universe ?? []).forEach((entry: any, universePosition: number) => {
    if (!entry?.name || !Array.isArray(entry?.tokens) || entry.tokens.length < 2) return;
    if (!Number.isFinite(usdcIndex) || entry.tokens[1] !== usdcIndex) return;
    const baseToken = tokens.find((t: any) => t?.index === entry.tokens[0]);
    const baseCoin = String(baseToken?.name ?? '').toUpperCase();
    if (!baseCoin) return;
    const symbol = String(entry.name).toUpperCase();
    bySymbol[symbol] = { baseCoin };
    if (!byBase[baseCoin]) byBase[baseCoin] = symbol;
    const ctx = getSpotContextForMarket(entry, universePosition, assetCtxs);
    const markPx = ctx?.markPx ?? ctx?.midPx;
    if (markPx != null) {
      markPxBySymbol[symbol] = String(markPx);
      if (!markPxByBase[baseCoin]) markPxByBase[baseCoin] = String(markPx);
    }
    const szDecRaw = Number(baseToken?.szDecimals ?? entry?.szDecimals);
    if (Number.isFinite(szDecRaw)) {
      szDecimalsBySymbol[symbol] = szDecRaw;
      if (szDecimalsByBase[baseCoin] == null) szDecimalsByBase[baseCoin] = szDecRaw;
    }
  });
  // Monad: perp ticker MON matches spot UMON (@243). A legacy `MON` token still
  // exists (@129) with a unrelated price — route display-MON spot lookups to UMON.
  const umonSym = byBase['UMON'];
  const monSym = byBase['MON'];
  if (umonSym && monSym && umonSym !== monSym) {
    byBase['MON'] = umonSym;
    const px = markPxBySymbol[umonSym];
    if (px != null) markPxByBase['MON'] = px;
    const sz = szDecimalsBySymbol[umonSym];
    if (Number.isFinite(sz)) szDecimalsByBase['MON'] = sz;
  }
  return { bySymbol, byBase, byToken, markPxBySymbol, markPxByBase, szDecimalsBySymbol, szDecimalsByBase };
}

export async function placeOrder(input: PlaceOrderInput) {
  const { assetId, szDecimals, maxLeverage, onlyIsolated } = await getAssetIdAndMeta(input.symbol);
  const isHip3OnEntry = input.symbol.includes(':');

  // JIT sendAsset funding for HIP-3 / cross-DEX orders.
  //
  // Standard mode: USDC is siloed per perp DEX. We sendAsset between perp
  // dexes directly, sourcing from each dex's `withdrawable`.
  //
  // Unified / portfolioMargin mode: HL pools spot USDC with main perp into a
  // single accountValue, BUT every HIP-3 dex (`xyz`, `abcd`, …) still has
  // its own clearinghouseState. When the user already has open positions on
  // main, HL does NOT auto-source spot USDC into a brand-new HIP-3 dex and
  // rejects the order with "insufficient margin". Empirically we have to
  // pre-fund the target dex via `sendAsset`. HL also rejects perp-to-perp
  // sendAsset for unified accounts ("unified account only accept sending
  // assets through spot"), so the route MUST be `sourceDex: "spot"`. We
  // budget the transfer from the unified-pool free margin (spot USDC minus
  // isolated/cross margin already used), since spot withdrawable in unified
  // mode is constrained by every cross position's margin reservation.
  const abstractionMode = input.accountAbstractionMode ?? null;
  if (abstractionMode === 'dexAbstraction') {
    throw new Error('This legacy Hyperliquid account mode is being discontinued. Open Profile and upgrade to unified balances before placing orders.');
  }
  const isPooledAbstraction = isPooledAccountMode(abstractionMode);
  const targetDex = isHip3OnEntry ? input.symbol.split(':')[0] : '';
  const legacyWithdrawableByDex: Record<string, number> = {
    ...(Number.isFinite(input.mainDexAvailableUsdc) ? { '': input.mainDexAvailableUsdc as number } : {}),
    ...(isHip3OnEntry && Number.isFinite(input.hip3DexBalanceUsd)
      ? { [targetDex]: input.hip3DexBalanceUsd as number }
      : {}),
  };
  // Standard-mode source map: per-dex withdrawable USDC. Unused in unified
  // mode where the spot route + spot-pool budget take over below.
  const standardSourceByDex = input.perpWithdrawableByDex ?? legacyWithdrawableByDex;
  const targetDexMarginAvailableUsd = Number.isFinite(input.targetDexMarginAvailableUsd)
    ? (input.targetDexMarginAvailableUsd as number)
    : (targetDex === ''
      ? (Number.isFinite(input.mainDexAvailableUsdc) ? (input.mainDexAvailableUsdc as number) : 0)
      : (Number.isFinite(input.hip3DexBalanceUsd) ? (input.hip3DexBalanceUsd as number) : 0));
  // JIT-fund the target dex when:
  //   • Opening (not reduce-only)
  //   • Target dex has a margin shortfall vs the order's initial margin
  //   • We have a wallet to sign and a non-zero source budget
  //
  // For unified mode targeting MAIN perp we skip JIT: main IS the unified
  // pool, so a "shortfall" there can't be solved by transferring from spot
  // (it's the same pool). HL handles main-pool margin checks natively and
  // returns clean error messages — we don't need to wrap them.
  const skipJitForUnifiedMain = isPooledAbstraction && targetDex === '';
  const unifiedSpotPoolUsd = isPooledAbstraction
    ? Math.max(0, safeNum(input.unifiedSpotPoolFreeUsd))
    : 0;
  const hasUnifiedSpotBudget = isPooledAbstraction && unifiedSpotPoolUsd > 0.01;
  const hasStandardBudget = !isPooledAbstraction && Object.keys(standardSourceByDex).length > 0;
  // JIT seeds the target HIP-3 dex from the active book's spot/perp pools.
  // When `vaultAddress` is set, sendAsset uses fromSubAccount=sub so only that
  // sub's collateral moves (Main stays isolated).
  const shouldTryJitFunding =
    !input.reduceOnly &&
    !skipJitForUnifiedMain &&
    !!input.userWalletProvider &&
    !!input.userAddress &&
    Number.isFinite(targetDexMarginAvailableUsd) &&
    (hasUnifiedSpotBudget || hasStandardBudget) &&
    Number.isFinite(input.sizeUsd) &&
    Number.isFinite(input.leverage) &&
    (input.leverage as number) > 0;

  if (shouldTryJitFunding) {
    // HL's order-acceptance check is purely
    //   `accountValue ≥ initialMargin`
    // (per HL margining docs — maintenance margin is a *liquidation*-time
    // concept). Fees are deducted from accountValue at fill time, but they
    // come out of the destination dex's pool post-fill and don't block
    // order acceptance. So the JIT transfer just needs to cover initial
    // margin; `ensurePerpDexFunded` already adds a 2% buffer on top to
    // absorb fee/slippage/rounding.
    //
    // (We previously also reserved maintenance margin here, but that
    // required transferring ~50% MORE than the slider's max — at unified
    // limits the spot pool didn't have it and HL rejected with
    // "Insufficient balance for token transfer".)
    const lev = input.leverage as number;
    const initRequired = input.sizeUsd / lev;
    const requiredMargin = initRequired;
    if (__DEV__) {
      try {
        // eslint-disable-next-line no-console
        console.log('[JITFunding]', {
          mode: abstractionMode,
          targetDex,
          symbol: input.symbol,
          sizeUsd: input.sizeUsd,
          leverage: lev,
          maxLeverage,
          initRequired,
          requiredMargin,
          targetDexCurrent: Math.max(0, targetDexMarginAvailableUsd),
          unifiedSpotPoolUsd,
          isPooledAbstraction,
        });
      } catch {}
    }
    try {
      await ensurePerpDexFunded({
        userWalletProvider: input.userWalletProvider!,
        userAddress: input.userAddress!,
        targetDex,
        requiredUsdc: requiredMargin,
        currentTargetAvailableUsdc: Math.max(0, targetDexMarginAvailableUsd),
        withdrawableByDex: standardSourceByDex,
        ...(isPooledAbstraction ? { spotSourceUsd: unifiedSpotPoolUsd } : {}),
        ...(input.vaultAddress ? { fromSubAccount: input.vaultAddress } : {}),
      });
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to fund target perp dex for this order');
    }
  }
  if (!Number.isFinite(input.sizeUsd) || input.sizeUsd <= 0) {
    throw new Error('Invalid size');
  }
  if (input.sizeUsd < 10) {
    throw new Error('Order must have minimum value of $10.');
  }
  if (!Number.isFinite(input.oraclePx) || input.oraclePx <= 0) {
    throw new Error('Invalid oracle price');
  }

  const sizeUnitsRaw = input.sizeUsd / input.oraclePx;
  
  // Validate size before formatting
  if (!Number.isFinite(sizeUnitsRaw) || sizeUnitsRaw <= 0) {
    throw new Error('Invalid size calculation');
  }
  
  const minSizeUnits = Math.pow(10, -szDecimals);
  if (sizeUnitsRaw < minSizeUnits) {
    const minUsd = minSizeUnits * input.oraclePx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  let sizeUnits: string;
  try {
    sizeUnits = formatSize(sizeUnitsRaw, szDecimals);
  } catch (e: any) {
    const minUsd = minSizeUnits * input.oraclePx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  const sizeUnitsParsed = parseFloat(sizeUnits);
  
  // Validate formatted size
  if (!sizeUnits || sizeUnits === '0' || !Number.isFinite(sizeUnitsParsed) || sizeUnitsParsed <= 0) {
    const minUsd = minSizeUnits * input.oraclePx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }

  const exchange = createAgentExchangeClient(input.agentPrivateKey, input.vaultAddress);

  // Check margin support to determine if cross is allowed
  // Use passed marginSupport if available to avoid redundant API call
  const marginSupport = input.marginSupport !== undefined ? input.marginSupport : await getPerpMarginSupport(input.symbol);
  const supportsCross = marginSupport?.supportsCross ?? !onlyIsolated;
  const isCross = input.isCross !== undefined ? input.isCross : supportsCross;
  const leverage = input.leverage ?? undefined;
  if (leverage && Number.isFinite(maxLeverage) && leverage > (maxLeverage as number)) {
    throw new Error(`Leverage too high for this market (max ${maxLeverage}x)`);
  }
  
  // ── Latency-critical: fan out updateLeverage and getReferencePx in parallel.
  //
  // Sequential timeline (old behavior):
  //   updateLeverage POST (~150-300ms warm) → getReferencePx POST (~150-300ms) → order POST
  //
  // Parallel timeline (new):
  //   ┌─ updateLeverage POST ─┐
  //   └─ getReferencePx POST ─┘ → order POST
  //
  // Both calls are safely independent:
  //   - updateLeverage mutates the user's per-asset leverage state on HL.
  //   - getReferencePx is a read-only POST to /info; it doesn't touch the
  //     exchange endpoint or consume nonces.
  // Neither's payload depends on the other's response.
  //
  // Critically, the leverage update is still awaited before exchange.order()
  // is called, so HL still sees the leverage change committed before the
  // order is matched. If updateLeverage fails (invalid leverage, network
  // error), Promise.all rejects and we never sign or submit the order —
  // identical safety to the old sequential flow.

  const isBuy = input.side === 'long';
  const reduceOnly = !!input.reduceOnly;
  const isHip3Asset = input.symbol.includes(':');
  // HIP-3 assets (stocks, commodities, forex) often have wider spreads and less liquidity.
  // Keep real-money market orders conservative; if the book is wider than 1%,
  // fail and let the user place an explicit limit.
  const defaultSlippageBps = isHip3Asset ? 100 : 50;
  const maxSlippageBps = isHip3Asset ? 100 : 300;
  const slippageBps = Math.min(input.slippageBps ?? defaultSlippageBps, maxSlippageBps);
  const slippage = slippageBps / 10000;

  const buildBuilder = { b: getBuilderAddress(), f: getBuilderFeeTenthsBps() };

  const isStopOrder = input.orderType === 'stop_market' || input.orderType === 'stop_limit';
  const isTakeOrder = input.orderType === 'take_market' || input.orderType === 'take_limit';
  const isTriggerOrder = isStopOrder || isTakeOrder;
  const isLimitStyleTrigger =
    input.orderType === 'stop_limit' || input.orderType === 'take_limit';
  if (isTriggerOrder) {
    if (!Number.isFinite(input.triggerPx) || (input.triggerPx as number) <= 0) {
      throw new Error('Missing trigger price');
    }
    if (isLimitStyleTrigger && (!input.limitPx || input.limitPx <= 0)) {
      throw new Error('Missing limit price');
    }
  }

  // For market orders, fetch fresh reference price to avoid stale price issues
  // FrontendMarket TIF requires the price to be within ~5% of Hyperliquid's current reference price
  // Using stale oraclePx (from page load) can cause "order cd not immediately match" errors
  const isMarketOrder = input.orderType === 'market';
  const needsFreshPrice = isTriggerOrder || isMarketOrder;

  const getReferencePx = async (): Promise<number> => {
    // For limit orders on crypto, use provided price
    if (!needsFreshPrice) return input.oraclePx;

    // If caller provided a recent reference price, use it
    if (Number.isFinite(input.referencePx) && (input.referencePx as number) > 0) {
      return input.referencePx as number;
    }

    // Fetch fresh price from Hyperliquid
    try {
      const dexName = isHip3Asset ? input.symbol.split(':')[0] : null;
      const payload: any = { type: 'metaAndAssetCtxs' };
      if (dexName) payload.dex = dexName;
      const response = await hlInfoFetch( {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length >= 2) {
          const meta = data[0];
          const assetCtxs = data[1];
          const universe = meta?.universe ?? [];
          const assetIndex = universe.findIndex((u: any) => u?.name === input.symbol);
          if (assetIndex >= 0) {
            // Perp metaAndAssetCtxs returns ctxs that are array-indexed against
            // `universe` and do NOT carry a `coin` field (unlike spot). Use the
            // index — finding by coin would always miss and return null here.
            const ctx = assetCtxs[assetIndex] ?? null;
            const ref = parseFloat(ctx?.midPx ?? ctx?.markPx ?? ctx?.oraclePx ?? ctx?.premium ?? '0');
            if (Number.isFinite(ref) && ref > 0) return ref;
          }
        }
      }
    } catch {
      // fall back to oraclePx below
    }
    return input.oraclePx;
  };

  // Ensure leverage matches UI. Hyperliquid checks leverage at open, and it is set per-asset.
  // Only use cross margin if the asset supports it.
  // Skip updateLeverage if we recently set the same leverage for this asset or if caller says to skip.
  const leveragePromise: Promise<void> = (async () => {
    if (input.reduceOnly || !input.leverage || input.skipLeverageUpdate) return;
    const leverageVal = Math.max(1, Math.floor(input.leverage));
    const isCrossVal = !!(isCross && supportsCross);
    // Include vault so Main vs Dedicated leverage state never share a cache entry.
    const cacheKey = `${input.vaultAddress ?? ''}:${input.symbol}:${assetId}`;
    const leverageCache = mainnetBucket.lastLeverageCache;
    const cached = leverageCache.get(cacheKey);
    const now = Date.now();
    const needsUpdate = !cached ||
      cached.leverage !== leverageVal ||
      cached.isCross !== isCrossVal ||
      (now - cached.timestamp) > LEVERAGE_CACHE_TTL_MS;
    if (!needsUpdate) return;

    if (__DEV__) {
      console.log('[HLOrderLeverageUpdate]', {
        symbol: input.symbol,
        assetId,
        requestedIsCross: input.isCross,
        supportsCross,
        isCrossVal,
        leverage: leverageVal,
        marginSupport,
      });
    }
    await exchange.updateLeverage({
      asset: assetId,
      isCross: isCrossVal,
      leverage: leverageVal,
    });
    leverageCache.set(cacheKey, { leverage: leverageVal, isCross: isCrossVal, timestamp: now });
  })();

  // Wait for both: the leverage commit + the fresh price. If leverage fails
  // we never proceed to sign/submit the order (Promise.all rejects on the
  // first rejection), which preserves the old "leverage applied before
  // order" guarantee. getReferencePx swallows its own errors and falls back
  // to oraclePx, so it can't fail this gate.
  const [, referencePx] = await Promise.all([leveragePromise, getReferencePx()]);
  
  // Calculate market price using fresh reference price with slippage
  const marketPx = isBuy ? referencePx * (1 + slippage) : referencePx * (1 - slippage);
  
  if (isTriggerOrder && Number.isFinite(referencePx) && referencePx > 0) {
    const triggerPx = input.triggerPx as number;
    // HL's trigger-direction rules (loss-direction vs profit-direction):
    //   Stop Buy  → trigger > mid    Take Buy  → trigger < mid
    //   Stop Sell → trigger < mid    Take Sell → trigger > mid
    // We compare against a fresh reference (mid/mark/oracle) and bail
    // before signing, so HL doesn't reject us server-side with a
    // cryptic error.
    if (isStopOrder) {
      if (input.side === 'long' && triggerPx <= referencePx) {
        throw new Error('Trigger must be above current price for stop buy orders');
      }
      if (input.side === 'short' && triggerPx >= referencePx) {
        throw new Error('Trigger must be below current price for stop sell orders');
      }
    } else if (isTakeOrder) {
      if (input.side === 'long' && triggerPx >= referencePx) {
        throw new Error('Trigger must be below current price for take buy orders');
      }
      if (input.side === 'short' && triggerPx <= referencePx) {
        throw new Error('Trigger must be above current price for take sell orders');
      }
    }
  }

  // Price selection:
  //   limit / stop_limit / take_limit → use the user's explicit limit price.
  //   stop_market / take_market       → HL still needs a resting price; we
  //                                      use the trigger as a sane default
  //                                      (the `isMarket: true` flag in the
  //                                      trigger payload makes HL ignore it
  //                                      and use 10% slippage on fire).
  //   market                          → slippage-adjusted reference.
  const px = isLimitStyleTrigger || input.orderType === 'limit'
    ? input.limitPx
    : isTriggerOrder
      ? input.triggerPx
      : marketPx;

  if (!px || px <= 0) throw new Error('Missing price');

  const p = formatPrice(px, szDecimals, 'perp');
  // For market orders:
  // - Use 'FrontendMarket' TIF for HIP-3 assets (stocks, commodities, forex) - more aggressive crossing
  // - Use 'Ioc' for crypto which has deeper liquidity
  // 'FrontendMarket' is what Hyperliquid's UI uses for market orders and allows up to 5% slippage
  const tif = input.orderType === 'limit' 
    ? 'Gtc' 
    : (isHip3Asset ? 'FrontendMarket' : 'Ioc');

  // HL's `tpsl` label: 'sl' for loss-direction (Stop), 'tp' for profit-
  // direction (Take). Regular limit/market orders never carry a tpsl —
  // they're sent with a plain `limit` payload instead of a `trigger`.
  const resolveTriggerType = () => {
    if (isStopOrder) return 'sl' as const;
    if (isTakeOrder) return 'tp' as const;
    return 'tp' as const; // unreachable for non-trigger orders (defensive)
  };

  const isMarketStyleTrigger =
    input.orderType === 'stop_market' || input.orderType === 'take_market';

  // Dev-only end-to-end latency instrumentation. The single number that
  // matters for "how fast does an order feel" is the wall-clock time from
  // the moment we call exchange.order() to the moment HL acks. That window
  // covers SDK action assembly + EIP-712/EdDSA signing + JSON serialization
  // + HTTPS POST + server processing + response parsing. We report it here
  // so we can decide later whether the bottleneck is signing (fixable by
  // swapping to native crypto) or network (fixable by warmup or location).
  // No effect on production: __DEV__ is statically false in release builds.
  const orderStart = __DEV__ ? Date.now() : 0;
  try {
    const result = await exchange.order({
      orders: [
        {
          a: assetId,
          b: isBuy,
          p,
          s: sizeUnits,
          r: reduceOnly,
          t: isTriggerOrder
            ? {
                trigger: {
                  isMarket: isMarketStyleTrigger,
                  triggerPx: formatPrice(input.triggerPx as number, szDecimals, 'perp'),
                  tpsl: resolveTriggerType(),
                },
              }
            : { limit: { tif } },
        },
      ],
      grouping: 'na',
      builder: buildBuilder,
    });
    if (__DEV__) {
      console.log('[HLOrderLatency]', {
        symbol: input.symbol,
        type: input.orderType,
        side: input.side,
        elapsedMs: Date.now() - orderStart,
      });
    }
    return result;
  } catch (e: any) {
    if (__DEV__) {
      console.log('[HLOrderLatency:err]', {
        symbol: input.symbol,
        type: input.orderType,
        elapsedMs: Date.now() - orderStart,
      });
    }
    const msg = String(e?.message ?? e ?? '');
    if (input.orderType === 'market' && msg.toLowerCase().includes('could not immediately match')) {
      throw new Error(
        `${input.symbol} market order could not fill immediately. The order book is too wide or thin; try again or place a limit order near the best ${isBuy ? 'ask' : 'bid'}.`,
      );
    }
    throw e;
  }
}

export async function placeSpotOrder(input: {
  agentPrivateKey: Hex;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  sizeUsd: number;
  sizeUnits?: number;
  referencePx?: number;
  limitPx?: number;
  slippageBps?: number;
  /** Trade as HL sub-account (device-agent + defaultVaultAddress). */
  vaultAddress?: Hex;
}) {
  const spotSymbol = await resolveSpotSymbol(input.symbol);
  const { assetId, szDecimals, pxDecimals } = await getSpotAssetIdAndMeta(spotSymbol);
  if (!Number.isFinite(input.sizeUsd) || input.sizeUsd <= 0) {
    throw new Error('Invalid size');
  }
  
  // For market orders, fetch fresh reference price from Hyperliquid
  // FrontendMarket TIF requires the price to be close to the current market price
  let refPxRaw = Number.isFinite(input.referencePx ?? NaN) ? (input.referencePx as number) : 0;
  
  if (input.orderType === 'market') {
    try {
      const response = await hlInfoFetch( {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' }),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length >= 2) {
          const assetCtxs = data[1] ?? [];
          // Find ctx by coin name (more reliable than index)
          const ctx = assetCtxs.find((c: any) => 
            String(c?.coin ?? '').toUpperCase() === spotSymbol.toUpperCase()
          );
          if (ctx) {
            const freshPx = parseFloat(ctx.midPx ?? ctx.markPx ?? '0');
            if (Number.isFinite(freshPx) && freshPx > 0) {
              refPxRaw = freshPx;
              console.log('[placeSpotOrder] Fresh price for', spotSymbol, ':', freshPx);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[placeSpotOrder] Failed to fetch fresh price:', e);
    }
  }
  
  const sizingPx =
    input.orderType === 'limit' && Number.isFinite(input.limitPx ?? NaN) ? (input.limitPx as number) : refPxRaw;
  if (!Number.isFinite(sizingPx) || sizingPx <= 0) {
    throw new Error('Invalid reference price');
  }
  const sizeUnitsRaw =
    Number.isFinite(input.sizeUnits ?? NaN) && (input.sizeUnits as number) > 0
      ? (input.sizeUnits as number)
      : input.sizeUsd / sizingPx;
  const minSizeUnits = Math.pow(10, -szDecimals);
  
  if (!Number.isFinite(sizeUnitsRaw) || sizeUnitsRaw < minSizeUnits) {
    const minUsd = minSizeUnits * sizingPx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  let sizeUnits: string;
  try {
    sizeUnits = formatSize(sizeUnitsRaw, szDecimals);
  } catch {
    const minUsd = minSizeUnits * sizingPx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  const sizeUnitsParsed = parseFloat(sizeUnits);

  if (!sizeUnits || sizeUnits === '0' || !Number.isFinite(sizeUnitsParsed) || sizeUnitsParsed <= 0) {
    const minUsd = minSizeUnits * sizingPx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  const exchange = createAgentExchangeClient(input.agentPrivateKey, input.vaultAddress);

  const refPx = refPxRaw;
  // For exact-size spot sells (100%/close-style sells), a low slippage cap can
  // partially fill one lot and leave the rest on thin books like XAUT. The
  // order `s` is already capped to the user's available base balance; use a
  // wider worst-price limit so "sell all" actually has room to cross.
  const isExactSizeSell =
    input.orderType === 'market' &&
    input.side === 'sell' &&
    Number.isFinite(input.sizeUnits ?? NaN) &&
    (input.sizeUnits as number) > 0;
  const requestedSlippageBps = input.slippageBps ?? (input.side === 'sell' ? 300 : 200);
  const minSlippageBps = isExactSizeSell ? 300 : 0;
  const maxSlippageBps = isExactSizeSell ? 450 : 400;
  const slippageBps = Math.min(Math.max(requestedSlippageBps, minSlippageBps), maxSlippageBps);
  const slippage = slippageBps / 10000;
  const marketPx = input.side === 'buy' ? refPx * (1 + slippage) : refPx * (1 - slippage);
  const px = input.orderType === 'limit' ? input.limitPx : marketPx;
  if (!px || px <= 0) throw new Error('Missing price');
  const priceDecimals = Number.isFinite(pxDecimals ?? NaN) ? (pxDecimals as number) : szDecimals;
  const p = formatPrice(px, priceDecimals, 'spot');

  const effectiveNotional = sizeUnitsParsed * px;

  if (!Number.isFinite(effectiveNotional) || effectiveNotional + 1e-9 < 10) {
    throw new Error('Order must have minimum value of $10.');
  }
  // Use FrontendMarket TIF for market orders - better execution than Ioc
  const tif = input.orderType === 'limit' ? 'Gtc' : 'FrontendMarket';

  const orderPayload = {
    spotSymbol,
    assetId,
    side: input.side,
    orderType: input.orderType,
    inputSizeUsd: input.sizeUsd,
    inputSizeUnits: input.sizeUnits,
    sizingPx,
    refPx,
    px,
    formattedPx: p,
    sizeUnitsRaw,
    formattedSizeUnits: sizeUnits,
    effectiveNotional,
    szDecimals,
    pxDecimals,
    requestedSlippageBps,
    effectiveSlippageBps: slippageBps,
    tif,
  };
  if (__DEV__) {
    console.log('[placeSpotOrder] submitting', orderPayload);
  }

  const result = await exchange.order({
    orders: [
      {
        a: assetId,
        b: input.side === 'buy',
        p,
        s: sizeUnits,
        r: false,
        t: { limit: { tif } },
      },
    ],
    grouping: 'na',
    builder: { b: getBuilderAddress(), f: getSpotBuilderFeeTenthsBps() },
  });
  if (__DEV__) {
    console.log('[placeSpotOrder] result', { spotSymbol, result });
  }
  return result;
}

export async function cancelOpenOrder(args: {
  agentPrivateKey: Hex;
  symbol: string;
  oid: number;
  vaultAddress?: Hex;
}) {
  const isSpot = args.symbol.startsWith('@') || args.symbol.toUpperCase().includes('/USDC');
  const { assetId } = isSpot
    ? await getSpotAssetIdAndMeta(await resolveSpotSymbol(args.symbol))
    : await getAssetIdAndMeta(args.symbol);

  const exchange = createAgentExchangeClient(args.agentPrivateKey, args.vaultAddress);

  return await exchange.cancel({ cancels: [{ a: assetId, o: args.oid }] });
}

export async function marketCloseSpotPosition(args: {
  agentPrivateKey: Hex;
  symbol: string;
  sizeUnits: string;
  referencePx?: number;
  slippageBps?: number;
  vaultAddress?: Hex;
}) {
  const spotSymbol = await resolveSpotSymbol(args.symbol);
  const { assetId, szDecimals, pxDecimals } = await getSpotAssetIdAndMeta(spotSymbol);
  const sizeUnitsRaw = Math.abs(parseFloat(args.sizeUnits));
  if (!Number.isFinite(sizeUnitsRaw) || sizeUnitsRaw <= 0) throw new Error('No position');

  // HL spot enforces a minimum lot of 10^-szDecimals base units. Anything
  // below that cannot be sold (formatSize would throw "Size is too small").
  // Truncate explicitly so we never round up past the user's actual balance,
  // and surface a friendly message when the residue is below the lot floor —
  // that's the "$0.30 dust" case where there's nothing to do but live with it.
  const minLot = Math.pow(10, -szDecimals);
  const truncatedSize = Math.floor(sizeUnitsRaw / minLot) * minLot;
  if (!Number.isFinite(truncatedSize) || truncatedSize < minLot) {
    throw new Error(
      `Remaining ${args.symbol.toUpperCase()} is below the minimum spot lot (${minLot}). This residue can't be sold on Hyperliquid.`,
    );
  }
  let s: string;
  try {
    s = formatSize(truncatedSize, szDecimals);
  } catch {
    throw new Error(
      `Remaining ${args.symbol.toUpperCase()} is below the minimum spot lot (${minLot}). This residue can't be sold on Hyperliquid.`,
    );
  }
  const parsedS = parseFloat(s);
  if (!parsedS || !Number.isFinite(parsedS) || parsedS <= 0) {
    throw new Error(
      `Remaining ${args.symbol.toUpperCase()} is below the minimum spot lot (${minLot}). This residue can't be sold on Hyperliquid.`,
    );
  }

  // Fetch fresh reference price from Hyperliquid to avoid stale price issues
  // FrontendMarket TIF requires the price to be close to the current market price
  let refPx = 0;
  try {
    const response = await hlInfoFetch( {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' }),
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length >= 2) {
        const assetCtxs = data[1] ?? [];
        // Find ctx by coin name (more reliable than index)
        const ctx = assetCtxs.find((c: any) => 
          String(c?.coin ?? '').toUpperCase() === spotSymbol.toUpperCase()
        );
        if (ctx) {
          const px = parseFloat(ctx.midPx ?? ctx.markPx ?? '0');
          if (Number.isFinite(px) && px > 0) {
            refPx = px;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[marketCloseSpotPosition] Failed to fetch fresh price:', e);
  }
  
  // Fallback to provided reference price if fresh fetch failed
  if (!Number.isFinite(refPx) || refPx <= 0) {
    refPx = Number.isFinite(args.referencePx ?? NaN) ? (args.referencePx as number) : 0;
  }
  if (!Number.isFinite(refPx) || refPx <= 0) {
    const spotData = await getSpotAssetData(spotSymbol);
    refPx = Number.isFinite(spotData.midPx ?? NaN) ? (spotData.midPx as number) : (spotData.markPx as number);
  }
  if (!Number.isFinite(refPx) || refPx <= 0) throw new Error('Missing price');
  
  console.log('[marketCloseSpotPosition] Using refPx:', refPx, 'for', spotSymbol);

  // Use higher slippage for market close orders to ensure fills
  // Selling: place limit below market to cross the spread aggressively
  const slippageBps = Math.min(args.slippageBps ?? 300, 450); // 3% default, 4.5% max
  const slippage = slippageBps / 10000;
  const marketPx = refPx * (1 - slippage);
  const priceDecimals = Number.isFinite(pxDecimals ?? NaN) ? (pxDecimals as number) : szDecimals;
  const p = formatPrice(marketPx, priceDecimals, 'spot');

  const exchange = createAgentExchangeClient(args.agentPrivateKey, args.vaultAddress);

  // Use FrontendMarket TIF for better execution on market close orders
  // This is what Hyperliquid's own UI uses and allows aggressive crossing
  const res = await exchange.order({
    orders: [
      {
        a: assetId,
        b: false,
        p,
        s,
        r: false,
        t: { limit: { tif: 'FrontendMarket' } },
      },
    ],
    grouping: 'na',
    builder: { b: getBuilderAddress(), f: getSpotBuilderFeeTenthsBps() },
  });
  // Same rationale as `marketClosePosition` — surface per-order
  // rejections so silent failures on close-all don't mask un-closed
  // spot legs (price-band rejection on thin books, etc.).
  const acceptanceError = getPerpOrderAcceptanceError(res);
  if (acceptanceError) throw new Error(acceptanceError);
  return res;
}

export async function marketClosePosition(args: {
  agentPrivateKey: Hex;
  symbol: string;
  // current signed size (szi) from HL (positive=long, negative=short)
  szi: string;
  oraclePx?: number; // Optional fallback, will fetch reference price if not provided
  vaultAddress?: Hex;
}) {
  const { assetId, szDecimals } = await getAssetIdAndMeta(args.symbol);
  const sziNum = parseFloat(args.szi);
  if (!Number.isFinite(sziNum) || sziNum === 0) throw new Error('No position');

  const side: 'long' | 'short' = sziNum > 0 ? 'short' : 'long'; // opposite to close
  const sizeUnitsRaw = Math.abs(sziNum);

  // Fetch the actual reference price for this symbol from Hyperliquid
  // FrontendMarket orders require the price to be very close to the reference price
  let referencePx = args.oraclePx;
  if (!referencePx || referencePx <= 0) {
    try {
      const isHip3 = args.symbol.includes(':');
      const dexName = isHip3 ? args.symbol.split(':')[0] : null;
      
      const payload: any = { type: 'metaAndAssetCtxs' };
      if (dexName) {
        payload.dex = dexName;
      }
      
      const response = await hlInfoFetch( {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length >= 2) {
          const meta = data[0];
          const assetCtxs = data[1];
          const universe = meta?.universe ?? [];
          const assetIndex = universe.findIndex((u: any) => u?.name === args.symbol);
          
          if (assetIndex >= 0) {
            // Perp metaAndAssetCtxs ctxs are array-indexed against `universe`
            // and don't carry a `coin` field — finding by coin returns null,
            // which is exactly the regression that produced
            // "Invalid reference price for HYPE" on perp close.
            const ctx = assetCtxs[assetIndex] ?? null;
            referencePx = parseFloat(ctx?.markPx ?? ctx?.midPx ?? ctx?.oraclePx ?? ctx?.premium ?? '0');
          }
        }
      }
    } catch (e) {
      // Fallback: if fetching fails, use provided oraclePx or throw
      if (!referencePx || referencePx <= 0) {
        throw new Error(`Failed to get reference price for ${args.symbol}. Please try again.`);
      }
    }
  }

  if (!referencePx || referencePx <= 0) {
    throw new Error(`Invalid reference price for ${args.symbol}`);
  }

  const exchange = createAgentExchangeClient(args.agentPrivateKey, args.vaultAddress);

  const isBuy = side === 'long';
  // Use 4.5% slippage for market close - very aggressive to ensure fills in thin markets
  // Hyperliquid allows up to 5% away from reference price
  const slippage = 450 / 10000; // 4.5% slippage (near max allowed)
  const pxRaw = isBuy ? referencePx * (1 + slippage) : referencePx * (1 - slippage);

  const p = formatPrice(pxRaw, szDecimals, 'perp');
  const minSizeUnits = Math.pow(10, -szDecimals);
  if (!Number.isFinite(sizeUnitsRaw) || sizeUnitsRaw < minSizeUnits) {
    const minUsd = minSizeUnits * referencePx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  let s: string;
  try {
    s = formatSize(sizeUnitsRaw, szDecimals);
  } catch {
    const minUsd = minSizeUnits * referencePx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  if (parseFloat(s) <= 0) {
    const minUsd = minSizeUnits * referencePx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }

  // Use FrontendMarket TIF - this is what Hyperliquid's own UI uses for market orders
  // With 4.5% slippage, this should cross the spread aggressively and fill immediately
  // If it fails, it means there's genuinely no liquidity in the market
  const res = await exchange.order({
    orders: [
      {
        a: assetId,
        b: isBuy,
        p,
        s,
        r: true, // reduce-only
        t: { limit: { tif: 'FrontendMarket' } },
      },
    ],
    grouping: 'na',
    builder: { b: getBuilderAddress(), f: getBuilderFeeTenthsBps() },
  });
  // Surface per-order rejections that HL reports inside `response.data.statuses`.
  // Without this the call resolves successfully even when HL rejected the
  // order (e.g. price out-of-band, "Order has zero size", "Reduce only
  // order rejected because position would be increased"), which is how
  // HIP-3 closes silently fail in the close-all loop on thin books while
  // main-perp closes go through. All callers have try/catch — single-row
  // close surfaces the message in its toast, close-all logs it and (with
  // its retry pass) gets a second chance on a fresh price.
  const acceptanceError = getPerpOrderAcceptanceError(res);
  if (acceptanceError) throw new Error(acceptanceError);
  return res;
}

export async function placeReduceOnlyTpslTrigger(args: {
  agentPrivateKey: Hex;
  symbol: string;
  // entry side for the position this closes
  entrySide: 'long' | 'short';
  // Notional size (USD) — kept in the API for backward compat / logging,
  // but NOT sent to HL. We send `s = '0'` so HL auto-binds the trigger
  // to the live position size. See doc-block above.
  sizeUsd: number;
  // Current oracle/mark price (still required for `p` / slippage anchor)
  oraclePx: number;
  // Trigger price
  triggerPx: number;
  tpsl: 'tp' | 'sl';
  /** Trade as this HL sub-account (master/agent signs with vaultAddress). */
  vaultAddress?: Hex;
}) {
  const { assetId, szDecimals } = await getAssetIdAndMeta(args.symbol);
  if (!Number.isFinite(args.sizeUsd) || args.sizeUsd <= 0) throw new Error('Invalid size');
  if (!Number.isFinite(args.oraclePx) || args.oraclePx <= 0) throw new Error('Invalid oracle price');
  if (!Number.isFinite(args.triggerPx) || args.triggerPx <= 0) throw new Error('Invalid trigger price');

  // Reduce-only close side is the opposite of the entry.
  // Close long -> sell (isBuy=false). Close short -> buy (isBuy=true).
  const isBuy = args.entrySide === 'short';

  // HL sentinel for position-linked TP/SL: s = '0' tells HL "close the
  // live position size at trigger time" (auto-resizes with the position).
  // Any non-zero s here causes HL to demote this to a fixed-size trigger
  // (isPositionTpsl: false). See doc-block above.
  const s = '0';

  const triggerPx = formatPrice(args.triggerPx, szDecimals, 'perp');
  // For market triggers, `p` acts as a slippage anchor. We use the
  // trigger price; HL's market trigger applies its own ±10% slippage
  // tolerance at fire time.
  const p = triggerPx;

  const exchange = createAgentExchangeClient(args.agentPrivateKey, args.vaultAddress);

  return await exchange.order({
    orders: [
      {
        a: assetId,
        b: isBuy,
        p,
        s,
        r: true, // reduce-only — required by HL for positionTpsl grouping
        t: { trigger: { isMarket: true, triggerPx, tpsl: args.tpsl } },
      },
    ],
    // Position-linked TP/SL. With s='0' + r=true + isMarket=true, HL
    // returns isPositionTpsl=true and auto-binds the trigger size to
    // the live position at fire time. See doc-block above.
    grouping: 'positionTpsl',
    builder: { b: getBuilderAddress(), f: getBuilderFeeTenthsBps() },
  });
}

export async function modifyOpenOrder(args: {
  agentPrivateKey: Hex;
  symbol: string;
  oid: number;
  side: 'buy' | 'sell' | 'long' | 'short' | 'B' | 'S';
  sizeUnits: string | number;
  limitPx: number;
  reduceOnly?: boolean;
  cloid?: string | null;
  isTrigger?: boolean;
  tpsl?: 'tp' | 'sl';
  vaultAddress?: Hex;
}) {
  // ── Position TP/SL (triggers) ───────────────────────────────────────────
  // AI agents (and our open path) place these as positionTpsl with s='0'.
  // Editing via exchange.modify with the displayed full position size demotes
  // them to fixed-size reduce-only triggers — and in practice has flattened
  // the live position on save (observed: SPCX short closed at entry after an
  // SL trigger edit). Safe path = cancel oid → re-place with s='0' +
  // grouping positionTpsl (same as placeReduceOnlyTpslTrigger / agent adapter).
  // Never fall through to exchange.modify for triggers.
  if (args.isTrigger) {
    const tpsl = args.tpsl === 'tp' || args.tpsl === 'sl' ? args.tpsl : null;
    if (!tpsl) {
      throw new Error('Cannot edit this trigger (missing TP/SL type). Cancel it and place a new TP/SL instead.');
    }
    if (!Number.isFinite(args.limitPx) || args.limitPx <= 0) {
      throw new Error('Invalid trigger price');
    }
    const sideRaw = String(args.side).toLowerCase();
    const isBuy = sideRaw === 'b' || sideRaw === 'buy' || sideRaw === 'long';
    // Buy trigger closes a short; sell trigger closes a long.
    const entrySide: 'long' | 'short' = isBuy ? 'short' : 'long';

    await cancelOpenOrder({
      agentPrivateKey: args.agentPrivateKey,
      symbol: args.symbol,
      oid: args.oid,
      vaultAddress: args.vaultAddress,
    });

    // sizeUsd is unused by placeReduceOnlyTpslTrigger (s='0') but validated.
    const sizeUsd = Math.max(
      10,
      Math.abs(parseFloat(String(args.sizeUnits)) || 0) * args.limitPx,
    );
    return placeReduceOnlyTpslTrigger({
      agentPrivateKey: args.agentPrivateKey,
      symbol: args.symbol,
      entrySide,
      sizeUsd,
      oraclePx: args.limitPx,
      triggerPx: args.limitPx,
      tpsl,
      vaultAddress: args.vaultAddress,
    });
  }

  const isSpot = args.symbol.startsWith('@') || args.symbol.toUpperCase().includes('/USDC');
  let assetId: number;
  let szDecimals: number;
  let priceDecimals: number | undefined;
  if (isSpot) {
    const spotMeta: { assetId: number; szDecimals: number; pxDecimals?: number } =
      await getSpotAssetIdAndMeta(await resolveSpotSymbol(args.symbol));
    assetId = spotMeta.assetId;
    szDecimals = spotMeta.szDecimals;
    priceDecimals = spotMeta.pxDecimals;
  } else {
    const perpMeta = await getAssetIdAndMeta(args.symbol);
    assetId = perpMeta.assetId;
    szDecimals = perpMeta.szDecimals;
    priceDecimals = undefined;
  }

  const sizeUnitsRaw = Math.abs(parseFloat(String(args.sizeUnits)));
  if (!Number.isFinite(sizeUnitsRaw) || sizeUnitsRaw <= 0) {
    throw new Error('Invalid size');
  }
  const minSizeUnits = Math.pow(10, -szDecimals);
  if (sizeUnitsRaw < minSizeUnits) {
    const minUsd = minSizeUnits * args.limitPx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }

  if (!Number.isFinite(args.limitPx) || args.limitPx <= 0) {
    throw new Error('Invalid limit price');
  }
  if (sizeUnitsRaw * args.limitPx + 1e-9 < 10) {
    throw new Error('Order must have minimum value of $10.');
  }

  let s: string;
  try {
    s = formatSize(sizeUnitsRaw, szDecimals);
  } catch {
    const minUsd = minSizeUnits * args.limitPx;
    throw new Error(`Size too small for this market (min ≈ $${minUsd.toFixed(2)})`);
  }
  const finalPriceDecimals = isSpot && Number.isFinite(priceDecimals ?? NaN) ? (priceDecimals as number) : szDecimals;
  const p = formatPrice(args.limitPx, finalPriceDecimals, isSpot ? 'spot' : 'perp');
  const sideRaw = String(args.side).toLowerCase();
  const isBuy = sideRaw === 'b' || sideRaw === 'buy' || sideRaw === 'long';

  const exchange = createAgentExchangeClient(args.agentPrivateKey, args.vaultAddress);

  // HL network upgrade: modifies are rest-only. Be explicit instead of
  // relying on GTC being coerced into ALO by the exchange.
  const orderType: any = { limit: { tif: 'Alo' } };

  return await exchange.modify({
    oid: args.oid,
    order: {
      a: assetId,
      b: isBuy,
      p,
      s,
      r: !!args.reduceOnly,
      t: orderType,
      c: args.cloid ?? undefined,
    },
  });
}

export async function getUserFills(userAddress: Hex, opts?: { aggregateByTime?: boolean }) {
  const info = getHlInfoClient();
  return info.userFills({
    user: userAddress,
    aggregateByTime: opts?.aggregateByTime ?? true,
  });
}

export async function getUserFillsReplay(userAddress: Hex) {
  return getUserFills(userAddress, { aggregateByTime: false });
}

export async function getUserFunding(
  userAddress: Hex,
  opts?: {
    startTimeMs?: number;
    endTimeMs?: number;
  },
) {
  const info =
    getHlInfoClient();

  const fetchUserFunding =
    async (dex?: string) => {
      const endTimeMs =
        opts?.endTimeMs ??
        Date.now();

      const startTimeMs =
        opts?.startTimeMs ??
        endTimeMs -
          30 *
            24 *
            60 *
            60 *
            1000;

      if (
        typeof (info as any)
          .userFunding ===
        'function'
      ) {
        return (
          info as any
        ).userFunding(
          dex
            ? {
                user:
                  userAddress,
                startTime:
                  startTimeMs,
                endTime:
                  endTimeMs,
                dex,
              }
            : {
                user:
                  userAddress,
                startTime:
                  startTimeMs,
                endTime:
                  endTimeMs,
              },
        );
      }

      const payload: any = {
        type: 'userFunding',
        user: userAddress,
        startTime: startTimeMs,
        endTime: endTimeMs,
      };

      if (dex) {
        payload.dex = dex;
      }

      const response =
        await hlInfoFetch({
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(
              payload,
            ),
        });

      if (!response.ok) {
        throw new Error(
          `Hyperliquid API error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json();
    };

  const [
    mainFunding,
    hip3Funding,
  ] = await Promise.all([
    fetchUserFunding(),

    Promise.all(
      HIP3_DEXES.map(
        async (dex) => {
          try {
            return await fetchUserFunding(
              dex,
            );
          } catch {
            return [];
          }
        },
      ),
    ),
  ]);

  const normalize =
    (data: any) => {
      if (Array.isArray(data)) {
        return data;
      }

      if (
        Array.isArray(
          data?.funding,
        )
      ) {
        return data.funding;
      }

      if (
        Array.isArray(
          data?.data,
        )
      ) {
        return data.data;
      }

      return [];
    };

  return [
    ...normalize(mainFunding),
    ...hip3Funding.flatMap(
      normalize,
    ),
  ];
}

export async function getOpenOrders(
  userAddress: Hex,
) {
  const fetchFrontendOrders =
    async (dex?: string) => {
      const payload: any = {
        type:
          'frontendOpenOrders',
        user: userAddress,
      };

      if (dex) {
        payload.dex = dex;
      }

      const response =
        await hlInfoFetch({
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(
              payload,
            ),
        });

      if (!response.ok) {
        throw new Error(
          `Hyperliquid API error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json();
    };

  const [
    mainOrders,
    hip3Orders,
  ] = await Promise.all([
    fetchFrontendOrders(),

    Promise.all(
      HIP3_DEXES.map(
        async (dex) => {
          try {
            return await fetchFrontendOrders(
              dex,
            );
          } catch {
            return [];
          }
        },
      ),
    ),
  ]);

  const normalizeOrder =
    (o: any) => {
      if (
        !o ||
        typeof o !== 'object'
      ) {
        return o;
      }

      const inner =
        (o as any).order ??
        (o as any).o;

      if (
        !inner ||
        typeof inner !==
          'object'
      ) {
        return o;
      }

      const merged: any = {
        ...inner,
        ...o,
      };

      if (
        inner.coin != null &&
        merged.coin == null
      ) {
        merged.coin =
          inner.coin;
      }

      if (
        inner.side != null &&
        merged.side == null
      ) {
        merged.side =
          inner.side;
      }

      if (
        inner.limitPx != null &&
        merged.limitPx == null
      ) {
        merged.limitPx =
          inner.limitPx;
      }

      if (
        inner.sz != null &&
        merged.sz == null
      ) {
        merged.sz =
          inner.sz;
      }

      if (
        inner.t != null &&
        merged.t == null
      ) {
        merged.t =
          inner.t;
      }

      if (
        inner.orderType != null &&
        merged.orderType == null
      ) {
        merged.orderType =
          inner.orderType;
      }

      if (
        inner.leverage != null &&
        merged.leverage == null
      ) {
        merged.leverage =
          inner.leverage;
      }

      if (
        inner.isCross != null &&
        merged.isCross == null
      ) {
        merged.isCross =
          inner.isCross;
      }

      if (
        inner.marginType != null &&
        merged.marginType == null
      ) {
        merged.marginType =
          inner.marginType;
      }

      if (
        inner.marginUsed != null &&
        merged.marginUsed == null
      ) {
        merged.marginUsed =
          inner.marginUsed;
      }

      if (
        inner.marginUsedUsd != null &&
        merged.marginUsedUsd == null
      ) {
        merged.marginUsedUsd =
          inner.marginUsedUsd;
      }

      return merged;
    };

  const tagOrder =
    (
      o: any,
      dex: string,
    ) =>
      o &&
      typeof o === 'object' &&
      o._dex == null
        ? {
            ...normalizeOrder(o),
            _dex: dex,
          }
        : normalizeOrder(o);

  return [
    ...((mainOrders ?? []) as any[]).map(
      (o) => tagOrder(o, ''),
    ),

    ...HIP3_DEXES.flatMap(
      (dex, i) =>
        ((hip3Orders[i] ?? []) as any[]).map(
          (o) =>
            tagOrder(o, dex),
        ),
    ),
  ];
}

export async function getSpotClearinghouseState(userAddress: Hex): Promise<any> {
  const response = await hlInfoFetch({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'spotClearinghouseState', user: userAddress }),
  });
  if (!response.ok) {
    throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getUserDepositWithdrawalHistory(
  userAddress: Hex,
  startTime?: number,
  endTime?: number
) {
  const info = getHlInfoClient();
  
  // Try SDK method first, fallback to direct API call if not available
  if (typeof (info as any).userNonFundingLedgerUpdates === 'function') {
    return (info as any).userNonFundingLedgerUpdates({
      user: userAddress,
      startTime,
      endTime,
    });
  }
  
  // Fallback: direct API call
  const payload: any = {
    type: 'userNonFundingLedgerUpdates',
    user: userAddress,
  };
  if (startTime !== undefined) payload.startTime = startTime;
  if (endTime !== undefined) payload.endTime = endTime;
  
      const response = await hlInfoFetch( {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

function parseLedgerUsd(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Internal capital moves that HL does **not** net out of `portfolio.pnlHistory`. */
const INTERNAL_CAPITAL_LEDGER_TYPES = new Set([
  'send', // sendAsset (dedicated fund/reclaim, cross-user)
  'internaltransfer',
  'subaccounttransfer',
  'spottransfer',
]);

/**
 * Net USDC inflow to `address` from internal transfers (sendAsset, usdSend,
 * subAccountTransfer, spotTransfer). Positive = capital arrived.
 *
 * HL's portfolio graphs define PnL as `accountValue + deposits - withdrawals`
 * (https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-graphs).
 * Dedicated ↔ Main `sendAsset` is neither a deposit nor a withdrawal, so it
 * leaks into `pnlHistory` as fake trading PnL. Subtract this from the
 * displayed period figure.
 *
 * Amounts are unsigned in the ledger (`user` = sender, `destination` =
 * recipient). Same-address dex shuffles are skipped. Pass `counterparties`
 * (the other book: Dedicated subs on Main, master on a sub) so we only
 * strip those moves — and so a Main series is never adjusted with a sub
 * ledger (that double-applies a 1k fund as −2k).
 */
export function netInternalCapitalInflowUsd(
  ledger: unknown,
  address: string,
  startMs = 0,
  endMs = Number.POSITIVE_INFINITY,
  counterparties?: Iterable<string>,
): number {
  const self = String(address ?? '').toLowerCase();
  if (!self.startsWith('0x')) return 0;
  const peers = new Set(
    [...(counterparties ?? [])].map((a) => String(a ?? '').toLowerCase()).filter((a) => a.startsWith('0x') && a !== self),
  );
  const rows = Array.isArray(ledger) ? ledger : [];
  const seen = new Set<string>();
  let net = 0;
  for (const row of rows) {
    const time = Number(row?.time ?? 0);
    if (Number.isFinite(time) && time > 0 && (time < startMs || time > endMs)) continue;
    const delta = row?.delta ?? row;
    const type = String(delta?.type ?? '').toLowerCase();
    if (!INTERNAL_CAPITAL_LEDGER_TYPES.has(type)) continue;

    const dest = String(delta?.destination ?? '').toLowerCase();
    const user = String(delta?.user ?? '').toLowerCase();
    if (!dest && !user) continue;
    if (dest === self && user === self) continue;

    if (peers.size > 0) {
      const otherIsPeer = (dest.startsWith('0x') && peers.has(dest)) || (user.startsWith('0x') && peers.has(user));
      if (!otherIsPeer) continue;
    }

    let usd = parseLedgerUsd(delta?.usdcValue ?? delta?.usdc);
    if (!Number.isFinite(usd)) {
      const token = String(delta?.token ?? '').toUpperCase();
      if (token === 'USDC' || token.startsWith('USDC:')) {
        usd = parseLedgerUsd(delta?.amount);
      }
    }
    if (!Number.isFinite(usd) || usd === 0) continue;
    const mag = Math.abs(usd);

    const feeRaw = parseLedgerUsd(delta?.fee);
    const feeToken = String(delta?.feeToken ?? 'USDC').toUpperCase();
    const feeUsd =
      Number.isFinite(feeRaw) && feeRaw > 0 && (feeToken === 'USDC' || feeToken.startsWith('USDC:'))
        ? feeRaw
        : 0;

    const hash = String(row?.hash ?? '').toLowerCase();
    const dedupe = hash.startsWith('0x') ? hash : `${time}|${user}|${dest}|${mag}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    // Direction from addresses only — never trust the unsigned amount's sign.
    if (peers.size > 0) {
      if (peers.has(dest) && dest !== self) {
        net -= mag + feeUsd;
        continue;
      }
      if (peers.has(user) && user !== self) {
        net += mag;
        continue;
      }
    }
    if (dest === self) net += mag;
    else if (user === self) net -= mag + feeUsd;
  }
  return net;
}

export async function getPerpMarginTiers(symbol: string): Promise<MarginTier[] | null> {
  // HIP-3 assets have format "dex:SYMBOL" (e.g., "xyz:TSLA")
  const isHip3 = symbol.includes(':');
  const dexName = isHip3 ? symbol.split(':')[0] : null;

  let meta: any;
  if (dexName) {
    // Fetch HIP-3 dex meta (different from main exchange)
    meta = await getHip3MetaCached(dexName);
  } else {
    meta = await getMetaCached();
  }

  const uni = (meta?.universe ?? []) as Array<any>;
  const entry = uni.find((u) => u?.name === symbol);
  if (!entry) return null;

  const marginTableId = Number(entry.marginTableId);
  if (!Number.isFinite(marginTableId)) return null;

  // Per HL docs: for IDs < 50, there is a single tier with max leverage equal to the ID.
  if (marginTableId > 0 && marginTableId < 50) {
    return [{ lowerBoundUsd: 0, maxLeverage: marginTableId }];
  }

  const table = await getHlInfoClient().marginTable({ id: marginTableId });
  const tiers = (table?.marginTiers ?? []) as Array<any>;
  return tiers
    .map((t) => ({
      lowerBoundUsd: Number(t.lowerBound),
      maxLeverage: Number(t.maxLeverage),
    }))
    .filter((t) => Number.isFinite(t.lowerBoundUsd) && Number.isFinite(t.maxLeverage));
}

export async function getUserFees(userAddress: Hex) {
  const info = getHlInfoClient();
  return await info.userFees({ user: userAddress });
}

export type Hip3FeeParams = {
  deployerFeeScale: number;
  growthMode: boolean;
};

/**
 * Live HIP-3 fee params from HL `meta` universe (source of truth after setDeployerFees).
 * Returns null for non-HIP-3 symbols or if the asset is missing from meta.
 * Refreshes meta so deployer scale / growth mode changes show up without a long cache wait.
 */
export async function getHip3FeeParams(symbol: string): Promise<Hip3FeeParams | null> {
  const coin = String(symbol || '');
  if (!coin.includes(':')) return null;
  const dexName = coin.split(':')[0];
  if (!dexName) return null;
  const meta = await getHip3MetaCached(dexName, { forceRefresh: true });
  const uni = (meta?.universe ?? []) as Array<any>;
  const entry = uni.find((u) => u?.name === coin);
  if (!entry) return null;
  return {
    deployerFeeScale: parseDeployerFeeScale(entry.deployerFeeScale, 1),
    growthMode: isGrowthModeEnabled(entry.growthMode),
  };
}

export async function getActiveAssetData(userAddress: Hex, coin: string) {
  const info = getHlInfoClient();
  const isHip3 = coin.includes(':');
  const dexName = isHip3 ? coin.split(':')[0] : null;
  if (typeof (info as any).activeAssetData === 'function') {
    return (info as any).activeAssetData(dexName ? { user: userAddress, coin, dex: dexName } : { user: userAddress, coin });
  }
  const payload: any = { type: 'activeAssetData', user: userAddress, coin };
  if (dexName) payload.dex = dexName;
      const response = await hlInfoFetch( {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function canUseCrossOnAsset(
  isHip3: boolean,
  accountAbstractionMode: HyperliquidAbstractionMode | null | undefined,
): boolean {
  if (!isHip3) return true;
  return isPooledAccountMode(accountAbstractionMode);
}

export function parseFeeRateDecimal(rate: string | number | null | undefined): number {
  if (rate === null || rate === undefined) return 0;
  const n = typeof rate === 'number' ? rate : parseFloat(rate);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Whether orderable USDC is safe to show for sizing / Available labels.
 *
 * Unified users expect the full transferable pool. While abstraction mode or
 * spot collateral is still hydrating, HIP-3 sizing falls through to
 * `targetDexBalance` alone (often a few dollars left on `xyz`) or $0 — worse
 * than waiting. Callers should show "—" (and avoid Max sizing) until this
 * returns true; sticky last-known values are fine after the first hydrate.
 */
export function isOrderAvailableHydrated(args: {
  accountAbstractionMode: HyperliquidAbstractionMode | null | undefined;
  isHip3Order: boolean;
  /** Spot clearinghouse (or REST trading state that includes spot USDC) has loaded. */
  spotBalancesHydrated: boolean;
}): boolean {
  if (args.accountAbstractionMode == null) return false;
  if (isPooledAccountMode(args.accountAbstractionMode) && args.isHip3Order) {
    return args.spotBalancesHydrated;
  }
  return true;
}

export function needsUnifiedAccountMigration(
  mode: HyperliquidAbstractionMode | null | undefined,
): boolean {
  return !isPooledAccountMode(mode);
}

export async function getUserDexAbstractionEnabled(userAddress: Hex): Promise<boolean | null> {
  try {
    const response = await hlInfoFetch( {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userDexAbstraction', user: userAddress }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data === 'boolean') return data;
    if (data && typeof data === 'object') {
      if (typeof data.enabled === 'boolean') return data.enabled;
      if (typeof data.userDexAbstraction === 'boolean') return data.userDexAbstraction;
    }
    return null;
  } catch {
    return null;
  }
}

export async function transferUsdBetweenSpotAndPerp(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  amountUsd: string;
  toPerp: boolean;
}): Promise<void> {
  const amt = parseFloat(args.amountUsd);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Invalid transfer amount');
  }
  const exchange = await createUserExchangeClient(args.userWalletProvider, args.userAddress);
  await (exchange as any).usdClassTransfer({ amount: args.amountUsd, toPerp: args.toPerp });
}

/**
 * Lifetime HL volume (USD) that counts toward fee tiers / sub-account gates.
 *
 * Prefer `referral.cumVlm` over `portfolio.allTime.vlm`: portfolio reports raw
 * traded notional, while HIP-3 markets in growth mode only contribute ~10% to
 * HL "volume contributions" (fees, rate limits, and the ~$100k sub-account
 * create gate). Using portfolio alone falsely unlocks Dedicated for XYZ-heavy
 * wallets that HL still rejects.
 *
 * Falls back to portfolio allTime when referral is unavailable.
 * Throws on total network failure so callers can distinguish "ineligible"
 * from "unknown".
 */
export async function getUserLifetimeVolumeUsd(userAddress: Hex): Promise<number> {
  try {
    // SDK may not expose `referral`; hit info HTTP directly (same as perpDexs).
    const r = await hlInfoFetch( {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'referral', user: userAddress }),
    });
    if (r.ok) {
      const referral = await r.json();
      const cum = Number(referral?.cumVlm);
      if (Number.isFinite(cum) && cum >= 0) return cum;
    }
  } catch {
    // fall through to portfolio
  }
  const info = getHlInfoClient();
  const res = await (info as any).portfolio({ user: userAddress });
  if (!Array.isArray(res)) return 0;
  for (const entry of res) {
    if (Array.isArray(entry) && entry[0] === 'allTime') {
      const vlm = Number(entry[1]?.vlm);
      return Number.isFinite(vlm) ? vlm : 0;
    }
  }
  return 0;
}

/**
 * Spot → perp `sendAsset` budget for unified / portfolioMargin mode.
 *
 * Implements Hyperliquid's documented "transfer margin" rule (see
 * https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margining):
 *
 *   transfer_margin_required = max(
 *     initial_margin_required,
 *     0.10 × total_cross_notional_position_value
 *   )
 *
 *   spot_transferable        = max(0,
 *     spotUSDC
 *       − transfer_margin_required
 *       − isolated_margin_used
 *   )
 *
 * The 10% floor dominates whenever any cross position is opened above 10×
 * leverage (it equals notional × maintenance_margin_rate doubled, roughly).
 * Without it, slider Max would happily size orders that HL then rejects
 * with "Insufficient balance for token transfer" — regardless of how much
 * spot USDC is showing in the wallet.
 *
 * Centralising this here keeps the slider, preflight, and JIT funding all
 * agreeing on what HL will actually accept. No empirical cushion needed —
 * this matches HL's published rule exactly.
 */
export const UNIFIED_TRANSFER_MARGIN_FLOOR_RATE = 0.1;
export function computeUnifiedSpotTransferableUsd(args: {
  spotUsdcBalanceUsd: number;
  totalCrossInitialMarginUsedUsd: number;
  totalCrossPositionValueUsd: number;
  totalIsolatedMarginUsedUsd: number;
  /**
   * Estimated USDC locked by resting spot BUY orders. This reduces spot -> perp
   * dex funding budgets, but raw spot-state `hold` can include perp margin and
   * should not be subtracted here.
   */
  spotUsdcHoldUsd?: number;
  /**
   * Initial margin locked by RESTING limit orders (cross OR isolated).
   * HL's `clearinghouseState` only fills `marginSummary.totalMarginUsed`
   * and `assetPositions[*].marginUsed` from FILLED positions — resting
   * isolated limits don't show up there until they fill, but HL still
   * reserves their init margin out of the spot pool. Without this, the
   * transferable cap (and the HIP-3 slider) treats resting-order locks
   * as free money and we hit "Insufficient balance for token transfer"
   * at submit time.
   */
  restingOrdersInitMarginUsd?: number;
}): number {
  const initialReq = Math.max(0, args.totalCrossInitialMarginUsedUsd ?? 0);
  const tenPctReq = UNIFIED_TRANSFER_MARGIN_FLOOR_RATE * Math.max(0, args.totalCrossPositionValueUsd ?? 0);
  const transferMarginRequired = Math.max(initialReq, tenPctReq);
  const transferable = (args.spotUsdcBalanceUsd ?? 0)
    - transferMarginRequired
    - Math.max(0, args.totalIsolatedMarginUsedUsd ?? 0)
    - Math.max(0, args.spotUsdcHoldUsd ?? 0)
    - Math.max(0, args.restingOrdersInitMarginUsd ?? 0);
  return Math.max(0, transferable);
}

/**
 * Sum of estimated initial-margin USD locked by RESTING open orders. HL
 * locks `notional / leverage` of init margin the moment a limit order
 * rests on the book — it's not just position-time. This estimate uses
 * the order's leverage when present and falls back to the 10% floor
 * (same as the transfer-rule floor, dominant for L≥10) when not.
 *
 * Used to deduct resting-order locks from the unified-mode
 * `pooledMarginAvailableUsd` so the slider/Max for MAIN-DEX orders
 * doesn't let users size into HL's "insufficient margin" rejection
 * path — without this, a user with two BTC limits resting at 40x
 * sees the full spot pool as transferable and only learns it's locked
 * after submitting another order.
 */
/** Oid for merge/dedupe — matches PortfolioTabs `extractOpenOrderOid`. */
function openOrderOid(o: any): number | null {
  const oid = Number(o?.oid ?? o?.order?.oid ?? o?.o?.oid);
  return Number.isFinite(oid) ? oid : null;
}

/**
 * HL allows at most one position-linked TP and one SL per coin. During modify
 * the WS snapshot can briefly carry the old oid while REST still has the
 * previous row (or vice versa), so oid-keyed merge alone flashes two rows.
 * Collapse those transitions by keeping the newest oid per (coin, tpsl).
 */
function positionLinkedTpslDedupeKey(o: any): string | null {
  const order = o?.order ?? o?.o ?? o;
  const coin = String(order?.coin ?? o?.coin ?? '');
  if (!coin) return null;
  const tpsl = order?.tpsl ?? o?.tpsl;
  if (tpsl !== 'tp' && tpsl !== 'sl') return null;
  const orderType = order?.orderType ?? o?.orderType;
  const triggerPx = parseFloat(order?.triggerPx ?? o?.triggerPx ?? '');
  const isTrigger =
    order?.isTrigger === true ||
    o?.isTrigger === true ||
    orderType?.trigger != null ||
    (Number.isFinite(triggerPx) && triggerPx > 0);
  if (!isTrigger) return null;
  return `${coin}:${tpsl}`;
}

function dedupePositionLinkedTpslOrders(orders: any[]): any[] {
  const passthrough: any[] = [];
  const groups = new Map<string, any[]>();
  for (const o of orders) {
    const key = positionLinkedTpslDedupeKey(o);
    if (!key) {
      passthrough.push(o);
      continue;
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(o);
    groups.set(key, bucket);
  }
  const pickNewest = (group: any[]) =>
    group.reduce((best, cur) => {
      const bestOid = openOrderOid(best) ?? 0;
      const curOid = openOrderOid(cur) ?? 0;
      return curOid >= bestOid ? cur : best;
    });
  const deduped = [...passthrough, ...Array.from(groups.values()).map(pickNewest)];
  return deduped.length === orders.length ? orders : deduped;
}

/**
 * Merge REST-polled open orders with the HL user WS feed for display.
 * When WS is connected we previously only layered HIP-3 (`:`) coins from
 * REST, so a new main-dex limit could land in `refetchOpenOrders` but stay
 * invisible until the next WS tick — PortfolioTabs skeleton dropped early
 * and the row popped in 1–2s later. REST seeds the map; WS overwrites per
 * oid with live ticks.
 */
export function mergeRestAndStreamOpenOrders(
  restOrders: any[] | undefined,
  streamOrders: any[] | undefined,
  wsConnected: boolean,
): any[] {
  const rest = restOrders ?? [];
  if (!wsConnected || !Array.isArray(streamOrders)) {
    return sortOpenOrdersStable(dedupePositionLinkedTpslOrders(rest));
  }
  const merged = new Map<string, any>();
  const put = (o: any) => {
    const oid = openOrderOid(o);
    if (oid != null) merged.set(String(oid), o);
  };
  rest.forEach(put);
  streamOrders.forEach(put);
  return sortOpenOrdersStable(dedupePositionLinkedTpslOrders(Array.from(merged.values())));
}

function openOrderSortTime(o: any): number {
  const order = o?.order ?? o?.o ?? o;
  const t = Number(order?.timestamp ?? o?.timestamp ?? order?.time ?? o?.time ?? 0);
  return Number.isFinite(t) ? t : 0;
}

/** Newest-first, oid tiebreak — keeps Orders UI from reshuffling on WS ticks. */
function sortOpenOrdersStable(orders: any[]): any[] {
  return [...orders].sort((a, b) => {
    const tb = openOrderSortTime(b);
    const ta = openOrderSortTime(a);
    if (tb !== ta) return tb - ta;
    return (openOrderOid(b) ?? 0) - (openOrderOid(a) ?? 0);
  });
}

/** True for entry limits that lock init margin (not TP/SL / reduce-only). */
export function isRestingEntryLimitOrder(order: any | undefined | null): boolean {
  if (!order) return false;
  if (order.reduceOnly) return false;
  if (order.isTrigger) return false;
  if (order.isPositionTpsl) return false;
  return true;
}

/** Unique `coin` values for resting entry limits (perp + spot). */
export function restingEntryLimitCoins(orders: any[] | undefined): string[] {
  if (!Array.isArray(orders)) return [];
  const seen = new Set<string>();
  const coins: string[] = [];
  for (const o of orders) {
    if (!isRestingEntryLimitOrder(o)) continue;
    const coin = String(o.coin ?? '').toUpperCase();
    if (!coin || seen.has(coin)) continue;
    seen.add(coin);
    coins.push(coin);
  }
  return coins;
}

export function estimateRestingOrdersInitMarginUsd(orders: any[] | undefined): number {
  if (!Array.isArray(orders)) return 0;
  let sum = 0;
  for (const o of orders) {
    if (!isRestingEntryLimitOrder(o)) continue;
    const px = parseFloat(o?.limitPx ?? '0');
    const sz = parseFloat(o?.sz ?? o?.origSz ?? '0');
    if (!Number.isFinite(px) || !Number.isFinite(sz)) continue;
    const ntl = Math.abs(px * sz);
    if (!Number.isFinite(ntl) || ntl <= 0) continue;
    let lev = 0;
    const rawLev = (o as any)?.leverage;
    if (rawLev != null) {
      lev = typeof rawLev === 'object'
        ? parseFloat(rawLev?.value ?? '0')
        : parseFloat(String(rawLev));
    }
    // No leverage info → fall back to the 10% rule (= leverage 10).
    // For L<10 the actual init lock is bigger; for L≥10 the 10% floor
    // is what HL effectively reserves anyway (transfer rule).
    if (!Number.isFinite(lev) || lev <= 0) lev = 10;
    sum += ntl / lev;
  }
  return sum;
}

/**
 * Same calculation as `estimateRestingOrdersInitMarginUsd` but bucketed
 * by dex (key '' for main perp, e.g. 'xyz' for HIP-3 dexes — derived
 * from the order's `coin` field which is encoded as `dex:SYMBOL` for
 * HIP-3 markets). Used to tighten `perpInitialMarginAvailableByDex`
 * which would otherwise overstate per-dex room for new orders by the
 * sum of resting orders' init margin (HL's `marginSummary.totalMarginUsed`
 * only reflects filled positions, not resting orders).
 */
export function estimateRestingOrdersInitMarginByDex(orders: any[] | undefined): Record<string, number> {
  const byDex: Record<string, number> = {};
  if (!Array.isArray(orders)) return byDex;
  for (const o of orders) {
    if (!isRestingEntryLimitOrder(o)) continue;
    const px = parseFloat(o?.limitPx ?? '0');
    const sz = parseFloat(o?.sz ?? o?.origSz ?? '0');
    if (!Number.isFinite(px) || !Number.isFinite(sz)) continue;
    const ntl = Math.abs(px * sz);
    if (!Number.isFinite(ntl) || ntl <= 0) continue;
    let lev = 0;
    const rawLev = (o as any)?.leverage;
    if (rawLev != null) {
      lev = typeof rawLev === 'object'
        ? parseFloat(rawLev?.value ?? '0')
        : parseFloat(String(rawLev));
    }
    if (!Number.isFinite(lev) || lev <= 0) lev = 10;
    // Prefer the explicit `_dex` tag we attach to orders at fetch / WS
    // ingestion time (HL's order payloads carry bare `coin` strings —
    // "BRENTOIL" not "xyz:BRENTOIL" — even when fetched from a HIP-3
    // dex endpoint). Fall back to the symbol-prefix heuristic only when
    // the tag is missing so legacy data still buckets correctly.
    const explicitDex = typeof (o as any)._dex === 'string' ? (o as any)._dex : undefined;
    const coin = String(o?.coin ?? '');
    const dexKey = explicitDex != null
      ? explicitDex
      : coin.includes(':') ? coin.split(':')[0] : '';
    byDex[dexKey] = (byDex[dexKey] ?? 0) + ntl / lev;
  }
  return byDex;
}

/**
 * Get historical PnL timeseries for a user.
 * Returns account value history and PnL history for day, week, month, allTime periods.
 * 
 * According to Hyperliquid docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 * Response format:
 * [
 *   ["day", { "accountValueHistory": [[timestamp, value], ...], "pnlHistory": [[timestamp, value], ...], "vlm": "0.0" }],
 *   ["week", { ... }],
 *   ["month", { ... }],
 *   ["allTime", { ... }]
 * ]
 */
export type PnlTimeseriesEntry = {
  accountValueHistory: [number, string][];
  pnlHistory: [number, string][];
  vlm: string;
};

export type PnlTimeseries = {
  day: PnlTimeseriesEntry | null;
  week: PnlTimeseriesEntry | null;
  month: PnlTimeseriesEntry | null;
  allTime: PnlTimeseriesEntry | null;
};

export type UserPortfolioSummary = {
  allTimePnl: number | null;
  allTimeVlm: number | null;
};

/**
 * Calculate total PnL from user fills as a fallback verification method.
 * This sums all closedPnl from fills, which represents realized trading PnL.
 * Note: This may not include funding payments, so portfolio API is preferred.
 */
async function calculateTotalPnlFromFills(userAddress: Hex): Promise<number | null> {
  try {
    const fills = await getUserFills(userAddress);
    if (!Array.isArray(fills) || fills.length === 0) return null;
    
    let totalPnl = 0;
    for (const fill of fills) {
      // closedPnl is the realized PnL from closed positions
      const closedPnl = (fill as any)?.closedPnl ?? (fill as any)?.pnl ?? (fill as any)?.realizedPnl ?? 0;
      const pnlNum = typeof closedPnl === 'string' ? parseFloat(closedPnl) : typeof closedPnl === 'number' ? closedPnl : 0;
      if (Number.isFinite(pnlNum)) {
        totalPnl += pnlNum;
      }
      
      // Also subtract fees (fees are negative for the user)
      const fee = (fill as any)?.fee ?? 0;
      const feeNum = typeof fee === 'string' ? parseFloat(fee) : typeof fee === 'number' ? fee : 0;
      if (Number.isFinite(feeNum)) {
        totalPnl -= feeNum;
      }
    }
    
    return Number.isFinite(totalPnl) ? totalPnl : null;
  } catch {
    return null;
  }
}

export async function getUserPortfolioSummary(userAddress: Hex): Promise<UserPortfolioSummary> {
  const info = getHlInfoClient();
  let data: any;
  if (typeof (info as any).portfolio === 'function') {
    data = await (info as any).portfolio({ user: userAddress });
  } else {
    const response = await hlInfoFetch( {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'portfolio',
        user: userAddress,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText} ${errorBody}`);
    }

    data = await response.json();
  }
  
  /**
   * Extract PnL from pnlHistory array (pure trading PnL, excludes deposits/withdrawals).
   * pnlHistory format: [[timestamp, value], ...]
   * For "allTime", the last value should be the total cumulative PnL from account creation.
   * Returns the last value from the array, or null if not available.
   */
  const extractPnlFromHistory = (entry: any): number | null => {
    if (!entry) return null;
    
    // First, try to get from pnlHistory array (pure trading PnL)
    const pnlHistory = entry.pnlHistory;
    if (Array.isArray(pnlHistory) && pnlHistory.length > 0) {
      // For allTime, the last entry should be the total cumulative PnL
      const lastEntry = pnlHistory[pnlHistory.length - 1];
      if (Array.isArray(lastEntry) && lastEntry.length >= 2) {
        const rawPnl = lastEntry[1];
        const pnl = typeof rawPnl === 'string' ? parseFloat(rawPnl) : typeof rawPnl === 'number' ? rawPnl : NaN;
        if (Number.isFinite(pnl)) return pnl;
      }
    }
    
    // Fallback to direct fields (for backwards compatibility)
    const rawPnl =
      entry.pnl ??
      entry.pnls ??
      entry.pnlUsd ??
      entry.totalPnl ??
      entry.allTimePnl ??
      entry.allTimePnlUsd ??
      null;
    const pnl = typeof rawPnl === 'string' ? parseFloat(rawPnl) : typeof rawPnl === 'number' ? rawPnl : NaN;
    return Number.isFinite(pnl) ? pnl : null;
  };
  
  const extractVlm = (entry: any): number | null => {
    if (!entry) return null;
    const rawVlm =
      entry.vlm ??
      entry.volume ??
      entry.totalVlm ??
      entry.allTimeVlm ??
      entry.allTimeVolume ??
      null;
    const vlm = typeof rawVlm === 'string' ? parseFloat(rawVlm) : typeof rawVlm === 'number' ? rawVlm : NaN;
    return Number.isFinite(vlm) ? vlm : null;
  };

  // Formats seen in the docs include array tuples or keyed objects.
  let extractedPnl: number | null = null;
  let extractedVlm: number | null = null;
  
  if (Array.isArray(data)) {
    for (const [period, entry] of data) {
      if (period === 'allTime' || period === 'perpAllTime') {
        extractedPnl = extractPnlFromHistory(entry);
        extractedVlm = extractVlm(entry);
        break;
      }
    }
  }

  // If not found in array format, try candidate entries
  if (extractedPnl === null) {
    const candidateEntries = [
      data?.allTime,
      data?.perpAllTime,
      data?.portfolio?.allTime,
      data?.portfolio?.perpAllTime,
      data?.perp?.allTime,
      data?.perp?.perpAllTime,
      data?.summary?.allTime,
    ].filter(Boolean);

    for (const entry of candidateEntries) {
      extractedPnl = extractPnlFromHistory(entry);
      extractedVlm = extractVlm(entry);
      if (extractedPnl != null || extractedVlm != null) {
        break;
      }
    }
  }

  // Final fallback to root data
  if (extractedPnl === null) {
    extractedPnl = extractPnlFromHistory(data);
    extractedVlm = extractVlm(data);
  }

  // If still no PnL found from portfolio API, try calculating from fills as verification
  // This is a fallback and may not include funding payments
  if (extractedPnl === null) {
    const fillsPnl = await calculateTotalPnlFromFills(userAddress);
    if (fillsPnl !== null) {
      extractedPnl = fillsPnl;
    }
  }

  return { allTimePnl: extractedPnl, allTimeVlm: extractedVlm };
}

export async function getHistoricalPnlTimeseries(userAddress: Hex): Promise<PnlTimeseries> {
  const info = getHlInfoClient();
  let data: any;
  if (typeof (info as any).portfolio === 'function') {
    data = await (info as any).portfolio({ user: userAddress });
  } else {
    const response = await hlInfoFetch( {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'portfolio',
        user: userAddress,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText} ${errorBody}`);
    }

    data = await response.json();
  }
  
  // Parse the array format into a more usable object
  const result: PnlTimeseries = {
    day: null,
    week: null,
    month: null,
    allTime: null,
  };

  if (Array.isArray(data)) {
    for (const [period, entry] of data) {
      // These are combined portfolio periods. The separate perp* entries
      // represent a different scope; do not overwrite account-wide volume.
      if (period === 'day') {
        result.day = entry as PnlTimeseriesEntry;
      } else if (period === 'week') {
        result.week = entry as PnlTimeseriesEntry;
      } else if (period === 'month') {
        result.month = entry as PnlTimeseriesEntry;
      } else if (period === 'allTime') {
        result.allTime = entry as PnlTimeseriesEntry;
      }
    }
  }

  return result;
}

/**
 * Calculate 24h PnL percentage from historical data.
 * Uses pnlHistory (pure trading PnL) - NOT accountValueHistory which includes deposits/withdrawals.
 * 
 * IMPORTANT: Returns 0 for tiny/inactive accounts to avoid misleading percentages.
 * When account values are very small (< $1), tiny fluctuations can cause
 * massive percentage swings (e.g., $0.003 -> $0.01 = +233%) which are meaningless.
 */
export function calculate24hPnlPercent(timeseries: PnlTimeseries, currentAccountValue: number): number {
  // Minimum threshold to avoid misleading percentages from tiny balances
  const MIN_MEANINGFUL_VALUE = 1.0;
  
  const dayData = timeseries.day;
  if (!dayData) {
    return 0;
  }

  // Use pnlHistory for pure trading PnL (excludes deposits/withdrawals)
  // pnlHistory contains cumulative PnL, so 24h PnL = latest - oldest in the day period
  const pnlHistory = dayData.pnlHistory;
  if (!pnlHistory || pnlHistory.length < 2) {
    return 0;
  }

  // Get 24h trading PnL (difference between latest and oldest cumulative PnL in the day)
  const oldestPnl = parseFloat(pnlHistory[0]?.[1] ?? '0');
  const latestPnl = parseFloat(pnlHistory[pnlHistory.length - 1]?.[1] ?? '0');
  const tradingPnl24h = latestPnl - oldestPnl;

  // If account value is too small, any percentage is noise
  if (currentAccountValue < MIN_MEANINGFUL_VALUE) {
    return 0;
  }

  // Derive the capital base in a deposit/withdrawal-aware way.
  //
  // We must NOT divide by the oldest account value in the window: if a deposit
  // (or withdrawal) happened during the last 24h, that value predates it and is
  // unrelated to the capital the PnL was actually earned on. Example: account
  // sat at $50, user deposits $3,000, trades to +$275 -> 275/50 = 550% which is
  // meaningless and hits the display cap.
  //
  // `currentAccountValue - tradingPnl24h` algebraically equals
  // `accountValue_24h_ago + netDeposits_in_window`, i.e. the total capital that
  // was actually at work over the period. That is the correct denominator.
  let baseValue = currentAccountValue - tradingPnl24h;

  // Fallback only if the derived base is unusable (e.g. rounds to ~0).
  if (!Number.isFinite(baseValue) || baseValue < MIN_MEANINGFUL_VALUE) {
    const accountHistory = dayData.accountValueHistory;
    const oldestAccountValue = accountHistory && accountHistory.length > 0
      ? parseFloat(accountHistory[0]?.[1] ?? '0')
      : NaN;
    if (Number.isFinite(oldestAccountValue) && oldestAccountValue > MIN_MEANINGFUL_VALUE) {
      baseValue = oldestAccountValue;
    } else {
      baseValue = currentAccountValue;
    }
  }

  if (!Number.isFinite(baseValue) || baseValue < MIN_MEANINGFUL_VALUE) {
    return 0;
  }

  // Calculate percentage based on trading PnL relative to the capital base
  const pnlPercent = (tradingPnl24h / baseValue) * 100;
  
  // Cap extreme percentages to avoid display issues
  const cappedChange = Math.max(-99.9, Math.min(pnlPercent, 999.9));
  
  return Number.isFinite(cappedChange) ? cappedChange : 0;
}

/** Last sample of a PnL series (all-time cumulative, or a 1-point window). */
export function lastPnlHistoryValue(history: [number, string][] | null | undefined): number | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const raw = history[history.length - 1]?.[1];
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Trading PnL over a window. HL `day`/`week`/`month` series are cumulative
 * snapshots — period change is last − first (homepage 24h % already does this).
 */
export function windowPnlHistoryDelta(history: [number, string][] | null | undefined): number | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const last = lastPnlHistoryValue(history);
  if (last == null) return null;
  if (history.length === 1) return last;
  const firstRaw = history[0]?.[1];
  const first = typeof firstRaw === 'number' ? firstRaw : parseFloat(String(firstRaw ?? ''));
  if (!Number.isFinite(first)) return last;
  return last - first;
}

export async function prewarmOrderCaches(symbol: string): Promise<void> {
  try {
    const isHip3 = symbol.includes(':');

    // Run cache-warming fetches in parallel
    const promises: Promise<any>[] = [];

    if (isHip3) {
      const dexName = symbol.split(':')[0];
      // Pre-fetch HIP-3 meta and dex list
      promises.push(getHip3MetaCached(dexName));
      promises.push(getPerpDexsCached());
    } else {
      // Pre-fetch main exchange meta
      promises.push(getMetaCached());
    }

    // Always pre-fetch margin support (uses same meta caches)
    promises.push(getPerpMarginSupport(symbol).catch(() => null));

    await Promise.all(promises);
  } catch {
    // Silently ignore errors - this is just optimization
  }
}

export async function prewarmHlTransport(): Promise<void> {
  try {
    // Fire and forget. We don't await downstream — caller usually doesn't
    // care when the warmup completes, only that it started.
    await getMetaCached();
  } catch {
    // Silently ignore — this is just connection priming.
  }
}

export function computeSpotUsdcOnlyUsd(spotState: any): number {
  if (!spotState) return 0;
  const balances = spotState?.balances ?? [];
  let total = 0;
  for (const b of balances) {
    const coin = String(b?.coin ?? '').toUpperCase();
    const tokenIdx = b?.token;
    const isUsdc = coin === 'USDC' || tokenIdx === 0;
    if (!isUsdc) continue;
    const v = parseFloat(b?.total ?? '0');
    if (Number.isFinite(v) && v > 0) total += v;
  }
  return total;
}

export function computeSpotUsdcHoldUsd(spotState: any): number {
  if (!spotState) return 0;
  const balances = spotState?.balances ?? [];
  let total = 0;
  for (const b of balances) {
    const coin = String(b?.coin ?? '').toUpperCase();
    const tokenIdx = b?.token;
    const isUsdc = coin === 'USDC' || tokenIdx === 0;
    if (!isUsdc) continue;
    const v = parseFloat(b?.hold ?? '0');
    if (Number.isFinite(v) && v > 0) total += v;
  }
  return total;
}

export function estimateSpotOpenOrdersUsdcHoldUsd(orders: any[] | undefined): number {
  if (!Array.isArray(orders)) return 0;
  let sum = 0;
  for (const o of orders) {
    if (!o) continue;
    if (o.reduceOnly) continue;
    if (o.isTrigger) continue;
    if (o.isPositionTpsl) continue;
    const side = String(o?.side ?? o?.sideRaw ?? '').toUpperCase();
    const isBuy = side === 'B' || side === 'BUY' || side === 'LONG';
    if (!isBuy) continue;
    const coin = String(o?.coin ?? '');
    const asset = Number(o?.asset ?? o?.a);
    const isSpot = coin.startsWith('@') || coin.toUpperCase().includes('/USDC') || asset >= 10000;
    if (!isSpot) continue;
    const px = parseFloat(o?.limitPx ?? '0');
    const sz = parseFloat(o?.sz ?? o?.origSz ?? '0');
    if (!Number.isFinite(px) || !Number.isFinite(sz)) continue;
    const ntl = Math.abs(px * sz);
    if (Number.isFinite(ntl) && ntl > 0) sum += ntl;
  }
  return sum;
}

export function computeSpotBalanceUsd(
  spotState: any,
  spotMetaData: any,
): { spotBalanceUsd: number; spotPositionsCount: number } {
  let spotBalanceUsd = 0;
  let spotPositionsCount = 0;
  if (!spotState) return { spotBalanceUsd, spotPositionsCount };

  const balances = spotState?.balances ?? [];
  const hasMeta = spotMetaData && Array.isArray(spotMetaData) && spotMetaData.length >= 2;
  const meta = hasMeta ? spotMetaData[0] : null;
  const assetCtxs = hasMeta ? (spotMetaData[1] ?? []) : [];
  const tokens = meta?.tokens ?? [];
  const universe = meta?.universe ?? [];
  const usdcIndex = tokens.find((t: any) => String(t?.name ?? '').toUpperCase() === 'USDC')?.index;

  balances.forEach((balance: any) => {
    const tokenStr = String(balance?.token ?? balance?.coin ?? '');
    const total = safeNum(balance?.total);
    if (total <= 0) return;

    const coinName = String(balance?.coin ?? '').toUpperCase();
    // Fast path when spot meta hasn't loaded yet (common on Home right after
    // the account stream connects): still count USDC, and use HL's
    // `entryNtl` cost basis for non-USDC (e.g. spot GOLD) so Trade Balance
    // doesn't flash ~$50 short until mark prices arrive.
    if (!hasMeta) {
      if (coinName === 'USDC') {
        spotBalanceUsd += total;
        return;
      }
      const entryNtl = safeNum(balance?.entryNtl);
      if (entryNtl > 0) {
        spotBalanceUsd += entryNtl;
        if (entryNtl >= 1) spotPositionsCount++;
      }
      return;
    }

    const token = tokens.find((t: any) =>
      String(t?.index ?? '') === tokenStr ||
      String(t?.name ?? '').toUpperCase() === tokenStr.toUpperCase() ||
      String(t?.name ?? '').toUpperCase() === coinName,
    );
    if (!token) {
      if (coinName === 'USDC') spotBalanceUsd += total;
      return;
    }

    if (token.index === 0 || String(token.name).toUpperCase() === 'USDC') {
      spotBalanceUsd += total;
      return;
    }

    const universeEntry = universe.find((u: any) => {
      const uTokens = u?.tokens;
      return (
        Array.isArray(uTokens) &&
        uTokens.length >= 2 &&
        uTokens[0] === token.index &&
        (Number.isFinite(usdcIndex) ? uTokens[1] === usdcIndex : uTokens[1] === 0)
      );
    });
    if (universeEntry?.name) {
      const symbol = String(universeEntry.name).toUpperCase();
      const spotPair = assetCtxs.find((c: any) => String(c?.coin ?? '').toUpperCase() === symbol);
      const markPx = safeNum(spotPair?.markPx ?? spotPair?.midPx);
      const szDecRaw = Number(token?.szDecimals ?? universeEntry?.szDecimals ?? universeEntry?.szDec);
      const minLot = Number.isFinite(szDecRaw) ? Math.pow(10, -szDecRaw) : 0;
      const isSellableLot = !Number.isFinite(minLot) || minLot <= 0 || total >= minLot;
      if (markPx > 0) {
        const valueUsd = total * markPx;
        spotBalanceUsd += valueUsd;
        if (isSellableLot && valueUsd >= 1) spotPositionsCount++;
        return;
      }
    }

    const entryNtl = safeNum(balance?.entryNtl);
    if (entryNtl > 0) {
      spotBalanceUsd += entryNtl;
      const szDecRaw = Number(token?.szDecimals);
      const minLot = Number.isFinite(szDecRaw) ? Math.pow(10, -szDecRaw) : 0;
      const isSellableLot = !Number.isFinite(minLot) || minLot <= 0 || total >= minLot;
      if (isSellableLot && entryNtl >= 1) spotPositionsCount++;
    }
  });

  return { spotBalanceUsd, spotPositionsCount };
}

// ============================================================================
// Hyperliquid Trading State & Abstraction Mode Queries
// ============================================================================

export type HyperliquidTradingState = {
  accountValueUsd: number;
  withdrawableUsd: number;
  hasBalance: boolean;
  agentAddress?: Hex;
  isAgentActive: boolean;
  /**
   * Unix-ms expiry of the currently-matched (stored) agent, or null when no
   * active agent matches. Drives proactive silent re-approval before the
   * agent lapses so users aren't re-prompted at order time. HL agents are
   * long-lived (~180d) but finite; we renew within a window of this value.
   */
  agentValidUntil: number | null;
  positions: Array<{
    coin: string;
    szi: string;
    entryPx: string;
    liquidationPx: string | null;
    unrealizedPnl: string;
    returnOnEquity: string;
    leverage?: string | number | null;
    marginUsed?: string | number | null;
    positionValue?: string | number | null;
    maxLeverage?: string | number | null;
    marginType?: 'cross' | 'isolated';
    cumFunding?: {
      allTime: string;
      sinceOpen: string;
      sinceChange: string;
    } | null;
  }>;
  perpAccountValueUsd: number;
  spotBalanceUsd: number;
  perpPositionsCount: number;
  spotPositionsCount: number;
  /**
   * Cross-margin pool equity (`crossMarginSummary.accountValue`) per HL DEX.
   *
   * Key '' is the main perp dex; HIP-3 dexes are keyed by their dex name
   * (e.g. 'xyz'). Use this — NOT `perpAccountValueUsd` — when computing
   * cross liquidation prices, because:
   *
   *   • HL keeps each dex's cross margin SEPARATE under standard account
   *     abstraction, so a HIP-3 dex's equity does not back main-dex
   *     positions and vice versa.
   *   • Within a dex, isolated-position equity is not part of the cross
   *     pool — `crossMarginSummary.accountValue` excludes it, while
   *     `marginSummary.accountValue` does not.
   *
   * Mixing those layers (as the previous `perpAccountValueUsd` summation
   * did) would inflate equity and produce projected liq prices that drift
   * safer than HL's own — sometimes far enough to flip the direction of
   * change when compounding a position.
   */
  perpCrossAccountValueByDex: Record<string, number>;
  /**
   * Sum of every OPEN cross position's maintenance-margin requirement in
   * the dex pool, as exposed by HL at the top level of `clearinghouseState`
   * (`crossMaintenanceMarginUsed`). Pairs with `perpCrossAccountValueByDex`:
   *
   *   margin_available_cross = crossMarginSummary.accountValue
   *                          − crossMaintenanceMarginUsed
   *
   * This is the SHARED `margin_available` scalar HL plugs into its
   * liquidation formula for every cross position in the pool. Without
   * subtracting it, projected liqs for a NEW position on an asset with no
   * existing same-asset position drift dangerously safe — they ignore the
   * maintenance margin already locked up by the user's other cross
   * positions, even though HL's real fill will subtract them.
   *
   * Same key convention as `perpCrossAccountValueByDex`: '' for main perp
   * dex, dex name for HIP-3 dexes.
   */
  perpCrossMaintenanceMarginUsedByDex: Record<string, number>;
  /**
   * Per-dex withdrawable USDC (`clearinghouseState.withdrawable`). Key ''
   * for the main perp dex, dex name for HIP-3 dexes.
   *
   * Used as the `mainDexAvailableUsdc` input for JIT `sendAsset` funding
   * of HIP-3 orders in Standard account-abstraction mode, where per-dex
   * balances are siloed and the target HIP-3 dex may need to be topped
   * up from the main dex before an opening order is placed.
   */
  perpWithdrawableByDex: Record<string, number>;
  /**
   * Per-dex initial-margin room for opening/stacking perp orders:
   *
   *   marginSummary.accountValue - marginSummary.totalMarginUsed
   *
   * This is different from withdrawable. Withdrawable can be zero because of
   * transfer requirements, while the account may still have room to open
   * more notional; conversely, another DEX's withdrawable must not size a
   * Standard-mode main-dex order.
   */
  perpInitialMarginAvailableByDex: Record<string, number>;
  /**
   * HL account abstraction mode (`userAbstraction` endpoint). DEFAULT for
   * app.hyperliquid.xyz is `unifiedAccount`.
   *
   * Liquidation math depends on this:
   *
   *   • `unifiedAccount` / `portfolioMargin` — ONE shared cross-margin pool
   *     across all USDC-backed dexes:
   *
   *       margin_available = spotUsdcBalanceUsd
   *                        − totalIsolatedMarginUsedUsd
   *                        − totalCrossMaintenanceMarginUsedUsd
   *
   *     Per-dex `crossMarginSummary.accountValue` is NOT meaningful in
   *     these modes; we MUST use the unified-pool scalars below.
   *
   *   • `disabled` / `default` / `dexAbstraction` — Per-dex cross pool:
   *
   *       margin_available = perpCrossAccountValueByDex[dex]
   *                        − perpCrossMaintenanceMarginUsedByDex[dex]
   *
   * `null` means we couldn't fetch the mode (treat as per-dex fallback).
   */
  accountAbstractionMode: HyperliquidAbstractionMode | null;
  /**
   * Legacy HIP-3 DEX abstraction flag from HL's separate
   * `userDexAbstraction` endpoint. This can expose migrated/hybrid accounts
   * where `userAbstraction` reports `disabled` but HIP-3 USDC may still
   * affect main-dex behavior in non-obvious ways.
   */
  userDexAbstractionEnabled: boolean | null;
  /**
   * USDC-only spot balance (excludes other coins). Backs cross positions
   * in `unifiedAccount` / `portfolioMargin` modes. Includes balances on
   * hold (matches HL's own ratio formula).
   */
  spotUsdcBalanceUsd: number;
  /**
   * Estimated USDC locked by resting spot BUY orders. Raw
   * `spotClearinghouseState.balances[].hold` can also include unified perp
   * margin reservations, so do not use raw hold as a spot-order lock.
   */
  spotUsdcHoldUsd: number;
  /**
   * Sum of `marginUsed` across every OPEN isolated position on every dex
   * (main + HIP-3). In `unifiedAccount` mode this is what HL deducts from
   * `spotUSDC` to get the pool equity backing cross positions.
   */
  totalIsolatedMarginUsedUsd: number;
  /**
   * Sum of `crossMaintenanceMarginUsed` across every dex (main + HIP-3).
   * In `unifiedAccount` mode this is the total maintenance margin
   * requirement for the unified cross pool.
   */
  totalCrossMaintenanceMarginUsedUsd: number;
  /**
   * Sum of `marginSummary.totalMarginUsed` across every dex (main + HIP-3).
   * Equals every cross / isolated position's INITIAL margin reservation.
   * One half of HL's `transfer_margin_required = max(initial, 0.10 × pos_val)`
   * rule used to cap `sendAsset(spot → <dex>)` transfers in unified mode.
   */
  totalCrossInitialMarginUsedUsd: number;
  /**
   * Sum of `|positionValue|` across every CROSS position on every dex.
   * The other half of HL's transfer rule — at >10× leverage the
   * `0.10 × position_value` floor dominates `initial_margin_used` and is
   * what HL actually enforces on spot-out transfers in unified mode.
   */
  totalCrossPositionValueUsd: number;
  /**
   * Amount transferable out of the spot subaccount in unified /
   * portfolioMargin modes via `sendAsset(spot → <dex>)`. Implements HL's
   * documented "transfer margin" rule (see Margining docs):
   *
   *   transfer_margin_required = max(
   *     totalCrossInitialMarginUsedUsd,
   *     0.10 × totalCrossPositionValueUsd          ← dominates above 10×
   *   )
   *   transferable = max(0,
   *     spotUSDC
   *       − transfer_margin_required
   *       − totalIsolatedMarginUsedUsd
   *   )
   *
   * Sending more than this triggers HL's "Insufficient balance for token
   * transfer" rejection. Use this (not `pooledMarginAvailableUsd`) as the
   * JIT funding source budget for HIP-3 orders in unified mode.
   *
   * In Standard / disabled modes this value is meaningless; callers should
   * gate on `accountAbstractionMode`.
   */
  unifiedSpotTransferableUsd: number;
  /**
   * Coins with resting entry limit orders (not reduce-only / trigger / TP-SL).
   * These lock init margin before fill — Shared agents sit out if they fill
   * into a live position; Dedicated funding/transfers can fail until cancelled
   * or more USDC is added.
   */
  restingLimitCoins: string[];
};

export async function getHyperliquidTradingState(userAddress: Hex): Promise<HyperliquidTradingState> {
  // Open orders are needed to mirror HL's transfer rule, which counts
  // RESTING (non-reduce-only / non-trigger) order notionals in
  // `position_value` for the `max(initial, 0.10 × position_value)` cap.
  // Without these, a $300 resting BTC limit lets the slider/JIT think
  // the spot pool is fully transferable when in fact $30 is locked.
  const [mainState, hip3States, agents, spotState, abstractionMode, userDexAbstractionEnabled, allOpenOrders] = await Promise.all([
    (async () => {
      const response = await hlInfoFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user: userAddress }),
      });
      if (!response.ok) {
        throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })(),
    Promise.all(
      HIP3_DEXES.map(async (dex) => {
        try {
          const response = await hlInfoFetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: userAddress, dex }),
          });
          if (!response.ok) return null;
          return await response.json();
        } catch {
          return null;
        }
      }),
    ),
    // extraAgents lives on the master signer. HL subs return null/[] here —
    // callers must overlay master isAgentActive (useSignerTradingSetup)
    // instead of treating a dedicated book as "agent off".
    (async () => {
      const response = await hlInfoFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'extraAgents', user: userAddress }),
      });
      if (!response.ok) {
        throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })(),
    getSpotClearinghouseState(userAddress).catch(() => null),
    getUserAbstractionMode(userAddress).catch(() => null),
    getUserDexAbstractionEnabled(userAddress).catch(() => null),
    getOpenOrders(userAddress).catch(() => [] as any[]),
  ]);

  const allStates = [mainState, ...(hip3States.filter(Boolean) as any[])];
  const rawPerpAccountValueUsd = allStates.reduce((sum, s) => sum + safeNum(s?.marginSummary?.accountValue), 0);
  const rawWithdrawableUsd = allStates.reduce((sum, s) => sum + safeNum(s?.withdrawable), 0);

  const getIsolatedMarginUsed = (st: any): number => {
    const positions = st?.assetPositions ?? [];
    return positions.reduce((sum: number, p: any) => {
      const lev = p?.position?.leverage;
      const isIsolated = typeof lev === 'object' && lev?.type === 'isolated';
      if (!isIsolated) return sum;
      return sum + safeNum(p?.position?.marginUsed);
    }, 0);
  };

  // Cross-backed account value per dex. For Standard mode, cross margin
  // shares all account value in the dex except isolated margin. In live
  // tests, `crossMarginSummary.accountValue` can understate this after
  // cross positions exist, causing too-tight new-position liq previews.
  // So use `marginSummary.accountValue - isolatedMarginUsed` and keep
  // `crossMarginSummary.accountValue` only as a fallback.
  const perpCrossAccountValueByDex: Record<string, number> = {};
  const perpCrossMaintenanceMarginUsedByDex: Record<string, number> = {};
  const perpWithdrawableByDex: Record<string, number> = {};
  const perpInitialMarginAvailableByDex: Record<string, number> = {};
  const mainIsolatedMarginUsed = getIsolatedMarginUsed(mainState);
  perpCrossAccountValueByDex[''] =
    Math.max(0, safeNum((mainState as any)?.marginSummary?.accountValue) - mainIsolatedMarginUsed)
    || safeNum((mainState as any)?.crossMarginSummary?.accountValue);
  perpCrossMaintenanceMarginUsedByDex[''] = safeNum((mainState as any)?.crossMaintenanceMarginUsed);
  perpWithdrawableByDex[''] = safeNum((mainState as any)?.withdrawable);
  perpInitialMarginAvailableByDex[''] = Math.max(
    0,
    safeNum((mainState as any)?.marginSummary?.accountValue) -
      safeNum((mainState as any)?.marginSummary?.totalMarginUsed),
  );
  HIP3_DEXES.forEach((dexName, i) => {
    const s = hip3States[i];
    if (!s) return;
    const iso = getIsolatedMarginUsed(s);
    perpCrossAccountValueByDex[dexName] =
      Math.max(0, safeNum((s as any)?.marginSummary?.accountValue) - iso)
      || safeNum((s as any)?.crossMarginSummary?.accountValue);
    perpCrossMaintenanceMarginUsedByDex[dexName] = safeNum((s as any)?.crossMaintenanceMarginUsed);
    perpWithdrawableByDex[dexName] = safeNum((s as any)?.withdrawable);
    perpInitialMarginAvailableByDex[dexName] = Math.max(
      0,
      safeNum((s as any)?.marginSummary?.accountValue) -
        safeNum((s as any)?.marginSummary?.totalMarginUsed),
    );
  });
  // Subtract resting orders' init-margin locks on a per-dex basis. HL's
  // `marginSummary.totalMarginUsed` only reflects FILLED positions, so
  // a dex with two resting limits otherwise looks completely free even
  // when each limit has reserved init margin out of that dex's pool.
  // Without this the HIP-3 slider cap (`unifiedSpotTransferable +
  // targetDexBalance`) overstates room and HL rejects the next order
  // for "insufficient margin" at submit time.
  const restingOrdersInitMarginByDex = estimateRestingOrdersInitMarginByDex(allOpenOrders as any[]);
  for (const [dex, lock] of Object.entries(restingOrdersInitMarginByDex)) {
    if (perpInitialMarginAvailableByDex[dex] == null) continue;
    perpInitialMarginAvailableByDex[dex] = Math.max(
      0,
      perpInitialMarginAvailableByDex[dex] - (Number.isFinite(lock) ? lock : 0),
    );
  }

  // Unified-pool aggregates (used in `unifiedAccount` / `portfolioMargin` modes
  // where HL collateralises every USDC-backed cross dex from one shared pool).
  // Per HL docs: `available = spotUSDC − sum(isolatedMarginUsed)`; ratio is
  // `sum(crossMaintenanceMarginUsed) / available`. We feed those scalars into
  // estimateLiqPriceCross so projections match HL's own client-side liq math.
  const totalCrossMaintenanceMarginUsedUsd = Object.values(perpCrossMaintenanceMarginUsedByDex)
    .reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const totalIsolatedMarginUsedUsd = allStates.reduce((sum, st) => sum + getIsolatedMarginUsed(st), 0);
  // Sum of every dex's `marginSummary.totalMarginUsed`. In unified mode this
  // captures all initial margin reservations that pin the spot pool — both
  // main perp and HIP-3 dexes contribute. One half of HL's
  // `transfer_margin_required = max(initial, 0.10 × position_value)` rule.
  const totalCrossInitialMarginUsedUsd = allStates.reduce((sum, st) => {
    const mu = safeNum((st as any)?.marginSummary?.totalMarginUsed);
    return sum + (Number.isFinite(mu) ? mu : 0);
  }, 0);
  // Sum of every CROSS position's notional value across every dex. Drives
  // the 10%-of-notional floor on transferable margin. Above 10× leverage
  // this floor dominates and is what locks down spot in your example.
  const positionsCrossPositionValueUsd = allStates.reduce((sum, st) => {
    const aps = ((st as any)?.assetPositions ?? []) as any[];
    let dexSum = 0;
    aps.forEach((ap) => {
      const lev = ap?.position?.leverage;
      const isCross = typeof lev === 'object' ? lev?.type === 'cross' : true;
      if (!isCross) return;
      const pv = Math.abs(safeNum(ap?.position?.positionValue));
      if (Number.isFinite(pv)) dexSum += pv;
    });
    return sum + dexSum;
  }, 0);
  // RESTING limit orders (non-reduce-only / non-trigger / non-position-tpsl)
  // also count toward `position_value` in HL's transfer rule. Without
  // including them, the `max(initial, 0.10 × position_value)` cap looks
  // higher than HL's actual limit and JIT funding gets rejected with
  // "Insufficient balance for token transfer".
  const restingOrdersNotionalUsd = ((allOpenOrders ?? []) as any[]).reduce((sum, o) => {
    if (!o) return sum;
    if (o.reduceOnly) return sum;
    if (o.isTrigger) return sum;
    if (o.isPositionTpsl) return sum;
    const px = parseFloat(o?.limitPx ?? '0');
    const sz = parseFloat(o?.sz ?? o?.origSz ?? '0');
    if (!Number.isFinite(px) || !Number.isFinite(sz)) return sum;
    const ntl = Math.abs(px * sz);
    return Number.isFinite(ntl) ? sum + ntl : sum;
  }, 0);
  const totalCrossPositionValueUsd = positionsCrossPositionValueUsd + restingOrdersNotionalUsd;

  // Spot balance (USDC + non-USDC priced via entryNtl / spot meta). Shared with DepositPanel
  // so "Trade Balance" matches across home, profile, and portfolio screens.
  const spotMetaData = spotState ? await getSpotMetaAndAssetCtxsCached().catch(() => null) : null;
  const { spotBalanceUsd, spotPositionsCount } = computeSpotBalanceUsd(spotState, spotMetaData);
  const spotUsdcBalanceUsd = computeSpotUsdcOnlyUsd(spotState);
  const spotUsdcHoldUsd = estimateSpotOpenOrdersUsdcHoldUsd(allOpenOrders as any[]);
  /*
   * Debug note (2026-06-03): kept commented for future unified spot/perp margin
   * investigations. We used this to confirm raw spot `hold` can represent perp
   * margin reservation, while `spotOrderHoldUsd` should only count resting spot
   * BUY orders for spot -> HIP-3 funding budgets.
   *
   * if (__DEV__ && spotState) {
   *   try {
   *     const rawSpotUsdcHoldUsd = computeSpotUsdcHoldUsd(spotState);
   *     const spotBalances = ((spotState as any)?.balances ?? []) as any[];
   *     const nonUsdcBalances = spotBalances
   *       .filter((b) => {
   *         const coin = String(b?.coin ?? '').toUpperCase();
   *         return coin && coin !== 'USDC' && safeNum(b?.total) > 0;
   *       })
   *       .map((b) => ({
   *         coin: b?.coin,
   *         total: b?.total,
   *         hold: b?.hold,
   *         entryNtl: b?.entryNtl,
   *       }));
   *     const likelySpotOrders = ((allOpenOrders ?? []) as any[])
   *       .filter((o) => {
   *         const coin = String(o?.coin ?? '');
   *         const asset = Number(o?.asset ?? o?.a);
   *         return coin.startsWith('@') || coin.toUpperCase().includes('/USDC') || asset >= 10000;
   *       })
   *       .map((o) => ({
   *         coin: o?.coin,
   *         side: o?.side,
   *         limitPx: o?.limitPx,
   *         sz: o?.sz ?? o?.origSz,
   *         reduceOnly: o?.reduceOnly,
   *         isTrigger: o?.isTrigger,
   *       }))
   *       .slice(0, 8);
   *     if (rawSpotUsdcHoldUsd > 0.01 || spotUsdcHoldUsd > 0.01 || nonUsdcBalances.length > 0 || likelySpotOrders.length > 0) {
   *       console.log('[HLSpotBalanceDebug]', {
   *         spotBalanceUsd,
   *         spotUsdcBalanceUsd,
   *         spotHoldUsd: rawSpotUsdcHoldUsd,
   *         spotOrderHoldUsd: spotUsdcHoldUsd,
   *         pooledMode: isPooledAccountMode(abstractionMode),
   *         openSpotOrders: likelySpotOrders,
   *         nonUsdcBalances,
   *       });
   *     }
   *   } catch {}
   * }
   */

  const isPooledAbstraction = isPooledAccountMode(abstractionMode);
  // Unified-mode "free margin available for new orders":
  //   accountValue − (existing cross init margins + resting orders'
  //   init margins + isolated margins)
  // HL's order-acceptance check is `accountValue ≥ initialMargin` (per HL
  // Margining docs), so we subtract INITIAL — not maintenance — for
  // existing positions. Resting orders also lock initial margin from the
  // moment they hit the book, so we estimate and subtract those too.
  // Without the resting-order term, a user with two BTC limits at 40x
  // sees the full spot pool as available and HL rejects their next order.
  const restingOrdersInitMarginUsd = estimateRestingOrdersInitMarginUsd(allOpenOrders as any[]);
  const pooledMarginAvailableUsd = Math.max(
    0,
    spotUsdcBalanceUsd
      - totalIsolatedMarginUsedUsd
      - totalCrossInitialMarginUsedUsd
      - restingOrdersInitMarginUsd,
  );
  // Spot → perp transferable budget in unified mode using HL's documented
  // `max(initial, 0.10 × position_value)` rule. Resting limit orders
  // (cross or isolated) lock additional init margin out of the spot pool
  // even before they fill, so we pass them in too — without this, the
  // HIP-3 slider treats those locks as free transferable USDC.
  const unifiedSpotTransferableUsd = computeUnifiedSpotTransferableUsd({
    spotUsdcBalanceUsd,
    totalCrossInitialMarginUsedUsd,
    totalCrossPositionValueUsd,
    totalIsolatedMarginUsedUsd,
    spotUsdcHoldUsd,
    restingOrdersInitMarginUsd,
  });
  const perpAccountValueUsd = isPooledAbstraction ? 0 : rawPerpAccountValueUsd;
  const withdrawableUsd = isPooledAbstraction ? pooledMarginAvailableUsd : rawWithdrawableUsd;
  const accountValueUsd = isPooledAbstraction ? spotBalanceUsd : rawPerpAccountValueUsd + spotBalanceUsd;
  const hasBalance = accountValueUsd > 0.01 || withdrawableUsd > 0.01;

  const agentAddress = await getStoredAgentAddress();
  const now = Date.now();
  // `extraAgents` can be null/non-array for HL sub-accounts — don't throw.
  const agentList = Array.isArray(agents) ? agents : [];
  const matchedAgent = agentAddress
    ? agentList.find(
        (a) =>
          a?.address &&
          String(a.address).toLowerCase() === agentAddress.toLowerCase() &&
          (a.validUntil == null ||
            (Number.isFinite(Number(a.validUntil)) && Number(a.validUntil) > now))
      )
    : undefined;
  const isAgentActive = !!matchedAgent;
  const agentValidUntil =
    matchedAgent && matchedAgent.validUntil != null
      ? Number(matchedAgent.validUntil)
      : null;

  // Count perp positions
  const perpPositionsCount = allStates.flatMap((state) => state?.assetPositions ?? []).length;

  return {
    accountValueUsd,
    withdrawableUsd,
    hasBalance,
    agentAddress: agentAddress ?? undefined,
    isAgentActive,
    agentValidUntil,
    positions: allStates.flatMap((state) => state?.assetPositions ?? []).map((p) => {
      const lev = (p.position as any)?.leverage;
      // Hyperliquid leverage can be an object { type: "cross"|"isolated", value: number } or just a number
      const marginType: 'cross' | 'isolated' =
        typeof lev === 'object' && lev?.type === 'cross' ? 'cross' : 'isolated';
      // cumFunding: { allTime, sinceOpen, sinceChange } — accumulated funding for this position
      const rawCumFunding = (p.position as any)?.cumFunding;
      const cumFunding = rawCumFunding && typeof rawCumFunding === 'object'
        ? {
            allTime: String(rawCumFunding.allTime ?? '0'),
            sinceOpen: String(rawCumFunding.sinceOpen ?? '0'),
            sinceChange: String(rawCumFunding.sinceChange ?? '0'),
          }
        : null;
      return {
        coin: p.position.coin,
        szi: p.position.szi,
        entryPx: p.position.entryPx,
        liquidationPx: p.position.liquidationPx,
        unrealizedPnl: p.position.unrealizedPnl,
        returnOnEquity: p.position.returnOnEquity,
        leverage: lev ?? null,
        marginUsed: (p.position as any)?.marginUsed ?? (p.position as any)?.marginUsedUsd ?? null,
        positionValue: (p.position as any)?.positionValue ?? (p.position as any)?.position_value ?? null,
        maxLeverage: (p.position as any)?.maxLeverage ?? null,
        marginType,
        cumFunding,
      };
    }),
    perpAccountValueUsd,
    spotBalanceUsd,
    perpPositionsCount,
    spotPositionsCount,
    perpCrossAccountValueByDex,
    perpCrossMaintenanceMarginUsedByDex,
    perpWithdrawableByDex,
    perpInitialMarginAvailableByDex,
    accountAbstractionMode: abstractionMode,
    userDexAbstractionEnabled,
    spotUsdcBalanceUsd,
    spotUsdcHoldUsd,
    totalIsolatedMarginUsedUsd,
    totalCrossMaintenanceMarginUsedUsd,
    totalCrossInitialMarginUsedUsd,
    totalCrossPositionValueUsd,
    unifiedSpotTransferableUsd,
    restingLimitCoins: restingEntryLimitCoins(allOpenOrders as any[]),
  };
}

// ============================================================================
// Seamless Setup Types & Stepwise Execution Engine
// ============================================================================

export type SeamlessStepId = 'agent' | 'builderFee' | 'accountMode';

export interface SeamlessSetupStatus {
  /** Stored agent is approved + active on HL. */
  agent: boolean;
  /** Builder-fee cap approved for the active builder (network-scoped). */
  builderFee: boolean;
  /** Account is in a pooled (unified / portfolio-margin) mode. */
  accountMode: boolean;
  /** All three conditions satisfied — equivalent to `setupComplete`. */
  allComplete: boolean;
}

/**
 * Inspect chain + locally-stored state to determine which of the three
 * seamless-setup steps still require a signature. Safe to call repeatedly; it
 * performs no signing and no mutation.
 */
export async function inspectSeamlessSetupStatus(
  userAddress: Hex,
): Promise<SeamlessSetupStatus> {
  const state = await getHyperliquidTradingState(userAddress);
  const agent = state.isAgentActive;
  const accountMode = isPooledAccountMode(state.accountAbstractionMode);
  let builderFee = false;
  try {
    builderFee = await isBuilderFeeApproved(userAddress);
  } catch {
    // Couldn't determine (network/HL blip) → treat as not-approved so the step
    // is offered rather than silently skipped. A redundant re-approval is a
    // harmless no-op signature; a wrongly-skipped one would block orders.
    builderFee = false;
  }
  return {
    agent,
    builderFee,
    accountMode,
    allComplete: agent && builderFee && accountMode,
  };
}

export type SeamlessStepPhase = 'signing' | 'done';

/**
 * Run only the missing seamless-setup steps, one signature at a time.
 *
 * Resumable and idempotent: already-satisfied steps are skipped, so a user who
 * signed 1–2 of 3 and returned later completes only what remains. Throws if a
 * signature is rejected/fails — already-applied steps stay applied, and the next
 * run resumes from the first still-missing step.
 *
 * @param onStep       progress callback fired as each remaining step is signed.
 * @param isCancelled  cooperative-cancel check evaluated between steps; when it
 *                     returns true the run stops before the next signature
 *                     (a signature already handed to the wallet cannot be
 *                     recalled, but no further prompts are issued).
 */
function isUserRejectedWalletError(err: unknown): boolean {
  return isWalletUserRejectedRequest(err);
}

/**
 * Light on-chain check for one setup step. Avoids the full trading-state
 * fetch so we can poll while a WalletConnect promise is outstanding.
 */
async function isSeamlessStepSatisfied(userAddress: Hex, step: SeamlessStepId): Promise<boolean> {
  if (step === 'agent') {
    const agentAddress = await getStoredAgentAddress();
    if (!agentAddress) return false;
    const extras = await listHlExtraAgents(userAddress);
    return extras.some((a) => a.address.toLowerCase() === agentAddress.toLowerCase());
  }
  if (step === 'builderFee') {
    return isBuilderFeeApproved(userAddress);
  }
  const mode = await getUserAbstractionMode(userAddress).catch(() => null);
  return isPooledAccountMode(mode);
}

export type SeamlessSetupRunPhase = 'complete' | 'hl_confirm' | 'more_signatures';

type SeamlessSignWait = { via: 'sign' } | { via: 'onchain'; signPending: boolean };

/**
 * WalletConnect often never settles `eth_signTypedData_v4` after the user
 * leaves the wallet app — even when they signed and HL already applied it.
 * Race the local promise against `isLanded`, and time out shortly after
 * the app returns to the foreground so the UI cannot spin forever.
 */
function waitForWalletSignedAction(args: {
  sign: () => Promise<unknown>;
  isLanded: () => Promise<boolean>;
  isCancelled?: () => boolean;
  timeoutMs?: number;
  postForegroundGraceMs?: number;
}): Promise<SeamlessSignWait> {
  const timeoutMs = args.timeoutMs ?? 90_000;
  const postForegroundGraceMs = args.postForegroundGraceMs ?? 15_000;
  const startedAt = Date.now();
  const cancelled = () => args.isCancelled?.() === true;

  return new Promise<SeamlessSignWait>((resolve, reject) => {
    let settled = false;
    let signPending = true;
    let sawBackground = false;
    let foregroundedAt: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let unsubscribeVisibility: (() => void) | undefined;

    const cleanup = () => {
      if (intervalId != null) clearInterval(intervalId);
      unsubscribeVisibility?.();
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const signPromise = args.sign();
    void signPromise.then(
      () => {
        signPending = false;
        finish(() => resolve({ via: 'sign' }));
      },
      (err) => {
        signPending = false;
        if (settled) return;
        if (cancelled() || isUserRejectedWalletError(err)) {
          finish(() => reject(err));
          return;
        }
        void args.isLanded()
          .then((ok) => {
            if (ok) finish(() => resolve({ via: 'onchain', signPending: false }));
            else finish(() => reject(err));
          })
          .catch(() => finish(() => reject(err)));
      },
    );
    void signPromise.catch(() => undefined);

    const tryInspect = async () => {
      if (settled) return;
      if (cancelled()) {
        finish(() => reject(new Error('__setup_cancelled__')));
        return;
      }
      try {
        if (await args.isLanded()) {
          finish(() => resolve({ via: 'onchain', signPending }));
          return;
        }
      } catch {
        /* keep waiting */
      }
      const now = Date.now();
      if (now - startedAt >= timeoutMs) {
        finish(() => reject(new Error('__approve_timeout__')));
        return;
      }
      if (foregroundedAt != null && now - foregroundedAt >= postForegroundGraceMs) {
        finish(() => reject(new Error('__approve_timeout__')));
      }
    };

    intervalId = setInterval(() => { void tryInspect(); }, 2_000);
    unsubscribeVisibility = onVisibilityStateChange((visible) => {
      if (!visible) sawBackground = true;
      if (visible && sawBackground) {
        foregroundedAt = Date.now();
        void tryInspect();
      }
    });
  });
}

function waitForSeamlessSignature(args: {
  sign: () => Promise<unknown>;
  userAddress: Hex;
  step: SeamlessStepId;
  isCancelled: () => boolean;
  timeoutMs?: number;
  postForegroundGraceMs?: number;
}): Promise<SeamlessSignWait> {
  return waitForWalletSignedAction({
    sign: args.sign,
    isLanded: () => isSeamlessStepSatisfied(args.userAddress, args.step),
    isCancelled: args.isCancelled,
    timeoutMs: args.timeoutMs,
    postForegroundGraceMs: args.postForegroundGraceMs,
  });
}

export async function runSeamlessSetupStepwise(args: {
  userWalletProvider: Eip1193Provider;
  userAddress: Hex;
  onStep?: (step: SeamlessStepId, phase: SeamlessStepPhase) => void;
  isCancelled?: () => boolean;
  /** Total time to wait for HL to reflect the new state. Default 45s. */
  confirmTimeoutMs?: number;
}): Promise<{ confirmed: boolean; status: SeamlessSetupStatus; phase: SeamlessSetupRunPhase }> {
  const { userAddress } = args;
  const cancelled = () => args.isCancelled?.() === true;

  // Reuse the persisted agent key so a resumed setup approves the SAME agent
  // rather than orphaning a previously-approved one.
  const agent = await ensureAgentKey();

  let status = await inspectSeamlessSetupStatus(userAddress);
  const stopForMoreSignatures = async (): Promise<{
    confirmed: boolean;
    status: SeamlessSetupStatus;
    phase: SeamlessSetupRunPhase;
  }> => {
    const next = await inspectSeamlessSetupStatus(userAddress).catch(() => status);
    status = next;
    if (next.allComplete) {
      await markTradingSetupComplete().catch(() => { /* ignore storage errors */ });
      return { confirmed: true, status: next, phase: 'complete' };
    }
    return { confirmed: false, status: next, phase: 'more_signatures' };
  };
  if (status.allComplete) {
    await markTradingSetupComplete().catch(() => { /* ignore storage errors */ });
    return { confirmed: true, status, phase: 'complete' };
  }

  const runSignedStep = async (
    step: SeamlessStepId,
    sign: () => Promise<unknown>,
  ): Promise<'continue' | 'yield'> => {
    if (cancelled()) return 'yield';
    args.onStep?.(step, 'signing');
    let wait: SeamlessSignWait;
    try {
      wait = await waitForSeamlessSignature({
        sign,
        userAddress,
        step,
        isCancelled: cancelled,
      });
    } catch (err) {
      if (isUserRejectedWalletError(err) || cancelled()) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === '__setup_cancelled__') throw err;
      // Last look: the action may have landed while the wallet hung.
      if (await isSeamlessStepSatisfied(userAddress, step).catch(() => false)) {
        args.onStep?.(step, 'done');
        return 'yield';
      }
      throw err;
    }
    args.onStep?.(step, 'done');
    if (wait.via === 'onchain' && wait.signPending) {
      // WC request is still open — do not stack the next session_request.
      await new Promise((r) => setTimeout(r, 1_500));
      return 'yield';
    }
    await new Promise((r) => setTimeout(r, 1_200));
    return 'continue';
  };

  // 1) Authorize the agent (API wallet) for one-tap order placement.
  if (!status.agent) {
    if (cancelled()) return stopForMoreSignatures();
    const next = await runSignedStep('agent', () =>
      withUserSignedExchange(args.userWalletProvider, userAddress, (exchange) =>
        exchange.approveAgent({ agentAddress: agent.agentAddress, agentName: 'Anonymous Liquid' }),
      ),
    );
    if (next === 'yield') return stopForMoreSignatures();
  }

  // 2) Approve the builder-fee cap for the active builder address.
  // Re-inspect so a recovered agent step doesn't still look "pending".
  status = await inspectSeamlessSetupStatus(userAddress).catch(() => status);
  if (!status.builderFee) {
    if (cancelled()) return stopForMoreSignatures();
    const next = await runSignedStep('builderFee', () =>
      withUserSignedExchange(args.userWalletProvider, userAddress, (exchange) =>
        exchange.approveBuilderFee({
          builder: getBuilderAddress() as Hex,
          maxFeeRate: HL_BUILDER_MAX_FEE_RATE,
        }),
      ),
    );
    if (next === 'yield') return stopForMoreSignatures();
  }

  // 3) Move into HL's unified (pooled) account mode.
  status = await inspectSeamlessSetupStatus(userAddress).catch(() => status);
  if (!status.accountMode) {
    if (cancelled()) return stopForMoreSignatures();
    const next = await runSignedStep('accountMode', () =>
      withUserSignedExchange(args.userWalletProvider, userAddress, (exchange) =>
        (exchange as any).userSetAbstraction({
          user: userAddress,
          abstraction: 'unifiedAccount',
        }),
      ),
    );
    if (next === 'yield') return stopForMoreSignatures();
  }

  // Confirm the new state is observable on HL before declaring success — mirrors
  // the exact conditions that define `setupComplete` so a confirmed run can't be
  // downgraded into a later surprise re-prompt.
  const deadline = Date.now() + (args.confirmTimeoutMs ?? 45_000);
  let finalStatus = await inspectSeamlessSetupStatus(userAddress).catch(() => status);
  while (!finalStatus.allComplete && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    finalStatus = await inspectSeamlessSetupStatus(userAddress).catch(() => finalStatus);
  }
  if (finalStatus.allComplete) {
    await markTradingSetupComplete().catch(() => { /* ignore storage errors */ });
    return { confirmed: true, status: finalStatus, phase: 'complete' };
  }
  return { confirmed: false, status: finalStatus, phase: 'hl_confirm' };
}

export type HypertradeCryptoAsset = {
  coin: string;
  name: string;
  symbol: string;
  category: 'crypto';
  maxLeverage: number;
  szDecimals: number;
  markPx: string | null;
  prevDayPx: string | null;
  dayNtlVlm: string | null;
  openInterest: string | null;
  funding: string | null;
  change24h: number | null;
  isHip3: false;
  isSpotOnly?: boolean;
  hasSpot?: boolean;
  spotSymbol?: string | null;
  spotCtx?: {
    markPx?: string | number | null;
    midPx?: string | number | null;
    prevDayPx?: string | number | null;
    dayNtlVlm?: string | number | null;
  };
};

type RwaCategory =
  | 'stock'
  | 'commodity'
  | 'forex'
  | 'index'
  | 'other';

type RwaCatalogEntry = {
  name: string;
  symbol: string;
  category: RwaCategory;
  displayName?: string;
  isPreIpo?: boolean;
  dex?: string;
  preIpoBoundLow?: number;
  preIpoBoundHigh?: number;
  openInterestCapLabel?: string;
  preIpoMcapQuote?: boolean;
  isSpotOnly?: boolean;
  hlBaseCoin?: string;
};

export type HypertradeRwaAsset = {
  coin: string;
  name: string;
  symbol: string;
  uiSymbol?: string;
  category:
    | 'stock'
    | 'commodity'
    | 'forex'
    | 'index'
    | 'other';
  maxLeverage: number;
  szDecimals: number;
  markPx: string | null;
  prevDayPx: string | null;
  dayNtlVlm: string | null;
  openInterest: string | null;
  funding: string | null;
  change24h: number | null;
  isHip3: boolean;
  isSpotOnly?: boolean;
  isPreIpo?: boolean;
  dex?: string | null;
  preIpoBoundLow?: number | null;
  preIpoBoundHigh?: number | null;
  openInterestCapLabel?: string | null;
  preIpoMcapQuote?: boolean | null;
  hasSpot?: boolean;
  spotSymbol?: string | null;
  growthMode?: boolean | null;
  deployerFeeScale?: number | null;
  spotCtx?: {
    markPx?: string | number | null;
    midPx?: string | number | null;
    prevDayPx?: string | number | null;
    dayNtlVlm?: string | number | null;
  };
};

export const ASSET_METADATA: Record<string, RwaCatalogEntry> = {
  TSLA: { name: 'Tesla', symbol: 'TSLA', category: 'stock' },
  NVDA: { name: 'Nvidia', symbol: 'NVDA', category: 'stock' },
  AAPL: { name: 'Apple', symbol: 'AAPL', category: 'stock' },
  GOOGL: { name: 'Google', symbol: 'GOOGL', category: 'stock' },
  AMZN: { name: 'Amazon', symbol: 'AMZN', category: 'stock' },
  MSFT: { name: 'Microsoft', symbol: 'MSFT', category: 'stock' },
  META: { name: 'Meta', symbol: 'META', category: 'stock' },
  INTC: { name: 'Intel', symbol: 'INTC', category: 'stock' },
  AMD: { name: 'AMD', symbol: 'AMD', category: 'stock' },
  COIN: { name: 'Coinbase', symbol: 'COIN', category: 'stock' },
  HOOD: { name: 'Robinhood', symbol: 'HOOD', category: 'stock' },
  MSTR: { name: 'Strategy', symbol: 'MSTR', category: 'stock' },
  PURRDAT: { name: 'Purr', symbol: 'PURRDAT', category: 'stock' },
  PLTR: { name: 'Palantir', symbol: 'PLTR', category: 'stock' },
  ORCL: { name: 'Oracle', symbol: 'ORCL', category: 'stock' },
  BOT: { name: 'RoboStrategy Inc.', symbol: 'BOT', category: 'stock' },
  SKHY: { name: 'SK Hynix', symbol: 'SKHY', category: 'stock' },
  RIVN: { name: 'Rivian', symbol: 'RIVN', category: 'stock' },
  MU: { name: 'Micron', symbol: 'MU', category: 'stock' },
  BABA: { name: 'Alibaba', symbol: 'BABA', category: 'stock' },
  SNDK: { name: 'Sandisk', symbol: 'SNDK', category: 'stock' },

  ANTH: {
    name: 'Anthropic',
    symbol: 'ANTH',
    category: 'stock',
    isPreIpo: true,
    dex: 'io',
    preIpoBoundLow: 300,
    preIpoBoundHigh: 4200,
    openInterestCapLabel: '3M',
    preIpoMcapQuote: true,
  },

  CRCL: { name: 'Circle', symbol: 'CRCL', category: 'stock' },
  CRWV: { name: 'CoreWeave', symbol: 'CRWV', category: 'stock' },
  SPCX: { name: 'SpaceX', symbol: 'SPCX', category: 'stock' },
  CXMT: { name: 'ChangXin Technology', symbol: 'CXMT', category: 'stock' },
  UNITREE: { name: 'Unitree Technology', symbol: 'UNITREE', category: 'stock' },
  CBRS: { name: 'Cerebras', symbol: 'CBRS', category: 'stock' },
  IBM: { name: 'IBM', symbol: 'IBM', category: 'stock' },
  DELL: { name: 'Dell', symbol: 'DELL', category: 'stock' },
  AVGO: { name: 'Broadcom', symbol: 'AVGO', category: 'stock' },
  MRVL: { name: 'Marvell', symbol: 'MRVL', category: 'stock' },
  LLY: { name: 'Eli Lilly', symbol: 'LLY', category: 'stock' },
  GME: { name: 'GameStop', symbol: 'GME', category: 'stock' },
  NFLX: { name: 'Netflix', symbol: 'NFLX', category: 'stock' },
  TSM: { name: 'TSM', symbol: 'TSM', category: 'stock' },
  LITE: { name: 'Lumentum Holdings', symbol: 'LITE', category: 'stock' },
  MRNA: { name: 'Moderna', symbol: 'MRNA', category: 'stock' },
  SMSN: { name: 'Samsung', symbol: 'SMSN', category: 'stock' },

  EUR: { name: 'Euro', symbol: 'EUR', category: 'forex' },
  JPY: { name: 'Japanese Yen', symbol: 'JPY', category: 'forex' },

  GOLD: { name: 'Gold', symbol: 'GOLD', category: 'commodity' },
  SILVER: { name: 'Silver', symbol: 'SILVER', category: 'commodity' },
  PLATINUM: { name: 'Platinum', symbol: 'PLATINUM', category: 'commodity' },
  PALLADIUM: { name: 'Palladium', symbol: 'PALLADIUM', category: 'commodity' },
  COPPER: { name: 'Copper', symbol: 'COPPER', category: 'commodity' },

  CL: {
    name: 'Crude Oil',
    symbol: 'OIL',
    displayName: 'OIL',
    category: 'commodity',
  },

  BZ: {
    name: 'Brent Oil',
    symbol: 'BRENTOIL',
    displayName: 'BRENTOIL',
    category: 'commodity',
  },

  NATGAS: { name: 'Natural Gas', symbol: 'NATGAS', category: 'commodity' },
  URNM: { name: 'Uranium', symbol: 'URNM', category: 'commodity' },

  GOLDSPOT: {
    name: 'Gold Spot',
    symbol: 'GOLDSPOT',
    category: 'commodity',
    isSpotOnly: true,
    hlBaseCoin: 'XAUT',
  },

  XYZ100: {
    name: 'Nasdaq 100',
    symbol: 'XYZ100',
    displayName: 'NDX100',
    category: 'index',
  },

  SP500: {
    name: 'S&P 500',
    symbol: 'SP500',
    displayName: 'SP500',
    category: 'index',
  },

  EWY: {
    name: 'iShares South Korea ETF',
    symbol: 'EWY',
    displayName: 'EWY',
    category: 'index',
  },

  DRAM: {
    name: 'Roundhill Memory ETF',
    symbol: 'DRAM',
    displayName: 'DRAM',
    category: 'index',
  },
};

type CryptoCatalogEntry = {
  name: string;
  symbol: string;
  category: 'crypto';
  isSpotOnly?: boolean;
  hlBaseCoin?: string;
};

export const CRYPTO_METADATA: Record<string, CryptoCatalogEntry> = {
  BTC: { name: 'Bitcoin', symbol: 'BTC', category: 'crypto' },
  ETH: { name: 'Ethereum', symbol: 'ETH', category: 'crypto' },
  SOL: { name: 'Solana', symbol: 'SOL', category: 'crypto' },
  XRP: { name: 'XRP', symbol: 'XRP', category: 'crypto' },
  ZEC: { name: 'Zcash', symbol: 'ZEC', category: 'crypto' },
  HYPE: { name: 'Hyperliquid', symbol: 'HYPE', category: 'crypto' },
  LIT: { name: 'Lighter', symbol: 'LIT', category: 'crypto' },
  BNB: { name: 'Binance', symbol: 'BNB', category: 'crypto' },
  LINK: { name: 'Chainlink', symbol: 'LINK', category: 'crypto' },
  AAVE: { name: 'Aave', symbol: 'AAVE', category: 'crypto' },
  NEAR: { name: 'Near', symbol: 'NEAR', category: 'crypto' },
  ARB: { name: 'Arbitrum', symbol: 'ARB', category: 'crypto' },
  JUP: { name: 'Jupiter', symbol: 'JUP', category: 'crypto' },
  JTO: { name: 'Jito', symbol: 'JTO', category: 'crypto' },
  PYTH: { name: 'Pyth', symbol: 'PYTH', category: 'crypto' },
  PUMP: { name: 'Pump Fun', symbol: 'PUMP', category: 'crypto' },
  SUI: { name: 'Sui', symbol: 'SUI', category: 'crypto' },
  KNTQ: {
    name: 'Kinetiq',
    symbol: 'KNTQ',
    category: 'crypto',
    isSpotOnly: true,
  },
  XPL: { name: 'Plasma', symbol: 'XPL', category: 'crypto' },
  XMR: { name: 'Monero', symbol: 'XMR', category: 'crypto' },
  UNI: { name: 'Uniswap', symbol: 'UNI', category: 'crypto' },
  ONDO: { name: 'Ondo', symbol: 'ONDO', category: 'crypto' },
  GRAM: { name: 'Telegram', symbol: 'GRAM', category: 'crypto' },
  TRX: { name: 'Tron', symbol: 'TRX', category: 'crypto' },
  LTC: { name: 'Litecoin', symbol: 'LTC', category: 'crypto' },
  XLM: { name: 'Stellar', symbol: 'XLM', category: 'crypto' },
  HBAR: { name: 'Hedera', symbol: 'HBAR', category: 'crypto' },
  BCH: { name: 'Bitcoin Cash', symbol: 'BCH', category: 'crypto' },
  ADA: { name: 'Cardano', symbol: 'ADA', category: 'crypto' },
  AVAX: { name: 'Avalanche', symbol: 'AVAX', category: 'crypto' },
  ENA: { name: 'Ethena', symbol: 'ENA', category: 'crypto' },
  MON: { name: 'Monad', symbol: 'MON', category: 'crypto' },
  APT: { name: 'Aptos', symbol: 'APT', category: 'crypto' },
  WLFI: {
    name: 'World Liberty Financial',
    symbol: 'WLFI',
    category: 'crypto',
  },
  TAO: { name: 'Bittensor', symbol: 'TAO', category: 'crypto' },
  WLD: { name: 'Worldcoin', symbol: 'WLD', category: 'crypto' },
  ZRO: { name: 'LayerZero', symbol: 'ZRO', category: 'crypto' },
  VIRTUAL: {
    name: 'Virtual',
    symbol: 'VIRTUAL',
    category: 'crypto',
  },
  VVV: { name: 'Venice AI', symbol: 'VVV', category: 'crypto' },
  MEGA: { name: 'MegaETH', symbol: 'MEGA', category: 'crypto' },
  PONS: { name: 'Pons', symbol: 'PONS', category: 'crypto' },
  ASTER: { name: 'Aster', symbol: 'ASTER', category: 'crypto' },
  USDT: {
    name: 'USDT',
    symbol: 'USDT',
    category: 'crypto',
    isSpotOnly: true,
  },
};

const VERIFIED_SPOT_DISPLAY_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    /*
     * Verified Hyperliquid frontend / Unit remaps.
     *
     * LEFT:
     * raw HyperCore Spot token name
     *
     * RIGHT:
     * user-facing market ticker
     *
     * Trading must STILL use the real spotSymbol.
     */
    ONEAR: "NEAR",

    UBTC: "BTC",
    UETH: "ETH",
    USOL: "SOL",
    UZEC: "ZEC",

    UENA: "ENA",
    UMON: "MON",
    UXPL: "XPL",
    UAVAX: "AVAX",
    UVIRT: "VIRTUAL",

    UPUMP: "PUMP",
    UBONK: "BONK",
    UFART: "FARTCOIN",

    UDZ: "2Z",

    UUUSPX: "SPX",

    HPENGU: "PENGU",
  });

function normalizeSpotAliasKey(
  value: unknown,
): string {
  return String(
    value || "",
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      "",
    );
}

export const CRYPTO_COINS = Object.keys(CRYPTO_METADATA);

const CRYPTO_SPOT_ONLY = new Set(
  CRYPTO_COINS.filter(
    (coin) => CRYPTO_METADATA[coin]?.isSpotOnly === true,
  ),
);

function normalizeCoinKey(coin: string): string {
  return coin.trim().toUpperCase();
}

function getHlBaseCoin(coin: string): string {
  const meta = CRYPTO_METADATA[coin];
  return meta?.hlBaseCoin || coin;
}

function resolveSpotCoin(
  coin: string,
  universe: any[],
  tokens: any[],
): string | null {
  const key = normalizeCoinKey(coin);

  const names = new Map<string, string>();

  for (const u of universe) {
    const originalName = String(u?.name || '');
    names.set(originalName.toUpperCase(), originalName);
  }

  if (names.has(key)) {
    return names.get(key) || null;
  }

  const pair = `${key}/USDC`;

  if (names.has(pair)) {
    return names.get(pair) || null;
  }

  const prefixedPair = `U${key}/USDC`;

  if (names.has(prefixedPair)) {
    return names.get(prefixedPair) || null;
  }

  if (key.startsWith('U') && key.length > 1) {
    const unprefixedPair = `${key.slice(1)}/USDC`;

    if (names.has(unprefixedPair)) {
      return names.get(unprefixedPair) || null;
    }
  }

  const usdcToken = tokens.find(
    (t) => String(t?.name || '').toUpperCase() === 'USDC',
  );

  const usdcIdx = usdcToken?.index;

  const candidates =
    key.startsWith('U') && key.length > 1
      ? [key, key.slice(1)]
      : [`U${key}`, key];

  for (const name of candidates) {
    const token = tokens.find(
      (t) => String(t?.name || '').toUpperCase() === name,
    );

    if (token !== undefined && usdcIdx !== undefined) {
      for (const u of universe) {
        const toks = Array.isArray(u?.tokens) ? u.tokens : [];

        if (
          toks.length >= 2 &&
          toks[0] === token?.index &&
          toks[1] === usdcIdx
        ) {
          return u?.name || null;
        }
      }
    }
  }

  for (const name of candidates) {
    const token = tokens.find((t) => {
      const tokenName = String(t?.name || '').toUpperCase();

      return (
        tokenName.startsWith(name) &&
        tokenName.length <= name.length + 1
      );
    });

    if (token !== undefined && usdcIdx !== undefined) {
      for (const u of universe) {
        const toks = Array.isArray(u?.tokens) ? u.tokens : [];

        if (
          toks.length >= 2 &&
          toks[0] === token?.index &&
          toks[1] === usdcIdx
        ) {
          return u?.name || null;
        }
      }
    }
  }

  return null;
}

function calculateSourceChange24h(
  markPx: any,
  prevDayPx: any,
): number | null {
  if (markPx && prevDayPx) {
    const current = Number(markPx);
    const previous = Number(prevDayPx);

    if (
      Number.isFinite(current) &&
      Number.isFinite(previous) &&
      previous > 0
    ) {
      return ((current - previous) / previous) * 100;
    }
  }

  return null;
}

export async function getCryptoAssetsFromHyperliquid(): Promise<{
  assets: HypertradeCryptoAsset[];
  count: number;
}> {
  const [
    perpData,
    spotData,
  ] = await Promise.all([
    getMainPerpMetaAndAssetCtxsCached(),
    getSpotMetaAndAssetCtxsCached()
      .catch(() => null),
  ]);

  if (
    !Array.isArray(perpData) ||
    perpData.length < 2
  ) {
    return {
      assets: [],
      count: 0,
    };
  }

  const perpMeta =
    perpData[0] || {};

  const perpCtxs =
    Array.isArray(perpData[1])
      ? perpData[1]
      : [];

  const perpUniverse =
    Array.isArray(
      perpMeta?.universe
    )
      ? perpMeta.universe
      : [];

  const nativePerpNames =
    new Set(
      perpUniverse
        .map((entry: any) =>
          String(
            entry?.name || ""
          )
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    );

  const catalogByHlBase =
    new Map<
      string,
      CryptoCatalogEntry
    >();

  for (
    const [
      key,
      meta,
    ] of Object.entries(
      CRYPTO_METADATA
    )
  ) {
    catalogByHlBase.set(
      String(
        meta.hlBaseCoin ||
          key
      )
        .trim()
        .toUpperCase(),
      meta
    );
  }

  const catalogByFriendlyName =
    new Map<
      string,
      CryptoCatalogEntry
    >();

  for (
    const [
      key,
      meta,
    ] of Object.entries(
      CRYPTO_METADATA
    )
  ) {
    const candidates = [
      key,
      meta.symbol,
      meta.name,
    ];

    for (
      const candidate
      of candidates
    ) {
      const normalized =
        normalizeSpotAliasKey(
          candidate,
        );

      if (normalized) {
        catalogByFriendlyName.set(
          normalized,
          meta,
        );
      }
    }
  }

  const resolveSpotDisplayIdentity = (
    baseToken: any,
    baseRaw: string,
  ): {
    displaySymbol: string;
    catalogMeta:
      CryptoCatalogEntry |
      undefined;
  } => {
    const raw =
      String(
        baseRaw || "",
      )
        .trim()
        .toUpperCase();

    /*
     * 1. Exact verified UI remaps have highest priority.
     */
    const verifiedAlias =
      VERIFIED_SPOT_DISPLAY_ALIASES[
        raw
      ];

    if (verifiedAlias) {
      return {
        displaySymbol:
          verifiedAlias,

        catalogMeta:
          CRYPTO_METADATA[
            verifiedAlias
          ] ||
          catalogByFriendlyName.get(
            normalizeSpotAliasKey(
              verifiedAlias,
            ),
          ),
      };
    }

    /*
     * 2. Existing explicit source metadata.
     */
    const directCatalog =
      catalogByHlBase.get(
        raw,
      );

    if (directCatalog) {
      return {
        displaySymbol:
          String(
            directCatalog.symbol ||
              raw,
          )
            .trim()
            .toUpperCase(),

        catalogMeta:
          directCatalog,
      };
    }

    const fullName =
      String(
        baseToken?.fullName ||
          "",
      ).trim();

    /*
     * 3. HyperUnit / Unit Protocol assets.
     */
    if (
      /^Unit\s+/i.test(
        fullName,
      )
    ) {
      const underlyingName =
        fullName.replace(
          /^Unit\s+/i,
          "",
        );

      const normalizedUnderlying =
        normalizeSpotAliasKey(
          underlyingName,
        );

      const friendlyCatalog =
        catalogByFriendlyName.get(
          normalizedUnderlying,
        );

      if (friendlyCatalog) {
        return {
          displaySymbol:
            String(
              friendlyCatalog.symbol,
            )
              .trim()
              .toUpperCase(),

          catalogMeta:
            friendlyCatalog,
        };
      }

      if (
        nativePerpNames.has(
          normalizedUnderlying,
        )
      ) {
        return {
          displaySymbol:
            normalizedUnderlying,

          catalogMeta:
            CRYPTO_METADATA[
              normalizedUnderlying
            ],
        };
      }

      /*
       * Permissionless future Unit assets:
       * remove exactly ONE wrapper U prefix.
       */
      if (
        raw.startsWith("U") &&
        raw.length > 1
      ) {
        const unwrapped =
          raw.slice(1);

        if (unwrapped) {
          return {
            displaySymbol:
              unwrapped,

            catalogMeta:
              CRYPTO_METADATA[
                unwrapped
              ] ||
              catalogByFriendlyName.get(
                normalizeSpotAliasKey(
                  unwrapped,
                ),
              ),
          };
        }
      }
    }

    /*
     * 4. Keep unrelated permissionless Spot
     * tickers exactly as deployed.
     */
    return {
      displaySymbol:
        raw,

      catalogMeta:
        CRYPTO_METADATA[
          raw
        ],
    };
  };

  type SpotDiscovered = {
    displaySymbol: string;
    baseRaw: string;
    name: string;
    spotSymbol: string;
    markPx: string | null;
    midPx: string | null;
    prevDayPx: string | null;
    dayNtlVlm: string | null;
    szDecimals: number;
    canonical: boolean;
    index: number;
  };

  const spots =
    new Map<
      string,
      SpotDiscovered
    >();

  if (
    Array.isArray(spotData) &&
    spotData.length >= 2
  ) {
    const spotMeta =
      spotData[0] || {};

    const universe =
      Array.isArray(
        spotMeta?.universe
      )
        ? spotMeta.universe
        : [];

    const tokens =
      Array.isArray(
        spotMeta?.tokens
      )
        ? spotMeta.tokens
        : [];

    const ctxs =
      Array.isArray(
        spotData[1]
      )
        ? spotData[1]
        : [];

    // Lookup live context by exact market identity before mapping Spot tickers.
    const spotCtxByCoin = new Map<string, any>();
    for (const spotCtx of ctxs) {
      const ctxCoin = String(spotCtx?.coin ?? "").trim().toUpperCase();
      if (ctxCoin) spotCtxByCoin.set(ctxCoin, spotCtx);
    }

    const reservedRwaSpotBases =
      new Set<string>();

    for (
      const [
        key,
        meta,
      ] of Object.entries(
        ASSET_METADATA
      )
    ) {
      if (
        meta.isSpotOnly !==
        true
      ) {
        continue;
      }

      const realBase =
        String(
          meta.hlBaseCoin ||
            key
        )
          .trim()
          .toUpperCase();

      if (realBase) {
        reservedRwaSpotBases.add(
          realBase
        );
      }
    }

    const tokenByIndex =
      new Map<number, any>();

    for (
      const token
      of tokens
    ) {
      const index =
        Number(
          token?.index
        );

      if (
        Number.isFinite(
          index
        )
      ) {
        tokenByIndex.set(
          index,
          token
        );
      }
    }

    for (
      let i = 0;
      i < universe.length;
      i += 1
    ) {
      const market =
        universe[i] || {};

      const pairTokens =
        Array.isArray(
          market?.tokens
        )
          ? market.tokens
          : [];

      if (
        pairTokens.length <
        2
      ) {
        continue;
      }

      const baseToken =
        tokenByIndex.get(
          Number(
            pairTokens[0]
          )
        );

      const quoteToken =
        tokenByIndex.get(
          Number(
            pairTokens[1]
          )
        );

      if (
        !baseToken ||
        !quoteToken
      ) {
        continue;
      }

      const quote =
        String(
          quoteToken?.name ||
            ""
        )
          .trim()
          .toUpperCase();

      /*
       * Existing Anonymous Liquid Spot order/balance flow
       * is USDC based.
       *
       * Never fake another quote token as USDC.
       */
      if (
        quote !== "USDC"
      ) {
        continue;
      }

      const baseRaw =
        String(
          baseToken?.name ||
            ""
        )
          .trim()
          .toUpperCase();

      if (!baseRaw) {
        continue;
      }

      if (
        reservedRwaSpotBases.has(
          baseRaw
        )
      ) {
        /*
         * This real Spot market is already represented
         * by an explicit ASSET_METADATA Spot alias
         * such as GOLDSPOT -> XAUT.
         *
         * Let getRwaAssetsFromHyperliquid own that row.
         * Do not create a second crypto Spot-only row.
         */
        continue;
      }

      const {
        displaySymbol:
          resolvedDisplaySymbol,

        catalogMeta:
          resolvedCatalog,
      } =
        resolveSpotDisplayIdentity(
          baseToken,
          baseRaw,
        );

      const displaySymbol =
        String(
          resolvedDisplaySymbol ||
            baseRaw,
        )
          .trim()
          .toUpperCase();

      const known =
        resolvedCatalog;

      const spotSymbol =
        String(
          market?.name ||
            ""
        ).trim();

      if (!spotSymbol) {
        continue;
      }

      const marketIndexRaw = Number(market?.index);
      const marketIndex =
        Number.isInteger(marketIndexRaw) && marketIndexRaw >= 0
          ? marketIndexRaw
          : i;
      const ctx = getSpotContextForMarket(market, i, ctxs, spotCtxByCoin);

      const szRaw =
        Number(
          baseToken
            ?.szDecimals
        );

      const discovered:
        SpotDiscovered = {
          displaySymbol,
          baseRaw,

          name:
            known?.name ||
            String(
              baseToken
                ?.fullName ||
                ""
            ).trim() ||
            displaySymbol,

          spotSymbol,

          markPx:
            ctx?.markPx ??
            null,

          midPx:
            ctx?.midPx ??
            null,

          prevDayPx:
            ctx?.prevDayPx ??
            null,

          dayNtlVlm:
            ctx?.dayNtlVlm ??
            null,

          szDecimals:
            Number.isFinite(
              szRaw
            )
              ? szRaw
              : 0,

          canonical:
            market
              ?.isCanonical ===
            true,

          index:
            marketIndex,
        };

      const existing =
        spots.get(
          displaySymbol
        );

      if (
        !existing ||
        (
          discovered
            .canonical &&
          !existing
            .canonical
        ) ||
        (
          discovered
            .canonical ===
            existing
              .canonical &&
          discovered.index <
            existing.index
        )
      ) {
        spots.set(
          displaySymbol,
          discovered
        );
      }
    }
  }

  const assets:
    HypertradeCryptoAsset[] =
    [];

  const perpSymbols =
    new Set<string>();

  /*
   * EVERY native Hyperliquid perp.
   * NO CRYPTO_METADATA whitelist.
   */
  for (
    let i = 0;
    i <
    perpUniverse.length;
    i += 1
  ) {
    const raw =
      perpUniverse[i] || {};

    const coin =
      String(
        raw?.name || ""
      ).trim();

    if (!coin) {
      continue;
    }

    const known =
      CRYPTO_METADATA[
        coin.toUpperCase()
      ];

    const symbol =
      String(
        known?.symbol ||
          coin
      )
        .trim()
        .toUpperCase();

    const ctx =
      perpCtxs[i] || {};

    const maxLev =
      Number(
        raw?.maxLeverage
      );

    const decimals =
      Number(
        raw?.szDecimals
      );

    const entry:
      HypertradeCryptoAsset = {
        coin,

        name:
          known?.name ||
          symbol,

        symbol,

        category:
          "crypto",

        maxLeverage:
          Number.isFinite(
            maxLev
          ) &&
          maxLev > 0
            ? maxLev
            : 1,

        szDecimals:
          Number.isFinite(
            decimals
          ) &&
          decimals >= 0
            ? decimals
            : 0,

        markPx:
          ctx?.markPx ??
          null,

        prevDayPx:
          ctx?.prevDayPx ??
          null,

        dayNtlVlm:
          ctx?.dayNtlVlm ??
          null,

        openInterest:
          ctx?.openInterest ??
          null,

        funding:
          ctx?.funding ??
          null,

        change24h:
          calculateSourceChange24h(
            ctx?.markPx,
            ctx?.prevDayPx
          ),

        isHip3:
          false,
      };

    const spot =
      spots.get(
        symbol
      );

    if (spot) {
      entry.hasSpot =
        true;

      entry.spotSymbol =
        spot.spotSymbol;

      entry.spotCtx = {
        markPx:
          spot.markPx,

        midPx:
          spot.midPx,

        prevDayPx:
          spot.prevDayPx,

        dayNtlVlm:
          spot.dayNtlVlm,
      };
    }

    perpSymbols.add(
      symbol
    );

    assets.push(
      entry
    );
  }

  /*
   * EVERY real USDC Spot market which does not have a
   * corresponding native perp becomes Spot-only.
   */
  for (
    const [
      symbol,
      spot,
    ] of spots
  ) {
    if (
      perpSymbols.has(
        symbol
      )
    ) {
      continue;
    }

    assets.push({
      coin:
        symbol,

      name:
        spot.name,

      symbol,

      category:
        "crypto",

      maxLeverage:
        1,

      szDecimals:
        spot.szDecimals,

      markPx:
        spot.markPx,

      prevDayPx:
        spot.prevDayPx,

      dayNtlVlm:
        spot.dayNtlVlm,

      openInterest:
        null,

      funding:
        null,

      change24h:
        calculateSourceChange24h(
          spot.markPx,
          spot.prevDayPx
        ),

      isHip3:
        false,

      isSpotOnly:
        true,

      hasSpot:
        true,

      spotSymbol:
        spot.spotSymbol,

      spotCtx: {
        markPx:
          spot.markPx,

        midPx:
          spot.midPx,

        prevDayPx:
          spot.prevDayPx,

        dayNtlVlm:
          spot.dayNtlVlm,
      },
    });
  }

  return {
    assets,
    count:
      assets.length,
  };
}

function rwaMetaDex(
  meta: RwaCatalogEntry,
): string {
  return String(
    meta.dex || 'xyz'
  ).toLowerCase();
}

function lookupRwaMetadata(
  symbol: string,
  dexName: string,
): {
  key: string | null;
  meta: RwaCatalogEntry | null;
} {
  const dex =
    String(dexName || '')
      .toLowerCase();

  const symbolUpper =
    String(symbol || '')
      .toUpperCase();

  if (!symbolUpper) {
    return {
      key: null,
      meta: null,
    };
  }

  for (
    const [key, meta]
    of Object.entries(
      ASSET_METADATA
    )
  ) {
    if (
      rwaMetaDex(meta) !== dex
    ) {
      continue;
    }

    const apiSymbol =
      String(
        meta.symbol || key
      );

    if (
      apiSymbol.toUpperCase() ===
        symbolUpper ||
      key.toUpperCase() ===
        symbolUpper
    ) {
      return {
        key,
        meta,
      };
    }
  }

  return {
    key: null,
    meta: null,
  };
}

function normalizeRwaGrowthMode(
  value: any,
): boolean | null {
  if (value == null) {
    return null;
  }

  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    typeof value === 'string'
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized === 'enabled' ||
      normalized === 'true' ||
      normalized === '1'
    ) {
      return true;
    }

    if (
      normalized === 'disabled' ||
      normalized === 'false' ||
      normalized === '0' ||
      normalized === ''
    ) {
      return false;
    }

    return null;
  }

  return Boolean(value);
}

function normalizeRwaDeployerFeeScale(
  value: any,
): number | null {
  if (
    value == null ||
    value === ''
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

export async function getRwaAssetsFromHyperliquid(): Promise<{
  assets: HypertradeRwaAsset[];
  count: number;
}> {
  const assets:
    HypertradeRwaAsset[] = [];

  const [
    perpDexRows,
    mainPerpDataForDedup,
    sharedSpotData,
  ] = await Promise.all([
    getPerpDexsCached()
      .catch(() => []),

    getMainPerpMetaAndAssetCtxsCached()
      .catch(() => null),

    getSpotMetaAndAssetCtxsCached()
      .catch(() => null),
  ]);

  const sharedSpotMeta =
    Array.isArray(
      sharedSpotData,
    ) &&
    sharedSpotData.length >= 1
      ? sharedSpotData[0] || {}
      : {};

  const sharedSpotTokens =
    Array.isArray(
      sharedSpotMeta?.tokens,
    )
      ? sharedSpotMeta.tokens
      : [];

  const usdcSpotToken =
    sharedSpotTokens.find(
      (token: any) =>
        String(
          token?.name || "",
        )
          .trim()
          .toUpperCase() ===
        "USDC",
    );

  const usdcCollateralTokenIndex =
    Number(
      usdcSpotToken?.index,
    );

  const hasVerifiedUsdcCollateralIndex =
    Number.isFinite(
      usdcCollateralTokenIndex,
    );

  const mainPerpMetaForDedup =
    Array.isArray(
      mainPerpDataForDedup,
    ) &&
    mainPerpDataForDedup.length >= 1
      ? mainPerpDataForDedup[0] || {}
      : {};

  const mainPerpUniverseForDedup =
    Array.isArray(
      mainPerpMetaForDedup?.universe,
    )
      ? mainPerpMetaForDedup.universe
      : [];

  const nativePerpDisplaySymbols =
    new Set<string>(
      mainPerpUniverseForDedup
        .map(
          (entry: any) => {
            const raw =
              String(
                entry?.name || "",
              )
                .trim()
                .toUpperCase();

            if (!raw) {
              return "";
            }

            return String(
              CRYPTO_METADATA[
                raw
              ]?.symbol ||
                raw,
            )
              .trim()
              .toUpperCase();
          },
        )
        .filter(Boolean),
    );

  const discoveredDexNames =
    Array.from(
      new Set(
        (
          Array.isArray(
            perpDexRows
          )
            ? perpDexRows
            : []
        )
          .map(
            (row: any) =>
              String(
                row?.name || "",
              )
                .trim()
                .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

  const dexNames =
    discoveredDexNames.length > 0
      ? discoveredDexNames
      : enabledHip3Dexes();

  for (
    const dexName
    of dexNames
  ) {
    try {
      const response =
        await hlInfoFetch({
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify({
              type:
                'metaAndAssetCtxs',
              dex:
                dexName,
            }),
        });

      if (!response.ok) {
        continue;
      }

      const data =
        await response.json();

      if (
        !Array.isArray(data) ||
        data.length < 2
      ) {
        continue;
      }

      const meta =
        data[0] || {};

      const dexCollateralTokenIndex =
        Number(
          meta?.collateralToken,
        );

      if (
        !hasVerifiedUsdcCollateralIndex ||
        !Number.isFinite(
          dexCollateralTokenIndex,
        ) ||
        dexCollateralTokenIndex !==
          usdcCollateralTokenIndex
      ) {
        continue;
      }

      const assetCtxs =
        Array.isArray(data[1])
          ? data[1]
          : [];

      const universe =
        Array.isArray(
          meta?.universe
        )
          ? meta.universe
          : [];

      for (
        let i = 0;
        i < universe.length;
        i += 1
      ) {
        const asset =
          universe[i] || {};

        const coinName =
          String(
            asset?.name || ''
          );

        const symbol =
          coinName.includes(':')
            ? coinName
                .split(':')
                .pop() || ''
            : coinName;

        const {
          key: displayKey,
          meta: metaInfo,
        } =
          lookupRwaMetadata(
            symbol,
            dexName,
          );

        const displaySymbol =
          String(
            metaInfo?.displayName ||
            displayKey ||
            symbol
          )
            .trim()
            .toUpperCase();

        // Skip if this display symbol is already a native Hyperliquid perp
        if (
          nativePerpDisplaySymbols.has(
            displaySymbol,
          )
        ) {
          continue;
        }

        const ctx =
          i < assetCtxs.length
            ? assetCtxs[i] || {}
            : {};

        const displayName =
          metaInfo?.name ||
          displaySymbol;

        const category:
          RwaCategory =
          metaInfo?.category ||
          "other";

        const uiSymbol =
          metaInfo
            ? displaySymbol
            : coinName;

        const markPx =
          ctx?.markPx ?? null;

        const prevDayPx =
          ctx?.prevDayPx ?? null;

        assets.push({
          coin:
            coinName,
          name:
            displayName,
          symbol:
            displaySymbol,
          uiSymbol,
          category,
          maxLeverage:
            asset?.maxLeverage ??
            1,
          szDecimals:
            asset?.szDecimals ??
            2,
          markPx,
          prevDayPx,
          dayNtlVlm:
            ctx?.dayNtlVlm ??
            null,
          openInterest:
            ctx?.openInterest ??
            null,
          funding:
            ctx?.funding ??
            null,
          change24h:
            calculateSourceChange24h(
              markPx,
              prevDayPx,
            ),
          isHip3:
            true,
          isPreIpo:
            metaInfo?.isPreIpo ===
            true,
          dex:
            dexName,
          growthMode:
            normalizeRwaGrowthMode(
              asset?.growthMode,
            ),
          deployerFeeScale:
            normalizeRwaDeployerFeeScale(
              asset
                ?.deployerFeeScale,
            ),
          preIpoBoundLow:
            metaInfo
              ?.preIpoBoundLow ??
            null,
          preIpoBoundHigh:
            metaInfo
              ?.preIpoBoundHigh ??
            null,
          openInterestCapLabel:
            metaInfo
              ?.openInterestCapLabel ??
            null,
          preIpoMcapQuote:
            metaInfo
              ?.preIpoMcapQuote ??
            null,
        });
      }
    } catch {
      continue;
    }
  }

  const spotOnlyAssets =
    Object.entries(
      ASSET_METADATA
    )
      .filter(
        ([, meta]) =>
          meta.isSpotOnly ===
          true,
      );

  if (
    spotOnlyAssets.length > 0
  ) {
    try {
      const spotData =
        sharedSpotData;

      if (
        Array.isArray(spotData) &&
        spotData.length >= 2
      ) {
        const spotMeta =
          spotData[0] || {};

        const spotCtxs =
          Array.isArray(
            spotData[1]
          )
            ? spotData[1]
            : [];

        const spotUniverse =
          Array.isArray(
            spotMeta?.universe
          )
            ? spotMeta.universe
            : [];

        const spotTokens =
          Array.isArray(
            spotMeta?.tokens
          )
            ? spotMeta.tokens
            : [];

        for (
          const [
            spotOnlyCoin,
            metaInfo,
          ]
          of spotOnlyAssets
        ) {
          const spotName =
            resolveSpotCoin(
              metaInfo
                .hlBaseCoin ||
                spotOnlyCoin,
              spotUniverse,
              spotTokens,
            );

          if (!spotName) {
            continue;
          }

          const spotIndex = spotUniverse.findIndex(
            (u: any) => String(u?.name || "").toUpperCase() === spotName.toUpperCase(),
          );
          if (spotIndex < 0) continue;
          const spotEntry = spotUniverse[spotIndex] || {};
          // Same exact USDC market context as the trading terminal.
          const ctx = getSpotContextForMarket(spotEntry, spotIndex, spotCtxs);

          const markPx =
            ctx?.markPx ?? null;

          const prevDayPx =
            ctx?.prevDayPx ??
            null;

          assets.push({
            coin:
              spotOnlyCoin,
            name:
              metaInfo.name,
            symbol:
              metaInfo
                .displayName ||
              metaInfo.symbol,
            category:
              metaInfo.category,
            maxLeverage:
              1,
            szDecimals:
              spotEntry
                ?.szDecimals ??
              2,
            markPx,
            prevDayPx,
            dayNtlVlm:
              ctx?.dayNtlVlm ??
              null,
            openInterest:
              null,
            funding:
              null,
            change24h:
              calculateSourceChange24h(
                markPx,
                prevDayPx,
              ),
            isHip3:
              false,
            isSpotOnly:
              true,
            hasSpot:
              true,
            spotSymbol:
              spotName,
            spotCtx: {
              markPx,
              midPx: ctx?.midPx ?? null,
              prevDayPx,
              dayNtlVlm:
                ctx?.dayNtlVlm ??
                null,
            },
          });
        }
      }
    } catch {
      // No fake spot fallback.
    }
  }

  const uniqueAssets =
    new Map<
      string,
      HypertradeRwaAsset
    >();

  const numericVolume = (
    value: string | null,
  ): number => {
    const parsed =
      Number(value);

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : -1;
  };

  for (
    const asset
    of assets
  ) {
    const isSpotOnly =
      asset.isSpotOnly ===
      true;

    const key =
      isSpotOnly
        ? `spot:${String(
            asset.coin || "",
          )
            .trim()
            .toLowerCase()}`
        : `perp:${String(
            asset.symbol || "",
          )
            .trim()
            .toUpperCase()}`;

    if (!key) {
      continue;
    }

    const existing =
      uniqueAssets.get(
        key,
      );

    if (!existing) {
      uniqueAssets.set(
        key,
        asset,
      );
      continue;
    }

    if (isSpotOnly) {
      continue;
    }

    if (
      numericVolume(
        asset.dayNtlVlm,
      ) >
      numericVolume(
        existing.dayNtlVlm,
      )
    ) {
      uniqueAssets.set(
        key,
        asset,
      );
    }
  }

  const result =
    Array.from(
      uniqueAssets.values(),
    );

  return {
    assets:
      result,

    count:
      result.length,
  };
}

