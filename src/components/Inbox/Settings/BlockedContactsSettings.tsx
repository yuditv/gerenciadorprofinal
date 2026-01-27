import { useState, useEffect } from "react";
import { Ban, RefreshCw, UserCheck, Phone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BlockedContact {
  phone: string;
  formattedPhone: string;
}

export function BlockedContactsSettings() {
  const { toast } = useToast();
  const { instances, isLoading: isLoadingInstances } = useWhatsAppInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [blockedContacts, setBlockedContacts] = useState<BlockedContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState<string | null>(null);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [contactToUnblock, setContactToUnblock] = useState<BlockedContact | null>(null);

  // Auto-select first instance
  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  // Fetch blocked contacts when instance changes
  useEffect(() => {
    if (selectedInstanceId) {
      fetchBlockedContacts();
    }
  }, [selectedInstanceId]);

  const formatPhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  const fetchBlockedContacts = async () => {
    if (!selectedInstanceId) return;

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        'https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/whatsapp-instances',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            action: 'list_blocked',
            instanceId: selectedInstanceId
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar contatos bloqueados');
      }

      const contacts: BlockedContact[] = (result.blocked || []).map((phone: string) => ({
        phone,
        formattedPhone: formatPhone(phone)
      }));

      setBlockedContacts(contacts);
    } catch (error) {
      console.error('Error fetching blocked contacts:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível carregar contatos bloqueados',
        variant: 'destructive'
      });
      setBlockedContacts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockClick = (contact: BlockedContact) => {
    setContactToUnblock(contact);
    setUnblockDialogOpen(true);
  };

  const handleConfirmUnblock = async () => {
    if (!contactToUnblock || !selectedInstanceId) return;

    setIsUnblocking(contactToUnblock.phone);
    setUnblockDialogOpen(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        'https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/whatsapp-instances',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            action: 'unblock_contact',
            instanceId: selectedInstanceId,
            phone: contactToUnblock.phone
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao desbloquear contato');
      }

      // Remove from local list
      setBlockedContacts(prev => prev.filter(c => c.phone !== contactToUnblock.phone));

      toast({
        title: 'Contato desbloqueado',
        description: `${contactToUnblock.formattedPhone} pode enviar mensagens novamente`,
      });
    } catch (error) {
      console.error('Error unblocking contact:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível desbloquear o contato',
        variant: 'destructive'
      });
    } finally {
      setIsUnblocking(null);
      setContactToUnblock(null);
    }
  };

  const activeInstances = instances.filter(i => i.status === 'connected');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Contatos Bloqueados</h2>
        <p className="text-muted-foreground mt-1">
          Gerencie os contatos que foram bloqueados no WhatsApp
        </p>
      </div>

      {/* Instance Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selecione a Instância</CardTitle>
          <CardDescription>
            Escolha a instância do WhatsApp para visualizar os contatos bloqueados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={selectedInstanceId}
              onValueChange={setSelectedInstanceId}
              disabled={isLoadingInstances}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {activeInstances.map(instance => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchBlockedContacts}
              disabled={!selectedInstanceId || isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {activeInstances.length === 0 && !isLoadingInstances && (
            <div className="flex items-center gap-2 mt-3 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span>Nenhuma instância conectada encontrada</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Contacts List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                Lista de Bloqueados
              </CardTitle>
              <CardDescription>
                {blockedContacts.length} contato(s) bloqueado(s)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : blockedContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ban className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhum contato bloqueado</p>
              <p className="text-sm mt-1">
                Contatos bloqueados aparecerão aqui
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {blockedContacts.map((contact) => (
                  <div
                    key={contact.phone}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium">{contact.formattedPhone}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblockClick(contact)}
                      disabled={isUnblocking === contact.phone}
                      className="text-green-600 border-green-600 hover:bg-green-600/10"
                    >
                      {isUnblocking === contact.phone ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-2" />
                      )}
                      Desbloquear
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Unblock Confirmation Dialog */}
      <AlertDialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desbloquear{' '}
              <span className="font-medium text-foreground">
                {contactToUnblock?.formattedPhone}
              </span>
              ? Este contato poderá enviar mensagens para você novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnblock}
              className="bg-green-600 hover:bg-green-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
