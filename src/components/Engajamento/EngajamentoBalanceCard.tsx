import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useWallet } from "@/hooks/useWallet";

export function EngajamentoBalanceCard(props: {
  balanceQuery: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    data?: { balance?: string; currency?: string };
    error?: unknown;
    refetch: () => unknown;
  };
}) {
  const navigate = useNavigate();
  const { isAdmin } = useUserPermissions();
  const { walletQuery } = useWallet();

  const balanceErrorMessage =
    props.balanceQuery.error instanceof Error
      ? props.balanceQuery.error.message
      : "Erro desconhecido";

  return (
    <Card className="border-primary/15 hover:border-primary/30">
      <CardHeader className="space-y-1">
        <CardTitle>Saldo</CardTitle>
        <CardDescription>Consulta em tempo real do painel SMM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-semibold tabular-nums">
          {props.balanceQuery.isLoading ? "..." : props.balanceQuery.data?.balance ?? "—"}
          <span className="ml-2 text-base text-muted-foreground">
            {props.balanceQuery.data?.currency ?? ""}
          </span>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">Créditos disponíveis</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="text-lg font-semibold tabular-nums">
              {walletQuery.isLoading ? "..." : (walletQuery.data?.credits ?? 0).toFixed(2)}
              <span className="ml-2 text-xs text-muted-foreground">cr</span>
            </div>
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate("/carteira")}
                className="gap-2"
              >
                Recarregar
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => props.balanceQuery.refetch()}
            disabled={props.balanceQuery.isFetching}
            className="gap-2"
          >
            <RefreshCw className={props.balanceQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Atualizar
          </Button>
          {props.balanceQuery.isError && (
            <span className="text-sm text-destructive">{balanceErrorMessage}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
