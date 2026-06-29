-- Reconcile production payment schema with the Paystack checkout code.
-- This migration is intentionally additive/idempotent and does not rewrite
-- existing production rows.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS interval_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS variant text DEFAULT 'outline';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'charge',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS installment_id uuid,
  ADD COLUMN IF NOT EXISTS installment_number integer;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  total_installments integer NOT NULL,
  installments_paid integer NOT NULL DEFAULT 0,
  amount_total_cents bigint NOT NULL,
  amount_paid_cents bigint NOT NULL DEFAULT 0,
  installment_amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  next_due_at timestamptz,
  last_paid_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.payment_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_installments_status_check'
      AND conrelid = 'public.payment_installments'::regclass
  ) THEN
    ALTER TABLE public.payment_installments
      ADD CONSTRAINT payment_installments_status_check
      CHECK (status = ANY (ARRAY['active','completed','overdue','canceled']))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coupons_discount_type_check'
      AND conrelid = 'public.coupons'::regclass
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_discount_type_check
      CHECK (discount_type = ANY (ARRAY['percent','fixed']))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coupons_discount_value_check'
      AND conrelid = 'public.coupons'::regclass
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_discount_value_check
      CHECK (discount_value > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_installment_id_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_installment_id_fkey
      FOREIGN KEY (installment_id)
      REFERENCES public.payment_installments(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference
  ON public.payments(reference)
  WHERE reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_invoice_number
  ON public.payments(invoice_number)
  WHERE invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_plan
  ON public.payments(plan_id);

CREATE INDEX IF NOT EXISTS idx_payments_gateway
  ON public.payments(gateway)
  WHERE gateway IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installments_user
  ON public.payment_installments(user_id);

CREATE INDEX IF NOT EXISTS idx_installments_due
  ON public.payment_installments(next_due_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_installments_subscription
  ON public.payment_installments(subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_plan
  ON public.coupons(plan_id)
  WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_active
  ON public.coupons(is_active, valid_from, valid_until);

GRANT SELECT ON public.payment_installments TO authenticated;
GRANT ALL ON public.payment_installments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
GRANT SELECT ON public.payment_provider_settings TO anon, authenticated;
GRANT ALL ON public.payment_provider_settings TO service_role;

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_installments'
      AND policyname = 'Members read own installments'
  ) THEN
    CREATE POLICY "Members read own installments"
      ON public.payment_installments
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coupons'
      AND policyname = 'Admins manage coupons'
  ) THEN
    CREATE POLICY "Admins manage coupons"
      ON public.coupons
      FOR ALL
      TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_provider_settings'
      AND policyname = 'Anyone can view provider settings'
  ) THEN
    CREATE POLICY "Anyone can view provider settings"
      ON public.payment_provider_settings
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_provider_settings'
      AND policyname = 'Admins manage provider settings'
  ) THEN
    CREATE POLICY "Admins manage provider settings"
      ON public.payment_provider_settings
      FOR ALL
      TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_payment_installments_updated_at'
      AND tgrelid = 'public.payment_installments'::regclass
  ) THEN
    CREATE TRIGGER update_payment_installments_updated_at
      BEFORE UPDATE ON public.payment_installments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_coupons_updated'
      AND tgrelid = 'public.coupons'::regclass
  ) THEN
    CREATE TRIGGER trg_coupons_updated
      BEFORE UPDATE ON public.coupons
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_provider_settings_updated'
      AND tgrelid = 'public.payment_provider_settings'::regclass
  ) THEN
    CREATE TRIGGER trg_provider_settings_updated
      BEFORE UPDATE ON public.payment_provider_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
