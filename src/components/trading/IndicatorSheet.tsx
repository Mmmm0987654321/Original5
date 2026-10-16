import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CHART_COLOR_PRESETS,
  DEFAULT_BOLL_COLORS,
  DEFAULT_EMA_ROWS,
  DEFAULT_INDICATOR_PREFS,
  DEFAULT_MA_ROWS,
  DEFAULT_RSI_ROWS,
  MA_BAND_SLOT_COUNT,
  MA_SOURCE_OPTIONS,
  EXTRA_INDICATOR_SPECS,
  CUSTOM_INDICATOR_SPECS,
  type DirectionalFigureStyle,
  type IndicatorLineWidth,
  type MaBandRow,
  type RsiBandRow,
  type WebIndicatorPrefs,
} from '../../lib/indicatorPrefs';
import { Check as CheckIcon, ChevronRight, X, Search, Star, SlidersHorizontal } from 'lucide-react';

type Section = 'library' | 'main' | 'sub';
type MainId = 'ma' | 'ema' | 'boll' | 'vwap' | 'supertrend';
type SubId = 'vol' | 'macd' | 'rsi' | 'cci';
type ColorPick =
  | { kind: 'ma' | 'ema'; index: number }
  | { kind: 'vwap' }
  | { kind: 'boll'; index: number }
  | { kind: 'supertrend' }
  | { kind: 'rsi'; index: number }
  | { kind: 'cci' }
  | { kind: 'universal'; indicatorId: string; index: number }
  | null;

type LibraryItem = {
  id: string;
  name: string;
  alias?: string;
  isOverlay: boolean;
};

const LIBRARY_BASE_9: LibraryItem[] = [
  { id: 'MA', name: 'Moving Average (MA)', alias: 'MA Simple Moving Average', isOverlay: true },
  { id: 'EMA', name: 'Exponential Moving Average (EMA)', alias: 'EMA Exponential Moving Average', isOverlay: true },
  { id: 'BOLL', name: 'Bollinger Bands (BB)', alias: 'BOLL BB', isOverlay: true },
  { id: 'VWAP', name: 'VWAP', alias: 'Volume Weighted Average Price', isOverlay: true },
  { id: 'Supertrend', name: 'Supertrend', alias: 'SuperTrend', isOverlay: true },
  { id: 'VOL', name: 'Volume (VOL)', alias: 'Volume Histogram', isOverlay: false },
  { id: 'MACD', name: 'MACD', alias: 'Moving Average Convergence Divergence', isOverlay: false },
  { id: 'RSI', name: 'Relative Strength Index (RSI)', alias: 'RSI', isOverlay: false },
  { id: 'CCI', name: 'CCI', alias: 'Commodity Channel Index', isOverlay: false },
];

// Search aliases resolve to existing implemented indicators, never fake studies.
const EXTRA_ALIASES: Record<string, string> = {
  SMA: 'Simple Moving Average SMA 20 50',
  DMI: 'Average Directional Index (ADX) / Directional Movement Index DMI Plus DI Minus DI',
  MTM: 'Momentum',
  WR: 'Williams Percent Range Williams %R',
  AO: 'Awesome Oscillator',
  OBV: 'On-Balance Volume (OBV)',
  SAR: 'Parabolic SAR Stop And Reverse',
  PVT: 'Price Volume Trend PVT',
  ROC: 'Rate Of Change Rate of Change ROC',
};

export const ALL_INDICATORS: LibraryItem[] = [
  ...LIBRARY_BASE_9,
  ...EXTRA_INDICATOR_SPECS.map((spec) => ({
    id: spec.name,
    name: spec.name === 'DMI' ? 'Directional Movement Index (DMI / ADX)' : (spec.label || spec.name),
    alias: EXTRA_ALIASES[spec.name],
    isOverlay: spec.overlay,
  })),
  ...CUSTOM_INDICATOR_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.label,
    alias: spec.alias,
    isOverlay: spec.overlay,
  })),
];

type NavItem = {
  id: string;
  label: string;
  isBase?: boolean;
};

const ALL_MAIN_ITEMS: NavItem[] = [
  { id: 'ma', label: 'MA', isBase: true },
  { id: 'ema', label: 'EMA', isBase: true },
  { id: 'boll', label: 'BOLL', isBase: true },
  { id: 'vwap', label: 'VWAP', isBase: true },
  { id: 'supertrend', label: 'Supertrend', isBase: true },
  ...EXTRA_INDICATOR_SPECS.filter((s) => s.overlay).map((s) => ({ id: s.name, label: s.label })),
  ...CUSTOM_INDICATOR_SPECS.filter((s) => s.overlay).map((s) => ({ id: s.id, label: s.label })),
];

const ALL_SUB_ITEMS: NavItem[] = [
  { id: 'vol', label: 'VOL', isBase: true },
  { id: 'macd', label: 'MACD', isBase: true },
  { id: 'rsi', label: 'RSI', isBase: true },
  { id: 'cci', label: 'CCI', isBase: true },
  ...EXTRA_INDICATOR_SPECS.filter((s) => !s.overlay).map((s) => ({ id: s.name, label: s.label })),
  ...CUSTOM_INDICATOR_SPECS.filter((s) => !s.overlay).map((s) => ({ id: s.id, label: s.label })),
];

