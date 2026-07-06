function timeoutMessage(status: number): string {
  if (status === 504 || status === 408) {
    return "The audit is taking longer than expected. Please try again in a few minutes, or contact support if this keeps happening.";
  }
  return `Request failed (${status})`;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * Parse a fetch Response as JSON with friendly errors for HTML/plain-text failures (e.g. Vercel 504).
 */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!text) {
    if (!res.ok) throw new Error(timeoutMessage(res.status));
    return {} as T;
  }

  const shouldParseJson =
    contentType.includes("application/json") || contentType.includes("+json") || looksLikeJson(text);

  if (shouldParseJson) {
    try {
      return JSON.parse(text) as T;
    } catch {
      if (!res.ok) {
        throw new Error(timeoutMessage(res.status));
      }
      throw new Error("Server returned an invalid JSON response.");
    }
  }

  if (!res.ok) {
    throw new Error(timeoutMessage(res.status));
  }

  throw new Error("Server returned an unexpected response format.");
}
