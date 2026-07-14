-- MASTERPLAN §8.2: Wochen-Newsletter pro Region, ohne Account, Double-Opt-in.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  bundesland text NOT NULL,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_newsletter_active
  ON newsletter_subscribers (bundesland)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;
