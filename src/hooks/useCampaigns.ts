import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Campaign {
  id: string;
  instance_id: string;
  name: string;
  message_template: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  progress: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  pause_after_messages: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CampaignContact {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

export function useCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    try {
      // Use raw fetch since table may not be in types yet
      const { data, error } = await supabase
        .from('campaigns' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        setCampaigns([]);
        return;
      }
      setCampaigns((data as unknown as Campaign[]) || []);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (data: {
    instance_id: string;
    name: string;
    message_template: string;
    min_delay_seconds?: number;
    max_delay_seconds?: number;
    pause_after_messages?: number;
  }) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('campaigns/create', {
        body: data,
      });
      if (error) throw error;
      toast.success('Campanha criada!');
      await fetchCampaigns();
      return result.campaign;
    } catch (error: any) {
      toast.error(error.message);
      return null;
    }
  };

  const addContacts = async (campaignId: string, contacts: Array<{ phone: string; name?: string; variables?: Record<string, string> }>) => {
    try {
      const { error } = await supabase.functions.invoke(`campaigns/add-contacts/${campaignId}`, {
        body: { contacts },
      });
      if (error) throw error;
      toast.success(`${contacts.length} contato(s) adicionado(s)!`);
      await fetchCampaigns();
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  const startCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase.functions.invoke(`campaigns/start/${campaignId}`, {
        body: {},
      });
      if (error) throw error;
      toast.success('Campanha iniciada!');
      await fetchCampaigns();
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase.functions.invoke(`campaigns/pause/${campaignId}`, {
        body: {},
      });
      if (error) throw error;
      toast.success('Campanha pausada!');
      await fetchCampaigns();
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  const getStats = async (campaignId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`campaigns/stats/${campaignId}`);
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      return null;
    }
  };

  return {
    campaigns,
    isLoading,
    createCampaign,
    addContacts,
    startCampaign,
    pauseCampaign,
    getStats,
    refetch: fetchCampaigns,
  };
}
