import { z } from "zod";
import {
  authenticated,
  boundedBody,
  privateHeaders,
  sameOrigin,
} from "@/lib/server";
import { momentInput } from "@/lib/world/domain";
import { cityById } from "@/lib/world/cities";
import { mediaStorage, worldAdmin } from "@/lib/world/server";
import { sanitizeImage } from "@/lib/world/media";
import { moderationProvider } from "@/lib/world/moderation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (!auth)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  const { data: owned, error } = await auth.client
    .from("moment_ownership")
    .select("moment_id")
    .eq("user_id", auth.user.id);
  if (error)
    return Response.json(
      { error: "Unavailable" },
      { status: 503, headers: privateHeaders },
    );
  if (!owned?.length)
    return Response.json({ moments: [] }, { headers: privateHeaders });
  const result = await auth.client
    .from("public_moments")
    .select("*")
    .in(
      "id",
      owned.map((o) => o.moment_id),
    )
    .order("submitted_at", { ascending: false });
  return Response.json(
    result.error ? { error: "Unavailable" } : { moments: result.data },
    { status: result.error ? 503 : 200, headers: privateHeaders },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: privateHeaders },
    );
  const auth = await authenticated(request);
  if (!auth)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  const admin = worldAdmin(),
    storage = mediaStorage();
  if (!admin || !storage)
    return Response.json(
      { error: "Not configured" },
      { status: 503, headers: privateHeaders },
    );
  let path: string | undefined;
  try {
    const data = momentInput.safeParse(
      JSON.parse(await boundedBody(request, 4000000)),
    );
    if (!data.success || !cityById(data.data.cityId))
      return Response.json(
        { error: "Invalid moment" },
        { status: 400, headers: privateHeaders },
      );
    const { data: allowed, error: limitError } = await auth.client.rpc(
      "claim_world_action",
      { kind: "submit" },
    );
    if (limitError || !allowed)
      return Response.json(
        { error: "Limit" },
        { status: 429, headers: privateHeaders },
      );
    const input = data.data;
    let image: Awaited<ReturnType<typeof sanitizeImage>> | undefined;
    if (input.image) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.image))
        throw new Error("Invalid image");
      image = await sanitizeImage(Buffer.from(input.image, "base64"));
      path = crypto.randomUUID() + ".webp";
      await storage.put(path, image.data);
    }
    const review = await moderationProvider().review({
      caption: input.caption,
      feeling: input.feeling,
      image: image?.data,
    });
    const { image: discarded, ...entry } = input;
    void discarded;
    const created = await admin.rpc("create_world_moment", {
      owner_id: auth.user.id,
      entry,
      media: image
        ? { path, width: image.width, height: image.height, bytes: image.bytes }
        : null,
      review,
    });
    if (created.error) throw new Error("Save failed");
    path = undefined;
    let state = "pending";
    if (review.state !== "pending") {
      const { error } = await admin.rpc("review_world_moment", {
        mid: created.data,
        decision: review.state,
        reviewer: review.provider,
        review_version: review.version,
      });
      if (!error) state = review.state;
    }
    return Response.json(
      { id: created.data, state },
      { status: 201, headers: privateHeaders },
    );
  } catch {
    if (path)
      await storage.remove([path]).catch(async () => {
        await admin
          .from("media_deletion_queue")
          .upsert({ storage_path: path }, { onConflict: "storage_path" });
      });
    return Response.json(
      { error: "Could not submit moment" },
      { status: 400, headers: privateHeaders },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: privateHeaders },
    );
  const auth = await authenticated(request);
  if (!auth)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success)
    return Response.json(
      { error: "Invalid ID" },
      { status: 400, headers: privateHeaders },
    );
  const { error } = await auth.client.rpc("delete_world_moment", {
    mid: id.data,
  });
  return Response.json(error ? { error: "Not permitted" } : { deleted: true }, {
    status: error ? 403 : 200,
    headers: privateHeaders,
  });
}
