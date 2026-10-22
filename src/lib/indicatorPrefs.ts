/**
 * Chart indicator editor prefs — same row model as mobile (`frontend/src/lib/indicatorPrefs.ts`).
 * localStorage, not owner-scoped (web desk is one chart).
 */

export const MA_BAND_SLOT_COUNT = 6;
export const RSI_BAND_SLOT_COUNT = 3;

export type MaPriceSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'ohlc4';

export type IndicatorLineWidth = 1 | 2 | 3 | 4;

export type DirectionalFigureStyle = {
  upColor: string;
  downColor: string;
  noChangeColor: string;
  borderSize: 0 | 1 | 2 | 3 | 4;
};

export type MaBandRow = {
  enabled: boolean;
  period: number;
  source: MaPriceSource;
  color: string;
  lineWidth?: IndicatorLineWidth;
};

export type RsiBandRow = {
  enabled: boolean;
  period: number;
  source: MaPriceSource;
  color: string;
  lineWidth: IndicatorLineWidth;
};

export const MA_SOURCE_OPTIONS: { id: MaPriceSource; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'high', label: 'High' },
  { id: 'low', label: 'Low' },
  { id: 'close', label: 'Close' },
  { id: 'hl2', label: 'HL2' },
  { id: 'ohlc4', label: 'OHLC4' },
];

export const CHART_COLOR_PRESETS = [
  '#4ef2bb',
  '#ef4444',
  '#22d3ee',
  '#a855f7',
  '#ec4899',
  '#e5e7eb',
  '#f59e0b',
  '#22c55e',
  '#60a5fa',
  '#f97316',
  '#34d399',
  '#facc15',
  '#94a3b8',
  '#ffffff',
  '#16a34a',
  '#dc2626',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#9333ea',
  '#c026d3',
  '#db2777',
  '#be123c',
  '#ca8a04',
  '#65a30d',
  '#0f766e',
  '#111827',
];

const EMA_SLOT_PERIODS = [9, 21, 50, 100, 200, 400];
/** Available slots; show one standard Simple Moving Average (SMA 20) by default. */
const MA_SLOT_PERIODS = [20, 50, 200, 9, 100, 300];

const EMA_DEFAULT_COLORS = [
  '#FF9600',
  '#935EBD',
  '#1677FF',
  '#E11D74',
  '#01C5C4',
  '#76808F',
];
const MA_DEFAULT_COLORS = [
  '#FF9600',
  '#935EBD',
  '#1677FF',
  '#E11D74',
  '#01C5C4',
  '#76808F',
];

const RSI_SLOT_PERIODS = [14, 7, 21];
const RSI_DEFAULT_COLORS = ['#ec4899', '#a78bfa', '#facc15'];

export const DEFAULT_RSI_ROWS: RsiBandRow[] = RSI_SLOT_PERIODS.map((period, i) => ({
  enabled: true,
  period,
  source: 'close' as const,
  color: RSI_DEFAULT_COLORS[i] ?? '#38bdf8',
  lineWidth: 1 as const,
}));

export const DEFAULT_EMA_ROWS: MaBandRow[] = EMA_SLOT_PERIODS.map((period, i) => ({
  enabled: false,
  period,
  source: 'close',
  color: EMA_DEFAULT_COLORS[i] ?? '#eab308',
  lineWidth: 1,
}));

export const DEFAULT_MA_ROWS: MaBandRow[] = MA_SLOT_PERIODS.map((period, i) => ({
  enabled: i < 3,
  period,
  source: 'close',
  color: MA_DEFAULT_COLORS[i] ?? '#94a3b8',
  lineWidth: 1,
}));

export type AverageTab = 'ema' | 'ma';

export type SingleIndicatorSetting = {
  params?: number[];
  colors?: string[];
  lineWidths?: IndicatorLineWidth[];
  paneHeight?: number;
  barStyle?: DirectionalFigureStyle;
  circleStyle?: DirectionalFigureStyle;
};

export type IndicatorStyleKind =
  | 'line'
  | 'bar'
  | 'circle';

export type ExtraIndicatorSpec = {
  name: string;
  label: string;
  defaultParams: number[];
  overlay: boolean;
  defaultColors?: string[];
  paramLabels?: string[];
  colorLabels?: string[];
  styleKind?: IndicatorStyleKind;
};

export const EXTRA_INDICATOR_SPECS: ExtraIndicatorSpec[] = [
  {
    name: 'SMA',
    label: 'SMA',
    defaultParams: [20, 50],
    overlay: true,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period 1', 'Period 2'],
    colorLabels: ['SMA 1', 'SMA 2'],
  },
  {
    name: 'BBI',
    label: 'BBI',
    defaultParams: [3, 6, 12, 24],
    overlay: true,
    defaultColors: ['#FF9600', '#935EBD', '#1677FF', '#E11D74'],
    paramLabels: ['Period 1', 'Period 2', 'Period 3', 'Period 4'],
    colorLabels: ['BBI 1', 'BBI 2', 'BBI 3', 'BBI 4'],
  },
  {
    name: 'KDJ',
    label: 'KDJ',
    defaultParams: [9, 3, 3],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD', '#1677FF'],
    paramLabels: ['Period', 'K Period', 'D Period'],
    colorLabels: ['K Line', 'D Line', 'J Line'],
  },
  {
    name: 'BIAS',
    label: 'BIAS',
    defaultParams: [6, 12, 24],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD', '#1677FF'],
    paramLabels: ['Period 1', 'Period 2', 'Period 3'],
    colorLabels: ['BIAS 1', 'BIAS 2', 'BIAS 3'],
  },
  {
    name: 'BRAR',
    label: 'BRAR',
    defaultParams: [26],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period'],
    colorLabels: ['BR Line', 'AR Line'],
  },
  {
    name: 'DMI',
    label: 'DMI',
    defaultParams: [14, 6],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD', '#1677FF', '#E11D74'],
    paramLabels: ['Period', 'SMA Period'],
    colorLabels: ['+DI', '-DI', 'ADX', 'ADXR'],
  },
  {
    name: 'CR',
    label: 'CR',
    defaultParams: [26, 10, 20, 40, 60],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD', '#1677FF', '#E11D74', '#01C5C4'],
    paramLabels: ['Period', 'MA 1', 'MA 2', 'MA 3', 'MA 4'],
    colorLabels: ['CR Line', 'MA 1', 'MA 2', 'MA 3', 'MA 4'],
  },
  {
    name: 'PSY',
    label: 'PSY',
    defaultParams: [12, 6],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period', 'MA Period'],
    colorLabels: ['PSY Line', 'PSYMA Line'],
  },
  {
    name: 'DMA',
    label: 'DMA',
    defaultParams: [10, 50, 10],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Short Period', 'Long Period', 'MA Period'],
    colorLabels: ['DMA Line', 'AMA Line'],
  },
  {
    name: 'TRIX',
    label: 'TRIX',
    defaultParams: [12, 9],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period', 'Signal Period'],
    colorLabels: ['TRIX Line', 'MATRIX Line'],
  },
  {
    name: 'OBV',
    label: 'OBV',
    defaultParams: [30],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['MA Period'],
    colorLabels: ['OBV Line', 'MA Line'],
  },
  {
    name: 'VR',
    label: 'VR',
    defaultParams: [26, 6],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period', 'MA Period'],
    colorLabels: ['VR Line', 'MAVR Line'],
  },
  {
    name: 'WR',
    label: 'WR',
    defaultParams: [6, 10, 14],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD', '#1677FF'],
    paramLabels: ['Period 1', 'Period 2', 'Period 3'],
    colorLabels: ['WR 1', 'WR 2', 'WR 3'],
  },
  {
    name: 'MTM',
    label: 'MTM',
    defaultParams: [12, 6],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period', 'MA Period'],
    colorLabels: ['MTM Line', 'MAMTM Line'],
  },
  {
    name: 'SAR',
    label: 'SAR',
    defaultParams: [2, 2, 20],
    overlay: true,
    defaultColors: ['#FF9600'],
    paramLabels: ['Start (0.02 = 2)', 'Step (0.02 = 2)', 'Max (0.2 = 20)'],
    colorLabels: ['SAR Points'],
    styleKind: 'circle',
  },
  {
    name: 'AO',
    label: 'AO',
    defaultParams: [5, 34],
    overlay: false,
    defaultColors: ['#2DC08E', '#F92855'],
    paramLabels: ['Fast Period', 'Slow Period'],
    colorLabels: ['Up Color', 'Down Color'],
    styleKind: 'bar',
  },
  {
    name: 'ROC',
    label: 'ROC',
    defaultParams: [12, 6],
    overlay: false,
    defaultColors: ['#FF9600', '#935EBD'],
    paramLabels: ['Period', 'MA Period'],
    colorLabels: ['ROC Line', 'MAROC Line'],
  },
  {
    name: 'PVT',
    label: 'PVT',
    defaultParams: [],
    overlay: false,
    defaultColors: ['#FF9600'],
    paramLabels: [],
    colorLabels: ['PVT Line'],
  },
];

