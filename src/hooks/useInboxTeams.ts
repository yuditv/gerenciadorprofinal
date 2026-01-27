import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface InboxTeam {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  auto_assign: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface InboxTeamMember {
  id: string;
  team_id: string;
  agent_id: string;
  created_at: string;
}

export function useInboxTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<InboxTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('inbox_teams')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (teamsError) throw teamsError;

      // Fetch member counts
      const { data: memberCounts, error: countError } = await supabase
        .from('inbox_team_members')
        .select('team_id');

      if (countError) throw countError;

      // Count members per team
      const countMap = new Map<string, number>();
      memberCounts?.forEach(m => {
        countMap.set(m.team_id, (countMap.get(m.team_id) || 0) + 1);
      });

      const teamsWithCounts = (teamsData || []).map(team => ({
        ...team,
        member_count: countMap.get(team.id) || 0,
      })) as InboxTeam[];

      setTeams(teamsWithCounts);
    } catch (error) {
      console.error('Error fetching inbox teams:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (data: {
    name: string;
    description?: string;
    auto_assign?: boolean;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const { data: newTeam, error } = await supabase
      .from('inbox_teams')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description || null,
        auto_assign: data.auto_assign || false,
      })
      .select()
      .single();

    if (error) throw error;
    
    const teamWithCount = { ...newTeam, member_count: 0 } as InboxTeam;
    setTeams(prev => [...prev, teamWithCount].sort((a, b) => 
      a.name.localeCompare(b.name)
    ));
    
    return newTeam;
  };

  const updateTeam = async (id: string, data: {
    name?: string;
    description?: string;
    auto_assign?: boolean;
  }) => {
    const { data: updated, error } = await supabase
      .from('inbox_teams')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    setTeams(prev => prev.map(t => t.id === id ? { ...updated, member_count: t.member_count } as InboxTeam : t));
    return updated;
  };

  const deleteTeam = async (id: string) => {
    const { error } = await supabase
      .from('inbox_teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setTeams(prev => prev.filter(t => t.id !== id));
  };

  const addMember = async (teamId: string, agentId: string) => {
    const { data, error } = await supabase
      .from('inbox_team_members')
      .insert({ team_id: teamId, agent_id: agentId })
      .select()
      .single();

    if (error) throw error;
    
    // Update local count
    setTeams(prev => prev.map(t => 
      t.id === teamId ? { ...t, member_count: (t.member_count || 0) + 1 } : t
    ));
    
    return data;
  };

  const removeMember = async (teamId: string, agentId: string) => {
    const { error } = await supabase
      .from('inbox_team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('agent_id', agentId);

    if (error) throw error;
    
    // Update local count
    setTeams(prev => prev.map(t => 
      t.id === teamId ? { ...t, member_count: Math.max((t.member_count || 0) - 1, 0) } : t
    ));
  };

  return {
    teams,
    isLoading,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    refetch: fetchTeams,
  };
}
