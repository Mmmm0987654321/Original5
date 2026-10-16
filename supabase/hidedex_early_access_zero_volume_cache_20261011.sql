-- PREVIEW ONLY: apply with owner approval before deploying Edge v7.
-- Existing signed registration/permission flow and RLS are unchanged.
BEGIN;
ALTER TABLE public.hidedex_early_access
  ADD COLUMN IF NOT EXISTS volume_retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.hidedex_early_access
  DROP CONSTRAINT IF EXISTS hidedex_early_access_allowed_point_tiers;
ALTER TABLE public.hidedex_early_access
  ADD CONSTRAINT hidedex_early_access_allowed_point_tiers
  CHECK (points IS NULL OR points IN (0,0.10,1,2,3,5,6,7,8,12));
ALTER TABLE public.hidedex_early_access
  ADD CONSTRAINT hidedex_early_access_volume_retry_count_bounds
  CHECK (volume_retry_count BETWEEN 0 AND 16);
COMMENT ON COLUMN public.hidedex_early_access.volume_retry_count IS
 'Consecutive upstream volume checks attempted for per-wallet exponential backoff; verified zero is valid.';
COMMIT;
