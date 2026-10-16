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
