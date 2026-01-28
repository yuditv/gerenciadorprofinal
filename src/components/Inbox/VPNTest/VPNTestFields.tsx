import { Copy, KeyRound, Lock, Timer, Link2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

type IconType = React.ComponentType<{ className?: string }>;

function FieldRow({
  icon: Icon,
  label,
  value,
  onCopy,
}: {
  icon: IconType;
  label: string;
  value: string;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="flex items-center py-2 px-3 gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">{label}</span>
      <span className="text-sm font-medium truncate flex-1" title={value}>
        {value || "-"}
      </span>
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onCopy(label, value)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export function VPNTestFields({
  username,
  password,
  connectionLimit,
  minutes,
  v2rayEnabled,
  v2rayUuid,
  onCopy,
}: {
  username: string;
  password: string;
  connectionLimit: number;
  minutes: number;
  v2rayEnabled: boolean;
  v2rayUuid: string;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-3 py-2 border-b">
        <h4 className="text-sm font-semibold text-foreground">Dados do Teste</h4>
      </div>
      <div className="divide-y">
        <FieldRow icon={KeyRound} label="Usuário" value={username} onCopy={onCopy} />
        <FieldRow icon={Lock} label="Senha" value={password} onCopy={onCopy} />
        <FieldRow icon={Link2} label="Limite de conexões" value={String(connectionLimit)} onCopy={onCopy} />
        <FieldRow icon={Timer} label="Minutos" value={String(minutes)} onCopy={onCopy} />
        {v2rayEnabled ? (
          <FieldRow icon={Hash} label="UUID" value={v2rayUuid} onCopy={onCopy} />
        ) : null}
      </div>
    </div>
  );
}
