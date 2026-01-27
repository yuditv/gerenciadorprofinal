import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  Award,
  Calculator,
} from "lucide-react";
import { Reseller } from "@/components/ResellerManagement";
import type { Client } from "@/types/client";

interface CommissionReportProps {
  resellers: Reseller[];
  clients: Client[];
  planPrices: Record<string, number>;
}

interface ResellerCommission {
  reseller: Reseller;
  clientsCount: number;
  totalSales: number;
  commission: number;
  goalProgress: number;
}

const planDurations: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function CommissionReport({ resellers, clients, planPrices }: CommissionReportProps) {
  const commissionData = useMemo((): ResellerCommission[] => {
    return resellers.map((reseller) => {
      // Simular clientes por revendedor (baseado no clientsCount do reseller)
      // Em produção, os clientes teriam um resellerId para associação
      const resellerClients = reseller.clientsCount;
      
      // Calcular vendas totais (usando o totalRevenue do reseller ou estimativa)
      const totalSales = reseller.totalRevenue || (resellerClients * (planPrices.monthly || 99.90));
      
      // Calcular comissão baseada na taxa do revendedor
      const commission = totalSales * (reseller.commissionRate / 100);
      
      // Calcular progresso da meta
      const goalProgress = reseller.revenueGoal > 0 
        ? Math.min((totalSales / reseller.revenueGoal) * 100, 100)
        : 0;
      
      return {
        reseller,
        clientsCount: resellerClients,
        totalSales,
        commission,
        goalProgress,
      };
    });
  }, [resellers, planPrices]);

  const totals = useMemo(() => {
    return commissionData.reduce(
      (acc, item) => ({
        totalClients: acc.totalClients + item.clientsCount,
        totalSales: acc.totalSales + item.totalSales,
        totalCommissions: acc.totalCommissions + item.commission,
      }),
      { totalClients: 0, totalSales: 0, totalCommissions: 0 }
    );
  }, [commissionData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const activeResellers = resellers.filter((r) => r.isActive);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revendedores Ativos</p>
                <p className="text-2xl font-bold text-blue-600">{activeResellers.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Vendas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalSales)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Comissões</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(totals.totalCommissions)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Totais</p>
                <p className="text-2xl font-bold text-orange-600">{totals.totalClients}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Relatório de Comissões por Revendedor</CardTitle>
          </div>
          <CardDescription>
            Cálculo automático baseado nas vendas realizadas e taxa de comissão configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resellers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum revendedor cadastrado</p>
              <p className="text-sm">Cadastre revendedores para ver o relatório de comissões</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Revendedor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Clientes</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="w-[200px]">Progresso Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionData.map((item) => (
                    <TableRow key={item.reseller.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.reseller.name}</p>
                          <p className="text-sm text-muted-foreground">{item.reseller.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={item.reseller.isActive ? "default" : "secondary"}
                          className={item.reseller.isActive ? "bg-green-500/20 text-green-600" : ""}
                        >
                          {item.reseller.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {item.clientsCount}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalSales)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
                          {item.reseller.commissionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(item.commission)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Meta</span>
                            <span>{item.goalProgress.toFixed(0)}%</span>
                          </div>
                          <Progress 
                            value={item.goalProgress} 
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground text-right">
                            {formatCurrency(item.reseller.revenueGoal)}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      {commissionData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <CardTitle>Top Performers</CardTitle>
            </div>
            <CardDescription>Revendedores com melhor desempenho em comissões</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {commissionData
                .filter((item) => item.reseller.isActive)
                .sort((a, b) => b.commission - a.commission)
                .slice(0, 3)
                .map((item, index) => (
                  <Card 
                    key={item.reseller.id}
                    className={`border-2 ${
                      index === 0 
                        ? "border-yellow-500/50 bg-yellow-500/5" 
                        : index === 1 
                          ? "border-gray-400/50 bg-gray-400/5"
                          : "border-orange-600/50 bg-orange-600/5"
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 
                            ? "bg-yellow-500" 
                            : index === 1 
                              ? "bg-gray-400"
                              : "bg-orange-600"
                        }`}>
                          {index + 1}º
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{item.reseller.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.clientsCount} clientes
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Comissão</span>
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(item.commission)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
