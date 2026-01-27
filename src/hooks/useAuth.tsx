import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Clear corrupted auth tokens from localStorage
const clearCorruptedTokens = () => {
  try {
    const authKey = 'sb-eocrnjbdrrvuhhdwskvn-auth-token';
    const stored = localStorage.getItem(authKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check for corrupted/short refresh tokens
      if (parsed.refresh_token && parsed.refresh_token.length < 20) {
        console.warn('Detected corrupted auth token, clearing...');
        localStorage.removeItem(authKey);
        return true;
      }
    }
  } catch (e) {
    // If parsing fails, token is corrupted
    console.warn('Failed to parse auth token, clearing...');
    localStorage.removeItem('sb-eocrnjbdrrvuhhdwskvn-auth-token');
    return true;
  }
  return false;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Clear any corrupted tokens before initializing
    const wasCorrupted = clearCorruptedTokens();
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || wasCorrupted) {
        // Force sign out if there was an error or corrupted token
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
