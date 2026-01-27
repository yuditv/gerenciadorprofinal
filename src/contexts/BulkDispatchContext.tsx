import React, { createContext, useContext } from "react";
import { useBulkDispatch } from "@/hooks/useBulkDispatch";

type BulkDispatchContextValue = ReturnType<typeof useBulkDispatch>;

const BulkDispatchContext = createContext<BulkDispatchContextValue | null>(null);

export function BulkDispatchProvider({ children }: { children: React.ReactNode }) {
  const value = useBulkDispatch();
  return (
    <BulkDispatchContext.Provider value={value}>
      {children}
    </BulkDispatchContext.Provider>
  );
}

export function useBulkDispatchContext() {
  const ctx = useContext(BulkDispatchContext);
  if (!ctx) {
    throw new Error("useBulkDispatchContext must be used within BulkDispatchProvider");
  }
  return ctx;
}
