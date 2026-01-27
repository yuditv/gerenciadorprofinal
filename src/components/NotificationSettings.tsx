import { useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, BellRing, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function NotificationSettings() {
  const {
    permission,
    isSupported,
    requestPermission,
    scheduleExpirationCheck,
  } = usePushNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success('Notificações ativadas com sucesso!');
        // Test notification
        await scheduleExpirationCheck();
      } else {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
      }
    } catch (error) {
      toast.error('Erro ao ativar notificações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const result = await scheduleExpirationCheck();
      if (result) {
        const total = result.expiringToday.length + result.expiringIn3Days.length + result.expiringIn7Days.length;
        if (total > 0) {
          toast.success(`Verificação concluída! ${total} cliente(s) com planos vencendo.`);
        } else {
          toast.info('Nenhum cliente com plano vencendo nos próximos 7 dias.');
        }
      }
    } catch (error) {
      toast.error('Erro ao verificar vencimentos');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium">Navegador não suportado</p>
              <p className="text-sm text-muted-foreground">
                Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Notificações Push</CardTitle>
              <CardDescription>
                Receba alertas sobre clientes com planos vencendo
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}
            className="flex items-center gap-1"
          >
            {permission === 'granted' ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Ativo
              </>
            ) : permission === 'denied' ? (
              <>
                <XCircle className="h-3 w-3" />
                Bloqueado
              </>
            ) : (
              <>
                <BellOff className="h-3 w-3" />
                Desativado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'granted' ? (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Notificações ativas</p>
                  <p className="text-sm text-muted-foreground">
                    Você receberá alertas para planos vencendo hoje, em 3 e 7 dias
                  </p>
                </div>
              </div>
              <Switch checked={true} disabled />
            </div>
            <Button
              onClick={handleTestNotification}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              {isLoading ? 'Verificando...' : 'Verificar Vencimentos Agora'}
            </Button>
          </>
        ) : permission === 'denied' ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              As notificações foram bloqueadas. Para ativá-las:
            </p>
            <ol className="mt-2 text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Clique no ícone de cadeado na barra de endereços</li>
              <li>Encontre "Notificações" nas permissões</li>
              <li>Altere para "Permitir"</li>
              <li>Recarregue a página</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Ative as notificações para receber alertas sobre:
              </p>
              <ul className="mt-2 text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Planos vencendo hoje
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Planos vencendo em 3 dias
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Planos vencendo em 7 dias
                </li>
              </ul>
            </div>
            <Button
              onClick={handleEnableNotifications}
              disabled={isLoading}
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              {isLoading ? 'Ativando...' : 'Ativar Notificações'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