export function IndicatorSheet({
  open,
  prefs,
  onChange,
  onClose,
  initialSearchQuery = '',
}: {
  open: boolean;
  initialSearchQuery?: string;
  prefs: WebIndicatorPrefs;
  onChange: (next: WebIndicatorPrefs) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [mainId, setMainId] = useState<string>('ma');
  const [subId, setSubId] = useState<string>('vol');
  const [colorPick, setColorPick] = useState<ColorPick>(null);

  useEffect(() => {
    if (open) { setSection('library'); setSearchQuery(initialSearchQuery); }
  }, [open, initialSearchQuery]);

  useEffect(() => {
    if (!open) {
      setColorPick(null);
      setSearchQuery('');
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      if (colorPick) {
        setColorPick(null);
        return;
      }

      onClose();
    };

    window.addEventListener('keydown', onKey);

    return () =>
      window.removeEventListener('keydown', onKey);
  }, [open, onClose, colorPick]);

  if (!open) return null;

  const getIndicatorActive = (id: string): boolean => {
    switch (id) {
      case 'MA':
      case 'ma':
        return prefs.maVisible;
      case 'EMA':
      case 'ema':
        return prefs.emaVisible;
      case 'BOLL':
      case 'boll':
        return prefs.boll;
      case 'VWAP':
      case 'vwap':
        return prefs.vwap;
      case 'Supertrend':
      case 'supertrend':
        return prefs.supertrend;
      case 'VOL':
      case 'vol':
        return prefs.vol;
      case 'MACD':
      case 'macd':
        return prefs.macd;
      case 'RSI':
      case 'rsi':
        return prefs.rsi;
      case 'CCI':
      case 'cci':
        return prefs.cci;
      default:
        return (
          (Array.isArray(prefs.extraIndicators) && prefs.extraIndicators.includes(id)) ||
          (Array.isArray(prefs.customIndicators) && prefs.customIndicators.includes(id))
        );
    }
  };

  const handleToggleIndicator = (id: string) => {
    switch (id) {
      case 'MA':
      case 'ma': {
        const nextVisible = !prefs.maVisible;
        let nextRows = prefs.maRows;
        if (nextVisible && (!nextRows || !nextRows.some((r) => r.enabled))) {
          nextRows = (nextRows && nextRows.length ? nextRows : DEFAULT_MA_ROWS).map((r, i) => ({
            ...r,
            enabled: i < 3,
          }));
        }
        onChange({ ...prefs, maVisible: nextVisible, maRows: nextRows });
        break;
      }
      case 'EMA':
      case 'ema': {
        const nextVisible = !prefs.emaVisible;
        let nextRows = prefs.emaRows;
        if (nextVisible && (!nextRows || !nextRows.some((r) => r.enabled))) {
          nextRows = (nextRows && nextRows.length ? nextRows : DEFAULT_EMA_ROWS).map((r, i) => ({
            ...r,
            enabled: i < 3,
          }));
        }
        onChange({ ...prefs, emaVisible: nextVisible, emaRows: nextRows });
        break;
      }
      case 'BOLL':
      case 'boll':
        onChange({ ...prefs, boll: !prefs.boll });
        break;
      case 'VWAP':
      case 'vwap':
        onChange({ ...prefs, vwap: !prefs.vwap });
        break;
      case 'Supertrend':
      case 'supertrend':
        onChange({ ...prefs, supertrend: !prefs.supertrend });
        break;
      case 'VOL':
      case 'vol':
        onChange({ ...prefs, vol: !prefs.vol });
        break;
      case 'MACD':
      case 'macd':
        onChange({ ...prefs, macd: !prefs.macd });
        break;
      case 'RSI':
      case 'rsi':
        onChange({ ...prefs, rsi: !prefs.rsi });
        break;
      case 'CCI':
      case 'cci':
        onChange({ ...prefs, cci: !prefs.cci });
        break;
      default: {
        if (CUSTOM_INDICATOR_SPECS.some((s) => s.id === id)) {
          const current = Array.isArray(prefs.customIndicators) ? prefs.customIndicators : [];
          const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
          onChange({ ...prefs, customIndicators: next });
          break;
        }
        const current = Array.isArray(prefs.extraIndicators) ? prefs.extraIndicators : [];
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        onChange({ ...prefs, extraIndicators: next });
        break;
      }
    }
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = Array.isArray(prefs.indicatorFavorites) ? prefs.indicatorFavorites : [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ ...prefs, indicatorFavorites: next });
  };

  const colorValue = (() => {
    if (!colorPick) {
      return '#4ef2bb';
    }

    if (colorPick.kind === 'vwap') {
      return prefs.vwapColor;
    }

    if (colorPick.kind === 'supertrend') {
      return prefs.supertrendColor;
    }

    if (colorPick.kind === 'rsi') {
      const rows = prefs.rsiRows ?? DEFAULT_RSI_ROWS;
      return rows[colorPick.index]?.color ?? '#ec4899';
    }

    if (colorPick.kind === 'cci') {
      return prefs.cciColor || '#22d3ee';
    }

    if (colorPick.kind === 'boll') {
      return (
        prefs.bollColors[
          colorPick.index
        ] ?? '#4ef2bb'
      );
    }

    if (colorPick.kind === 'universal') {
      const customSpec = CUSTOM_INDICATOR_SPECS.find((s) => s.id === colorPick.indicatorId);
      const extraSpec = EXTRA_INDICATOR_SPECS.find((s) => s.name === colorPick.indicatorId);
      const defaultColors = customSpec?.colors ?? extraSpec?.defaultColors ?? ['#FF9600', '#935EBD', '#1677FF'];
      const userColors = prefs.indicatorSettings?.[colorPick.indicatorId]?.colors;
      return userColors?.[colorPick.index] ?? defaultColors[colorPick.index] ?? '#4ef2bb';
    }

    const rows =
      colorPick.kind === 'ema'
        ? prefs.emaRows
        : prefs.maRows;

    return (
      rows[colorPick.index]
        ?.color ?? '#4ef2bb'
    );
  })();

  const applyColor = (
    color: string,
  ) => {
    if (!colorPick) return;

    if (
      colorPick.kind ===
      'vwap'
    ) {
      onChange({
        ...prefs,
        vwapColor: color,
      });
    } else if (
      colorPick.kind ===
      'supertrend'
    ) {
      onChange({
        ...prefs,
        supertrendColor: color,
      });
    } else if (
      colorPick.kind ===
      'rsi'
    ) {
      const rows = prefs.rsiRows ?? DEFAULT_RSI_ROWS;
      onChange({
        ...prefs,
        rsiRows: rows.map((r, i) =>
          i === colorPick.index ? { ...r, color } : r
        ),
      });
    } else if (
      colorPick.kind ===
      'cci'
    ) {
      onChange({
        ...prefs,
        cciColor: color,
      });
    } else if (
      colorPick.kind ===
      'boll'
    ) {
      const next = [
        ...prefs.bollColors,
      ] as [
        string,
        string,
        string,
      ];

      next[
        colorPick.index
      ] = color;

      onChange({
        ...prefs,
        bollColors: next,
      });
    } else if (colorPick.kind === 'universal') {
      const customSpec = CUSTOM_INDICATOR_SPECS.find((s) => s.id === colorPick.indicatorId);
      const extraSpec = EXTRA_INDICATOR_SPECS.find((s) => s.name === colorPick.indicatorId);
      const defaultColors = customSpec?.colors ?? extraSpec?.defaultColors ?? ['#FF9600', '#935EBD', '#1677FF'];
      const currentColors = [...(prefs.indicatorSettings?.[colorPick.indicatorId]?.colors ?? defaultColors)];
      currentColors[colorPick.index] = color;
      const nextSettings = { ...(prefs.indicatorSettings ?? {}) };
      nextSettings[colorPick.indicatorId] = {
        ...(nextSettings[colorPick.indicatorId] ?? {}),
        colors: currentColors,
      };
      onChange({
        ...prefs,
        indicatorSettings: nextSettings,
      });
    } else {
      const key =
        colorPick.kind ===
        'ema'
          ? 'emaRows'
          : 'maRows';

      const list =
        colorPick.kind ===
        'ema'
          ? prefs.emaRows
          : prefs.maRows;

      onChange({
        ...prefs,

        [key]:
          list.map(
            (
              r,
              i,
            ) =>
              i ===
              colorPick.index
                ? {
                    ...r,
                    color,
                  }
                : r,
          ),
      });
    }

    setColorPick(null);
  };

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const filteredIndicators = ALL_INDICATORS.filter((item) => {
    if (!trimmedSearch) return true;
    const nameMatch = item.name.toLowerCase().includes(trimmedSearch);
    const aliasMatch = item.alias ? item.alias.toLowerCase().includes(trimmedSearch) : false;
    const idMatch = item.id.toLowerCase().includes(trimmedSearch);
    return nameMatch || aliasMatch || idMatch;
  });

  const favorites = Array.isArray(prefs.indicatorFavorites) ? prefs.indicatorFavorites : [];
  const favoriteItems = ALL_INDICATORS.filter((item) => favorites.includes(item.id));

  const renderIndicatorRow = (item: LibraryItem) => {
    const active = getIndicatorActive(item.id);
    const isFav = favorites.includes(item.id);

    return (
      <div
        key={item.id}
        className={`flex items-center justify-between p-2.5 sm:p-2 rounded-xl border transition-all select-none ${
          active
            ? 'bg-brand-overlay-normal border-accent/40 shadow-xs'
            : 'bg-brand-surface/40 border-brand-border/40 hover:bg-brand-overlay-subtle hover:border-brand-border'
        }`}
      >
        <div
          onClick={() => handleToggleIndicator(item.id)}
          className="flex items-center gap-2.5 min-w-0 pr-2 flex-1 cursor-pointer"
        >
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
              active
                ? 'bg-accent text-black border-accent'
                : 'border-brand-border bg-brand-surface text-transparent'
            }`}
          >
            <CheckIcon size={13} strokeWidth={3} className={active ? 'text-black' : 'opacity-0'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-text truncate">
                {item.name}
              </span>
              {item.isOverlay ? (
                <span className="text-[8px] font-mono font-bold uppercase px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-400 shrink-0">
                  Main
                </span>
              ) : (
                <span className="text-[8px] font-mono font-bold uppercase px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 shrink-0">
                  Sub
                </span>
              )}
            </div>
            {item.alias && (
              <p className="text-[10px] text-gray-500 truncate">
                {item.alias}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label={`Settings for ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (['MA', 'EMA', 'BOLL', 'VWAP', 'Supertrend'].includes(item.id)) {
                setMainId(item.id.toLowerCase() as MainId);
                setSection('main');
              } else if (['VOL', 'MACD', 'RSI', 'CCI'].includes(item.id)) {
                setSubId(item.id.toLowerCase() as SubId);
                setSection('sub');
              } else if (item.isOverlay) {
                setMainId(item.id);
                setSection('main');
              } else {
                setSubId(item.id);
                setSection('sub');
              }
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-brand-overlay-normal transition-colors cursor-pointer"
            title="Indicator settings"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            type="button"
            aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
            onClick={(e) => handleToggleFavorite(item.id, e)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isFav
                ? 'text-yellow-400 hover:bg-yellow-400/10'
                : 'text-gray-500 hover:text-gray-300 hover:bg-brand-overlay-normal'
            }`}
          >
            <Star size={14} className={isFav ? 'fill-yellow-400 text-yellow-400' : ''} />
          </button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[1px] touch-none sm:bg-black/55 sm:backdrop-blur-0"
        aria-label="Close"
        onClick={() => {
          if (colorPick) {
            setColorPick(null);
            return;
          }

          onClose();
        }}
      />

      <div className="relative flex h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-b-0 border-brand-border bg-brand-bg shadow-2xl sm:h-auto sm:max-h-[min(40rem,90vh)] sm:max-w-[46rem] sm:rounded-2xl sm:border-b">
        <div className="flex h-5 shrink-0 items-center justify-center sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex shrink-0 items-center gap-4 border-b border-brand-border px-4 pb-0 pt-0 sm:pt-0">
          {(
            [
              {
                id: 'library',
                label:
                  'Indicators',
              },
              {
                id: 'main',
                label:
                  'Main settings',
              },
              {
                id: 'sub',
                label:
                  'Sub settings',
              },
            ] as const
          ).map(
            (tab) => (
              <button
                key={
                  tab.id
                }
                type="button"
                onClick={() =>
                  setSection(
                    tab.id,
                  )
                }
                className={`relative py-3 text-[13px] font-bold cursor-pointer ${
                  section ===
                  tab.id
                    ? 'text-brand-text'
                    : 'text-brand-sub hover:text-brand-text'
                }`}
              >
                {
                  tab.label
                }

                {section ===
                tab.id ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
                ) : null}
              </button>
            ),
          )}

          <button
            type="button"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-brand-overlay-normal cursor-pointer text-gray-400 hover:text-brand-text"
            aria-label="Close"
            onClick={
              onClose
            }
          >
            <X
              size={
                16
              }
            />
          </button>
        </div>

        {section === 'library' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Search Input Bar */}
            <div className="p-3 border-b border-brand-border bg-brand-bg shrink-0">
              <div className="flex items-center gap-2 bg-brand-surface border border-brand-border rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search indicators..."
                  className="bg-transparent text-xs text-brand-text placeholder-gray-500 focus:outline-none w-full font-medium"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-brand-text p-0.5 rounded cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Indicator Library List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
              {/* Favorites Section */}
              {!trimmedSearch && favoriteItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-accent text-accent" />
                    <span>Favorites</span>
                  </div>
                  <div className="space-y-1.5">
                    {favoriteItems.map((item) => renderIndicatorRow(item))}
                  </div>
                </div>
              )}

              {/* All / Filtered Indicators Section */}
              <div className="space-y-1.5">
                {!trimmedSearch && (
                  <div className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    All Indicators ({ALL_INDICATORS.length})
                  </div>
                )}
                {filteredIndicators.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-500">
                    No indicators matching &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredIndicators.map((item) => renderIndicatorRow(item))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <div className="flex w-full shrink-0 overflow-x-auto border-b border-brand-border px-2 py-2 sm:block sm:w-[9.5rem] sm:overflow-y-auto sm:border-b-0 sm:border-r sm:px-0">
              {section === 'main'
                ? ALL_MAIN_ITEMS.map((item) => (
                    <NavRow
                      key={item.id}
                      label={item.label}
                      on={getIndicatorActive(item.id)}
                      active={mainId.toLowerCase() === item.id.toLowerCase() || mainId === item.id}
                      onSelect={() => setMainId(item.id)}
                      onToggle={() => handleToggleIndicator(item.id)}
                    />
                  ))
                : ALL_SUB_ITEMS.map((item) => (
                    <NavRow
                      key={item.id}
                      label={item.label}
                      on={getIndicatorActive(item.id)}
                      active={subId.toLowerCase() === item.id.toLowerCase() || subId === item.id}
                      onSelect={() => setSubId(item.id)}
                      onToggle={() => handleToggleIndicator(item.id)}
                    />
                  ))}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              {section === 'main' ? (
                mainId.toLowerCase() === 'ma' ? (
                  <AverageEditor
                    kind="ma"
                    prefs={prefs}
                    onChange={onChange}
                    onClose={onClose}
                    onPickColor={(index) => setColorPick({ kind: 'ma', index })}
                  />
                ) : mainId.toLowerCase() === 'ema' ? (
                  <AverageEditor
                    kind="ema"
                    prefs={prefs}
                    onChange={onChange}
                    onClose={onClose}
                    onPickColor={(index) => setColorPick({ kind: 'ema', index })}
                  />
                ) : mainId.toLowerCase() === 'boll' ? (
                  <BollEditor
                    prefs={prefs}
                    onChange={onChange}
                    onClose={onClose}
                    onPickColor={(index) => setColorPick({ kind: 'boll', index })}
                  />
                ) : mainId.toLowerCase() === 'vwap' ? (
                  <VwapEditor
                    prefs={prefs}
                    onChange={onChange}
                    onClose={onClose}
                    onPickColor={() => setColorPick({ kind: 'vwap' })}
                  />
                ) : mainId.toLowerCase() === 'supertrend' ? (
                  <SupertrendEditor
                    prefs={prefs}
                    onChange={onChange}
                    onClose={onClose}
                    onPickColor={() => setColorPick({ kind: 'supertrend' })}
                  />
                ) : (
                  <UniversalIndicatorEditor
                    indicatorId={mainId}
                    prefs={prefs}
                    onChange={onChange}
                    onClose={onClose}
                    onPickColor={(indicatorId, index) =>
                      setColorPick({ kind: 'universal', indicatorId, index })
                    }
                  />
                )
              ) : subId.toLowerCase() === 'vol' ? (
                <VolEditor
                  prefs={prefs}
                  onChange={onChange}
                  onClose={onClose}
                />
              ) : subId.toLowerCase() === 'macd' ? (
                <MacdEditor
                  prefs={prefs}
                  onChange={onChange}
                  onClose={onClose}
                />
              ) : subId.toLowerCase() === 'rsi' ? (
                <RsiEditor
                  prefs={prefs}
                  onChange={onChange}
                  onClose={onClose}
                  onPickColor={(index) => setColorPick({ kind: 'rsi', index })}
                />
              ) : subId.toLowerCase() === 'cci' ? (
                <CciEditor
                  prefs={prefs}
                  onChange={onChange}
                  onClose={onClose}
                  onPickColor={() => setColorPick({ kind: 'cci' })}
                />
              ) : (
                <UniversalIndicatorEditor
                  indicatorId={subId}
                  prefs={prefs}
                  onChange={onChange}
                  onClose={onClose}
                  onPickColor={(indicatorId, index) =>
                    setColorPick({ kind: 'universal', indicatorId, index })
                  }
                />
              )}
            </div>
          </div>
        )}

        {colorPick ? (
          <ColorPicker
            value={colorValue}
            onPick={applyColor}
            onClose={() => setColorPick(null)}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function LineWidthPicker({
  value,
  onChange,
}: {
  value:
    1 | 2 | 3 | 4;

  onChange:
    (
      value:
        1 | 2 | 3 | 4
    ) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {(
        [1,2,3,4] as const
      ).map(
        (width) => (
          <button
            key={width}
            type="button"
            onClick={() =>
              onChange(
                width,
              )
            }
            className={`h-7 w-7 rounded text-[11px] font-bold ${
              value === width
                ? 'bg-accent/10 text-accent'
                : 'bg-brand-overlay-normal text-brand-sub hover:text-brand-text'
            }`}
          >
            {width}
          </button>
        ),
      )}
    </div>
  );
}

function PaneHeightControl({
  value,
  onChange,
}: {
  value:
    number | undefined;

  onChange:
    (
      value:
        number | undefined
    ) => void;
}) {
  const custom =
    typeof value === 'number';

  return (
    <div className="mt-4 rounded-lg border border-brand-border/40 bg-brand-surface/30 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Pane Height
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onChange(
              undefined,
            )
          }
          className={`h-8 rounded-md px-3 text-[11px] font-semibold ${
            !custom
              ? 'bg-accent/10 text-accent'
              : 'bg-brand-overlay-normal text-brand-sub'
          }`}
        >
          Auto
        </button>

        <button
          type="button"
          onClick={() =>
            onChange(
              value ?? 100,
            )
          }
          className={`h-8 rounded-md px-3 text-[11px] font-semibold ${
            custom
              ? 'bg-accent/10 text-accent'
              : 'bg-brand-overlay-normal text-brand-sub'
          }`}
        >
          Custom
        </button>

        {custom ? (
          <input
            type="number"
            min={50}
            max={500}
            value={value}
            onChange={(e) => {
              const n =
                Math.round(
                  Number(
                    e.target.value,
                  ),
                );

              if (
                Number.isFinite(
                  n,
                )
              ) {
                onChange(
                  Math.max(
                    50,
                    Math.min(
                      500,
                      n,
                    ),
                  ),
                );
              }
            }}
            className="h-8 w-20 rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px] font-semibold text-brand-text outline-none focus:border-accent"
          />
        ) : null}
      </div>
    </div>
  );
}

function DirectionalStyleEditor({
  value,
  onChange,
  upLabel = 'Up',
  downLabel = 'Down',
}: {
  value:
    DirectionalFigureStyle;

  onChange:
    (
      value:
        DirectionalFigureStyle
    ) => void;

  upLabel?: string;
  downLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {[
        [
          'upColor',
          upLabel,
        ],
        [
          'downColor',
          downLabel,
        ],
        [
          'noChangeColor',
          'No Change',
        ],
      ].map(
        ([
          key,
          label,
        ]) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-[12px] text-brand-text">
              {label}
            </span>

            <input
              type="color"
              value={
                value[
                  key as
                    | 'upColor'
                    | 'downColor'
                    | 'noChangeColor'
                ]
              }
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]:
                    e.target
                      .value,
                })
              }
              className="h-8 w-12 cursor-pointer rounded border border-brand-border bg-transparent p-0.5"
            />
          </label>
        ),
      )}

      <label className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-brand-text">
          Border Width
        </span>

        <select
          value={
            value.borderSize
          }
          onChange={(e) =>
            onChange({
              ...value,

              borderSize:
                Number(
                  e.target
                    .value,
                ) as
                  0|1|2|3|4,
            })
          }
          className="h-8 rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px]"
        >
          {[0,1,2,3,4].map(
            (n) => (
              <option
                key={n}
                value={n}
              >
                {n}
              </option>
            ),
          )}
        </select>
      </label>
    </div>
  );
}

function UniversalIndicatorEditor({
  indicatorId,
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  indicatorId: string;
  prefs: WebIndicatorPrefs;
  onChange: (next: WebIndicatorPrefs) => void;
  onClose: () => void;
  onPickColor: (indicatorId: string, index: number) => void;
}) {
  const extraSpec = EXTRA_INDICATOR_SPECS.find((s) => s.name === indicatorId);
  const customSpec = CUSTOM_INDICATOR_SPECS.find((s) => s.id === indicatorId);
  const isCustom = !!customSpec;
  const isExtra = !!extraSpec;
  if (!isCustom && !isExtra) return null;

  const label = customSpec ? customSpec.label : extraSpec!.label;
  const alias = customSpec ? customSpec.alias : EXTRA_ALIASES[indicatorId];
  const overlay = customSpec ? customSpec.overlay : extraSpec!.overlay;
  const defaultParams = customSpec ? customSpec.defaultParams : extraSpec!.defaultParams;
  const paramLabels =
    (customSpec ? customSpec.paramLabels : extraSpec!.paramLabels) ??
    defaultParams.map((_, i) => `Parameter ${i + 1}`);
  const defaultColors =
    (customSpec ? customSpec.colors : extraSpec!.defaultColors) ?? [
      '#FF9600',
      '#935EBD',
      '#1677FF',
      '#E11D74',
      '#01C5C4',
    ];
  const colorLabels =
    (customSpec ? customSpec.colorLabels : extraSpec!.colorLabels) ??
    defaultColors.map((_, i) => `Line ${i + 1}`);

  const active = isCustom
    ? Array.isArray(prefs.customIndicators) && prefs.customIndicators.includes(indicatorId)
    : Array.isArray(prefs.extraIndicators) && prefs.extraIndicators.includes(indicatorId);

  const toggleActive = () => {
    if (isCustom) {
      const current = Array.isArray(prefs.customIndicators) ? prefs.customIndicators : [];
      const next = current.includes(indicatorId)
        ? current.filter((x) => x !== indicatorId)
        : [...current, indicatorId];
      onChange({ ...prefs, customIndicators: next });
    } else {
      const current = Array.isArray(prefs.extraIndicators) ? prefs.extraIndicators : [];
      const next = current.includes(indicatorId)
        ? current.filter((x) => x !== indicatorId)
        : [...current, indicatorId];
      onChange({ ...prefs, extraIndicators: next });
    }
  };

  const userSetting = prefs.indicatorSettings?.[indicatorId];
  const currentParams =
    userSetting?.params && userSetting.params.length === defaultParams.length
      ? userSetting.params
      : defaultParams;
  const currentColors =
    userSetting?.colors && userSetting.colors.length === defaultColors.length
      ? userSetting.colors
      : defaultColors;

  const styleKind =
    customSpec?.styleKind ??
    extraSpec?.styleKind ??
    'line';

  const currentLineWidths =
    userSetting?.lineWidths &&
    userSetting.lineWidths.length ===
      currentColors.length
      ? userSetting.lineWidths
      : currentColors.map(
          () =>
            1 as const,
        );

  const currentPaneHeight =
    userSetting?.paneHeight;

  const updateSetting = (
    patch:
      Partial<
        NonNullable<
          WebIndicatorPrefs[
            'indicatorSettings'
          ][string]
        >
      >,
  ) => {
    const nextSettings = {
      ...(prefs.indicatorSettings ??
        {}),
    };

    nextSettings[
      indicatorId
    ] = {
      ...(nextSettings[
        indicatorId
      ] ?? {}),
      ...patch,
    };

    onChange({
      ...prefs,
      indicatorSettings:
        nextSettings,
    });
  };

  const updateLineWidth = (
    index: number,
    value:
      1 | 2 | 3 | 4,
  ) => {
    const next =
      [...currentLineWidths];

    next[index] =
      value;

    updateSetting({
      lineWidths:
        next,
    });
  };

  const updatePaneHeight = (
    value:
      number | undefined,
  ) => {
    const nextSettings = {
      ...(prefs.indicatorSettings ??
        {}),
    };

    const current = {
      ...(nextSettings[
        indicatorId
      ] ?? {}),
    };

    if (
      value === undefined
    ) {
      delete current
        .paneHeight;
    } else {
      current.paneHeight =
        Math.max(
          50,
          Math.min(
            500,
            Math.round(
              value,
            ),
          ),
        );
    }

    nextSettings[
      indicatorId
    ] = current;

    onChange({
      ...prefs,
      indicatorSettings:
        nextSettings,
    });
  };

  const updateParam = (index: number, val: number) => {
    const nextParams = [...currentParams];
    nextParams[index] = val;
    const nextSettings = { ...(prefs.indicatorSettings ?? {}) };
    nextSettings[indicatorId] = {
      ...(nextSettings[indicatorId] ?? {}),
      params: nextParams,
    };
    onChange({
      ...prefs,
      indicatorSettings: nextSettings,
    });
  };

  const handleReset = () => {
    const nextSettings = { ...(prefs.indicatorSettings ?? {}) };
    delete nextSettings[indicatorId];
    onChange({
      ...prefs,
      indicatorSettings: nextSettings,
    });
  };

  const defaultDirectional:
    DirectionalFigureStyle = {
      upColor:
        currentColors[0] ??
        '#2DC08E',

      downColor:
        currentColors[1] ??
        '#F92855',

      noChangeColor:
        '#888888',

      borderSize:
        1,
    };

  const directionalStyle =
    styleKind === 'bar'
      ? (
          userSetting?.barStyle ??
          defaultDirectional
        )
      : (
          userSetting?.circleStyle ??
          defaultDirectional
        );

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-brand-text">{label}</h3>
            {overlay ? (
              <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                Main
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                Sub
              </span>
            )}
          </div>
          {alias && <p className="text-[11px] text-gray-500 mt-0.5">{alias}</p>}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between p-2 rounded-lg bg-brand-surface/50 border border-brand-border/40">
        <span className="text-[12px] font-semibold text-brand-text">Show on chart</span>
        <Check on={active} onClick={toggleActive} />
      </div>

      {defaultParams.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
            Parameters
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {defaultParams.map((defVal, idx) => {
              const pLabel = paramLabels[idx] || `Param ${idx + 1}`;
              const val = currentParams[idx] ?? defVal;
              return (
                <label key={idx} className="block min-w-0">
                  <span className="mb-1 block text-[11px] text-brand-sub truncate" title={pLabel}>
                    {pLabel}
                  </span>
                  <input
                    type="number"
                    step={Number.isInteger(defVal) ? '1' : '0.01'}
                    value={val}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      if (Number.isFinite(num)) {
                        updateParam(idx, num);
                      }
                    }}
                    className="h-8 w-full rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px] font-semibold text-brand-text outline-none focus:border-accent"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {styleKind === 'line' &&
       defaultColors.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
            Style
          </p>

          <div className="divide-y divide-brand-border/40 rounded-lg border border-brand-border/40 bg-brand-surface/30 px-3">
            {defaultColors.map(
              (
                defColor,
                idx,
              ) => {
                const cLabel =
                  colorLabels[idx] ??
                  `Line ${idx + 1}`;

                const color =
                  currentColors[idx] ??
                  defColor;

                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-[7rem] flex-1 truncate text-[12px] font-medium text-brand-text">
                      {cLabel}
                    </span>

                    <button
                      type="button"
                      title={`Change ${cLabel} color`}
                      onClick={() =>
                        onPickColor(
                          indicatorId,
                          idx,
                        )
                      }
                      className="h-7 w-7 shrink-0 rounded-md border-2"
                      style={{
                        borderColor:
                          color,
                        background:
                          color,
                      }}
                    />

                    <LineWidthPicker
                      value={
                        currentLineWidths[
                          idx
                        ] ?? 1
                      }
                      onChange={(
                        width,
                      ) =>
                        updateLineWidth(
                          idx,
                          width,
                        )
                      }
                    />
                  </div>
                );
              },
            )}
          </div>
        </div>
      ) : null}

      {styleKind === 'bar' ? (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
            Style
          </p>
          <div className="rounded-lg border border-brand-border/40 bg-brand-surface/30 p-3">
            <DirectionalStyleEditor
              value={
                directionalStyle
              }
              onChange={(
                next,
              ) =>
                updateSetting({
                  barStyle:
                    next,
                })
              }
            />
          </div>
        </div>
      ) : null}

      {styleKind === 'circle' ? (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
            Style
          </p>
          <div className="rounded-lg border border-brand-border/40 bg-brand-surface/30 p-3">
            <DirectionalStyleEditor
              value={
                directionalStyle
              }
              upLabel={
                indicatorId ===
                'WILLIAMS_FRACTAL'
                  ? 'Up Fractal'
                  : 'Up'
              }
              downLabel={
                indicatorId ===
                'WILLIAMS_FRACTAL'
                  ? 'Down Fractal'
                  : 'Down'
              }
              onChange={(
                next,
              ) =>
                updateSetting({
                  circleStyle:
                    next,
                })
              }
            />
          </div>
        </div>
      ) : null}

      {!overlay ? (
        <PaneHeightControl
          value={
            currentPaneHeight
          }
          onChange={
            updatePaneHeight
          }
        />
      ) : null}

      <Footer onReset={handleReset} onDone={onClose} />
    </div>
  );
}

function NavRow({
  label,
  on,
  active,
  onSelect,
  onToggle,
}: {
  label: string;
  on: boolean;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex min-w-[7rem] shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 sm:min-w-0 sm:rounded-none ${
        active
          ? 'bg-brand-overlay-normal'
          : 'hover:bg-brand-overlay-subtle'
      }`}
    >
      <Check
        on={on}
        onClick={
          onToggle
        }
      />

      <button
        type="button"
        onClick={
          onSelect
        }
        className="flex min-w-0 flex-1 items-center justify-between text-left"
      >
        <span
          className={`truncate text-[12px] font-semibold ${
            active ||
            on
              ? 'text-brand-text'
              : 'text-brand-sub'
          }`}
        >
          {label}
        </span>

        <ChevronRight
          size={12}
          className="text-brand-sub"
        />
      </button>
    </div>
  );
}

