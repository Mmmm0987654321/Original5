/**
 * Aster V3 mainnet venue adapter. ONE existing HideDex presentation.
 *
 * NO bespoke market/header/chart/order-form/account UI: these are the same
 * shared components used by Hyperliquid and Lighter. The only new code
 * deals with authenticated-UNAVAILABLE Aster public data, state and mapping.
 *
 * CRITICAL: Signed Aster trading, builder fees and funding are NOT available
 * from public V3 APIs. Real order/withdraw commands remain disabled until
 * verified Agent+Builder authorization and isolated signed flows are wired.
 */
import React,{useEffect,useMemo,useState} from "react";
import {ActiveTab,type TokenMetadata} from "../../types";
import {Wallet,TrendingUp,Unlock,Lock} from "lucide-react";
import GeneralDashboard from "../dashboard/GeneralDashboard";
import MarketsPanel from "../dashboard/MarketsPanel";
import HideDexFundsOverview from "../dashboard/HideDexFundsOverview";
import {getAsterSpotAndPerps,getAsterBook,type AsterMarket,type AsterBook,type AsterMarketKind} from "../../lib/asterMarketData";
import MarketSelector,{renderAssetLogo} from "./MarketSelector";
import HideDexUnifiedMarketHeader from "./HideDexUnifiedMarketHeader";
import HideDexUnifiedMarketView from "./HideDexUnifiedMarketView";
import HideDexUnifiedTradeCanvas from "./HideDexUnifiedTradeCanvas";
import HideDexUnifiedOrderForm from "./HideDexUnifiedOrderForm";
import HideDexUnifiedAccountPanel from "./HideDexUnifiedAccountPanel";
import HideDexOrderBookPanel,{type HideDexBookLevel} from "./HideDexOrderBookPanel";
import TradingAccountTabBar,{type TradingTabId} from "./TradingAccountTabBar";
import TopOrderBookView from "./TopOrderBookView";
import TVChart from "./TVChart";
import HideDexTradingAuthorizationSheet from "./HideDexTradingAuthorizationSheet";
import HideDexBalancesView,{type HideDexBalanceItem} from "./HideDexBalancesView";
import {reconnectAsterAgent,registerAsterTradingAgent,getAsterFuturesBalances,
  getAsterAllVerifiedLeverageBrackets,
  clearAsterSession,type AsterWalletProvider,type AsterIdentity,type AsterAccountBalance,
  type AsterVerifiedLeverage} from "../../lib/asterTradingAuth";

