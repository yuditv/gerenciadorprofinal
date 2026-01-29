import { IPTVTestGeneratorDialog } from "./IPTVTestGeneratorDialog";

interface TestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestGeneratorDialog({ open, onOpenChange }: TestGeneratorDialogProps) {
  return (
    <IPTVTestGeneratorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Gerar Teste IPTV (SPORTPLAY)"
      apiUrl="https://sportplay.sigmab.pro/api/chatbot/80m1Eev1lE/VpKDaPJLRA"
    />
  );
}

