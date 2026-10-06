import { z } from "zod";
import { worldReader } from "@/lib/world/server";
import { dailyPrompt, pulseLabel, type Pulse } from "@/lib/world/domain";
import { privateHeaders } from "@/lib/server";
const querySchema = z.object({
  city: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  before: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid().optional(),
  prompt: z.coerce.number().int().min(1).max(64).optional(),
});
export async function GET(request: Request) {
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query" },
      { status: 400, headers: privateHeaders },
    );
  const client = worldReader();
  if (!client)
    return Response.json(
      {
        connected: false,
        moments: [],
        pulses: [],
        next: null,
        prompt: dailyPrompt(),
      },
      { headers: privateHeaders },
    );
  const { city, before, id, prompt } = query.data;
  if ((before && !id) || (!before && id))
    return Response.json({ error: "Invalid cursor" }, { status: 400 });
  try {
    const [feed, pulses] = await Promise.all([
      client.rpc("world_feed", {
        city: city ?? null,
        before_time: before ?? null,
        before_id: id ?? null,
        prompt: prompt ?? null,
      }),
      client.rpc("world_pulses"),
    ]);
    if (feed.error || pulses.error) throw new Error();
    const rows = feed.data ?? [];
    const visible = rows.slice(0, 20);
    const last = visible.at(-1);
    return Response.json(
      {
        connected: true,
        moments: visible,
        pulses: (pulses.data ?? []).map((p: Pulse) => ({
          ...p,
          label: pulseLabel(p.sampleCount, p.dimensions, p.dimensionCounts),
        })),
        next:
          rows.length > 20 ? { before: last.submitted_at, id: last.id } : null,
        prompt: dailyPrompt(),
      },
      { headers: privateHeaders },
    );
  } catch {
    return Response.json(
      { error: "World unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
