export const DEFAULT_HIP3_DEXES = ['xyz', 'io'] as const;

const DEX_NAME_RE = /^[a-z]{2,4}$/;

export function parseEnabledHip3Dexes(
  raw?: string | null,
): string[] {
  const fallback = [...DEFAULT_HIP3_DEXES];

  if (!raw || !String(raw).trim()) {
    return fallback;
  }

  const out: string[] = [];
  const seen = new Set<string>();

  for (const part of String(raw).split(',')) {
    const d = part.trim().toLowerCase();

    if (
      !DEX_NAME_RE.test(d) ||
      seen.has(d)
    ) {
      continue;
    }

    seen.add(d);
    out.push(d);
  }

  return out.length
    ? out
    : fallback;
}

export function enabledHip3Dexes(): string[] {
  return parseEnabledHip3Dexes(
    import.meta.env.VITE_HIP3_ENABLED_DEXES
  );
}

export function isHip3DexName(
  name: string | null | undefined,
): boolean {
  const n = String(name ?? '').trim();

  if (!n) return false;

  const lower = n.toLowerCase();

  if (lower === 'trade.xyz') return true;

  if (
    enabledHip3Dexes().includes(lower)
  ) {
    return true;
  }

  return (
    n === lower &&
    DEX_NAME_RE.test(n)
  );
}

export function splitHip3Symbol(
  value: string,
  fallbackDex?: string | null,
): {
  dex: string;
  base: string;
} {
  const raw =
    String(value ?? '').trim();

  const fallback =
    (fallbackDex || 'xyz').toLowerCase();

  if (!raw.includes(':')) {
    return {
      dex: fallback,
      base: raw,
    };
  }

  const [left, ...rest] =
    raw.split(':');

  const right =
    rest.join(':');

  if (isHip3DexName(left)) {
    return {
      dex: left.toLowerCase(),
      base: right,
    };
  }

  if (isHip3DexName(right)) {
    return {
      dex: right.toLowerCase(),
      base: left,
    };
  }

  return {
    dex: fallback,
    base: right || left,
  };
}

export function hip3DisplaySymbol(
  symbol: string,
): string {
  const raw =
    String(symbol ?? '').trim();

  if (!raw) return raw;

  if (!raw.includes(':')) {
    return raw;
  }

  const { base } =
    splitHip3Symbol(raw);

  return base || raw;
}

export function normalizeHip3Coin(
  coin: string,
  dex?: string | null,
): string {
  const parsed =
    splitHip3Symbol(coin, dex);

  return `${parsed.dex}:${parsed.base}`;
}
