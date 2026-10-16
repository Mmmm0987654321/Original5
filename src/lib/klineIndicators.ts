import { registerIndicator, type Chart, type KLineData } from 'klinecharts';
import {
  enabledAverageRows,
  barSource,
  emaSeries,
  smaSeries,
  RSI_BAND_SLOT_COUNT,
  EXTRA_INDICATOR_SPECS,
  CUSTOM_INDICATOR_SPECS,
  type MaPriceSource,
  type WebIndicatorPrefs,
} from './indicatorPrefs';
import type { ChartMode } from './chartPrefs';

export const MA_WEB = 'MA_WEB';
export const EMA_WEB = 'EMA_WEB';
export const VWAP_WEB = 'VWAP_WEB';
export const SUPERTREND_WEB = 'SUPERTREND_WEB';

type AvgExtend = { sources?: MaPriceSource[] };

function figuresFor(shortName: string, params: unknown[]) {
  return params.map((p, i) => ({
    key: `ma${i + 1}`,
    title: `${shortName}${p}: `,
    type: 'line' as const,
  }));
}

function calcAverage(kind: 'sma' | 'ema', dataList: KLineData[], indicator: { calcParams: unknown[]; extendData: unknown }) {
  const params = indicator.calcParams.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= 2);
  const sources = (indicator.extendData as AvgExtend | undefined)?.sources ?? [];
  const cache = new Map<string, number[]>();
  const series = params.map((period, i) => {
    const src = sources[i] ?? 'close';
    let prices = cache.get(src);
    if (!prices) {
      prices = dataList.map((b) => barSource(b, src));
      cache.set(src, prices);
    }
    return kind === 'ema' ? emaSeries(prices, period) : smaSeries(prices, period);
  });
  return dataList.map((_, i) => {
    const row: Record<string, number> = {};
    for (let idx = 0; idx < series.length; idx++) {
      const v = series[idx][i];
      if (v != null) row[`ma${idx + 1}`] = v;
    }
    return row;
  });
}

function computeATR(data: KLineData[], period: number) {
  const out: Array<{ time: number; value: number }> = [];
  let sum = 0;

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    sum += tr;

    if (i >= period) {
      const prevHigh = data[i - period].high;
      const prevLow = data[i - period].low;

      const prevPrevClose =
        data[i - period - 1]?.close ??
        prevClose;

      const prevTr = Math.max(
        prevHigh - prevLow,
        Math.abs(prevHigh - prevPrevClose),
        Math.abs(prevLow - prevPrevClose)
      );

      sum -= prevTr;
    }

    if (i >= period) {
      const t = data[i].timestamp ?? data[i].time ?? i;
      out.push({
        time: t,
        value: sum / period,
      });
    }
  }

  return out;
}

function calcSupertrend(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const multiplier = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 3;

  const atr = computeATR(dataList, period);
  const atrMap = new Map(atr.map((a) => [a.time, a.value]));

  let prevUpper: number | null = null;
  let prevLower: number | null = null;
  let prevTrend = 1;

  return dataList.map((candle, i) => {
    const t = candle.timestamp ?? candle.time ?? i;
    const a = atrMap.get(t);
    if (a === undefined || a === null) {
      return {};
    }

    const high = candle.high;
    const low = candle.low;
    const close = candle.close;
    const prevClose = i > 0 ? dataList[i - 1].close : close;

    const hl2 = (high + low) / 2;
    let upper = hl2 + multiplier * a;
    let lower = hl2 - multiplier * a;

    if (prevUpper !== null) {
      if (upper > prevUpper && prevClose <= prevUpper) {
        upper = prevUpper;
      }
    }

    if (prevLower !== null) {
      if (lower < prevLower && prevClose >= prevLower) {
        lower = prevLower;
      }
    }

    let trend = prevTrend;
    if (close > (prevUpper ?? upper)) {
      trend = 1;
    }
    if (close < (prevLower ?? lower)) {
      trend = -1;
    }

    const value = trend === 1 ? lower : upper;

    prevUpper = upper;
    prevLower = lower;
    prevTrend = trend;

    return { supertrend: value };
  });
}

function trueRangeSeries(dataList: KLineData[]): number[] {
  const tr: number[] = [];
  for (let i = 0; i < dataList.length; i++) {
    const high = dataList[i].high;
    const low = dataList[i].low;
    if (i === 0) {
      tr.push(high - low);
    } else {
      const prevClose = dataList[i - 1].close;
      tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
  }
  return tr;
}

function wilderAtrSeries(
  dataList: KLineData[],
  period: number,
): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(dataList.length);
  if (period < 1 || dataList.length < period) return out;
  const tr = trueRangeSeries(dataList);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  let atr = sum / period;
  out[period - 1] = atr;
  for (let i = period; i < dataList.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    out[i] = atr;
  }
  return out;
}

function wmaSeries(values: number[], period: number): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1 || values.length < period) return out;
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let num = 0;
    for (let j = 0; j < period; j++) {
      num += (j + 1) * values[i - period + 1 + j];
    }
    out[i] = num / denom;
  }
  return out;
}

function wmaNullableSeries(
  values: Array<number | undefined>,
  period: number,
): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1 || values.length < period) return out;
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let num = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const val = values[i - period + 1 + j];
      if (val == null) {
        valid = false;
        break;
      }
      num += (j + 1) * val;
    }
    if (valid) {
      out[i] = num / denom;
    }
  }
  return out;
}

function smaNullableSeries(
  values: Array<number | undefined>,
  period: number,
): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1 || values.length < period) return out;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const val = values[i - period + 1 + j];
      if (val == null) {
        valid = false;
        break;
      }
      sum += val;
    }
    if (valid) {
      out[i] = sum / period;
    }
  }
  return out;
}

function emaNullableSeries(
  values: Array<number | undefined>,
  period: number,
): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1) return out;
  const k = 2 / (period + 1);
  let ema: number | null = null;
  let validCount = 0;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === undefined || val === null) {
      ema = null;
      validCount = 0;
      continue;
    }
    if (ema === null) {
      ema = val;
      validCount = 1;
    } else {
      ema = val * k + ema * (1 - k);
      validCount += 1;
    }
    if (validCount >= period) {
      out[i] = ema;
    }
  }

  return out;
}

function wilderRsiSeries(values: number[], period: number): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (values.length <= period || period < 1) return out;
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let sumG = 0;
  let sumL = 0;
  for (let i = 1; i <= period; i++) {
    sumG += gains[i];
    sumL += losses[i];
  }
  let avgG = sumG / period;
  let avgL = sumL / period;

  const computeRsi = (g: number, l: number) => {
    if (g === 0 && l === 0) return 50;
    if (l === 0) return 100;
    if (g === 0) return 0;
    const rs = g / l;
    return 100 - 100 / (1 + rs);
  };

  out[period] = computeRsi(avgG, avgL);
  for (let i = period + 1; i < values.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
    out[i] = computeRsi(avgG, avgL);
  }
  return out;
}

function calcAlma(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const window = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 9);
  const offset = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 0.85;
  const sigma = Number.isFinite(Number(indicator.calcParams[2])) ? Number(indicator.calcParams[2]) : 6;
  const m = offset * (window - 1);
  const s = window / (sigma || 6);
  const weights: number[] = [];
  let sumW = 0;
  for (let i = 0; i < window; i++) {
    const w = Math.exp(-Math.pow(i - m, 2) / (2 * s * s));
    weights.push(w);
    sumW += w;
  }

  return dataList.map((_, i) => {
    if (i < window - 1) return {};
    let weightedSum = 0;
    for (let k = 0; k < window; k++) {
      weightedSum += dataList[i - window + 1 + k].close * weights[k];
    }
    return { alma: sumW > 0 ? weightedSum / sumW : dataList[i].close };
  });
}

function calcAroon(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  return dataList.map((_, i) => {
    if (i < period) return {};
    let highIdx = i - period;
    let lowIdx = i - period;
    let maxH = dataList[highIdx].high;
    let minL = dataList[lowIdx].low;
    for (let j = i - period; j <= i; j++) {
      if (dataList[j].high >= maxH) {
        maxH = dataList[j].high;
        highIdx = j;
      }
      if (dataList[j].low <= minL) {
        minL = dataList[j].low;
        lowIdx = j;
      }
    }
    const daysSinceHigh = i - highIdx;
    const daysSinceLow = i - lowIdx;
    const up = ((period - daysSinceHigh) / period) * 100;
    const down = ((period - daysSinceLow) / period) * 100;
    return { up, down };
  });
}

function calcBollPercentB(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 20);
  const mult = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 2;
  return dataList.map((candle, i) => {
    if (i < period - 1) return {};
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += dataList[j].close;
    const sma = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += Math.pow(dataList[j].close - sma, 2);
    const stdDev = Math.sqrt(sumSq / period);
    const upper = sma + mult * stdDev;
    const lower = sma - mult * stdDev;
    const diff = upper - lower;
    const percentB = diff !== 0 ? (candle.close - lower) / diff : 0;
    return { percentB };
  });
}

function calcBollWidth(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 20);
  const mult = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 2;
  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += dataList[j].close;
    const sma = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += Math.pow(dataList[j].close - sma, 2);
    const stdDev = Math.sqrt(sumSq / period);
    const upper = sma + mult * stdDev;
    const lower = sma - mult * stdDev;
    const width = sma !== 0 ? ((upper - lower) / sma) * 100 : 0;
    return { width };
  });
}

function calcCmf(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 20);
  const mfvList = dataList.map((b) => {
    const hl = b.high - b.low;
    const mfm = hl > 0 ? ((b.close - b.low) - (b.high - b.close)) / hl : 0;
    return mfm * (b.volume ?? 0);
  });
  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let sumMfv = 0;
    let sumVol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumMfv += mfvList[j];
      sumVol += dataList[j].volume ?? 0;
    }
    return { cmf: sumVol > 0 ? sumMfv / sumVol : 0 };
  });
}

function calcChop(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 14);
  const trList = dataList.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prevC = dataList[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prevC), Math.abs(b.low - prevC));
  });
  const logPeriod = Math.log10(period);
  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let sumTr = 0;
    let maxH = dataList[i - period + 1].high;
    let minL = dataList[i - period + 1].low;
    for (let j = i - period + 1; j <= i; j++) {
      sumTr += trList[j];
      if (dataList[j].high > maxH) maxH = dataList[j].high;
      if (dataList[j].low < minL) minL = dataList[j].low;
    }
    const range = maxH - minL;
    const chop = range > 0 && sumTr > 0 ? 100 * (Math.log10(sumTr / range) / logPeriod) : 50;
    return { chop };
  });
}

function calcDonchian(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let upper = dataList[i - period + 1].high;
    let lower = dataList[i - period + 1].low;
    for (let j = i - period + 1; j <= i; j++) {
      if (dataList[j].high > upper) upper = dataList[j].high;
      if (dataList[j].low < lower) lower = dataList[j].low;
    }
    const middle = (upper + lower) / 2;
    return { upper, middle, lower };
  });
}

function calcHma(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 9);
  const closes = dataList.map((d) => d.close);
  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)));

  const wmaHalf = wmaSeries(closes, halfPeriod);
  const wmaFull = wmaSeries(closes, period);

  const diffSeries: Array<number | undefined> = new Array(closes.length);
  for (let i = 0; i < closes.length; i++) {
    const h = wmaHalf[i];
    const f = wmaFull[i];
    if (h != null && f != null) {
      diffSeries[i] = 2 * h - f;
    } else {
      diffSeries[i] = undefined;
    }
  }

  const hma = wmaNullableSeries(diffSeries, sqrtPeriod);
  return dataList.map((_, i) => {
    const v = hma[i];
    return v != null ? { hma: v } : {};
  });
}

function calcKeltner(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const emaPeriod = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const atrPeriod = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 10);
  const mult = Number.isFinite(Number(indicator.calcParams[2])) ? Number(indicator.calcParams[2]) : 2;

  const closes = dataList.map((d) => d.close);
  const ema = emaSeries(closes, emaPeriod);
  const atr = wilderAtrSeries(dataList, atrPeriod);

  return dataList.map((_, i) => {
    const mid = ema[i];
    const a = atr[i];
    if (mid == null || a == null) return {};
    return {
      upper: mid + mult * a,
      middle: mid,
      lower: mid - mult * a,
    };
  });
}

function calcMfi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const tpList = dataList.map((d) => (d.high + d.low + d.close) / 3);

  return dataList.map((_, i) => {
    if (i < period) return {};
    let posMf = 0;
    let negMf = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const rawMf = tpList[j] * (dataList[j].volume ?? 0);
      if (tpList[j] > tpList[j - 1]) posMf += rawMf;
      else if (tpList[j] < tpList[j - 1]) negMf += rawMf;
    }
    const totalMf = posMf + negMf;
    const mfi = totalMf > 0 ? (100 * posMf) / totalMf : 50;
    return { mfi };
  });
}

