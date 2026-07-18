export const requestIdHeader = "x-request-id";

const validRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export function createRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function resolveRequestId(
  headers: Pick<Headers, "get">,
  trustIncoming: boolean,
  generate: () => string = createRequestId,
): string {
  const incoming = headers.get(requestIdHeader);

  if (trustIncoming && incoming !== null && validRequestId.test(incoming)) {
    return incoming;
  }

  return generate();
}
