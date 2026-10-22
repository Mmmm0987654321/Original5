import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { createPortal } from 'react-dom';

import {
  dispose,
  init,
  type Chart,
  type KLineData,
  type Period,
} from 'klinecharts';

import {
  applyChartDisplay,
  applyIndicatorPrefs,
  ensureKlineAverages,
} from '../../lib/klineIndicators';

import {
  ensureAnonymousLiquidDrawingExtensions,
} from '../../lib/klineDrawingExtensions';

import {
  loadIndicatorPrefs,
  saveIndicatorPrefs,
  EXTRA_INDICATOR_SPECS,
  CUSTOM_INDICATOR_SPECS,
  type WebIndicatorPrefs,
} from '../../lib/indicatorPrefs';

import {
  type CandleInterval,
  type ChartMode,
} from '../../lib/chartPrefs';

import {
  loadDrawings,
  saveDrawings,
  type SavedDrawing,
  type SavedDrawingPoint,
} from '../../lib/drawingStorage';

import {
  MousePointer,
  TrendingUp,
  Minus,
  MoveRight,
  MoveUpRight,
  Split,
  Layers,
  Percent,
  Paintbrush,
  Type,
  Tag,
  Shapes,
  Square,
  Circle,
  Triangle,
  Activity,
  Undo2,
  Trash2,
  Eraser,
  Waves,
  Ruler,
  Compass,
  Crosshair,
  Info,
  Calendar,
  DollarSign,
  Clock,
  Plus,
  Dot,
  GitCommit,
  Target,
  BarChart2,
  BarChart3,
  Eye,
  Volume2,
  Pin,
  MessageSquare,
  Flag,
  Search,
  X,
} from 'lucide-react';

import {
  IndicatorSheet,
  ALL_INDICATORS,
} from './IndicatorSheet';

import type {
  ChartPriceLine,
} from '../../lib/chartLines';

import {
  syncKlinePriceLines,
} from '../../lib/klineLines';

import {
  type KlineTradeMarker,
  syncKlineTradeMarkers,
} from '../../lib/klineTradeMarkers';

export type KLineCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DrawTool =
  | 'segment'
  | 'horizontalStraightLine'
  | 'horizontalRayLine'
  | 'horizontalSegment'
  | 'rayLine'
  | 'straightLine'
  | 'verticalStraightLine'
  | 'verticalRayLine'
  | 'verticalSegment'
  | 'priceLine'
  | 'parallelStraightLine'
  | 'priceChannelLine'
  | 'fibonacciLine'
  | 'fibonacciRetracement'
  | 'brush'
  | 'simpleAnnotation'
  | 'simpleTag'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'parallelogram'
  | 'abcd'
  | 'xabcd'
  | 'threeWaves'
  | 'fiveWaves'
  | 'eightWaves'
  | 'fibonacciSegment'
  | 'fibonacciCircle'
  | 'fibonacciSpiral'
  | 'fibonacciSpeedResistanceFan'
  | 'fibonacciSpeedResistanceArcs'
  | 'fibonacciExtension'
  | 'fibonacciTimeZone'
  | 'gannBox'
  | 'gannFan'
  | 'infoLine'
  | 'trendAngle'
  | 'crossLine'
  | 'priceRange'
  | 'dateRange'
  | 'datePriceRange'
  | 'crossMarker'
  | 'dotMarker'
  | 'measure'
  | 'regressionTrend'
  | 'flatTopBottom'
  | 'disjointChannel'
  | 'pitchfork'
  | 'schiffPitchfork'
  | 'modifiedSchiffPitchfork'
  | 'insidePitchfork'
  | 'fibonacciChannel'
  | 'trendBasedFibTime'
  | 'fibonacciWedge'
  | 'pitchfan'
  | 'gannSquareFixed'
  | 'gannSquare'
  | 'longPosition'
  | 'shortPosition'
  | 'forecast'
  | 'barsPattern'
  | 'ghostFeed'
  | 'projection'
  | 'anchoredVwap'
  | 'fixedRangeVolumeProfile'
  | 'text'
  | 'anchoredText'
  | 'note'
  | 'anchoredNote'
  | 'callout'
  | 'comment'
  | 'priceLabel'
  | 'priceNote'
  | 'signpost'
  | 'flagMark';

export const ALL_DRAWING_TOOL_NAMES: DrawTool[] = [
  'segment',
  'horizontalStraightLine',
  'horizontalRayLine',
  'horizontalSegment',
  'rayLine',
  'straightLine',
  'verticalStraightLine',
  'verticalRayLine',
  'verticalSegment',
  'priceLine',
  'parallelStraightLine',
  'priceChannelLine',
  'fibonacciLine',
  'fibonacciRetracement',
  'brush',
  'simpleAnnotation',
  'simpleTag',
  'arrow',
  'rect',
  'circle',
  'triangle',
  'parallelogram',
  'abcd',
  'xabcd',
  'threeWaves',
  'fiveWaves',
  'eightWaves',
  'fibonacciSegment',
  'fibonacciCircle',
  'fibonacciSpiral',
  'fibonacciSpeedResistanceFan',
  'fibonacciSpeedResistanceArcs',
  'fibonacciExtension',
  'fibonacciTimeZone',
  'gannBox',
  'gannFan',
  'infoLine',
  'trendAngle',
  'crossLine',
  'priceRange',
  'dateRange',
  'datePriceRange',
  'crossMarker',
  'dotMarker',
  'measure',
  'regressionTrend',
  'flatTopBottom',
  'disjointChannel',
  'pitchfork',
  'schiffPitchfork',
  'modifiedSchiffPitchfork',
  'insidePitchfork',
  'fibonacciChannel',
  'trendBasedFibTime',
  'fibonacciWedge',
  'pitchfan',
  'gannSquareFixed',
  'gannSquare',
  'longPosition',
  'shortPosition',
  'forecast',
  'barsPattern',
  'ghostFeed',
  'projection',
  'anchoredVwap',
  'fixedRangeVolumeProfile',
  'text',
  'anchoredText',
  'note',
  'anchoredNote',
  'callout',
  'comment',
  'priceLabel',
  'priceNote',
  'signpost',
  'flagMark',
];

interface ToolItem {
  id: DrawTool | 'eraser';
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  isAction?: boolean;
}

interface DrawCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  tools: ToolItem[];
}

const USER_DRAWING_GROUP = 'anonymous-liquid-user-drawings';