function calcStoch(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const kPeriod = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const kSmooth = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 3);
  const dSmooth = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 3);

  const rawK: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    if (i < kPeriod - 1) {
      rawK[i] = undefined;
      continue;
    }
    let minL = dataList[i - kPeriod + 1].low;
    let maxH = dataList[i - kPeriod + 1].high;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (dataList[j].low < minL) minL = dataList[j].low;
      if (dataList[j].high > maxH) maxH = dataList[j].high;
    }
    const range = maxH - minL;
    rawK[i] = range > 0 ? ((dataList[i].close - minL) / range) * 100 : 50;
  }

  const smoothK = smaNullableSeries(rawK, kSmooth);
  const smoothD = smaNullableSeries(smoothK, dSmooth);

  return dataList.map((_, i) => {
    const k = smoothK[i];
    const d = smoothD[i];
    const res: Record<string, number> = {};
    if (k != null) res.k = k;
    if (d != null) res.d = d;
    return res;
  });
}

function calcStochRsi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const rsiPeriod = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const stochPeriod = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 14);
  const kSmooth = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 3);
  const dSmooth = Math.max(1, Math.round(Number(indicator.calcParams[3])) || 3);

  const rsiList: Array<number | undefined> = new Array(dataList.length);
  if (dataList.length > rsiPeriod) {
    let sumGain = 0;
    let sumLoss = 0;
    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = dataList[i].close - dataList[i - 1].close;
      if (diff > 0) sumGain += diff;
      else if (diff < 0) sumLoss += -diff;
    }
    let avgGain = sumGain / rsiPeriod;
    let avgLoss = sumLoss / rsiPeriod;

    const computeRsiVal = (g: number, l: number): number => {
      if (g === 0 && l === 0) return 50;
      if (l === 0) return 100;
      if (g === 0) return 0;
      const rs = g / l;
      return 100 - 100 / (1 + rs);
    };

    rsiList[rsiPeriod] = computeRsiVal(avgGain, avgLoss);

    for (let i = rsiPeriod + 1; i < dataList.length; i++) {
      const diff = dataList[i].close - dataList[i - 1].close;
      const currentGain = diff > 0 ? diff : 0;
      const currentLoss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (rsiPeriod - 1) + currentGain) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + currentLoss) / rsiPeriod;
      rsiList[i] = computeRsiVal(avgGain, avgLoss);
    }
  }

  const rawStochRsi: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    if (i < rsiPeriod + stochPeriod - 1) {
      rawStochRsi[i] = undefined;
      continue;
    }
    let minR: number | undefined = undefined;
    let maxR: number | undefined = undefined;
    let valid = true;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const val = rsiList[j];
      if (val == null) {
        valid = false;
        break;
      }
      if (minR === undefined || val < minR) minR = val;
      if (maxR === undefined || val > maxR) maxR = val;
    }
    if (!valid || minR === undefined || maxR === undefined || rsiList[i] == null) {
      rawStochRsi[i] = undefined;
      continue;
    }
    const range = maxR - minR;
    rawStochRsi[i] = range > 0 ? (100 * (rsiList[i]! - minR)) / range : 50;
  }

  const smoothK = smaNullableSeries(rawStochRsi, kSmooth);
  const smoothD = smaNullableSeries(smoothK, dSmooth);

  return dataList.map((_, i) => {
    const k = smoothK[i];
    const d = smoothD[i];
    const res: Record<string, number> = {};
    if (k != null) res.k = k;
    if (d != null) res.d = d;
    return res;
  });
}

function calcVortex(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const vmPlus: number[] = [0];
  const vmMinus: number[] = [0];
  const trList: number[] = [dataList[0]?.high - dataList[0]?.low || 0];

  for (let i = 1; i < dataList.length; i++) {
    vmPlus.push(Math.abs(dataList[i].high - dataList[i - 1].low));
    vmMinus.push(Math.abs(dataList[i].low - dataList[i - 1].high));
    const prevC = dataList[i - 1].close;
    trList.push(Math.max(dataList[i].high - dataList[i].low, Math.abs(dataList[i].high - prevC), Math.abs(dataList[i].low - prevC)));
  }

  return dataList.map((_, i) => {
    if (i < period) return {};
    let sumVp = 0;
    let sumVm = 0;
    let sumTr = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumVp += vmPlus[j];
      sumVm += vmMinus[j];
      sumTr += trList[j];
    }
    if (sumTr <= 0) return {};
    return {
      vip: sumVp / sumTr,
      vim: sumVm / sumTr,
    };
  });
}

function calcVwma(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  return dataList.map((candle, i) => {
    if (i < period - 1) return {};
    let sumPv = 0;
    let sumVol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = dataList[j].volume ?? 0;
      sumPv += dataList[j].close * v;
      sumVol += v;
    }
    if (sumVol <= 0) return {};
    return { vwma: sumPv / sumVol };
  });
}

function calcCmo(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < dataList.length; i++) {
    const d = dataList[i].close - dataList[i - 1].close;
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }

  return dataList.map((_, i) => {
    if (i < period) return {};
    let sumGain = 0;
    let sumLoss = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumGain += gains[j];
      sumLoss += losses[j];
    }
    const denom = sumGain + sumLoss;
    const cmo = denom === 0 ? 0 : (100 * (sumGain - sumLoss)) / denom;
    return { cmo };
  });
}

function calcEfi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 13);
  const rawForce: Array<number | undefined> = new Array(dataList.length);
  rawForce[0] = undefined;
  for (let i = 1; i < dataList.length; i++) {
    const volume = dataList[i].volume;
    if (!Number.isFinite(volume)) {
      rawForce[i] = undefined;
    } else {
      rawForce[i] = (dataList[i].close - dataList[i - 1].close) * (volume as number);
    }
  }
  const efiEma = emaNullableSeries(rawForce, period);
  return dataList.map((_, i) => {
    const v = efiEma[i];
    return v != null ? { efi: v } : {};
  });
}

function calcChaikinOsc(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastPeriod = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 3);
  const slowPeriod = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 10);

  const adl: Array<number | undefined> = new Array(dataList.length);
  let cumAdl = 0;
  for (let i = 0; i < dataList.length; i++) {
    const b = dataList[i];
    const volume = b.volume;
    if (!Number.isFinite(volume)) {
      adl[i] = undefined;
      continue;
    }
    const range = b.high - b.low;
    const mfm = range === 0 ? 0 : ((b.close - b.low) - (b.high - b.close)) / range;
    const mfv = mfm * (volume as number);
    cumAdl += mfv;
    adl[i] = cumAdl;
  }

  const fastEma = emaNullableSeries(adl, fastPeriod);
  const slowEma = emaNullableSeries(adl, slowPeriod);

  return dataList.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f == null || s == null) return {};
    return { chaikin: f - s };
  });
}

function calcFisher(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 9);
  const medians = dataList.map((d) => (d.high + d.low) / 2);

  const out: Array<{ fisher?: number; trigger?: number }> = new Array(dataList.length);
  let prevValue = 0;
  let prevFish = 0;

  for (let i = 0; i < dataList.length; i++) {
    if (i < period - 1) {
      out[i] = {};
      continue;
    }
    let minL = medians[i - period + 1];
    let maxH = medians[i - period + 1];
    for (let j = i - period + 1; j <= i; j++) {
      if (medians[j] < minL) minL = medians[j];
      if (medians[j] > maxH) maxH = medians[j];
    }
    const range = maxH - minL;
    const normalized = range === 0 ? 0 : 2 * ((medians[i] - minL) / range - 0.5);
    const rawVal = 0.33 * normalized + 0.67 * prevValue;
    const clampedVal = Math.max(-0.999, Math.min(0.999, rawVal));
    const fish = 0.5 * Math.log((1 + clampedVal) / (1 - clampedVal)) + 0.5 * prevFish;
    const trigger = prevFish;

    prevValue = clampedVal;
    prevFish = fish;

    out[i] = { fisher: fish, trigger };
  }

  return out;
}

function calcUltimateOsc(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const p1 = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 7);
  const p2 = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 14);
  const p3 = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 28);
  const maxP = Math.max(p1, p2, p3);

  const bp: number[] = [0];
  const tr: number[] = [0];
  for (let i = 1; i < dataList.length; i++) {
    const prevC = dataList[i - 1].close;
    const minL = Math.min(dataList[i].low, prevC);
    const maxH = Math.max(dataList[i].high, prevC);
    bp.push(dataList[i].close - minL);
    tr.push(maxH - minL);
  }

  return dataList.map((_, i) => {
    if (i < maxP) return {};
    let sumBp1 = 0;
    let sumTr1 = 0;
    for (let j = i - p1 + 1; j <= i; j++) {
      sumBp1 += bp[j];
      sumTr1 += tr[j];
    }
    let sumBp2 = 0;
    let sumTr2 = 0;
    for (let j = i - p2 + 1; j <= i; j++) {
      sumBp2 += bp[j];
      sumTr2 += tr[j];
    }
    let sumBp3 = 0;
    let sumTr3 = 0;
    for (let j = i - p3 + 1; j <= i; j++) {
      sumBp3 += bp[j];
      sumTr3 += tr[j];
    }

    if (sumTr1 <= 0 || sumTr2 <= 0 || sumTr3 <= 0) return {};
    const avg1 = sumBp1 / sumTr1;
    const avg2 = sumBp2 / sumTr2;
    const avg3 = sumBp3 / sumTr3;
    const ultimate = (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;
    return { ultimate };
  });
}

function calcDema(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const closes = dataList.map((d) => d.close);
  const ema1 = emaSeries(closes, period);
  const ema2 = emaNullableSeries(ema1, period);

  return dataList.map((_, i) => {
    const e1 = ema1[i];
    const e2 = ema2[i];
    if (e1 == null || e2 == null) return {};
    return { dema: 2 * e1 - e2 };
  });
}

function calcTema(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const closes = dataList.map((d) => d.close);
  const ema1 = emaSeries(closes, period);
  const ema2 = emaNullableSeries(ema1, period);
  const ema3 = emaNullableSeries(ema2, period);

  return dataList.map((_, i) => {
    const e1 = ema1[i];
    const e2 = ema2[i];
    const e3 = ema3[i];
    if (e1 == null || e2 == null || e3 == null) return {};
    return { tema: 3 * e1 - 3 * e2 + e3 };
  });
}

function calcWma(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const closes = dataList.map((d) => d.close);
  const wma = wmaSeries(closes, period);
  return dataList.map((_, i) => {
    const v = wma[i];
    return v != null ? { wma: v } : {};
  });
}

function calcEnvelopes(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const percent = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 2.5;
  const closes = dataList.map((d) => d.close);
  const sma = smaSeries(closes, period);

  return dataList.map((_, i) => {
    const mid = sma[i];
    if (mid == null) return {};
    const factor = percent / 100;
    return {
      upper: mid * (1 + factor),
      middle: mid,
      lower: mid * (1 - factor),
    };
  });
}

function calcMassIndex(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const emaPeriod = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 9);
  const sumPeriod = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 25);

  const ranges = dataList.map((d) => d.high - d.low);
  const ema1 = emaSeries(ranges, emaPeriod);
  const ema2 = emaNullableSeries(ema1, emaPeriod);

  const ratios: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const e1 = ema1[i];
    const e2 = ema2[i];
    if (e1 != null && e2 != null && e2 !== 0) {
      ratios[i] = e1 / e2;
    } else {
      ratios[i] = undefined;
    }
  }

  return dataList.map((_, i) => {
    if (i < emaPeriod + emaPeriod + sumPeriod - 3) return {};
    let sum = 0;
    for (let j = i - sumPeriod + 1; j <= i; j++) {
      const r = ratios[j];
      if (r == null) return {};
      sum += r;
    }
    return { mass: sum };
  });
}

function calcLinregHelper(dataList: KLineData[], period: number, returnSlope: boolean) {
  const n = Math.max(2, period);
  const sumX = (n * (n - 1)) / 2;
  const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;
  const denom = n * sumXX - sumX * sumX;

  return dataList.map((_, i) => {
    if (i < n - 1 || denom === 0) return {};
    let sumY = 0;
    let sumXY = 0;
    for (let j = 0; j < n; j++) {
      const y = dataList[i - n + 1 + j].close;
      sumY += y;
      sumXY += j * y;
    }
    const slope = (n * sumXY - sumX * sumY) / denom;
    if (returnSlope) {
      return { slope };
    }
    const intercept = (sumY - slope * sumX) / n;
    const linreg = intercept + slope * (n - 1);
    return { linreg };
  });
}

function calcLinreg(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 14);
  return calcLinregHelper(dataList, period, false);
}

function calcLinregSlope(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 14);
  return calcLinregHelper(dataList, period, true);
}

function calcKlinger(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastPeriod = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 34);
  const slowPeriod = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 55);
  const signalPeriod = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 13);

  const hlc = dataList.map((d) => d.high + d.low + d.close);
  const volumeForce: Array<number | undefined> = new Array(dataList.length);
  volumeForce[0] = undefined;

  let prevTrend = 1;
  let prevCm = 0;
  let prevDm = 0;

  for (let i = 1; i < dataList.length; i++) {
    let trend = prevTrend;
    if (hlc[i] > hlc[i - 1]) trend = 1;
    else if (hlc[i] < hlc[i - 1]) trend = -1;

    const dm = dataList[i].high - dataList[i].low;
    let cm = 0;
    if (trend === prevTrend) {
      cm = prevCm + dm;
    } else {
      cm = prevDm + dm;
    }

    const volume = dataList[i].volume;
    if (!Number.isFinite(volume)) {
      volumeForce[i] = undefined;
    } else if (cm <= 0) {
      volumeForce[i] = 0;
    } else {
      volumeForce[i] = (volume as number) * Math.abs(2 * (dm / cm - 1)) * trend * 100;
    }

    prevTrend = trend;
    prevCm = cm;
    prevDm = dm;
  }

  const fastEma = emaNullableSeries(volumeForce, fastPeriod);
  const slowEma = emaNullableSeries(volumeForce, slowPeriod);

  const ko: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f != null && s != null) {
      ko[i] = f - s;
    } else {
      ko[i] = undefined;
    }
  }

  const signalEma = emaNullableSeries(ko, signalPeriod);

  return dataList.map((_, i) => {
    const k = ko[i];
    const sig = signalEma[i];
    const res: Record<string, number> = {};
    if (k != null) res.klinger = k;
    if (sig != null) res.signal = sig;
    return res;
  });
}

