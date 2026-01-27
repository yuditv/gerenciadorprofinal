import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StatusSchedule {
  id: string;
  user_id: string;
  status_type: 'text' | 'image' | 'video' | 'audio';
  text_content: string | null;
  background_color: number;
  font_style: number;
  media_url: string | null;
  media_mimetype: string | null;
  instance_ids: string[];
  scheduled_at: string;
  recurrence_type: 'none' | 'daily' | 'weekly';
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  error_message: string | null;
  success_count: number;
  fail_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  status_type: 'text' | 'image' | 'video' | 'audio';
  text_content?: string;
  background_color?: number;
  font_style?: number;
  media_url?: string;
  media_mimetype?: string;
  instance_ids: string[];
  scheduled_at: Date;
  recurrence_type?: 'none' | 'daily' | 'weekly';
  recurrence_days?: number[];
  recurrence_end_date?: Date;
}

export function useStatusSchedules() {
  const [schedules, setSchedules] = useState<StatusSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('status_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      
      // Cast the data properly
      setSchedules((data || []) as unknown as StatusSchedule[]);
    } catch (error) {
      console.error('Error fetching status schedules:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const createSchedule = async (input: CreateScheduleInput): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return false;
      }

      const { error } = await supabase
        .from('status_schedules')
        .insert({
          user_id: user.id,
          status_type: input.status_type,
          text_content: input.text_content || null,
          background_color: input.background_color || 1,
          font_style: input.font_style || 0,
          media_url: input.media_url || null,
          media_mimetype: input.media_mimetype || null,
          instance_ids: input.instance_ids,
          scheduled_at: input.scheduled_at.toISOString(),
          recurrence_type: input.recurrence_type || 'none',
          recurrence_days: input.recurrence_days || null,
          recurrence_end_date: input.recurrence_end_date?.toISOString() || null,
        });

      if (error) throw error;

      toast.success('Agendamento criado com sucesso!');
      await fetchSchedules();
      return true;
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast.error('Erro ao criar agendamento');
      return false;
    }
  };

  const updateSchedule = async (id: string, updates: Partial<CreateScheduleInput>): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = {};
      
      if (updates.status_type) updateData.status_type = updates.status_type;
      if (updates.text_content !== undefined) updateData.text_content = updates.text_content;
      if (updates.background_color !== undefined) updateData.background_color = updates.background_color;
      if (updates.font_style !== undefined) updateData.font_style = updates.font_style;
      if (updates.media_url !== undefined) updateData.media_url = updates.media_url;
      if (updates.media_mimetype !== undefined) updateData.media_mimetype = updates.media_mimetype;
      if (updates.instance_ids) updateData.instance_ids = updates.instance_ids;
      if (updates.scheduled_at) updateData.scheduled_at = updates.scheduled_at.toISOString();
      if (updates.recurrence_type) updateData.recurrence_type = updates.recurrence_type;
      if (updates.recurrence_days !== undefined) updateData.recurrence_days = updates.recurrence_days;
      if (updates.recurrence_end_date !== undefined) {
        updateData.recurrence_end_date = updates.recurrence_end_date?.toISOString() || null;
      }

      const { error } = await supabase
        .from('status_schedules')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Agendamento atualizado!');
      await fetchSchedules();
      return true;
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Erro ao atualizar agendamento');
      return false;
    }
  };

  const cancelSchedule = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('status_schedules')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Agendamento cancelado');
      await fetchSchedules();
      return true;
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      toast.error('Erro ao cancelar agendamento');
      return false;
    }
  };

  const deleteSchedule = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('status_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Agendamento excluído');
      await fetchSchedules();
      return true;
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Erro ao excluir agendamento');
      return false;
    }
  };

  const pendingSchedules = schedules.filter(s => s.status === 'pending');
  const sentSchedules = schedules.filter(s => s.status === 'sent');
  const failedSchedules = schedules.filter(s => s.status === 'failed');
  const cancelledSchedules = schedules.filter(s => s.status === 'cancelled');

  return {
    schedules,
    pendingSchedules,
    sentSchedules,
    failedSchedules,
    cancelledSchedules,
    isLoading,
    createSchedule,
    updateSchedule,
    cancelSchedule,
    deleteSchedule,
    refetch: fetchSchedules,
  };
}
