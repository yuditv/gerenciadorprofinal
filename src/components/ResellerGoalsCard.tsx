import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Target, Users, DollarSign, TrendingUp, Pencil, Trophy, Sparkles } from "lucide-react";
import { useResellerGoals } from "@/hooks/useResellerGoals";
import { formatCurrency } from "@/types/client";

interface ResellerGoalsCardProps {
  currentClients: number;
  currentRevenue: number;
}

export function ResellerGoalsCard({ currentClients, currentRevenue }: ResellerGoalsCardProps) {
  const { goals, isLoading, saveGoals, calculateProgress } = useResellerGoals();
  const [isEditing, setIsEditing] = useState(false);
  const [clientGoal, setClientGoal] = useState(10);
  const [revenueGoal, setRevenueGoal] = useState(5000);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  useEffect(() => {
    if (goals) {
      setClientGoal(goals.clientGoal);
      setRevenueGoal(goals.revenueGoal);
      setPeriod(goals.period);
    }
  }, [goals]);

  const handleSave = async () => {
    const result = await saveGoals(clientGoal, revenueGoal, period);
    if (result) {
      setIsEditing(false);
    }
  };

  const clientProgress = calculateProgress(currentClients, goals?.clientGoal || clientGoal);
  const revenueProgress = calculateProgress(currentRevenue, goals?.revenueGoal || revenueGoal);

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case 'monthly': return 'Mensal';
      case 'quarterly': return 'Trimestral';
      case 'annual': return 'Anual';
      default: return p;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-emerald-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const hasGoals = goals !== null;

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (!hasGoals) {
    return (
      <>
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setIsEditing(true)}>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Defina suas Metas</h3>
              <p className="text-sm text-muted-foreground">
                Configure objetivos de clientes e receita para acompanhar seu progresso
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-2">
              <Sparkles className="h-4 w-4 mr-2" />
              Configurar Metas
            </Button>
          </CardContent>
        </Card>

        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Configurar Metas
              </DialogTitle>
              <DialogDescription>
                Defina seus objetivos de clientes e receita para o período
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Meta de Clientes
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={clientGoal}
                  onChange={(e) => setClientGoal(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Atual: {currentClients} clientes
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Meta de Receita
                </Label>
                <Input
                  type="number"
                  min="100"
                  step="100"
                  value={revenueGoal}
                  onChange={(e) => setRevenueGoal(parseInt(e.target.value) || 100)}
                />
                <p className="text-xs text-muted-foreground">
                  Atual: {formatCurrency(currentRevenue)}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Salvar Metas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Suas Metas</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {getPeriodLabel(goals.period)}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client Goal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Clientes
              </span>
              <span className="font-medium">
                {currentClients} / {goals.clientGoal}
              </span>
            </div>
            <div className="relative">
              <Progress value={clientProgress} className="h-3" />
              {clientProgress >= 100 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                </div>
              )}
            </div>
            <p className="text-xs text-right text-muted-foreground">
              {clientProgress.toFixed(0)}% concluído
            </p>
          </div>

          {/* Revenue Goal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Receita
              </span>
              <span className="font-medium">
                {formatCurrency(currentRevenue)} / {formatCurrency(goals.revenueGoal)}
              </span>
            </div>
            <div className="relative">
              <Progress value={revenueProgress} className="h-3" />
              {revenueProgress >= 100 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                </div>
              )}
            </div>
            <p className="text-xs text-right text-muted-foreground">
              {revenueProgress.toFixed(0)}% concluído
            </p>
          </div>

          {/* Motivation message */}
          {clientProgress >= 100 && revenueProgress >= 100 ? (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                🎉 Parabéns! Você atingiu todas as metas!
              </p>
            </div>
          ) : clientProgress >= 75 || revenueProgress >= 75 ? (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                💪 Quase lá! Continue assim!
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Editar Metas
            </DialogTitle>
            <DialogDescription>
              Ajuste seus objetivos de clientes e receita
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Meta de Clientes
              </Label>
              <Input
                type="number"
                min="1"
                value={clientGoal}
                onChange={(e) => setClientGoal(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Atual: {currentClients} clientes ({calculateProgress(currentClients, clientGoal).toFixed(0)}%)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Meta de Receita
              </Label>
              <Input
                type="number"
                min="100"
                step="100"
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(parseInt(e.target.value) || 100)}
              />
              <p className="text-xs text-muted-foreground">
                Atual: {formatCurrency(currentRevenue)} ({calculateProgress(currentRevenue, revenueGoal).toFixed(0)}%)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Metas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
