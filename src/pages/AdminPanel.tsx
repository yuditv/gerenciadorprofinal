import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminUsers, AdminUser } from "@/hooks/useAdminUsers";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Shield, 
  Users, 
  Trash2, 
  RefreshCw, 
  Crown,
  UserCog,
  User,
  Lock,
  Ban,
  ShieldCheck,
  Settings,
  UserPlus,
  CreditCard
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { AdminSubscriptionManager } from "@/components/AdminSubscriptionManager";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionPlan } from "@/types/subscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserSubscriptionData {
  id: string;
  user_id: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan?: SubscriptionPlan;
  user_email?: string;
  user_name?: string;
}

const roleConfig = {
  admin: { 
    label: 'Admin', 
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: Crown 
  },
  moderator: { 
    label: 'Moderador', 
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: UserCog 
  },
  user: { 
    label: 'Usuário', 
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: User 
  },
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    users, 
    isLoading, 
    isAdmin, 
    checkAdminStatus, 
    fetchUsers, 
    updateUserRole, 
    blockUser,
    unblockUser,
    deleteUser,
    updatePermissions,
    createUser
  } = useAdminUsers();
  const [isChecking, setIsChecking] = useState(true);
  const [blockReason, setBlockReason] = useState("");
  const [userToBlock, setUserToBlock] = useState<string | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<typeof users[0] | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionData[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    setIsLoadingSubscriptions(true);
    
    // Fetch plans
    const { data: plansData } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('duration_months', { ascending: true });

    if (plansData) {
      setPlans(plansData as SubscriptionPlan[]);
    }

    // Fetch subscriptions with user info
    const { data: subsData } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .order('created_at', { ascending: false });

    if (subsData) {
      // Map user info from users list
      const subsWithUserInfo = subsData.map((sub: any) => {
        const userInfo = users.find(u => u.id === sub.user_id);
        return {
          ...sub,
          user_email: userInfo?.email,
          user_name: userInfo?.profile?.display_name,
        };
      });
      setSubscriptions(subsWithUserInfo as UserSubscriptionData[]);
    }

    setIsLoadingSubscriptions(false);
  }, [users]);

  useEffect(() => {
    const init = async () => {
      setIsChecking(true);
      const admin = await checkAdminStatus();
      if (admin) {
        await fetchUsers();
      }
      setIsChecking(false);
    };
    init();
  }, [checkAdminStatus, fetchUsers]);

  useEffect(() => {
    if (users.length > 0) {
      fetchSubscriptions();
    }
  }, [users, fetchSubscriptions]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full glass-card glow-border">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <Lock className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar o painel de administração.
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="btn-futuristic"
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20 glow-border">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gradient glitch-subtle">
                Painel Admin
              </h1>
              <p className="text-muted-foreground">
                Gerencie usuários e permissões
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-primary/30"
            >
              Voltar
            </Button>
            <Button
              onClick={fetchUsers}
              disabled={isLoading}
              variant="outline"
              className="border-primary/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="btn-futuristic"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-background/50 border border-border/50">
            <TabsTrigger value="users" className="data-[state=active]:bg-primary/20">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="data-[state=active]:bg-primary/20">
              <CreditCard className="h-4 w-4 mr-2" />
              Assinaturas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="glass-card glow-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/20">
                      <Users className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{users.length}</p>
                      <p className="text-sm text-muted-foreground">Total de Usuários</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card glow-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-red-500/20">
                      <Crown className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {users.filter(u => u.role === 'admin').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Administradores</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card glow-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-500/20">
                      <UserCog className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {users.filter(u => u.role === 'moderator').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Moderadores</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card glow-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-500/20">
                      <Ban className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {users.filter(u => u.is_blocked).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Bloqueados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card className="glass-card glow-border overflow-hidden">
              <CardHeader className="border-b border-primary/10">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Usuários Registrados
                </CardTitle>
              </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-primary/10 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Usuário</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">WhatsApp</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Criado em</TableHead>
                    <TableHead className="text-muted-foreground">Último acesso</TableHead>
                    <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const RoleIcon = roleConfig[u.role]?.icon || User;
                    const isCurrentUser = u.id === user?.id;
                    
                    return (
                      <TableRow 
                        key={u.id} 
                        className="border-primary/10 hover:bg-primary/5"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-primary/20">
                              <AvatarImage src={u.profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/20 text-primary">
                                {u.profile?.display_name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {u.profile?.display_name || 'Sem nome'}
                                {isCurrentUser && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Você
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.profile?.whatsapp || '-'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(value: 'admin' | 'moderator' | 'user') => 
                              updateUserRole(u.id, value)
                            }
                            disabled={isCurrentUser}
                          >
                            <SelectTrigger className="w-[140px] border-primary/20">
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  <RoleIcon className="h-4 w-4" />
                                  <span>{roleConfig[u.role]?.label || 'Usuário'}</span>
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4 text-red-400" />
                                  <span>Admin</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="moderator">
                                <div className="flex items-center gap-2">
                                  <UserCog className="h-4 w-4 text-amber-400" />
                                  <span>Moderador</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="user">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-blue-400" />
                                  <span>Usuário</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {u.is_blocked ? (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                              <Ban className="h-3 w-3 mr-1" />
                              Bloqueado
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Ativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.last_sign_in_at 
                            ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) 
                            : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Permissions Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:text-primary/80 hover:bg-primary/10"
                              disabled={isCurrentUser || u.role === 'admin'}
                              title="Gerenciar permissões"
                              onClick={() => setPermissionsUser(u)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>

                            {/* Block/Unblock Button */}
                            {u.is_blocked ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                    disabled={isCurrentUser}
                                    title="Desbloquear usuário"
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="glass-card border-primary/20">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Desbloquear usuário?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O usuário <strong>{u.email}</strong> poderá acessar o sistema novamente.
                                      {u.block_reason && (
                                        <span className="block mt-2 text-muted-foreground">
                                          Motivo do bloqueio: {u.block_reason}
                                        </span>
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => unblockUser(u.id)}
                                      className="bg-green-500 hover:bg-green-600"
                                    >
                                      Desbloquear
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <AlertDialog open={userToBlock === u.id} onOpenChange={(open) => {
                                if (!open) {
                                  setUserToBlock(null);
                                  setBlockReason("");
                                }
                              }}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                    disabled={isCurrentUser}
                                    title="Bloquear usuário"
                                    onClick={() => setUserToBlock(u.id)}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="glass-card border-primary/20">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Bloquear usuário?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O usuário <strong>{u.email}</strong> não poderá acessar o sistema enquanto estiver bloqueado.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <div className="py-4">
                                    <Input
                                      placeholder="Motivo do bloqueio (opcional)"
                                      value={blockReason}
                                      onChange={(e) => setBlockReason(e.target.value)}
                                      className="border-primary/20"
                                    />
                                  </div>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => {
                                      setUserToBlock(null);
                                      setBlockReason("");
                                    }}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        blockUser(u.id, blockReason);
                                        setUserToBlock(null);
                                        setBlockReason("");
                                      }}
                                      className="bg-orange-500 hover:bg-orange-600"
                                    >
                                      Bloquear
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {/* Delete Button */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  disabled={isCurrentUser}
                                  title="Excluir usuário"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass-card border-primary/20">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O usuário{' '}
                                    <strong>{u.email}</strong> será permanentemente removido.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser(u.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {users.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <AdminSubscriptionManager
              subscriptions={subscriptions}
              plans={plans}
              onRefresh={fetchSubscriptions}
              isLoading={isLoadingSubscriptions}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Permissions Dialog */}
      <UserPermissionsDialog
        user={permissionsUser}
        open={!!permissionsUser}
        onOpenChange={(open) => !open && setPermissionsUser(null)}
        onSave={updatePermissions}
      />

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onUserCreated={fetchUsers}
        createUser={createUser}
      />
    </div>
  );
}