function AverageEditor({
  kind,
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  kind:
    | 'ma'
    | 'ema';
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
  onPickColor: (
    index: number,
  ) => void;
}) {
  const rows =
    (
      kind ===
      'ema'
        ? prefs.emaRows
        : prefs.maRows
    ).slice(
      0,
      MA_BAND_SLOT_COUNT,
    );

  const rowKey =
    kind === 'ema'
      ? 'emaRows'
      : 'maRows';

  const visible =
    kind === 'ema'
      ? prefs.emaVisible
      : prefs.maVisible;

  const patchRow = (
    index: number,
    patch:
      Partial<MaBandRow>,
  ) => {
    onChange({
      ...prefs,

      [rowKey]:
        rows.map(
          (
            r,
            i,
          ) =>
            i ===
            index
              ? {
                  ...r,
                  ...patch,
                }
              : r,
        ),
    });
  };

  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        {kind ===
        'ema'
          ? 'EMA — Exponential MA'
          : 'MA — Moving Average'}
      </h3>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            visible
          }
          onClick={() =>
            onChange({
              ...prefs,

              ...(kind ===
              'ema'
                ? {
                    emaVisible:
                      !prefs.emaVisible,
                  }
                : {
                    maVisible:
                      !prefs.maVisible,
                  }),
            })
          }
        />
      </div>

      <div className="divide-y divide-brand-border">
        {rows.map(
          (
            row,
            index,
          ) => (
            <div
              key={`${kind}-${index}`}
              className="flex items-center gap-2 py-2"
            >
              <Check
                on={
                  row.enabled
                }
                onClick={() =>
                  patchRow(
                    index,
                    {
                      enabled:
                        !row.enabled,
                    },
                  )
                }
              />

              <span className="w-11 shrink-0 text-[11px] font-bold text-brand-muted">
                {kind ===
                'ema'
                  ? `EMA${index + 1}`
                  : `MA${index + 1}`}
              </span>

              <input
                inputMode="numeric"
                maxLength={
                  3
                }
                value={
                  row.period ===
                  0
                    ? ''
                    : String(
                        row.period,
                      )
                }
                onChange={(
                  e,
                ) => {
                  const cleaned =
                    e.target.value.replace(
                      /[^0-9]/g,
                      '',
                    );

                  patchRow(
                    index,
                    {
                      period:
                        cleaned ===
                        ''
                          ? 0
                          : Number(
                              cleaned,
                            ),
                    },
                  );
                }}
                className="h-8 w-14 rounded-md border border-brand-border bg-brand-overlay-normal px-1.5 text-center text-[12px] font-semibold text-brand-text outline-none focus:border-accent"
              />

              <select
                value={
                  row.source
                }
                onChange={(
                  e,
                ) =>
                  patchRow(
                    index,
                    {
                      source:
                        e.target
                          .value as MaBandRow['source'],
                    },
                  )
                }
                className="h-8 min-w-0 flex-1 rounded-md border border-brand-border bg-brand-overlay-normal px-1.5 text-[11px] font-semibold text-brand-text outline-none focus:border-accent"
              >
                {MA_SOURCE_OPTIONS.map(
                  (
                    opt,
                  ) => (
                    <option
                      key={
                        opt.id
                      }
                      value={
                        opt.id
                      }
                    >
                      {
                        opt.label
                      }
                    </option>
                  ),
                )}
              </select>

              <button
                type="button"
                title="Line color"
                onClick={() =>
                  onPickColor(
                    index,
                  )
                }
                className="h-7 w-7 shrink-0 rounded-md border-2"
                style={{
                  borderColor:
                    row.color,
                  background:
                    row.color,
                }}
              />

              <LineWidthPicker
                value={
                  row.lineWidth ??
                  1
                }
                onChange={(
                  lineWidth,
                ) =>
                  patchRow(
                    index,
                    {
                      lineWidth,
                    },
                  )
                }
              />
            </div>
          ),
        )}
      </div>

      <Footer
        onReset={() => {
          const defaults =
            kind ===
            'ema'
              ? DEFAULT_EMA_ROWS
              : DEFAULT_MA_ROWS;

          onChange({
            ...prefs,

            [rowKey]:
              defaults.map(
                (
                  r,
                ) => ({
                  ...r,
                }),
              ),
          });
        }}
        onDone={
          onClose
        }
      />
    </div>
  );
}

