ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'local';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS provider_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_provider_id_unique
  ON public.users(provider, provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users(provider);
