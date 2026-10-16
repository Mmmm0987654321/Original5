-- A public, immutable X proof ID is reserved on wallet connection, before signing.
-- The code does NOT represent wallet ownership, enrollment, points or trading access.
CREATE TABLE IF NOT EXISTS public.hidedex_x_proof_reservations (
 wallet_address text PRIMARY KEY CHECK (wallet_address ~ '^0x[0-9a-f]{40}$'),
 x_verification_code text NOT NULL UNIQUE
  DEFAULT ('HDX-' || lpad(nextval('public.hidedex_x_verification_seq'::regclass)::text, 8, '0')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hidedex_x_proof_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hidedex_x_proof_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.hidedex_x_proof_reservations TO service_role;

-- Serialize concurrent code requests for a wallet; existing enrollment wins.
CREATE OR REPLACE FUNCTION public.hidedex_reserve_x_proof_code(p_wallet text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_code text;
BEGIN
 IF p_wallet IS NULL OR p_wallet !~ '^0x[0-9a-f]{40}$' THEN
  RAISE EXCEPTION 'Invalid wallet address';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_wallet, 0));
 SELECT e.x_verification_code INTO v_code
 FROM public.hidedex_early_access e WHERE e.wallet_address = p_wallet;
 IF v_code IS NOT NULL THEN RETURN v_code; END IF;
 INSERT INTO public.hidedex_x_proof_reservations(wallet_address)
 VALUES(p_wallet) ON CONFLICT(wallet_address) DO NOTHING;
 SELECT r.x_verification_code INTO v_code
 FROM public.hidedex_x_proof_reservations r WHERE r.wallet_address = p_wallet;
 RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.hidedex_reserve_x_proof_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidedex_reserve_x_proof_code(text) TO service_role;
