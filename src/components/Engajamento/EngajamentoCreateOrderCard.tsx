import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import type { SmmService } from "@/hooks/useSmmPanel";
import { EngajamentoServiceList } from "@/components/Engajamento/EngajamentoServiceList";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { useSmmOrders } from "@/hooks/useSmmOrders";
import { useSmmFavorites } from "@/hooks/useSmmFavorites";
import { useWallet } from "@/hooks/useWallet";

function computeProviderCost(rate: string | undefined, quantity: number) {
  if (!rate) return null;
  const r = Number(String(rate).replace(/,/g, "."));
  if (!Number.isFinite(r) || r <= 0) return null;
  if (quantity > 0) return (r * quantity) / 1000;
  return r;
}

export function EngajamentoCreateOrderCard(props: {
  services: SmmService[];
  categories: string[];
  isLoadingServices: boolean;
  isFetchingServices: boolean;
  isErrorServices: boolean;
  servicesError?: unknown;
  refetchServices: () => unknown;
}) {
  const ALL_CATEGORIES_VALUE = "__all__";
  const FAVORITES_CATEGORY_VALUE = "__favorites__";

  const extractPlatform = (s: SmmService): string | null => {
    // Objetivo: Categoria = "plataforma" (TikTok/Instagram/etc) e NÃO o texto completo do serviço.
    // A maioria dos painéis vem com category tipo "Instagram - Followers".
    const raw = String(s.category ?? "").trim();
    if (!raw) return null;

    // separadores comuns
    const head = raw.split(/\s*[-|/\\>]\s*/)[0]?.trim();
    const clean = (head || raw).trim();
    if (!clean) return null;

    // normaliza variações mais comuns
    const lower = clean.toLowerCase();
    const map: Record<string, string> = {
      insta: "INSTAGRAM",
      instagram: "INSTAGRAM",
      ig: "INSTAGRAM",
      tiktok: "TIKTOK",
      tik: "TIKTOK",
      youtube: "YOUTUBE",
      yt: "YOUTUBE",
      facebook: "FACEBOOK",
      fb: "FACEBOOK",
      twitter: "TWITTER",
      x: "X",
      telegram: "TELEGRAM",
      whatsapp: "WHATSAPP",
      spotify: "SPOTIFY",
      twitch: "TWITCH",
      kwai: "KWAI",
      pinterest: "PINTEREST",
      linkedin: "LINKEDIN",
      snapchat: "SNAPCHAT",
      discord: "DISCORD",
      threads: "THREADS",
    };

    // pega a primeira palavra como chave (ex.: "Instagram Reels" -> "instagram")
    const firstWord = lower.split(/\s+/)[0] ?? lower;
    const normalized = map[firstWord];
    return normalized ?? clean.toUpperCase();
  };

  const { pricingQuery } = usePricingSettings();
  const { walletQuery } = useWallet();
  const { createOrder } = useSmmOrders();
  const favorites = useSmmFavorites({ limit: 200 });

  const [category, setCategory] = useState<string>(ALL_CATEGORIES_VALUE);
  const [search, setSearch] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [comments, setComments] = useState("");
  const [runs, setRuns] = useState("");
  const [interval, setInterval] = useState("");

  const servicesErrorMessage =
    props.servicesError instanceof Error ? props.servicesError.message : "Erro desconhecido";

  const availablePlatforms = useMemo(() => {
    const present = new Set<string>();
    for (const s of props.services) {
      const p = extractPlatform(s);
      if (p) present.add(p);
    }

    const preferred = [
      "INSTAGRAM",
      "TIKTOK",
      "WHATSAPP",
      "YOUTUBE",
      "FACEBOOK",
      "TELEGRAM",
      "TWITTER",
      "X",
    ];

    const rest = Array.from(present)
      .filter((p) => !preferred.includes(p))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    const ordered = preferred.filter((p) => present.has(p));
    return [...ordered, ...rest];
  }, [props.services]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.services
      .filter((s) => {
        if (category === FAVORITES_CATEGORY_VALUE) {
          return favorites.favoriteIdSet.has(s.service);
        }
        if (category !== ALL_CATEGORIES_VALUE) {
          const p = extractPlatform(s);
          if (!p || p !== category) return false;
        }
        if (!q) return true;
        return String(s.service).includes(q) || (s.name ?? "").toLowerCase().includes(q);
      })
      .slice(0, 500);
  }, [props.services, category, search, favorites.favoriteIdSet]);

  const selectedService = useMemo(() => {
    const id = Number(serviceId);
    if (!id) return null;
    return props.services.find((s) => s.service === id) ?? null;
  }, [serviceId, props.services]);

  const isPackage = useMemo(() => {
    const type = (selectedService?.type ?? "").toLowerCase();
    return type.includes("package");
  }, [selectedService]);

  const requiresComments = useMemo(() => {
    const type = (selectedService?.type ?? "").toLowerCase();
    const name = (selectedService?.name ?? "").toLowerCase();
    return type.includes("comment") || name.includes("comment");
  }, [selectedService]);

  const supportsDripfeed = Boolean(selectedService?.dripfeed);

  const quantityNumber = Number(quantity || 0);
  const providerCost = useMemo(
    () => computeProviderCost(selectedService?.rate, isPackage ? 0 : quantityNumber),
    [selectedService?.rate, quantityNumber, isPackage],
  );

  const priceBreakdown = useMemo(() => {
    if (providerCost == null) return null;
    const markup = Number(pricingQuery.data?.markup_percent ?? 0);
    const rawFinal = providerCost * (1 + markup / 100);
    const finalPrice = Math.ceil(rawFinal * 100) / 100;
    const profit = Number((finalPrice - providerCost).toFixed(2));
    return {
      providerCost: Number(providerCost.toFixed(2)),
      markup,
      finalPrice: Number(finalPrice.toFixed(2)),
      profit,
    };
  }, [providerCost, pricingQuery.data?.markup_percent]);

  const hasBalance = useMemo(() => {
    const credits = Number(walletQuery.data?.credits ?? 0);
    const need = Number(priceBreakdown?.finalPrice ?? 0);
    if (!need) return true;
    return credits >= need;
  }, [walletQuery.data?.credits, priceBreakdown?.finalPrice]);

  const canSubmit = useMemo(() => {
    if (!serviceId) return false;
    if (!link.trim()) return false;
    if (!priceBreakdown) return false;
    if (!hasBalance) return false;
    if (!isPackage && !(Number(quantity) > 0)) return false;
    if (requiresComments && !comments.trim()) return false;
    if (supportsDripfeed) {
      if (runs && Number(runs) <= 0) return false;
      if (interval && Number(interval) <= 0) return false;
    }
    return true;
  }, [serviceId, link, priceBreakdown, hasBalance, isPackage, quantity, requiresComments, comments, supportsDripfeed, runs, interval]);

  const handleCreateOrder = async () => {
    if (!canSubmit) return;
    try {
      const payload: any = {
        service_id: Number(serviceId),
        link: link.trim(),
      };
      if (!isPackage) payload.quantity = Number(quantity);
      if (requiresComments) payload.comments = comments;
      if (supportsDripfeed) {
        if (runs) payload.runs = Number(runs);
        if (interval) payload.interval = Number(interval);
      }

      const res = await createOrder.mutateAsync(payload);
      toast.success("Pedido criado com sucesso", {
        description: res?.provider_order_id ? `Pedido #${res.provider_order_id}` : undefined,
      });
      setLink("");
      setQuantity("");
      setComments("");
      setRuns("");
      setInterval("");
    } catch (e) {
      toast.error("Erro ao criar pedido", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  };

  return (
    <Card className="border-primary/15 hover:border-primary/30">
      <CardHeader className="space-y-1">
        <CardTitle>Criar pedido</CardTitle>
        <CardDescription>Escolha um serviço, informe o link e a quantidade.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label>Categoria</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setServiceId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_VALUE}>Todas</SelectItem>
                <SelectItem value={FAVORITES_CATEGORY_VALUE}>⭐ Favoritos</SelectItem>
                {availablePlatforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Buscar</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="id ou nome" />
          </div>

          <div className="md:col-span-2">
            <Label>Serviços</Label>
            <EngajamentoServiceList
              isLoading={props.isLoadingServices}
              isError={props.isErrorServices}
              errorMessage={servicesErrorMessage}
              isFetching={props.isFetchingServices}
              onRetry={() => props.refetchServices()}
              services={filteredServices}
              onSelectService={(id) => setServiceId(String(id))}
              isFavorite={(id) => favorites.isFavorite(id)}
              onToggleFavorite={(id) => favorites.toggleFavorite(id)}
            />
          </div>

          <div className="md:col-span-4">
            <Label htmlFor="smm-link">Link</Label>
            <Input
              id="smm-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://instagram.com/..."
              autoComplete="off"
            />
          </div>

          {!isPackage && (
            <div className="md:col-span-2">
              <Label htmlFor="smm-qty">Quantidade</Label>
              <Input
                id="smm-qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="100"
                inputMode="numeric"
              />
            </div>
          )}

          {requiresComments && (
            <div className="md:col-span-6">
              <Label htmlFor="smm-comments">Comentários (1 por linha)</Label>
              <Textarea
                id="smm-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={5}
                placeholder={"good pic\ngreat photo\n:)\n;)"}
              />
            </div>
          )}

          {supportsDripfeed && (
            <>
              <div className="md:col-span-3">
                <Label>Runs</Label>
                <Input value={runs} onChange={(e) => setRuns(e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
              <div className="md:col-span-3">
                <Label>Interval (min)</Label>
                <Input
                  value={interval}
                  onChange={(e) => setInterval(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
            </>
          )}
        </div>

        {selectedService && (
          <div className="space-y-1 text-xs">
            {selectedService.category && (
              <p className="text-muted-foreground">Categoria: {selectedService.category}</p>
            )}
            {selectedService.rate && (
              <p className="text-muted-foreground">
                Rate (custo):{" "}
                <span className="font-semibold text-foreground">{selectedService.rate}</span>
                {isPackage ? " (pacote)" : " por 1000"}
              </p>
            )}
            {selectedService.min && selectedService.max && (
              <p className="text-muted-foreground">
                Mín: {selectedService.min} • Máx: {selectedService.max}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {priceBreakdown && (
            <div className="text-sm space-y-0.5">
              <div className="font-medium">
                Custo (API):{" "}
                <span className="text-primary tabular-nums">{priceBreakdown.providerCost.toFixed(2)}</span>
              </div>
              <div className="text-muted-foreground">
                Markup (global): <span className="tabular-nums">{priceBreakdown.markup.toFixed(2)}%</span>
                {" "}• Preço final: <span className="tabular-nums">{priceBreakdown.finalPrice.toFixed(2)}</span>
                {" "}• Lucro: <span className="tabular-nums">{priceBreakdown.profit.toFixed(2)}</span>
              </div>
              {!hasBalance && (
                <div className="text-destructive text-xs">
                  Saldo insuficiente para este pedido.
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />
          <Button
            type="button"
            onClick={handleCreateOrder}
            disabled={!canSubmit || createOrder.isPending}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            {createOrder.isPending ? "Enviando..." : "Criar pedido"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
