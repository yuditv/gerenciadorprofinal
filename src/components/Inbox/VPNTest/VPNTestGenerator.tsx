import { useMemo, useState } from "react";
import { RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { VPNTestForm } from "@/components/Inbox/VPNTest/VPNTestForm";
import { VPNTestFields } from "@/components/Inbox/VPNTest/VPNTestFields";
import type { VPNTestFormValues } from "@/components/Inbox/VPNTest/types";
import { generateOfflineValues } from "@/components/Inbox/VPNTest/utils";
import { buildVPNTestTemplate } from "@/components/Inbox/VPNTest/template";
import { VPNTestTemplate } from "@/components/Inbox/VPNTest/VPNTestTemplate";

function sanitizeValues(values: VPNTestFormValues): VPNTestFormValues {
  return {
    ...values,
    username: values.username.trim().slice(0, 20),
    password: values.password.trim().slice(0, 20),
    connectionLimit: Math.max(1, Number(values.connectionLimit || 1)),
    minutes: Math.max(1, Math.min(360, Number(values.minutes || 60))),
    v2rayUuid: values.v2rayUuid.trim(),
  };
}

export function VPNTestGenerator({
  initialValues,
}: {
  initialValues?: Partial<VPNTestFormValues>;
}) {
  const { toast } = useToast();

  const defaultValues = useMemo<VPNTestFormValues>(
    () => generateOfflineValues(initialValues),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [values, setValues] = useState<VPNTestFormValues>(defaultValues);
  const template = useMemo(() => buildVPNTestTemplate(sanitizeValues(values)), [values]);

  const regenerate = () => {
    const next = generateOfflineValues({
      connectionLimit: values.connectionLimit,
      minutes: values.minutes,
      v2rayEnabled: values.v2rayEnabled,
    });
    setValues(next);
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4 text-primary" />
          <span>Modo offline (sem Servex)</span>
        </div>
        <Button variant="outline" size="sm" onClick={regenerate}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Gerar novo
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <VPNTestForm values={values} onChange={setValues} />
      </div>

      <VPNTestFields
        username={values.username}
        password={values.password}
        connectionLimit={values.connectionLimit}
        minutes={values.minutes}
        v2rayEnabled={values.v2rayEnabled}
        v2rayUuid={values.v2rayUuid}
        onCopy={(label, value) => copyText(label, value)}
      />

      <VPNTestTemplate value={template} onCopy={(t) => copyText("Template", t)} />
    </div>
  );
}
