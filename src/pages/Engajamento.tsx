import { TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FloatingSidebar } from "@/components/FloatingSidebar";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSmmPanel } from "@/hooks/useSmmPanel";
import { EngajamentoBalanceCard } from "@/components/Engajamento/EngajamentoBalanceCard";
import { EngajamentoCreateOrderCard } from "@/components/Engajamento/EngajamentoCreateOrderCard";
import { EngajamentoOrdersTab } from "@/components/Engajamento/EngajamentoOrdersTab";
import { EngajamentoReportsTab } from "@/components/Engajamento/EngajamentoReportsTab";

export default function Engajamento() {
  const navigate = useNavigate();
  const { balanceQuery, servicesQuery, categories } = useSmmPanel();

  const handleSidebarSectionChange = (section: string) => {
    // Mantém o padrão do app: trocar "seção" usando querystring na rota principal.
    navigate(`/?section=${encodeURIComponent(section)}`);
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

          <Tabs defaultValue="criar" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="criar">Criar pedido</TabsTrigger>
              <TabsTrigger value="pedidos">Meus pedidos</TabsTrigger>
              <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
            </TabsList>

            <TabsContent value="criar">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                  <EngajamentoBalanceCard balanceQuery={balanceQuery as any} />
                </div>
                <div className="md:col-span-2">
                  <EngajamentoCreateOrderCard
                    services={servicesQuery.data ?? []}
                    categories={categories}
                    isLoadingServices={servicesQuery.isLoading}
                    isFetchingServices={servicesQuery.isFetching}
                    isErrorServices={servicesQuery.isError}
                    servicesError={servicesQuery.error}
                    refetchServices={() => servicesQuery.refetch()}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pedidos">
              <EngajamentoOrdersTab services={servicesQuery.data ?? []} />
            </TabsContent>

            <TabsContent value="relatorios">
              <EngajamentoReportsTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
