import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Download, RefreshCw, Copy, UserCheck, Search, Smartphone, ChevronRight, Shield } from "lucide-react";
import { motion } from "framer-motion";

interface GroupInfo {
  id: string;
  name?: string;
  subject?: string;
  size?: number;
  owner?: string;
}

interface Participant {
  phone: string;
  name: string;
  isAdmin: boolean;
}

export function GroupContactExtractor() {
  const { instances } = useWhatsAppInstances();
  const connectedInstances = instances.filter(i => i.status === 'connected');

  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFrom, setExtractedFrom] = useState<string[]>([]);

  const fetchGroups = useCallback(async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância");
      return;
    }

    setIsLoadingGroups(true);
    setGroups([]);
    setSelectedGroups(new Set());
    setParticipants([]);
    setExtractedFrom([]);

    try {
      const { data, error } = await supabase.functions.invoke('extract-group-contacts', {
        body: { action: 'list-groups', instanceId: selectedInstance }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar grupos');

      const groupList: GroupInfo[] = (data.groups || []).map((g: Record<string, unknown>) => {
        const pArr = g.participants as unknown[] | undefined;
        return {
          id: (g.id || g.jid || g.chatId || '') as string,
          name: (g.name || g.subject || g.groupName || 'Grupo sem nome') as string,
          size: (g.size as number) || (Array.isArray(pArr) ? pArr.length : 0),
          owner: (g.owner || '') as string,
        };
      }).filter((g: GroupInfo) => g.id);

      setGroups(groupList);
      toast.success(`${groupList.length} grupo(s) encontrado(s)`);
    } catch (err) {
      console.error('Error fetching groups:', err);
      toast.error("Erro ao buscar grupos. Verifique se a instância está conectada.");
    } finally {
      setIsLoadingGroups(false);
    }
  }, [selectedInstance]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedGroups.size === groups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(groups.map(g => g.id)));
    }
  };

  const extractContacts = useCallback(async () => {
    if (selectedGroups.size === 0) {
      toast.error("Selecione pelo menos um grupo");
      return;
    }

    setIsExtracting(true);
    const allParticipants: Participant[] = [];
    const extractedGroupNames: string[] = [];
    const seenPhones = new Set<string>();

    try {
      for (const groupId of selectedGroups) {
        const group = groups.find(g => g.id === groupId);
        const { data, error } = await supabase.functions.invoke('extract-group-contacts', {
          body: { action: 'get-participants', instanceId: selectedInstance, groupId }
        });

        if (error || !data?.success) {
          console.warn(`Failed to extract from ${groupId}:`, data?.error);
          continue;
        }

        extractedGroupNames.push(group?.name || groupId);
        
        for (const p of (data.participants || [])) {
          if (!seenPhones.has(p.phone)) {
            seenPhones.add(p.phone);
            allParticipants.push(p);
          }
        }
      }

      setParticipants(allParticipants);
      setExtractedFrom(extractedGroupNames);
      toast.success(`${allParticipants.length} contato(s) extraído(s) de ${extractedGroupNames.length} grupo(s)`);
    } catch (err) {
      console.error('Error extracting contacts:', err);
      toast.error("Erro ao extrair contatos");
    } finally {
      setIsExtracting(false);
    }
  }, [selectedGroups, selectedInstance, groups]);

  const copyNumbers = (withDDI: boolean) => {
    const numbers = participants.map(p => {
      if (withDDI) return p.phone;
      // Remove DDI (55 for Brazil)
      let num = p.phone;
      if (num.startsWith('55') && num.length > 10) {
        num = num.substring(2);
      }
      return num;
    });
    navigator.clipboard.writeText(numbers.join('\n'));
    toast.success(`${numbers.length} número(s) copiado(s)!`);
  };

  const exportCSV = () => {
    const header = "Telefone,Nome,Admin\n";
    const rows = participants.map(p => `${p.phone},${p.name || ''},${p.isAdmin ? 'Sim' : 'Não'}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos-grupos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <div className="space-y-6">
      {/* Instance Selection */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Selecionar Instância
          </CardTitle>
          <CardDescription>
            Escolha uma instância conectada para buscar os grupos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione uma instância..." />
              </SelectTrigger>
              <SelectContent>
                {connectedInstances.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      {inst.instance_name || inst.name}
                    </span>
                  </SelectItem>
                ))}
                {connectedInstances.length === 0 && (
                  <SelectItem value="none" disabled>
                    Nenhuma instância conectada
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={fetchGroups}
              disabled={!selectedInstance || isLoadingGroups}
              className="gap-2"
            >
              {isLoadingGroups ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar Grupos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      {groups.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Grupos Encontrados
                  <Badge variant="secondary">{groups.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Selecione os grupos dos quais deseja extrair os contatos
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selectedGroups.size === groups.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
                <Button
                  onClick={extractContacts}
                  disabled={selectedGroups.size === 0 || isExtracting}
                  size="sm"
                  className="gap-2"
                >
                  {isExtracting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Extrair ({selectedGroups.size})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {groups.map(group => (
                  <label
                    key={group.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50 ${
                      selectedGroups.has(group.id) ? 'border-primary/50 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Checkbox
                      checked={selectedGroups.has(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.id}</p>
                    </div>
                    {group.size ? (
                      <Badge variant="outline" className="shrink-0">
                        {group.size} membros
                      </Badge>
                    ) : null}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Extracted Contacts */}
      {participants.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-500" />
                  Contatos Extraídos
                  <Badge variant="default">{participants.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Extraídos de: {extractedFrom.join(', ')}
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => copyNumbers(true)}>
                  <Copy className="h-4 w-4" />
                  Copiar com DDI
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => copyNumbers(false)}>
                  <Copy className="h-4 w-4" />
                  Copiar sem DDI
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {participants.map((p, idx) => (
                  <div
                    key={`${p.phone}-${idx}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-sm font-mono text-muted-foreground w-8">{idx + 1}</span>
                    <span className="font-mono text-sm flex-1">{p.phone}</span>
                    {p.name && (
                      <span className="text-sm text-muted-foreground truncate max-w-[200px]">{p.name}</span>
                    )}
                    {p.isAdmin && (
                      <Badge variant="outline" className="gap-1 shrink-0">
                        <Shield className="h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {groups.length === 0 && !isLoadingGroups && (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Extrair Contatos de Grupos</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Selecione uma instância conectada e busque os grupos do WhatsApp para extrair todos os contatos de cada grupo.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
