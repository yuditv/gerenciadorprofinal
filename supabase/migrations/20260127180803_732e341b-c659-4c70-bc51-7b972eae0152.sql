-- Tighten service-role RLS policies (avoid USING/WITH CHECK true)

DO $$
BEGIN
  -- ai_message_buffer
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_message_buffer' AND policyname='Service role can manage all buffers') THEN
    EXECUTE 'DROP POLICY "Service role can manage all buffers" ON public.ai_message_buffer';
  END IF;
  EXECUTE 'CREATE POLICY "Service role can manage all buffers" ON public.ai_message_buffer FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

  -- bot_proxy_sessions
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bot_proxy_sessions' AND policyname='Service role can manage all bot proxy sessions') THEN
    EXECUTE 'DROP POLICY "Service role can manage all bot proxy sessions" ON public.bot_proxy_sessions';
  END IF;
  EXECUTE 'CREATE POLICY "Service role can manage all bot proxy sessions" ON public.bot_proxy_sessions FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

  -- owner_notification_log
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='owner_notification_log' AND policyname='Service role can manage all notification logs') THEN
    EXECUTE 'DROP POLICY "Service role can manage all notification logs" ON public.owner_notification_log';
  END IF;
  EXECUTE 'CREATE POLICY "Service role can manage all notification logs" ON public.owner_notification_log FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

  -- owner_notification_settings
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='owner_notification_settings' AND policyname='Service role can manage all notification settings') THEN
    EXECUTE 'DROP POLICY "Service role can manage all notification settings" ON public.owner_notification_settings';
  END IF;
  EXECUTE 'CREATE POLICY "Service role can manage all notification settings" ON public.owner_notification_settings FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
END $$;
