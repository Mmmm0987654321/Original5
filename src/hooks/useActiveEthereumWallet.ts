import { useMemo, useCallback } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { getAddress } from "viem";
import type { Eip1193Provider } from "../lib/hyperliquid";

export type WalletAuthKind = "embedded" | "external" | null;

export interface ActiveEthereumWallet {
  address: `0x${string}` | null;
  normalizedAddress: string | null;
  kind: WalletAuthKind;
  isConnected: boolean;
  isExternal: boolean;
  isEmbedded: boolean;
  walletClientType: string | null;
  getProvider: () => Promise<Eip1193Provider>;
}

export function useActiveEthereumWallet(): ActiveEthereumWallet {
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount({
    namespace: "eip155",
  });
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");

  // TEMPORARY REOWN-ONLY MODE:
  // Active wallet requires appKitConnected === true, valid appKitAddress, real walletProvider exists.
  // Privy authentication / embedded wallets are bypassed for this mode.
  const activeIdentity = useMemo(() => {
    if (appKitConnected && appKitAddress && walletProvider) {
      try {
        const normalized = getAddress(appKitAddress);
        return {
          kind: "external" as WalletAuthKind,
          address: normalized,
          walletClientType: "WalletConnect",
        };
      } catch {
        // Invalid address format
      }
    }

    return {
      kind: null as WalletAuthKind,
      address: null as `0x${string}` | null,
      walletClientType: null as string | null,
    };
  }, [appKitConnected, appKitAddress, walletProvider]);

  const getProvider = useCallback(async (): Promise<Eip1193Provider> => {
    if (!activeIdentity.kind || !activeIdentity.address) {
      throw new Error("Wallet session expired. Reconnect your wallet and try again.");
    }

    if (!appKitConnected || !walletProvider) {
      throw new Error("External wallet session expired. Reconnect your wallet and try again.");
    }

    const accounts = (await walletProvider.request({
      method: "eth_accounts",
    })) as string[] | undefined;

    const first = accounts?.[0];
    if (!first) {
      throw new Error("External wallet session expired. Reconnect your wallet and try again.");
    }

    const signer = getAddress(first);
    if (signer.toLowerCase() !== activeIdentity.address.toLowerCase()) {
      throw new Error("Connected wallet account changed. Please reconnect your wallet and try again.");
    }

    return walletProvider;
  }, [activeIdentity, appKitConnected, walletProvider]);

  return {
    address: activeIdentity.address,
    normalizedAddress: activeIdentity.address ? activeIdentity.address.toLowerCase() : null,
    kind: activeIdentity.kind,
    isConnected: !!activeIdentity.address && activeIdentity.kind === "external",
    isExternal: activeIdentity.kind === "external",
    isEmbedded: false,
    walletClientType: activeIdentity.walletClientType,
    getProvider,
  };
}
