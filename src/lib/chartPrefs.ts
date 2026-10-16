/**
 * Advanced chart timeframe/display preferences.
 *
 * This is the source web chart preference model adapted only to avoid
 * depending on the source repo's hlMarket.ts file.
 *
 * The timeframe list below is copied from the source chart market model.
 */

export const ALL_CANDLE_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const;

export type CandleInterval =
  (typeof ALL_CANDLE_INTERVALS)[number];

export const DEFAULT_VISIBLE_INTERVALS:
  CandleInterval[] = [
    '1m',
    '5m',
    '15m',
    '1h',
    '4h',
    '1d',
  ];

export function intervalLabel(
  id: CandleInterval,
): string {
  if (id === '1w') return 'W';
  if (id === '1M') return 'M';
  return id;
}

const KEY = 'builderpad:chartPrefs';

const DEFAULT_INTERVAL:
  CandleInterval = '15m';

export type ChartEngine =
  | 'tv'
  | 'kline';

export type ChartMode =
  | 'candle'
  | 'hollow'
  | 'hollowUp'
  | 'hollowDown'
  | 'bars'
  | 'line'
  | 'lineMarkers'
  | 'area';

export const CHART_STYLE_OPTIONS = [
  {
    id: 'candle',
    label: 'Candles',
  },
  {
    id: 'hollow',
    label: 'Hollow Candles',
  },
  {
    id: 'hollowUp',
    label: 'Hollow Up Candles',
  },
  {
    id: 'hollowDown',
    label: 'Hollow Down Candles',
  },
  {
    id: 'bars',
    label: 'Bars',
  },
  {
    id: 'line',
    label: 'Line',
  },
  {
    id: 'lineMarkers',
    label: 'Line with Markers',
  },
  {
    id: 'area',
    label: 'Area',
  },
] as const;

type ChartPrefs = {
  lastInterval?: string;
  visibleIntervals?: string[];
  engine?: ChartEngine;

  /**
   * Hide KLine top-left OHLC / MA / EMA legend.
   * Unset = collapsed on mobile, shown on desktop.
   */
  legendCollapsed?: boolean;

  /**
   * KLine overlay line colors keyed by indicator name.
   */
  indicatorColors?: Record<
    string,
    string[]
  >;

  /**
   * IANA timezone for axis labels + toolbar clock.
   */
  timezone?: string;

  /**
   * KLine high/low price labels.
   * Default true.
   */
  showHighLow?: boolean;

  /**
   * KLine top-left OHLCV tooltip.
   * Unset = off mobile, on desktop.
   */
  showOhlcv?: boolean;

  /**
   * Candles vs smooth close line.
   */
  chartMode?: ChartMode;

  /**
   * Entry / liquidation / TP-SL /
   * resting-order chart lines.
   */
  showPositionLines?: boolean;

  /**
   * Real user trade / fill B/S markers.
   * Default true.
   */
  showTradeMarkers?: boolean;
};

function read(): ChartPrefs {
  try {
    const raw =
      localStorage.getItem(KEY);

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw) as ChartPrefs;

    return (
      parsed &&
      typeof parsed === 'object'
    )
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function write(
  prefs: ChartPrefs,
) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(prefs),
    );
  } catch {
    /* quota / private mode */
  }
}

const NARROW_MQ =
  '(max-width: 639px)';

function isNarrowViewport():
  boolean {
  return (
    typeof window !==
      'undefined' &&
    window
      .matchMedia(
        NARROW_MQ,
      )
      .matches
  );
}

function isInterval(v: unknown): v is CandleInterval {
  return typeof v === 'string' && (ALL_CANDLE_INTERVALS as readonly string[]).includes(v);
}

export function getSavedChartInterval():
  CandleInterval {
  const last =
    read().lastInterval;

  return isInterval(last)
    ? last
    : DEFAULT_INTERVAL;
}

export function saveChartInterval(
  interval: CandleInterval,
) {
  const prefs = read();

  if (
    prefs.lastInterval ===
    interval
  ) {
    return;
  }

  prefs.lastInterval =
    interval;

  write(prefs);
}

export function getVisibleChartIntervals():
  CandleInterval[] {
  const raw =
    read().visibleIntervals;

  if (
    !Array.isArray(raw) ||
    !raw.length
  ) {
    return [
      ...DEFAULT_VISIBLE_INTERVALS,
    ];
  }

  const next =
    raw.filter(isInterval);

  return next.length
    ? next
    : [
        ...DEFAULT_VISIBLE_INTERVALS,
      ];
}