function BollEditor({
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
  onPickColor: (
    index: number,
  ) => void;
}) {
  const bands: {
    label: string;
    index: number;
  }[] = [
    {
      label: 'UP',
      index: 0,
    },
    {
      label:
        'MID',
      index: 1,
    },
    {
      label: 'DN',
      index: 2,
    },
  ];

  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        BOLL — Bollinger Bands
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            prefs.boll
          }
          onClick={() =>
            onChange({
              ...prefs,
              boll:
                !prefs.boll,
            })
          }
        />
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Parameters
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <NumField
          label="Length"
          value={
            prefs.bollLength
          }
          onChange={(
            n,
          ) =>
            onChange({
              ...prefs,
              bollLength:
                n,
            })
          }
        />

        <label className="block">
          <span className="mb-1 block text-[11px] text-brand-sub">
            Multiplier
          </span>

          <input
            inputMode="decimal"
            value={String(
              prefs.bollMult,
            )}
            onChange={(
              e,
            ) => {
              const n =
                Number(
                  e.target
                    .value,
                );

              onChange({
                ...prefs,

                bollMult:
                  Number.isFinite(
                    n,
                  )
                    ? n
                    : prefs.bollMult,
              });
            }}
            className="h-8 w-full rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px] font-semibold outline-none focus:border-accent"
          />
        </label>
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Display
      </p>

      <div className="divide-y divide-brand-border">
        {bands.map(
          (
            b,
          ) => (
            <div
              key={
                b.label
              }
              className="flex items-center justify-between py-2"
            >
              <span className="text-[12px] font-semibold">
                {
                  b.label
                }
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-7 w-7 rounded-md border-2"
                  style={{
                    borderColor:
                      prefs.bollColors[
                        b.index
                      ],

                    background:
                      prefs.bollColors[
                        b.index
                      ],
                  }}
                  onClick={() =>
                    onPickColor(
                      b.index,
                    )
                  }
                />

                <LineWidthPicker
                  value={
                    prefs.bollLineWidths?.[
                      b.index
                    ] ?? 1
                  }
                  onChange={(
                    width,
                  ) => {
                    const next = [
                      ...(
                        prefs
                          .bollLineWidths ??
                        [1,1,1]
                      ),
                    ] as [
                      IndicatorLineWidth,
                      IndicatorLineWidth,
                      IndicatorLineWidth,
                    ];

                    next[
                      b.index
                    ] = width;

                    onChange({
                      ...prefs,
                      bollLineWidths:
                        next,
                    });
                  }}
                />
              </div>
            </div>
          ),
        )}
      </div>

      <Footer
        onReset={() =>
          onChange({
            ...prefs,
            bollLength:
              20,
            bollMult:
              2,
            bollColors:
              DEFAULT_BOLL_COLORS,
            bollLineWidths:
              [1,1,1],
          })
        }
        onDone={
          onClose
        }
      />
    </div>
  );
}