function calcKama(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const fast = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 2);
  const slow = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 30);

  const fastSC = 2 / (fast + 1);
  const slowSC = 2 / (slow + 1);
  const closes = dataList.map((d) => d.close);

  const out: Array<{ kama?: number }> = new Array(dataList.length);
  let prevKama: number | null = null;

  for (let i = 0; i < dataList.length; i++) {
    if (i < period - 1) {
      out[i] = {};
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[j];
      prevKama = sum / period;
      out[i] = { kama: prevKama };
      continue;
    }

    const change = Math.abs(closes[i] - closes[i - period]);
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) {
      volatility += Math.abs(closes[j] - closes[j - 1]);
    }
    const er = volatility === 0 ? 0 : change / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    const kama = (prevKama ?? closes[i]) + sc * (closes[i] - (prevKama ?? closes[i]));
    prevKama = kama;
    out[i] = { kama };
  }

  return out;
}

function calcStdDev(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const closes = dataList.map((d) => d.close);

  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const mean = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += Math.pow(closes[j] - mean, 2);
    const stddev = Math.sqrt(sumSq / period);
    return { stddev };
  });
}

function calcIchimoku(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const convP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 9);
  const baseP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 26);
  const spanBP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 52);

  return dataList.map((candle, i) => {
    let conv: number | undefined = undefined;
    let base: number | undefined = undefined;
    let spanA: number | undefined = undefined;
    let spanB: number | undefined = undefined;

    if (i >= convP - 1) {
      let maxH = dataList[i - convP + 1].high;
      let minL = dataList[i - convP + 1].low;
      for (let j = i - convP + 1; j <= i; j++) {
        if (dataList[j].high > maxH) maxH = dataList[j].high;
        if (dataList[j].low < minL) minL = dataList[j].low;
      }
      conv = (maxH + minL) / 2;
    }

    if (i >= baseP - 1) {
      let maxH = dataList[i - baseP + 1].high;
      let minL = dataList[i - baseP + 1].low;
      for (let j = i - baseP + 1; j <= i; j++) {
        if (dataList[j].high > maxH) maxH = dataList[j].high;
        if (dataList[j].low < minL) minL = dataList[j].low;
      }
      base = (maxH + minL) / 2;
    }

    if (conv !== undefined && base !== undefined) {
      spanA = (conv + base) / 2;
    }

    if (i >= spanBP - 1) {
      let maxH = dataList[i - spanBP + 1].high;
      let minL = dataList[i - spanBP + 1].low;
      for (let j = i - spanBP + 1; j <= i; j++) {
        if (dataList[j].high > maxH) maxH = dataList[j].high;
        if (dataList[j].low < minL) minL = dataList[j].low;
      }
      spanB = (maxH + minL) / 2;
    }

    const res: Record<string, number> = {};
    if (conv !== undefined) res.conversion = conv;
    if (base !== undefined) res.base = base;
    if (spanA !== undefined) res.spanA = spanA;
    if (spanB !== undefined) res.spanB = spanB;
    res.lagging = candle.close;
    return res;
  });
}

function calcConnorsRsi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const priceRsiP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 3);
  const streakRsiP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 2);
  const pctRankP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 100);

  const closes = dataList.map((d) => d.close);
  const priceRsi = wilderRsiSeries(closes, priceRsiP);

  const streaks: number[] = new Array(dataList.length);
  streaks[0] = 0;
  for (let i = 1; i < dataList.length; i++) {
    if (closes[i] > closes[i - 1]) {
      streaks[i] = streaks[i - 1] > 0 ? streaks[i - 1] + 1 : 1;
    } else if (closes[i] < closes[i - 1]) {
      streaks[i] = streaks[i - 1] < 0 ? streaks[i - 1] - 1 : -1;
    } else {
      streaks[i] = 0;
    }
  }

  const streakRsi = wilderRsiSeries(streaks, streakRsiP);

  const roc: Array<number | undefined> = new Array(dataList.length);
  roc[0] = undefined;
  for (let i = 1; i < dataList.length; i++) {
    const prev = closes[i - 1];
    if (!Number.isFinite(prev) || prev === 0) {
      roc[i] = undefined;
    } else {
      roc[i] = ((closes[i] - prev) / prev) * 100;
    }
  }

  return dataList.map((_, i) => {
    const pRsi = priceRsi[i];
    const sRsi = streakRsi[i];
    const currentRoc = roc[i];
    if (pRsi == null || sRsi == null || currentRoc == null || i < pctRankP) return {};

    let count = 0;
    for (let j = i - pctRankP; j < i; j++) {
      const r = roc[j];
      if (r == null) return {};
      if (r < currentRoc) count++;
    }
    const pctRank = (100 * count) / pctRankP;
    const connorsRsi = (pRsi + sRsi + pctRank) / 3;
    return { connorsRsi };
  });
}

function calcChandeKroll(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const atrP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const mult = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 1;
  const stopP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 9);

  const atr = wilderAtrSeries(dataList, atrP);
  const highStopBase: Array<number | undefined> = new Array(dataList.length);
  const lowStopBase: Array<number | undefined> = new Array(dataList.length);

  for (let i = 0; i < dataList.length; i++) {
    const a = atr[i];
    if (a == null || i < atrP - 1) {
      highStopBase[i] = undefined;
      lowStopBase[i] = undefined;
      continue;
    }
    let maxH = dataList[i - atrP + 1].high;
    let minL = dataList[i - atrP + 1].low;
    for (let j = i - atrP + 1; j <= i; j++) {
      if (dataList[j].high > maxH) maxH = dataList[j].high;
      if (dataList[j].low < minL) minL = dataList[j].low;
    }
    highStopBase[i] = maxH - mult * a;
    lowStopBase[i] = minL + mult * a;
  }

  return dataList.map((_, i) => {
    if (i < atrP + stopP - 2) return {};
    let maxHighStop = -Infinity;
    let minLowStop = Infinity;
    let valid = true;

    for (let j = i - stopP + 1; j <= i; j++) {
      const hb = highStopBase[j];
      const lb = lowStopBase[j];
      if (hb == null || lb == null) {
        valid = false;
        break;
      }
      if (hb > maxHighStop) maxHighStop = hb;
      if (lb < minLowStop) minLowStop = lb;
    }

    if (!valid || !Number.isFinite(maxHighStop) || !Number.isFinite(minLowStop)) return {};
    return {
      longStop: maxHighStop,
      shortStop: minLowStop,
    };
  });
}

function calcHistVol(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 20);
  const annual = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 365;

  const logReturns: Array<number | undefined> = new Array(dataList.length);
  logReturns[0] = undefined;
  for (let i = 1; i < dataList.length; i++) {
    const prevC = dataList[i - 1].close;
    const currC = dataList[i].close;
    if (prevC > 0 && currC > 0) {
      logReturns[i] = Math.log(currC / prevC);
    } else {
      logReturns[i] = undefined;
    }
  }

  return dataList.map((_, i) => {
    if (i < period) return {};
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const r = logReturns[j];
      if (r == null) return {};
      sum += r;
    }
    const mean = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const r = logReturns[j]!;
      sumSq += Math.pow(r - mean, 2);
    }
    const variance = sumSq / period;
    const stdDev = Math.sqrt(variance);
    const histVol = stdDev * Math.sqrt(annual) * 100;
    return { histVol };
  });
}

function smmaSeries(values: number[], period: number): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let smma = sum / period;
  out[period - 1] = smma;
  for (let i = period; i < values.length; i++) {
    smma = (smma * (period - 1) + values[i]) / period;
    out[i] = smma;
  }
  return out;
}

function calcWilliamsAlligator(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const jawP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 13);
  const teethP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 8);
  const lipsP = Math.max(1, Math.round(Number(indicator.calcParams[4])) || 5);

  const medians = dataList.map((d) => (d.high + d.low) / 2);
  const jaw = smmaSeries(medians, jawP);
  const teeth = smmaSeries(medians, teethP);
  const lips = smmaSeries(medians, lipsP);

  return dataList.map((_, i) => {
    const j = jaw[i];
    const t = teeth[i];
    const l = lips[i];
    const res: Record<string, number> = {};
    if (j != null) res.jaw = j;
    if (t != null) res.teeth = t;
    if (l != null) res.lips = l;
    return res;
  });
}

function calcBop(dataList: KLineData[]) {
  return dataList.map((candle) => {
    const denom = candle.high - candle.low;
    const bop = denom === 0 ? 0 : (candle.close - candle.open) / denom;
    return { bop };
  });
}

function calcChaikinVol(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const emaP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const rocP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 10);

  const ranges = dataList.map((d) => d.high - d.low);
  const emaRange = emaSeries(ranges, emaP);

  return dataList.map((_, i) => {
    if (i < rocP) return {};
    const curr = emaRange[i];
    const prev = emaRange[i - rocP];
    if (curr == null || prev == null || prev === 0) return {};
    return { chaikinVol: (100 * (curr - prev)) / prev };
  });
}

function calcCoppock(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const longRocP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const shortRocP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 11);
  const wmaP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 10);

  const combined: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    if (i < longRocP) {
      combined[i] = undefined;
      continue;
    }
    const closeCurr = dataList[i].close;
    const closeLong = dataList[i - longRocP]?.close;
    const closeShort = dataList[i - shortRocP]?.close;
    if (closeLong > 0 && closeShort > 0) {
      const rLong = 100 * (closeCurr / closeLong - 1);
      const rShort = 100 * (closeCurr / closeShort - 1);
      combined[i] = rLong + rShort;
    } else {
      combined[i] = undefined;
    }
  }

  const coppock = wmaNullableSeries(combined, wmaP);
  return dataList.map((_, i) => {
    const v = coppock[i];
    return v != null ? { coppock: v } : {};
  });
}

function calcDpo(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 20);
  const shift = Math.floor(period / 2) + 1;
  const closes = dataList.map((d) => d.close);
  const sma = smaSeries(closes, period);

  return dataList.map((_, i) => {
    if (i < period - 1 || i - shift < 0) return {};
    const s = sma[i];
    if (s == null) return {};
    return { dpo: closes[i - shift] - s };
  });
}

function calcEom(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const rawEom: Array<number | undefined> = new Array(dataList.length);
  rawEom[0] = undefined;

  for (let i = 1; i < dataList.length; i++) {
    const currMid = (dataList[i].high + dataList[i].low) / 2;
    const prevMid = (dataList[i - 1].high + dataList[i - 1].low) / 2;
    const dm = currMid - prevMid;
    const vol = dataList[i].volume ?? 0;
    const hl = dataList[i].high - dataList[i].low;
    if (vol <= 0 || hl <= 0) {
      rawEom[i] = undefined;
    } else {
      const boxRatio = (vol / 100000000) / hl;
      rawEom[i] = boxRatio > 0 ? dm / boxRatio : undefined;
    }
  }

  const eom = smaNullableSeries(rawEom, period);
  return dataList.map((_, i) => {
    const v = eom[i];
    return v != null ? { eom: v } : {};
  });
}

function calcGmma(dataList: KLineData[]) {
  const periods = [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60];
  const closes = dataList.map((d) => d.close);
  const emas = periods.map((p) => emaSeries(closes, p));

  return dataList.map((_, i) => {
    const res: Record<string, number> = {};
    for (let idx = 0; idx < periods.length; idx++) {
      const v = emas[idx][i];
      if (v != null) res[`ema${periods[idx]}`] = v;
    }
    return res;
  });
}

function calcMcGinley(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 14);
  const closes = dataList.map((d) => d.close);
  const out: Array<{ mcginley?: number }> = new Array(dataList.length);
  let prevMg: number | null = null;

  for (let i = 0; i < dataList.length; i++) {
    if (i < period - 1) {
      out[i] = {};
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[j];
      prevMg = sum / period;
      out[i] = { mcginley: prevMg };
      continue;
    }

    const c = closes[i];
    if (prevMg == null || prevMg <= 0) {
      prevMg = c;
      out[i] = { mcginley: prevMg };
      continue;
    }
    const ratio = c / prevMg;
    const mg = prevMg + (c - prevMg) / (period * Math.pow(ratio, 4));
    prevMg = mg;
    out[i] = { mcginley: mg };
  }

  return out;
}

