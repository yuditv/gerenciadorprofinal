import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CannedResponse {
  id: string;
  user_id: string;
  short_code: string;
  content: string;
  is_global: boolean;
  media_url: string | null;
  media_type: string | null;
  media_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useCannedResponses() {
  const { user } = useAuth();
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResponses = useCallback(async () => {
    if (!user) {
      setResponses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .or(`user_id.eq.${user.id},is_global.eq.true`)
        .order('short_code', { ascending: true });

      if (error) throw error;
      setResponses((data as CannedResponse[]) || []);
    } catch (error) {
      console.error('Error fetching canned responses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const createResponse = async (data: {
    short_code: string;
    content: string;
    is_global?: boolean;
    media_url?: string | null;
    media_type?: string | null;
    media_name?: string | null;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const { data: newResponse, error } = await supabase
      .from('canned_responses')
      .insert({
        user_id: user.id,
        short_code: data.short_code,
        content: data.content,
        is_global: data.is_global || false,
        media_url: data.media_url || null,
        media_type: data.media_type || null,
        media_name: data.media_name || null,
      })
      .select()
      .single();

    if (error) throw error;
    
    setResponses(prev => [...prev, newResponse as CannedResponse].sort((a, b) => 
      a.short_code.localeCompare(b.short_code)
    ));
    
    return newResponse;
  };

  const updateResponse = async (id: string, data: {
    short_code?: string;
    content?: string;
    is_global?: boolean;
    media_url?: string | null;
    media_type?: string | null;
    media_name?: string | null;
  }) => {
    const { data: updated, error } = await supabase
      .from('canned_responses')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    setResponses(prev => prev.map(r => r.id === id ? updated as CannedResponse : r));
    return updated;
  };

  const deleteResponse = async (id: string) => {
    const { error } = await supabase
      .from('canned_responses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const findByShortCode = (code: string): CannedResponse | undefined => {
    return responses.find(r => r.short_code.toLowerCase() === code.toLowerCase());
  };

  const searchResponses = (query: string): CannedResponse[] => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return responses.filter(r => 
      r.short_code.toLowerCase().includes(lowerQuery)
    ).slice(0, 5);
  };

  return {
    responses,
    isLoading,
    createResponse,
    updateResponse,
    deleteResponse,
    findByShortCode,
    searchResponses,
    refetch: fetchResponses,
  };
}
