import { timingSafeEqual } from "node:crypto";
import { worldAdmin, mediaStorage } from "@/lib/world/server";
import { pulseLabel, type Pulse } from "@/lib/world/domain";
import { privateHeaders } from "@/lib/server";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") ?? "";
  if (
    !expected ||
    Buffer.byteLength(actual) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(`Bearer ${expected}`))
  )
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  const admin = worldAdmin(),
    storage = mediaStorage();
  if (!admin || !storage)
    return Response.json(
      { error: "Unavailable" },
      { status: 503, headers: privateHeaders },
    );
  try {
    const expired = await admin.rpc("expire_world_moments");
    if (expired.error) throw expired.error;
    const { data: queue, error } = await admin
      .from("media_deletion_queue")
      .select("id,storage_path")
      .limit(100);
    if (error) throw error;
    if (queue?.length) {
      await storage.remove(queue.map((x) => x.storage_path));
      const { error } = await admin
        .from("media_deletion_queue")
        .delete()
        .in(
          "id",
          queue.map((x) => x.id),
        );
      if (error) throw error;
    }
    const pulses = await admin.rpc("world_pulses");
    if (pulses.error) throw pulses.error;
    if (pulses.data?.length) {
      const snapshots = (pulses.data as Pulse[]).map((p) => ({
        city_id: p.cityId,
        window_start: p.windowStart,
        window_end: p.windowEnd,
        sample_count: p.sampleCount,
        dimensions: p.dimensions,
        dimension_counts: p.dimensionCounts,
        confidence: p.confidence,
        atmosphere_label: pulseLabel(
          p.sampleCount,
          p.dimensions,
          p.dimensionCounts,
        ),
        calculation_version: p.version,
      }));
      const saved = await admin.from("city_pulse_snapshots").upsert(snapshots);
      if (saved.error) throw saved.error;
    }
    const pruned = await admin
      .from("city_pulse_snapshots")
      .delete()
      .lt("window_end", new Date(Date.now() - 30 * 86400000).toISOString());
    if (pruned.error) throw pruned.error;
    return Response.json(
      { removed: queue?.length ?? 0 },
      { headers: privateHeaders },
    );
  } catch {
    return Response.json(
      { error: "Cleanup failed" },
      { status: 503, headers: privateHeaders },
    );
  }
}