export type CustomIndicatorSpec = {
  id: string;
  internalName: string;
  label: string;
  alias?: string;
  defaultParams: number[];
  overlay: boolean;
  colors: string[];
  lookback: number;
  paramLabels?: string[];
  colorLabels?: string[];
  styleKind?: IndicatorStyleKind;
};

export const CUSTOM_INDICATOR_SPECS: CustomIndicatorSpec[] = [
  {
    id: 'ATR',
    internalName: 'AL_ATR',
    label: 'Average True Range (ATR)',
    alias: 'ATR Volatility',
    defaultParams: [14],
    overlay: false,
    lookback: 14,
    colors: ['#F59E0B'],
  },
  {
    id: 'AROON',
    internalName: 'AL_AROON',
    label: 'Aroon',
    alias: 'Aroon Up Down',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#2DC08E', '#F92855'],
  },
  {
    id: 'ALMA',
    internalName: 'AL_ALMA',
    label: 'Arnaud Legoux Moving Average',
    alias: 'ALMA',
    defaultParams: [9, 0.85, 6],
    overlay: true,
    lookback: 9,
    colors: ['#22D3EE'],
  },
  {
    id: 'BOLL_PERCENT_B',
    internalName: 'AL_BOLL_PERCENT_B',
    label: 'Bollinger Bands %B',
    alias: 'Bollinger %B',
    defaultParams: [20, 2],
    overlay: false,
    lookback: 20,
    colors: ['#60A5FA'],
  },
  {
    id: 'BOLL_WIDTH',
    internalName: 'AL_BOLL_WIDTH',
    label: 'Bollinger Bands Width',
    alias: 'Bollinger Bandwidth BBW',
    defaultParams: [20, 2],
    overlay: false,
    lookback: 20,
    colors: ['#A78BFA'],
  },
  {
    id: 'CMF',
    internalName: 'AL_CMF',
    label: 'Chaikin Money Flow',
    alias: 'CMF',
    defaultParams: [20],
    overlay: false,
    lookback: 20,
    colors: ['#22D3EE'],
  },
  {
    id: 'CHOP',
    internalName: 'AL_CHOP',
    label: 'Choppiness Index',
    alias: 'CHOP',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#FACC15'],
  },
  {
    id: 'DONCHIAN',
    internalName: 'AL_DONCHIAN',
    label: 'Donchian Channels',
    alias: 'Donchian Price Channel',
    defaultParams: [20],
    overlay: true,
    lookback: 20,
    colors: ['#60A5FA', '#94A3B8', '#60A5FA'],
  },
  {
    id: 'HMA',
    internalName: 'AL_HMA',
    label: 'Hull Moving Average (HMA)',
    alias: 'HMA',
    defaultParams: [9],
    overlay: true,
    lookback: 20,
    colors: ['#F59E0B'],
  },
  {
    id: 'KELTNER',
    internalName: 'AL_KELTNER',
    label: 'Keltner Channels',
    alias: 'Keltner',
    defaultParams: [20, 10, 2],
    overlay: true,
    lookback: 20,
    colors: ['#A78BFA', '#94A3B8', '#A78BFA'],
  },
  {
    id: 'MFI',
    internalName: 'AL_MFI',
    label: 'Money Flow Index',
    alias: 'MFI',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#EC4899'],
  },
  {
    id: 'STOCH',
    internalName: 'AL_STOCH',
    label: 'Stochastic Oscillator',
    alias: 'Stochastic Oscillator',
    defaultParams: [14, 3, 3],
    overlay: false,
    lookback: 20,
    colors: ['#22D3EE', '#F59E0B'],
  },
  {
    id: 'STOCH_RSI',
    internalName: 'AL_STOCH_RSI',
    label: 'Stochastic RSI',
    alias: 'Stoch RSI',
    defaultParams: [14, 14, 3, 3],
    overlay: false,
    lookback: 35,
    colors: ['#60A5FA', '#EC4899'],
  },
  {
    id: 'VORTEX',
    internalName: 'AL_VORTEX',
    label: 'Vortex Indicator',
    alias: 'Vortex VI',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#2DC08E', '#F92855'],
  },
  {
    id: 'VWMA',
    internalName: 'AL_VWMA',
    label: 'Volume Weighted Moving Average (VWMA)',
    alias: 'Volume Weighted Moving Average',
    defaultParams: [20],
    overlay: true,
    lookback: 20,
    colors: ['#2DC08E'],
  },
  {
    id: 'CMO',
    internalName: 'AL_CMO',
    label: 'Chande Momentum Oscillator',
    alias: 'CMO',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#22D3EE'],
  },
  {
    id: 'EFI',
    internalName: 'AL_EFI',
    label: "Elder's Force Index",
    alias: 'Force Index EFI',
    defaultParams: [13],
    overlay: false,
    lookback: 14,
    colors: ['#F59E0B'],
  },
  {
    id: 'CHAIKIN_OSC',
    internalName: 'AL_CHAIKIN_OSC',
    label: 'Chaikin Oscillator',
    alias: 'Chaikin ADL Oscillator',
    defaultParams: [3, 10],
    overlay: false,
    lookback: 20,
    colors: ['#2DC08E'],
  },
  {
    id: 'FISHER',
    internalName: 'AL_FISHER',
    label: 'Fisher Transform',
    alias: 'Fisher',
    defaultParams: [9],
    overlay: false,
    lookback: 10,
    colors: ['#22D3EE', '#F59E0B'],
  },
  {
    id: 'ULTIMATE_OSC',
    internalName: 'AL_ULTIMATE_OSC',
    label: 'Ultimate Oscillator',
    alias: 'Ultimate UO',
    defaultParams: [7, 14, 28],
    overlay: false,
    lookback: 29,
    colors: ['#A78BFA'],
  },
  {
    id: 'DEMA',
    internalName: 'AL_DEMA',
    label: 'Double EMA',
    alias: 'Double Exponential Moving Average Moving Average Double Double EMA',
    defaultParams: [20],
    overlay: true,
    lookback: 40,
    colors: ['#22D3EE'],
  },
  {
    id: 'TEMA',
    internalName: 'AL_TEMA',
    label: 'Triple EMA',
    alias: 'Triple Exponential Moving Average Moving Average Triple Triple EMA',
    defaultParams: [20],
    overlay: true,
    lookback: 60,
    colors: ['#EC4899'],
  },
  {
    id: 'WMA',
    internalName: 'AL_WMA',
    label: 'Moving Average Weighted',
    alias: 'Weighted Moving Average Moving Average Weighted WMA',
    defaultParams: [20],
    overlay: true,
    lookback: 20,
    colors: ['#FACC15'],
  },
  {
    id: 'ENVELOPES',
    internalName: 'AL_ENVELOPES',
    label: 'Envelopes',
    alias: 'Moving Average Envelopes',
    defaultParams: [20, 2.5],
    overlay: true,
    lookback: 20,
    colors: ['#60A5FA', '#94A3B8', '#60A5FA'],
  },
  {
    id: 'MASS_INDEX',
    internalName: 'AL_MASS_INDEX',
    label: 'Mass Index',
    alias: 'Mass Index Reversal',
    defaultParams: [9, 25],
    overlay: false,
    lookback: 50,
    colors: ['#F59E0B'],
  },
  {
    id: 'LINREG',
    internalName: 'AL_LINREG',
    label: 'Linear Regression Curve',
    alias: 'Linear Regression Least Squares Moving Average LSMA',
    defaultParams: [14],
    overlay: true,
    lookback: 14,
    colors: ['#A78BFA'],
  },
  {
    id: 'LINREG_SLOPE',
    internalName: 'AL_LINREG_SLOPE',
    label: 'Linear Regression Slope',
    alias: 'Regression Slope',
    defaultParams: [14],
    overlay: false,
    lookback: 14,
    colors: ['#22D3EE'],
  },
  {
    id: 'KLINGER',
    internalName: 'AL_KLINGER',
    label: 'Klinger Oscillator',
    alias: 'Klinger Volume Oscillator KVO',
    defaultParams: [34, 55, 13],
    overlay: false,
    lookback: 70,
    colors: ['#2DC08E', '#F59E0B'],
  },
  {
    id: 'KAMA',
    internalName: 'AL_KAMA',
    label: 'Moving Average Adaptive',
    alias: 'Kaufman Adaptive Moving Average Moving Average Adaptive KAMA',
    defaultParams: [10, 2, 30],
    overlay: true,
    lookback: 20,
    colors: ['#2DC08E'],
  },
  {
    id: 'STDDEV',
    internalName: 'AL_STDDEV',
    label: 'Standard Deviation',
    alias: 'StdDev Volatility',
    defaultParams: [20],
    overlay: false,
    lookback: 20,
    colors: ['#60A5FA'],
  },
  {
    id: 'ICHIMOKU',
    internalName: 'AL_ICHIMOKU',
    label: 'Ichimoku Cloud',
    alias: 'Ichimoku Kinko Hyo',
    defaultParams: [9, 26, 52, 26],
    overlay: true,
    lookback: 78,
    colors: ['#22D3EE', '#F92855', '#2DC08E', '#A78BFA', '#F59E0B'],
  },
  {
    id: 'CONNORS_RSI',
    internalName: 'AL_CONNORS_RSI',
    label: 'Connors RSI',
    alias: 'CRSI Connors',
    defaultParams: [3, 2, 100],
    overlay: false,
    lookback: 110,
    colors: ['#22D3EE'],
  },
  {
    id: 'CHANDE_KROLL',
    internalName: 'AL_CHANDE_KROLL',
    label: 'Chande Kroll Stop',
    alias: 'Chande Kroll',
    defaultParams: [10, 1, 9],
    overlay: true,
    lookback: 30,
    colors: ['#2DC08E', '#F92855'],
  },
  {
    id: 'HIST_VOL',
    internalName: 'AL_HIST_VOL',
    label: 'Historical Volatility',
    alias: 'Historical Volatility Volatility Close-to-Close Close to Close Volatility HV',
    defaultParams: [20, 365],
    overlay: false,
    lookback: 21,
    colors: ['#A78BFA'],
  },
  {
    id: 'WILLIAMS_ALLIGATOR',
    internalName: 'AL_WILLIAMS_ALLIGATOR',
    label: 'Williams Alligator',
    alias: 'Alligator Jaw Teeth Lips',
    defaultParams: [13, 8, 8, 5, 5, 3],
    overlay: true,
    lookback: 25,
    colors: ['#60A5FA', '#F92855', '#2DC08E'],
  },
  {
    id: 'BOP',
    internalName: 'AL_BOP',
    label: 'Balance of Power',
    alias: 'BOP',
    defaultParams: [],
    overlay: false,
    lookback: 1,
    colors: ['#22D3EE'],
  },
  {
    id: 'CHAIKIN_VOL',
    internalName: 'AL_CHAIKIN_VOL',
    label: 'Chaikin Volatility',
    alias: 'Chaikin Volatility CHV',
    defaultParams: [10, 10],
    overlay: false,
    lookback: 25,
    colors: ['#F59E0B'],
  },
  {
    id: 'COPPOCK',
    internalName: 'AL_COPPOCK',
    label: 'Coppock Curve',
    alias: 'Coppock',
    defaultParams: [14, 11, 10],
    overlay: false,
    lookback: 30,
    colors: ['#EC4899'],
  },
  {
    id: 'DPO',
    internalName: 'AL_DPO',
    label: 'Detrended Price Oscillator',
    alias: 'DPO',
    defaultParams: [20],
    overlay: false,
    lookback: 35,
    colors: ['#60A5FA'],
  },
  {
    id: 'EOM',
    internalName: 'AL_EOM',
    label: 'Ease Of Movement',
    alias: 'Ease of Movement EOM',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#2DC08E'],
  },
  {
    id: 'GMMA',
    internalName: 'AL_GMMA',
    label: 'Guppy Multiple Moving Average',
    alias: 'Guppy Multiple Moving Average Moving Average Multiple GMMA',
    defaultParams: [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60],
    overlay: true,
    lookback: 60,
    colors: [
      '#22D3EE',
      '#38BDF8',
      '#60A5FA',
      '#818CF8',
      '#A78BFA',
      '#C084FC',
      '#F59E0B',
      '#F97316',
      '#EF4444',
      '#F92855',
      '#EC4899',
      '#DB2777',
    ],
  },
  {
    id: 'MCGINLEY',
    internalName: 'AL_MCGINLEY',
    label: 'McGinley Dynamic',
    alias: 'McGinley',
    defaultParams: [14],
    overlay: true,
    lookback: 15,
    colors: ['#FACC15'],
  },
  {
    id: 'RVI',
    internalName: 'AL_RVI',
    label: 'Relative Vigor Index',
    alias: 'RVI',
    defaultParams: [10, 4],
    overlay: false,
    lookback: 20,
    colors: ['#22D3EE', '#F59E0B'],
  },
  {
    id: 'TSI',
    internalName: 'AL_TSI',
    label: 'True Strength Index',
    alias: 'True Strength Indicator True Strength Index TSI',
    defaultParams: [25, 13, 7],
    overlay: false,
    lookback: 55,
    colors: ['#2DC08E', '#F59E0B'],
  },
  {
    id: 'VOLUME_OSC',
    internalName: 'AL_VOLUME_OSC',
    label: 'Volume Oscillator',
    alias: 'Volume Osc',
    defaultParams: [5, 10],
    overlay: false,
    lookback: 10,
    colors: ['#A78BFA'],
  },
  {
    id: 'ADL',
    internalName: 'AL_ADL',
    label: 'Accumulation/Distribution Line (ADL)',
    alias: 'ADL Accumulation Distribution',
    defaultParams: [],
    overlay: false,
    lookback: 1,
    colors: ['#2DC08E'],
  },
  {
    id: 'BULL_BEAR_POWER',
    internalName: 'AL_BULL_BEAR_POWER',
    label: 'Bull Bear Power',
    alias: 'Elder Ray Bull Power Bear Power',
    defaultParams: [13],
    overlay: false,
    lookback: 13,
    colors: ['#2DC08E', '#F92855'],
  },
  {
    id: 'KST',
    internalName: 'AL_KST',
    label: 'Know Sure Thing',
    alias: 'KST',
    defaultParams: [10, 15, 20, 30, 10, 10, 10, 15, 9],
    overlay: false,
    lookback: 50,
    colors: ['#22D3EE', '#F59E0B'],
  },
  {
    id: 'MEDIAN_PRICE',
    internalName: 'AL_MEDIAN_PRICE',
    label: 'Median Price',
    alias: 'HL2 Median',
    defaultParams: [],
    overlay: true,
    lookback: 1,
    colors: ['#A78BFA'],
  },
  {
    id: 'NET_VOLUME',
    internalName: 'AL_NET_VOLUME',
    label: 'Net Volume',
    alias: 'Net Volume NV',
    defaultParams: [],
    overlay: false,
    lookback: 2,
    colors: ['#22D3EE'],
  },
  {
    id: 'NVI',
    internalName: 'AL_NVI',
    label: 'Negative Volume Index',
    alias: 'NVI',
    defaultParams: [1000],
    overlay: false,
    lookback: 2,
    colors: ['#F59E0B'],
  },
  {
    id: 'PVI',
    internalName: 'AL_PVI',
    label: 'Positive Volume Index',
    alias: 'PVI',
    defaultParams: [1000],
    overlay: false,
    lookback: 2,
    colors: ['#2DC08E'],
  },
  {
    id: 'PPO',
    internalName: 'AL_PPO',
    label: 'Price Oscillator',
    alias: 'Percentage Price Oscillator PPO',
    defaultParams: [12, 26, 9],
    overlay: false,
    lookback: 40,
    colors: ['#22D3EE', '#F59E0B', '#94A3B8'],
  },
  {
    id: 'RCI',
    internalName: 'AL_RCI',
    label: 'Rank Correlation Index',
    alias: 'RCI Spearman Rank',
    defaultParams: [14],
    overlay: false,
    lookback: 14,
    colors: ['#EC4899'],
  },
  {
    id: 'SMMA',
    internalName: 'AL_SMMA',
    label: 'Smoothed Moving Average',
    alias: 'SMMA RMA',
    defaultParams: [14],
    overlay: true,
    lookback: 14,
    colors: ['#60A5FA'],
  },
  {
    id: 'ZLEMA',
    internalName: 'AL_ZLEMA',
    label: 'Zero Lag EMA',
    alias: 'ZLEMA Zero Lag Exponential Moving Average',
    defaultParams: [20],
    overlay: true,
    lookback: 30,
    colors: ['#2DC08E'],
  },
  {
    id: 'HAMMING_MA',
    internalName: 'AL_HAMMING_MA',
    label: 'Moving Average Hamming',
    alias: 'Hamming Moving Average',
    defaultParams: [20],
    overlay: true,
    lookback: 20,
    colors: ['#A78BFA'],
  },
  {
    id: 'CHANDELIER_EXIT',
    internalName: 'AL_CHANDELIER_EXIT',
    label: 'Chandelier Exit',
    alias: 'Chandelier ATR Exit',
    defaultParams: [22, 3],
    overlay: true,
    lookback: 30,
    colors: ['#2DC08E', '#F92855'],
  },
  {
    id: 'SMI_ERGODIC',
    internalName: 'AL_SMI_ERGODIC',
    label: 'SMI Ergodic Indicator',
    alias: 'SMI Ergodic Oscillator SMI Ergodic Indicator',
    defaultParams: [5, 20, 5],
    overlay: false,
    lookback: 40,
    colors: ['#22D3EE', '#F59E0B'],
  },
  {
    id: 'VOLUME_ROC',
    internalName: 'AL_VOLUME_ROC',
    label: 'Volume Rate of Change',
    alias: 'Volume ROC VROC',
    defaultParams: [14],
    overlay: false,
    lookback: 15,
    colors: ['#A78BFA'],
  },
  {
    id: 'ACCELERATOR',
    internalName: 'AL_ACCELERATOR',
    label: 'Accelerator Oscillator',
    alias: 'AC Accelerator Decelerator Oscillator',
    defaultParams: [5, 34, 5],
    overlay: false,
    lookback: 45,
    colors: ['#22D3EE'],
  },
  {
    id: 'AVERAGE_PRICE',
    internalName: 'AL_AVERAGE_PRICE',
    label: 'Average Price',
    alias: 'OHLC4',
    defaultParams: [],
    overlay: true,
    lookback: 1,
    colors: ['#A78BFA'],
  },
  {
    id: 'TYPICAL_PRICE',
    internalName: 'AL_TYPICAL_PRICE',
    label: 'Typical Price',
    alias: 'HLC3',
    defaultParams: [],
    overlay: true,
    lookback: 1,
    colors: ['#22D3EE'],
  },
  {
    id: 'MA_CROSS',
    internalName: 'AL_MA_CROSS',
    label: 'MA Cross',
    alias: 'Moving Average Cross SMA Cross',
    defaultParams: [9, 21],
    overlay: true,
    lookback: 21,
    colors: ['#22D3EE', '#F59E0B'],
  },
  {
    id: 'EMA_CROSS',
    internalName: 'AL_EMA_CROSS',
    label: 'EMA Cross',
    alias: 'Exponential Moving Average Cross',
    defaultParams: [9, 21],
    overlay: true,
    lookback: 21,
    colors: ['#2DC08E', '#EC4899'],
  },
  {
    id: 'MA_EMA_CROSS',
    internalName: 'AL_MA_EMA_CROSS',
    label: 'MA with EMA Cross',
    alias: 'SMA EMA Cross',
    defaultParams: [20, 20],
    overlay: true,
    lookback: 20,
    colors: ['#60A5FA', '#F59E0B'],
  },
  {
    id: 'MAJORITY_RULE',
    internalName: 'AL_MAJORITY_RULE',
    label: 'Majority Rule',
    alias: 'Majority Bull Bear Rule',
    defaultParams: [14],
    overlay: false,
    lookback: 14,
    colors: ['#2DC08E'],
  },
  {
    id: 'RELATIVE_VOLATILITY',
    internalName: 'AL_RELATIVE_VOLATILITY',
    label: 'Relative Volatility Index (RVI)',
    alias: 'RVI Volatility Dorsey',
    defaultParams: [10, 14],
    overlay: false,
    lookback: 30,
    colors: ['#A78BFA'],
  },
  {
    id: 'STANDARD_ERROR',
    internalName: 'AL_STANDARD_ERROR',
    label: 'Standard Error',
    alias: 'Regression Standard Error',
    defaultParams: [20],
    overlay: false,
    lookback: 20,
    colors: ['#60A5FA'],
  },
  {
    id: 'STANDARD_ERROR_BANDS',
    internalName: 'AL_STANDARD_ERROR_BANDS',
    label: 'Standard Error Bands',
    alias: 'Regression Standard Error Bands',
    defaultParams: [20, 2],
    overlay: true,
    lookback: 20,
    colors: ['#60A5FA', '#94A3B8', '#60A5FA'],
  },
  {
    id: 'TREND_STRENGTH',
    internalName: 'AL_TREND_STRENGTH',
    label: 'Trend Strength Index',
    alias: 'Trend Strength Pearson Correlation TSI Trend',
    defaultParams: [14],
    overlay: false,
    lookback: 14,
    colors: ['#22D3EE'],
  },
  {
    id: 'MA_CHANNEL',
    internalName: 'AL_MA_CHANNEL',
    label: 'Moving Average Channel',
    alias: 'MA Channel High Low Moving Average',
    defaultParams: [20],
    overlay: true,
    lookback: 20,
    colors: ['#60A5FA', '#F59E0B'],
  },
  {
    id: 'VOL_ZERO_TREND_CTC',
    internalName: 'AL_VOL_ZERO_TREND_CTC',
    label: 'Volatility Zero Trend Close-to-Close',
    alias: 'Zero Trend Close to Close Volatility',
    defaultParams: [10, 252],
    overlay: false,
    lookback: 11,
    colors: ['#60A5FA'],
  },
  {
    id: 'VOL_OHLC',
    internalName: 'AL_VOL_OHLC',
    label: 'Volatility O-H-L-C',
    alias: 'OHLC Volatility Garman Klass',
    defaultParams: [10, 252],
    overlay: false,
    lookback: 10,
    colors: ['#F92855'],
  },
  {
    id: 'PIVOT_DAILY_TRADITIONAL',
    internalName: 'AL_PIVOT_DAILY_TRADITIONAL',
    label: 'Daily Pivot Points (Traditional, UTC)',
    alias: 'Pivot Points Standard Daily Traditional Support Resistance P R1 R2 R3 S1 S2 S3',
    defaultParams: [],
    overlay: true,
    lookback: 350,
    colors: ['#F59E0B', '#EF4444', '#F87171', '#FB7185', '#2DC08E', '#34D399', '#6EE7B7'],
    colorLabels: ['Pivot P', 'Resistance R1', 'Resistance R2', 'Resistance R3', 'Support S1', 'Support S2', 'Support S3'],
  },
  {
    id: 'WILLIAMS_FRACTAL',
    internalName: 'AL_WILLIAMS_FRACTAL',
    label: 'Williams Fractal',
    alias: 'Williams Fractals Bill Williams',
    defaultParams: [2],
    overlay: true,
    lookback: 5,
    colors: ['#22C55E', '#EF4444'],
    paramLabels: ['Periods (Left/Right)'],
    colorLabels: ['Up Fractal', 'Down Fractal'],
    styleKind: 'circle',
  },
];

