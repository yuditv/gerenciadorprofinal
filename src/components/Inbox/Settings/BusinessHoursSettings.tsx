import { useState, useEffect } from "react";
import { Clock, Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InstanceHours {
  id: string;
  instance_name: string;
  business_hours_start: string;
  business_hours_end: string;
  auto_reply_enabled?: boolean;
  auto_reply_message?: string;
}

export function BusinessHoursSettings() {
  const { instances, refetch } = useWhatsAppInstances();
  const { toast } = useToast();
  const [instanceHours, setInstanceHours] = useState<InstanceHours[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setInstanceHours(
      instances.map(inst => ({
        id: inst.id,
        instance_name: inst.instance_name || inst.name || "Instância",
        business_hours_start: inst.business_hours_start || "08:00",
        business_hours_end: inst.business_hours_end || "18:00",
        auto_reply_enabled: false,
        auto_reply_message: "Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve!"
      }))
    );
  }, [instances]);

  const handleSave = async (instanceId: string) => {
    const hours = instanceHours.find(h => h.id === instanceId);
    if (!hours) return;

    setSaving(prev => ({ ...prev, [instanceId]: true }));

    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          business_hours_start: hours.business_hours_start,
          business_hours_end: hours.business_hours_end,
        })
        .eq("id", instanceId);

      if (error) throw error;

      toast({ title: "Horário comercial atualizado!" });
      refetch();
    } catch (error) {
      console.error("Error saving business hours:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const updateHours = (instanceId: string, field: keyof InstanceHours, value: string | boolean) => {
    setInstanceHours(prev =>
      prev.map(h =>
        h.id === instanceId ? { ...h, [field]: value } : h
      )
    );
  };

  const isWithinBusinessHours = (start: string, end: string): boolean => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes;

    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime < endTime;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Horário Comercial</h2>
        <p className="text-muted-foreground">
          Configure o horário de funcionamento por instância do WhatsApp.
          Automações podem ser disparadas no início e fim do expediente.
        </p>
      </div>

      {instanceHours.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhuma instância encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma instância do WhatsApp primeiro
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {instanceHours.map((hours) => {
            const isOpen = isWithinBusinessHours(hours.business_hours_start, hours.business_hours_end);

            return (
              <Card key={hours.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {hours.instance_name}
                    </CardTitle>
                    <Badge variant={isOpen ? "default" : "secondary"}>
                      {isOpen ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aberto
                        </>
                      ) : (
                        "Fechado"
                      )}
                    </Badge>
                  </div>
                  <CardDescription>
                    Horário atual: {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Início do Expediente</Label>
                      <Input
                        type="time"
                        value={hours.business_hours_start}
                        onChange={(e) => updateHours(hours.id, "business_hours_start", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim do Expediente</Label>
                      <Input
                        type="time"
                        value={hours.business_hours_end}
                        onChange={(e) => updateHours(hours.id, "business_hours_end", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Resposta automática fora do horário</Label>
                      <p className="text-xs text-muted-foreground">
                        Envia mensagem automática quando receber contato fora do expediente
                      </p>
                    </div>
                    <Switch
                      checked={hours.auto_reply_enabled || false}
                      onCheckedChange={(checked) => updateHours(hours.id, "auto_reply_enabled", checked)}
                    />
                  </div>

                  {hours.auto_reply_enabled && (
                    <div className="space-y-2">
                      <Label>Mensagem de resposta automática</Label>
                      <Input
                        placeholder="Olá! Estamos fora do horário de atendimento..."
                        value={hours.auto_reply_message || ""}
                        onChange={(e) => updateHours(hours.id, "auto_reply_message", e.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleSave(hours.id)}
                      disabled={saving[hours.id]}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving[hours.id] ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info about automation triggers */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">Gatilhos de Automação</h4>
              <p className="text-sm text-muted-foreground">
                Com o horário comercial configurado, você pode criar regras de automação que
                são disparadas no início e fim do expediente. Por exemplo:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                <li>Desativar IA fora do horário comercial</li>
                <li>Enviar mensagem de boas-vindas no início do expediente</li>
                <li>Resolver conversas pendentes no fim do dia</li>
                <li>Notificar equipe sobre conversas não resolvidas</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
