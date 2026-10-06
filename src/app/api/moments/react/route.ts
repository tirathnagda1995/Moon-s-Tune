import { z } from "zod";
import {
  authenticated,
  boundedBody,
  privateHeaders,
  sameOrigin,
} from "@/lib/server";
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
  try {
    const body = z
      .object({ id: z.uuid() })
      .strict()
      .parse(JSON.parse(await boundedBody(request, 1000)));
    const { data, error } = await auth.client.rpc("react_world_moment", {
      mid: body.id,
    });
    if (error) throw error;
    return Response.json({ reacted: data }, { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: "Reaction unavailable" },
      { status: 400, headers: privateHeaders },
    );
  }
}