function VolEditor({
  prefs,
  onChange,
  onClose,
}: {
  prefs:
    WebIndicatorPrefs;

  onChange:
    (
      next:
        WebIndicatorPrefs
    ) => void;

  onClose:
    () => void;
}) {
  const periods =
    prefs.volMaPeriods ??
    [5,10,20];

  const colors =
    prefs.volMaColors ??
    [
      '#FF9600',
      '#935EBD',
      '#1677FF',
    ];

  const widths =
    prefs.volMaLineWidths ??
    [1,1,1];

  const barStyle =
    prefs.volBarStyle ?? {
      upColor:
        '#2DC08E',
      downColor:
        '#F92855',
      noChangeColor:
        '#888888',
      borderSize:
        1,
    };

  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        Volume
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={prefs.vol}
          onClick={() =>
            onChange({
              ...prefs,
              vol:
                !prefs.vol,
            })
          }
        />
      </div>

      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Moving Averages
      </p>

      {[0,1,2].map(
        (index) => (
          <div
            key={index}
            className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-brand-border/40 p-2"
          >
            <span className="w-10 text-[11px] font-bold">
              MA{index + 1}
            </span>

            <input
              type="number"
              min={1}
              max={500}
              value={
                periods[
                  index
                ]
              }
              onChange={(e) => {
                const next =
                  [...periods] as [
                    number,
                    number,
                    number,
                  ];

                next[index] =
                  Math.max(
                    1,
                    Math.min(
                      500,
                      Math.round(
                        Number(
                          e.target
                            .value,
                        ),
                      ) || 1,
                    ),
                  );

                onChange({
                  ...prefs,
                  volMaPeriods:
                    next,
                });
              }}
              className="h-8 w-20 rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px]"
            />

            <input
              type="color"
              value={
                colors[index]
              }
              onChange={(e) => {
                const next =
                  [...colors] as [
                    string,
                    string,
                    string,
                  ];

                next[index] =
                  e.target.value;

                onChange({
                  ...prefs,
                  volMaColors:
                    next,
                });
              }}
              className="h-8 w-12"
            />

            <LineWidthPicker
              value={
                widths[
                  index
                ]
              }
              onChange={(
                width,
              ) => {
                const next =
                  [...widths] as [
                    IndicatorLineWidth,
                    IndicatorLineWidth,
                    IndicatorLineWidth,
                  ];

                next[index] =
                  width;

                onChange({
                  ...prefs,
                  volMaLineWidths:
                    next,
                });
              }}
            />
          </div>
        ),
      )}

      <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Volume Bars
      </p>

      <DirectionalStyleEditor
        value={
          barStyle
        }
        onChange={(
          volBarStyle,
        ) =>
          onChange({
            ...prefs,
            volBarStyle,
          })
        }
      />

      <PaneHeightControl
        value={
          prefs.indicatorSettings?.VOL
            ?.paneHeight
        }
        onChange={(paneHeight) => {
          const nextSettings = {
            ...(prefs.indicatorSettings ??
              {}),
          };

          const setting = {
            ...(nextSettings.VOL ??
              {}),
          };

          if (
            paneHeight ===
            undefined
          ) {
            delete setting
              .paneHeight;
          } else {
            setting.paneHeight =
              paneHeight;
          }

          nextSettings.VOL =
            setting;

          onChange({
            ...prefs,
            indicatorSettings:
              nextSettings,
          });
        }}
      />

      <Footer
        onReset={() => {
          const nextSettings = {
            ...(prefs.indicatorSettings ??
              {}),
          };

          const setting = {
            ...(nextSettings.VOL ??
              {}),
          };

          delete setting
            .paneHeight;

          nextSettings.VOL =
            setting;

          onChange({
            ...prefs,
            volMaPeriods:
              [5,10,20],

            volMaColors:
              [
                '#FF9600',
                '#935EBD',
                '#1677FF',
              ],

            volMaLineWidths:
              [1,1,1],

            volBarStyle: {
              upColor:
                '#2DC08E',

              downColor:
                '#F92855',

              noChangeColor:
                '#888888',

              borderSize:
                1,
            },

            indicatorSettings:
              nextSettings,
          });
        }}
        onDone={
          onClose
        }
      />
    </div>
  );
}

