"use client";

import { createContext, useContext } from "react";
import { z } from "zod";

export const userSchema = z.object({
  account_id: z.number(),
  manager_id: z.number(),
  name: z.string(),
  login: z.string(),
  role: z.enum(["manager", "admin"]),
});
export type SessionUser = z.infer<typeof userSchema>;
export type SessionValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
export const SessionContext = createContext<SessionValue | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
