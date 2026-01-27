import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, List, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Campaign, useCampaigns } from "@/hooks/useCampaigns";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface Contact {
  phone: string;
  name?: string;
  variables?: Record<string, string>;
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
  onRefetch: () => void;
}

export function ImportContactsDialog({ 
  open, 
  onOpenChange, 
  campaign,
  onRefetch 
}: ImportContactsDialogProps) {
  const { addContacts } = useCampaigns();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [parsedContacts, setParsedContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState("upload");

  const parseManualInput = (text: string): Contact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      const phone = parts[0]?.replace(/\D/g, '') || '';
      const name = parts[1] || undefined;
      return { phone, name };
    }).filter(c => c.phone.length >= 10);
  };

  const handleManualInputChange = (text: string) => {
    setManualInput(text);
    const contacts = parseManualInput(text);
    setParsedContacts(contacts);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Skip header row if it looks like headers
      const startRow = rows[0]?.some(cell => 
        typeof cell === 'string' && 
        (cell.toLowerCase().includes('nome') || 
         cell.toLowerCase().includes('telefone') ||
         cell.toLowerCase().includes('phone'))
      ) ? 1 : 0;

      const contacts: Contact[] = [];
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // Try to find phone and name columns
        let phone = '';
        let name = '';

        for (const cell of row) {
          const cellStr = String(cell || '').trim();
          const digits = cellStr.replace(/\D/g, '');
          
          if (digits.length >= 10 && digits.length <= 13 && !phone) {
            phone = digits;
          } else if (cellStr && !name && !/^\d+$/.test(cellStr)) {
            name = cellStr;
          }
        }

        if (phone) {
          contacts.push({ phone, name: name || undefined });
        }
      }

      setParsedContacts(contacts);
      toast.success(`${contacts.length} contatos encontrados no arquivo`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!campaign || parsedContacts.length === 0) return;

    setLoading(true);
    try {
      const success = await addContacts(campaign.id, parsedContacts);
      if (success) {
        setParsedContacts([]);
        setManualInput("");
        onOpenChange(false);
        onRefetch();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setParsedContacts([]);
    setManualInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Adicionar Contatos
          </DialogTitle>
          <DialogDescription>
            Campanha: {campaign?.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Arquivo
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <List className="w-4 h-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-2">
              <Label>Carregar arquivo CSV ou Excel</Label>
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Clique para selecionar ou arraste o arquivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos: .csv, .xlsx, .xls
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O arquivo deve conter colunas de telefone e nome (opcional)
            </p>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Label>Lista de contatos</Label>
              <Textarea
                placeholder="Formato: telefone, nome (um por linha)&#10;11999999999, João Silva&#10;11988888888, Maria Santos"
                value={manualInput}
                onChange={(e) => handleManualInputChange(e.target.value)}
                rows={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Separe telefone e nome por vírgula, ponto-e-vírgula ou tab
            </p>
          </TabsContent>
        </Tabs>

        {parsedContacts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">
                {parsedContacts.length} contatos válidos
              </span>
            </div>
            <ScrollArea className="h-[150px] border rounded-lg p-2">
              <div className="space-y-1">
                {parsedContacts.slice(0, 50).map((contact, i) => (
                  <div key={i} className="text-xs flex justify-between py-1 border-b last:border-0">
                    <span className="font-mono">{contact.phone}</span>
                    <span className="text-muted-foreground">{contact.name || '-'}</span>
                  </div>
                ))}
                {parsedContacts.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ... e mais {parsedContacts.length - 50} contatos
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {parsedContacts.length === 0 && (manualInput || activeTab === 'upload') && (
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Nenhum contato válido encontrado</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || parsedContacts.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : (
              `Adicionar ${parsedContacts.length} Contatos`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
