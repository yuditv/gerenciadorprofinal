import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, Upload, FileSpreadsheet, Trash2, 
  Check, X, Loader2, Download, AlertCircle,
  Database, Search, Plus, CheckCircle2, XCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface Contact {
  phone: string;
  name?: string;
  plan?: string;
  expires_at?: string;
  link?: string;
  email?: string;
  variables?: Record<string, string>;
  isValid?: boolean;
  whatsappName?: string;
  originalId?: string; // ID do contato original se veio de "Meus Contatos"
}

export interface SavedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

interface ContactsManagerProps {
  contacts: Contact[];
  verifyNumbers: boolean;
  onContactsChange: (contacts: Contact[]) => void;
  onVerifyChange: (verify: boolean) => void;
  onVerifyContacts?: (contacts: Contact[]) => Promise<Contact[]>;
  isVerifying?: boolean;
  verificationProgress?: number;
  savedContacts?: SavedContact[];
  isLoadingSaved?: boolean;
  onRefreshSaved?: () => void;
  onSaveContacts?: (contacts: { name: string; phone: string; email?: string }[]) => Promise<boolean>;
  isSaving?: boolean;
  // New props for lazy loading
  onTabChange?: (tab: string) => void;
  savedContactsTotal?: number;
  hasMoreSavedContacts?: boolean;
  onLoadMoreSavedContacts?: () => void;
  onSearchSavedContacts?: (query: string, limit?: number) => Promise<SavedContact[]>;
}

