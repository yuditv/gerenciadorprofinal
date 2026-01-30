import { useMemo, useState } from 'react';
import { Client, getDaysUntilExpiration, planLabels } from '@/types/client';
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

interface SendWhatsAppDialogProps {
  client: Client | null;
  instances: WhatsAppInstance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendWhatsAppDialog({ client, instances, open, onOpenChange }: SendWhatsAppDialogProps) {
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const connectedInstances = instances.filter(i => i.status === 'connected');

  const templates = useMemo(() => {
    if (!client) return [] as { id: string; label: string; value: string }[];

    const days = getDaysUntilExpiration(client.expiresAt);
    const expiresAtStr = client.expiresAt.toLocaleDateString('pt-BR');
    const planLabel = planLabels[client.plan] ?? client.plan;
    const priceStr = client.price != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.price)
      : '';
    const signatureLine = "\n\n*Responda aqui para renovar.*";

    return [
      {
        id: 'expiring',
        label: 'Aviso: vai expirar',
        value:
          `Olá ${client.name}! Tudo bem? 🙂\n` +
          `Seu plano *${planLabel}* vence em *${expiresAtStr}* (${days} dia(s)).\n` +
          `Posso gerar sua renovação agora para você não ficar sem acesso?` +
          signatureLine,
      },
      {
        id: 'expired',
        label: 'Expirado: renovar agora',
        value:
          `Olá ${client.name}!\n` +
          `Seu acesso *venceu em ${expiresAtStr}*.\n` +
          `Se quiser, eu já faço sua renovação agora pra liberar novamente.` +
          signatureLine,
      },
      {
        id: 'renew_short',
        label: 'Renovação (curta)',
        value:
          `Oi ${client.name}! Sua renovação está disponível. Quer renovar agora?` +
          signatureLine,
      },
      {
        id: 'renew_with_price',
        label: 'Renovação (com valor)',
        value:
          `Olá ${client.name}!\n` +
          `Renovação do plano *${planLabel}*${priceStr ? ` por *${priceStr}*` : ''}.\n` +
          `Quer que eu envie o pagamento para renovar?` +
          signatureLine,
      },
    ];
  }, [client]);

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (tpl) setMessage(tpl.value);
  };

  const handleSend = async () => {
    if (!client || !selectedInstance || !message.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSending(true);

    // UX: clear immediately to feel responsive; restore on failure.
    const messageToSend = message.trim();
    setMessage('');

    try {
      const instance = instances.find(i => i.id === selectedInstance);
      if (!instance?.instance_key) {
        throw new Error('Instância não configurada');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-uazapi', {
        body: {
          instanceKey: instance.instance_key,
          phone: client.whatsapp.replace(/\D/g, ''),
          message: messageToSend,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Mensagem enviada com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Restore what user typed if send failed
      setMessage(prev => prev || messageToSend);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage('');
      setSelectedInstance('');
      setSelectedTemplate('');
      onOpenChange(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
          return;
        }
        onOpenChange(true);
      }}
    >
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

          {/* Templates */}
          <div className="space-y-2">
            <Label>Templates</Label>
            <Select value={selectedTemplate} onValueChange={applyTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
