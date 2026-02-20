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

const SERVERPLAY_OPTIONS = [
  {
    label: "SERVER OFICIAL - COMPLETO C ADULTOS",
    url: "https://serverplay.sigmab.pro/api/chatbot/Ar0WZp2La7/EMeWepDnN9",
    color: "bg-green-500",
  },
  {
    label: "SERVER OFICIAL - COMPLETO S ADULTOS",
    url: "https://serverplay.sigmab.pro/api/chatbot/Ar0WZp2La7/BKADdn1lrn",
    color: "bg-green-500",
  },
  {
    label: "SERVER PLAY - COMPLETO C ADULTOS",
    url: "https://serverplay.sigmab.pro/api/chatbot/Ar0WZp2La7/ayb1BQxWPR",
    color: "bg-muted-foreground",
  },
  {
    label: "SERVER PLAY - COMPLETO S ADULTOS",
    url: "https://serverplay.sigmab.pro/api/chatbot/Ar0WZp2La7/qK4WrbQWeN",
    color: "bg-muted-foreground",
  },
];

interface ServerplayTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerplayTestGeneratorDialog({ open, onOpenChange }: ServerplayTestGeneratorDialogProps) {
  const [selectedOption, setSelectedOption] = useState<typeof SERVERPLAY_OPTIONS[number] | null>(null);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedOption(null);
    }
  }, [open]);

  // If an option is selected, show the IPTV generator with that URL
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
      />
    );
  }

  // Show option selection
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            SERVERPLAY - Escolha o servidor
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {SERVERPLAY_OPTIONS.map((option) => (
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
