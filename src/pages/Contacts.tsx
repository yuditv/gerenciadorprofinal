import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FileText, Users, Download, Upload, FileSpreadsheet, Database, CloudOff, Cloud, RefreshCw, ArrowRightLeft, Pencil, Search, Phone, Mail, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContactsSupabase, type Contact, type ImportProgress } from "@/hooks/useContactsSupabase";
import { useSentContacts } from "@/hooks/useSentContacts";
import { ContactForm } from "@/components/ContactForm";
import { SentContactsList } from "@/components/SentContactsList";
import { exportContactsAsVCard } from "@/lib/exportVCard";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { ImportTxtWithVerificationDialog } from "@/components/ImportTxtWithVerificationDialog";

export default function Contacts() {
  const { contacts, isLoading, userId, isConfigured, importProgress, addContact, updateContact, deleteContact, importContacts, clearAllContacts, getContactCount, refetch } = useContactsSupabase();
  const { sentContacts, getSentContactCount } = useSentContacts();
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [migrateConfirm, setMigrateConfirm] = useState(false);
  const [localStorageCount, setLocalStorageCount] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [sentContactCount, setSentContactCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");
  const [txtVerificationOpen, setTxtVerificationOpen] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Filter contacts based on search
  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load contacts when user is logged in
  useEffect(() => {
    if (userId) {
      refetch();
    }
  }, [userId, refetch]);

  // Check for localStorage contacts
  useEffect(() => {
    try {
      const stored = localStorage.getItem("contacts");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLocalStorageCount(parsed.length);
        }
      }
    } catch (e) {
      console.error("Error reading localStorage contacts:", e);
    }
  }, []);

  const handleMigrateFromLocalStorage = async () => {
    if (!userId) {
      toast.error("Você precisa estar logado");
      return;
    }

    setIsMigrating(true);
    try {
      const stored = localStorage.getItem("contacts");
      if (!stored) {
        toast.error("Nenhum contato encontrado no localStorage");
        return;
      }

      const localContacts = JSON.parse(stored);
      if (!Array.isArray(localContacts) || localContacts.length === 0) {
        toast.error("Nenhum contato válido encontrado");
        return;
      }

      // Map localStorage contacts to the import format
      const contactsToImport = localContacts.map((c: any) => ({
        name: c.name || "Sem nome",
        phone: c.phone || "",
        email: c.email || undefined,
        notes: c.notes || undefined,
      })).filter((c: any) => c.phone);

      if (contactsToImport.length === 0) {
        toast.error("Nenhum contato com telefone válido");
        return;
      }

      await importContacts(contactsToImport);
      
      // Clear localStorage after successful migration
      localStorage.removeItem("contacts");
      setLocalStorageCount(0);
      
      toast.success(`${contactsToImport.length} contato(s) migrado(s) com sucesso! localStorage limpo.`);
      setMigrateConfirm(false);
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Erro ao migrar contatos");
    } finally {
      setIsMigrating(false);
    }
  };

  // Fetch counts separately for performance
  useEffect(() => {
    if (userId) {
      getContactCount().then(setContactCount);
      getSentContactCount().then(setSentContactCount);
    }
  }, [userId, contacts.length, sentContacts.length, getContactCount, getSentContactCount]);

  const handleSubmit = (data: Omit<Contact, "id" | "createdAt" | "updatedAt">) => {
    if (editingContact) {
      updateContact(editingContact.id, data);
      setEditingContact(null);
    } else {
      addContact(data);
    }
    setFormOpen(false);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleDeleteContact = async () => {
    if (deleteConfirm) {
      await deleteContact(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleExportJSON = () => {
    if (contacts.length === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }
    const dataStr = JSON.stringify(contacts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contatos-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${contacts.length} contato(s) exportado(s) como JSON`);
  };

  const handleExportVCard = () => {
    if (contacts.length === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }
    exportContactsAsVCard(contacts);
    toast.success(`${contacts.length} contato(s) exportado(s) como vCard`);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        
        if (!Array.isArray(imported)) {
          toast.error("Arquivo inválido: esperado um array de contatos");
          return;
        }

        const validContacts = imported.filter(
          (c: any) => c.name && c.phone
        );

        if (validContacts.length === 0) {
          toast.error("Nenhum contato válido encontrado no arquivo");
          return;
        }

        importContacts(validContacts);
        toast.success(`${validContacts.length} contato(s) importado(s) com sucesso!`);
      } catch (error) {
        console.error("Error parsing JSON:", error);
        toast.error("Erro ao ler arquivo JSON");
      }
    };
    reader.readAsText(file);
    
    if (jsonInputRef.current) {
      jsonInputRef.current.value = "";
    }
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          toast.error("Arquivo vazio ou sem dados válidos");
          return;
        }

        const headers = (jsonData[0] as string[]).map((h) => 
          String(h || "").toLowerCase().trim()
        );
        
        const nameIdx = headers.findIndex((h) => 
          h.includes("nome") || h.includes("name") || h === "contato" || h === "contact"
        );
        const phoneIdx = headers.findIndex((h) => 
          h.includes("telefone") || h.includes("phone") || h.includes("celular") || h.includes("whatsapp") || h.includes("número") || h.includes("numero")
        );
        const emailIdx = headers.findIndex((h) => 
          h.includes("email") || h.includes("e-mail")
        );
        const notesIdx = headers.findIndex((h) => 
          h.includes("nota") || h.includes("notes") || h.includes("observa") || h.includes("obs")
        );

        if (nameIdx === -1 && phoneIdx === -1) {
          toast.error("Colunas 'nome' e 'telefone/phone' não encontradas. Verifique o cabeçalho.");
          return;
        }

        const importedContacts: Array<Omit<Contact, "id" | "createdAt" | "updatedAt">> = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          const name = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
          const phone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : "";
          
          if (!name && !phone) continue;
          
          importedContacts.push({
            name: name || "Sem nome",
            phone: phone.replace(/\D/g, ""),
            email: emailIdx >= 0 ? String(row[emailIdx] || "").trim() : undefined,
            notes: notesIdx >= 0 ? String(row[notesIdx] || "").trim() : undefined,
          });
        }

        if (importedContacts.length === 0) {
          toast.error("Nenhum contato válido encontrado no arquivo");
          return;
        }

        importContacts(importedContacts);
        toast.success(`${importedContacts.length} contato(s) importado(s) com sucesso!`);
      } catch (error) {
        console.error("Error parsing Excel/CSV:", error);
        toast.error("Erro ao ler arquivo. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
    
    if (excelInputRef.current) {
      excelInputRef.current.value = "";
    }
  };

  if (!isConfigured) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CloudOff className="h-12 w-12 text-destructive/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              Supabase não configurado
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              Configure as variáveis de ambiente <code className="bg-muted px-1 rounded">VITE_CONTACTS_SUPABASE_URL</code> e{" "}
              <code className="bg-muted px-1 rounded">VITE_CONTACTS_SUPABASE_KEY</code> no arquivo .env para conectar ao seu Supabase externo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card className="border-amber-500/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Cloud className="h-12 w-12 text-amber-500/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              Login necessário
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Você precisa estar logado para acessar seus contatos salvos no Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && contacts.length === 0 && !importProgress.isImporting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Premium Header */}
      <motion.div 
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="page-header-icon" style={{
          background: 'linear-gradient(135deg, hsl(210 85% 55%) 0%, hsl(200 80% 50%) 100%)',
          boxShadow: '0 8px 32px hsl(210 85% 55% / 0.35), 0 0 0 1px hsl(210 85% 55% / 0.2)'
        }}>
          <Database className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gradient">Lista de Contatos</h1>
          <p className="text-muted-foreground">
            Gerencie sua lista para disparos em massa
          </p>
        </div>
      </motion.div>

      {/* Hidden file inputs */}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        className="hidden"
      />
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleImportExcel}
        className="hidden"
      />

      {/* Import Progress Bar */}
      {importProgress.isImporting && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Importando contatos...</span>
                <span className="text-sm text-muted-foreground">
                  {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={(importProgress.current / importProgress.total) * 100} 
                className="h-3"
              />
              <p className="text-xs text-muted-foreground">
                {Math.round((importProgress.current / importProgress.total) * 100)}% concluído
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for contacts and sent contacts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="contacts" className="gap-2">
            <Database className="h-4 w-4" />
            Meus Contatos
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {contactCount.toLocaleString()}
            </span>
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="h-4 w-4" />
            Contatos Enviados
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {sentContactCount.toLocaleString()}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Meus Contatos Tab */}
        <TabsContent value="contacts" className="space-y-6">
          {/* Summary Card */}
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Database className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-4xl font-bold text-gradient">{contactCount.toLocaleString()}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {contactCount === 1 ? "Contato disponível para disparo" : "Contatos disponíveis para disparo"}
                  </CardDescription>
                  {contacts.length !== contactCount && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Exibindo {contacts.length.toLocaleString()} na tela
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-6">
                Seus contatos estão salvos no banco de dados e prontos para uso no disparo em massa. 
                Após enviar mensagens, eles serão movidos para "Contatos Enviados".
              </p>
              
              <div className="flex flex-wrap gap-3">
                {/* Migrate from localStorage */}
                {localStorageCount > 0 && (
                  <Button 
                    onClick={() => setMigrateConfirm(true)} 
                    variant="default"
                    className="gap-2 bg-amber-600 hover:bg-amber-700"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Migrar {localStorageCount} do localStorage
                  </Button>
                )}

                {/* Add Contact */}
                <Button onClick={() => setFormOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Contato
                </Button>

                {/* Import Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Importar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { setEditingContact(null); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Adicionar manualmente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => excelInputRef.current?.click()}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel / CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => jsonInputRef.current?.click()}>
                      <FileText className="h-4 w-4 mr-2" />
                      JSON (Backup)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTxtVerificationOpen(true)}>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      TXT (com verificação WhatsApp)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {contacts.length > 0 && (
                  <>
                    {/* Export Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          Exportar
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleExportJSON}>
                          <FileText className="h-4 w-4 mr-2" />
                          JSON (Backup)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportVCard}>
                          <Users className="h-4 w-4 mr-2" />
                          vCard
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Clear All */}
                    <Button 
                      variant="destructive" 
                      className="gap-2"
                      onClick={() => setClearAllConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpar Lista
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contacts List */}
          {contacts.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg">Seus Contatos</CardTitle>
                  <div className="relative w-full sm:w-64 search-glow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar contatos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-white/10 rounded-xl bg-background/50 backdrop-blur-sm focus:outline-none focus:border-primary/30 transition-all"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {filteredContacts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum contato encontrado para "{searchQuery}"
                    </p>
                  ) : (
                    filteredContacts.slice(0, 100).map((contact, index) => (
                      <motion.div
                        key={contact.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-background/30 hover:bg-primary/5 hover:border-primary/15 transition-all group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{contact.name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {contact.phone}
                            </span>
                            {contact.email && (
                              <span className="flex items-center gap-1.5 truncate">
                                <Mail className="h-3.5 w-3.5" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditContact(contact)}
                            className="h-9 w-9 rounded-lg"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(contact)}
                            className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  )}
                  {filteredContacts.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground py-3">
                      Mostrando 100 de {filteredContacts.length} contatos. Use a busca para filtrar.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {contacts.length === 0 && (
            <Card className="glass-card">
              <CardContent className="empty-state">
                <div className="empty-state-icon">
                  <Users />
                </div>
                <h3 className="text-lg font-semibold mb-2">Lista vazia</h3>
                <p className="text-muted-foreground max-w-md">
                  Importe uma planilha Excel/CSV com colunas "nome" e "telefone", 
                  ou adicione contatos manualmente para começar.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contatos Enviados Tab */}
        <TabsContent value="sent">
          <SentContactsList />
        </TabsContent>
      </Tabs>

      {/* Contact Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingContact(null);
        }}
        contact={editingContact}
        onSubmit={handleSubmit}
      />

      {/* Delete Single Contact Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteConfirm?.name}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearAllConfirm} onOpenChange={setClearAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar toda a lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover todos os {contacts.length} contato(s)? 
              Esta ação não pode ser desfeita. Recomendamos exportar um backup antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                clearAllContacts();
                setClearAllConfirm(false);
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar Lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migrate Confirmation */}
      <AlertDialog open={migrateConfirm} onOpenChange={setMigrateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Migrar contatos do localStorage?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem <strong>{localStorageCount}</strong> contato(s) salvos no localStorage do navegador. 
              Deseja migrá-los para o Supabase? Após a migração, o localStorage será limpo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMigrating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMigrateFromLocalStorage}
              disabled={isMigrating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Migrando...
                </>
              ) : (
                "Migrar Contatos"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* TXT Import with WhatsApp Verification */}
      <ImportTxtWithVerificationDialog
        open={txtVerificationOpen}
        onOpenChange={setTxtVerificationOpen}
        onImport={async (contacts) => {
          await importContacts(contacts);
        }}
      />
    </div>
  );
}
