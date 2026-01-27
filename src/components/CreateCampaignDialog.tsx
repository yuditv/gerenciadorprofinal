import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Loader2, Info } from "lucide-react";
import { WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { useCampaigns } from "@/hooks/useCampaigns";
import { toast } from "sonner";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: WhatsAppInstance[];
  onRefetch: () => void;
}

export function CreateCampaignDialog({ 
  open, 
  onOpenChange, 
  instances,
  onRefetch 
}: CreateCampaignDialogProps) {
  const { createCampaign } = useCampaigns();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    instanceId: "",
    messageTemplate: "",
    minDelay: "5",
    maxDelay: "12",
    pauseAfter: "50",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.instanceId || !formData.messageTemplate.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    setLoading(true);
    try {
      const result = await createCampaign({
        instance_id: formData.instanceId,
        name: formData.name.trim(),
        message_template: formData.messageTemplate.trim(),
        min_delay_seconds: parseInt(formData.minDelay) || 5,
        max_delay_seconds: parseInt(formData.maxDelay) || 12,
        pause_after_messages: parseInt(formData.pauseAfter) || 50,
      });
      
      if (result) {
        setFormData({
          name: "",
          instanceId: "",
          messageTemplate: "",
          minDelay: "5",
          maxDelay: "12",
          pauseAfter: "50",
        });
        onOpenChange(false);
        onRefetch();
      }
    } finally {
      setLoading(false);
    }
  };

  const previewMessage = formData.messageTemplate
    .replace(/\{\{nome\}\}/g, "João Silva")
    .replace(/\{\{telefone\}\}/g, "11999999999");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Nova Campanha
          </DialogTitle>
          <DialogDescription>
            Configure sua campanha de envio em massa
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha *</Label>
            <Input
              id="name"
              placeholder="Ex: Black Friday 2024"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance">Instância WhatsApp *</Label>
            <Select 
              value={formData.instanceId} 
              onValueChange={(value) => setFormData({ ...formData, instanceId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name} {instance.phone_connected && `(${instance.phone_connected})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              placeholder="Olá {{nome}}, temos uma oferta especial para você!"
              value={formData.messageTemplate}
              onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
              rows={4}
              required
            />
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Variáveis disponíveis:</p>
                <p><code className="bg-background px-1 rounded">{'{{nome}}'}</code> - Nome do contato</p>
                <p><code className="bg-background px-1 rounded">{'{{telefone}}'}</code> - Telefone do contato</p>
              </div>
            </div>
          </div>

          {formData.messageTemplate && (
            <div className="space-y-2">
              <Label>Preview da Mensagem</Label>
              <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minDelay">Delay Mín (s)</Label>
              <Input
                id="minDelay"
                type="number"
                value={formData.minDelay}
                onChange={(e) => setFormData({ ...formData, minDelay: e.target.value })}
                min="3"
                max="60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDelay">Delay Máx (s)</Label>
              <Input
                id="maxDelay"
                type="number"
                value={formData.maxDelay}
                onChange={(e) => setFormData({ ...formData, maxDelay: e.target.value })}
                min="5"
                max="120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pauseAfter">Pausar após</Label>
              <Input
                id="pauseAfter"
                type="number"
                value={formData.pauseAfter}
                onChange={(e) => setFormData({ ...formData, pauseAfter: e.target.value })}
                min="10"
                max="200"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O envio pausará automaticamente após {formData.pauseAfter || 50} mensagens para evitar bloqueios
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Campanha"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