/**
 * Persist toolbar set.
 * Always keeps at least one interval.
 */
export function saveVisibleChartIntervals(
  intervals: CandleInterval[],
) {
  const next =
    intervals.filter(
      isInterval,
    );

  const prefs = read();

  prefs.visibleIntervals =
    next.length
      ? next
      : [
          ...DEFAULT_VISIBLE_INTERVALS,
        ];

  write(prefs);
}

export function getSavedChartEngine():
  ChartEngine {
  return (
    read().engine === 'tv'
      ? 'tv'
      : 'kline'
  );
}

export function saveChartEngine(
  engine: ChartEngine,
) {
  const prefs = read();

  if (
    prefs.engine === engine
  ) {
    return;
  }

  prefs.engine = engine;

  write(prefs);
}

export function getLegendCollapsed(
  narrow =
    isNarrowViewport(),
): boolean {
  const saved =
    read().legendCollapsed;

  if (
    typeof saved ===
    'boolean'
  ) {
    return saved;
  }

  return narrow;
}

export function getSavedChartTimezone():
  string {
  const raw =
    read().timezone;

  if (
    typeof raw ===
      'string' &&
    raw.trim()
  ) {
    return raw.trim();
  }

  return '';
}

export function saveChartTimezone(
  timezone: string,
) {
  const prefs = read();

  if (
    prefs.timezone ===
    timezone
  ) {
    return;
  }

  prefs.timezone =
    timezone;

  write(prefs);
}

export function getShowHighLow():
  boolean {
  return (
    read().showHighLow !==
    false
  );
}

export function saveShowHighLow(
  on: boolean,
) {
  const prefs = read();

  if (
    prefs.showHighLow === on
  ) {
    return;
  }

  prefs.showHighLow = on;

  write(prefs);
}

export function getShowOhlcv(
  narrow =
    isNarrowViewport(),
): boolean {
  const saved =
    read().showOhlcv;

  if (
    typeof saved ===
    'boolean'
  ) {
    return saved;
  }

  return !narrow;
}

export function saveShowOhlcv(
  on: boolean,
) {
  const prefs = read();

  if (
    prefs.showOhlcv === on
  ) {
    return;
  }

  prefs.showOhlcv = on;

  write(prefs);
}

export function getShowPositionLines():
  boolean {
  return (
    read().showPositionLines !==
    false
  );
}

export function saveShowPositionLines(
  on: boolean,
) {
  const prefs = read();

  if (
    prefs.showPositionLines ===
    on
  ) {
    return;
  }

  prefs.showPositionLines =
    on;

  write(prefs);
}

export function getShowTradeMarkers():
  boolean {
  return (
    read().showTradeMarkers !==
    false
  );
}

export function saveShowTradeMarkers(
  on: boolean,
) {
  const prefs = read();

  if (
    prefs.showTradeMarkers ===
    on
  ) {
    return;
  }

  prefs.showTradeMarkers =
    on;

  write(prefs);
}

const VALID_CHART_MODES: readonly ChartMode[] = [
  'candle',
  'hollow',
  'hollowUp',
  'hollowDown',
  'bars',
  'line',
  'lineMarkers',
  'area',
];

export function getSavedChartMode(): ChartMode {
  const mode = read().chartMode;
  if (typeof mode === 'string' && (VALID_CHART_MODES as readonly string[]).includes(mode)) {
    return mode as ChartMode;
  }
  return 'candle';
}

export function saveChartMode(
  mode: ChartMode,
) {
  const prefs = read();

  if (
    prefs.chartMode === mode
  ) {
    return;
  }

  prefs.chartMode = mode;

  write(prefs);
}

export function saveLegendCollapsed(
  collapsed: boolean,
) {
  const prefs = read();

  if (
    prefs.legendCollapsed ===
    collapsed
  ) {
    return;
  }

  prefs.legendCollapsed =
    collapsed;

  write(prefs);
}

export function getIndicatorColors(
  name: string,
  count: number,
  fallback: string[],
): string[] {
  const saved =
    read()
      .indicatorColors?.[
        name
      ];

  const out: string[] = [];

  for (
    let i = 0;
    i < count;
    i++
  ) {
    out.push(
      saved?.[i] ||
      fallback[i] ||
      fallback[0] ||
      '#4ef2bb',
    );
  }

  return out;
}

export function saveIndicatorColors(
  name: string,
  colors: string[],
) {
  const prefs = read();

  prefs.indicatorColors = {
    ...(
      prefs.indicatorColors ??
      {}
    ),

    [name]:
      colors,
  };

  write(prefs);
}
