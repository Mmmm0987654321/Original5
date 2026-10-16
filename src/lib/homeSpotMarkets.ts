import type {
  HypertradeCryptoAsset as Asset,
} from './hyperliquid';

export const HOME_SPOT_MARKET_ORDER = [
  'BTC',
  'HYPE',
  'ETH',
  'SOL',
  'ZEC',
  'ENA',
  'MON',
  'XPL',
  'KNTQ',
  'USDT',
] as const;

export const HOME_SPOT_WHITELIST =
  new Set<string>(
    HOME_SPOT_MARKET_ORDER.map(
      (symbol) => symbol.toUpperCase(),
    ),
  );

const ORDER_FALLBACK_RANK =
  Number.MAX_SAFE_INTEGER;

const buildOrderRankMap = (
  symbols: readonly string[],
): Map<string, number> =>
  new Map(
    symbols.map(
      (symbol, idx) => [
        symbol.toUpperCase(),
        idx,
      ],
    ),
  );

const HOME_SPOT_ORDER_RANK =
  buildOrderRankMap(
    HOME_SPOT_MARKET_ORDER,
  );

const getAssetSortSymbol = (
  asset: Asset,
): string =>
  String(
    asset.symbol ||
    asset.coin ||
    '',
  ).toUpperCase();

export function getHomeSpotAssets(
  sourceAssets: Asset[],
): Asset[] {
  const assets =
    sourceAssets.filter(
      (asset) =>
        (
          asset.hasSpot === true ||
          asset.isSpotOnly === true
        ) &&
        HOME_SPOT_WHITELIST.has(
          String(
            asset.symbol ||
            asset.coin ||
            '',
          ).toUpperCase(),
        ),
    );

  return [...assets].sort(
    (a, b) => {
      const aSymbol =
        getAssetSortSymbol(a);

      const bSymbol =
        getAssetSortSymbol(b);

      const aRank =
        HOME_SPOT_ORDER_RANK.get(
          aSymbol,
        ) ??
        ORDER_FALLBACK_RANK;

      const bRank =
        HOME_SPOT_ORDER_RANK.get(
          bSymbol,
        ) ??
        ORDER_FALLBACK_RANK;

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      return aSymbol.localeCompare(
        bSymbol,
      );
    },
  );
}
