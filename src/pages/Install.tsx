import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Download, Smartphone, Monitor, CheckCircle, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Instalar App</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {isInstalled ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">App Instalado!</h2>
              <p className="text-muted-foreground">
                O app já está instalado no seu dispositivo. Você pode acessá-lo pela tela inicial.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 rounded-2xl bg-primary/10">
                  <Smartphone className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Instale o App</CardTitle>
                <CardDescription>
                  Acesse o gerenciador de clientes diretamente da sua tela inicial, com acesso rápido e funcionamento offline.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Acesso Rápido</p>
                      <p className="text-sm text-muted-foreground">
                        Abra o app direto da tela inicial, sem precisar do navegador
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Funciona Offline</p>
                      <p className="text-sm text-muted-foreground">
                        Visualize dados mesmo sem conexão com a internet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Experiência Nativa</p>
                      <p className="text-sm text-muted-foreground">
                        Interface otimizada para celular com tela cheia
                      </p>
                    </div>
                  </div>
                </div>

                {deferredPrompt ? (
                  <Button onClick={handleInstall} className="w-full" size="lg">
                    <Download className="h-5 w-5 mr-2" />
                    Instalar Agora
                  </Button>
                ) : isIOS ? (
                  <Card className="border-primary/30">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        Como instalar no iPhone/iPad:
                      </h3>
                      <ol className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            1
                          </span>
                          <span>
                            Toque no botão <Share className="h-4 w-4 inline" /> <strong>Compartilhar</strong> na barra do Safari
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            2
                          </span>
                          <span>
                            Role e toque em <Plus className="h-4 w-4 inline" /> <strong>Adicionar à Tela de Início</strong>
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            3
                          </span>
                          <span>
                            Toque em <strong>Adicionar</strong> no canto superior direito
                          </span>
                        </li>
                      </ol>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-primary/30">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        Como instalar no Android:
                      </h3>
                      <ol className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            1
                          </span>
                          <span>
                            Toque no menu <strong>⋮</strong> (três pontos) do navegador
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            2
                          </span>
                          <span>
                            Selecione <strong>Adicionar à tela inicial</strong> ou <strong>Instalar app</strong>
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            3
                          </span>
                          <span>
                            Confirme tocando em <strong>Adicionar</strong>
                          </span>
                        </li>
                      </ol>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Button variant="outline" onClick={() => navigate("/")} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para o App
        </Button>
      </main>
    </div>
  );
}
