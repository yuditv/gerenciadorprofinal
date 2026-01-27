import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Globe, User, Image, Video, Music, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useCannedResponses, CannedResponse } from "@/hooks/useCannedResponses";
import { useToast } from "@/hooks/use-toast";
import { MediaUploadField, MediaType } from "./MediaUploadField";

export function CannedResponsesSettings() {
  const { responses, isLoading, createResponse, updateResponse, deleteResponse } = useCannedResponses();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    short_code: "",
    content: "",
    is_global: false,
    media: null as { url: string; type: MediaType; name: string } | null,
  });

  const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
    image: Image,
    video: Video,
    audio: Music,
    document: FileText,
  };

  const filteredResponses = responses.filter(r => 
    r.short_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        type: response.media_type as MediaType,
        name: response.media_name || 'Arquivo',
      } : null,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.short_code.trim()) {
      toast({
        title: "Erro",
        description: "O código de atalho é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.content.trim() && !formData.media) {
      toast({
        title: "Erro",
        description: "Adicione um texto ou uma mídia",
        variant: "destructive",
      });
      return;
    }

    // Ensure short_code starts with /
    const shortCode = formData.short_code.startsWith("/") 
      ? formData.short_code 
      : `/${formData.short_code}`;

    try {
      if (editingResponse) {
        await updateResponse(editingResponse.id, {
          short_code: shortCode,
          content: formData.content,
          is_global: formData.is_global,
          media_url: formData.media?.url || null,
          media_type: formData.media?.type || null,
          media_name: formData.media?.name || null,
        });
        toast({ title: "Resposta atualizada com sucesso" });
      } else {
        await createResponse({
          short_code: shortCode,
          content: formData.content,
          is_global: formData.is_global,
          media_url: formData.media?.url || null,
          media_type: formData.media?.type || null,
          media_name: formData.media?.name || null,
        });
        toast({ title: "Resposta criada com sucesso" });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteResponse(deleteId);
      toast({ title: "Resposta excluída com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Respostas Prontas</h2>
        <p className="text-muted-foreground">
          Crie atalhos para enviar mensagens rapidamente. Digite o código no chat para expandir.
        </p>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar respostas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Resposta
        </Button>
      </div>

      {/* Responses List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredResponses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhuma resposta encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Tente outro termo de busca" : "Crie sua primeira resposta pronta"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredResponses.map((response) => {
            const MediaIcon = response.media_type ? MEDIA_TYPE_ICONS[response.media_type] : null;
            
            return (
              <Card key={response.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Media Preview */}
                      {response.media_url && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                          {response.media_type === 'image' ? (
                            <img 
                              src={response.media_url} 
                              alt={response.media_name || ''} 
                              className="w-full h-full object-cover" 
                            />
                          ) : response.media_type === 'video' ? (
                            <video 
                              src={response.media_url} 
                              className="w-full h-full object-cover" 
                            />
                          ) : MediaIcon ? (
                            <MediaIcon className="h-6 w-6 text-muted-foreground" />
                          ) : null}
                        </div>
                      )}

                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                            {response.short_code}
                          </code>
                          {response.media_type && (
                            <Badge variant="outline" className="gap-1 capitalize">
                              {MediaIcon && <MediaIcon className="h-3 w-3" />}
                              {response.media_type === 'image' ? 'Imagem' : 
                               response.media_type === 'video' ? 'Vídeo' :
                               response.media_type === 'audio' ? 'Áudio' : 'Arquivo'}
                            </Badge>
                          )}
                          {response.is_global ? (
                            <Badge variant="secondary" className="gap-1">
                              <Globe className="h-3 w-3" />
                              Global
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <User className="h-3 w-3" />
                              Pessoal
                            </Badge>
                          )}
                        </CardTitle>
                        {response.content && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2">
                            {response.content}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(response)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(response.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingResponse ? "Editar Resposta" : "Nova Resposta Pronta"}
            </DialogTitle>
            <DialogDescription>
              Crie um atalho para enviar mensagens rapidamente no chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="short_code">Código de Atalho</Label>
              <Input
                id="short_code"
                placeholder="/oi, /preco, /horario"
                value={formData.short_code}
                onChange={(e) => setFormData(prev => ({ ...prev, short_code: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Digite este código no chat para expandir a mensagem
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo da Mensagem</Label>
              <Textarea
                id="content"
                placeholder="Olá! Como posso ajudar você hoje?"
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{nome}}"} para inserir o nome do contato
              </p>
            </div>

            {/* Media Upload Field */}
            <div className="space-y-2">
              <Label>Mídia (opcional)</Label>
              <MediaUploadField
                value={formData.media}
                onChange={(media) => setFormData(prev => ({ ...prev, media }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is_global">Disponível para todos</Label>
                <p className="text-xs text-muted-foreground">
                  Outros agentes poderão usar esta resposta
                </p>
              </div>
              <Switch
                id="is_global"
                checked={formData.is_global}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_global: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingResponse ? "Salvar Alterações" : "Criar Resposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A resposta será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