function VwapEditor({
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
  onPickColor:
    () => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        VWAP
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            prefs.vwap
          }
          onClick={() =>
            onChange({
              ...prefs,
              vwap:
                !prefs.vwap,
            })
          }
        />
      </div>

      <div className="flex items-end gap-3">
        <NumField
          label="Length"
          value={
            prefs.vwapLength
          }
          onChange={(
            n,
          ) =>
            onChange({
              ...prefs,
              vwapLength:
                n,
            })
          }
        />

        <button
          type="button"
          title="Line color"
          onClick={
            onPickColor
          }
          className="mb-0 h-8 w-8 rounded-md border-2"
          style={{
            borderColor:
              prefs.vwapColor,
            background:
              prefs.vwapColor,
          }}
        />
      </div>

      <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Line width
      </p>

      <div className="flex gap-1">
        {(
          [
            1,
            2,
            3,
            4,
          ] as const
        ).map(
          (
            w,
          ) => (
            <button
              key={
                w
              }
              type="button"
              onClick={() =>
                onChange({
                  ...prefs,
                  vwapLineWidth:
                    w,
                })
              }
              className={`h-8 min-w-8 rounded-md px-2.5 text-[12px] font-bold ${
                (
                  prefs.vwapLineWidth ||
                  2
                ) ===
                w
                  ? 'bg-accent/10 text-accent'
                  : 'bg-brand-overlay-normal text-brand-sub hover:text-brand-text'
              }`}
            >
              {w}
            </button>
          ),
        )}
      </div>

      <Footer
        onReset={() =>
          onChange({
            ...prefs,
            vwapLength:
              14,
            vwapColor:
              DEFAULT_INDICATOR_PREFS.vwapColor,
            vwapLineWidth:
              2,
          })
        }
        onDone={
          onClose
        }
      />
    </div>
  );
}

