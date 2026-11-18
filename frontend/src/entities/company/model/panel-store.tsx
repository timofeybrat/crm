"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

type PanelState = { activeId: number | null; open: (id: number) => void; close: () => void };
function createPanelStore() {
  return createStore<PanelState>((set) => ({ activeId: null, open: (activeId) => set({ activeId }), close: () => set({ activeId: null }) }));
}
const Context = createContext<ReturnType<typeof createPanelStore> | null>(null);
export function CompanyPanelProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPanelStore);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useCompanyPanel<T>(selector: (state: PanelState) => T) {
  const store = useContext(Context);
  if (!store) throw new Error("CompanyPanelProvider is required");
  return useStore(store, selector);
}
