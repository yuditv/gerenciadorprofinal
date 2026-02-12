import { IPTVTestGeneratorDialog } from "./IPTVTestGeneratorDialog";

interface ServerplayTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerplayTestGeneratorDialog({ open, onOpenChange }: ServerplayTestGeneratorDialogProps) {
  return (
    <IPTVTestGeneratorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Gerar Teste IPTV (SERVERPLAY)"
      apiUrl="https://serverplay.sigmab.pro/api/chatbot/Ar0WZp2La7/EMeWepDnN9"
    />
  );
}
