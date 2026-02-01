import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CustomService {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

const STORAGE_KEY = 'custom-services';

export function useCustomServices() {
  const { user } = useAuth();
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage initially for immediate UI
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCustomServices(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing stored services:', e);
      }
    }
    setIsLoading(false);
  }, []);

  // Sync with Supabase when user is available
  useEffect(() => {
    if (!user) return;

    const fetchServices = async () => {
      try {
        // Check if custom_services table exists by attempting to query it
        const { data, error } = await supabase
          .from('client_tags')
          .select('id')
          .limit(1);

        // For now, we'll use localStorage only since we don't have a custom_services table
        // This can be migrated to Supabase later
      } catch (error) {
        console.error('Error fetching custom services:', error);
      }
    };

    fetchServices();
  }, [user]);

  const addService = useCallback((name: string) => {
    const trimmedName = name.trim().toUpperCase();
    if (!trimmedName) return null;

    // Check if already exists
    const exists = customServices.some(
      s => s.name.toUpperCase() === trimmedName
    );
    if (exists) return null;

    const newService: CustomService = {
      id: crypto.randomUUID(),
      name: trimmedName,
      user_id: user?.id || '',
      created_at: new Date().toISOString(),
    };

    const updated = [...customServices, newService];
    setCustomServices(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return newService;
  }, [customServices, user]);

  const removeService = useCallback((id: string) => {
    const updated = customServices.filter(s => s.id !== id);
    setCustomServices(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [customServices]);

  const getAllServices = useCallback(() => {
    const defaultServices = [
      { id: 'IPTV', name: 'IPTV', isDefault: true },
      { id: 'VPN', name: 'VPN', isDefault: true },
    ];

    const custom = customServices.map(s => ({
      id: s.name,
      name: s.name,
      isDefault: false,
    }));

    return [...defaultServices, ...custom];
  }, [customServices]);

  return {
    customServices,
    isLoading,
    addService,
    removeService,
    getAllServices,
  };
}
