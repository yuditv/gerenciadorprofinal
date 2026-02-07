import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Settings, Users, Tag, Zap, Play, ScrollText, Clock, Ban, MessageSquareText, PhoneOff, Bot, Shuffle, BarChart3 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAccountContext } from "@/hooks/useAccountContext";

// Settings components
import { LabelsSettings } from "@/components/Inbox/Settings/LabelsSettings";
import { TeamsSettings } from "@/components/Inbox/Settings/TeamsSettings";
import { AttendantsSettings } from "@/components/Inbox/Settings/AttendantsSettings";
import { MacrosSettings } from "@/components/Inbox/Settings/MacrosSettings";
import { AutomationSettings } from "@/components/Inbox/Settings/AutomationSettings";
import { AuditLogsSettings } from "@/components/Inbox/Settings/AuditLogsSettings";
import { BusinessHoursSettings } from "@/components/Inbox/Settings/BusinessHoursSettings";
import { BlockedContactsSettings } from "@/components/Inbox/Settings/BlockedContactsSettings";

import { CannedResponsesSettings } from "@/components/Inbox/Settings/CannedResponsesSettings";
import { CallSettings } from "@/components/Inbox/Settings/CallSettings";
import { BotProxySettings } from "@/components/Inbox/Settings/BotProxySettings";
import { AdvancedSettingsPanel } from "@/components/Inbox/Settings/AdvancedSettingsPanel";
import { BlacklistManager } from "@/components/Inbox/BlacklistManager";
import { DistributionSettings } from "@/components/Inbox/DistributionSettings";
import { CampaignMetrics } from "@/components/Inbox/CampaignMetrics";

type SettingsSection = 
  | "labels"
  | "teams"
  | "attendants"
  | "macros"
  | "automation"
  | "business-hours"
  | "blocked-contacts"
  | "audit-logs"
  | "canned-responses"
  | "call-settings"
  | "bot-proxy"
  | "advanced"
  | "blacklist"
  | "distribution"
  | "campaign-metrics";

interface MenuItem {
  id: SettingsSection;
  title: string;
  description: string;
  icon: React.ElementType;
}

const menuItems: MenuItem[] = [
  {
    id: "labels",
    title: "Etiquetas",
    description: "Gerenciar etiquetas coloridas",
    icon: Tag,
  },
  {
    id: "teams",
    title: "Equipes",
    description: "Agrupar agentes em times",
    icon: Users,
  },
  {
    id: "attendants",
    title: "Atendentes",
    description: "Criar acessos restritos",
    icon: Users,
  },
  {
    id: "macros",
    title: "Macros",
    description: "Ações automáticas pré-definidas",
    icon: Play,
  },
  {
    id: "automation",
    title: "Automação",
    description: "Regras baseadas em eventos",
    icon: Zap,
  },
  {
    id: "business-hours",
    title: "Horário Comercial",
    description: "Expediente por instância",
    icon: Clock,
  },
  {
    id: "blocked-contacts",
    title: "Contatos Bloqueados",
    description: "Gerenciar bloqueios do WhatsApp",
    icon: Ban,
  },
  {
    id: "canned-responses",
    title: "Mensagens Rápidas",
    description: "Respostas prontas para o chat",
    icon: MessageSquareText,
  },
  {
    id: "call-settings",
    title: "Chamadas",
    description: "Rejeitar ligações automático",
    icon: PhoneOff,
  },
  {
    id: "bot-proxy",
    title: "Ponte de Bot",
    description: "Encaminhar mensagens para bot",
    icon: Bot,
  },
  {
    id: "distribution",
    title: "Distribuição",
    description: "Atribuição automática round-robin",
    icon: Shuffle,
  },
  {
    id: "blacklist",
    title: "Blacklist Global",
    description: "Números bloqueados para envio",
    icon: Ban,
  },
  {
    id: "campaign-metrics",
    title: "Métricas de Campanhas",
    description: "Estatísticas de envio em massa",
    icon: BarChart3,
  },
  {
    id: "advanced",
    title: "Avançado",
    description: "SLA, Horário, Triagem e Motivos",
    icon: Settings,
  },
  {
    id: "audit-logs",
    title: "Auditoria",
    description: "Log de atividades do sistema",
    icon: ScrollText,
  },
];

