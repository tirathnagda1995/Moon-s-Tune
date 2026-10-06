import { z } from "zod";
import { worldReader, worldAdmin, mediaStorage } from "@/lib/world/server";
import { privateHeaders } from "@/lib/server";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers: privateHeaders });
  const reader = worldReader(),
    admin = worldAdmin(),
    storage = mediaStorage();
  if (!reader || !admin || !storage)
    return new Response(null, { status: 404, headers: privateHeaders });
  try {
    const { data: moment } = await reader
      .from("public_moments")
      .select("id")
      .eq("media_id", id)
      .maybeSingle();
    if (!moment)
      return new Response(null, { status: 404, headers: privateHeaders });
    const { data: media } = await admin
      .from("moment_media")
      .select("storage_path")
      .eq("id", id)
      .eq("moment_id", moment.id)
      .maybeSingle();
    if (!media)
      return new Response(null, { status: 404, headers: privateHeaders });
    const blob = await storage.get(media.storage_path);
    return new Response(blob, {
      headers: {
        ...privateHeaders,
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response(null, { status: 404, headers: privateHeaders });
  }
}
