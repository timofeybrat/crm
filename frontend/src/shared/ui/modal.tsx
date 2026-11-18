"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { createContext, useContext, useRef, type ReactNode } from "react";

const DialogDepth = createContext(0);

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  side = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: boolean;
  busy?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const depth = useContext(DialogDepth);
  return (
    <DialogDepth.Provider value={depth + 1}>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!value && !busy) onClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" style={{ zIndex: 50 + depth * 10 }} />
          <Dialog.Content
            ref={content}
            className={`dialog-content ${side ? "dialog-side" : ""}`}
            style={{ zIndex: 51 + depth * 10 }}
            onOpenAutoFocus={(event) => {
              opener.current = document.activeElement as HTMLElement;
              if (!side) {
                const firstInput = content.current?.querySelector<HTMLElement>("input, select");
                if (firstInput) {
                  event.preventDefault();
                  firstInput.focus();
                }
              }
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = opener.current?.isConnected
                ? opener.current
                : document.querySelector<HTMLElement>("main button, main a");
              target?.focus();
            }}
            onPointerDownOutside={(event) => {
              if (!side || busy) event.preventDefault();
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <div className="dialog-header">
              <div>
                <Dialog.Title className="dialog-title">{title}</Dialog.Title>
                <Dialog.Description className={description ? "dialog-description" : "sr-only"}>
                  {description ?? title}
                </Dialog.Description>
              </div>
              <Dialog.Close disabled={busy} className="icon-button" aria-label="Закрыть">
                <X size={20} />
              </Dialog.Close>
            </div>
            <div className="dialog-body">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DialogDepth.Provider>
  );
}