function calcRvi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const num: Array<number | undefined> = new Array(dataList.length);
  const den: Array<number | undefined> = new Array(dataList.length);

  for (let i = 0; i < dataList.length; i++) {
    if (i < 3) {
      num[i] = undefined;
      den[i] = undefined;
      continue;
    }
    const co0 = dataList[i].close - dataList[i].open;
    const co1 = dataList[i - 1].close - dataList[i - 1].open;
    const co2 = dataList[i - 2].close - dataList[i - 2].open;
    const co3 = dataList[i - 3].close - dataList[i - 3].open;
    num[i] = (co0 + 2 * co1 + 2 * co2 + co3) / 6;

    const hl0 = dataList[i].high - dataList[i].low;
    const hl1 = dataList[i - 1].high - dataList[i - 1].low;
    const hl2 = dataList[i - 2].high - dataList[i - 2].low;
    const hl3 = dataList[i - 3].high - dataList[i - 3].low;
    den[i] = (hl0 + 2 * hl1 + 2 * hl2 + hl3) / 6;
  }

  const smaNum = smaNullableSeries(num, period);
  const smaDen = smaNullableSeries(den, period);

  const rviRaw: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const sn = smaNum[i];
    const sd = smaDen[i];
    if (sn != null && sd != null && sd !== 0) {
      rviRaw[i] = sn / sd;
    } else {
      rviRaw[i] = undefined;
    }
  }

  return dataList.map((_, i) => {
    const r = rviRaw[i];
    if (r == null) return {};
    const res: Record<string, number> = { rvi: r };
    if (i >= 3 && rviRaw[i - 1] != null && rviRaw[i - 2] != null && rviRaw[i - 3] != null) {
      res.signal = (r + 2 * rviRaw[i - 1]! + 2 * rviRaw[i - 2]! + rviRaw[i - 3]!) / 6;
    }
    return res;
  });
}

function calcTsi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const longP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 25);
  const shortP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 13);
  const sigP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 7);

  const m: Array<number | undefined> = new Array(dataList.length);
  const absM: Array<number | undefined> = new Array(dataList.length);
  m[0] = undefined;
  absM[0] = undefined;

  for (let i = 1; i < dataList.length; i++) {
    const diff = dataList[i].close - dataList[i - 1].close;
    m[i] = diff;
    absM[i] = Math.abs(diff);
  }

  const ema1_m = emaNullableSeries(m, longP);
  const ema2_m = emaNullableSeries(ema1_m, shortP);
  const ema1_abs = emaNullableSeries(absM, longP);
  const ema2_abs = emaNullableSeries(ema1_abs, shortP);

  const tsiRaw: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const e2m = ema2_m[i];
    const e2abs = ema2_abs[i];
    if (e2m != null && e2abs != null) {
      tsiRaw[i] = e2abs === 0 ? 0 : (100 * e2m) / e2abs;
    } else {
      tsiRaw[i] = undefined;
    }
  }

  const sigEma = emaNullableSeries(tsiRaw, sigP);
  return dataList.map((_, i) => {
    const t = tsiRaw[i];
    const s = sigEma[i];
    const res: Record<string, number> = {};
    if (t != null) res.tsi = t;
    if (s != null) res.signal = s;
    return res;
  });
}

function calcVolumeOsc(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 5);
  const slowP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 10);

  const volumes: Array<number | undefined> = dataList.map((d) =>
    Number.isFinite(d.volume) ? (d.volume as number) : undefined,
  );
  const fastEma = emaNullableSeries(volumes, fastP);
  const slowEma = emaNullableSeries(volumes, slowP);

  return dataList.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f == null || s == null || s === 0) return {};
    return { volOsc: (100 * (f - s)) / s };
  });
}

function calcAdl(dataList: KLineData[]) {
  const out: Array<{ adl?: number }> = new Array(dataList.length);
  let cumAdl = 0;

  for (let i = 0; i < dataList.length; i++) {
    const b = dataList[i];
    const volume = b.volume;
    if (!Number.isFinite(volume)) {
      out[i] = {};
      continue;
    }
    const range = b.high - b.low;
    const mfm = range === 0 ? 0 : ((b.close - b.low) - (b.high - b.close)) / range;
    const mfv = mfm * (volume as number);
    cumAdl += mfv;
    out[i] = { adl: cumAdl };
  }

  return out;
}

function calcBullBearPower(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 13);
  const closes = dataList.map((d) => d.close);
  const ema = emaSeries(closes, period);

  return dataList.map((candle, i) => {
    const e = ema[i];
    if (e == null) return {};
    return {
      bull: candle.high - e,
      bear: candle.low - e,
    };
  });
}

function calcKst(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const r1 = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const r2 = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 15);
  const r3 = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 20);
  const r4 = Math.max(1, Math.round(Number(indicator.calcParams[3])) || 30);
  const s1 = Math.max(1, Math.round(Number(indicator.calcParams[4])) || 10);
  const s2 = Math.max(1, Math.round(Number(indicator.calcParams[5])) || 10);
  const s3 = Math.max(1, Math.round(Number(indicator.calcParams[6])) || 10);
  const s4 = Math.max(1, Math.round(Number(indicator.calcParams[7])) || 15);
  const sigP = Math.max(1, Math.round(Number(indicator.calcParams[8])) || 9);

  const closes = dataList.map((d) => d.close);
  const getRoc = (p: number) => {
    const roc: Array<number | undefined> = new Array(closes.length);
    for (let i = 0; i < closes.length; i++) {
      if (i < p) {
        roc[i] = undefined;
      } else {
        const prev = closes[i - p];
        roc[i] = prev > 0 ? ((closes[i] - prev) / prev) * 100 : undefined;
      }
    }
    return roc;
  };

  const rcma1 = smaNullableSeries(getRoc(r1), s1);
  const rcma2 = smaNullableSeries(getRoc(r2), s2);
  const rcma3 = smaNullableSeries(getRoc(r3), s3);
  const rcma4 = smaNullableSeries(getRoc(r4), s4);

  const kstList: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const m1 = rcma1[i];
    const m2 = rcma2[i];
    const m3 = rcma3[i];
    const m4 = rcma4[i];
    if (m1 != null && m2 != null && m3 != null && m4 != null) {
      kstList[i] = m1 + 2 * m2 + 3 * m3 + 4 * m4;
    } else {
      kstList[i] = undefined;
    }
  }

  const signal = smaNullableSeries(kstList, sigP);

  return dataList.map((_, i) => {
    const k = kstList[i];
    const s = signal[i];
    const res: Record<string, number> = {};
    if (k != null) res.kst = k;
    if (s != null) res.signal = s;
    return res;
  });
}

function calcMedianPrice(dataList: KLineData[]) {
  return dataList.map((candle) => ({
    median: (candle.high + candle.low) / 2,
  }));
}

function calcNetVolume(dataList: KLineData[]) {
  return dataList.map((candle, i) => {
    if (i === 0) return {};
    const volume = candle.volume;
    if (!Number.isFinite(volume)) return {};
    const prevC = dataList[i - 1].close;
    const currC = candle.close;
    let net = 0;
    if (currC > prevC) net = volume as number;
    else if (currC < prevC) net = -(volume as number);
    else net = 0;
    return { netVolume: net };
  });
}

function calcNvi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const seed = Number.isFinite(Number(indicator.calcParams[0])) ? Number(indicator.calcParams[0]) : 1000;
  const out: Array<{ nvi?: number }> = new Array(dataList.length);
  if (!dataList.length) return out;

  let nvi = seed;
  const firstVol = dataList[0].volume;
  if (Number.isFinite(firstVol)) {
    out[0] = { nvi };
  } else {
    out[0] = {};
  }

  for (let i = 1; i < dataList.length; i++) {
    const currV = dataList[i].volume;
    const prevV = dataList[i - 1].volume;
    const currC = dataList[i].close;
    const prevC = dataList[i - 1].close;

    if (
      !Number.isFinite(currV) ||
      !Number.isFinite(prevV) ||
      !Number.isFinite(currC) ||
      !Number.isFinite(prevC) ||
      prevC === 0
    ) {
      out[i] = {};
      continue;
    }

    if ((currV as number) < (prevV as number)) {
      nvi = nvi * (1 + (currC - prevC) / prevC);
    }
    out[i] = { nvi };
  }

  return out;
}

function calcPvi(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const seed = Number.isFinite(Number(indicator.calcParams[0])) ? Number(indicator.calcParams[0]) : 1000;
  const out: Array<{ pvi?: number }> = new Array(dataList.length);
  if (!dataList.length) return out;

  let pvi = seed;
  const firstVol = dataList[0].volume;
  if (Number.isFinite(firstVol)) {
    out[0] = { pvi };
  } else {
    out[0] = {};
  }

  for (let i = 1; i < dataList.length; i++) {
    const currV = dataList[i].volume;
    const prevV = dataList[i - 1].volume;
    const currC = dataList[i].close;
    const prevC = dataList[i - 1].close;

    if (
      !Number.isFinite(currV) ||
      !Number.isFinite(prevV) ||
      !Number.isFinite(currC) ||
      !Number.isFinite(prevC) ||
      prevC === 0
    ) {
      out[i] = {};
      continue;
    }

    if ((currV as number) > (prevV as number)) {
      pvi = pvi * (1 + (currC - prevC) / prevC);
    }
    out[i] = { pvi };
  }

  return out;
}

function calcPpo(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 12);
  const slowP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 26);
  const sigP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 9);

  const closes = dataList.map((d) => d.close);
  const fastEma = emaSeries(closes, fastP);
  const slowEma = emaSeries(closes, slowP);

  const ppoList: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f != null && s != null && s !== 0) {
      ppoList[i] = (100 * (f - s)) / s;
    } else {
      ppoList[i] = undefined;
    }
  }

  const signal = emaNullableSeries(ppoList, sigP);

  return dataList.map((_, i) => {
    const p = ppoList[i];
    const s = signal[i];
    const res: Record<string, number> = {};
    if (p != null) res.ppo = p;
    if (s != null) res.signal = s;
    if (p != null && s != null) res.histogram = p - s;
    return res;
  });
}

function calcRci(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 14);
  const closes = dataList.map((d) => d.close);

  const meanT = (period + 1) / 2;
  let ssT = 0;
  for (let k = 1; k <= period; k++) {
    ssT += Math.pow(k - meanT, 2);
  }

  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    const windowCloses = closes.slice(i - period + 1, i + 1);

    const items = windowCloses.map((val, idx) => ({ val, idx }));
    items.sort((a, b) => a.val - b.val);

    const priceRanks = new Array<number>(period);
    let start = 0;
    while (start < period) {
      let end = start;
      while (end < period - 1 && items[end + 1].val === items[start].val) {
        end++;
      }
      const avgRank = (start + 1 + (end + 1)) / 2;
      for (let k = start; k <= end; k++) {
        priceRanks[items[k].idx] = avgRank;
      }
      start = end + 1;
    }

    const meanR = (period + 1) / 2;
    let ssR = 0;
    let sp = 0;
    for (let k = 0; k < period; k++) {
      const tRank = k + 1;
      const pRank = priceRanks[k];
      const diffT = tRank - meanT;
      const diffR = pRank - meanR;
      ssR += diffR * diffR;
      sp += diffT * diffR;
    }

    if (ssT <= 0 || ssR <= 0) return { rci: 0 };
    const r = sp / Math.sqrt(ssT * ssR);
    const rci = Math.max(-100, Math.min(100, r * 100));
    return { rci };
  });
}

function calcSmma(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
  const closes = dataList.map((d) => d.close);
  const smma = smmaSeries(closes, period);
  return dataList.map((_, i) => {
    const v = smma[i];
    return v != null ? { smma: v } : {};
  });
}

function calcZlema(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const lag = Math.floor((period - 1) / 2);
  const closes = dataList.map((d) => d.close);

  const adjusted: Array<number | undefined> = new Array(closes.length);
  for (let i = 0; i < closes.length; i++) {
    if (i < lag) {
      adjusted[i] = undefined;
    } else {
      adjusted[i] = closes[i] + (closes[i] - closes[i - lag]);
    }
  }

  const zlema = emaNullableSeries(adjusted, period);
  return dataList.map((_, i) => {
    const v = zlema[i];
    return v != null ? { zlema: v } : {};
  });
}

function calcHammingMa(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const closes = dataList.map((d) => d.close);

  const weights: number[] = [];
  let sumW = 0;
  if (period === 1) {
    weights.push(1);
    sumW = 1;
  } else {
    for (let k = 0; k < period; k++) {
      const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * k) / (period - 1));
      weights.push(w);
      sumW += w;
    }
  }

  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let sum = 0;
    for (let k = 0; k < period; k++) {
      sum += closes[i - period + 1 + k] * weights[k];
    }
    return { hammingMa: sumW > 0 ? sum / sumW : closes[i] };
  });
}

function calcChandelierExit(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 22);
  const mult = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 3;
  const atr = wilderAtrSeries(dataList, period);

  return dataList.map((_, i) => {
    const a = atr[i];
    if (a == null || i < period - 1) return {};
    let maxH = dataList[i - period + 1].high;
    let minL = dataList[i - period + 1].low;
    for (let j = i - period + 1; j <= i; j++) {
      if (dataList[j].high > maxH) maxH = dataList[j].high;
      if (dataList[j].low < minL) minL = dataList[j].low;
    }
    return {
      longExit: maxH - mult * a,
      shortExit: minL + mult * a,
    };
  });
}

