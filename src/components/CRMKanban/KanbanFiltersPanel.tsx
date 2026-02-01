import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  KanbanFilters,
  KANBAN_STATUSES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_TEMPERATURES,
  LeadTag,
} from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface KanbanFiltersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: KanbanFilters;
  setFilters: (filters: KanbanFilters) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  tags: LeadTag[];
}

export function KanbanFiltersPanel({
  open,
  onOpenChange,
  filters,
  setFilters,
  resetFilters,
  hasActiveFilters,
  tags,
}: KanbanFiltersPanelProps) {
  const toggleArrayFilter = (
    key: 'status' | 'priority' | 'source' | 'temperature' | 'tags',
    value: string
  ) => {
    const currentValues = filters[key];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    setFilters({ ...filters, [key]: newValues });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Filtros</SheetTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-6">
            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex flex-wrap gap-2">
                {KANBAN_STATUSES.map(status => (
                  <Badge
                    key={status.id}
                    variant={filters.status.includes(status.id) ? 'default' : 'outline'}
                    className={cn(
                      "cursor-pointer transition-all",
                      filters.status.includes(status.id) && status.color
                    )}
                    onClick={() => toggleArrayFilter('status', status.id)}
                  >
                    {status.title}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Priority Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Prioridade</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_PRIORITIES.map(priority => (
                  <Badge
                    key={priority.id}
                    variant={filters.priority.includes(priority.id) ? 'default' : 'outline'}
                    className={cn(
                      "cursor-pointer transition-all",
                      filters.priority.includes(priority.id) && priority.color
                    )}
                    onClick={() => toggleArrayFilter('priority', priority.id)}
                  >
                    {priority.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Temperature Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Temperatura</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_TEMPERATURES.map(temp => (
                  <Badge
                    key={temp.id}
                    variant={filters.temperature.includes(temp.id) ? 'default' : 'outline'}
                    className={cn(
                      "cursor-pointer transition-all",
                      filters.temperature.includes(temp.id) && temp.color
                    )}
                    onClick={() => toggleArrayFilter('temperature', temp.id)}
                  >
                    {temp.icon} {temp.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Source Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Origem</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_SOURCES.slice(0, 6).map(source => (
                  <Badge
                    key={source.id}
                    variant={filters.source.includes(source.id) ? 'default' : 'outline'}
                    className="cursor-pointer transition-all"
                    onClick={() => toggleArrayFilter('source', source.id)}
                  >
                    {source.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Follow-up Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Follow-up</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasFollowUp"
                    checked={filters.hasFollowUp === true}
                    onCheckedChange={(checked) =>
                      setFilters({
                        ...filters,
                        hasFollowUp: checked ? true : null,
                      })
                    }
                  />
                  <Label htmlFor="hasFollowUp" className="text-sm font-normal cursor-pointer">
                    Com follow-up agendado
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="noFollowUp"
                    checked={filters.hasFollowUp === false}
                    onCheckedChange={(checked) =>
                      setFilters({
                        ...filters,
                        hasFollowUp: checked ? false : null,
                      })
                    }
                  />
                  <Label htmlFor="noFollowUp" className="text-sm font-normal cursor-pointer">
                    Sem follow-up
                  </Label>
                </div>
              </div>
            </div>

            {/* Tags Filter */}
            {tags.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Etiquetas</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant={filters.tags.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer transition-all"
                        style={{
                          backgroundColor: filters.tags.includes(tag.id) ? tag.color : undefined,
                          borderColor: tag.color,
                          color: filters.tags.includes(tag.id) ? 'white' : tag.color,
                        }}
                        onClick={() => toggleArrayFilter('tags', tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
