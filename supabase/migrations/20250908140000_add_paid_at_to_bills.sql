-- Add paid_at column and triggers to maintain the real payment timestamp
BEGIN;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_paid_at_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting an already paid bill, stamp paid_at if missing
  IF TG_OP = 'INSERT' THEN
    IF NEW.paid IS TRUE AND NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- For updates, only react when the 'paid' flag changes
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.paid IS DISTINCT FROM OLD.paid) THEN
      IF NEW.paid IS TRUE THEN
        -- Transition from not paid -> paid: set the real payment timestamp (if not provided)
        IF NEW.paid_at IS NULL THEN
          NEW.paid_at := now();
        END IF;
      ELSE
        -- Transition from paid -> not paid: clear payment timestamp
        NEW.paid_at := NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bills_set_paid_at_on_change'
  ) THEN
    CREATE TRIGGER bills_set_paid_at_on_change
      BEFORE INSERT OR UPDATE ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.set_paid_at_on_status_change();
  END IF;
END $$;

-- Helpful index for queries filtering by payment month
CREATE INDEX IF NOT EXISTS idx_bills_paid_at ON public.bills (paid_at);

COMMIT;