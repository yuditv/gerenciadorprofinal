import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  Clock, 
  Copy, 
  QrCode, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  DollarSign,
  Calendar
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useBotProxy, BotProxyPlan } from '@/hooks/useBotProxy';

interface ClientPixPayment {
  id: string;
  plan_name: string;
  description: string;
  amount: number;
  duration_days: number | null;
  status: string;
  pix_code: string | null;
  pix_qr_code: string | null;
  expires_at: string;
  created_at: string;
}

interface GeneratePIXDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  instanceId: string;
  clientPhone: string;
  clientName?: string;
  onSendMessage: (content: string, isPrivate?: boolean, mediaUrl?: string, mediaType?: string) => Promise<boolean>;
}

export function GeneratePIXDialog({
  open,
  onOpenChange,
  conversationId,
  instanceId,
  clientPhone,
  clientName,
  onSendMessage,
}: GeneratePIXDialogProps) {
  const { plans, isLoading: isLoadingPlans } = useBotProxy();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [useCustomValue, setUseCustomValue] = useState(false);
  const [payment, setPayment] = useState<ClientPixPayment | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPayment(null);
      setSelectedPlanId(null);
      setCustomAmount('');
      setCustomDescription('');
      setUseCustomValue(false);
      setTimeLeft(10 * 60);
    }
  }, [open]);

  // Timer de expiração
  useEffect(() => {
    if (!open || !payment || payment.status === 'paid') return;

    const interval = setInterval(() => {
      if (payment.expires_at) {
        const expiresAt = new Date(payment.expires_at);
        const now = new Date();
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setTimeLeft(diff);
        
        if (diff <= 0) {
          setPayment(prev => prev ? { ...prev, status: 'expired' } : null);
          clearInterval(interval);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [open, payment]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGeneratePIX = async () => {
    if (!selectedPlanId && !useCustomValue) {
      toast({ title: 'Selecione um plano', variant: 'destructive' });
      return;
    }

    if (useCustomValue && (!customAmount || parseFloat(customAmount.replace(',', '.')) <= 0)) {
      toast({ title: 'Digite um valor válido', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const payload: Record<string, unknown> = {
        action: 'create',
        conversationId,
        instanceId,
        clientPhone,
      };

      if (useCustomValue) {
        payload.customAmount = parseFloat(customAmount.replace(',', '.'));
        payload.customDescription = customDescription || 'Pagamento via PIX';
      } else {
        payload.planId = selectedPlanId;
      }

      const { data, error } = await supabase.functions.invoke('generate-client-pix', {
        body: payload
      });

      if (error) throw error;

      setPayment(data.payment);
      setTimeLeft(10 * 60);
    } catch (error) {
      console.error('Erro ao gerar PIX:', error);
      toast({
        title: 'Erro ao gerar PIX',
        description: 'Não foi possível gerar o código PIX. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!payment?.id) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-client-pix', {
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
          description: 'O cliente realizou o pagamento.',
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

  const handleCopyCode = () => {
    const pixCode = payment?.pix_code || '';
    if (!pixCode) return;
    
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast({ title: 'Código copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToClient = async () => {
    if (!payment) return;

    setIsSending(true);
    try {
      // Format message
      const message = `💳 *${payment.plan_name}* - ${formatCurrency(payment.amount)}
${payment.duration_days ? `📅 Válido por ${payment.duration_days} dias` : `📝 ${payment.description}`}

⏰ *Expira em 10 minutos*

📲 Escaneie o QR Code ou use o código abaixo:

\`\`\`
${payment.pix_code}
\`\`\``;

      // Send QR code image first
      if (payment.pix_qr_code) {
        await onSendMessage('', false, payment.pix_qr_code, 'image/png');
      }

      // Then send the text message
      await onSendMessage(message, false);

      toast({
        title: 'PIX enviado!',
        description: 'O código PIX foi enviado para o cliente.',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao enviar PIX:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o PIX para o cliente.',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const isPaid = payment?.status === 'paid';
  const isExpired = timeLeft === 0 || payment?.status === 'expired';
  const activePlans = plans.filter(p => p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {payment ? 'PIX Gerado' : 'Gerar PIX para Cliente'}
          </DialogTitle>
          <DialogDescription>
            {payment 
              ? `${payment.plan_name} - ${formatCurrency(payment.amount)}`
              : clientName || clientPhone
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <AnimatePresence mode="wait">
            {!payment ? (
              // Step 1: Select plan or custom value
              <motion.div
                key="select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {isLoadingPlans ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : activePlans.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label>Selecione o Plano</Label>
                      <RadioGroup
                        value={useCustomValue ? '' : (selectedPlanId || '')}
                        onValueChange={(value) => {
                          setSelectedPlanId(value);
                          setUseCustomValue(false);
                        }}
                      >
                        <ScrollArea className="max-h-48">
                          <div className="space-y-2 pr-2">
                            {activePlans.map((plan) => (
                              <div
                                key={plan.id}
                                className={cn(
                                  "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                  selectedPlanId === plan.id && !useCustomValue
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-muted/50"
                                )}
                                onClick={() => {
                                  setSelectedPlanId(plan.id);
                                  setUseCustomValue(false);
                                }}
                              >
                                <RadioGroupItem value={plan.id} id={plan.id} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{plan.name}</span>
                                    <Badge variant="secondary">
                                      {formatCurrency(plan.price)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Calendar className="h-3 w-3" />
                                    {plan.duration_days} dias
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </RadioGroup>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          ou
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="space-y-3">
                  <div
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      useCustomValue
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => {
                      setUseCustomValue(true);
                      setSelectedPlanId(null);
                    }}
                  >
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Valor Personalizado</span>
                  </div>

                  {useCustomValue && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pl-2"
                    >
                      <div>
                        <Label>Valor (R$)</Label>
                        <Input
                          type="text"
                          placeholder="0,00"
                          value={customAmount}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^\d,]/g, '');
                            setCustomAmount(value);
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Descrição (opcional)</Label>
                        <Textarea
                          placeholder="Ex: Renovação mensal"
                          value={customDescription}
                          onChange={(e) => setCustomDescription(e.target.value)}
                          className="mt-1 resize-none"
                          rows={2}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <Button
                  onClick={handleGeneratePIX}
                  className="w-full"
                  disabled={isCreating || (!selectedPlanId && !useCustomValue)}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando PIX...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Gerar PIX
                    </>
                  )}
                </Button>
              </motion.div>
            ) : isPaid ? (
              // Payment confirmed
              <motion.div
                key="paid"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <p className="text-center text-muted-foreground">
                  Pagamento confirmado com sucesso!
                </p>
                <Button onClick={() => onOpenChange(false)} className="w-full">
                  Fechar
                </Button>
              </motion.div>
            ) : isExpired ? (
              // Payment expired
              <motion.div
                key="expired"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <p className="text-center text-muted-foreground">
                  O código PIX expirou. Gere um novo código.
                </p>
                <Button 
                  onClick={() => setPayment(null)} 
                  className="w-full"
                >
                  Gerar Novo PIX
                </Button>
              </motion.div>
            ) : (
              // Show generated PIX
              <motion.div
                key="generated"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Timer */}
                <div className="flex items-center justify-center gap-2">
                  <Clock className={cn(
                    'h-5 w-5',
                    timeLeft < 120 ? 'text-red-400' : 'text-muted-foreground'
                  )} />
                  <span className={cn(
                    'font-mono text-lg',
                    timeLeft < 120 ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {formatTime(timeLeft)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Expira
                  </Badge>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="w-44 h-44 bg-white rounded-xl p-3 flex items-center justify-center">
                    {payment.pix_qr_code ? (
                      <img 
                        src={payment.pix_qr_code} 
                        alt="QR Code PIX" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <QrCode className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* PIX Code */}
                {payment.pix_code && (
                  <div className="space-y-2">
                    <p className="text-sm text-center text-muted-foreground">
                      Código PIX:
                    </p>
                    <div className="relative">
                      <div className="p-2 bg-muted rounded-lg font-mono text-[10px] break-all text-center pr-12 max-h-16 overflow-hidden">
                        {payment.pix_code.slice(0, 100)}...
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCopyCode}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
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

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCheckStatus}
                    className="flex-1"
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Verificar
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSendToClient}
                    className="flex-1"
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Clique em "Enviar" para mandar o QR Code e código para o cliente
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
