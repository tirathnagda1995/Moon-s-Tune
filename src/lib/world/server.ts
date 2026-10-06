import { createClient } from "@supabase/supabase-js";
export function worldReader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
export function worldAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
export interface MediaStorage {
  put(path: string, bytes: Uint8Array): Promise<void>;
  remove(paths: string[]): Promise<void>;
  get(path: string): Promise<Blob>;
}
export function mediaStorage(): MediaStorage | null {
  const admin = worldAdmin();
  if (!admin) return null;
  const bucket = admin.storage.from("moment-quarantine");
  return {
    async put(path, bytes) {
      const { error } = await bucket.upload(path, bytes, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "0",
      });
      if (error) throw new Error("Upload failed");
    },
    async remove(paths) {
      const { error } = await bucket.remove(paths);
      if (error) throw new Error("Removal failed");
    },
    async get(path) {
      const { data, error } = await bucket.download(path);
      if (error || !data) throw new Error("Media missing");
      return data;
    },
  };
}
