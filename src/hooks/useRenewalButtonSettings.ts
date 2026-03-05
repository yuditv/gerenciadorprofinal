import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface RenewalButtonSettings {
  id?: string;
  buttonText: string;
  actionType: 'dialog' | 'link' | 'whatsapp';
  customLink: string;
  whatsappMessage: string;
}

const DEFAULT_SETTINGS: RenewalButtonSettings = {
  buttonText: 'Renovar',
  actionType: 'dialog',
  customLink: '',
  whatsappMessage: 'Olá {nome}, seu plano {plano} vence em {vencimento}. Renove agora!',
};

export function useRenewalButtonSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RenewalButtonSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('renewal_button_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        setSettings({
          id: (data as any).id,
          buttonText: (data as any).button_text || DEFAULT_SETTINGS.buttonText,
          actionType: (data as any).action_type || DEFAULT_SETTINGS.actionType,
          customLink: (data as any).custom_link || '',
          whatsappMessage: (data as any).whatsapp_message || DEFAULT_SETTINGS.whatsappMessage,
        });
      }
    } catch (err) {
      console.error('Error loading renewal button settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: RenewalButtonSettings) => {
    if (!user) return;
    try {
      const payload = {
        user_id: user.id,
        button_text: newSettings.buttonText,
        action_type: newSettings.actionType,
        custom_link: newSettings.customLink || null,
        whatsapp_message: newSettings.whatsappMessage,
      };

      const { error } = await supabase
        .from('renewal_button_settings' as any)
        .upsert(payload as any, { onConflict: 'user_id' });

      if (error) throw error;
      setSettings(newSettings);
      toast.success('Configurações do botão renovar salvas!');
    } catch (err) {
      console.error('Error saving renewal button settings:', err);
      toast.error('Erro ao salvar configurações');
    }
  };

  return { settings, isLoading, saveSettings };
}
