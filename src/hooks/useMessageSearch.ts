import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/hooks/useInboxMessages';
import { useToast } from '@/hooks/use-toast';

export interface MessageSearchParams {
  conversationId: string;
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
  messageType?: 'all' | 'text' | 'image' | 'video' | 'audio' | 'document';
  limit?: number;
  offset?: number;
}

export interface MessageSearchResult extends ChatMessage {
  highlight?: string;
}

export function useMessageSearch() {
  const { toast } = useToast();
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  const [lastParams, setLastParams] = useState<MessageSearchParams | null>(null);

  const searchMessages = useCallback(async (params: MessageSearchParams) => {
    const { conversationId, searchTerm, dateFrom, dateTo, messageType, limit = 20, offset = 0 } = params;
    
    if (!conversationId) return;
    
    setIsSearching(true);
    setLastParams(params);
    
    try {
      let query = supabase
        .from('chat_inbox_messages')
        .select('*', { count: 'exact' })
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      // Filter by search term
      if (searchTerm && searchTerm.trim()) {
        query = query.ilike('content', `%${searchTerm.trim()}%`);
      }
      
      // Filter by date range
      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }
      
      // Filter by message type
      if (messageType && messageType !== 'all') {
        if (messageType === 'text') {
          query = query.is('media_type', null);
        } else {
          query = query.ilike('media_type', `${messageType}/%`);
        }
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      const searchResults: MessageSearchResult[] = (data || []).map(msg => ({
        ...msg as ChatMessage,
        highlight: searchTerm ? highlightText(msg.content || '', searchTerm) : undefined
      }));
      
      if (offset === 0) {
        setResults(searchResults);
      } else {
        setResults(prev => [...prev, ...searchResults]);
      }
      
      setTotalFound(count || 0);
      setHasMore((count || 0) > offset + limit);
      
    } catch (error) {
      console.error('Error searching messages:', error);
      toast({
        title: 'Erro na busca',
        description: 'Não foi possível buscar as mensagens',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const loadMore = useCallback(async () => {
    if (!lastParams || isSearching || !hasMore) return;
    
    const newParams = {
      ...lastParams,
      offset: (lastParams.offset || 0) + (lastParams.limit || 20)
    };
    
    await searchMessages(newParams);
  }, [lastParams, isSearching, hasMore, searchMessages]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setTotalFound(0);
    setHasMore(false);
    setLastParams(null);
  }, []);

  return {
    results,
    isSearching,
    hasMore,
    totalFound,
    searchMessages,
    loadMore,
    clearSearch
  };
}

// Helper to highlight search term in text
function highlightText(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text;
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  return text.replace(regex, '**$1**');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
