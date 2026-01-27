import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Receipt, Download, Eye, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { formatCurrencyBRL } from "@/types/subscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SubscriptionStatusCard } from "@/components/SubscriptionStatusCard";
import { SubscriptionPlansDialog } from "@/components/SubscriptionPlansDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusConfig = {
  paid: {
    label: "Pago",
    icon: CheckCircle,
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  expired: {
    label: "Expirado",
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
  refunded: {
    label: "Reembolsado",
    icon: Receipt,
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
};

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { payments, subscription, isLoading } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);

  const selectedPaymentData = payments.find(p => p.id === selectedPayment);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Pagamentos</h1>
              <p className="text-muted-foreground">Visualize suas faturas e pagamentos anteriores</p>
            </div>
          </div>
          <Button onClick={() => setShowPlans(true)}>
            Alterar Plano
          </Button>
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SubscriptionStatusCard />
        </motion.div>

        {/* Payments Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Faturas
              </CardTitle>
              <CardDescription>
                Histórico completo de pagamentos da sua assinatura
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowPlans(true)}
                  >
                    Fazer primeira assinatura
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;
                      const StatusIcon = status.icon;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {format(new Date(payment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(payment.created_at), "HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {(payment as any).plan?.name || "Plano"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-medium">
                              {formatCurrencyBRL(payment.amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-xs">
                              {payment.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={status.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayment(payment.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Plans Dialog */}
      <SubscriptionPlansDialog open={showPlans} onOpenChange={setShowPlans} />

      {/* Payment Details Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="glass-card border-primary/20">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          {selectedPaymentData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID da Transação</p>
                  <p className="font-mono text-sm">{selectedPaymentData.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID Externo</p>
                  <p className="font-mono text-sm">{selectedPaymentData.external_id || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Criação</p>
                  <p className="font-medium">
                    {format(new Date(selectedPaymentData.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Pagamento</p>
                  <p className="font-medium">
                    {selectedPaymentData.paid_at 
                      ? format(new Date(selectedPaymentData.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "-"
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="font-medium">{(selectedPaymentData as any).plan?.name || "Plano"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-mono font-bold text-lg">{formatCurrencyBRL(selectedPaymentData.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Método</p>
                  <Badge variant="outline" className="uppercase">
                    {selectedPaymentData.payment_method}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {(() => {
                    const status = statusConfig[selectedPaymentData.status as keyof typeof statusConfig] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    return (
                      <Badge className={status.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              {selectedPaymentData.status === "paid" && (
                <div className="pt-4 border-t border-border">
                  <Button variant="outline" className="w-full" disabled>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Comprovante (em breve)
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
