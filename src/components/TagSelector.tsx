import { useState } from "react";
import { Check, ChevronDown, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ClientTag } from "@/hooks/useClientTags";
import { TagBadge } from "./TagBadge";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  availableTags: ClientTag[];
  selectedTags: ClientTag[];
  onToggle: (tagId: string, selected: boolean) => void;
  compact?: boolean;
}

export function TagSelector({
  availableTags,
  selectedTags,
  onToggle,
  compact = false,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            "gap-2 glass-card border-primary/30 hover:border-primary",
            compact && "h-7 px-2 text-xs"
          )}
        >
          <Tag className={compact ? "h-3 w-3" : "h-4 w-4"} />
          {selectedTags.length > 0 ? (
            <span>{selectedTags.length} tag{selectedTags.length > 1 ? "s" : ""}</span>
          ) : (
            <span>Tags</span>
          )}
          <ChevronDown className={compact ? "h-3 w-3" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="glass-card border-border/50 w-56 p-2" align="start">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {availableTags.map((tag) => {
            const isSelected = selectedIds.has(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => onToggle(tag.id, !isSelected)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                )}
              >
                <TagBadge name={tag.name} color={tag.color} />
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
