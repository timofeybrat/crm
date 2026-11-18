"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/entities/session";
import { Loading } from "@/shared/ui";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const path = usePathname() ?? "/companies";
  const router = useRouter();
  const publicPage = path === "/login" || path === "/video/guest";
  useEffect(() => {
    if (!publicPage && !loading && !user) {
      router.replace(
        `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
    }
  }, [publicPage, loading, user, router]);
  if (publicPage) return children;
  if (loading) return <Loading label="Проверяем сессию…" />;
  if (!user) return null;
  return children;
}
