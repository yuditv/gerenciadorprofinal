import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Plus, Pencil } from "lucide-react";
import { PROVIDERS, PROVIDER_PRESETS, type CreateApiCredentialInput, type ApiCredential } from "@/hooks/useApiCredentials";

interface AddCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateApiCredentialInput) => void;
  editingCredential?: ApiCredential | null;
  onUpdate?: (input: { id: string } & CreateApiCredentialInput) => void;
  isPending?: boolean;
}

export function AddCredentialDialog({
  open,
  onOpenChange,
  onSave,
  editingCredential,
  onUpdate,
  isPending,
}: AddCredentialDialogProps) {
  const isEditing = !!editingCredential;

  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelDefault, setModelDefault] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (editingCredential) {
      setProvider(editingCredential.provider_name);
      setLabel(editingCredential.api_label);
      setApiKey("");
      setBaseUrl(editingCredential.base_url || "");
      setModelDefault(editingCredential.model_default || "");
    } else {
      setProvider("openai");
      setLabel("");
      setApiKey("");
      setBaseUrl("");
      setModelDefault("");
    }
    setShowKey(false);
  }, [editingCredential, open]);

  useEffect(() => {
    if (!isEditing) {
      const preset = PROVIDER_PRESETS[provider];
      if (preset) {
        setBaseUrl(preset.base_url);
        setModelDefault(preset.models[0] || "");
      }
    }
  }, [provider, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateApiCredentialInput = {
      provider_name: provider,
      api_label: label.trim(),
      api_key: apiKey,
      base_url: baseUrl.trim() || undefined,
      model_default: modelDefault.trim() || undefined,
    };

    if (isEditing && onUpdate && editingCredential) {
      onUpdate({ id: editingCredential.id, ...input });
    } else {
      onSave(input);
    }
  };

  const preset = PROVIDER_PRESETS[provider];
  const providerInfo = PROVIDERS.find((p) => p.value === provider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isEditing ? (
              <Pencil className="h-5 w-5 text-primary" />
            ) : (
              <Plus className="h-5 w-5 text-primary" />
            )}
            {isEditing ? "Editar Credencial" : "Adicionar Credencial de API"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações da credencial"
              : "Configure uma API key para usar nos seus agentes IA"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={setProvider} disabled={isEditing}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <span>{p.icon}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Nome / Identificador *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Ex: Minha chave ${providerInfo?.label || ""}`}
              required
              className="bg-background/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              Nome único para identificar esta credencial
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key *</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEditing ? "Deixe vazio para manter a atual" : "sk-..."}
                required={!isEditing}
                className="bg-background/50 border-border/50 pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="base-url">URL Base da API</Label>
            <Input
              id="base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="bg-background/50 border-border/50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {provider !== "custom"
                ? "Preenchido automaticamente, altere se necessário"
                : "URL da API compatível com OpenAI"}
            </p>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model">Modelo Padrão</Label>
            {preset && preset.models.length > 0 ? (
              <Select value={modelDefault} onValueChange={setModelDefault}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {preset.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model"
                value={modelDefault}
                onChange={(e) => setModelDefault(e.target.value)}
                placeholder="nome-do-modelo"
                className="bg-background/50 border-border/50 font-mono text-sm"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !label.trim() || (!isEditing && !apiKey.trim())}
              className="flex-1"
            >
              {isPending
                ? "Salvando..."
                : isEditing
                ? "Atualizar"
                : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
