CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('tenant', 'owner', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_type') THEN
    CREATE TYPE property_type AS ENUM ('building', 'hotel');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_type') THEN
    CREATE TYPE unit_type AS ENUM ('guest_house', 'cowork_space', 'event_hall', 'room', 'apartment', 'studio', 'hotel_room');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_model') THEN
    CREATE TYPE pricing_model AS ENUM ('hourly', 'half_day', 'daily', 'nightly', 'monthly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_status') THEN
    CREATE TYPE unit_status AS ENUM ('available', 'maintenance');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE media_type AS ENUM ('photo', 'video', 'tour_3d');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_status') THEN
    CREATE TYPE media_status AS ENUM ('uploading', 'processing', 'ready', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type') THEN
    CREATE TYPE booking_type AS ENUM ('reservation', 'rental_booking');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('pending', 'active', 'cancelled', 'completed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'paid_offline', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('mobile_money', 'bank_transfer', 'card');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'successful', 'failed', 'refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_status') THEN
    CREATE TYPE visit_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
    CREATE TYPE plan_type AS ENUM ('monthly', 'yearly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_interval') THEN
    CREATE TYPE billing_interval AS ENUM ('daily', 'monthly', 'yearly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agreement_status') THEN
    CREATE TYPE agreement_status AS ENUM ('proposed', 'active', 'ended', 'cancelled');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email citext UNIQUE NOT NULL,
  phone_number text UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  kyc_status verification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.business_accounts (
  account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  business_name text NOT NULL,
  tax_info text,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_accounts_user_id ON public.business_accounts(user_id);
DROP TRIGGER IF EXISTS trg_business_accounts_updated_at ON public.business_accounts;
CREATE TRIGGER trg_business_accounts_updated_at BEFORE UPDATE ON public.business_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.properties (
  property_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.business_accounts(account_id) ON DELETE RESTRICT,
  property_type property_type NOT NULL,
  name text NOT NULL,
  description text,
  country text NOT NULL DEFAULT 'CM',
  city text NOT NULL,
  town text NOT NULL,
  area text NOT NULL,
  street text,
  gps geometry(Point,4326),
  ownership_verified boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_properties_account_id ON public.properties(account_id);
CREATE INDEX IF NOT EXISTS idx_properties_gps ON public.properties USING GIST (gps);
DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rentable_units (
  unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(property_id) ON DELETE RESTRICT,
  name text NOT NULL,
  unit_type unit_type NOT NULL,
  pricing_model pricing_model NOT NULL,
  price_amount numeric(14,2) NOT NULL CHECK (price_amount >= 0),
  capacity smallint NOT NULL CHECK (capacity > 0),
  bedrooms smallint CHECK (bedrooms >= 0),
  bathrooms smallint CHECK (bathrooms >= 0),
  area_sqm numeric(10,2) CHECK (area_sqm > 0),
  status unit_status NOT NULL DEFAULT 'available',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rentable_units_property_id ON public.rentable_units(property_id);
DROP TRIGGER IF EXISTS trg_rentable_units_updated_at ON public.rentable_units;
CREATE TRIGGER trg_rentable_units_updated_at BEFORE UPDATE ON public.rentable_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.rentable_units ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.media (
  media_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(property_id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES public.rentable_units(unit_id) ON DELETE RESTRICT,
  type media_type NOT NULL,
  storage_key text NOT NULL,
  status media_status NOT NULL DEFAULT 'uploading',
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_exactly_one_parent CHECK (num_nonnulls(property_id, unit_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_media_property_id ON public.media(property_id);
CREATE INDEX IF NOT EXISTS idx_media_unit_id ON public.media(unit_id);
DROP TRIGGER IF EXISTS trg_media_updated_at ON public.media;
CREATE TRIGGER trg_media_updated_at BEFORE UPDATE ON public.media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bookings (
  booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.rentable_units(unit_id) ON DELETE RESTRICT,
  booking_type booking_type NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_range_check CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_unit_id ON public.bookings(unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_expires_at ON public.bookings(expires_at);
DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agreements (
  agreement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.rentable_units(unit_id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  booking_id uuid UNIQUE REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
  agreed_amount numeric(14,2) NOT NULL CHECK (agreed_amount >= 0),
  billing_interval billing_interval,
  start_date date NOT NULL,
  end_date date,
  status agreement_status NOT NULL DEFAULT 'proposed',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreements_dates_check CHECK (end_date IS NULL OR end_date > start_date)
);
CREATE INDEX IF NOT EXISTS idx_agreements_unit_id ON public.agreements(unit_id);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_id ON public.agreements(tenant_id);
DROP TRIGGER IF EXISTS trg_agreements_updated_at ON public.agreements;
CREATE TRIGGER trg_agreements_updated_at BEFORE UPDATE ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.business_accounts(account_id) ON DELETE RESTRICT,
  plan_type plan_type NOT NULL,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  renewed_from uuid REFERENCES public.subscription_plans(subscription_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_dates_check CHECK (end_date > start_date)
);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_account_id ON public.subscription_plans(account_id);
DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.invoices (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE REFERENCES public.bookings(booking_id) ON DELETE RESTRICT,
  subscription_id uuid UNIQUE REFERENCES public.subscription_plans(subscription_id) ON DELETE RESTRICT,
  agreement_id uuid REFERENCES public.agreements(agreement_id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  status invoice_status NOT NULL DEFAULT 'pending',
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_exactly_one_parent CHECK (num_nonnulls(booking_id, subscription_id, agreement_id) = 1),
  CONSTRAINT invoices_period_both_or_none CHECK ((period_start IS NULL) = (period_end IS NULL)),
  CONSTRAINT invoices_period_check CHECK (period_start IS NULL OR period_end > period_start)
);
CREATE INDEX IF NOT EXISTS idx_invoices_agreement_id ON public.invoices(agreement_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_agreement_period_unique ON public.invoices(agreement_id, period_start) WHERE agreement_id IS NOT NULL AND period_start IS NOT NULL;
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(invoice_id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  platform_commission numeric(14,2) NOT NULL CHECK (platform_commission >= 0),
  owner_payout numeric(14,2) NOT NULL CHECK (owner_payout >= 0),
  payment_method payment_method NOT NULL,
  provider_reference text UNIQUE NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  refund_amount numeric(14,2) CHECK (refund_amount IS NULL OR (refund_amount >= 0 AND refund_amount <= amount)),
  refunded_at timestamptz,
  refund_reason text,
  paid_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_split_check CHECK (amount = platform_commission + owner_payout),
  CONSTRAINT payments_refund_fields_consistent CHECK ((refund_amount IS NULL) = (refunded_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_invoice_successful_unique ON public.payments(invoice_id) WHERE status = 'successful';
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid UNIQUE NOT NULL REFERENCES public.payments(payment_id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(invoice_id) ON DELETE RESTRICT,
  transaction_details jsonb NOT NULL,
  signature_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice_id ON public.payment_receipts(invoice_id);
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.property_visits (
  visit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES public.properties(property_id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES public.rentable_units(unit_id) ON DELETE RESTRICT,
  scheduled_time timestamptz NOT NULL,
  status visit_status NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_visits_user_id ON public.property_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_property_id ON public.property_visits(property_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_unit_id ON public.property_visits(unit_id);
DROP TRIGGER IF EXISTS trg_property_visits_updated_at ON public.property_visits;
CREATE TRIGGER trg_property_visits_updated_at BEFORE UPDATE ON public.property_visits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.property_visits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  receiver_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(property_id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
  content text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_different_users CHECK (sender_id <> receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
DROP TRIGGER IF EXISTS trg_messages_updated_at ON public.messages;
CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  token_hash text UNIQUE NOT NULL,
  family_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON public.refresh_tokens(family_id);
DROP TRIGGER IF EXISTS trg_refresh_tokens_updated_at ON public.refresh_tokens;
CREATE TRIGGER trg_refresh_tokens_updated_at BEFORE UPDATE ON public.refresh_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING GIST (
        unit_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status IN ('pending', 'active'));
  END IF;
END$$;