type Kind=AsterMarketKind;
type Section="dashboard"|"markets"|"trade"|"funds"|"account"|"orders";
type Props={
 walletAddress:string;
 getWalletProvider:()=>Promise<AsterWalletProvider>;
 onSwitchToBsc:()=>Promise<void>;
 getReownChainId:()=>number|null;
 onConnectWallet:()=>void;
 section:Section;
 initialKind:Kind;
 onSelectSection:(section:Section,kind?:Kind)=>void;
 onMarketCatalog?:(rows:TokenMetadata[])=>void;
 watchlist?:readonly string[];
 onToggleFavorite?:(symbol:string)=>void;
 sidebarMarketRequest?:{symbol:string;nonce:number}|null;
 initialOrdersTab?:TradingTabId;
};
const numeric=(v:unknown)=>{
 const n=Number(v);return Number.isFinite(n)&&n>0?n:null;
};
function toToken(m:AsterMarket,maxLeverage?:number):TokenMetadata{
 const name=m.baseAsset+"/"+m.quoteAsset;
 return {
  symbol:m.kind==="spot"?name+"-SPOT":name,
  name,sourceCoin:m.symbol,displayBaseAsset:m.baseAsset,
  price:m.lastPrice,change24h:m.change24hPercent,
  volume24h:["USDT","USDC","USD1"].includes(m.quoteAsset)?m.quoteVolume24h:null,
  high24h:m.high24h,low24h:m.low24h,
  maxLeverage:m.kind==="perp"?maxLeverage:undefined, // Only signed Aster tiers.
  openInterest:m.kind==="perp"?null:undefined,
  category:m.kind==="spot"?"spot":"perps",
  isSpotOnly:m.kind==="spot",hasSpot:m.kind==="spot",
  spotSymbol:m.kind==="spot"?m.symbol:undefined,
 };
}
function bookLevels(book:AsterBook|null,side:"bids"|"asks"):HideDexBookLevel[]{
 if(!book)return [];
 let sum=0;
 return book[side].flatMap(raw=>{
  const price=numeric(raw.price),size=Number(raw.size);
  if(price===null||!Number.isFinite(size)||size<0)return [];
  sum+=size;
  return [{price,size,total:sum}];
 });
}
function formatPrice(value:number|null):string{
 if(value===null||!Number.isFinite(value)||value<=0)return "—";
 return value.toLocaleString("en-US",{maximumFractionDigits:8});
}
export default function AsterVenueAdapter({
 walletAddress,getWalletProvider,onSwitchToBsc,getReownChainId,onConnectWallet,section,initialKind,onSelectSection,
 onMarketCatalog,watchlist=[],onToggleFavorite,sidebarMarketRequest,initialOrdersTab,
}:Props){
 const [markets,setMarkets]=useState<AsterMarket[]>([]);
 const [marketError,setMarketError]=useState("");
 const [catalogLoading,setCatalogLoading]=useState(true);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [kind,setKind]=useState<Kind>(initialKind);
 const [marketPopup,setMarketPopup]=useState(false);
 const [view,setView]=useState<"chart"|"orderbook">("chart");
 const [marketInfoOpen,setMarketInfoOpen]=useState(false);
 const [book,setBook]=useState<AsterBook|null>(null);
 const [bookError,setBookError]=useState("");
 const [orderType,setOrderType]=useState<"MARKET"|"LIMIT">("MARKET");
 const [side,setSide]=useState<"BUY"|"SELL">("BUY");
 const [amount,setAmount]=useState("");
 const [limitPrice,setLimitPrice]=useState("");
 const [sizeUnit,setSizeUnit]=useState<"USD"|"COIN">("USD");
 const [accountTab,setAccountTab]=useState<TradingTabId>(
  section==="orders"?initialOrdersTab??"OPEN_ORDERS":"POSITIONS");
 const [bookGroup,setBookGroup]=useState("1");
 const [hideBalances,setHideBalances]=useState(false);
 const [copiedAddress,setCopiedAddress]=useState(false);
 const [authSheetOpen,setAuthSheetOpen]=useState(false);
 const [authBusy,setAuthBusy]=useState(false);
 const [authStatus,setAuthStatus]=useState("");
 const [agentIdentity,setAgentIdentity]=useState<AsterIdentity|null>(null);
 const [agentRestoring,setAgentRestoring]=useState(Boolean(walletAddress));
 const [futuresBalances,setFuturesBalances]=useState<AsterAccountBalance[]|null>(null);
 const [balanceError,setBalanceError]=useState("");
 const [balanceLoading,setBalanceLoading]=useState(false);
 const [leverageLimits,setLeverageLimits]=useState<Record<string,AsterVerifiedLeverage>>({});
 const [leverageStatus,setLeverageStatus]=useState("");
 // Agent is owner-scoped; navigating or disconnecting never reuses another wallet's key.
 useEffect(()=>{
  let alive=true;
  clearAsterSession();
  setAgentIdentity(null);setFuturesBalances(null);setBalanceError("");
  setLeverageLimits({});setLeverageStatus("");
  setAuthStatus("");setAuthSheetOpen(false);
  if(!walletAddress){setAgentRestoring(false);return ()=>{alive=false;};}
  setAgentRestoring(true);
  void reconnectAsterAgent(walletAddress).then(identity=>{
   if(alive)setAgentIdentity(identity);
  }).catch(error=>{
   if(alive)setAuthStatus(error instanceof Error?error.message:"Encrypted Aster key restore failed");
  }).finally(()=>{if(alive)setAgentRestoring(false);});
  return ()=>{alive=false;};
 },[walletAddress]);
 const enableTrading=async()=>{
  if(!walletAddress){onConnectWallet();return;}
  if(authBusy||agentIdentity||agentRestoring)return;
  setAuthBusy(true);setAuthStatus("");
  try{
   const identity=await registerAsterTradingAgent({walletAddress,getWalletProvider,onSwitchToBsc,getReownChainId});
   setAgentIdentity(identity);setAuthSheetOpen(false);
   setAuthStatus("Aster authorized Spot/Perp trading agent. Withdrawal permission was NOT granted. Signed account verification in progress; orders remain disabled.");
  }catch(error){
   setAuthStatus(error instanceof Error?error.message:"Aster authorization not confirmed");
  }finally{setAuthBusy(false);}
 };
 // Read only authenticated exchange funds; unknown/error is never equivalent to zero.
 useEffect(()=>{
  setFuturesBalances(null);setBalanceError("");
  if(!walletAddress||!agentIdentity||
     (section!=="trade"&&section!=="funds"&&section!=="orders"&&section!=="markets"))return;
  const controller=new AbortController();let running=false;let invalidSignature=false;
  const refresh=async()=>{
   if(running||invalidSignature||controller.signal.aborted)return;
   running=true;setBalanceLoading(true);
   try{
    const balances=await getAsterFuturesBalances(walletAddress,controller.signal);
    if(!controller.signal.aborted){setFuturesBalances(balances);setBalanceError("");}
   }catch(error){
    if(!controller.signal.aborted){
     setFuturesBalances(null);
     const message=error instanceof Error?error.message:"Aster signed balance query failed";
     // Never spam signed account requests after the exchange rejects a
     // signature. A new session/reload or another code fix is required.
     if(/Aster error -1000.*signature check failed/i.test(message))
      invalidSignature=true;
     setBalanceError(message);
    }
   }finally{running=false;if(!controller.signal.aborted)setBalanceLoading(false);}
  };
  void refresh();
  const interval=window.setInterval(()=>void refresh(),45_000);
  return ()=>{controller.abort();window.clearInterval(interval);};
 },[walletAddress,agentIdentity?.agent,section]);
 useEffect(()=>{
  setLeverageLimits({});setLeverageStatus("");
  if(!walletAddress||!agentIdentity)return;
  const controller=new AbortController();
  void getAsterAllVerifiedLeverageBrackets(walletAddress,controller.signal).then(data=>{
   if(!controller.signal.aborted){setLeverageLimits(data);setLeverageStatus("");}
  }).catch(error=>{
   if(!controller.signal.aborted)setLeverageStatus(error instanceof Error?
    error.message:"Aster leverage brackets unavailable");
  });
  return ()=>controller.abort();
 },[walletAddress,agentIdentity?.agent]);
 const usdtPerp=futuresBalances?.find(row=>row.asset==="USDT")??null;
 const parsedUsd=(s:string|null|undefined):number|null=>{
  if(typeof s!=="string"||!s.trim())return null;
  const value=Number(s);
  return Number.isFinite(value)&&value>=0?value:null;
 };
 const usdtTotal=usdtPerp?parsedUsd(usdtPerp.balance):null;
 const usdtAvailable=usdtPerp?parsedUsd(usdtPerp.availableBalance):null;
 const verifiedBalances=useMemo<HideDexBalanceItem[]|null>(()=>{
  if(futuresBalances===null)return null;
  return futuresBalances.map(row=>({
   id:"aster-perps:"+row.asset,symbol:row.asset,name:"Aster Perp collateral",
   total:parsedUsd(row.balance),available:parsedUsd(row.availableBalance),
   locked:null,valueUsd:null,allocationPercent:null,
  }));
 },[futuresBalances]);

 // One read-only official snapshot on mount and on low-frequency refresh.
 // No fallback to Hyperliquid/Lighter and no retry storm.
 useEffect(()=>{
  const controller=new AbortController();
  let running=false;
  const refresh=async()=>{
   if(running||controller.signal.aborted)return;
   running=true;
   try{
    const rows=await getAsterSpotAndPerps(controller.signal);
    if(controller.signal.aborted)return;
    setMarkets(rows);setMarketError("");
    setSelectedId(old=>old&&rows.some(m=>m.id===old)?old:
     rows.find(m=>m.kind===initialKind&&m.baseAsset==="BTC"&&m.quoteAsset==="USDT")?.id??
     rows.find(m=>m.kind===initialKind)?.id??rows[0]?.id??null);
   }catch(error){
    if(!controller.signal.aborted)setMarketError(error instanceof Error?error.message:"Aster public API unavailable");
   }finally{
    running=false;
    if(!controller.signal.aborted)setCatalogLoading(false);
   }
  };
  void refresh();
  const id=window.setInterval(()=>void refresh(),90_000);
  return ()=>{controller.abort();window.clearInterval(id);};
 },[]);
 useEffect(()=>{if(section==="orders")setAccountTab(initialOrdersTab??"OPEN_ORDERS");},
  [section,initialOrdersTab]);
 const tokens=useMemo(()=>markets.map(m=>toToken(m,leverageLimits[m.symbol]?.maxLeverage)),
  [markets,leverageLimits]);
 useEffect(()=>{onMarketCatalog?.(tokens);},[tokens,onMarketCatalog]);
 const selected=useMemo(()=>markets.find(m=>m.id===selectedId)??null,[markets,selectedId]);
 useEffect(()=>{
  if(selected)setKind(selected.kind);
 },[selected?.id]);
 // Preserve the user's manual market while switching screens.
 useEffect(()=>{
  if(section!=="trade"||initialKind===kind)return;
  const next=markets.find(m=>m.kind===initialKind&&m.baseAsset===selected?.baseAsset&&
    m.quoteAsset===selected?.quoteAsset)??markets.find(m=>m.kind===initialKind);
  if(next){setSelectedId(next.id);setKind(initialKind);}
 },[initialKind,section]);
 const choose=(market:AsterMarket,openTrade=true)=>{
  setSelectedId(market.id);setKind(market.kind);
  setMarketPopup(false);setBook(null);setAmount("");setLimitPrice("");setBookError("");
  if(openTrade)onSelectSection("trade",market.kind);
 };
 useEffect(()=>{
  if(!sidebarMarketRequest)return;
  const market=markets.find(m=>toToken(m).symbol===sidebarMarketRequest.symbol);
  if(market)choose(market,true);
 },[sidebarMarketRequest?.nonce,markets]);
 useEffect(()=>{
  setBook(null);setBookError("");
  if(!selected||(section!=="trade"&&section!=="markets"))return;
  let disposed=false;
  const controller=new AbortController();
  let running=false;
  const read=async()=>{
   if(running||controller.signal.aborted)return;
   running=true;
   try{
    const snapshot=await getAsterBook(selected.kind,selected.symbol,20,controller.signal);
    if(!disposed){setBook(snapshot);setBookError("");}
   }catch(error){
    if(!disposed)setBookError(error instanceof Error?error.message:"Aster depth unavailable");
   }finally{running=false;}
  };
  void read();
  const timer=window.setInterval(()=>void read(),5000);
  return ()=>{disposed=true;controller.abort();window.clearInterval(timer);};
 },[selected?.id,section]);
 const verifiedMaxLeverage=selected?.kind==="perp"?
   leverageLimits[selected.symbol]?.maxLeverage??null:null;
 const token=selected?toToken(selected,verifiedMaxLeverage??undefined):null;
 const asks=useMemo(()=>bookLevels(book,"asks"),[book]);
 const bids=useMemo(()=>bookLevels(book,"bids"),[book]);
 const quoteSymbol=selected?.quoteAsset??"USDT";
 const ticker=token?.name??"—";
 const logo=selected?renderAssetLogo(selected.baseAsset,selected.baseAsset,selected.symbol,true):null;
 const price=selected?.lastPrice??null;
 const priceLabel=formatPrice(price);
 const toggleKind=()=>{
  const other:Kind=kind==="spot"?"perp":"spot";
  const next=markets.find(m=>m.kind===other&&m.baseAsset===selected?.baseAsset&&
    m.quoteAsset===selected?.quoteAsset)??markets.find(m=>m.kind===other);
  if(next)choose(next);
 };
 const bookDisplay=<HideDexOrderBookPanel
  asks={asks} bids={bids} midPrice={price}
  midLabel={bookError?"DEPTH UNAVAILABLE":"LAST PRICE"}
  sizeUnit={sizeUnit} baseSymbol={selected?.baseAsset??"COIN"}
  onToggleSizeUnit={()=>setSizeUnit(x=>x==="USD"?"COIN":"USD")}
  onSelectPrice={v=>{setOrderType("LIMIT");setLimitPrice(String(v));}}
  formatPrice={v=>formatPrice(v)}
  formatSize={(p,s)=>sizeUnit==="USD"?formatPrice(p*s):formatPrice(s)}
  group={bookGroup} groupOptions={["1"]}
  onGroup={setBookGroup}
 />;
 const chart=selected?<TVChart
  key={"aster:"+selected.id} symbol={selected.baseAsset+(selected.kind==="spot"?"-SPOT":"")}
  marketCoin="" isSpot={selected.kind==="spot"}
  currentPrice={price} high24h={selected.high24h} low24h={selected.low24h}
  volume24h={selected.quoteVolume24h} change24h={selected.change24hPercent}
  asterMarket={{kind:selected.kind,symbol:selected.symbol}}
  toolbarHostId="market-chart-toolbar-host"
 />:<p className="p-4 text-xs text-brand-muted">Aster market data loading…</p>;
 const bookView=token?<TopOrderBookView
  symbol={selected?.baseAsset??"—"} currentToken={token}
  quoteSymbol={selected?.quoteAsset??"USDT"}
  depthVerified={Boolean(book)&&!bookError}
  asks={asks} bids={bids} priceDecimals={selected?.priceDecimals??undefined}
  onSelectPrice={p=>{setOrderType("LIMIT");setLimitPrice(String(p));}}
 />:<p className="p-4 text-xs text-brand-muted">Aster order book unavailable.</p>;
 const header=<HideDexUnifiedMarketHeader
  mobile={{
   logo,ticker,modeLabel:kind==="perp"?
   (verifiedMaxLeverage?verifiedMaxLeverage+"x Perp · Aster":"Perp · Aster"):"Spot · Aster",
   priceLabel,change24h:selected?.change24hPercent,
   onSelectMarket:()=>setMarketPopup(true),mode:kind,
   switchMode:"toggle",onSwitchMode:toggleKind,
  }}
  desktop={{
   logo,ticker,sublabel:kind==="perp"?"Perpetual · Aster":"Spot · Aster",
   onMarket:()=>setMarketPopup(true),view,
   onView:setView,marketInfoOpen,onMarketInfo:()=>setMarketInfoOpen(v=>!v),
  }}
  info={{ticker,mode:kind,priceLabel,change24h:selected?.change24hPercent,
   fundingRate:selected?.fundingRate,
   badge:<span className="text-[9px] text-brand-muted">ASTER MAINNET</span>,
  }}
  showChartToolbar={view==="chart"}
 />;
 const form=<HideDexUnifiedOrderForm
  connected={Boolean(walletAddress)} onConnect={onConnectWallet}
  onSubmit={e=>e.preventDefault()}
  selectors={{
   isPerp:kind==="perp",orderType,onOrderType:t=>{
    if(t==="MARKET"||t==="LIMIT")setOrderType(t);
   },
   availableOrderTypes:["MARKET","LIMIT"],
   marginMode:"CROSS",leverage:1,maxLeverage:verifiedMaxLeverage,
   leverageDisabled:true,readOnlyMaxLeverage:true,
  }}
  side={{isPerp:kind==="perp",side,onSide:setSide,
    available:usdtAvailable!==null?usdtAvailable.toLocaleString("en-US",{maximumFractionDigits:6})+" USDT · Perps":
     "— (Aster balance unverified)"}}
  basic={{type:orderType,price:limitPrice,onPrice:setLimitPrice,midPrice:price,
    size:amount,onSize:setAmount,sizeUnit:sizeUnit==="USD"?quoteSymbol:selected?.baseAsset??"COIN",
    onToggleUnit:()=>setSizeUnit(u=>u==="USD"?"COIN":"USD")}}
  presets={{onSelect:()=>{},disabled:true}}
  options={{visible:false,tpsl:{checked:false,disabled:true,onChange:()=>{}}}}
  summary={{isPerp:kind==="perp",liquidation:"—",orderValue:"—",margin:"—"}}
  place={!agentIdentity?{
    type:"button",disabled:!walletAddress||agentRestoring||authBusy,side,
    label:agentRestoring?"RESTORING ASTER WALLET…":"ENABLE TRADING",
    onClick:()=>{if(walletAddress)setAuthSheetOpen(true);}
  }:{type:"button",disabled:true,side,label:"ASTER AGENT AUTHORIZED · ORDERS UNAVAILABLE"}}
 />;
 const account=<HideDexUnifiedAccountPanel
  tabs={<TradingAccountTabBar activeTab={accountTab} onSelect={setAccountTab}/>}
 >
  {accountTab==="BALANCES"?<div className="p-2">
    <p className="mb-2 text-xs text-brand-muted">Aster V3 authenticated Futures collateral (not Spot)</p>
    <HideDexBalancesView items={verifiedBalances}
      unavailableMessage={agentRestoring?"Restoring encrypted Aster agent…":
       !agentIdentity?"Enable Aster trading to verify account balances.":
       balanceLoading?"Loading verified Aster Futures balances…":
       balanceError||"Signed Aster account data unavailable"}/>
  </div>:
  <p className="py-7 text-center text-xs text-brand-muted" role="status">
    Aster {accountTab.toLowerCase().replaceAll("_"," ")} is not yet connected.
    No position, order or fill is fabricated. Order placement remains disabled.
  </p>}
 </HideDexUnifiedAccountPanel>;
 return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="aster">
  {authSheetOpen&&<HideDexTradingAuthorizationSheet
    title="Enable Trading" onClose={()=>{if(!authBusy)setAuthSheetOpen(false);}}
    closeDisabled={authBusy} primaryDisabled={authBusy||!walletAddress||agentRestoring}
    primaryLabel={authBusy?"CHECK YOUR WALLET":"SIGN TO ENABLE ASTER →"}
    onPrimary={()=>{void enableTrading();}}
    description={<div className="space-y-2 py-2 text-xs text-brand-sub">
      <p>Authorize Aster Spot/Perp trading with your connected wallet on BNB Smart Chain (56).</p>
      <p>Withdrawals are <strong>not authorized</strong>. No deposit or order is placed.
        The trading key stays encrypted on this device.</p>
      <p>Aster may require an initial deposit before authenticated account APIs work.</p>
    </div>}
  >
    {authStatus&&<p role="status" className="my-2 text-xs text-amber-500 break-words">{authStatus}</p>}
  </HideDexTradingAuthorizationSheet>}
  {marketPopup&&<MarketSelector
    tokens={tokens} selectedSymbol={token?.symbol??""}
    favorites={[...watchlist]} onToggleFavorite={onToggleFavorite}
    onSelectToken={(symbol,marketKind)=>{
      const m=markets.find(row=>toToken(row).symbol===symbol&&row.kind===marketKind);
      if(m)choose(m);
    }}
    onClose={()=>setMarketPopup(false)}
    initialCategory={kind==="spot"?"spot":"perps"}
    externalPricesOnly
  />}
  {marketError&&<p role="alert" className="mb-2 rounded-xl border border-rose-500/40 p-3 text-rose-400 text-xs">
    Aster public market data unavailable: {marketError}. Other exchanges are never substituted.
  </p>}
  {catalogLoading&&<p role="status" className="p-2 text-xs text-brand-muted">Loading real Aster Spot / Perp markets…</p>}
  {/* Each real navigation section has its original HideDex workspace.
      NEVER render the trading canvas outside of the Trade tab. */}
  {section==="dashboard"&&<GeneralDashboard
    tokens={tokens} balanceUSDC={0} balanceKnown={false}
    balanceLabel="Aster account (authorization required)"
    positionsCount={null} nodeConnected={Boolean(markets.length)&&!marketError}
    walletAddress={walletAddress}
    setActiveTab={next=>{
      if(next===ActiveTab.Markets)onSelectSection("markets");
      else if(next===ActiveTab.Spot)onSelectSection("trade","spot");
      else if(next===ActiveTab.Perp)onSelectSection("trade","perp");
    }}
    onSelectToken={(symbol,marketKind)=>{
      const market=markets.find(m=>toToken(m).symbol===symbol&&m.kind===marketKind);
      if(market)choose(market,true);
    }}
  />}
  {section==="markets"&&<MarketsPanel
    tokens={tokens}
    selectedSymbol={token?.symbol??""}
    setSelectedSymbol={symbol=>{
      const market=markets.find(m=>toToken(m).symbol===symbol);
      if(market)choose(market,false);
    }}
    onSelectToken={(symbol,marketKind)=>{
      const market=markets.find(m=>toToken(m).symbol===symbol&&m.kind===marketKind);
      if(market)choose(market,true);
    }}
    walletConnected={Boolean(walletAddress)}
    watchlist={[...watchlist]} onToggleWatchlist={onToggleFavorite}
    balanceUSDC={0}
    positions={[]} openOrders={[]} tradeHistory={[]}
    asterMarket={selected?{kind:selected.kind,symbol:selected.symbol}:undefined}
    asterBook={book} asterLastPrice={price}
    asterPriceDecimals={selected?.priceDecimals}
    asterAccountSummary={account}
    onSelectOrderBookPrice={(v)=>{setOrderType("LIMIT");setLimitPrice(String(v));}}
  />}
  {section==="funds"&&<>
    {!agentIdentity&&<div className="flex justify-end px-3">
      <button type="button" disabled={agentRestoring}
        onClick={()=>walletAddress?setAuthSheetOpen(true):onConnectWallet()}
        className="px-4 py-2 text-xs font-bold rounded-lg bg-accent text-brand-bg disabled:opacity-50">
        {agentRestoring?"Restoring…":walletAddress?"Enable Aster Trading":"Connect Wallet"}
      </button>
    </div>}
    <div id="funds-portfolio-container"
      className="space-y-3 sm:space-y-4 text-brand-text font-sans bg-brand-bg px-3 pt-2 pb-2 sm:p-4 sm:pb-8 rounded-3xl max-w-4xl mx-auto w-full">
    <HideDexFundsOverview
      totalLabel="PERP USDT BALANCE"
      totalValue={hideBalances?"••••":usdtTotal===null?"—":
        usdtTotal.toLocaleString("en-US",{maximumFractionDigits:6})+" USDT"}
      approximateValue={hideBalances?"≈ ••••":usdtTotal===null?
        "Aster Futures collateral unavailable":"Aster verified Perps USDT only · Spot not included"}
      accountLabel="Aster Account" accountModeLabel="Aster V3"
      walletAddress={walletAddress}
      walletDisplay={walletAddress?walletAddress.slice(0,6)+"…"+walletAddress.slice(-4):"Not connected"}
      hideBalances={hideBalances} onToggleBalances={()=>setHideBalances(x=>!x)}
      addressCopied={copiedAddress}
      onCopyAddress={async()=>{
        if(!walletAddress)return;
        try{await navigator.clipboard.writeText(walletAddress);setCopiedAddress(true);}
        catch{setCopiedAddress(false);}
      }}
      accountError={!agentIdentity?"Aster trading authorization required for account balances":
        balanceError||(!futuresBalances?"Signed Aster balance data unavailable":undefined)}
      depositLabel="Deposit" depositSubtitle="Not connected to Aster funding API"
      withdrawLabel="Withdrawal" withdrawSubtitle="Not connected to Aster funding API"
      onDeposit={()=>{}} onWithdraw={()=>{}}
      depositDisabled withdrawDisabled
      cards={[
        {label:"Spot Available",value:hideBalances?"••••":"—",subtitle:"Aster Spot balance unavailable",
         icon:<Wallet className="w-3.5 h-3.5"/>},
        {label:"Perpetual Balance",value:hideBalances?"••••":
          usdtTotal===null?"—":usdtTotal.toLocaleString("en-US",{maximumFractionDigits:6})+" USDT",
          subtitle:"Verified Aster Perp USDT collateral",
         icon:<TrendingUp className="w-3.5 h-3.5"/>},
        {label:"Available for Trade",value:hideBalances?"••••":
          usdtAvailable===null?"—":usdtAvailable.toLocaleString("en-US",{maximumFractionDigits:6})+" USDT",
          subtitle:"Exchange-reported Futures available USDT",
         icon:<Unlock className="w-3.5 h-3.5"/>},
        {label:"Margin in Trade",value:hideBalances?"••••":"—",subtitle:"No authenticated margin data",
         icon:<Lock className="w-3.5 h-3.5"/>},
      ]}
    />
  </div></>}
  {section==="orders"&&<div className="rounded-xl border border-brand-border bg-brand-bg p-3">
    {account}
  </div>}
  {section==="trade"&&<>
    {/* Aster trading authorization is only in the original bottom sheet,
        never a second top-of-page banner/toast. */}
    {header}
    <HideDexUnifiedTradeCanvas
      marketView={<HideDexUnifiedMarketView
        view={view==="chart"?"chart":"orderbook"} chart={chart} orderBook={bookView}/>}
      orderForm={form}
      orderBook={bookDisplay}
      account={account}
    />
  </>}
 </div>;
}
