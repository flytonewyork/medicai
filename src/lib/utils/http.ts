// Tiny client-side HTTP helper. The pattern
//
//     const res = await fetch(url, { ... });
//     if (!res.ok) throw new Error(await res.text());
//     return (await res.json()) as T;
//
// had grown across ~12 lib/* and component call sites. Centralising it
// here gives every caller the same error shape (`HttpError` carrying
// the status and server message) and keeps individual modules focused
// on their payload.

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}${body ? `: ${body}` : ""}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export interface PostJsonOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...options.headers },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return (await res.json()) as T;
}
