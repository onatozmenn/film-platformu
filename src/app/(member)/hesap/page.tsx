import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getOptionalMemberSession } from "@/modules/identity/server";
import { DeleteAccountButton } from "@/modules/identity/ui/delete-account-button";
import { SignOutButton } from "@/modules/identity/ui/sign-out-button";
import { libraryService } from "@/modules/library/server";
import { AccountLibrary } from "@/modules/library/ui/account-library";

export const metadata: Metadata = { title: "Hesap" };

export default async function AccountPage() {
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  const library = await libraryService.getMemberLibrary({
    actorUserId: session.user.id,
    ownerUserId: session.user.id,
  });
  if (library === null) {
    redirect("/giris");
  }

  return (
    <main className="account-page" id="ana-icerik">
      <header className="account-heading">
        <p className="eyebrow">Üye hesabı</p>
        <h1>{session.user.displayName}</h1>
        <p>Listeniz, puanlarınız ve izleme ilerlemeniz bu hesapta saklanır.</p>
      </header>
      <AccountLibrary library={library} />
      <section className="account-band" aria-labelledby="account-status-title">
        <div>
          <ShieldCheck aria-hidden="true" size={22} strokeWidth={2} />
          <h2 id="account-status-title">Oturum açık</h2>
          <p>Bu cihazdaki hesap oturumu etkin.</p>
        </div>
        <SignOutButton />
      </section>
      <section className="account-danger-band" aria-labelledby="account-deletion-title">
        <div>
          <p className="eyebrow">Geri alınamaz işlem</p>
          <h2 id="account-deletion-title">Hesabı sil</h2>
          <p>Hesap erişimini hemen kapatır ve kişisel verilerin kalıcı silinmesini başlatır.</p>
        </div>
        <DeleteAccountButton />
      </section>
    </main>
  );
}