export default function InboxSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<SettingsSection>("labels");
  const { isMember, isLoading: accountLoading } = useAccountContext();

  const effectiveMenu = useMemo(() => {
    // Attendants should not access the settings area
    if (isMember) return [] as MenuItem[];
    // If owner disabled label/macro management for attendants, still owner sees everything.
    return menuItems;
  }, [isMember]);

  useEffect(() => {
    if (!accountLoading && isMember) {
      navigate("/atendimento", { replace: true });
    }
  }, [accountLoading, isMember, navigate]);

  useEffect(() => {
    const section = searchParams.get('section') as SettingsSection | null;
    if (!section) return;

    const allowed: SettingsSection[] = [
      'labels',
      'teams',
      'attendants',
      'macros',
      'automation',
      'business-hours',
      'blocked-contacts',
      'audit-logs',
      'canned-responses',
      'call-settings',
      'bot-proxy',
      'advanced',
      'blacklist',
      'distribution',
      'campaign-metrics',
    ];

    if (allowed.includes(section)) setActiveSection(section);
  }, [searchParams]);

  const renderContent = () => {
    switch (activeSection) {
      case "labels":
        return <LabelsSettings />;
      case "teams":
        return <TeamsSettings />;
      case "attendants":
        return <AttendantsSettings />;
      case "macros":
        return <MacrosSettings />;
      case "automation":
        return <AutomationSettings />;
      case "business-hours":
        return <BusinessHoursSettings />;
      case "blocked-contacts":
        return <BlockedContactsSettings />;
      case "canned-responses":
        return <CannedResponsesSettings />;
      case "call-settings":
        return <CallSettings />;
      case "bot-proxy":
        return <BotProxySettings />;
      case "advanced":
        return <AdvancedSettingsPanel labels={[]} />;
      case "blacklist":
        return <BlacklistManager />;
      case "distribution":
        return <DistributionSettings />;
      case "campaign-metrics":
        return <CampaignMetrics />;
      case "audit-logs":
        return <AuditLogsSettings />;
      default:
        return <LabelsSettings />;
    }
  };

  // On mobile, track whether user is viewing the menu or the content
  const [showContent, setShowContent] = useState(false);

  const handleSelectSection = (id: SettingsSection) => {
    setActiveSection(id);
    setShowContent(true); // navigate to content on mobile
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-x-hidden">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-3 sm:px-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* On mobile when viewing content, show back-to-menu button */}
          {showContent ? (
            <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setShowContent(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className={cn("shrink-0", showContent && "hidden md:flex")} onClick={() => navigate('/atendimento')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold truncate">
              {showContent ? effectiveMenu.find(m => m.id === activeSection)?.title || 'Configurações' : 'Configurações do Inbox'}
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Menu — hidden on mobile when content is shown */}
        <aside className={cn(
          "w-full md:w-64 border-r shrink-0",
          showContent ? "hidden md:block" : "block"
        )}>
          <ScrollArea className="h-full">
            <nav className="p-2 sm:p-3 space-y-1">
              {effectiveMenu.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSection(item.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 mt-0.5 shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground"
                    )} />
                    <div className="min-w-0">
                      <div className={cn(
                        "font-medium text-sm",
                        isActive ? "text-primary-foreground" : "text-foreground"
                      )}>
                        {item.title}
                      </div>
                      <div className={cn(
                        "text-xs mt-0.5 truncate",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content Area — hidden on mobile when menu is shown */}
        <main className={cn(
          "flex-1 overflow-auto min-w-0",
          showContent ? "block" : "hidden md:block"
        )}>
          <div className="p-3 sm:p-6 max-w-4xl">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