export type WebIndicatorPrefs = {
  emaRows: MaBandRow[];
  maRows: MaBandRow[];
  emaVisible: boolean;
  maVisible: boolean;
  vwap: boolean;
  vwapVisible: boolean;
  vwapLength: number;
  vwapColor: string;
  vwapLineWidth: 1 | 2 | 3 | 4;
  boll: boolean;
  bollVisible: boolean;
  bollLength: number;
  bollMult: number;
  bollColors: [string, string, string];
  bollLineWidths?: [IndicatorLineWidth, IndicatorLineWidth, IndicatorLineWidth];
  vol: boolean;
  volMaPeriods?: [number, number, number];
  volMaColors?: [string, string, string];
  volMaLineWidths?: [IndicatorLineWidth, IndicatorLineWidth, IndicatorLineWidth];
  volBarStyle?: DirectionalFigureStyle;
  macd: boolean;
  macdParams: [number, number, number];
  macdColors?: [string, string];
  macdLineWidths?: [IndicatorLineWidth, IndicatorLineWidth];
  macdHistStyle?: DirectionalFigureStyle;
  rsi: boolean;
  rsiPeriod: number;
  rsiRows: RsiBandRow[];
  cci: boolean;
  cciColor: string;
  cciLineWidth: 1 | 2 | 3 | 4;
  supertrend: boolean;
  supertrendPeriod: number;
  supertrendMultiplier: number;
  supertrendColor: string;
  supertrendLineWidth: 1 | 2 | 3 | 4;
  extraIndicators: string[];
  customIndicators: string[];
  indicatorFavorites: string[];
  indicatorSettings?: Record<string, SingleIndicatorSetting>;
};

