import { useState } from "react";
import { RefreshCw, Copy, Loader2, Tv, User, Lock, Calendar, Link2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface TestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestCredentials {
  username: string;
  password: string;
  expiresAt: string;
  connections: string;
  linkM3U: string;
  assistPlusCode: string;
  corePlayerCode: string;
  playSimCode: string;
  xcloudProvider: string;
}

const extractCredentials = (data: any): TestCredentials => {
  const reply = data.reply || '';
  
  // Extract Link M3U from reply
  const m3uMatch = reply.match(/📥\s*(http[^\s\n]+)/);
  const linkM3U = m3uMatch ? m3uMatch[1] : '';
  
  // Extract ASSIST PLUS code
  const assistMatch = reply.match(/ASSIST PLUS\n🔢 Código:\s*(\d+)/);
  const assistPlusCode = assistMatch ? assistMatch[1] : '';
  
  // Extract CORE PLAYER code
  const coreMatch = reply.match(/CORE PLAYER\n🔢 Código:\s*(\d+)/);
  const corePlayerCode = coreMatch ? coreMatch[1] : '';
  
  // Extract PlaySim code
  const playSimMatch = reply.match(/🚀?PlaySim\n🔢 Código:\s*(\d+)/);
  const playSimCode = playSimMatch ? playSimMatch[1] : '';
  
  // Extract XCLOUD provider
  const xcloudMatch = reply.match(/XCLOUD\n🏷️ Provedor:\s*([^\n]+)/);
  const xcloudProvider = xcloudMatch ? xcloudMatch[1].trim() : '';

  return {
    username: data.username || '',
    password: data.password || '',
    expiresAt: data.expiresAtFormatted || data.expiresAt || '',
    connections: String(data.connections || ''),
    linkM3U,
    assistPlusCode,
    corePlayerCode,
    playSimCode,
    xcloudProvider,
  };
};

export function TestGeneratorDialog({ open, onOpenChange }: TestGeneratorDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState<TestCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateTest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        "https://sportplay.sigmab.pro/api/chatbot/80m1Eev1lE/VpKDaPJLRA",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("🔍 JSON da API:", JSON.stringify(data, null, 2));
      const extracted = extractCredentials(data);
      setCredentials(extracted);
    } catch (err) {
      console.error("Erro ao gerar teste:", err);
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

  const copySectionToClipboard = async (title: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ 
        title: "Copiado!", 
        description: `${title} copiado para a área de transferência` 
      });
    } catch (err) {
      toast({ 
        title: "Erro ao copiar", 
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive"
      });
    }
  };

  const copyAll = async () => {
    if (credentials) {
      const formattedText = `📺 *TESTE IPTV*

👤 Usuário: ${credentials.username}
🔐 Senha: ${credentials.password}
📅 Expira em: ${credentials.expiresAt}

📱 *ASSIST PLUS*
🔢 Código: ${credentials.assistPlusCode}
👤 Usuário: ${credentials.username}
🔐 Senha: ${credentials.password}
📅 Expira em: ${credentials.expiresAt}

🚀 *PLAYSIM*
🔢 Código: ${credentials.playSimCode}
👤 Usuário: ${credentials.username}
🔐 Senha: ${credentials.password}
📅 Expira em: ${credentials.expiresAt}

📥 *M3U*
🔗 Link: ${credentials.linkM3U}
📅 Expira em: ${credentials.expiresAt}`;

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
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const CredentialRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-center py-2 px-3 rounded-md hover:bg-muted/50 transition-colors gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">{label}:</span>
      <span className="text-sm font-medium truncate min-w-0 flex-1" title={value}>{value || '-'}</span>
      {value && (
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => copyField(label, value)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const CredentialSection = ({ 
    title, 
    icon: Icon,
    children,
    onCopySection
  }: { 
    title: string; 
    icon: any;
    children: React.ReactNode;
    onCopySection: () => void;
  }) => (
    <div className="rounded-lg border bg-card">
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold text-foreground truncate">{title}</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={onCopySection}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copiar
        </Button>
      </div>
      <div className="divide-y">
        {children}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Gerar Teste IPTV
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
          
          {credentials && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-4 pb-4">
                {/* Credenciais Básicas */}
                <CredentialSection 
                  title="Usuário e Senha" 
                  icon={User}
                  onCopySection={() => copySectionToClipboard(
                    "Usuário e Senha",
                    `👤 Usuário: ${credentials.username}\n🔐 Senha: ${credentials.password}\n📅 Expira em: ${credentials.expiresAt}`
                  )}
                >
                  <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                  <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                  <CredentialRow icon={Calendar} label="Expira em" value={credentials.expiresAt} />
                </CredentialSection>

                {/* Assist Plus */}
                <CredentialSection 
                  title="Assist Plus" 
                  icon={Smartphone}
                  onCopySection={() => copySectionToClipboard(
                    "Assist Plus",
                    `📱 *ASSIST PLUS*\n🔢 Código: ${credentials.assistPlusCode}\n👤 Usuário: ${credentials.username}\n🔐 Senha: ${credentials.password}\n📅 Expira em: ${credentials.expiresAt}`
                  )}
                >
                  <CredentialRow icon={Smartphone} label="Código" value={credentials.assistPlusCode} />
                  <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                  <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                  <CredentialRow icon={Calendar} label="Expira em" value={credentials.expiresAt} />
                </CredentialSection>

                {/* PlaySim */}
                <CredentialSection 
                  title="PlaySim" 
                  icon={Smartphone}
                  onCopySection={() => copySectionToClipboard(
                    "PlaySim",
                    `🚀 *PLAYSIM*\n🔢 Código: ${credentials.playSimCode}\n👤 Usuário: ${credentials.username}\n🔐 Senha: ${credentials.password}\n📅 Expira em: ${credentials.expiresAt}`
                  )}
                >
                  <CredentialRow icon={Smartphone} label="Código" value={credentials.playSimCode} />
                  <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                  <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                  <CredentialRow icon={Calendar} label="Expira em" value={credentials.expiresAt} />
                </CredentialSection>

                {/* M3U */}
                <CredentialSection 
                  title="M3U" 
                  icon={Link2}
                  onCopySection={() => copySectionToClipboard(
                    "M3U",
                    `📥 *M3U*\n🔗 Link: ${credentials.linkM3U}\n📅 Expira em: ${credentials.expiresAt}`
                  )}
                >
                  <CredentialRow icon={Link2} label="Link M3U" value={credentials.linkM3U} />
                  <CredentialRow icon={Calendar} label="Expira em" value={credentials.expiresAt} />
                </CredentialSection>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 shrink-0 border-t mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