function SupertrendEditor({
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
  onPickColor: () => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        Supertrend
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            prefs.supertrend
          }
          onClick={() =>
            onChange({
              ...prefs,
              supertrend:
                !prefs.supertrend,
            })
          }
        />
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Parameters
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <NumField
          label="ATR Period"
          value={
            prefs.supertrendPeriod
          }
          onChange={(
            n,
          ) => {
            const period =
              Number.isFinite(
                n,
              )
                ? Math.max(
                    1,
                    Math.min(
                      500,
                      Math.round(
                        n,
                      ),
                    ),
                  )
                : 10;
            onChange({
              ...prefs,
              supertrendPeriod:
                period,
            });
          }}
        />

        <label className="block">
          <span className="mb-1 block text-[11px] text-brand-sub">
            Multiplier
          </span>

          <input
            inputMode="decimal"
            value={String(
              prefs.supertrendMultiplier,
            )}
            onChange={(
              e,
            ) => {
              const n =
                Number(
                  e.target
                    .value,
                );

              onChange({
                ...prefs,

                supertrendMultiplier:
                  Number.isFinite(
                    n,
                  )
                    ? Math.max(
                        0.1,
                        Math.min(
                          50,
                          n,
                        ),
                      )
                    : prefs.supertrendMultiplier,
              });
            }}
            className="h-8 w-full rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px] font-semibold outline-none focus:border-accent"
          />
        </label>
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Line Color
      </p>

      <div className="mb-4 flex items-center justify-between py-1">
        <span className="text-[12px] font-semibold">
          Color
        </span>

        <button
          type="button"
          title="Line color"
          onClick={
            onPickColor
          }
          className="h-7 w-7 rounded-md border-2"
          style={{
            borderColor:
              prefs.supertrendColor,
            background:
              prefs.supertrendColor,
          }}
        />
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Line width
      </p>

      <div className="flex gap-1">
        {(
          [
            1,
            2,
            3,
            4,
          ] as const
        ).map(
          (
            w,
          ) => (
            <button
              key={
                w
              }
              type="button"
              onClick={() =>
                onChange({
                  ...prefs,
                  supertrendLineWidth:
                    w,
                })
              }
              className={`h-8 min-w-8 rounded-md px-2.5 text-[12px] font-bold ${
                (
                  prefs.supertrendLineWidth ||
                  1
                ) ===
                w
                  ? 'bg-accent/10 text-accent'
                  : 'bg-brand-overlay-normal text-brand-sub hover:text-brand-text'
              }`}
            >
              {w}
            </button>
          ),
        )}
      </div>

      <Footer
        onReset={() =>
          onChange({
            ...prefs,
            supertrendPeriod: 10,
            supertrendMultiplier: 3,
            supertrendColor:
              '#fb7185',
            supertrendLineWidth: 1,
          })
        }
        onDone={
          onClose
        }
      />
    </div>
  );
}

function MacdEditor({
  prefs,
  onChange,
  onClose,
}: {
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
}) {
  const setParam = (
    i:
      | 0
      | 1
      | 2,
    n: number,
  ) => {
    const next = [
      ...prefs.macdParams,
    ] as [
      number,
      number,
      number,
    ];

    next[i] = n;

    onChange({
      ...prefs,
      macdParams:
        next,
    });
  };

  const lineColors =
    prefs.macdColors ??
    [
      '#F59E0B',
      '#22D3EE',
    ];

  const lineWidths =
    prefs.macdLineWidths ??
    [1,1];

  const histStyle =
    prefs.macdHistStyle ?? {
      upColor:
        '#2DC08E',

      downColor:
        '#F92855',

      noChangeColor:
        '#888888',

      borderSize:
        1,
    };

  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        MACD
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            prefs.macd
          }
          onClick={() =>
            onChange({
              ...prefs,
              macd:
                !prefs.macd,
            })
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumField
          label="Fast"
          value={
            prefs.macdParams[0]
          }
          onChange={(
            n,
          ) =>
            setParam(
              0,
              n,
            )
          }
        />

        <NumField
          label="Slow"
          value={
            prefs.macdParams[1]
          }
          onChange={(
            n,
          ) =>
            setParam(
              1,
              n,
            )
          }
        />

        <NumField
          label="Signal"
          value={
            prefs.macdParams[2]
          }
          onChange={(
            n,
          ) =>
            setParam(
              2,
              n,
            )
          }
        />
      </div>

      <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Lines
      </p>

      {[
        ['DIF',0],
        ['DEA',1],
      ].map(
        ([label, rawIndex]) => {
          const index =
            Number(rawIndex);

          return (
            <div
              key={label}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="text-[12px] font-semibold">
                {label}
              </span>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={
                    lineColors[
                      index
                    ]
                  }
                  onChange={(e) => {
                    const next =
                      [...lineColors] as [
                        string,
                        string,
                      ];

                    next[index] =
                      e.target.value;

                    onChange({
                      ...prefs,
                      macdColors:
                        next,
                    });
                  }}
                  className="h-8 w-12 cursor-pointer rounded border border-brand-border bg-transparent p-0.5"
                />

                <LineWidthPicker
                  value={
                    lineWidths[
                      index
                    ]
                  }
                  onChange={(
                    width,
                  ) => {
                    const next =
                      [...lineWidths] as [
                        IndicatorLineWidth,
                        IndicatorLineWidth,
                      ];

                    next[index] =
                      width;

                    onChange({
                      ...prefs,
                      macdLineWidths:
                        next,
                    });
                  }}
                />
              </div>
            </div>
          );
        },
      )}

      <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Histogram
      </p>

      <DirectionalStyleEditor
        value={histStyle}
        onChange={(
          macdHistStyle,
        ) =>
          onChange({
            ...prefs,
            macdHistStyle,
          })
        }
      />

      <PaneHeightControl
        value={
          prefs.indicatorSettings?.MACD
            ?.paneHeight
        }
        onChange={(paneHeight) => {
          const nextSettings = {
            ...(prefs.indicatorSettings ??
              {}),
          };

          const setting = {
            ...(nextSettings.MACD ??
              {}),
          };

          if (
            paneHeight ===
            undefined
          ) {
            delete setting
              .paneHeight;
          } else {
            setting.paneHeight =
              paneHeight;
          }

          nextSettings.MACD =
            setting;

          onChange({
            ...prefs,
            indicatorSettings:
              nextSettings,
          });
        }}
      />

      <Footer
        onReset={() => {
          const nextSettings = {
            ...(prefs.indicatorSettings ??
              {}),
          };

          const setting = {
            ...(nextSettings.MACD ??
              {}),
          };

          delete setting
            .paneHeight;

          nextSettings.MACD =
            setting;

          onChange({
            ...prefs,
            macdParams: [
              12,
              26,
              9,
            ],
            macdColors: [
              '#F59E0B',
              '#22D3EE',
            ],
            macdLineWidths: [1, 1],
            macdHistStyle: {
              upColor:
                '#2DC08E',
              downColor:
                '#F92855',
              noChangeColor:
                '#888888',
              borderSize:
                1,
            },
            indicatorSettings:
              nextSettings,
          });
        }}
        onDone={
          onClose
        }
      />
    </div>
  );
}

