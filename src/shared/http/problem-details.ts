export type ProblemCode =
  | "AUTHENTICATION_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "PLAYBACK_NOT_AVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "VALIDATION_FAILED";

type ProblemDefinition = Readonly<{
  detail: string;
  slug: string;
  status: number;
  title: string;
}>;

const definitions = {
  AUTHENTICATION_REQUIRED: {
    detail: "Bu işlem için oturum açmanız gerekiyor.",
    slug: "authentication-required",
    status: 401,
    title: "Oturum gerekli",
  },
  CONFLICT: {
    detail: "İşlem mevcut durumla çakışıyor.",
    slug: "conflict",
    status: 409,
    title: "İşlem tamamlanamadı",
  },
  FORBIDDEN: {
    detail: "Bu işlemi yapma yetkiniz bulunmuyor.",
    slug: "forbidden",
    status: 403,
    title: "İşleme izin verilmiyor",
  },
  INTERNAL_ERROR: {
    detail: "Beklenmeyen bir sorun oluştu.",
    slug: "internal-error",
    status: 500,
    title: "İşlem tamamlanamadı",
  },
  NOT_FOUND: {
    detail: "Aradığınız içerik bulunamadı.",
    slug: "not-found",
    status: 404,
    title: "İçerik bulunamadı",
  },
  PLAYBACK_NOT_AVAILABLE: {
    detail: "Bu film şu anda oynatılamıyor.",
    slug: "playback-not-available",
    status: 403,
    title: "Film şu anda oynatılamıyor",
  },
  PROVIDER_UNAVAILABLE: {
    detail: "Gerekli hizmet şu anda yanıt vermiyor.",
    slug: "provider-unavailable",
    status: 503,
    title: "Hizmete ulaşılamıyor",
  },
  RATE_LIMITED: {
    detail: "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.",
    slug: "rate-limited",
    status: 429,
    title: "İstek sınırı aşıldı",
  },
  VALIDATION_FAILED: {
    detail: "Gönderilen bilgiler geçerli değil.",
    slug: "validation-failed",
    status: 400,
    title: "Bilgileri kontrol edin",
  },
} satisfies Record<ProblemCode, ProblemDefinition>;

export type ProblemDetails = Readonly<{
  code: ProblemCode;
  detail: string;
  requestId: string;
  status: number;
  title: string;
  type: string;
}>;

export function createProblemDetails(code: ProblemCode, requestId: string): ProblemDetails {
  const definition = definitions[code];

  return {
    code,
    detail: definition.detail,
    requestId,
    status: definition.status,
    title: definition.title,
    type: `https://film-platform.invalid/problems/${definition.slug}`,
  };
}

export function problemResponse(code: ProblemCode, requestId: string): Response {
  const problem = createProblemDetails(code, requestId);

  return Response.json(problem, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/problem+json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    },
    status: problem.status,
  });
}
