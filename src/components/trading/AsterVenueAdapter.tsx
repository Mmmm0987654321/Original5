import React,{useEffect,useMemo,useState,useCallback} from "react";
import type {Position,OpenOrder,TradeHistoryItem} from "../../types";
import {Wallet,TrendingUp,Unlock,Lock} from "lucide-react";
import type {TokenMetadata} from "../../types";
import MarketSelector,{renderAssetLogo,tokenMatchesSubcategory,type PerpSubcategory} from "./MarketSelector";
import TVChart from "./TVChart";
import MarketsPanel from "../dashboard/MarketsPanel";
import PositionTable from "./PositionTable";
import HideDexUnifiedMarketHeader from "./HideDexUnifiedMarketHeader";
import HideDexUnifiedMarketView from "./HideDexUnifiedMarketView";
import HideDexUnifiedTradeCanvas from "./HideDexUnifiedTradeCanvas";
import HideDexUnifiedOrderForm from "./HideDexUnifiedOrderForm";
import HideDexOrderBookPanel from "./HideDexOrderBookPanel";
import HideDexUnifiedAccountPanel from "./HideDexUnifiedAccountPanel";
import TradingAccountTabBar,{type TradingTabId} from "./TradingAccountTabBar";
import HideDexBalancesView,{type HideDexBalanceItem} from "./HideDexBalancesView";
import HideDexOpenOrders,{type HideDexOpenOrderRow} from "./HideDexOpenOrders";
import HideDexTradeHistory,{type HideDexHistoryRow} from "./HideDexTradeHistory";
import HideDexPositionCard from "./HideDexPositionCard";
import HideDexPositionHeader from "./HideDexPositionHeader";
import HideDexPositionDetails from "./HideDexPositionDetails";
import HideDexPositionActions from "./HideDexPositionActions";
import HideDexPositionActionBar,{type HideDexPositionSort} from "./HideDexPositionActionBar";
import HideDexTradingToast from "./HideDexTradingToast";
import TpSlModal from "./TpSlModal";
import HideDexAssetAllocation from "../dashboard/HideDexAssetAllocation";
import HideDexFundsPerformance,{type HideDexPerformancePeriod,type HideDexPerformanceMarket} from "../dashboard/HideDexFundsPerformance";
import HideDexPerformanceAreaChart from "../dashboard/HideDexPerformanceAreaChart";
import AnalyticsPanel,{DailyFillVolumeBars} from "../dashboard/AnalyticsPanel";
import HideDexTradingAuthorizationSheet from "./HideDexTradingAuthorizationSheet";
import HideDexFundsOverview from "../dashboard/HideDexFundsOverview";
import HideDexFundsDialogShell from "../dashboard/HideDexFundsDialogShell";
import {HideDexFundingNetworkAsset,HideDexFundingAmount,HideDexFundingFeeCard,HideDexFundingSubmit,HideDexFundingDestination} from "../dashboard/HideDexFundingFields";
import {getAsterMarkets,getAsterDepth,type AsterMarket,type AsterLevel} from "../../lib/asterMarketData";
import {getAsterSpotMarkets,getAsterSpotDepth} from "../../lib/asterSpotData";
import {restoreAsterSigner,authorizeAsterAgent,asterReadAccount,asterSignedWrite,asterSignedRead,asterSignedSpotRead,asterSignedSpotWrite,asterNumber,grantAsterWithdrawPermission,type AsterIdentity,type AsterProvider} from "../../lib/asterProV3";
import {ASTER_CHAINS,asterDepositUsdt,asterWithdrawQuote,asterWithdrawUsdt,type AsterChainId} from "../../lib/asterFunding";

