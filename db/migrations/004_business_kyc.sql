ALTER TYPE kyc_applicant_type ADD VALUE IF NOT EXISTS 'business';

ALTER TYPE kyc_file_type ADD VALUE IF NOT EXISTS 'rccm';
ALTER TYPE kyc_file_type ADD VALUE IF NOT EXISTS 'legal_rep_id_front';
ALTER TYPE kyc_file_type ADD VALUE IF NOT EXISTS 'legal_rep_id_back';
ALTER TYPE kyc_file_type ADD VALUE IF NOT EXISTS 'legal_rep_selfie_with_id';

ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS rccm_number TEXT,
  ADD COLUMN IF NOT EXISTS niu_number TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_phone TEXT;

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
  type kyc_applicant_type NOT NULL,
  business_name TEXT,
  rccm_number TEXT,
  niu_number TEXT,
  legal_representative_name TEXT,
  legal_representative_phone TEXT,
  kyc_submission_id UUID REFERENCES public.kyc_submissions(id),
  verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_kyc_submission_id ON public.businesses(kyc_submission_id);

CREATE TRIGGER set_updated_at_businesses
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
