import { createClient } from "@supabase/supabase-js";
export function serverClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function authenticated(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const client = serverClient(token);
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { client, user: data.user, token };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const expected = process.env.APP_URL
      ? new URL(process.env.APP_URL).origin
      : `${new URL(request.url).protocol}//${request.headers.get("host") ?? new URL(request.url).host}`;
    return origin === expected;
  } catch {
    return false;
  }
}
export const privateHeaders = { "Cache-Control": "no-store" };
export async function boundedBody(request: Request, maxBytes = 20000) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error("Too large");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) {
    data.set(part, offset);
    offset += part.length;
  }
  return new TextDecoder().decode(data);
}
