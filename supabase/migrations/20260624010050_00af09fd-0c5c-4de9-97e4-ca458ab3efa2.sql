-- 1. Relax provider CHECK constraints to allow Paystack
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_check
  CHECK (provider = ANY (ARRAY['stripe','paypal','mpesa','airtel','manual','paystack']));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider = ANY (ARRAY['stripe','paypal','mpesa','airtel','manual','paystack']));

ALTER TABLE public.payment_provider_settings DROP CONSTRAINT IF EXISTS payment_provider_settings_provider_check;
ALTER TABLE public.payment_provider_settings ADD CONSTRAINT payment_provider_settings_provider_check
  CHECK (provider = ANY (ARRAY['stripe','paypal','mpesa','airtel','paystack']));

-- 2. Payments: Paystack-specific tracking columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference
  ON public.payments(reference) WHERE reference IS NOT NULL;

-- 3. Subscriptions: store payment method & metadata
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Seed / enable the Paystack provider
INSERT INTO public.payment_provider_settings (provider, display_name, is_enabled, config, sort_order)
VALUES ('paystack', 'Paystack', true,
  '{"currency":"KES","channels":["mobile_money","card","bank","bank_transfer","apple_pay","ussd"]}'::jsonb, 0)
ON CONFLICT (provider) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled,
      display_name = EXCLUDED.display_name,
      config = EXCLUDED.config,
      sort_order = EXCLUDED.sort_order;