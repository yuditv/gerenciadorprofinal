import { useState } from "react";
import { RefreshCw, Copy, Loader2, Tv, User, Lock, Calendar, Link2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface IPTVTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiUrl: string;
  title: string;
  providerVariant?: "sportplay" | "gextv";
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
  const reply = data.reply || "";

  // Extract Link M3U from reply
  const m3uMatch = reply.match(/📥\s*(http[^\s\n]+)/);
  const linkM3U = m3uMatch ? m3uMatch[1] : "";

  // Extract ASSIST PLUS code
  const assistMatch = reply.match(/ASSIST PLUS\n🔢 Código:\s*(\d+)/);
  const assistPlusCode = assistMatch ? assistMatch[1] : "";

  // Extract CORE PLAYER code
  const coreMatch = reply.match(/CORE PLAYER\n🔢 Código:\s*(\d+)/);
  const corePlayerCode = coreMatch ? coreMatch[1] : "";

  // Extract PlaySim code
  const playSimMatch = reply.match(/🚀?PlaySim\n🔢 Código:\s*(\d+)/);
  const playSimCode = playSimMatch ? playSimMatch[1] : "";

  // Extract XCLOUD provider
  const xcloudMatch = reply.match(/XCLOUD\n🏷️ Provedor:\s*([^\n]+)/);
  const xcloudProvider = xcloudMatch ? xcloudMatch[1].trim() : "";

  return {
    username: data.username || "",
    password: data.password || "",
    expiresAt: data.expiresAtFormatted || data.expiresAt || "",
    connections: String(data.connections || ""),
    linkM3U,
    assistPlusCode,
    corePlayerCode,
    playSimCode,
    xcloudProvider,
  };
};

