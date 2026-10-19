/** Aster on-site mainnet funding, from official audited Aster deposit-fund
 * treasury whitelist and V3 withdrawal demos. No private wallet keys collected.
 * Real transactions require the connected wallet's explicit confirmation.
 */
import {BrowserProvider,Contract,getAddress,parseUnits,formatUnits} from "ethers";
import type {AsterProvider,AsterAuthMode} from "./asterProV3";
import {asterSignedWrite} from "./asterProV3";
const depositDomain="https://www.asterdex.com";
const chains={
 56:{name:"BNB Chain",deposit:"0x128463A60784c4D3f46c23Af3f65Ed859Ba87974",usdt:"0x55d398326f99059fF775485246999027B3197955",decimals:18,confirms:3},
 1:{name:"Ethereum",deposit:"0x604DD02d620633Ae427888d41bfd15e38483736E",usdt:"0xdAC17F958D2ee523a2206206994597C13D831ec7",decimals:6,confirms:2},
 42161:{name:"Arbitrum One",deposit:"0x9E36CB86a159d479cEd94Fa05036f235Ac40E1d5",usdt:"0xFd086bC7CD5C481DCC9C85eC8a27AaA8fC58E61",decimals:6,confirms:2}
} as const;
export type AsterChainId=keyof typeof chains;
export const ASTER_CHAINS=chains;
const tokenAbi=["function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)","function approve(address,uint256) returns (bool)","function decimals() view returns (uint8)"];
const treasuryAbi=["function depositFor(address currency,address forAddress,uint256 amount,uint256 broker) external payable"];
async function checkPublicAsset(chainId:AsterChainId,target:"perp"|"spot"){
 const chain=chains[chainId];
 const url=depositDomain+"/bapi/futures/v1/public/future/aster/deposit/assets?chainIds="+chainId+"&networks=EVM&accountType="+target;
 const response=await fetch(url,{headers:{Accept:"application/json"}});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok||!data||typeof data!=="object"||!("data" in data)||!Array.isArray((data as any).data))throw Error("Aster deposit asset verification unavailable; no transaction sent.");
 const found=(data as {data:unknown[]}).data.some(entry=>{
  const r=entry&&typeof entry==="object"?entry as Record<string,unknown>:{};
  return (r.name==="USDT"||r.displayName==="USDT")&&
   typeof r.contractAddress==="string"&&r.contractAddress.toLowerCase()===chain.usdt.toLowerCase()&&
   Number(r.decimals)===chain.decimals&&Number(r.chainId)===chainId;
 });
 if(!found)throw Error("Aster USDT/chain metadata differs from the audited allowlist. Deposit blocked.");
}
async function ownedSigner(provider:AsterProvider,owner:string,chainId:AsterChainId){
 const web3=new BrowserProvider(provider as any);
 const raw=Number(BigInt(String(await provider.request({method:"eth_chainId"}))));
 if(raw!==chainId)await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x"+chainId.toString(16)}]});
 if(Number(BigInt(String(await provider.request({method:"eth_chainId"}))))!==chainId)throw Error("Wallet network mismatch");
 const signer=await (new BrowserProvider(provider as any)).getSigner();
 if(getAddress(await signer.getAddress())!==getAddress(owner))throw Error("Wallet address changed; funding stopped.");
 return signer;
}
export async function asterDepositUsdt(owner:string,provider:AsterProvider,chainId:AsterChainId,amount:string,update:(message:string)=>void,target:"perp"|"spot"="perp"){
 const config=chains[chainId];if(!config)throw Error("Unsupported Aster network");
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount))throw Error("Invalid deposit amount");
 const units=parseUnits(amount,config.decimals);if(units<=0n)throw Error("Deposit must be positive");
 update("Verifying Aster's public deposit asset listing…");
 await checkPublicAsset(chainId,target);
 const signer=await ownedSigner(provider,owner,chainId);
 const token=new Contract(config.usdt,tokenAbi,signer);
 const treasury=new Contract(config.deposit,treasuryAbi,signer);
 const realDecimals=Number(await token.decimals());
 if(realDecimals!==config.decimals)throw Error("Token decimals mismatch");
 const balance=await token.balanceOf(owner) as bigint;
 if(balance<units)throw Error("Insufficient verified USDT on "+config.name);
 const gasBalance=await (signer.provider).getBalance(owner);
 if(gasBalance<=0n)throw Error("Native gas balance required");
 const allowance=await token.allowance(owner,config.deposit) as bigint;
 if(allowance<units){
  update("Step 1/2 — Confirm exact-amount USDT allowance in your wallet");
  const tx=await token.approve(config.deposit,units);
  const receipt=await tx.wait(config.confirms);
  if(!receipt||receipt.status!==1)throw Error("USDT approval not confirmed");
  const check=await token.allowance(owner,config.deposit) as bigint;
  if(check<units)throw Error("USDT allowance still insufficient; no deposit submitted");
 }
 update("Step 2/2 — Confirm actual USDT deposit into audited Aster treasury");
 const tx=await treasury.depositFor(config.usdt,getAddress(owner),units,target==="spot"?1000n:0n);
 update("Deposit transaction sent. Awaiting network confirmations. Tx "+String(tx.hash).slice(0,14)+"…");
 const receipt=await tx.wait(config.confirms);
 if(!receipt||receipt.status!==1)throw Error("Aster treasury deposit not confirmed");
 update("On-chain deposit confirmed. Aster account credit may take time. Tx "+tx.hash);
 return String(tx.hash);
}
export async function asterWithdrawQuote(chainId:AsterChainId){
 const url=depositDomain+"/bapi/futures/v1/public/future/aster/estimate-withdraw-fee?chainId="+chainId+"&network=EVM&currency=USDT&accountType=perp";
 const response=await fetch(url,{headers:{Accept:"application/json"}});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok||!data||typeof data!=="object")throw Error("Aster withdrawal fee quote unavailable");
 const obj=data as Record<string,unknown>,quote=obj.data&&typeof obj.data==="object"?obj.data as Record<string,unknown>:null;
 if(obj.success!==true||!quote||quote.gasCost==null)throw Error("Aster withdrawal quote not verified");
 const fee=String(quote.gasCost);if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(fee))throw Error("Invalid withdrawal fee");
 return fee;
}
export async function asterWithdrawUsdt(owner:string,provider:AsterProvider,mode:AsterAuthMode,chainId:AsterChainId,amount:string,fee:string){
 if(!chains[chainId])throw Error("Unsupported withdrawal network");
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)||!(Number(amount)>0))throw Error("Invalid withdrawal amount");
 // Only return funds to the user's same connected wallet, no arbitrary receivers.
 const destination=getAddress(owner);
 const signer=await ownedSigner(provider,owner,chainId);
 const withdrawalNonce=(BigInt(Date.now())*1000n).toString();
 const chainName=chainId===56?"BSC":chainId===1?"ETH":"Arbitrum";
 const msg={"type":"Withdraw","destination":destination,"destination Chain":chainName,
  "token":"USDT","amount":amount,"fee":fee,"nonce":BigInt(withdrawalNonce),"aster chain":"Mainnet"};
 const signature=await signer.signTypedData(
  {name:"Aster",version:"1",chainId,verifyingContract:"0x0000000000000000000000000000000000000000"},
  {Action:[{name:"type",type:"string"},{name:"destination",type:"address"},
   {name:"destination Chain",type:"string"},{name:"token",type:"string"},
   {name:"amount",type:"string"},{name:"fee",type:"string"},{name:"nonce",type:"uint256"},
   {name:"aster chain",type:"string"}]},msg);
 return asterSignedWrite(owner,mode,"/fapi/v3/aster/user-withdraw","POST",{
  chainId:String(chainId),asset:"USDT",amount,fee,receiver:destination,
  userNonce:withdrawalNonce,userSignature:signature,
 });
}
