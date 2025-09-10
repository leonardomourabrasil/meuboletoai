-- Backfill paid_at for existing paid bills missing a timestamp
BEGIN;

-- Set paid_at using updated_at (preferred), then due_date, else now()
UPDATE bills
SET paid_at = COALESCE(updated_at, due_date, NOW())
WHERE paid = TRUE
  AND paid_at IS NULL;

COMMIT;