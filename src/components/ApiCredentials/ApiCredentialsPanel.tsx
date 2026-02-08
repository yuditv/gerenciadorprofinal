import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Shield, Key, Loader2 } from "lucide-react";
import { useApiCredentials, type ApiCredential } from "@/hooks/useApiCredentials";
import { AddCredentialDialog } from "./AddCredentialDialog";
import { CredentialCard } from "./CredentialCard";

export function ApiCredentialsPanel() {
  const { credentials, isLoading, createCredential, updateCredential, deleteCredential, toggleActive } = useApiCredentials();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<ApiCredential | null>(null);

  const handleAdd = () => {
    setEditingCredential(null);
    setDialogOpen(true);
  };

  const handleEdit = (credential: ApiCredential) => {
    setEditingCredential(credential);
    setDialogOpen(true);
  };

  const handleSave = (input: Parameters<typeof createCredential.mutateAsync>[0]) => {
    createCredential.mutate(input, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  const handleUpdate = (input: { id: string } & Parameters<typeof createCredential.mutateAsync>[0]) => {
    const { id, api_key, ...rest } = input;
    updateCredential.mutate(
      {
        id,
        ...rest,
        ...(api_key ? { api_key } : {}),
      },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            Credenciais de API
          </h2>
          <p className="text-muted-foreground mt-1">
            Gerencie suas API Keys para usar nos agentes IA
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Credencial
        </Button>
      </div>

      {/* Security Note */}
      <Alert className="border-primary/20 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription>
          Suas chaves são armazenadas de forma segura e só podem ser acessadas por você.
          Ao vincular uma credencial a um agente, ela será usada para fazer chamadas à API correspondente.
        </AlertDescription>
      </Alert>

      {/* Credentials List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-12 space-y-3 border border-dashed border-border/50 rounded-lg">
          <Key className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <div>
            <p className="font-medium text-muted-foreground">Nenhuma credencial configurada</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Adicione suas API Keys (OpenAI, Anthropic, Google, etc.) para usar nos agentes
            </p>
          </div>
          <Button variant="outline" onClick={handleAdd} className="gap-2 mt-2">
            <Plus className="h-4 w-4" />
            Adicionar Primeira Credencial
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              onEdit={handleEdit}
              onDelete={(id) => deleteCredential.mutate(id)}
              onToggleActive={(id, is_active) => toggleActive.mutate({ id, is_active })}
            />
          ))}
        </div>
      )}

      <AddCredentialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editingCredential={editingCredential}
        onUpdate={handleUpdate}
        isPending={createCredential.isPending || updateCredential.isPending}
      />
    </div>
  );
}