export const DEFAULT_BOLL_COLORS: [string, string, string] = ['#60a5fa', '#e5e7eb', '#f472b6'];

export const DEFAULT_INDICATOR_PREFS: WebIndicatorPrefs = {
  emaRows: DEFAULT_EMA_ROWS.map((r) => ({ ...r })),
  maRows: DEFAULT_MA_ROWS.map((r) => ({ ...r })),
  emaVisible: false,
  maVisible: true,
  vwap: false,
  vwapVisible: true,
  vwapLength: 14,
  vwapColor: '#3b82f6',
  vwapLineWidth: 2,
  boll: false,
  bollVisible: true,
  bollLength: 20,
  bollMult: 2,
  bollColors: DEFAULT_BOLL_COLORS,
  bollLineWidths: [1, 1, 1],
  vol: false,
  volMaPeriods: [5, 10, 20],
  volMaColors: ['#FF9600', '#935EBD', '#1677FF'],
  volMaLineWidths: [1, 1, 1],
  volBarStyle: {
    upColor: 'rgba(45, 192, 142, 0.7)',
    downColor: 'rgba(249, 40, 85, 0.7)',
    noChangeColor: '#888888',
    borderSize: 1,
  },
  macd: false,
  macdParams: [12, 26, 9],
  macdColors: ['#F59E0B', '#22D3EE'],
  macdLineWidths: [1, 1],
  macdHistStyle: {
    upColor: '#2DC08E',
    downColor: '#F92855',
    noChangeColor: '#888888',
    borderSize: 1,
  },
  rsi: false,
  rsiPeriod: 14,
  rsiRows: DEFAULT_RSI_ROWS.map((row) => ({ ...row })),
  cci: false,
  cciColor: '#22d3ee',
  cciLineWidth: 1,
  supertrend: false,
  supertrendPeriod: 10,
  supertrendMultiplier: 3,
  supertrendColor: '#fb7185',
  supertrendLineWidth: 1,
  extraIndicators: [],
  customIndicators: [],
  indicatorFavorites: [],
  indicatorSettings: {},
};

