import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Smartphone, 
  Loader2, 
  Settings, 
  CheckCircle2, 
  Sparkles,
  AlertCircle,
  RefreshCw,
  X,
  Clock,
  User
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CreateInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateInstance: (name: string, dailyLimit?: number) => Promise<any>;
  onRefetch: () => void;
}

type Step = 1 | 2 | 3;
type Status = 'idle' | 'creating' | 'success' | 'error';

export function CreateInstanceDialog({ 
  open, 
  onOpenChange, 
  onCreateInstance,
  onRefetch 
}: CreateInstanceDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Form fields
  const [name, setName] = useState("");
  const [systemName, setSystemName] = useState("");
  const [dailyLimit, setDailyLimit] = useState("500");
  const [adminFieldsOpen, setAdminFieldsOpen] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setStatus('idle');
      setProgress(0);
      setName("");
      setSystemName("");
      setDailyLimit("500");
      setErrorMessage("");
    }
  }, [open]);

  // Progress animation during creation
  useEffect(() => {
    if (status === 'creating') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [status]);

  const generateAutoName = () => {
    const adjectives = ['Principal', 'Vendas', 'Suporte', 'Marketing', 'Atendimento'];
    const suffix = Math.floor(Math.random() * 1000);
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    setName(`WhatsApp-${randomAdj}-${suffix}`);
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleCreate = async () => {
    setStatus('creating');
    setProgress(0);
    
    try {
      const result = await onCreateInstance(name.trim(), parseInt(dailyLimit) || 500);
      
      if (result) {
        setProgress(100);
        setStatus('success');
        setTimeout(() => {
          onOpenChange(false);
          onRefetch();
        }, 1500);
      } else {
        throw new Error("Falha na criação da instância");
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.message || "Falha na criação da instância");
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setProgress(0);
    setErrorMessage("");
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-6">
      {[1, 2, 3].map((s, i) => (
        <div key={s} className="flex items-center">
          <div 
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              s === step 
                ? "bg-primary text-primary-foreground" 
                : s < step 
                  ? "bg-primary/80 text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
            )}
          >
            {s}
          </div>
          {i < 2 && (
            <div 
              className={cn(
                "w-12 h-0.5 transition-all",
                s < step ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  // Creating/Success/Error States
  if (status !== 'idle') {
    return (
      <Dialog open={open} onOpenChange={status === 'creating' ? undefined : onOpenChange}>
        <DialogContent className="sm:max-w-md border-primary/20">
          <button 
            onClick={() => status !== 'creating' && onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 disabled:pointer-events-none"
            disabled={status === 'creating'}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center py-6 text-center">
            {status === 'creating' && (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Sincronizando Dados</h3>
                <p className="text-muted-foreground mb-1">Conectando com banco de dados...</p>
                <p className="text-foreground font-medium mb-4">{name}</p>
                
                <div className="w-full max-w-xs">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="text-foreground">{Math.round(progress)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>Não feche esta janela</span>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Instância Criada!</h3>
                <p className="text-muted-foreground">{name} foi criada com sucesso</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Erro na Criação</h3>
                <p className="text-muted-foreground mb-2">Ocorreu um problema durante o processo</p>
                <p className="text-sm text-foreground font-mono bg-muted px-3 py-1 rounded mb-4">
                  {name || 'instância'}
                </p>

                <div className="w-full max-w-xs mb-4">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-destructive" style={{ width: '0%' }} />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="text-foreground">0%</span>
                  </div>
                </div>

                <div className="w-full bg-destructive/10 text-destructive text-sm py-2 px-4 rounded mb-4">
                  {errorMessage || "Falha na criação da instância"}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleRetry} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Tentar Novamente
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center pt-2 pb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Nova Instância UAZ</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure uma nova instância do WhatsApp API UAZ
          </p>
        </div>

        <StepIndicator />

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Smartphone className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold">Informações Básicas</h3>
              <p className="text-sm text-muted-foreground">Configure os dados principais da instância</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome da Instância *</Label>
              <Input
                id="name"
                placeholder="Ex: minha-empresa-whatsapp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-primary/20 focus:border-primary"
              />
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full gap-2 border-primary/20"
              onClick={generateAutoName}
            >
              <Sparkles className="w-4 h-4" />
              Gerar nome automático
            </Button>

            {name && (
              <div className="bg-muted/50 rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="text-sm">Preview: <span className="font-medium">{name}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Advanced Config */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Settings className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold">Configurações Avançadas</h3>
              <p className="text-sm text-muted-foreground">Opcionais - podem ser configuradas depois</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="systemName">Nome do Sistema</Label>
              </div>
              <Input
                id="systemName"
                placeholder={name || "Nome para uso interno"}
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="border-primary/20 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Usado internamente pelo sistema UAZ</p>
            </div>

            <Collapsible open={adminFieldsOpen} onOpenChange={setAdminFieldsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-primary/20 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Campos Administrativos</span>
                </div>
                <span className="text-muted-foreground">›</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="dailyLimit">Limite Diário de Mensagens</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    placeholder="500"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    min="1"
                    max="5000"
                    className="border-primary/20 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo de mensagens que podem ser enviadas por dia
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold">Confirmação</h3>
              <p className="text-sm text-muted-foreground">Revise as configurações antes de criar</p>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Resumo da Instância</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{name}</span>
                </div>
                {systemName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sistema:</span>
                    <span className="font-medium">{systemName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limite Diário:</span>
                  <span className="font-medium">{dailyLimit} mensagens</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <Clock className="w-4 h-4" />
              <span>Tempo estimado: 5-10 segundos</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t mt-4">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              Voltar
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className={step === 1 ? "flex-1" : ""}
          >
            Cancelar
          </Button>
          {step < 3 ? (
            <Button 
              onClick={handleNext} 
              disabled={step === 1 && !name.trim()}
              className="flex-1"
            >
              Próximo
            </Button>
          ) : (
            <Button onClick={handleCreate} className="flex-1 gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Criar Instância
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
