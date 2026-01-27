import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  UserPlus,
  Users,
  Edit,
  Trash2,
  Shield,
  Target,
  DollarSign,
  Phone,
  Mail,
  Check,
  X,
  Search,
  MoreHorizontal,
  Crown,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export interface Reseller {
  id: string;
  name: string;
  email: string;
  phone: string;
  accessLevel: "admin" | "manager" | "seller";
  commissionRate: number;
  clientLimit: number | null; // null = unlimited
  monthlyGoal: number;
  revenueGoal: number;
  isActive: boolean;
  createdAt: Date;
  clientsCount: number;
  totalRevenue: number;
}

interface ResellerManagementProps {
  resellers: Reseller[];
  onCreateReseller: (reseller: Omit<Reseller, "id" | "createdAt" | "clientsCount" | "totalRevenue">) => Promise<void>;
  onUpdateReseller: (id: string, reseller: Partial<Reseller>) => Promise<void>;
  onDeleteReseller: (id: string) => Promise<void>;
}

const accessLevelLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  seller: "Vendedor",
};

const accessLevelIcons: Record<string, React.ReactNode> = {
  admin: <Crown className="h-4 w-4" />,
  manager: <ShieldCheck className="h-4 w-4" />,
  seller: <ShieldAlert className="h-4 w-4" />,
};

const accessLevelColors: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  manager: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  seller: "bg-green-500/20 text-green-600 border-green-500/30",
};

const emptyReseller: Omit<Reseller, "id" | "createdAt" | "clientsCount" | "totalRevenue"> = {
  name: "",
  email: "",
  phone: "",
  accessLevel: "seller",
  commissionRate: 10,
  clientLimit: null,
  monthlyGoal: 10,
  revenueGoal: 5000,
  isActive: true,
};

export function ResellerManagement({
  resellers,
  onCreateReseller,
  onUpdateReseller,
  onDeleteReseller,
}: ResellerManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [formData, setFormData] = useState(emptyReseller);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hasClientLimit, setHasClientLimit] = useState(false);

  const filteredResellers = resellers.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery)
  );

  const openCreateDialog = () => {
    setEditingReseller(null);
    setFormData(emptyReseller);
    setHasClientLimit(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setFormData({
      name: reseller.name,
      email: reseller.email,
      phone: reseller.phone,
      accessLevel: reseller.accessLevel,
      commissionRate: reseller.commissionRate,
      clientLimit: reseller.clientLimit,
      monthlyGoal: reseller.monthlyGoal,
      revenueGoal: reseller.revenueGoal,
      isActive: reseller.isActive,
    });
    setHasClientLimit(reseller.clientLimit !== null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        clientLimit: hasClientLimit ? formData.clientLimit : null,
      };

      if (editingReseller) {
        await onUpdateReseller(editingReseller.id, data);
        toast.success("Revendedor atualizado com sucesso!");
      } else {
        await onCreateReseller(data);
        toast.success("Revendedor criado com sucesso!");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao salvar revendedor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeleteReseller(id);
      toast.success("Revendedor removido com sucesso!");
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error("Erro ao remover revendedor");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gerenciamento de Revendedores
              </CardTitle>
              <CardDescription>
                Crie e configure revendedores com seus níveis de acesso e metas
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Revendedor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar revendedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Revendedor</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Metas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResellers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchQuery
                        ? "Nenhum revendedor encontrado"
                        : "Nenhum revendedor cadastrado. Clique em 'Novo Revendedor' para começar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResellers.map((reseller) => (
                    <TableRow key={reseller.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{reseller.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {reseller.email}
                            </span>
                            {reseller.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {reseller.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${accessLevelColors[reseller.accessLevel]}`}>
                          {accessLevelIcons[reseller.accessLevel]}
                          {accessLevelLabels[reseller.accessLevel]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{reseller.commissionRate}%</Badge>
                      </TableCell>
                      <TableCell>
                        {reseller.clientLimit ? (
                          <span className="text-sm">
                            {reseller.clientsCount}/{reseller.clientLimit}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Ilimitado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-blue-500" />
                            {reseller.monthlyGoal} clientes
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-green-500" />
                            {formatCurrency(reseller.revenueGoal)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {reseller.isActive ? (
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30 gap-1">
                            <Check className="h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-600 border-red-500/30 gap-1">
                            <X className="h-3 w-3" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(reseller)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(reseller.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReseller ? "Editar Revendedor" : "Novo Revendedor"}</DialogTitle>
            <DialogDescription>
              {editingReseller
                ? "Altere os dados e configurações do revendedor"
                : "Preencha os dados para criar um novo revendedor"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="access">Acesso</TabsTrigger>
              <TabsTrigger value="goals">Metas</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Nome do revendedor"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Status</Label>
                  <p className="text-sm text-muted-foreground">Revendedor ativo pode acessar o sistema</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-4">
              <div className="space-y-2">
                <Label>Nível de Acesso</Label>
                <Select
                  value={formData.accessLevel}
                  onValueChange={(value: "admin" | "manager" | "seller") =>
                    setFormData({ ...formData, accessLevel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-purple-500" />
                        Administrador - Acesso total
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                        Gerente - Gerencia equipe
                      </div>
                    </SelectItem>
                    <SelectItem value="seller">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-green-500" />
                        Vendedor - Apenas vendas
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">Comissão (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.commissionRate}
                  onChange={(e) =>
                    setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Porcentagem de comissão sobre cada venda
                </p>
              </div>

              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Limite de Clientes</Label>
                    <p className="text-sm text-muted-foreground">
                      Definir limite máximo de clientes
                    </p>
                  </div>
                  <Switch
                    checked={hasClientLimit}
                    onCheckedChange={(checked) => {
                      setHasClientLimit(checked);
                      if (!checked) {
                        setFormData({ ...formData, clientLimit: null });
                      } else {
                        setFormData({ ...formData, clientLimit: 50 });
                      }
                    }}
                  />
                </div>
                {hasClientLimit && (
                  <div className="space-y-2">
                    <Label htmlFor="clientLimit">Máximo de Clientes</Label>
                    <Input
                      id="clientLimit"
                      type="number"
                      min={1}
                      value={formData.clientLimit || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, clientLimit: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="goals" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyGoal">Meta de Clientes (mensal)</Label>
                <Input
                  id="monthlyGoal"
                  type="number"
                  min={0}
                  value={formData.monthlyGoal}
                  onChange={(e) =>
                    setFormData({ ...formData, monthlyGoal: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Quantidade de novos clientes esperada por mês
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenueGoal">Meta de Receita (mensal)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="revenueGoal"
                    type="number"
                    min={0}
                    step={100}
                    className="pl-10"
                    value={formData.revenueGoal}
                    onChange={(e) =>
                      setFormData({ ...formData, revenueGoal: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Valor em receita esperado por mês
                </p>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Resumo das Metas
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Clientes/mês</p>
                      <p className="text-lg font-bold">{formData.monthlyGoal}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Receita/mês</p>
                      <p className="text-lg font-bold">{formatCurrency(formData.revenueGoal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editingReseller ? "Salvar Alterações" : "Criar Revendedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este revendedor? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
