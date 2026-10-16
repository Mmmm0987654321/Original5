/**
 * Price lines for the trade chart.
 *
 * Adapted from the verified HyperTrade web chart-line model to the
 * existing Anonymous Liquid Position/OpenOrder types.
 *
 * Pure data only. Rendering lives in klineLines.ts.
 */

import type {
  OpenOrder,
  Position,
} from '../types';

export type ChartLineKind =
  | 'entry'
  | 'liq'
  | 'tp'
  | 'sl'
  | 'buy'
  | 'sell';

export type ChartPriceLine = {
  /**
   * Stable id so the renderer can update in place instead of flickering.
   */
  id: string;

  kind: ChartLineKind;

  price: number;

  /**
   * Short right-edge tag.
   */
  label: string;

  color: string;

  dashed: boolean;
};

const UP = '#77c7af';
const DOWN = '#ff9c9c';
const LIQ = '#ff9c9c';
const MUTED = '#ffffff99';

function formatPx(
  v:
    | number
    | null
    | undefined,
): string {
  if (
    v == null ||
    !Number.isFinite(v)
  ) {
    return '—';
  }

  const abs =
    Math.abs(v);

  if (abs >= 1000) {
    return v.toLocaleString(
      'en-US',
      {
        maximumFractionDigits:
          2,

        minimumFractionDigits:
          2,
      },
    );
  }

  if (abs >= 1) {
    return v.toLocaleString(
      'en-US',
      {
        maximumFractionDigits:
          abs >= 100
            ? 2
            : 4,
      },
    );
  }

  return v
    .toPrecision(4)
    .replace(
      /\.?0+$/,
      '',
    );
}

function sameCoin(
  a: string,
  b: string,
): boolean {
  return (
    a.toUpperCase() ===
    b.toUpperCase()
  );
}

function positionCoin(
  position: Position,
): string {
  return String(
    position.sourceCoin ||
      position.symbol ||
      '',
  );
}

function orderCoin(
  order: OpenOrder,
): string {
  return String(
    order.sourceCoin ||
      order.symbol ||
      '',
  );
}

/**
 * Entry color by live mark vs entry.
 * Green means position is on the profitable side of entry,
 * red means it is on the losing side.
 */
function entryColor(
  pos: Position,
  mark: number | null,
): string {
  const entry =
    Number(
      pos.entryPrice,
    );

  if (
    !Number.isFinite(entry) ||
    entry <= 0
  ) {
    return MUTED;
  }

  if (
    mark == null ||
    !Number.isFinite(mark) ||
    mark <= 0
  ) {
    return MUTED;
  }

  const rawSzi =
    Number(
      pos.rawSzi,
    );

  const isLong =
    Number.isFinite(rawSzi) &&
    rawSzi !== 0
      ? rawSzi >= 0
      : pos.type ===
        'LONG';

  if (isLong) {
    return mark >= entry
      ? UP
      : DOWN;
  }

  return mark <= entry
    ? UP
    : DOWN;
}

/**
 * Build chart lines for one raw Hyperliquid coin.
 *
 * For HIP-3 markets `sourceCoin` is intentionally used first so the
 * dex-prefixed raw coin remains the matching authority.
 *
 * Spot callers must pass no positions/orders or simply not call this.
 */
export function buildChartLines(
  args: {
    coin: string;

    positions:
      | Position[]
      | null
      | undefined;

    orders:
      | OpenOrder[]
      | null
      | undefined;

    mark:
      | number
      | null;
  },
): ChartPriceLine[] {
  const out:
    ChartPriceLine[] = [];

  if (!args.coin) {
    return out;
  }

  const pos =
    (
      args.positions ??
      []
    ).find(
      (p) =>
        sameCoin(
          positionCoin(p),
          args.coin,
        ) &&
        Number(p.size) !==
          0,
    );

  if (
    pos &&
    Number.isFinite(
      Number(
        pos.entryPrice,
      ),
    ) &&
    Number(
      pos.entryPrice,
    ) > 0
  ) {
    const entry =
      Number(
        pos.entryPrice,
      );

    out.push({
      id: 'entry',

      kind:
        'entry',

      price:
        entry,

      label:
        `Avg. ${formatPx(
          entry,
        )}`,

      color:
        entryColor(
          pos,
          args.mark,
        ),

      dashed:
        false,
    });

    const liq =
      Number(
        pos.liqPrice,
      );

    if (
      Number.isFinite(
        liq,
      ) &&
      liq > 0
    ) {
      out.push({
        id:
          'liq',

        kind:
          'liq',

        price:
          liq,

        label:
          `Liq ${formatPx(
            liq,
          )}`,

        color:
          LIQ,

        dashed:
          true,
      });
    }
  }

  for (
    const o of
    args.orders ??
    []
  ) {
    if (
      !sameCoin(
        orderCoin(o),
        args.coin,
      )
    ) {
      continue;
    }

    const isTpsl =
      o.tpsl ===
        'tp' ||
      o.tpsl ===
        'sl';

    const triggerPx =
      Number(
        o.triggerPrice ??
          0,
      );

    const trigger =
      o.isTrigger ===
        true ||
      isTpsl ||
      (
        Number.isFinite(
          triggerPx,
        ) &&
        triggerPx > 0
      );

    const limitPx =
      Number(
        o.price,
      );

    const px =
      trigger &&
      Number.isFinite(
        triggerPx,
      ) &&
      triggerPx > 0
        ? triggerPx
        : limitPx;

    if (
      !Number.isFinite(
        px,
      ) ||
      px <= 0
    ) {
      continue;
    }

    const isBuy =
      o.side ===
      'BUY';

    const stableOrderId =
      o.oid != null
        ? String(
            o.oid,
          )
        : String(
            o.id,
          );

    if (isTpsl) {
      const tp =
        o.tpsl ===
        'tp';

      out.push({
        id:
          `o${stableOrderId}`,

        kind:
          tp
            ? 'tp'
            : 'sl',

        price:
          px,

        label:
          `${tp ? 'TP' : 'SL'} ${formatPx(
            px,
          )}`,

        color:
          tp
            ? UP
            : DOWN,

        dashed:
          true,
      });

      continue;
    }

    out.push({
      id:
        `o${stableOrderId}`,

      kind:
        isBuy
          ? 'buy'
          : 'sell',

      price:
        px,

      label:
        `${trigger ? 'Stop ' : ''}${isBuy ? 'Buy' : 'Sell'} ${formatPx(
          px,
        )}`,

      color:
        isBuy
          ? UP
          : DOWN,

      dashed:
        true,
    });
  }

  return out;
}
