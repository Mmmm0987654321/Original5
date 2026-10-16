import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { arbitrum, mainnet } from "@reown/appkit/networks";

const rawProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const projectId = typeof rawProjectId === "string" ? rawProjectId.trim() : "";

if (!projectId) {
  throw new Error("VITE_WALLETCONNECT_PROJECT_ID is not configured");
}

export const networks = [arbitrum, mainnet];

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

