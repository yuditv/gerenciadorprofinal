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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, XCircle, ShieldCheck, FileText } from "lucide-react";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { toast } from "sonner";

interface ParsedContact {
  phone: string;
  name?: string;
}

interface VerifiedContact extends ParsedContact {
  exists: boolean;
  whatsappName?: string;
}

interface ImportTxtWithVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: Array<{ name: string; phone: string }>) => void;
}

export function ImportTxtWithVerificationDialog({
  open,
  onOpenChange,
  onImport,
}: ImportTxtWithVerificationDialogProps) {
  const { instances, checkNumbers } = useWhatsAppInstances();
  const connectedInstances = instances.filter(i => i.status === 'connected');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [verifiedContacts, setVerifiedContacts] = useState<VerifiedContact[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationDone, setVerificationDone] = useState(false);
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
      setVerifiedContacts([]);
      setVerificationDone(false);
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

  const handleVerifyNumbers = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância conectada");
      return;
    }
    if (parsedContacts.length === 0) {
      toast.error("Carregue um arquivo .txt primeiro");
      return;
    }

    setIsVerifying(true);
    setVerificationProgress(0);
    setVerifiedContacts([]);

    const results: VerifiedContact[] = [];
    const batchSize = 10;

    try {
      for (let i = 0; i < parsedContacts.length; i += batchSize) {
        const batch = parsedContacts.slice(i, i + batchSize);
        const phones = batch.map(c => c.phone);

        const batchResults = await checkNumbers(selectedInstance, phones, false);

        if (batchResults) {
          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const original = batch[j];
            results.push({
              phone: original.phone,
              name: original.name,
              exists: result.exists,
              whatsappName: result.whatsappName,
            });
          }
        } else {
          for (const contact of batch) {
            results.push({ ...contact, exists: false });
          }
        }

        setVerificationProgress(((i + batch.length) / parsedContacts.length) * 100);
        setVerifiedContacts([...results]);
      }

      const activeCount = results.filter(r => r.exists).length;
      const inactiveCount = results.filter(r => !r.exists).length;
      toast.success(`Verificação concluída: ${activeCount} ativos, ${inactiveCount} inativos`);
      setVerificationDone(true);
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Erro durante a verificação");
    } finally {
      setIsVerifying(false);
    }
  };

  const activeContacts = verifiedContacts.filter(c => c.exists);

  const handleSubmit = async () => {
    const contactsToAdd = verificationDone ? activeContacts : parsedContacts;
    if (contactsToAdd.length === 0) return;

    setLoading(true);
    try {
      onImport(contactsToAdd.map(c => ({
        name: ('whatsappName' in c ? (c as VerifiedContact).whatsappName : undefined) || c.name || "Sem nome",
        phone: c.phone,
      })));
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setParsedContacts([]);
    setVerifiedContacts([]);
    setVerificationDone(false);
    setVerificationProgress(0);
    setSelectedInstance("");
    setFileName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Importar TXT com Verificação WhatsApp
          </DialogTitle>
          <DialogDescription>
            Carregue um arquivo .txt e verifique quais números possuem WhatsApp ativo
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
        {parsedContacts.length > 0 && !verificationDone && (
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

        {/* WhatsApp Verification */}
        {parsedContacts.length > 0 && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Verificação WhatsApp</span>
              <Badge variant="outline" className="text-xs">Obrigatório</Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Instância para verificação</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id} className="text-xs">
                      {inst.instance_name} {inst.phone_connected ? `(${inst.phone_connected})` : ''}
                    </SelectItem>
                  ))}
                  {connectedInstances.length === 0 && (
                    <SelectItem value="none" disabled className="text-xs">
                      Nenhuma instância conectada
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isVerifying && (
              <div className="space-y-2">
                <Progress value={verificationProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Verificando... {Math.round(verificationProgress)}%
                </p>
              </div>
            )}

            {!verificationDone && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleVerifyNumbers}
                disabled={isVerifying || !selectedInstance || parsedContacts.length === 0}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    Verificar números
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Verification Results */}
        {verificationDone && verifiedContacts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">{activeContacts.length} ativos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">
                  {verifiedContacts.length - activeContacts.length} inativos (removidos)
                </span>
              </div>
            </div>
            <ScrollArea className="h-[150px] border rounded-lg p-2">
              <div className="space-y-1">
                {verifiedContacts.map((contact, i) => (
                  <div key={i} className={`text-xs flex justify-between items-center py-1 border-b last:border-0 ${!contact.exists ? 'opacity-40 line-through' : ''}`}>
                    <div className="flex items-center gap-2">
                      {contact.exists ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                      )}
                      <span className="font-mono">{contact.phone}</span>
                    </div>
                    <span className="text-muted-foreground">{contact.whatsappName || contact.name || '-'}</span>
                  </div>
                ))}
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
            disabled={loading || !verificationDone || activeContacts.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : verificationDone ? (
              `Adicionar ${activeContacts.length} Contatos Ativos`
            ) : (
              "Verifique os números primeiro"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
