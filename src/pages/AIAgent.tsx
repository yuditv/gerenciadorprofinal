import { Bot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIAgentAdmin } from "@/components/AIAgentAdmin";
import { AIAgentChat } from "@/components/AIAgentChat";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitAlert } from "@/components/PlanLimitAlert";
import { motion } from "framer-motion";

export default function AIAgent() {
  const { planType, canAccessAIAgent, isLoading } = usePlanLimits();
  
  const isBlocked = !canAccessAIAgent();
  const isTrial = planType === 'trial';

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Blocked Alert */}
      {isBlocked && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PlanLimitAlert 
            type={isTrial ? 'trial_blocked' : 'blocked'}
            feature="Agente IA"
            planType={planType}
          />
        </motion.div>
      )}

      {/* Premium Header */}
      <motion.div 
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="p-3 rounded-2xl" style={{
          background: 'linear-gradient(135deg, hsl(260 85% 60%) 0%, hsl(280 80% 55%) 100%)',
          boxShadow: '0 8px 32px hsl(260 85% 60% / 0.35), 0 0 60px hsl(260 85% 60% / 0.15)'
        }}>
          <Bot className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gradient">Agente IA</h1>
          <p className="text-muted-foreground">
            Configure e gerencie seus agentes de IA para automatizar conversas
          </p>
        </div>
      </motion.div>

      {/* Main Content with Overlay */}
      <div className="relative">
        {/* Blocked Overlay */}
        {isBlocked && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 rounded-xl" />
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Tabs defaultValue="manage" className="space-y-6">
            <TabsList>
              <TabsTrigger value="manage" className="gap-2">
                <Bot className="h-4 w-4" />
                Meus Agentes
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <Bot className="h-4 w-4" />
                Testar Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manage">
              <AIAgentAdmin />
            </TabsContent>

            <TabsContent value="chat">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Testar Agente</CardTitle>
                  <CardDescription>
                    Teste a conversa com seus agentes configurados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AIAgentChat />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
