/**
 * HideDex Lighter mainnet signed execution.
 * The signing key is session-memory only; never put it in URLs, localStorage,
 * sessionStorage, logs, analytics, backend requests, or cross-venue code.
 * The pinned browser SDK packages Go's Lighter signer WASM. It is an
 * independent TypeScript wrapper, not an endorsement by Lighter.
 */
import { BrowserProvider, getAddress } from "ethers";
import {
  initLighterSigner, LighterClient, LighterOnboarding, LighterHelper,
  type LighterSignerContext, type LighterActiveOrder,
} from "@hitesh23k/lighter-sdk/browser";
import wasmUrl from "@hitesh23k/lighter-sdk/lighterSigner.wasm?url";
import wasmExecUrl from "@hitesh23k/lighter-sdk/wasm_exec.js?url";
import { getLighterAccountIndexes, getLighterPublicAccounts, getLighterMarkets, type LighterMarket } from "./lighterMarketData";
import type { LighterWalletProvider } from "./lighterFunding";

type Session = {
  address: string;
  signer: LighterSignerContext;
  client: LighterClient;
};
export type LighterTradingIdentity = {
  walletAddress: string;
  accountIndex: number;
  apiKeyIndex: number;
};

let session: Session | null = null;
let initialized = false;
let writeBusy = false;

function init(): void {
  if (initialized) return;
  initLighterSigner({ wasmUrl, wasmExecUrl });
  initialized = true;
}
function publicSession(s: Session): LighterTradingIdentity {
  return {
    walletAddress: s.address, accountIndex: s.signer.accountIndex,
    apiKeyIndex: s.signer.apiKeyIndex,
  };
}
function active(walletAddress: string): Session {
  const address = getAddress(walletAddress);
  if (!session || session.address !== address) {
    throw new Error("Connect and authorize your own Lighter trading key first.");
  }
  return session;
}
async function withWrite<T>(task: () => Promise<T>): Promise<T> {
  if (writeBusy) throw new Error("Wait for the preceding Lighter transaction to finish.");
  writeBusy = true;
  try { return await task(); } finally { writeBusy = false; }
}
function accepted(result: { code: number; message?: string; tx_hash?: string }): string {
  if (result.code !== 200 || !result.tx_hash || !/^(?:0x)?[0-9a-fA-F]{64}$/.test(result.tx_hash)) {
    throw new Error(result.message || "Lighter did not return an accepted transaction hash.");
  }
  return result.tx_hash;
}

export function getActiveLighterSigner(walletAddress: string): LighterTradingIdentity | null {
  if (!walletAddress || !session) return null;
  try { return session.address === getAddress(walletAddress) ? publicSession(session) : null; }
  catch { return null; }
}
export function clearLighterTradingKey(): void { session = null; }

export async function registerLighterTradingKey(args: {
  walletAddress: string;
  getWalletProvider: () => Promise<LighterWalletProvider>;
}): Promise<{ identity: LighterTradingIdentity; recoveryKey: string; txHash?: string }> {
  return withWrite(async () => {
    const address = getAddress(args.walletAddress);
    if (session && session.address === address) {
      throw new Error("This wallet has already authorized a key in this session.");
    }
    init();
    const wallet = await args.getWalletProvider();
    const provider = new BrowserProvider(wallet as any);
    const signer = await provider.getSigner();
    if (getAddress(await signer.getAddress()) !== address) {
      throw new Error("Connected wallet changed; trading-key registration cancelled.");
    }
    const onboarding = new LighterOnboarding({ venue: "zk", isMainnet: true });
    // A fresh API key uses a free slot 4..254, never a reserved desktop/mobile key.
    const registered = await onboarding.registerApiKey({
      l1Address: address,
      l1Sign: async (message) => {
        if (!message || typeof message !== "string") throw new Error("Missing wallet authorization message.");
        if (getAddress(await signer.getAddress()) !== address) throw new Error("Wallet changed.");
        return signer.signMessage(message);
      },
    });
    const ctx = registered.signer;
    if (!Number.isSafeInteger(ctx.accountIndex) || !Number.isSafeInteger(ctx.apiKeyIndex) ||
        ctx.apiKeyIndex < 4 || ctx.apiKeyIndex > 254) {
      throw new Error("Lighter returned an invalid trading-key authorization.");
    }
    const client = new LighterClient({ venue: "zk", isMainnet: true, signer: ctx, defaultSlippage: 0.02 });
    session = { address, signer: ctx, client };
    return { identity: publicSession(session), recoveryKey: ctx.apiPrivateKey, txHash: registered.txHash };
  });
}

