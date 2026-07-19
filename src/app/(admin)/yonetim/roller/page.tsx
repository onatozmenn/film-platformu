import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { disableAccountAction, grantRoleAction, revokeRoleAction } from "@/modules/admin/actions";
import { adminQueries } from "@/modules/admin/server";
import { AdminFormStatus } from "@/modules/admin/ui/admin-form-status";
import { getOptionalMemberSession } from "@/modules/identity/server";

export const metadata: Metadata = { title: "Roller" };

export default async function RolesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ durum?: string | string[] }> }>) {
  const session = await getOptionalMemberSession();
  if (session === null) redirect("/giris");
  const model = await adminQueries.getRoles(session.user.id);
  if (model === null) notFound();
  const rawStatus = (await searchParams).durum;

  return (
    <main className="admin-page" id="ana-icerik">
      <header className="admin-page-heading">
        <div>
          <p className="eyebrow">Yetki yönetimi</p>
          <h1>Roller ve hesaplar</h1>
          <p>Yetki değişiklikleri oturumları iptal eder ve denetim kaydı oluşturur.</p>
        </div>
      </header>
      <AdminFormStatus status={typeof rawStatus === "string" ? rawStatus : undefined} />
      <section aria-labelledby="role-list-heading" className="admin-section">
        <div className="admin-section-heading">
          <h2 id="role-list-heading">Hesaplar</h2>
          <span>{model.accounts.length} hesap</span>
        </div>
        <div className="admin-record-list">
          {model.accounts.map((account) => (
            <article className="admin-record admin-account-row" key={account.id}>
              <div>
                <strong>{account.displayName}</strong>
                <span>{account.email ?? "E-posta yok"}</span>
                <small>
                  {account.disabledAt === null ? account.roles.join(" · ") : "Devre dışı"}
                </small>
              </div>
              {account.disabledAt === null ? (
                <div className="admin-row-actions">
                  {(["EDITOR", "ADMIN"] as const).map((role) => {
                    const assigned = account.roles.includes(role);
                    return (
                      <form action={assigned ? revokeRoleAction : grantRoleAction} key={role}>
                        <input name="subjectUserId" type="hidden" value={account.id} />
                        <input name="role" type="hidden" value={role} />
                        <button
                          className={assigned ? "danger-action" : "secondary-action"}
                          type="submit"
                        >
                          {assigned ? `${role} rolünü kaldır` : `${role} rolü ver`}
                        </button>
                      </form>
                    );
                  })}
                  <form action={disableAccountAction}>
                    <input name="subjectUserId" type="hidden" value={account.id} />
                    <button className="danger-action" type="submit">
                      Hesabı devre dışı bırak
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
