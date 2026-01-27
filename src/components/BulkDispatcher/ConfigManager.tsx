import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Save, FolderOpen, Trash2, MoreVertical, 
  Clock, MessageSquare, Smartphone, Check 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SavedDispatchConfig } from '@/hooks/useDispatchConfigs';
import { DispatchConfig } from '@/hooks/useBulkDispatch';
import { cn } from '@/lib/utils';

interface ConfigManagerProps {
  configs: SavedDispatchConfig[];
  currentConfig: DispatchConfig;
  isLoading: boolean;
  onSave: (name: string) => Promise<void>;
  onLoad: (config: SavedDispatchConfig) => void;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ConfigManager({
  configs,
  currentConfig,
  isLoading,
  onSave,
  onLoad,
  onUpdate,
  onDelete
}: ConfigManagerProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [configName, setConfigName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!configName.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(configName.trim());
      setSaveDialogOpen(false);
      setConfigName('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = (config: SavedDispatchConfig) => {
    onLoad(config);
    setLoadDialogOpen(false);
  };

  const handleUpdate = async (id: string, name: string) => {
    await onUpdate(id, name);
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
  };

  // Check if current config has content worth saving
  const hasContent = 
    currentConfig.messages.length > 0 || 
    currentConfig.instanceIds.length > 0;

  return (
    <>
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSaveDialogOpen(true)}
          disabled={!hasContent}
        >
          <Save className="w-4 h-4 mr-1" />
          Salvar
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLoadDialogOpen(true)}
          disabled={configs.length === 0}
        >
          <FolderOpen className="w-4 h-4 mr-1" />
          Carregar
          {configs.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {configs.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Configuração</DialogTitle>
            <DialogDescription>
              Salve a configuração atual para reutilizar em futuros disparos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="config-name">Nome da Configuração</Label>
              <Input
                id="config-name"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="Ex: Campanha de Renovação"
                autoFocus
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Esta configuração inclui:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{currentConfig.instanceIds.length} instância(s) selecionada(s)</li>
                <li>{currentConfig.messages.length} mensagem(ns)</li>
                <li>Delay: {currentConfig.minDelay}s - {currentConfig.maxDelay}s</li>
                {currentConfig.businessHoursEnabled && (
                  <li>Horário: {currentConfig.businessHoursStart} - {currentConfig.businessHoursEnd}</li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!configName.trim() || isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Carregar Configuração</DialogTitle>
            <DialogDescription>
              Selecione uma configuração salva para carregar
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2 py-4">
              {configs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma configuração salva</p>
                </div>
              ) : (
                configs.map((config) => (
                  <div
                    key={config.id}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all cursor-pointer",
                      selectedConfigId === config.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border"
                    )}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{config.name}</h4>
                          {selectedConfigId === config.id && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <Smartphone className="w-3 h-3 mr-1" />
                            {config.instance_ids.length} inst.
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {config.messages.length} msg
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {config.min_delay_seconds}s-{config.max_delay_seconds}s
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Atualizado {formatDistanceToNow(new Date(config.updated_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleLoad(config)}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Carregar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdate(config.id, config.name)}>
                            <Save className="w-4 h-4 mr-2" />
                            Sobrescrever
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(config.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                const config = configs.find(c => c.id === selectedConfigId);
                if (config) handleLoad(config);
              }}
              disabled={!selectedConfigId}
            >
              Carregar Selecionada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
