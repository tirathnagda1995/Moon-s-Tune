import { z } from "zod";
import { languageProvider } from "@/lib/llm";
import {
  authenticated,
  boundedBody,
  privateHeaders,
  sameOrigin,
} from "@/lib/server";
export const runtime = "nodejs";
const schema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: z.string().regex(/^[a-zA-Z-]{2,35}$/),
  consent: z.literal(true),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: privateHeaders },
    );
  const provider = languageProvider();
  if (!provider)
    return Response.json(
      { error: "Not configured" },
      { status: 503, headers: privateHeaders },
    );
  const auth = await authenticated(request);
  if (!auth)
    return Response.json(
      { error: "Sign in required" },
      { status: 401, headers: privateHeaders },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 20000)
    return Response.json(
      { error: "Too large" },
      { status: 413, headers: privateHeaders },
    );
  try {
    const body = await boundedBody(request);
    if (body.length > 20000)
      return Response.json({ error: "Too large" }, { status: 413 });
    const parsed = schema.safeParse(JSON.parse(body));
    if (!parsed.success)
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: privateHeaders },
      );
    const { data: allowed, error } = await auth.client.rpc("claim_ai_request");
    if (error || !allowed)
      return Response.json(
        { error: "Rate or consent limit" },
        { status: 429, headers: privateHeaders },
      );
    const result = await provider.interpret(
      parsed.data.text,
      parsed.data.locale,
    );
    return Response.json(result, { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: "Interpretation unavailable" },
      { status: 502, headers: privateHeaders },
    );
  }
}
