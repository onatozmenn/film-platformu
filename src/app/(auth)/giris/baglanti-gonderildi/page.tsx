import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Bağlantı gönderildi" };

export default function VerifyRequestPage() {
  return (
    <main className="auth-main" id="ana-icerik">
      <section className="auth-surface" aria-labelledby="verify-title">
        <MailCheck aria-hidden="true" className="auth-state-icon" size={28} strokeWidth={2} />
        <p className="eyebrow">E-postanızı kontrol edin</p>
        <h1 id="verify-title">Bağlantı hazırlandı</h1>
        <p>
          Adres kayıtlı olsun ya da olmasın aynı yanıtı gösteririz. Gelen kutunuzdaki tek
          kullanımlık bağlantıyı açın.
        </p>
        <Link className="secondary-action" href="/">
          Programa dön
        </Link>
      </section>
    </main>
  );
}
