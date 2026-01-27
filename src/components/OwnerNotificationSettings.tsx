import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Phone, Clock, Timer, History, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useOwnerNotifications, type NotificationLog } from '@/hooks/useOwnerNotifications';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EVENT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  'ai_uncertainty': { label: 'IA precisa de ajuda', emoji: '🤔', color: 'bg-yellow-500' },
  'payment_proof': { label: 'Comprovante', emoji: '💰', color: 'bg-green-500' },
  'new_contact': { label: 'Novo cliente', emoji: '👋', color: 'bg-blue-500' },
  'complaint': { label: 'Reclamação', emoji: '⚠️', color: 'bg-red-500' },
  'vip_message': { label: 'Cliente VIP', emoji: '⭐', color: 'bg-purple-500' },
  'long_wait': { label: 'Espera longa', emoji: '⏰', color: 'bg-orange-500' },
};

export function OwnerNotificationSettings() {
  const { settings, isLoading, isSaving, saveSettings, logs, isLoadingLogs, fetchLogs } = useOwnerNotifications();
  const { instances } = useWhatsAppInstances();
  const [showHistory, setShowHistory] = useState(false);
  
  // Local state for text inputs to avoid saving on every keystroke
  const [localPhone, setLocalPhone] = useState('');
  const [localLongWait, setLocalLongWait] = useState('10');
  const [localInterval, setLocalInterval] = useState('5');
  const [localQuietStart, setLocalQuietStart] = useState('22:00');
  const [localQuietEnd, setLocalQuietEnd] = useState('08:00');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Sync local state with settings when loaded
  useEffect(() => {
    if (!isLoading) {
      setLocalPhone(settings.notification_phone || '');
      setLocalLongWait(String(settings.long_wait_minutes || 10));
      setLocalInterval(String(settings.min_interval_minutes || 5));
      setLocalQuietStart(settings.quiet_hours_start || '22:00');
      setLocalQuietEnd(settings.quiet_hours_end || '08:00');
      setHasUnsavedChanges(false);
    }
  }, [isLoading, settings]);

  useEffect(() => {
    if (showHistory) {
      fetchLogs();
    }
  }, [showHistory, fetchLogs]);

  const handleSaveTextFields = async () => {
    await saveSettings({
      notification_phone: localPhone || null,
      long_wait_minutes: parseInt(localLongWait) || 10,
      min_interval_minutes: parseInt(localInterval) || 5,
      quiet_hours_start: localQuietStart,
      quiet_hours_end: localQuietEnd,
    }, true); // Show toast on manual save
    setHasUnsavedChanges(false);
  };

  const handlePhoneChange = (value: string) => {
    setLocalPhone(value);
    setHasUnsavedChanges(true);
  };

  const handleToggleChange = async (key: string, value: boolean) => {
    await saveSettings({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connectedInstances = instances?.filter(i => i.phone_connected) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificações do Dono
          </CardTitle>
          <CardDescription>
            Receba alertas via WhatsApp sobre eventos importantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <Label className="text-base">Ativar notificações via WhatsApp</Label>
                <p className="text-sm text-muted-foreground">Receba alertas no seu celular</p>
              </div>
            </div>
            <Switch
              checked={settings.notify_via_whatsapp}
              onCheckedChange={(checked) => handleToggleChange('notify_via_whatsapp', checked)}
              disabled={isSaving}
            />
          </div>

          {settings.notify_via_whatsapp && (
            <>
              {/* Phone and Instance selection */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notification-phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Número para receber alertas
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="notification-phone"
                      type="tel"
                      placeholder="Ex: 91987654321"
                      value={localPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Seu número do WhatsApp (com DDD)</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Instância para enviar
                  </Label>
                  <Select
                    value={settings.notification_instance_id || 'auto'}
                    onValueChange={(value) => handleToggleChange('notification_instance_id', value === 'auto' ? null : value as any)}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Automático" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔄 Automático (primeira disponível)</SelectItem>
                      {connectedInstances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.instance_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Save button for text inputs */}
              {hasUnsavedChanges && (
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveTextFields}
                    disabled={isSaving}
                    size="sm"
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar número
                  </Button>
                </div>
              )}

              <Separator />

              {/* Event toggles */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Notificar quando:</Label>
                
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🤔</span>
                      <div>
                        <Label>IA não souber responder</Label>
                        <p className="text-xs text-muted-foreground">Quando a IA precisar de ajuda humana</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notify_on_ai_uncertainty}
                      onCheckedChange={(checked) => handleToggleChange('notify_on_ai_uncertainty', checked)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💰</span>
                      <div>
                        <Label>Receber comprovante de pagamento</Label>
                        <p className="text-xs text-muted-foreground">Imagem com palavras como "paguei", "pix"</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notify_on_payment_proof}
                      onCheckedChange={(checked) => handleToggleChange('notify_on_payment_proof', checked)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">👋</span>
                      <div>
                        <Label>Novo cliente entrar em contato</Label>
                        <p className="text-xs text-muted-foreground">Primeiro contato de um número</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notify_on_new_contact}
                      onCheckedChange={(checked) => handleToggleChange('notify_on_new_contact', checked)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <Label>Detectar reclamação</Label>
                        <p className="text-xs text-muted-foreground">Palavras como "problema", "não funciona"</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notify_on_complaint}
                      onCheckedChange={(checked) => handleToggleChange('notify_on_complaint', checked)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⭐</span>
                      <div>
                        <Label>Cliente VIP mandar mensagem</Label>
                        <p className="text-xs text-muted-foreground">Clientes marcados como VIP</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notify_on_vip_message}
                      onCheckedChange={(checked) => handleToggleChange('notify_on_vip_message', checked)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⏰</span>
                      <div>
                        <Label>Cliente esperando muito tempo</Label>
                        <p className="text-xs text-muted-foreground">Após {localLongWait} minutos sem resposta</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        className="w-16"
                        value={localLongWait}
                        onChange={(e) => {
                          setLocalLongWait(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        disabled={!settings.notify_on_long_wait}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                      <Switch
                        checked={settings.notify_on_long_wait}
                        onCheckedChange={(checked) => handleToggleChange('notify_on_long_wait', checked)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Quiet hours and anti-spam */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Horário silencioso</Label>
                      <p className="text-xs text-muted-foreground">Não enviar notificações neste período</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.quiet_hours_enabled}
                    onCheckedChange={(checked) => handleToggleChange('quiet_hours_enabled', checked)}
                    disabled={isSaving}
                  />
                </div>

                {settings.quiet_hours_enabled && (
                  <div className="flex items-center gap-4 pl-10">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Das</Label>
                      <Input
                        type="time"
                        className="w-28"
                        value={localQuietStart}
                        onChange={(e) => {
                          setLocalQuietStart(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">às</Label>
                      <Input
                        type="time"
                        className="w-28"
                        value={localQuietEnd}
                        onChange={(e) => {
                          setLocalQuietEnd(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 p-3 rounded-lg border">
                  <Timer className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label>Intervalo mínimo entre notificações</Label>
                    <p className="text-xs text-muted-foreground">Evita spam do mesmo contato</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      className="w-16"
                      value={localInterval}
                      onChange={(e) => {
                        setLocalInterval(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              </div>

              {/* Save button at bottom */}
              {hasUnsavedChanges && (
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSaveTextFields}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar alterações
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Histórico de Notificações
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchLogs();
              }}
            >
              {showHistory ? 'Ocultar' : 'Ver histórico'}
            </Button>
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma notificação enviada ainda
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {logs.map((log) => {
                    const eventInfo = EVENT_LABELS[log.event_type] || { 
                      label: log.event_type, 
                      emoji: '📢', 
                      color: 'bg-gray-500' 
                    };
                    
                    return (
                      <div 
                        key={log.id} 
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <span className="text-xl">{eventInfo.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {eventInfo.label}
                            </Badge>
                            {log.urgency === 'high' && (
                              <Badge variant="destructive" className="text-xs">Urgente</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-1">
                            {log.contact_name || log.contact_phone}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {log.summary}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}