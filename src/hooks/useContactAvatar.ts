import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useContactAvatar() {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetches the contact avatar from UAZAPI using the chat/details endpoint
   * and updates the conversation record with the new avatar URL
   */
  const fetchAvatar = useCallback(async (
    conversationId: string, 
    phone: string,
    instanceId?: string
  ): Promise<string | null> => {
    if (!conversationId || !phone) return null;
    
    setIsLoading(true);
    try {
      let targetInstanceId = instanceId;

      // If no instanceId provided, get it from the conversation
      if (!targetInstanceId) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('instance_id')
          .eq('id', conversationId)
          .single();
        
        targetInstanceId = conversation?.instance_id;
      }

      if (!targetInstanceId) {
        console.error('No instance ID available');
        return null;
      }

      // Call the fetch-chat-details edge function
      const { data, error } = await supabase.functions.invoke('fetch-chat-details', {
        body: { 
          instanceId: targetInstanceId,
          phone,
          preview: true // Use preview size for faster loading
        }
      });
      
      if (error) {
        console.error('Error fetching chat details:', error);
        toast.error('Erro ao buscar foto de perfil');
        return null;
      }

      // Get avatar URL from response (imagePreview for smaller size, or image for full)
      const avatarUrl = data?.imagePreview || data?.image || null;
      const contactName = data?.wa_name || data?.wa_contactName || data?.name || null;

      if (avatarUrl) {
        // Update the conversation with the new avatar URL and name if available
        const updateData: Record<string, string> = { contact_avatar: avatarUrl };
        
        // Also update contact name if we got a better one from WhatsApp
        if (contactName) {
          // Only update name if conversation doesn't have one yet
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('contact_name')
            .eq('id', conversationId)
            .single();
          
          if (!existingConv?.contact_name) {
            updateData.contact_name = contactName;
          }
        }

        await supabase
          .from('conversations')
          .update(updateData)
          .eq('id', conversationId);

        toast.success('Foto de perfil atualizada!');
        return avatarUrl;
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
  }, []);

  /**
   * Fetches avatars for multiple conversations in batch
   */
  const fetchAvatarsBatch = useCallback(async (
    conversations: Array<{ id: string; phone: string; instance_id: string; contact_avatar?: string | null }>
  ): Promise<number> => {
    // Filter conversations without avatar
    const withoutAvatar = conversations.filter(c => !c.contact_avatar);
    
    if (withoutAvatar.length === 0) return 0;

    setIsLoading(true);
    let successCount = 0;

    // Process in parallel with a limit
    const batchSize = 5;
    for (let i = 0; i < withoutAvatar.length; i += batchSize) {
      const batch = withoutAvatar.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (conv) => {
          try {
            const { data, error } = await supabase.functions.invoke('fetch-chat-details', {
              body: { 
                instanceId: conv.instance_id,
                phone: conv.phone,
                preview: true
              }
            });

            if (!error && data) {
              const avatarUrl = data?.imagePreview || data?.image;
              const contactName = data?.wa_name || data?.wa_contactName || data?.name;

              if (avatarUrl) {
                const updateData: Record<string, string> = { contact_avatar: avatarUrl };
                if (contactName) {
                  updateData.contact_name = contactName;
                }

                await supabase
                  .from('conversations')
                  .update(updateData)
                  .eq('id', conv.id);

                successCount++;
              }
            }
          } catch (err) {
            console.error(`Error fetching avatar for ${conv.phone}:`, err);
          }
        })
      );
    }

    setIsLoading(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} foto(s) de perfil atualizada(s)!`);
    }

    return successCount;
  }, []);

  return { 
    fetchAvatar, 
    fetchAvatarsBatch,
    isLoading 
  };
}
