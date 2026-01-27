import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Search, Users, MessageSquare, Smartphone, Filter, Bot, Flame, Headphones, Settings, User, BarChart3 } from 'lucide-react';
import { Client } from '@/types/client';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  clients: Client[];
  instances: WhatsAppInstance[];
  onNavigate?: (section: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const sections = [
  { id: 'clients', label: 'Gerenciador', icon: Users, description: 'Gerenciar clientes' },
  { id: 'contatos', label: 'Contatos', icon: Users, description: 'Lista de contatos' },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, description: 'Instâncias e envios' },
  { id: 'atendimento', label: 'Atendimento', icon: Headphones, description: 'Central de atendimento' },
  { id: 'filter-numbers', label: 'Filtrar Números', icon: Filter, description: 'Verificar números WhatsApp' },
  { id: 'ai-agent', label: 'Agente IA', icon: Bot, description: 'Assistente inteligente' },
  { id: 'warm-chips', label: 'Aquecimento', icon: Flame, description: 'Aquecer chips' },
];

const quickActions = [
  { id: 'profile', label: 'Meu Perfil', icon: User, path: '/profile' },
  { id: 'settings', label: 'Configurações', icon: Settings, path: '/settings' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/dashboard' },
];

export function GlobalSearch({ clients, instances, onNavigate, isOpen, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!search || search.length < 2) return [];
    const query = search.toLowerCase();
    return clients
      .filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.whatsapp.includes(search)
      )
      .slice(0, 5);
  }, [clients, search]);

  // Filter instances based on search
  const filteredInstances = useMemo(() => {
    if (!search || search.length < 2) return [];
    const query = search.toLowerCase();
    return instances
      .filter(i => i.instance_name.toLowerCase().includes(query))
      .slice(0, 3);
  }, [instances, search]);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!search) return sections;
    const query = search.toLowerCase();
    return sections.filter(s => 
      s.label.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
    );
  }, [search]);

  const handleSelect = useCallback((value: string) => {
    onOpenChange(false);
    setSearch('');

    // Handle section navigation
    const section = sections.find(s => s.id === value);
    if (section && onNavigate) {
      onNavigate(section.id);
      return;
    }

    // Handle quick action navigation
    const action = quickActions.find(a => a.id === value);
    if (action) {
      navigate(action.path);
      return;
    }

    // Handle client selection
    if (value.startsWith('client-')) {
      const clientId = value.replace('client-', '');
      // Navigate to client (you could open edit dialog instead)
      if (onNavigate) {
        onNavigate('clients');
      }
    }

    // Handle instance selection
    if (value.startsWith('instance-')) {
      if (onNavigate) {
        onNavigate('whatsapp');
      }
    }
  }, [onNavigate, onOpenChange, navigate]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  return (
    <CommandDialog open={isOpen} onOpenChange={onOpenChange}>
      <Command className="rounded-lg border-none">
        <CommandInput 
          placeholder="Buscar clientes, seções, ações..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-30" />
              <p>Nenhum resultado encontrado</p>
              <p className="text-xs mt-1">Tente buscar por outro termo</p>
            </div>
          </CommandEmpty>

          {/* Clients Results */}
          {filteredClients.length > 0 && (
            <CommandGroup heading="Clientes">
              {filteredClients.map(client => (
                <CommandItem
                  key={client.id}
                  value={`client-${client.id}`}
                  onSelect={handleSelect}
                  className="flex items-center gap-3"
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{client.email || client.whatsapp}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {client.plan}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Instances Results */}
          {filteredInstances.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Instâncias WhatsApp">
                {filteredInstances.map(instance => (
                  <CommandItem
                    key={instance.id}
                    value={`instance-${instance.id}`}
                    onSelect={handleSelect}
                    className="flex items-center gap-3"
                  >
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{instance.instance_name}</p>
                      <p className="text-xs text-muted-foreground">{instance.phone_connected || 'Não conectado'}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px]",
                        instance.status === 'connected' 
                          ? 'border-emerald-500 text-emerald-500' 
                          : 'border-destructive text-destructive'
                      )}
                    >
                      {instance.status === 'connected' ? 'Online' : 'Offline'}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Sections */}
          <CommandSeparator />
          <CommandGroup heading="Seções">
            {filteredSections.map(section => (
              <CommandItem
                key={section.id}
                value={section.id}
                onSelect={handleSelect}
                className="flex items-center gap-3"
              >
                <section.icon className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          {/* Quick Actions */}
          <CommandSeparator />
          <CommandGroup heading="Ações Rápidas">
            {quickActions.map(action => (
              <CommandItem
                key={action.id}
                value={action.id}
                onSelect={handleSelect}
                className="flex items-center gap-3"
              >
                <action.icon className="h-4 w-4 text-muted-foreground" />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
