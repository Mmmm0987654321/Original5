/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WalletAccount {
  address: string;
  chainId: number;
  providerType: 'injected' | 'walletconnect' | 'phantom' | 'metamask' | string;
  isConnected: boolean;
}

export interface WalletState {
  connected: boolean;
  address: string;
  walletType: 'MetaMask' | 'Rabby' | 'Coinbase' | 'WalletConnect' | 'Injected' | 'ReadOnly' | 'Phantom' | null;
  chainId: number;
  error: string | null;
  isSimulated: boolean;
  connectorName?: string;
}