type Section="dashboard"|"markets"|"trade"|"funds"|"orders"|"account";
type MarketKind="spot"|"perp";
type Raw=Record<string,unknown>;
const obj=(x:unknown):Raw|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Raw:null;
const rows=(x:unknown):Raw[]=>Array.isArray(x)?x.map(obj).filter((r):r is Raw=>r!==null):[];
const num=asterNumber;
const fmt=(n:number|null,d=2)=>n!==null&&Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d}):"—";
const signedBalance=(v:unknown)=>rows(v).find(a=>a.asset==="USDT"||a.asset==="USDC")??null;
const sourceError=(err:unknown)=>err instanceof Error?err.message.slice(0,220):"Aster operation unavailable";
const quantize=(value:number,step:string)=>{const size=Number(step);if(!Number.isFinite(value)||value<=0||!Number.isFinite(size)||size<=0)throw Error("Invalid order size/tick from Aster");
 const precision=Math.max(0,(step.split(".")[1]??"").replace(/0+$/,"").length);
 const out=Math.floor(value/size+1e-9)*size;
 if(!Number.isFinite(out)||out<=0)throw Error("Order size is below market minimum");
 return out.toFixed(Math.min(12,precision));
};
const quoteMarkets=(m:AsterMarket):TokenMetadata=>{
 const token:TokenMetadata={
  symbol:m.base,name:m.base,fullName:m.base,sourceCoin:m.symbol,
  price:m.last,change24h:m.change24h,volume24h:m.volume24h,
  high24h:null,low24h:null,category:"perps",
  maxLeverage:m.maxLeverage??undefined
 };
 // Apply the original HideDex curated classification; never assign
 // all instruments to Crypto just because the venue is Aster.
 const verified=(["stocks","commodities","forex","indices","crypto"] as PerpSubcategory[])
  .find(group=>tokenMatchesSubcategory(token,group));
 return verified?{...token,subcategory:verified}:token;
};
export default function AsterVenueAdapter(p:{
 section:Section;initialKind:MarketKind;walletAddress:string;
 perpTradingApproved:boolean;
 getWalletProvider:()=>Promise<AsterProvider>;onConnectWallet:()=>void;
 onSelectSection:(section:Section,kind?:MarketKind)=>void;initialOrdersTab?:"OPEN_ORDERS"|"TRADE_HISTORY";
}){
 const {section,initialKind,walletAddress,onConnectWallet,getWalletProvider,onSelectSection,perpTradingApproved}=p;
 const [markets,setMarkets]=useState<AsterMarket[]>([]);
 const [spotMarkets,setSpotMarkets]=useState<AsterMarket[]>([]);
 const [marketError,setMarketError]=useState("");
 const [spotMarketError,setSpotMarketError]=useState("");
 const [selectedSymbol,setSelectedSymbol]=useState("BTCUSDT");
 const [kind,setKind]=useState<MarketKind>(initialKind);
 const [selectOpen,setSelectOpen]=useState(false);
 const [view,setView]=useState<"chart"|"orderbook">("chart");
 const [infoOpen,setInfoOpen]=useState(false);
 const [depth,setDepth]=useState<{asks:AsterLevel[];bids:AsterLevel[]}|null>(null);
 const [bookFlashes,setBookFlashes]=useState<Record<string,"BUY"|"SELL">>({});
 const [lastLiveTrade,setLastLiveTrade]=useState<{symbol:string;kind:MarketKind;price:number}|null>(null);
 const [identity,setIdentity]=useState<AsterIdentity|null>(null);
 const [restoring,setRestoring]=useState(false);
 const [balances,setBalances]=useState<Raw[]|null>(null);
 const [futuresAccount,setFuturesAccount]=useState<Raw|null>(null);
 const [spotBalances,setSpotBalances]=useState<Raw[]|null>(null);
 const [spotMode,setSpotMode]=useState<AsterIdentity["mode"]>(null);
 const [spotOrders,setSpotOrders]=useState<Raw[]|null>(null);
 const [risk,setRisk]=useState<Raw[]|null>(null);
 const [openOrders,setOpenOrders]=useState<Raw[]|null>(null);
 const [trades,setTrades]=useState<Raw[]|null>(null);
 const [accountError,setAccountError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [authOpen,setAuthOpen]=useState(false);
 const [reload,setReload]=useState(0);
 const [tab,setTab]=useState<TradingTabId>("POSITIONS");
 const [positionSort,setPositionSort]=useState<HideDexPositionSort>("DEFAULT");
 const [toastKind,setToastKind]=useState<"pending"|"success"|"error">("success");
 const [orderType,setOrderType]=useState<"MARKET"|"LIMIT">("MARKET");
 const [side,setSide]=useState<"BUY"|"SELL">("BUY");
 const [amount,setAmount]=useState("");
 const [limitPrice,setLimitPrice]=useState("");
 const [sizeUnit,setSizeUnit]=useState<"USDT"|"COIN">("USDT");
 const [reduceOnly,setReduceOnly]=useState(false);
 const [marginMode,setMarginMode]=useState<"CROSS"|"ISOLATED">("CROSS");
 const [leverage,setLeverage]=useState(1);
 const [maxLeverage,setMaxLeverage]=useState<number|null>(null);
 const [leverageCaps,setLeverageCaps]=useState<Record<string,number>>({});
 const [confirmedLeverage,setConfirmedLeverage]=useState<Record<string,number>>({});
 const [performancePeriod,setPerformancePeriod]=useState<HideDexPerformancePeriod>("day");
 const [performanceMarket,setPerformanceMarket]=useState<HideDexPerformanceMarket>("all");
 const [tradesSymbol,setTradesSymbol]=useState<string|null>(null);
 const [tradesError,setTradesError]=useState("");
 const [fundingModal,setFundingModal]=useState<"deposit"|"withdraw"|null>(null);
 const [fundingNetwork,setFundingNetwork]=useState<AsterChainId>(56);
 const [fundingTarget,setFundingTarget]=useState<"perp"|"spot">("perp");
 const [fundingAmount,setFundingAmount]=useState("");
 const [withdrawFee,setWithdrawFee]=useState<string|null>(null);
 const [hideBalance,setHideBalance]=useState(false);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [tpsl,setTpsl]=useState<Raw|null>(null);
 const current=useMemo(()=>{const list=kind==="spot"?spotMarkets:markets;return list.find(m=>m.symbol===selectedSymbol)??list.find(m=>m.base==="BTC")??list[0]??null;},[kind,markets,spotMarkets,selectedSymbol]);
 // One exact original market selector with separate, venue-authentic Spot and Perp
 // assets. The shared selector only recognizes Spot if spotSymbol is real.
 const tokens=useMemo<TokenMetadata[]>(()=>[
  ...markets.map(m=>({...quoteMarkets(m),maxLeverage:leverageCaps[m.symbol]??m.maxLeverage??undefined})),
  ...spotMarkets.map(m=>({
   ...quoteMarkets(m),symbol:m.base+"-SPOT",name:m.base,
   category:"spot" as const,isSpotOnly:true,hasSpot:true,spotSymbol:m.symbol
  }))
 ],[markets,spotMarkets,leverageCaps]);
 const available=signedBalance(balances);
 const ownedSpot=(asset:string)=>spotBalances?.find(x=>x.asset===asset);
 const spotFree=kind==="spot"?num(ownedSpot(side==="BUY"?(current?.quote??"USDT"):(current?.base??""))?.free):null;
 const free=kind==="spot"?spotFree:(num(available?.availableBalance)??num(available?.balance));
 const activeOrders=kind==="spot"?spotOrders:openOrders;
 const positionRows=useMemo(()=>risk===null?null:risk.filter(r=>{const n=num(r.positionAmt);return n!==null&&n!==0;}),[risk]);
 const currentPosition=positionRows?.find(r=>r.symbol===current?.symbol);
 const hasOpposite=!!currentPosition&&((side==="SELL"&&(num(currentPosition.positionAmt)??0)>0)||(side==="BUY"&&(num(currentPosition.positionAmt)??0)<0));
 // The last authenticated public trade takes precedence over the 45s catalogue.
 // Never use bid/ask midpoint as a fake last-traded price.
 const marketPrice=lastLiveTrade?.symbol===current?.symbol&&lastLiveTrade?.kind===kind
  ?lastLiveTrade.price:current?.last??null;
 const price=orderType==="MARKET"?marketPrice:num(limitPrice);
 const size=price!==null&&price>0&&num(amount)!==null
   ?sizeUnit==="USDT"?Number(amount)/price:Number(amount):null;
 const orderValue=size!==null&&price!==null?size*price:null;
 const own=walletAddress.trim().toLowerCase();
 const leverageStorageKey="hidedex_aster_verified_leverage_"+own;
 const accountMarginBalance=num(futuresAccount?.totalMarginBalance);
 const accountMaintenanceMargin=num(futuresAccount?.totalMaintMargin);
 const accountMarginRatio=accountMarginBalance!==null&&accountMarginBalance>0&&accountMaintenanceMargin!==null&&accountMaintenanceMargin>=0
   ?100*accountMaintenanceMargin/accountMarginBalance:null;
 const asterPositionMargin=(r:Raw):number|null=>{
  const isolated=r.marginType==="isolated"?num(r.isolatedMargin):null;
  if(isolated!==null&&isolated>0)return isolated;
  const initial=num(r.initialMargin);
  return initial!==null&&initial>0?initial:null;
 };
 const asterPositionEstimate=(r:Raw):number|null=>{
  const signed=num(r.positionAmt),mark=num(r.markPrice),lev=num(r.leverage);
  return signed!==null&&mark!==null&&mark>0&&lev!==null&&lev>0?Math.abs(signed)*mark/lev:null;
 };
 const asterPositionModel=(r:Raw):Position=>{
  const signed=num(r.positionAmt)??0;
  const margin=asterPositionMargin(r);
  const pnl=num(r.unRealizedProfit);
  return {
   id:String(r.symbol??""),symbol:String(r.symbol??"").replace(/USDT$/,""),sourceCoin:String(r.symbol??""),
   type:signed>=0?"LONG":"SHORT",leverage:num(r.leverage)??0,size:Math.abs(signed),
   entryPrice:num(r.entryPrice)??0,markPrice:num(r.markPrice)??0,
   liqPrice:num(r.liquidationPrice)??0,margin:margin??0,
   unrealizedPnl:pnl??0,unrealizedPnlPercent:margin!==null&&margin>0&&pnl!==null?100*pnl/margin:0,
   marginType:r.marginType==="isolated"?"isolated":"cross",
   marginRatio:accountMarginRatio??undefined,
  };
 };
 // Aster Spot and Futures are separate signed ledgers. The Funds chart
 // must never reference an undefined total or assume unknown Spot = zero.
 const spotUsdtRow=spotBalances?.find(r=>r.asset==="USDT");
 const verifiedSpotUsdt=spotBalances===null?null:spotUsdtRow?num(spotUsdtRow.free):0;
 const spotLockedUsdt=spotBalances===null?null:spotUsdtRow?num(spotUsdtRow.locked):0;
 const totalSpotUsdt=verifiedSpotUsdt!==null&&spotLockedUsdt!==null
  ?verifiedSpotUsdt+spotLockedUsdt:null;
 const futuresTotalUsdt=num(available?.balance);
 const spotOtherHoldings=spotBalances?.some(r=>r.asset!=="USDT"&&
  ((num(r.free)??0)>0||(num(r.locked)??0)>0))??false;
 const combinedUsdt=futuresTotalUsdt!==null&&totalSpotUsdt!==null&&!spotOtherHoldings
  ?futuresTotalUsdt+totalSpotUsdt:null;

 // Only signed and response-confirmed market leverage preferences are cached.
 // The exchange's current risk record always overrides a stored hint.
 useEffect(()=>{
  let parsed:Record<string,number>={};
  if(/^0x[0-9a-f]{40}$/i.test(own)){
   try{
    const value=JSON.parse(localStorage.getItem(leverageStorageKey)??"{}");
    if(value&&typeof value==="object"&&!Array.isArray(value)){
     for(const [symbol,lev] of Object.entries(value)){
      if(/^[A-Z0-9]{3,32}$/.test(symbol)&&typeof lev==="number"&&
         Number.isSafeInteger(lev)&&lev>=1&&lev<=1000)parsed[symbol]=lev;
     }
    }
   }catch{ /* Browser storage unavailable: read from Aster signed account. */ }
  }
  setConfirmedLeverage(parsed);
 },[leverageStorageKey]);
 useEffect(()=>{setKind(initialKind);},[initialKind]);
 useEffect(()=>{let cancelled=false;const poll=()=>getAsterMarkets().then(list=>{
  if(cancelled)return;setMarkets(list);setMarketError("");
  if(list.length&&!list.some(x=>x.symbol===selectedSymbol))setSelectedSymbol(list[0].symbol);
 }).catch(e=>{if(!cancelled)setMarketError(sourceError(e));});
 void poll();const id=window.setInterval(poll,45_000);
 return()=>{cancelled=true;window.clearInterval(id);};},[]);
 useEffect(()=>{let cancelled=false;const poll=()=>getAsterSpotMarkets().then(list=>{
   if(cancelled)return;
   setSpotMarkets(list);
   setSpotMarketError(list.length===0?"Aster Spot API returned no verified active USDT pairs.":"");
 }).catch(e=>{if(!cancelled){setSpotMarkets([]);setSpotMarketError(sourceError(e));}});
 void poll();const id=window.setInterval(poll,60_000);return()=>{cancelled=true;window.clearInterval(id);};},[]);
 // Read-only Aster mainnet market-data feed. This updates the ORIGINAL
 // HideDexOrderBookPanel and price/header; it is not a new book UI or signer.
 // Partial depth20 streams are complete TOP-20 snapshots (NOT diff updates).
 useEffect(()=>{
  const symbol=current?.symbol;
  if(!symbol||!/^[A-Z0-9]{3,32}$/.test(symbol))return;
  let stopped=false,connection:WebSocket|null=null;
  let reconnectTimer:ReturnType<typeof setTimeout>|null=null;
  let bookFlush:ReturnType<typeof setTimeout>|null=null;
  let flashClear:ReturnType<typeof setTimeout>|null=null;
  let shownBook:{asks:AsterLevel[];bids:AsterLevel[]}|null=null;
  let tradeFlush:ReturnType<typeof setTimeout>|null=null;
  let waitingBook:{asks:AsterLevel[];bids:AsterLevel[]}|null=null;
  let waitingTrade:number|null=null;
  let lastBook=0,lastTrade=0,retries=0;
  setDepth(null);setBookFlashes({});setLastLiveTrade(null);
  const parseSide=(raw:unknown,ask:boolean):AsterLevel[]|null=>{
   if(!Array.isArray(raw))return null;
   const sorted=raw.flatMap(item=>{
    if(!Array.isArray(item)||item.length<2)return[];
    const price=num(item[0]),size=num(item[1]);
    return price!==null&&price>0&&size!==null&&size>0?[{price,size}]:[];
   }).sort((a,b)=>ask?a.price-b.price:b.price-a.price).slice(0,20);
   if(!sorted.length)return null;
   let total=0;return sorted.map(row=>({...row,total:(total+=row.size)}));
  };
  const flushBook=()=>{
   bookFlush=null;
   if(stopped||!waitingBook)return;
   const next=waitingBook;
   const flashes:Record<string,"BUY"|"SELL">={};
   if(shownBook){
    for(const [side,previous,latest] of [
      ["SELL",shownBook.asks,next.asks],["BUY",shownBook.bids,next.bids]
    ] as const){
     const prev=new Map(previous.map(level=>[level.price,level.size]));
     for(const level of latest){
      const prior=prev.get(level.price);
      if(prior!==undefined&&prior!==level.size)
       flashes[level.price.toString()]=side;
     }
    }
   }
   shownBook=next;setDepth(next);waitingBook=null;
   if(Object.keys(flashes).length){
    setBookFlashes(flashes);
    if(flashClear)clearTimeout(flashClear);
    flashClear=setTimeout(()=>{if(!stopped)setBookFlashes({});},450);
   }
  };
  const flushTrade=()=>{
   tradeFlush=null;
   if(stopped||waitingTrade===null)return;
   setLastLiveTrade({symbol,kind,price:waitingTrade});waitingTrade=null;
  };
  const fallbackDepth=async()=>{
   if(stopped||Date.now()-lastBook<3000)return;
   try{
    const value=await (kind==="spot"?getAsterSpotDepth(symbol):getAsterDepth(symbol));
    if(!stopped&&Date.now()-lastBook>=3000){shownBook=value;setDepth(value);}
   }catch{ /* Preserve the last verified book on transient REST errors. */ }
  };
  const fallbackPrice=async()=>{
   if(stopped||Date.now()-lastTrade<3500)return;
   try{
    const url=(kind==="spot"?"https://sapi.asterdex.com/api/v3/ticker/price?symbol=":
       "https://fapi.asterdex.com/fapi/v3/ticker/price?symbol=")+encodeURIComponent(symbol);
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    if(!response.ok) return;
    const data=obj(await response.json());
    const price=num(data?.price);
    if(!stopped&&Date.now()-lastTrade>=3500&&data?.symbol===symbol&&price!==null&&price>0)
     setLastLiveTrade({symbol,kind,price});
   }catch{ /* Catalogue price remains a read-only last-price fallback. */ }
  };
  const connect=()=>{
   if(stopped)return;
   try{
    const base=kind==="spot"?"wss://sstream.asterdex.com":"wss://fstream.asterdex.com";
    const stream=symbol.toLowerCase();
    const ws=new WebSocket(base+"/stream?streams="+stream+"@aggTrade/"+stream+"@depth20@100ms");
    connection=ws;
    ws.onopen=()=>{if(!stopped)retries=0;};
    ws.onmessage=event=>{
     if(stopped||typeof event.data!=="string")return;
     let frame:unknown;
     try{frame=JSON.parse(event.data);}catch{return;}
     const wrapper=obj(frame),message=obj(wrapper?.data??frame);
     if(!message||message.s!==symbol)return;
     const streamName=String(wrapper?.stream??"");
     if(message.e==="aggTrade"||streamName.endsWith("@aggTrade")){
      const value=num(message.p);
      if(value!==null&&value>0){
       lastTrade=Date.now();waitingTrade=value;
       if(!tradeFlush)tradeFlush=setTimeout(flushTrade,150);
      }
     }else if(streamName.includes("@depth20")&&Array.isArray(message.a)&&Array.isArray(message.b)){
      const asks=parseSide(message.a,true),bids=parseSide(message.b,false);
      if(asks&&bids){
       lastBook=Date.now();waitingBook={asks,bids};
       if(!bookFlush)bookFlush=setTimeout(flushBook,170);
      }
     }
    };
    ws.onerror=()=>{try{ws.close();}catch{}};
    ws.onclose=()=>{
     if(stopped)return;
     if(connection===ws)connection=null;
     const delay=Math.min(12000,1000*Math.pow(2,Math.min(retries++,4)));
     reconnectTimer=setTimeout(connect,delay);
    };
   }catch{
    if(!stopped)reconnectTimer=setTimeout(connect,5000);
   }
  };
  void fallbackDepth();void fallbackPrice();connect();
  const restTimer=window.setInterval(()=>{
   void fallbackDepth();void fallbackPrice();
  },4000);
  return()=>{
   stopped=true;window.clearInterval(restTimer);
   if(reconnectTimer)clearTimeout(reconnectTimer);
   if(bookFlush)clearTimeout(bookFlush);
   if(tradeFlush)clearTimeout(tradeFlush);
   if(flashClear)clearTimeout(flashClear);
   const old=connection;connection=null;
   if(old){old.onclose=null;old.onmessage=null;old.onerror=null;old.close();}
  };
 },[current?.symbol,kind]);
 useEffect(()=>{let stopped=false;setIdentity(null);setBalances(null);setFuturesAccount(null);setSpotBalances(null);setSpotMode(null);setSpotOrders(null);setRisk(null);setOpenOrders(null);setTrades(null);setAccountError("");
 if(!/^0x[0-9a-f]{40}$/i.test(walletAddress)){setRestoring(false);return;}
 setRestoring(true);
 void restoreAsterSigner(walletAddress).then(x=>{if(!stopped){setIdentity(x);if(x)setReload(v=>v+1);}})
 .catch(e=>{if(!stopped)setAccountError(sourceError(e));})
 .finally(()=>{if(!stopped)setRestoring(false);});
 return()=>{stopped=true;};
 },[own]);
 const refresh=useCallback(async()=>{
  if(!walletAddress||!identity)return;
  try{
   const spot=await asterSignedSpotRead(walletAddress,"/api/v3/account");
   const account=obj(spot.data);
   if(!Array.isArray(account?.balances))throw Error("Aster Spot account response missing balances");
   setSpotMode(spot.mode);setSpotBalances(rows(account.balances));
   try{const orders=await asterSignedSpotRead(walletAddress,"/api/v3/openOrders");
    setSpotOrders(rows(orders.data));}catch{setSpotOrders(null);}
  }catch{setSpotMode(null);setSpotBalances(null);setSpotOrders(null);}
  try{
   const data=await asterReadAccount(walletAddress);
   setIdentity(data.identity);setBalances(rows(data.balance));setFuturesAccount(obj(data.account));setRisk(rows(data.positions));
   setOpenOrders(rows(data.orders));setAccountError("");
  }catch(e){
   setBalances(null);setFuturesAccount(null);setRisk(null);setOpenOrders(null);setAccountError(sourceError(e));
  }
 },[walletAddress,identity?.agent]);
 useEffect(()=>{if(!identity)return;let cancelled=false;
 const read=()=>void refresh().catch(e=>{if(!cancelled)setAccountError(sourceError(e));});
 void read();const id=window.setInterval(read,30_000);
 return()=>{cancelled=true;window.clearInterval(id);};
 },[identity?.agent,own,reload]);
 useEffect(()=>{
  const shouldRead=tab==="TRADE_HISTORY"||
   (section==="orders"&&p.initialOrdersTab==="TRADE_HISTORY")||section==="funds";
  const symbol=kind==="perp"?current?.symbol:null;
  setTrades(null);setTradesSymbol(null);setTradesError("");
  if(!shouldRead||!identity?.mode||!symbol)return;
  let gone=false;
  void asterSignedRead(walletAddress,"/fapi/v3/userTrades",{symbol,limit:"500"})
   .then(({data})=>{
    if(gone)return;
    if(!Array.isArray(data))throw Error("Aster trade history response not verified");
    setTrades(rows(data));setTradesSymbol(symbol);setTradesError("");
   })
   .catch(e=>{if(!gone){setTrades(null);setTradesSymbol(null);setTradesError(sourceError(e));}});
  return()=>{gone=true;};
 },[tab,identity?.agent,current?.symbol,reload,kind,section,p.initialOrdersTab]);
 // Aster V3 supports a single signed leverageBrackets query without symbol:
 // the entire per-market verified cap catalogue can populate Market Selector.
 useEffect(()=>{
  setLeverageCaps({});
  if(!identity?.mode||!walletAddress)return;
  let stopped=false;
  void asterSignedRead(walletAddress,"/fapi/v3/leverageBrackets")
   .then(({data})=>{
    if(stopped)return;
    const items=Array.isArray(data)?rows(data):obj(data)?[obj(data)!]:[];
    const caps:Record<string,number>={};
    for(const item of items){
     if(typeof item.symbol!=="string"||!Array.isArray(item.brackets))continue;
     const brackets=rows(item.brackets);
     const initial=brackets.map(b=>num(b.initialLeverage)).filter((n):n is number=>n!==null&&Number.isInteger(n)&&n>0);
     if(initial.length)caps[item.symbol]=Math.max(...initial);
    }
    setLeverageCaps(caps);
   })
   .catch(()=>{if(!stopped)setLeverageCaps({});});
  return()=>{stopped=true;};
 },[identity?.agent,own,identity?.mode?.order]);
 useEffect(()=>{
  if(kind!=="perp"||!current){setMaxLeverage(null);return;}
  const cached=leverageCaps[current.symbol];
  if(cached){setMaxLeverage(cached);return;}
  setMaxLeverage(current.maxLeverage);
  if(!identity?.mode||!walletAddress)return;
  let stopped=false;
  void asterSignedRead(walletAddress,"/fapi/v3/leverageBrackets",{symbol:current.symbol})
   .then(({data})=>{
    if(stopped)return;
    const item=Array.isArray(data)?rows(data).find(r=>r.symbol===current.symbol):obj(data);
    if(item?.symbol!==current.symbol)return;
    const brackets=rows(item.brackets);
    const initial=brackets.map(b=>num(b.initialLeverage)).filter((n):n is number=>n!==null&&Number.isInteger(n)&&n>0);
    if(!initial.length)return;
    const cap=Math.max(...initial);
    setLeverageCaps(prev=>({...prev,[current.symbol]:cap}));
    setMaxLeverage(cap);
   }).catch(()=>{ /* No unverified default leverage is shown. */ });
  return()=>{stopped=true;};
 },[current?.symbol,kind,leverageCaps[current?.symbol??""],identity?.agent,identity?.mode?.order]);
 // Restore each pair independently. Aster positionRisk may include flat
 // rows even for zero positions; respect any verified per-symbol setting.
 useEffect(()=>{
  if(kind!=="perp"||!current){setLeverage(1);return;}
  const row=risk?.find(r=>r.symbol===current.symbol&&num(r.leverage)!==null);
  const server=num(row?.leverage),saved=confirmedLeverage[current.symbol];
  const cap=leverageCaps[current.symbol]??current.maxLeverage??null;
  const next=server!==null&&server>=1?server:
   typeof saved==="number"&&Number.isSafeInteger(saved)&&saved>=1?saved:1;
  setLeverage(cap!==null?Math.min(next,cap):next);
  if(row?.marginType==="isolated")setMarginMode("ISOLATED");
  else if(row?.marginType==="cross")setMarginMode("CROSS");
  else setMarginMode("CROSS");
 },[kind,current?.symbol,risk,confirmedLeverage,leverageCaps]);
 useEffect(()=>{if(!fundingModal||fundingModal!=="withdraw")return;
 setWithdrawFee(null);void asterWithdrawQuote(fundingNetwork).then(setWithdrawFee).catch(e=>setNotice(sourceError(e)));
 },[fundingModal,fundingNetwork]);
 const act=async(label:string,fn:()=>Promise<unknown>):Promise<boolean>=>{
  if(busy)return false;
  setBusy(true);setNotice(label+" request in progress…");setToastKind("pending");
  try{
   await fn();
   setNotice(label+" accepted by Aster. Refreshing verified account state.");
   setToastKind("success");setReload(v=>v+1);
   return true;
  }catch(e){
   setNotice(sourceError(e));setToastKind("error");return false;
  }finally{setBusy(false);}
 };
 const enable=async()=>{
  if(!walletAddress)return;setBusy(true);setNotice("");
  try{
   const provider=await getWalletProvider();
   const granted=await authorizeAsterAgent(walletAddress,provider);
   setIdentity(granted);setAuthOpen(false);setToastKind("success");setNotice("Agent registered. Verifying Aster V3 signed account read; deposit may be required first.");
   setReload(v=>v+1);
  }catch(e){setToastKind("error");setNotice(sourceError(e));setAuthOpen(false);}
  finally{setBusy(false);}
 };
 const order=async()=>{
  if(kind==="perp"&&!perpTradingApproved){
   setToastKind("error");
   setNotice("Perpetual trading requires approved Early Access. Spot trading is available.");
   return;
  }
  if(!walletAddress){onConnectWallet();return;}
  if(!identity){setAuthOpen(true);return;}
  const mode=kind==="spot"?spotMode:identity.mode;
  if(!mode){setToastKind("error");setNotice(accountError||"Aster signed "+kind+" account verification required. No order sent.");return;}
  if(!current||size===null||price===null||size<=0||price<=0){setToastKind("error");setNotice("Select a valid Aster market, price and size.");return;}
  await act("Order",async()=>{
   if(!current)return;
   const qty=quantize(size,current.step);
   if(current.minQty!==null&&Number(qty)<current.minQty)throw Error("Below Aster minimum order quantity");
   if(current.minNotional!==null&&Number(qty)*price<current.minNotional)throw Error("Below Aster minimum notional");
   const params:Record<string,string>={symbol:current.symbol,side,type:orderType,quantity:qty};
   if(orderType==="LIMIT"){params.timeInForce="GTC";params.price=quantize(price,current.tick);}
   if(kind==="spot"){
     if(orderType==="MARKET"&&side==="BUY"&&sizeUnit==="USDT"){
       delete params.quantity;params.quoteOrderQty=String(Number(amount));
     }
     if(free===null)throw Error("Aster Spot available balance is unverified");
     if(side==="BUY"&&orderValue!==null&&orderValue>free)throw Error("Insufficient verified Spot quote balance");
     if(side==="SELL"&&size>free)throw Error("Insufficient verified Spot asset balance");
     return asterSignedSpotWrite(walletAddress,mode!,"/api/v3/order","POST",params);
   }
   if(reduceOnly){if(!hasOpposite)throw Error("Reduce Only requires opposite verified position");params.reduceOnly="true";}
   return asterSignedWrite(walletAddress,mode!,"/fapi/v3/order","POST",params);
  });
 };
 const closePos=async(pos:Raw,percent:number)=>{
  if(!identity?.mode||!walletAddress)throw Error("Aster account is not verified");
  if(pos.positionSide&&pos.positionSide!=="BOTH")throw Error("Hedge positions need explicit positionSide support. No close sent.");
  await act("Close",async()=>{
   const symbol=String(pos.symbol||""),fresh=await asterSignedRead(walletAddress,"/fapi/v3/positionRisk",{symbol});
   const latest=rows(fresh.data).find(x=>x.symbol===symbol&&(!x.positionSide||x.positionSide==="BOTH"));
   const signed=num(latest?.positionAmt);if(signed===null||signed===0)throw Error("Position already closed");
   const market=markets.find(x=>x.symbol===symbol);if(!market)throw Error("Aster market filters unavailable");
   const qty=quantize(Math.abs(signed)*percent/100,market.step);
   return asterSignedWrite(walletAddress,identity.mode!,"/fapi/v3/order","POST",{
    symbol,side:signed>0?"SELL":"BUY",type:"MARKET",quantity:qty,reduceOnly:"true"
   });
  });
 };
 // Same verified Aster trigger route, displayed with the existing HideDex sheet.
 const sendTrigger=async(tpPrice:number|null,slPrice:number|null,overrideTarget?:Raw)=>{
  if(!identity?.mode||!walletAddress)throw Error("Aster signer not verified");
  if(tpPrice===null&&slPrice===null)return;
  const target=overrideTarget??tpsl;
  if(!target)throw Error("Aster position not selected");
  const accepted=await act("TP / SL",async()=>{
   const symbol=String(target.symbol??"");
   const market=markets.find(m=>m.symbol===symbol);
   if(!market)throw Error("Aster market filters unavailable");
   const current=await asterSignedRead(walletAddress,"/fapi/v3/positionRisk",{symbol});
   const matching=rows(current.data).find(x=>x.symbol===symbol&&(!x.positionSide||x.positionSide==="BOTH"));
   const amt=num(matching?.positionAmt);
   if(amt===null||amt===0)throw Error("Position closed or unverified");
   const side=amt>0?"SELL":"BUY";
   for(const [kind,trigger] of [["tp",tpPrice],["sl",slPrice]] as const){
    if(trigger===null)continue;
    if(!Number.isFinite(trigger)||trigger<=0)throw Error("Invalid Aster trigger price");
    await asterSignedWrite(walletAddress,identity.mode!,"/fapi/v3/order","POST",{
     symbol,side,type:kind==="tp"?"TAKE_PROFIT_MARKET":"STOP_MARKET",
     closePosition:"true",stopPrice:quantize(trigger,market.tick),workingType:"MARK_PRICE"
    });
   }
  });
  if(accepted)setTpsl(null);
  else throw Error("Aster trigger was not accepted; check the order state.");
 };
 const cancel=async(orderId:string,symbol:string)=>{
  if(!(kind==="spot"?spotMode:identity?.mode))return;
  await act("Cancel",async()=>kind==="spot"&&spotMode
    ? asterSignedSpotWrite(walletAddress,spotMode,"/api/v3/order","DELETE",{symbol,orderId})
    : asterSignedWrite(walletAddress,identity.mode!,"/fapi/v3/order","DELETE",{symbol,orderId}));
 };
 const changeLev=async(next:number)=>{
  if(!identity?.mode||!current||maxLeverage===null||busy||
     !Number.isSafeInteger(next)||next>maxLeverage||next<1)return;
  const symbol=current.symbol;
  setBusy(true);
  // No success popup for leverage changes; an error is still actionable.
  if(notice.toLowerCase().includes("leverage"))setNotice("");
  try{
   const response=await asterSignedWrite(walletAddress,identity.mode,"/fapi/v3/leverage","POST",{
    symbol,leverage:String(next)
   });
   const ack=obj(response);
   const verified=num(ack?.leverage);
   if(ack?.symbol!==symbol||verified!==next)throw Error("Aster has not confirmed this leverage. Refresh the account and retry.");
   const updated={...confirmedLeverage,[symbol]:verified};
   setConfirmedLeverage(updated);
   try{localStorage.setItem(leverageStorageKey,JSON.stringify(updated));}catch{}
   setReload(v=>v+1);
  }catch(e){
   setToastKind("error");setNotice(sourceError(e));
   setReload(v=>v+1);
  }finally{setBusy(false);}
 };
 const changeMargin=async(next:"CROSS"|"ISOLATED")=>{
  if(!identity?.mode||!current)return;
  await act("Margin mode",async()=>asterSignedWrite(walletAddress,identity.mode!,"/fapi/v3/marginType","POST",{symbol:current.symbol,marginType:next==="CROSS"?"CROSSED":"ISOLATED"}));
 };
 const history:HideDexHistoryRow[]|null=trades===null?null:trades.flatMap((r,i)=>{
  const px=num(r.price),qty=num(r.qty);if(px===null||qty===null)return[];
  return[{id:String(r.id??i),symbol:String(r.symbol??current?.base??"—"),side:r.side==="SELL"?"SELL" as const:"BUY" as const,
   isSpot:false,price:px,size:qty,value:px*qty,
   realizedPnl:num(r.realizedPnl),fee:num(r.commission),
   timestamp:new Date(num(r.time)??Date.now()).toLocaleString()}];
 });
 const orderRows:HideDexOpenOrderRow[]|null=activeOrders===null?null:activeOrders.flatMap((r,i)=>{
  const id=r.orderId!=null?String(r.orderId):"";if(!id||typeof r.symbol!=="string")return[];
  const original=num(r.origQty),executed=num(r.executedQty),trigger=Boolean(r.stopPrice&&Number(r.stopPrice)>0);
  return[{id,symbol:String(r.symbol).replace(/USDT$/,""),isSpot:kind==="spot",
   side:r.side==="SELL"?"SELL" as const:"BUY" as const,
   orderType:String(r.type??"—"),priceLabel:String(trigger?r.stopPrice:r.price??"—"),trigger,
   sizeLabel:String(r.origQty??"—"),filledLabel:executed===null?"—":String(executed),
   remainingLabel:original!==null&&executed!==null?fmt(original-executed,8):"—",
   status:String(r.status??"OPEN"),timestamp:num(r.time)!==null?new Date(Number(r.time)).toLocaleString():"—",canCancel:kind==="spot"?!!spotMode:!!identity?.mode}];
 });
 const balanceSource=kind==="spot"?spotBalances:balances;
 const balanceItems:HideDexBalanceItem[]|null=balanceSource===null?null:balanceSource.map((r,i)=>({
  id:String(r.asset??i),symbol:String(r.asset??"—"),name:kind==="spot"?"Aster Spot":"Aster Futures",
  total:kind==="spot"?(num(r.free)!==null&&num(r.locked)!==null?Number(r.free)+Number(r.locked):null):num(r.balance),
  available:kind==="spot"?num(r.free):num(r.availableBalance),locked:kind==="spot"?num(r.locked):null,valueUsd:null,allocationPercent:null
 }));
 const sortedPositions=useMemo(()=>{
   if(!positionRows)return null;
   const list=[...positionRows];
   if(positionSort==="SYMBOL")list.sort((a,b)=>String(a.symbol??"").localeCompare(String(b.symbol??"")));
   if(positionSort==="SIZE")list.sort((a,b)=>Math.abs(num(b.positionAmt)??0)-Math.abs(num(a.positionAmt)??0));
   if(positionSort==="PNL")list.sort((a,b)=>(num(b.unRealizedProfit)??-Infinity)-(num(a.unRealizedProfit)??-Infinity));
   return list;
 },[positionRows,positionSort]);
 const allExpanded=!!sortedPositions?.length&&sortedPositions.every(r=>!!expanded[String(r.symbol)]);
 const managerOrders:OpenOrder[]|null=activeOrders===null?null:activeOrders.flatMap(r=>{
  if(typeof r.symbol!=="string"||r.orderId==null)return[];
  const rawType=String(r.type??"").toUpperCase();
  const isTp=rawType.includes("TAKE_PROFIT"),isSl=rawType.includes("STOP");
  const isTrigger=isTp||isSl||(num(r.stopPrice)??0)>0;
  const t=rawType==="LIMIT"?"LIMIT" as const:isTrigger?"TRIGGER" as const:"UNKNOWN" as const;
  const state=String(r.status??"NEW").toUpperCase();
  const stat=state==="FILLED"?"FILLED" as const:state==="CANCELED"?"CANCELLED" as const:
    state==="PARTIALLY_FILLED"?"PARTIAL" as const:"OPEN" as const;
  const trigger=num(r.stopPrice)??0, px=num(r.price)??0,quantity=num(r.origQty)??0;
  return [{
    id:String(r.orderId),symbol:r.symbol.replace(/USDT$/,""),sourceCoin:r.symbol,
    type:t,side:r.side==="SELL"?"SELL" as const:"BUY" as const,
    price:isTrigger&&trigger>0?trigger:px,size:quantity,filled:num(r.executedQty)??0,
    status:stat,timestamp:num(r.time)!==null?new Date(Number(r.time)).toLocaleString():"—",
    triggerPrice:trigger>0?trigger:undefined,isTrigger,tpsl:isTp?"tp" as const:isSl?"sl" as const:undefined,
    isSpot:kind==="spot"
  }];
 });
 const managerTrades:TradeHistoryItem[]|null=trades===null?null:trades.flatMap((r,i)=>{
   const px=num(r.price),qty=num(r.qty),fee=num(r.commission),time=num(r.time);
   if(px===null||qty===null||fee===null||time===null||typeof r.symbol!=="string")return[];
   return [{id:String(r.id??i),symbol:r.symbol.replace(/USDT$/,""),
    side:r.side==="SELL"?"SELL" as const:"BUY" as const,
    price:px,size:qty,value:px*qty,fee,timestamp:new Date(time).toLocaleString(),
    timestampMs:time,pnl:num(r.realizedPnl)??undefined,isSpot:kind==="spot"}];
 });
 // Official Aster signed userTrades is scoped to ONE futures symbol.
 // Never present this sample as all-venue total volume or full equity history.
 const asterAnalytics=useMemo(()=>{
  if(!trades||!tradesSymbol||kind!=="perp"||tradesSymbol!==current?.symbol)return null;
  const days=performancePeriod==="day"?1:performancePeriod==="week"?7:
   performancePeriod==="month"?30:null;
  const cutoff=days===null?0:Date.now()-days*86400000;
  let volume=0,realized=0,fees=0,volumeKnown=true,pnlKnown=true,feeKnown=true,idsKnown=true;
  const ids=new Set<string>();
  const loaded: Array<{time:number;px:number;sz:number;coin:string}>=[];
  const pnlFills: Array<{time:number;pnl:number}>=[];
  for(const r of trades){
   const time=num(r.time),px=num(r.price),qty=num(r.qty);
   if(time===null||time<=0||time<cutoff||r.symbol!==tradesSymbol)continue;
   if(px===null||px<=0||qty===null||qty<=0)volumeKnown=false;
   else{volume+=px*qty;loaded.push({time,px,sz:qty,coin:tradesSymbol});}
   const pnl=num(r.realizedPnl);
   if(pnl===null)pnlKnown=false;
   else{realized+=pnl;pnlFills.push({time,pnl});}
   const fee=num(r.commission);
   if(fee===null||String(r.commissionAsset??"").toUpperCase()!=="USDT")feeKnown=false;
   else fees+=fee;
   if(r.orderId===undefined||r.orderId===null)idsKnown=false;
   else ids.add(String(r.orderId));
  }
  const count=trades.filter(r=>r.symbol===tradesSymbol&&
   (num(r.time)??0)>=cutoff).length;
  // This is NOT an equity or account-value series: it sums Aster's actual
  // realizedPnl fields of loaded userTrades for the selected perp only.
  const pnlSeries: Array<{timestamp:number;value:number}>=[];
  if(pnlKnown&&pnlFills.length){
   let total=0;
   for(const fill of pnlFills.sort((a,b)=>a.time-b.time)){
    total+=fill.pnl;
    const last=pnlSeries[pnlSeries.length-1];
    if(last?.timestamp===fill.time)last.value=total;
    else pnlSeries.push({timestamp:fill.time,value:total});
   }
  }
  return {
   volume:volumeKnown?volume:null,
   pnl:pnlKnown?realized:null,
   fees:feeKnown?fees:null,
   orders:idsKnown?ids.size:null,
   count,loaded,pnlSeries
  };
 },[trades,tradesSymbol,current?.symbol,kind,performancePeriod]);
 const showPerpPerformance=kind==="perp"&&performanceMarket!=="spot";
 const performanceLoaded=showPerpPerformance?asterAnalytics:null;
 const accountPanel=<HideDexUnifiedAccountPanel
  tabs={<TradingAccountTabBar activeTab={tab} onSelect={setTab}
   positionsCount={kind==="spot"?0:positionRows?.length} ordersCount={activeOrders?.length}/>}
  actions={tab==="POSITIONS"&&kind==="perp"&&<HideDexPositionActionBar
   sort={positionSort} onSort={setPositionSort} supportedSorts={["DEFAULT","SYMBOL","SIZE","PNL"]}
   allExpanded={allExpanded}
   onToggleAll={()=>{const keys=(positionRows??[]).map(r=>String(r.symbol));setExpanded(Object.fromEntries(keys.map(k=>[k,!allExpanded])));}}
   // The original toolbar has a Close All control. Until batch-close is
   // verified on Aster, keep it visibly disabled rather than sending orders.
   onCloseAll={()=>{}} closeDisabled
  />}
  >
  {tab==="BALANCES"&&<HideDexBalancesView items={balanceItems} unavailableMessage={accountError||"Connect and verify your Aster trading account."}/>}
  {tab==="POSITIONS"&&kind==="spot"?<p className="text-xs text-brand-muted py-6">Spot holdings appear in Balances. There are no Spot leveraged positions.</p>:tab==="POSITIONS"&&(sortedPositions===null?
   <p className="text-xs text-brand-muted py-6 text-center">{accountError||"Aster positions not verified."}</p>:
   sortedPositions.length===0?<p className="text-xs text-brand-muted py-6 text-center">No active Aster positions.</p>:
   <div className="flex flex-col gap-3 w-full pr-1 overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent" id="positions-card-container">{sortedPositions.map((r,i)=>{
    const signed=num(r.positionAmt)??0,symbol=String(r.symbol??""),coin=symbol.replace(/USDT$/,""),priceNum=num(r.markPrice),entry=num(r.entryPrice),
    pnl=num(r.unRealizedProfit),liquid=num(r.liquidationPrice),lev=num(r.leverage);
    const knownMargin=asterPositionMargin(r),estMargin=asterPositionEstimate(r);
    const roi=knownMargin!==null&&knownMargin>0&&pnl!==null?100*pnl/knownMargin:null;
    const triggers=(openOrders??[]).filter(o=>o.symbol===symbol&&(num(o.stopPrice)??0)>0);
    const tp=triggers.find(o=>String(o.type).toUpperCase().includes("TAKE_PROFIT"));
    const sl=triggers.find(o=>String(o.type).toUpperCase().includes("STOP"));
    const target=openOrders===null?"—":
      [tp?"TP $"+fmt(num(tp.stopPrice),4):"",sl?"SL $"+fmt(num(sl.stopPrice),4):""].filter(Boolean).join(" · ")||"Not set";
    return <HideDexPositionCard key={String(r.symbol)+":"+i}><HideDexPositionHeader
     symbol={coin} side={signed>0?"LONG":"SHORT"} isExpanded={!!expanded[String(r.symbol)]}
     onToggle={()=>setExpanded(prev=>({...prev,[String(r.symbol)]:!prev[String(r.symbol)]}))}
     marginLabel={r.marginType==="isolated"?"Isolated":r.marginType==="cross"?"Cross":null}
     leverageLabel={lev!==null?lev+"x":undefined} pnl={pnl} roi={roi}/>
     {expanded[String(r.symbol)]&&<HideDexPositionDetails
      left={[
       {label:"Position Size",value:fmt(Math.abs(signed),8)+" "+coin,
        hint:entry!==null&&entry>0?"($"+fmt(Math.abs(signed)*entry)+")":undefined},
       {label:"Entry Price",value:entry!==null&&entry>0?"$"+fmt(entry,4):"—"},
       {label:"Account Margin Ratio",value:accountMarginRatio!==null?fmt(accountMarginRatio,2)+"%":"—",
        tone:accountMarginRatio!==null?"profit":"muted"},
       {label:"Liquidation Price",value:liquid!==null&&liquid>0?"$"+fmt(liquid,4):"—",
        tone:liquid!==null&&liquid>0?"loss":"muted"},
      ]}
      right={[
       {label:knownMargin!==null?(r.marginType==="isolated"?"Margin Used":"Initial Margin"):"Initial Margin (est.)",
        value:knownMargin!==null?"$"+fmt(knownMargin,4):estMargin!==null?"≈$"+fmt(estMargin,4):"—",
        tone:knownMargin!==null||estMargin!==null?"profit":"muted"},
       {label:"Mark Price",value:priceNum!==null&&priceNum>0?"$"+fmt(priceNum,4):"—"},
       {label:"TP / SL Target",value:target,tone:"muted"},
      ]}
      actions={<HideDexPositionActions
       onTpSl={()=>setTpsl(r)}
       onClose={()=>void closePos(r,100)}
       tpSlDisabled={busy||!identity?.mode||entry===null||entry<=0}
       closeDisabled={busy||!identity?.mode}
      />}
     />}
    </HideDexPositionCard>;
   })}</div>)}
  {tab==="OPEN_ORDERS"&&<HideDexOpenOrders orders={orderRows} unavailableMessage={accountError||"Verify Aster open orders."} onCancel={o=>{const matched=activeOrders?.find(x=>String(x.orderId)===o.id);if(matched)void cancel(o.id,String(matched.symbol));}}/>}
  {tab==="TRADE_HISTORY"&&<HideDexTradeHistory items={history} noDataMessage="No verified Aster trade history for this market."/>}
 </HideDexUnifiedAccountPanel>;
 const placeForm=<HideDexUnifiedOrderForm
  connected={!!walletAddress} onConnect={onConnectWallet}
  onSubmit={e=>e.preventDefault()}
  selectors={{isPerp:kind==="perp",orderType,onOrderType:v=>{if(v==="MARKET"||v==="LIMIT")setOrderType(v);},
   availableOrderTypes:["MARKET","LIMIT"],marginMode,
   onMarginMode:kind==="perp"&&perpTradingApproved&&identity?.mode?next=>{setMarginMode(next);void changeMargin(next);}:undefined,
   leverage, maxLeverage, onLeverage:kind==="perp"&&perpTradingApproved&&identity?.mode?setLeverage:undefined,
   onLeverageCommit:kind==="perp"&&perpTradingApproved&&identity?.mode?next=>void changeLev(next):undefined,
   leverageDisabled:!identity?.mode||maxLeverage===null||(kind==="perp"&&!perpTradingApproved)}}
  side={{isPerp:kind==="perp",side,onSide:setSide,available:free!==null?fmt(free,5)+" "+(kind==="spot"&&side==="SELL"?current?.base??"COIN":"USDT"):"—"}}
  basic={{type:orderType,price:limitPrice,onPrice:setLimitPrice,midPrice:marketPrice,
   size:amount,onSize:setAmount,sizeUnit:sizeUnit==="USDT"?"USDT":current?.base??"COIN",
   onToggleUnit:()=>{if(price&&num(amount)!==null&&price>0)
    setAmount(String(sizeUnit==="USDT"?Number(amount)/price:Number(amount)*price));
    else setAmount("");setSizeUnit(v=>v==="USDT"?"COIN":"USDT");}}}
  advancedFields={kind==="perp"&&!perpTradingApproved?
   <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
    Perpetual trading requires approved Early Access. Charts remain available; Spot is open.
   </p>:undefined}
  presets={{disabled:free===null||marketPrice===null||marketPrice<=0,onSelect:pct=>{
   if(free===null||marketPrice===null||marketPrice<=0)return;
   const spend=free*pct/100;
   const notional=kind==="spot"&&side==="SELL"?spend*marketPrice:spend*(kind==="perp"?leverage:1);
   const coin=kind==="spot"&&side==="SELL"?spend:notional/marketPrice;
   setAmount(String(sizeUnit==="USDT"?Number(notional.toFixed(4)):Number(coin.toFixed(8))));
  }}}
  options={{visible:kind==="perp",reduce:{checked:reduceOnly,onChange:setReduceOnly,disabled:!hasOpposite||busy},tpsl:{checked:false,onChange:()=>{},disabled:true}}}
  summary={{isPerp:kind==="perp",liquidation:"—",orderValue:orderValue!==null?"$"+fmt(orderValue):"—",margin:orderValue!==null&&leverage>0?"≈$"+fmt(orderValue/leverage):"—"}}
  // Authorizing the trading agent must not require choosing a market or
  // entering a nonzero order size. Validate order size only AFTER an agent
  // exists; never trigger authorization automatically during restore.
  place={{type:"button",side,busy,
   disabled:(kind==="perp"&&!perpTradingApproved)||busy||restoring||(identity!==null&&(!current||size===null||size<=0)),
   onClick:()=>void order(),
   label:kind==="perp"&&!perpTradingApproved?"PERPETUAL LOCKED":busy?"Processing…":restoring?"RESTORING ASTER AGENT":!identity?"ENABLE TRADING":(kind==="spot"&&!spotMode||kind==="perp"&&!identity.mode)?"VERIFY ASTER ACCOUNT":"PLACE "+(kind==="spot"?(side==="BUY"?"BUY":"SELL"):(side==="BUY"?"LONG":"SHORT"))}}
 />;
 const tradeView=<>
  <HideDexUnifiedMarketHeader
   mobile={{logo:current?renderAssetLogo(current.base):null,ticker:current?.base??"ASTER",modeLabel:kind==="spot"?"Aster Spot":"Aster Perpetual",
    priceLabel:fmt(marketPrice),change24h:current?.change24h,onSelectMarket:()=>setSelectOpen(true),mode:kind,
    switchMode:"toggle",onSwitchMode:()=>{setKind(kind==="perp"?"spot":"perp");onSelectSection("trade",kind==="perp"?"spot":"perp");}}}
   desktop={{logo:current?renderAssetLogo(current.base):null,ticker:current?.base??"ASTER",
    sublabel:kind==="spot"?"Aster Spot":"Aster Perpetual",onMarket:()=>setSelectOpen(true),view,onView:setView,marketInfoOpen:infoOpen,onMarketInfo:()=>setInfoOpen(v=>!v)}}
   info={{ticker:current?.symbol??"—",mode:kind,priceLabel:"$"+fmt(marketPrice),change24h:current?.change24h,fundingRate:null,openInterestUsd:null,onSwitch:()=>{setKind(kind==="perp"?"spot":"perp");onSelectSection("trade",kind==="perp"?"spot":"perp");}}}
   showChartToolbar={view==="chart"}/>
  <HideDexUnifiedTradeCanvas
   marketView={<HideDexUnifiedMarketView view={view}
    chart={current?<TVChart key={"aster-"+current.symbol} symbol={current.base} marketCoin="" asterMarketSymbol={current.symbol} asterMarketKind={kind}
     currentPrice={marketPrice} change24h={current.change24h} volume24h={current.volume24h} tradeHistory={[]} toolbarHostId="market-chart-toolbar-host"/>:<div className="p-6 text-brand-muted text-xs">Aster public market data loading…</div>}
    orderBook={<HideDexOrderBookPanel asks={depth?.asks??[]} bids={depth?.bids??[]} midPrice={marketPrice} midLabel="Last Price" flashingPrices={bookFlashes}
     sizeUnit="USD" baseSymbol={current?.base??"COIN"} onToggleSizeUnit={()=>{}}
     onSelectPrice={v=>{setLimitPrice(String(v));setOrderType("LIMIT");}}
     formatPrice={n=>fmt(n,4)} formatSize={(price,size)=>"$"+fmt(price*size,2)} group="1" groupOptions={["1"]}
     onGroup={()=>{}}/>}
   />}
   orderForm={placeForm}
   orderBook={<HideDexOrderBookPanel asks={depth?.asks??[]} bids={depth?.bids??[]} midPrice={marketPrice} midLabel="Last Price" flashingPrices={bookFlashes}
    sizeUnit="USD" baseSymbol={current?.base??"COIN"} onToggleSizeUnit={()=>{}}
    onSelectPrice={v=>{setLimitPrice(String(v));setOrderType("LIMIT");}}
    formatPrice={n=>fmt(n,4)} formatSize={(price,size)=>"$"+fmt(price*size,2)} group="1" groupOptions={["1"]} onGroup={()=>{}}/>}
   account={accountPanel}/>
 </>;
 return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="aster">
  {section==="trade"&&(
   <nav aria-label="Aster trading mode" className="mb-3 flex min-w-0 items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface p-1.5">
    {([
     {id:"perp",label:"Perpetual"},
     {id:"spot",label:"Spot"},
     {id:"1001x",label:"1001x"},
    ] as const).map(option=>{
     const unavailable=option.id==="1001x";
     const active=!unavailable&&option.id===kind;
     return <button key={option.id} type="button" aria-current={active?"page":undefined}
      disabled={busy||restoring||unavailable} aria-disabled={unavailable}
      title={unavailable?"Aster 1001x is unavailable: verified live 1001x contract execution and account data are not connected.":undefined}
      onClick={()=>{
       if(busy||restoring||unavailable)return;
       setSelectOpen(false);setAuthOpen(false);setInfoOpen(false);setTpsl(null);setFundingModal(null);
       setKind(option.id);onSelectSection("trade",option.id);
      }}
      className={"min-w-0 flex-1 rounded-lg px-2 py-2.5 text-xs font-bold transition-colors disabled:opacity-60 "+
       (active?"bg-brand-overlay-normal border border-accent text-brand-text":"border border-transparent text-brand-muted hover:bg-brand-overlay-subtle hover:text-brand-text")}>
      {option.label}{unavailable&&<span className="ml-1 text-[9px] opacity-80">Unavailable</span>}
     </button>;
    })}
   </nav>
  )}
  {/* Always keep the authentic Aster Pro/Spot chart, markets and account panels visible.
      Never present an empty 1001x preview as a working execution venue. */}
  {marketError&&<p role="alert" className="p-3 mb-2 rounded-lg border border-rose-500/30 text-rose-400 text-xs">Aster mainnet public markets unavailable: {marketError}. No other exchange's data is substituted.</p>}
  {notice&&!authOpen&&<HideDexTradingToast type={busy?"pending":toastKind}
     title="Aster" message={notice} onClose={()=>setNotice("")}/>}
  {!notice&&accountError&&<p role="alert" className="p-2 text-xs text-rose-400">{accountError}</p>}
  {restoring&&<p className="p-2 text-xs text-brand-muted">Verifying encrypted Aster agent for this wallet…</p>}
  {selectOpen&&<MarketSelector tokens={tokens} selectedSymbol={kind==="spot"?current?.base+"-SPOT":current?.base??""} externalPricesOnly
    initialCategory={kind==="spot"?"spot":"perps"} onClose={()=>setSelectOpen(false)}
    onSelectToken={(symbol,mode)=>{
     const actual=(mode==="spot"?spotMarkets:markets).find(m=>m.base===(mode==="spot"?symbol.replace(/-SPOT$/,""):symbol));
     if(actual){setSelectedSymbol(actual.symbol);setKind(mode);setSelectOpen(false);onSelectSection("trade",mode);}
    }}/>}
  {authOpen&&<HideDexTradingAuthorizationSheet title="Enable Trading" onClose={()=>{if(!busy)setAuthOpen(false);}}
    primaryDisabled={busy||!walletAddress} primaryLabel={busy?"CHECK YOUR WALLET":"SIGN TO ENABLE TRADING →"}
    onPrimary={()=>void enable()} description={<p className="text-sm text-brand-sub">
     Sign once with the connected wallet on BNB Chain to register a fresh Aster Pro API trading agent. The key stays encrypted on this browser. Withdrawals are NOT authorized by this step. Signed balance verification is required before real orders.</p>}/>}

  {section==="trade"&&tradeView}
  {section==="markets"&&<>
   {kind==="spot"&&spotMarketError&&<p role="alert" className="py-2 px-3 text-xs text-brand-muted">{spotMarketError}</p>}
   {current&&<MarketsPanel
    tokens={tokens} selectedSymbol={kind==="spot"?current.base+"-SPOT":current.base}
    setSelectedSymbol={()=>{}}
    onSelectToken={(symbol,mode)=>{
     const base=mode==="spot"?symbol.replace(/-SPOT$/,""):symbol;
     const found=(mode==="spot"?spotMarkets:markets).find(m=>m.base===base);
     if(found){setSelectedSymbol(found.symbol);setKind(mode);}
    }}
    walletConnected={!!walletAddress} walletAddress={walletAddress}
    onConnectWallet={onConnectWallet}
    asterMarket={{
     symbol:current.symbol,kind,price:marketPrice,maxLeverage:kind==="perp"?maxLeverage:null,
     accountSummary:accountPanel,
     orderBook:<HideDexOrderBookPanel
      asks={depth?.asks??[]} bids={depth?.bids??[]} midPrice={marketPrice} midLabel="Last Price" flashingPrices={bookFlashes}
      sizeUnit="USD" baseSymbol={current.base} onToggleSizeUnit={()=>{}}
      onSelectPrice={v=>{setLimitPrice(String(v));setOrderType("LIMIT");onSelectSection("trade",kind);}}
      formatPrice={n=>fmt(n,4)} formatSize={(px,qty)=>"$"+fmt(px*qty,2)}
      group="1" groupOptions={["1"]} onGroup={()=>{}}
     />
    }}
   />}
  </>}
  {section==="dashboard"&&accountPanel}
  {section==="orders"&&(
   !walletAddress||!identity?.mode||managerOrders===null||positionRows===null
    ?<div className="glass-panel rounded-2xl p-4 text-sm text-brand-muted">
      {accountError||"Aster order manager requires a verified signed account read."}</div>
    :<div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-1.5 border-b border-brand-border pb-4">
       <h1 className="text-xl font-bold font-sans text-brand-text uppercase tracking-wider">
        {p.initialOrdersTab==="TRADE_HISTORY"?"Settled Audits":"Trigger Orders"}
       </h1>
      </div>
      {p.initialOrdersTab==="TRADE_HISTORY"&&managerTrades===null?
        <p className="text-xs text-brand-muted p-4">Aster trade history is not yet verified.</p>:
       <PositionTable
        isPerp={kind==="perp"}
        positions={positionRows.map(asterPositionModel)}
        openOrders={managerOrders}
        tradeHistory={managerTrades??[]}
        initialTab={p.initialOrdersTab==="TRADE_HISTORY"?"HISTORY":"OPEN_ORDERS"}
        allowModify={false}
        onCancelOrder={async id=>{
         const raw=activeOrders?.find(r=>String(r.orderId)===id);
         if(raw&&typeof raw.symbol==="string")await cancel(id,raw.symbol);
        }}
        onClosePosition={async(pos,pct)=>{
         const raw=positionRows.find(r=>String(r.symbol)===pos.sourceCoin);
         if(raw)await closePos(raw,pct);
        }}
        onSavePositionTpSl={async(pos,tp,sl)=>{
         const raw=positionRows.find(r=>String(r.symbol)===pos.sourceCoin);
         if(!raw)throw Error("Verified Aster position not found");
         await sendTrigger(tp,sl,raw);
        }}
       />}
    </div>
  )}
  {section==="funds"&&<div id="funds-portfolio-container" className="space-y-3 sm:space-y-4 text-brand-text font-sans bg-brand-bg px-3 pt-2 pb-2 sm:p-4 sm:pb-8 rounded-3xl max-w-4xl mx-auto w-full">
    <HideDexFundsOverview totalLabel="TOTAL FUNDS"
     totalValue={hideBalance?"••••":combinedUsdt!==null?fmt(combinedUsdt)+" USDT":futuresTotalUsdt!==null?fmt(futuresTotalUsdt)+" USDT":"—"}
     approximateValue={combinedUsdt!==null?"Verified Aster Futures + Spot USDT":
       futuresTotalUsdt!==null?"Futures collateral only · Spot total unverified":"Aster account totals unavailable"}
     accountLabel="Aster Account" accountModeLabel="Aster Futures" walletAddress={walletAddress}
     walletDisplay={walletAddress?walletAddress.slice(0,6)+"…"+walletAddress.slice(-3):"Not connected"}
     hideBalances={hideBalance} onToggleBalances={()=>setHideBalance(v=>!v)}
     onCopyAddress={()=>{void navigator.clipboard.writeText(walletAddress)}} accountError={accountError||null}
     depositLabel="Deposit" depositSubtitle="Add funds" withdrawLabel="Withdrawal" withdrawSubtitle="Send funds"
     onDeposit={()=>{setFundingModal("deposit");setNotice("");}}
     onWithdraw={()=>{setFundingModal("withdraw");setNotice("");}}
     cards={[
      {label:"Spot Available",value:hideBalance?"••••":verifiedSpotUsdt!==null?fmt(verifiedSpotUsdt)+" USDT":"—",
       subtitle:"Aster Spot USDT, separately verified",icon:<Wallet size={14}/>},
      {label:"Perpetual Balance",value:hideBalance?"••••":available&&num(available.balance)!==null?fmt(num(available.balance))+" USDT":"—",
       subtitle:"Aster exchange-reported collateral",icon:<TrendingUp size={14}/>,iconTone:"text-success"},
      {label:"Available for Trade",value:hideBalance?"••••":free!==null?fmt(free)+" USDT":"—",
       subtitle:"Aster available margin",icon:<Unlock size={14}/>},
      {label:"Margin in Trade",value:hideBalance?"••••":num(futuresAccount?.totalPositionInitialMargin)!==null?fmt(num(futuresAccount?.totalPositionInitialMargin))+" USDT":"—",
       subtitle:"Exchange-reported initial margin",icon:<Lock size={14}/>,iconTone:"text-amber-500"},
     ]} />
    <HideDexAssetAllocation totalLabel="TOTAL" totalUnit="USDT"
      totalValue={hideBalance?"••••":combinedUsdt!==null?fmt(combinedUsdt):"—"}
      chartValues={hideBalance||combinedUsdt===null||combinedUsdt<=0?[]:[
       {value:futuresTotalUsdt??0,color:"#18c29c"},
       {value:totalSpotUsdt??0,color:"#717b8b"}
      ]}
      rows={[
       {label:"Perp Collateral",color:"#18c29c",amount:hideBalance?"••••":futuresTotalUsdt!==null?fmt(futuresTotalUsdt):"—",
        percentage:combinedUsdt!==null&&combinedUsdt>0?100*(futuresTotalUsdt??0)/combinedUsdt:null},
       {label:"Spot USDT",color:"#717b8b",amount:hideBalance?"••••":totalSpotUsdt!==null?fmt(totalSpotUsdt):"—",
        percentage:combinedUsdt!==null&&combinedUsdt>0?100*(totalSpotUsdt??0)/combinedUsdt:null}
      ]}/>
    <HideDexFundsPerformance
      period={performancePeriod} onPeriod={setPerformancePeriod}
      market={performanceMarket} onMarket={setPerformanceMarket}
      summary={<AnalyticsPanel
       period={performancePeriod} market={performanceMarket}
       walletConnected={Boolean(walletAddress)} walletAddress={walletAddress}
       fills={[]} loading={Boolean(identity?.mode)&&trades===null&&!tradesError}
       failed={Boolean(tradesError)} sensitiveHidden={hideBalance}
       venueStats={{
        pnl:performanceLoaded?.pnl??null,
        volume:performanceLoaded?.volume??null,
        fees:performanceLoaded?.fees??null,
        orders:performanceLoaded?.orders??null,
        pnlLabel:"Realized PnL (loaded perp)",
        volumeLabel:"Volume (selected perp)",
        feesLabel:"Fees (USDT · loaded)",
        ordersLabel:"Executed orders (loaded)"
       }}
      />}
      chart={<HideDexPerformanceAreaChart
       period={performancePeriod}
       data={performanceLoaded?.pnlSeries??[]}
       label={"Cumulative Realized PnL · "+(current?.base??"Aster")+" (loaded)"}
       hidden={hideBalance}
       loading={Boolean(identity?.mode)&&trades===null&&!tradesError}
       emptyMessage={performanceMarket==="spot"||kind==="spot"?
        "Aster Spot historical PnL is not verified.":
        tradesError||"Two timestamped, verified fills required for a realized PnL chart. Historical equity is not inferred."}
      />}
    />
    <DailyFillVolumeBars
     fills={performanceLoaded?.loaded??[]}
     period={performancePeriod}
     walletConnected={Boolean(walletAddress)}
     sensitiveHidden={hideBalance}
     sourceLabel={kind==="perp"&&current?"Aster "+current.base+" Perp loaded fills":"Aster fills"}
     unavailableMessage={
       performanceMarket==="spot"||kind==="spot"?
       "Aster Spot account-wide trading history has not been verified.":
       !identity?.mode?"Verify Aster trading authorization to load fills.":
       tradesError||(!asterAnalytics?"Loading Aster signed fills for the selected market…":undefined)
     }
    />
   </div>}
  {fundingModal&&<HideDexFundsDialogShell deposit={fundingModal==="deposit"} busy={busy}
   onClose={()=>{setFundingModal(null);setFundingAmount("");}} subtitle="Aster mainnet USDT — never sends funds to Hyperliquid or Lighter">
   <HideDexFundingNetworkAsset assetSymbol="USDT" network={ASTER_CHAINS[fundingNetwork].name} chainId={fundingNetwork}
     options={(Object.entries(ASTER_CHAINS) as Array<[string,{name:string}]>).map(([id,c])=>({value:id,label:c.name,chainId:Number(id)}))}
     value={String(fundingNetwork)} onNetworkChange={v=>setFundingNetwork(Number(v) as AsterChainId)} pickerStyle="modal" disabled={busy}/>
   <p className="text-xs text-brand-muted">Asset: USDT. Only the verified contract and audited Aster deposit treasury will be used.</p>
   {fundingModal==="deposit"&&<div className="flex gap-2">
    {(["perp","spot"] as const).map(x=><button type="button" key={x} disabled={busy} onClick={()=>setFundingTarget(x)}
     className={"flex-1 p-2 rounded-lg border text-xs font-bold "+(fundingTarget===x?"border-accent bg-accent/10":"border-brand-border")}>
     {x==="perp"?"Futures Account":"Spot Account"}</button>)}
   </div>}
   {fundingModal==="withdraw"&&<HideDexFundingDestination address={walletAddress}/>}
   <HideDexFundingAmount assetSymbol="USDT" id="aster-funding-amount" amount={fundingAmount} onAmount={setFundingAmount}
    minLabel="Mainnet USDT. No transaction is sent until you confirm in your wallet." disabled={busy}/>
   <HideDexFundingFeeCard deposit={fundingModal==="deposit"}
    fee={fundingModal==="withdraw"?withdrawFee??"—":"Wallet network gas (estimated by wallet)"}
    receive={fundingModal==="withdraw"&&withdrawFee&&num(fundingAmount)!==null?
      fmt(Math.max(0,Number(fundingAmount)-Number(withdrawFee)))+" USDT":"—"}/>
   <p className="text-xs text-brand-muted break-all">
     {fundingModal==="deposit"?"Audited Aster treasury ("+fundingTarget+"): "+ASTER_CHAINS[fundingNetwork].deposit:
      "Withdrawals need a separate wallet-signed agent permission and a second withdrawal signature. Only your connected wallet can receive."}
   </p>
   <HideDexFundingSubmit deposit={fundingModal==="deposit"} busy={busy}
    disabled={!walletAddress||!fundingAmount||!(Number(fundingAmount)>0)||(fundingModal==="withdraw"&&!withdrawFee)}
    label={fundingModal==="deposit"?"Confirm Aster Deposit":"Authorize & Withdraw USDT"}
    onClick={()=>void act(fundingModal==="deposit"?"Deposit":"Withdrawal",async()=>{
     const provider=await getWalletProvider();
     if(fundingModal==="deposit"){
      await asterDepositUsdt(walletAddress,provider,fundingNetwork,fundingAmount,setNotice,fundingTarget);
     }else{
      if(!identity?.mode||!withdrawFee)throw Error("Verify signed Aster account before withdrawing");
      await grantAsterWithdrawPermission(walletAddress,provider);
      await asterWithdrawUsdt(walletAddress,provider,identity.mode,fundingNetwork,fundingAmount,withdrawFee);
     }
     setFundingModal(null);setFundingAmount("");
    })}/>
   </HideDexFundsDialogShell>}
  {tpsl&&<TpSlModal
     position={asterPositionModel(tpsl)}
     openOrders={(openOrders??[]).flatMap(o=>{
      const type=String(o.type??"").toUpperCase();
      const kind:"tp"|"sl"|null=type.includes("TAKE_PROFIT")?"tp":type.includes("STOP")?"sl":null;
      const trigger=num(o.stopPrice),id=o.orderId;
      if(!kind||trigger===null||trigger<=0||id==null||typeof o.symbol!=="string")return[];
      return [{
       id:String(id),symbol:o.symbol.replace(/USDT$/,""),sourceCoin:o.symbol,
       type:"TRIGGER" as const,side:o.side==="SELL"?"SELL" as const:"BUY" as const,
       status:"OPEN" as const,price:trigger,size:num(o.origQty)??0,
       timestamp:"—",triggerPrice:trigger,isTrigger:true,tpsl:kind,
      } satisfies OpenOrder];
     })}
     onClose={()=>{if(!busy)setTpsl(null);}}
     tradingEnabled={Boolean(identity?.mode)&&!busy}
     priceOnly
     onSave={async(tp,sl)=>{await sendTrigger(tp,sl);}}
    />}
 </div>;
}
