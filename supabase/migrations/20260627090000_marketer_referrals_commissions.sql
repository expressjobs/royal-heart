-- Marketer referrals and commission tracking.
-- Admin-managed only; public clients cannot directly mutate these tables.

CREATE TABLE IF NOT EXISTS public.marketers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  referral_code text UNIQUE NOT NULL,
  referral_slug text UNIQUE NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 0.15,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  source_url text,
  status text NOT NULL DEFAULT 'visited' CHECK (status IN ('visited', 'signup', 'paid', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.marketer_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  gross_amount numeric NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 0.15,
  commission_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketers_status_idx ON public.marketers (status);
CREATE INDEX IF NOT EXISTS referrals_marketer_idx ON public.referrals (marketer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_referred_user_idx ON public.referrals (referred_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_marketer_per_user_idx
  ON public.referrals (referred_user_id)
  WHERE referred_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketer_commissions_marketer_idx
  ON public.marketer_commissions (marketer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS marketer_commissions_payment_unique_idx
  ON public.marketer_commissions (payment_id)
  WHERE payment_id IS NOT NULL;

GRANT SELECT ON public.marketers TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.marketer_commissions TO authenticated;
GRANT ALL ON public.marketers TO service_role;
GRANT ALL ON public.referrals TO service_role;
GRANT ALL ON public.marketer_commissions TO service_role;

ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read marketers" ON public.marketers;
CREATE POLICY "Admins read marketers"
  ON public.marketers FOR SELECT TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read referrals" ON public.referrals;
CREATE POLICY "Admins read referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read marketer commissions" ON public.marketer_commissions;
CREATE POLICY "Admins read marketer commissions"
  ON public.marketer_commissions FOR SELECT TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));
