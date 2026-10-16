import React, { useEffect, useMemo, useState } from "react";

/**
 * Public information pages. Intentionally separate from the gated trading
 * terminal: reading policies or contacting support never grants access.
 */
export type PublicInfoSection = "terms" | "risk" | "privacy" | "about" | "contact" | "markets" | "early-access" | "faq" | "resources" | "whitepaper" | "docs" | "exchange-info" | "exchange-api" | "market-info" | "fees";
const SUPPORT_EMAIL = "hidedex.com@gmail.com";
const PRIMARY_ORIGIN = "https://www.hidedex.com";

const pageInfo: Record<PublicInfoSection, { title: string; description: string; eyebrow: string }> = {
  "exchange-info": { title: "HideDex Exchange Listing Information", description: "Verifiable public project details, community references and gaps for exchange listing reviews.", eyebrow: "Official exchange reference" },
  "exchange-api": { title: "HideDex API and Integration Reference", description: "Underlying Hyperliquid public information endpoints; no independent HideDex exchange API is claimed.", eyebrow: "Protocol integration disclosure" },
  "market-info": { title: "HideDex Spot & Perpetual Market Information", description: "Public information on Hyperliquid spot and perpetual markets and the source of live market data.", eyebrow: "Underlying market reference" },
  fees: { title: "HideDex Trading Fees", description: "HideDex builder-fee disclosure, underlying protocol trading fees and payment-method limitations.", eyebrow: "Fee disclosures" },
  docs: {
    title: "HideDex Documentation",
    description: "Official user guides for wallet connection, Early Access, Spot and Perpetual trading, order controls, fees, safety and troubleshooting.",
    eyebrow: "Official documentation · Version 1.0",
  },
  resources: {
    title: "Partners & Resources",
    description: "Independent crypto directories and other useful public references for HideDex.",
    eyebrow: "Directory references",
  },
  whitepaper: {
    title: "HideDex Whitepaper",
    description: "Vision, Hyperliquid trading infrastructure, user control, HIDE token roadmap and planned airdrop.",
    eyebrow: "Project document · Version 0.1",
  },
  terms: { title: "Terms of Service", description: "Terms for using HideDex, Early Access and its wallet-connected trading interface.", eyebrow: "Platform terms" },
  risk: { title: "Trading Risk Disclosure", description: "Risks of Spot and leveraged Perpetual trading through HideDex.", eyebrow: "Trading risks" },
  privacy: {
    title: "Privacy Policy",
    description: "How the HideDex website handles connected-wallet data, Early Access registration and browser preferences.",
    eyebrow: "Privacy & transparency",
  },
  about: {
    title: "About HideDex",
    description: "Learn what HideDex does, how the trading interface works and what privacy controls can and cannot do.",
    eyebrow: "Our platform",
  },
  contact: {
    title: "Contact HideDex",
    description: "How to reach the HideDex support team and report security issues safely.",
    eyebrow: "Official support",
  },
  markets: {
    title: "HideDex Trading Markets",
    description: "Learn how HideDex spot and perpetual markets work, what traders can review, and why Early Access approval is currently required.",
    eyebrow: "Spot and perpetual markets",
  },
  "early-access": {
    title: "HideDex Early Access",
    description: "How to join the HideDex Early Access waitlist, connect your wallet, and understand registration, verification and trading approval.",
    eyebrow: "Early Access registration",
  },
  faq: {
    title: "HideDex FAQ",
    description: "Answers about the HideDex wallet connection, Early Access, trading access, trading fees, and display privacy features.",
    eyebrow: "Frequently asked questions",
  },
};