const DRAW_CATEGORIES: DrawCategory[] = [
  {
    id: 'lines',
    name: 'Lines',
    icon: TrendingUp,
    tools: [
      { id: 'segment', name: 'Trend Line', icon: TrendingUp },
      { id: 'rayLine', name: 'Ray', icon: MoveUpRight },
      { id: 'infoLine', name: 'Info Line', icon: Info },
      { id: 'straightLine', name: 'Extended Line', icon: TrendingUp },
      { id: 'trendAngle', name: 'Trend Angle', icon: Compass },
      { id: 'horizontalStraightLine', name: 'Horizontal Line', icon: Minus },
      { id: 'horizontalRayLine', name: 'Horizontal Ray', icon: MoveRight },
      { id: 'verticalStraightLine', name: 'Vertical Line', icon: Split },
      { id: 'crossLine', name: 'Cross Line', icon: Crosshair },
    ],
  },
  {
    id: 'channels',
    name: 'Channels',
    icon: Layers,
    tools: [
      { id: 'parallelStraightLine', name: 'Parallel Channel', icon: Layers },
      { id: 'regressionTrend', name: 'Regression Trend', icon: TrendingUp },
      { id: 'flatTopBottom', name: 'Flat Top/Bottom', icon: Layers },
      { id: 'disjointChannel', name: 'Disjoint Channel', icon: Layers },
    ],
  },
  {
    id: 'pitchforks',
    name: 'Pitchforks',
    icon: GitCommit,
    tools: [
      { id: 'pitchfork', name: 'Pitchfork', icon: GitCommit },
      { id: 'schiffPitchfork', name: 'Schiff Pitchfork', icon: GitCommit },
      { id: 'modifiedSchiffPitchfork', name: 'Modified Schiff Pitchfork', icon: GitCommit },
      { id: 'insidePitchfork', name: 'Inside Pitchfork', icon: GitCommit },
    ],
  },
  {
    id: 'fib',
    name: 'Fibonacci',
    icon: Percent,
    tools: [
      { id: 'fibonacciRetracement', name: 'Fib Retracement', icon: Percent },
      { id: 'fibonacciExtension', name: 'Trend-Based Fib Extension', icon: MoveUpRight },
      { id: 'fibonacciChannel', name: 'Fib Channel', icon: Layers },
      { id: 'fibonacciTimeZone', name: 'Fib Time Zone', icon: Clock },
      { id: 'fibonacciSpeedResistanceFan', name: 'Fib Speed Resistance Fan', icon: TrendingUp },
      { id: 'trendBasedFibTime', name: 'Trend-Based Fib Time', icon: Clock },
      { id: 'fibonacciCircle', name: 'Fib Circles', icon: Circle },
      { id: 'fibonacciSpiral', name: 'Fib Spiral', icon: Activity },
      { id: 'fibonacciSpeedResistanceArcs', name: 'Fib Speed Resistance Arcs', icon: Circle },
      { id: 'fibonacciWedge', name: 'Fib Wedge', icon: Shapes },
      { id: 'pitchfan', name: 'Pitchfan', icon: TrendingUp },
    ],
  },
  {
    id: 'gann',
    name: 'Gann',
    icon: Square,
    tools: [
      { id: 'gannBox', name: 'Gann Box', icon: Square },
      { id: 'gannSquareFixed', name: 'Gann Square Fixed', icon: Square },
      { id: 'gannSquare', name: 'Gann Square', icon: Square },
      { id: 'gannFan', name: 'Gann Fan', icon: TrendingUp },
    ],
  },
  {
    id: 'projection',
    name: 'Projection',
    icon: Target,
    tools: [
      { id: 'longPosition', name: 'Long Position', icon: TrendingUp },
      { id: 'shortPosition', name: 'Short Position', icon: TrendingUp },
      { id: 'forecast', name: 'Forecast', icon: MoveUpRight },
      { id: 'barsPattern', name: 'Bars Pattern', icon: BarChart2 },
      { id: 'ghostFeed', name: 'Ghost Feed', icon: Eye },
      { id: 'projection', name: 'Projection', icon: Target },
    ],
  },
  {
    id: 'volume',
    name: 'Volume-Based',
    icon: Volume2,
    tools: [
      { id: 'anchoredVwap', name: 'Anchored VWAP', icon: Activity },
      { id: 'fixedRangeVolumeProfile', name: 'Fixed Range Volume Profile', icon: BarChart3 },
    ],
  },
  {
    id: 'measurer',
    name: 'Measurer',
    icon: Ruler,
    tools: [
      { id: 'priceRange', name: 'Price Range', icon: DollarSign },
      { id: 'dateRange', name: 'Date Range', icon: Calendar },
      { id: 'datePriceRange', name: 'Date and Price Range', icon: Ruler },
    ],
  },
  {
    id: 'text',
    name: 'Text & Notes',
    icon: Type,
    tools: [
      { id: 'text', name: 'Text', icon: Type },
      { id: 'anchoredText', name: 'Anchored Text', icon: Pin },
      { id: 'note', name: 'Note', icon: Pin },
      { id: 'anchoredNote', name: 'Anchored Note', icon: Pin },
      { id: 'callout', name: 'Callout', icon: MessageSquare },
      { id: 'comment', name: 'Comment', icon: MessageSquare },
      { id: 'priceLabel', name: 'Price Label', icon: Tag },
      { id: 'priceNote', name: 'Price Note', icon: Tag },
      { id: 'signpost', name: 'Signpost', icon: Flag },
      { id: 'flagMark', name: 'Flag Mark', icon: Flag },
    ],
  },
  {
    id: 'markers',
    name: 'Markers',
    icon: Plus,
    tools: [
      { id: 'crossMarker', name: 'Cross', icon: Plus },
      { id: 'dotMarker', name: 'Dot', icon: Dot },
      { id: 'arrow', name: 'Arrow', icon: MoveUpRight },
      { id: 'eraser', name: 'Eraser', icon: Eraser, isAction: true },
    ],
  },
  {
    id: 'shapes',
    name: 'Shapes',
    icon: Shapes,
    tools: [
      { id: 'rect', name: 'Rectangle', icon: Square },
      { id: 'circle', name: 'Circle', icon: Circle },
      { id: 'triangle', name: 'Triangle', icon: Triangle },
      { id: 'parallelogram', name: 'Parallelogram', icon: Layers },
    ],
  },
  {
    id: 'patterns',
    name: 'Patterns',
    icon: Activity,
    tools: [
      { id: 'abcd', name: 'ABCD', icon: Activity },
      { id: 'xabcd', name: 'XABCD', icon: Activity },
    ],
  },
  {
    id: 'waves',
    name: 'Waves',
    icon: Waves,
    tools: [
      { id: 'threeWaves', name: '3 Wave', icon: Activity },
      { id: 'fiveWaves', name: '5 Wave', icon: Activity },
      { id: 'eightWaves', name: '8 Wave', icon: Activity },
    ],
  },
  {
    id: 'draw',
    name: 'Draw',
    icon: Paintbrush,
    tools: [
      { id: 'brush', name: 'Brush', icon: Paintbrush },
    ],
  },
];

// Public search index is derived from the SAME implemented drawing groups used by the toolbar.
export const DRAWING_SEARCH_ITEMS = DRAW_CATEGORIES.flatMap((category) =>
  category.tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    category: category.name,
    categoryId: category.id,
  }))
);

const UP = '#2DC08E';
const DOWN = '#F92855';

const CANDLE_UP = '#2DC08E';
const CANDLE_DOWN = '#F92855';

const NEON =
  '#4ef2bb';

const CROSSHAIR =
  '#ffffff66';

const GRID =
  '#ffffff14';

const AXIS =
  '#ffffff99';

const FONT =
  'Inter, ui-sans-serif, system-ui, sans-serif';

const DEFAULT_BAR_SPACE =
  8;

const RIGHT_OFFSET_PX =
  96;

function candleTimestampMs(
  time: number,
): number {
  if (
    !Number.isFinite(time)
  ) {
    return 0;
  }

  /*
   * Current Anonymous Liquid TVChart stores
   * candle time in seconds.
   *
   * Hyperliquid/source KLine candles use
   * millisecond timestamps.
   *
   * Preserve either form safely.
   */
  return time < 1e12
    ? Math.floor(
        time * 1000,
      )
    : Math.floor(time);
}

function toBar(
  candle: KLineCandle,
): KLineData {
  return {
    timestamp:
      candleTimestampMs(
        candle.time,
      ),

    open:
      candle.open,

    high:
      candle.high,

    low:
      candle.low,

    close:
      candle.close,

    volume:
      candle.volume,
  };
}

function toPeriod(
  interval: CandleInterval,
): Period {
  switch (interval) {
    case '1m':
      return {
        span: 1,
        type: 'minute',
      };

    case '3m':
      return {
        span: 3,
        type: 'minute',
      };

    case '5m':
      return {
        span: 5,
        type: 'minute',
      };

    case '15m':
      return {
        span: 15,
        type: 'minute',
      };

    case '30m':
      return {
        span: 30,
        type: 'minute',
      };

    case '1h':
      return {
        span: 1,
        type: 'hour',
      };

    case '2h':
      return {
        span: 2,
        type: 'hour',
      };

    case '4h':
      return {
        span: 4,
        type: 'hour',
      };

    case '8h':
      return {
        span: 8,
        type: 'hour',
      };

    case '12h':
      return {
        span: 12,
        type: 'hour',
      };

    case '1d':
      return {
        span: 1,
        type: 'day',
      };

    case '3d':
      return {
        span: 3,
        type: 'day',
      };

    case '1w':
      return {
        span: 1,
        type: 'week',
      };

    case '1M':
      return {
        span: 1,
        type: 'month',
      };
  }
}

function getIsLightMode(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.classList.contains('light') ||
    document.body.classList.contains('light')
  );
}

function getChartThemeStyles(isLight: boolean) {
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
  const axisTextColor = isLight ? '#475569' : AXIS;
  const axisLineColor = isLight ? 'rgba(0, 0, 0, 0.08)' : '#ffffff1f';
  const crosshairLine = isLight ? 'rgba(15, 23, 42, 0.4)' : CROSSHAIR;
  const crosshairBadgeBg = isLight ? '#0f172a' : '#3a3b44';
  const crosshairBadgeText = '#ffffff';

  const drawMain = isLight ? '#334155' : '#F8FAFC';
  const drawBg = isLight ? 'rgba(51, 65, 85, 0.06)' : 'rgba(248, 250, 252, 0.06)';
  const drawPointBorder = isLight ? '#FFFFFF' : '#0F172A';
  const drawPointActiveBorder = isLight ? '#0F172A' : '#FFFFFF';
  const drawPointActiveColor = isLight ? '#1E293B' : '#F8FAFC';
  const textBg = isLight ? '#FFFFFF' : '#0F172A';
  const textColor = isLight ? '#1E293B' : '#F8FAFC';

  return {
    grid: {
      horizontal: { show: false },
      vertical: { show: false },
    },
    xAxis: {
      size: 0,
      axisLine: {
        show: false,
        color: axisLineColor,
      },
      tickLine: {
        show: false,
        color: axisLineColor,
      },
      tickText: {
        show: false,
        color: axisTextColor,
        family: FONT,
        size: 10,
      },
    },
    yAxis: {
      size: 58,
      axisLine: { show: true, color: axisLineColor },
      tickLine: { show: false, color: axisLineColor },
      tickText: { color: axisTextColor, family: FONT, size: 10 },
    },
    separator: { color: axisLineColor },
    crosshair: {
      horizontal: {
        line: { color: crosshairLine },
        text: { backgroundColor: crosshairBadgeBg, color: crosshairBadgeText, family: FONT, size: 11 },
      },
      vertical: {
        line: { color: crosshairLine },
        text: { backgroundColor: crosshairBadgeBg, color: crosshairBadgeText, family: FONT, size: 11 },
      },
    },
    candle: {
      priceMark: {
        last: {
          show: true,
          upColor: UP,
          downColor: DOWN,
          noChangeColor: '#888888',
          line: {
            show: true,
            style: 'dashed' as const,
            dashedValue: [4, 4],
            size: 1,
          },
          text: {
            show: true,
            style: 'fill' as const,
            size: 11,
            family: FONT,
            weight: 'bold',
            color: '#FFFFFF',
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 2,
          },
        },
        high: {
          color: axisTextColor,
          textFamily: FONT,
          textSize: 10,
        },
        low: {
          color: axisTextColor,
          textFamily: FONT,
          textSize: 10,
        },
      },
    },
    overlay: {
      point: {
        color: drawMain,
        borderColor: drawPointBorder,
        borderSize: 1,
        radius: 4,
        activeColor: drawPointActiveColor,
        activeBorderColor: drawPointActiveBorder,
        activeBorderSize: 2,
        activeRadius: 5,
      },
      line: {
        style: 'solid' as const,
        smooth: false,
        color: drawMain,
        size: 1,
        dashedValue: [2, 2],
      },
      rect: {
        style: 'fill' as const,
        color: drawBg,
        borderColor: drawMain,
        borderSize: 1,
        borderStyle: 'solid' as const,
        borderRadius: 4,
        borderDashedValue: [2, 2],
      },
      polygon: {
        style: 'fill' as const,
        color: drawBg,
        borderColor: drawMain,
        borderSize: 1,
        borderStyle: 'solid' as const,
        borderDashedValue: [2, 2],
      },
      circle: {
        style: 'fill' as const,
        color: drawBg,
        borderColor: drawMain,
        borderSize: 1,
        borderStyle: 'solid' as const,
        borderDashedValue: [2, 2],
      },
      arc: {
        style: 'solid' as const,
        color: drawMain,
        size: 1,
        dashedValue: [2, 2],
      },
      text: {
        style: 'fill' as const,
        color: textColor,
        size: 11,
        family: FONT,
        weight: 'bold',
        borderStyle: 'solid' as const,
        borderDashedValue: [2, 2],
        borderSize: 1,
        borderColor: drawMain,
        borderRadius: 4,
        backgroundColor: textBg,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3,
      },
    },
  };
}

