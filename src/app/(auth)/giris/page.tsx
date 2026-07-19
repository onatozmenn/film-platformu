import type { Metadata } from "next";

import { SignInForm } from "@/modules/identity/ui/sign-in-form";

export const metadata: Metadata = { title: "Oturum aç" };

export default function SignInPage() {
  return (
    <main className="auth-main" id="ana-icerik">
      <section className="auth-surface" aria-labelledby="sign-in-title">
        <p className="eyebrow">Üye hesabı</p>
        <h1 id="sign-in-title">Oturum aç</h1>
        <p>Tek kullanımlık bağlantı e-posta adresinize gönderilir.</p>
        <SignInForm />
      </section>
    </main>
  );
}
