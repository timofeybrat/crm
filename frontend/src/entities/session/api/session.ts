import { apiRequest } from "@/shared/api";
import { userSchema } from "../model/session";

export async function getCurrentUser() {
  return userSchema.parse(await apiRequest("/auth/me", { cache: "no-store" }));
}
export async function signIn(login: string, password: string) {
  const challenge = await apiRequest<{ csrf_token: string }>("/auth/csrf", { cache: "no-store" });
  return userSchema.parse(
    await apiRequest("/auth/login", {
      method: "POST",
      headers: { "X-CSRF-Token": challenge.csrf_token },
      body: JSON.stringify({ login, password }),
    }),
  );
}
export async function signOut() {
  await apiRequest("/auth/logout", { method: "POST" });
}
