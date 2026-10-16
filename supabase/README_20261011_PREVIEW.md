HideDex PREVIEW — 2026-10-11. No live Supabase deployment was performed.
1) MAIN / production unchanged. GitHub original main: 4a12b73b07d2aabad1bf8fdb94c24ca95254b3ba
2) Backup branch: backup/main-before-earlyaccess-cleanup-20261011
   Supabase live Edge v6 snapshot: supabase/backups/hidedex-early-access-v6-20261011.ts (backup branch)
3) SQL must be deployed BEFORE the updated Edge function: supabase/hidedex_early_access_zero_volume_cache_20261011.sql
4) Supabase new Edge source (not deployed): supabase/functions/hidedex-early-access/index.ts
5) Confirmed $0 Hyperliquid + $0 Lighter volume => verified points=0. A missing/unreachable API is NULL/PENDING, not 0.
6) Other real tier rules remain unchanged; partial exchange successes cached in existing columns; per-wallet CAS and backoff.
7) This is bounded transient HTTP retry with durable per-wallet backoff/cache. A true GLOBAL
   100k-burst queue and global API concurrency cap is NOT included; it needs separate worker/queue rollout.
8) Social PointsModal dummy removed; currently active Supabase Early Access points remain.
9) Hardcoded App price alert demo/monitor removed; notification bell/log and trade notifications stay.
10) Unreachable TWAP history presentation removed; raw exchange order metadata, funding and trade histories untouched.
11) No on-chain transactions, user funds or wallet credentials touched.
12) Review preview CI and live wallet behavior before any main merge or Supabase migration/deployment.