/** Reconnect a previously authorized key without creating a new API-key slot. */
export async function reconnectLighterTradingKey(args: {
  walletAddress: string; accountIndex: number; apiKeyIndex: number; apiPrivateKey: string;
}): Promise<LighterTradingIdentity> {
  return withWrite(async () => {
    const address = getAddress(args.walletAddress);
    if (!Number.isSafeInteger(args.accountIndex) || args.accountIndex < 0 ||
        !Number.isSafeInteger(args.apiKeyIndex) || args.apiKeyIndex < 4 || args.apiKeyIndex > 254 ||
        !/^(0x)?[0-9a-fA-F]{1,128}$/.test(args.apiPrivateKey)) {
      throw new Error("Invalid existing Lighter API key or account/key index.");
    }
    init();
    const owned = await getLighterAccountIndexes(address);
    if (!owned.includes(args.accountIndex)) throw new Error("Lighter account does not belong to your connected wallet.");
    const ctx: LighterSignerContext = {
      apiPrivateKey: args.apiPrivateKey, accountIndex: args.accountIndex, apiKeyIndex: args.apiKeyIndex,
    };
    const onboard = new LighterOnboarding({ venue: "zk", isMainnet: true });
    if (!(await onboard.verifyApiKey(ctx))) throw new Error("Lighter rejected this key/account combination.");
    session = {
      address, signer: ctx, client: new LighterClient({
        venue: "zk", isMainnet: true, signer: ctx, defaultSlippage: 0.02,
      }),
    };
    return publicSession(session);
  });
}

/** Confirm registration has actually finalized before allowing signed actions. */
export async function verifyLighterTradingKey(walletAddress: string): Promise<boolean> {
  const s = active(walletAddress);
  init();
  return new LighterOnboarding({ venue: "zk", isMainnet: true }).verifyApiKey(s.signer);
}

function clientOrderIndex(): number {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const timestampBits = Date.now() % (2 ** 29);
  return timestampBits * (2 ** 19) + (random[0] % (2 ** 19));
}
function rawOrder(market: LighterMarket, coinSize: number, humanPrice: number): {
  baseAmount: bigint; price: number;
} {
  if (!Number.isFinite(coinSize) || coinSize <= 0 || !Number.isFinite(humanPrice) || humanPrice <= 0)
    throw new Error("Enter a positive order size and price.");
  if (!(market.multiplier > 0) || !Number.isSafeInteger(market.id) ||
      !Number.isInteger(market.sizeDecimals) || !Number.isInteger(market.priceDecimals) ||
      market.sizeDecimals < 0 || market.priceDecimals < 0 || market.sizeDecimals > 12 ||
      market.priceDecimals > 10) throw new Error("Unverified Lighter market scaling.");
  const rawSize = coinSize / market.multiplier;
  const rawPrice = humanPrice * market.multiplier;
  const baseAmount = LighterHelper.toBaseAmount(rawSize.toFixed(Math.min(market.sizeDecimals, 12)), market.sizeDecimals);
  const price = Number(LighterHelper.toPriceInt(rawPrice.toFixed(market.priceDecimals), market.priceDecimals));
  if (baseAmount <= 0n || baseAmount > 9223372036854775807n ||
      !Number.isSafeInteger(price) || price <= 0 || price > 4294967295)
    throw new Error("Size/price is outside Lighter's permitted integer range.");
  return { baseAmount, price };
}

