/** A response with an error status; `detail` is the message the backend sent, if any. */
export class HttpError extends Error {
  // explicit fields: parameter properties are not allowed with erasableSyntaxOnly
  readonly status: number;
  readonly detail: string | undefined;

  constructor(message: string, status: number, detail: string | undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.detail = detail;
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const detail = typeof body?.detail === "string" ? body.detail : undefined;
    throw new HttpError(
      `${init?.method ?? "GET"} ${url} failed: ${res.status}`,
      res.status,
      detail,
    );
  }

  return res.json();
}

export const UNEXPECTED_ERROR =
  "The server did not answer as expected. Please try again.";

/**
 * The backend's explanation for an expected client error (e.g. 404 for a record deleted in the
 * meantime), otherwise a generic message.
 */
export function errorMessage(error: unknown, explainedStatus: number): string {
  if (
    error instanceof HttpError &&
    error.status === explainedStatus &&
    error.detail
  ) {
    return error.detail;
  }
  return UNEXPECTED_ERROR;
}
