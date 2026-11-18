"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ToastContext } from "@/shared/ui";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  function notify(text: string) {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((current) => (current?.id === id ? null : current)), 4500);
  }
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="toast-region">
        {toast && (
          <div className="toast">
            <span className="toast-check">
              <Check size={16} />
            </span>
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
