import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IPTVTestChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseSportplay: () => void;
  onChooseGextv: () => void;
}

export function IPTVTestChoiceDialog({
  open,
  onOpenChange,
  onChooseSportplay,
  onChooseGextv,
}: IPTVTestChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            IPTV
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Button
            onClick={() => {
              onOpenChange(false);
              onChooseGextv();
            }}
            className="w-full"
          >
            TESTE GEXTV
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onChooseSportplay();
            }}
            className="w-full"
          >
            TESTE SPORTPLAY
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
