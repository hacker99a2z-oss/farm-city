CREATE TABLE public.players (
  telegram_id bigint PRIMARY KEY,
  first_name text,
  username text,
  state jsonb,
  referred_by bigint,
  referral_count int NOT NULL DEFAULT 0,
  referral_bonus int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  amount int NOT NULL,
  method text NOT NULL,
  account text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.withdrawals (telegram_id);