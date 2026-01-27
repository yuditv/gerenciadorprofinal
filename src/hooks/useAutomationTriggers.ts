import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInboxAutomation, AutomationRule, AutomationAction } from '@/hooks/useInboxAutomation';
import { useInboxMacros, MacroAction } from '@/hooks/useInboxMacros';
import { Conversation } from '@/hooks/useInboxConversations';
import { ChatMessage } from '@/hooks/useInboxMessages';


interface TriggerContext {
  conversation?: Conversation;
  message?: ChatMessage;
  previousStatus?: string;
}

interface TriggerCallbacks {
  onSendMessage?: (conversationId: string, content: string, isPrivate?: boolean) => Promise<boolean>;
  onAssignLabel?: (conversationId: string, labelId: string) => Promise<void>;
  onResolve?: (conversationId: string) => Promise<void>;
  onToggleAI?: (conversationId: string, enabled: boolean) => Promise<void>;
  onSnooze?: (conversationId: string, until: Date) => Promise<void>;
  onSetPriority?: (conversationId: string, priority: string) => Promise<void>;
  onAssignAgent?: (conversationId: string, agentId: string) => Promise<void>;
}

export function useAutomationTriggers(callbacks: TriggerCallbacks = {}) {
  const { user } = useAuth();
  const { rules } = useInboxAutomation();
  const { macros } = useInboxMacros();
  const processedEvents = useRef<Set<string>>(new Set());

  const executeAction = useCallback(async (
    action: AutomationAction | MacroAction,
    context: TriggerContext
  ): Promise<void> => {
    const conversationId = context.conversation?.id;
    if (!conversationId) return;

    switch (action.type) {
      case 'send_message':
        if (action.params?.message && callbacks.onSendMessage) {
          await callbacks.onSendMessage(conversationId, action.params.message as string, false);
        }
        break;

      case 'send_private_note':
        if (action.params?.message && callbacks.onSendMessage) {
          await callbacks.onSendMessage(conversationId, action.params.message as string, true);
        }
        break;

      case 'add_label':
        if (action.params?.label_id && callbacks.onAssignLabel) {
          await callbacks.onAssignLabel(conversationId, action.params.label_id as string);
        }
        break;

      case 'resolve':
      case 'resolve_conversation':
        if (callbacks.onResolve) {
          await callbacks.onResolve(conversationId);
        }
        break;

      case 'toggle_ai':
        if (callbacks.onToggleAI) {
          const enabled = action.params?.enabled !== false;
          await callbacks.onToggleAI(conversationId, enabled);
        }
        break;

      case 'snooze':
        if (callbacks.onSnooze && action.params?.duration_minutes) {
          const until = new Date();
          until.setMinutes(until.getMinutes() + (action.params.duration_minutes as number));
          await callbacks.onSnooze(conversationId, until);
        }
        break;

      case 'set_priority':
        if (callbacks.onSetPriority && action.params?.priority) {
          await callbacks.onSetPriority(conversationId, action.params.priority as string);
        }
        break;

      case 'assign_agent':
        if (callbacks.onAssignAgent && action.params?.agent_id) {
          await callbacks.onAssignAgent(conversationId, action.params.agent_id as string);
        }
        break;

      case 'execute_macro':
        if (action.params?.macro_id) {
          const macro = macros.find(m => m.id === action.params?.macro_id);
          if (macro) {
            for (const macroAction of macro.actions) {
              await executeAction(macroAction, context);
            }
          }
        }
        break;

    }
  }, [callbacks, macros]);

  const checkConditions = useCallback((
    rule: AutomationRule,
    context: TriggerContext
  ): boolean => {
    const conditions = rule.conditions || {};

    // NOVA CONDIÇÃO: Bloquear se conversa já tem a etiqueta específica
    if (conditions.exclude_if_has_label && context.conversation?.labels) {
      const excludeLabelId = conditions.exclude_if_has_label as string;
      const hasLabel = context.conversation.labels.some(
        (labelData: { label?: { id?: string } }) => labelData.label?.id === excludeLabelId
      );
      if (hasLabel) {
        console.log(`[Automation] Blocked: conversation already has label ${excludeLabelId}`);
        return false;
      }
    }

    // Check keyword conditions
    if (conditions.keywords && context.message?.content) {
      const keywords = (conditions.keywords as string).split(',').map(k => k.trim().toLowerCase());
      const messageContent = context.message.content.toLowerCase();
      const hasKeyword = keywords.some(keyword => messageContent.includes(keyword));
      if (!hasKeyword) return false;
    }

    // Check status conditions
    if (conditions.status && context.conversation?.status !== conditions.status) {
      return false;
    }

    // Check priority conditions
    if (conditions.priority && context.conversation?.priority !== conditions.priority) {
      return false;
    }

    // Check time-based conditions
    if (conditions.time_range) {
      const now = new Date();
      const currentHour = now.getHours();
      const range = conditions.time_range as { start: number; end: number };
      if (currentHour < range.start || currentHour >= range.end) {
        return false;
      }
    }

    // Check inactivity timeout
    if (conditions.inactivity_minutes && context.conversation?.last_message_at) {
      const lastMessage = new Date(context.conversation.last_message_at);
      const minutesSinceLastMessage = (Date.now() - lastMessage.getTime()) / 60000;
      if (minutesSinceLastMessage < (conditions.inactivity_minutes as number)) {
        return false;
      }
    }

    return true;
  }, []);

  const processEvent = useCallback(async (
    eventType: string,
    context: TriggerContext
  ): Promise<void> => {
    // Create unique event key to prevent duplicate processing
    const eventKey = `${eventType}-${context.conversation?.id}-${context.message?.id || ''}-${Date.now()}`;
    
    if (processedEvents.current.has(eventKey)) {
      return;
    }
    processedEvents.current.add(eventKey);

    // Clean up old events (keep last 100)
    if (processedEvents.current.size > 100) {
      const entries = Array.from(processedEvents.current);
      entries.slice(0, entries.length - 100).forEach(e => processedEvents.current.delete(e));
    }

    // Find matching rules
    const activeRules = rules.filter(rule => 
      rule.is_active && 
      rule.event_type === eventType &&
      checkConditions(rule, context)
    );

    // Execute actions for each matching rule
    for (const rule of activeRules) {
      console.log(`[Automation] Executing rule: ${rule.name}`);
      for (const action of rule.actions) {
        try {
          await executeAction(action, context);
        } catch (error) {
          console.error(`[Automation] Error executing action:`, error);
        }
      }
    }
  }, [rules, checkConditions, executeAction]);

  const triggerMessageCreated = useCallback((
    conversation: Conversation,
    message: ChatMessage
  ) => {
    processEvent('message_created', { conversation, message });

    // Also check for keyword triggers
    if (message.content) {
      processEvent('keyword_detected', { conversation, message });
    }
  }, [processEvent]);

  const triggerConversationCreated = useCallback((
    conversation: Conversation
  ) => {
    processEvent('conversation_created', { conversation });
  }, [processEvent]);

  const triggerConversationResolved = useCallback((
    conversation: Conversation
  ) => {
    processEvent('conversation_resolved', { conversation });
  }, [processEvent]);

  const triggerConversationReopened = useCallback((
    conversation: Conversation
  ) => {
    processEvent('conversation_reopened', { conversation });
  }, [processEvent]);

  const triggerConversationAssigned = useCallback((
    conversation: Conversation
  ) => {
    processEvent('conversation_assigned', { conversation });
  }, [processEvent]);

  const triggerInactivityTimeout = useCallback((
    conversation: Conversation
  ) => {
    processEvent('inactivity_timeout', { conversation });
  }, [processEvent]);

  return {
    triggerMessageCreated,
    triggerConversationCreated,
    triggerConversationResolved,
    triggerConversationReopened,
    triggerConversationAssigned,
    triggerInactivityTimeout,
    processEvent,
    executeAction,
  };
}
