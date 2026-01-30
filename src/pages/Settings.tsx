import { useState } from 'react';
import { ArrowLeft, DollarSign, Palette, Save, Moon, Sun, Monitor, Loader2, Bell, CreditCard, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { usePlanSettings, PlanSetting } from '@/hooks/usePlanSettings';
import { RenewalReminderSettings } from '@/components/RenewalReminderSettings';
import { SubscriptionReminderSettings } from '@/components/SubscriptionReminderSettings';
import { OwnerNotificationSettings } from '@/components/OwnerNotificationSettings';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, isLoading, saveSettings } = usePlanSettings();
  const { theme, setTheme } = useTheme();
  
  const [editedSettings, setEditedSettings] = useState<PlanSetting[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const handlePlanSettingChange = (planKey: string, field: 'planName' | 'planPrice', value: string | number) => {
    const currentSettings = editedSettings.length > 0 ? editedSettings : settings;
    const updated = currentSettings.map(s => 
      s.planKey === planKey 
        ? { ...s, [field]: field === 'planPrice' ? Number(value) : value }
        : s
    );
    setEditedSettings(updated);
    setHasChanges(true);
  };

  const handleSavePlanSettings = async () => {
    if (editedSettings.length === 0) return;
    await saveSettings(editedSettings);
    setHasChanges(false);
    setEditedSettings([]);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    toast.success(
      `Tema alterado para ${newTheme === 'light' ? 'Claro' : newTheme === 'dark' ? 'Escuro' : 'Sistema'}`
    );
  };

  const currentSettings = editedSettings.length > 0 ? editedSettings : settings;

  const planIcons: Record<string, string> = {
    monthly: '📅',
    quarterly: '📆',
    semiannual: '🗓️',
    annual: '🎯',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Personalize o sistema conforme suas necessidades</p>
          </div>
        </div>

        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Planos</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="subscription-reminders" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Assinatura</span>
            </TabsTrigger>
            <TabsTrigger value="owner-notifications" className="flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Aparência</span>
            </TabsTrigger>
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Configurações de Planos
                </CardTitle>
                <CardDescription>
                  Personalize os nomes e preços padrão dos planos oferecidos aos seus clientes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  {currentSettings.map((plan) => (
                    <Card key={plan.planKey} className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>{planIcons[plan.planKey]}</span>
                          {plan.planKey === 'monthly' && 'Plano Mensal'}
                          {plan.planKey === 'quarterly' && 'Plano Trimestral'}
                          {plan.planKey === 'semiannual' && 'Plano Semestral'}
                          {plan.planKey === 'annual' && 'Plano Anual'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`name-${plan.planKey}`}>Nome do Plano</Label>
                          <Input
                            id={`name-${plan.planKey}`}
                            value={plan.planName}
                            onChange={(e) => handlePlanSettingChange(plan.planKey, 'planName', e.target.value)}
                            placeholder="Nome do plano"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`price-${plan.planKey}`}>Preço Padrão (R$)</Label>
                          <Input
                            id={`price-${plan.planKey}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={plan.planPrice}
                            onChange={(e) => handlePlanSettingChange(plan.planKey, 'planPrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {hasChanges && (
                  <div className="flex justify-end">
                    <Button onClick={handleSavePlanSettings} className="gap-2">
                      <Save className="h-4 w-4" />
                      Salvar Alterações
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <RenewalReminderSettings />
          </TabsContent>

          {/* Subscription Reminders Tab */}
          <TabsContent value="subscription-reminders" className="space-y-6">
            <SubscriptionReminderSettings />
          </TabsContent>

          {/* Owner Notifications Tab */}
          <TabsContent value="owner-notifications" className="space-y-6">
            <OwnerNotificationSettings />
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  Aparência
                </CardTitle>
                <CardDescription>
                  Personalize o visual do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Tema</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleThemeChange('light')}
                      className="gap-2"
                    >
                      <Sun className="h-4 w-4" />
                      Claro
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleThemeChange('dark')}
                      className="gap-2"
                    >
                      <Moon className="h-4 w-4" />
                      Escuro
                    </Button>
                    <Button
                      variant={theme === 'system' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleThemeChange('system')}
                      className="gap-2"
                    >
                      <Monitor className="h-4 w-4" />
                      Sistema
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Escolha entre tema claro, escuro ou automático baseado no sistema.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
