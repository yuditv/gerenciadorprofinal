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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Loader2, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

interface ParsedContact {
  phone: string;
  name?: string;
}

interface ImportTxtWithVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: Array<{ name: string; phone: string }>) => Promise<void> | void;
}

export function ImportTxtWithVerificationDialog({
  open,
  onOpenChange,
  onImport,
}: ImportTxtWithVerificationDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const parseText = (text: string): ParsedContact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      let phone = parts[0]?.replace(/\D/g, '') || '';
      const name = parts[1] || undefined;
      if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith('55')) {
        phone = '55' + phone;
      }
      return { phone, name };
    }).filter(c => c.phone.length >= 10);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const contacts = parseText(text);
      setParsedContacts(contacts);
      setFileName(file.name);
      toast.success(`${contacts.length} contatos encontrados no arquivo`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (parsedContacts.length === 0) return;

    setLoading(true);
    try {
      await onImport(parsedContacts.map(c => ({
        name: c.name || "Sem nome",
        phone: c.phone,
      })));
      handleClose();
    } catch (error) {
      console.error("Error importing contacts from TXT:", error);
      toast.error("Falha ao importar contatos");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setParsedContacts([]);
    setFileName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Importar TXT
          </DialogTitle>
          <DialogDescription>
            Carregue um arquivo .txt para importar contatos
          </DialogDescription>
        </DialogHeader>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Arquivo .txt</Label>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">
              {fileName || "Clique para selecionar o arquivo .txt"}
            </p>
            <p className="text-xs text-muted-foreground">
              Um contato por linha: telefone ou telefone, nome
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Parsed contacts preview */}
        {parsedContacts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">
                {parsedContacts.length} contatos encontrados
              </span>
            </div>
            <ScrollArea className="h-[120px] border rounded-lg p-2">
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
