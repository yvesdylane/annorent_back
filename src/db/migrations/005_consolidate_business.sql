-- Add KYC fields to business_accounts
ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS applicant_type kyc_applicant_type,
  ADD COLUMN IF NOT EXISTS type kyc_applicant_type,
  ADD COLUMN IF NOT EXISTS rccm_number TEXT,
  ADD COLUMN IF NOT EXISTS niu_number TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_phone TEXT,
  ADD COLUMN IF NOT EXISTS kyc_submission_id UUID REFERENCES public.kyc_submissions(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Make user_id unique (one business account per owner)
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_accounts_user_id_unique ON public.business_accounts(user_id);

-- Migrate data from businesses to business_accounts if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'businesses') THEN
    INSERT INTO public.business_accounts (user_id, business_name, tax_info, verification_status, applicant_type, type, rccm_number, niu_number, legal_representative_name, legal_representative_phone, kyc_submission_id, verified_at)
    SELECT 
      b.user_id,
      COALESCE(b.business_name, u.name, 'Business') as business_name,
      b.niu_number as tax_info,
      'verified' as verification_status,
      b.type as applicant_type,
      b.type,
      b.rccm_number,
      b.niu_number,
      b.legal_representative_name,
      b.legal_representative_phone,
      b.kyc_submission_id,
      b.verified_at
    FROM public.businesses b
    JOIN public.users u ON u.user_id = b.user_id
    ON CONFLICT (user_id) DO UPDATE SET
      applicant_type = EXCLUDED.applicant_type,
      type = EXCLUDED.type,
      rccm_number = EXCLUDED.rccm_number,
      niu_number = EXCLUDED.niu_number,
      legal_representative_name = EXCLUDED.legal_representative_name,
      legal_representative_phone = EXCLUDED.legal_representative_phone,
      kyc_submission_id = EXCLUDED.kyc_submission_id,
      verified_at = COALESCE(EXCLUDED.verified_at, business_accounts.verified_at),
      verification_status = 'verified';
    
    DROP TABLE IF EXISTS public.businesses CASCADE;
  END IF;
END $$;

-- Update verification_status for verified owners
UPDATE public.business_accounts ba
SET verification_status = 'verified', verified_at = COALESCE(ba.verified_at, now())
FROM public.users u
WHERE ba.user_id = u.user_id AND u.role = 'owner' AND u.kyc_status = 'verified';

-- Create business_accounts for verified owners who don't have one
INSERT INTO public.business_accounts (user_id, business_name, tax_info, verification_status, applicant_type, type, rccm_number, niu_number, legal_representative_name, legal_representative_phone, kyc_submission_id, verified_at)
SELECT 
  u.user_id,
  COALESCE(s.business_name, s.full_legal_name, u.name, 'Business'),
  COALESCE(s.niu_number, s.rccm_number),
  'verified',
  s.applicant_type,
  s.applicant_type,
  s.rccm_number,
  s.niu_number,
  s.legal_representative_name,
  s.legal_representative_phone,
  s.id,
  now()
FROM public.users u
LEFT JOIN LATERAL (
  SELECT * FROM public.kyc_submissions 
  WHERE user_id = u.user_id AND status = 'verified' 
  ORDER BY reviewed_at DESC NULLS LAST 
  LIMIT 1
) s ON true
WHERE u.role = 'owner' AND u.kyc_status = 'verified'
  AND NOT EXISTS (SELECT 1 FROM public.business_accounts ba WHERE ba.user_id = u.user_id)
ON CONFLICT (user_id) DO NOTHING;
