"use client";

import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { errorMessage } from "@/shared/lib/errors";

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} className="shrink-0" />
      <span>{typeof error === "string" ? error : errorMessage(error)}</span>
      {retry && (
        <Button variant="ghost" onClick={retry}>
          <RefreshCw size={14} />
          Повторить
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = "Загружаем данные…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
