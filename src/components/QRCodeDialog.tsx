import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, QrCode, Smartphone, Copy, Check, Loader2 } from "lucide-react";
import { WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { toast } from "sonner";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: WhatsAppInstance | null;
  getQRCode: (instanceId: string) => Promise<string | null>;
  getPairingCode?: (instanceId: string, phoneNumber: string) => Promise<string | null>;
}

export function QRCodeDialog({ open, onOpenChange, instance, getQRCode, getPairingCode }: QRCodeDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("qrcode");
  
  // Pairing code state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchQRCode = async () => {
    if (!instance) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const code = await getQRCode(instance.id);
      if (code) {
        setQrCode(code);
      } else {
        setError("Não foi possível obter o QR Code. A instância pode já estar conectada.");
      }
    } catch (err) {
      setError("Erro ao buscar QR Code");
    } finally {
      setLoading(false);
    }
  };

  const fetchPairingCode = async () => {
    if (!instance || !phoneNumber.trim() || !getPairingCode) return;
    
    // Clean phone number - remove non-digits
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      setPairingError("Número de telefone inválido. Inclua o código do país (ex: 5511999999999)");
      return;
    }
    
    setPairingLoading(true);
    setPairingError(null);
    setPairingCode(null);
    
    try {
      const code = await getPairingCode(instance.id, cleanPhone);
      if (code) {
        setPairingCode(code);
      } else {
        setPairingError("Não foi possível gerar o código. Tente novamente ou use o QR Code.");
      }
    } catch (err: any) {
      setPairingError(err.message || "Erro ao gerar código de pareamento");
    } finally {
      setPairingLoading(false);
    }
  };

  const copyPairingCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (open && instance) {
      fetchQRCode();
    } else {
      setQrCode(null);
      setError(null);
      setPairingCode(null);
      setPairingError(null);
      setPhoneNumber("");
      setActiveTab("qrcode");
    }
  }, [open, instance]);

  // Auto-refresh QR Code every 30 seconds
  useEffect(() => {
    if (!open || !instance || instance.status === 'connected' || activeTab !== 'qrcode') return;
    
    const interval = setInterval(() => {
      fetchQRCode();
    }, 30000);

    return () => clearInterval(interval);
  }, [open, instance, activeTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Conectar - {instance?.instance_name}
          </DialogTitle>
          <DialogDescription>
            Escolha como conectar sua instância WhatsApp
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qrcode" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="paircode" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Código
            </TabsTrigger>
          </TabsList>

          {/* QR Code Tab */}
          <TabsContent value="qrcode" className="mt-4">
            <div className="flex flex-col items-center space-y-4">
              {loading ? (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="w-64 h-64 flex flex-col items-center justify-center bg-muted rounded-lg text-center p-4">
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={fetchQRCode}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div>
              ) : qrCode ? (
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-56 h-56"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">QR Code não disponível</p>
                </div>
              )}

              <div className="text-center space-y-2">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Como conectar:</p>
                  <ol className="list-decimal list-inside text-left text-xs space-y-1">
                    <li>Abra o WhatsApp no celular</li>
                    <li>Vá em <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Escaneie o QR Code</li>
                  </ol>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Atualiza a cada 30 segundos
                </p>
                
                <Button variant="outline" size="sm" onClick={fetchQRCode} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Pairing Code Tab */}
          <TabsContent value="paircode" className="mt-4">
            <div className="flex flex-col space-y-4">
              {/* Info Alert about API Support */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-600 dark:text-amber-400">
                <p className="font-medium mb-1">⚠️ Recurso Experimental</p>
                <p className="text-xs">
                  O código de pareamento pode não estar disponível dependendo da configuração do servidor UAZAPI. 
                  Se não funcionar, use o QR Code.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-center text-lg tracking-wider"
                />
                <p className="text-xs text-muted-foreground">
                  Digite o número com código do país (ex: 55 para Brasil)
                </p>
              </div>

              <Button 
                onClick={fetchPairingCode} 
                disabled={pairingLoading || !phoneNumber.trim() || !getPairingCode}
                className="w-full"
              >
                {pairingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando código...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Gerar Código de Pareamento
                  </>
                )}
              </Button>

              {pairingError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                  <p className="font-medium mb-1">Não disponível</p>
                  <p className="text-xs">{pairingError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 w-full"
                    onClick={() => setActiveTab("qrcode")}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Usar QR Code
                  </Button>
                </div>
              )}

              {pairingCode && (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <p className="text-xs text-muted-foreground text-center mb-2">
                      Seu código de pareamento:
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-2xl font-mono font-bold tracking-[0.5em] text-primary">
                        {pairingCode}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={copyPairingCode}
                        className="h-8 w-8"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium">Como usar:</p>
                    <ol className="list-decimal list-inside text-xs space-y-1">
                      <li>Abra o WhatsApp no celular</li>
                      <li>Vá em <strong>Aparelhos conectados</strong></li>
                      <li>Toque em <strong>Conectar um aparelho</strong></li>
                      <li>Toque em <strong>Conectar com número</strong></li>
                      <li>Digite o código acima</li>
                    </ol>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    ⏱️ O código expira em poucos minutos
                  </p>
                </div>
              )}

              {!pairingCode && !pairingError && (
                <div className="text-center text-sm text-muted-foreground space-y-2 pt-2">
                  <p className="text-xs">
                    Digite seu número e clique em gerar para obter o código.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
