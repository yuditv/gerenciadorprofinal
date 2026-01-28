import { Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
            Teste VPN (Offline)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto pr-1">
          <VPNTestGenerator />
        </div>
      </DialogContent>
    </Dialog>
  );
}
