import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSoundEffects } from "@/hooks/useSoundEffects";

export function SoundToggle() {
  const { isMuted, toggleMute } = useSoundEffects();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="h-9 w-9 rounded-lg hover:bg-primary/10 transition-colors"
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Volume2 className="h-5 w-5 text-primary" />
          )}
          <span className="sr-only">
            {isMuted ? "Ativar sons" : "Desativar sons"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{isMuted ? "Ativar efeitos sonoros" : "Desativar efeitos sonoros"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
