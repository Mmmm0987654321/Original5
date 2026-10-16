-- ==============================================================================
-- HideDex Early Access Schema & RPC Setup
-- Run this script in the Supabase SQL Editor
-- ==============================================================================

-- 1. Create table for Early Access registration with normalized wallet identity
CREATE TABLE IF NOT EXISTS public.early_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    x_username TEXT NOT NULL,
    gmail TEXT NOT NULL,
    access_status TEXT NOT NULL DEFAULT 'pending' CHECK (access_status IN ('pending', 'granted', 'rejected')),
    queue_position INTEGER,
    hyperliquid_volume_usd NUMERIC(20, 4),
    lighter_volume_usd NUMERIC(20, 4),
    total_external_volume_usd NUMERIC(20, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    volume_checked_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enforce strict unique normalized wallet constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_early_access_normalized_wallet 
ON public.early_access (lower(trim(wallet_address)));

-- 3. Queue sequence tracking index
CREATE INDEX IF NOT EXISTS idx_early_access_queue_position 
ON public.early_access (queue_position);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.early_access ENABLE ROW LEVEL SECURITY;

-- Anonymous users may read their own status via RPC functions only
DROP POLICY IF EXISTS "Deny direct anon select" ON public.early_access;
CREATE POLICY "Deny direct anon select" ON public.early_access
    FOR SELECT TO anon USING (false);

-- 5. RPC: get_early_access_status
-- Authoritative check by normalized EVM wallet address
CREATE OR REPLACE FUNCTION public.get_early_access_status(
    p_wallet TEXT
)
RETURNS TABLE (
    wallet_address TEXT,
    access_status TEXT,
    queue_position INTEGER,
    hyperliquid_volume_usd NUMERIC,
    lighter_volume_usd NUMERIC,
    total_external_volume_usd NUMERIC,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_normalized TEXT;
BEGIN
    v_normalized := lower(trim(p_wallet));
    
    RETURN QUERY
    SELECT 
        ea.wallet_address,
        ea.access_status,
        ea.queue_position,
        ea.hyperliquid_volume_usd,
        ea.lighter_volume_usd,
        ea.total_external_volume_usd,
        ea.created_at
    FROM public.early_access ea
    WHERE lower(trim(ea.wallet_address)) = v_normalized
    LIMIT 1;
END;
$$;

-- 6. RPC: join_early_access
-- Idempotent registration: if wallet already exists, returns existing record without creating duplicates.
CREATE OR REPLACE FUNCTION public.join_early_access(
    p_wallet TEXT,
    p_x_username TEXT,
    p_gmail TEXT,
    p_hyperliquid_volume NUMERIC DEFAULT NULL,
    p_lighter_volume NUMERIC DEFAULT NULL,
    p_total_volume NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    wallet_address TEXT,
    access_status TEXT,
    queue_position INTEGER,
    hyperliquid_volume_usd NUMERIC,
    lighter_volume_usd NUMERIC,
    total_external_volume_usd NUMERIC,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_normalized TEXT;
    v_existing_id UUID;
    v_next_pos INTEGER;
BEGIN
    v_normalized := lower(trim(p_wallet));

    IF v_normalized IS NULL OR length(v_normalized) < 10 THEN
        RAISE EXCEPTION 'Invalid wallet address provided.';
    END IF;

    -- Check if record already exists for this normalized wallet
    SELECT ea.id INTO v_existing_id
    FROM public.early_access ea
    WHERE lower(trim(ea.wallet_address)) = v_normalized
    LIMIT 1;

    -- If already registered, return existing record (idempotent, no duplicate)
    IF v_existing_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            ea.wallet_address,
            ea.access_status,
            ea.queue_position,
            ea.hyperliquid_volume_usd,
            ea.lighter_volume_usd,
            ea.total_external_volume_usd,
            ea.created_at
        FROM public.early_access ea
        WHERE ea.id = v_existing_id;
        RETURN;
    END IF;

    -- Calculate next queue position
    SELECT coalesce(max(ea.queue_position), 0) + 1 INTO v_next_pos
    FROM public.early_access ea;

    -- Insert new registration record
    RETURN QUERY
    INSERT INTO public.early_access (
        wallet_address,
        x_username,
        gmail,
        access_status,
        queue_position,
        hyperliquid_volume_usd,
        lighter_volume_usd,
        total_external_volume_usd,
        volume_checked_at
    )
    VALUES (
        v_normalized,
        trim(p_x_username),
        lower(trim(p_gmail)),
        'pending',
        v_next_pos,
        p_hyperliquid_volume,
        p_lighter_volume,
        p_total_volume,
        CASE WHEN p_hyperliquid_volume IS NOT NULL OR p_lighter_volume IS NOT NULL THEN now() ELSE NULL END
    )
    RETURNING 
        early_access.wallet_address,
        early_access.access_status,
        early_access.queue_position,
        early_access.hyperliquid_volume_usd,
        early_access.lighter_volume_usd,
        early_access.total_external_volume_usd,
        early_access.created_at;
END;
$$;

-- Grant execution permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_early_access_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_early_access(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated;
