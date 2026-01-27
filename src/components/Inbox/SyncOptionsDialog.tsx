import { useState } from "react";
import { RefreshCw, Loader2, Clock, Download, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onSyncMessages: (limit: number) => void;
  isSyncing: boolean;
  lastSyncAt?: string | null;
}

const SYNC_LIMITS = [
  { value: '50', label: 'Últimas 50 mensagens' },
  { value: '100', label: 'Últimas 100 mensagens' },
  { value: '200', label: 'Últimas 200 mensagens' },
  { value: '500', label: 'Últimas 500 mensagens' },
];

export function SyncOptionsDialog({
  open,
  onOpenChange,
  conversationId,
  onSyncMessages,
  isSyncing,
  lastSyncAt
}: SyncOptionsDialogProps) {
  const { toast } = useToast();
  const { instances } = useWhatsAppInstances();
  
  const [syncLimit, setSyncLimit] = useState('50');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [onlyNewMessages, setOnlyNewMessages] = useState(true);
  const [includeGroups, setIncludeGroups] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  const handleSingleSync = () => {
    onSyncMessages(parseInt(syncLimit));
    onOpenChange(false);
  };

  const handleBatchSync = async () => {
    if (!selectedInstanceId) {
      toast({
        title: 'Selecione uma instância',
        description: 'Escolha a instância para sincronizar',
        variant: 'destructive'
      });
      return;
    }

    setIsBatchSyncing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/sync-chats`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            instanceId: selectedInstanceId,
            filters: {
              onlyNew: onlyNewMessages,
              includeGroups,
              limit: 50
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro na sincronização em lote');
      }

      toast({
        title: 'Sincronização concluída',
        description: `${result.syncedChats || 0} conversa(s) sincronizada(s)`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Batch sync error:', error);
      toast({
        title: 'Erro na sincronização',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setIsBatchSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Opções de Sincronização
          </DialogTitle>
          <DialogDescription>
            Configure como sincronizar mensagens do WhatsApp
          </DialogDescription>
        </DialogHeader>

        {/* Single Conversation Sync */}
        {conversationId && (
          <>
            <div className="space-y-4">
              <Label className="font-semibold">Sincronizar esta conversa</Label>
              
              <RadioGroup value={syncLimit} onValueChange={setSyncLimit}>
                <div className="grid grid-cols-2 gap-3">
                  {SYNC_LIMITS.map(limit => (
                    <div key={limit.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={limit.value} id={limit.value} />
                      <Label htmlFor={limit.value} className="text-sm cursor-pointer">
                        {limit.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              <Button 
                onClick={handleSingleSync} 
                disabled={isSyncing}
                className="w-full"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Sincronizar Mensagens
                  </>
                )}
              </Button>
            </div>

            <Separator />
          </>
        )}

        {/* Batch Sync */}
        <div className="space-y-4">
          <Label className="font-semibold">Sincronização em Lote</Label>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Selecione a instância</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map(instance => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="onlyNew"
                  checked={onlyNewMessages}
                  onCheckedChange={(checked) => setOnlyNewMessages(checked === true)}
                />
                <Label htmlFor="onlyNew" className="text-sm cursor-pointer">
                  Apenas conversas com mensagens novas
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeGroups"
                  checked={includeGroups}
                  onCheckedChange={(checked) => setIncludeGroups(checked === true)}
                />
                <Label htmlFor="includeGroups" className="text-sm cursor-pointer">
                  Incluir grupos
                </Label>
              </div>
            </div>

            <Button 
              onClick={handleBatchSync}
              disabled={isBatchSyncing || !selectedInstanceId}
              variant="outline"
              className="w-full"
            >
              {isBatchSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando em lote...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Todas as Conversas
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Last Sync Info */}
        {lastSyncAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <Clock className="h-3 w-3" />
            Última sincronização: {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: ptBR })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
