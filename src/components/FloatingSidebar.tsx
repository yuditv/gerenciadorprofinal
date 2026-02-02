import { useState } from "react";
import { Users, Bot, Flame, Crown, Headset, Search, User, Settings, LogOut, BarChart3, CreditCard, Smartphone, ChevronDown, TrendingUp, Wallet, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logoFuturistic from "@/assets/logo-red-futuristic.png";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAccountContext } from "@/hooks/useAccountContext";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useGlobalCustomerChatNotifications } from "@/hooks/useGlobalCustomerChatNotifications";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Custom WhatsApp icon
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export type AppSection = "clients" | "whatsapp" | "filter-numbers" | "ai-agent" | "warm-chips" | "revenda" | "iptv" | "admin" | "atendimento" | "engajamento" | "crm-kanban";

type PermissionKey = 
  | 'can_view_clients'
  | 'can_view_whatsapp'
  | 'can_view_warming'
  | 'can_view_ai_agent'
  | 'can_view_reseller'
  | 'can_view_inbox';

interface MenuItem {
  id: AppSection;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  adminOnly?: boolean;
  permissionKey?: PermissionKey;
}

const menuItems: MenuItem[] = [
  {
    id: "admin",
    title: "Painel Admin",
    icon: Crown,
    color: "text-red-500",
    bgColor: "bg-red-500",
    adminOnly: true,
  },
  {
    id: "clients",
    title: "Gerenciador",
    icon: Users,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    permissionKey: "can_view_clients",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    icon: WhatsAppIcon,
    color: "text-green-500",
    bgColor: "bg-green-500",
    permissionKey: "can_view_whatsapp",
  },
  {
    id: "atendimento",
    title: "Atendimento",
    icon: Headset,
    color: "text-teal-500",
    bgColor: "bg-teal-500",
    permissionKey: "can_view_inbox",
  },
  {
    id: "ai-agent",
    title: "Agente IA",
    icon: Bot,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500",
    permissionKey: "can_view_ai_agent",
  },
  {
    id: "warm-chips",
    title: "Aquecer",
    icon: Flame,
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    permissionKey: "can_view_warming",
  },
  {
    id: "engajamento",
    title: "Engajamento",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
  },
  {
    id: "crm-kanban",
    title: "CRM Kanban",
    icon: LayoutGrid,
    color: "text-pink-500",
    bgColor: "bg-pink-500",
  },
];

interface FloatingSidebarProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
}

