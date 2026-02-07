import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { toast } from 'sonner';

export interface CSATSurvey {
  id: string;
  conversation_id: string;
  user_id: string;
  rating: number | null;
  feedback: string | null;
  sent_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface CSATMetrics {
  totalSurveys: number;
  totalResponses: number;
  responseRate: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  npsScore: number;
}

export function useInboxCSAT() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [surveys, setSurveys] = useState<CSATSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = ownerId || user?.id;

  const fetchSurveys = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('inbox_csat_surveys')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setSurveys((data || []) as CSATSurvey[]);
    } catch (error) {
      console.error('Error fetching CSAT surveys:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const sendSurvey = async (conversationId: string) => {
    if (!effectiveUserId) return;
    try {
      const { error } = await supabase
        .from('inbox_csat_surveys')
        .insert({
          conversation_id: conversationId,
          user_id: effectiveUserId,
        });

      if (error) throw error;
      toast.success('Pesquisa de satisfação enviada');
      await fetchSurveys();
    } catch (error) {
      console.error('Error sending CSAT survey:', error);
      toast.error('Erro ao enviar pesquisa');
    }
  };

  const submitRating = async (surveyId: string, rating: number, feedback?: string) => {
    try {
      const { error } = await supabase
        .from('inbox_csat_surveys')
        .update({
          rating,
          feedback: feedback || null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', surveyId);

      if (error) throw error;
      toast.success('Avaliação registrada');
      await fetchSurveys();
    } catch (error) {
      console.error('Error submitting CSAT rating:', error);
      toast.error('Erro ao registrar avaliação');
    }
  };

  const metrics: CSATMetrics = {
    totalSurveys: surveys.length,
    totalResponses: surveys.filter(s => s.rating !== null).length,
    responseRate: surveys.length > 0
      ? (surveys.filter(s => s.rating !== null).length / surveys.length) * 100
      : 0,
    averageRating: (() => {
      const rated = surveys.filter(s => s.rating !== null);
      if (rated.length === 0) return 0;
      return rated.reduce((sum, s) => sum + (s.rating || 0), 0) / rated.length;
    })(),
    ratingDistribution: surveys.reduce((acc, s) => {
      if (s.rating !== null) {
        acc[s.rating] = (acc[s.rating] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>),
    npsScore: (() => {
      const rated = surveys.filter(s => s.rating !== null);
      if (rated.length === 0) return 0;
      const promoters = rated.filter(s => (s.rating || 0) >= 4).length;
      const detractors = rated.filter(s => (s.rating || 0) <= 2).length;
      return Math.round(((promoters - detractors) / rated.length) * 100);
    })(),
  };

  return { surveys, isLoading, sendSurvey, submitRating, metrics, refetch: fetchSurveys };
}
