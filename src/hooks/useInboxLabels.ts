import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// UAZAPI color mapping (0-19)
export const UAZAPI_COLORS = [
  { code: 0, hex: "#00a884", name: "Verde" },
  { code: 1, hex: "#53bdeb", name: "Azul Claro" },
  { code: 2, hex: "#ffb02e", name: "Amarelo" },
  { code: 3, hex: "#ff7eb3", name: "Rosa" },
  { code: 4, hex: "#a695e7", name: "Roxo" },
  { code: 5, hex: "#ff6b6b", name: "Vermelho" },
  { code: 6, hex: "#ffa07a", name: "Salmão" },
  { code: 7, hex: "#20c997", name: "Turquesa" },
  { code: 8, hex: "#6c757d", name: "Cinza" },
  { code: 9, hex: "#fd7e14", name: "Laranja" },
  { code: 10, hex: "#198754", name: "Verde Escuro" },
  { code: 11, hex: "#0dcaf0", name: "Ciano" },
  { code: 12, hex: "#d63384", name: "Magenta" },
  { code: 13, hex: "#6610f2", name: "Índigo" },
  { code: 14, hex: "#dc3545", name: "Vermelho Escuro" },
  { code: 15, hex: "#ffc107", name: "Âmbar" },
  { code: 16, hex: "#0d6efd", name: "Azul" },
  { code: 17, hex: "#6f42c1", name: "Violeta" },
  { code: 18, hex: "#212529", name: "Preto" },
  { code: 19, hex: "#adb5bd", name: "Prata" },
];

export function getColorCodeFromHex(hex: string): number {
  const found = UAZAPI_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  return found?.code ?? 0;
}

export function getHexFromColorCode(code: number): string {
  const found = UAZAPI_COLORS.find(c => c.code === code);
  return found?.hex ?? "#00a884";
}

export interface InboxLabel {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  whatsapp_label_id: string | null;
  color_code: number | null;
  instance_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppLabel {
  id: string;
  name: string;
  color: number;
}

export function useInboxLabels() {
  const { user } = useAuth();
  const [labels, setLabels] = useState<InboxLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchLabels = useCallback(async () => {
    if (!user) {
      setLabels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_labels')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setLabels((data as InboxLabel[]) || []);
    } catch (error) {
      console.error('Error fetching inbox labels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  // Sync labels from WhatsApp (import from UAZAPI)
  const syncFromWhatsApp = async (instanceId: string) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsSyncing(true);
    try {
      // 1. Fetch labels from UAZAPI
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'get_labels', instanceId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const whatsappLabels: WhatsAppLabel[] = data.labels || [];
      
      // 2. Upsert labels into local database
      let imported = 0;
      for (const waLabel of whatsappLabels) {
        // Check if already exists
        const existing = labels.find(
          l => l.whatsapp_label_id === waLabel.id && l.instance_id === instanceId
        );

        if (existing) {
          // Update existing
          await supabase
            .from('inbox_labels')
            .update({
              name: waLabel.name,
              color: getHexFromColorCode(waLabel.color),
              color_code: waLabel.color,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          // Create new
          await supabase
            .from('inbox_labels')
            .insert({
              user_id: user.id,
              instance_id: instanceId,
              whatsapp_label_id: waLabel.id,
              name: waLabel.name,
              color: getHexFromColorCode(waLabel.color),
              color_code: waLabel.color,
            });
          imported++;
        }
      }

      await fetchLabels();
      return { success: true, imported, total: whatsappLabels.length };
    } finally {
      setIsSyncing(false);
    }
  };

  // Create label with WhatsApp sync
  const createLabel = async (data: {
    name: string;
    description?: string;
    color: string;
    colorCode?: number;
    instanceId?: string;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const colorCode = data.colorCode ?? getColorCodeFromHex(data.color);
    let whatsappLabelId: string | null = null;

    // If instanceId provided, create in WhatsApp first
    if (data.instanceId) {
      try {
        const { data: waResult, error } = await supabase.functions.invoke('whatsapp-instances', {
          body: { 
            action: 'create_label', 
            instanceId: data.instanceId,
            name: data.name,
            colorCode
          }
        });

        if (!error && waResult?.labelId) {
          whatsappLabelId = waResult.labelId;
        }
      } catch (e) {
        console.warn('Could not create label in WhatsApp:', e);
      }
    }

    // Create in database
    const { data: newLabel, error } = await supabase
      .from('inbox_labels')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description || null,
        color: data.color,
        color_code: colorCode,
        instance_id: data.instanceId || null,
        whatsapp_label_id: whatsappLabelId,
      })
      .select()
      .single();

    if (error) throw error;
    
    setLabels(prev => [...prev, newLabel as InboxLabel].sort((a, b) => 
      a.name.localeCompare(b.name)
    ));
    
    return newLabel;
  };

  const updateLabel = async (id: string, data: {
    name?: string;
    description?: string;
    color?: string;
    colorCode?: number;
  }) => {
    const updateData: Record<string, unknown> = { ...data };
    
    if (data.color && !data.colorCode) {
      updateData.color_code = getColorCodeFromHex(data.color);
    }

    const { data: updated, error } = await supabase
      .from('inbox_labels')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    setLabels(prev => prev.map(l => l.id === id ? updated as InboxLabel : l));
    return updated;
  };

  const deleteLabel = async (id: string) => {
    // Get the label first to check if it needs WhatsApp deletion
    const label = labels.find(l => l.id === id);
    
    // If synced with WhatsApp, delete there too
    if (label?.whatsapp_label_id && label?.instance_id) {
      try {
        await supabase.functions.invoke('whatsapp-instances', {
          body: { 
            action: 'delete_label', 
            instanceId: label.instance_id,
            labelId: label.whatsapp_label_id
          }
        });
      } catch (e) {
        console.warn('Could not delete label from WhatsApp:', e);
      }
    }

    const { error } = await supabase
      .from('inbox_labels')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setLabels(prev => prev.filter(l => l.id !== id));
  };

  // Assign label to a chat (syncs with WhatsApp)
  const assignLabelToChat = async (
    labelId: string, 
    instanceId: string, 
    phone: string
  ) => {
    const label = labels.find(l => l.id === labelId);
    
    if (label?.whatsapp_label_id) {
      await supabase.functions.invoke('whatsapp-instances', {
        body: { 
          action: 'assign_chat_labels', 
          instanceId,
          phone,
          addLabelIds: [label.whatsapp_label_id]
        }
      });
    }
  };

  // Remove label from a chat (syncs with WhatsApp)
  const removeLabelFromChat = async (
    labelId: string, 
    instanceId: string, 
    phone: string
  ) => {
    const label = labels.find(l => l.id === labelId);
    
    if (label?.whatsapp_label_id) {
      await supabase.functions.invoke('whatsapp-instances', {
        body: { 
          action: 'assign_chat_labels', 
          instanceId,
          phone,
          removeLabelIds: [label.whatsapp_label_id]
        }
      });
    }
  };

  return {
    labels,
    isLoading,
    isSyncing,
    createLabel,
    updateLabel,
    deleteLabel,
    syncFromWhatsApp,
    assignLabelToChat,
    removeLabelFromChat,
    refetch: fetchLabels,
    UAZAPI_COLORS,
  };
}
