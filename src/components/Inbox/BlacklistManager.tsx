import { useState } from 'react';
import { Ban, Plus, Trash2, Upload, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useGlobalBlacklist } from '@/hooks/useGlobalBlacklist';
import { toast } from 'sonner';

export function BlacklistManager() {
  const { entries, isLoading, addToBlacklist, addBulk, removeFromBlacklist } = useGlobalBlacklist();
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e =>
    e.phone.includes(search.replace(/\D/g, '')) || (e.reason || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!phone.trim()) return;
    try {
      await addToBlacklist(phone.trim(), reason.trim() || undefined);
      setPhone('');
      setReason('');
      toast.success('Número adicionado à blacklist');
    } catch {
      toast.error('Erro ao adicionar');
    }
  };

  const handleBulkAdd = async () => {
    const phones = bulkText
      .split(/[\n,;]+/)
      .map(p => p.trim())
      .filter(p => p.length >= 8);
    if (phones.length === 0) { toast.error('Nenhum número válido'); return; }
    try {
      await addBulk(phones, 'Importação em massa');
      setBulkText('');
      setShowBulk(false);
      toast.success(`${phones.length} números adicionados à blacklist`);
    } catch {
      toast.error('Erro ao importar');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeFromBlacklist(id);
      toast.success('Número removido da blacklist');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Ban className="h-4 w-4 text-destructive" />
            Blacklist Global
          </div>
          <Badge variant="outline" className="text-xs">
            {entries.length} números
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add single */}
        <div className="flex gap-2">
          <Input
            placeholder="Número de telefone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={handleAdd} disabled={!phone.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar na blacklist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        <ScrollArea className="h-64">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {search ? 'Nenhum resultado' : 'Blacklist vazia'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 group">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-mono">{entry.phone}</span>
                    {entry.reason && (
                      <span className="text-xs text-muted-foreground ml-2">— {entry.reason}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{entry.source}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => handleRemove(entry.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Bulk Dialog */}
        <Dialog open={showBulk} onOpenChange={setShowBulk}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Números em Massa</DialogTitle>
              <DialogDescription>
                Cole os números separados por vírgula, ponto-e-vírgula ou quebra de linha.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="5511999999999&#10;5511888888888&#10;..."
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={8}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulk(false)}>Cancelar</Button>
              <Button onClick={handleBulkAdd}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
