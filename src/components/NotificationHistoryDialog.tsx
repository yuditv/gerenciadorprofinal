import { useState, useEffect } from 'react';
import { Client } from '@/types/client';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationRecord {
  id: string;
  notification_type: string;
  subject: string;
  status: string;
  days_until_expiration: number | null;
  created_at: string;
}

interface NotificationHistoryDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationHistoryDialog({ client, open, onOpenChange }: NotificationHistoryDialogProps) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && client) {
      fetchNotifications();
    }
  }, [open, client]);

  const fetchNotifications = async () => {
    if (!client) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_history')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Histórico de Notificações
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{client.name}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma notificação enviada</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {notification.status === 'sent' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={notification.notification_type === 'email' ? 'default' : 'secondary'}>
                        {notification.notification_type === 'email' ? 'Email' : 'WhatsApp'}
                      </Badge>
                    </div>
                    {notification.days_until_expiration !== null && (
                      <Badge variant="outline" className="text-xs">
                        {notification.days_until_expiration < 0 
                          ? `${Math.abs(notification.days_until_expiration)}d expirado`
                          : notification.days_until_expiration === 0
                          ? 'Vence hoje'
                          : `${notification.days_until_expiration}d para vencer`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">
                    {notification.subject}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(notification.created_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