/** Read-only Hyperliquid metadata view; NEVER labeled as HideDex-exclusive market activity. */
type SourceMarketRow = { type: "Perpetual" | "Spot"; symbol: string; marketId: string; price: number | null; volume: number | null };
function sourceNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function displaySourceNumber(n: number | null): string {
  return n === null ? "N/A" : n.toLocaleString("en-US", { maximumFractionDigits: n > 1 ? 2 : 8 });
}
async function requestPublicContext(type: "metaAndAssetCtxs" | "spotMetaAndAssetCtxs", signal: AbortSignal): Promise<unknown> {
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
    signal,
  });
  if (!response.ok) throw new Error("Hyperliquid HTTP " + response.status);
  return response.json();
}
function parseSourceMarkets(perp: unknown, spot: unknown): SourceMarketRow[] {
  if (!Array.isArray(perp) || !Array.isArray(spot)) throw new Error("Invalid market data response");
  const [perpMeta, perpCtx] = perp;
  const [spotMeta, spotCtx] = spot;
  if (!Array.isArray(perpMeta?.universe) || !Array.isArray(perpCtx) ||
      !Array.isArray(spotMeta?.tokens) || !Array.isArray(spotMeta?.universe) ||
      !Array.isArray(spotCtx)) throw new Error("Market metadata is unavailable");
  const tokenMap = new Map<number, string>();
  for (const token of spotMeta.tokens) {
    if (typeof token?.index === "number" && typeof token?.name === "string")
      tokenMap.set(token.index, token.name);
  }
  const perps: SourceMarketRow[] = perpMeta.universe.map((u: {name?: string}, i: number) => {
    const ctx = perpCtx[i];
    return { type: "Perpetual", symbol: String(u?.name ?? "Unknown") + "-PERP", marketId: String(u?.name ?? i),
      price: sourceNumber(ctx?.markPx ?? ctx?.midPx), volume: sourceNumber(ctx?.dayNtlVlm) };
  });
  const spots: SourceMarketRow[] = spotMeta.universe.map((u: {name?: string; tokens?: number[]}, i: number) => {
    const ctx = spotCtx[i];
    const symbol = Array.isArray(u?.tokens) ?
      u.tokens.map(t => tokenMap.get(t) ?? ("Token #" + t)).join("/") :
      String(u?.name ?? "Unknown");
    return { type: "Spot", symbol, marketId: String(u?.name ?? i),
      price: sourceNumber(ctx?.midPx ?? ctx?.markPx), volume: sourceNumber(ctx?.dayNtlVlm) };
  });
  return [...perps, ...spots].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
}
function PublicProtocolMarketTable() {
  const [rows, setRows] = useState<SourceMarketRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [textFilter, setTextFilter] = useState("");
  const [marketType, setMarketType] = useState<"All" | "Spot" | "Perpetual">("All");
  const [expanded, setExpanded] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [fetchedTime, setFetchedTime] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      requestPublicContext("metaAndAssetCtxs", abort.signal),
      requestPublicContext("spotMetaAndAssetCtxs", abort.signal)
    ]).then(([perp, spot]) => {
      if (abort.signal.aborted) return;
      setRows(parseSourceMarkets(perp, spot));
      setFetchedTime(new Date().toLocaleString());
      setLoading(false);
    }).catch((reason: unknown) => {
      if (abort.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Unknown upstream request error");
      setLoading(false);
    });
    return () => abort.abort();
  }, [refreshIndex]);
  const filtered = useMemo(() => {
    const q = textFilter.trim().toLowerCase();
    return rows.filter(r => (marketType === "All" || marketType === r.type) &&
      (!q || r.symbol.toLowerCase().includes(q) || r.marketId.toLowerCase().includes(q)));
  }, [rows, textFilter, marketType]);
  return (
    <div className="rounded-xl border border-[#cee0f1] bg-[#f4f9fe] p-3 sm:p-4 space-y-3">
      <p className="font-bold text-[#12375c]">Live underlying Hyperliquid market data</p>
      <p className="text-xs">Raw protocol identifiers, mark/mid price, and Hyperliquid's 24h reported notional volume. <strong>These values are not HideDex's own trading volume</strong>. Additional HIP-3 perp markets may exist outside the default-dex feed.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Filter market symbols" value={textFilter}
          onChange={e => { setTextFilter(e.target.value); setExpanded(false); }}
          placeholder="Search pairs" className="p-2 rounded-lg border border-[#b7cddd] flex-1 min-w-0 text-sm" />
        <select aria-label="Market type filter" value={marketType}
          onChange={e => { setMarketType(e.target.value as "All" | "Spot" | "Perpetual"); setExpanded(false); }}
          className="p-2 rounded-lg border border-[#b7cddd] text-sm">
          <option>All</option><option>Spot</option><option>Perpetual</option>
        </select>
        <button type="button" disabled={loading} onClick={() => setRefreshIndex(i => i + 1)}
          className="p-2 px-3 rounded-lg bg-[#1d5ba8] text-white text-sm font-bold disabled:opacity-50">Refresh</button>
      </div>
      {loading && <p role="status">Loading Hyperliquid public data…</p>}
      {!!error && <p role="alert" className="text-sm text-[#a3333b]">Live data unavailable: {error}. No synthetic prices or volumes are shown; use the official protocol API links above.</p>}
      {!loading && !error && <>
        <p className="text-xs text-[#617b94]">{filtered.length} matching instruments. Fetched {fetchedTime} (device local time).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead><tr className="bg-[#e4f0fb]"><th className="p-2">Pair / ID</th><th className="p-2">Type</th><th className="p-2 text-right">Mark/Mid USD</th><th className="p-2 text-right">24h protocol notional (USD)</th></tr></thead>
            <tbody>
              {(expanded ? filtered : filtered.slice(0, 60)).map(row => <tr key={row.type + ":" + row.marketId} className="border-t border-[#d8e6f2]">
                <td className="p-2 font-semibold">{row.symbol}<span className="block text-[10px] text-[#607d97]">ID: {row.marketId}</span></td>
                <td className="p-2">{row.type}</td>
                <td className="p-2 text-right whitespace-nowrap">{displaySourceNumber(row.price)}</td>
                <td className="p-2 text-right whitespace-nowrap">{displaySourceNumber(row.volume)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!expanded && filtered.length > 60 && <button type="button" onClick={() => setExpanded(true)}
          className="text-[#145fbd] underline font-semibold text-sm">Show all {filtered.length} instruments</button>}
      </>}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-[#dce5ef] pb-6 last:border-b-0 last:pb-0 space-y-2 scroll-mt-8">
      <h2 className="text-lg sm:text-xl font-bold text-[#12375c]">{title}</h2>
      <div className="text-sm sm:text-base leading-7 text-[#38516a] space-y-3">{children}</div>
    </section>
  );
}

export default function PublicInfoPage({ section }: { section: PublicInfoSection }) {
  const info = pageInfo[section];
  useEffect(() => {
    const url = `${PRIMARY_ORIGIN}/${section}`;
    document.title = `${info.title} | HideDex`;
    const setTag = (selector: string, attr: "content" | "href", value: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setTag('meta[name="description"]', "content", info.description);
    setTag('meta[property="og:title"]', "content", document.title);
    setTag('meta[property="og:description"]', "content", info.description);
    setTag('meta[property="og:url"]', "content", url);
    setTag('meta[name="twitter:title"]', "content", document.title);
    setTag('meta[name="twitter:description"]', "content", info.description);
    setTag('meta[name="twitter:url"]', "content", url);
    setTag('link[rel="canonical"]', "href", url);
    window.scrollTo(0, 0);
  }, [section, info]);

  return (
    <div className="min-h-[100dvh] bg-[#f8fbff] text-[#102a43] font-sans">
      <header className="border-b border-[#dfe9f3] bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <a href="/" aria-label="HideDex home" className="flex items-center gap-2.5 min-w-0">
            <img src="/IMG_20261014_171156.png" width={44} height={44} alt="" className="h-10 w-10 object-contain" />
            <span className="font-extrabold tracking-tight text-xl">HideDex</span>
          </a>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-16">
        <p className="text-xs sm:text-sm uppercase tracking-[.14em] text-[#226ac9] font-bold">{info.eyebrow}</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mt-2">{info.title}</h1>
        <p className="text-sm sm:text-base text-[#526b80] leading-7 mt-4">{info.description}</p>

        <article className="mt-8 sm:mt-10 rounded-2xl bg-white border border-[#dce5ef] shadow-sm p-5 sm:p-9 space-y-7">

          {section === "exchange-info" && (
            <>
              <Section title="HideDex platform information">
                <p><strong>Exchange name:</strong> HideDex. <strong>Website:</strong> <a className="underline text-[#145fbd]" href="/">https://www.hidedex.com</a>. <strong>Support email:</strong> <a className="underline text-[#145fbd]" href="mailto:hidedex.com@gmail.com">hidedex.com@gmail.com</a>.</p>
                <p>HideDex is a wallet-connected, self-custody-oriented trading interface for live Spot and Perpetual markets on <strong>Hyperliquid mainnet</strong>. It provides market discovery, charts, order-book views and wallet-authorized trading workflows. The underlying protocol supplies liquidity, market data and execution. HideDex does <strong>not</strong> claim to operate an independent matching engine or a separate blockchain.</p>
                <p>Trading access is currently restricted to approved Early Access wallets. The site does not independently offer a verified fiat bank/card payment gateway.</p>
              </Section>
              <Section title="Required technical and fee references">
                <p><a className="underline text-[#145fbd]" href="/exchange-api">Public technical reference</a> · <a className="underline text-[#145fbd]" href="/market-info">Coins and markets information</a> · <a className="underline text-[#145fbd]" href="/fees">Fee schedule and accepted payment methods</a> · <a className="underline text-[#145fbd]" href="/docs">User documentation</a>.</p>
                <p>Official listing logo file: <a className="underline text-[#145fbd]" href="/hidedex-wallet-icon-20261013.png">square HideDex PNG (192×192)</a>. A separate 200×200 transparent original-artwork export preferred by the listing form remains unverified; it must be supplied and checked separately. Do not resize or replace the existing website branding.</p>
              </Section>
              <Section title="CoinGecko listing field references">
                <p><strong>Exchange description:</strong> HideDex is a wallet-connected Hyperliquid mainnet Spot and Perpetual trading interface with charts, market discovery, order books and wallet-authorized trades. It does not operate an independent matching engine or claim protocol-wide trading volume as its own. Trading is subject to Early Access approval.</p>
                <p><strong>API documentation URL:</strong> <a className="underline text-[#145fbd]" href="/exchange-api">Public API and integration reference</a> describes Hyperliquid's public information endpoints; there is no independent public HideDex exchange API.</p>
                <p><strong>Coins and markets URL:</strong> <a className="underline text-[#145fbd]" href="/market-info">Live Spot/Perpetual market information</a> includes read-only protocol markets, pricing and protocol-wide 24-hour volume, not HideDex-only volume.</p>
                <p><strong>Fees URL:</strong> <a className="underline text-[#145fbd]" href="/fees">Trading fee disclosures</a> separate the configured 0.1% builder fee (where applicable) from variable protocol maker/taker fees. No universal flat withdrawal or deposit fee is claimed.</p>
                <p><strong>Margin trading:</strong> Eligible approved wallets can trade supported protocol margined perpetual contracts, subject to instrument/account requirements and <a className="underline text-[#145fbd]" href="/risk">risk disclosures</a>.</p>
                <p><strong>Accepted fiat currencies and payments:</strong> Direct bank transfers, cards, fiat deposits and e-wallet payment rails are not verified as active HideDex features. Do not list them as supported without evidence.</p>
                <p><strong>Blockchain and contract specification:</strong> Underlying trading protocol: Hyperliquid mainnet; HideDex is not a separate blockchain. See <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications" target="_blank" rel="noopener noreferrer">official perpetual contract specifications</a> and <a className="underline text-[#145fbd]" href="/market-info">market metadata</a>.</p>
              </Section>
              <Section title="Community and owner contact">
                <p>X: <a className="underline text-[#145fbd]" href="https://x.com/HideDex_Com">@HideDex_Com</a> · Telegram: <a className="underline text-[#145fbd]" href="https://t.me/Hidedex_official">@Hidedex_official</a> · Discord: <a className="underline text-[#145fbd]" href="https://discord.gg/sZ8ZS98Psg">HideDex Discord</a> · <a className="underline text-[#145fbd]" href="/contact">Contact</a>.</p>
                <p>Further information: <a className="underline text-[#145fbd]" href="/whitepaper">Whitepaper</a> · <a className="underline text-[#145fbd]" href="/terms">Terms</a> · <a className="underline text-[#145fbd]" href="/risk">Risk disclosure</a> · <a className="underline text-[#145fbd]" href="/privacy">Privacy</a>.</p>
              </Section>
              <Section title="Legal, founder and country details">
                <p>Public website documentation is dated 2026. This is <strong>not</strong> proof of the company's incorporation or license year. A legal entity name, country of incorporation, registered company address, founder/team identity links and regulatory licenses have <strong>not</strong> been independently verified in these public materials. Please contact the project owner for authenticated legal documents and applicable jurisdiction restrictions before completing mandatory listing fields. Do not claim a regulatory license that cannot be linked to a regulator.</p>
                <p><strong>Year of establishment and submitter role:</strong> A website publication date does not prove incorporation. Only the real applicant can select Owner/Founder or another role; the company's verified year and legal details must come from authenticated owner records.</p>
                <p><strong>Supported / unsupported countries:</strong> No exhaustive jurisdiction whitelist or blacklist has been independently verified on this website. Early Access and applicable local legal/protocol restrictions apply; do not claim worldwide availability without a confirmed policy. Public team/founder profile and regulator/license evidence also require owner verification.</p>
              </Section>
              <Section title="External directory backlink">
                <p><a className="underline text-[#145fbd]" href="https://www.coingecko.com/en/exchanges" target="_blank" rel="noopener noreferrer">CoinGecko Exchange Directory</a> is an external market-data resource, not evidence of a HideDex listing, partnership, sponsorship or endorsement.</p>
              </Section>
            </>
          )}
          {section === "exchange-api" && (
            <>
              <Section title="API ownership and status">
                <p><strong>HideDex does not currently publish an independently operated public exchange API or SDK.</strong> The following are Hyperliquid mainnet public market-data API endpoints, not separate HideDex-controlled trading APIs. An exchange listing reviewer may require additional independent integration endpoints.</p>
              </Section>
              <Section title="Hyperliquid public market metadata">
                <p><strong>Method:</strong> POST · <strong>Endpoint:</strong> <code>https://api.hyperliquid.xyz/info</code> · <strong>Content-Type:</strong> application/json.</p>
                <p><strong>Native perpetuals:</strong> request body <code>{'{"type":"metaAndAssetCtxs"}'}</code> · <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals" target="_blank" rel="noopener noreferrer">official perpetual API docs</a>.</p>
                <p><strong>Spot:</strong> request body <code>{'{"type":"spotMetaAndAssetCtxs"}'}</code> · <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot" target="_blank" rel="noopener noreferrer">official spot API docs</a>.</p>
                <p>Market contexts can contain protocol mark/mid price and day notional volume. Such values are <strong>Hyperliquid market-wide data</strong>, not an independently verified HideDex exchange volume. HIP-3 deployed perpetual markets may require additional DEX-specific requests.</p>
              </Section>
              <Section title="Contract specifications and fee documentation">
                <p><a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications" target="_blank" rel="noopener noreferrer">Perpetual contract specifications</a> · <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees" target="_blank" rel="noopener noreferrer">Protocol fee schedule</a> · <a className="underline text-[#145fbd]" href="/market-info">Market information</a>.</p>
                <p>Trading transactions need user wallet or authorized-agent signatures. There is no public unauthenticated HideDex order-placement endpoint represented by this page.</p>
              </Section>
            </>
          )}
          {section === "market-info" && (
            <>
              <Section title="Supported market model">
                <p>HideDex displays eligible Hyperliquid mainnet spot tokens and perpetual contracts. Native perpetual instruments, supported spot pairs and builder-deployed HIP-3 contracts may differ in account requirements, price/volume sources and quote assets. Trading is currently Early Access-gated. This informational page is publicly accessible.</p>
                <p>The current coin and pair universe is dynamic, not a fixed list of token promises. To inspect live symbols, pricing and the underlying protocol's 24-hour notional volume, see the official Hyperliquid <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals" target="_blank" rel="noopener noreferrer">perpetual market metadata</a> and <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot" target="_blank" rel="noopener noreferrer">spot market metadata</a> endpoints, or the signed-in trading market selector after access approval.</p>
              </Section>
              <Section title="Public spot/perpetual market snapshot"><PublicProtocolMarketTable /></Section>
              <Section title="Market data limitations">
                <p><strong>Market identifiers:</strong> pair names and raw Hyperliquid token identifiers are resolved from the current protocol universe. <strong>Price:</strong> mark or mid price according to the market context. <strong>24-hour volume:</strong> protocol-provided day notional volume (USD-equivalent), where available. <strong>Margin and funding:</strong> depend on instrument and wallet state.</p>
                <p><strong>Important:</strong> Underlying Hyperliquid total market volume must never be reported as volume generated exclusively by HideDex. HideDex does not publish an independently audited exchange-only ticker/volume feed on this page. See <a className="underline text-[#145fbd]" href="/exchange-api">API reference</a> and <a className="underline text-[#145fbd]" href="/docs#markets">markets guide</a>.</p>
              </Section>
            </>
          )}
          {section === "fees" && (
            <>
              <Section title="Builder and trading fees">
                <p>The current HideDex order configuration specifies a <strong>0.1% (10 basis points) builder fee</strong> on supported Spot/Perpetual order routes, where permitted by the underlying protocol's actual builder-fee rules. For example, 0.1% of 100 USDC filled notional equals 0.10 USDC when the builder fee applies.</p>
                <p>This builder fee is <strong>separate</strong> from Hyperliquid protocol maker/taker charges. Protocol fees vary with volume tier, asset, transaction side, referral/staking tier and other rules; no universally fixed total fee is claimed. <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees" target="_blank" rel="noopener noreferrer">Official protocol maker/taker fee schedule</a> · <a className="underline text-[#145fbd]" href="https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes" target="_blank" rel="noopener noreferrer">builder fee rules</a>.</p>
              </Section>
              <Section title="Withdrawal fees, deposit fees and margin">
                <p>No universal flat HideDex withdrawal/deposit fee is published. Where funding flows are available, network, bridge, transfer, exchange or protocol conditions may impose separate costs. A visible Deposit or Withdraw button is <strong>not</strong> proof that a transfer route is operational.</p>
                <p><strong>Margin trading:</strong> Yes, eligible approved wallets can trade supported perpetual markets with leverage and cross/isolated margin where allowed by the selected instrument and protocol account mode. Funding and liquidation risk apply. <a className="underline text-[#145fbd]" href="/risk">Read risks</a>.</p>
              </Section>
              <Section title="Fiat acceptance and payment methods">
                <p>Direct HideDex bank/card/fiat payment rails are not independently verified. Do <strong>not</strong> list fiat currencies (USD, EUR, INR, etc.) or bank transfers, payment cards or e-wallet payments as directly accepted without a working integration. HideDex currently documents wallet-connected digital-asset trading on Hyperliquid mainnet.</p>
              </Section>
            </>
          )}

          {section === "docs" && (
            <>
              <p className="text-xs text-[#677c90]">Version 1.0 · October 14, 2026 · Public user documentation</p>
              <p>Welcome to the official HideDex user documentation. This guide explains the wallet-connected interface, access requirements, trading controls and their limitations. Reading this page does not connect a wallet or grant trading access. Available features and protocol rules may change.</p>
              <nav aria-label="Documentation table of contents" className="rounded-xl border border-[#cbdff2] bg-[#f3f8ff] p-4 sm:p-5">
                <h2 className="font-bold text-[#143a62] mb-3">Contents</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {([
                    ["overview", "Project overview"],
                    ["start", "Getting started"],
                    ["early", "Early Access"],
                    ["wallet", "Wallet and signatures"],
                    ["markets", "Supported markets"],
                    ["charts", "Charts and order book"],
                    ["spot", "Spot trading"],
                    ["perp", "Perpetual trading"],
                    ["types", "Order types"],
                    ["tpsl", "TP / SL and reduce-only"],
                    ["history", "Orders and positions"],
                    ["funding", "Balances and funding"],
                    ["fees", "Trading fees"],
                    ["privacy", "Privacy and security"],
                    ["token", "Points and HIDE token"],
                    ["issues", "Troubleshooting"],
                    ["developer", "Developer reference"],
                    ["support", "Support and official links"],
                  ] as const).map(([id, label]) => (
                    <a key={id} href={`#${id}`} className="font-semibold text-[#145fbd] underline underline-offset-2 hover:text-[#0a3f81]">{label}</a>
                  ))}
                </div>
              </nav>
              <Section id="overview" title="1. Project overview">
                <p>HideDex is a self-custody-oriented trading frontend connected to <strong>Hyperliquid mainnet</strong>. It provides live market discovery, charting, order-book information and wallet-authorized Spot and Perpetual trading workflows. The exchange protocol, wallet provider and related services remain responsible for their own execution, signatures and settlement.</p>
                <p>HideDex is not a separate blockchain or a promise of custody, guaranteed execution, profits or anonymity. Current account and market conditions are determined by live supported protocol data.</p>
              </Section>
              <Section id="start" title="2. Getting started">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Open <a className="font-semibold text-[#145fbd] underline" href="/">www.hidedex.com</a> and verify the domain before using a wallet.</li>
                  <li>Choose <strong>Early Access</strong> to apply, or <strong>Launch App</strong> to check access for an existing approved wallet.</li>
                  <li>Connect your own wallet and inspect each wallet-ownership or trading-authorization request.</li>
                  <li>After approval and any required account setup, open the workspace and select a Spot or Perpetual market.</li>
                  <li>Check balances, the order value, applicable fees and trading risks before submitting.</li>
                </ol>
              </Section>
              <Section id="early" title="3. Early Access registration and approval">
                <p>Trading is currently restricted to wallets granted Early Access. Registration requests your public wallet address, X username and Gmail address, along with a wallet-ownership signature and verification records. Follow the complete application steps shown on the site.</p>
                <p><strong>Copy Post</strong> or <strong>Post on X</strong> prepares social content only; it does not by itself submit a signed application, approve a wallet or enable trading. Verification and wallet approval are separate. When access is granted, reconnect the same approved wallet and select Launch App. A locally remembered wallet does not bypass server authorization.</p>
                <p>For step-by-step registration guidance, visit the <a className="font-semibold underline text-[#145fbd]" href="/early-access">Early Access page</a>.</p>
              </Section>
              <Section id="wallet" title="4. Connecting wallets and authorizing trades">
                <p>Connect an external wallet using the site's wallet controls. Verify the address and the content of every requested signature. Initial trading setup may involve authorized-agent permissions or a builder-fee approval; registering for Early Access is not the same as authorizing an order.</p>
                <p>Never disclose private keys, seed phrases, recovery words or wallet recovery codes. Keep your wallet software updated and reject unexpected signature requests. After switching wallets, confirm both the active address and its Early Access status.</p>
              </Section>
              <Section id="markets" title="5. Markets: Spot versus Perpetual">
                <p>Use the market selector to find supported instruments. <strong>Spot</strong> involves trading supported tokens, subject to the actual available assets and balances. <strong>Perpetuals</strong> offer margined long/short price exposure and may have leverage, funding and liquidation risk.</p>
                <p>A token's appearance in the market selector does not mean all trading routes or order types are available for that token. Check the exact selected market, price, liquidity and minimum size. Market data and availability can change.</p>
                <p><a className="font-semibold underline text-[#145fbd]" href="/markets">View the trading markets guide</a>.</p>
              </Section>
              <Section id="charts" title="6. Charting, market data and order book">
                <p>The workspace contains chart, timeframe and market-information controls, drawing/analysis tools and an order-book view. These help assess prices, volume and displayed liquidity. A chart price or visible order-book level is not a guaranteed order fill price.</p>
                <p>Prices and liquidity may move during wallet confirmation or network delays. Use the actual trade form and current order state rather than relying only on the chart.</p>
              </Section>
              <Section id="spot" title="7. Placing Spot orders">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Choose an available Spot market and confirm the correct token pair.</li>
                  <li>Select Buy or Sell, then Market or Limit. The current Spot Limit execution path uses <strong>GTC (Good-Til-Cancelled)</strong>.</li>
                  <li>Enter the size in the displayed units and a price when required for Limit orders.</li>
                  <li>Check the estimated value, available Spot balance, trading fees and any minimum order restrictions.</li>
                  <li>Submit once, wait for the actual response and inspect balances, fills and open orders to verify execution.</li>
                </ol>
                <p>Market orders may experience slippage; Limit orders may remain open, only partially fill or fail to execute. Pre-trade quantities are estimates, not confirmed fills.</p>
              </Section>
              <Section id="perp" title="8. Placing Perpetual orders">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Select a supported Perpetual market and choose Long/Buy or Short/Sell.</li>
                  <li>Inspect leverage, margin requirements and Cross or Isolated margin settings where permitted by the account and market.</li>
                  <li>Select the intended order type, size and price or trigger fields as applicable.</li>
                  <li>Review funding, estimated fees and liquidation risk, then authorize the transaction as required.</li>
                  <li>Monitor accepted orders, live positions, margin and funding rather than assuming a submitted order is filled.</li>
                </ol>
                <p>Leveraged positions can lose all posted collateral through liquidation. Cross and Isolated features may depend on the selected instrument and account mode.</p>
              </Section>
              <Section id="types" title="9. Market, Limit and conditional order types">
                <p><strong>Market</strong> attempts execution using available liquidity, so actual prices can differ from quotes. <strong>Limit</strong> sets a price condition but does not guarantee a fill. The current Perpetual order form also offers <strong>Stop Limit</strong>, <strong>Stop Market</strong>, <strong>Take Limit</strong> and <strong>Take Market</strong>.</p>
                <p>Conditional orders are subject to trigger conditions, protocol rules and liquidity. Trigger prices are not guaranteed execution prices. Spot supports Market and Limit in the current form; do not assume Perpetual-only choices are also available for Spot.</p>
              </Section>
              <Section id="tpsl" title="10. Take Profit, Stop Loss and reduce-only controls">
                <p>Where TP/SL is available, configure trigger levels through the supported position/order workflow. Perpetual TP/SL triggers are intended to reduce or close an existing position, not intentionally open another position. Reduce-only settings are also subject to live position size and protocol restrictions.</p>
                <p>Check the actual live open orders and position size to confirm whether a trigger order exists. A displayed estimate or configured trigger does not guarantee execution, an exit price or a realized PnL amount. Fast market moves and liquidation can override an expected result.</p>
              </Section>
              <Section id="history" title="11. Positions, open orders, fills and cancellations">
                <p>Use the account dashboard to view positions, open orders and relevant account or fill history where available. Distinguish a submitted request from an exchange-accepted order, a partially filled order and an actually completed trade.</p>
                <p>Wait for exchange acknowledgment before treating a cancellation as final. Do not assume delayed account refresh means the previous order failed; check order history and the live position first. Realized PnL, unrealized PnL, protocol fees and funding are separate concepts.</p>
              </Section>
              <Section id="funding" title="12. Balances, deposits, withdrawals and transfers">
                <p>Spot and Perpetual balances, available margin and transferable amounts can differ. Some accounts or modes may enforce collateral requirements or transfer restrictions.</p>
                <p><strong>Important:</strong> A displayed Deposit, Withdraw or Transfer control does not by itself verify that the full funding integration is currently operational. Availability can depend on enabled wallet approvals, supported asset/chain, protocol requirements, margin state and completed transaction responses. Never send funds to an unverified address or assume an unfinished transaction has settled. Check the actual available flow and final network or protocol status before moving funds.</p>
              </Section>
              <Section id="fees" title="13. Builder fees, protocol fees and funding">
                <p>The current HideDex trading configuration specifies a <strong>0.1% builder fee (10 basis points)</strong> on supported Spot/Perpetual order routes. This builder fee is separate from Hyperliquid protocol maker/taker fees, funding, slippage and any transfer or network charges.</p>
                <p>For illustration, 0.1% of a 100 USDC order notional equals 0.10 USDC in builder fee <em>before</em> other applicable charges. Actual final fees depend on the market, execution and live protocol rules. Review the order form's estimated fee, any builder-fee authorization and wallet confirmation.</p>
              </Section>
              <Section id="privacy" title="14. Security, display privacy and data collection">
                <p>Privacy display modes may conceal balances and other sensitive values on the screen, but they do not make on-chain transfers anonymous or erase public blockchain activity. Early Access stores wallet address, Gmail, X username and relevant registration/verification records. Browser preferences and service requests may also be processed.</p>
                <p>External wallets, the trading protocol, hosting and registration services have their own data-handling practices. Review the <a className="font-semibold underline text-[#145fbd]" href="/privacy">Privacy Policy</a> and <a className="font-semibold underline text-[#145fbd]" href="/risk">Risk Disclosure</a>. No system guarantees absolute wallet, browser or network security.</p>
              </Section>
              <Section id="token" title="15. Registration points and planned HIDE token">
                <p>Some Early Access screens may show verified registration or historical-volume points. The broader points program, HIDE token and any community airdrop are <strong>future project plans</strong>, not a live token claim or promise of returns.</p>
                <p>There is no finalized public token contract, eligibility formula, conversion ratio, claim date or guaranteed allocation described by this documentation. Beware of unofficial claim sites. For project-reported roadmap details, read the <a className="font-semibold underline text-[#145fbd]" href="/whitepaper">Whitepaper</a>.</p>
              </Section>
              <Section id="issues" title="16. Troubleshooting">
                <p><strong>Cannot connect a wallet:</strong> check your wallet app/extension, site permissions and displayed account address; reconnect using the wallet controls.</p>
                <p><strong>Trading is blocked:</strong> confirm that the current wallet—not merely a different registered wallet—has server-approved Early Access and has completed its required trading setup.</p>
                <p><strong>Insufficient margin/balance:</strong> recheck instrument type, size, estimated fees, collateral, reserved funds and currently withdrawable/available amounts.</p>
                <p><strong>Order stays pending:</strong> inspect open orders, fills and positions after the exchange responds; avoid a second submission until you know whether the first one was accepted.</p>
                <p><strong>Missing TP/SL:</strong> inspect live open orders and position size before attempting a replacement. <strong>Funding control unavailable:</strong> do not guess addresses, unsupported bridges or signature payloads; contact official support.</p>
              </Section>
              <Section id="developer" title="17. Technical reference and developer API status">
                <p>Public listing references: <a className="underline font-semibold text-[#145fbd]" href="/exchange-info">Exchange profile</a> · <a className="underline font-semibold text-[#145fbd]" href="/exchange-api">API reference</a> · <a className="underline font-semibold text-[#145fbd]" href="/market-info">Markets</a> · <a className="underline font-semibold text-[#145fbd]" href="/fees">Fees</a>.</p>
                <p>HideDex uses a React/TypeScript browser frontend with underlying Hyperliquid mainnet data and trading integrations, plus wallet-based permissions and Early Access authorization. These pages document the end-user interface rather than a new independent exchange protocol.</p>
                <p><strong>No separate public HideDex developer API or SDK is specified here.</strong> Do not infer third-party API endpoints, API keys, automated order permissions, smart-contract addresses or integration guarantees from this guide. Refer to the underlying protocol's official developer documentation for protocol-specific interfaces.</p>
              </Section>
              <Section id="support" title="18. Official links, support and policies">
                <p>For help, visit <a className="font-semibold underline text-[#145fbd]" href="/contact">Contact HideDex</a> or email <a className="font-semibold underline text-[#145fbd] break-all" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Report the feature, approximate time, reproducible steps and safe public transaction/order identifiers—never seed phrases or private keys.</p>
                <p>Read the <a className="font-semibold underline text-[#145fbd]" href="/whitepaper">Whitepaper</a>, <a className="font-semibold underline text-[#145fbd]" href="/faq">FAQ</a>, <a className="font-semibold underline text-[#145fbd]" href="/terms">Terms</a>, <a className="font-semibold underline text-[#145fbd]" href="/risk">Risk Disclosure</a>, <a className="font-semibold underline text-[#145fbd]" href="/privacy">Privacy Policy</a> and <a className="font-semibold underline text-[#145fbd]" href="/resources">Partners &amp; Resources</a>.</p>
                <p>Official updates: <a className="font-semibold underline text-[#145fbd]" href="https://x.com/HideDex_Com" target="_blank" rel="noopener noreferrer">@HideDex_Com</a>, <a className="font-semibold underline text-[#145fbd]" href="https://t.me/Hidedex_official" target="_blank" rel="noopener noreferrer">Telegram</a>, and <a className="font-semibold underline text-[#145fbd]" href="https://discord.gg/sZ8ZS98Psg" target="_blank" rel="noopener noreferrer">Discord</a>. This guide is educational and not investment advice.</p>
              </Section>
            </>
          )}
          {section === "resources" && (
            <>
              <p className="text-xs text-[#677c90]">Public directory references · Updated October 14, 2026</p>
              <Section title="Directories and industry references">
                <p>HideDex maintains these external directory references to help visitors discover and compare crypto trading tools. A directory link is not proof that HideDex is approved or listed there, and does not imply a business partnership or recommendation.</p>
                <div className="rounded-2xl border border-[#c4d9ee] bg-[#f3f8ff] p-5 space-y-2">
                  <h3 className="font-bold text-lg text-[#163c67]">PolyMart Crypto Tools Directory</h3>
                  <p>Browse external crypto tools, trading interfaces, wallets and research resources at PolyMart.</p>
                  <a href="https://polymart.app/crypto" target="_blank" rel="noopener noreferrer" className="inline-flex font-bold text-[#145fbd] underline break-words">Visit PolyMart Crypto Tools Directory ↗</a>
                </div>
              </Section>
              <Section title="Future references">
                <p>We can add other relevant public directory links to this page after confirming their official destination. An external listing remains subject to its own review; HideDex does not claim acceptance, affiliation or endorsement unless separately verified.</p>
              </Section>
              <Section title="Official documentation">
                <p>Read the <a href="/docs" className="font-semibold text-[#145fbd] underline">HideDex Documentation</a> for trading, wallet, fee and troubleshooting guides.</p>
                <p>Read the <a href="/whitepaper" className="font-semibold text-[#145fbd] underline">HideDex Whitepaper</a>, <a href="/terms" className="font-semibold text-[#145fbd] underline">Terms of Service</a>, <a href="/privacy" className="font-semibold text-[#145fbd] underline">Privacy Policy</a> and <a href="/contact" className="font-semibold text-[#145fbd] underline">Contact page</a>.</p>
              </Section>
            </>
          )}
          {section === "whitepaper" && (
            <>
              <p className="text-xs text-[#677c90]">Version 0.1 · October 14, 2026 · Project-provided roadmap; token details may change</p>
              <Section title="1. Executive overview">
                <p>HideDex is a privacy-minded, wallet-connected trading interface for supported Hyperliquid mainnet Spot and Perpetual markets. Our focus is to bring charts, market information, order controls and wallet-authorized trading together while leaving users in control of their own wallet permissions.</p>
                <p>The platform has an Early Access program for approved wallets. A future HIDE token and community airdrop are part of HideDex's announced project plans; distribution is not live.</p>
              </Section>
              <Section title="2. Vision: privacy and user control">
                <p>HideDex aims to help traders manage their own decisions, wallet authorizations and screen privacy. Optional display privacy modes can mask sensitive account figures from nearby viewers, but they do not make blockchain transfers anonymous or erase public wallet histories.</p>
                <p>Users keep control of their own external wallet keys. HideDex support does not require or request seed phrases, private keys or recovery codes. No website can guarantee that a phone, browser or wallet is absolutely safe from compromise.</p>
              </Section>
              <Section title="3. Current trading platform">
                <p>HideDex's existing interface supports discovery and trading workflows for Hyperliquid mainnet Spot and Perpetual markets, including charting, order-book views and order-management controls. Entry into the trading workspace currently depends on wallet-based Early Access approval.</p>
                <p>Transactions are authorized through the appropriate wallet or agent signing flow and are executed through supported underlying protocols. The HideDex interface is not an independently operated blockchain or a guarantee of transaction settlement.</p>
              </Section>
              <Section title="4. Privacy and data practices">
                <p>The project aims to minimize unnecessary data collection, but does collect information needed for some features. Early Access registration requests and stores the applicant's wallet address, X username, Gmail address and application/verification records. Browser settings, wallet-connected market data and technical service requests may also be processed.</p>
                <p>External wallet providers, Hyperliquid, hosting and registration infrastructure may process information under their own practices. Public blockchain transactions remain public. For accurate details, see the <a href="/privacy" className="font-semibold text-[#145fbd] underline">Privacy Policy</a>.</p>
              </Section>
              <Section title="5. HIDE token details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#d2e2f3] bg-[#f2f7ff] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#56718b]">Planned ticker</p><p className="text-3xl font-extrabold text-[#13375d]">HIDE</p></div>
                  <div className="rounded-xl border border-[#d2e2f3] bg-[#f2f7ff] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#56718b]">Project-stated total supply</p><p className="text-xl sm:text-2xl font-extrabold text-[#13375d]">1,000,000,000</p><p className="text-xs text-[#56718b]">1 billion HIDE planned</p></div>
                </div>
                <p>The ticker and supply are project-announced plans. They do not verify a deployed token contract or an existing circulating supply. The token's contract address, issuing network, vesting and allocation percentages have not been publicly finalized in this whitepaper.</p>
              </Section>
              <Section title="6. Announced future airdrop">
                <p>HideDex has announced a planned HIDE token airdrop for eligible community members. The airdrop is not currently being distributed. Eligibility criteria, point-to-token conversion, reward amounts, snapshot dates, vesting and claim procedures will be announced in future official rules.</p>
                <p>Connecting a wallet, submitting an Early Access form or earning any displayed points does not guarantee a specific token allocation or financial return. Users should beware of fake claim links and never share recovery phrases.</p>
              </Section>
              <Section title="7. Roadmap and 2027 target">
                <p><strong>Current:</strong> Hyperliquid mainnet trading interface, wallet-signature-backed Early Access and screen privacy controls.</p>
                <p><strong>Upcoming:</strong> Extended points features, improvements to the trading experience and detailed HIDE token/airdrop rules.</p>
                <p><strong>2027:</strong> The project is targeting a future HIDE token/airdrop milestone during 2027. This is a roadmap target, not a guaranteed listing, token generation or distribution deadline. Exact dates remain to be announced.</p>
              </Section>
              <Section title="8. Safety and risk">
                <p>Self-custody means users must secure their wallets and devices, inspect every signature and understand permissions. Leverage can rapidly liquidate positions and may cause the loss of posted collateral. Third-party API, network and protocol failures are possible. Read the <a href="/risk" className="font-semibold text-[#145fbd] underline">Risk Disclosure</a> and <a href="/terms" className="font-semibold text-[#145fbd] underline">Terms of Service</a>.</p>
              </Section>
              <Section title="9. Official information and updates">
                <p>Website: <a href="https://www.hidedex.com" className="font-semibold text-[#145fbd] underline">www.hidedex.com</a>. X: <a href="https://x.com/HideDex_Com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#145fbd] underline">@HideDex_Com</a>. Telegram: <a href="https://t.me/Hidedex_official" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#145fbd] underline">@Hidedex_official</a>. Discord: <a href="https://discord.gg/sZ8ZS98Psg" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#145fbd] underline">HideDex community</a>.</p>
                <p>Official support: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#145fbd] underline break-all">{SUPPORT_EMAIL}</a>. This document summarizes current product functionality and project plans and does not offer token purchases or guaranteed investment returns.</p>
              </Section>
            </>
          )}
          {section === "terms" && (
            <>
              <p className="text-xs text-[#677c90]">Last updated: October 13, 2026</p>
              <Section title="1. Platform and acceptance">
                <p>HideDex (hidedex.com) provides a wallet-connected trading interface for supported Hyperliquid mainnet Spot and Perpetual markets. By using HideDex, you agree to these terms, to act lawfully, and to review any applicable connected wallet and protocol terms.</p>
                <p>Market data, external wallets and protocols are third-party services. HideDex does not guarantee market prices, execution outcomes, uninterrupted availability, or the security of a third-party wallet or protocol.</p>
              </Section>
              <Section title="2. Early Access and legal eligibility">
                <p>Trading access is currently limited to approved wallets. Enrollment may collect a wallet address, X username and Gmail address and require a wallet-ownership signature. Applying does not guarantee access. Users are responsible for checking whether trading services are lawful in their jurisdiction and for respecting applicable restrictions.</p>
              </Section>
              <Section title="3. Wallets, transactions and fees">
                <p>Protect your wallet and review every signing request, connected network, trading amount and permission. HideDex support never needs your seed phrase, private key or recovery code. Wallet authorizations and blockchain transactions can be irreversible.</p>
                <p>Protocol fees, funding payments, network costs, slippage and any separately disclosed builder fees can apply. Review the live order and wallet confirmation before approving a transaction.</p>
              </Section>
              <Section title="4. Risks and responsibilities">
                <p>Digital assets can lose value. Leverage magnifies losses, and Perpetual positions may be liquidated with the loss of all posted collateral. Third-party services, markets and networks may experience errors or delays. See the <a href="/risk" className="underline font-semibold text-[#145fbd]">Trading Risk Disclosure</a>.</p>
              </Section>
              <Section title="5. Points and future token distribution">
                <p>HideDex plans future points-to-token rewards. The planned HIDE ticker has been announced by the project; distribution timing, conversion ratio, eligibility and allocation rules have not yet been finalized or published. Registration, points and trading access are separate; no particular token amount, distribution date or financial return is promised. Further program rules will be published when available.</p>
              </Section>
              <Section title="6. Privacy, updates and support">
                <p>The <a href="/privacy" className="underline font-semibold text-[#145fbd]">Privacy Policy</a> describes Early Access records and browser data practices. Terms and website features may be revised, with an updated date when revised.</p>
                <p>Questions: <a className="underline font-semibold text-[#145fbd] break-all" href={`mailto:${SUPPORT_EMAIL}?subject=HideDex%20Terms`}>{SUPPORT_EMAIL}</a>.</p>
              </Section>
            </>
          )}
          {section === "risk" && (
            <>
              <p className="text-xs text-[#677c90]">Last updated: October 13, 2026</p>
              <Section title="Market risk and possible loss">
                <p>Cryptoasset prices can move sharply; some or all value can be lost. Liquidity, spread, slippage and order-book conditions can change without warning. Historical trading results are not a guarantee of future performance.</p>
              </Section>
              <Section title="Leverage and liquidation">
                <p>Leverage magnifies losses as well as gains. Perpetual positions may be liquidated rapidly and all posted margin may be lost. Read margin and funding rules before trading.</p>
              </Section>
              <Section title="Wallet, protocol and operational risk">
                <p>Blockchain transactions can be irreversible. Wallet connectors, networks, price feeds, APIs and smart contracts can fail, be delayed, or suffer security incidents or outages. Check signed permissions and live account information yourself.</p>
              </Section>
              <Section title="Fees and trading decisions">
                <p>Trading can involve funding, protocol charges, slippage and disclosed builder fees. HideDex does not guarantee returns or provide personalized investment advice. Consider your own risk tolerance and independent advice where appropriate.</p>
              </Section>
              <Section title="Contact">
                <p>Questions about these disclosures: <a className="underline font-semibold text-[#145fbd] break-all" href={`mailto:${SUPPORT_EMAIL}?subject=HideDex%20Risk`}>{SUPPORT_EMAIL}</a>. See also the <a href="/terms" className="underline font-semibold text-[#145fbd]">Terms of Service</a>.</p>
              </Section>
            </>
          )}
          {section === "privacy" && (
            <>
              <p className="text-xs text-[#677c90]">Last updated: October 12, 2026</p>
              <Section title="1. Information handled by HideDex">
                <p>When you connect a wallet, the interface can read your public wallet address and publicly available market and trading data. Early Access enrollment asks for a wallet address, X username and Gmail address; the server stores registration, verification and application status records, including verified volume snapshots where available.</p>
                <p>We do not need your wallet seed phrase or private key for enrollment or support. Never send these to anyone.</p>
              </Section>
              <Section title="2. Why this information is used">
                <p>To check Early Access eligibility, show registration status, support wallet-connected features, prevent duplicate submissions and respond to support requests. Trading-related information may be obtained from Hyperliquid and other integrated providers.</p>
              </Section>
              <Section title="3. Browser storage and local privacy">
                <p>Browser storage may save theme choices, trading preferences, session state and local privacy settings. Some trading-agent credentials use encrypted browser storage. Your wallet provider and third-party services may also have their own storage or cookie practices.</p>
                <p>Standard, Private and Anonymous display modes control what is shown on your screen; they do not make blockchain transactions anonymous or erase public on-chain wallet activity.</p>
              </Section>
              <Section title="4. Service providers and public blockchain records">
                <p>HideDex uses integrations such as wallet connectors, Hyperliquid market/trading APIs, Vercel hosting and Supabase Early Access services. These services may process network, account or request information according to their own practices. Public transaction history cannot be removed from the blockchain by hiding information in the interface.</p>
              </Section>
              <Section title="5. X account verification posts">
                <p>HideDex's public X post contains an HDX reference derived from the connected wallet's last 10 characters; this is not a unique wallet-ownership proof. A separate server-issued enrollment record is saved only through wallet-signed registration. Applicants may post from their X account; authorized staff can compare the post, registered X username and signed wallet record for manual review. X verification is independent of waitlist approval and verified-volume points.</p>
                <p>X posts are public and controlled by the account owner. HideDex does not have permission to delete posts automatically, and X may retain data under its own policies.</p>
              </Section>
              <Section title="6. Retention and requests">
                <p>Registration and verification records can be retained as needed to operate Early Access, prevent abuse and handle support. For questions about stored account information or a deletion request, contact the support address below. Public blockchain data and third-party records may remain outside HideDex's control.</p>
              </Section>
              <Section title="7. Contact">
                <p>For privacy-related requests, email <a className="font-semibold text-[#145fbd] underline break-all" href={`mailto:${SUPPORT_EMAIL}?subject=HideDex%20Privacy%20Request`}>{SUPPORT_EMAIL}</a>. This document may be updated as features, hosting or data practices change.</p>
              </Section>
            </>
          )}
          {section === "about" && (
            <>
              <Section title="What is HideDex?">
                <p>HideDex is a wallet-connected interface for viewing cryptocurrency markets and accessing supported spot and perpetual trading through integrated protocols, including Hyperliquid. It brings market selection, charts, order book and order management together in one responsive workspace.</p>
              </Section>
              <Section title="Wallet-controlled experience">
                <p>Users connect their own wallets. Transactions and trading authorizations require the applicable wallet or authorized-agent permissions and underlying protocol checks. The Early Access approval flow remains separate from these public information pages.</p>
              </Section>
              <Section title="Privacy controls">
                <p>Display privacy modes help mask sensitive figures or account information on screen. They do not conceal public blockchain transactions, guarantee network anonymity or replace wallet security.</p>
              </Section>
              <Section title="Trading risk">
                <p>Digital assets and leveraged perpetual contracts are risky. Prices move rapidly, trading fees and slippage can apply, and leveraged positions can be liquidated. Review the protocol's terms, fee disclosures and transaction details before authorizing actions.</p>
              </Section>
              <Section title="Contact and updates">
                <p>The official HideDex X profile is <a className="font-semibold underline text-[#145fbd]" href="https://x.com/HideDex_Com" target="_blank" rel="noopener noreferrer">@HideDex_Com</a>. Visit our <a className="font-semibold underline text-[#145fbd]" href="/contact">Contact page</a> for support.</p>
              </Section>
            </>
          )}
          {section === "markets" && (
            <>
              <Section title="Explore spot markets">
                <p>Spot markets let eligible traders exchange supported assets through the underlying integrated trading protocol. Available symbols, orders and market data come from the connected market service, not from a prefilled promotional price list.</p>
                <p>Market listings may vary over time. Check the live order book, token identifiers, prices and applicable fees before submitting an order.</p>
              </Section>
              <Section title="Perpetual trading">
                <p>Perpetual contracts allow trading price exposure with margin, including leverage where supported. They carry liquidation risk; displayed balances, funding and position information must be checked against live account data.</p>
                <p>Orders and other account-changing actions require the appropriate wallet or agent authorizations. HideDex does not approve trades on the basis of visiting this public page.</p>
              </Section>
              <Section title="Open the trading interface">
                <p>Trading is currently limited to wallets with granted Early Access. Visit the <a className="underline font-semibold text-[#145fbd]" href="/">HideDex homepage</a> and select Launch App to check approval with your connected wallet. Unapproved visitors remain on the waitlist.</p>
                <p>Learn <a className="underline font-semibold text-[#145fbd]" href="/early-access">how Early Access works</a> or read the <a className="underline font-semibold text-[#145fbd]" href="/faq">trading FAQ</a>.</p>
              </Section>
            </>
          )}
          {section === "early-access" && (
            <>
              <Section title="How to request Early Access">
                <p>Open the <a className="underline font-semibold text-[#145fbd]" href="/">official HideDex homepage</a> and select Early Access. Connect your own wallet, enter your X username and Gmail address, and use Submit to begin a free wallet-ownership signature for registration.</p>
                <p>The Copy Post and Post on X buttons prepare a public post; using them alone does not submit a signed registration or grant trading access. Never share your wallet recovery phrase.</p>
              </Section>
              <Section title="X verification and waitlist">
                <p>When available, the post contains an HDX reference based on the wallet address. X verification is reviewed separately from waitlist approval. Posting publicly does not automatically approve an account.</p>
                <p>Return to the homepage to check your status. Trading access is granted only after HideDex verifies the connected wallet against the current server-side access status.</p>
              </Section>
              <Section title="Trading-volume points">
                <p>Early Access may display verified registration points from supported historical-volume data. The broader points program and planned future points-to-token rewards are upcoming; distribution dates and conversion ratios have not been announced. Points and trading access are separate.</p>
                <p>Find further answers in our <a className="underline font-semibold text-[#145fbd]" href="/faq">FAQ</a>.</p>
              </Section>
            </>
          )}
          {section === "faq" && (
            <>
              <Section title="What is HideDex?">
                <p>HideDex is a wallet-connected interface for supported spot and perpetual markets, charting and order management. See <a className="underline font-semibold text-[#145fbd]" href="/about">About HideDex</a> for more details.</p>
              </Section>
              <Section title="Who can trade now?">
                <p>Only wallets with granted Early Access can enter the trading app while the rollout is restricted. Connecting or registering a wallet, posting on X or earning points does not by itself grant trading approval. Read the <a className="underline font-semibold text-[#145fbd]" href="/early-access">Early Access guide</a>.</p>
              </Section>
              <Section title="Does Copy Post submit my application?">
                <p>No. Copy Post copies the X post text and Post on X opens an X composer. To enroll you must explicitly submit the Early Access form and complete its separate wallet-ownership signature.</p>
              </Section>
              <Section title="What trading markets and fees are supported?">
                <p>Eligible wallets can view the live supported spot and perpetual market list. Trading fees and protocol conditions vary; always review the trading form, disclosed builder fee and wallet confirmation before approving an order. See <a className="underline font-semibold text-[#145fbd]" href="/markets">Trading Markets</a>.</p>
              </Section>
              <Section title="Are my on-chain transactions anonymous?">
                <p>No. Display privacy modes can hide information on your screen, but they do not make public blockchain activity anonymous. Read the <a className="underline font-semibold text-[#145fbd]" href="/privacy">Privacy Policy</a>.</p>
              </Section>
              <Section title="How do I contact the official team?">
                <p>Use the <a className="underline font-semibold text-[#145fbd]" href="/contact">Contact HideDex</a> page. Never send private keys, seed phrases or wallet recovery codes to anyone.</p>
              </Section>
            </>
          )}
          {section === "contact" && (
            <>
              <Section title="Official support email">
                <p>Reach HideDex about wallet connections, trading interface errors, Early Access, privacy requests, feedback or technical questions.</p>
                <a href={`mailto:${SUPPORT_EMAIL}?subject=HideDex%20Support`} className="inline-flex items-center justify-center rounded-xl bg-[#216bd3] text-white px-5 py-3 font-bold text-sm hover:bg-[#144f9f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 break-all">{SUPPORT_EMAIL}</a>
                <p>If your email application does not open, copy the address and contact us from your preferred mail provider.</p>
              </Section>
              <Section title="Report a security issue">
                <p>Use the subject “HideDex Security Report”. Describe the affected feature, expected behavior and steps to reproduce without exposing other people's accounts or performing transactions with their funds. Share screenshots or public transaction hashes if necessary, after removing sensitive information.</p>
                <a className="text-[#145fbd] underline font-semibold" href={`mailto:${SUPPORT_EMAIL}?subject=HideDex%20Security%20Report`}>Email a security report</a>
              </Section>
              <Section title="Stay safe">
                <p>HideDex support will never need your seed phrase, private key or wallet recovery codes. Be careful with impersonator accounts, unofficial links and unexpected signature requests.</p>
                <p>Official X profile: <a className="font-semibold underline text-[#145fbd]" href="https://x.com/HideDex_Com" target="_blank" rel="noopener noreferrer">@HideDex_Com</a>. Official Telegram: <a className="font-semibold underline text-[#145fbd]" href="https://t.me/Hidedex_official" target="_blank" rel="noopener noreferrer">@Hidedex_official</a>. Official Discord: <a className="font-semibold underline text-[#145fbd]" href="https://discord.gg/sZ8ZS98Psg" target="_blank" rel="noopener noreferrer">Join the HideDex Discord</a>. Beware of impersonators.</p>
              </Section>
            </>
          )}
        </article>
      </main>
      <footer className="border-t border-[#dfe9f3] bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-[#486681]">
          <span>© {new Date().getFullYear()} HideDex</span>
          <nav aria-label="Footer links" className="flex gap-4 flex-wrap justify-center font-semibold">
            <a className="hover:text-[#226ac9]" href="/">Home</a>
            <a className="hover:text-[#226ac9]" href="/docs">Documentation</a>
            <a className="hover:text-[#226ac9]" href="/exchange-info">Exchange Information</a>
            <a className="hover:text-[#226ac9]" href="/whitepaper">Whitepaper</a>
            <a className="hover:text-[#226ac9]" href="/resources">Partners &amp; Resources</a>
            <a className="hover:text-[#226ac9]" href="/terms">Terms</a>
            <a className="hover:text-[#226ac9]" href="/risk">Risk Disclosure</a>
            <a className="hover:text-[#226ac9]" href="/privacy">Privacy Policy</a>
            <a className="hover:text-[#226ac9]" href="/about">About</a>
            <a className="hover:text-[#226ac9]" href="/markets">Trading Markets</a>
            <a className="hover:text-[#226ac9]" href="/early-access">Early Access</a>
            <a className="hover:text-[#226ac9]" href="/faq">FAQ</a>
            <a className="hover:text-[#226ac9]" href="/contact">Contact</a>
            <a className="hover:text-[#226ac9]" href="https://www.coingecko.com/en/exchanges" target="_blank" rel="noopener noreferrer">CoinGecko Directory ↗</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
