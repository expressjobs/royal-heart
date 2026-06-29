-- ============ Helper: tier ranking (private, not API-exposed) ============
CREATE OR REPLACE FUNCTION private.tier_rank(_tier public.membership_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _tier
    WHEN 'free' THEN 0
    WHEN 'premium' THEN 1
    WHEN 'gold' THEN 2
    WHEN 'platinum' THEN 3
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION private.tier_at_least(_uid uuid, _min public.membership_tier)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid
      AND private.tier_rank(membership_tier) >= private.tier_rank(_min)
  )
$$;

-- ============ Update is_premium to include the new 'premium' tier where appropriate ============
-- Messaging stays a Gold+ benefit; like limits become a Premium+ benefit (handled in enforce_like_limit).
-- is_premium remains Gold+ for unlimited messaging.
CREATE OR REPLACE FUNCTION private.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND membership_tier IN ('gold'::public.membership_tier, 'platinum'::public.membership_tier)
  );
$$;

-- Unlimited likes become a Premium+ benefit.
CREATE OR REPLACE FUNCTION public.enforce_like_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  today_count integer;
BEGIN
  IF private.is_banned(NEW.liker_id) THEN
    RAISE EXCEPTION 'Your account is suspended.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.is_like IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- Premium, Gold and Platinum members have unlimited likes.
  IF private.tier_at_least(NEW.liker_id, 'premium'::public.membership_tier) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO today_count
  FROM public.likes
  WHERE liker_id = NEW.liker_id
    AND is_like = true
    AND created_at >= date_trunc('day', now());

  IF today_count >= 10 THEN
    RAISE EXCEPTION 'Daily like limit reached. Upgrade for unlimited likes.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ============ Allow the secure server-side checkout (service role) to apply tier upgrades ============
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  -- Admins and the trusted service role (server-side checkout/webhooks) may change privileged fields.
  IF private.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'You are not allowed to change membership tier, verification, or featured status.';
  END IF;

  RETURN NEW;
END;
$$;

-- ============ subscription_plans ============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.membership_tier NOT NULL,
  name text NOT NULL,
  slug text UNIQUE,
  tagline text,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('day','week','month','quarter','year')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  badge text,
  variant text NOT NULL DEFAULT 'outline',
  is_active boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active visible plans" ON public.subscription_plans
  FOR SELECT USING (is_active AND is_visible);
CREATE POLICY "Admins can view all plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ subscriptions ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  tier public.membership_tier NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trialing','active','past_due','canceled','expired')),
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe','paypal','mpesa','airtel','manual')),
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ payments (transactions + invoices + refunds) ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe','paypal','mpesa','airtel','manual')),
  provider_payment_id text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded')),
  kind text NOT NULL DEFAULT 'charge' CHECK (kind IN ('charge','refund')),
  description text,
  coupon_code text,
  invoice_number text UNIQUE,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_created ON public.payments(created_at);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all payments" ON public.payments
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ coupons / promo codes (admin-only; validated server-side) ============
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  currency text NOT NULL DEFAULT 'USD',
  max_redemptions integer,
  times_redeemed integer NOT NULL DEFAULT 0,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ payment_provider_settings ============
CREATE TABLE public.payment_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider IN ('stripe','paypal','mpesa','airtel')),
  display_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_provider_settings TO anon, authenticated;
GRANT ALL ON public.payment_provider_settings TO service_role;
ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view provider settings" ON public.payment_provider_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins manage provider settings" ON public.payment_provider_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_provider_settings_updated BEFORE UPDATE ON public.payment_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ seed default provider rows (non-secret config) ============
INSERT INTO public.payment_provider_settings (provider, display_name, is_enabled, sort_order, config) VALUES
  ('stripe', 'Stripe (Card)', true, 0, '{"mode":"test"}'::jsonb),
  ('paypal', 'PayPal', false, 1, '{}'::jsonb),
  ('mpesa', 'M-Pesa', false, 2, '{}'::jsonb),
  ('airtel', 'Airtel Money', false, 3, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;