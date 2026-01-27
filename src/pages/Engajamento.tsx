import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, ShoppingCart } from "lucide-react";
import { FloatingSidebar } from "@/components/FloatingSidebar";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useSmmPanel } from "@/hooks/useSmmPanel";
import { useWallet } from "@/hooks/useWallet";

export default function Engajamento() {
  const navigate = useNavigate();
  const { balanceQuery, servicesQuery, addOrder, categories } = useSmmPanel();
  const { walletQuery } = useWallet();

  const [serviceId, setServiceId] = useState<string>("");
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");

  const services = servicesQuery.data ?? [];

  const servicesErrorMessage =
    servicesQuery.error instanceof Error ? servicesQuery.error.message : "Erro desconhecido";
  const balanceErrorMessage =
    balanceQuery.error instanceof Error ? balanceQuery.error.message : "Erro desconhecido";

  const selectedService = useMemo(() => {
    const id = Number(serviceId);
    if (!id) return null;
    return services.find((s) => s.service === id) ?? null;
  }, [serviceId, services]);

  const estimatedCost = useMemo(() => {
    if (!selectedService || !selectedService.rate || !quantity) return null;
    const rate = parseFloat(String(selectedService.rate));
    const qty = parseInt(quantity, 10);
    if (isNaN(rate) || isNaN(qty) || qty <= 0) return null;
    // rate is per 1000
    return ((rate * qty) / 1000).toFixed(2);
  }, [selectedService, quantity]);

  const handleSidebarSectionChange = (section: string) => {
    // Mantém o padrão do app: trocar "seção" usando querystring na rota principal.
    navigate(`/?section=${encodeURIComponent(section)}`);
  };

  const canSubmit = Boolean(serviceId && link.trim() && Number(quantity) > 0);

  const handleCreateOrder = async () => {
    if (!canSubmit) return;
    try {
      const result = await addOrder.mutateAsync({
        service: Number(serviceId),
        link: link.trim(),
        quantity: Number(quantity),
      });

      if (result?.error) {
        toast.error("Falha ao criar pedido", { description: result.error });
        return;
      }

      toast.success("Pedido criado com sucesso", {
        description: result?.order ? `Pedido #${result.order}` : undefined,
      });
      setLink("");
      setQuantity("");
    } catch (e) {
      toast.error("Erro ao criar pedido", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full relative theme-engajamento">
      <SubscriptionBanner />
      <FloatingSidebar
        activeSection="engajamento"
        onSectionChange={(section) => handleSidebarSectionChange(section)}
      />

      <main className="flex-1 p-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Engajamento</h1>
                <p className="text-sm text-muted-foreground">
                  Painel SMM para vender seguidores, curtidas e outros serviços.
                </p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border-primary/15 hover:border-primary/30">
              <CardHeader className="space-y-1">
                <CardTitle>Saldo</CardTitle>
                <CardDescription>Consulta em tempo real do painel SMM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-semibold tabular-nums">
                  {balanceQuery.isLoading
                    ? "..."
                    : balanceQuery.data?.balance ?? "—"}
                  <span className="ml-2 text-base text-muted-foreground">
                    {balanceQuery.data?.currency ?? ""}
                  </span>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Créditos disponíveis</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="text-lg font-semibold tabular-nums">
                      {walletQuery.isLoading ? "..." : (walletQuery.data?.credits ?? 0).toFixed(2)}
                      <span className="ml-2 text-xs text-muted-foreground">cr</span>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => navigate("/carteira")}
                      className="gap-2">
                      Recarregar
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => balanceQuery.refetch()}
                    disabled={balanceQuery.isFetching}
                    className="gap-2"
                  >
                    <RefreshCw className={balanceQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                    Atualizar
                  </Button>
                  {balanceQuery.isError && (
                    <span className="text-sm text-destructive">{balanceErrorMessage}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-primary/15 hover:border-primary/30">
              <CardHeader className="space-y-1">
                <CardTitle>Criar pedido</CardTitle>
                <CardDescription>
                  Escolha um serviço, informe o link e a quantidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <Label>Serviço</Label>
                    <Select value={serviceId} onValueChange={setServiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder={servicesQuery.isLoading ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        {services.slice(0, 400).map((s) => (
                          <SelectItem key={s.service} value={String(s.service)}>
                            #{s.service} — {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {servicesQuery.isError && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-destructive line-clamp-2">{servicesErrorMessage}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => servicesQuery.refetch()}
                          disabled={servicesQuery.isFetching}
                          className="gap-2"
                        >
                          <RefreshCw className={servicesQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                          Tentar
                        </Button>
                      </div>
                    )}
                    {selectedService && (
                      <div className="mt-2 space-y-1 text-xs">
                        {selectedService.category && (
                          <p className="text-muted-foreground">Categoria: {selectedService.category}</p>
                        )}
                        {selectedService.rate && (
                          <p className="text-muted-foreground">
                            Rate: <span className="font-semibold text-foreground">{selectedService.rate}</span> por 1000
                          </p>
                        )}
                        {selectedService.min && selectedService.max && (
                          <p className="text-muted-foreground">
                            Mín: {selectedService.min} • Máx: {selectedService.max}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="smm-link">Link</Label>
                    <Input
                      id="smm-link"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://instagram.com/..."
                      autoComplete="off"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <Label htmlFor="smm-qty">Quantidade</Label>
                    <Input
                      id="smm-qty"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="100"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  {estimatedCost && (
                    <div className="text-sm font-medium">
                      Custo estimado: <span className="text-primary tabular-nums">{estimatedCost}</span>
                    </div>
                  )}
                  <div className="flex-1" />
                  <Button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={!canSubmit || addOrder.isPending}
                    className="gap-2"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {addOrder.isPending ? "Enviando..." : "Criar pedido"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
