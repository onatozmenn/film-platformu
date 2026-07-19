import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Giriş tamamlanamadı" };

export default function AuthErrorPage() {
  return (
    <main className="auth-main" id="ana-icerik">
      <section className="auth-surface" aria-labelledby="auth-error-title">
        <CircleAlert aria-hidden="true" className="auth-state-icon" size={28} strokeWidth={2} />
        <p className="eyebrow">Bağlantı kullanılamıyor</p>
        <h1 id="auth-error-title">Oturum açılamadı</h1>
        <p>Bağlantı geçersiz veya süresi dolmuş olabilir. Yeni bir bağlantı isteyin.</p>
        <Link className="primary-action" href="/giris">
          Yeni bağlantı iste
        </Link>
      </section>
    </main>
  );
}
