import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubscriptionReminderMessages {
  threeDays: string;
  oneDay: string;
  today: string;
}

export interface SubscriptionNotificationSettings {
  whatsapp_enabled: boolean;
  reminder_messages: SubscriptionReminderMessages;
}

const defaultReminderMessages: SubscriptionReminderMessages = {
  threeDays: 'Olá! Sua assinatura expira em 3 dias. Renove agora para continuar aproveitando todos os recursos!',
  oneDay: 'Atenção! Sua assinatura expira amanhã. Não perca acesso às funcionalidades, renove já!',
  today: 'Sua assinatura expira HOJE! Renove agora para não perder o acesso ao sistema.',
};

const defaultSettings: SubscriptionNotificationSettings = {
  whatsapp_enabled: true,
  reminder_messages: defaultReminderMessages,
};

export function useSubscriptionNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SubscriptionNotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Use rpc or direct query with type assertion since table is new
      const { data, error } = await supabase
        .from('subscription_notification_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading subscription notification settings:', error);
        setSettings(defaultSettings);
      } else if (data) {
        const record = data as any;
        let reminderMessages = defaultReminderMessages;
        if (record.reminder_messages) {
          const parsed = typeof record.reminder_messages === 'string' 
            ? JSON.parse(record.reminder_messages) 
            : record.reminder_messages;
          reminderMessages = {
            threeDays: parsed.threeDays || defaultReminderMessages.threeDays,
            oneDay: parsed.oneDay || defaultReminderMessages.oneDay,
            today: parsed.today || defaultReminderMessages.today,
          };
        }

        setSettings({
          whatsapp_enabled: record.whatsapp_enabled ?? defaultSettings.whatsapp_enabled,
          reminder_messages: reminderMessages,
        });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading subscription notification settings:', error);
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newSettings: Partial<SubscriptionNotificationSettings>) => {
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
        .from('subscription_notification_settings' as any)
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const reminderMessagesJson = updatedSettings.reminder_messages as unknown as Record<string, string>;

      let error;
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('subscription_notification_settings' as any)
          .update({
            whatsapp_enabled: updatedSettings.whatsapp_enabled,
            reminder_messages: reminderMessagesJson,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('user_id', user.id);
        error = updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('subscription_notification_settings' as any)
          .insert([{
            user_id: user.id,
            whatsapp_enabled: updatedSettings.whatsapp_enabled,
            reminder_messages: reminderMessagesJson,
          }] as any);
        error = insertError;
      }

      if (error) {
        console.error('Error saving subscription notification settings:', error);
        toast.error('Erro ao salvar configurações.');
        return false;
      }

      setSettings(updatedSettings);
      toast.success('Configurações salvas com sucesso!');
      return true;
    } catch (error) {
      console.error('Error saving subscription notification settings:', error);
      toast.error('Erro ao salvar configurações.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    refetch: fetchSettings,
    defaultReminderMessages,
  };
}