export async function submitLighterOrder(args: {
  walletAddress: string; market: LighterMarket; side: "buy" | "sell";
  type: "market" | "limit"; coinSize: number; limitPrice?: number;
  referencePrice: number; reduceOnly?: boolean;
  takeProfit?: number; stopLoss?: number;
}): Promise<string> {
  return withWrite(async () => {
    const s = active(args.walletAddress);
    if (!(await verifyLighterTradingKey(args.walletAddress)))
      throw new Error("Trading key not yet registered by Lighter. Try again after confirmation.");
    const catalog = await getLighterMarkets();
    const fresh = catalog.find(m => m.id === args.market.id && m.kind === args.market.kind &&
      m.symbol === args.market.symbol);
    if (!fresh) throw new Error("Market identity changed; refresh before placing an order.");
    const signedPrice = args.type === "limit" ? Number(args.limitPrice) :
      args.side === "sell" ? args.referencePrice * 0.98 : args.referencePrice * 1.02;
    if (!(args.referencePrice > 0)) throw new Error("Live market reference price unavailable.");
    const { baseAmount, price } = rawOrder(fresh, args.coinSize, signedPrice);
    const minNotional = args.coinSize * args.referencePrice;
    if (!Number.isFinite(minNotional) || minNotional <= 0) throw new Error("Invalid order notional.");
    if (args.reduceOnly) {
      if (fresh.kind !== "perp" || args.takeProfit != null || args.stopLoss != null)
        throw new Error("Reduce Only is permitted only for individual Lighter perpetual close orders.");
      const [account] = await getLighterPublicAccounts([s.signer.accountIndex]);
      if (!account) throw new Error("Cannot verify position before reduce-only order.");
      const pos = account.positions.find(p => p.symbol === fresh.symbol);
      if (!pos || (args.side === "sell" && pos.signedSize <= 0) ||
          (args.side === "buy" && pos.signedSize >= 0) ||
          args.coinSize > Math.abs(pos.signedSize) + 1e-10)
        throw new Error("Reduce-only side/size does not match a verified open position.");
    }
    let tx: { code:number;message?:string;tx_hash?:string };
    if (args.takeProfit != null || args.stopLoss != null) {
      if (fresh.kind !== "perp" || args.reduceOnly)
        throw new Error("Native atomic TP/SL brackets are perpetual-entry only.");
      if (fresh.multiplier !== 1)
        throw new Error("This market uses multiplier scaling; native bracket orders cannot be verified.");
      const sdkMeta = (await s.client.markets()).find(m => m.marketId === fresh.id && m.symbol === fresh.symbol.toUpperCase());
      if (!sdkMeta || sdkMeta.priceDecimals !== fresh.priceDecimals || sdkMeta.sizeDecimals !== fresh.sizeDecimals)
        throw new Error("SDK market price/size metadata mismatch. No order submitted.");
      const tp = args.takeProfit, sl = args.stopLoss;
      if ((tp != null && (!Number.isFinite(tp) || tp <= 0 ||
          (args.side === "buy" ? tp <= args.referencePrice : tp >= args.referencePrice))) ||
          (sl != null && (!Number.isFinite(sl) || sl <= 0 ||
          (args.side === "buy" ? sl >= args.referencePrice : sl <= args.referencePrice))))
        throw new Error("Invalid TP/SL direction or trigger prices for this entry.");
      tx = await s.client.placeBracketOrder({
        symbol: fresh.symbol, side: args.side === "buy" ? "long" : "short",
        size: args.coinSize,
        entry: args.type === "limit" ? { type:"limit",price:Number(args.limitPrice) } :
          { type:"market",slippage:0.02 },
        takeProfit:tp,stopLoss:sl,applyIntegratorFee:false,
      },s.signer);
    } else {
      const params = {
        marketIndex: fresh.id, baseAmount, price, isAsk: args.side === "sell",
        clientOrderIndex: clientOrderIndex(), reduceOnly: Boolean(args.reduceOnly),
        applyIntegratorFee: false,
      };
      tx = args.type === "market"
        ? await s.client.rest.createMarketOrder(s.signer, params)
        : await s.client.rest.createLimitOrder(s.signer, {...params, timeInForce: "gtc" });
    }
    return accepted(tx);
  });
}

/** Authenticated read of genuine trades for only the active Lighter signer account. */
export async function getLighterSignedTradeHistory(walletAddress: string) {
  const s=active(walletAddress);
  if(!(await verifyLighterTradingKey(walletAddress)))
    throw new Error("Lighter API key must be verified before loading trade history.");
  if(!(await getLighterAccountIndexes(s.address)).includes(s.signer.accountIndex))
    throw new Error("Lighter account ownership could not be verified.");
  return {accountIndex:s.signer.accountIndex, trades:await s.client.rest.getAccountTrades(s.signer,{limit:50})};
}

