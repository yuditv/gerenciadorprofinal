import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InstanceSettingsGeneralTab } from '@/components/InstanceSettings/InstanceSettingsGeneralTab';
import { InstanceSettingsUazapiTab } from '@/components/InstanceSettings/InstanceSettingsUazapiTab';
import { InstanceSettingsPrivacyTab } from '@/components/InstanceSettings/InstanceSettingsPrivacyTab';
import { 
  Settings, 
  Smartphone, 
  User, 
  Wifi,
  WifiOff,
} from 'lucide-react';

interface InstanceSettingsDialogProps {
  instance: WhatsAppInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
  initialTab?: 'general' | 'instance' | 'privacy';
}

export function InstanceSettingsDialog({ 
  instance, 
  open, 
  onOpenChange,
  onSave,
  initialTab = 'general',
}: InstanceSettingsDialogProps) {
  const [dailyLimit, setDailyLimit] = useState(200);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<'general' | 'instance' | 'privacy'>(initialTab);

  useEffect(() => {
    if (instance) {
      setDailyLimit(instance.daily_limit || 200);
      setBusinessHoursStart(instance.business_hours_start?.slice(0, 5) || '08:00');
      setBusinessHoursEnd(instance.business_hours_end?.slice(0, 5) || '18:00');
      // Check if business hours are different from defaults to determine if enabled
      setBusinessHoursEnabled(
        instance.business_hours_start !== '08:00:00' || 
        instance.business_hours_end !== '18:00:00'
      );
    }
  }, [instance]);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const handleSave = async () => {
    if (!instance) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          daily_limit: dailyLimit,
          business_hours_start: businessHoursEnabled ? `${businessHoursStart}:00` : '08:00:00',
          business_hours_end: businessHoursEnabled ? `${businessHoursEnd}:00` : '18:00:00',
        })
        .eq('id', instance.id);

      if (error) throw error;

      toast.success('Configurações salvas com sucesso!');
      onSave?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving instance settings:', error);
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings className="h-5 w-5 shrink-0" />
            Configurações da Instância
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Ajuste as configurações de {instance.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 sm:space-y-6">
          {/* Instance Info Card */}
          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/50 border">
            <Avatar className="h-10 w-10 sm:h-14 sm:w-14 shrink-0">
              {instance.profile_picture_url ? (
                <AvatarImage src={instance.profile_picture_url} alt={instance.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10">
                <User className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate text-sm sm:text-base">{instance.name}</h3>
                <Badge 
                  variant={instance.status === 'connected' ? 'default' : 'destructive'}
                  className={instance.status === 'connected' ? 'bg-green-500/15 text-green-500 border-green-500/30 text-xs' : 'text-xs'}
                >
                  {instance.status === 'connected' ? (
                    <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
                  ) : (
                    <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
                  )}
                </Badge>
              </div>
              {instance.profile_name && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{instance.profile_name}</p>
              )}
              {instance.phone_connected && (
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {instance.phone_connected}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="general" className="text-xs sm:text-sm">Geral</TabsTrigger>
              <TabsTrigger value="instance" className="text-xs sm:text-sm">Instância</TabsTrigger>
              <TabsTrigger value="privacy" className="text-xs sm:text-sm">Privacidade</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <InstanceSettingsGeneralTab
                dailyLimit={dailyLimit}
                setDailyLimit={setDailyLimit}
                businessHoursEnabled={businessHoursEnabled}
                setBusinessHoursEnabled={setBusinessHoursEnabled}
                businessHoursStart={businessHoursStart}
                setBusinessHoursStart={setBusinessHoursStart}
                businessHoursEnd={businessHoursEnd}
                setBusinessHoursEnd={setBusinessHoursEnd}
                isSaving={isSaving}
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="instance">
              <InstanceSettingsUazapiTab instance={instance} onSaved={onSave} />
            </TabsContent>

            <TabsContent value="privacy">
              <InstanceSettingsPrivacyTab instanceId={instance.id} active={tab === 'privacy'} />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
