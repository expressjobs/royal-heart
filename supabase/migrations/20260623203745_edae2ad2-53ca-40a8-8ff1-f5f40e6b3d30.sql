ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS id_photo_path text,
  ADD COLUMN IF NOT EXISTS selfie_hash text,
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fraud_score integer NOT NULL DEFAULT 0;

ALTER TABLE public.verification_requests
  DROP CONSTRAINT IF EXISTS verification_document_type_check;
ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_document_type_check
  CHECK (document_type IS NULL OR document_type IN ('passport','national_id','drivers_license'));

CREATE INDEX IF NOT EXISTS idx_verification_selfie_hash
  ON public.verification_requests(selfie_hash);