"use client";

import { useState, type ReactNode } from "react";
import { CompanyPanelContext, createCompanyPanelStore } from "@/entities/company";

export function CompanyPanelProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCompanyPanelStore);
  return <CompanyPanelContext.Provider value={store}>{children}</CompanyPanelContext.Provider>;
}
