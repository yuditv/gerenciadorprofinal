import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, CreditCard, QrCode, RefreshCw, Wallet as WalletIcon } from "lucide-react";
import { FloatingSidebar } from "@/components/FloatingSidebar";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import { useWalletTopup } from "@/hooks/useWalletTopup";
import { usePricingSettings } from "@/hooks/usePricingSettings";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Wallet() {
  const navigate = useNavigate();
  const { walletQuery, transactionsQuery } = useWallet();
  const { pricingQuery, upsertMarkup } = usePricingSettings();
  const { createTopup, checkTopup } = useWalletTopup();

  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState("1,00");
  const [activeTopupId, setActiveTopupId] = useState<string | null>(null);
  const [activeTopup, setActiveTopup] = useState<any | null>(null);
  const [markupDraft, setMarkupDraft] = useState<string>("0");

  useEffect(() => {
    if (pricingQuery.data) setMarkupDraft(String(pricingQuery.data.markup_percent ?? 0));
  }, [pricingQuery.data]);

  // polling while pending
  useEffect(() => {
    if (!activeTopupId || !activeTopup || activeTopup.status === "paid") return;
    const t = setInterval(async () => {
      try {
        const res = await checkTopup.mutateAsync(activeTopupId);
        setActiveTopup(res.topup);
        if (res.topup?.status === "paid") {
          toast.success("Recarga confirmada!", { description: "Seu saldo foi creditado." });
        }
      } catch {
        // ignore (user can click manual check)
      }
    }, 8000);
    return () => clearInterval(t);
  }, [activeTopupId, activeTopup, checkTopup]);

  const credits = walletQuery.data?.credits ?? 0;

  const handleSidebarSectionChange = (section: string) => {
    navigate(`/?section=${encodeURIComponent(section)}`);
  };

  const parsedAmount = useMemo(() => {
    const n = Number(amount.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const canCreate = parsedAmount >= 1;

  const startTopup = async () => {
    try {
      const topup = await createTopup.mutateAsync(parsedAmount);
      setActiveTopupId(topup.id);
      setActiveTopup(topup);
    } catch (e) {
      toast.error("Falha ao gerar PIX", { description: e instanceof Error ? e.message : "Erro desconhecido" });
    }
  };

  const manualCheck = async () => {
    if (!activeTopupId) return;
    try {
      const res = await checkTopup.mutateAsync(activeTopupId);
      setActiveTopup(res.topup);
      if (res.topup?.status === "paid") {
        toast.success("Recarga confirmada!", { description: "Seu saldo foi creditado." });
      } else {
        toast.message("Ainda não confirmado", { description: `Status: ${res.topup?.status ?? "—"}` });
      }
    } catch (e) {
      toast.error("Erro ao verificar", { description: e instanceof Error ? e.message : "Erro desconhecido" });
    }
  };

  const copyPix = async () => {
    const code = activeTopup?.pix_code;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  };

  const saveMarkup = async () => {
    try {
      const n = Number(markupDraft.replace(",", "."));
      await upsertMarkup.mutateAsync(n);
      toast.success("Markup salvo");
    } catch (e) {
      toast.error("Falha ao salvar", { description: e instanceof Error ? e.message : "Erro desconhecido" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full relative theme-engajamento">
      <SubscriptionBanner />
      <FloatingSidebar activeSection="engajamento" onSectionChange={(s) => handleSidebarSectionChange(s)} />

      <main className="flex-1 p-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
              <WalletIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Carteira</h1>
              <p className="text-sm text-muted-foreground">Recarregue via PIX e configure seu markup.</p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="border-primary/15 hover:border-primary/30">
              <CardHeader className="space-y-1">
                <CardTitle>Saldo de créditos</CardTitle>
                <CardDescription>1 crédito = R$ 1,00</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-semibold tabular-nums">
                  {walletQuery.isLoading ? "..." : credits.toFixed(2)}
                  <span className="ml-2 text-base text-muted-foreground">créditos</span>
                </div>
                <div className="text-sm text-muted-foreground">Equivalente: {formatBRL(credits)}</div>

                <div className="flex items-center gap-2">
                  <Button type="button" className="gap-2" onClick={() => setTopupOpen(true)}>
                    <CreditCard className="h-4 w-4" />
                    Recarregar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      walletQuery.refetch();
                      transactionsQuery.refetch();
                    }}
                    disabled={walletQuery.isFetching || transactionsQuery.isFetching}
                    className="gap-2"
                  >
                    <RefreshCw
                      className={
                        walletQuery.isFetching || transactionsQuery.isFetching
                          ? "h-4 w-4 animate-spin"
                          : "h-4 w-4"
                      }
                    />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-primary/15 hover:border-primary/30">
              <CardHeader className="space-y-1">
                <CardTitle>Markup (%)</CardTitle>
                <CardDescription>Define seu preço final: custo × (1 + markup/100)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <Label htmlFor="markup">Markup</Label>
                    <Input
                      id="markup"
                      value={markupDraft}
                      onChange={(e) => setMarkupDraft(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="50"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end gap-2">
                    <Button type="button" onClick={saveMarkup} disabled={upsertMarkup.isPending}>
                      {upsertMarkup.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Atual: {pricingQuery.isLoading ? "..." : `${(pricingQuery.data?.markup_percent ?? 0).toFixed(2)}%`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/15 hover:border-primary/30">
            <CardHeader className="space-y-1">
              <CardTitle>Histórico</CardTitle>
              <CardDescription>Últimas movimentações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactionsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : transactionsQuery.data?.length ? (
                <div className="space-y-2">
                  {transactionsQuery.data.map((t: any) => (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="font-medium">{t.type}</div>
                      <div className="tabular-nums">
                        {Number(t.credits).toFixed(2)} cr
                        {t.amount_brl != null ? ` • ${formatBRL(Number(t.amount_brl))}` : ""}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem movimentações ainda.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="sm:max-w-md glass-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Recarregar via PIX
            </DialogTitle>
            <DialogDescription>Mínimo R$ 1,00</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!activeTopup ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="1,00"
                    inputMode="decimal"
                  />
                  <div className="text-xs text-muted-foreground">Você receberá {formatBRL(Math.max(parsedAmount, 0))} em créditos.</div>
                </div>

                <Button type="button" onClick={startTopup} disabled={!canCreate || createTopup.isPending} className="w-full">
                  {createTopup.isPending ? "Gerando..." : "Gerar PIX"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium">{activeTopup.status}</div>
                </div>
                <Separator />

                  <div className="flex justify-center">
                  <div className="w-44 h-44 bg-qr rounded-xl p-3 flex items-center justify-center">
                    {activeTopup.pix_qr_code ? (
                      <img src={activeTopup.pix_qr_code} alt="QR Code PIX" className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Código PIX</Label>
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs break-all select-all">
                    {activeTopup.pix_code || "—"}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={copyPix} disabled={!activeTopup.pix_code} className="gap-2 flex-1">
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                    <Button type="button" onClick={manualCheck} disabled={checkTopup.isPending} className="gap-2 flex-1">
                      <RefreshCw className={checkTopup.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                      Verificar
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setActiveTopup(null);
                    setActiveTopupId(null);
                    setAmount("1,00");
                  }}
                >
                  Gerar outro PIX
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
