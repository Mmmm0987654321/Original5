# HideDex Builder Analytics — scoped patch (2026-10-11)
- Original main backup: backup/main-before-builder-stats-cleanup-20261011
- Verified Early Access registrations: hide current Wallet Volume panel and stop needless volume fetch; show saved volume at verification above frozen points. Pending verification must never be represented as $0.
- Funds: remove duplicated account-wide Performance PnL and volume + equity chart; present one HideDex Trading Activity panel; remove long daily chart/explanatory paragraphs.
- Builder address must be read from getBuilderAddress() in src/lib/hyperliquid.ts, NOT any example or hardcoded alternative.
- Existing Hyperliquid userFills API fields include optional builderFee but do NOT include a guaranteed builder address. Presence of builderFee is NOT proof that HideDex routed the fill.
- This UI is deliberately strict: only direct records carrying an exact builder identity are counted; otherwise it displays "Awaiting verification" rather than attributing other app trades.
- **Required next stage:** verified backend ingestion from official Hyperliquid daily LZ4 archive at https://stats-data.hyperliquid.xyz/Mainnet/builder_fills/{builder_address_lowercase}/{YYYYMMDD}.csv.lz4; validate headers time,user,coin,px,sz,closed_pnl,builder_fee, dedupe safely; backfill and paginate/cap; match account-specific detailed fill fees without guessing; differentiate closed PnL from net after fees/funding.
- **No backend archive integration is in this patch.** All-time HideDex-only totals must NOT be claimed available until archive indexing is verified.
- Protected: no trading execution, builder fee settings, wallet signing, TP/SL, transfers, Supabase database or packages changed.
