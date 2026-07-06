/**
 * Parse a request body as JSON, returning an empty object when the body is missing.
 */
export async function parseJsonBody<T extends Record<string, unknown>>(
  request: Request
): Promise<T> {
  const text = await request.text();
  if (!text.trim()) {
    return {} as T;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as T;
    }
    return parsed as T;
  } catch {
    throw new Error("Invalid JSON request body");
  }
}
