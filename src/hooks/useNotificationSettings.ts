import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReminderMessages {
  before: string;
  today: string;
  after: string;
}

export interface NotificationSettings {
  email_reminders_enabled: boolean;
  whatsapp_reminders_enabled: boolean;
  auto_send_enabled: boolean;
  reminder_days: number[];
  reminder_messages: ReminderMessages;
}

const defaultReminderMessages: ReminderMessages = {
  before: 'Olá {nome}! Seu plano {plano} vence AMANHÃ ({vencimento}). Renove agora para não perder o acesso!',
  today: 'Olá {nome}! Seu plano {plano} vence HOJE ({vencimento}). Renove agora para continuar com acesso!',
  after: 'Olá {nome}! Seu plano {plano} venceu ontem ({vencimento}). Renove para reativar seu acesso!',
};

const defaultSettings: NotificationSettings = {
  email_reminders_enabled: true,
  whatsapp_reminders_enabled: false,
  auto_send_enabled: false,
  reminder_days: [1, 0, -1], // 1 day before, today, 1 day after
  reminder_messages: defaultReminderMessages,
};

export function useNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading notification settings:', error);
        setSettings(defaultSettings);
      } else if (data) {
        // Parse reminder_messages from JSONB
        let reminderMessages = defaultReminderMessages;
        if (data.reminder_messages) {
          const parsed = typeof data.reminder_messages === 'string' 
            ? JSON.parse(data.reminder_messages) 
            : data.reminder_messages;
          reminderMessages = {
            before: parsed.before || defaultReminderMessages.before,
            today: parsed.today || defaultReminderMessages.today,
            after: parsed.after || defaultReminderMessages.after,
          };
        }

        setSettings({
          email_reminders_enabled: data.email_reminders_enabled ?? defaultSettings.email_reminders_enabled,
          whatsapp_reminders_enabled: data.whatsapp_reminders_enabled ?? defaultSettings.whatsapp_reminders_enabled,
          auto_send_enabled: data.auto_send_enabled ?? defaultSettings.auto_send_enabled,
          reminder_days: data.reminder_days ?? defaultSettings.reminder_days,
          reminder_messages: reminderMessages,
        });
      } else {
        // No settings exist yet - auto-create with WhatsApp reminders enabled by default
        const defaultWithWhatsApp = {
          ...defaultSettings,
          whatsapp_reminders_enabled: true,
        };
        
        // Create record in database
        const { error: insertError } = await supabase
          .from('notification_settings')
          .insert([{
            user_id: user.id,
            email_reminders_enabled: defaultWithWhatsApp.email_reminders_enabled,
            whatsapp_reminders_enabled: defaultWithWhatsApp.whatsapp_reminders_enabled,
            auto_send_enabled: defaultWithWhatsApp.auto_send_enabled,
            reminder_days: defaultWithWhatsApp.reminder_days,
            reminder_messages: defaultWithWhatsApp.reminder_messages as unknown as Record<string, string>,
          }]);
        
        if (insertError) {
          console.error('Error auto-creating notification settings:', insertError);
        }
        
        setSettings(defaultWithWhatsApp);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return false;
    }

    setIsSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };

      // Check if record exists
      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Cast reminder_messages to Json type for Supabase
      const reminderMessagesJson = updatedSettings.reminder_messages as unknown as Record<string, string>;

      let error;
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('notification_settings')
          .update({
            email_reminders_enabled: updatedSettings.email_reminders_enabled,
            whatsapp_reminders_enabled: updatedSettings.whatsapp_reminders_enabled,
            auto_send_enabled: updatedSettings.auto_send_enabled,
            reminder_days: updatedSettings.reminder_days,
            reminder_messages: reminderMessagesJson,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        error = updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('notification_settings')
          .insert([{
            user_id: user.id,
            email_reminders_enabled: updatedSettings.email_reminders_enabled,
            whatsapp_reminders_enabled: updatedSettings.whatsapp_reminders_enabled,
            auto_send_enabled: updatedSettings.auto_send_enabled,
            reminder_days: updatedSettings.reminder_days,
            reminder_messages: reminderMessagesJson,
          }]);
        error = insertError;
      }

      if (error) {
        console.error('Error saving notification settings:', error);
        toast.error('Erro ao salvar configurações.');
        return false;
      }

      setSettings(updatedSettings);
      toast.success('Configurações salvas com sucesso!');
      return true;
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Erro ao salvar configurações.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = async <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    return saveSettings({ [key]: value });
  };

  // Trigger the renewal reminder scheduler
  const triggerReminderCheck = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('renewal-reminder-scheduler');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error triggering reminder check:', error);
      return null;
    }
  };

  // Trigger the scheduled dispatcher
  const triggerDispatcher = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-dispatcher');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error triggering dispatcher:', error);
      return null;
    }
  };

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    updateSetting,
    refetch: fetchSettings,
    triggerReminderCheck,
    triggerDispatcher,
    defaultReminderMessages,
  };
}