const KEY = 'builderpad:indicatorPrefs';
/** One-shot: volume pane used to default on; hide it unless the user turns it back on. */
const VOL_OFF_MIGRATION = 'builderpad:volOff.v1';
const INDICATOR_COLORS_MIGRATION = 'builderpad:indicatorColors.v1';
const SINGLE_EMA_DEFAULT_MIGRATION = 'builderpad:singleEma21Default.v1';
const SINGLE_SMA_DEFAULT_MIGRATION = 'builderpad:singleSma20Default.v1';

/** Keep the untouched chart free of a second indicator/subpane by default. */
function defaultVol(): boolean {
  return false;
}

function freshPrefs(): WebIndicatorPrefs {
  return {
    ...DEFAULT_INDICATOR_PREFS,
    emaRows: DEFAULT_EMA_ROWS.map((r) => ({ ...r })),
    maRows: DEFAULT_MA_ROWS.map((r) => ({ ...r })),
    bollColors: DEFAULT_BOLL_COLORS,
    macdParams: DEFAULT_INDICATOR_PREFS.macdParams,
    vol: defaultVol(),
  };
}
const SOURCE_SET = new Set<MaPriceSource>(MA_SOURCE_OPTIONS.map((o) => o.id));
const HEX6 = /^#([0-9a-fA-F]{6})$/;

function clampPeriod(n: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(999, Math.round(n)));
}

export function normalizeMaBandRow(partial: Partial<MaBandRow> | undefined, fallback: MaBandRow): MaBandRow {
  const src = partial?.source && SOURCE_SET.has(partial.source) ? partial.source : fallback.source;
  const color =
    typeof partial?.color === 'string' && HEX6.test(partial.color.trim()) ? partial.color.trim() : fallback.color;
  const lineWidth = ([1, 2, 3, 4] as const).includes(Number(partial?.lineWidth) as IndicatorLineWidth)
    ? (Number(partial?.lineWidth) as IndicatorLineWidth)
    : (fallback.lineWidth ?? 1);
  return {
    enabled: !!partial?.enabled,
    period: clampPeriod(Number(partial?.period), fallback.period),
    source: src,
    color,
    lineWidth,
  };
}

export function normalizeRsiBandRow(partial: Partial<RsiBandRow> | undefined, fallback: RsiBandRow): RsiBandRow {
  const src = partial?.source && SOURCE_SET.has(partial.source) ? partial.source : fallback.source;
  const color =
    typeof partial?.color === 'string' && HEX6.test(partial.color.trim()) ? partial.color.trim() : fallback.color;
  return {
    enabled: partial?.enabled !== undefined ? !!partial.enabled : fallback.enabled,
    period: clampPeriod(Number(partial?.period), fallback.period) || fallback.period,
    source: src,
    color,
    lineWidth: ([1, 2, 3, 4] as const).includes(Number(partial?.lineWidth) as 1 | 2 | 3 | 4)
      ? (Number(partial?.lineWidth) as 1 | 2 | 3 | 4)
      : fallback.lineWidth,
  };
}

function normalizeRows(raw: unknown, defaults: MaBandRow[]): MaBandRow[] {
  const arr = Array.isArray(raw) ? raw : [];
  return defaults.map((def, i) => normalizeMaBandRow(arr[i] as Partial<MaBandRow> | undefined, def));
}

function normalizeHexColor(
  value: unknown,
  fallback: string,
): string {
  return (
    typeof value === 'string' &&
    HEX6.test(value.trim())
  )
    ? value.trim()
    : fallback;
}

function normalizeDirectionalStyle(
  value: unknown,
  fallback: DirectionalFigureStyle,
): DirectionalFigureStyle {
  const raw =
    value &&
    typeof value === 'object'
      ? value as Partial<DirectionalFigureStyle>
      : {};

  const border =
    Number(raw.borderSize);

  return {
    upColor:
      normalizeHexColor(
        raw.upColor,
        fallback.upColor,
      ),

    downColor:
      normalizeHexColor(
        raw.downColor,
        fallback.downColor,
      ),

    noChangeColor:
      normalizeHexColor(
        raw.noChangeColor,
        fallback.noChangeColor,
      ),

    borderSize:
      ([0,1,2,3,4] as const).includes(
        border as 0|1|2|3|4
      )
        ? border as 0|1|2|3|4
        : fallback.borderSize,
  };
}

function normalizeLineWidths(
  value: unknown,
  count: number,
): IndicatorLineWidth[] {
  const raw =
    Array.isArray(value)
      ? value
      : [];

  return Array.from(
    { length: count },
    (_, index) => {
      const n =
        Number(raw[index]);

      return (
        [1,2,3,4] as const
      ).includes(
        n as IndicatorLineWidth
      )
        ? n as IndicatorLineWidth
        : 1;
    },
  );
}

function migrateVolumeOff(prefs: WebIndicatorPrefs, hadSaved: boolean): WebIndicatorPrefs {
  try {
    if (localStorage.getItem(VOL_OFF_MIGRATION) === '1') return prefs;
    localStorage.setItem(VOL_OFF_MIGRATION, '1');
    if (!hadSaved || !prefs.vol) return prefs;
    const next = { ...prefs, vol: false };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return hadSaved ? { ...prefs, vol: false } : prefs;
  }
}

function migrateLegacyIndicatorColors(prefs: WebIndicatorPrefs, hadSaved: boolean): WebIndicatorPrefs {
  try {
    if (localStorage.getItem(INDICATOR_COLORS_MIGRATION) === '1') return prefs;
    localStorage.setItem(INDICATOR_COLORS_MIGRATION, '1');
    if (!hadSaved || !prefs.maRows || prefs.maRows.length < 3) return prefs;
    const [r0, r1, r2] = prefs.maRows;
    const isLegacy =
      r0.period === 7 &&
      r1.period === 25 &&
      r2.period === 99 &&
      r0.color.toLowerCase() === '#ef4444' &&
      r1.color.toLowerCase() === '#22c55e' &&
      r2.color.toLowerCase() === '#facc15';
    if (!isLegacy) return prefs;
    const nextMaRows = [...prefs.maRows];
    nextMaRows[0] = { ...nextMaRows[0], color: '#FF9600' };
    nextMaRows[1] = { ...nextMaRows[1], color: '#935EBD' };
    nextMaRows[2] = { ...nextMaRows[2], color: '#1677FF' };
    const next = { ...prefs, maRows: nextMaRows };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return prefs;
  }
}

