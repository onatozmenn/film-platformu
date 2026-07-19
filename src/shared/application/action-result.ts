export type ActionErrorCode =
  "CONFLICT" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "PROVIDER_UNAVAILABLE";

export type ActionFieldErrors = Readonly<Record<string, readonly string[]>>;

export type ActionResult<T> =
  | Readonly<{ data: T; ok: true }>
  | Readonly<{
      code: ActionErrorCode;
      fieldErrors?: ActionFieldErrors;
      ok: false;
    }>;
