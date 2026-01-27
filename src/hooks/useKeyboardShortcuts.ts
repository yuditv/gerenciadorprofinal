import { useEffect, useCallback } from 'react';
import { AppSection } from '@/components/FloatingSidebar';

interface KeyboardShortcutsOptions {
  onSectionChange: (section: AppSection) => void;
  enabled?: boolean;
}

const sectionShortcuts: { key: string; section: AppSection; label: string }[] = [
  { key: '1', section: 'clients', label: 'Gerenciador' },
  { key: '2', section: 'whatsapp', label: 'WhatsApp' },
  { key: '3', section: 'atendimento', label: 'Central de Atendimento' },
  { key: '4', section: 'filter-numbers', label: 'Filtrar Números' },
  { key: '5', section: 'ai-agent', label: 'Agente IA' },
  { key: '6', section: 'warm-chips', label: 'Aquecer Chips' },
];

export function useKeyboardShortcuts({ onSectionChange, enabled = true }: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if Ctrl (or Cmd on Mac) is pressed
    if (!event.ctrlKey && !event.metaKey) return;
    
    // Don't trigger if user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const shortcut = sectionShortcuts.find(s => s.key === event.key);
    if (shortcut) {
      event.preventDefault();
      onSectionChange(shortcut.section);
    }
  }, [onSectionChange]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return { shortcuts: sectionShortcuts };
}
