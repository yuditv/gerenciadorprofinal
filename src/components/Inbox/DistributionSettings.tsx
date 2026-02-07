import { useState } from 'react';
import { Shuffle, Users, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDistributionConfig } from '@/hooks/useDistributionConfig';
import { toast } from 'sonner';

export function DistributionSettings() {
  const { config, isLoading, saveConfig } = useDistributionConfig();
  const [saving, setSaving] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await saveConfig({ is_enabled: enabled });
      toast.success(enabled ? 'Distribuição automática ativada' : 'Distribuição automática desativada');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (mode: string) => {
    setSaving(true);
    try {
      await saveConfig({ mode });
      toast.success('Modo atualizado');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleMaxChange = async (val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return;
    setSaving(true);
    try {
      await saveConfig({ max_active_per_agent: num });
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Shuffle className="h-4 w-4 text-primary" />
            Distribuição Automática
          </div>
          <Badge variant={config?.is_enabled ? 'default' : 'outline'} className="text-xs">
            {config?.is_enabled ? 'Ativo' : 'Inativo'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="dist-toggle" className="text-sm">
            Ativar distribuição round-robin
          </Label>
          <Switch
            id="dist-toggle"
            checked={config?.is_enabled || false}
            onCheckedChange={handleToggle}
            disabled={isLoading || saving}
          />
        </div>

        {config?.is_enabled && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Modo de distribuição</Label>
              <Select
                value={config.mode || 'round_robin'}
                onValueChange={handleModeChange}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">
                    <div className="flex items-center gap-2">
                      <Shuffle className="h-3 w-3" />
                      Round Robin
                    </div>
                  </SelectItem>
                  <SelectItem value="least_busy">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Menos Ocupado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Máximo de conversas ativas por atendente
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                defaultValue={config.max_active_per_agent || 10}
                onBlur={e => handleMaxChange(e.target.value)}
                className="w-24"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Novas conversas serão automaticamente atribuídas aos atendentes online, 
              respeitando o limite máximo configurado.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
