import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { 
  Settings, 
  Clock, 
  MessageSquare, 
  Smartphone, 
  User, 
  Save,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';

interface InstanceSettingsDialogProps {
  instance: WhatsAppInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function InstanceSettingsDialog({ 
  instance, 
  open, 
  onOpenChange,
  onSave 
}: InstanceSettingsDialogProps) {
  const [dailyLimit, setDailyLimit] = useState(200);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
  const [isSaving, setIsSaving] = useState(false);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações da Instância
          </DialogTitle>
          <DialogDescription>
            Ajuste as configurações de {instance.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instance Info Card */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
            <Avatar className="h-14 w-14">
              {instance.profile_picture_url ? (
                <AvatarImage src={instance.profile_picture_url} alt={instance.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10">
                <User className="h-7 w-7 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{instance.name}</h3>
                <Badge 
                  variant={instance.status === 'connected' ? 'default' : 'destructive'}
                  className={instance.status === 'connected' ? 'bg-green-500/15 text-green-500 border-green-500/30' : ''}
                >
                  {instance.status === 'connected' ? (
                    <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
                  ) : (
                    <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
                  )}
                </Badge>
              </div>
              {instance.profile_name && (
                <p className="text-sm text-muted-foreground truncate">{instance.profile_name}</p>
              )}
              {instance.phone_connected && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {instance.phone_connected}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Daily Limit */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="daily-limit">Limite diário de mensagens</Label>
            </div>
            <Input
              id="daily-limit"
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              min={1}
              max={10000}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Limite máximo de mensagens que podem ser enviadas por dia nesta instância.
            </p>
          </div>

          <Separator />

          {/* Business Hours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="business-hours">Horário comercial</Label>
              </div>
              <Switch
                id="business-hours"
                checked={businessHoursEnabled}
                onCheckedChange={setBusinessHoursEnabled}
              />
            </div>
            
            {businessHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-xs">Início</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={businessHoursStart}
                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time" className="text-xs">Fim</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={businessHoursEnd}
                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground pl-6">
              Define o horário de funcionamento para automações e respostas.
            </p>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
