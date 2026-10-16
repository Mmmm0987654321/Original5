/**
 * Mainnet-only, user-signed Ethereum USDC -> Lighter direct deposit.
 * Reference: https://apidocs.lighter.xyz/docs/deposits-transfers-and-withdrawals
 * Never moves funds unless the user explicitly confirms wallet transactions.
 * Does NOT implement withdrawal or Lighter order signing.
 */
import { BrowserProvider, Contract, getAddress, parseUnits } from "ethers";
import { lighterPublicGet } from "./lighterMarketData";

const LIGHTER_L1 = "0x3B4D794a66304F130a4Db8F2551B0070dfCf5ca7";
const ETHEREUM_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
];
const LIGHTER_ABI = ["function deposit(address _to,uint16 _assetIndex,uint8 _routeType,uint256 _amount) payable"];

export type LighterWalletProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

async function verifiedUsdcAssetIndex(): Promise<number> {
  const data = await lighterPublicGet("/api/v1/assetDetails");
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const matching = assets.filter(v => {
    if (!v || typeof v !== "object") return false;
    const a = v as Record<string, unknown>;
    return a.symbol === "USDC" &&
      typeof a.l1_address === "string" &&
      a.l1_address.toLowerCase() === ETHEREUM_USDC.toLowerCase() &&
      Number(a.l1_decimals) === 6;
  });
  if (matching.length !== 1) {
    throw new Error("Official Lighter USDC asset metadata could not be verified. No transaction was sent.");
  }
  const id = Number((matching[0] as Record<string, unknown>).asset_id);
  if (!Number.isSafeInteger(id) || id < 0 || id > 65535) {
    throw new Error("Invalid USDC asset index. No transaction was sent.");
  }
  return id;
}

export async function depositLighterUsdcOnEthereum(args: {
  walletAddress: string;
  amount: string;
  getWalletProvider: () => Promise<LighterWalletProvider>;
  onStage?: (status: string) => void;
}): Promise<string> {
  const { walletAddress, amount, getWalletProvider, onStage } = args;
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) throw new Error("Connect the correct Ethereum wallet first.");
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(amount.trim())) {
    throw new Error("Enter a valid USDC amount with up to six decimals.");
  }
  const units = parseUnits(amount.trim(), 6);
  if (units < 1000000n) throw new Error("Lighter Ethereum deposit minimum is 1 USDC.");

  onStage?.("Checking the official Lighter asset index…");
  const assetIndex = await verifiedUsdcAssetIndex();
  const wallet = await getWalletProvider();
  if (!wallet || typeof wallet.request !== "function") throw new Error("Wallet provider unavailable.");
  const chainHex = await wallet.request({ method: "eth_chainId" });
  if (Number(BigInt(chainHex)) !== 1) {
    onStage?.("Approve switching your wallet to Ethereum mainnet…");
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
  }
  if (Number(BigInt(await wallet.request({ method: "eth_chainId" }))) !== 1) {
    throw new Error("Ethereum mainnet (chain ID 1) is required. No transaction was sent.");
  }
  const provider = new BrowserProvider(wallet as any);
  const signer = await provider.getSigner();
  const signerAddress = getAddress(await signer.getAddress());
  if (signerAddress !== getAddress(walletAddress)) {
    throw new Error("Connected signer does not match your HideDex wallet. No transaction was sent.");
  }

  const usdc = new Contract(ETHEREUM_USDC, USDC_ABI, signer);
  const balance = await usdc.balanceOf(signerAddress) as bigint;
  if (balance < units) throw new Error("Insufficient Ethereum-mainnet USDC. No transaction was sent.");

  let allowance = await usdc.allowance(signerAddress, LIGHTER_L1) as bigint;
  if (allowance < units) {
    onStage?.("Confirm an exact-amount USDC allowance in your wallet…");
    // Never grant unlimited spending; approval is exclusively for this deposit amount.
    const approval = await usdc.approve(LIGHTER_L1, units);
    const approvalReceipt = await approval.wait();
    if (!approvalReceipt || approvalReceipt.status !== 1) throw new Error("USDC approval did not confirm.");
    allowance = await usdc.allowance(signerAddress, LIGHTER_L1) as bigint;
    if (allowance < units) throw new Error("USDC allowance remains insufficient; no deposit was sent.");
  }

  onStage?.("Confirm your deposit to Lighter in your wallet…");
  const bridge = new Contract(LIGHTER_L1, LIGHTER_ABI, signer);
  // routeType=0 credits Lighter perpetuals, never Hyperliquid.
  const depositTx = await bridge.deposit(signerAddress, assetIndex, 0, units);
  onStage?.("Ethereum transaction sent: " + depositTx.hash.slice(0, 14) + "… Waiting for confirmation.");
  const receipt = await depositTx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deposit reverted on Ethereum. Check your wallet history.");
  onStage?.("Ethereum deposit confirmed. Lighter credit may take several minutes. Tx: " + depositTx.hash);
  return depositTx.hash;
}

