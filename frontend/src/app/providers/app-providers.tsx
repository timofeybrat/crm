"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyPanelProvider } from "./company-panel-provider";
import { ToastProvider } from "./toast-provider";
import { SessionProvider } from "./session-provider";
import { SessionBoundary } from "./session-boundary";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CompanyPanelProvider>
        <ToastProvider>
          <SessionProvider>
            <SessionBoundary>{children}</SessionBoundary>
          </SessionProvider>
        </ToastProvider>
      </CompanyPanelProvider>
    </QueryClientProvider>
  );
}
