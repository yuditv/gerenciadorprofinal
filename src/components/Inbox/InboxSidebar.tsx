import { useState } from "react";
import { 
  MessageSquare, 
  Inbox, 
  Tag, 
  BarChart3,
  ChevronDown,
  Circle,
  Bot,
  UserCheck,
  UserX,
  CheckCircle2,
  Mail,
  Kanban,
  Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationFilter, InboxLabel } from "@/hooks/useInboxConversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ConversationDateFilter } from "./ConversationDateFilter";
import { DateRange } from "react-day-picker";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
}

interface InboxSidebarProps {
  instances: WhatsAppInstance[];
  labels: InboxLabel[];
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  metrics: {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    unassigned: number;
    unread: number;
    mine: number;
  };
  activeTab: 'conversations' | 'customer-chat' | 'instance-chat' | 'dashboard' | 'kanban';
  onTabChange: (tab: 'conversations' | 'customer-chat' | 'instance-chat' | 'dashboard' | 'kanban') => void;
  showCustomerChatTab?: boolean;
  customerUnread?: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
}

export function InboxSidebar({
  instances,
  labels,
  filter,
  onFilterChange,
  metrics,
  activeTab,
  onTabChange,
  showCustomerChatTab = false,
  customerUnread = 0,
  dateRange,
  onDateRangeChange,
}: InboxSidebarProps) {
  const filterItems = [
    { 
      id: 'all', 
      label: 'Todas', 
      icon: MessageSquare, 
      count: metrics.total,
      filter: { status: 'all' as const, assignedTo: 'all' as const, instanceId: undefined, labelId: undefined }
    },
    { 
      id: 'mine', 
      label: 'Minhas', 
      icon: UserCheck, 
      count: metrics.mine,
      filter: { status: 'all' as const, assignedTo: 'me' as const, instanceId: undefined, labelId: undefined }
    },
    { 
      id: 'unassigned', 
      label: 'Não atribuídas', 
      icon: UserX, 
      count: metrics.unassigned,
      filter: { status: 'open' as const, assignedTo: 'unassigned' as const, instanceId: undefined, labelId: undefined }
    },
    { 
      id: 'open', 
      label: 'Abertas', 
      icon: Circle, 
      count: metrics.open,
      iconClass: "fill-green-500 text-green-500",
      filter: { status: 'open' as const, assignedTo: 'all' as const, instanceId: undefined, labelId: undefined }
    },
    { 
      id: 'resolved', 
      label: 'Compra Finalizada', 
      icon: CheckCircle2, 
      count: metrics.resolved,
      filter: { status: 'resolved' as const, assignedTo: 'all' as const, instanceId: undefined, labelId: undefined }
    },
  ];

  const isActiveFilter = (itemFilter: ConversationFilter) => {
    return (
      filter.status === itemFilter.status &&
      filter.assignedTo === itemFilter.assignedTo &&
      !filter.instanceId &&
      !filter.labelId
    );
  };

  const currentFilterLabel = filterItems.find(item => isActiveFilter(item.filter))?.label || 'Filtro';
  const selectedInstance = instances.find(i => i.id === filter.instanceId);
  const selectedLabel = labels.find(l => l.id === filter.labelId);

  return (
    <div className="w-full border-b border-border/50 bg-inbox-header shrink-0">
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
        {/* Logo/Title */}
        <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-border/50">
          <Bot className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold hidden sm:inline">Atendimento</span>
        </div>

        {/* Main Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={activeTab === 'conversations' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onTabChange('conversations')}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Conversas</span>
            {metrics.unread > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 h-4 ml-1">
                {metrics.unread}
              </Badge>
            )}
          </Button>

          {showCustomerChatTab && (
            <Button
              variant={activeTab === 'customer-chat' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => onTabChange('customer-chat')}
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Chat do Cliente</span>
              {customerUnread > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 h-4 ml-1">
                  {customerUnread}
                </Badge>
              )}
            </Button>
          )}

          <Button
            variant={activeTab === 'instance-chat' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onTabChange('instance-chat')}
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Chat Instância</span>
          </Button>

          <Button
            variant={activeTab === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onTabChange('kanban')}
          >
            <Kanban className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </Button>

          <Button
            variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onTabChange('dashboard')}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
        </div>

        <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />

        {activeTab === 'conversations' && (
          <>
            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Inbox className="h-4 w-4" />
                  <span className="hidden sm:inline">{currentFilterLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-popover border border-border">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Filtrar por</DropdownMenuLabel>
                {filterItems.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => onFilterChange(item.filter)}
                    className={cn(
                      "gap-2",
                      isActiveFilter(item.filter) && "bg-primary/10 text-primary"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", item.iconClass)} />
                    <span className="flex-1">{item.label}</span>
                    {item.count > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Instance Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filter.instanceId ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5"
                >
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-24 truncate">
                    {selectedInstance?.instance_name || 'Instância'}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover border border-border">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Instâncias</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onFilterChange({ ...filter, instanceId: undefined })}
                  className={cn(!filter.instanceId && "bg-primary/10 text-primary")}
                >
                  Todas as instâncias
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {instances.length === 0 ? (
                  <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                    Nenhuma instância
                  </DropdownMenuItem>
                ) : (
                  instances.map((instance) => (
                    <DropdownMenuItem
                      key={instance.id}
                      onClick={() => onFilterChange({ ...filter, instanceId: instance.id })}
                      className={cn(
                        "gap-2",
                        filter.instanceId === instance.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <Circle
                        className={cn(
                          "h-2.5 w-2.5 shrink-0",
                          instance.status === 'connected'
                            ? "fill-green-500 text-green-500"
                            : "fill-red-500 text-red-500"
                        )}
                      />
                      <span className="truncate">{instance.instance_name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Labels Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filter.labelId ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5"
                >
                  <Tag className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-24 truncate">
                    {selectedLabel?.name || 'Etiqueta'}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover border border-border">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Etiquetas</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onFilterChange({ ...filter, labelId: undefined })}
                  className={cn(!filter.labelId && "bg-primary/10 text-primary")}
                >
                  Todas as etiquetas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {labels.length === 0 ? (
                  <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                    Nenhuma etiqueta
                  </DropdownMenuItem>
                ) : (
                  labels.map((label) => (
                    <DropdownMenuItem
                      key={label.id}
                      onClick={() => onFilterChange({ ...filter, labelId: label.id })}
                      className={cn(
                        "gap-2",
                        filter.labelId === label.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: label.color }} />
                      <span className="truncate">{label.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date Range Filter */}
            {onDateRangeChange && (
              <ConversationDateFilter
                dateRange={dateRange}
                onDateRangeChange={onDateRangeChange}
              />
            )}

            {/* Active Filters Pills */}
            {(filter.instanceId || filter.labelId) && (
              <>
                <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
                <div className="flex items-center gap-1 shrink-0">
                  {filter.instanceId && selectedInstance && (
                    <Badge
                      variant="secondary"
                      className="h-6 gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => onFilterChange({ ...filter, instanceId: undefined })}
                    >
                      <Circle
                        className={cn(
                          "h-2 w-2",
                          selectedInstance.status === 'connected'
                            ? "fill-green-500 text-green-500"
                            : "fill-red-500 text-red-500"
                        )}
                      />
                      <span className="max-w-20 truncate text-xs">{selectedInstance.instance_name}</span>
                      <span className="text-muted-foreground">×</span>
                    </Badge>
                  )}
                  {filter.labelId && selectedLabel && (
                    <Badge
                      variant="secondary"
                      className="h-6 gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => onFilterChange({ ...filter, labelId: undefined })}
                    >
                      <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: selectedLabel.color }} />
                      <span className="max-w-20 truncate text-xs">{selectedLabel.name}</span>
                      <span className="text-muted-foreground">×</span>
                    </Badge>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
