-- Adiciona coluna upcoming_window_days em user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS upcoming_window_days integer NOT NULL DEFAULT 7;

-- Garantir que updated_at seja atualizado
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER set_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION update_user_settings_updated_at();