import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  FileText,
  Trash2,
  Filter as FilterIcon,
  Type,
  Copy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import * as XLSX from 'xlsx';

interface ParsedNumber {
  raw: string;
  phone: string;
  name?: string;
}

interface VerificationResult {
  phone: string;
  name?: string;
  exists: boolean;
  whatsappName?: string;
}

export function WhatsAppNumberFilter() {
  const { instances, checkNumbers } = useWhatsAppInstances();
  const connectedInstances = instances.filter(i => i.status === 'connected');
  
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [fetchOriginalName, setFetchOriginalName] = useState(false);
  const [manualNumbers, setManualNumbers] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<ParsedNumber[]>([]);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("import");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse manual input numbers
  const parseManualNumbers = useCallback((text: string): ParsedNumber[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // Try to extract phone and name
      const parts = line.trim().split(/\s+/);
      let phone = parts[0] || "";
      const name = parts.slice(1).join(" ") || undefined;
      
      // Normalize phone number
      phone = phone.replace(/[^\d+]/g, '');
      if (!phone.startsWith('+') && !phone.startsWith('55')) {
        phone = '55' + phone;
      }
      phone = phone.replace('+', '');
      
      return { raw: line, phone, name };
    }).filter(n => n.phone.length >= 10);
  }, []);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  // Handle file selection
  const handleFile = async (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (extension === 'txt') {
        const text = await file.text();
        const parsed = parseManualNumbers(text);
        setParsedNumbers(prev => [...prev, ...parsed]);
        toast.success(`${parsed.length} números importados`);
      } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        const numbers: ParsedNumber[] = [];
        for (const row of data as unknown[][]) {
          if (row && row.length > 0) {
            let phone = String(row[0] || '').replace(/[^\d+]/g, '');
            const name = row[1] ? String(row[1]) : undefined;
            
            if (phone && phone.length >= 10) {
              if (!phone.startsWith('+') && !phone.startsWith('55')) {
                phone = '55' + phone;
              }
              phone = phone.replace('+', '');
              numbers.push({ raw: `${phone} ${name || ''}`.trim(), phone, name });
            }
          }
        }
        
        setParsedNumbers(prev => [...prev, ...numbers]);
        toast.success(`${numbers.length} números importados`);
      } else {
        toast.error("Formato não suportado. Use .xlsx, .xls, .csv ou .txt");
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao processar arquivo");
    }
  };

  // Add manual numbers to list
  const handleAddManualNumbers = () => {
    if (!manualNumbers.trim()) {
      toast.error("Digite pelo menos um número");
      return;
    }
    
    const parsed = parseManualNumbers(manualNumbers);
    if (parsed.length === 0) {
      toast.error("Nenhum número válido encontrado");
      return;
    }
    
    setParsedNumbers(prev => [...prev, ...parsed]);
    setManualNumbers("");
    toast.success(`${parsed.length} números adicionados`);
  };

  // Remove number from list
  const removeNumber = (index: number) => {
    setParsedNumbers(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all numbers
  const clearAllNumbers = () => {
    setParsedNumbers([]);
    setVerificationResults([]);
    toast.success("Lista limpa");
  };

  // Verify numbers using real WhatsApp API
  const handleVerifyNumbers = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância conectada");
      return;
    }
    
    if (parsedNumbers.length === 0) {
      toast.error("Adicione números para verificar");
      return;
    }
    
    setIsVerifying(true);
    setVerificationProgress(0);
    setVerificationResults([]);
    
    const results: VerificationResult[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the API
    const phones = parsedNumbers.map(n => n.phone);
    
    try {
      // Process in batches
      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize);
        const batchParsed = parsedNumbers.slice(i, i + batchSize);
        
        const batchResults = await checkNumbers(selectedInstance, batch, fetchOriginalName);
        
        if (batchResults) {
          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const original = batchParsed[j];
            
            results.push({
              phone: result.phone,
              name: original?.name,
              exists: result.exists,
              whatsappName: result.whatsappName,
            });
          }
        } else {
          // If batch failed, mark all as unknown
          for (const num of batchParsed) {
            results.push({
              phone: num.phone,
              name: num.name,
              exists: false,
            });
          }
        }
        
        setVerificationProgress(((i + batch.length) / parsedNumbers.length) * 100);
        setVerificationResults([...results]);
      }
      
      const validCount = results.filter(r => r.exists).length;
      const invalidCount = results.filter(r => !r.exists).length;
      
      toast.success(`Verificação concluída: ${validCount} válidos, ${invalidCount} inválidos`);
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Erro durante a verificação");
    } finally {
      setIsVerifying(false);
    }
  };

  // Export valid numbers
  const exportValidNumbers = () => {
    const valid = verificationResults.filter(r => r.exists);
    if (valid.length === 0) {
      toast.error("Nenhum número válido para exportar");
      return;
    }
    
    const content = valid.map(r => `${r.phone}${r.name ? ` ${r.name}` : ''}${r.whatsappName ? ` (${r.whatsappName})` : ''}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'numeros_validos.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`${valid.length} números exportados`);
  };

  // Export invalid numbers
  const exportInvalidNumbers = () => {
    const invalid = verificationResults.filter(r => !r.exists);
    if (invalid.length === 0) {
      toast.error("Nenhum número inválido para exportar");
      return;
    }
    
    const content = invalid.map(r => `${r.phone}${r.name ? ` ${r.name}` : ''}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'numeros_invalidos.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`${invalid.length} números exportados`);
  };

  // Remove Brazil country code (55 or +55) from phone
  const stripBrazilCode = (phone: string): string => {
    let cleaned = phone.replace(/^\+/, '');
    if (cleaned.startsWith('55') && cleaned.length > 10) {
      cleaned = cleaned.slice(2);
    }
    return cleaned;
  };

  // Copy valid numbers to clipboard
  const copyValidNumbers = () => {
    const valid = verificationResults.filter(r => r.exists);
    if (valid.length === 0) {
      toast.error("Nenhum número válido para copiar");
      return;
    }
    const content = valid.map(r => r.phone).join('\n');
    navigator.clipboard.writeText(content);
    toast.success(`${valid.length} números copiados`);
  };

  // Copy valid numbers without +55 prefix
  const copyValidNumbersWithout55 = () => {
    const valid = verificationResults.filter(r => r.exists);
    if (valid.length === 0) {
      toast.error("Nenhum número válido para copiar");
      return;
    }
    const content = valid.map(r => stripBrazilCode(r.phone)).join('\n');
    navigator.clipboard.writeText(content);
    toast.success(`${valid.length} números copiados sem o código 55`);
  };

  const totalNumbers = parsedNumbers.length;
  const validNumbers = verificationResults.filter(r => r.exists).length;
  const invalidNumbers = verificationResults.filter(r => !r.exists).length;

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card className="glass-card">
        <CardHeader className="border-b border-border/30">
          <CardTitle className="flex items-center gap-3">
            <div className="stats-icon-container primary">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Importação Avançada de Contatos</span>
              <CardDescription className="mt-1">
                Importe contatos de Excel, CSV ou TXT com detecção automática
              </CardDescription>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="import" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Importar
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Download className="h-4 w-4" />
                Pré-visualização
                {parsedNumbers.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {parsedNumbers.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import">
              {/* Premium Drag & Drop Area */}
              <div
                className={cn(
                  "drop-zone-premium group",
                  isDragging && "dragging"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="drop-icon mb-4">
                  <Upload className="h-14 w-14 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-foreground font-semibold text-lg mb-2">
                  Arraste e solte o arquivo aqui
                </p>
                <p className="text-muted-foreground text-sm mb-6">
                  ou clique para selecionar do seu computador
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 btn-glass"
                >
                  <FileText className="h-4 w-4" />
                  Selecionar Arquivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Badge variant="outline" className="text-xs">
                    .xlsx
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    .csv
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    .txt
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Tamanho máximo: 10 MB
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preview">
              {parsedNumbers.length === 0 ? (
                <div className="empty-state py-12">
                  <div className="empty-state-icon mb-4">
                    <FileSpreadsheet className="h-10 w-10" />
                  </div>
                  <p className="text-muted-foreground">Nenhum número importado ainda</p>
                </div>
              ) : (
                <ScrollArea className="h-[220px] rounded-xl border border-border/30 bg-background/30">
                  <div className="p-3 space-y-2">
                    {parsedNumbers.map((num, index) => (
                      <div 
                        key={index}
                        className="template-card flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{index + 1}
                          </Badge>
                          <div>
                            <span className="font-mono text-sm">{num.phone}</span>
                            {num.name && (
                              <span className="text-muted-foreground text-sm ml-2">
                                • {num.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeNumber(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Manual Entry & Verification */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual Entry */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-primary" />
              Entrada Manual
            </CardTitle>
            <CardDescription>
              Digite números diretamente ou adicione aos contatos importados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Números</Label>
              <Textarea
                value={manualNumbers}
                onChange={(e) => setManualNumbers(e.target.value)}
                placeholder="Digite os números com nomes (um por linha):
5511999999999 João Silva
+55 11 98888-8888 Maria Santos
11977777777 Pedro Costa"
                className="min-h-[150px] font-mono text-sm bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Suporta: número + nome, apenas número. Formatos: +5511999999999, 5511999999999, 11999999999
            </p>
            <Button onClick={handleAddManualNumbers} className="w-full btn-premium">
              Adicionar à Lista
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Verification */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Verificação WhatsApp
            </CardTitle>
            <CardDescription>
              Verifique se os números estão registrados no WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Instância</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Selecione uma instância conectada" />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma instância conectada
                    </SelectItem>
                  ) : (
                    connectedInstances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {connectedInstances.length === 0 && (
                <p className="text-xs text-destructive">
                  Nenhuma instância conectada encontrada. Conecte uma instância primeiro.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="space-y-0.5">
                <Label>Buscar Nome Original do WhatsApp</Label>
                <p className="text-xs text-muted-foreground">
                  {fetchOriginalName 
                    ? "Ativado: Busca o nome cadastrado no WhatsApp"
                    : "Desativado: Verificação rápida"
                  }
                </p>
              </div>
              <Switch
                checked={fetchOriginalName}
                onCheckedChange={setFetchOriginalName}
              />
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-primary/5 border border-primary/20">
              <span className="text-sm text-foreground font-medium">Total para verificar:</span>
              <Badge className="bg-primary/20 text-primary border-primary/30">
                {totalNumbers} números
              </Badge>
            </div>

            {isVerifying && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/30">
                <div className="progress-animated">
                  <div 
                    className="progress-animated-bar" 
                    style={{ width: `${verificationProgress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-foreground font-medium">
                  Verificando... {Math.round(verificationProgress)}%
                </p>
              </div>
            )}

            <Button 
              onClick={handleVerifyNumbers} 
              className="w-full gap-2 btn-premium"
              disabled={isVerifying || parsedNumbers.length === 0 || !selectedInstance}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Verificar Números ({totalNumbers})
            </Button>

            {totalNumbers > 0 && (
              <Button 
                variant="outline" 
                onClick={clearAllNumbers}
                className="w-full gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Limpar Lista
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {verificationResults.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="border-b border-border/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="stats-icon-container success">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle>Resultados da Verificação</CardTitle>
                  <CardDescription className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {validNumbers} válidos
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-destructive" />
                      {invalidNumbers} inválidos
                    </span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyValidNumbers}
                  className="gap-1.5 bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
                >
                  <Copy className="h-4 w-4" />
                  Copiar Válidos
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyValidNumbersWithout55}
                  className="gap-1.5 bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                >
                  <Copy className="h-4 w-4" />
                  Copiar sem 55
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportValidNumbers}
                  className="gap-1.5 bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
                >
                  <Download className="h-4 w-4" />
                  Exportar Válidos
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportInvalidNumbers}
                  className="gap-1.5 bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
                >
                  <Download className="h-4 w-4" />
                  Exportar Inválidos
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ScrollArea className="h-[320px]">
              <div className="space-y-2 pr-2">
                {verificationResults.map((result, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "result-item",
                      result.exists ? "valid" : "invalid"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {result.exists ? (
                        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </div>
                      )}
                      <div>
                        <p className="font-mono text-sm font-medium">{result.phone}</p>
                        {result.name && (
                          <p className="text-xs text-muted-foreground">{result.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {result.exists ? (
                        <span className="verification-badge valid">
                          {result.whatsappName || "Válido"}
                        </span>
                      ) : (
                        <span className="verification-badge invalid">
                          Inválido
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
