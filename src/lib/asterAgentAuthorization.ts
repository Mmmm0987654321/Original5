/**
 * Aster V3 MAINNET trading-only Agent authorization request preparation.
 *
 * Official source: asterdex/api-docs
 * V3(Recommended)/EN/aster-finance-futures-api-v3.md
 * "Register and Approve Agent (PUBLIC)".
 *
 * No signed requests or trading are made here. This helper NEVER creates a
 * private key, stores a credential, calls a wallet, or approves withdrawals.
 * Future UI must obtain clear wallet consent, verify EIP-712 signature,
 * register the agent with the exchange, and securely encrypt its signing key.
 * No API wallet access exists until all of these operations succeed.
 */
import {getAddress} from "ethers";

export const ASTER_EVM_SIGNATURE_CHAIN_ID=56 as const;
export const ASTER_AGENT_REGISTRATION_PATH="/fapi/v3/registerAndApproveAgent" as const;
const SIGN_DOMAIN={
 name:"AsterSignTransaction",
 version:"1",
 chainId:ASTER_EVM_SIGNATURE_CHAIN_ID,
 verifyingContract:"0x0000000000000000000000000000000000000000",
} as const;

/** New creation/verification is separate for every wallet and never reused
 * across other exchanges. No withdraw permission is granted.
 */
export interface AsterAgentSetupRequest {
 userAddress:string;
 agentAddress:string;
 /** Explicit expiry in epoch milliseconds, not an inferred duration. */
 expiresAtMs:number;
 /** Must be generated at the moment of the actual consent request. */
 nowMs:number;
 agentName?:string;
}
export interface AsterAgentSetupPayload {
 endpoint:typeof ASTER_AGENT_REGISTRATION_PATH;
 params:Record<string,string>;
 /** Signed text must exactly match the URL-encoded body sent to Aster. */
 message:string;
 eip712:{
   domain:typeof SIGN_DOMAIN;
   types:{Message:Array<{name:string;type:string}>};
   primaryType:"Message";
   message:{msg:string};
 };
}
const dec=(v:number)=>{
 if(!Number.isSafeInteger(v)||v<0)throw new Error("Invalid Aster authorization timestamp");
 return String(v);
};
export function prepareAsterTradingAgentAuthorization(
  request:AsterAgentSetupRequest
):AsterAgentSetupPayload{
 const user=getAddress(request.userAddress);
 const agent=getAddress(request.agentAddress);
 if(user===agent)throw new Error("Aster requires an isolated API agent, not the owner's signing wallet");
 const now=Number(request.nowMs);
 if(!Number.isSafeInteger(now)||now<=0)throw new Error("Invalid Aster authorization time");
 const expiry=Number(request.expiresAtMs);
 if(!Number.isSafeInteger(expiry)||expiry<=now)
  throw new Error("Aster agent expiration must be in the future");
 // This API requires a nonce expressed in microseconds, not milliseconds.
 // Never reuse the result on a second request; create a fresh payload.
 const nonce=dec(now*1000);
 const agentName=request.agentName??"HideDex";
 if(!/^[a-zA-Z0-9_-]{1,32}$/.test(agentName))
  throw new Error("Invalid Aster agent name");
 // Keep exact official order. Withdrawal permission is ALWAYS false.
 const params:Record<string,string>={
  user,nonce,agentName,agentAddress:agent,
  expired:dec(expiry),
  signatureChainId:String(ASTER_EVM_SIGNATURE_CHAIN_ID),
  canSpotTrade:"true",
  canPerpTrade:"true",
  canWithdraw:"false",
  ipWhitelist:"",
 };
 const message=new URLSearchParams(params).toString();
 return {
  endpoint:ASTER_AGENT_REGISTRATION_PATH,
  params,
  message,
  eip712:{
   domain:SIGN_DOMAIN,
   types:{Message:[{name:"msg",type:"string"}]},
   primaryType:"Message",
   message:{msg:message},
  },
 };
}

/** Aster V3 USER_DATA and TRADE APIs now require a prior main-wallet
 * deposit. Error -5050 is NOT "zero balance" and must never trigger an order.
 */
export function isAsterInitialDepositRequired(response:unknown):boolean{
 if(!response||typeof response!=="object"||Array.isArray(response))return false;
 const code=(response as {code?:unknown}).code;
 return code===-5050||code==="-5050";
}
