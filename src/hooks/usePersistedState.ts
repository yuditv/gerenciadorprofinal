import { useState, useEffect, useCallback } from 'react';

/**
 * A hook that persists state to localStorage and restores it on page load.
 * Useful for maintaining state across tab switches and page reloads.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize state from localStorage or use default
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.warn(`Failed to parse stored value for key "${key}":`, error);
    }
    return defaultValue;
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to persist state for key "${key}":`, error);
    }
  }, [key, state]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch (error) {
          console.warn(`Failed to parse storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [state, setState];
}

/**
 * A hook specifically for persisting form state with debounced saves.
 * Useful for complex forms where you want to save drafts automatically.
 */
export function usePersistedFormState<T extends Record<string, unknown>>(
  key: string,
  defaultValue: T,
  debounceMs: number = 500
): [T, (updates: Partial<T>) => void, () => void] {
  const [state, setState] = usePersistedState<T>(key, defaultValue);

  const updateState = useCallback((updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, [setState]);

  const clearState = useCallback(() => {
    localStorage.removeItem(key);
    setState(defaultValue);
  }, [key, defaultValue, setState]);

  return [state, updateState, clearState];
}
