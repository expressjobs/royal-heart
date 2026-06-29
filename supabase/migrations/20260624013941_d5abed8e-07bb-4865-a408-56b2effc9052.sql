-- Gateway (processor) separate from payment method
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS gateway text;

-- Installment tracking on payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installment_id uuid,
  ADD COLUMN IF NOT EXISTS installment_number integer;

-- Installment plans
CREATE TABLE IF NOT EXISTS public.payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  total_installments integer NOT NULL,
  installments_paid integer NOT NULL DEFAULT 0,
  amount_total_cents bigint NOT NULL,
  amount_paid_cents bigint NOT NULL DEFAULT 0,
  installment_amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  next_due_at timestamptz,
  last_paid_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active','completed','overdue','canceled'])),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_installments TO authenticated;
GRANT ALL ON public.payment_installments TO service_role;

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own installments"
  ON public.payment_installments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_installments_user ON public.payment_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_installments_due
  ON public.payment_installments(next_due_at) WHERE status = 'active';

CREATE TRIGGER update_payment_installments_updated_at
  BEFORE UPDATE ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
