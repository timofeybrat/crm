"use client";

import { AlertCircle, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "./button";
import { errorMessage } from "@/shared/lib/errors";

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="error-notice" role="alert"><AlertCircle size={18} className="shrink-0" />
    <span>{typeof error === "string" ? error : errorMessage(error)}</span>
    {retry && <Button variant="ghost" onClick={retry}><RefreshCw size={14} />Повторить</Button>}
  </div>;
}

export function Loading({ label = "Загружаем данные…" }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  function notify(text: string) {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((current) => current?.id === id ? null : current), 4500);
  }
  return <ToastContext.Provider value={notify}>{children}
    <div aria-live="polite" aria-atomic="true" className="toast-region">
      {toast && <div className="toast"><span className="toast-check"><Check size={16} /></span>{toast.text}</div>}
    </div>
  </ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }
