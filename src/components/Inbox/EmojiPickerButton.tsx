import { useState } from "react";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPickerButton({ onEmojiSelect, disabled }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emojiData: { native: string }) => {
    onEmojiSelect(emojiData.native);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              disabled={disabled}
            >
              <Smile className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Inserir emoji</TooltipContent>
      </Tooltip>
      <PopoverContent 
        side="top" 
        align="end" 
        className="w-auto p-0 border-0 bg-transparent shadow-none"
        sideOffset={8}
      >
        <Picker
          data={data}
          onEmojiSelect={handleSelect}
          theme="auto"
          locale="pt"
          previewPosition="none"
          skinTonePosition="none"
          emojiSize={22}
          emojiButtonSize={32}
          maxFrequentRows={2}
        />
      </PopoverContent>
    </Popover>
  );
}
