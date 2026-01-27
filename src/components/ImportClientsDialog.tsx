import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, X, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Client, PlanType, ServiceType, planLabels, serviceLabels } from '@/types/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { addMonths, parse, isValid } from 'date-fns';

interface ImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (clients: Omit<Client, 'id' | 'renewalHistory'>[]) => Promise<void>;
}

interface ParsedRow {
  name: string;
  whatsapp: string;
  email: string;
  service: ServiceType;
  plan: PlanType;
  price: number | null;
  notes: string | null;
  expiresAt: Date;
  valid: boolean;
  errors: string[];
}

interface ColumnMapping {
  name: string;
  whatsapp: string;
  email: string;
  service: string;
  plan: string;
  price: string;
  notes: string;
  expiresAt: string;
}

const defaultMapping: ColumnMapping = {
  name: '',
  whatsapp: '',
  email: '',
  service: '',
  plan: '',
  price: '',
  notes: '',
  expiresAt: '',
};

export function ImportClientsDialog({ open, onOpenChange, onImport }: ImportClientsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(defaultMapping);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setMapping(defaultMapping);
    setParsedRows([]);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    try {
      let data: Record<string, any>[] = [];
      let columns: string[] = [];

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        
        if (jsonData.length === 0) {
          toast.error('Arquivo vazio ou sem dados válidos');
          return;
        }

        data = jsonData as Record<string, any>[];
        columns = Object.keys(data[0]);
      } else if (fileExtension === 'csv') {
        const text = await file.text();
        const workbook = XLSX.read(text, { type: 'string' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        
        if (jsonData.length === 0) {
          toast.error('Arquivo vazio ou sem dados válidos');
          return;
        }

        data = jsonData as Record<string, any>[];
        columns = Object.keys(data[0]);
      } else {
        toast.error('Formato não suportado. Use XLSX, XLS ou CSV.');
        return;
      }

      setRawData(data);
      setHeaders(columns);
      
      // Auto-detect column mappings
      const autoMapping: ColumnMapping = { ...defaultMapping };
      const lowerHeaders = columns.map(h => h.toLowerCase());
      
      const namePatterns = ['nome', 'name', 'cliente', 'client'];
      const whatsappPatterns = ['whatsapp', 'telefone', 'phone', 'celular', 'fone', 'tel'];
      const emailPatterns = ['email', 'e-mail', 'mail', 'correio'];
      const servicePatterns = ['serviço', 'servico', 'service', 'tipo'];
      const planPatterns = ['plano', 'plan', 'assinatura'];
      const pricePatterns = ['preço', 'preco', 'price', 'valor', 'mensalidade'];
      const notesPatterns = ['notas', 'notes', 'observação', 'observacao', 'obs'];
      const expiresPatterns = ['vencimento', 'expira', 'expires', 'data', 'validade'];

      columns.forEach(col => {
        const lower = col.toLowerCase();
        if (namePatterns.some(p => lower.includes(p))) autoMapping.name = col;
        if (whatsappPatterns.some(p => lower.includes(p))) autoMapping.whatsapp = col;
        if (emailPatterns.some(p => lower.includes(p))) autoMapping.email = col;
        if (servicePatterns.some(p => lower.includes(p))) autoMapping.service = col;
        if (planPatterns.some(p => lower.includes(p))) autoMapping.plan = col;
        if (pricePatterns.some(p => lower.includes(p))) autoMapping.price = col;
        if (notesPatterns.some(p => lower.includes(p))) autoMapping.notes = col;
        if (expiresPatterns.some(p => lower.includes(p))) autoMapping.expiresAt = col;
      });

      setMapping(autoMapping);
      setStep('mapping');
      toast.success(`${data.length} linha(s) encontrada(s) no arquivo`);
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Erro ao ler o arquivo');
    }
  };

  const parseService = (value: string): ServiceType => {
    const lower = value?.toString().toLowerCase().trim();
    if (lower === 'vpn' || lower.includes('vpn')) return 'VPN';
    return 'IPTV';
  };

  const parsePlan = (value: string): PlanType => {
    const lower = value?.toString().toLowerCase().trim();
    if (lower.includes('anual') || lower === 'annual' || lower === '12') return 'annual';
    if (lower.includes('semestral') || lower === 'semiannual' || lower === '6') return 'semiannual';
    if (lower.includes('trimestral') || lower === 'quarterly' || lower === '3') return 'quarterly';
    return 'monthly';
  };

  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    
    // If it's already a Date
    if (value instanceof Date && isValid(value)) return value;
    
    // If it's a number (Excel date serial)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return new Date(date.y, date.m - 1, date.d);
      }
    }
    
    // If it's a string
    const str = value.toString().trim();
    
    // Try common formats
    const formats = [
      'dd/MM/yyyy',
      'dd-MM-yyyy',
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'd/M/yyyy',
    ];
    
    for (const fmt of formats) {
      const parsed = parse(str, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
    
    // Try native Date parsing
    const native = new Date(str);
    if (isValid(native)) return native;
    
    return null;
  };

  const parsePhone = (value: string): string => {
    if (!value) return '';
    return value.toString().replace(/\D/g, '');
  };

  const handleProcessData = () => {
    if (!mapping.name) {
      toast.error('Selecione a coluna do Nome');
      return;
    }

    const parsed: ParsedRow[] = rawData.map(row => {
      const errors: string[] = [];
      
      const name = row[mapping.name]?.toString().trim() || '';
      const whatsapp = parsePhone(row[mapping.whatsapp] || '');
      const email = row[mapping.email]?.toString().trim() || '';
      const service = parseService(row[mapping.service] || '');
      const plan = parsePlan(row[mapping.plan] || '');
      const priceRaw = row[mapping.price];
      const price = priceRaw ? parseFloat(priceRaw.toString().replace(/[^\d.,]/g, '').replace(',', '.')) : null;
      const notes = row[mapping.notes]?.toString().trim() || null;
      
      let expiresAt = parseDate(row[mapping.expiresAt]);
      if (!expiresAt) {
        // Default to plan duration from now
        const monthsToAdd = plan === 'annual' ? 12 : plan === 'semiannual' ? 6 : plan === 'quarterly' ? 3 : 1;
        expiresAt = addMonths(new Date(), monthsToAdd);
      }

      if (!name) errors.push('Nome é obrigatório');
      if (!whatsapp && !email) errors.push('WhatsApp ou Email é obrigatório');
      if (whatsapp && whatsapp.length < 10) errors.push('WhatsApp inválido');
      if (email && !email.includes('@')) errors.push('Email inválido');

      return {
        name,
        whatsapp,
        email,
        service,
        plan,
        price,
        notes,
        expiresAt,
        valid: errors.length === 0,
        errors,
      };
    });

    setParsedRows(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.valid);
    
    if (validRows.length === 0) {
      toast.error('Nenhum cliente válido para importar');
      return;
    }

    setIsImporting(true);

    try {
      const clientsToImport: Omit<Client, 'id' | 'renewalHistory'>[] = validRows.map(row => ({
        name: row.name,
        whatsapp: row.whatsapp,
        email: row.email,
        service: row.service,
        plan: row.plan,
        price: row.price,
        notes: row.notes,
        createdAt: new Date(),
        expiresAt: row.expiresAt,
        serviceUsername: null,
        servicePassword: null,
        appName: null,
        device: null,
      }));

      await onImport(clientsToImport);
      toast.success(`${validRows.length} cliente(s) importado(s) com sucesso!`);
      handleClose(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar clientes');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Clientes
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione um arquivo XLSX, XLS ou CSV para importar clientes'}
            {step === 'mapping' && 'Mapeie as colunas do arquivo para os campos do cliente'}
            {step === 'preview' && 'Revise os dados antes de importar'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-12 w-12 text-primary" />
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                  <Upload className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Selecionar Arquivo
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 max-w-md">
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    O arquivo deve ter colunas como: Nome, WhatsApp, Email, Serviço, Plano, Preço, Notas, Vencimento.
                    As colunas serão detectadas automaticamente.
                  </span>
                </p>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Select value={mapping.name} onValueChange={(v) => setMapping(m => ({ ...m, name: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Select value={mapping.whatsapp} onValueChange={(v) => setMapping(m => ({ ...m, whatsapp: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Select value={mapping.email} onValueChange={(v) => setMapping(m => ({ ...m, email: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select value={mapping.service} onValueChange={(v) => setMapping(m => ({ ...m, service: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma (padrão: IPTV)</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={mapping.plan} onValueChange={(v) => setMapping(m => ({ ...m, plan: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma (padrão: Mensal)</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Preço</Label>
                  <Select value={mapping.price} onValueChange={(v) => setMapping(m => ({ ...m, price: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Select value={mapping.notes} onValueChange={(v) => setMapping(m => ({ ...m, notes: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Select value={mapping.expiresAt} onValueChange={(v) => setMapping(m => ({ ...m, expiresAt: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma (calculado pelo plano)</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Preview:</strong> {rawData.length} linha(s) encontrada(s). 
                  Colunas detectadas: {headers.join(', ')}
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} válido(s)
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} inválido(s)
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow key={idx} className={!row.valid ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          {row.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.name || '-'}</TableCell>
                        <TableCell>{row.whatsapp || '-'}</TableCell>
                        <TableCell>{row.email || '-'}</TableCell>
                        <TableCell>{serviceLabels[row.service]}</TableCell>
                        <TableCell>{planLabels[row.plan]}</TableCell>
                        <TableCell>{row.expiresAt.toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="text-destructive text-sm">{row.errors.length} erro(s)</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <ul className="list-disc pl-4">
                                  {row.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step !== 'upload' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
              disabled={isImporting}
            >
              Voltar
            </Button>
          )}
          
          {step === 'mapping' && (
            <Button onClick={handleProcessData}>
              Processar Dados
            </Button>
          )}
          
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={isImporting || validCount === 0}>
              {isImporting ? 'Importando...' : `Importar ${validCount} Cliente(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
