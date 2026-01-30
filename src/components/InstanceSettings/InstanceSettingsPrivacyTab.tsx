import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhatsAppInstances, type WhatsAppPrivacySettings } from "@/hooks/useWhatsAppInstances";
import { Loader2, RefreshCw, Save, ShieldAlert } from "lucide-react";

type Props = {
  instanceId: string;
  active: boolean;
};

const privacyOptions = {
  all: "Todos",
  contacts: "Meus contatos",
  contact_blacklist: "Exceto...",
  none: "Ninguém",
  match_last_seen: "Igual ao visto por último",
  known: "Conhecidos",
} as const;

function PrivacySelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: Array<keyof typeof privacyOptions>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {privacyOptions[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InstanceSettingsPrivacyTab({ instanceId, active }: Props) {
  const { getInstancePrivacy, setInstancePrivacy } = useWhatsAppInstances();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [privacy, setPrivacy] = useState<WhatsAppPrivacySettings | null>(null);

  const canLoad = useMemo(() => active && !!instanceId, [active, instanceId]);

  const load = async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const p = await getInstancePrivacy(instanceId);
      setPrivacy(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canLoad) return;
    if (privacy) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const save = async () => {
    if (!instanceId || !privacy) return;
    setSaving(true);
    try {
      const updated = await setInstancePrivacy(instanceId, privacy);
      if (updated) setPrivacy(updated);
    } finally {
      setSaving(false);
    }
  };

  if (!active) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Observação: Broadcast/Stories não é configurável pela API.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando privacidade...
        </div>
      ) : (
        <div className="grid gap-4">
          <PrivacySelect
            label="Quem pode adicionar aos grupos"
            value={privacy?.groupadd}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), groupadd: v }))}
            options={["all", "contacts", "contact_blacklist", "none"]}
          />
          <PrivacySelect
            label="Quem pode ver visto por último"
            value={privacy?.last}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), last: v }))}
            options={["all", "contacts", "contact_blacklist", "none"]}
          />
          <PrivacySelect
            label="Quem pode ver recado/status"
            value={privacy?.status}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), status: v }))}
            options={["all", "contacts", "contact_blacklist", "none"]}
          />
          <PrivacySelect
            label="Quem pode ver foto de perfil"
            value={privacy?.profile}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), profile: v }))}
            options={["all", "contacts", "contact_blacklist", "none"]}
          />
          <PrivacySelect
            label="Confirmação de leitura"
            value={privacy?.readreceipts}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), readreceipts: v }))}
            options={["all", "none"]}
          />
          <PrivacySelect
            label="Quem pode ver online"
            value={privacy?.online}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), online: v }))}
            options={["all", "match_last_seen"]}
          />
          <PrivacySelect
            label="Quem pode fazer chamadas"
            value={privacy?.calladd}
            onChange={(v) => setPrivacy((p) => ({ ...(p || {}), calladd: v }))}
            options={["all", "known"]}
          />
        </div>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Carregar do WhatsApp
        </Button>
        <Button onClick={save} disabled={saving || loading || !privacy} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
