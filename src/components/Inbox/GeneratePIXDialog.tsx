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
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  DollarSign,
  Calendar,
  ExternalLink,
  QrCode,
  CreditCard,
  ArrowLeft,
  Smartphone,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useBotProxy } from '@/hooks/useBotProxy';
import pixQrCode from '@/assets/pix-qrcode.png';

const PIX_KEY = '91980910280';
const PIX_KEY_FORMATTED = '(91) 98091-0280';
const PIX_QRCODE_PUBLIC_URL = 'https://tgprvcodlwyfxjbxirgh.supabase.co/storage/v1/object/public/lovable-uploads/lovable_1770450883470_c86cf8a1.png';

type PaymentMethod = 'pix' | 'card' | null;

interface ClientPixPayment {
  id: string;
  plan_name: string;
  description: string;
  amount: number;
  duration_days: number | null;
  status: string;
  checkout_url: string | null;
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [payment, setPayment] = useState<ClientPixPayment | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [copied, setCopied] = useState(false);

  // Derived state for selected plan info
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const resolvedAmount = useCustomValue 
    ? parseFloat(customAmount.replace(',', '.')) || 0 
    : (selectedPlan?.price || 0);
  const resolvedPlanName = useCustomValue 
    ? 'Valor Personalizado' 
    : (selectedPlan?.name || '');
  const resolvedDescription = useCustomValue 
    ? (customDescription || 'Pagamento') 
    : `Pagamento - ${selectedPlan?.name || ''}`;
  const resolvedDurationDays = useCustomValue ? null : (selectedPlan?.duration_days || null);

  useEffect(() => {
    if (open) {
      setPayment(null);
      setSelectedPlanId(null);
      setCustomAmount('');
      setCustomDescription('');
      setUseCustomValue(false);
      setPaymentMethod(null);
      setTimeLeft(30 * 60);
    }
  }, [open]);

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
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasValidSelection = selectedPlanId || (useCustomValue && resolvedAmount > 0);

