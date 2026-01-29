import { IPTVTestGeneratorDialog } from "./IPTVTestGeneratorDialog";

interface GextvTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GextvTestGeneratorDialog({ open, onOpenChange }: GextvTestGeneratorDialogProps) {
  return (
    <IPTVTestGeneratorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Gerar Teste IPTV (GEXTV)"
      apiUrl="https://bommesmo.site/api/chatbot/8241KEgDmx/nVrW8oDKaN"
    />
  );
}
