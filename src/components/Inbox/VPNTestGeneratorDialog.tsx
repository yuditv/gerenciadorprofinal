import { Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VPNTestGenerator } from "@/components/Inbox/VPNTest/VPNTestGenerator";

interface VPNTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VPNTestGeneratorDialog({ open, onOpenChange }: VPNTestGeneratorDialogProps) {
  const handleOpenChange = (newOpen: boolean) => onOpenChange(newOpen);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Teste VPN (Online)
          </DialogTitle>
          <DialogDescription>
            Clique em “Gerar no painel” para criar o teste diretamente no Servex e copie os dados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto pr-1">
          <VPNTestGenerator />
        </div>
      </DialogContent>
    </Dialog>
  );
}
