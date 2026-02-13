import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WhatsAppInstance {
  id: string;
  instance_name: string;
  name: string; // Alias for backwards compatibility
  status: string;
  daily_limit: number;
  instance_key: string | null;
  qr_code: string | null;
  phone_connected: string | null;
  presence_status: 'available' | 'unavailable';
  profile_picture_url: string | null;
  profile_name: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export type WhatsAppInstanceStatusDetails = {
  qrCode?: string | null;
  paircode?: string | null;
  owner?: string | null;
  platform?: string | null;
  lastDisconnect?: string | null;
  lastDisconnectReason?: string | null;
  connected?: boolean | null;
  loggedIn?: boolean | null;
};

export type WhatsAppPrivacySettings = {
  groupadd?: string;
  last?: string;
  status?: string;
  profile?: string;
  readreceipts?: string;
  online?: string;
  calladd?: string;
};

export function useWhatsAppInstances() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInstances = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching instances:', error);
        setInstances([]);
        return;
      }
      
      // Map data to include backwards-compatible properties
      const mappedData: WhatsAppInstance[] = (data || []).map((item: any) => ({
        id: item.id,
        instance_name: item.instance_name,
        name: item.instance_name, // Alias
        status: item.status,
        daily_limit: item.daily_limit ?? 200,
        instance_key: item.instance_key || null,
        qr_code: item.qr_code || null,
        phone_connected: item.phone_connected || null,
        profile_picture_url: item.profile_picture_url || null,
        profile_name: item.profile_name || null,
        presence_status: item.presence_status || 'available',
        business_hours_start: item.business_hours_start || "08:00:00",
        business_hours_end: item.business_hours_end || "18:00:00",
        last_connected_at: item.last_connected_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        user_id: item.user_id,
      }));
      
      setInstances(mappedData);
    } catch (error: any) {
      console.error('Error fetching instances:', error);
      setInstances([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const createInstance = async (name: string, dailyLimit?: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'create', name, daily_limit: dailyLimit },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Instância criada!');
      await fetchInstances();
      return data.instance;
    } catch (error: any) {
      console.error('Create instance error:', error);
      toast.error(error.message || 'Erro ao criar instância');
      return null;
    }
  };

  const getQRCode = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'qrcode', instanceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await fetchInstances();
      return data.qrcode;
    } catch (error: any) {
      console.error('QR code error:', error);
      toast.error(error.message || 'Erro ao obter QR Code');
      return null;
    }
  };

  const checkStatus = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'status', instanceId },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Falha ao buscar status');
      await fetchInstances();
      return data;
    } catch (error: any) {
      console.error('Status check error:', error);
      return null;
    }
  };

  const updateInstanceName = async (instanceId: string, name: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'update_instance_name', instanceId, name },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao atualizar nome');
      toast.success('Nome da instância atualizado!');
      await fetchInstances();
      return true;
    } catch (error: any) {
      console.error('Update instance name error:', error);
      toast.error(error.message || 'Erro ao atualizar nome');
      return false;
    }
  };

  const getInstancePrivacy = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'get_privacy', instanceId },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao buscar privacidade');
      return (data?.privacy ?? null) as WhatsAppPrivacySettings | null;
    } catch (error: any) {
      console.error('Get privacy error:', error);
      toast.error(error.message || 'Erro ao buscar privacidade');
      return null;
    }
  };

  const setInstancePrivacy = async (instanceId: string, privacy: WhatsAppPrivacySettings) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'set_privacy', instanceId, privacy },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao salvar privacidade');
      toast.success('Privacidade atualizada!');
      return (data?.privacy ?? null) as WhatsAppPrivacySettings | null;
    } catch (error: any) {
      console.error('Set privacy error:', error);
      toast.error(error.message || 'Erro ao salvar privacidade');
      return null;
    }
  };

  const setInstancePresence = async (instanceId: string, presence: 'available' | 'unavailable') => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'set_presence', instanceId, presence },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao atualizar presença');
      toast.success(presence === 'available' ? 'Status alterado para Online' : 'Status alterado para Offline');
      await fetchInstances();
      return true;
    } catch (error: any) {
      console.error('Set presence error:', error);
      toast.error(error.message || 'Erro ao atualizar presença');
      return false;
    }
  };

  const updateProfileName = async (instanceId: string, profileName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'update_profile_name', instanceId, profileName },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao atualizar nome do perfil');
      toast.success('Nome do perfil atualizado!');
      await fetchInstances();
      return true;
    } catch (error: any) {
      console.error('Update profile name error:', error);
      toast.error(error.message || 'Erro ao atualizar nome do perfil');
      return false;
    }
  };

  const updateProfileImage = async (instanceId: string, image: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'update_profile_image', instanceId, image },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao atualizar foto do perfil');
      toast.success(image === 'remove' || image === 'delete' ? 'Foto do perfil removida!' : 'Foto do perfil atualizada!');
      await fetchInstances();
      return true;
    } catch (error: any) {
      console.error('Update profile image error:', error);
      toast.error(error.message || 'Erro ao atualizar foto do perfil');
      return false;
    }
  };

  const disconnectInstance = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'disconnect', instanceId },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao desconectar');
      toast.success('Instância desconectada.');
      await fetchInstances();
      return true;
    } catch (error: any) {
      console.error('Disconnect instance error:', error);
      toast.error(error.message || 'Erro ao desconectar instância');
      return false;
    }
  };

  const getPairingCode = async (instanceId: string, phoneNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'paircode', instanceId, phoneNumber },
      });
      if (error) throw error;
      // The edge function may return { success:false } with a hint when the API doesn't support paircode.
      if (data?.success === false) {
        throw new Error(data?.error || 'Código de pareamento não disponível');
      }
      if (data?.error) throw new Error(data.error);
      toast.success('Código de pareamento gerado!');
      await fetchInstances();
      return data.paircode;
    } catch (error: any) {
      console.error('Pairing code error:', error);
      toast.error(error.message || 'Erro ao gerar código de pareamento');
      return null;
    }
  };

  const deleteInstance = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'delete', instanceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Instância excluída!');
      await fetchInstances();
      return true;
    } catch (error: any) {
      console.error('Delete instance error:', error);
      toast.error(error.message || 'Erro ao excluir instância');
      return false;
    }
  };

  const checkNumbers = async (instanceId: string, phones: string[], fetchName: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'check-number', instanceId, phones, fetchName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.results as Array<{ phone: string; exists: boolean; whatsappName?: string; error?: string }>;
    } catch (error: any) {
      console.error('Check numbers error:', error);
      toast.error(error.message || 'Erro ao verificar números');
      return null;
    }
  };

  const configureWebhook = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'configure-webhook', instanceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || 'Webhook configurado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Configure webhook error:', error);
      toast.error(error.message || 'Erro ao configurar webhook');
    return null;
    }
  };

  const testWebhook = async (instanceId: string) => {
    try {
      // Find the instance to get its details
      const instance = instances.find(i => i.id === instanceId);
      if (!instance) throw new Error('Instância não encontrada');

      // Create a test message payload simulating UAZAPI format
      const testPayload = {
        event: 'messages.upsert',
        token: instance.instance_key,
        instance: instance.instance_name,
        data: {
          key: {
            remoteJid: `5511${Date.now().toString().slice(-8)}@s.whatsapp.net`,
            fromMe: false,
            id: `test-webhook-${Date.now()}`
          },
          pushName: '🧪 Teste de Webhook',
          message: {
            conversation: `✅ Mensagem de teste enviada às ${new Date().toLocaleTimeString('pt-BR')}. Se você está vendo isso na Central de Atendimento, o webhook está funcionando corretamente!`
          },
          messageTimestamp: Math.floor(Date.now() / 1000)
        }
      };

      // Use supabase.functions.invoke for proper CORS handling
      const { data: result, error } = await supabase.functions.invoke('whatsapp-inbox-webhook', {
        body: testPayload
      });

      if (error) throw error;
      
      if (result?.success) {
        toast.success('Teste enviado! Verifique a Central de Atendimento.');
        return result;
      } else {
        throw new Error(result?.error || 'Falha no teste');
      }
    } catch (error: any) {
      console.error('Test webhook error:', error);
      toast.error(error.message || 'Erro ao testar webhook');
      return null;
    }
  };

  // Refresh all instances status from UAZAPI
  const refreshAllStatus = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // First fetch current instances from DB
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user.id);
      
      if (data && data.length > 0) {
        // Check status for each instance that has an instance_key
        for (const instance of data) {
          if (instance.instance_key) {
            try {
              await supabase.functions.invoke('whatsapp-instances', {
                body: { action: 'status', instanceId: instance.id },
              });
            } catch (e) {
              console.error('Error checking status for instance:', instance.id, e);
            }
          }
        }
      }
      
      // Reload instances with updated status
      await fetchInstances();
    } catch (error) {
      console.error('Error refreshing all status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchInstances]);

  const syncFromUazapi = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'sync' },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erro ao sincronizar');
      toast.success(data?.message || 'Sincronização concluída!');
      await fetchInstances();
      return data;
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Erro ao sincronizar instâncias');
      return null;
    }
  };

  return {
    instances,
    isLoading,
    createInstance,
    getQRCode,
    checkStatus,
    updateInstanceName,
    getInstancePrivacy,
    setInstancePrivacy,
    disconnectInstance,
    deleteInstance,
    getPairingCode,
    checkNumbers,
    configureWebhook,
    testWebhook,
    setInstancePresence,
    updateProfileName,
    updateProfileImage,
    refetch: fetchInstances,
    refreshAllStatus,
    syncFromUazapi,
  };
}
