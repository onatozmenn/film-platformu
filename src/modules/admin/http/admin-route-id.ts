import { z } from "zod";

const routeIdSchema = z.string().uuid();

export function parseAdminRouteId(value: string): string | null {
  const parsed = routeIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
