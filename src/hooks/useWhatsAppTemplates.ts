import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WhatsAppTemplate {
  id: string;
  template_type: string;
  subject: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('template_type', 'whatsapp')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching WhatsApp templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (name: string, content: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('message_templates')
        .insert({
          user_id: user.id,
          template_type: 'whatsapp',
          subject: name,
          content,
        });

      if (error) throw error;
      toast.success('Template criado com sucesso!');
      await fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast.error('Erro ao criar template');
      return false;
    }
  };

  const updateTemplate = async (id: string, name: string, content: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('message_templates')
        .update({
          subject: name,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Template atualizado com sucesso!');
      await fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast.error('Erro ao atualizar template');
      return false;
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Template excluído com sucesso!');
      await fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
      return false;
    }
  };

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}
