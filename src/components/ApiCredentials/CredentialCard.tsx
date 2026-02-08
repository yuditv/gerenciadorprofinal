import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Pencil, Trash2, Globe, Cpu } from "lucide-react";
import { PROVIDERS, type ApiCredential } from "@/hooks/useApiCredentials";

interface CredentialCardProps {
  credential: ApiCredential;
  onEdit: (credential: ApiCredential) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, is_active: boolean) => void;
}

export function CredentialCard({ credential, onEdit, onDelete, onToggleActive }: CredentialCardProps) {
  const [showKey, setShowKey] = useState(false);

  const provider = PROVIDERS.find((p) => p.value === credential.provider_name);
  const maskedKey = credential.api_key_enc
    ? `${credential.api_key_enc.slice(0, 8)}${"•".repeat(20)}${credential.api_key_enc.slice(-4)}`
    : "••••••••";

  return (
    <Card className={`transition-all duration-200 ${credential.is_active ? "border-border/50" : "border-border/30 opacity-60"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="text-2xl flex-shrink-0">{provider?.icon || "🔧"}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm truncate">{credential.api_label}</h4>
                <Badge variant="outline" className="text-xs">
                  {provider?.label || credential.provider_name}
                </Badge>
                {!credential.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inativa
                  </Badge>
                )}
              </div>

              {/* Key display */}
              <div className="flex items-center gap-1 mt-2">
                <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded truncate">
                  {showKey ? credential.api_key_enc : maskedKey}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>

              {/* Details */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                {credential.base_url && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{credential.base_url}</span>
                  </span>
                )}
                {credential.model_default && (
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    {credential.model_default}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              checked={credential.is_active}
              onCheckedChange={(checked) => onToggleActive(credential.id, checked)}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(credential)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Tem certeza que deseja remover esta credencial?")) {
                  onDelete(credential.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
