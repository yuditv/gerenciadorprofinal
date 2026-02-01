import { useEffect, useState } from "react";
import { Copy, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { CustomerChatLink } from "@/hooks/useCustomerChatLinks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => Promise<CustomerChatLink | null>;
  getInviteUrl: (token: string) => string;
};

export function CreateCustomerChatLinkDialog({ open, onOpenChange, onCreate, getInviteUrl }: Props) {
  const { toast } = useToast();
  const [created, setCreated] = useState<CustomerChatLink | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setCreated(null);
      setInviteUrl("");
      setIsCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    setIsCreating(true);
    const link = await onCreate();
    setCreated(link);
    setInviteUrl(link ? getInviteUrl(link.token) : "");
    setIsCreating(false);
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Link copiado", description: "Envie esse link para o cliente." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Criar link do chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!created ? (
            <Button onClick={handleCreate} disabled={isCreating} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {isCreating ? "Criando..." : "Criar link"}
            </Button>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Link criado. O cliente vai cadastrar <span className="font-medium text-foreground">nome obrigatório</span> ao acessar.
              </div>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
