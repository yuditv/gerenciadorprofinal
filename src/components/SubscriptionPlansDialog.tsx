import { useState } from 'react';
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
import { Check, Crown, Sparkles, Zap, MessageSquare, Smartphone, Infinity } from 'lucide-react';
import { SubscriptionPlan, formatCurrencyBRL } from '@/types/subscription';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { PIXPaymentDialog } from '@/components/PIXPaymentDialog';

interface SubscriptionPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Novos planos profissionais
const professionalPlans = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    color: 'from-blue-500 to-blue-600',
    basePrice: 39.90,
    features: {
      dailyDispatches: 200,
      whatsappConnections: 1,
      aiAgents: 0,
    },
    featureList: [
      '200 disparos por dia',
      '1 conexão WhatsApp',
      'Suporte',
      'Atualizações gratuitas',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Sparkles,
    color: 'from-purple-500 to-purple-600',
    basePrice: 79.90,
    isPopular: true,
    features: {
      dailyDispatches: 500,
      whatsappConnections: 3,
      aiAgents: 1,
    },
    featureList: [
      '500 disparos por dia',
      '3 conexões WhatsApp',
      '1 Agente IA',
      'Suporte',
      'Atualizações gratuitas',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    basePrice: 149.90,
    features: {
      dailyDispatches: -1, // ilimitado
      whatsappConnections: -1, // ilimitado
      aiAgents: -1, // ilimitado
    },
    featureList: [
      'Disparos ilimitados',
      'WhatsApp ilimitado',
      'Agentes IA ilimitados',
      'Aquecimento de chips',
      'Suporte',
      'Atualizações gratuitas',
    ],
  },
];

// Opções de duração com desconto
const durationOptions = [
  { months: 1, label: '1 mês', discount: 0 },
  { months: 3, label: '3 meses', discount: 15 },
  { months: 6, label: '6 meses', discount: 25 },
  { months: 12, label: '12 meses', discount: 40 },
];

export function SubscriptionPlansDialog({
  open,
  onOpenChange,
}: SubscriptionPlansDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlanData, setSelectedPlanData] = useState<SubscriptionPlan | null>(null);

  const currentDuration = durationOptions.find(d => d.months === selectedDuration) || durationOptions[0];

  const calculatePrice = (basePrice: number) => {
    const totalWithoutDiscount = basePrice * selectedDuration;
    const discountAmount = totalWithoutDiscount * (currentDuration.discount / 100);
    return totalWithoutDiscount - discountAmount;
  };

  const calculateMonthlyPrice = (basePrice: number) => {
    return calculatePrice(basePrice) / selectedDuration;
  };

  const calculateSavings = (basePrice: number) => {
    const totalWithoutDiscount = basePrice * selectedDuration;
    return totalWithoutDiscount - calculatePrice(basePrice);
  };

  const handleSelect = () => {
    if (selectedPlan) {
      const plan = professionalPlans.find(p => p.id === selectedPlan);
      if (plan) {
        // Criar objeto compatível com SubscriptionPlan
        const planData: SubscriptionPlan = {
          id: `${plan.id}-${selectedDuration}`,
          name: `${plan.name} (${currentDuration.label})`,
          duration_months: selectedDuration,
          price: calculatePrice(plan.basePrice),
          discount_percentage: currentDuration.discount,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSelectedPlanData(planData);
        setShowPayment(true);
        onOpenChange(false);
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto glass-card glass-card-static border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Escolha seu Plano
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Desbloqueie todas as funcionalidades e potencialize seu negócio
            </DialogDescription>
          </DialogHeader>

          {/* Seletor de duração */}
          <div className="flex justify-center gap-2 py-4">
            {durationOptions.map((duration) => (
              <button
                key={duration.months}
                onClick={() => setSelectedDuration(duration.months)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all',
                  selectedDuration === duration.months
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {duration.label}
                {duration.discount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5"
                  >
                    -{duration.discount}%
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            <AnimatePresence>
              {professionalPlans.map((plan, index) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan === plan.id;
                const totalPrice = calculatePrice(plan.basePrice);
                const monthlyPrice = calculateMonthlyPrice(plan.basePrice);
                const savings = calculateSavings(plan.basePrice);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={cn(
                      'relative cursor-pointer rounded-xl border-2 p-5 transition-colors duration-200',
                      'hover:shadow-lg hover:shadow-primary/10',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                        : 'border-border/50 bg-card/50 hover:border-primary/50',
                      plan.isPopular && 'ring-2 ring-amber-500/50'
                    )}
                  >
                    {/* Badge Popular */}
                    {plan.isPopular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Mais Popular
                      </Badge>
                    )}

                    {/* Ícone do plano */}
                    <div className={cn(
                      'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4',
                      plan.color
                    )}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    {/* Nome do plano */}
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {plan.name}
                    </h3>

                    {/* Limites principais */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                        <MessageSquare className="h-3 w-3" />
                        {plan.features.dailyDispatches === -1 ? (
                          <span className="flex items-center gap-0.5">
                            <Infinity className="h-3 w-3" /> disparos
                          </span>
                        ) : (
                          <span>{plan.features.dailyDispatches}/dia</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                        <Smartphone className="h-3 w-3" />
                        {plan.features.whatsappConnections === -1 ? (
                          <span className="flex items-center gap-0.5">
                            <Infinity className="h-3 w-3" /> WhatsApp
                          </span>
                        ) : (
                          <span>{plan.features.whatsappConnections} WhatsApp</span>
                        )}
                      </div>
                    </div>

                    {/* Preço */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">
                          {formatCurrencyBRL(totalPrice)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrencyBRL(monthlyPrice)}/mês
                      </p>
                    </div>

                    {/* Economia */}
                    {savings > 0 && (
                      <p className="text-sm text-green-400 mb-4">
                        Economia de {formatCurrencyBRL(savings)}
                      </p>
                    )}

                    {/* Features */}
                    <ul className="space-y-2 text-sm">
                      {plan.featureList.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Indicador de seleção */}
                    {isSelected && (
                      <motion.div
                        layoutId="selected-indicator"
                        className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
                        initial={false}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Botão de confirmação */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              disabled={!selectedPlan}
              onClick={handleSelect}
              className="min-w-[200px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Zap className="h-5 w-5 mr-2" />
              Continuar com Pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedPlanData && (
        <PIXPaymentDialog
          open={showPayment}
          onOpenChange={setShowPayment}
          plan={selectedPlanData}
        />
      )}
    </>
  );
}
