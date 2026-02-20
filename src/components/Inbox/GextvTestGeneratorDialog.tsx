import { useState, useEffect } from "react";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IPTVTestGeneratorDialog } from "./IPTVTestGeneratorDialog";

const GEXTV_OPTIONS = [
  {
    label: "GEXTV - TESTE (3 H) C/ ADULTOS 2 TELAS",
    url: "https://bommesmo.site/api/chatbot/8241KEgDmx/nVrW8oDKaN",
    color: "bg-green-500",
  },
  {
    label: "GEXTV - TESTE (3 H) S/ ADULTOS 🔞 2 TELAS",
    url: "https://bommesmo.site/api/chatbot/8241KEgDmx/b8K1x6DvGN",
    color: "bg-red-500",
  },
];

interface GextvTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GextvTestGeneratorDialog({ open, onOpenChange }: GextvTestGeneratorDialogProps) {
  const [selectedOption, setSelectedOption] = useState<typeof GEXTV_OPTIONS[number] | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedOption(null);
    }
  }, [open]);

  if (selectedOption && open) {
    return (
      <IPTVTestGeneratorDialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setSelectedOption(null);
          }
          onOpenChange(newOpen);
        }}
        title={`Gerar Teste - ${selectedOption.label}`}
        apiUrl={selectedOption.url}
        providerVariant="gextv"
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            GEXTV - Escolha o teste
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {GEXTV_OPTIONS.map((option) => (
            <Button
              key={option.url}
              variant="outline"
              onClick={() => setSelectedOption(option)}
              className="w-full justify-start gap-3 h-auto py-3"
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${option.color}`} />
              <span className="text-sm font-medium">{option.label}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
