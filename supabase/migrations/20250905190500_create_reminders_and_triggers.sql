-- Reminders table to schedule automatic notifications per bill
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  remind_date DATE NOT NULL,
  send_email BOOLEAN NOT NULL DEFAULT false,
  send_whatsapp BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bill_id, remind_date)
);

-- Enable RLS on reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reminders' AND policyname = 'Users can view their own reminders'
  ) THEN
    CREATE POLICY "Users can view their own reminders"
    ON public.reminders
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reminders' AND policyname = 'Users can update their own reminders'
  ) THEN
    CREATE POLICY "Users can update their own reminders"
    ON public.reminders
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_reminders_updated_at'
  ) THEN
    CREATE TRIGGER update_reminders_updated_at
      BEFORE UPDATE ON public.reminders
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Function to (re)generate reminders when a bill is inserted or due_date is updated
CREATE OR REPLACE FUNCTION public.handle_bills_generate_reminders()
RETURNS TRIGGER AS $$
DECLARE
  s record;
  d integer;
  email_count int := 0;
  whatsapp_count int := 0;
BEGIN
  -- Load user settings; if none or disabled, do nothing
  SELECT notifications_enabled, email_recipients, whatsapp_recipients, reminder_days
    INTO s
  FROM public.user_settings
  WHERE user_id = NEW.user_id;

  IF s IS NULL OR s.notifications_enabled IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF s.email_recipients IS NULL THEN s.email_recipients := ARRAY[]::text[]; END IF;
  IF s.whatsapp_recipients IS NULL THEN s.whatsapp_recipients := ARRAY[]::text[]; END IF;
  email_count := COALESCE(array_length(s.email_recipients, 1), 0);
  whatsapp_count := COALESCE(array_length(s.whatsapp_recipients, 1), 0);

  IF s.reminder_days IS NULL OR array_length(s.reminder_days, 1) IS NULL THEN
    s.reminder_days := ARRAY[1];
  END IF;

  -- If due_date changed, remove future unsent reminders for this bill
  IF TG_OP = 'UPDATE' AND NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    DELETE FROM public.reminders
    WHERE bill_id = NEW.id
      AND sent_at IS NULL
      AND remind_date >= CURRENT_DATE;
  END IF;

  -- Create reminders for configured days before due date
  FOREACH d IN ARRAY s.reminder_days LOOP
    INSERT INTO public.reminders (user_id, bill_id, remind_date, send_email, send_whatsapp)
    VALUES (NEW.user_id, NEW.id, NEW.due_date - d, email_count > 0, whatsapp_count > 0)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel reminders when a bill is marked as paid
CREATE OR REPLACE FUNCTION public.handle_bills_cancel_reminders_on_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paid IS TRUE AND (OLD.paid IS DISTINCT FROM NEW.paid) THEN
    DELETE FROM public.reminders
    WHERE bill_id = NEW.id
      AND sent_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers on bills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bills_after_insert_generate_reminders'
  ) THEN
    CREATE TRIGGER bills_after_insert_generate_reminders
      AFTER INSERT ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_bills_generate_reminders();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bills_after_update_generate_reminders'
  ) THEN
    CREATE TRIGGER bills_after_update_generate_reminders
      AFTER UPDATE OF due_date ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_bills_generate_reminders();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bills_after_update_cancel_reminders_on_paid'
  ) THEN
    CREATE TRIGGER bills_after_update_cancel_reminders_on_paid
      AFTER UPDATE OF paid ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_bills_cancel_reminders_on_paid();
  END IF;
END $$;