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
import type {TokenMetadata} from "../../types";
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

type Kind=AsterMarketKind;
type Section="dashboard"|"markets"|"trade"|"funds"|"account"|"orders";
type Props={
 walletAddress:string;
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
function toToken(m:AsterMarket):TokenMetadata{
 const name=m.baseAsset+"/"+m.quoteAsset;
 return {
  symbol:m.kind==="spot"?name+"-SPOT":name,
  name,sourceCoin:m.symbol,displayBaseAsset:m.baseAsset,
  price:m.lastPrice,change24h:m.change24hPercent,
  volume24h:["USDT","USDC","USD1"].includes(m.quoteAsset)?m.quoteVolume24h:null,
  high24h:m.high24h,low24h:m.low24h,
  maxLeverage:undefined, // Private signed bracket query required.
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
 walletAddress,onConnectWallet,section,initialKind,onSelectSection,
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
 const tokens=useMemo(()=>markets.map(toToken),[markets]);
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
 const token=selected?toToken(selected):null;
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
  asks={asks} bids={bids} priceDecimals={selected?.priceDecimals??undefined}
  onSelectPrice={p=>{setOrderType("LIMIT");setLimitPrice(String(p));}}
 />:<p className="p-4 text-xs text-brand-muted">Aster order book unavailable.</p>;
 const header=<HideDexUnifiedMarketHeader
  mobile={{
   logo,ticker,modeLabel:kind==="perp"?"Perp · Aster":"Spot · Aster",
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
   marginMode:"CROSS",leverage:1,maxLeverage:null,leverageDisabled:true,
  }}
  side={{isPerp:kind==="perp",side,onSide:setSide,
    available:"— (Aster authorization pending)"}}
  basic={{type:orderType,price:limitPrice,onPrice:setLimitPrice,midPrice:price,
    size:amount,onSize:setAmount,sizeUnit:sizeUnit==="USD"?quoteSymbol:selected?.baseAsset??"COIN",
    onToggleUnit:()=>setSizeUnit(u=>u==="USD"?"COIN":"USD")}}
  presets={{onSelect:()=>{},disabled:true}}
  options={{visible:false,tpsl:{checked:false,disabled:true,onChange:()=>{}}}}
  summary={{isPerp:kind==="perp",liquidation:"—",orderValue:"—",margin:"—"}}
  place={{type:"button",disabled:true,side,label:"ASTER TRADING NOT YET ENABLED"}}
 />;
 const account=<HideDexUnifiedAccountPanel
  tabs={<TradingAccountTabBar activeTab={accountTab} onSelect={setAccountTab}/>}
 ><p className="py-7 text-center text-xs text-brand-muted" role="status">
   Aster {accountTab.toLowerCase().replaceAll("_"," ")} is not yet connected.
   No account balance, order or position is invented; trading and withdrawals are disabled.
 </p></HideDexUnifiedAccountPanel>;
 return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="aster">
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
  <p role="status" className="mb-2 text-[10px] font-mono text-brand-muted">
    Aster V3 public market view · Read-only until verified Agent/Builder trading authorization
  </p>
  {header}
  <HideDexUnifiedTradeCanvas
    marketView={<HideDexUnifiedMarketView
      view={view==="chart"?"chart":"orderbook"} chart={chart} orderBook={bookView}/>}
    orderForm={form}
    orderBook={bookDisplay}
    account={account}
  />
 </div>;
}