function applyYAxisEdge(
  chart: Chart,
  compact: boolean,
  isLight = false,
) {
  const axisLineColor = isLight ? 'rgba(0, 0, 0, 0.08)' : '#ffffff1f';
  chart.setStyles({
    yAxis: {
      axisLine: {
        show: !compact,
        color: compact ? 'transparent' : axisLineColor,
        size: compact ? 0 : 1,
      },
      tickLine: {
        show: false,
        size: 0,
      },
    },
  });
}

function getSubPaneIndicatorsMap(chart: Chart): Map<string, { paneId: string; prefId: string }> {
  const map = new Map<string, { paneId: string; prefId: string }>();
  const baseSubMap: Record<string, string> = {
    VOL: 'VOL',
    MACD: 'MACD',
    RSI: 'RSI',
    CCI: 'CCI',
  };

  for (const [name, prefId] of Object.entries(baseSubMap)) {
    try {
      const list = chart.getIndicators({ name });
      if (Array.isArray(list)) {
        for (const ind of list) {
          if (ind?.paneId && ind.paneId !== 'candle_pane' && !map.has(ind.paneId)) {
            map.set(ind.paneId, { paneId: ind.paneId, prefId });
          }
        }
      }
    } catch {}
  }

  if (Array.isArray(EXTRA_INDICATOR_SPECS)) {
    for (const spec of EXTRA_INDICATOR_SPECS) {
      if (!spec.overlay) {
        try {
          const list = chart.getIndicators({ name: spec.name });
          if (Array.isArray(list)) {
            for (const ind of list) {
              if (ind?.paneId && ind.paneId !== 'candle_pane' && !map.has(ind.paneId)) {
                map.set(ind.paneId, { paneId: ind.paneId, prefId: spec.name });
              }
            }
          }
        } catch {}
      }
    }
  }

  if (Array.isArray(CUSTOM_INDICATOR_SPECS)) {
    for (const spec of CUSTOM_INDICATOR_SPECS) {
      if (!spec.overlay) {
        try {
          const list = chart.getIndicators({ name: spec.internalName });
          if (Array.isArray(list)) {
            for (const ind of list) {
              if (ind?.paneId && ind.paneId !== 'candle_pane' && !map.has(ind.paneId)) {
                map.set(ind.paneId, { paneId: ind.paneId, prefId: spec.id });
              }
            }
          }
        } catch {}
      }
    }
  }

  return map;
}

function applyResponsiveIndicatorPaneLayout(
  chart: Chart | null,
  host: HTMLElement | null,
) {
  if (!chart || !host) return;

  const width = host.clientWidth || 320;
  const rawHeight = host.clientHeight || 0;
  const availableHeight = Math.max(rawHeight, 240);
  const isMobile = width < 640;

  const subPaneMap = getSubPaneIndicatorsMap(chart);
  const subPaneEntries = Array.from(subPaneMap.values());
  const count = subPaneEntries.length;
  const candleMin = isMobile ? 180 : 240;
  const subMin = isMobile ? 64 : 72;

  if (count === 0) {
    chart.setPaneOptions({
      id: 'candle_pane',
      height: availableHeight,
      minHeight: Math.min(candleMin, availableHeight),
      dragEnabled: true,
    });
    return;
  }

  const prefs = loadIndicatorPrefs();
  let defaultSubTarget = isMobile ? 105 : 130;
  if (count === 2) {
    defaultSubTarget = isMobile ? 82 : 105;
  } else if (count >= 3) {
    defaultSubTarget = isMobile ? 72 : 90;
  }

  let totalRequestedSubHeight = 0;
  const targetHeights = new Map<string, number>();

  for (const entry of subPaneEntries) {
    const customHeight = Number(prefs.indicatorSettings?.[entry.prefId]?.paneHeight);
    const validCustomHeight =
      Number.isFinite(customHeight) && customHeight >= 50 && customHeight <= 500
        ? customHeight
        : undefined;
    const h = validCustomHeight ?? defaultSubTarget;
    targetHeights.set(entry.paneId, h);
    totalRequestedSubHeight += h;
  }

  let candleHeight = availableHeight - totalRequestedSubHeight;
  if (candleHeight < candleMin) {
    const maxSubTotal = Math.max(availableHeight - candleMin, count * subMin);
    candleHeight = Math.max(availableHeight - maxSubTotal, 100);
    const scale = totalRequestedSubHeight > 0 ? maxSubTotal / totalRequestedSubHeight : 1;
    for (const entry of subPaneEntries) {
      const current = targetHeights.get(entry.paneId) ?? defaultSubTarget;
      targetHeights.set(entry.paneId, Math.max(Math.floor(current * scale), subMin));
    }
  }

  chart.setPaneOptions({
    id: 'candle_pane',
    height: candleHeight,
    minHeight: Math.min(candleMin, candleHeight),
    dragEnabled: true,
  });

  for (const entry of subPaneEntries) {
    const h = targetHeights.get(entry.paneId) ?? defaultSubTarget;
    chart.setPaneOptions({
      id: entry.paneId,
      height: h,
      minHeight: Math.min(subMin, h),
      dragEnabled: true,
    });
  }
}

function applyDefaultViewport(
  chart: Chart,
) {
  chart.setBarSpace(
    DEFAULT_BAR_SPACE,
  );

  chart.setOffsetRightDistance(
    RIGHT_OFFSET_PX,
  );

  chart.scrollToRealTime(
    0,
  );
}

function resetAndScrollToLatest(
  chart: Chart,
) {
  chart.resetData();

  window.requestAnimationFrame(
    () => {
      applyDefaultViewport(
        chart
      );

      window.requestAnimationFrame(
        () =>
          applyDefaultViewport(
            chart
          )
      );
    }
  );
}

function buildMeasureTexts(points: any[]): string[] {
  const start = points?.[0];
  const end = points?.[1];

  if (
    start?.value === undefined ||
    end?.value === undefined
  ) {
    return [];
  }

  const change =
    end.value - start.value;

  const percent =
    start.value === 0
      ? 0
      : (change / start.value) * 100;

  return [
    `Price Change: ${change.toFixed(2)}`,
    `Change: ${percent.toFixed(2)}%`,
  ];
}

function persistCurrentDrawings(
  chart: Chart | null,
  storageKey: string,
  activeOverlayId?: string | null
) {
  if (!chart || !storageKey) return;

  const overlays = chart.getOverlays({
    groupId: USER_DRAWING_GROUP,
  });

  if (!overlays || overlays.length === 0) {
    saveDrawings(storageKey, []);
    return;
  }

  const completedOverlays = overlays.filter(
    (ov) => ov.id !== activeOverlayId
  );

  const drawingsToSave: SavedDrawing[] = [];

  for (const ov of completedOverlays) {
    if (!ov.name || !ALL_DRAWING_TOOL_NAMES.includes(ov.name as DrawTool)) {
      continue;
    }

    if (!Array.isArray(ov.points) || ov.points.length === 0) {
      continue;
    }

    const validPoints: SavedDrawingPoint[] = [];
    for (const pt of ov.points) {
      if (!pt || typeof pt !== 'object') continue;
      const timestamp = Number(pt.timestamp);
      if (!Number.isFinite(timestamp)) continue;

      const p: SavedDrawingPoint = { timestamp };
      if (pt.value !== undefined) {
        const val = Number(pt.value);
        if (Number.isFinite(val)) {
          p.value = val;
        }
      }
      validPoints.push(p);
    }

    if (validPoints.length === 0) continue;

    const record: SavedDrawing = {
      tool: ov.name,
      points: validPoints,
    };

    if (
      ov.name !== 'measure' &&
      ov.extendData !== undefined &&
      typeof ov.extendData !== 'function'
    ) {
      record.extendData = ov.extendData;
    }

    drawingsToSave.push(record);
  }

  saveDrawings(storageKey, drawingsToSave);
}

