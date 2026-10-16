/**
 * Native KLineCharts renderer for trade / fill B/S markers.
 *
 * Uses a single locked, event-transparent overlay figure in a dedicated group
 * so markers remain anchored to the correct candle during scroll, zoom, pan,
 * timeframe change, and resize, without interfering with user drawings.
 */

import {
  registerOverlay,
  type Chart,
  type OverlayFigure,
} from 'klinecharts';

export type KlineTradeMarker = {
  id: string;
  timestamp: number;
  value: number;
  side: "BUY" | "SELL";
  fillPrice?: number;
};

export const TRADE_MARKER_OVERLAY = "anonymous_liquid_trade_markers";
export const TRADE_MARKER_GROUP = "anonymous_liquid_trade_markers";
const OVERLAY_ID = `${TRADE_MARKER_GROUP}_all`;

const FONT =
  '"Basel Grotesk", Basel, Inter, ui-sans-serif, system-ui, sans-serif';

const BADGE_SIZE = 16;
const GAP = 3;
const STEP = BADGE_SIZE + GAP;

let registered = false;

export function ensureKlineTradeMarkerOverlay(): void {
  if (registered) return;
  registered = true;

  registerOverlay<KlineTradeMarker[]>({
    name: TRADE_MARKER_OVERLAY,
    totalStep: 2,
    lock: true,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, bounding, overlay }) => {
      const markers = overlay.extendData;
      if (!Array.isArray(markers) || !markers.length) {
        return [];
      }

      const figures: OverlayFigure[] = [];
      const buyCountMap = new Map<number, number>();
      const sellCountMap = new Map<number, number>();

      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        const marker = markers[i];
        if (!coord || !marker || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) {
          continue;
        }

        const ts = marker.timestamp;
        const x = coord.x - BADGE_SIZE / 2;
        let y: number;

        if (marker.side === 'BUY') {
          const count = buyCountMap.get(ts) ?? 0;
          buyCountMap.set(ts, count + 1);
          y = coord.y + 4 + count * STEP;
        } else {
          const count = sellCountMap.get(ts) ?? 0;
          sellCountMap.set(ts, count + 1);
          y = coord.y - 4 - BADGE_SIZE - count * STEP;
        }

        const clampedX = Math.max(0, Math.min(bounding.width - BADGE_SIZE, x));
        const clampedY = Math.max(0, Math.min(bounding.height - BADGE_SIZE, y));

        figures.push({
          type: 'rect',
          attrs: {
            x: clampedX,
            y: clampedY,
            width: BADGE_SIZE,
            height: BADGE_SIZE,
          },
          styles: {
            style: 'fill',
            color: marker.side === 'BUY' ? '#2DC08E' : '#F92855',
            borderRadius: 3,
            borderSize: 0,
          },
          ignoreEvent: true,
        });

        figures.push({
          type: 'text',
          attrs: {
            x: clampedX + BADGE_SIZE / 2,
            y: clampedY + BADGE_SIZE / 2,
            text: marker.side === 'BUY' ? 'B' : 'S',
            align: 'center',
            baseline: 'middle',
          },
          styles: {
            style: 'fill',
            color: '#FFFFFF',
            backgroundColor: 'transparent',
            size: 10,
            weight: 'bold',
            family: FONT,
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            borderSize: 0,
          },
          ignoreEvent: true,
        });
      }

      return figures;
    },
  });
}

export function syncKlineTradeMarkers(
  chart: Chart,
  markers: KlineTradeMarker[],
  enabled: boolean
): void {
  ensureKlineTradeMarkerOverlay();

  const existing = chart.getOverlays({
    groupId: TRADE_MARKER_GROUP,
  });

  if (!enabled || !markers.length) {
    for (const o of existing) {
      chart.removeOverlay({
        id: o.id,
      });
    }
    return;
  }

  const points = markers.map((m) => ({
    timestamp: m.timestamp,
    value: m.value,
  }));

  const extendData = markers;

  const has = existing.some((o) => o.id === OVERLAY_ID);

  for (const o of existing) {
    if (o.id !== OVERLAY_ID) {
      chart.removeOverlay({
        id: o.id,
      });
    }
  }

  if (has) {
    chart.overrideOverlay({
      id: OVERLAY_ID,
      points,
      extendData,
    });
  } else {
    chart.createOverlay({
      name: TRADE_MARKER_OVERLAY,
      id: OVERLAY_ID,
      groupId: TRADE_MARKER_GROUP,
      paneId: 'candle_pane',
      points,
      extendData,
      lock: true,
      visible: true,
      zLevel: 10,
    });
  }
}