function RsiEditor({
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
  onPickColor: (
    index: number,
  ) => void;
}) {
  const rows =
    prefs.rsiRows ??
    DEFAULT_RSI_ROWS;

  const updateRow = (
    index: number,
    patch: Partial<RsiBandRow>,
  ) => {
    const nextRows =
      rows.map((r, i) =>
        i === index
          ? {
              ...r,
              ...patch,
            }
          : r,
      );
    const firstEnabled =
      nextRows.find(
        (r) => r.enabled,
      );
    onChange({
      ...prefs,
      rsiRows: nextRows,
      rsiPeriod: firstEnabled
        ? firstEnabled.period
        : prefs.rsiPeriod,
    });
  };

  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        RSI
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            prefs.rsi
          }
          onClick={() =>
            onChange({
              ...prefs,
              rsi:
                !prefs.rsi,
            })
          }
        />
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Parameters
      </p>

      <div className="divide-y divide-brand-border">
        {rows.map(
          (
            row,
            i,
          ) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Check
                  on={
                    row.enabled
                  }
                  onClick={() =>
                    updateRow(
                      i,
                      {
                        enabled:
                          !row.enabled,
                      },
                    )
                  }
                />
                <span className="text-[12px] font-semibold">
                  RSI {i + 1}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-brand-sub">
                  <span>
                    Period
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={
                      row.period
                    }
                    onChange={(
                      e,
                    ) => {
                      const n =
                        Math.max(
                          1,
                          Math.min(
                            500,
                            Math.round(
                              Number(
                                e
                                  .target
                                  .value,
                              ),
                            ) ||
                              1,
                          ),
                        );
                      updateRow(
                        i,
                        {
                          period:
                            n,
                        },
                      );
                    }}
                    className="h-8 w-16 rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px] font-semibold text-brand-text outline-none focus:border-accent"
                  />
                </label>

                <button
                  type="button"
                  title="Line color"
                  onClick={() =>
                    onPickColor(
                      i,
                    )
                  }
                  className="h-7 w-7 rounded-md border-2"
                  style={{
                    borderColor:
                      row.color,
                    background:
                      row.color,
                  }}
                />

                <div className="flex gap-0.5">
                  {(
                    [
                      1,
                      2,
                      3,
                      4,
                    ] as const
                  ).map(
                    (
                      w,
                    ) => (
                      <button
                        key={
                          w
                        }
                        type="button"
                        onClick={() =>
                          updateRow(
                            i,
                            {
                              lineWidth:
                                w,
                            },
                          )
                        }
                        className={`h-7 w-6 rounded text-[11px] font-bold ${
                          (
                            row.lineWidth ||
                            1
                          ) ===
                          w
                            ? 'bg-accent/10 text-accent'
                            : 'bg-brand-overlay-normal text-brand-sub hover:text-brand-text'
                        }`}
                      >
                        {w}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <PaneHeightControl
        value={
          prefs.indicatorSettings?.RSI
            ?.paneHeight
        }
        onChange={(paneHeight) => {
          const nextSettings = {
            ...(prefs.indicatorSettings ??
              {}),
          };

          const current = {
            ...(nextSettings.RSI ??
              {}),
          };

          if (
            paneHeight === undefined
          ) {
            delete current.paneHeight;
          } else {
            current.paneHeight =
              paneHeight;
          }

          nextSettings.RSI =
            current;

          onChange({
            ...prefs,
            indicatorSettings:
              nextSettings,
          });
        }}
      />

      <Footer
        onReset={() =>
          onChange({
            ...prefs,
            rsiRows:
              DEFAULT_RSI_ROWS.map(
                (
                  r,
                ) => ({
                  ...r,
                }),
              ),
            rsiPeriod:
              DEFAULT_RSI_ROWS[0]
                .period,
          })
        }
        onDone={
          onClose
        }
      />
    </div>
  );
}

function CciEditor({
  prefs,
  onChange,
  onClose,
  onPickColor,
}: {
  prefs: WebIndicatorPrefs;
  onChange: (
    next: WebIndicatorPrefs,
  ) => void;
  onClose: () => void;
  onPickColor: () => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        CCI
      </h3>

      <p className="mb-4 text-[12px] text-brand-sub">
        Commodity Channel Index (20)
      </p>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={
            prefs.cci
          }
          onClick={() =>
            onChange({
              ...prefs,
              cci:
                !prefs.cci,
            })
          }
        />
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Line Color
      </p>

      <div className="mb-4 flex items-center justify-between py-1">
        <span className="text-[12px] font-semibold">
          Color
        </span>

        <button
          type="button"
          title="Line color"
          onClick={
            onPickColor
          }
          className="h-7 w-7 rounded-md border-2"
          style={{
            borderColor:
              prefs.cciColor ||
              '#22d3ee',
            background:
              prefs.cciColor ||
              '#22d3ee',
          }}
        />
      </div>

      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sub">
        Line width
      </p>

      <div className="flex gap-1">
        {(
          [
            1,
            2,
            3,
            4,
          ] as const
        ).map(
          (
            w,
          ) => (
            <button
              key={
                w
              }
              type="button"
              onClick={() =>
                onChange({
                  ...prefs,
                  cciLineWidth:
                    w,
                })
              }
              className={`h-8 min-w-8 rounded-md px-2.5 text-[12px] font-bold ${
                (
                  prefs.cciLineWidth ||
                  1
                ) ===
                w
                  ? 'bg-accent/10 text-accent'
                  : 'bg-brand-overlay-normal text-brand-sub hover:text-brand-text'
              }`}
            >
              {w}
            </button>
          ),
        )}
      </div>

      <PaneHeightControl
        value={
          prefs.indicatorSettings?.CCI
            ?.paneHeight
        }
        onChange={(paneHeight) => {
          const nextSettings = {
            ...(prefs.indicatorSettings ??
              {}),
          };

          const current = {
            ...(nextSettings.CCI ??
              {}),
          };

          if (
            paneHeight === undefined
          ) {
            delete current.paneHeight;
          } else {
            current.paneHeight =
              paneHeight;
          }

          nextSettings.CCI =
            current;

          onChange({
            ...prefs,
            indicatorSettings:
              nextSettings,
          });
        }}
      />

      <Footer
        onReset={() =>
          onChange({
            ...prefs,
            cciColor:
              '#22d3ee',
            cciLineWidth: 1,
          })
        }
        onDone={
          onClose
        }
      />
    </div>
  );
}

function SimpleEditor({
  title,
  hint,
  on,
  onToggle,
  onClose,
}: {
  title: string;
  hint: string;
  on: boolean;
  onToggle:
    () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[14px] font-bold">
        {title}
      </h3>

      <p className="mb-4 text-[12px] text-brand-sub">
        {hint}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          Show on chart
        </span>

        <Check
          on={on}
          onClick={
            onToggle
          }
        />
      </div>

      <Footer
        onReset={
          onToggle
        }
        onDone={
          onClose
        }
        hideReset
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    n: number,
  ) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] text-brand-sub">
        {label}
      </span>

      <input
        inputMode="numeric"
        maxLength={
          3
        }
        value={
          value ===
          0
            ? ''
            : String(
                value,
              )
        }
        onChange={(
          e,
        ) => {
          const cleaned =
            e.target.value.replace(
              /[^0-9]/g,
              '',
            );

          onChange(
            cleaned ===
            ''
              ? 0
              : Number(
                  cleaned,
                ),
          );
        }}
        className="h-8 w-full rounded-md border border-brand-border bg-brand-overlay-normal px-2 text-[12px] font-semibold outline-none focus:border-accent"
      />
    </label>
  );
}

function Footer({
  onReset,
  onDone,
  hideReset,
}: {
  onReset: () => void;
  onDone: () => void;
  hideReset?: boolean;
}) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      {hideReset ? null : (
        <button
          type="button"
          onClick={
            onReset
          }
          className="rounded-lg border border-brand-border px-4 py-1.5 text-[12px] font-semibold text-brand-sub hover:bg-brand-overlay-active hover:text-brand-text"
        >
          Reset
        </button>
      )}

      <button
        type="button"
        onClick={
          onDone
        }
        className="rounded-lg bg-accent px-5 py-1.5 text-[12px] font-bold text-[#0a0a0a]"
      >
        Done
      </button>
    </div>
  );
}

function Check({
  on,
  onClick,
}: {
  on: boolean;
  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={
        on
      }
      onClick={(
        e,
      ) => {
        e.stopPropagation();

        onClick();
      }}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${
        on
          ? 'border-accent bg-accent text-[#0a0a0a]'
          : 'border-brand-border bg-transparent text-transparent'
      }`}
    >
      <CheckIcon
        size={
          11
        }
      />
    </button>
  );
}

function ColorPicker({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (
    color: string,
  ) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close color picker"
        onClick={
          onClose
        }
      />

      <div className="relative w-full max-w-sm rounded-xl border border-brand-border bg-brand-bg p-3 shadow-lg">
        <p className="mb-2 text-[13px] font-bold">
          Line color
        </p>

        <div className="grid grid-cols-7 gap-2">
          {CHART_COLOR_PRESETS.map(
            (
              c,
            ) => (
              <button
                key={
                  c
                }
                type="button"
                onClick={() =>
                  onPick(
                    c,
                  )
                }
                className="h-7 w-7 rounded-full border border-white/20"
                style={{
                  background:
                    c,

                  boxShadow:
                    value.toLowerCase() ===
                    c.toLowerCase()
                      ? '0 0 0 2px #4ef2bb'
                      : undefined,
                }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