export default function KLineChartPane({
  candles,
  interval,
  symbol,
  drawingStorageKey,
  timezone,
  chartMode,
  showHighLow,
  showOhlcv,
  lines,
  showLines,
  tradeMarkers,
  showTradeMarkers,
  loadOlderCandles,
  indicatorsOpen,
  onIndicatorsOpenChange,
}: {
  candles:
    KLineCandle[];

  interval:
    CandleInterval;

  symbol:
    string;

  drawingStorageKey?:
    string;

  timezone:
    string;

  chartMode:
    ChartMode;

  showHighLow:
    boolean;

  showOhlcv:
    boolean;

  lines?: ChartPriceLine[];

  showLines?: boolean;

  tradeMarkers?: KlineTradeMarker[];

  showTradeMarkers?: boolean;

  loadOlderCandles?: (
    beforeTimestampMs: number
  ) => Promise<{
    candles: KLineCandle[];
    hasMore: boolean;
  }>;

  indicatorsOpen?: boolean;
  onIndicatorsOpenChange?: (open: boolean) => void;
}) {
  const normalizedStorageKey = String(
    drawingStorageKey ||
    symbol ||
    'PERP'
  )
    .trim()
    .toUpperCase();

  const currentDrawingStorageKeyRef =
    useRef(normalizedStorageKey);

  const hostRef =
    useRef<HTMLDivElement>(
      null,
    );

  const chartRef =
    useRef<Chart | null>(
      null,
    );

  type TextEditTool =
    | 'text'
    | 'anchoredText'
    | 'note'
    | 'anchoredNote'
    | 'callout'
    | 'comment'
    | 'priceNote'
    | 'signpost';

  const TEXT_EDIT_TOOLS: DrawTool[] = [
    'text',
    'anchoredText',
    'note',
    'anchoredNote',
    'callout',
    'comment',
    'priceNote',
    'signpost',
  ];

  const [eraserMode, setEraserMode] = useState(false);
  const eraserModeRef = useRef(false);
  eraserModeRef.current = eraserMode;

  const [pendingDrawingText, setPendingDrawingText] = useState<{
    overlayId: string;
    tool: TextEditTool;
    text: string;
  } | null>(null);

  const [toolFinderOpen, setToolFinderOpen] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [indicatorSearchSeed, setIndicatorSearchSeed] = useState('');
  const [toolFinderCategory, setToolFinderCategory] = useState<string>('all');

  const normalizeToolSearch = (value: string) =>
    value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const discardPendingTextDrawing = (resumeTool = false) => {
    const pending = pendingDrawingText;
    if (!pending) return;

    const chart = chartRef.current;
    if (chart) {
      chart.removeOverlay({
        id: pending.overlayId,
      });

      persistCurrentDrawings(
        chart,
        currentDrawingStorageKeyRef.current,
        activeDrawingIdRef.current
      );
    }

    setPendingDrawingText(null);

    if (
      resumeTool &&
      activeDrawToolRef.current === pending.tool
    ) {
      requestAnimationFrame(() => {
        if (activeDrawToolRef.current === pending.tool && !eraserModeRef.current) {
          startDraw(pending.tool);
        }
      });
    }
  };

  const enableEraserMode = () => {
    if (pendingDrawingText) {
      discardPendingTextDrawing(false);
    }
    activeDrawToolRef.current = null;
    const chart = chartRef.current;
    if (chart && activeDrawingIdRef.current) {
      chart.removeOverlay({ id: activeDrawingIdRef.current });
    }
    activeDrawingIdRef.current = null;
    setDrawTool(null);
    setSelectedDrawingId(null);
    setMenuAnchor(null);
    setToolFinderOpen(false);
    setEraserMode(true);
    eraserModeRef.current = true;
  };

  const handleSavePendingText = (trimmedText: string) => {
    const pending = pendingDrawingText;
    if (!pending) return;
    const chart = chartRef.current;
    const { overlayId, tool } = pending;
    if (chart) {
      const overlays = chart.getOverlays({ id: overlayId });
      const existingExtendData = overlays?.[0]?.extendData;
      const nextExtendData =
        existingExtendData && typeof existingExtendData === 'object'
          ? { ...existingExtendData, text: trimmedText }
          : { text: trimmedText };

      chart.overrideOverlay({
        id: overlayId,
        extendData: nextExtendData,
      });

      persistCurrentDrawings(
        chart,
        currentDrawingStorageKeyRef.current,
        activeDrawingIdRef.current
      );
    }
    setPendingDrawingText(null);
    requestAnimationFrame(() => {
      if (activeDrawToolRef.current === tool && !eraserModeRef.current) {
        startDraw(tool);
      }
    });
  };

  const restoreSavedDrawings = (
    chart: Chart,
    storageKey: string,
    isLightMode: boolean
  ) => {
    const saved = loadDrawings(storageKey);
    if (!saved || saved.length === 0) return;

    const themeOverlayStyles = getChartThemeStyles(isLightMode).overlay;

    for (const item of saved) {
      if (!ALL_DRAWING_TOOL_NAMES.includes(item.tool as DrawTool)) {
        continue;
      }
      if (!Array.isArray(item.points) || item.points.length === 0) {
        continue;
      }

      let createdId: string | null = null;

      const createParams: any = {
        name: item.tool,
        groupId: USER_DRAWING_GROUP,
        points: item.points,
        styles: themeOverlayStyles,
        onSelected: () => {
          if (eraserModeRef.current && createdId) {
            const matches = chart.getOverlays({
              id: createdId,
              groupId: USER_DRAWING_GROUP,
            });
            if (matches && matches.length > 0) {
              chart.removeOverlay({ id: createdId });
              requestAnimationFrame(() => {
                persistCurrentDrawings(
                  chartRef.current,
                  currentDrawingStorageKeyRef.current,
                  activeDrawingIdRef.current
                );
              });
            }
            return false;
          }

          if (activeDrawToolRef.current !== null) {
            return false;
          }

          if (createdId) {
            setSelectedDrawingId(createdId);
          }
          return false;
        },
        onDeselected: () => {
          setSelectedDrawingId((current) =>
            current === createdId ? null : current
          );
          return false;
        },
        onRemoved: () => {
          setSelectedDrawingId((current) =>
            current === createdId ? null : current
          );
          requestAnimationFrame(() => {
            persistCurrentDrawings(
              chartRef.current,
              currentDrawingStorageKeyRef.current,
              activeDrawingIdRef.current
            );
          });
          return false;
        },
        onPressedMoveEnd: () => {
          requestAnimationFrame(() => {
            persistCurrentDrawings(
              chartRef.current,
              currentDrawingStorageKeyRef.current,
              activeDrawingIdRef.current
            );
          });
          return false;
        },
      };

      if (item.tool === 'measure') {
        const currentOverlayStyles = (createParams.styles ?? {}) as any;
        createParams.styles = {
          ...currentOverlayStyles,
          backgroundColor: currentOverlayStyles.polygon?.color,
          lineColor: currentOverlayStyles.line?.color,
          tipBackgroundColor: currentOverlayStyles.text?.backgroundColor,
        };
        createParams.extendData = buildMeasureTexts;
      } else if (item.extendData !== undefined && typeof item.extendData !== 'function') {
        createParams.extendData = item.extendData;
      }

      const overlayId = chart.createOverlay(createParams);
      if (typeof overlayId === 'string') {
        createdId = overlayId;
      }
    }
  };

  const candlesRef =
    useRef(candles);

  const loadOlderRef =
    useRef(
      loadOlderCandles
    );

  loadOlderRef.current =
    loadOlderCandles;

  const pushRef =
    useRef<
      ((
        bar: KLineData,
      ) => void) |
      null
    >(null);

  const historyRef =
    useRef({
      first: 0,
      length: 0,
      ready: false,
    });

  const lastPushRef =
    useRef<
      KLineCandle |
      null
    >(null);

  const [
    indicatorOpen,
    setIndicatorOpen,
  ] =
    useState(false);

  const [
    drawTool,
    setDrawTool,
  ] = useState<DrawTool | null>(
    null,
  );

  const activeDrawingIdRef =
    useRef<string | null>(null);

  const activeDrawToolRef =
    useRef<DrawTool | null>(null);

  const [selectedDrawingId, setSelectedDrawingId] =
    useState<string | null>(null);

  const [
    drawnOverlayIds,
    setDrawnOverlayIds,
  ] = useState<string[]>([]);

  const [
    activeCategoryTool,
    setActiveCategoryTool,
  ] = useState<Record<string, DrawTool>>({
    lines: 'segment',
    channels: 'parallelStraightLine',
    pitchforks: 'pitchfork',
    fib: 'fibonacciRetracement',
    gann: 'gannBox',
    projection: 'longPosition',
    volume: 'anchoredVwap',
    measurer: 'priceRange',
    text: 'text',
    markers: 'crossMarker',
    shapes: 'rect',
    patterns: 'abcd',
    waves: 'threeWaves',
    draw: 'brush',
  });

  const [
    menuAnchor,
    setMenuAnchor,
  ] = useState<{ catId: string; top: number; left: number } | null>(null);

  const [isLight, setIsLight] = useState<boolean>(() => getIsLightMode());

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const checkTheme = () => {
      setIsLight(getIsLightMode());
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener('storage', checkTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkTheme);
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const themeStyles = getChartThemeStyles(isLight);
    chart.setStyles(themeStyles);

    const userOverlays = chart.getOverlays({ groupId: USER_DRAWING_GROUP });
    if (userOverlays && userOverlays.length > 0) {
      for (const ov of userOverlays) {
        chart.overrideOverlay({
          id: ov.id,
          styles: themeStyles.overlay,
        });
      }
    }
  }, [isLight]);

  useEffect(() => {
    const handleCloseMenu = () => setMenuAnchor(null);
    window.addEventListener('resize', handleCloseMenu);
    window.addEventListener('scroll', handleCloseMenu, true);
    return () => {
      window.removeEventListener('resize', handleCloseMenu);
      window.removeEventListener('scroll', handleCloseMenu, true);
    };
  }, []);

  const [
    prefs,
    setPrefs,
  ] =
    useState<WebIndicatorPrefs>(
      () =>
        loadIndicatorPrefs(),
    );

  const prefsRef =
    useRef(prefs);

  prefsRef.current =
    prefs;

  candlesRef.current =
    candles;

  /*
   * Create / destroy the KLine engine.
   */
  useEffect(() => {
    const host =
      hostRef.current;

    if (!host) {
      return;
    }

    ensureKlineAverages();
    ensureAnonymousLiquidDrawingExtensions();

    const initialThemeStyles = getChartThemeStyles(getIsLightMode());

    const chart =
      init(
        host,
        {
          locale:
            'en-US',

          timezone,

          styles: {
            ...initialThemeStyles,

            candle: {
              bar: {
                upColor:
                  CANDLE_UP,

                downColor:
                  CANDLE_DOWN,

                upBorderColor:
                  CANDLE_UP,

                downBorderColor:
                  CANDLE_DOWN,

                upWickColor:
                  CANDLE_UP,

                downWickColor:
                  CANDLE_DOWN,

                noChangeColor:
                  '#888888',
              },

              priceMark: {
                last: {
                  show: true,
                  upColor:
                    UP,

                  downColor:
                    DOWN,

                  line: {
                    show: true,
                    style: 'dashed',
                    dashedValue: [4, 4],
                    size: 1,
                  },

                  text: {
                    show: true,
                    style: 'fill',
                    size: 11,
                    family:
                      FONT,
                    weight:
                      'bold',
                    color:
                      '#FFFFFF',
                    paddingLeft: 4,
                    paddingRight: 4,
                    paddingTop: 2,
                    paddingBottom: 2,
                    borderRadius: 2,
                  },
                },

                high: {
                  color:
                    AXIS,

                  textFamily:
                    FONT,
                },

                low: {
                  color:
                    AXIS,

                  textFamily:
                    FONT,
                },
              },

              tooltip: {
                offsetLeft:
                  28,

                offsetTop:
                  6,

                legend: {
                  color:
                    AXIS,

                  family:
                    FONT,

                  size:
                    11,

                  marginTop:
                    2,

                  marginBottom:
                    2,

                  template: [
                    {
                      title:
                        'O: ',

                      value:
                        '{open}',
                    },

                    {
                      title:
                        'H: ',

                      value:
                        '{high}',
                    },

                    {
                      title:
                        'L: ',

                      value:
                        '{low}',
                    },

                    {
                      title:
                        'C: ',

                      value:
                        '{close}',
                    },

                    {
                      title:
                        'V: ',

                      value:
                        '{volume}',
                    },
                  ],
                },

                title: {
                  show:
                    false,

                  color:
                    AXIS,

                  family:
                    FONT,

                  size:
                    11,
                },
              },
            },

            indicator: {
              tooltip: {
                showRule:
                  'none',

                offsetLeft:
                  28,

                title: {
                  color:
                    AXIS,

                  family:
                    FONT,

                  size:
                    11,
                },

                legend: {
                  color:
                    AXIS,

                  family:
                    FONT,

                  size:
                    11,
                },
              },

              lines: [
                {
                  color:
                    '#FF9600',
                },
                {
                  color:
                    '#935EBD',
                },
                {
                  color:
                    '#1677FF',
                },
                {
                  color:
                    '#E11D74',
                },
                {
                  color:
                    '#01C5C4',
                },
              ],
            },
          },
        },
      );

    if (!chart) {
      return;
    }

    chartRef.current =
      chart;

    // Mobile-only: choose the initial Y-axis scale from ACTUAL visible OHLC
    // instead of letting a distant long-period overlay (such as MA200)
    // squash the candles. This matches a gentle price-axis zoom gesture;
    // the horizontal viewport, live stream and drawing/indicator logic stay
    // exactly as in the original chart.
    chart.overrideYAxis({
      paneId: 'candle_pane',
      scrollZoomEnabled: true,
      createRange: ({ chart: currentChart, defaultRange }) => {
        if (typeof window === 'undefined' || window.innerWidth >= 640) {
          return defaultRange;
        }
        const data = currentChart.getDataList();
        const visible = currentChart.getVisibleRange();
        if (!data || data.length < 2) return defaultRange;

        const start = Math.max(0, Math.floor(visible.from));
        const end = Math.min(data.length - 1, Math.ceil(visible.to));
        if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 1) {
          return defaultRange;
        }

        let low = Number.POSITIVE_INFINITY;
        let high = Number.NEGATIVE_INFINITY;
        for (let i = start; i <= end; i++) {
          const bar = data[i];
          const barLow = Number(bar?.low);
          const barHigh = Number(bar?.high);
          if (Number.isFinite(barLow) && Number.isFinite(barHigh) &&
              barLow > 0 && barHigh >= barLow) {
            low = Math.min(low, barLow);
            high = Math.max(high, barHigh);
          }
        }
        if (!Number.isFinite(low) || !Number.isFinite(high) || high <= 0) {
          return defaultRange;
        }

        // When nearby moving averages already fit, keep native auto-scaling.
        // Otherwise focus on real visible candle highs/lows; the chart's
        // existing top/bottom margins supply breathing room naturally.
        const candleSpan = Math.max(high - low, high * 0.0003);
        if (!Number.isFinite(defaultRange.realRange) ||
            defaultRange.realRange <= candleSpan * 1.4) {
          return defaultRange;
        }
        const middle = (high + low) / 2;
        const from = middle - candleSpan / 2;
        const to = middle + candleSpan / 2;
        return {
          from, to, range: to - from,
          realFrom: from, realTo: to, realRange: to - from,
          displayFrom: from, displayTo: to, displayRange: to - from,
        };
      },
    });

    chart.setSymbol({
      ticker:
        symbol ||
        'PERP',

      pricePrecision:
        4,

      volumePrecision:
        2,
    });

    chart.setPeriod(
      toPeriod(
        interval,
      ),
    );

    chart.setDataLoader({
      getBars: async ({
        type,
        timestamp,
        callback,
      }) => {
        if (
          type ===
            'forward' &&
          timestamp != null &&
          loadOlderRef.current
        ) {
          try {
            const page =
              await loadOlderRef.current(
                timestamp
              );

            callback(
              page.candles.map(
                toBar
              ),
              {
                forward:
                  page.hasMore,

                backward:
                  false,
              }
            );
          } catch {
            callback(
              [],
              {
                forward:
                  false,

                backward:
                  false,
              }
            );
          }

          return;
        }

        if (
          type ===
          'backward'
        ) {
          callback(
            [],
            {
              forward:
                true,

              backward:
                false,
            }
          );

          return;
        }

        const bars =
          candlesRef.current;

        callback(
          bars.length < 2
            ? []
            : bars.map(
                toBar
              ),
          {
            forward:
              !!loadOlderRef.current,

            backward:
              false,
          }
        );
      },

      subscribeBar: ({
        callback,
      }) => {
        pushRef.current =
          callback;
      },

      unsubscribeBar:
        () => {
          pushRef.current =
            null;
        },
    });

    applyIndicatorPrefs(
      chart,
      prefsRef.current,
      false,
      showOhlcv,
    );

    applyChartDisplay(
      chart,
      {
        mode:
          chartMode,

        showHighLow,

        showOhlcv,

        legendCollapsed:
          false,
      },
    );

    window.requestAnimationFrame(() => {
      applyResponsiveIndicatorPaneLayout(chart, host);
    });

    applyYAxisEdge(
      chart,
      host.clientWidth <
        640,
      getIsLightMode(),
    );

    window.requestAnimationFrame(
      () => {
        applyDefaultViewport(
          chart
        );

        restoreSavedDrawings(
          chart,
          normalizedStorageKey,
          getIsLightMode()
        );

        window.requestAnimationFrame(
          () =>
            applyDefaultViewport(
              chart
            )
        );
      }
    );

    let lastWidth =
      host.clientWidth;

    let lastHeight =
      host.clientHeight;

    const resizeObserver =
      new ResizeObserver(
        () => {
          const width =
            host.clientWidth;

          const height =
            host.clientHeight;

          if (
            width ===
              lastWidth &&
            height ===
              lastHeight
          ) {
            return;
          }

          lastWidth =
            width;

          lastHeight =
            height;

          applyYAxisEdge(
            chart,
            width < 640,
            getIsLightMode(),
          );

          chart.resize();

          window.requestAnimationFrame(() => {
            applyResponsiveIndicatorPaneLayout(chart, host);
          });
        },
      );

    resizeObserver.observe(
      host,
    );

    const handlePaneDrag = () => {
      try {
        const subPaneMap =
          getSubPaneIndicatorsMap(
            chart,
          );

        if (
          subPaneMap.size === 0
        ) {
          return;
        }

        const currentPrefs =
          loadIndicatorPrefs();

        const nextSettings = {
          ...(
            currentPrefs
              .indicatorSettings ??
            {}
          ),
        };

        let changed =
          false;

        for (
          const [
            paneId,
            { prefId },
          ] of subPaneMap.entries()
        ) {
          const size =
            chart.getSize(
              paneId,
              'root',
            );

          const rawHeight =
            size?.height;

          if (
            !Number.isFinite(
              rawHeight,
            )
          ) {
            continue;
          }

          const height =
            Math.max(
              50,
              Math.min(
                500,
                Math.round(
                  rawHeight as number,
                ),
              ),
            );

          const existing = {
            ...(
              nextSettings[
                prefId
              ] ?? {}
            ),
          };

          if (
            existing.paneHeight !==
            height
          ) {
            nextSettings[
              prefId
            ] = {
              ...existing,
              paneHeight:
                height,
            };

            changed =
              true;
          }
        }

        if (
          changed
        ) {
          saveIndicatorPrefs({
            ...currentPrefs,
            indicatorSettings:
              nextSettings,
          });
        }
      } catch {
        /* ignore */
      }
    };

    try {
      chart.subscribeAction(
        'onPaneDrag',
        handlePaneDrag,
      );
    } catch {
      /* ignore */
    }

    return () => {
      try {
        chart.unsubscribeAction(
          'onPaneDrag',
          handlePaneDrag,
        );
      } catch {
        /* ignore */
      }
      resizeObserver.disconnect();

      pushRef.current =
        null;

      if (chartRef.current) {
        persistCurrentDrawings(
          chartRef.current,
          currentDrawingStorageKeyRef.current,
          activeDrawingIdRef.current
        );
      }

      dispose(
        chart,
      );

      chartRef.current =
        null;
    };
  }, []);

  /*
   * Market / drawingStorageKey change:
   * save old market drawings and load new market drawings.
   */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      currentDrawingStorageKeyRef.current = normalizedStorageKey;
      return;
    }

    const previousKey = currentDrawingStorageKeyRef.current;
    if (previousKey === normalizedStorageKey) {
      return;
    }

    // A. STOP only current unfinished drawing
    activeDrawToolRef.current = null;
    if (activeDrawingIdRef.current) {
      chart.removeOverlay({ id: activeDrawingIdRef.current });
      activeDrawingIdRef.current = null;
    }

    // B. SAVE completed drawings under the PREVIOUS market key
    persistCurrentDrawings(chart, previousKey, null);

    // C. Remove current chart user drawings
    chart.removeOverlay({
      groupId: USER_DRAWING_GROUP,
    });

    // D. Clear only drawing UI selection state
    setDrawTool(null);
    setMenuAnchor(null);
    setSelectedDrawingId(null);

    // E. Update currentDrawingStorageKeyRef
    currentDrawingStorageKeyRef.current = normalizedStorageKey;

    // F. Load and restore drawings belonging to the NEW market key
    restoreSavedDrawings(chart, normalizedStorageKey, isLight);
  }, [normalizedStorageKey, isLight]);

  /*
   * Timezone can change without
   * rebuilding the chart.
   */
  useEffect(() => {
    chartRef.current
      ?.setTimezone(
        timezone,
      );
  }, [
    timezone,
  ]);

  /*
   * Symbol / timeframe change:
   * reset authoritative history.
   */
  useEffect(() => {
    const chart =
      chartRef.current;

    if (!chart) {
      return;
    }

    chart.setSymbol({
      ticker:
        symbol ||
        'PERP',

      pricePrecision:
        4,

      volumePrecision:
        2,
    });

    chart.setPeriod(
      toPeriod(
        interval,
      ),
    );

    historyRef.current = {
      first: 0,
      length: 0,
      ready: false,
    };

    lastPushRef.current =
      null;

    if (
      candlesRef.current
        .length >= 2
    ) {
      resetAndScrollToLatest(
        chart
      );
    }
  }, [
    symbol,
    interval,
  ]);

  /*
   * Historical / live candle sync.
   *
   * Full history reset only when
   * history actually changes.
   *
   * Ordinary live updates push only
   * the last candle.
   */
  useEffect(() => {
    const chart =
      chartRef.current;

    if (
      !chart ||
      candles.length < 2
    ) {
      if (
        !candles.length
      ) {
        historyRef.current = {
          first: 0,
          length: 0,
          ready: false,
        };

        lastPushRef.current =
          null;
      }

      return;
    }

    const first =
      candleTimestampMs(
        candles[0].time,
      );

    const last =
      candles[
        candles.length - 1
      ];

    const history =
      historyRef.current;

    if (
      !history.ready ||
      first !==
        history.first ||
      candles.length <
        history.length
    ) {
      historyRef.current = {
        first,
        length:
          candles.length,
        ready:
          true,
      };

      lastPushRef.current =
        last;

      resetAndScrollToLatest(
        chart
      );

      return;
    }

    historyRef.current = {
      first,
      length:
        candles.length,
      ready:
        true,
    };

    const prev =
      lastPushRef.current;

    if (
      prev &&
      prev.time ===
        last.time &&
      prev.open ===
        last.open &&
      prev.high ===
        last.high &&
      prev.low ===
        last.low &&
      prev.close ===
        last.close &&
      prev.volume ===
        last.volume
    ) {
      return;
    }

    lastPushRef.current =
      last;

    pushRef.current?.(
      toBar(last),
    );
  }, [
    candles,
  ]);

  /*
   * Re-apply visual mode and
   * indicators when settings change.
   */
  useEffect(() => {
    const chart =
      chartRef.current;

    if (!chart) {
      return;
    }

    applyIndicatorPrefs(
      chart,
      prefs,
      false,
      showOhlcv,
    );

    applyChartDisplay(
      chart,
      {
        mode:
          chartMode,

        showHighLow,

        showOhlcv,

        legendCollapsed:
          false,
      },
    );

    window.requestAnimationFrame(() => {
      applyResponsiveIndicatorPaneLayout(chart, hostRef.current);
    });
  }, [
    prefs,
    chartMode,
    showHighLow,
    showOhlcv,
  ]);

  useEffect(() => {
    const chart =
      chartRef.current;

    if (!chart) {
      return;
    }

    syncKlinePriceLines(
      chart,
      showLines === false
        ? []
        : (
            lines ??
            []
          ),
    );
  }, [
    lines,
    showLines,
    symbol,
    interval,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    syncKlineTradeMarkers(
      chart,
      tradeMarkers ?? [],
      showTradeMarkers === true
    );
  }, [
    tradeMarkers,
    showTradeMarkers,
    symbol,
    interval,
  ]);

  const handleToolPick = (catId: string, tool: ToolItem) => {
    if (pendingDrawingText) {
      discardPendingTextDrawing(false);
    }
    setSelectedDrawingId(null);
    setMenuAnchor(null);
    setToolFinderOpen(false);

    if (tool.id === 'eraser' || tool.isAction) {
      enableEraserMode();
      return;
    }

    setActiveCategoryTool((prev) => ({
      ...prev,
      [catId]: tool.id as DrawTool,
    }));

    startDraw(tool.id as DrawTool);
  };

  const startDraw = (next: DrawTool) => {
    const chart = chartRef.current;
    if (!chart) return;

    setEraserMode(false);
    eraserModeRef.current = false;
    setSelectedDrawingId(null);

    if (activeDrawingIdRef.current) {
      chart.removeOverlay({ id: activeDrawingIdRef.current });
      activeDrawingIdRef.current = null;
    }

    activeDrawToolRef.current = next;
    setDrawTool(next);

    let createdOverlayId: string | null = null;

    const createParams: any = {
      name: next,
      groupId: USER_DRAWING_GROUP,
      styles: getChartThemeStyles(isLight).overlay,
      onSelected: () => {
        if (eraserModeRef.current && createdOverlayId) {
          const matches = chart.getOverlays({
            id: createdOverlayId,
            groupId: USER_DRAWING_GROUP,
          });
          if (matches && matches.length > 0) {
            chart.removeOverlay({ id: createdOverlayId });
            requestAnimationFrame(() => {
              persistCurrentDrawings(
                chartRef.current,
                currentDrawingStorageKeyRef.current,
                activeDrawingIdRef.current
              );
            });
          }
          return false;
        }

        if (activeDrawToolRef.current !== null) {
          return false;
        }

        if (createdOverlayId) {
          setSelectedDrawingId(createdOverlayId);
        }
        return false;
      },
      onDeselected: () => {
        setSelectedDrawingId((current) =>
          current === createdOverlayId ? null : current
        );
        return false;
      },
      onRemoved: () => {
        setSelectedDrawingId((current) =>
          current === createdOverlayId ? null : current
        );
        requestAnimationFrame(() => {
          persistCurrentDrawings(
            chartRef.current,
            currentDrawingStorageKeyRef.current,
            activeDrawingIdRef.current
          );
        });
        return false;
      },
      onPressedMoveEnd: () => {
        requestAnimationFrame(() => {
          persistCurrentDrawings(
            chartRef.current,
            currentDrawingStorageKeyRef.current,
            activeDrawingIdRef.current
          );
        });
        return false;
      },
      onDrawEnd: () => {
        const finishedId = createdOverlayId;
        activeDrawingIdRef.current = null;
        setSelectedDrawingId(null);
        requestAnimationFrame(() => {
          persistCurrentDrawings(
            chartRef.current,
            currentDrawingStorageKeyRef.current,
            activeDrawingIdRef.current
          );
          if (TEXT_EDIT_TOOLS.includes(next) && finishedId) {
            setPendingDrawingText({
              overlayId: finishedId,
              tool: next as TextEditTool,
              text: '',
            });
            return;
          }
          if (activeDrawToolRef.current === next) {
            startDraw(next);
          }
        });
        return false;
      },
    };

    if (next === 'measure') {
      const currentOverlayStyles = (createParams.styles ?? {}) as any;
      createParams.styles = {
        ...currentOverlayStyles,
        backgroundColor: currentOverlayStyles.polygon?.color,
        lineColor: currentOverlayStyles.line?.color,
        tipBackgroundColor: currentOverlayStyles.text?.backgroundColor,
      };

      createParams.extendData = buildMeasureTexts;
    }

    const overlayId = chart.createOverlay(createParams);

    if (typeof overlayId === 'string') {
      createdOverlayId = overlayId;
      activeDrawingIdRef.current = overlayId;
    }
  };

  const handleDeleteSelected = () => {
    if (pendingDrawingText) {
      discardPendingTextDrawing(false);
    }
    const chart = chartRef.current;
    const id = selectedDrawingId;

    if (!chart || !id) return;

    chart.removeOverlay({ id });

    if (activeDrawingIdRef.current === id) {
      activeDrawingIdRef.current = null;
      activeDrawToolRef.current = null;
      setDrawTool(null);
    }

    setSelectedDrawingId(null);

    requestAnimationFrame(() => {
      persistCurrentDrawings(
        chartRef.current,
        currentDrawingStorageKeyRef.current,
        activeDrawingIdRef.current
      );
    });
  };

  const handleCursor = () => {
    if (pendingDrawingText) {
      discardPendingTextDrawing(false);
    }
    setEraserMode(false);
    eraserModeRef.current = false;
    activeDrawToolRef.current = null;
    const chart = chartRef.current;

    if (chart && activeDrawingIdRef.current) {
      chart.removeOverlay({ id: activeDrawingIdRef.current });
    }

    activeDrawingIdRef.current = null;
    setDrawTool(null);
    setMenuAnchor(null);
    setToolFinderOpen(false);
    setSelectedDrawingId(null);
  };

  const handleUndo = () => {
    if (pendingDrawingText) {
      discardPendingTextDrawing(false);
    }
    const chart = chartRef.current;
    if (!chart) return;

    const overlays = chart.getOverlays({
      groupId: USER_DRAWING_GROUP,
    });

    if (overlays && overlays.length > 0) {
      const completedOverlays = overlays.filter(
        (overlay) => overlay.id !== activeDrawingIdRef.current
      );

      if (completedOverlays.length > 0) {
        const last = completedOverlays[completedOverlays.length - 1];
        chart.removeOverlay({ id: last.id });

        if (selectedDrawingId === last.id) {
          setSelectedDrawingId(null);
        }

        requestAnimationFrame(() => {
          persistCurrentDrawings(
            chartRef.current,
            currentDrawingStorageKeyRef.current,
            activeDrawingIdRef.current
          );
        });
      }
    }
  };

  const handleClear = () => {
    if (pendingDrawingText) {
      discardPendingTextDrawing(false);
    }
    activeDrawToolRef.current = null;
    const chart = chartRef.current;
    if (!chart) return;

    chart.removeOverlay({
      groupId: USER_DRAWING_GROUP,
    });

    activeDrawingIdRef.current = null;
    setDrawTool(null);
    setMenuAnchor(null);
    setToolFinderOpen(false);
    setSelectedDrawingId(null);

    saveDrawings(currentDrawingStorageKeyRef.current, []);
  };

  const patchPrefs = (
    next:
      WebIndicatorPrefs,
  ) => {
    setPrefs(next);

    saveIndicatorPrefs(
      next,
    );
  };

  const searchKeywords = normalizeToolSearch(toolSearch).split(/\s+/).filter(Boolean);

  const filteredCategories = DRAW_CATEGORIES.map((cat) => {
    if (searchKeywords.length === 0 && toolFinderCategory !== 'all' && cat.id !== toolFinderCategory) {
      return { ...cat, tools: [] };
    }
    if (searchKeywords.length === 0) {
      return cat;
    }
    const matchingTools = cat.tools.filter((tool) => {
      const searchStr = normalizeToolSearch(`${tool.name} ${tool.id} ${cat.name}`);
      return searchKeywords.every((kw) => searchStr.includes(kw));
    });
    return { ...cat, tools: matchingTools };
  }).filter((cat) => cat.tools.length > 0);
  // Use the original full indicator catalog, no fake or duplicate indicators.
  const matchingIndicators = searchKeywords.length ? ALL_INDICATORS.filter(item => {
    const haystack = normalizeToolSearch(`${item.id} ${item.name} ${item.alias || ''} indicator study`);
    return searchKeywords.every(word => haystack.includes(word));
  }) : [];
  const openSearchedIndicator = (name: string) => {
    setIndicatorSearchSeed(name);
    setToolFinderOpen(false);
    if (onIndicatorsOpenChange) onIndicatorsOpenChange(true);
    else setIndicatorOpen(true);
  };

  // Header global search opens the EXISTING real indicator library/tool finder.
  // It does not create a separate drawing/indicator implementation.
  useEffect(() => {
    const handleGlobalChartSearch = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; query?: string }>).detail;
      if (!detail || typeof detail.query !== 'string') return;
      if (detail.kind === 'indicator') {
        setIndicatorSearchSeed(detail.query);
        setToolFinderOpen(false);
        if (onIndicatorsOpenChange) onIndicatorsOpenChange(true);
        else setIndicatorOpen(true);
      } else if (detail.kind === 'drawing') {
        setToolSearch(detail.query);
        setToolFinderCategory('all');
        setToolFinderOpen(true);
      }
    };
    window.addEventListener('hidedex:global-chart-search', handleGlobalChartSearch);
    return () => window.removeEventListener('hidedex:global-chart-search', handleGlobalChartSearch);
  }, [onIndicatorsOpenChange]);

  return (
    <div className="relative flex h-full min-h-[240px] w-full flex-col overflow-hidden bg-brand-bg">
      {/* HORIZONTAL DRAWING TOOLBAR */}
      <div className="relative z-30 flex h-10 sm:h-11 w-full shrink-0 items-center justify-between border-b border-brand-border/60 bg-brand-surface/40 px-1.5 select-none text-[9px] sm:text-[11px]">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-nowrap w-full">
          {/* Cursor Button */}
          <button
            type="button"
            title="Select drawing to move or delete"
            aria-label="Select drawing"
            onClick={handleCursor}
            className={`flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-colors shrink-0 ${
              drawTool === null && !eraserMode
                ? 'border-[#2196F3]/40 bg-[#2196F3]/15 text-[#2196F3] font-semibold shadow-xs'
                : 'text-brand-sub hover:text-brand-text hover:bg-brand-card border border-transparent'
            }`}
          >
            <MousePointer size={12} className="shrink-0" />
            <span className="text-[7px] sm:text-[8px] leading-none whitespace-nowrap">Select</span>
          </button>

          {/* Search Button */}
          <button
            type="button"
            title="Search tools and indicators"
            aria-label="Search tools and indicators"
            onClick={() => {
              setMenuAnchor(null);
              setToolFinderOpen(true);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-colors shrink-0 ${
              toolFinderOpen
                ? 'border-[#2196F3]/40 bg-[#2196F3]/15 text-[#2196F3] font-semibold shadow-xs'
                : 'text-brand-sub hover:text-brand-text hover:bg-brand-card border border-transparent'
            }`}
          >
            <Search size={12} className="shrink-0" />
            <span className="text-[7px] sm:text-[8px] leading-none whitespace-nowrap">Search</span>
          </button>

          <div className="h-5 w-px bg-brand-border/60 mx-0.5 shrink-0" />

          {/* Categories: Lines, Channel, Fib, Brush, Text */}
          {DRAW_CATEGORIES.map((cat) => {
            const ToolIcon = cat.icon;
            const isCatActive =
              (drawTool !== null && cat.tools.some((t) => t.id === drawTool)) ||
              (eraserMode && cat.id === 'markers');
            const isMenuOpen = menuAnchor?.catId === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                title={`${cat.name} menu`}
                aria-label={cat.name}
                onClick={(e) => {
                  setSelectedDrawingId(null);
                  if (isMenuOpen) {
                    setMenuAnchor(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuAnchor({
                      catId: cat.id,
                      top: rect.bottom + 4,
                      left: Math.max(8, Math.min(rect.left, window.innerWidth - 190)),
                    });
                  }
                }}
                className={`flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border shrink-0 transition-colors ${
                  isCatActive
                    ? 'border-[#2196F3]/40 bg-[#2196F3]/15 text-[#2196F3] font-semibold shadow-xs'
                    : isMenuOpen
                    ? 'border-brand-border bg-brand-card text-brand-text shadow-xs'
                    : 'border-brand-border/60 bg-brand-surface text-brand-sub hover:border-brand-border hover:bg-brand-card hover:text-brand-text'
                }`}
              >
                <ToolIcon size={12} className="shrink-0" />
                <span className="text-[7px] sm:text-[8px] leading-none whitespace-nowrap">{cat.name}</span>
              </button>
            );
          })}

          <div className="h-5 w-px bg-brand-border/60 mx-0.5 shrink-0" />

          {/* Undo Button */}
          <button
            type="button"
            title="Undo last drawing"
            aria-label="Undo"
            onClick={handleUndo}
            className="flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-brand-sub hover:text-brand-text hover:bg-brand-card border border-transparent transition-colors shrink-0"
          >
            <Undo2 size={12} className="shrink-0" />
            <span className="text-[7px] sm:text-[8px] leading-none whitespace-nowrap">Undo</span>
          </button>

          {/* Clear All Button (Permanent) */}
          <button
            type="button"
            title="Clear all drawings"
            aria-label="Clear all drawings"
            onClick={handleClear}
            className="flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-brand-sub hover:text-red-400 hover:bg-red-500/10 border border-transparent transition-colors shrink-0"
          >
            <Eraser size={12} className="shrink-0" />
            <span className="text-[7px] sm:text-[8px] leading-none whitespace-nowrap">Clear</span>
          </button>
        </div>
      </div>

      {/* ACTUAL CHART CANVAS (Immediately below toolbar) */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div
          ref={hostRef}
          className={`absolute inset-0 transition-opacity duration-300 ${
            candles.length < 2 ? 'opacity-25' : 'opacity-100'
          }`}
        />

        {/* Contextual Delete button when a completed drawing is selected */}
        {selectedDrawingId !== null && (
          <button
            type="button"
            title="Delete selected drawing"
            aria-label="Delete selected drawing"
            onClick={handleDeleteSelected}
            className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-md text-red-400 hover:text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-colors shadow-sm font-medium text-[10px] sm:text-xs cursor-pointer"
          >
            <Trash2 size={13} className="shrink-0 text-red-400" />
            <span className="whitespace-nowrap">Delete</span>
          </button>
        )}

        {candles.length < 2 ? (
          <div
            className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-brand-bg/30 text-[11px] font-semibold text-brand-sub"
            aria-busy
          >
            Loading chart...
          </div>
        ) : null}
      </div>

      {/* Submenu Portal */}
      {menuAnchor &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setMenuAnchor(null)}
            />
            <div
              className="fixed z-[101] min-w-[180px] max-h-[60dvh] overflow-y-auto rounded-lg border border-brand-border bg-brand-surface/95 dark:bg-brand-card/95 p-1 shadow-2xl backdrop-blur-md flex flex-col gap-0.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
              style={{
                top: `${menuAnchor.top}px`,
                left: `${menuAnchor.left}px`,
              }}
            >
              {(() => {
                const cat = DRAW_CATEGORIES.find((c) => c.id === menuAnchor.catId);
                if (!cat) return null;
                const currentToolId = activeCategoryTool[cat.id] || cat.tools[0].id;

                return cat.tools.map((tool) => {
                  const SubIcon = tool.icon;
                  const isCurrent = currentToolId === tool.id;
                  const isDrawingThis = drawTool === tool.id || (tool.id === 'eraser' && eraserMode);

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleToolPick(cat.id, tool)}
                      className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left transition-colors ${
                        isDrawingThis
                          ? 'bg-[#2196F3]/15 text-[#2196F3] font-semibold'
                          : isCurrent
                          ? 'text-brand-text bg-brand-card font-medium shadow-xs border border-brand-border/40'
                          : 'text-brand-sub hover:bg-brand-card/70 hover:text-brand-text border border-transparent'
                      }`}
                    >
                      <SubIcon size={13} className="shrink-0 text-brand-muted" />
                      <span className="truncate">{tool.name}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </>,
          document.body
        )}

      {/* ALL TOOLS FINDER MODAL / BOTTOM SHEET */}
      {toolFinderOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={() => setToolFinderOpen(false)}
            />
            <div
              className="fixed z-[111] bg-brand-surface dark:bg-brand-card border border-brand-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150
              bottom-0 left-0 right-0 max-h-[80dvh] rounded-t-2xl pb-safe
              sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] sm:max-w-[calc(100vw-32px)] sm:max-h-[70vh] sm:rounded-xl"
            >
              {/* Mobile Drag Indicator */}
              <div className="w-10 h-1 rounded-full bg-brand-border mx-auto mt-2 sm:hidden shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border shrink-0">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-[#2196F3]" />
                  <h3 className="text-sm font-semibold text-brand-text">Tools &amp; Indicators</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setToolFinderOpen(false)}
                  className="p-1 rounded-md text-brand-sub hover:text-brand-text hover:bg-brand-muted/20 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Input */}
              <div className="p-3 border-b border-brand-border shrink-0">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-brand-muted pointer-events-none" />
                  <input
                    type="text"
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Search tools or indicators (RSI, MACD, lines...)"
                    autoFocus
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-brand-bg border border-brand-border text-xs text-brand-text placeholder:text-brand-muted focus:outline-hidden focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-colors"
                  />
                  {toolSearch && (
                    <button
                      type="button"
                      onClick={() => setToolSearch('')}
                      className="absolute right-2.5 p-0.5 text-brand-muted hover:text-brand-text"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Chips */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-brand-border overflow-x-auto scrollbar-none shrink-0 text-[11px]">
                <button
                  type="button"
                  onClick={() => setToolFinderCategory('all')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                    toolFinderCategory === 'all'
                      ? 'bg-[#2196F3] text-white font-medium shadow-xs'
                      : 'bg-brand-bg text-brand-sub hover:text-brand-text border border-brand-border'
                  }`}
                >
                  All
                </button>
                {DRAW_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setToolFinderCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                      toolFinderCategory === cat.id
                        ? 'bg-[#2196F3] text-white font-medium shadow-xs'
                        : 'bg-brand-bg text-brand-sub hover:text-brand-text border border-brand-border'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {matchingIndicators.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wide px-1">Indicators ({matchingIndicators.length})</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {matchingIndicators.map(item => (
                        <button key={item.id} type="button" onClick={() => openSearchedIndicator(item.name)}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg text-left border border-brand-border/50 bg-brand-bg/50 text-brand-text hover:bg-brand-overlay-normal">
                          <span className="min-w-0 flex items-center gap-2">
                            <BarChart3 size={14} className="shrink-0 text-accent" />
                            <span className="text-xs truncate">{item.name}</span>
                          </span>
                          <span className="shrink-0 text-[9px] font-semibold text-accent bg-accent/10 rounded px-1.5 py-0.5">Indicator</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {filteredCategories.length === 0 && matchingIndicators.length === 0 ? (
                  <div className="py-12 text-center text-xs text-brand-muted">
                    No matching tools or indicators
                  </div>
                ) : (
                  filteredCategories.map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="text-[10px] font-semibold text-brand-muted tracking-wider uppercase px-1">
                        {cat.name}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {cat.tools.map((tool) => {
                          const ToolIcon = tool.icon;
                          const isCurrent = drawTool === tool.id || (tool.id === 'eraser' && eraserMode);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => handleToolPick(cat.id, tool)}
                              className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                                isCurrent
                                  ? 'bg-[#2196F3]/15 text-[#2196F3] font-semibold border border-[#2196F3]/30'
                                  : 'bg-brand-bg/50 hover:bg-brand-bg text-brand-text border border-brand-border/40 hover:border-brand-border'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <ToolIcon size={14} className="shrink-0 text-brand-muted" />
                                <span className="text-xs truncate">{tool.name}</span>
                              </div>
                              <span className="text-[9px] text-brand-muted shrink-0 ml-2">
                                {cat.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}

      {/* TEXT / NOTE COMPACT MODAL */}
      {pendingDrawingText &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs animate-in fade-in duration-100"
              onClick={() => discardPendingTextDrawing(true)}
            />
            <div className="fixed z-[111] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-24px)] max-w-[360px] rounded-xl border border-brand-border bg-brand-surface dark:bg-brand-card p-4 shadow-2xl animate-in zoom-in-95 duration-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-brand-text">
                  {pendingDrawingText.tool === 'note' || pendingDrawingText.tool === 'anchoredNote'
                    ? 'Add Note'
                    : pendingDrawingText.tool === 'comment'
                    ? 'Add Comment'
                    : pendingDrawingText.tool === 'signpost'
                    ? 'Add Signpost Text'
                    : 'Add Text'}
                </h4>
                <button
                  type="button"
                  onClick={() => discardPendingTextDrawing(true)}
                  className="p-1 rounded-md text-brand-sub hover:text-brand-text hover:bg-brand-muted/20"
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                autoFocus
                rows={3}
                value={pendingDrawingText.text}
                onChange={(e) =>
                  setPendingDrawingText((prev) =>
                    prev ? { ...prev, text: e.target.value } : null
                  )
                }
                placeholder="Enter text..."
                className="w-full p-2 rounded-lg bg-brand-bg border border-brand-border text-xs text-brand-text placeholder:text-brand-muted focus:outline-hidden focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSavePendingText(pendingDrawingText.text.trim());
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    discardPendingTextDrawing(true);
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => discardPendingTextDrawing(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-brand-sub hover:text-brand-text hover:bg-brand-muted/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePendingText(pendingDrawingText.text.trim())}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#2196F3] hover:bg-[#2196F3]/90 text-white shadow-xs transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* IndicatorSheet (separate, preserved) */}
      <IndicatorSheet
        initialSearchQuery={indicatorSearchSeed}
        open={
          indicatorsOpen !== undefined
            ? indicatorsOpen
            : indicatorOpen
        }
        prefs={
          prefs
        }
        onChange={
          patchPrefs
        }
        onClose={() => {
          setIndicatorSearchSeed('');
          if (onIndicatorsOpenChange) {
            onIndicatorsOpenChange(false);
          }
          setIndicatorOpen(
            false,
          );
        }}
      />
    </div>
  );
}
