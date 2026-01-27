import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientTag } from "@/hooks/useClientTags";
import { TagBadge } from "./TagBadge";

const TAG_COLORS = [
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

interface TagManagerProps {
  tags: ClientTag[];
  onCreate: (name: string, color: string) => Promise<ClientTag | null>;
  onUpdate: (id: string, name: string, color: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TagManager({ tags, onCreate, onUpdate, onDelete }: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [editingTag, setEditingTag] = useState<ClientTag | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setIsSubmitting(true);
    await onCreate(newTagName.trim(), newTagColor);
    setNewTagName("");
    setNewTagColor(TAG_COLORS[0]);
    setIsSubmitting(false);
  };

  const handleUpdate = async () => {
    if (!editingTag || !newTagName.trim()) return;
    setIsSubmitting(true);
    await onUpdate(editingTag.id, newTagName.trim(), newTagColor);
    setEditingTag(null);
    setNewTagName("");
    setNewTagColor(TAG_COLORS[0]);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta tag? Ela será removida de todos os clientes.")) {
      await onDelete(id);
    }
  };

  const startEdit = (tag: ClientTag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setNewTagName("");
    setNewTagColor(TAG_COLORS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 glass-card border-primary/30 hover:border-primary">
          <Plus className="h-4 w-4" />
          Gerenciar Tags
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gradient">Gerenciar Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create/Edit Form */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30">
            <Input
              placeholder="Nome da tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="bg-background/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  editingTag ? handleUpdate() : handleCreate();
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    newTagColor === color
                      ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {editingTag ? (
                <>
                  <Button onClick={handleUpdate} disabled={isSubmitting || !newTagName.trim()} className="flex-1">
                    Atualizar
                  </Button>
                  <Button variant="outline" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreate} disabled={isSubmitting || !newTagName.trim()} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Tag
                </Button>
              )}
            </div>
          </div>

          {/* Tags List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma tag criada ainda
              </p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                >
                  <TagBadge name={tag.name} color={tag.color} size="md" />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEdit(tag)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tag.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