function calcSmiErgodic(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const shortP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 5);
  const longP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 20);
  const sigP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 5);

  const m: Array<number | undefined> = new Array(dataList.length);
  const absM: Array<number | undefined> = new Array(dataList.length);
  m[0] = undefined;
  absM[0] = undefined;

  for (let i = 1; i < dataList.length; i++) {
    const diff = dataList[i].close - dataList[i - 1].close;
    m[i] = diff;
    absM[i] = Math.abs(diff);
  }

  const ema1_m = emaNullableSeries(m, shortP);
  const ema2_m = emaNullableSeries(ema1_m, longP);
  const ema1_abs = emaNullableSeries(absM, shortP);
  const ema2_abs = emaNullableSeries(ema1_abs, longP);

  const smiList: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const e2m = ema2_m[i];
    const e2abs = ema2_abs[i];
    if (e2m != null && e2abs != null) {
      smiList[i] = e2abs === 0 ? 0 : (100 * e2m) / e2abs;
    } else {
      smiList[i] = undefined;
    }
  }

  const signal = emaNullableSeries(smiList, sigP);

  return dataList.map((_, i) => {
    const smi = smiList[i];
    const sig = signal[i];
    const res: Record<string, number> = {};
    if (smi != null) res.smi = smi;
    if (sig != null) res.signal = sig;
    return res;
  });
}

function calcVolumeRoc(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);

  return dataList.map((candle, i) => {
    if (i < period) return {};
    const currV = candle.volume;
    const prevV = dataList[i - period]?.volume;
    if (!Number.isFinite(currV) || !Number.isFinite(prevV) || prevV === 0) return {};
    return {
      vroc: (100 * ((currV as number) - (prevV as number))) / (prevV as number),
    };
  });
}

function calcAccelerator(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 5);
  const slowP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 34);
  const smoothP = Math.max(1, Math.round(Number(indicator.calcParams[2])) || 5);

  const medians = dataList.map((d) => (d.high + d.low) / 2);
  const fastSma = smaSeries(medians, fastP);
  const slowSma = smaSeries(medians, slowP);

  const ao: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    const f = fastSma[i];
    const s = slowSma[i];
    if (f != null && s != null) {
      ao[i] = f - s;
    } else {
      ao[i] = undefined;
    }
  }

  const aoSmooth = smaNullableSeries(ao, smoothP);

  return dataList.map((_, i) => {
    const a = ao[i];
    const sm = aoSmooth[i];
    if (a == null || sm == null) return {};
    return { ac: a - sm };
  });
}

function calcAveragePrice(dataList: KLineData[]) {
  return dataList.map((candle) => ({
    averagePrice: (candle.open + candle.high + candle.low + candle.close) / 4,
  }));
}

function calcTypicalPrice(dataList: KLineData[]) {
  return dataList.map((candle) => ({
    typicalPrice: (candle.high + candle.low + candle.close) / 3,
  }));
}

function calcMaCross(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 9);
  const slowP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 21);
  const closes = dataList.map((d) => d.close);

  const fastSma = smaSeries(closes, fastP);
  const slowSma = smaSeries(closes, slowP);

  return dataList.map((_, i) => {
    const f = fastSma[i];
    const s = slowSma[i];
    const res: Record<string, number> = {};
    if (f != null) res.fast = f;
    if (s != null) res.slow = s;
    return res;
  });
}

function calcEmaCross(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const fastP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 9);
  const slowP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 21);
  const closes = dataList.map((d) => d.close);

  const fastEma = emaSeries(closes, fastP);
  const slowEma = emaSeries(closes, slowP);

  return dataList.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    const res: Record<string, number> = {};
    if (f != null) res.fast = f;
    if (s != null) res.slow = s;
    return res;
  });
}

function calcMaEmaCross(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const smaP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const emaP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 20);
  const closes = dataList.map((d) => d.close);

  const sma = smaSeries(closes, smaP);
  const ema = emaSeries(closes, emaP);

  return dataList.map((_, i) => {
    const s = sma[i];
    const e = ema[i];
    const res: Record<string, number> = {};
    if (s != null) res.sma = s;
    if (e != null) res.ema = e;
    return res;
  });
}

function calcMajorityRule(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);

  return dataList.map((_, i) => {
    if (i < period - 1) return {};
    let bullBars = 0;
    let bearBars = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const c = dataList[j].close;
      const o = dataList[j].open;
      if (c > o) bullBars++;
      else if (c < o) bearBars++;
    }
    return { majority: (100 * (bullBars - bearBars)) / period };
  });
}

function wilderNullableSeries(
  values: Array<number | undefined>,
  period: number,
): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length);
  if (period < 1 || values.length < period) return out;

  let sum = 0;
  let validCount = 0;
  let prevWilder: number | null = null;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === undefined || val === null || !Number.isFinite(val)) {
      sum = 0;
      validCount = 0;
      prevWilder = null;
      out[i] = undefined;
      continue;
    }

    if (prevWilder === null) {
      sum += val;
      validCount++;
      if (validCount === period) {
        prevWilder = sum / period;
        out[i] = prevWilder;
      } else {
        out[i] = undefined;
      }
    } else {
      prevWilder = (prevWilder * (period - 1) + val) / period;
      out[i] = prevWilder;
    }
  }

  return out;
}

function calcRelativeVolatility(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const stdP = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const smoothP = Math.max(1, Math.round(Number(indicator.calcParams[1])) || 14);
  const closes = dataList.map((d) => d.close);

  const stdDev: Array<number | undefined> = new Array(dataList.length);
  for (let i = 0; i < dataList.length; i++) {
    if (i < stdP - 1) {
      stdDev[i] = undefined;
      continue;
    }
    let sum = 0;
    for (let j = i - stdP + 1; j <= i; j++) sum += closes[j];
    const mean = sum / stdP;
    let sumSq = 0;
    for (let j = i - stdP + 1; j <= i; j++) sumSq += Math.pow(closes[j] - mean, 2);
    stdDev[i] = Math.sqrt(sumSq / stdP);
  }

  const upVol: Array<number | undefined> = new Array(dataList.length);
  const downVol: Array<number | undefined> = new Array(dataList.length);

  for (let i = 0; i < dataList.length; i++) {
    const sd = stdDev[i];
    if (sd == null || i === 0) {
      upVol[i] = undefined;
      downVol[i] = undefined;
      continue;
    }
    if (closes[i] > closes[i - 1]) {
      upVol[i] = sd;
      downVol[i] = 0;
    } else if (closes[i] < closes[i - 1]) {
      upVol[i] = 0;
      downVol[i] = sd;
    } else {
      upVol[i] = 0;
      downVol[i] = 0;
    }
  }

  const smoothedUp = wilderNullableSeries(upVol, smoothP);
  const smoothedDown = wilderNullableSeries(downVol, smoothP);

  return dataList.map((_, i) => {
    const su = smoothedUp[i];
    const sd = smoothedDown[i];
    if (su == null || sd == null) return {};
    const total = su + sd;
    const rvi = total === 0 ? 50 : (100 * su) / total;
    return { relativeVolatility: Math.max(0, Math.min(100, rvi)) };
  });
}

function calcStandardErrorHelper(dataList: KLineData[], period: number) {
  const n = Math.max(3, period);
  const sumX = (n * (n - 1)) / 2;
  const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;
  const denom = n * sumXX - sumX * sumX;

  return dataList.map((_, i) => {
    if (i < n - 1 || denom === 0) return null;
    let sumY = 0;
    let sumXY = 0;
    for (let j = 0; j < n; j++) {
      const y = dataList[i - n + 1 + j].close;
      sumY += y;
      sumXY += j * y;
    }
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const endpoint = intercept + slope * (n - 1);

    let sse = 0;
    for (let j = 0; j < n; j++) {
      const actual = dataList[i - n + 1 + j].close;
      const predicted = intercept + slope * j;
      sse += Math.pow(actual - predicted, 2);
    }
    const standardError = Math.sqrt(sse / (n - 2));

    return { endpoint, standardError };
  });
}

function calcStandardError(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(3, Math.round(Number(indicator.calcParams[0])) || 20);
  const res = calcStandardErrorHelper(dataList, period);
  return res.map((r) => (r != null ? { standardError: r.standardError } : {}));
}

function calcStandardErrorBands(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(3, Math.round(Number(indicator.calcParams[0])) || 20);
  const mult = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 2;
  const res = calcStandardErrorHelper(dataList, period);

  return res.map((r) => {
    if (r == null) return {};
    return {
      upper: r.endpoint + mult * r.standardError,
      middle: r.endpoint,
      lower: r.endpoint - mult * r.standardError,
    };
  });
}

function calcTrendStrength(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(2, Math.round(Number(indicator.calcParams[0])) || 14);
  const n = period;
  const sumX = (n * (n - 1)) / 2;
  const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;

  return dataList.map((_, i) => {
    if (i < n - 1) return {};
    let sumY = 0;
    let sumYY = 0;
    let sumXY = 0;
    for (let j = 0; j < n; j++) {
      const y = dataList[i - n + 1 + j].close;
      sumY += y;
      sumYY += y * y;
      sumXY += j * y;
    }
    const num = n * sumXY - sumX * sumY;
    const denom = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    if (denom <= 0) return { trendStrength: 0 };
    const r = num / denom;
    return { trendStrength: Math.max(-1, Math.min(1, r)) };
  });
}

function calcMaChannel(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 20);
  const highs = dataList.map((d) => d.high);
  const lows = dataList.map((d) => d.low);

  const upperSma = smaSeries(highs, period);
  const lowerSma = smaSeries(lows, period);

  return dataList.map((_, i) => {
    const u = upperSma[i];
    const l = lowerSma[i];
    const res: Record<string, number> = {};
    if (u != null) res.upper = u;
    if (l != null) res.lower = l;
    return res;
  });
}

function calcVolZeroTrendCtc(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const periodsPerYear = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 252;

  const r2: Array<number | undefined> = new Array(dataList.length);
  r2[0] = undefined;

  for (let i = 1; i < dataList.length; i++) {
    const currC = dataList[i].close;
    const prevC = dataList[i - 1].close;
    if (currC > 0 && prevC > 0) {
      const r = Math.log(currC / prevC);
      r2[i] = r * r;
    } else {
      r2[i] = undefined;
    }
  }

  const meanSquare = smaNullableSeries(r2, period);

  return dataList.map((_, i) => {
    const ms = meanSquare[i];
    if (ms == null) return {};
    const vol = 100 * Math.sqrt(Math.max(ms, 0) * periodsPerYear);
    return { volatility: vol };
  });
}

function calcVolOhlc(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 10);
  const periodsPerYear = Number.isFinite(Number(indicator.calcParams[1])) ? Number(indicator.calcParams[1]) : 252;
  const factor = 2 * Math.LN2 - 1;

  const barVariance: Array<number | undefined> = new Array(dataList.length);

  for (let i = 0; i < dataList.length; i++) {
    const { open, high, low, close } = dataList[i];
    if (open > 0 && high > 0 && low > 0 && close > 0) {
      const logHL = Math.log(high / low);
      const logCO = Math.log(close / open);
      barVariance[i] = 0.5 * logHL * logHL - factor * logCO * logCO;
    } else {
      barVariance[i] = undefined;
    }
  }

  const meanVariance = smaNullableSeries(barVariance, period);

  return dataList.map((_, i) => {
    const mv = meanVariance[i];
    if (mv == null) return {};
    const vol = 100 * Math.sqrt(Math.max(mv, 0) * periodsPerYear);
    return { volatility: vol };
  });
}

function calcWilliamsFractal(dataList: KLineData[], indicator: { calcParams: unknown[] }) {
  const n = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 2);
  const result: Array<{ upFractal?: number; downFractal?: number }> = new Array(dataList.length);

  for (let i = 0; i < dataList.length; i++) {
    result[i] = {};
    if (i < n || i >= dataList.length - n) {
      continue;
    }

    const currentHigh = dataList[i].high;
    const currentLow = dataList[i].low;

    let isUp = true;
    let isDown = true;

    for (let offset = 1; offset <= n; offset++) {
      if (dataList[i - offset].high >= currentHigh || dataList[i + offset].high >= currentHigh) {
        isUp = false;
      }
      if (dataList[i - offset].low <= currentLow || dataList[i + offset].low <= currentLow) {
        isDown = false;
      }
    }

    if (isUp) {
      result[i].upFractal = currentHigh;
    }
    if (isDown) {
      result[i].downFractal = currentLow;
    }
  }

  return result;
}

/**
 * Real Traditional UTC-daily pivot levels. Only completed OHLC sessions
 * qualify; partial history, missing bars and unsupported multi-day candle
 * intervals deliberately return no level instead of fabricated pivots.
 * Uses TradingView's published Traditional P/R1-3/S1-3 formulas.
 */
