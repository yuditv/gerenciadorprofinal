import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, PlanType, ServiceType, RenewalRecord, getExpirationStatus, getDaysUntilExpiration, planDurations, planLabels } from '@/types/client';
import { addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from './useAuth';

interface DbClient {
  id: string;
  user_id: string;
  name: string;
  whatsapp: string;
  email: string;
  service: string;
  plan: string;
  price: number | null;
  notes: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  service_username: string | null;
  service_password: string | null;
  app_name: string | null;
  device: string | null;
}

interface DbRenewal {
  id: string;
  client_id: string;
  user_id: string;
  plan: string;
  previous_expires_at: string;
  new_expires_at: string;
  created_at: string;
}

export function useClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!user) {
      setClients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      setIsLoading(false);
      return;
    }

    const { data: renewalsData, error: renewalsError } = await supabase
      .from('renewal_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (renewalsError) {
      console.error('Error fetching renewals:', renewalsError);
    }

    const renewalsByClient = (renewalsData || []).reduce((acc, renewal: DbRenewal) => {
      if (!acc[renewal.client_id]) {
        acc[renewal.client_id] = [];
      }
      acc[renewal.client_id].push({
        id: renewal.id,
        date: new Date(renewal.created_at),
        previousExpiresAt: new Date(renewal.previous_expires_at),
        newExpiresAt: new Date(renewal.new_expires_at),
        plan: renewal.plan as PlanType,
      });
      return acc;
    }, {} as Record<string, RenewalRecord[]>);

    const formattedClients: Client[] = (clientsData || []).map((c: DbClient) => ({
      id: c.id,
      name: c.name,
      whatsapp: c.whatsapp,
      email: c.email,
      service: (c.service || 'IPTV') as ServiceType,
      plan: c.plan as PlanType,
      price: c.price,
      notes: c.notes,
      expiresAt: new Date(c.expires_at),
      createdAt: new Date(c.created_at),
      renewalHistory: renewalsByClient[c.id] || [],
      serviceUsername: c.service_username,
      servicePassword: c.service_password,
      appName: c.app_name,
      device: c.device,
    }));

    setClients(formattedClients);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClient = async (data: Omit<Client, 'id' | 'renewalHistory'>) => {
    if (!user) return null;

    // Check if this is user's first client (for referral validation)
    const isFirstClient = clients.length === 0;

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        name: data.name,
        whatsapp: data.whatsapp,
        email: data.email,
        service: data.service,
        plan: data.plan,
        price: data.price,
        notes: data.notes,
        created_at: data.createdAt.toISOString(),
        expires_at: data.expiresAt.toISOString(),
        service_username: data.serviceUsername,
        service_password: data.servicePassword,
        app_name: data.appName,
        device: data.device,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding client:', error);
      return null;
    }

    await fetchClients();
    return newClient;
  };

  const updateClient = async (id: string, data: Partial<Omit<Client, 'id'>>) => {
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.whatsapp) updateData.whatsapp = data.whatsapp;
    if (data.email) updateData.email = data.email;
    if (data.service) updateData.service = data.service;
    if (data.plan) updateData.plan = data.plan;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.createdAt) updateData.created_at = data.createdAt.toISOString();
    if (data.expiresAt) updateData.expires_at = data.expiresAt.toISOString();
    if (data.serviceUsername !== undefined) updateData.service_username = data.serviceUsername;
    if (data.servicePassword !== undefined) updateData.service_password = data.servicePassword;
    if (data.appName !== undefined) updateData.app_name = data.appName;
    if (data.device !== undefined) updateData.device = data.device;

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating client:', error);
      return;
    }

    await fetchClients();
  };

  const deleteClient = async (id: string) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting client:', error);
      return;
    }

    await fetchClients();
  };

  const renewClient = async (id: string, sendNotification: boolean = true) => {
    if (!user) return null;
    
    const client = clients.find(c => c.id === id);
    if (!client) return null;

    const now = new Date();
    const currentExpiration = client.expiresAt;
    const baseDate = currentExpiration < now ? now : currentExpiration;
    const newExpiresAt = addMonths(baseDate, planDurations[client.plan]);

    // Insert renewal record
    const { error: renewalError } = await supabase
      .from('renewal_history')
      .insert({
        client_id: id,
        user_id: user.id,
        plan: client.plan,
        previous_expires_at: currentExpiration.toISOString(),
        new_expires_at: newExpiresAt.toISOString(),
      });

    if (renewalError) {
      console.error('Error creating renewal:', renewalError);
      return null;
    }

    // Update client expiration
    const { error: updateError } = await supabase
      .from('clients')
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating client expiration:', updateError);
      return null;
    }

    // Send WhatsApp renewal notification if enabled
    if (sendNotification && client.whatsapp) {
      try {
        // Fetch user's connected WhatsApp instance
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('instance_key')
          .eq('user_id', user.id)
          .eq('status', 'connected')
          .limit(1)
          .single();

        if (instance?.instance_key) {
          // Format phone number
          let phone = client.whatsapp.replace(/[^\d]/g, '');
          if (!phone.startsWith('55') && phone.length <= 11) {
            phone = '55' + phone;
          }

          // Build renewal confirmation message
          const planName = planLabels[client.plan] || client.plan;
          const formattedDate = format(newExpiresAt, "dd/MM/yyyy", { locale: ptBR });
          const message = `✅ *Renovação Confirmada!*\n\n` +
            `Olá ${client.name}!\n\n` +
            `Seu plano *${planName}* foi renovado com sucesso!\n\n` +
            `📅 Nova data de vencimento: ${formattedDate}\n\n` +
            `Obrigado pela preferência! 🙏`;

          // Send via UAZAPI
          const { error: sendError } = await supabase.functions.invoke('send-whatsapp-uazapi', {
            body: {
              instanceKey: instance.instance_key,
              phone,
              message,
            }
          });

          if (sendError) {
            console.error('Error sending renewal notification:', sendError);
          } else {
            console.log('Renewal notification sent to:', phone);
            
            // Register message in inbox if conversation exists
            const { data: conversation } = await supabase
              .from('conversations')
              .select('id')
              .eq('phone', phone)
              .limit(1)
              .maybeSingle();
            
            if (conversation) {
              // Insert message into inbox
              await supabase
                .from('chat_inbox_messages')
                .insert({
                  conversation_id: conversation.id,
                  content: message,
                  sender_type: 'agent',
                  sender_id: user.id,
                  metadata: {
                    sent_by: user.email,
                    renewal_notification: true,
                    client_id: id
                  }
                });
                
              // Update conversation last_message_at
              await supabase
                .from('conversations')
                .update({ 
                  last_message_at: new Date().toISOString(),
                  last_message_preview: '✅ Renovação Confirmada!'
                })
                .eq('id', conversation.id);
                
              console.log('Renewal message registered in inbox for conversation:', conversation.id);
            }
          }
        } else {
          console.log('No connected WhatsApp instance found, skipping notification');
        }
      } catch (error) {
        console.error('Error sending renewal notification:', error);
        // Don't block the renewal if notification fails
      }
    }

    await fetchClients();
    return newExpiresAt;
  };

  const getClientsByPlan = (plan: PlanType) => {
    return clients.filter(c => c.plan === plan);
  };

  const importClients = async (clientsData: Omit<Client, 'id' | 'renewalHistory'>[]) => {
    if (!user || clientsData.length === 0) return;

    const clientsToInsert = clientsData.map(data => ({
      user_id: user.id,
      name: data.name,
      whatsapp: data.whatsapp,
      email: data.email,
      service: data.service,
      plan: data.plan,
      price: data.price,
      notes: data.notes,
      created_at: data.createdAt.toISOString(),
      expires_at: data.expiresAt.toISOString(),
      service_username: data.serviceUsername,
      service_password: data.servicePassword,
      app_name: data.appName,
      device: data.device,
    }));

    const { error } = await supabase
      .from('clients')
      .insert(clientsToInsert);

    if (error) {
      console.error('Error importing clients:', error);
      throw error;
    }

    await fetchClients();
  };

  const expiringClients = useMemo(() => {
    return clients.filter(c => getExpirationStatus(c.expiresAt) === 'expiring');
  }, [clients]);

  const expiredClients = useMemo(() => {
    return clients.filter(c => {
      if (getExpirationStatus(c.expiresAt) !== 'expired') return false;
      const days = Math.abs(getDaysUntilExpiration(c.expiresAt));
      return days >= 1 && days <= 7;
    });
  }, [clients]);

  return {
    clients,
    isLoading,
    addClient,
    updateClient,
    deleteClient,
    renewClient,
    getClientsByPlan,
    importClients,
    expiringClients,
    expiredClients,
    refetch: fetchClients,
  };
}
