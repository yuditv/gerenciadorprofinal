import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'system-notifications-enabled';
const VOLUME_KEY = 'system-notifications-volume';

// Audio context for generating notification sounds
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Generate a LOUD notification sound (WhatsApp-style with higher volume)
const playLoudNotificationSound = (volume: number = 1.0) => {
  try {
    const ctx = getAudioContext();
    
    // Create master gain for volume control
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    
    // Play an attention-grabbing notification melody
    const notes = [
      { freq: 880, time: 0, duration: 0.15 },      // A5
      { freq: 1108.73, time: 0.12, duration: 0.15 }, // C#6
      { freq: 1318.51, time: 0.24, duration: 0.2 },  // E6
      { freq: 880, time: 0.5, duration: 0.15 },      // A5 (repeat)
      { freq: 1108.73, time: 0.62, duration: 0.15 }, // C#6
      { freq: 1318.51, time: 0.74, duration: 0.2 },  // E6
    ];
    
    notes.forEach(({ freq, time, duration }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time);
      
      // Envelope for each note - LOUDER
      gainNode.gain.setValueAtTime(0, ctx.currentTime + time);
      gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
      
      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + duration + 0.05);
    });

    // Add a subtle bell-like overtone for richness
    const bellFreqs = [880 * 2, 1318.51 * 1.5];
    bellFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + 0.24 + (i * 0.1));
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.24 + (i * 0.1));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      
      osc.start(ctx.currentTime + 0.24 + (i * 0.1));
      osc.stop(ctx.currentTime + 1);
    });
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
};

// Generate urgent/alarm notification sound
const playUrgentNotificationSound = (volume: number = 1.0) => {
  try {
    const ctx = getAudioContext();
    
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    
    // Urgent beeping pattern
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(1000, ctx.currentTime + (i * 0.25));
      oscillator.frequency.setValueAtTime(800, ctx.currentTime + (i * 0.25) + 0.1);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + (i * 0.25));
      gainNode.gain.linearRampToValueAtTime(0.35, ctx.currentTime + (i * 0.25) + 0.01);
      gainNode.gain.setValueAtTime(0.35, ctx.currentTime + (i * 0.25) + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + (i * 0.25) + 0.2);
      
      oscillator.start(ctx.currentTime + (i * 0.25));
      oscillator.stop(ctx.currentTime + (i * 0.25) + 0.25);
    }
  } catch (e) {
    console.error('Error playing urgent sound:', e);
  }
};

export type NotificationSoundType = 'default' | 'urgent' | 'message';

export interface SystemNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  soundType?: NotificationSoundType;
  silent?: boolean;
  onClick?: () => void;
}

export function useSystemNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  });
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem(VOLUME_KEY);
    return stored ? parseFloat(stored) : 1.0;
  });

  useEffect(() => {
    const supported = 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isEnabled));
  }, [isEnabled]);

  useEffect(() => {
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const playSound = useCallback((type: NotificationSoundType = 'default') => {
    if (!isEnabled) return;
    
    switch (type) {
      case 'urgent':
        playUrgentNotificationSound(volume);
        break;
      case 'message':
      case 'default':
      default:
        playLoudNotificationSound(volume);
        break;
    }
  }, [isEnabled, volume]);

  const showNotification = useCallback(async (options: SystemNotificationOptions) => {
    const {
      title,
      body,
      icon = '/pwa-192x192.png',
      tag,
      requireInteraction = false,
      soundType = 'default',
      silent = false,
      onClick,
    } = options;

    // Play sound first (works even if notifications aren't granted)
    if (!silent && isEnabled) {
      playSound(soundType);
    }

    // Show browser notification if permitted
    if (permission === 'granted' && isEnabled) {
      try {
        const notification = new Notification(title, {
          body,
          icon,
          badge: '/pwa-192x192.png',
          tag,
          requireInteraction,
          silent: true, // We handle sound ourselves
        });

        if (onClick) {
          notification.onclick = () => {
            window.focus();
            onClick();
            notification.close();
          };
        }

        return notification;
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }

    return null;
  }, [permission, isEnabled, playSound]);

  const testNotification = useCallback(() => {
    showNotification({
      title: '🔔 Teste de Notificação',
      body: 'As notificações estão funcionando corretamente!',
      soundType: 'default',
    });
  }, [showNotification]);

  const testUrgentNotification = useCallback(() => {
    showNotification({
      title: '⚠️ Notificação Urgente',
      body: 'Este é um exemplo de notificação urgente!',
      soundType: 'urgent',
      requireInteraction: true,
    });
  }, [showNotification]);

  return {
    permission,
    isSupported,
    isEnabled,
    volume,
    setIsEnabled,
    setVolume,
    requestPermission,
    showNotification,
    playSound,
    testNotification,
    testUrgentNotification,
  };
}
