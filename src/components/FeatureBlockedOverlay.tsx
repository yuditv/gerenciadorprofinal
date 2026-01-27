import { motion } from 'framer-motion';
import { Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { SubscriptionPlansDialog } from '@/components/SubscriptionPlansDialog';

interface FeatureBlockedOverlayProps {
  feature: string;
  message?: string;
}

export function FeatureBlockedOverlay({ feature, message }: FeatureBlockedOverlayProps) {
  const [showPlans, setShowPlans] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg"
      >
        <div className="text-center p-6 max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-foreground">
            Funcionalidade Bloqueada
          </h3>
          <p className="text-muted-foreground mb-6">
            {message || `O acesso a "${feature}" está bloqueado. Assine ou renove sua assinatura para desbloquear.`}
          </p>
          <Button 
            onClick={() => setShowPlans(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Zap className="h-4 w-4 mr-2" />
            Assinar Agora
          </Button>
        </div>
      </motion.div>

      <SubscriptionPlansDialog open={showPlans} onOpenChange={setShowPlans} />
    </>
  );
}
