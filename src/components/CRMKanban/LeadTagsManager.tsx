import { useState } from 'react';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LeadTag } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface LeadTagsManagerProps {
  leadId: string;
  currentTags: LeadTag[];
  availableTags: LeadTag[];
  onAssignTag: (leadId: string, tagId: string) => Promise<boolean>;
  onRemoveTag: (leadId: string, tagId: string) => Promise<boolean>;
  onCreateTag: (name: string, color: string) => Promise<LeadTag | null>;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

export function LeadTagsManager({
  leadId,
  currentTags,
  availableTags,
  onAssignTag,
  onRemoveTag,
  onCreateTag,
}: LeadTagsManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const unassignedTags = availableTags.filter(
    tag => !currentTags.some(ct => ct.id === tag.id)
  );

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const newTag = await onCreateTag(newTagName.trim(), selectedColor);
    if (newTag) {
      await onAssignTag(leadId, newTag.id);
      setNewTagName('');
      setIsCreating(false);
    }
  };

  const handleAssign = async (tagId: string) => {
    await onAssignTag(leadId, tagId);
  };

  const handleRemove = async (tagId: string) => {
    await onRemoveTag(leadId, tagId);
  };

  return (
    <div className="space-y-2">
      {/* Current Tags */}
      <div className="flex flex-wrap gap-1.5">
        {currentTags.map(tag => (
          <Badge
            key={tag.id}
            className="group pl-2 pr-1 py-0.5 gap-1"
            style={{ backgroundColor: tag.color }}
          >
            <span className="text-white text-xs">{tag.name}</span>
            <button
              onClick={() => handleRemove(tag.id)}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </Badge>
        ))}

        {/* Add Tag Button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              {!isCreating ? (
                <>
                  {/* Existing Tags */}
                  {unassignedTags.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground px-1">Tags disponíveis</p>
                      <div className="flex flex-wrap gap-1">
                        {unassignedTags.map(tag => (
                          <Badge
                            key={tag.id}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: tag.color }}
                            onClick={() => handleAssign(tag.id)}
                          >
                            <span className="text-white text-xs">{tag.name}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create New Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Criar nova tag
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Nome da tag"
                    className="h-8 text-sm"
                    autoFocus
                  />

                  {/* Color Picker */}
                  <div className="flex flex-wrap gap-1">
                    {TAG_COLORS.map(color => (
                      <button
                        key={color}
                        className={cn(
                          "w-5 h-5 rounded-full transition-all",
                          selectedColor === color && "ring-2 ring-offset-1 ring-primary"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>

                  {/* Preview */}
                  {newTagName && (
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                      <Badge style={{ backgroundColor: selectedColor }}>
                        <span className="text-white text-xs">{newTagName}</span>
                      </Badge>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => {
                        setIsCreating(false);
                        setNewTagName('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                    >
                      Criar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
