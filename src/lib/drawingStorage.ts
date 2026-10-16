/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SavedDrawingPoint = {
  timestamp: number;
  value?: number;
};

export type SavedDrawing = {
  tool: string;
  points: SavedDrawingPoint[];
  extendData?: unknown;
};

function getStorageKey(marketKey: string): string {
  const normalized = String(marketKey || 'PERP').trim().toUpperCase();
  return `chartDrawings:${normalized}`;
}

export function loadDrawings(marketKey: string): SavedDrawing[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const key = getStorageKey(marketKey);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validDrawings: SavedDrawing[] = [];

    for (const item of parsed) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.tool !== 'string' ||
        !item.tool.trim() ||
        !Array.isArray(item.points) ||
        item.points.length === 0
      ) {
        continue;
      }

      const validPoints: SavedDrawingPoint[] = [];

      for (const pt of item.points) {
        if (!pt || typeof pt !== 'object') continue;
        const timestamp = Number(pt.timestamp);
        if (!Number.isFinite(timestamp)) continue;

        const point: SavedDrawingPoint = { timestamp };
        if (pt.value !== undefined) {
          const val = Number(pt.value);
          if (Number.isFinite(val)) {
            point.value = val;
          }
        }
        validPoints.push(point);
      }

      if (validPoints.length === 0) continue;

      const drawing: SavedDrawing = {
        tool: item.tool.trim(),
        points: validPoints,
      };

      if (item.extendData !== undefined && typeof item.extendData !== 'function') {
        drawing.extendData = item.extendData;
      }

      validDrawings.push(drawing);
    }

    return validDrawings;
  } catch {
    return [];
  }
}

export function saveDrawings(
  marketKey: string,
  drawings: SavedDrawing[]
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const key = getStorageKey(marketKey);
    if (!drawings || drawings.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(drawings));
    }
  } catch {
    // Ignore storage errors
  }
}
