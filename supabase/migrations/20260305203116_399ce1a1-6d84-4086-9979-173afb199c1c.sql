
CREATE TABLE public.renewal_button_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  button_text text NOT NULL DEFAULT 'Renovar',
  action_type text NOT NULL DEFAULT 'dialog' CHECK (action_type IN ('dialog', 'link', 'whatsapp')),
  custom_link text,
  whatsapp_message text DEFAULT 'Olá {nome}, seu plano {plano} vence em {vencimento}. Renove agora!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.renewal_button_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own renewal settings"
  ON public.renewal_button_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_renewal_button_settings_updated_at
  BEFORE UPDATE ON public.renewal_button_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
