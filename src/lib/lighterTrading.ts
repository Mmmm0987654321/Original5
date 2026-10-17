/**
 * HideDex Lighter mainnet signed execution.
 * The signing key is session-memory only; never put it in URLs, localStorage,
 * sessionStorage, logs, analytics, backend requests, or cross-venue code.
 * The pinned browser SDK packages Go's Lighter signer WASM. It is an
 * independent TypeScript wrapper, not an endorsement by Lighter.
 */
import { BrowserProvider, getAddress } from "ethers";
import {
  initLighterSigner, LighterClient, LighterOnboarding, LighterHelper, LighterConstant,
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


/** Signed Lighter native TP/SL triggers for an already-open perpetual position.
 * No simulated triggers or new position-entry. Orders are real reduce-only.
 * Each leg is independently accepted; the caller must refresh actual orders.
 */
export async function setLighterPositionTriggers(args:{
  walletAddress:string;market:LighterMarket;signedSize:number;
  takeProfit:number|null;stopLoss:number|null;
}):Promise<string[]>{
  return withWrite(async()=>{
    const s=active(args.walletAddress);
    if(!await verifyLighterTradingKey(args.walletAddress))
      throw new Error("Lighter trading signer is not authorized.");
    if(args.market.kind!=="perp"||!(args.signedSize!==0&&Number.isFinite(args.signedSize))||
       (args.takeProfit===null&&args.stopLoss===null))
      throw new Error("A verified perp position and TP or SL trigger price are required.");
    const catalog=await getLighterMarkets();
    const market=catalog.find(m=>m.id===args.market.id&&m.kind==="perp"&&m.symbol===args.market.symbol);
    if(!market||market.priceDecimals!==args.market.priceDecimals||
       market.sizeDecimals!==args.market.sizeDecimals||market.multiplier!==args.market.multiplier)
      throw new Error("Lighter market metadata changed. No trigger submitted.");
    const [account]=await getLighterPublicAccounts([s.signer.accountIndex]);
    const position=account?.positions.find(p=>p.symbol===market.symbol);
    if(!position||Math.sign(position.signedSize)!==Math.sign(args.signedSize)||
       Math.abs(position.signedSize-args.signedSize)>1e-9)
      throw new Error("Position size or side changed. Verify position before attaching TP/SL.");
    const anchor=market.lastTradePrice;
    if(!(anchor&&anchor>0))throw new Error("Lighter trigger reference price is unavailable.");
    const closeSell=position.signedSize>0;
    if((args.takeProfit!=null&&(!Number.isFinite(args.takeProfit)||args.takeProfit<=0||
        (closeSell?args.takeProfit<=anchor:args.takeProfit>=anchor)))||
       (args.stopLoss!=null&&(!Number.isFinite(args.stopLoss)||args.stopLoss<=0||
        (closeSell?args.stopLoss>=anchor:args.stopLoss<=anchor))))
      throw new Error("TP/SL direction must match current market and position side.");
    // Do not stack duplicate native triggers against one open position.
    // Existing orders must be cancelled explicitly by the user first.
    const existing=await s.client.getOpenOrders();
    const duplicate=(kind:"tp"|"sl")=>existing.some(o=>
      matchesLighterPositionTrigger(o,market.id,closeSell)&&
      lighterPositionTriggerKind(o)===kind);
    if((args.takeProfit!==null&&duplicate("tp"))||
       (args.stopLoss!==null&&duplicate("sl")))
      throw new Error("Existing Lighter TP/SL trigger detected. Manage or cancel the old trigger in Open Orders before setting another.");
    // A Lighter SDK response can carry the volume-quota note even when a
    // signed trigger reached the exchange. Reconcile by authenticated READ,
    // never by repeating a signed transaction.
    const beforeOrderIds=new Set(existing.map(o=>String(o.order_index)));
    const confirmActiveTrigger=async(kind:"tp"|"sl",target:number):Promise<boolean>=>{
      const nativeTarget=rawOrder(market,Math.abs(position.signedSize),target).price;
      const tick=Math.pow(10,-Math.max(0,market.priceDecimals));
      for(const delay of [900,2300,4200]){
        await new Promise<void>(resolve=>setTimeout(resolve,delay));
        try{
          const rows=await s.client.getOpenOrders();
          if(rows.some(o=>{
            if(!matchesLighterPositionTrigger(o,market.id,closeSell)||
               lighterPositionTriggerKind(o)!==kind||
               !Number.isSafeInteger(Number(o.order_index))||
               beforeOrderIds.has(String(o.order_index)))return false;
            const price=Number(o.trigger_price);
            return Number.isFinite(price)&&(
              Math.abs(price-target)<=Math.max(tick*2,target*1e-7)||
              Math.abs(price-nativeTarget)<=1
            );
          }))return true;
        }catch{/* A failed read cannot prove either success or failure. */}
      }
      return false;
    };
    const out:string[]=[];
    for(const [label,trigger] of [["TP",args.takeProfit],["SL",args.stopLoss]] as const){
      if(trigger===null)continue;
      const amount=rawOrder(market,Math.abs(position.signedSize),closeSell?trigger*0.98:trigger*1.02);
      const triggerPx=rawOrder(market,Math.abs(position.signedSize),trigger).price;
      if(amount.baseAmount<=0n||amount.baseAmount>281474976710655n)
        throw new Error("Lighter trigger size is outside native uint48 limits.");
      const orderKind=label==="TP"?LighterConstant.ORDER_TYPE.TAKE_PROFIT:
        LighterConstant.ORDER_TYPE.STOP_LOSS;
      try{
        const result=await s.client.rest.createTriggerOrder(s.signer,{
          marketIndex:market.id,baseAmount:amount.baseAmount,isAsk:closeSell,
          orderType:orderKind,triggerPrice:triggerPx,price:amount.price,
          clientOrderIndex:clientOrderIndex(),applyIntegratorFee:false,
        });
        out.push(accepted(result));
      }catch(e){
        const note=e instanceof Error?e.message:String(e);
        // No matching order of this type existed before the signed attempt,
        // so a new signer-owned market/type/reduce-only order is real evidence.
        if(await confirmActiveTrigger(label==="TP"?"tp":"sl",trigger)){
          out.push("VERIFIED_ACTIVE_"+label);
          continue;
        }
        if(out.length)throw new Error("Some Lighter TP/SL orders were accepted, but "+
          label+" was not verified. Check Open Orders before trying again; no retry was sent.");
        if(/didn['’]t use volume quota|ratelimit/i.test(note))
          throw new Error("Lighter TP/SL submission could not be verified. Check Open Orders "+
            "before trying again; the exchange may have received this order.");
        throw new Error("Lighter "+label+" trigger was not confirmed: "+note);
      }
    }
    return out;
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

/** Lighter's /accountActiveOrders reports order type as e.g. "take-profit",
 * while SDK versions may also use 4/2. This is read-only classification.
 * Never assume a native trigger is reduce-only solely from its type.
 */
export function lighterPositionTriggerKind(order: LighterActiveOrder): "tp" | "sl" | null {
  const labels=[order.type,order.order_type].map(value=>
    String(value??"").trim().toLowerCase().replace(/[\s_]+/g,"-"));
  if(labels.some(value=>value==="4"||value==="takeprofit"||value.startsWith("take-profit")))
    return "tp";
  if(labels.some(value=>value==="2"||value==="stoploss"||value.startsWith("stop-loss")))
    return "sl";
  return null;
}
export function matchesLighterPositionTrigger(
  order:LighterActiveOrder, marketId:number, closeIsAsk:boolean
):boolean {
  return Number(order.market_index??order.market_id)===marketId &&
    order.is_ask===closeIsAsk && lighterPositionTriggerKind(order)!==null &&
    Number(order.trigger_price)>0;
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
    try {
      const tx = await s.client.rest.cancelOrder(s.signer, {
        marketIndex: args.market.id, orderIndex: args.orderIndex,
      });
      return accepted(tx);
    } catch (error) {
      const note=error instanceof Error?error.message:String(error);
      // A quota note is not proof that a signed cancellation failed.
      // Only READ the signer-owned account; never submit the cancel again.
      if(!/didn['’]t use volume quota|ratelimit/i.test(note))throw error;
      for(const delay of [900,2300,4200]){
        await new Promise<void>(resolve=>setTimeout(resolve,delay));
        try {
          const rows=await s.client.getOpenOrders();
          if(!rows.some(o=>Number(o.order_index)===args.orderIndex &&
            Number(o.market_index??o.market_id)===args.market.id))
            return "VERIFIED_NO_LONGER_OPEN"; // Could have filled; do not claim cancellation.
        }catch{/* No status conclusion can be drawn from a failed read. */}
      }
      throw new Error("Lighter cancellation is not yet verified. Checking Open Orders automatically; do not repeat it until status is known.");
    }
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
    // Secure route (not fast withdrawal): official minimum 1 USDC equivalent.
    if (!Number.isFinite(amount) || amount < 1)
      throw new Error("Lighter secure USDC withdrawal minimum is 1 USDC.");
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
    // This pinned SDK's documented high-level secure-withdrawal API accepts
    // {amount}. It selects its own correct default route/asset. Explicitly
    // injecting routeType:0 was rejected in the live browser as
    // "invalid route type" despite 0 being a valid *protocol* perp route.
    // Do NOT guess another numeric route or use a different SDK/signing flow.
    // Secure withdrawal always targets the verified L1 owner above.
    try {
      const tx = await s.client.withdraw({ amount: args.amount.trim() });
      return accepted(tx);
    } catch (error) {
      const raw=error instanceof Error?error.message:String(error);
      if(/invalid route type/i.test(raw)) {
        // It may be an SDK/protocol compatibility error. A failed response
        // alone cannot establish transaction status; never auto retry.
        throw new Error("Lighter did not confirm the secure Ethereum withdrawal route. Check your Lighter withdrawal history before attempting it again.");
      }
      throw error;
    }
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
