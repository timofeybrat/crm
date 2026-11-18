"use client";

import { createContext, useContext } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

type PanelState = { activeId: number | null; open: (id: number) => void; close: () => void };
export function createCompanyPanelStore() {
  return createStore<PanelState>((set) => ({
    activeId: null,
    open: (activeId) => set({ activeId }),
    close: () => set({ activeId: null }),
  }));
}
export const CompanyPanelContext = createContext<ReturnType<typeof createCompanyPanelStore> | null>(
  null,
);
export function useCompanyPanel<T>(selector: (state: PanelState) => T) {
  const store = useContext(CompanyPanelContext);
  if (!store) throw new Error("CompanyPanelProvider is required");
  return useStore(store, selector);
}
