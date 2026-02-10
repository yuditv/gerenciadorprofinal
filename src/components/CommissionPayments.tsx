import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Search,
  CreditCard,
  Banknote,
  Calendar,
  FileText,
  Mail,
} from "lucide-react";
import { Reseller } from "@/components/ResellerManagement";
import { useCommissionPayments, PaymentStatus, CommissionPayment } from "@/hooks/useCommissionPayments";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommissionPaymentsProps {
  resellers: Reseller[];
  planPrices: Record<string, number>;
}

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  paid: "Pago",
  cancelled: "Cancelado",
};

const statusColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  approved: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  paid: "bg-green-500/20 text-green-600 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-600 border-red-500/30",
};

const statusIcons: Record<PaymentStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  approved: <CheckCircle className="h-3 w-3" />,
  paid: <DollarSign className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
};

const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "transfer", label: "Transferência Bancária" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
];

export function CommissionPayments({ resellers, planPrices }: CommissionPaymentsProps) {
  const { 
    payments, 
    isLoading, 
    createPayment, 
    updatePaymentStatus, 
    deletePayment,
    getPaymentStats 
  } = useCommissionPayments();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CommissionPayment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    resellerId: "",
    referenceMonth: format(new Date(), "yyyy-MM"),
    notes: "",
  });

  const [paymentData, setPaymentData] = useState({
    paymentMethod: "pix",
    notes: "",
  });

  const stats = getPaymentStats();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch = 
        payment.resellerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.referenceMonth.includes(searchQuery);
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchQuery, statusFilter]);

  const selectedReseller = useMemo(() => {
    return resellers.find((r) => r.id === formData.resellerId);
  }, [resellers, formData.resellerId]);

  const calculatedCommission = useMemo(() => {
    if (!selectedReseller) return { totalSales: 0, commission: 0 };
    const totalSales = selectedReseller.totalRevenue || (selectedReseller.clientsCount * (planPrices.monthly || 99.90));
    const commission = totalSales * (selectedReseller.commissionRate / 100);
    return { totalSales, commission };
  }, [selectedReseller, planPrices]);

  const handleCreatePayment = async () => {
    if (!formData.resellerId) {
      toast.error("Selecione um revendedor");
      return;
    }

    if (!selectedReseller) return;

    setIsSubmitting(true);
    try {
      await createPayment({
        resellerId: formData.resellerId,
        amount: calculatedCommission.commission,
        referenceMonth: formData.referenceMonth,
        totalSales: calculatedCommission.totalSales,
        commissionRate: selectedReseller.commissionRate,
        status: "pending",
        paymentDate: null,
        paymentMethod: null,
        notes: formData.notes || null,
      });
      setIsCreateDialogOpen(false);
      setFormData({ resellerId: "", referenceMonth: format(new Date(), "yyyy-MM"), notes: "" });
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendPaymentNotification = async (
    payment: CommissionPayment, 
    status: 'approved' | 'paid',
    paymentMethod?: string,
    paymentDate?: Date
  ) => {
    const reseller = resellers.find(r => r.id === payment.resellerId);
    if (!reseller || !reseller.email) {
      console.log("No reseller email found, skipping notification");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-payment-notification', {
        body: {
          resellerName: reseller.name,
          resellerEmail: reseller.email,
          amount: payment.amount,
          referenceMonth: payment.referenceMonth,
          status: status,
          paymentMethod: paymentMethod,
          paymentDate: paymentDate?.toISOString(),
        },
      });

      if (error) {
        console.error("Error sending notification:", error);
        toast.error("Pagamento atualizado, mas falha ao enviar email");
      } else {
        toast.success(`Email de notificação enviado para ${reseller.email}`);
      }
    } catch (error) {
      console.error("Error invoking notification function:", error);
    }
  };

  const handleApprovePayment = async (payment: CommissionPayment) => {
    await updatePaymentStatus(payment.id, "approved");
    // Send notification email
    sendPaymentNotification(payment, 'approved');
  };

  const handleOpenPayDialog = (payment: CommissionPayment) => {
    setSelectedPayment(payment);
    setPaymentData({ paymentMethod: "pix", notes: "" });
    setIsPayDialogOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;

    setIsSubmitting(true);
    const paymentDate = new Date();
    try {
      await updatePaymentStatus(
        selectedPayment.id,
        "paid",
        paymentDate,
        paymentData.paymentMethod
      );
      // Send notification email
      sendPaymentNotification(selectedPayment, 'paid', paymentData.paymentMethod, paymentDate);
      setIsPayDialogOpen(false);
      setSelectedPayment(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = async (payment: CommissionPayment) => {
    await updatePaymentStatus(payment.id, "cancelled");
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.totalPending)}</p>
                <p className="text-xs text-muted-foreground">{stats.pendingCount} pagamentos</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalApproved)}</p>
                <p className="text-xs text-muted-foreground">{stats.approvedCount} pagamentos</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pagos</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
                <p className="text-xs text-muted-foreground">{stats.paidCount} pagamentos</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Banknote className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Geral</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(stats.totalPending + stats.totalApproved + stats.totalPaid)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingCount + stats.approvedCount + stats.paidCount} pagamentos
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Gerencie os pagamentos de comissões dos revendedores</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pagamento
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 pt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por revendedor ou mês..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pagamento encontrado</p>
              <p className="text-sm">Clique em "Novo Pagamento" para registrar uma comissão</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]" type="always">
              <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Revendedor</TableHead>
                    <TableHead className="text-center">Mês Ref.</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Data Pgto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.resellerName || "—"}</TableCell>
                      <TableCell className="text-center">
                        {format(new Date(payment.referenceMonth + "-01"), "MMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.totalSales)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{payment.commissionRate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`gap-1 ${statusColors[payment.status]}`}>
                          {statusIcons[payment.status]}
                          {statusLabels[payment.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {payment.paymentDate
                          ? format(payment.paymentDate, "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {payment.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => handleApprovePayment(payment)}
                              >
                                Aprovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleCancelPayment(payment)}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                          {payment.status === "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleOpenPayDialog(payment)}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <ScrollBar orientation="horizontal" className="h-3" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Payment Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Pagamento de Comissão
            </DialogTitle>
            <DialogDescription>
              Registre um novo pagamento de comissão para um revendedor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Revendedor</Label>
              <Select
                value={formData.resellerId}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, resellerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um revendedor" />
                </SelectTrigger>
                <SelectContent>
                  {resellers.filter((r) => r.isActive).map((reseller) => (
                    <SelectItem key={reseller.id} value={reseller.id}>
                      {reseller.name} ({reseller.commissionRate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={formData.referenceMonth}
                onChange={(e) => setFormData((prev) => ({ ...prev, referenceMonth: e.target.value }))}
              />
            </div>

            {selectedReseller && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendas Totais:</span>
                    <span className="font-medium">{formatCurrency(calculatedCommission.totalSales)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de Comissão:</span>
                    <span className="font-medium">{selectedReseller.commissionRate}%</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Comissão a Pagar:</span>
                    <span className="text-green-600">{formatCurrency(calculatedCommission.commission)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Adicione observações se necessário..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePayment} disabled={isSubmitting || !formData.resellerId}>
              {isSubmitting ? "Registrando..." : "Registrar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Confirmar Pagamento
            </DialogTitle>
            <DialogDescription>
              Registre o pagamento da comissão para {selectedPayment?.resellerName}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mês Referência:</span>
                    <span className="font-medium">
                      {format(new Date(selectedPayment.referenceMonth + "-01"), "MMMM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>Valor a Pagar:</span>
                    <span className="text-green-600">{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={paymentData.paymentMethod}
                  onValueChange={(v) => setPaymentData((prev) => ({ ...prev, paymentMethod: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Adicione observações sobre o pagamento..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment} disabled={isSubmitting}>
              {isSubmitting ? "Confirmando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
