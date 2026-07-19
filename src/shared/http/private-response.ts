export function privateNoContent(requestId: string): Response {
  return new Response(null, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    },
    status: 204,
  });
}
