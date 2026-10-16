import {
  registerOverlay,
  utils,
  type Coordinate,
  type OverlayFigure,
  type OverlayTemplate,
} from 'klinecharts';

function getDistance(c1: Coordinate, c2: Coordinate): number {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getRotateCoordinate(coordinate: Coordinate, target: Coordinate, angle: number): Coordinate {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = coordinate.x - target.x;
  const dy = coordinate.y - target.y;
  return {
    x: dx * cos - dy * sin + target.x,
    y: dx * sin + dy * cos + target.y,
  };
}

function getPrecision(chart: any, yAxis: any, paneId: string): number {
  if (!chart) return 2;
  if (yAxis && typeof yAxis.isInCandle === 'function' && yAxis.isInCandle()) {
    return chart.getSymbol()?.pricePrecision ?? 2;
  }
  const indicators = chart.getIndicators?.({ paneId }) ?? [];
  if (indicators.length > 0) {
    return Math.max(...indicators.map((ind: any) => ind.precision ?? 2));
  }
  return chart.getSymbol()?.pricePrecision ?? 2;
}

const FIB_LEVEL_COLORS = [
  '#F92855',
  '#F59E0B',
  '#FACC15',
  '#2DC08E',
  '#22D3EE',
  '#60A5FA',
  '#A78BFA',
  '#EC4899',
];

function getOverlayThemeColors(overlay: any) {
  const styles = (overlay?.styles ?? {}) as any;
  const isLight =
    styles?.text?.backgroundColor === '#FFFFFF' ||
    styles?.line?.color === '#334155' ||
    (typeof document !== 'undefined' &&
      (document.documentElement.classList.contains('light') ||
        document.body.classList.contains('light')));

  const defaultLine = isLight ? '#334155' : '#94A3B8';
  const defaultText = isLight ? '#1E293B' : '#F8FAFC';
  const defaultTextBg = isLight ? '#FFFFFF' : '#0F172A';
  const defaultFill = isLight
    ? 'rgba(51, 65, 85, 0.08)'
    : 'rgba(148, 163, 184, 0.10)';
  const defaultBorder = isLight ? '#334155' : '#94A3B8';

  return {
    line: styles?.line?.color ?? defaultLine,
    text: styles?.text?.color ?? styles?.line?.color ?? defaultText,
    textBackground: styles?.text?.backgroundColor ?? defaultTextBg,
    fill: styles?.polygon?.color ?? styles?.rect?.color ?? defaultFill,
    border:
      styles?.polygon?.borderColor ??
      styles?.rect?.borderColor ??
      styles?.line?.color ??
      defaultBorder,
  };
}

function midpoint(a: Coordinate, b: Coordinate): Coordinate {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function addCoordinate(a: Coordinate, b: Coordinate): Coordinate {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

function subtractCoordinate(a: Coordinate, b: Coordinate): Coordinate {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function scaleCoordinate(a: Coordinate, factor: number): Coordinate {
  return {
    x: a.x * factor,
    y: a.y * factor,
  };
}

function dotCoordinate(a: Coordinate, b: Coordinate): number {
  return a.x * b.x + a.y * b.y;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTimestampRangeData(
  chart: any,
  startTimestamp: number,
  endTimestamp: number
) {
  const minTimestamp = Math.min(startTimestamp, endTimestamp);
  const maxTimestamp = Math.max(startTimestamp, endTimestamp);

  return (chart?.getDataList?.() ?? []).filter((bar: any) => {
    const ts = Number(bar?.timestamp);
    return (
      Number.isFinite(ts) &&
      ts >= minTimestamp &&
      ts <= maxTimestamp
    );
  });
}

function formatElapsedTime(ms: number): string {
  const absMs = Math.abs(ms);
  if (absMs < 3600_000) {
    return `${Math.max(1, Math.round(absMs / 60_000))}m`;
  }
  if (absMs < 48 * 3600_000) {
    const h = Math.floor(absMs / 3600_000);
    const m = Math.round((absMs % 3600_000) / 60_000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(absMs / 86400_000);
  const h = Math.round((absMs % 86400_000) / 3600_000);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function buildInfoBoxFigures(
  coordinates: Coordinate[],
  texts: string[],
  bounding: any,
  tipBackgroundColor = '#2196F3'
): OverlayFigure[] {
  if (texts.length === 0 || coordinates.length < 2) return [];

  const topToBottom = coordinates[0].y < coordinates[1].y;
  const centerCoordinate = {
    x: Math.round((coordinates[0].x + coordinates[1].x) / 2),
    y: Math.round((coordinates[0].y + coordinates[1].y) / 2),
  };

  const tipGap = 8;
  const textGap = 4;
  const horizontalPadding = 12;
  const verticalPadding = 8;

  const height =
    texts.length * 12 +
    (texts.length - 1) * textGap +
    verticalPadding * 2;

  let maxWidth = 0;
  texts.forEach((text) => {
    const textWidth = utils.calcTextWidth(text);
    maxWidth = Math.max(maxWidth, textWidth);
  });

  const width = maxWidth + horizontalPadding * 2;

  let y: number;
  if (topToBottom) {
    y = coordinates[1].y + tipGap;
    if (bounding?.height && y + height > bounding.height) {
      y = coordinates[1].y - tipGap - height;
    }
  } else {
    y = coordinates[1].y - tipGap - height;
    if (y < 0) {
      y = coordinates[1].y + tipGap;
    }
  }

  if (bounding?.height && y + height > bounding.height) {
    y = bounding.height - height;
  }
  if (y < 0) {
    y = 0;
  }

  const figures: OverlayFigure[] = [];

  figures.push({
    type: 'rect',
    attrs: {
      x: centerCoordinate.x - width / 2,
      y,
      width,
      height,
    },
    styles: {
      borderRadius: 4,
      color: tipBackgroundColor,
    },
    ignoreEvent: true,
  });

  texts.forEach((text, i) => {
    figures.push({
      type: 'text',
      attrs: {
        x: centerCoordinate.x,
        y: y + verticalPadding + i * (12 + textGap),
        text,
        align: 'center',
        baseline: 'top',
      },
      styles: {
        backgroundColor: 'none',
        paddingLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
      },
      ignoreEvent: true,
    });
  });

  return figures;
}

type LineAttrs = {
  coordinates: Coordinate[];
};

function getRayLine(coordinates: Coordinate[], bounding: any): LineAttrs | LineAttrs[] {
  if (coordinates.length > 1) {
    let coordinate: Coordinate;
    if (coordinates[0].x === coordinates[1].x && coordinates[0].y !== coordinates[1].y) {
      if (coordinates[0].y < coordinates[1].y) {
        coordinate = {
          x: coordinates[0].x,
          y: bounding?.height ?? 0,
        };
      } else {
        coordinate = {
          x: coordinates[0].x,
          y: 0,
        };
      }
    } else if (coordinates[0].x > coordinates[1].x) {
      coordinate = {
        x: 0,
        y: utils.getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: 0, y: coordinates[0].y }),
      };
    } else {
      coordinate = {
        x: bounding?.width ?? 0,
        y: utils.getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: bounding?.width ?? 0, y: coordinates[0].y }),
      };
    }
    return { coordinates: [coordinates[0], coordinate] };
  }
  return [];
}

let registered = false;

export function ensureAnonymousLiquidDrawingExtensions(): void {
  if (registered) {
    return;
  }

  // 1. Arrow
  const arrow: OverlayTemplate = {
    name: 'arrow',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        const p1 = coordinates[0];
        const p2 = coordinates[1];
        const kb = utils.getLinearSlopeIntercept(p1, p2);
        let angle = 0;
        if (kb) {
          angle = Math.atan(kb[0]);
          if (p2.x < p1.x) {
            angle += Math.PI;
          }
        } else {
          if (p2.y > p1.y) {
            angle = Math.PI / 2;
          } else {
            angle = (Math.PI / 2) * 3;
          }
        }
        const rotated1 = getRotateCoordinate({ x: p2.x - 8, y: p2.y - 4 }, p2, angle);
        const rotated2 = getRotateCoordinate({ x: p2.x - 8, y: p2.y + 4 }, p2, angle);
        return [
          {
            type: 'line',
            attrs: { coordinates: [p1, p2] },
          },
          {
            type: 'line',
            attrs: { coordinates: [rotated1, p2, rotated2] },
            ignoreEvent: true,
          },
        ];
      }
      return [];
    },
  };

  // 2. Rectangle
  const rect: OverlayTemplate = {
    name: 'rect',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        const p1 = coordinates[0];
        const p2 = coordinates[1];
        return [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                p1,
                { x: p2.x, y: p1.y },
                p2,
                { x: p1.x, y: p2.y },
              ],
            },
            styles: { style: 'stroke_fill' },
          },
        ];
      }
      return [];
    },
  };

  // 3. Circle
  const circle: OverlayTemplate = {
    name: 'circle',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        return [
          {
            type: 'circle',
            attrs: {
              x: coordinates[0].x,
              y: coordinates[0].y,
              r: getDistance(coordinates[0], coordinates[1]),
            },
            styles: { style: 'stroke_fill' },
          },
        ];
      }
      return [];
    },
  };

  // 4. Triangle
  const triangle: OverlayTemplate = {
    name: 'triangle',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      return [
        {
          type: 'polygon',
          attrs: {
            coordinates,
          },
          styles: { style: 'stroke_fill' },
        },
      ];
    },
  };

  // 5. Parallelogram
  const parallelogram: OverlayTemplate = {
    name: 'parallelogram',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
      if (currentStep === 2) {
        points[0].value = performPoint.value;
      }
    },
    performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
      if (performPointIndex < 2) {
        points[0].value = performPoint.value;
        points[1].value = performPoint.value;
      }
    },
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length === 2) {
        return [
          {
            type: 'line',
            attrs: {
              coordinates: [coordinates[0], coordinates[1]],
            },
            ignoreEvent: true,
          },
        ];
      }
      if (coordinates.length > 2) {
        const p1 = coordinates[0];
        const p2 = coordinates[1];
        const p3 = coordinates[2];
        const p4 = {
          x: p1.x + (p3.x - p2.x),
          y: p3.y,
        };
        return [
          {
            type: 'polygon',
            attrs: {
              coordinates: [p1, p2, p3, p4],
            },
            styles: { style: 'stroke_fill' },
          },
        ];
      }
      return [];
    },
  };

  // 6. ABCD Pattern
  const abcd: OverlayTemplate = {
    name: 'abcd',
    totalStep: 5,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      const figures: OverlayFigure[] = [];
      if (coordinates.length > 1) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
        });
      }
      if (coordinates.length > 2) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [coordinates[0], coordinates[2]] },
          styles: { style: 'dashed', dashedValue: [4, 4] },
        });
      }
      if (coordinates.length > 3) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [coordinates[1], coordinates[3]] },
          styles: { style: 'dashed', dashedValue: [4, 4] },
        });
      }
      const labels = ['(A)', '(B)', '(C)', '(D)'];
      coordinates.forEach((coord, i) => {
        if (i < labels.length) {
          figures.push({
            type: 'text',
            attrs: {
              x: coord.x,
              y: coord.y - 8,
              text: labels[i],
              align: 'center',
              baseline: 'bottom',
            },
            ignoreEvent: true,
          });
        }
      });
      return figures;
    },
  };

  // 7. XABCD Pattern
  const xabcd: OverlayTemplate = {
    name: 'xabcd',
    totalStep: 6,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      const figures: OverlayFigure[] = [];
      if (coordinates.length > 2) {
        figures.push({
          type: 'polygon',
          attrs: {
            coordinates: [coordinates[0], coordinates[1], coordinates[2]],
          },
          styles: { style: 'stroke_fill' },
        });
      }
      if (coordinates.length > 4) {
        figures.push({
          type: 'polygon',
          attrs: {
            coordinates: [coordinates[2], coordinates[3], coordinates[4]],
          },
          styles: { style: 'stroke_fill' },
        });
      }
      if (coordinates.length > 1) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
        });
      }
      if (coordinates.length > 2) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [coordinates[0], coordinates[2]] },
          styles: { style: 'dashed', dashedValue: [4, 4] },
        });
      }
      if (coordinates.length > 3) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [coordinates[1], coordinates[3]] },
          styles: { style: 'dashed', dashedValue: [4, 4] },
        });
      }
      if (coordinates.length > 4) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [coordinates[2], coordinates[4]] },
          styles: { style: 'dashed', dashedValue: [4, 4] },
        });
      }
      const labels = ['(X)', '(A)', '(B)', '(C)', '(D)'];
      coordinates.forEach((coord, i) => {
        if (i < labels.length) {
          figures.push({
            type: 'text',
            attrs: {
              x: coord.x,
              y: coord.y - 8,
              text: labels[i],
              align: 'center',
              baseline: 'bottom',
            },
            ignoreEvent: true,
          });
        }
      });
      return figures;
    },
  };

  // 8. Three Waves
  const threeWaves: OverlayTemplate = {
    name: 'threeWaves',
    totalStep: 5,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      const figures: OverlayFigure[] = [];
      if (coordinates.length > 1) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
        });
      }
      coordinates.forEach((coord, i) => {
        figures.push({
          type: 'text',
          attrs: {
            x: coord.x,
            y: coord.y,
            text: `(${i})`,
            align: 'center',
            baseline: 'bottom',
          },
          ignoreEvent: true,
        });
      });
      return figures;
    },
  };

  // 9. Five Waves
  const fiveWaves: OverlayTemplate = {
    name: 'fiveWaves',
    totalStep: 7,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      const figures: OverlayFigure[] = [];
      if (coordinates.length > 1) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
        });
      }
      coordinates.forEach((coord, i) => {
        figures.push({
          type: 'text',
          attrs: {
            x: coord.x,
            y: coord.y,
            text: `(${i})`,
            align: 'center',
            baseline: 'bottom',
          },
          ignoreEvent: true,
        });
      });
      return figures;
    },
  };

  // 10. Eight Waves
  const eightWaves: OverlayTemplate = {
    name: 'eightWaves',
    totalStep: 10,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      const figures: OverlayFigure[] = [];
      if (coordinates.length > 1) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
        });
      }
      coordinates.forEach((coord, i) => {
        figures.push({
          type: 'text',
          attrs: {
            x: coord.x,
            y: coord.y,
            text: `(${i})`,
            align: 'center',
            baseline: 'bottom',
          },
          ignoreEvent: true,
        });
      });
      return figures;
    },
  };

  // 11. Fibonacci Retracement (custom multi-color)
  const fibonacciRetracement: OverlayTemplate = {
    name: 'fibonacciRetracement',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, overlay, yAxis, chart }) => {
      if (coordinates.length > 1) {
        const points = overlay.points;
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const yDif = coordinates[0].y - coordinates[1].y;
        const valueDif = (points[0]?.value ?? 0) - (points[1]?.value ?? 0);
        const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
        const minX = Math.min(coordinates[0].x, coordinates[1].x);
        const maxX = Math.max(coordinates[0].x, coordinates[1].x);
        const figures: OverlayFigure[] = [];

        percents.forEach((percent, idx) => {
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const y = coordinates[1].y + yDif * percent;
          const price = (points[1]?.value ?? 0) + valueDif * percent;
          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x: minX, y },
                { x: maxX, y },
              ],
            },
            styles: { color },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: minX,
              y: y - 2,
              text: `${price.toFixed(prec)} (${(percent * 100).toFixed(percent === 0 || percent === 1 || percent === 0.5 ? 0 : 1)}%)`,
              baseline: 'bottom',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 12. Fibonacci Segment
  const fibonacciSegment: OverlayTemplate = {
    name: 'fibonacciSegment',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, overlay, yAxis, chart }) => {
      if (coordinates.length > 1) {
        const points = overlay.points;
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const yDif = coordinates[0].y - coordinates[1].y;
        const valueDif = (points[0]?.value ?? 0) - (points[1]?.value ?? 0);
        const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
        const minX = Math.min(coordinates[0].x, coordinates[1].x);
        const figures: OverlayFigure[] = [];

        percents.forEach((percent, idx) => {
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const y = coordinates[1].y + yDif * percent;
          const price = (points[1]?.value ?? 0) + valueDif * percent;
          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[0].x, y },
                { x: coordinates[1].x, y },
              ],
            },
            styles: { color },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: minX,
              y,
              text: `${price.toFixed(prec)} (${(percent * 100).toFixed(percent === 0 || percent === 1 || percent === 0.5 ? 0 : 1)}%)`,
              baseline: 'bottom',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 13. Fibonacci Circle
  const fibonacciCircle: OverlayTemplate = {
    name: 'fibonacciCircle',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        const radius = Math.sqrt(
          Math.pow(Math.abs(coordinates[0].x - coordinates[1].x), 2) +
          Math.pow(Math.abs(coordinates[0].y - coordinates[1].y), 2)
        );
        const percents = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const figures: OverlayFigure[] = [];

        percents.forEach((percent, idx) => {
          const r = radius * percent;
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push({
            type: 'circle',
            attrs: {
              x: coordinates[0].x,
              y: coordinates[0].y,
              r,
            },
            styles: { style: 'stroke', color },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: coordinates[0].x,
              y: coordinates[0].y + r + 6,
              text: `${(percent * 100).toFixed(percent === 0.5 || percent === 1 ? 0 : 1)}%`,
              align: 'center',
              baseline: 'top',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 14. Fibonacci Spiral
  const fibonacciSpiral: OverlayTemplate = {
    name: 'fibonacciSpiral',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding }) => {
      if (coordinates.length > 1) {
        const startRadius = getDistance(coordinates[0], coordinates[1]) / Math.sqrt(24);
        const flag = coordinates[1].x > coordinates[0].x ? 0 : 1;
        const kb = utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]);
        let offsetAngle: number;
        if (kb) {
          offsetAngle = Math.atan(kb[0]) + Math.PI * flag;
        } else {
          if (coordinates[1].y > coordinates[0].y) {
            offsetAngle = Math.PI / 2;
          } else {
            offsetAngle = (Math.PI / 2) * 3;
          }
        }

        const rotateCenter1 = getRotateCoordinate(
          {
            x: coordinates[0].x - startRadius,
            y: coordinates[0].y,
          },
          coordinates[0],
          offsetAngle
        );
        const rotateCenter2 = getRotateCoordinate(
          {
            x: coordinates[0].x - startRadius,
            y: coordinates[0].y - startRadius,
          },
          coordinates[0],
          offsetAngle
        );

        const arcs: Array<{ x: number; y: number; r: number; startAngle: number; endAngle: number }> = [
          {
            x: rotateCenter1.x,
            y: rotateCenter1.y,
            r: startRadius,
            startAngle: offsetAngle,
            endAngle: offsetAngle + Math.PI / 2,
          },
          {
            x: rotateCenter2.x,
            y: rotateCenter2.y,
            r: startRadius * 2,
            startAngle: offsetAngle + Math.PI / 2,
            endAngle: offsetAngle + Math.PI,
          },
        ];

        let x = coordinates[0].x - startRadius;
        let y = coordinates[0].y - startRadius;

        for (let i = 2; i < 9; i++) {
          const r = arcs[i - 2].r + arcs[i - 1].r;
          let startAngle = offsetAngle;
          switch (i % 4) {
            case 0: {
              startAngle = offsetAngle;
              x -= arcs[i - 2].r;
              break;
            }
            case 1: {
              startAngle = offsetAngle + Math.PI / 2;
              y -= arcs[i - 2].r;
              break;
            }
            case 2: {
              startAngle = offsetAngle + Math.PI;
              x += arcs[i - 2].r;
              break;
            }
            case 3: {
              startAngle = offsetAngle + (Math.PI / 2) * 3;
              y += arcs[i - 2].r;
              break;
            }
          }
          const endAngle = startAngle + Math.PI / 2;
          const center = getRotateCoordinate({ x, y }, coordinates[0], offsetAngle);
          arcs.push({
            x: center.x,
            y: center.y,
            r,
            startAngle,
            endAngle,
          });
        }

        const figures: OverlayFigure[] = [];
        arcs.forEach((arc, i) => {
          figures.push({
            type: 'arc',
            attrs: arc,
            styles: { color: FIB_LEVEL_COLORS[i % FIB_LEVEL_COLORS.length] },
          });
        });

        figures.push({
          type: 'line',
          attrs: getRayLine(coordinates, bounding),
        });

        return figures;
      }
      return [];
    },
  };

  // 15. Fibonacci Speed Resistance Fan
  const fibonacciSpeedResistanceFan: OverlayTemplate = {
    name: 'fibonacciSpeedResistanceFan',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding }) => {
      const figures: OverlayFigure[] = [];

      if (coordinates.length > 1) {
        const xOffset = coordinates[1].x > coordinates[0].x ? -38 : 4;
        const yOffset = coordinates[1].y > coordinates[0].y ? -2 : 20;
        const xDistance = coordinates[1].x - coordinates[0].x;
        const yDistance = coordinates[1].y - coordinates[0].y;
        const percents = [1, 0.75, 0.618, 0.5, 0.382, 0.25, 0];

        percents.forEach((percent, idx) => {
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const x = coordinates[1].x - xDistance * percent;
          const y = coordinates[1].y - yDistance * percent;

          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x, y: coordinates[0].y },
                { x, y: coordinates[1].y },
              ],
            },
            styles: { color },
          });
          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[0].x, y },
                { x: coordinates[1].x, y },
              ],
            },
            styles: { color },
          });

          const ray1 = getRayLine(
            [
              coordinates[0],
              { x, y: coordinates[1].y },
            ],
            bounding
          );
          const ray2 = getRayLine(
            [
              coordinates[0],
              { x, y: coordinates[1].x },
            ],
            bounding
          );

          figures.push({
            type: 'line',
            attrs: ray1,
            styles: { color },
          });
          figures.push({
            type: 'line',
            attrs: ray2,
            styles: { color },
          });

          const text = percent.toFixed(3);
          figures.push({
            type: 'text',
            attrs: {
              x: coordinates[0].x + xOffset,
              y: y + 10,
              text,
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
          figures.push({
            type: 'text',
            attrs: {
              x: x - 18,
              y: coordinates[0].y + yOffset,
              text,
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 16. Fibonacci Extension
  const fibonacciExtension: OverlayTemplate = {
    name: 'fibonacciExtension',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, overlay, yAxis, chart }) => {
      const figures: OverlayFigure[] = [];
      if (coordinates.length > 1) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
          styles: { style: 'dashed', dashedValue: [2, 2] },
        });
      }
      if (coordinates.length > 2) {
        const points = overlay.points;
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const valueDif = (points[1]?.value ?? 0) - (points[0]?.value ?? 0);
        const yDif = coordinates[1].y - coordinates[0].y;
        const percents = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const minX = Math.min(coordinates[1].x, coordinates[2].x);

        percents.forEach((percent, idx) => {
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const y = coordinates[2].y + yDif * percent;
          const price = (points[2]?.value ?? 0) + valueDif * percent;
          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[1].x, y },
                { x: coordinates[2].x, y },
              ],
            },
            styles: { color },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: minX,
              y,
              text: `${price.toFixed(prec)} (${(percent * 100).toFixed(percent === 0 || percent === 1 || percent === 0.5 ? 0 : 1)}%)`,
              baseline: 'bottom',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });
      }
      return figures;
    },
  };

  // 17. Fib Time Zone
  const fibonacciTimeZone: OverlayTemplate = {
    name: 'fibonacciTimeZone',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding }) => {
      if (coordinates.length > 1) {
        const baseX = coordinates[1].x - coordinates[0].x;
        const sequence = [0, 1, 2, 3, 5, 8, 13, 21];
        const bh = bounding?.height ?? 0;
        const figures: OverlayFigure[] = [];

        sequence.forEach((factor, idx) => {
          const x = coordinates[0].x + baseX * factor;
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x, y: 0 },
                { x, y: bh },
              ],
            },
            styles: {
              color,
              style: factor === 0 ? 'solid' : 'dashed',
              dashedValue: [3, 3],
            },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: x + 4,
              y: 14,
              text: `${factor}`,
              baseline: 'top',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 18. Fib Speed Resistance Arcs
  const fibonacciSpeedResistanceArcs: OverlayTemplate = {
    name: 'fibonacciSpeedResistanceArcs',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        const center = coordinates[0];
        const baseRadius = getDistance(coordinates[0], coordinates[1]);
        const levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const figures: OverlayFigure[] = [];

        levels.forEach((level, idx) => {
          const r = baseRadius * level;
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push({
            type: 'circle',
            attrs: {
              x: center.x,
              y: center.y,
              r,
            },
            styles: {
              style: 'stroke',
              color,
            },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: center.x,
              y: center.y + r + 4,
              text: `${(level * 100).toFixed(level === 0.5 || level === 1 ? 0 : 1)}%`,
              align: 'center',
              baseline: 'top',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 19. Gann Box
  const gannBox: OverlayTemplate = {
    name: 'gannBox',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        const point0 = coordinates[0];
        const point1 = coordinates[1];
        const x1 = point0.x;
        const y1 = point0.y;
        const x2 = point1.x;
        const y2 = point1.y;
        const quarterYDis = (y2 - y1) / 4;
        const xDis = x2 - x1;

        const dashedLines: Array<{ coordinates: Coordinate[] }> = [
          // A: point0 -> { x2, y2 - quarterYDis }
          { coordinates: [point0, { x: x2, y: y2 - quarterYDis }] },
          // B: point0 -> { x2, y2 - quarterYDis * 2 }
          { coordinates: [point0, { x: x2, y: y2 - quarterYDis * 2 }] },
          // C: { x1, y2 } -> { x2, y1 + quarterYDis }
          { coordinates: [{ x: x1, y: y2 }, { x: x2, y: y1 + quarterYDis }] },
          // D: { x1, y2 } -> { x2, y1 + quarterYDis * 2 }
          { coordinates: [{ x: x1, y: y2 }, { x: x2, y: y1 + quarterYDis * 2 }] },
          // E: point0 -> { x1 + xDis * 0.236, y: y2 }
          { coordinates: [point0, { x: x1 + xDis * 0.236, y: y2 }] },
          // F: point0 -> { x1 + xDis * 0.5, y: y2 }
          { coordinates: [point0, { x: x1 + xDis * 0.5, y: y2 }] },
          // G: { x1, y2 } -> { x1 + xDis * 0.236, y: y1 }
          { coordinates: [{ x: x1, y: y2 }, { x: x1 + xDis * 0.236, y: y1 }] },
          // H: { x1, y2 } -> { x1 + xDis * 0.5, y: y1 }
          { coordinates: [{ x: x1, y: y2 }, { x: x1 + xDis * 0.5, y: y1 }] },
        ];

        const solidLines: Array<{ coordinates: Coordinate[] }> = [
          // point0 -> point1
          { coordinates: [point0, point1] },
          // { x1, y2 } -> { x2, y1 }
          { coordinates: [{ x: x1, y: y2 }, { x: x2, y: y1 }] },
        ];

        const dashedFigures: OverlayFigure[] = dashedLines.map((line, idx) => ({
          type: 'line',
          attrs: line,
          styles: {
            style: 'dashed',
            color: FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length],
          },
        }));

        const solidFigures: OverlayFigure[] = solidLines.map((line) => ({
          type: 'line',
          attrs: line,
          styles: { color: '#22D3EE' },
        }));

        return [
          // Outer rectangle
          {
            type: 'line',
            attrs: [
              { coordinates: [point0, { x: x2, y: y1 }] },
              { coordinates: [{ x: x2, y: y1 }, point1] },
              { coordinates: [point1, { x: x1, y: y2 }] },
              { coordinates: [{ x: x1, y: y2 }, point0] },
            ],
          },
          // Filled background polygon
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                point0,
                { x: x2, y: y1 },
                point1,
                { x: x1, y: y2 },
              ],
            },
            styles: { style: 'fill' },
            ignoreEvent: true,
          },
          ...dashedFigures,
          ...solidFigures,
        ];
      }
      return [];
    },
  };

  // 20. Gann Fan
  const gannFan: OverlayTemplate = {
    name: 'gannFan',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding }) => {
      if (coordinates.length > 1) {
        const p1 = coordinates[0];
        const p2 = coordinates[1];
        const dy = p2.y - p1.y;
        const ratios = [
          { r: 1 / 8, label: '1:8' },
          { r: 1 / 4, label: '1:4' },
          { r: 1 / 3, label: '1:3' },
          { r: 1 / 2, label: '1:2' },
          { r: 1, label: '1:1' },
          { r: 2, label: '2:1' },
          { r: 3, label: '3:1' },
          { r: 4, label: '4:1' },
          { r: 8, label: '8:1' },
        ];

        const figures: OverlayFigure[] = [];

        ratios.forEach((item, idx) => {
          const target = { x: p2.x, y: p1.y + dy * item.r };
          const ray = getRayLine([p1, target], bounding);
          const isCenter = item.label === '1:1';
          const color = isCenter ? '#22D3EE' : FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const size = isCenter ? 2 : 1;

          figures.push({
            type: 'line',
            attrs: ray,
            styles: { color, size },
          });

          figures.push({
            type: 'text',
            attrs: {
              x: target.x + 4,
              y: target.y,
              text: item.label,
              baseline: 'middle',
            },
            styles: {
              color,
              backgroundColor: 'none',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            },
            ignoreEvent: true,
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 21. Info Line
  const infoLine: OverlayTemplate = {
    name: 'infoLine',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, overlay, yAxis, chart }) => {
      if (coordinates.length > 1) {
        const points = overlay.points;
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const p1 = points[0];
        const p2 = points[1];
        const v1 = p1?.value ?? 0;
        const v2 = p2?.value ?? 0;
        const priceChange = v2 - v1;
        const percent = v1 === 0 ? 0 : (priceChange / v1) * 100;
        const sign = priceChange >= 0 ? '+' : '';
        const text = `${sign}${priceChange.toFixed(prec)} (${sign}${percent.toFixed(2)}%)`;

        const center = {
          x: (coordinates[0].x + coordinates[1].x) / 2,
          y: (coordinates[0].y + coordinates[1].y) / 2,
        };

        return [
          {
            type: 'line',
            attrs: { coordinates: [coordinates[0], coordinates[1]] },
          },
          {
            type: 'text',
            attrs: {
              x: center.x,
              y: center.y - 6,
              text,
              align: 'center',
              baseline: 'bottom',
            },
            styles: {
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
            },
            ignoreEvent: true,
          },
        ];
      }
      return [];
    },
  };

  // 22. Trend Angle
  const trendAngle: OverlayTemplate = {
    name: 'trendAngle',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 1) {
        const p1 = coordinates[0];
        const p2 = coordinates[1];
        const angle = Math.atan2(p1.y - p2.y, p2.x - p1.x) * (180 / Math.PI);
        const text = `${angle.toFixed(1)}°`;
        const center = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };
        return [
          {
            type: 'line',
            attrs: { coordinates: [p1, p2] },
          },
          {
            type: 'text',
            attrs: {
              x: center.x,
              y: center.y - 6,
              text,
              align: 'center',
              baseline: 'bottom',
            },
            styles: {
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
            },
            ignoreEvent: true,
          },
        ];
      }
      return [];
    },
  };

  // 23. Cross Line
  const crossLine: OverlayTemplate = {
    name: 'crossLine',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, bounding }) => {
      if (coordinates.length > 0) {
        const p = coordinates[0];
        const bw = bounding?.width ?? 0;
        const bh = bounding?.height ?? 0;
        return [
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: 0, y: p.y },
                { x: bw, y: p.y },
              ],
            },
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: p.x, y: 0 },
                { x: p.x, y: bh },
              ],
            },
          },
        ];
      }
      return [];
    },
  };

  // 24. Price Range
  const priceRange: OverlayTemplate = {
    name: 'priceRange',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, yAxis, chart, bounding }) => {
      if (coordinates.length > 1) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const points = overlay.points;
        const v1 = points[0]?.value ?? 0;
        const v2 = points[1]?.value ?? 0;
        const priceChange = v2 - v1;
        const percent = v1 === 0 ? 0 : (priceChange / v1) * 100;
        const sign = priceChange >= 0 ? '+' : '';

        const centerCoordinate = {
          x: Math.round((coordinates[0].x + coordinates[1].x) / 2),
          y: Math.round((coordinates[0].y + coordinates[1].y) / 2),
        };

        const {
          backgroundColor = 'rgba(34, 211, 238, 0.1)',
          tipBackgroundColor = '#0891b2',
          lineColor = '#22D3EE',
        } = (overlay.styles ?? {}) as any;

        const figures: OverlayFigure[] = [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                coordinates[0],
                { x: coordinates[1].x, y: coordinates[0].y },
                coordinates[1],
                { x: coordinates[0].x, y: coordinates[1].y },
              ],
            },
            styles: {
              style: 'stroke_fill',
              color: backgroundColor,
              borderColor: lineColor,
            },
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[0].x, y: centerCoordinate.y },
                { x: coordinates[1].x, y: centerCoordinate.y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: centerCoordinate.x, y: coordinates[0].y },
                { x: centerCoordinate.x, y: coordinates[1].y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
        ];

        const texts = [
          `Price: ${sign}${priceChange.toFixed(prec)}`,
          `Change: ${sign}${percent.toFixed(2)}%`,
        ];

        const boxFigures = buildInfoBoxFigures(coordinates, texts, bounding, tipBackgroundColor);
        return figures.concat(boxFigures);
      }
      return [];
    },
  };

  // 25. Date Range
  const dateRange: OverlayTemplate = {
    name: 'dateRange',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length > 1) {
        const points = overlay.points;
        const t1 = points[0]?.timestamp ?? 0;
        const t2 = points[1]?.timestamp ?? 0;
        const timeText = formatElapsedTime(t2 - t1);

        const centerCoordinate = {
          x: Math.round((coordinates[0].x + coordinates[1].x) / 2),
          y: Math.round((coordinates[0].y + coordinates[1].y) / 2),
        };

        const {
          backgroundColor = 'rgba(167, 139, 250, 0.1)',
          tipBackgroundColor = '#7c3aed',
          lineColor = '#A78BFA',
        } = (overlay.styles ?? {}) as any;

        const figures: OverlayFigure[] = [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                coordinates[0],
                { x: coordinates[1].x, y: coordinates[0].y },
                coordinates[1],
                { x: coordinates[0].x, y: coordinates[1].y },
              ],
            },
            styles: {
              style: 'stroke_fill',
              color: backgroundColor,
              borderColor: lineColor,
            },
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[0].x, y: centerCoordinate.y },
                { x: coordinates[1].x, y: centerCoordinate.y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: centerCoordinate.x, y: coordinates[0].y },
                { x: centerCoordinate.x, y: coordinates[1].y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
        ];

        const texts = [`Time: ${timeText}`];
        const boxFigures = buildInfoBoxFigures(coordinates, texts, bounding, tipBackgroundColor);
        return figures.concat(boxFigures);
      }
      return [];
    },
  };

  // 26. Date and Price Range
  const datePriceRange: OverlayTemplate = {
    name: 'datePriceRange',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, yAxis, chart, bounding }) => {
      if (coordinates.length > 1) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const points = overlay.points;
        const v1 = points[0]?.value ?? 0;
        const v2 = points[1]?.value ?? 0;
        const t1 = points[0]?.timestamp ?? 0;
        const t2 = points[1]?.timestamp ?? 0;
        const priceChange = v2 - v1;
        const percent = v1 === 0 ? 0 : (priceChange / v1) * 100;
        const sign = priceChange >= 0 ? '+' : '';
        const timeText = formatElapsedTime(t2 - t1);

        const centerCoordinate = {
          x: Math.round((coordinates[0].x + coordinates[1].x) / 2),
          y: Math.round((coordinates[0].y + coordinates[1].y) / 2),
        };

        const {
          backgroundColor = 'rgba(45, 192, 142, 0.1)',
          tipBackgroundColor = '#059669',
          lineColor = '#2DC08E',
        } = (overlay.styles ?? {}) as any;

        const figures: OverlayFigure[] = [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                coordinates[0],
                { x: coordinates[1].x, y: coordinates[0].y },
                coordinates[1],
                { x: coordinates[0].x, y: coordinates[1].y },
              ],
            },
            styles: {
              style: 'stroke_fill',
              color: backgroundColor,
              borderColor: lineColor,
            },
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[0].x, y: centerCoordinate.y },
                { x: coordinates[1].x, y: centerCoordinate.y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: centerCoordinate.x, y: coordinates[0].y },
                { x: centerCoordinate.x, y: coordinates[1].y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
        ];

        const texts = [
          `Price Change: ${sign}${priceChange.toFixed(prec)}`,
          `Change: ${sign}${percent.toFixed(2)}%`,
          `Time: ${timeText}`,
        ];

        const boxFigures = buildInfoBoxFigures(coordinates, texts, bounding, tipBackgroundColor);
        return figures.concat(boxFigures);
      }
      return [];
    },
  };

  // 27. Cross Marker
  const crossMarker: OverlayTemplate = {
    name: 'crossMarker',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 0) {
        const p = coordinates[0];
        return [
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: p.x - 9, y: p.y },
                { x: p.x + 9, y: p.y },
              ],
            },
          },
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: p.x, y: p.y - 9 },
                { x: p.x, y: p.y + 9 },
              ],
            },
          },
        ];
      }
      return [];
    },
  };

  // 28. Dot Marker
  const dotMarker: OverlayTemplate = {
    name: 'dotMarker',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length > 0) {
        const p = coordinates[0];
        return [
          {
            type: 'circle',
            attrs: {
              x: p.x,
              y: p.y,
              r: 4,
            },
            styles: {
              style: 'fill',
            },
          },
        ];
      }
      return [];
    },
  };

  // 29. Measure
  const measure: OverlayTemplate = {
    name: 'measure',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length > 1) {
        const leftToRight = coordinates[0].x < coordinates[1].x;
        const topToBottom = coordinates[0].y < coordinates[1].y;

        const centerCoordinate = {
          x: Math.round((coordinates[0].x + coordinates[1].x) / 2),
          y: Math.round((coordinates[0].y + coordinates[1].y) / 2),
        };

        const {
          backgroundColor = 'rgba(33, 150, 243, 0.1)',
          tipBackgroundColor = '#2196F3',
          lineColor = '#2196F3',
        } = (overlay.styles ?? {}) as any;

        const figures: OverlayFigure[] = [
          // FIRST figure: selection polygon of the four rectangle corners
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                coordinates[0],
                { x: coordinates[1].x, y: coordinates[0].y },
                coordinates[1],
                { x: coordinates[0].x, y: coordinates[1].y },
              ],
            },
            styles: {
              style: 'stroke_fill',
              color: backgroundColor,
              borderColor: lineColor,
            },
          },
          // SECOND: center horizontal line
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: coordinates[0].x, y: centerCoordinate.y },
                { x: coordinates[1].x, y: centerCoordinate.y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
          // THIRD: center vertical line
          {
            type: 'line',
            attrs: {
              coordinates: [
                { x: centerCoordinate.x, y: coordinates[0].y },
                { x: centerCoordinate.x, y: coordinates[1].y },
              ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
          // Horizontal arrowhead: 6px x 4px structure based on leftToRight
          {
            type: 'line',
            attrs: {
              coordinates: leftToRight
                ? [
                    { x: coordinates[1].x - 6, y: centerCoordinate.y - 4 },
                    { x: coordinates[1].x, y: centerCoordinate.y },
                    { x: coordinates[1].x - 6, y: centerCoordinate.y + 4 },
                  ]
                : [
                    { x: coordinates[1].x + 6, y: centerCoordinate.y - 4 },
                    { x: coordinates[1].x, y: centerCoordinate.y },
                    { x: coordinates[1].x + 6, y: centerCoordinate.y + 4 },
                  ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
          // Vertical arrowhead: 4px x 6px structure based on topToBottom
          {
            type: 'line',
            attrs: {
              coordinates: topToBottom
                ? [
                    { x: centerCoordinate.x - 4, y: coordinates[1].y - 6 },
                    { x: centerCoordinate.x, y: coordinates[1].y },
                    { x: centerCoordinate.x + 4, y: coordinates[1].y - 6 },
                  ]
                : [
                    { x: centerCoordinate.x - 4, y: coordinates[1].y + 6 },
                    { x: centerCoordinate.x, y: coordinates[1].y },
                    { x: centerCoordinate.x + 4, y: coordinates[1].y + 6 },
                  ],
            },
            styles: { color: lineColor },
            ignoreEvent: true,
          },
        ];

        const extendData = overlay.extendData as ((points: typeof overlay.points) => string[]) | undefined;
        const texts = extendData?.(overlay.points) ?? [];

        if (texts.length > 0) {
          const boxFigures = buildInfoBoxFigures(coordinates, texts, bounding, tipBackgroundColor);
          figures.push(...boxFigures);
        }

        return figures;
      }
      return [];
    },
  };

  // 29. Regression Trend
  const regressionTrend: OverlayTemplate = {
    name: 'regressionTrend',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ chart, overlay, coordinates }) => {
      if (coordinates.length > 1 && overlay.points.length > 1) {
        const p1 = overlay.points[0];
        const p2 = overlay.points[1];
        const t1 = p1.timestamp ?? 0;
        const t2 = p2.timestamp ?? 0;
        const bars = getTimestampRangeData(chart, t1, t2);

        if (bars.length >= 2) {
          const N = bars.length;
          let sumX = 0;
          let sumY = 0;
          for (let i = 0; i < N; i++) {
            sumX += i;
            sumY += Number(bars[i].close ?? 0);
          }
          const meanX = sumX / N;
          const meanY = sumY / N;

          let num = 0;
          let den = 0;
          for (let i = 0; i < N; i++) {
            const dx = i - meanX;
            const dy = Number(bars[i].close ?? 0) - meanY;
            num += dx * dy;
            den += dx * dx;
          }
          const slope = den === 0 ? 0 : num / den;
          const intercept = meanY - slope * meanX;

          let sumSqRes = 0;
          for (let i = 0; i < N; i++) {
            const pred = intercept + slope * i;
            const res = Number(bars[i].close ?? 0) - pred;
            sumSqRes += res * res;
          }
          const sigma = Math.sqrt(sumSqRes / N);

          const startBar = bars[0];
          const endBar = bars[N - 1];

          const centerStartVal = intercept;
          const centerEndVal = intercept + slope * (N - 1);
          const upperStartVal = centerStartVal + sigma * 2;
          const upperEndVal = centerEndVal + sigma * 2;
          const lowerStartVal = centerStartVal - sigma * 2;
          const lowerEndVal = centerEndVal - sigma * 2;

          const paneId = overlay.paneId;
          const csPix = chart.convertToPixel({ timestamp: startBar.timestamp, value: centerStartVal }, { paneId });
          const cePix = chart.convertToPixel({ timestamp: endBar.timestamp, value: centerEndVal }, { paneId });
          const usPix = chart.convertToPixel({ timestamp: startBar.timestamp, value: upperStartVal }, { paneId });
          const uePix = chart.convertToPixel({ timestamp: endBar.timestamp, value: upperEndVal }, { paneId });
          const lsPix = chart.convertToPixel({ timestamp: startBar.timestamp, value: lowerStartVal }, { paneId });
          const lePix = chart.convertToPixel({ timestamp: endBar.timestamp, value: lowerEndVal }, { paneId });

          if (csPix && cePix && usPix && uePix && lsPix && lePix) {
            return [
              {
                type: 'polygon',
                attrs: {
                  coordinates: [usPix, uePix, lePix, lsPix],
                },
                styles: {
                  style: 'fill',
                  color: 'rgba(33, 150, 243, 0.08)',
                },
                ignoreEvent: true,
              },
              {
                type: 'line',
                attrs: { coordinates: [usPix, uePix] },
                styles: { color: '#F92855' },
              },
              {
                type: 'line',
                attrs: { coordinates: [csPix, cePix] },
                styles: { color: '#2196F3', size: 2 },
              },
              {
                type: 'line',
                attrs: { coordinates: [lsPix, lePix] },
                styles: { color: '#2DC08E' },
              },
            ];
          }
        }

        return [
          {
            type: 'line',
            attrs: { coordinates },
          },
        ];
      }
      return [];
    },
  };

  // 30. Flat Top/Bottom
  const flatTopBottom: OverlayTemplate = {
    name: 'flatTopBottom',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const C1: Coordinate = { x: A.x, y: C.y };
        const C2: Coordinate = { x: B.x, y: C.y };
        return [
          {
            type: 'polygon',
            attrs: { coordinates: [A, B, C2, C1] },
            styles: { style: 'fill', color: 'rgba(33, 150, 243, 0.1)' },
            ignoreEvent: true,
          },
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { color: '#2196F3' },
          },
          {
            type: 'line',
            attrs: { coordinates: [C1, C2] },
            styles: { color: '#2196F3' },
          },
        ];
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 31. Disjoint Channel
  const disjointChannel: OverlayTemplate = {
    name: 'disjointChannel',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const D: Coordinate = { x: C.x + dx, y: C.y + dy };
        return [
          {
            type: 'polygon',
            attrs: { coordinates: [A, B, D, C] },
            styles: { style: 'fill', color: 'rgba(33, 150, 243, 0.08)' },
            ignoreEvent: true,
          },
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { color: '#2196F3' },
          },
          {
            type: 'line',
            attrs: { coordinates: [C, D] },
            styles: { color: '#2196F3' },
          },
        ];
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 32. Pitchfork
  const pitchfork: OverlayTemplate = {
    name: 'pitchfork',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length >= 3) {
        const themeColors = getOverlayThemeColors(overlay);
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const M = midpoint(B, C);
        const dir = subtractCoordinate(M, A);
        const B2 = addCoordinate(B, dir);
        const C2 = addCoordinate(C, dir);

        const medianRay = getRayLine([A, M], bounding);
        const bRay = getRayLine([B, B2], bounding);
        const cRay = getRayLine([C, C2], bounding);

        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [B, C] },
            styles: { style: 'dashed', color: themeColors.line },
          },
        ];
        if ('coordinates' in medianRay) {
          figures.push({ type: 'line', attrs: medianRay, styles: { color: '#ec4899', size: 2 } });
        }
        if ('coordinates' in bRay) {
          figures.push({ type: 'line', attrs: bRay, styles: { color: '#2196F3' } });
        }
        if ('coordinates' in cRay) {
          figures.push({ type: 'line', attrs: cRay, styles: { color: '#2196F3' } });
        }
        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 33. Schiff Pitchfork
  const schiffPitchfork: OverlayTemplate = {
    name: 'schiffPitchfork',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length >= 3) {
        const themeColors = getOverlayThemeColors(overlay);
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const O: Coordinate = { x: A.x, y: (A.y + B.y) / 2 };
        const M = midpoint(B, C);
        const dir = subtractCoordinate(M, O);
        const B2 = addCoordinate(B, dir);
        const C2 = addCoordinate(C, dir);

        const medianRay = getRayLine([O, M], bounding);
        const bRay = getRayLine([B, B2], bounding);
        const cRay = getRayLine([C, C2], bounding);

        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [B, C] },
            styles: { style: 'dashed', color: themeColors.line },
          },
        ];
        if ('coordinates' in medianRay) {
          figures.push({ type: 'line', attrs: medianRay, styles: { color: '#a78bfa', size: 2 } });
        }
        if ('coordinates' in bRay) {
          figures.push({ type: 'line', attrs: bRay, styles: { color: '#2196F3' } });
        }
        if ('coordinates' in cRay) {
          figures.push({ type: 'line', attrs: cRay, styles: { color: '#2196F3' } });
        }
        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 34. Modified Schiff Pitchfork
  const modifiedSchiffPitchfork: OverlayTemplate = {
    name: 'modifiedSchiffPitchfork',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length >= 3) {
        const themeColors = getOverlayThemeColors(overlay);
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const O = midpoint(A, B);
        const M = midpoint(B, C);
        const dir = subtractCoordinate(M, O);
        const B2 = addCoordinate(B, dir);
        const C2 = addCoordinate(C, dir);

        const medianRay = getRayLine([O, M], bounding);
        const bRay = getRayLine([B, B2], bounding);
        const cRay = getRayLine([C, C2], bounding);

        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [B, C] },
            styles: { style: 'dashed', color: themeColors.line },
          },
        ];
        if ('coordinates' in medianRay) {
          figures.push({ type: 'line', attrs: medianRay, styles: { color: '#facc15', size: 2 } });
        }
        if ('coordinates' in bRay) {
          figures.push({ type: 'line', attrs: bRay, styles: { color: '#2196F3' } });
        }
        if ('coordinates' in cRay) {
          figures.push({ type: 'line', attrs: cRay, styles: { color: '#2196F3' } });
        }
        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 35. Inside Pitchfork
  const insidePitchfork: OverlayTemplate = {
    name: 'insidePitchfork',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length >= 3) {
        const themeColors = getOverlayThemeColors(overlay);
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const O = midpoint(A, B);
        const dir = subtractCoordinate(C, O);
        const B2 = addCoordinate(B, dir);
        const C2 = addCoordinate(C, dir);

        const medianRay = getRayLine([O, C], bounding);
        const bRay = getRayLine([B, B2], bounding);
        const cRay = getRayLine([C, C2], bounding);

        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { style: 'dashed', color: themeColors.line },
          },
        ];
        if ('coordinates' in medianRay) {
          figures.push({ type: 'line', attrs: medianRay, styles: { color: '#22d3ee', size: 2 } });
        }
        if ('coordinates' in bRay) {
          figures.push({ type: 'line', attrs: bRay, styles: { color: '#2196F3' } });
        }
        if ('coordinates' in cRay) {
          figures.push({ type: 'line', attrs: cRay, styles: { color: '#2196F3' } });
        }
        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 36. Fibonacci Channel
  const fibonacciChannel: OverlayTemplate = {
    name: 'fibonacciChannel',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const v = subtractCoordinate(B, A);
        const den = dotCoordinate(v, v);
        if (den === 0) {
          return [{ type: 'line', attrs: { coordinates: [A, B] } }];
        }
        const projFactor = dotCoordinate(subtractCoordinate(C, A), v) / den;
        const proj = addCoordinate(A, scaleCoordinate(v, projFactor));
        const offset = subtractCoordinate(C, proj);

        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];
        const figures: OverlayFigure[] = [];

        levels.forEach((lvl, idx) => {
          const start = addCoordinate(A, scaleCoordinate(offset, lvl));
          const end = addCoordinate(B, scaleCoordinate(offset, lvl));
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push(
            {
              type: 'line',
              attrs: { coordinates: [start, end] },
              styles: { color },
            },
            {
              type: 'text',
              attrs: {
                x: start.x,
                y: start.y,
                text: `${lvl}`,
                align: 'left',
                baseline: 'bottom',
              },
              styles: {
                color,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 1,
                paddingBottom: 1,
                borderRadius: 2,
              },
              ignoreEvent: true,
            }
          );
        });

        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 37. Trend-Based Fib Time
  const trendBasedFibTime: OverlayTemplate = {
    name: 'trendBasedFibTime',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const themeColors = getOverlayThemeColors(overlay);
        const baseX = B.x - A.x;
        const bh = bounding?.height ?? 800;
        const factors = [0, 1, 2, 3, 5, 8, 13, 21];
        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { style: 'dashed', color: themeColors.line },
          },
        ];

        factors.forEach((f, idx) => {
          const x = C.x + baseX * f;
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push(
            {
              type: 'line',
              attrs: { coordinates: [{ x, y: 0 }, { x, y: bh }] },
              styles: { color },
            },
            {
              type: 'text',
              attrs: {
                x,
                y: 16,
                text: `${f}`,
                align: 'center',
                baseline: 'top',
              },
              styles: {
                color,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 1,
                paddingBottom: 1,
                borderRadius: 2,
              },
              ignoreEvent: true,
            }
          );
        });

        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 38. Fibonacci Wedge
  const fibonacciWedge: OverlayTemplate = {
    name: 'fibonacciWedge',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const startAngle = Math.atan2(B.y - A.y, B.x - A.x);
        const endAngle = Math.atan2(C.y - A.y, C.x - A.x);
        const baseRadius = Math.max(getDistance(A, B), getDistance(A, C));
        const levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { color: '#60A5FA' },
          },
          {
            type: 'line',
            attrs: { coordinates: [A, C] },
            styles: { color: '#60A5FA' },
          },
        ];

        levels.forEach((lvl, idx) => {
          const r = baseRadius * lvl;
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push({
            type: 'arc',
            attrs: {
              x: A.x,
              y: A.y,
              r,
              startAngle,
              endAngle,
            },
            styles: { color },
          });
        });

        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 39. Pitchfan
  const pitchfan: OverlayTemplate = {
    name: 'pitchfan',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const themeColors = getOverlayThemeColors(overlay);
        const levels = [0.25, 0.382, 0.5, 0.618, 0.75, 1, 1.5, 1.75, 2];
        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [B, C] },
            styles: { style: 'dashed', color: themeColors.line },
          },
        ];

        levels.forEach((lvl, idx) => {
          const target: Coordinate = {
            x: B.x + (C.x - B.x) * lvl,
            y: B.y + (C.y - B.y) * lvl,
          };
          const ray = getRayLine([A, target], bounding);
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          if ('coordinates' in ray) {
            figures.push({
              type: 'line',
              attrs: ray,
              styles: { color, size: lvl === 1 ? 2 : 1 },
            });
          }
        });

        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 40. Gann Square Fixed
  const gannSquareFixed: OverlayTemplate = {
    name: 'gannSquareFixed',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 2) {
        const A = coordinates[0];
        const B = coordinates[1];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        const sx = dx < 0 ? -1 : 1;
        const sy = dy < 0 ? -1 : 1;
        const x2 = A.x + side * sx;
        const y2 = A.y + side * sy;

        const minX = Math.min(A.x, x2);
        const maxX = Math.max(A.x, x2);
        const minY = Math.min(A.y, y2);
        const maxY = Math.max(A.y, y2);
        const w = maxX - minX;
        const h = maxY - minY;

        const figures: OverlayFigure[] = [
          {
            type: 'rect',
            attrs: { x: minX, y: minY, width: w, height: h },
            styles: { style: 'stroke', color: '#f59e0b' },
          },
          {
            type: 'line',
            attrs: { coordinates: [{ x: minX, y: minY }, { x: maxX, y: maxY }] },
            styles: { color: '#f59e0b' },
          },
          {
            type: 'line',
            attrs: { coordinates: [{ x: minX, y: maxY }, { x: maxX, y: minY }] },
            styles: { color: '#f59e0b' },
          },
        ];

        for (let i = 1; i <= 7; i++) {
          const fx = i / 8;
          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: minX + w * fx, y: minY }, { x: minX + w * fx, y: maxY }] },
            styles: { style: 'dashed', color: 'rgba(245, 158, 11, 0.4)' },
          });
          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: minX, y: minY + h * fx }, { x: maxX, y: minY + h * fx }] },
            styles: { style: 'dashed', color: 'rgba(245, 158, 11, 0.4)' },
          });
        }

        const fanRatios = [0.125, 0.25, 0.333, 0.5, 1, 2, 3, 4, 8];
        fanRatios.forEach((r, idx) => {
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const targetX = r <= 1 ? minX + w : minX + w / r;
          const targetY = r >= 1 ? minY + h : minY + h * r;
          figures.push({
            type: 'line',
            attrs: { coordinates: [A, { x: targetX, y: targetY }] },
            styles: { color },
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 41. Gann Square
  const gannSquare: OverlayTemplate = {
    name: 'gannSquare',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 2) {
        const A = coordinates[0];
        const B = coordinates[1];
        const minX = Math.min(A.x, B.x);
        const maxX = Math.max(A.x, B.x);
        const minY = Math.min(A.y, B.y);
        const maxY = Math.max(A.y, B.y);
        const w = maxX - minX;
        const h = maxY - minY;

        const figures: OverlayFigure[] = [
          {
            type: 'rect',
            attrs: { x: minX, y: minY, width: w, height: h },
            styles: { style: 'stroke', color: '#60A5FA' },
          },
          {
            type: 'line',
            attrs: { coordinates: [{ x: minX, y: minY }, { x: maxX, y: maxY }] },
            styles: { color: '#60A5FA' },
          },
          {
            type: 'line',
            attrs: { coordinates: [{ x: minX, y: maxY }, { x: maxX, y: minY }] },
            styles: { color: '#60A5FA' },
          },
        ];

        for (let i = 1; i <= 7; i++) {
          const fx = i / 8;
          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: minX + w * fx, y: minY }, { x: minX + w * fx, y: maxY }] },
            styles: { style: 'dashed', color: 'rgba(96, 165, 250, 0.4)' },
          });
          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: minX, y: minY + h * fx }, { x: maxX, y: minY + h * fx }] },
            styles: { style: 'dashed', color: 'rgba(96, 165, 250, 0.4)' },
          });
        }

        const fanRatios = [0.125, 0.25, 0.333, 0.5, 1, 2, 3, 4, 8];
        fanRatios.forEach((r, idx) => {
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          const targetX = r <= 1 ? minX + w : minX + w / r;
          const targetY = r >= 1 ? minY + h : minY + h * r;
          figures.push({
            type: 'line',
            attrs: { coordinates: [A, { x: targetX, y: targetY }] },
            styles: { color },
          });
        });

        return figures;
      }
      return [];
    },
  };

  // 42. Long Position
  const longPosition: OverlayTemplate = {
    name: 'longPosition',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart, yAxis, bounding }) => {
      if (coordinates.length >= 3 && overlay.points.length >= 3) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const themeColors = getOverlayThemeColors(overlay);

        const pts = [0, 1, 2].map((i) => ({
          point: overlay.points[i],
          coord: coordinates[i],
          val: overlay.points[i]?.value ?? 0,
        }));
        pts.sort((a, b) => a.val - b.val);

        const stop = pts[0].val;
        const cStop = pts[0].coord;
        const entry = pts[1].val;
        const cEntry = pts[1].coord;
        const target = pts[2].val;
        const cTarget = pts[2].coord;

        const rawLeft = Math.min(cStop.x, cEntry.x, cTarget.x);
        const rawRight = Math.max(cStop.x, cEntry.x, cTarget.x);
        const rawCenter = (rawLeft + rawRight) / 2;
        const bWidth = bounding?.width ?? 600;
        const minimumWidth = Math.min(220, Math.max(110, bWidth * 0.3));
        const width = Math.max(rawRight - rawLeft, minimumWidth);
        const x1 = clampNumber(rawCenter - width / 2, 0, bWidth);
        const x2 = clampNumber(rawCenter + width / 2, 0, bWidth);

        const reward = target - entry;
        const risk = entry - stop;
        const targetPct = entry === 0 ? 0 : (reward / entry) * 100;
        const stopPct = entry === 0 ? 0 : (risk / entry) * 100;
        const rrStr = risk <= 0 ? 'N/A' : (reward / risk).toFixed(2);

        return [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                { x: x1, y: cEntry.y },
                { x: x2, y: cEntry.y },
                { x: x2, y: cTarget.y },
                { x: x1, y: cTarget.y },
              ],
            },
            styles: { style: 'stroke_fill', color: 'rgba(45, 192, 142, 0.2)', borderColor: '#2DC08E' },
          },
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                { x: x1, y: cEntry.y },
                { x: x2, y: cEntry.y },
                { x: x2, y: cStop.y },
                { x: x1, y: cStop.y },
              ],
            },
            styles: { style: 'stroke_fill', color: 'rgba(249, 40, 85, 0.2)', borderColor: '#F92855' },
          },
          {
            type: 'line',
            attrs: { coordinates: [{ x: x1, y: cEntry.y }, { x: x2, y: cEntry.y }] },
            styles: { color: themeColors.line, size: 2 },
          },
          {
            type: 'text',
            attrs: {
              x: x2 - 4,
              y: cTarget.y + 4,
              text: `Target: ${target.toFixed(prec)} (+${targetPct.toFixed(2)}%) | R:R ${rrStr}`,
              align: 'right',
              baseline: 'top',
            },
            styles: { color: '#2DC08E', backgroundColor: themeColors.textBackground, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
            ignoreEvent: true,
          },
          {
            type: 'text',
            attrs: {
              x: x2 - 4,
              y: cEntry.y - 4,
              text: `Entry: ${entry.toFixed(prec)}`,
              align: 'right',
              baseline: 'bottom',
            },
            styles: { color: themeColors.text, backgroundColor: themeColors.textBackground, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
            ignoreEvent: true,
          },
          {
            type: 'text',
            attrs: {
              x: x2 - 4,
              y: cStop.y - 4,
              text: `Stop: ${stop.toFixed(prec)} (-${stopPct.toFixed(2)}%)`,
              align: 'right',
              baseline: 'bottom',
            },
            styles: { color: '#F92855', backgroundColor: themeColors.textBackground, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
            ignoreEvent: true,
          },
        ];
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 43. Short Position
  const shortPosition: OverlayTemplate = {
    name: 'shortPosition',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart, yAxis, bounding }) => {
      if (coordinates.length >= 3 && overlay.points.length >= 3) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const themeColors = getOverlayThemeColors(overlay);

        const pts = [0, 1, 2].map((i) => ({
          point: overlay.points[i],
          coord: coordinates[i],
          val: overlay.points[i]?.value ?? 0,
        }));
        pts.sort((a, b) => a.val - b.val);

        const target = pts[0].val;
        const cTarget = pts[0].coord;
        const entry = pts[1].val;
        const cEntry = pts[1].coord;
        const stop = pts[2].val;
        const cStop = pts[2].coord;

        const rawLeft = Math.min(cStop.x, cEntry.x, cTarget.x);
        const rawRight = Math.max(cStop.x, cEntry.x, cTarget.x);
        const rawCenter = (rawLeft + rawRight) / 2;
        const bWidth = bounding?.width ?? 600;
        const minimumWidth = Math.min(220, Math.max(110, bWidth * 0.3));
        const width = Math.max(rawRight - rawLeft, minimumWidth);
        const x1 = clampNumber(rawCenter - width / 2, 0, bWidth);
        const x2 = clampNumber(rawCenter + width / 2, 0, bWidth);

        const reward = entry - target;
        const risk = stop - entry;
        const targetProfitPct = entry === 0 ? 0 : (reward / entry) * 100;
        const stopLossPct = entry === 0 ? 0 : (risk / entry) * 100;
        const rrStr = risk <= 0 ? 'N/A' : (reward / risk).toFixed(2);

        return [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                { x: x1, y: cEntry.y },
                { x: x2, y: cEntry.y },
                { x: x2, y: cTarget.y },
                { x: x1, y: cTarget.y },
              ],
            },
            styles: { style: 'stroke_fill', color: 'rgba(45, 192, 142, 0.2)', borderColor: '#2DC08E' },
          },
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                { x: x1, y: cEntry.y },
                { x: x2, y: cEntry.y },
                { x: x2, y: cStop.y },
                { x: x1, y: cStop.y },
              ],
            },
            styles: { style: 'stroke_fill', color: 'rgba(249, 40, 85, 0.2)', borderColor: '#F92855' },
          },
          {
            type: 'line',
            attrs: { coordinates: [{ x: x1, y: cEntry.y }, { x: x2, y: cEntry.y }] },
            styles: { color: themeColors.line, size: 2 },
          },
          {
            type: 'text',
            attrs: {
              x: x2 - 4,
              y: cTarget.y - 4,
              text: `Target: ${target.toFixed(prec)} (+${targetProfitPct.toFixed(2)}%) | R:R ${rrStr}`,
              align: 'right',
              baseline: 'bottom',
            },
            styles: { color: '#2DC08E', backgroundColor: themeColors.textBackground, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
            ignoreEvent: true,
          },
          {
            type: 'text',
            attrs: {
              x: x2 - 4,
              y: cEntry.y + 4,
              text: `Entry: ${entry.toFixed(prec)}`,
              align: 'right',
              baseline: 'top',
            },
            styles: { color: themeColors.text, backgroundColor: themeColors.textBackground, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
            ignoreEvent: true,
          },
          {
            type: 'text',
            attrs: {
              x: x2 - 4,
              y: cStop.y + 4,
              text: `Stop: ${stop.toFixed(prec)} (-${stopLossPct.toFixed(2)}%)`,
              align: 'right',
              baseline: 'top',
            },
            styles: { color: '#F92855', backgroundColor: themeColors.textBackground, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
            ignoreEvent: true,
          },
        ];
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 44. Forecast
  const forecast: OverlayTemplate = {
    name: 'forecast',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart, yAxis, bounding }) => {
      if (coordinates.length >= 2 && overlay.points.length >= 2) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const p1 = overlay.points[0];
        const p2 = overlay.points[1];
        const v1 = p1.value ?? 0;
        const v2 = p2.value ?? 0;
        const change = v2 - v1;
        const pct = v1 === 0 ? 0 : (change / v1) * 100;
        const elapsed = formatElapsedTime((p2.timestamp ?? 0) - (p1.timestamp ?? 0));
        const sign = change >= 0 ? '+' : '';

        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [coordinates[0], coordinates[1]] },
            styles: { color: change >= 0 ? '#2DC08E' : '#F92855', size: 2 },
          },
        ];

        const texts = [
          `Forecast: ${sign}${change.toFixed(prec)} (${sign}${pct.toFixed(2)}%)`,
          `Target: ${v2.toFixed(prec)} | Time: ${elapsed}`,
        ];
        const infoBoxes = buildInfoBoxFigures(coordinates, texts, bounding, change >= 0 ? '#2DC08E' : '#F92855');
        figures.push(...infoBoxes);
        return figures;
      }
      return [];
    },
  };

  // 45. Bars Pattern
  const barsPattern: OverlayTemplate = {
    name: 'barsPattern',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart }) => {
      if (coordinates.length >= 3 && overlay.points.length >= 3) {
        const p0 = overlay.points[0];
        const p1 = overlay.points[1];
        const p2 = overlay.points[2];
        const t0 = p0.timestamp ?? 0;
        const t1 = p1.timestamp ?? 0;
        const bars = getTimestampRangeData(chart, t0, t1).slice(-200);

        if (bars.length >= 2) {
          const baseClose = Number(bars[0].close ?? 0);
          const cAnchor = coordinates[2];
          const barSpacing = Math.max(3, Math.abs(coordinates[1].x - coordinates[0].x) / bars.length);
          const figures: OverlayFigure[] = [];

          const paneId = overlay.paneId;
          const pAnchorVal = p2.value ?? baseClose;
          const refPix = chart.convertToPixel({ timestamp: p2.timestamp, value: pAnchorVal + 1 }, { paneId });
          const pxPerUnit = refPix ? Math.abs(refPix.y - cAnchor.y) : 1;

          bars.forEach((bar: any, idx: number) => {
            const bx = cAnchor.x + idx * barSpacing;
            const bOpen = Number(bar.open ?? 0) - baseClose;
            const bHigh = Number(bar.high ?? 0) - baseClose;
            const bLow = Number(bar.low ?? 0) - baseClose;
            const bClose = Number(bar.close ?? 0) - baseClose;

            const yOpen = cAnchor.y - bOpen * pxPerUnit;
            const yHigh = cAnchor.y - bHigh * pxPerUnit;
            const yLow = cAnchor.y - bLow * pxPerUnit;
            const yClose = cAnchor.y - bClose * pxPerUnit;

            const isUp = bClose >= bOpen;
            const color = isUp ? '#2DC08E' : '#F92855';

            figures.push(
              {
                type: 'line',
                attrs: { coordinates: [{ x: bx, y: yHigh }, { x: bx, y: yLow }] },
                styles: { color },
                ignoreEvent: true,
              },
              {
                type: 'rect',
                attrs: {
                  x: bx - barSpacing * 0.35,
                  y: Math.min(yOpen, yClose),
                  width: Math.max(1, barSpacing * 0.7),
                  height: Math.max(1, Math.abs(yClose - yOpen)),
                },
                styles: { style: 'fill', color },
                ignoreEvent: true,
              }
            );
          });
          return figures;
        }
      }
      if (coordinates.length >= 2) {
        return [{ type: 'line', attrs: { coordinates: [coordinates[0], coordinates[1]] } }];
      }
      return [];
    },
  };

  // 46. Ghost Feed
  const ghostFeed: OverlayTemplate = {
    name: 'ghostFeed',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart }) => {
      if (coordinates.length >= 2 && overlay.points.length >= 2) {
        const A = overlay.points[0];
        const B = overlay.points[1];
        const allBars = chart?.getDataList?.() ?? [];
        const aTs = A.timestamp ?? 0;
        const recentBars = allBars.filter((b: any) => Number(b.timestamp) <= aTs).slice(-12);

        if (recentBars.length >= 2) {
          const firstClose = Number(recentBars[0].close ?? 0);
          if (firstClose <= 0) return [];
          const cA = coordinates[0];
          const cB = coordinates[1];
          const dxTotal = cB.x - cA.x;
          const dyTotal = cB.y - cA.y;
          const stepX = dxTotal / recentBars.length;
          const figures: OverlayFigure[] = [];

          recentBars.forEach((b: any, idx: number) => {
            const bx = cA.x + idx * stepX;
            const bOpen = Number(b.open ?? 0);
            const bHigh = Number(b.high ?? 0);
            const bLow = Number(b.low ?? 0);
            const bClose = Number(b.close ?? 0);

            const relOpen = ((bOpen - firstClose) / firstClose) * dyTotal;
            const relHigh = ((bHigh - firstClose) / firstClose) * dyTotal;
            const relLow = ((bLow - firstClose) / firstClose) * dyTotal;
            const relClose = ((bClose - firstClose) / firstClose) * dyTotal;

            const baseY = cA.y + (idx / recentBars.length) * dyTotal;
            const yOpen = baseY + relOpen;
            const yHigh = baseY + relHigh;
            const yLow = baseY + relLow;
            const yClose = baseY + relClose;

            const isUp = bClose >= bOpen;
            const color = isUp ? 'rgba(45, 192, 142, 0.45)' : 'rgba(249, 40, 85, 0.45)';
            const barWidth = Math.max(2, Math.abs(stepX) * 0.7);

            figures.push(
              {
                type: 'line',
                attrs: { coordinates: [{ x: bx, y: yHigh }, { x: bx, y: yLow }] },
                styles: { color },
                ignoreEvent: true,
              },
              {
                type: 'rect',
                attrs: {
                  x: bx - barWidth * 0.5,
                  y: Math.min(yOpen, yClose),
                  width: barWidth,
                  height: Math.max(1, Math.abs(yClose - yOpen)),
                },
                styles: { style: 'fill', color },
                ignoreEvent: true,
              }
            );
          });
          return figures;
        }
        return [{ type: 'line', attrs: { coordinates: [coordinates[0], coordinates[1]] }, styles: { style: 'dashed', color: getOverlayThemeColors(overlay).line } }];
      }
      return [];
    },
  };

  // 47. Projection
  const projection: OverlayTemplate = {
    name: 'projection',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length >= 3) {
        const A = coordinates[0];
        const B = coordinates[1];
        const C = coordinates[2];
        const startAngle = Math.atan2(B.y - A.y, B.x - A.x);
        const endAngle = Math.atan2(C.y - A.y, C.x - A.x);
        const baseRadius = getDistance(A, B);
        const figures: OverlayFigure[] = [
          { type: 'line', attrs: { coordinates: [A, B] }, styles: { color: '#38bdf8' } },
          { type: 'line', attrs: { coordinates: [A, C] }, styles: { color: '#38bdf8' } },
        ];

        [1, 2, 3].forEach((mult, idx) => {
          const r = baseRadius * mult;
          const color = FIB_LEVEL_COLORS[idx % FIB_LEVEL_COLORS.length];
          figures.push({
            type: 'arc',
            attrs: { x: A.x, y: A.y, r, startAngle, endAngle },
            styles: { color },
          });
        });
        return figures;
      }
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }];
      }
      return [];
    },
  };

  // 48. Anchored VWAP
  const anchoredVwap: OverlayTemplate = {
    name: 'anchoredVwap',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, chart }) => {
      if (overlay.points.length > 0) {
        const anchorTs = overlay.points[0].timestamp ?? 0;
        const allBars = chart?.getDataList?.() ?? [];
        const bars = allBars.filter((b: any) => Number(b.timestamp) >= anchorTs);

        if (bars.length > 0) {
          let cumPV = 0;
          let cumVol = 0;
          const coords: Coordinate[] = [];
          const paneId = overlay.paneId;

          bars.forEach((bar: any) => {
            const high = Number(bar.high);
            const low = Number(bar.low);
            const close = Number(bar.close);
            const ts = Number(bar.timestamp);
            const vol = Number(bar.volume ?? 0);

            if (
              !Number.isFinite(high) ||
              !Number.isFinite(low) ||
              !Number.isFinite(close) ||
              !Number.isFinite(ts) ||
              !Number.isFinite(vol) ||
              vol <= 0
            ) {
              return;
            }

            const typical = (high + low + close) / 3;
            cumPV += typical * vol;
            cumVol += vol;

            if (cumVol <= 0) return;
            const vwap = cumPV / cumVol;
            const pix = chart.convertToPixel({ timestamp: ts, value: vwap }, { paneId });
            if (pix) {
              coords.push(pix);
            }
          });

          if (coords.length > 1) {
            return [
              {
                type: 'line',
                attrs: { coordinates: coords },
                styles: { color: '#ec4899', size: 2 },
              },
            ];
          }
        }
      }
      return [];
    },
  };

  // 49. Fixed Range Volume Profile
  const fixedRangeVolumeProfile: OverlayTemplate = {
    name: 'fixedRangeVolumeProfile',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart }) => {
      if (coordinates.length >= 2 && overlay.points.length >= 2) {
        const t1 = overlay.points[0].timestamp ?? 0;
        const t2 = overlay.points[1].timestamp ?? 0;
        const bars = getTimestampRangeData(chart, t1, t2);

        if (bars.length >= 2) {
          let rangeLow = Infinity;
          let rangeHigh = -Infinity;
          bars.forEach((b: any) => {
            const low = Number(b.low);
            const high = Number(b.high);
            if (Number.isFinite(low)) rangeLow = Math.min(rangeLow, low);
            if (Number.isFinite(high)) rangeHigh = Math.max(rangeHigh, high);
          });

          if (rangeHigh > rangeLow && Number.isFinite(rangeLow) && Number.isFinite(rangeHigh)) {
            const BIN_COUNT = 24;
            const binSize = (rangeHigh - rangeLow) / BIN_COUNT;
            const bins = Array.from({ length: BIN_COUNT }, () => ({ upVol: 0, downVol: 0, total: 0 }));

            bars.forEach((b: any) => {
              const bClose = Number(b.close ?? 0);
              const bOpen = Number(b.open ?? 0);
              const bHigh = Number(b.high ?? 0);
              const bLow = Number(b.low ?? 0);
              const bVol = Number(b.volume ?? 0);

              if (!Number.isFinite(bVol) || bVol <= 0) return;
              const isUp = bClose >= bOpen;

              if (bHigh > bLow) {
                for (let k = 0; k < BIN_COUNT; k++) {
                  const binLow = rangeLow + k * binSize;
                  const binHigh = binLow + binSize;
                  const overlap = Math.max(0, Math.min(bHigh, binHigh) - Math.max(bLow, binLow));
                  if (overlap > 0) {
                    const portion = (bVol * overlap) / (bHigh - bLow);
                    if (isUp) bins[k].upVol += portion;
                    else bins[k].downVol += portion;
                    bins[k].total += portion;
                  }
                }
              } else {
                const bIdx = clampNumber(Math.floor((bLow - rangeLow) / binSize), 0, BIN_COUNT - 1);
                if (isUp) bins[bIdx].upVol += bVol;
                else bins[bIdx].downVol += bVol;
                bins[bIdx].total += bVol;
              }
            });

            let maxTotal = 0;
            bins.forEach((bn) => { maxTotal = Math.max(maxTotal, bn.total); });

            const paneId = overlay.paneId;
            const rightX = Math.max(coordinates[0].x, coordinates[1].x);
            const rangeWidth = Math.abs(coordinates[1].x - coordinates[0].x);
            const maxHistWidth = Math.max(30, rangeWidth * 0.3);
            const figures: OverlayFigure[] = [];

            bins.forEach((bn, idx) => {
              if (bn.total > 0 && maxTotal > 0) {
                const binPriceLow = rangeLow + idx * binSize;
                const binPriceHigh = binPriceLow + binSize;
                const pLow = chart.convertToPixel({ timestamp: t1, value: binPriceLow }, { paneId });
                const pHigh = chart.convertToPixel({ timestamp: t1, value: binPriceHigh }, { paneId });

                if (pLow && pHigh) {
                  const yTop = Math.min(pLow.y, pHigh.y);
                  const yHeight = Math.max(1, Math.abs(pLow.y - pHigh.y));
                  const upW = (bn.upVol / maxTotal) * maxHistWidth;
                  const downW = (bn.downVol / maxTotal) * maxHistWidth;

                  figures.push(
                    {
                      type: 'rect',
                      attrs: { x: rightX - upW, y: yTop, width: upW, height: yHeight },
                      styles: { style: 'fill', color: 'rgba(45, 192, 142, 0.6)' },
                      ignoreEvent: true,
                    },
                    {
                      type: 'rect',
                      attrs: { x: rightX - upW - downW, y: yTop, width: downW, height: yHeight },
                      styles: { style: 'fill', color: 'rgba(249, 40, 85, 0.6)' },
                      ignoreEvent: true,
                    }
                  );
                }
              }
            });
            return figures;
          }
        }
      }
      return [];
    },
  };

  // 50. Text
  const text: OverlayTemplate = {
    name: 'text',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length > 0) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        if (!textVal) return [];
        const themeColors = getOverlayThemeColors(overlay);
        return [
          {
            type: 'text',
            attrs: {
              x: coordinates[0].x,
              y: coordinates[0].y,
              text: textVal,
              align: 'left',
              baseline: 'bottom',
            },
            styles: {
              color: themeColors.text,
              backgroundColor: themeColors.textBackground,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            },
          },
        ];
      }
      return [];
    },
  };

  // 51. Anchored Text
  const anchoredText: OverlayTemplate = {
    name: 'anchoredText',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length > 0) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        const p = coordinates[0];
        const themeColors = getOverlayThemeColors(overlay);
        const figures: OverlayFigure[] = [
          {
            type: 'circle',
            attrs: { x: p.x, y: p.y, r: 4 },
            styles: { style: 'fill', color: '#2196F3' },
          },
        ];
        if (textVal) {
          figures.push({
            type: 'text',
            attrs: {
              x: p.x + 8,
              y: p.y,
              text: textVal,
              align: 'left',
              baseline: 'middle',
            },
            styles: {
              color: themeColors.text,
              backgroundColor: themeColors.textBackground,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            },
          });
        }
        return figures;
      }
      return [];
    },
  };

  // 52. Note
  const note: OverlayTemplate = {
    name: 'note',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length > 0) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        const p = coordinates[0];
        const figures: OverlayFigure[] = [
          {
            type: 'circle',
            attrs: { x: p.x, y: p.y, r: 5 },
            styles: { style: 'fill', color: '#FACC15' },
          },
        ];
        if (textVal) {
          figures.push({
            type: 'text',
            attrs: {
              x: p.x + 10,
              y: p.y - 10,
              text: textVal,
              align: 'left',
              baseline: 'middle',
            },
            styles: {
              color: '#0F172A',
              backgroundColor: '#FACC15',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            },
          });
        }
        return figures;
      }
      return [];
    },
  };

  // 53. Anchored Note
  const anchoredNote: OverlayTemplate = {
    name: 'anchoredNote',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length >= 2) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        const A = coordinates[0];
        const B = coordinates[1];
        const figures: OverlayFigure[] = [
          {
            type: 'circle',
            attrs: { x: A.x, y: A.y, r: 4 },
            styles: { style: 'fill', color: '#FACC15' },
          },
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { style: 'dashed', color: '#FACC15' },
          },
        ];
        if (textVal) {
          figures.push({
            type: 'text',
            attrs: {
              x: B.x,
              y: B.y,
              text: textVal,
              align: 'left',
              baseline: 'middle',
            },
            styles: {
              color: '#0F172A',
              backgroundColor: '#FACC15',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            },
          });
        }
        return figures;
      }
      return [];
    },
  };

  // 54. Callout
  const callout: OverlayTemplate = {
    name: 'callout',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length >= 2) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        const A = coordinates[0];
        const B = coordinates[1];
        const themeColors = getOverlayThemeColors(overlay);
        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { color: '#60A5FA' },
          },
        ];
        if (textVal) {
          figures.push({
            type: 'text',
            attrs: {
              x: B.x,
              y: B.y,
              text: textVal,
              align: 'left',
              baseline: 'middle',
            },
            styles: {
              color: themeColors.text,
              backgroundColor: themeColors.textBackground,
              borderColor: '#60A5FA',
              borderSize: 1,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 6,
            },
          });
        }
        return figures;
      }
      return [];
    },
  };

  // 55. Comment
  const comment: OverlayTemplate = {
    name: 'comment',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length > 0) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        if (!textVal) return [];
        const p = coordinates[0];
        const themeColors = getOverlayThemeColors(overlay);
        return [
          {
            type: 'text',
            attrs: {
              x: p.x,
              y: p.y,
              text: `💬 ${textVal}`,
              align: 'left',
              baseline: 'bottom',
            },
            styles: {
              color: themeColors.text,
              backgroundColor: themeColors.textBackground,
              borderColor: '#38BDF8',
              borderSize: 1,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 6,
            },
          },
        ];
      }
      return [];
    },
  };

  // 56. Price Label
  const priceLabel: OverlayTemplate = {
    name: 'priceLabel',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart, yAxis }) => {
      if (coordinates.length > 0 && overlay.points.length > 0) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const val = overlay.points[0].value ?? 0;
        const p = coordinates[0];
        return [
          {
            type: 'text',
            attrs: {
              x: p.x,
              y: p.y,
              text: val.toFixed(prec),
              align: 'left',
              baseline: 'middle',
            },
            styles: {
              color: '#FFFFFF',
              backgroundColor: '#2196F3',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            },
          },
        ];
      }
      return [];
    },
  };

  // 57. Price Note
  const priceNote: OverlayTemplate = {
    name: 'priceNote',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, chart, yAxis }) => {
      if (coordinates.length >= 2 && overlay.points.length >= 2) {
        const prec = getPrecision(chart, yAxis, overlay.paneId);
        const val = overlay.points[0].value ?? 0;
        const userNote = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        const textVal = userNote ? `${val.toFixed(prec)}\n${userNote}` : val.toFixed(prec);
        const A = coordinates[0];
        const B = coordinates[1];
        return [
          {
            type: 'line',
            attrs: { coordinates: [A, B] },
            styles: { color: '#22D3EE' },
          },
          {
            type: 'text',
            attrs: {
              x: B.x,
              y: B.y,
              text: textVal,
              align: 'left',
              baseline: 'middle',
            },
            styles: {
              color: '#0F172A',
              backgroundColor: '#22D3EE',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            },
          },
        ];
      }
      return [];
    },
  };

  // 58. Signpost
  const signpost: OverlayTemplate = {
    name: 'signpost',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length >= 2) {
        const textVal = typeof (overlay.extendData as any)?.text === 'string' ? (overlay.extendData as any).text : '';
        const A = coordinates[0];
        const B = coordinates[1];
        const figures: OverlayFigure[] = [
          {
            type: 'line',
            attrs: { coordinates: [A, { x: A.x, y: B.y }] },
            styles: { color: '#A78BFA', size: 2 },
          },
        ];
        if (textVal) {
          figures.push({
            type: 'text',
            attrs: {
              x: A.x,
              y: B.y,
              text: `🚩 ${textVal}`,
              align: 'left',
              baseline: 'bottom',
            },
            styles: {
              color: '#FFFFFF',
              backgroundColor: '#7C3AED',
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 4,
            },
          });
        }
        return figures;
      }
      return [];
    },
  };

  // 59. Flag Mark
  const flagMark: OverlayTemplate = {
    name: 'flagMark',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length > 0) {
        const p = coordinates[0];
        const themeColors = getOverlayThemeColors(overlay);
        return [
          {
            type: 'line',
            attrs: { coordinates: [p, { x: p.x, y: p.y - 24 }] },
            styles: { color: themeColors.line, size: 2 },
          },
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                { x: p.x, y: p.y - 24 },
                { x: p.x + 16, y: p.y - 18 },
                { x: p.x, y: p.y - 12 },
              ],
            },
            styles: { style: 'fill', color: '#F92855' },
          },
        ];
      }
      return [];
    },
  };

  registerOverlay(arrow);
  registerOverlay(rect);
  registerOverlay(circle);
  registerOverlay(triangle);
  registerOverlay(parallelogram);
  registerOverlay(abcd);
  registerOverlay(xabcd);
  registerOverlay(threeWaves);
  registerOverlay(fiveWaves);
  registerOverlay(eightWaves);
  registerOverlay(fibonacciRetracement);
  registerOverlay(fibonacciSegment);
  registerOverlay(fibonacciCircle);
  registerOverlay(fibonacciSpiral);
  registerOverlay(fibonacciSpeedResistanceFan);
  registerOverlay(fibonacciSpeedResistanceArcs);
  registerOverlay(fibonacciExtension);
  registerOverlay(fibonacciTimeZone);
  registerOverlay(gannBox);
  registerOverlay(gannFan);
  registerOverlay(infoLine);
  registerOverlay(trendAngle);
  registerOverlay(crossLine);
  registerOverlay(priceRange);
  registerOverlay(dateRange);
  registerOverlay(datePriceRange);
  registerOverlay(crossMarker);
  registerOverlay(dotMarker);
  registerOverlay(measure);

  // Register 31 new custom overlays
  registerOverlay(regressionTrend);
  registerOverlay(flatTopBottom);
  registerOverlay(disjointChannel);

  registerOverlay(pitchfork);
  registerOverlay(schiffPitchfork);
  registerOverlay(modifiedSchiffPitchfork);
  registerOverlay(insidePitchfork);

  registerOverlay(fibonacciChannel);
  registerOverlay(trendBasedFibTime);
  registerOverlay(fibonacciWedge);
  registerOverlay(pitchfan);

  registerOverlay(gannSquareFixed);
  registerOverlay(gannSquare);

  registerOverlay(longPosition);
  registerOverlay(shortPosition);
  registerOverlay(forecast);
  registerOverlay(barsPattern);
  registerOverlay(ghostFeed);
  registerOverlay(projection);

  registerOverlay(anchoredVwap);
  registerOverlay(fixedRangeVolumeProfile);

  registerOverlay(text);
  registerOverlay(anchoredText);
  registerOverlay(note);
  registerOverlay(anchoredNote);
  registerOverlay(callout);
  registerOverlay(comment);
  registerOverlay(priceLabel);
  registerOverlay(priceNote);
  registerOverlay(signpost);
  registerOverlay(flagMark);

  registered = true;
}