function calcTraditionalUtcDailyPivots(dataList: KLineData[]): Array<Record<string, number>> {
  const dayMs = 86_400_000;
  const ms = (b: KLineData) => {
    const t = Number(b.timestamp ?? b.time);
    return Number.isFinite(t) ? (t < 1e12 ? t * 1000 : t) : NaN;
  };
  let cadence = dayMs + 1;
  for (let i = 1; i < dataList.length; i++) {
    const delta = ms(dataList[i]) - ms(dataList[i - 1]);
    if (delta > 0 && delta < cadence) cadence = delta;
  }
  if (cadence > dayMs || dataList.length < 2) return dataList.map(() => ({}));
  const expectedBars = Math.round(dayMs / cadence);
  let currentDay = NaN;
  let high = 0, low = 0, close = 0, firstMs = 0, lastMs = 0, count = 0;
  let levels: Record<string, number> | null = null;
  const result: Array<Record<string, number>> = [];
  for (const bar of dataList) {
    const t = ms(bar);
    if (!Number.isFinite(t) || !Number.isFinite(bar.high) ||
      !Number.isFinite(bar.low) || !Number.isFinite(bar.close)) {
      result.push({});
      continue;
    }
    const day = Math.floor(t / dayMs);
    if (day !== currentDay) {
      if (Number.isFinite(currentDay)) {
        const start = currentDay * dayMs;
        const complete = day === currentDay + 1 &&
          firstMs < start + cadence &&
          lastMs >= start + dayMs - cadence &&
          count >= Math.max(1, expectedBars - 1) &&
          Number.isFinite(high) && Number.isFinite(low) &&
          Number.isFinite(close) && high >= low;
        if (complete) {
          const p = (high + low + close) / 3;
          levels = {
            p,
            r1: 2 * p - low,
            r2: p + high - low,
            r3: 2 * p + high - 2 * low,
            s1: 2 * p - high,
            s2: p - high + low,
            s3: 2 * p - 2 * high + low,
          };
        } else levels = null;
      }
      currentDay = day;
      high = bar.high;
      low = bar.low;
      close = bar.close;
      firstMs = t;
      lastMs = t;
      count = 1;
    } else {
      high = Math.max(high, bar.high);
      low = Math.min(low, bar.low);
      close = bar.close;
      lastMs = t;
      count++;
    }
    result.push(levels ? { ...levels } : {});
  }
  return result;
}

let registered = false;

