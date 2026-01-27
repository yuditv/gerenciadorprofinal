import { useState } from "react";
import { RefreshCw, Copy, Loader2, Wifi, User, Lock, Calendar, Clock, Server, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VPNTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VPNTestCredentials {
  username?: string;
  password?: string;
  expiresAt?: string;
  duration?: string;
  server?: string;
  protocol?: string;
  [key: string]: string | undefined;
}

export function VPNTestGeneratorDialog({ open, onOpenChange }: VPNTestGeneratorDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState<VPNTestCredentials | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateTest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('vpn-test-generator');
      
      if (fnError) {
        throw new Error(fnError.message);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      console.log("🔍 VPN API Response:", JSON.stringify(data, null, 2));
      setRawResponse(data);
      
      // Try to extract common fields
      const extracted: VPNTestCredentials = {
        username: data.username || data.user || data.login || '',
        password: data.password || data.pass || data.senha || '',
        expiresAt: data.expiresAt || data.expires_at || data.expiration || data.validade || '',
        duration: data.duration || data.duracao || '',
        server: data.server || data.servidor || data.host || '',
        protocol: data.protocol || data.protocolo || data.type || '',
      };
      
      setCredentials(extracted);
    } catch (err) {
      console.error("Erro ao gerar teste VPN:", err);
      setError("Erro ao gerar teste. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyField = async (label: string, value: string) => {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        toast({ 
          title: "Copiado!", 
          description: `${label} copiado para a área de transferência` 
        });
      } catch (err) {
        toast({ 
          title: "Erro ao copiar", 
          description: "Não foi possível copiar para a área de transferência",
          variant: "destructive"
        });
      }
    }
  };

  const copyAll = async () => {
    if (rawResponse) {
      const formattedText = JSON.stringify(rawResponse, null, 2);
      try {
        await navigator.clipboard.writeText(formattedText);
        toast({ 
          title: "Copiado!", 
          description: "Todos os dados foram copiados" 
        });
      } catch (err) {
        toast({ 
          title: "Erro ao copiar", 
          description: "Não foi possível copiar para a área de transferência",
          variant: "destructive"
        });
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCredentials(null);
      setRawResponse(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const CredentialRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-center py-2 px-3 rounded-md hover:bg-muted/50 transition-colors gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">{label}:</span>
      <span className="text-sm font-medium truncate flex-1" title={value}>{value || '-'}</span>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => copyField(label, value)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  // Render all fields from rawResponse dynamically
  const renderDynamicFields = () => {
    if (!rawResponse || typeof rawResponse !== 'object') return null;
    
    const iconMap: Record<string, any> = {
      username: User,
      user: User,
      login: User,
      password: Lock,
      pass: Lock,
      senha: Lock,
      expires: Calendar,
      expiresAt: Calendar,
      expires_at: Calendar,
      expiration: Calendar,
      validade: Calendar,
      duration: Clock,
      duracao: Clock,
      server: Server,
      servidor: Server,
      host: Server,
    };
    
    return Object.entries(rawResponse).map(([key, value]) => {
      if (value === null || value === undefined || value === '') return null;
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const Icon = iconMap[key] || Globe;
      return (
        <CredentialRow 
          key={key} 
          icon={Icon} 
          label={key} 
          value={stringValue} 
        />
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Gerar Teste VPN / Internet Ilimitada
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <Button 
            onClick={generateTest} 
            disabled={isLoading}
            className="w-full shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Novo Teste
              </>
            )}
          </Button>
          
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm shrink-0">
              {error}
            </div>
          )}
          
          {rawResponse && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 pr-4">
                <div className="rounded-lg border bg-card">
                  <div className="px-3 py-2 border-b">
                    <h4 className="text-sm font-semibold text-foreground">Dados do Teste</h4>
                  </div>
                  <div className="divide-y">
                    {renderDynamicFields()}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 shrink-0 border-t mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
          {rawResponse && (
            <Button onClick={copyAll} variant="default">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Tudo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
