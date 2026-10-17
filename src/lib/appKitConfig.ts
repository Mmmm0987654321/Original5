import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { arbitrum, mainnet, bsc } from "@reown/appkit/networks";

const rawProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
// Public Reown project ID already documented in this repository's .env.example.
// Prefer Vercel's configured value; use this existing ID if a newly imported
// project is missing VITE_WALLETCONNECT_PROJECT_ID. This is a public client ID,
// not a secret or wallet signing credential.
const projectId = typeof rawProjectId === "string" && rawProjectId.trim()
  ? rawProjectId.trim()
  : "e36f4642eb489923b516cbf3f0dfd68e";

if (!projectId) {
  throw new Error("VITE_WALLETCONNECT_PROJECT_ID is not configured");
}

// Keep existing default Arbitrum; BSC is selectable only for user-approved Aster signing.
export const networks = [arbitrum, mainnet, bsc];

export const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  defaultNetwork: arbitrum,
  projectId,
  metadata: {
    name: "HideDex",
    description: "Hyperliquid spot and perpetual trading interface",
    url: typeof window !== "undefined" ? window.location.origin : "",
    icons: ["https://www.hidedex.com/hidedex-wallet-icon-20261013.png"],
  },
  features: {
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
});

