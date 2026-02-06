import { WhatsAppWarming } from "@/components/WhatsAppWarming";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitAlert } from "@/components/PlanLimitAlert";

export default function WarmChips() {
  const { planType, canAccessChipWarming } = usePlanLimits();
  
  const isBlocked = !canAccessChipWarming();
  const isTrial = planType === 'trial';

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      {/* Premium Header */}
      <motion.div 
        className="flex items-center gap-3 sm:gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0" style={{ 
          background: 'linear-gradient(135deg, hsl(25 95% 55%) 0%, hsl(15 90% 50%) 100%)',
          boxShadow: '0 8px 32px hsl(25 95% 55% / 0.35), 0 0 60px hsl(25 95% 55% / 0.15)'
        }}>
          <Flame className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-gradient">Aquecer Chips</h1>
          <p className="text-muted-foreground text-xs sm:text-base">
            Simule conversas naturais para reduzir risco de banimento
          </p>
        </div>
      </motion.div>

      {/* Blocked Alert */}
      {isBlocked && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PlanLimitAlert 
            type={isTrial ? 'trial_blocked' : 'blocked'}
            feature="Aquecimento de Chips"
            planType={planType}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative"
      >
        {/* Overlay when blocked */}
        {isBlocked && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-xl" />
        )}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Sistema de Aquecimento</CardTitle>
            <CardDescription>
              Configure sessões de aquecimento para manter suas instâncias saudáveis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppWarming />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
