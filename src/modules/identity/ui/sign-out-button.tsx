"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      className="secondary-action"
      disabled={pending}
      type="button"
      onClick={() => {
        if (pending) {
          return;
        }
        setPending(true);
        void signOut({ callbackUrl: "/" }).catch(() => setPending(false));
      }}
    >
      <LogOut aria-hidden="true" size={18} strokeWidth={2} />
      {pending ? "Oturum kapatılıyor" : "Oturumu kapat"}
    </button>
  );
}
