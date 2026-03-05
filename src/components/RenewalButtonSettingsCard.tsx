import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, RefreshCw, Link2, MessageSquare, LayoutDashboard } from 'lucide-react';
import { useRenewalButtonSettings, RenewalButtonSettings } from '@/hooks/useRenewalButtonSettings';
import { Badge } from '@/components/ui/badge';

export function RenewalButtonSettingsCard() {
  const { settings, isLoading, saveSettings } = useRenewalButtonSettings();
  const [form, setForm] = useState<RenewalButtonSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = (field: keyof RenewalButtonSettings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await saveSettings(form);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Botão Renovar
        </CardTitle>
        <CardDescription>
          Configure o comportamento do botão "Renovar" nos cards dos clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Button text */}
        <div className="space-y-2">
          <Label htmlFor="buttonText">Texto do Botão</Label>
          <Input
            id="buttonText"
            value={form.buttonText}
            onChange={(e) => handleChange('buttonText', e.target.value)}
            placeholder="Renovar"
          />
        </div>

        {/* Action type */}
        <div className="space-y-3">
          <Label>Ação ao Clicar</Label>
          <RadioGroup
            value={form.actionType}
            onValueChange={(v) => handleChange('actionType', v)}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
              <RadioGroupItem value="dialog" id="action-dialog" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="action-dialog" className="flex items-center gap-2 cursor-pointer font-medium">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  Diálogo de Renovação
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Exibe o diálogo completo com informações do cliente e confirmação
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
              <RadioGroupItem value="link" id="action-link" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="action-link" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  Abrir Link Personalizado
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Redireciona para um link externo (ex: loja, página de pagamento)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
              <RadioGroupItem value="whatsapp" id="action-whatsapp" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="action-whatsapp" className="flex items-center gap-2 cursor-pointer font-medium">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  Enviar Mensagem WhatsApp
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Abre conversa no WhatsApp com mensagem pré-definida
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Conditional fields */}
        {form.actionType === 'link' && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Label htmlFor="customLink">URL do Link</Label>
            <Input
              id="customLink"
              type="url"
              value={form.customLink}
              onChange={(e) => handleChange('customLink', e.target.value)}
              placeholder="https://sua-loja.com/renovar"
            />
          </div>
        )}

        {form.actionType === 'whatsapp' && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Label htmlFor="whatsappMessage">Mensagem do WhatsApp</Label>
            <Textarea
              id="whatsappMessage"
              value={form.whatsappMessage}
              onChange={(e) => handleChange('whatsappMessage', e.target.value)}
              placeholder="Olá {nome}, seu plano vence em {vencimento}..."
              rows={4}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-xs">{'{nome}'}</Badge>
              <Badge variant="outline" className="text-xs">{'{plano}'}</Badge>
              <Badge variant="outline" className="text-xs">{'{valor}'}</Badge>
              <Badge variant="outline" className="text-xs">{'{vencimento}'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Use as variáveis acima para personalizar a mensagem
            </p>
          </div>
        )}

        {hasChanges && (
          <div className="flex justify-end">
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar Configurações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
