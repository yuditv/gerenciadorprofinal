import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ClientTag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface ClientTagAssignment {
  clientId: string;
  tagId: string;
}

// Generic types for tables not yet in the generated types
interface DbClientTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

interface DbClientTagAssignment {
  id: string;
  client_id: string;
  tag_id: string;
  created_at: string;
}

export function useClientTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [assignments, setAssignments] = useState<ClientTagAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('client_tags' as any)
        .select('*')
        .order('name') as { data: DbClientTag[] | null; error: any };

      // Silently ignore if table doesn't exist yet (PGRST205)
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('client_tags table not found in schema cache. Please reload Supabase schema cache.');
          return;
        }
        throw error;
      }

      setTags(
        (data || []).map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdAt: new Date(tag.created_at),
        }))
      );
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, [user]);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('client_tag_assignments' as any)
        .select('client_id, tag_id') as { data: { client_id: string; tag_id: string }[] | null; error: any };

      // Silently ignore if table doesn't exist yet (PGRST205)
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('client_tag_assignments table not found in schema cache. Please reload Supabase schema cache.');
          return;
        }
        throw error;
      }

      setAssignments(
        (data || []).map((a) => ({
          clientId: a.client_id,
          tagId: a.tag_id,
        }))
      );
    } catch (error) {
      console.error('Error fetching tag assignments:', error);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTags(), fetchAssignments()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchTags, fetchAssignments]);

  const createTag = async (name: string, color: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('client_tags' as any)
        .insert({ user_id: user.id, name, color })
        .select()
        .single() as { data: DbClientTag | null; error: any };

      if (error) throw error;
      if (!data) return null;

      const newTag: ClientTag = {
        id: data.id,
        name: data.name,
        color: data.color,
        createdAt: new Date(data.created_at),
      };

      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Tag criada com sucesso!');
      return newTag;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma tag com esse nome');
      } else {
        toast.error('Erro ao criar tag');
      }
      return null;
    }
  };

  const updateTag = async (id: string, name: string, color: string) => {
    try {
      const { error } = await supabase
        .from('client_tags' as any)
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;

      setTags((prev) =>
        prev.map((tag) => (tag.id === id ? { ...tag, name, color } : tag))
      );
      toast.success('Tag atualizada!');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma tag com esse nome');
      } else {
        toast.error('Erro ao atualizar tag');
      }
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase.from('client_tags' as any).delete().eq('id', id);

      if (error) throw error;

      setTags((prev) => prev.filter((tag) => tag.id !== id));
      setAssignments((prev) => prev.filter((a) => a.tagId !== id));
      toast.success('Tag excluída!');
    } catch (error) {
      toast.error('Erro ao excluir tag');
    }
  };

  const assignTag = async (clientId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('client_tag_assignments' as any)
        .insert({ client_id: clientId, tag_id: tagId });

      if (error) {
        if (error.code === '23505') return; // Already assigned
        throw error;
      }

      setAssignments((prev) => [...prev, { clientId, tagId }]);
    } catch (error) {
      toast.error('Erro ao atribuir tag');
    }
  };

  const removeTag = async (clientId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('client_tag_assignments' as any)
        .delete()
        .match({ client_id: clientId, tag_id: tagId });

      if (error) throw error;

      setAssignments((prev) =>
        prev.filter((a) => !(a.clientId === clientId && a.tagId === tagId))
      );
    } catch (error) {
      toast.error('Erro ao remover tag');
    }
  };

  const getClientTags = (clientId: string): ClientTag[] => {
    const clientTagIds = assignments
      .filter((a) => a.clientId === clientId)
      .map((a) => a.tagId);
    return tags.filter((tag) => clientTagIds.includes(tag.id));
  };

  const getClientsByTag = (tagId: string): string[] => {
    return assignments.filter((a) => a.tagId === tagId).map((a) => a.clientId);
  };

  return {
    tags,
    assignments,
    isLoading,
    createTag,
    updateTag,
    deleteTag,
    assignTag,
    removeTag,
    getClientTags,
    getClientsByTag,
    refetch: () => Promise.all([fetchTags(), fetchAssignments()]),
  };
}
