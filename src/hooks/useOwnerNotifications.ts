import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface OwnerNotificationSettings {
  id?: string;
  user_id?: string;
  notify_via_whatsapp: boolean;
  notification_phone: string | null;
  notification_instance_id: string | null;
  notify_on_ai_uncertainty: boolean;
  notify_on_payment_proof: boolean;
  notify_on_new_contact: boolean;
  notify_on_complaint: boolean;
  notify_on_vip_message: boolean;
  notify_on_long_wait: boolean;
  long_wait_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  min_interval_minutes: number;
}

export interface NotificationLog {
  id: string;
  event_type: string;
  contact_phone: string;
  contact_name: string | null;
  summary: string;
  urgency: string;
  sent_at: string;
  created_at: string;
}

const defaultSettings: OwnerNotificationSettings = {
  notify_via_whatsapp: true,
  notification_phone: null,
  notification_instance_id: null,
  notify_on_ai_uncertainty: true,
  notify_on_payment_proof: true,
  notify_on_new_contact: true,
  notify_on_complaint: true,
  notify_on_vip_message: true,
  notify_on_long_wait: false,
  long_wait_minutes: 10,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  min_interval_minutes: 5,
};

export function useOwnerNotifications() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OwnerNotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('owner_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...defaultSettings,
          ...data,
          quiet_hours_start: data.quiet_hours_start || '22:00',
          quiet_hours_end: data.quiet_hours_end || '08:00',
        });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching owner notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<OwnerNotificationSettings>, showToast = false) => {
    if (!user) return;

    try {
      setIsSaving(true);
      
      const dataToSave = {
        user_id: user.id,
        ...settings,
        ...newSettings,
      };

      // Remove id if present (upsert will handle it)
      delete dataToSave.id;

      const { error } = await supabase
        .from('owner_notification_settings')
        .upsert(dataToSave, { 
          onConflict: 'user_id',
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...newSettings }));
      
      if (showToast) {
        toast.success('Configurações salvas com sucesso!');
      }
    } catch (error) {
      console.error('Error saving owner notification settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchLogs = async (limit = 50) => {
    if (!user) return;

    try {
      setIsLoadingLogs(true);
      const { data, error } = await supabase
        .from('owner_notification_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching notification logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    refetch: fetchSettings,
    logs,
    isLoadingLogs,
    fetchLogs,
  };
}
