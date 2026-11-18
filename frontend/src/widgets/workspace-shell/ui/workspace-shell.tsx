"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Globe2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { almatyTime, formatDate } from "@/shared/lib/datetime";
import { useNow } from "@/shared/lib/use-now";

const links = [
  { href: "/companies", title: "Организации", Icon: Building2 },
  { href: "/schedule", title: "Расписание", Icon: CalendarDays },
];
function Brand({ mobile = false }: { mobile?: boolean }) {
  return (
    <Link
      href="/companies"
      className={`brand ${mobile ? "mobile-brand" : ""}`}
      aria-label="Пульс CRM — организации"
    >
      <span className="brand-mark">
        <Activity size={21} strokeWidth={2} />
      </span>
      <span>
        пульс<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/companies";
  const now = useNow();
  const active = links.find((item) => path.startsWith(item.href));
  const navigation = links.map(({ href, title, Icon }) => (
    <Link
      href={href}
      key={href}
      aria-current={path.startsWith(href) ? "page" : undefined}
      className={`nav-link ${path.startsWith(href) ? "nav-link-active" : ""}`}
    >
      <Icon size={17} strokeWidth={1.7} />
      {title}
    </Link>
  ));
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>
      <aside className="sidebar">
        <Brand />
        <p className="workspace-label">Рабочее пространство</p>
        <nav aria-label="Основная навигация" className="sidebar-nav">
          {navigation}
        </nav>
        <div className="sidebar-bottom">
          <div className="work-hours">
            <div className="work-hours-title">
              <Clock3 size={13} />
              Время для встреч
            </div>
            <strong>09:00 — 18:00</strong>
            <p>Пн–пт · время Алматы</p>
          </div>
          <div className="sidebar-footer">
            <span className="team-avatar">
              <Users size={16} />
            </span>
            <div>
              <div className="team-name">Команда продаж</div>
              <div className="team-subtitle">Всё начинается с контакта</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Brand mobile />
          <div className="breadcrumb">
            <span>Рабочее пространство</span>
            <ChevronRight size={12} />
            <strong>{active?.title ?? "Обзор"}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-date" suppressHydrationWarning>
              {formatDate(new Date(now).toISOString(), { month: "long" })}
            </span>
            <span className="zone-pill">
              <Globe2 size={12} />
              <span suppressHydrationWarning>
                Алматы · {almatyTime(new Date(now).toISOString())}
              </span>
            </span>
          </div>
        </header>
        <nav aria-label="Мобильная навигация" className="mobile-nav">
          {navigation}
        </nav>
        <main className="workspace-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
