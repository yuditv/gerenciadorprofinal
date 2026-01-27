import { useState } from 'react';
import { Client } from '@/types/client';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Smartphone, User, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SendWhatsAppDialogProps {
  client: Client | null;
  instances: WhatsAppInstance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendWhatsAppDialog({ client, instances, open, onOpenChange }: SendWhatsAppDialogProps) {
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const connectedInstances = instances.filter(i => i.status === 'connected');

  const handleSend = async () => {
    if (!client || !selectedInstance || !message.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSending(true);

    try {
      const instance = instances.find(i => i.id === selectedInstance);
      if (!instance?.instance_key) {
        throw new Error('Instância não configurada');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-uazapi', {
        body: {
          instanceKey: instance.instance_key,
          phone: client.whatsapp.replace(/\D/g, ''),
          message: message.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Mensagem enviada com sucesso!');
      setMessage('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage('');
      setSelectedInstance('');
      onOpenChange(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem direta para o cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{client.name}</p>
              <p className="text-sm text-muted-foreground">{client.whatsapp}</p>
            </div>
          </div>

          {/* Instance Selection */}
          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            {connectedInstances.length === 0 ? (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                Nenhuma instância conectada. Configure uma instância primeiro.
              </div>
            ) : (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.map(instance => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <span>{instance.instance_name}</span>
                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-500">
                          Online
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length} caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !selectedInstance || !message.trim() || connectedInstances.length === 0}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
