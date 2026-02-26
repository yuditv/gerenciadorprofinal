import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContactsManager, Contact, SavedContact } from './ContactsManager';
import { TimingConfig } from './TimingConfig';
import { SendingWindow } from './SendingWindow';

interface BottomPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Contacts
  contacts: Contact[];
  verifyNumbers: boolean;
  onContactsChange: (contacts: Contact[]) => void;
  onVerifyChange: (verify: boolean) => void;
  isVerifying?: boolean;
  verificationProgress?: number;
  onVerifyContacts?: () => void;
  savedContacts?: SavedContact[];
  isLoadingSaved?: boolean;
  onRefreshSaved?: () => void;
  onSaveContacts?: (contacts: { name: string; phone: string; email?: string }[]) => Promise<boolean>;
  isSaving?: boolean;
  onTabChangeInternal?: (tab: string) => void;
  savedContactsTotal?: number;
  hasMoreSavedContacts?: boolean;
  onLoadMoreSavedContacts?: () => void;
  onSearchSavedContacts?: (query: string, limit?: number) => Promise<SavedContact[]>;
  sentContactsCount?: number;
  onResetContacts?: () => Promise<void>;
  // Timing
  minDelay: number;
  maxDelay: number;
  pauseAfterMessages: number;
  pauseDurationMinutes: number;
  stopAfterMessages: number;
  smartDelay: boolean;
  attentionCall?: boolean;
  attentionCallDelay?: number;
  onTimingChange: (updates: any) => void;
  // Window
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  allowedDays: number[];
  onWindowChange: (updates: any) => void;
}

const TABS = [
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'timing', label: 'Delay De Envio', icon: Clock },
  { id: 'window', label: 'Agendar Disparo', icon: Calendar },
];

export function BottomPanel({
  activeTab,
  onTabChange,
  contacts,
  verifyNumbers,
  onContactsChange,
  onVerifyChange,
  isVerifying,
  verificationProgress,
  onVerifyContacts,
  savedContacts,
  isLoadingSaved,
  onRefreshSaved,
  onSaveContacts,
  isSaving,
  onTabChangeInternal,
  savedContactsTotal,
  hasMoreSavedContacts,
  onLoadMoreSavedContacts,
  onSearchSavedContacts,
  sentContactsCount,
  onResetContacts,
  minDelay,
  maxDelay,
  pauseAfterMessages,
  pauseDurationMinutes,
  stopAfterMessages,
  smartDelay,
  attentionCall = false,
  attentionCallDelay = 2,
  onTimingChange,
  businessHoursEnabled,
  businessHoursStart,
  businessHoursEnd,
  allowedDays,
  onWindowChange,
}: BottomPanelProps) {
  return (
    <div className="bottom-panel">
      {/* Tabs */}
      <div className="panel-tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn("panel-tab", activeTab === tab.id && "active")}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.id === 'contacts' && contacts.length > 0 && (
              <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {contacts.length}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="panel-content">
        <AnimatePresence mode="wait">
          {activeTab === 'contacts' && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ContactsManager
                contacts={contacts}
                verifyNumbers={verifyNumbers}
                onContactsChange={onContactsChange}
                onVerifyChange={onVerifyChange}
                isVerifying={isVerifying}
                verificationProgress={verificationProgress}
                savedContacts={savedContacts}
                isLoadingSaved={isLoadingSaved}
                onRefreshSaved={onRefreshSaved}
                onSaveContacts={onSaveContacts}
                isSaving={isSaving}
                onTabChange={onTabChangeInternal}
                savedContactsTotal={savedContactsTotal}
                hasMoreSavedContacts={hasMoreSavedContacts}
                onLoadMoreSavedContacts={onLoadMoreSavedContacts}
                onSearchSavedContacts={onSearchSavedContacts}
                sentContactsCount={sentContactsCount}
                onResetContacts={onResetContacts}
              />
            </motion.div>
          )}

          {activeTab === 'timing' && (
            <motion.div
              key="timing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <TimingConfig
                minDelay={minDelay}
                maxDelay={maxDelay}
                pauseAfterMessages={pauseAfterMessages}
                pauseDurationMinutes={pauseDurationMinutes}
                stopAfterMessages={stopAfterMessages}
                smartDelay={smartDelay}
                attentionCall={attentionCall}
                attentionCallDelay={attentionCallDelay}
                autoArchive={false}
                aiPersonalization={false}
                onConfigChange={onTimingChange}
              />
            </motion.div>
          )}

          {activeTab === 'window' && (
            <motion.div
              key="window"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SendingWindow
                enabled={businessHoursEnabled}
                startTime={businessHoursStart}
                endTime={businessHoursEnd}
                allowedDays={allowedDays}
                onEnabledChange={(enabled) => onWindowChange({ businessHoursEnabled: enabled })}
                onStartTimeChange={(time) => onWindowChange({ businessHoursStart: time })}
                onEndTimeChange={(time) => onWindowChange({ businessHoursEnd: time })}
                onAllowedDaysChange={(days) => onWindowChange({ allowedDays: days })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
