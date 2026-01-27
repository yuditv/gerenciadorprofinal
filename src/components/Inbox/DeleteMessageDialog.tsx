import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChatMessage } from "@/hooks/useInboxMessages";

interface DeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage | null;
  onDelete: (messageId: string, deleteForEveryone: boolean) => Promise<boolean>;
  isDeleting: boolean;
}

export function DeleteMessageDialog({
  open,
  onOpenChange,
  message,
  onDelete,
  isDeleting
}: DeleteMessageDialogProps) {
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  
  // Can only delete for everyone if:
  // 1. Message is from agent (sent by me)
  // 2. Has whatsapp_id in metadata (was sent to WhatsApp)
  const canDeleteForEveryone = message?.sender_type === 'agent' && 
    !!(message?.metadata?.whatsapp_id || message?.metadata?.whatsapp_message_id);

  const handleDelete = async () => {
    if (!message) return;
    const success = await onDelete(message.id, canDeleteForEveryone && deleteForEveryone);
    if (success) {
      onOpenChange(false);
      setDeleteForEveryone(false);
    }
  };

  const truncatedContent = message?.content 
    ? (message.content.length > 100 ? message.content.slice(0, 100) + '...' : message.content)
    : message?.media_url 
      ? '📎 Mídia anexada'
      : '';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Apagar mensagem
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {truncatedContent && (
              <span className="block mt-2 p-2 bg-muted rounded text-sm italic">
                "{truncatedContent}"
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {canDeleteForEveryone && (
          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="deleteForEveryone"
              checked={deleteForEveryone}
              onCheckedChange={(checked) => setDeleteForEveryone(!!checked)}
            />
            <label 
              htmlFor="deleteForEveryone" 
              className="text-sm cursor-pointer select-none"
            >
              Apagar para todos (também remove do WhatsApp)
            </label>
          </div>
        )}

        {!canDeleteForEveryone && message?.sender_type === 'agent' && (
          <p className="text-xs text-muted-foreground py-2">
            Esta mensagem não pode ser apagada do WhatsApp (sem ID de envio).
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDeleting ? 'Apagando...' : (deleteForEveryone && canDeleteForEveryone) ? 'Apagar para todos' : 'Apagar para mim'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
