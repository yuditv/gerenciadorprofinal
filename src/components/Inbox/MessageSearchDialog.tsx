import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Calendar, FileType, X, Loader2, ChevronDown, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useMessageSearch, MessageSearchResult } from "@/hooks/useMessageSearch";

interface MessageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onMessageClick?: (messageId: string) => void;
}

const MESSAGE_TYPES = [
  { value: 'all', label: 'Todas' },
  { value: 'text', label: 'Texto' },
  { value: 'image', label: 'Imagens' },
  { value: 'video', label: 'Vídeos' },
  { value: 'audio', label: 'Áudios' },
  { value: 'document', label: 'Documentos' },
];

export function MessageSearchDialog({
  open,
  onOpenChange,
  conversationId,
  onMessageClick
}: MessageSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [messageType, setMessageType] = useState<string>("all");
  
  const { results, isSearching, hasMore, totalFound, searchMessages, loadMore, clearSearch } = useMessageSearch();

  // Clear when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setDateFrom(undefined);
      setDateTo(undefined);
      setMessageType("all");
      clearSearch();
    }
  }, [open, clearSearch]);

  const handleSearch = () => {
    if (!conversationId) return;
    
    searchMessages({
      conversationId,
      searchTerm: searchTerm.trim() || undefined,
      dateFrom,
      dateTo,
      messageType: messageType as 'all' | 'text' | 'image' | 'video' | 'audio' | 'document',
      limit: 20,
      offset: 0
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setMessageType("all");
    clearSearch();
  };

  const renderHighlightedContent = (result: MessageSearchResult) => {
    if (result.highlight) {
      // Convert **text** to bold spans
      const parts = result.highlight.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={i} className="bg-primary/30 font-semibold px-0.5 rounded">
              {part.slice(2, -2)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    }
    return result.content || '[Mídia]';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Mensagens
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por texto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Date From */}
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-32 justify-start text-left font-normal">
                  <Calendar className="mr-2 h-3 w-3" />
                  {dateFrom ? format(dateFrom, "dd/MM/yy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-32 justify-start text-left font-normal">
                  <Calendar className="mr-2 h-3 w-3" />
                  {dateTo ? format(dateTo, "dd/MM/yy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Message Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || dateFrom || dateTo || messageType !== 'all') && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Results Count */}
        {totalFound > 0 && (
          <div className="text-sm text-muted-foreground">
            {totalFound} mensagem(ns) encontrada(s)
          </div>
        )}

        {/* Results */}
        <ScrollArea className="flex-1 min-h-48 max-h-96">
          {results.length === 0 && !isSearching && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>Use os filtros acima para buscar mensagens</p>
            </div>
          )}

          <div className="space-y-2 pr-4">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => onMessageClick?.(result.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  "hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                  result.sender_type === 'contact' 
                    ? "border-l-4 border-l-blue-500"
                    : "border-l-4 border-l-green-500"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {result.sender_type === 'contact' ? 'Cliente' : 
                     result.sender_type === 'agent' ? 'Atendente' :
                     result.sender_type === 'ai' ? 'IA' : 'Sistema'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(result.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm line-clamp-2">
                  {renderHighlightedContent(result)}
                </p>
                {result.media_type && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    <FileType className="h-3 w-3 mr-1" />
                    {result.media_type.split('/')[0]}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadMore}
                disabled={isSearching}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Carregar mais
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
