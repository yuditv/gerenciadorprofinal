import { Hash, User, Lock, Link2, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { VPNTestFormValues } from "./types";

function Field({
  icon: Icon,
  label,
  children,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function VPNTestForm({
  values,
  onChange,
}: {
  values: VPNTestFormValues;
  onChange: (next: VPNTestFormValues) => void;
}) {
  return (
    <div className="space-y-4">
      <Field icon={User} label="Usuário">
        <Input
          value={values.username}
          maxLength={20}
          onChange={(e) => onChange({ ...values, username: e.target.value.slice(0, 20) })}
        />
      </Field>

      <Field icon={Lock} label="Senha">
        <Input
          value={values.password}
          maxLength={20}
          onChange={(e) => onChange({ ...values, password: e.target.value.slice(0, 20) })}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field icon={Link2} label="Limite de conexões">
          <Input
            inputMode="numeric"
            value={String(values.connectionLimit)}
            onChange={(e) =>
              onChange({
                ...values,
                connectionLimit: Math.max(1, Number(e.target.value || 1)),
              })
            }
          />
        </Field>

        <Field icon={Timer} label="Minutos" hint="Máximo de 6 horas.">
          <Input
            inputMode="numeric"
            value={String(values.minutes)}
            onChange={(e) =>
              onChange({
                ...values,
                minutes: Math.max(1, Math.min(360, Number(e.target.value || 60))),
              })
            }
          />
        </Field>
      </div>

      <div className={cn("rounded-lg border p-3 flex items-center justify-between")}
      >
        <div>
          <p className="text-sm font-medium">Modo V2Ray</p>
          <p className="text-xs text-muted-foreground">Ative para gerar um UUID para V2Ray.</p>
        </div>
        <Switch
          checked={values.v2rayEnabled}
          onCheckedChange={(checked) => onChange({ ...values, v2rayEnabled: checked })}
        />
      </div>

      {values.v2rayEnabled ? (
        <Field icon={Hash} label="UUID">
          <Input value={values.v2rayUuid} readOnly />
        </Field>
      ) : null}
    </div>
  );
}
