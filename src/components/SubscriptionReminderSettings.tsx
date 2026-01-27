import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, MessageSquare, Bell, Clock, Calendar, AlertTriangle, Info } from 'lucide-react';
import { useSubscriptionNotificationSettings, SubscriptionReminderMessages } from '@/hooks/useSubscriptionNotificationSettings';
import { toast } from 'sonner';

const messageVariables = [
  { key: '{nome}', label: 'Nome do usuário' },
  { key: '{plano}', label: 'Nome do plano' },
  { key: '{vencimento}', label: 'Data de vencimento' },
  { key: '{dias}', label: 'Dias restantes' },
];

export function SubscriptionReminderSettings() {
  const { settings, isLoading, isSaving, saveSettings, defaultReminderMessages } = useSubscriptionNotificationSettings();
  
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [messages, setMessages] = useState<SubscriptionReminderMessages>(defaultReminderMessages);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setWhatsappEnabled(settings.whatsapp_enabled);
      setMessages(settings.reminder_messages);
    }
  }, [isLoading, settings]);

  const handleMessageChange = (key: keyof SubscriptionReminderMessages, value: string) => {
    setMessages(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleWhatsappToggle = (checked: boolean) => {
    setWhatsappEnabled(checked);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const success = await saveSettings({
      whatsapp_enabled: whatsappEnabled,
      reminder_messages: messages,
    });
    if (success) {
      setHasChanges(false);
    }
  };

  const insertVariable = (textareaId: string, variable: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + variable + text.substring(end);
      
      const key = textareaId.replace('msg-', '') as keyof SubscriptionReminderMessages;
      handleMessageChange(key, newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const resetToDefault = (key: keyof SubscriptionReminderMessages) => {
    handleMessageChange(key, defaultReminderMessages[key]);
    toast.info('Mensagem restaurada para o padrão');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const reminderConfigs = [
    {
      key: 'threeDays' as const,
      title: '3 dias antes',
      description: 'Enviada 3 dias antes do vencimento',
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      key: 'oneDay' as const,
      title: '1 dia antes',
      description: 'Enviada 1 dia antes do vencimento',
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      key: 'today' as const,
      title: 'No dia',
      description: 'Enviada no dia do vencimento',
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Lembretes de Assinatura</CardTitle>
                <CardDescription>
                  Configure notificações automáticas para quando sua assinatura estiver próxima de expirar
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Notificações via WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Receba lembretes automáticos no seu WhatsApp
                </p>
              </div>
            </div>
            <Switch
              checked={whatsappEnabled}
              onCheckedChange={handleWhatsappToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      {whatsappEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Personalizar Mensagens
            </CardTitle>
            <CardDescription>
              Personalize as mensagens que serão enviadas em cada momento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variables Info */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Variáveis disponíveis</p>
                  <p className="text-xs text-muted-foreground">
                    Clique em uma variável para inserir no texto
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {messageVariables.map((v) => (
                  <Badge 
                    key={v.key} 
                    variant="outline" 
                    className="cursor-default text-xs"
                  >
                    <code className="font-mono">{v.key}</code>
                    <span className="ml-1 text-muted-foreground">= {v.label}</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Message Templates */}
            <div className="space-y-6">
              {reminderConfigs.map((config) => {
                const Icon = config.icon;
                return (
                  <div key={config.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div>
                          <Label className="font-medium">{config.title}</Label>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetToDefault(config.key)}
                        className="text-xs"
                      >
                        Restaurar padrão
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {messageVariables.map((v) => (
                          <Button
                            key={v.key}
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => insertVariable(`msg-${config.key}`, v.key)}
                          >
                            {v.key}
                          </Button>
                        ))}
                      </div>
                      <Textarea
                        id={`msg-${config.key}`}
                        value={messages[config.key]}
                        onChange={(e) => handleMessageChange(config.key, e.target.value)}
                        placeholder="Digite a mensagem..."
                        className="min-h-[100px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {messages[config.key].length} caracteres
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Como funciona?</p>
              <p className="text-sm text-muted-foreground">
                O sistema verifica diariamente as assinaturas próximas do vencimento e envia 
                lembretes automáticos via WhatsApp nos momentos configurados. As mensagens são 
                enviadas para o número de WhatsApp cadastrado no seu perfil.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </div>
      )}
    </div>
  );
}
