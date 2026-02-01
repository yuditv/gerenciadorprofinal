import { Bell, BellOff, BellRing, Volume2, VolumeX, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";

export function NotificationSettingsCard() {
  const {
    permission,
    isSupported,
    isEnabled,
    volume,
    setIsEnabled,
    setVolume,
    requestPermission,
    testNotification,
    testUrgentNotification,
  } = useSystemNotifications();

  if (!isSupported) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">Notificações</CardTitle>
          </div>
          <CardDescription>
            Seu navegador não suporta notificações do sistema.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">Permitidas</Badge>;
      case 'denied':
        return <Badge variant="destructive">Bloqueadas</Badge>;
      default:
        return <Badge variant="secondary">Não solicitadas</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notificações do Sistema</CardTitle>
          </div>
          {getPermissionBadge()}
        </div>
        <CardDescription>
          Configure alertas sonoros e notificações na barra do Windows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Request */}
        {permission !== 'granted' && permission !== 'denied' && (
          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Permissão necessária</p>
                <p className="text-xs text-muted-foreground">
                  Clique para permitir notificações do navegador
                </p>
              </div>
            </div>
            <Button onClick={requestPermission} size="sm">
              Permitir
            </Button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">Notificações bloqueadas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Para reativar, clique no ícone de cadeado na barra de endereço e permita notificações.
            </p>
          </div>
        )}

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="notifications-enabled" className="font-medium">
                Notificações ativas
              </Label>
              <p className="text-xs text-muted-foreground">
                Sons e alertas visuais
              </p>
            </div>
          </div>
          <Switch
            id="notifications-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {/* Volume Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {volume === 0 ? (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Volume2 className="h-5 w-5 text-primary" />
            )}
            <div className="flex-1">
              <Label className="font-medium">Volume do som</Label>
              <p className="text-xs text-muted-foreground">
                {Math.round(volume * 100)}%
              </p>
            </div>
          </div>
          <Slider
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            min={0}
            max={1}
            step={0.1}
            disabled={!isEnabled}
            className="w-full"
          />
        </div>

        {/* Test Buttons */}
        <div className="pt-2 border-t">
          <Label className="text-sm font-medium text-muted-foreground mb-3 block">
            Testar notificações
          </Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testNotification}
              disabled={!isEnabled}
              className="flex-1"
            >
              <TestTube2 className="h-4 w-4 mr-2" />
              Som Normal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testUrgentNotification}
              disabled={!isEnabled}
              className="flex-1"
            >
              <BellRing className="h-4 w-4 mr-2" />
              Som Urgente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
