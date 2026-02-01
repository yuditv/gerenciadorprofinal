import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatDetails {
  // Informações básicas
  id?: string;
  wa_fastid?: string;
  wa_chatid?: string;
  owner?: string;
  name?: string;
  phone?: string;
  
  // Dados do WhatsApp
  wa_name?: string;
  wa_contactName?: string;
  wa_archived?: boolean;
  wa_isBlocked?: boolean;
  image?: string;
  imagePreview?: string;
  wa_ephermalExpiration?: number;
  wa_isGroup?: boolean;
  wa_isGroup_admin?: boolean;
  wa_isGroup_announce?: boolean;
  wa_isGroup_community?: boolean;
  wa_isGroup_member?: boolean;
  wa_isPinned?: boolean;
  wa_label?: string[];
  wa_lastMessageTextVote?: string;
  wa_lastMessageType?: string;
  wa_lastMsgTimestamp?: number;
  wa_lastMessageSender?: string;
  wa_muteEndTime?: number;
  wa_unreadCount?: number;
  common_groups?: string;
  
  // Dados de Lead/CRM
  lead_name?: string;
  lead_fullName?: string;
  lead_email?: string;
  lead_personalId?: string;
  lead_status?: string;
  lead_tags?: string[];
  lead_notes?: string;
  lead_isTicketOpen?: boolean;
  lead_assignedAttendant_id?: string;
  lead_kanbanOrder?: number;
  lead_field01?: string;
  lead_field02?: string;
  lead_field03?: string;
  lead_field04?: string;
  lead_field05?: string;
  lead_field06?: string;
  lead_field07?: string;
  lead_field08?: string;
  lead_field09?: string;
  lead_field10?: string;
  lead_field11?: string;
  lead_field12?: string;
  lead_field13?: string;
  lead_field14?: string;
  lead_field15?: string;
  lead_field16?: string;
  lead_field17?: string;
  lead_field18?: string;
  lead_field19?: string;
  lead_field20?: string;
  
  // Chatbot
  chatbot_agentResetMemoryAt?: number;
  chatbot_lastTrigger_id?: string;
  chatbot_lastTriggerAt?: number;
  chatbot_disableUntil?: number;
  chatbot_summary?: string;
}

export function useChatDetails() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ChatDetails | null>(null);

  const fetchChatDetails = useCallback(async (
    instanceId: string,
    phone: string,
    preview: boolean = false
  ): Promise<ChatDetails | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-chat-details', {
        body: { instanceId, phone, preview }
      });

      if (fnError) {
        console.error('Error fetching chat details:', fnError);
        setError(fnError.message || 'Erro ao buscar detalhes do chat');
        return null;
      }

      if (data?.error) {
        setError(data.error);
        return null;
      }

      setDetails(data);
      return data;
    } catch (err) {
      console.error('Exception fetching chat details:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDetails = useCallback(() => {
    setDetails(null);
    setError(null);
  }, []);

  return {
    details,
    isLoading,
    error,
    fetchChatDetails,
    clearDetails
  };
}
