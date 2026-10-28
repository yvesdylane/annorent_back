DO $$ BEGIN
  CREATE TYPE kyc_applicant_type AS ENUM ('individual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_document_type AS ENUM ('cni','passport');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status_enum AS ENUM ('pending','under_review','verified','rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_file_type AS ENUM ('id_front','id_back','selfie_with_id','taxpayer_id_proof','other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  applicant_type kyc_applicant_type NOT NULL DEFAULT 'individual',
  status kyc_status_enum NOT NULL DEFAULT 'pending',
  document_type kyc_document_type NOT NULL,
  document_number TEXT NOT NULL,
  full_legal_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  phone_number TEXT,
  taxpayer_id_number TEXT NOT NULL,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.users(user_id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.kyc_submissions(id) ON DELETE CASCADE,
  type kyc_file_type NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON public.kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_submission_id ON public.kyc_documents(submission_id);

CREATE TRIGGER set_updated_at_kyc_submissions
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
