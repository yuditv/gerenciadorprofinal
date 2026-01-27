import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useContactAvatar() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchAvatar = async (conversationId: string, phone: string): Promise<string | null> => {
    if (!conversationId || !phone) return null;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada');
        return null;
      }

      const response = await supabase.functions.invoke('whatsapp-instances', {
        body: { 
          action: 'fetch-avatar', 
          conversationId,
          phone 
        }
      });
      
      if (response.error) {
        console.error('Error fetching avatar:', response.error);
        toast.error('Erro ao buscar foto de perfil');
        return null;
      }

      if (response.data?.success && response.data?.avatarUrl) {
        toast.success('Foto de perfil atualizada!');
        return response.data.avatarUrl;
      } else {
        toast.info('Foto de perfil não disponível');
        return null;
      }
    } catch (error) {
      console.error('Error fetching avatar:', error);
      toast.error('Erro ao buscar foto de perfil');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchAvatar, isLoading };
}