export function FloatingSidebar({ activeSection, onSectionChange }: FloatingSidebarProps) {
  const navigate = useNavigate();
  const { permissions, isAdmin } = useUserPermissions();
  const { isMember } = useAccountContext();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { ref: menuScrollRef, isDragging: isMenuDragging, handlers: menuDragHandlers } = useDragScroll<HTMLDivElement>();
  const { unreadCount: customerChatUnread, hasNewMessage: hasNewCustomerMessage } = useGlobalCustomerChatNotifications();

  const handleClick = (item: MenuItem) => {
    if (item.id === 'admin') {
      navigate('/admin');
    } else if (item.id === 'engajamento') {
      navigate('/engajamento');
    } else {
      onSectionChange(item.id);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso!');
  };

  const visibleMenuItems = menuItems.filter((item) => {
    // Attendants: Inbox only
    if (isMember) return item.id === "atendimento";

    if (item.adminOnly) return isAdmin;
    if (item.permissionKey) return permissions[item.permissionKey];
    return true;
  });

  return (
    <TooltipProvider delayDuration={0}>
      <motion.header
        className={cn(
          "w-full border-b border-primary/20 shrink-0 z-50",
        )}
        style={{
          background: "hsl(230 18% 8% / 0.7)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.25), 0 0 60px hsl(0 75% 55% / 0.08), inset 0 1px 0 hsl(0 75% 55% / 0.1)"
        }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center h-14 sm:h-16 px-3 sm:px-6 gap-3 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 pr-3 sm:pr-6 border-border/50 shrink-0 border-r-0 sm:border-r">
            <div className="relative">
              <img
                src="/pwa-192x192.png"
                alt="ATLAS 2.0"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-contain"
              />
              <motion.div 
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className="font-bold text-xl text-gradient hidden sm:inline">ATLAS 2.0</span>
          </div>

          {/* Menu Items */}
          <nav
            ref={menuScrollRef}
            {...menuDragHandlers}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 flex-1 overflow-x-auto scrollbar-hide",
              "select-none",
              isMenuDragging ? "cursor-grabbing" : "cursor-grab",
            )}
          >
            {visibleMenuItems.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon;
              
              // Show notification badge for Atendimento when there are unread customer chat messages
              const showNotificationBadge = item.id === 'atendimento' && customerChatUnread > 0;
              const isPulsing = item.id === 'atendimento' && hasNewCustomerMessage;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => handleClick(item)}
                      className={cn(
                        "relative flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shrink-0",
                        "transition-all duration-200 ease-out",
                        "hover:bg-muted/50",
                        isActive && "bg-primary text-primary-foreground shadow-lg"
                      )}
                      style={isActive ? {
                        boxShadow: `0 4px 16px hsl(var(--primary) / 0.35)`
                      } : undefined}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1.5 w-10 h-1 rounded-t-full bg-primary"
                          style={{
                            boxShadow: "0 0 10px hsl(var(--primary))"
                          }}
                        />
                      )}

                      <div className="relative">
                        <Icon className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive ? "text-current" : item.color
                        )} />
                        
                        {/* Notification badge for customer chat */}
                        {showNotificationBadge && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={cn(
                              "absolute -top-1.5 -right-1.5 flex items-center justify-center",
                              "min-w-[18px] h-[18px] px-1 rounded-full",
                              "bg-destructive text-destructive-foreground text-[10px] font-bold",
                              isPulsing && "animate-pulse"
                            )}
                            style={{
                              boxShadow: isPulsing 
                                ? "0 0 10px hsl(var(--destructive)), 0 0 20px hsl(var(--destructive) / 0.5)" 
                                : undefined
                            }}
                          >
                            {customerChatUnread > 99 ? '99+' : customerChatUnread}
                          </motion.div>
                        )}
                      </div>

                      <span className={cn(
                        "text-base font-medium whitespace-nowrap hidden md:inline",
                        isActive ? "text-current" : "text-foreground"
                      )}>
                        {item.title}
                      </span>
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {item.title}
                    {showNotificationBadge && ` (${customerChatUnread} nova${customerChatUnread > 1 ? 's' : ''})`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="pl-2 sm:pl-6 border-border/50 shrink-0 border-l-0 sm:border-l">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  className={cn(
                    "flex items-center gap-3 p-1.5 sm:p-2 rounded-xl",
                    "transition-all duration-200 ease-out",
                    "hover:bg-muted/50"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary text-base">
                      {profile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:flex flex-col items-start overflow-hidden">
                    <span className="text-base font-medium text-foreground truncate max-w-[120px]">
                      {profile?.display_name || 'Usuário'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="glass-card border-primary/20 w-56" style={{ background: "hsl(230 18% 10% / 0.9)", backdropFilter: "blur(24px)" }}>
                <div className="px-3 py-2 text-sm text-muted-foreground border-b border-border/50 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {profile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="font-medium text-foreground truncate">{profile?.display_name || 'Usuário'}</p>
                    <span className="text-xs text-muted-foreground truncate block">{user?.email}</span>
                  </div>
                </div>
                {!isMember && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="hover:bg-primary/10 mt-1">
                      <User className="h-4 w-4 mr-2 text-primary" />
                      Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/payment-history')} className="hover:bg-primary/10">
                      <CreditCard className="h-4 w-4 mr-2 text-primary" />
                      Histórico de Pagamentos
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate('/carteira')} className="hover:bg-primary/10">
                        <Wallet className="h-4 w-4 mr-2 text-primary" />
                        Carteira
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/my-dashboard')} className="hover:bg-primary/10">
                      <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                      Meu Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/dashboard')} className="hover:bg-primary/10">
                      <BarChart3 className="h-4 w-4 mr-2 text-accent" />
                      Dashboard Geral
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/50" />
                    <DropdownMenuItem onClick={() => navigate('/install')} className="hover:bg-primary/10">
                      <Smartphone className="h-4 w-4 mr-2 text-primary" />
                      Instalar App
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="hover:bg-primary/10">
                      <Settings className="h-4 w-4 mr-2 text-primary" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/50" />
                  </>
                )}
                <DropdownMenuItem onClick={handleSignOut} className="hover:bg-destructive/10 text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.header>
    </TooltipProvider>
  );
}
