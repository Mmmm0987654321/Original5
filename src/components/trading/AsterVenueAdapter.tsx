import React,{useEffect,useMemo,useState,useCallback} from "react";
import type {Position,OpenOrder} from "../../types";
import {Wallet,TrendingUp,Unlock,Lock} from "lucide-react";
import type {TokenMetadata} from "../../types";
import MarketSelector,{renderAssetLogo} from "./MarketSelector";
import TVChart from "./TVChart";
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
const quoteMarkets=(m:AsterMarket):TokenMetadata=>({
 symbol:m.base,name:m.base,fullName:m.base,sourceCoin:m.symbol,
 price:m.last,change24h:m.change24h,volume24h:m.volume24h,high24h:null,low24h:null,category:"perps",subcategory:"crypto",
});
export default function AsterVenueAdapter(p:{
 section:Section;initialKind:MarketKind;walletAddress:string;
 getWalletProvider:()=>Promise<AsterProvider>;onConnectWallet:()=>void;
 onSelectSection:(section:Section,kind?:MarketKind)=>void;initialOrdersTab?:"OPEN_ORDERS"|"TRADE_HISTORY";
}){
 const {section,initialKind,walletAddress,onConnectWallet,getWalletProvider,onSelectSection}=p;
 const [markets,setMarkets]=useState<AsterMarket[]>([]);
 const [spotMarkets,setSpotMarkets]=useState<AsterMarket[]>([]);
 const [marketError,setMarketError]=useState("");
 const [selectedSymbol,setSelectedSymbol]=useState("BTCUSDT");
 const [kind,setKind]=useState<MarketKind>(initialKind);
 const [selectOpen,setSelectOpen]=useState(false);
 const [view,setView]=useState<"chart"|"orderbook">("chart");
 const [infoOpen,setInfoOpen]=useState(false);
 const [depth,setDepth]=useState<{asks:AsterLevel[];bids:AsterLevel[]}|null>(null);
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
 const [fundingModal,setFundingModal]=useState<"deposit"|"withdraw"|null>(null);
 const [fundingNetwork,setFundingNetwork]=useState<AsterChainId>(56);
 const [fundingTarget,setFundingTarget]=useState<"perp"|"spot">("perp");
 const [fundingAmount,setFundingAmount]=useState("");
 const [withdrawFee,setWithdrawFee]=useState<string|null>(null);
 const [hideBalance,setHideBalance]=useState(false);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [tpsl,setTpsl]=useState<Raw|null>(null);
 const current=useMemo(()=>{const list=kind==="spot"?spotMarkets:markets;return list.find(m=>m.symbol===selectedSymbol)??list.find(m=>m.base==="BTC")??list[0]??null;},[kind,markets,spotMarkets,selectedSymbol]);
 const tokens=useMemo(()=>(kind==="spot"?spotMarkets:markets).map(m=>({...quoteMarkets(m),category:kind==="spot"?"spot" as const:"perps" as const,isSpotOnly:kind==="spot"})),[markets,spotMarkets,kind]);
 const available=signedBalance(balances);
 const ownedSpot=(asset:string)=>spotBalances?.find(x=>x.asset===asset);
 const spotFree=kind==="spot"?num(ownedSpot(side==="BUY"?(current?.quote??"USDT"):(current?.base??""))?.free):null;
 const free=kind==="spot"?spotFree:(num(available?.availableBalance)??num(available?.balance));
 const activeOrders=kind==="spot"?spotOrders:openOrders;
 const positionRows=useMemo(()=>risk===null?null:risk.filter(r=>{const n=num(r.positionAmt);return n!==null&&n!==0;}),[risk]);
 const currentPosition=positionRows?.find(r=>r.symbol===current?.symbol);
 const hasOpposite=!!currentPosition&&((side==="SELL"&&(num(currentPosition.positionAmt)??0)>0)||(side==="BUY"&&(num(currentPosition.positionAmt)??0)<0));
 const price=orderType==="MARKET"?current?.last??null:num(limitPrice);
 const size=price!==null&&price>0&&num(amount)!==null
   ?sizeUnit==="USDT"?Number(amount)/price:Number(amount):null;
 const orderValue=size!==null&&price!==null?size*price:null;
 const own=walletAddress.trim().toLowerCase();
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

 useEffect(()=>{setKind(initialKind);},[initialKind]);
 useEffect(()=>{let cancelled=false;const poll=()=>getAsterMarkets().then(list=>{
  if(cancelled)return;setMarkets(list);setMarketError("");
  if(list.length&&!list.some(x=>x.symbol===selectedSymbol))setSelectedSymbol(list[0].symbol);
 }).catch(e=>{if(!cancelled)setMarketError(sourceError(e));});
 void poll();const id=window.setInterval(poll,45_000);
 return()=>{cancelled=true;window.clearInterval(id);};},[]);
 useEffect(()=>{let cancelled=false;const poll=()=>getAsterSpotMarkets().then(list=>{if(!cancelled)setSpotMarkets(list);}).catch(e=>{
  if(!cancelled)setMarketError("Aster Spot: "+sourceError(e));});
 void poll();const id=window.setInterval(poll,60_000);return()=>{cancelled=true;window.clearInterval(id);};},[]);
 useEffect(()=>{if(!current)return;let stopped=false;const read=()=> (kind==="spot"?getAsterSpotDepth(current.symbol):getAsterDepth(current.symbol)).then(x=>{
  if(!stopped)setDepth(x);
 }).catch(()=>{if(!stopped)setDepth(null);});
 setDepth(null);void read();const id=window.setInterval(read,4_000);
 return()=>{stopped=true;window.clearInterval(id);};
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
 useEffect(()=>{if(tab!=="TRADE_HISTORY"||!identity?.mode||kind==="spot"||!current)return;
 let gone=false;void asterSignedRead(walletAddress,"/fapi/v3/userTrades",{symbol:current.symbol})
 .then(({data})=>{if(!gone)setTrades(rows(data));})
 .catch(e=>{if(!gone){setTrades(null);setNotice(sourceError(e));}});
 return()=>{gone=true;};
 },[tab,identity?.agent,current?.symbol,reload,kind]);
 useEffect(()=>{if(!identity?.mode||!current)return;
 let stopped=false;
 void asterSignedRead(walletAddress,"/fapi/v3/leverageBracket",{symbol:current.symbol})
 .then(({data})=>{if(stopped)return;const arr=rows(data);const x=arr.find(z=>z.symbol===current.symbol);const entry=Array.isArray(x?.brackets)?rows(x.brackets)[0]:null;const lev=num(entry?.initialLeverage);setMaxLeverage(lev!==null&&lev>=1?lev:null);})
 .catch(()=>{if(!stopped)setMaxLeverage(null);});
 return()=>{stopped=true;};
 },[identity?.mode?.order,identity?.agent,current?.symbol]);
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
 const sendTrigger=async(tpPrice:number|null,slPrice:number|null)=>{
  if(!identity?.mode||!tpsl||!walletAddress)return;
  if(tpPrice===null&&slPrice===null)return;
  const target=tpsl;
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
 };
 const cancel=async(orderId:string,symbol:string)=>{
  if(!(kind==="spot"?spotMode:identity?.mode))return;
  await act("Cancel",async()=>kind==="spot"&&spotMode
    ? asterSignedSpotWrite(walletAddress,spotMode,"/api/v3/order","DELETE",{symbol,orderId})
    : asterSignedWrite(walletAddress,identity.mode!,"/fapi/v3/order","DELETE",{symbol,orderId}));
 };
 const changeLev=async(next:number)=>{
  if(!identity?.mode||!current||maxLeverage===null||next>maxLeverage||next<1)return;
  await act("Leverage",async()=>asterSignedWrite(walletAddress,identity.mode!,"/fapi/v3/leverage","POST",{symbol:current.symbol,leverage:String(Math.floor(next))}));
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
   onMarginMode:kind==="perp"&&identity?.mode?next=>{setMarginMode(next);void changeMargin(next);}:undefined,
   leverage, maxLeverage, onLeverage:kind==="perp"&&identity?.mode?setLeverage:undefined,
   onLeverageCommit:kind==="perp"&&identity?.mode?next=>void changeLev(next):undefined,
   leverageDisabled:!identity?.mode||maxLeverage===null}}
  side={{isPerp:kind==="perp",side,onSide:setSide,available:free!==null?fmt(free,5)+" "+(kind==="spot"&&side==="SELL"?current?.base??"COIN":"USDT"):"—"}}
  basic={{type:orderType,price:limitPrice,onPrice:setLimitPrice,midPrice:current?.last,
   size:amount,onSize:setAmount,sizeUnit:sizeUnit==="USDT"?"USDT":current?.base??"COIN",
   onToggleUnit:()=>{if(price&&num(amount)!==null&&price>0)
    setAmount(String(sizeUnit==="USDT"?Number(amount)/price:Number(amount)*price));
    else setAmount("");setSizeUnit(v=>v==="USDT"?"COIN":"USDT");}}}
  presets={{disabled:free===null||!current?.last,onSelect:pct=>{
   if(free===null||!current?.last)return;
   const spend=free*pct/100;
   const notional=kind==="spot"&&side==="SELL"?spend*current.last:spend*(kind==="perp"?leverage:1);
   const coin=kind==="spot"&&side==="SELL"?spend:notional/current.last;
   setAmount(String(sizeUnit==="USDT"?Number(notional.toFixed(4)):Number(coin.toFixed(8))));
  }}}
  options={{visible:kind==="perp",reduce:{checked:reduceOnly,onChange:setReduceOnly,disabled:!hasOpposite||busy},tpsl:{checked:false,onChange:()=>{},disabled:true}}}
  summary={{isPerp:kind==="perp",liquidation:"—",orderValue:orderValue!==null?"$"+fmt(orderValue):"—",margin:orderValue!==null&&leverage>0?"≈$"+fmt(orderValue/leverage):"—"}}
  place={{type:"button",side,busy,disabled:busy||!current||size===null||size<=0, onClick:()=>void order(),
   label:busy?"Processing…":!identity?"ENABLE TRADING":(kind==="spot"&&!spotMode||kind==="perp"&&!identity.mode)?"VERIFY ASTER ACCOUNT":"PLACE "+(kind==="spot"?(side==="BUY"?"BUY":"SELL"):(side==="BUY"?"LONG":"SHORT"))}}
 />;
 const marketPrice=current?.last??null;
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
    orderBook={<HideDexOrderBookPanel asks={depth?.asks??[]} bids={depth?.bids??[]} midPrice={marketPrice} midLabel="Last Price"
     sizeUnit="USD" baseSymbol={current?.base??"COIN"} onToggleSizeUnit={()=>{}}
     onSelectPrice={v=>{setLimitPrice(String(v));setOrderType("LIMIT");}}
     formatPrice={n=>fmt(n,4)} formatSize={(price,size)=>"$"+fmt(price*size,2)} group="1" groupOptions={["1"]}
     onGroup={()=>{}}/>}
   />}
   orderForm={placeForm}
   orderBook={<HideDexOrderBookPanel asks={depth?.asks??[]} bids={depth?.bids??[]} midPrice={marketPrice} midLabel="Last Price"
    sizeUnit="USD" baseSymbol={current?.base??"COIN"} onToggleSizeUnit={()=>{}}
    onSelectPrice={v=>{setLimitPrice(String(v));setOrderType("LIMIT");}}
    formatPrice={n=>fmt(n,4)} formatSize={(price,size)=>"$"+fmt(price*size,2)} group="1" groupOptions={["1"]} onGroup={()=>{}}/>}
   account={accountPanel}/>
 </>;
 return <div className="w-full min-w-0 text-brand-text pb-1" data-exchange="aster">
  {marketError&&<p role="alert" className="p-3 mb-2 rounded-lg border border-rose-500/30 text-rose-400 text-xs">Aster mainnet public markets unavailable: {marketError}. No other exchange's data is substituted.</p>}
  {notice&&!authOpen&&<HideDexTradingToast type={busy?"pending":toastKind}
     title="Aster" message={notice} onClose={()=>setNotice("")}/>}
  {!notice&&accountError&&<p role="alert" className="p-2 text-xs text-rose-400">{accountError}</p>}
  {restoring&&<p className="p-2 text-xs text-brand-muted">Verifying encrypted Aster agent for this wallet…</p>}
  {selectOpen&&<MarketSelector tokens={tokens} selectedSymbol={current?.base??""} externalPricesOnly
    initialCategory={kind==="spot"?"spot":"perps"} onClose={()=>setSelectOpen(false)}
    onSelectToken={symbol=>{const found=(kind==="spot"?spotMarkets:markets).find(m=>m.base===symbol);if(found){setSelectedSymbol(found.symbol);setSelectOpen(false);onSelectSection("trade",kind);}}}/>}
  {authOpen&&<HideDexTradingAuthorizationSheet title="Enable Trading" onClose={()=>{if(!busy)setAuthOpen(false);}}
    primaryDisabled={busy||!walletAddress} primaryLabel={busy?"CHECK YOUR WALLET":"SIGN TO ENABLE TRADING →"}
    onPrimary={()=>void enable()} description={<p className="text-sm text-brand-sub">
     Sign once with the connected wallet on BNB Chain to register a fresh Aster Pro API trading agent. The key stays encrypted on this browser. Withdrawals are NOT authorized by this step. Signed balance verification is required before real orders.</p>}/>}

  {section==="trade"&&tradeView}
  {section==="markets"&&<div className="space-y-2">
    <h2 className="text-lg font-bold p-2">Aster {kind==="spot"?"Spot":"Perpetual"} Markets</h2>
    <button className="px-3 py-2 rounded border border-brand-border text-xs" onClick={()=>setSelectOpen(true)}>Search Markets</button>
    <div className="max-h-[70vh] overflow-auto">{(kind==="spot"?spotMarkets:markets).map(m=><button key={m.symbol} onClick={()=>{setSelectedSymbol(m.symbol);onSelectSection("trade",kind);}}
      className="w-full flex justify-between items-center border-b border-brand-border p-3 text-sm text-brand-text hover:bg-brand-overlay-subtle">
      <span className="font-semibold">{m.base}/USDT</span><span>{fmt(m.last,5)}</span><span>{m.change24h===null?"—":fmt(m.change24h)+"%"}</span></button>)}</div>
   </div>}
  {(section==="orders"||section==="dashboard")&&accountPanel}
  {section==="funds"&&<div id="funds-portfolio-container" className="space-y-3 sm:space-y-4 text-brand-text font-sans bg-brand-bg px-3 pt-2 pb-2 sm:p-4 sm:pb-8 rounded-3xl max-w-4xl mx-auto w-full">
    <HideDexFundsOverview totalLabel="TOTAL FUNDS"
     totalValue={hideBalance?"••••":combinedUsdt!==null?fmt(combinedUsdt)+" USDT":futuresTotalUsdt!==null?fmt(futuresTotalUsdt)+" USDT":"—"}
     approximateValue={combinedUsdt!==null?"Verified Aster Futures + Spot USDT":
       futuresTotalUsdt!==null?"Futures collateral only · Spot total unverified":"Aster account totals unavailable"}
     accountLabel="Aster Account" accountModeLabel="Aster Futures" walletAddress={walletAddress}
     walletDisplay={walletAddress?walletAddress.slice(0,6)+"…"+walletAddress.slice(-3):"Not connected"}
     hideBalances={hideBalance} onToggleBalances={()=>setHideBalance(v=>!v)}
     onCopyAddress={()=>{void navigator.clipboard.writeText(walletAddress)}} accountError={accountError||null}
     depositLabel="Deposit" depositSubtitle="Fund Aster mainnet" withdrawLabel="Withdraw" withdrawSubtitle="Return to wallet"
     onDeposit={()=>{setFundingModal("deposit");setNotice("");}}
     onWithdraw={()=>{setFundingModal("withdraw");setNotice("");}}
     cards={[{label:"Perpetual Balance",value:hideBalance?"••••":available&&num(available.balance)!==null?fmt(num(available.balance))+" USDT":"—",
       subtitle:"Aster exchange-reported",icon:<Wallet size={14}/>},
      {label:"Available for Trade",value:hideBalance?"••••":free!==null?fmt(free)+" USDT":"—",
       subtitle:"Aster available margin",icon:<Unlock size={14}/>},
      {label:"Margin in Trade",value:hideBalance?"••••":num(futuresAccount?.totalPositionInitialMargin)!==null?fmt(num(futuresAccount?.totalPositionInitialMargin))+" USDT":"—",
       subtitle:"Exchange-reported initial margin",icon:<Lock size={14}/>},
      {label:"Spot Available",value:hideBalance?"••••":verifiedSpotUsdt!==null?fmt(verifiedSpotUsdt)+" USDT":"—",
       subtitle:"Aster Spot USDT, separately verified",icon:<TrendingUp size={14}/>}]} />
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
    {accountPanel}
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