/**
 * Official legacy CCTP Arbitrum -> Lighter perps USDC bridge.
 * Intent address is generated by Lighter's public API for THIS wallet address.
 * On Ethereum/Arbitrum users choose the route before signing any transaction.
 */
export async function depositLighterUsdcFromArbitrum(args: {
  walletAddress: string;
  amount: string;
  getWalletProvider: () => Promise<LighterWalletProvider>;
  onStage?: (status: string) => void;
}): Promise<string> {
  const { walletAddress, amount, getWalletProvider, onStage } = args;
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) throw new Error("Connect your Ethereum wallet first.");
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(amount.trim())) {
    throw new Error("Enter a valid USDC amount with up to six decimals.");
  }
  const units = parseUnits(amount.trim(), 6);
  if (units < 5000000n) throw new Error("Lighter CCTP deposit minimum is 5 USDC.");

  const wallet = await getWalletProvider();
  if (!wallet || typeof wallet.request !== "function") throw new Error("Wallet provider unavailable.");
  const sourceChain = 42161;
  if (Number(BigInt(await wallet.request({ method: "eth_chainId" }))) !== sourceChain) {
    onStage?.("Approve switching your wallet to Arbitrum One…");
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa4b1" }] });
  }
  if (Number(BigInt(await wallet.request({ method: "eth_chainId" }))) !== sourceChain) {
    throw new Error("Arbitrum One (chain ID 42161) is required. No funds were sent.");
  }
  const provider = new BrowserProvider(wallet as any);
  const signer = await provider.getSigner();
  const signerAddress = getAddress(await signer.getAddress());
  if (signerAddress !== getAddress(walletAddress)) {
    throw new Error("Wallet address changed. No transaction was sent.");
  }

  onStage?.("Requesting your personal USDC bridge address from Lighter…");
  const response = await fetch("https://mainnet.zklighter.elliot.ai/api/v1/createIntentAddress", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      chain_id: "42161",
      from_addr: signerAddress,
      amount: "0",
      is_external_deposit: "true",
    }),
  });
  if (!response.ok) throw new Error("Official Lighter bridge endpoint failed. No transaction was sent.");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid bridge response.");
  const data = payload as Record<string, unknown>;
  if (data.code !== 200 || typeof data.intent_address !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(data.intent_address)) {
    throw new Error("Lighter did not return a verified intent address. No funds were sent.");
  }
  const intent = getAddress(data.intent_address);
  if (intent === signerAddress) throw new Error("Invalid self-referential bridge address. No funds were sent.");

  const token = new Contract("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to,uint256 amount) returns (bool)",
  ], signer);
  const balance = await token.balanceOf(signerAddress) as bigint;
  if (balance < units) throw new Error("Insufficient Arbitrum native USDC. No transaction was sent.");

  onStage?.("Confirm USDC transfer to your Lighter bridge address in your wallet…");
  const tx = await token.transfer(intent, units);
  onStage?.("Arbitrum transaction sent: " + tx.hash.slice(0, 14) + "… Waiting for confirmation.");
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Arbitrum transfer reverted. Check wallet transactions.");
  onStage?.("Arbitrum deposit confirmed. Lighter CCTP credit usually takes around 15–20 minutes. Tx: " + tx.hash);
  return tx.hash;
}
