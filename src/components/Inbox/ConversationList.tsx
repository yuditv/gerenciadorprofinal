import { useState, useMemo, useCallback, memo } from "react";
import { 
  Search, 
  Circle,
  Filter,
  Camera,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Conversation } from "@/hooks/useInboxConversations";
import { useContactAvatar } from "@/hooks/useContactAvatar";
import { useDebouncedCallback } from "@/hooks/useOptimizedCallbacks";
import { useInboxSLA } from "@/hooks/useInboxSLA";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ConversationListItem } from "./ConversationListItem";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  defaultAgentId?: string | null;
}

export const ConversationList = memo(function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  searchQuery,
  onSearchChange,
  defaultAgentId
}: ConversationListProps) {
  const [sortBy, setSortBy] = useState<'recent' | 'unread'>('recent');
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const { fetchAvatarsBatch, isLoading: isFetchingAvatars } = useContactAvatar();
  const { getSLAStatus } = useInboxSLA();

  // Debounced search to reduce re-renders during typing
  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value);
  }, 300);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Memoize sorted conversations to prevent recalculation
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (sortBy === 'unread') {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
      }
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [conversations, sortBy]);

  // Memoize the fetch avatars callback
  const handleFetchAvatars = useCallback(async () => {
    const convs = conversations.map(c => ({
      id: c.id,
      phone: c.phone,
      instance_id: c.instance_id,
      contact_avatar: c.contact_avatar
    }));
    await fetchAvatarsBatch(convs);
  }, [conversations, fetchAvatarsBatch]);

  // Stable callback for conversation selection
  const handleSelect = useCallback((conversation: Conversation) => {
    onSelect(conversation);
  }, [onSelect]);

  return (
    <div className="w-full md:w-80 border-r border-border/50 flex flex-col h-full bg-inbox-sidebar overflow-hidden">
      {/* Search Header */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={localSearch}
            onChange={handleSearchChange}
            className="pl-9 bg-inbox-input"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {conversations.length} conversas
          </span>
          <div className="flex items-center gap-1">
            {/* Fetch Avatars Button */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={isFetchingAvatars || conversations.length === 0}
                    onClick={handleFetchAvatars}
                  >
                    {isFetchingAvatars ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Atualizar fotos de perfil
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  {sortBy === 'recent' ? 'Recentes' : 'Não lidas'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border">
                <DropdownMenuItem onClick={() => setSortBy('recent')}>
                  Mais recentes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('unread')}>
                  Não lidas primeiro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="py-2">
            {sortedConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                defaultAgentId={defaultAgentId}
                onSelect={handleSelect}
                getSLAStatus={getSLAStatus}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});