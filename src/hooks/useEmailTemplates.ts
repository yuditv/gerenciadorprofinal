import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';

// Validation schema
const templateSchema = z.object({
  template_type: z.string().trim().min(1, 'Nome é obrigatório').max(50, 'Nome muito longo'),
  subject: z.string().trim().max(200, 'Assunto muito longo').optional(),
  content: z.string().trim().min(1, 'Conteúdo é obrigatório').max(5000, 'Conteúdo muito longo'),
});

export interface CustomEmailTemplate {
  id: string;
  template_type: string; // Used as name
  subject: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function useEmailTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CustomEmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (data: {
    template_type: string;
    subject?: string;
    content: string;
  }): Promise<CustomEmailTemplate | null> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    // Validate input
    const validation = templateSchema.safeParse(data);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return null;
    }

    try {
      const { data: newTemplate, error } = await supabase
        .from('message_templates')
        .insert({
          user_id: user.id,
          template_type: data.template_type.trim(),
          subject: data.subject?.trim() || null,
          content: data.content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [newTemplate, ...prev]);
      toast.success('Template criado com sucesso!');
      return newTemplate;
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Erro ao criar template');
      return null;
    }
  };

  const updateTemplate = async (
    id: string,
    data: {
      template_type?: string;
      subject?: string;
      content?: string;
    }
  ): Promise<boolean> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return false;
    }

    // Validate input
    const validation = templateSchema.partial().safeParse(data);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return false;
    }

    try {
      const updateData: Record<string, string> = {};
      if (data.template_type) updateData.template_type = data.template_type.trim();
      if (data.subject !== undefined) updateData.subject = data.subject?.trim() || '';
      if (data.content) updateData.content = data.content.trim();

      const { error } = await supabase
        .from('message_templates')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTemplates(prev =>
        prev.map(t =>
          t.id === id ? { ...t, ...updateData, updated_at: new Date().toISOString() } : t
        )
      );
      toast.success('Template atualizado!');
      return true;
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Erro ao atualizar template');
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return false;
    }

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template excluído!');
      return true;
    } catch (error) {
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
