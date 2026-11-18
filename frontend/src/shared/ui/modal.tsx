"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ open, onClose, title, description, children, side = false, busy = false }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; side?: boolean; busy?: boolean;
}) {
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value && !busy) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className={`dialog-content ${side ? "dialog-side" : ""}`}
        onPointerDownOutside={(event) => { if (!side || busy) event.preventDefault(); }}
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}>
        <div className="dialog-header">
          <div><Dialog.Title className="dialog-title">{title}</Dialog.Title>
            <Dialog.Description className={description ? "dialog-description" : "sr-only"}>
              {description ?? title}
            </Dialog.Description></div>
          <Dialog.Close disabled={busy} className="icon-button" aria-label="Закрыть"><X size={20} /></Dialog.Close>
        </div>
        <div className="dialog-body">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
