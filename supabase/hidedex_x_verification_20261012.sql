-- HideDex Early Access: independent manual X verification (2026-10-12).
-- Public proof IDs do not grant trading, modify access_status, or award points.
-- The sequence is non-cycling: IDs, including unused ones, are NEVER reused.
create sequence if not exists public.hidedex_x_verification_seq as bigint start with 1 increment by 1 no cycle;
revoke all on sequence public.hidedex_x_verification_seq from public, anon, authenticated;
alter table public.hidedex_early_access
 add column if not exists x_verification_code text,
 add column if not exists x_verification_status text not null default 'pending',
 add column if not exists x_verified_at timestamptz,
 add column if not exists x_post_url text;
alter table public.hidedex_early_access
 alter column x_verification_code set default ('HDX-' || lpad(nextval('public.hidedex_x_verification_seq'::regclass)::text,8,'0'));
update public.hidedex_early_access set x_verification_code = default where x_verification_code is null;
alter table public.hidedex_early_access alter column x_verification_code set not null;
create unique index if not exists hidedex_early_access_x_code_unique on public.hidedex_early_access (x_verification_code);
create unique index if not exists hidedex_early_access_x_handle_unique on public.hidedex_early_access (lower(x_username));
alter table public.hidedex_early_access
 add constraint hidedex_x_code_format check (x_verification_code ~ '^HDX-[0-9]{8,}$');
alter table public.hidedex_early_access
 add constraint hidedex_x_status_allowed check (x_verification_status in ('pending','verified','rejected'));
alter table public.hidedex_early_access
 add constraint hidedex_x_verified_has_timestamp check (x_verification_status <> 'verified' or x_verified_at is not null);
comment on column public.hidedex_early_access.x_verification_code is 'Public one-time X proof code. Generated only on wallet-signed signup, not recycled or regenerated.';
comment on column public.hidedex_early_access.x_verification_status is 'Manual X account status independent of Early Access and volume-based points.';
