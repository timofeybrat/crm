"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  SessionContext,
  signIn,
  signOut,
  type SessionUser,
} from "@/entities/session";
import { useCompanyPanel } from "@/entities/company";
import { ApiError } from "@/shared/api";

const sessionKey = ["session", "me"] as const;
export function SessionProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const close = useCompanyPanel((s) => s.close);
  const channel = useRef<BroadcastChannel | null>(null);
  const query = useQuery<SessionUser | null>({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await getCurrentUser();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const clear = useCallback(() => {
    void cache.cancelQueries();
    cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    cache.setQueryData(sessionKey, null);
    close();
  }, [cache, close]);
  useEffect(() => {
    if (query.data === null) {
      void cache.cancelQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      close();
    }
  }, [query.data, cache, close]);
  useEffect(() => {
    const invalid = () => clear();
    window.addEventListener("crm:unauthorized", invalid);
    const broadcast =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("crm-auth") : null;
    channel.current = broadcast;
    if (broadcast)
      broadcast.onmessage = (e) => {
        if (e.data === "logout") clear();
        else if (e.data === "login") {
          clear();
          void cache.invalidateQueries({ queryKey: sessionKey });
        }
      };
    return () => {
      broadcast?.close();
      window.removeEventListener("crm:unauthorized", invalid);
    };
  }, [cache, clear]);
  async function login(loginName: string, password: string) {
    const authenticated = await signIn(loginName, password);
    await cache.cancelQueries();
    cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    close();
    cache.setQueryData(sessionKey, authenticated);
    channel.current?.postMessage("login");
  }
  async function logout() {
    await signOut();
    clear();
    channel.current?.postMessage("logout");
  }
  return (
    <SessionContext.Provider
      value={{ user: query.data ?? null, loading: query.isPending, login, logout }}
    >
      {children}
    </SessionContext.Provider>
  );
}
