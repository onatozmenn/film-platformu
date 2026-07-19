"use client";

import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SignInState = "idle" | "submitting" | "unavailable";

export function SignInForm() {
  const router = useRouter();
  const [state, setState] = useState<SignInState>("idle");

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (state === "submitting") {
          return;
        }
        const form = new FormData(event.currentTarget);
        const email = form.get("email");
        if (typeof email !== "string") {
          setState("unavailable");
          return;
        }
        setState("submitting");
        void signIn("email", {
          callbackUrl: "/hesap",
          email,
          redirect: false,
        })
          .then((result) => {
            if (result?.error !== null && result?.error !== undefined) {
              setState("unavailable");
              return;
            }
            router.push("/giris/baglanti-gonderildi");
          })
          .catch(() => setState("unavailable"));
      }}
    >
      <label htmlFor="sign-in-email">E-posta adresi</label>
      <div className="auth-input-row">
        <Mail aria-hidden="true" size={18} strokeWidth={2} />
        <input
          autoComplete="email"
          id="sign-in-email"
          maxLength={320}
          name="email"
          placeholder="uye@ornek.com"
          required
          type="email"
        />
      </div>
      <button className="primary-action" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Bağlantı hazırlanıyor" : "Giriş bağlantısı gönder"}
      </button>
      <p aria-live="polite" className="auth-form-status">
        {state === "unavailable"
          ? "Bağlantı şu anda hazırlanamadı. Lütfen daha sonra tekrar deneyin."
          : ""}
      </p>
    </form>
  );
}
