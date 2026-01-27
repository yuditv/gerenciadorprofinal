import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "engajamento:smm:favorites:v1";

function safeParse(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

export function useSmmFavorites(options?: { limit?: number }) {
  const limit = options?.limit ?? 200;

  const [ids, setIds] = useState<number[]>(() => safeParse(localStorage.getItem(STORAGE_KEY)));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const isFavorite = useCallback((serviceId: number) => idSet.has(serviceId), [idSet]);

  const toggleFavorite = useCallback(
    (serviceId: number) => {
      setIds((prev) => {
        const set = new Set(prev);
        if (set.has(serviceId)) {
          set.delete(serviceId);
        } else {
          set.add(serviceId);
        }
        const next = Array.from(set);

        // mantém os mais recentes no final (simples e previsível)
        if (limit > 0 && next.length > limit) {
          return next.slice(next.length - limit);
        }
        return next;
      });
    },
    [limit],
  );

  const clearFavorites = useCallback(() => setIds([]), []);

  return {
    favoriteIds: ids,
    favoriteIdSet: idSet,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    limit,
  };
}