/** One-time migration of untouched old multi-line presets only.
 * Never erase intentionally customized indicator combinations.
 */
function migrateLegacyDefaultAverages(prefs: WebIndicatorPrefs, hadSaved: boolean): WebIndicatorPrefs {
  if (!hadSaved) return prefs;
  try {
    if (localStorage.getItem(SINGLE_EMA_DEFAULT_MIGRATION) === '1') return prefs;
    const oldEma = prefs.emaRows.length === EMA_SLOT_PERIODS.length &&
      prefs.emaRows.every((r, i) => r.period === EMA_SLOT_PERIODS[i] && r.source === 'close' && r.enabled === (i < 3));
    const oldMa = prefs.maRows.length === MA_SLOT_PERIODS.length &&
      prefs.maRows.every((r, i) => r.period === MA_SLOT_PERIODS[i] && r.source === 'close' && r.enabled === (i < 3));
    if (!oldEma || !oldMa || !prefs.emaVisible || !prefs.maVisible ||
        prefs.vwap || prefs.boll || prefs.macd || prefs.rsi || prefs.cci || prefs.supertrend ||
        prefs.extraIndicators.length > 0 || prefs.customIndicators.length > 0) {
      localStorage.setItem(SINGLE_EMA_DEFAULT_MIGRATION, '1');
      return prefs;
    }
    const next: WebIndicatorPrefs = {
      ...prefs,
      emaRows: prefs.emaRows.map((r, i) => ({ ...r, enabled: i === 1 })),
      maRows: prefs.maRows.map(r => ({ ...r, enabled: false })),
      maVisible: false,
      vol: false,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.setItem(SINGLE_EMA_DEFAULT_MIGRATION, '1');
    return next;
  } catch {
    return prefs;
  }
}

/** Migrate only a pristine EMA(21) or older three-EMA/three-MA default.
 * Keep explicitly customized indicator periods, colors, overlay combinations
 * and auxiliary panes untouched. This runs once per browser profile.
 */
function migratePristineEmaToSma(prefs: WebIndicatorPrefs, hadSaved: boolean): WebIndicatorPrefs {
  if (!hadSaved) return prefs;
  try {
    if (localStorage.getItem(SINGLE_SMA_DEFAULT_MIGRATION) === '1') return prefs;
    const matchesRows = (rows: MaBandRow[], periods: number[], colors: string[], enabled: (i:number)=>boolean) =>
      rows.length === periods.length && rows.every((r, i) =>
        r.enabled === enabled(i) && r.period === periods[i] &&
        r.source === 'close' && r.color.toLowerCase() === colors[i].toLowerCase() &&
        (r.lineWidth ?? 1) === 1);
    const oneEma = matchesRows(prefs.emaRows, EMA_SLOT_PERIODS, EMA_DEFAULT_COLORS, i => i === 1) &&
      matchesRows(prefs.maRows, MA_SLOT_PERIODS, MA_DEFAULT_COLORS, () => false) &&
      prefs.emaVisible && !prefs.maVisible;
    const legacyMulti = matchesRows(prefs.emaRows, EMA_SLOT_PERIODS, EMA_DEFAULT_COLORS, i => i < 3) &&
      matchesRows(prefs.maRows, MA_SLOT_PERIODS, MA_DEFAULT_COLORS, i => i < 3) &&
      prefs.emaVisible && prefs.maVisible;
    const hasOtherIndicator = prefs.vwap || prefs.boll || prefs.macd || prefs.rsi || prefs.cci ||
      prefs.supertrend || prefs.extraIndicators.length > 0 || prefs.customIndicators.length > 0;
    localStorage.setItem(SINGLE_SMA_DEFAULT_MIGRATION, '1');
    if ((!oneEma && !legacyMulti) || hasOtherIndicator) return prefs;
    const next: WebIndicatorPrefs = {
      ...prefs,
      emaRows: prefs.emaRows.map(r => ({...r, enabled: false})),
      maRows: prefs.maRows.map((r, i) => ({...r, enabled: i === 0})),
      emaVisible: false,
      maVisible: true,
      vol: false,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return prefs;
  }
}


/** Restore the established three-MA preset only for untouched single-SMA charts. */
const THREE_MA_RESTORE_KEY = 'builderpad:threeMaDefaultRestore.v1';
function restoreThreeMaPreset(prefs: WebIndicatorPrefs, hadSaved: boolean): WebIndicatorPrefs {
  if (!hadSaved) return prefs;
  try {
    if (localStorage.getItem(THREE_MA_RESTORE_KEY) === '1') return prefs;
    localStorage.setItem(THREE_MA_RESTORE_KEY, '1');
    const pristineSingle = prefs.maVisible && !prefs.emaVisible &&
      prefs.maRows.length === MA_SLOT_PERIODS.length &&
      prefs.maRows.every((r, i) => r.period === MA_SLOT_PERIODS[i] &&
        r.enabled === (i === 0) && r.source === 'close' &&
        r.color.toLowerCase() === MA_DEFAULT_COLORS[i].toLowerCase() &&
        (r.lineWidth ?? 1) === 1) &&
      !prefs.emaRows.some(r => r.enabled) &&
      !prefs.vwap && !prefs.boll && !prefs.macd && !prefs.rsi &&
      !prefs.cci && !prefs.supertrend &&
      prefs.extraIndicators.length === 0 && prefs.customIndicators.length === 0;
    if (!pristineSingle) return prefs;
    const next = { ...prefs, maRows: prefs.maRows.map((r, i) => ({ ...r, enabled: i < 3 })) };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch { return prefs; }
}

export function loadIndicatorPrefs(): WebIndicatorPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return migrateLegacyIndicatorColors(migrateVolumeOff(freshPrefs(), false), false);
    const parsed = JSON.parse(raw) as Partial<WebIndicatorPrefs>;
    const bollColors = Array.isArray(parsed.bollColors)
      ? ([0, 1, 2].map((i) =>
          typeof parsed.bollColors?.[i] === 'string' && HEX6.test(parsed.bollColors[i])
            ? parsed.bollColors[i]
            : DEFAULT_BOLL_COLORS[i],
        ) as [string, string, string])
      : DEFAULT_BOLL_COLORS;
    const macdParams = Array.isArray(parsed.macdParams)
      ? ([0, 1, 2].map((i) => clampPeriod(Number(parsed.macdParams?.[i]), DEFAULT_INDICATOR_PREFS.macdParams[i])) as [
          number,
          number,
          number,
        ])
      : DEFAULT_INDICATOR_PREFS.macdParams;

    let rsiRows: RsiBandRow[];
    if (Array.isArray(parsed.rsiRows)) {
      rsiRows = DEFAULT_RSI_ROWS.map((def, i) =>
        normalizeRsiBandRow((parsed.rsiRows as unknown[])?.[i] as Partial<RsiBandRow> | undefined, def)
      );
    } else if (Number.isFinite(Number(parsed.rsiPeriod)) && Number(parsed.rsiPeriod) > 0) {
      const oldPeriod = clampPeriod(Number(parsed.rsiPeriod), 14) || 14;
      rsiRows = [
        {
          enabled: true,
          period: oldPeriod,
          source: 'close' as const,
          color: '#ec4899',
          lineWidth: 1 as const,
        },
        {
          ...DEFAULT_RSI_ROWS[1],
          enabled: false,
        },
        {
          ...DEFAULT_RSI_ROWS[2],
          enabled: false,
        },
      ];
    } else {
      rsiRows = DEFAULT_RSI_ROWS.map((r) => ({ ...r }));
    }

    const validExtraNames = new Set(EXTRA_INDICATOR_SPECS.map((s) => s.name));
    const extraIndicators = Array.isArray(parsed.extraIndicators)
      ? Array.from(
          new Set(
            parsed.extraIndicators.filter(
              (x): x is string => typeof x === 'string' && validExtraNames.has(x),
            ),
          ),
        )
      : [];

    const validCustomIds = new Set(CUSTOM_INDICATOR_SPECS.map((s) => s.id));
    const customIndicators = Array.isArray(parsed.customIndicators)
      ? Array.from(
          new Set(
            parsed.customIndicators.filter(
              (x): x is string => typeof x === 'string' && validCustomIds.has(x),
            ),
          ),
        )
      : [];

    const validIndicatorIds = new Set([
      'MA',
      'EMA',
      'BOLL',
      'VWAP',
      'Supertrend',
      'VOL',
      'MACD',
      'RSI',
      'CCI',
      ...EXTRA_INDICATOR_SPECS.map((s) => s.name),
      ...CUSTOM_INDICATOR_SPECS.map((s) => s.id),
    ]);
    const indicatorFavorites = Array.isArray(parsed.indicatorFavorites)
      ? Array.from(
          new Set(
            parsed.indicatorFavorites.filter(
              (x): x is string => typeof x === 'string' && validIndicatorIds.has(x),
            ),
          ),
        )
      : [];

    const overlayIndicatorIds = new Set([
      'MA',
      'EMA',
      'BOLL',
      'VWAP',
      'Supertrend',
      ...EXTRA_INDICATOR_SPECS.filter((s) => s.overlay).map((s) => s.name),
      ...CUSTOM_INDICATOR_SPECS.filter((s) => s.overlay).map((s) => s.id),
    ]);

    const indicatorSettings: Record<string, SingleIndicatorSetting> = {};
    if (parsed.indicatorSettings && typeof parsed.indicatorSettings === 'object') {
      for (const [key, val] of Object.entries(parsed.indicatorSettings)) {
        if (!validIndicatorIds.has(key) || !val || typeof val !== 'object') continue;

        const extraSpec =
          EXTRA_INDICATOR_SPECS.find(
            (spec) =>
              spec.name === key
          );

        const customSpec =
          CUSTOM_INDICATOR_SPECS.find(
            (spec) =>
              spec.id === key
          );

        const specParams =
          customSpec?.defaultParams ??
          extraSpec?.defaultParams ??
          [];

        const specColors =
          customSpec?.colors ??
          extraSpec?.defaultColors ??
          [];

        const styleKind =
          customSpec?.styleKind ??
          extraSpec?.styleKind ??
          'line';

        const s =
          val as Partial<SingleIndicatorSetting>;

        const sanitized:
          SingleIndicatorSetting = {};

        if (specParams.length > 0) {
          const raw =
            Array.isArray(s.params)
              ? s.params
              : [];

          sanitized.params =
            specParams.map(
              (defaultValue, index) => {
                const n =
                  Number(raw[index]);

                return Number.isFinite(n)
                  ? n
                  : defaultValue;
              },
            );
        }

        if (
          styleKind === 'line' &&
          specColors.length > 0
        ) {
          const rawColors =
            Array.isArray(s.colors)
              ? s.colors
              : [];

          sanitized.colors =
            specColors.map(
              (defaultColor, index) =>
                normalizeHexColor(
                  rawColors[index],
                  defaultColor,
                ),
            );

          sanitized.lineWidths =
            normalizeLineWidths(
              s.lineWidths,
              specColors.length,
            );
        }

        if (
          styleKind === 'bar'
        ) {
          sanitized.barStyle =
            normalizeDirectionalStyle(
              s.barStyle,
              {
                upColor: '#2DC08E',
                downColor: '#F92855',
                noChangeColor: '#888888',
                borderSize: 1,
              },
            );
        }

        if (
          styleKind === 'circle'
        ) {
          const defaultCircle:
            DirectionalFigureStyle = {
              upColor:
                specColors[0] ??
                '#2DC08E',

              downColor:
                specColors[1] ??
                '#F92855',

              noChangeColor:
                '#888888',

              borderSize:
                1,
            };

          sanitized.circleStyle =
            normalizeDirectionalStyle(
              s.circleStyle,
              defaultCircle,
            );
        }

        if (
          !overlayIndicatorIds.has(key) &&
          Number.isFinite(
            Number(s.paneHeight)
          )
        ) {
          sanitized.paneHeight =
            Math.max(
              50,
              Math.min(
                500,
                Math.round(
                  Number(s.paneHeight),
                ),
              ),
            );
        }

        indicatorSettings[key] =
          sanitized;
      }
    }

    const bollLineWidths = Array.isArray(parsed.bollLineWidths)
      ? ([0, 1, 2].map((i) =>
          ([1, 2, 3, 4] as const).includes(Number(parsed.bollLineWidths?.[i]) as IndicatorLineWidth)
            ? (Number(parsed.bollLineWidths?.[i]) as IndicatorLineWidth)
            : 1,
        ) as [IndicatorLineWidth, IndicatorLineWidth, IndicatorLineWidth])
      : DEFAULT_INDICATOR_PREFS.bollLineWidths;

    const volMaPeriods = Array.isArray(parsed.volMaPeriods)
      ? ([0, 1, 2].map((i) => clampPeriod(Number(parsed.volMaPeriods?.[i]), DEFAULT_INDICATOR_PREFS.volMaPeriods![i])) as [
          number,
          number,
          number,
        ])
      : DEFAULT_INDICATOR_PREFS.volMaPeriods;

    const volMaColors = Array.isArray(parsed.volMaColors)
      ? ([0, 1, 2].map((i) =>
          typeof parsed.volMaColors?.[i] === 'string' && HEX6.test(parsed.volMaColors[i])
            ? parsed.volMaColors[i]
            : DEFAULT_INDICATOR_PREFS.volMaColors![i],
        ) as [string, string, string])
      : DEFAULT_INDICATOR_PREFS.volMaColors;

    const volMaLineWidths = Array.isArray(parsed.volMaLineWidths)
      ? ([0, 1, 2].map((i) =>
          ([1, 2, 3, 4] as const).includes(Number(parsed.volMaLineWidths?.[i]) as IndicatorLineWidth)
            ? (Number(parsed.volMaLineWidths?.[i]) as IndicatorLineWidth)
            : 1,
        ) as [IndicatorLineWidth, IndicatorLineWidth, IndicatorLineWidth])
      : DEFAULT_INDICATOR_PREFS.volMaLineWidths;

    const volBarStyle: DirectionalFigureStyle = parsed.volBarStyle && typeof parsed.volBarStyle === 'object'
      ? {
          upColor: typeof parsed.volBarStyle.upColor === 'string' ? parsed.volBarStyle.upColor : DEFAULT_INDICATOR_PREFS.volBarStyle!.upColor,
          downColor: typeof parsed.volBarStyle.downColor === 'string' ? parsed.volBarStyle.downColor : DEFAULT_INDICATOR_PREFS.volBarStyle!.downColor,
          noChangeColor: typeof parsed.volBarStyle.noChangeColor === 'string' ? parsed.volBarStyle.noChangeColor : DEFAULT_INDICATOR_PREFS.volBarStyle!.noChangeColor,
          borderSize: ([0, 1, 2, 3, 4] as const).includes(Number(parsed.volBarStyle.borderSize) as any)
            ? (Number(parsed.volBarStyle.borderSize) as 0 | 1 | 2 | 3 | 4)
            : 1,
        }
      : DEFAULT_INDICATOR_PREFS.volBarStyle!;

    const macdColors = Array.isArray(parsed.macdColors)
      ? ([0, 1].map((i) =>
          typeof parsed.macdColors?.[i] === 'string' && HEX6.test(parsed.macdColors[i])
            ? parsed.macdColors[i]
            : DEFAULT_INDICATOR_PREFS.macdColors![i],
        ) as [string, string])
      : DEFAULT_INDICATOR_PREFS.macdColors;

    const macdLineWidths = Array.isArray(parsed.macdLineWidths)
      ? ([0, 1].map((i) =>
          ([1, 2, 3, 4] as const).includes(Number(parsed.macdLineWidths?.[i]) as IndicatorLineWidth)
            ? (Number(parsed.macdLineWidths?.[i]) as IndicatorLineWidth)
            : 1,
        ) as [IndicatorLineWidth, IndicatorLineWidth])
      : DEFAULT_INDICATOR_PREFS.macdLineWidths;

    const macdHistStyle: DirectionalFigureStyle = parsed.macdHistStyle && typeof parsed.macdHistStyle === 'object'
      ? {
          upColor: typeof parsed.macdHistStyle.upColor === 'string' ? parsed.macdHistStyle.upColor : DEFAULT_INDICATOR_PREFS.macdHistStyle!.upColor,
          downColor: typeof parsed.macdHistStyle.downColor === 'string' ? parsed.macdHistStyle.downColor : DEFAULT_INDICATOR_PREFS.macdHistStyle!.downColor,
          noChangeColor: typeof parsed.macdHistStyle.noChangeColor === 'string' ? parsed.macdHistStyle.noChangeColor : DEFAULT_INDICATOR_PREFS.macdHistStyle!.noChangeColor,
          borderSize: ([0, 1, 2, 3, 4] as const).includes(Number(parsed.macdHistStyle.borderSize) as any)
            ? (Number(parsed.macdHistStyle.borderSize) as 0 | 1 | 2 | 3 | 4)
            : 1,
        }
      : DEFAULT_INDICATOR_PREFS.macdHistStyle!;

    const loaded: WebIndicatorPrefs = {
      emaRows: normalizeRows(parsed.emaRows, DEFAULT_EMA_ROWS),
      maRows: normalizeRows(parsed.maRows, DEFAULT_MA_ROWS),
      emaVisible: parsed.emaVisible !== false,
      maVisible: parsed.maVisible !== false,
      vwap: !!parsed.vwap,
      vwapVisible: parsed.vwapVisible !== false,
      vwapLength: clampPeriod(Number(parsed.vwapLength), 14) || 14,
      vwapColor:
        typeof parsed.vwapColor === 'string' && HEX6.test(parsed.vwapColor) ? parsed.vwapColor : DEFAULT_INDICATOR_PREFS.vwapColor,
      vwapLineWidth: ([1, 2, 3, 4] as const).includes(Number(parsed.vwapLineWidth) as 1 | 2 | 3 | 4)
        ? (Number(parsed.vwapLineWidth) as 1 | 2 | 3 | 4)
        : 2,
      boll: !!parsed.boll,
      bollVisible: parsed.bollVisible !== false,
      bollLength: clampPeriod(Number(parsed.bollLength), 20) || 20,
      bollMult: Number.isFinite(Number(parsed.bollMult)) ? Math.max(0.1, Math.min(50, Number(parsed.bollMult))) : 2,
      bollColors,
      bollLineWidths,
      vol: typeof parsed.vol === 'boolean' ? parsed.vol : defaultVol(),
      volMaPeriods,
      volMaColors,
      volMaLineWidths,
      volBarStyle,
      macd: !!parsed.macd,
      macdParams,
      macdColors,
      macdLineWidths,
      macdHistStyle,
      rsi: !!parsed.rsi,
      rsiPeriod: clampPeriod(Number(parsed.rsiPeriod), 14) || 14,
      rsiRows,
      cci: !!parsed.cci,
      cciColor:
        typeof parsed.cciColor === 'string' && HEX6.test(parsed.cciColor.trim())
          ? parsed.cciColor.trim()
          : '#22d3ee',
      cciLineWidth: ([1, 2, 3, 4] as const).includes(Number(parsed.cciLineWidth) as 1 | 2 | 3 | 4)
        ? (Number(parsed.cciLineWidth) as 1 | 2 | 3 | 4)
        : 1,
      supertrend: !!parsed.supertrend,
      supertrendPeriod: Number.isFinite(Number(parsed.supertrendPeriod))
        ? Math.max(1, Math.min(500, Math.round(Number(parsed.supertrendPeriod))))
        : 10,
      supertrendMultiplier: Number.isFinite(Number(parsed.supertrendMultiplier))
        ? Math.max(0.1, Math.min(50, Number(parsed.supertrendMultiplier)))
        : 3,
      supertrendColor:
        typeof parsed.supertrendColor === 'string' && HEX6.test(parsed.supertrendColor.trim())
          ? parsed.supertrendColor.trim()
          : '#fb7185',
      supertrendLineWidth: ([1, 2, 3, 4] as const).includes(Number(parsed.supertrendLineWidth) as 1 | 2 | 3 | 4)
        ? (Number(parsed.supertrendLineWidth) as 1 | 2 | 3 | 4)
        : 1,
      extraIndicators,
      customIndicators,
      indicatorFavorites,
      indicatorSettings,
    };
    const volMigrated = migrateVolumeOff(loaded, true);
    return restoreThreeMaPreset(migratePristineEmaToSma(
      migrateLegacyDefaultAverages(migrateLegacyIndicatorColors(volMigrated, true), true),
      true,
    ), true);
  } catch {
    return freshPrefs();
  }
}

export const INDICATOR_PREFS_EVENT = 'builderpad:indicator-prefs';

export function saveIndicatorPrefs(prefs: WebIndicatorPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event(INDICATOR_PREFS_EVENT));
  } catch {
    /* quota / private mode */
  }
}

