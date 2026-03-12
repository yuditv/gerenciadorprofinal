import { useCallback, useRef, useEffect, useMemo, useReducer } from 'react';

/**
 * Custom hook for debounced callbacks with proper cleanup
 * Useful for search inputs, resize handlers, etc.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Custom hook for throttled callbacks
 * Useful for scroll handlers, resize handlers, frequent updates
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args) => {
      const now = Date.now();
      const remaining = limit - (now - lastRunRef.current);

      if (remaining <= 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        lastRunRef.current = now;
        callbackRef.current(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastRunRef.current = Date.now();
          timeoutRef.current = null;
          callbackRef.current(...args);
        }, remaining);
      }
    }) as T,
    [limit]
  );
}

/**
 * Custom hook for batching multiple state updates
 * Reduces render frequency for high-frequency updates
 */
export function useBatchedUpdates<T>(
  initialValue: T,
  flushInterval: number = 100
): [T, (updater: (prev: T) => T) => void, () => void] {
  const valueRef = useRef<T>(initialValue);
  const pendingUpdatesRef = useRef<Array<(prev: T) => T>>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const forceUpdateRef = useRef<() => void>(() => {});

  // Force update mechanism
  const [, setTick] = useReducer((x) => x + 1, 0);
  forceUpdateRef.current = setTick;

  const flush = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return;

    let currentValue = valueRef.current;
    for (const updater of pendingUpdatesRef.current) {
      currentValue = updater(currentValue);
    }
    valueRef.current = currentValue;
    pendingUpdatesRef.current = [];
    forceUpdateRef.current();
  }, []);

  const update = useCallback(
    (updater: (prev: T) => T) => {
      pendingUpdatesRef.current.push(updater);

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          flush();
        }, flushInterval);
      }
    },
    [flushInterval, flush]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [valueRef.current, update, flush];
}

/**
 * Hook to track if component is mounted
 * Prevents state updates on unmounted components
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * Hook for stable event handlers that don't cause re-renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}

/**
 * Hook for memoizing expensive computations with custom comparison
 */
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | null>(null);

  if (!ref.current || !shallowEqualArrays(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}

function shallowEqualArrays(a: React.DependencyList, b: React.DependencyList): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Hook for lazy initialization of expensive values
 */
export function useLazyRef<T>(initializer: () => T): React.MutableRefObject<T> {
  const ref = useRef<T | null>(null);

  if (ref.current === null) {
    ref.current = initializer();
  }

  return ref as React.MutableRefObject<T>;
}
