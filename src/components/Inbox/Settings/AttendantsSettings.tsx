import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInboxTeams } from "@/hooks/useInboxTeams";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AttendantRow = {
  id: string;
  member_id: string;
  member_email: string | null;
  member_name: string | null;
  created_at: string;
};

export function AttendantsSettings() {
  const { user } = useAuth();
  const { teams } = useInboxTeams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [attendants, setAttendants] = useState<AttendantRow[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttendantRow | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    canSend: true,
    canTransfer: true,
    canManageLabelsMacros: true,
    teamIds: [] as string[],
  });

  const loadAttendants = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_members")
        .select("id, member_id, member_email, member_name, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAttendants((data || []) as AttendantRow[]);
    } catch (e) {
      console.error("[AttendantsSettings] load error", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const teamOptions = useMemo(() => teams, [teams]);

  const toggleTeam = (teamId: string) => {
    setForm((prev) => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId) ? prev.teamIds.filter((id) => id !== teamId) : [...prev.teamIds, teamId],
    }));
  };

  const createAttendant = async () => {
    if (!form.email.trim() || !form.password) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("create-attendant", {
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || null,
          permissions: {
            can_send: form.canSend,
            can_transfer: form.canTransfer,
            can_manage_labels_macros: form.canManageLabelsMacros,
          },
          teamIds: form.teamIds,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Atendente criado",
        description: `Envie este link: ${window.location.origin}/attendant-auth`,
      });
      setIsCreateOpen(false);
      setForm({
        name: "",
        email: "",
        password: "",
        canSend: true,
        canTransfer: true,
        canManageLabelsMacros: true,
        teamIds: [],
      });
      await loadAttendants();
    } catch (e: any) {
      toast({
        title: "Erro ao criar atendente",
        description: e?.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const deleteAttendant = async () => {
    if (!deleteTarget) return;
    try {
      const { data, error } = await supabase.functions.invoke("delete-attendant", {
        body: {
          memberId: deleteTarget.member_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Atendente removido" });
      setDeleteTarget(null);
      await loadAttendants();
    } catch (e: any) {
      toast({
        title: "Erro ao remover",
        description: e?.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Atendentes</h2>
        <p className="text-muted-foreground">Crie acessos restritos para sua Central de Atendimento.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link de acesso do atendente</CardTitle>
          <CardDescription>Envie este link para o atendente entrar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <Input readOnly value={`${window.location.origin}/attendant-auth`} />
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/attendant-auth`);
                toast({ title: "Link copiado" });
              }}
            >
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Lista de atendentes</h3>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo atendente
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : attendants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhum atendente criado</h3>
            <p className="text-sm text-muted-foreground mt-1">Crie o primeiro acesso para sua equipe.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {attendants.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {a.member_name || a.member_email || a.member_id}
                    </CardTitle>
                    <CardDescription>{a.member_email || ""}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo atendente</DialogTitle>
            <DialogDescription>Esse usuário terá acesso somente ao Inbox (conversas atribuídas a ele).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.canSend} onCheckedChange={(v) => setForm((p) => ({ ...p, canSend: !!v }))} />
                  <span className="text-sm">Pode enviar mensagens</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.canTransfer}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, canTransfer: !!v }))}
                  />
                  <span className="text-sm">Pode encerrar/transferir</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.canManageLabelsMacros}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, canManageLabelsMacros: !!v }))}
                  />
                  <span className="text-sm">Pode usar/gerenciar Etiquetas e Macros</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Times</Label>
              <div className="space-y-2 rounded-lg border p-3 max-h-56 overflow-auto">
                {teamOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Crie um time primeiro em “Equipes”.</p>
                ) : (
                  teamOptions.map((t) => (
                    <label key={t.id} className="flex items-center gap-2">
                      <Checkbox checked={form.teamIds.includes(t.id)} onCheckedChange={() => toggleTeam(t.id)} />
                      <span className="text-sm">{t.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createAttendant}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atendente?</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendente perderá acesso imediato ao Inbox desta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAttendant} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
