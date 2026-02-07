import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: { category: string; items: ShortcutItem[] }[] = [
  {
    category: 'Navegação',
    items: [
      { keys: ['Ctrl', '1'], description: 'Ir para Gerenciador' },
      { keys: ['Ctrl', '2'], description: 'Ir para WhatsApp' },
      { keys: ['Ctrl', '3'], description: 'Ir para Atendimento' },
      { keys: ['Ctrl', '4'], description: 'Ir para Filtrar Números' },
      { keys: ['Ctrl', '5'], description: 'Ir para Agente IA' },
      { keys: ['Ctrl', '6'], description: 'Ir para Aquecer Chips' },
    ],
  },
  {
    category: 'Chat',
    items: [
      { keys: ['Enter'], description: 'Enviar mensagem' },
      { keys: ['Shift', 'Enter'], description: 'Nova linha' },
      { keys: ['/'], description: 'Atalho de resposta rápida' },
      { keys: ['Tab'], description: 'Selecionar sugestão' },
      { keys: ['Esc'], description: 'Cancelar/Fechar' },
      { keys: ['↑', '↓'], description: 'Navegar sugestões' },
    ],
  },
  {
    category: 'Ações',
    items: [
      { keys: ['Ctrl', 'K'], description: 'Busca global' },
    ],
  },
];

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsPanel({ open, onOpenChange }: KeyboardShortcutsPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Atalhos disponíveis para navegação e ações rápidas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map(group => (
            <div key={group.category}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          {ki > 0 && <span className="text-muted-foreground text-xs">+</span>}
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 font-mono bg-muted/50">
                            {key}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
