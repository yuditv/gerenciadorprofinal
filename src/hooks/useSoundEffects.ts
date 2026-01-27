import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sound-effects-muted";

// Audio context for generating sounds programmatically
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Generate a short click sound
const playClickSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // Silently fail if audio context is not available
  }
};

// Generate a hover sound
const playHoverSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.03);
  } catch (e) {
    // Silently fail
  }
};

// Generate a success sound
const playSuccessSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Silently fail
  }
};

// Generate a new message notification sound
const playNewMessageSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    
    // Play a pleasant notification melody (ascending two notes)
    const notes = [
      { freq: 880, time: 0 },      // A5
      { freq: 1174.66, time: 0.1 }, // D6
    ];
    
    notes.forEach(({ freq, time }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + time);
      gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.15);
      
      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.2);
    });
  } catch (e) {
    // Silently fail
  }
};

// Generate a message sent confirmation sound
const playMessageSentSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
    
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Silently fail
  }
};

// Generate a dispatch complete fanfare sound
const playDispatchCompleteSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    
    // Play a triumphant ascending melody
    const notes = [
      { freq: 523.25, time: 0 },      // C5
      { freq: 659.25, time: 0.12 },   // E5
      { freq: 783.99, time: 0.24 },   // G5
      { freq: 1046.50, time: 0.36 },  // C6
    ];
    
    notes.forEach(({ freq, time }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + time);
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2);
      
      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.25);
    });
    
    // Add a subtle chord at the end
    setTimeout(() => {
      const chordFreqs = [523.25, 659.25, 783.99]; // C major chord
      chordFreqs.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      });
    }, 450);
  } catch (e) {
    // Silently fail
  }
};

// Generate a dispatch failure/warning sound (descending dissonant)
const playDispatchFailureSound = (isMuted: boolean) => {
  if (isMuted) return;
  
  try {
    const ctx = getAudioContext();
    
    // Play a descending warning melody
    const notes = [
      { freq: 440, time: 0 },      // A4
      { freq: 349.23, time: 0.15 }, // F4
      { freq: 293.66, time: 0.30 }, // D4
    ];
    
    notes.forEach(({ freq, time }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + time);
      gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2);
      
      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.25);
    });
    
    // Add a low warning tone
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(196, ctx.currentTime); // G3
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }, 400);
  } catch (e) {
    // Silently fail
  }
};

export function useSoundEffects() {
  const [isMuted, setIsMuted] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isMuted));
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const playClick = useCallback(() => {
    playClickSound(isMuted);
  }, [isMuted]);

  const playHover = useCallback(() => {
    playHoverSound(isMuted);
  }, [isMuted]);

  const playSuccess = useCallback(() => {
    playSuccessSound(isMuted);
  }, [isMuted]);

  const playDispatchComplete = useCallback(() => {
    playDispatchCompleteSound(isMuted);
  }, [isMuted]);

  const playDispatchFailure = useCallback(() => {
    playDispatchFailureSound(isMuted);
  }, [isMuted]);

  const playNewMessage = useCallback(() => {
    playNewMessageSound(isMuted);
  }, [isMuted]);

  const playMessageSent = useCallback(() => {
    playMessageSentSound(isMuted);
  }, [isMuted]);

  return {
    isMuted,
    toggleMute,
    playClick,
    playHover,
    playSuccess,
    playDispatchComplete,
    playDispatchFailure,
    playNewMessage,
    playMessageSent,
  };
}

// Global click sound handler
export function initGlobalClickSound() {
  const isMuted = localStorage.getItem(STORAGE_KEY) === "true";
  
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.closest("button") ||
      target.getAttribute("role") === "button" ||
      target.closest('[role="button"]') ||
      target.closest('[role="menuitem"]') ||
      target.closest('[role="tab"]')
    ) {
      const currentMuted = localStorage.getItem(STORAGE_KEY) === "true";
      playClickSound(currentMuted);
    }
  });
}
