import { useState, useEffect } from 'react';
import { Bell, Save, Send, Loader2, Info, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useNotificationSettings, ReminderMessages } from '@/hooks/useNotificationSettings';
import { toast } from 'sonner';

const messageVariables = [
  { key: '{nome}', label: 'Nome do cliente' },
  { key: '{plano}', label: 'Nome do plano' },
  { key: '{vencimento}', label: 'Data de vencimento' },
  { key: '{whatsapp}', label: 'WhatsApp do cliente' },
  { key: '{email}', label: 'E-mail do cliente' },
];

export function RenewalReminderSettings() {
  const { 
    settings, 
    isLoading, 
    isSaving, 
    saveSettings, 
    triggerReminderCheck,
    triggerDispatcher,
    defaultReminderMessages 
  } = useNotificationSettings();
  
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState<number[]>([1, 0, -1]);
  const [messages, setMessages] = useState<ReminderMessages>(defaultReminderMessages);
  const [hasChanges, setHasChanges] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setWhatsappEnabled(settings.whatsapp_reminders_enabled);
      setReminderDays(settings.reminder_days);
      setMessages(settings.reminder_messages);
    }
  }, [settings, isLoading]);

  const handleDayToggle = (day: number) => {
    setReminderDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      return [...prev, day].sort((a, b) => b - a);
    });
    setHasChanges(true);
  };

  const handleMessageChange = (key: keyof ReminderMessages, value: string) => {
    setMessages(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const success = await saveSettings({
      whatsapp_reminders_enabled: whatsappEnabled,
      reminder_days: reminderDays,
      reminder_messages: messages,
    });
    if (success) {
      setHasChanges(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      // First trigger the scheduler to create pending messages
      const schedulerResult = await triggerReminderCheck();
      console.log('Scheduler result:', schedulerResult);
      
      if (schedulerResult?.remindersCreated > 0) {
        // Then trigger the dispatcher to send them
        const dispatcherResult = await triggerDispatcher();
        console.log('Dispatcher result:', dispatcherResult);
        
        toast.success(`${schedulerResult.remindersCreated} lembrete(s) criado(s) e enviado(s)!`);
      } else {
        toast.info('Nenhum cliente com vencimento nos dias configurados foi encontrado.');
      }
    } catch (error) {
      console.error('Error testing reminders:', error);
      toast.error('Erro ao testar lembretes');
    } finally {
      setIsTesting(false);
    }
  };

  const insertVariable = (textareaId: string, variable: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      
      const key = textareaId.replace('message-', '') as keyof ReminderMessages;
      handleMessageChange(key, newValue);
      
      // Focus and set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Lembretes de Renovação via WhatsApp
        </CardTitle>
        <CardDescription>
          Configure mensagens automáticas para clientes antes e após o vencimento do plano.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="space-y-0.5">
            <Label htmlFor="whatsapp-reminders" className="text-base font-medium">
              Ativar lembretes automáticos
            </Label>
            <p className="text-sm text-muted-foreground">
              Envie mensagens automáticas quando os planos estiverem próximos do vencimento
            </p>
          </div>
          <Switch
            id="whatsapp-reminders"
            checked={whatsappEnabled}
            onCheckedChange={(checked) => {
              setWhatsappEnabled(checked);
              setHasChanges(true);
            }}
          />
        </div>

        {whatsappEnabled && (
          <>
            {/* Reminder Days Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Quando enviar lembretes</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={reminderDays.includes(1)}
                    onCheckedChange={() => handleDayToggle(1)}
                  />
                  <div>
                    <p className="font-medium text-sm">1 dia antes</p>
                    <p className="text-xs text-muted-foreground">Lembrete preventivo</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={reminderDays.includes(0)}
                    onCheckedChange={() => handleDayToggle(0)}
                  />
                  <div>
                    <p className="font-medium text-sm">No dia</p>
                    <p className="text-xs text-muted-foreground">Aviso urgente</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={reminderDays.includes(-1)}
                    onCheckedChange={() => handleDayToggle(-1)}
                  />
                  <div>
                    <p className="font-medium text-sm">1 dia após</p>
                    <p className="text-xs text-muted-foreground">Reativação</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Available Variables */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Variáveis disponíveis (clique para inserir)
              </Label>
              <div className="flex flex-wrap gap-2">
                {messageVariables.map((v) => (
                  <Badge 
                    key={v.key} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    title={v.label}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Message Templates */}
            <div className="space-y-4">
              {reminderDays.includes(1) && (
                <div className="space-y-2">
                  <Label htmlFor="message-before" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-chart-4" />
                    Mensagem - 1 dia antes
                  </Label>
                  <Textarea
                    id="message-before"
                    value={messages.before}
                    onChange={(e) => handleMessageChange('before', e.target.value)}
                    placeholder="Digite a mensagem para 1 dia antes do vencimento..."
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-1">
                    {messageVariables.map((v) => (
                      <Badge 
                        key={v.key} 
                        variant="secondary" 
                        className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground"
                        onClick={() => insertVariable('message-before', v.key)}
                      >
                        + {v.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {reminderDays.includes(0) && (
                <div className="space-y-2">
                  <Label htmlFor="message-today" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-chart-3" />
                    Mensagem - No dia do vencimento
                  </Label>
                  <Textarea
                    id="message-today"
                    value={messages.today}
                    onChange={(e) => handleMessageChange('today', e.target.value)}
                    placeholder="Digite a mensagem para o dia do vencimento..."
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-1">
                    {messageVariables.map((v) => (
                      <Badge 
                        key={v.key} 
                        variant="secondary" 
                        className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground"
                        onClick={() => insertVariable('message-today', v.key)}
                      >
                        + {v.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {reminderDays.includes(-1) && (
                <div className="space-y-2">
                  <Label htmlFor="message-after" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-destructive" />
                    Mensagem - 1 dia após vencimento
                  </Label>
                  <Textarea
                    id="message-after"
                    value={messages.after}
                    onChange={(e) => handleMessageChange('after', e.target.value)}
                    placeholder="Digite a mensagem para 1 dia após o vencimento..."
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-1">
                    {messageVariables.map((v) => (
                      <Badge 
                        key={v.key} 
                        variant="secondary" 
                        className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground"
                        onClick={() => insertVariable('message-after', v.key)}
                      >
                        + {v.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary">Como funciona</p>
                  <p className="text-muted-foreground mt-1">
                    O sistema verifica automaticamente a cada hora os clientes com vencimento nos dias configurados 
                    e envia as mensagens via WhatsApp usando suas instâncias conectadas.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </Button>
          )}
          
          {whatsappEnabled && (
            <Button 
              variant="outline" 
              onClick={handleTest} 
              disabled={isTesting}
              className="gap-2"
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Testar Agora
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