export function ensureKlineAverages() {
  if (registered) return;
  registered = true;
  for (const spec of [
    { name: MA_WEB, shortName: 'MA', kind: 'sma' as const, calcParams: [7, 25, 99] },
    { name: EMA_WEB, shortName: 'EMA', kind: 'ema' as const, calcParams: [7, 50, 200] },
  ]) {
    registerIndicator({
      name: spec.name,
      shortName: spec.shortName,
      series: 'price',
      calcParams: spec.calcParams,
      figures: figuresFor(spec.shortName, spec.calcParams),
      regenerateFigures: (params) => figuresFor(spec.shortName, params),
      shouldUpdate: (prev, curr) => {
        const calc =
          JSON.stringify(prev.calcParams) !== JSON.stringify(curr.calcParams) ||
          JSON.stringify(prev.extendData) !== JSON.stringify(curr.extendData);
        return { calc, draw: true };
      },
      calc: (dataList, indicator) => calcAverage(spec.kind, dataList, indicator),
    });
  }
  registerIndicator({
    name: VWAP_WEB,
    shortName: 'VWAP',
    series: 'price',
    calcParams: [14],
    figures: [{ key: 'vwap', title: 'VWAP: ', type: 'line' }],
    regenerateFigures: (params) => [{ key: 'vwap', title: `VWAP${params[0] ?? ''}: `, type: 'line' }],
    calc: (dataList, indicator) => {
      const period = Math.max(2, Math.round(Number(indicator.calcParams[0]) || 14));
      return dataList.map((_, i) => {
        const from = Math.max(0, i - period + 1);
        let pv = 0;
        let vol = 0;
        for (let j = from; j <= i; j++) {
          const d = dataList[j];
          const tp = (d.high + d.low + d.close) / 3;
          const v = d.volume ?? 0;
          pv += tp * v;
          vol += v;
        }
        return vol > 0 ? { vwap: pv / vol } : {};
      });
    },
  });
  registerIndicator({
    name: SUPERTREND_WEB,
    shortName: 'Supertrend',
    series: 'price',
    calcParams: [10, 3],
    figures: [{ key: 'supertrend', title: 'ST: ', type: 'line' }],
    regenerateFigures: () => [{ key: 'supertrend', title: 'ST: ', type: 'line' }],
    calc: (dataList, indicator) => calcSupertrend(dataList, indicator),
  });

  // Register 15 Custom Indicators
  registerIndicator({
    name: 'AL_ATR',
    shortName: 'ATR',
    calcParams: [14],
    figures: [{ key: 'atr', title: 'ATR: ', type: 'line' }],
    calc: (dataList, indicator) => {
      const period = Math.max(1, Math.round(Number(indicator.calcParams[0])) || 14);
      const atr = wilderAtrSeries(dataList, period);
      return dataList.map((_, i) => {
        const v = atr[i];
        return v != null ? { atr: v } : {};
      });
    },
  });

  registerIndicator({
    name: 'AL_AROON',
    shortName: 'Aroon',
    calcParams: [14],
    figures: [
      { key: 'up', title: 'Aroon Up: ', type: 'line' },
      { key: 'down', title: 'Aroon Down: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcAroon(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_ALMA',
    shortName: 'ALMA',
    series: 'price',
    calcParams: [9, 0.85, 6],
    figures: [{ key: 'alma', title: 'ALMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcAlma(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_BOLL_PERCENT_B',
    shortName: '%B',
    calcParams: [20, 2],
    figures: [{ key: 'percentB', title: '%B: ', type: 'line' }],
    calc: (dataList, indicator) => calcBollPercentB(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_BOLL_WIDTH',
    shortName: 'BBW',
    calcParams: [20, 2],
    figures: [{ key: 'width', title: 'BandWidth: ', type: 'line' }],
    calc: (dataList, indicator) => calcBollWidth(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_CMF',
    shortName: 'CMF',
    calcParams: [20],
    figures: [{ key: 'cmf', title: 'CMF: ', type: 'line' }],
    calc: (dataList, indicator) => calcCmf(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_CHOP',
    shortName: 'CHOP',
    calcParams: [14],
    figures: [{ key: 'chop', title: 'CHOP: ', type: 'line' }],
    calc: (dataList, indicator) => calcChop(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_DONCHIAN',
    shortName: 'Donchian',
    series: 'price',
    calcParams: [20],
    figures: [
      { key: 'upper', title: 'Upper: ', type: 'line' },
      { key: 'middle', title: 'Middle: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcDonchian(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_HMA',
    shortName: 'HMA',
    series: 'price',
    calcParams: [9],
    figures: [{ key: 'hma', title: 'HMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcHma(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_KELTNER',
    shortName: 'Keltner',
    series: 'price',
    calcParams: [20, 10, 2],
    figures: [
      { key: 'upper', title: 'Upper: ', type: 'line' },
      { key: 'middle', title: 'Middle: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcKeltner(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_MFI',
    shortName: 'MFI',
    calcParams: [14],
    figures: [{ key: 'mfi', title: 'MFI: ', type: 'line' }],
    calc: (dataList, indicator) => calcMfi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_STOCH',
    shortName: 'Stoch',
    calcParams: [14, 3, 3],
    figures: [
      { key: 'k', title: '%K: ', type: 'line' },
      { key: 'd', title: '%D: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcStoch(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_STOCH_RSI',
    shortName: 'StochRSI',
    calcParams: [14, 14, 3, 3],
    figures: [
      { key: 'k', title: '%K: ', type: 'line' },
      { key: 'd', title: '%D: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcStochRsi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_VORTEX',
    shortName: 'Vortex',
    calcParams: [14],
    figures: [
      { key: 'vip', title: '+VI: ', type: 'line' },
      { key: 'vim', title: '-VI: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcVortex(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_VWMA',
    shortName: 'VWMA',
    series: 'price',
    calcParams: [20],
    figures: [{ key: 'vwma', title: 'VWMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcVwma(dataList, indicator),
  });

  // Batch 2 Custom Indicators
  registerIndicator({
    name: 'AL_CMO',
    shortName: 'CMO',
    calcParams: [14],
    figures: [{ key: 'cmo', title: 'CMO: ', type: 'line' }],
    calc: (dataList, indicator) => calcCmo(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_EFI',
    shortName: 'EFI',
    calcParams: [13],
    figures: [{ key: 'efi', title: 'EFI: ', type: 'line' }],
    calc: (dataList, indicator) => calcEfi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_CHAIKIN_OSC',
    shortName: 'Chaikin',
    calcParams: [3, 10],
    figures: [{ key: 'chaikin', title: 'Chaikin: ', type: 'line' }],
    calc: (dataList, indicator) => calcChaikinOsc(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_FISHER',
    shortName: 'Fisher',
    calcParams: [9],
    figures: [
      { key: 'fisher', title: 'Fisher: ', type: 'line' },
      { key: 'trigger', title: 'Trigger: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcFisher(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_ULTIMATE_OSC',
    shortName: 'UO',
    calcParams: [7, 14, 28],
    figures: [{ key: 'ultimate', title: 'UO: ', type: 'line' }],
    calc: (dataList, indicator) => calcUltimateOsc(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_DEMA',
    shortName: 'DEMA',
    series: 'price',
    calcParams: [20],
    figures: [{ key: 'dema', title: 'DEMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcDema(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_TEMA',
    shortName: 'TEMA',
    series: 'price',
    calcParams: [20],
    figures: [{ key: 'tema', title: 'TEMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcTema(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_WMA',
    shortName: 'WMA',
    series: 'price',
    calcParams: [20],
    figures: [{ key: 'wma', title: 'WMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcWma(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_ENVELOPES',
    shortName: 'Envelopes',
    series: 'price',
    calcParams: [20, 2.5],
    figures: [
      { key: 'upper', title: 'Upper: ', type: 'line' },
      { key: 'middle', title: 'Middle: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcEnvelopes(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_MASS_INDEX',
    shortName: 'Mass',
    calcParams: [9, 25],
    figures: [{ key: 'mass', title: 'Mass: ', type: 'line' }],
    calc: (dataList, indicator) => calcMassIndex(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_LINREG',
    shortName: 'LinReg',
    series: 'price',
    calcParams: [14],
    figures: [{ key: 'linreg', title: 'LinReg: ', type: 'line' }],
    calc: (dataList, indicator) => calcLinreg(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_LINREG_SLOPE',
    shortName: 'Slope',
    calcParams: [14],
    figures: [{ key: 'slope', title: 'Slope: ', type: 'line' }],
    calc: (dataList, indicator) => calcLinregSlope(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_KLINGER',
    shortName: 'Klinger',
    calcParams: [34, 55, 13],
    figures: [
      { key: 'klinger', title: 'Klinger: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcKlinger(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_KAMA',
    shortName: 'KAMA',
    series: 'price',
    calcParams: [10, 2, 30],
    figures: [{ key: 'kama', title: 'KAMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcKama(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_STDDEV',
    shortName: 'StdDev',
    calcParams: [20],
    figures: [{ key: 'stddev', title: 'StdDev: ', type: 'line' }],
    calc: (dataList, indicator) => calcStdDev(dataList, indicator),
  });

  // Batch 3 Custom Indicators
  registerIndicator({
    name: 'AL_ICHIMOKU',
    shortName: 'Ichimoku',
    series: 'price',
    calcParams: [9, 26, 52, 26],
    figures: [
      { key: 'conversion', title: 'Tenkan: ', type: 'line' },
      { key: 'base', title: 'Kijun: ', type: 'line' },
      { key: 'spanA', title: 'Senkou A: ', type: 'line' },
      { key: 'spanB', title: 'Senkou B: ', type: 'line' },
      { key: 'lagging', title: 'Chikou: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcIchimoku(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_CONNORS_RSI',
    shortName: 'CRSI',
    calcParams: [3, 2, 100],
    figures: [{ key: 'connorsRsi', title: 'CRSI: ', type: 'line' }],
    calc: (dataList, indicator) => calcConnorsRsi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_CHANDE_KROLL',
    shortName: 'ChandeKroll',
    series: 'price',
    calcParams: [10, 1, 9],
    figures: [
      { key: 'longStop', title: 'Stop L: ', type: 'line' },
      { key: 'shortStop', title: 'Stop S: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcChandeKroll(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_HIST_VOL',
    shortName: 'HV',
    calcParams: [20, 365],
    figures: [{ key: 'histVol', title: 'HV: ', type: 'line' }],
    calc: (dataList, indicator) => calcHistVol(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_WILLIAMS_ALLIGATOR',
    shortName: 'Alligator',
    series: 'price',
    calcParams: [13, 8, 8, 5, 5, 3],
    figures: [
      { key: 'jaw', title: 'Jaw: ', type: 'line' },
      { key: 'teeth', title: 'Teeth: ', type: 'line' },
      { key: 'lips', title: 'Lips: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcWilliamsAlligator(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_BOP',
    shortName: 'BOP',
    calcParams: [],
    figures: [{ key: 'bop', title: 'BOP: ', type: 'line' }],
    calc: (dataList) => calcBop(dataList),
  });

  registerIndicator({
    name: 'AL_CHAIKIN_VOL',
    shortName: 'ChaikinVol',
    calcParams: [10, 10],
    figures: [{ key: 'chaikinVol', title: 'CHV: ', type: 'line' }],
    calc: (dataList, indicator) => calcChaikinVol(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_COPPOCK',
    shortName: 'Coppock',
    calcParams: [14, 11, 10],
    figures: [{ key: 'coppock', title: 'Coppock: ', type: 'line' }],
    calc: (dataList, indicator) => calcCoppock(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_DPO',
    shortName: 'DPO',
    calcParams: [20],
    figures: [{ key: 'dpo', title: 'DPO: ', type: 'line' }],
    calc: (dataList, indicator) => calcDpo(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_EOM',
    shortName: 'EOM',
    calcParams: [14],
    figures: [{ key: 'eom', title: 'EOM: ', type: 'line' }],
    calc: (dataList, indicator) => calcEom(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_GMMA',
    shortName: 'GMMA',
    series: 'price',
    calcParams: [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60],
    figures: [
      { key: 'ema3', title: 'EMA3: ', type: 'line' },
      { key: 'ema5', title: 'EMA5: ', type: 'line' },
      { key: 'ema8', title: 'EMA8: ', type: 'line' },
      { key: 'ema10', title: 'EMA10: ', type: 'line' },
      { key: 'ema12', title: 'EMA12: ', type: 'line' },
      { key: 'ema15', title: 'EMA15: ', type: 'line' },
      { key: 'ema30', title: 'EMA30: ', type: 'line' },
      { key: 'ema35', title: 'EMA35: ', type: 'line' },
      { key: 'ema40', title: 'EMA40: ', type: 'line' },
      { key: 'ema45', title: 'EMA45: ', type: 'line' },
      { key: 'ema50', title: 'EMA50: ', type: 'line' },
      { key: 'ema60', title: 'EMA60: ', type: 'line' },
    ],
    calc: (dataList) => calcGmma(dataList),
  });

  registerIndicator({
    name: 'AL_MCGINLEY',
    shortName: 'McGinley',
    series: 'price',
    calcParams: [14],
    figures: [{ key: 'mcginley', title: 'MD: ', type: 'line' }],
    calc: (dataList, indicator) => calcMcGinley(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_RVI',
    shortName: 'RVI',
    calcParams: [10, 4],
    figures: [
      { key: 'rvi', title: 'RVI: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcRvi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_TSI',
    shortName: 'TSI',
    calcParams: [25, 13, 7],
    figures: [
      { key: 'tsi', title: 'TSI: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcTsi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_VOLUME_OSC',
    shortName: 'VolOsc',
    calcParams: [5, 10],
    figures: [{ key: 'volOsc', title: 'VolOsc: ', type: 'line' }],
    calc: (dataList, indicator) => calcVolumeOsc(dataList, indicator),
  });

  // Batch 4 Custom Indicators
  registerIndicator({
    name: 'AL_ADL',
    shortName: 'ADL',
    calcParams: [],
    figures: [{ key: 'adl', title: 'ADL: ', type: 'line' }],
    calc: (dataList) => calcAdl(dataList),
  });

  registerIndicator({
    name: 'AL_BULL_BEAR_POWER',
    shortName: 'BBP',
    calcParams: [13],
    figures: [
      { key: 'bull', title: 'Bull: ', type: 'line' },
      { key: 'bear', title: 'Bear: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcBullBearPower(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_KST',
    shortName: 'KST',
    calcParams: [10, 15, 20, 30, 10, 10, 10, 15, 9],
    figures: [
      { key: 'kst', title: 'KST: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcKst(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_MEDIAN_PRICE',
    shortName: 'Median',
    series: 'price',
    calcParams: [],
    figures: [{ key: 'median', title: 'Median: ', type: 'line' }],
    calc: (dataList) => calcMedianPrice(dataList),
  });

  registerIndicator({
    name: 'AL_NET_VOLUME',
    shortName: 'NetVol',
    calcParams: [],
    figures: [{ key: 'netVolume', title: 'NetVol: ', type: 'line' }],
    calc: (dataList) => calcNetVolume(dataList),
  });

  registerIndicator({
    name: 'AL_NVI',
    shortName: 'NVI',
    calcParams: [1000],
    figures: [{ key: 'nvi', title: 'NVI: ', type: 'line' }],
    calc: (dataList, indicator) => calcNvi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_PVI',
    shortName: 'PVI',
    calcParams: [1000],
    figures: [{ key: 'pvi', title: 'PVI: ', type: 'line' }],
    calc: (dataList, indicator) => calcPvi(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_PPO',
    shortName: 'PPO',
    calcParams: [12, 26, 9],
    figures: [
      { key: 'ppo', title: 'PPO: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
      { key: 'histogram', title: 'Hist: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcPpo(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_RCI',
    shortName: 'RCI',
    calcParams: [14],
    figures: [{ key: 'rci', title: 'RCI: ', type: 'line' }],
    calc: (dataList, indicator) => calcRci(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_SMMA',
    shortName: 'SMMA',
    series: 'price',
    calcParams: [14],
    figures: [{ key: 'smma', title: 'SMMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcSmma(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_ZLEMA',
    shortName: 'ZLEMA',
    series: 'price',
    calcParams: [20],
    figures: [{ key: 'zlema', title: 'ZLEMA: ', type: 'line' }],
    calc: (dataList, indicator) => calcZlema(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_HAMMING_MA',
    shortName: 'Hamming',
    series: 'price',
    calcParams: [20],
    figures: [{ key: 'hammingMa', title: 'Hamming: ', type: 'line' }],
    calc: (dataList, indicator) => calcHammingMa(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_CHANDELIER_EXIT',
    shortName: 'Chandelier',
    series: 'price',
    calcParams: [22, 3],
    figures: [
      { key: 'longExit', title: 'Long Exit: ', type: 'line' },
      { key: 'shortExit', title: 'Short Exit: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcChandelierExit(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_SMI_ERGODIC',
    shortName: 'SMI',
    calcParams: [5, 20, 5],
    figures: [
      { key: 'smi', title: 'SMI: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcSmiErgodic(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_VOLUME_ROC',
    shortName: 'VROC',
    calcParams: [14],
    figures: [{ key: 'vroc', title: 'VROC: ', type: 'line' }],
    calc: (dataList, indicator) => calcVolumeRoc(dataList, indicator),
  });

  // Batch 5 Custom Indicators
  registerIndicator({
    name: 'AL_ACCELERATOR',
    shortName: 'AC',
    calcParams: [5, 34, 5],
    figures: [{ key: 'ac', title: 'AC: ', type: 'line' }],
    calc: (dataList, indicator) => calcAccelerator(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_AVERAGE_PRICE',
    shortName: 'AvgPrice',
    series: 'price',
    calcParams: [],
    figures: [{ key: 'averagePrice', title: 'Avg Price: ', type: 'line' }],
    calc: (dataList) => calcAveragePrice(dataList),
  });

  registerIndicator({
    name: 'AL_TYPICAL_PRICE',
    shortName: 'TypPrice',
    series: 'price',
    calcParams: [],
    figures: [{ key: 'typicalPrice', title: 'Typ Price: ', type: 'line' }],
    calc: (dataList) => calcTypicalPrice(dataList),
  });

  registerIndicator({
    name: 'AL_MA_CROSS',
    shortName: 'MACross',
    series: 'price',
    calcParams: [9, 21],
    figures: [
      { key: 'fast', title: 'Fast: ', type: 'line' },
      { key: 'slow', title: 'Slow: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcMaCross(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_EMA_CROSS',
    shortName: 'EMACross',
    series: 'price',
    calcParams: [9, 21],
    figures: [
      { key: 'fast', title: 'Fast: ', type: 'line' },
      { key: 'slow', title: 'Slow: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcEmaCross(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_MA_EMA_CROSS',
    shortName: 'MAEMACross',
    series: 'price',
    calcParams: [20, 20],
    figures: [
      { key: 'sma', title: 'SMA: ', type: 'line' },
      { key: 'ema', title: 'EMA: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcMaEmaCross(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_MAJORITY_RULE',
    shortName: 'Majority',
    calcParams: [14],
    figures: [{ key: 'majority', title: 'Majority: ', type: 'line' }],
    calc: (dataList, indicator) => calcMajorityRule(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_RELATIVE_VOLATILITY',
    shortName: 'RVI_Dorsey',
    calcParams: [10, 14],
    figures: [{ key: 'relativeVolatility', title: 'RVI: ', type: 'line' }],
    calc: (dataList, indicator) => calcRelativeVolatility(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_STANDARD_ERROR',
    shortName: 'StdErr',
    calcParams: [20],
    figures: [{ key: 'standardError', title: 'StdErr: ', type: 'line' }],
    calc: (dataList, indicator) => calcStandardError(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_STANDARD_ERROR_BANDS',
    shortName: 'StdErrBands',
    series: 'price',
    calcParams: [20, 2],
    figures: [
      { key: 'upper', title: 'Upper: ', type: 'line' },
      { key: 'middle', title: 'Middle: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcStandardErrorBands(dataList, indicator),
  });

  // Batch 6 Custom Indicators
  registerIndicator({
    name: 'AL_TREND_STRENGTH',
    shortName: 'TrendStrength',
    calcParams: [14],
    figures: [{ key: 'trendStrength', title: 'TSI Trend: ', type: 'line' }],
    calc: (dataList, indicator) => calcTrendStrength(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_MA_CHANNEL',
    shortName: 'MAChannel',
    series: 'price',
    calcParams: [20],
    figures: [
      { key: 'upper', title: 'Upper: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' },
    ],
    calc: (dataList, indicator) => calcMaChannel(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_VOL_ZERO_TREND_CTC',
    shortName: 'VolCTC',
    calcParams: [10, 252],
    figures: [{ key: 'volatility', title: 'Vol CTC: ', type: 'line' }],
    calc: (dataList, indicator) => calcVolZeroTrendCtc(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_VOL_OHLC',
    shortName: 'VolOHLC',
    calcParams: [10, 252],
    figures: [{ key: 'volatility', title: 'Vol OHLC: ', type: 'line' }],
    calc: (dataList, indicator) => calcVolOhlc(dataList, indicator),
  });

  registerIndicator({
    name: 'AL_PIVOT_DAILY_TRADITIONAL',
    shortName: 'DailyPivots',
    series: 'price',
    calcParams: [],
    figures: [
      { key: 'p', title: 'P: ', type: 'line' },
      { key: 'r1', title: 'R1: ', type: 'line' },
      { key: 'r2', title: 'R2: ', type: 'line' },
      { key: 'r3', title: 'R3: ', type: 'line' },
      { key: 's1', title: 'S1: ', type: 'line' },
      { key: 's2', title: 'S2: ', type: 'line' },
      { key: 's3', title: 'S3: ', type: 'line' },
    ],
    calc: (dataList) => calcTraditionalUtcDailyPivots(dataList),
  });
  registerIndicator({
    name: 'AL_WILLIAMS_FRACTAL',
    shortName: 'Fractals',
    series: 'price',
    calcParams: [2],
    figures: [
      { key: 'upFractal', title: 'Up: ', type: 'circle' },
      { key: 'downFractal', title: 'Down: ', type: 'circle' },
    ],
    calc: (dataList, indicator) => calcWilliamsFractal(dataList, indicator),
  });
}

const EMA_FALLBACK_COLORS = [
  '#2563EB',
  '#F59E0B',
  '#7C3AED',
  '#DC2626',
  '#059669',
];

function syncAverage(
  chart: Chart,
  name: string,
  shortName: string,
  rows: MaBandRow[],
  visible = true,
) {
  const existing = chart.getIndicators({ name });
  const activeRows = rows.filter(
    (row) =>
      row.enabled &&
      Number.isFinite(Number(row.period)) &&
      Number(row.period) > 0,
  );

  if (!visible || !activeRows.length) {
    if (existing.length) chart.removeIndicator({ name });
    return;
  }

  const calcParams = activeRows.map((row) =>
    Math.max(1, Math.round(Number(row.period))),
  );

  const styles = {
    lines: activeRows.map((row, index) => {
      const validColor =
        typeof row.color === 'string' &&
        row.color.trim() !== '' &&
        row.color !== '#ffffff' &&
        row.color !== '#fff';
      const color = validColor
        ? row.color
        : EMA_FALLBACK_COLORS[index % EMA_FALLBACK_COLORS.length];
      const size = ([1, 2, 3, 4] as const).includes(
        Number(row.lineWidth) as 1 | 2 | 3 | 4,
      )
        ? (Number(row.lineWidth) as 1 | 2 | 3 | 4)
        : 1;
      return { color, size };
    }),
    tooltip: overlayTooltip(),
  };

  const payload = {
    name,
    shortName,
    visible: true,
    calcParams,
    extendData: { sources: activeRows.map((r) => r.source) } satisfies AvgExtend,
    paneId: 'candle_pane',
    styles,
  };

  if (existing.length) {
    chart.overrideIndicator(payload);
    return;
  }
  chart.createIndicator(payload, true);
}

type IndicatorDirectionalRenderStyle = {
  style?: 'fill' | 'stroke' | 'stroke_fill';
  borderStyle?: 'solid' | 'dashed';
  borderSize?: number;
  upColor: string;
  downColor: string;
  noChangeColor: string;
};

type IndicatorCircleRenderStyle = {
  style?: 'fill' | 'stroke' | 'stroke_fill';
  borderStyle?: 'solid' | 'dashed';
  borderSize?: number;
  upColor: string;
  downColor: string;
  noChangeColor: string;
};

function syncNamed(
  chart: Chart,
  name: string,
  on: boolean,
  opts: {
    overlay?: boolean;
    calcParams?: number[];
    styles?: {
      lines?: {
        color: string;
        size?: number;
      }[];

      bars?:
        IndicatorDirectionalRenderStyle[];

      circles?:
        IndicatorCircleRenderStyle[];
    };
    visible?: boolean;
  } = {},
) {
  const existing =
    chart.getIndicators({
      name,
    });

  if (!on) {
    if (existing.length) {
      chart.removeIndicator({
        name,
      });
    }
    return;
  }

  if (existing.length > 1) {
    chart.removeIndicator({
      name,
    });
  }

  const payload = {
    name,

    visible:
      opts.visible !== false,

    calcParams:
      opts.calcParams,

    styles: {
      ...opts.styles,

      ...(opts.overlay
        ? {
            tooltip:
              overlayTooltip(),
          }
        : {}),
    },

    ...(opts.overlay
      ? {
          paneId:
            'candle_pane',
        }
      : {}),
  };

  if (
    existing.length === 1
  ) {
    chart.overrideIndicator(
      payload,
    );
    return;
  }

  chart.createIndicator(
    payload,
    !!opts.overlay,
  );
}

const LEGEND_LEFT = 28;

/** Candle tooltip: OHLCV only — no time (crosshair / axis already show it). */
const OHLCV_LEGEND_TEMPLATE = [
  { title: 'O: ', value: '{open}' },
  { title: 'H: ', value: '{high}' },
  { title: 'L: ', value: '{low}' },
  { title: 'C: ', value: '{close}' },
  { title: 'V: ', value: '{volume}' },
];

function candleOhlcvTooltip(show: boolean) {
  return {
    showRule: (show ? 'always' : 'none') as 'always' | 'none',
    offsetLeft: LEGEND_LEFT,
    offsetTop: 6,
    title: { show: false },
    legend: {
      size: 11,
      marginTop: 2,
      marginBottom: 2,
      template: OHLCV_LEGEND_TEMPLATE,
    },
  };
}

function overlayTooltip() {
  return { offsetLeft: LEGEND_LEFT, showRule: 'none' as const };
}

function applyLegendVisibility(chart: Chart, collapsed: boolean, showOhlcv: boolean) {
  chart.setStyles({
    candle: { tooltip: candleOhlcvTooltip(!collapsed && showOhlcv) },
    indicator: { tooltip: { showRule: 'none', offsetLeft: LEGEND_LEFT } },
  });
}

const NEON = '#4ef2bb';

export function applyChartDisplay(
  chart: Chart,
  opts: { mode: ChartMode; showHighLow: boolean; showOhlcv: boolean; legendCollapsed?: boolean },
) {
  const isLine = opts.mode === 'line';
  const isLineMarkers = opts.mode === 'lineMarkers';
  const isArea = opts.mode === 'area';

  const candleType =
    opts.mode === 'candle'
      ? 'candle_solid'
      : opts.mode === 'hollow'
      ? 'candle_stroke'
      : opts.mode === 'hollowUp'
      ? 'candle_up_stroke'
      : opts.mode === 'hollowDown'
      ? 'candle_down_stroke'
      : opts.mode === 'bars'
      ? 'ohlc'
      : 'area';

  chart.setStyles({
    candle: {
      type: candleType as any,
      area: {
        lineSize: 2,
        lineColor: NEON,
        smooth: isArea,
        backgroundColor: isArea
          ? [
              { offset: 0, color: 'rgba(78, 242, 187, 0.32)' },
              { offset: 1, color: 'rgba(78, 242, 187, 0.02)' },
            ]
          : [
              { offset: 0, color: 'rgba(0, 0, 0, 0)' },
              { offset: 1, color: 'rgba(0, 0, 0, 0)' },
            ],
        point: {
          show: isLineMarkers,
          color: NEON,
          radius: 3,
          rippleColor: 'rgba(78, 242, 187, 0.35)',
          rippleRadius: 6,
          animation: false,
        },
      },
      priceMark: {
        high: { show: opts.showHighLow },
        low: { show: opts.showHighLow },
      },
      tooltip: candleOhlcvTooltip(!opts.legendCollapsed && opts.showOhlcv),
    },
    indicator: { tooltip: { showRule: 'none', offsetLeft: LEGEND_LEFT } },
  });
}

export function applyIndicatorPrefs(
  chart: Chart,
  prefs: WebIndicatorPrefs,
  legendCollapsed = false,
  showOhlcv = true,
) {
  syncAverage(chart, EMA_WEB, 'EMA', prefs.emaRows, prefs.emaVisible);
  syncAverage(chart, MA_WEB, 'MA', prefs.maRows, prefs.maVisible);
  syncNamed(chart, VWAP_WEB, prefs.vwap, {
    overlay: true,
    visible: prefs.vwapVisible !== false,
    calcParams: [Math.max(2, prefs.vwapLength || 14)],
    styles: { lines: [{ color: prefs.vwapColor, size: prefs.vwapLineWidth || 2 }] },
  });
  syncNamed(chart, 'BOLL', prefs.boll, {
    overlay: true,
    visible: prefs.bollVisible !== false,
    calcParams: [Math.max(2, prefs.bollLength || 20), prefs.bollMult || 2],
    styles: {
      lines: prefs.bollColors.map((color, i) => ({
        color,
        size: prefs.bollLineWidths?.[i] ?? 1,
      })),
    },
  });
  syncNamed(chart, 'VOL', prefs.vol, {
    calcParams: prefs.volMaPeriods ?? [5, 10, 20],
    styles: {
      lines: (prefs.volMaColors ?? ['#FF9600', '#935EBD', '#1677FF']).map((color, i) => ({
        color,
        size: prefs.volMaLineWidths?.[i] ?? 1,
      })),
      bars:
        prefs.volBarStyle
          ? [
              {
                style:
                  'fill' as const,

                borderStyle:
                  'solid' as const,

                borderSize:
                  prefs.volBarStyle
                    .borderSize,

                upColor:
                  prefs.volBarStyle
                    .upColor,

                downColor:
                  prefs.volBarStyle
                    .downColor,

                noChangeColor:
                  prefs.volBarStyle
                    .noChangeColor,
              },
            ]
          : undefined,
    },
  });
  syncNamed(chart, 'MACD', prefs.macd, {
    calcParams: prefs.macdParams,
    styles: {
      lines: (prefs.macdColors ?? ['#F59E0B', '#22D3EE']).map((color, i) => ({
        color,
        size: prefs.macdLineWidths?.[i] ?? 1,
      })),
      bars:
        prefs.macdHistStyle
          ? [
              {
                style:
                  'fill' as const,

                borderStyle:
                  'solid' as const,

                borderSize:
                  prefs.macdHistStyle
                    .borderSize,

                upColor:
                  prefs.macdHistStyle
                    .upColor,

                downColor:
                  prefs.macdHistStyle
                    .downColor,

                noChangeColor:
                  prefs.macdHistStyle
                    .noChangeColor,
              },
            ]
          : undefined,
    },
  });

  const activeRsiRows = (prefs.rsiRows ?? [])
    .filter(
      (row) =>
        row.enabled &&
        Number.isFinite(Number(row.period)) &&
        Number(row.period) > 0,
    )
    .slice(0, RSI_BAND_SLOT_COUNT);

  const rsiOn = prefs.rsi && activeRsiRows.length > 0;
  syncNamed(chart, 'RSI', rsiOn, {
    calcParams: activeRsiRows.map((r) => r.period),
    styles: {
      lines: activeRsiRows.map((r) => ({ color: r.color, size: r.lineWidth || 1 })),
    },
  });

  syncNamed(chart, 'CCI', prefs.cci, {
    calcParams: [20],
    styles: {
      lines: [{ color: prefs.cciColor || '#22d3ee', size: prefs.cciLineWidth || 1 }],
    },
  });

  syncNamed(chart, SUPERTREND_WEB, prefs.supertrend, {
    overlay: true,
    calcParams: [prefs.supertrendPeriod, prefs.supertrendMultiplier],
    styles: { lines: [{ color: prefs.supertrendColor, size: prefs.supertrendLineWidth || 1 }] },
  });

  // Synchronize 18 built-in extra indicators
  if (Array.isArray(EXTRA_INDICATOR_SPECS)) {
    for (const spec of EXTRA_INDICATOR_SPECS) {
      const enabled = Array.isArray(prefs.extraIndicators) && prefs.extraIndicators.includes(spec.name);
      const userSetting =
        prefs.indicatorSettings?.[
          spec.name
        ];

      const calcParams =
        userSetting?.params &&
        userSetting.params.length ===
          spec.defaultParams.length
          ? userSetting.params
          : spec.defaultParams;

      const defaultColors =
        spec.defaultColors ??
        [
          '#FF9600',
          '#935EBD',
          '#1677FF',
          '#E11D74',
          '#01C5C4',
        ];

      const colors =
        userSetting?.colors &&
        userSetting.colors.length ===
          defaultColors.length
          ? userSetting.colors
          : defaultColors;

      const lineWidths =
        userSetting?.lineWidths;

      const styleKind =
        spec.styleKind ??
        'line';

      const styleOptions:
        {
          lines?: {
            color: string;
            size?: number;
          }[];

          bars?:
            IndicatorDirectionalRenderStyle[];

          circles?:
            IndicatorCircleRenderStyle[];
        } = {};

      if (
        styleKind === 'line'
      ) {
        styleOptions.lines =
          colors.map(
            (color, index) => ({
              color,
              size:
                lineWidths?.[
                  index
                ] ?? 1,
            }),
          );
      }

      if (
        styleKind === 'bar'
      ) {
        const bar =
          userSetting?.barStyle ??
          {
            upColor:
              '#2DC08E',

            downColor:
              '#F92855',

            noChangeColor:
              '#888888',

            borderSize:
              1 as const,
          };

        styleOptions.bars = [
          {
            style:
              'fill',

            borderStyle:
              'solid',

            borderSize:
              bar.borderSize,

            upColor:
              bar.upColor,

            downColor:
              bar.downColor,

            noChangeColor:
              bar.noChangeColor,
          },
        ];
      }

      if (
        styleKind === 'circle'
      ) {
        const circle =
          userSetting?.circleStyle ??
          {
            upColor:
              colors[0] ??
              '#2DC08E',

            downColor:
              colors[1] ??
              '#F92855',

            noChangeColor:
              '#888888',

            borderSize:
              1 as const,
          };

        styleOptions.circles = [
          {
            style:
              'fill',

            borderStyle:
              'solid',

            borderSize:
              circle.borderSize,

            upColor:
              circle.upColor,

            downColor:
              circle.downColor,

            noChangeColor:
              circle.noChangeColor,
          },
        ];
      }

      syncNamed(
        chart,
        spec.name,
        enabled,
        {
          overlay:
            spec.overlay,

          calcParams,

          styles:
            styleOptions,
        },
      );
    }
  }

  // Synchronize 75 custom indicators
  if (Array.isArray(CUSTOM_INDICATOR_SPECS)) {
    for (const spec of CUSTOM_INDICATOR_SPECS) {
      const enabled =
        Array.isArray(
          prefs.customIndicators
        ) &&
        prefs.customIndicators.includes(
          spec.id,
        );

      const userSetting =
        prefs.indicatorSettings?.[
          spec.id
        ];

      const calcParams =
        userSetting?.params &&
        userSetting.params.length ===
          spec.defaultParams.length
          ? userSetting.params
          : spec.defaultParams;

      const colors =
        userSetting?.colors &&
        userSetting.colors.length ===
          spec.colors.length
          ? userSetting.colors
          : spec.colors;

      const lineWidths =
        userSetting?.lineWidths;

      const styleKind =
        spec.styleKind ??
        'line';

      const styles:
        {
          lines?: {
            color: string;
            size?: number;
          }[];

          bars?:
            IndicatorDirectionalRenderStyle[];

          circles?:
            IndicatorCircleRenderStyle[];
        } = {};

      if (
        styleKind === 'line'
      ) {
        styles.lines =
          colors.map(
            (color, index) => ({
              color,
              size:
                lineWidths?.[
                  index
                ] ?? 1,
            }),
          );
      }

      if (
        styleKind === 'bar'
      ) {
        const bar =
          userSetting?.barStyle ??
          {
            upColor:
              colors[0] ??
              '#2DC08E',

            downColor:
              colors[1] ??
              '#F92855',

            noChangeColor:
              '#888888',

            borderSize:
              1 as const,
          };

        styles.bars = [
          {
            style:
              'fill',

            borderStyle:
              'solid',

            borderSize:
              bar.borderSize,

            upColor:
              bar.upColor,

            downColor:
              bar.downColor,

            noChangeColor:
              bar.noChangeColor,
          },
        ];
      }

      if (
        styleKind === 'circle'
      ) {
        const circle =
          userSetting?.circleStyle ??
          {
            upColor:
              colors[0] ??
              '#2DC08E',

            downColor:
              colors[1] ??
              '#F92855',

            noChangeColor:
              '#888888',

            borderSize:
              1 as const,
          };

        styles.circles = [
          {
            style:
              'fill',

            borderStyle:
              'solid',

            borderSize:
              circle.borderSize,

            upColor:
              circle.upColor,

            downColor:
              circle.downColor,

            noChangeColor:
              circle.noChangeColor,
          },
        ];
      }

      syncNamed(
        chart,
        spec.internalName,
        enabled,
        {
          overlay:
            spec.overlay,

          calcParams,

          styles,
        },
      );
    }
  }

  applyLegendVisibility(chart, legendCollapsed, showOhlcv);
}
