import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionPlansDialog } from '@/components/SubscriptionPlansDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export function SubscriptionBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const { subscription, isLoading } = useSubscription();
  const { isAdmin } = useUserPermissions();

  // Admins não veem banner de assinatura
  if (isAdmin) return null;

  if (isLoading || !subscription) return null;

  const { status, trial_ends_at, current_period_end } = subscription;
  
  // Calculate days remaining
  const endDate = status === 'trial' ? trial_ends_at : current_period_end;
  if (!endDate && status !== 'expired') return null;
  
  const daysRemaining = endDate 
    ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Determine banner status
  let bannerStatus: 'trial' | 'expiring' | 'expired' | null = null;
  
  if (status === 'expired') {
    bannerStatus = 'expired';
  } else if (status === 'trial') {
    if (daysRemaining <= 0) {
      bannerStatus = 'expired';
    } else if (daysRemaining <= 3) {
      bannerStatus = 'expiring';
    } else if (daysRemaining <= 7) {
      bannerStatus = 'trial';
    }
  } else if (status === 'active' && daysRemaining <= 7 && daysRemaining > 0) {
    bannerStatus = 'expiring';
  }

  if (!bannerStatus || (dismissed && bannerStatus !== 'expired')) return null;

  const config = {
    trial: {
      icon: Clock,
      title: 'Período de Teste',
      message: `Você tem ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} restantes no seu trial gratuito.`,
      bgClass: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
      iconClass: 'text-blue-400',
      showDismiss: true,
    },
    expiring: {
      icon: AlertTriangle,
      title: 'Assinatura Expirando!',
      message: `Sua assinatura expira em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}. Renove agora para não perder acesso.`,
      bgClass: 'from-yellow-500/20 to-orange-500/10 border-yellow-500/30',
      iconClass: 'text-yellow-400',
      showDismiss: true,
    },
    expired: {
      icon: Zap,
      title: 'Assinatura Expirada',
      message: 'Seu período de teste expirou. Assine para desbloquear todas as funcionalidades.',
      bgClass: 'from-red-500/20 to-red-600/10 border-red-500/30',
      iconClass: 'text-red-400',
      showDismiss: false,
    },
  };

  const { icon: Icon, title, message, bgClass, iconClass, showDismiss } = config[bannerStatus];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'fixed top-0 left-20 right-0 z-50 overflow-hidden border-b bg-gradient-to-r p-3',
          bgClass
        )}
      >
        {/* Efeito de brilho */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        
        <div className="relative flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-background/50', iconClass)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm">{title}</h4>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowPlans(true)}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Zap className="h-3 w-3 mr-1" />
              Assinar Agora
            </Button>
            
            {showDismiss && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDismissed(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <SubscriptionPlansDialog 
        open={showPlans} 
        onOpenChange={setShowPlans} 
      />
    </>
  );
}