export function ContactsManager({
  contacts,
  verifyNumbers,
  onContactsChange,
  onVerifyChange,
  onVerifyContacts,
  isVerifying = false,
  verificationProgress = 0,
  savedContacts = [],
  isLoadingSaved = false,
  onRefreshSaved,
  onSaveContacts,
  isSaving = false,
  onTabChange,
  savedContactsTotal = 0,
  hasMoreSavedContacts = false,
  onLoadMoreSavedContacts,
  onSearchSavedContacts
}: ContactsManagerProps) {
  const [manualInput, setManualInput] = useState('');
  const [activeTab, setActiveTab] = useState('manual');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for saved contacts tab
  const [savedSearch, setSavedSearch] = useState('');
  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<string>>(new Set());
  const [autoSave, setAutoSave] = useState(false);
  const [searchResults, setSearchResults] = useState<SavedContact[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Debounced search for server-side filtering
  useEffect(() => {
    if (!savedSearch.trim()) {
      setSearchResults(null);
      return;
    }
    
    // For large datasets, use server-side search
    if (savedContactsTotal > 500 && onSearchSavedContacts) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        const results = await onSearchSavedContacts(savedSearch, 100);
        // Map Contact to SavedContact format
        setSearchResults(results.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          notes: c.notes
        })));
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [savedSearch, savedContactsTotal, onSearchSavedContacts]);

  // Handle tab change and notify parent
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const parseManualInput = useCallback((text: string): Contact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const phone = parts[0]?.replace(/\D/g, '') || '';
      const name = parts.slice(1).join(' ') || undefined;
      
      return { phone, name };
    }).filter(c => c.phone.length >= 10);
  }, []);

  const handleManualInputChange = (text: string) => {
    setManualInput(text);
    const parsed = parseManualInput(text);
    onContactsChange(parsed);
  };

  const handleFileUpload = async (file: File) => {
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const data = e.target?.result;
        
        if (file.name.endsWith('.txt')) {
          const text = data as string;
          const parsed = parseManualInput(text);
          onContactsChange(parsed);
          setManualInput(text);
          setActiveTab('manual');
        } else {
          // Excel/CSV
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          const parsed: Contact[] = [];
          
          // Try to detect headers
          const firstRow = jsonData[0] || [];
          const hasHeaders = firstRow.some((cell: any) => 
            typeof cell === 'string' && 
            /phone|telefone|whatsapp|nome|name/i.test(cell)
          );
          
          const startRow = hasHeaders ? 1 : 0;
          let phoneCol = 0;
          let nameCol = 1;
          
          if (hasHeaders) {
            phoneCol = firstRow.findIndex((h: string) => 
              /phone|telefone|whatsapp|celular/i.test(h)
            );
            nameCol = firstRow.findIndex((h: string) => 
              /nome|name|cliente/i.test(h)
            );
            if (phoneCol === -1) phoneCol = 0;
            if (nameCol === -1) nameCol = 1;
          }
          
          for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row[phoneCol]) continue;
            
            const phone = String(row[phoneCol]).replace(/\D/g, '');
            if (phone.length < 10) continue;
            
            parsed.push({
              phone,
              name: row[nameCol] ? String(row[nameCol]) : undefined
            });
          }
          
          onContactsChange(parsed);
          setManualInput(parsed.map(c => `${c.phone} ${c.name || ''}`).join('\n'));
        }
      };
      
      if (file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const clearContacts = () => {
    onContactsChange([]);
    setManualInput('');
  };

  const exportContacts = (type: 'valid' | 'invalid' | 'all') => {
    let toExport = contacts;
    if (type === 'valid') {
      toExport = contacts.filter(c => c.isValid === true);
    } else if (type === 'invalid') {
      toExport = contacts.filter(c => c.isValid === false);
    }
    
    const text = toExport.map(c => `${c.phone} ${c.name || ''}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_${type}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Display contacts: use search results if searching, otherwise use local filter for small datasets
  const displayedSavedContacts = useMemo(() => {
    // If server search returned results, use those
    if (searchResults !== null) return searchResults;
    
    // For small datasets or no search, filter locally
    if (!savedSearch.trim()) return savedContacts;
    const search = savedSearch.toLowerCase();
    return savedContacts.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.phone.includes(search)
    );
  }, [savedContacts, savedSearch, searchResults]);

  // Toggle contact selection
  const toggleSavedContact = useCallback((id: string) => {
    setSelectedSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible contacts
  const selectAllSaved = useCallback(() => {
    if (selectedSavedIds.size === displayedSavedContacts.length) {
      setSelectedSavedIds(new Set());
    } else {
      setSelectedSavedIds(new Set(displayedSavedContacts.map(c => c.id)));
    }
  }, [displayedSavedContacts, selectedSavedIds.size]);

  // Add selected saved contacts to dispatch list
  const handleAddSavedContacts = useCallback(() => {
    const existingPhones = new Set(contacts.map(c => c.phone));
    const selectedContacts = savedContacts.filter(c => selectedSavedIds.has(c.id));
    
    const newContacts = selectedContacts.filter(c => !existingPhones.has(c.phone));
    const duplicates = selectedContacts.length - newContacts.length;
    
    if (newContacts.length === 0) {
      toast.info('Todos os contatos selecionados já estão na lista');
      return;
    }
    
    // Include originalId to track contacts from saved list
    const formatted: Contact[] = newContacts.map(c => ({
      phone: c.phone,
      name: c.name,
      email: c.email,
      originalId: c.id // Track original contact ID for moving to sent list
    }));
    
    onContactsChange([...contacts, ...formatted]);
    setSelectedSavedIds(new Set());
    
    if (duplicates > 0) {
      toast.success(`${newContacts.length} contato(s) adicionado(s). ${duplicates} duplicado(s) ignorado(s)`);
    } else {
      toast.success(`${newContacts.length} contato(s) adicionado(s) ao disparo`);
    }
  }, [contacts, savedContacts, selectedSavedIds, onContactsChange]);

  // Get contacts that are not yet saved in the database
  const unsavedContacts = useMemo(() => {
    const savedPhones = new Set(savedContacts.map(c => c.phone));
    return contacts.filter(c => c.phone && !savedPhones.has(c.phone));
  }, [contacts, savedContacts]);

  // Save new contacts to database
  const handleSaveNewContacts = useCallback(async () => {
    if (!onSaveContacts || unsavedContacts.length === 0) return;
    
    const toSave = unsavedContacts.map(c => ({
      name: c.name || c.phone,
      phone: c.phone,
      email: c.email
    }));
    
    const success = await onSaveContacts(toSave);
    if (success) {
      toast.success(`${toSave.length} contato(s) salvo(s) na lista permanente`);
      onRefreshSaved?.();
    }
  }, [onSaveContacts, unsavedContacts, onRefreshSaved]);

  const validCount = contacts.filter(c => c.isValid === true).length;
  const invalidCount = contacts.filter(c => c.isValid === false).length;
  const uncheckedCount = contacts.filter(c => c.isValid === undefined).length;

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="stats-icon-container success">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Contatos</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie sua lista de destinatários
              </p>
            </div>
            <Badge className={cn(
              "transition-all",
              contacts.length > 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-muted"
            )}>
              {contacts.length} contato(s)
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="w-4 h-4" />
                Importar
              </Button>
            </motion.div>
            {contacts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearContacts}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full grid grid-cols-4 bg-muted/30 p-1">
            <TabsTrigger value="manual" className="data-[state=active]:bg-background">
              Manual
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-background">
              Upload
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5 data-[state=active]:bg-background">
              <Database className="w-3 h-3" />
              Meus
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-background">
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3">
            <Textarea
              value={manualInput}
              onChange={(e) => handleManualInputChange(e.target.value)}
              placeholder="Cole sua lista de contatos aqui...
Formato: telefone nome
Exemplo:
5511999998888 João Silva
5521988887777 Maria Santos"
              className="min-h-[200px] font-mono text-sm"
            />
            
            {/* Save to permanent list option */}
            {contacts.length > 0 && onSaveContacts && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <Switch
                    id="auto-save"
                    checked={autoSave}
                    onCheckedChange={setAutoSave}
                  />
                  <Label htmlFor="auto-save" className="text-sm">
                    Salvar novos contatos automaticamente
                  </Label>
                </div>
                {unsavedContacts.length > 0 && !autoSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveNewContacts}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 mr-1" />
                    )}
                    Salvar {unsavedContacts.length} novo(s)
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload">
            <motion.div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              whileHover={{ scale: 1.01 }}
              className={cn(
                "drop-zone-premium cursor-pointer",
                isDragging && "dragging"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <motion.div
                animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <FileSpreadsheet className="drop-icon w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              </motion.div>
              <p className="text-lg font-medium mb-2">
                Arraste um arquivo aqui
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Suporta: CSV, XLSX, XLS, TXT
              </p>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Selecionar Arquivo
              </Button>
            </motion.div>
          </TabsContent>

          <TabsContent value="saved" className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {onRefreshSaved && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onRefreshSaved}
                  disabled={isLoadingSaved}
                >
                  <Loader2 className={cn("w-4 h-4", isLoadingSaved && "animate-spin")} />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {savedContactsTotal > 0 ? (
                  <>Mostrando {savedContacts.length} de {savedContactsTotal} contato(s)</>
                ) : (
                  <>{savedContacts.length} contato(s) salvos</>
                )}
              </span>
              {displayedSavedContacts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllSaved}
                >
                  {selectedSavedIds.size === displayedSavedContacts.length
                    ? 'Desmarcar Todos'
                    : 'Selecionar Todos'}
                </Button>
              )}
            </div>

            {isLoadingSaved || isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayedSavedContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{savedSearch ? 'Nenhum contato encontrado' : 'Nenhum contato salvo'}</p>
                <p className="text-xs mt-1">
                  Adicione contatos na página "Contatos"
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] rounded-lg border border-border/50">
                <div className="p-2 space-y-1">
                  {displayedSavedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => toggleSavedContact(contact.id)}
                      className={cn(
                        "flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors",
                        selectedSavedIds.has(contact.id)
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={selectedSavedIds.has(contact.id)}
                        onCheckedChange={() => toggleSavedContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {contact.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {contact.phone}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Load More Button */}
            {hasMoreSavedContacts && !savedSearch && onLoadMoreSavedContacts && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onLoadMoreSavedContacts}
                disabled={isLoadingSaved}
              >
                {isLoadingSaved ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Carregar Mais
              </Button>
            )}

            {selectedSavedIds.size > 0 && (
              <Button
                className="w-full"
                onClick={handleAddSavedContacts}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar {selectedSavedIds.size} Contato(s) ao Disparo
              </Button>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-3">
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum contato importado</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] rounded-lg border border-border/50">
                <div className="p-3 space-y-1">
                  {contacts.slice(0, 50).map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">
                            {contact.name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contact.phone}
                          </p>
                        </div>
                      </div>
                      {contact.isValid !== undefined && (
                        contact.isValid ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400">
                            <Check className="w-3 h-3 mr-1" />
                            Válido
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <X className="w-3 h-3 mr-1" />
                            Inválido
                          </Badge>
                        )
                      )}
                    </div>
                  ))}
                  {contacts.length > 50 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      ... e mais {contacts.length - 50} contatos
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Verification Status */}
        {isVerifying && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando números...
              </span>
              <span>{Math.round(verificationProgress)}%</span>
            </div>
            <Progress value={verificationProgress} />
          </div>
        )}

        {/* Stats */}
        {contacts.length > 0 && (validCount > 0 || invalidCount > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-500">{validCount} válidos</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">{invalidCount} inválidos</span>
            </div>
            {uncheckedCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-white/10">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uncheckedCount} pendentes</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Export Options */}
        {contacts.length > 0 && (validCount > 0 || invalidCount > 0) && (
          <div className="flex gap-2">
            {validCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportContacts('valid')}
              >
                <Download className="w-3 h-3 mr-1" />
                Exportar Válidos
              </Button>
            )}
            {invalidCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportContacts('invalid')}
              >
                <Download className="w-3 h-3 mr-1" />
                Exportar Inválidos
              </Button>
            )}
          </div>
        )}

        {/* Footer Options */}
        <div className="flex items-center gap-3 pt-4 border-t border-border/50">
          <Switch
            id="verify"
            checked={verifyNumbers}
            onCheckedChange={onVerifyChange}
          />
          <Label htmlFor="verify" className="text-sm">
            Verificar números WhatsApp antes de enviar
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
