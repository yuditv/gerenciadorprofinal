import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import { CannedResponse } from '@/hooks/useCannedResponses';

interface QuickReplyAutocompleteProps {
  responses: CannedResponse[];
  isVisible: boolean;
  selectedIndex: number;
  onSelect: (response: CannedResponse) => void;
}

export function QuickReplyAutocomplete({
  responses,
  isVisible,
  selectedIndex,
  onSelect
}: QuickReplyAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isVisible || responses.length === 0) return null;

  return (
    <div 
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
    >
      <div className="p-1">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
          Respostas Rápidas
        </div>
        {responses.map((response, index) => (
          <button
            key={response.id}
            data-item
            className={cn(
              "w-full flex items-start gap-2 px-2 py-2 rounded-md text-left transition-colors",
              index === selectedIndex 
                ? "bg-accent text-accent-foreground" 
                : "hover:bg-muted"
            )}
            onClick={() => onSelect(response)}
          >
            <MessageSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  /{response.short_code}
                </span>
                {response.is_global && (
                  <span className="text-xs text-muted-foreground">global</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {response.content.substring(0, 80)}
                {response.content.length > 80 && '...'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
