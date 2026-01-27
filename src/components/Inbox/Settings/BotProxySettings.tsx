import { useState, useEffect } from 'react';
import { Bot, Phone, Tag, Smartphone, Power, Users, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBotProxy } from '@/hooks/useBotProxy';
import { useInboxLabels } from '@/hooks/useInboxLabels';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';

export function BotProxySettings() {
  const { 
    config, 
    sessions, 
    isLoading, 
    isSaving, 
    saveConfig, 
    toggleActive, 
    endSession
  } = useBotProxy();
  const { labels, isLoading: labelsLoading } = useInboxLabels();
  const { instances, isLoading: instancesLoading } = useWhatsAppInstances();

  const [botPhone, setBotPhone] = useState('');
  const [triggerLabelId, setTriggerLabelId] = useState<string>('');
  const [instanceId, setInstanceId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Load config into form
  useEffect(() => {
    if (config) {
      setBotPhone(config.bot_phone || '');
      setTriggerLabelId(config.trigger_label_id || '');
      setInstanceId(config.instance_id || '');
      setIsActive(config.is_active);
    }
  }, [config]);

  const handleSave = async () => {
    if (!botPhone.trim()) {
      return;
    }

    await saveConfig({
      bot_phone: botPhone,
      trigger_label_id: triggerLabelId || null,
      instance_id: instanceId || null,
      is_active: isActive,
    });
  };

  const connectedInstances = instances.filter(i => i.status === 'connected');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Ponte de Bot
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Encaminhe mensagens entre clientes e um bot externo automaticamente
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status da Ponte</CardTitle>
            <Switch
              checked={config?.is_active ?? false}
              onCheckedChange={toggleActive}
              disabled={!config}
            />
          </div>
          <CardDescription>
            {config?.is_active ? (
              <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Power className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Power className="h-3 w-3 mr-1" />
                Inativo
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        {config && sessions.length > 0 && (
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{sessions.length} sessão(ões) ativa(s)</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
          <CardDescription>
            Defina o número do bot e as regras de encaminhamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bot Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="bot-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Número do Bot
            </Label>
            <Input
              id="bot-phone"
              placeholder="5511999998888"
              value={botPhone}
              onChange={(e) => setBotPhone(e.target.value.replace(/\D/g, ''))}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Número do bot externo que receberá as mensagens dos clientes
            </p>
          </div>

          {/* Trigger Label */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Etiqueta de Ativação
            </Label>
            <Select value={triggerLabelId} onValueChange={setTriggerLabelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma etiqueta..." />
              </SelectTrigger>
              <SelectContent>
                {labelsLoading ? (
                  <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                ) : labels.length === 0 ? (
                  <SelectItem value="_empty" disabled>Nenhuma etiqueta criada</SelectItem>
                ) : (
                  labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Conversas com esta etiqueta terão mensagens encaminhadas para o bot
            </p>
          </div>

          {/* WhatsApp Instance */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Instância WhatsApp
            </Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância..." />
              </SelectTrigger>
              <SelectContent>
                {instancesLoading ? (
                  <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                ) : connectedInstances.length === 0 ? (
                  <SelectItem value="_empty" disabled>Nenhuma instância conectada</SelectItem>
                ) : (
                  connectedInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {instance.instance_name}
                        {instance.phone_connected && (
                          <span className="text-muted-foreground text-xs">
                            ({instance.phone_connected})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Instância usada para enviar mensagens ao bot (pode ser diferente da do cliente)
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving || !botPhone.trim()}>
            {isSaving ? 'Salvando...' : config ? 'Atualizar Configuração' : 'Criar Configuração'}
          </Button>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessões Ativas</CardTitle>
            <CardDescription>
              Clientes atualmente conectados ao bot via ponte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="font-mono text-sm">{session.client_phone}</p>
                      <p className="text-xs text-muted-foreground">
                        Última atividade: {new Date(session.last_activity_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => endSession(session.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Configure o número do bot externo acima</p>
          <p>2. Selecione uma etiqueta que ativará a ponte (ex: "🤖 Bot")</p>
          <p>3. Quando você adicionar essa etiqueta em uma conversa, as mensagens serão encaminhadas automaticamente</p>
          <p>4. O bot responde → você recebe → sistema encaminha para o cliente</p>
          <p>5. Para desativar, remova a etiqueta da conversa</p>
        </CardContent>
      </Card>
    </div>
  );
}
