-- Function to create/update business_accounts when owner is verified
CREATE OR REPLACE FUNCTION public.ensure_business_account_on_owner_verified()
RETURNS TRIGGER AS $$
DECLARE
  v_sub_id UUID;
  v_applicant_type kyc_applicant_type;
  v_business_name TEXT;
  v_rccm_number TEXT;
  v_niu_number TEXT;
  v_legal_rep_name TEXT;
  v_legal_rep_phone TEXT;
BEGIN
  -- If user becomes owner and verified
  IF NEW.role = 'owner' AND NEW.kyc_status = 'verified' AND (OLD.role IS DISTINCT FROM 'owner' OR OLD.kyc_status IS DISTINCT FROM 'verified') THEN
    -- Get latest approved submission
    SELECT id, applicant_type, business_name, full_legal_name, rccm_number, niu_number, legal_representative_name, legal_representative_phone
    INTO v_sub_id, v_applicant_type, v_business_name, v_legal_rep_name, v_rccm_number, v_niu_number, v_legal_rep_name, v_legal_rep_phone
    FROM public.kyc_submissions
    WHERE user_id = NEW.user_id AND status = 'verified'
    ORDER BY reviewed_at DESC NULLS LAST
    LIMIT 1;
    
    INSERT INTO public.business_accounts (user_id, business_name, tax_info, verification_status, applicant_type, type, rccm_number, niu_number, legal_representative_name, legal_representative_phone, kyc_submission_id, verified_at)
    VALUES (
      NEW.user_id,
      COALESCE(v_business_name, v_legal_rep_name, NEW.name, 'Business'),
      COALESCE(v_niu_number, v_rccm_number),
      'verified',
      COALESCE(v_applicant_type, 'individual'),
      COALESCE(v_applicant_type, 'individual'),
      v_rccm_number,
      v_niu_number,
      v_legal_rep_name,
      v_legal_rep_phone,
      v_sub_id,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      business_name = COALESCE(EXCLUDED.business_name, business_accounts.business_name),
      verification_status = 'verified',
      applicant_type = COALESCE(EXCLUDED.applicant_type, business_accounts.applicant_type),
      type = COALESCE(EXCLUDED.type, business_accounts.type),
      rccm_number = COALESCE(EXCLUDED.rccm_number, business_accounts.rccm_number),
      niu_number = COALESCE(EXCLUDED.niu_number, business_accounts.niu_number),
      legal_representative_name = COALESCE(EXCLUDED.legal_representative_name, business_accounts.legal_representative_name),
      legal_representative_phone = COALESCE(EXCLUDED.legal_representative_phone, business_accounts.legal_representative_phone),
      kyc_submission_id = COALESCE(EXCLUDED.kyc_submission_id, business_accounts.kyc_submission_id),
      verified_at = COALESCE(business_accounts.verified_at, now()),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_business_account_on_owner_verified ON public.users;
CREATE TRIGGER trg_ensure_business_account_on_owner_verified
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_business_account_on_owner_verified();

-- Also backfill for any existing verified owners
INSERT INTO public.business_accounts (user_id, business_name, tax_info, verification_status, applicant_type, type, rccm_number, niu_number, legal_representative_name, legal_representative_phone, kyc_submission_id, verified_at)
SELECT 
  u.user_id,
  COALESCE(s.business_name, s.full_legal_name, u.name, 'Business'),
  COALESCE(s.niu_number, s.rccm_number),
  'verified',
  COALESCE(s.applicant_type, 'individual'),
  COALESCE(s.applicant_type, 'individual'),
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
ON CONFLICT (user_id) DO UPDATE SET
  verification_status = 'verified',
  verified_at = COALESCE(business_accounts.verified_at, now());
