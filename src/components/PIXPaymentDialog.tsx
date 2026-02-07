import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  Clock, 
  Copy, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { SubscriptionPlan, SubscriptionPayment, formatCurrencyBRL } from '@/types/subscription';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PIXPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan;
}

export function PIXPaymentDialog({
  open,
  onOpenChange,
  plan,
}: PIXPaymentDialogProps) {
  const { user } = useAuth();
  const [payment, setPayment] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [copied, setCopied] = useState(false);

  // Create payment on open
  useEffect(() => {
    if (open && !payment && !isCreating) {
      createPayment();
    }
  }, [open]);

  // Expiration timer
  useEffect(() => {
    if (!open || payment?.status === 'paid') return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, payment?.status]);

  useEffect(() => {
    if (payment?.expires_at) {
      const expiresAt = new Date(payment.expires_at);
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(diff);
    }
  }, [payment?.expires_at]);

  const createPayment = async () => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('infinitepay-checkout', {
        body: {
          action: 'create',
          planId: plan.id,
          amount: plan.price,
          description: `Assinatura ${plan.name} - GerenciadorPro`
        }
      });

      if (error) throw error;

      setPayment(data.payment);
      setTimeLeft(30 * 60);
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      toast({
        title: 'Erro ao gerar pagamento',
        description: 'Não foi possível gerar o link de pagamento. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!payment?.id) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('infinitepay-checkout', {
        body: {
          action: 'check',
          paymentId: payment.id
        }
      });

      if (error) throw error;

      setPayment(data.payment);
      
      if (data.payment.status === 'paid') {
        toast({
          title: 'Pagamento confirmado!',
          description: 'Sua assinatura foi ativada com sucesso.',
        });
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      toast({
        title: 'Erro ao verificar',
        description: 'Não foi possível verificar o status do pagamento.',
        variant: 'destructive'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    const url = payment?.checkout_url || '';
    if (!url) return;
    
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({
      title: 'Link copiado!',
      description: 'Abra no navegador para pagar.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCheckout = () => {
    if (payment?.checkout_url) {
      window.open(payment.checkout_url, '_blank');
    }
  };

  const handleClose = () => {
    setPayment(null);
    onOpenChange(false);
  };

  const isPaid = payment?.status === 'paid';
  const isExpired = timeLeft === 0 || payment?.status === 'expired';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {isPaid ? 'Pagamento Confirmado!' : 'Pagamento InfinitePay'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isPaid 
              ? 'Sua assinatura foi ativada com sucesso.'
              : `Plano ${plan.name} - ${formatCurrencyBRL(plan.price)}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {isCreating ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Gerando link de pagamento...</p>
            </div>
          ) : isPaid ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <p className="text-center text-muted-foreground">
                Aproveite todos os recursos do sistema!
              </p>
              <Button onClick={handleClose} className="w-full">
                Continuar
              </Button>
            </motion.div>
          ) : isExpired ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <p className="text-center text-muted-foreground">
                O link de pagamento expirou. Gere um novo.
              </p>
              <Button 
                onClick={createPayment} 
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Novo Link'
                )}
              </Button>
            </div>
          ) : payment ? (
            <>
              {/* Timer */}
              <div className="flex items-center justify-center gap-2">
                <Clock className={cn(
                  'h-5 w-5',
                  timeLeft < 300 ? 'text-red-400' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'font-mono text-lg',
                  timeLeft < 300 ? 'text-red-400' : 'text-muted-foreground'
                )}>
                  {formatTime(timeLeft)}
                </span>
                <Badge variant="outline" className="text-xs">
                  Expira
                </Badge>
              </div>

              {/* Open Checkout Button */}
              <Button
                onClick={handleOpenCheckout}
                className="w-full gap-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white"
                size="lg"
              >
                <ExternalLink className="h-5 w-5" />
                Abrir Checkout InfinitePay
              </Button>

              {/* Copy Link */}
              {payment.checkout_url && (
                <div className="space-y-2">
                  <p className="text-sm text-center text-muted-foreground">
                    Ou copie o link de pagamento:
                  </p>
                  <div className="relative">
                    <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all text-center pr-16">
                      {payment.checkout_url.length > 60 
                        ? `${payment.checkout_url.slice(0, 60)}...` 
                        : payment.checkout_url}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Check Status */}
              <Button
                variant="outline"
                onClick={checkPaymentStatus}
                className="w-full"
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verificar Pagamento
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Após pagar, clique em "Verificar Pagamento" para confirmar.
              </p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