export function IPTVTestGeneratorDialog({
  open,
  onOpenChange,
  apiUrl,
  title,
  providerVariant = "sportplay",
}: IPTVTestGeneratorDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState<TestCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateTest = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const extracted = extractCredentials(data);
      setCredentials(extracted);
    } catch (err) {
      console.error("Erro ao gerar teste IPTV:", err);
      setError("Erro ao gerar teste. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyField = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const copySectionToClipboard = async (sectionTitle: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copiado!",
        description: `${sectionTitle} copiado para a área de transferência`,
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const copyAll = async () => {
    if (!credentials) return;
    const formattedText =
      providerVariant === "gextv"
        ? `📺 *TESTE IPTV (GEXTV)*

👤 Usuário: ${credentials.username}
🔐 Senha: ${credentials.password}
📅 Expira em: ${credentials.expiresAt}

📱 *APLICATIVO ASSIST+, PLAYSIM OU VIZZION PLAY, LAZER PLAY*
✅ Codigo: ${credentials.assistPlusCode}
✅ Usuário: ${credentials.username}
✅ Senha: ${credentials.password}

🎬 *CORE PLAY*
✅ Codigo: ${credentials.corePlayerCode}
✅ Usuário: ${credentials.username}
✅ Senha: ${credentials.password}

📥 *M3U*
🔗 Link: ${credentials.linkM3U}
📅 Expira em: ${credentials.expiresAt}`
        : `📺 *TESTE IPTV*

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
      toast({ title: "Copiado!", description: "Todos os dados foram copiados" });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCredentials(null);
      setError(null);
      setIsLoading(false);
    }
    onOpenChange(newOpen);
  };

  const CredentialRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value: string;
  }) => (
    <div className="flex items-center py-2 px-3 rounded-md hover:bg-muted/50 transition-colors gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
        {label}:
      </span>
      <span
        className="text-sm font-medium truncate min-w-0 flex-1"
        title={value}
      >
        {value || "-"}
      </span>
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
    sectionTitle,
    icon: Icon,
    children,
    onCopySection,
  }: {
    sectionTitle: string;
    icon: any;
    children: React.ReactNode;
    onCopySection: () => void;
  }) => (
    <div className="rounded-lg border bg-card">
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold text-foreground truncate">
            {sectionTitle}
          </h4>
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
      <div className="divide-y">{children}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Button onClick={generateTest} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={copyAll}
              disabled={!credentials}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar tudo
            </Button>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm shrink-0">
              {error}
            </div>
          )}

          {credentials && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-4 pb-4">
                <CredentialSection
                  sectionTitle="Usuário e Senha"
                  icon={User}
                  onCopySection={() =>
                    copySectionToClipboard(
                      "Usuário e Senha",
                      `👤 Usuário: ${credentials.username}\n🔐 Senha: ${credentials.password}\n📅 Expira em: ${credentials.expiresAt}`
                    )
                  }
                >
                  <CredentialRow
                    icon={User}
                    label="Usuário"
                    value={credentials.username}
                  />
                  <CredentialRow
                    icon={Lock}
                    label="Senha"
                    value={credentials.password}
                  />
                  <CredentialRow
                    icon={Calendar}
                    label="Expira em"
                    value={credentials.expiresAt}
                  />
                </CredentialSection>

                {providerVariant === "gextv" ? (
                  <>
                    <CredentialSection
                      sectionTitle="APLICATIVO ASSIST+, PLAYSIM OU VIZZION PLAY, LAZER PLAY"
                      icon={Smartphone}
                      onCopySection={() =>
                        copySectionToClipboard(
                          "Aplicativo",
                          `📱 *APLICATIVO ASSIST+, PLAYSIM OU VIZZION PLAY, LAZER PLAY*\n✅ Codigo: ${credentials.assistPlusCode}\n✅ Usuário: ${credentials.username}\n✅ Senha: ${credentials.password}`
                        )
                      }
                    >
                      <CredentialRow
                        icon={Smartphone}
                        label="Codigo"
                        value={credentials.assistPlusCode}
                      />
                      <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                      <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                    </CredentialSection>

                    <CredentialSection
                      sectionTitle="CORE PLAY"
                      icon={Tv}
                      onCopySection={() =>
                        copySectionToClipboard(
                          "Core Play",
                          `🎬 *CORE PLAY*\n✅ Codigo: ${credentials.corePlayerCode}\n✅ Usuário: ${credentials.username}\n✅ Senha: ${credentials.password}`
                        )
                      }
                    >
                      <CredentialRow icon={Tv} label="Codigo" value={credentials.corePlayerCode} />
                      <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                      <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                    </CredentialSection>
                  </>
                ) : (
                  <>
                    <CredentialSection
                      sectionTitle="Assist Plus"
                      icon={Smartphone}
                      onCopySection={() =>
                        copySectionToClipboard(
                          "Assist Plus",
                          `📱 *ASSIST PLUS*\n🔢 Código: ${credentials.assistPlusCode}\n👤 Usuário: ${credentials.username}\n🔐 Senha: ${credentials.password}\n📅 Expira em: ${credentials.expiresAt}`
                        )
                      }
                    >
                      <CredentialRow
                        icon={Smartphone}
                        label="Código"
                        value={credentials.assistPlusCode}
                      />
                      <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                      <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                      <CredentialRow icon={Calendar} label="Expira em" value={credentials.expiresAt} />
                    </CredentialSection>

                    <CredentialSection
                      sectionTitle="PlaySim"
                      icon={Smartphone}
                      onCopySection={() =>
                        copySectionToClipboard(
                          "PlaySim",
                          `🚀 *PLAYSIM*\n🔢 Código: ${credentials.playSimCode}\n👤 Usuário: ${credentials.username}\n🔐 Senha: ${credentials.password}\n📅 Expira em: ${credentials.expiresAt}`
                        )
                      }
                    >
                      <CredentialRow
                        icon={Smartphone}
                        label="Código"
                        value={credentials.playSimCode}
                      />
                      <CredentialRow icon={User} label="Usuário" value={credentials.username} />
                      <CredentialRow icon={Lock} label="Senha" value={credentials.password} />
                      <CredentialRow icon={Calendar} label="Expira em" value={credentials.expiresAt} />
                    </CredentialSection>
                  </>
                )}

                <CredentialSection
                  sectionTitle="M3U"
                  icon={Link2}
                  onCopySection={() =>
                    copySectionToClipboard(
                      "M3U",
                      `📥 *M3U*\n🔗 Link: ${credentials.linkM3U}\n📅 Expira em: ${credentials.expiresAt}`
                    )
                  }
                >
                  <CredentialRow
                    icon={Link2}
                    label="Link M3U"
                    value={credentials.linkM3U}
                  />
                  <CredentialRow
                    icon={Calendar}
                    label="Expira em"
                    value={credentials.expiresAt}
                  />
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