  // ── PIX Manual: send QR code + message ──
  const handleSendPIX = async () => {
    if (!hasValidSelection) return;

    setIsSending(true);
    try {
      const amountStr = formatCurrency(resolvedAmount);
      const durationStr = resolvedDurationDays ? `\n📅 Válido por ${resolvedDurationDays} dias` : '';

      const message = `💰 *${resolvedPlanName}* - ${amountStr}${durationStr}

📲 *Pague via PIX:*

📱 Chave PIX (Celular): *${PIX_KEY_FORMATTED}*

_Escaneie o QR Code acima ou copie a chave PIX para realizar o pagamento._

⚠️ Após o pagamento, envie o comprovante aqui.`;

      // Send QR code image first
      await onSendMessage('', false, PIX_QRCODE_PUBLIC_URL, 'image/png');
      // Then send the text message
      await onSendMessage(message, false);

      toast({
        title: 'PIX enviado!',
        description: 'QR Code e chave PIX enviados para o cliente.',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao enviar PIX:', error);
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // ── Card: generate InfinitePay checkout ──
  const handleGenerateCard = async () => {
    if (!hasValidSelection) return;

    setIsCreating(true);
    try {
      const payload = {
        client_phone: clientPhone,
        plan_name: resolvedPlanName,
        amount: resolvedAmount,
        duration_days: resolvedDurationDays,
        description: resolvedDescription,
        conversation_id: conversationId,
        instance_id: instanceId,
      };

      const { data, error } = await supabase.functions.invoke('generate-client-pix-v2', {
        body: payload
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar cobrança');

      setPayment({
        id: data.payment.id,
        plan_name: resolvedPlanName,
        description: resolvedDescription,
        amount: data.payment.amount,
        duration_days: resolvedDurationDays,
        status: 'pending',
        checkout_url: data.payment.checkout_url,
        expires_at: data.payment.expires_at,
        created_at: new Date().toISOString(),
      });
      setTimeLeft(30 * 60);
    } catch (error) {
      console.error('Erro ao gerar cobrança:', error);
      toast({
        title: 'Erro ao gerar cobrança',
        description: 'Não foi possível gerar o link de pagamento. Tente novamente.',
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
      const { data, error } = await supabase.functions.invoke('infinitepay-checkout', {
        body: { action: 'check', paymentId: payment.id }
      });

      if (error) throw error;
      setPayment(data.payment);
      
      if (data.payment.status === 'paid') {
        toast({ title: 'Pagamento confirmado!', description: 'O cliente realizou o pagamento.' });
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      toast({ title: 'Erro ao verificar', variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleCopyLink = () => {
    const url = payment?.checkout_url || '';
    if (!url) return;
    
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    toast({ title: 'Chave PIX copiada!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendCardLink = async () => {
    if (!payment) return;

    setIsSending(true);
    try {
      const message = `💳 *${payment.plan_name}* - ${formatCurrency(payment.amount)}
${payment.duration_days ? `📅 Válido por ${payment.duration_days} dias` : `📝 ${payment.description}`}

⏰ *Expira em 30 minutos*

🔗 *Link de pagamento:*
${payment.checkout_url}

_Clique no link acima para pagar via cartão de crédito._`;

      await onSendMessage(message, false);

      toast({
        title: 'Link enviado!',
        description: 'O link de pagamento foi enviado para o cliente.',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao enviar link:', error);
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const isPaid = payment?.status === 'paid';
  const isExpired = timeLeft === 0 || payment?.status === 'expired';
  const activePlans = plans.filter(p => p.is_active);

  // Step logic: 
  // 1. Select plan/amount
  // 2. Choose payment method (PIX or Card)
  // 3. For PIX: preview + send | For Card: generate checkout link
  const currentStep = payment 
    ? 'card-result' 
    : paymentMethod === 'pix' 
      ? 'pix-preview' 
      : paymentMethod === 'card' 
        ? 'card-generating' 
        : hasValidSelection 
          ? 'choose-method' 
          : 'select-plan';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5 text-primary" />
            {payment ? 'Cobrança Gerada' : paymentMethod === 'pix' ? 'PIX Manual' : 'Gerar Cobrança'}
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
            {/* ── Step 1: Select Plan/Amount ── */}
            {currentStep === 'select-plan' && (
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
                                    <Badge variant="secondary">{formatCurrency(plan.price)}</Badge>
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
                        <span className="bg-background px-2 text-muted-foreground">ou</span>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="space-y-3">
                  <div
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      useCustomValue ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => { setUseCustomValue(true); setSelectedPlanId(null); }}
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
                          onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d,]/g, ''))}
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
              </motion.div>
            )}

            {/* ── Step 2: Choose Payment Method ── */}
            {currentStep === 'choose-method' && (
              <motion.div
                key="method"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <p className="font-medium">{resolvedPlanName}</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(resolvedAmount)}</p>
                  {resolvedDurationDays && (
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {resolvedDurationDays} dias
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* PIX Option */}
                    <button
                      onClick={() => setPaymentMethod('pix')}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                        "hover:border-green-500/50 hover:bg-green-500/5",
                        "border-border cursor-pointer"
                      )}
                    >
                      <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <QrCode className="h-6 w-6 text-green-500" />
                      </div>
                      <span className="font-medium text-sm">PIX</span>
                      <span className="text-[10px] text-muted-foreground text-center">QR Code + Chave</span>
                    </button>

                    {/* Card Option */}
                    <button
                      onClick={() => {
                        setPaymentMethod('card');
                        // Auto-start card generation
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                        "hover:border-blue-500/50 hover:bg-blue-500/5",
                        "border-border cursor-pointer"
                      )}
                    >
                      <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-blue-500" />
                      </div>
                      <span className="font-medium text-sm">Cartão</span>
                      <span className="text-[10px] text-muted-foreground text-center">Link InfinitePay</span>
                    </button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPaymentMethod(null);
                    // Go back: if custom, keep custom; if plan, keep plan but allow re-selection
                  }}
                  className="w-full text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </motion.div>
            )}

            {/* ── PIX Preview: Show QR Code + Send ── */}
            {currentStep === 'pix-preview' && (
              <motion.div
                key="pix"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <p className="font-medium">{resolvedPlanName}</p>
                  <p className="text-2xl font-bold text-green-500">{formatCurrency(resolvedAmount)}</p>
                </div>

                {/* QR Code Preview */}
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-border/50">
                    <img 
                      src={pixQrCode} 
                      alt="QR Code PIX" 
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  
                  {/* PIX Key */}
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2.5 w-full">
                    <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Chave PIX (Celular)</p>
                      <p className="font-mono font-medium text-sm">{PIX_KEY_FORMATTED}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyPixKey}
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    onClick={handleSendPIX}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar PIX para o Cliente
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    O QR Code e a chave PIX serão enviados na conversa
                  </p>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaymentMethod(null)}
                    className="w-full text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Card Generating: InfinitePay Checkout ── */}
            {currentStep === 'card-generating' && (
              <motion.div
                key="card-gen"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <p className="font-medium">{resolvedPlanName}</p>
                  <p className="text-2xl font-bold text-blue-500">{formatCurrency(resolvedAmount)}</p>
                </div>

                <Button
                  onClick={handleGenerateCard}
                  className="w-full"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando link...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Gerar Link de Cartão
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaymentMethod(null)}
                  className="w-full text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </motion.div>
            )}

            {/* ── Card Result: Show checkout link ── */}
            {currentStep === 'card-result' && payment && (
              <>
                {isPaid ? (
                  <motion.div
                    key="paid"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                    <p className="text-center text-muted-foreground">Pagamento confirmado com sucesso!</p>
                    <Button onClick={() => onOpenChange(false)} className="w-full">Fechar</Button>
                  </motion.div>
                ) : isExpired ? (
                  <motion.div
                    key="expired"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <p className="text-center text-muted-foreground">O link expirou. Gere uma nova cobrança.</p>
                    <Button onClick={() => { setPayment(null); setPaymentMethod(null); }} className="w-full">
                      Gerar Nova Cobrança
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="generated"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {/* Timer */}
                    <div className="flex items-center justify-center gap-2">
                      <Clock className={cn('h-5 w-5', timeLeft < 120 ? 'text-red-400' : 'text-muted-foreground')} />
                      <span className={cn('font-mono text-lg', timeLeft < 120 ? 'text-red-400' : 'text-muted-foreground')}>
                        {formatTime(timeLeft)}
                      </span>
                      <Badge variant="outline" className="text-xs">Expira</Badge>
                    </div>

                    {/* Checkout Link */}
                    {payment.checkout_url && (
                      <div className="space-y-2">
                        <p className="text-sm text-center text-muted-foreground">Link de pagamento:</p>
                        <div className="relative">
                          <div className="p-2 bg-muted rounded-lg font-mono text-[10px] break-all text-center pr-12 max-h-16 overflow-hidden">
                            {payment.checkout_url.slice(0, 80)}...
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCopyLink}
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                          >
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
                        onClick={handleSendCardLink}
                        className="flex-1"
                        disabled={isSending}
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            Enviar Link
                          </>
                        )}
                      </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                      Clique em "Enviar Link" para mandar o link de pagamento para o cliente
                    </p>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
