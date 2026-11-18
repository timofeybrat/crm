"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useSession } from "@/entities/session";
import { Button, useToast } from "@/shared/ui";
import { errorMessage } from "@/shared/lib/errors";

export function SignOutButton() {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  return (
    <Button
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await logout();
        } catch (err) {
          notify(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <LogOut size={15} />
      Выйти из CRM
    </Button>
  );
}
