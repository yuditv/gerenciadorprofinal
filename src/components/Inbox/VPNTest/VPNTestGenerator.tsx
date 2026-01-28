import { useMemo, useState } from "react";
import { Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { VPNTestForm } from "@/components/Inbox/VPNTest/VPNTestForm";
import { VPNTestFields } from "@/components/Inbox/VPNTest/VPNTestFields";
import type { VPNTestFormValues } from "@/components/Inbox/VPNTest/types";
import { generateOfflineValues, normalizeNumberish } from "@/components/Inbox/VPNTest/utils";
import { buildVPNTestTemplate } from "@/components/Inbox/VPNTest/template";
import { VPNTestTemplate } from "@/components/Inbox/VPNTest/VPNTestTemplate";
import { supabase } from "@/integrations/supabase/client";

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Still generate initial credentials locally (required to send to API),
  // but we don't expose a "regenerate local" button to the user.

  const generateOnPanel = async () => {
    setIsGenerating(true);
    setApiError(null);

    try {
      const payload = {
        duration: values.minutes,
        connection_limit: values.connectionLimit,
        username: values.username,
        password: values.password,
        v2ray_enabled: values.v2rayEnabled,
        v2ray_uuid: values.v2rayUuid,
      };

      const { data, error } = await supabase.functions.invoke("vpn-test-generator", {
        body: payload,
      });

      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error(String((data as any).error));

      const next: VPNTestFormValues = {
        username: String((data as any)?.username ?? values.username).slice(0, 20),
        password: String((data as any)?.password ?? values.password).slice(0, 20),
        connectionLimit: normalizeNumberish((data as any)?.connection_limit ?? values.connectionLimit, values.connectionLimit),
        minutes: normalizeNumberish((data as any)?.duration ?? values.minutes, values.minutes),
        v2rayEnabled: values.v2rayEnabled,
        v2rayUuid: String((data as any)?.v2ray_uuid ?? values.v2rayUuid),
      };

      setValues(next);
      toast({
        title: "Teste gerado!",
        description: "Criado no painel via API e pronto para copiar.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setApiError(message);
      toast({
        title: "Falha ao gerar no painel",
        description: message.slice(0, 160),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
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
          <span>Modo online (Servex)</span>
        </div>
        <Button size="sm" onClick={generateOnPanel} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 mr-2" />
              Gerar no painel
            </>
          )}
        </Button>
      </div>

      {apiError ? (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {apiError}
        </div>
      ) : null}

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