/** Longest enabled MA/EMA/BOLL/VWAP/RSI/MACD period — sizes candle fetches. */
export function maxEnabledAveragePeriod(prefs: WebIndicatorPrefs): number {
  let m = 1;
  const scan = (rows: MaBandRow[]) => {
    for (const r of rows) {
      const period = Math.round(Number(r.period));
      if (r.enabled && Number.isFinite(period) && period > 0) m = Math.max(m, period);
    }
  };
  scan(prefs.maRows);
  scan(prefs.emaRows);
  if (prefs.boll) m = Math.max(m, Math.max(2, Math.round(Number(prefs.bollLength)) || 2));
  if (prefs.vwap) m = Math.max(m, Math.max(2, Math.round(Number(prefs.vwapLength)) || 2));
  if (prefs.rsi) {
    if (Array.isArray(prefs.rsiRows)) {
      for (const r of prefs.rsiRows) {
        const period = Math.round(Number(r.period));
        if (r.enabled && Number.isFinite(period) && period > 0) m = Math.max(m, period);
      }
    } else {
      m = Math.max(m, Math.max(2, Math.round(Number(prefs.rsiPeriod)) || 2));
    }
  }
  if (prefs.cci) m = Math.max(m, 20);
  if (prefs.supertrend) m = Math.max(m, Math.max(1, Math.round(Number(prefs.supertrendPeriod)) || 10));
  if (prefs.macd) {
    for (const n of prefs.macdParams) {
      const period = Math.round(Number(n));
      if (Number.isFinite(period) && period > 0) m = Math.max(m, period);
    }
  }
  if (Array.isArray(prefs.extraIndicators)) {
    for (const name of prefs.extraIndicators) {
      const spec = EXTRA_INDICATOR_SPECS.find((s) => s.name === name);
      const customParams = prefs.indicatorSettings?.[name]?.params;
      const paramsToScan = customParams && customParams.length ? customParams : spec?.defaultParams;
      if (Array.isArray(paramsToScan)) {
        for (const p of paramsToScan) {
          const period = Math.round(Number(p));
          if (Number.isFinite(period) && period > 0) m = Math.max(m, period);
        }
      }
    }
  }
  if (Array.isArray(prefs.customIndicators)) {
    for (const id of prefs.customIndicators) {
      const spec = CUSTOM_INDICATOR_SPECS.find((s) => s.id === id);
      const customParams = prefs.indicatorSettings?.[id]?.params;
      if (customParams && customParams.length) {
        for (const p of customParams) {
          const period = Math.round(Number(p));
          if (Number.isFinite(period) && period > 0) m = Math.max(m, period);
        }
      } else if (spec && Number.isFinite(spec.lookback) && spec.lookback > 0) {
        m = Math.max(m, spec.lookback);
      }
    }
  }
  return m;
}

export function enabledAverageRows(rows: MaBandRow[]): MaBandRow[] {
  return rows.filter((r) => r.enabled && r.period >= 2);
}

export function activeAverageRows(rows: MaBandRow[], visible: boolean): MaBandRow[] {
  if (!visible) return [];
  return enabledAverageRows(rows);
}

export function barSource(
  bar: { open: number; high: number; low: number; close: number },
  src: MaPriceSource,
): number {
  switch (src) {
    case 'open':
      return bar.open;
    case 'high':
      return bar.high;
    case 'low':
      return bar.low;
    case 'hl2':
      return (bar.high + bar.low) / 2;
    case 'ohlc4':
      return (bar.open + bar.high + bar.low + bar.close) / 4;
    default:
      return bar.close;
  }
}

export function smaSeries(values: number[], period: number): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 2) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function emaSeries(values: number[], period: number): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1 || !values.length) return out;
  const k = 2 / (period + 1);
  let ema = values[0];
  out[0] = period <= 1 ? ema : undefined;
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    if (i >= period - 1) out[i] = ema;
  }
  return out;
}
