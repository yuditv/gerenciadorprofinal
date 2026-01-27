import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ClientTag } from "@/hooks/useClientTags";
import { TagBadge } from "./TagBadge";

interface TagFilterProps {
  tags: ClientTag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  onClear: () => void;
}

export function TagFilter({ tags, selectedTagIds, onToggle, onClear }: TagFilterProps) {
  if (tags.length === 0) return null;

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`gap-2 glass-card border-primary/30 hover:border-primary ${
            selectedTagIds.length > 0 ? "border-primary bg-primary/10" : ""
          }`}
        >
          <Tag className="h-4 w-4" />
          {selectedTagIds.length > 0 ? (
            <span className="flex items-center gap-1">
              Filtrar: {selectedTagIds.length}
              <X
                className="h-3 w-3 ml-1 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
              />
            </span>
          ) : (
            <span>Filtrar por Tag</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="glass-card border-border/50 min-w-48">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <DropdownMenuItem
              key={tag.id}
              onClick={() => onToggle(tag.id)}
              className={`flex items-center justify-between ${isSelected ? "bg-primary/10" : ""}`}
            >
              <TagBadge name={tag.name} color={tag.color} />
              {isSelected && (
                <span className="text-xs text-primary">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
        {selectedTagIds.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClear} className="text-muted-foreground">
              Limpar filtros
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
