import { z } from "zod";
import type { ModerationProvider } from "./domain";
const decision = z
  .object({
    decision: z.enum(["approved", "rejected", "pending"]),
    version: z.string().min(1).max(50),
  })
  .strict();
export function moderationProvider(): ModerationProvider {
  return {
    async review(input) {
      const safe = {
        state: "pending" as const,
        provider: "unconfigured",
        version: "1",
        reason: "Awaiting content review",
      };
      const endpoint = process.env.MODERATION_URL;
      const key = process.env.MODERATION_API_KEY;
      if (!endpoint || !key) return safe;
      try {
        if (new URL(endpoint).protocol !== "https:") return safe;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schemaVersion: 1,
            caption: input.caption,
            feeling: input.feeling,
            image: input.image
              ? {
                  mime: "image/webp",
                  base64: Buffer.from(input.image).toString("base64"),
                }
              : null,
            policy:
              "Reject sexual exploitation, minors in sexual contexts, explicit violence, hateful abuse, personal identifying information, exact location, private health disclosures and spam. Review the complete image AND caption. Uncertain content remains pending.",
          }),
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
        if (!response.ok) return safe;
        const body = await response.text();
        if (body.length > 3000) return safe;
        const parsed = decision.safeParse(JSON.parse(body));
        if (!parsed.success) return safe;
        return {
          state: parsed.data.decision,
          provider: "configured-moderation",
          version: parsed.data.version,
          reason: "Provider decision",
        };
      } catch {
        return safe;
      }
    },
  };
}
