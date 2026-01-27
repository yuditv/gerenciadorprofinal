import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Edit, Search, Loader2, Globe, User, MessageSquareText, PanelRightClose, Image, Video, Music, FileText, Plus, MoreVertical, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCannedResponses, CannedResponse } from "@/hooks/useCannedResponses";
import { MediaUploadField } from "./Settings/MediaUploadField";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface QuickMessagesPanelProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => Promise<boolean>;
  onEditMessage: (content: string) => void;
  contactName?: string | null;
  phone?: string;
  onClose: () => void;
}

const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
};

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Arquivo',
};

type MediaValue = { url: string; type: 'image' | 'video' | 'audio' | 'document'; name: string } | null;

export function QuickMessagesPanel({
  onSendMessage,
  onEditMessage,
  contactName,
  phone,
  onClose
}: QuickMessagesPanelProps) {
  const { toast } = useToast();
  const { responses, isLoading, createResponse, updateResponse, deleteResponse } = useCannedResponses();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    short_code: "",
    content: "",
    is_global: false,
    media: null as MediaValue,
  });

  // Filter responses by search query
  const filteredResponses = responses.filter(r =>
    r.short_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Replace variables before sending
  const replaceVariables = (content: string) => {
    let result = content;
    if (contactName) {
      result = result.replace(/\{\{nome\}\}/gi, contactName);
    }
    if (phone) {
      result = result.replace(/\{\{telefone\}\}/gi, phone);
    }
    return result;
  };

  // Dialog handlers
  const handleOpenCreate = () => {
    setEditingResponse(null);
    setFormData({ short_code: "", content: "", is_global: false, media: null });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (response: CannedResponse) => {
    setEditingResponse(response);
    setFormData({
      short_code: response.short_code,
      content: response.content,
      is_global: response.is_global,
      media: response.media_url ? {
        url: response.media_url,
        type: response.media_type as 'image' | 'video' | 'audio' | 'document',
        name: response.media_name || 'Arquivo',
      } : null,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.short_code.trim()) {
      toast({ title: "Digite um código de atalho", variant: "destructive" });
      return;
    }
    if (!formData.content.trim() && !formData.media) {
      toast({ title: "Digite uma mensagem ou adicione mídia", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        short_code: formData.short_code.trim(),
        content: formData.content.trim(),
        is_global: formData.is_global,
        media_url: formData.media?.url || null,
        media_type: formData.media?.type || null,
        media_name: formData.media?.name || null,
      };

      if (editingResponse) {
        await updateResponse(editingResponse.id, payload);
        toast({ title: "Resposta atualizada" });
      } else {
        await createResponse(payload);
        toast({ title: "Resposta criada" });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving response:', error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteResponse(deleteConfirmId);
      toast({ title: "Resposta excluída" });
    } catch (error) {
      console.error('Error deleting response:', error);
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleQuickSend = async (response: CannedResponse) => {
    setSendingId(response.id);
    const content = replaceVariables(response.content);
    await onSendMessage(content, response.media_url || undefined, response.media_type || undefined);
    setSendingId(null);
  };

  const handleEdit = (response: CannedResponse) => {
    const content = replaceVariables(response.content);
    onEditMessage(content);
  };

  return (
    <>
      <motion.div 
        initial={{ width: 0, opacity: 0, x: 20 }}
        animate={{ width: 320, opacity: 1, x: 0 }}
        exit={{ width: 0, opacity: 0, x: 20 }}
        transition={{ 
          type: "spring",
          stiffness: 300,
          damping: 30,
          opacity: { duration: 0.2 }
        }}
        className="border-l flex flex-col h-full bg-muted/20 overflow-hidden"
      >
        {/* Header */}
        <div className="p-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm whitespace-nowrap">Mensagens Rápidas</h3>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleOpenCreate}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nova resposta</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={onClose}
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Messages List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquareText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? "Nenhuma mensagem encontrada" : "Nenhuma mensagem cadastrada"}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Criar nova resposta
                </Button>
              </div>
            ) : (
              filteredResponses.map((response) => {
                const MediaIcon = response.media_type ? MEDIA_TYPE_ICONS[response.media_type] : null;
                
                return (
                  <div
                    key={response.id}
                    className={cn(
                      "p-3 rounded-lg border bg-card transition-colors hover:bg-muted/50",
                      sendingId === response.id && "opacity-70"
                    )}
                  >
                    {/* Header with short code and badges */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {response.short_code}
                        </Badge>
                        {response.media_type && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                            {MediaIcon && <MediaIcon className="h-2.5 w-2.5" />}
                            {MEDIA_TYPE_LABELS[response.media_type]}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger>
                            {response.is_global ? (
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {response.is_global ? "Global" : "Pessoal"}
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleOpenEdit(response)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar resposta
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteConfirmId(response.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Media preview */}
                    {response.media_url && (
                      <div className="mb-2">
                        {response.media_type === 'image' ? (
                          <img 
                            src={response.media_url} 
                            alt="" 
                            className="w-full h-16 object-cover rounded-md" 
                          />
                        ) : response.media_type === 'video' ? (
                          <video 
                            src={response.media_url} 
                            className="w-full h-16 object-cover rounded-md" 
                          />
                        ) : (
                          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                            {MediaIcon && <MediaIcon className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-xs text-muted-foreground truncate">
                              {response.media_name || 'Arquivo anexado'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content preview */}
                    {response.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
                        {response.content.length > 80
                          ? `${response.content.substring(0, 80)}...`
                          : response.content}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleQuickSend(response)}
                        disabled={sendingId === response.id}
                      >
                        {sendingId === response.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Enviar
                      </Button>
                      
                      {!response.media_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEdit(response)}
                              disabled={sendingId === response.id}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar antes de enviar</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="p-2 border-t flex-shrink-0">
          <p className="text-[10px] text-muted-foreground text-center whitespace-nowrap">
            💡 Digite / no campo de mensagem para atalhos rápidos
          </p>
        </div>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingResponse ? "Editar Resposta" : "Nova Resposta"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Short code */}
            <div className="space-y-2">
              <Label htmlFor="short_code">Código de Atalho</Label>
              <Input
                id="short_code"
                placeholder="/oi, /preco, /horario"
                value={formData.short_code}
                onChange={(e) => setFormData(prev => ({ ...prev, short_code: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Use esse atalho digitando no campo de mensagem
              </p>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Mensagem</Label>
              <Textarea
                id="content"
                placeholder="Olá! Como posso ajudar?"
                rows={3}
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{nome}}"} e {"{{telefone}}"} para variáveis dinâmicas
              </p>
            </div>

            {/* Media */}
            <div className="space-y-2">
              <Label>Mídia (opcional)</Label>
              <MediaUploadField
                value={formData.media}
                onChange={(media) => setFormData(prev => ({ ...prev, media }))}
                disabled={isSaving}
              />
            </div>

            {/* Global toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is_global" className="cursor-pointer">Disponível para todos</Label>
                <p className="text-xs text-muted-foreground">
                  Outros usuários poderão usar esta resposta
                </p>
              </div>
              <Switch
                id="is_global"
                checked={formData.is_global}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_global: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingResponse ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A resposta será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
