import { useState, useRef } from 'react';
import { useSentContacts, SentContact } from '@/hooks/useSentContacts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { 
  RefreshCw, 
  Trash2, 
  RotateCcw, 
  Search, 
  Phone, 
  User, 
  Calendar,
  Loader2,
  ChevronDown,
  Upload
} from 'lucide-react';

export function SentContactsList() {
  const { 
    sentContacts, 
    isLoading, 
    userId,
    restoreContact, 
    restoreAllContacts, 
    clearAllSentContacts,
    refetch 
  } = useSentContacts();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const filteredContacts = sentContacts.filter(contact => {
    if (!searchQuery.trim()) return true;
    const lower = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(lower) ||
      contact.phone.includes(searchQuery)
    );
  });

  const displayedContacts = filteredContacts.slice(0, displayLimit);
  const hasMore = filteredContacts.length > displayLimit;

  const handleRestoreAll = async () => {
    setIsRestoring(true);
    try {
      await restoreAllContacts();
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllSentContacts();
    } finally {
      setIsClearing(false);
    }
  };

  const handleUploadUsedNumbers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      
      // Extract phone numbers (digits only, min 8 digits)
      const phones = lines
        .map(line => line.replace(/\D/g, ''))
        .filter(p => p.length >= 8);

      if (phones.length === 0) {
        toast.error('Nenhum número válido encontrado no arquivo');
        return;
      }

      // Insert in batches
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize).map(phone => ({
          user_id: userId,
          name: phone,
          phone,
          sent_at: new Date().toISOString(),
        }));
        const { error } = await (supabase as any).from('sent_contacts').insert(batch);
        if (error) {
          console.error('Error inserting batch:', error);
        } else {
          inserted += batch.length;
        }
      }

      toast.success(`${inserted} número(s) adicionado(s) aos contatos enviados`);
      await refetch();
    } catch (error) {
      console.error('Error uploading used numbers:', error);
      toast.error('Erro ao importar números');
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contatos Enviados
            </CardTitle>
            <CardDescription>
              {sentContacts.length} contato(s) já utilizado(s) em disparos em massa
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden upload input */}
        <input
          ref={uploadInputRef}
          type="file"
          accept=".txt,.csv"
          onChange={handleUploadUsedNumbers}
          className="hidden"
        />

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar Usados
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={sentContacts.length === 0 || isRestoring}
                >
                  {isRestoring ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Restaurar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar todos os contatos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso moverá {sentContacts.length} contato(s) de volta para a lista de Contatos Pessoais.
                    Eles poderão ser usados novamente em disparos em massa.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestoreAll}>
                    Restaurar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={sentContacts.length === 0 || isClearing}
                >
                  {isClearing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Limpar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os contatos enviados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso removerá permanentemente {sentContacts.length} contato(s) da lista de enviados.
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Limpar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Contacts List */}
        {sentContacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum contato enviado ainda</p>
            <p className="text-sm">Os contatos usados em disparos aparecerão aqui</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum contato encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {displayedContacts.map((contact) => (
                <ContactCard 
                  key={contact.id} 
                  contact={contact} 
                  onRestore={restoreContact}
                  formatPhone={formatPhone}
                />
              ))}
              
              {hasMore && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Carregar mais ({filteredContacts.length - displayLimit} restantes)
                </Button>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
          <span>
            Exibindo {displayedContacts.length} de {filteredContacts.length} contato(s)
          </span>
          <Badge variant="secondary">
            Total: {sentContacts.length}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactCard({ 
  contact, 
  onRestore,
  formatPhone 
}: { 
  contact: SentContact; 
  onRestore: (id: string) => Promise<void>;
  formatPhone: (phone: string) => string;
}) {
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(contact.id);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{contact.name}</p>
          <p className="text-sm text-muted-foreground">{formatPhone(contact.phone)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {format(new Date(contact.sentAt), "dd/MM/yy HH:mm", { locale: ptBR })}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestore}
          disabled={isRestoring}
          className="h-8"
        >
          {isRestoring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          <span className="sr-only sm:not-sr-only sm:ml-2">Restaurar</span>
        </Button>
      </div>
    </div>
  );
}