export async function getLighterSignedOpenOrders(walletAddress: string): Promise<LighterActiveOrder[]> {
  const s = active(walletAddress);
  if (!(await verifyLighterTradingKey(walletAddress))) throw new Error("Lighter key registration pending.");
  return s.client.getOpenOrders();
}

export async function cancelLighterSignedOrder(args: {
  walletAddress: string; market: LighterMarket; orderIndex: number;
}): Promise<string> {
  return withWrite(async () => {
    const s = active(args.walletAddress);
    if (!Number.isSafeInteger(args.orderIndex) || args.orderIndex < 0) throw new Error("Invalid Lighter order index.");
    if (!(await verifyLighterTradingKey(args.walletAddress))) throw new Error("Lighter key registration pending.");
    const catalog = await getLighterMarkets();
    if (!catalog.some(m => m.id === args.market.id && m.kind === args.market.kind &&
      m.symbol === args.market.symbol))
      throw new Error("Market identity changed. Refresh before cancelling.");
    const activeOrders = await s.client.getOpenOrders();
    const target = activeOrders.find(o => Number(o.order_index) === args.orderIndex &&
      Number(o.market_index ?? o.market_id) === args.market.id);
    if (!target) throw new Error("This order is no longer open on your Lighter account.");
    const tx = await s.client.rest.cancelOrder(s.signer, {
      marketIndex: args.market.id, orderIndex: args.orderIndex,
    });
    return accepted(tx);
  });
}

/** Secure/standard withdrawal only: destination is the original verified L1 wallet. */
export async function withdrawLighterUsdc(args: {
  walletAddress: string; amount: string;
}): Promise<string> {
  return withWrite(async () => {
    const s = active(args.walletAddress);
    if (!/^(?:[0-9]+)(?:\.[0-9]{1,6})?$/.test(args.amount.trim()))
      throw new Error("Enter a valid USDC amount (up to 6 decimal places).");
    const amount = Number(args.amount);
    if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Invalid withdrawal amount.");
    if (!(await verifyLighterTradingKey(args.walletAddress))) throw new Error("Lighter key registration pending.");
    const owned = await getLighterAccountIndexes(s.address);
    if (!owned.includes(s.signer.accountIndex))
      throw new Error("Lighter account ownership verification failed.");
    const account = await s.client.getAccount(s.signer.accountIndex);
    const owner = account?.l1_address;
    if (!owner || getAddress(owner) !== s.address)
      throw new Error("Lighter did not verify the original wallet withdrawal destination.");
    const available = Number(account?.available_balance);
    if (!Number.isFinite(available) || amount > available)
      throw new Error("Amount exceeds verified Lighter available balance.");
    const tx = await s.client.withdraw({ amount: args.amount.trim(), routeType: 0 });
    return accepted(tx);
  });
}

export async function updateLighterPerpMargin(args: {
  walletAddress: string; market: LighterMarket;
  leverage: number; marginMode: "cross" | "isolated";
}): Promise<string> {
  return withWrite(async () => {
    if (args.market.kind !== "perp" || !Number.isSafeInteger(args.leverage) || args.leverage < 1)
      throw new Error("Invalid perpetual market or leverage.");
    const s = active(args.walletAddress);
    if (!(await verifyLighterTradingKey(args.walletAddress))) throw new Error("Lighter signer not authorized.");
    const fresh = (await getLighterMarkets()).find(m =>
      m.kind === "perp" && m.id === args.market.id && m.symbol === args.market.symbol);
    if (!fresh?.maxLeverage || args.leverage > fresh.maxLeverage)
      throw new Error("Leverage exceeds the verified Lighter market limit.");
    const meta = (await s.client.markets()).find(m =>
      m.marketId === fresh.id && m.symbol === fresh.symbol.toUpperCase());
    if (!meta?.maxLeverage || args.leverage > meta.maxLeverage ||
      meta.priceDecimals !== fresh.priceDecimals || meta.sizeDecimals !== fresh.sizeDecimals)
      throw new Error("Lighter SDK metadata mismatch. No margin update was sent.");
    const tx = await s.client.rest.updateLeverage(s.signer, {
      marketIndex: fresh.id, leverage: args.leverage,
      marginMode: args.marginMode === "isolated" ? 1 : 0,
      minFraction: meta.minInitialMarginFraction,
    });
    return accepted(tx);
  });
}
