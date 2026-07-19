const messages = {
  conflict: "Kayıt siz çalışırken değişti. Güncel veriyi kontrol edip yeniden deneyin.",
  error: "İşlem tamamlanamadı. Daha sonra yeniden deneyin.",
  forbidden: "Bu işlem için gerekli yetkiniz bulunmuyor.",
  invalid: "Gönderilen alanları ve yayın koşullarını kontrol edin.",
  "not-found": "İşlem yapılacak kayıt bulunamadı.",
  "provider-unavailable": "Video sağlayıcısına şu anda ulaşılamıyor.",
  "rate-limited": "Çok fazla yönetim işlemi gönderildi. Lütfen daha sonra yeniden deneyin.",
  saved: "Değişiklik ve denetim kaydı birlikte kaydedildi.",
} as const;

export function AdminFormStatus({ status }: Readonly<{ status: string | undefined }>) {
  let message: string | undefined;
  switch (status) {
    case "conflict":
    case "error":
    case "forbidden":
    case "invalid":
    case "not-found":
    case "provider-unavailable":
    case "rate-limited":
    case "saved":
      message = messages[status];
      break;
    default:
      message = undefined;
  }
  if (message === undefined) {
    return null;
  }
  return (
    <p
      className={status === "saved" ? "admin-status admin-status--success" : "admin-status"}
      role="status"
    >
      {message}
    </p>
  );
}
