-- Advanced marketer/affiliate program and admin broadcast promotions.
-- Additive/idempotent: preserves existing referrals, commissions, Paystack, and notifications.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'system' AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'system';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'promotion' AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'promotion';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'safety' AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'safety';
  END IF;
END $$;

ALTER TABLE public.marketers
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS profile_photo_path text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_channel text,
  ADD COLUMN IF NOT EXISTS application_reason text,
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_account_name text,
  ADD COLUMN IF NOT EXISTS payout_account_details text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.marketers DROP CONSTRAINT IF EXISTS marketers_status_check;
ALTER TABLE public.marketers
  ADD CONSTRAINT marketers_status_check CHECK (status IN ('pending','active','suspended','inactive'));
ALTER TABLE public.marketers
  ALTER COLUMN commission_rate SET DEFAULT 0.15,
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.marketer_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  source_url text,
  landing_path text,
  visitor_hash text,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS click_id uuid REFERENCES public.marketer_clicks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.marketer_commissions
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_id uuid,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

CREATE TABLE IF NOT EXISTS public.marketer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  payout_method text,
  payout_account_name text,
  payout_account_details text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketer_commissions_payout_id_fkey'
  ) THEN
    ALTER TABLE public.marketer_commissions
      ADD CONSTRAINT marketer_commissions_payout_id_fkey
      FOREIGN KEY (payout_id) REFERENCES public.marketer_payouts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promo_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  image_path text,
  whatsapp_caption text,
  facebook_caption text,
  tiktok_caption text,
  referral_cta text NOT NULL DEFAULT 'Join HeartConnect today',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  cta_label text,
  cta_url text,
  image_url text,
  image_path text,
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  broadcast_type text NOT NULL DEFAULT 'system_announcement'
    CHECK (broadcast_type IN ('in_app_notification','promotional_message','system_announcement','upgrade_offer','safety_notice')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent','failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  audience_size integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','opened','clicked')),
  error text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS marketers_user_idx ON public.marketers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS marketers_user_unique_idx ON public.marketers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketers_status_created_idx ON public.marketers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketer_clicks_marketer_created_idx ON public.marketer_clicks(marketer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketer_clicks_code_created_idx ON public.marketer_clicks(referral_code, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_click_idx ON public.referrals(click_id);
CREATE UNIQUE INDEX IF NOT EXISTS marketer_commissions_payment_unique_idx
  ON public.marketer_commissions(payment_id)
  WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketer_payouts_marketer_created_idx ON public.marketer_payouts(marketer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS promo_materials_active_idx ON public.promo_materials(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS broadcasts_status_created_idx ON public.broadcasts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS broadcast_deliveries_broadcast_idx ON public.broadcast_deliveries(broadcast_id, status);
CREATE INDEX IF NOT EXISTS broadcast_deliveries_user_idx ON public.broadcast_deliveries(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.marketers TO authenticated;
GRANT SELECT ON public.marketer_clicks TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.marketer_commissions TO authenticated;
GRANT SELECT ON public.marketer_payouts TO authenticated;
GRANT SELECT ON public.promo_materials TO authenticated;
GRANT SELECT ON public.broadcasts TO authenticated;
GRANT SELECT ON public.broadcast_deliveries TO authenticated;
GRANT ALL ON public.marketers TO service_role;
GRANT ALL ON public.marketer_clicks TO service_role;
GRANT ALL ON public.referrals TO service_role;
GRANT ALL ON public.marketer_commissions TO service_role;
GRANT ALL ON public.marketer_payouts TO service_role;
GRANT ALL ON public.promo_materials TO service_role;
GRANT ALL ON public.broadcasts TO service_role;
GRANT ALL ON public.broadcast_deliveries TO service_role;

ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketers and admins read marketer profiles" ON public.marketers;
CREATE POLICY "Marketers and admins read marketer profiles"
  ON public.marketers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users apply as marketer" ON public.marketers;
CREATE POLICY "Users apply as marketer"
  ON public.marketers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Marketers edit own pending profile" ON public.marketers;
CREATE POLICY "Marketers edit own pending profile"
  ON public.marketers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Marketers and admins read own clicks" ON public.marketer_clicks;
CREATE POLICY "Marketers and admins read own clicks"
  ON public.marketer_clicks FOR SELECT TO authenticated
  USING (
    private.has_min_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.marketers m WHERE m.id = marketer_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Marketers and admins read own referrals" ON public.referrals;
CREATE POLICY "Marketers and admins read own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (
    private.has_min_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.marketers m WHERE m.id = marketer_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Marketers and admins read own commissions" ON public.marketer_commissions;
CREATE POLICY "Marketers and admins read own commissions"
  ON public.marketer_commissions FOR SELECT TO authenticated
  USING (
    private.has_min_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.marketers m WHERE m.id = marketer_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Marketers and admins read own payouts" ON public.marketer_payouts;
CREATE POLICY "Marketers and admins read own payouts"
  ON public.marketer_payouts FOR SELECT TO authenticated
  USING (
    private.has_min_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.marketers m WHERE m.id = marketer_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Active promo materials visible to marketers" ON public.promo_materials;
CREATE POLICY "Active promo materials visible to marketers"
  ON public.promo_materials FOR SELECT TO authenticated
  USING (
    is_active
    OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.marketers m WHERE m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins read broadcasts" ON public.broadcasts;
CREATE POLICY "Admins read broadcasts"
  ON public.broadcasts FOR SELECT TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read broadcast deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Admins read broadcast deliveries"
  ON public.broadcast_deliveries FOR SELECT TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketer-assets', 'marketer-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Marketer assets are public" ON storage.objects;
CREATE POLICY "Marketer assets are public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'marketer-assets');

DROP POLICY IF EXISTS "Authenticated users upload own marketer assets" ON storage.objects;
CREATE POLICY "Authenticated users upload own marketer assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketer-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users update own marketer assets" ON storage.objects;
CREATE POLICY "Authenticated users update own marketer assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketer-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'marketer-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users delete own marketer assets" ON storage.objects;
CREATE POLICY "Authenticated users delete own marketer assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketer-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
    )
  );
