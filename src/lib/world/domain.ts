import { z } from "zod";
import { prompts } from "@/locales/world/prompts";
export const feelings = [
  "peaceful",
  "alive",
  "connected",
  "heavy",
  "tired",
  "hopeful",
  "restless",
  "calm",
  "excited",
  "drained",
  "warm",
  "chaotic",
] as const;
export type Feeling = (typeof feelings)[number];
export type Visibility = "city" | "global";
export type ModerationState = "pending" | "approved" | "rejected";
export const momentInput = z
  .object({
    cityId: z.string().regex(/^[a-z0-9-]{2,70}$/),
    feeling: z.enum(feelings).nullable(),
    caption: z.string().trim().max(180),
    visibility: z.enum(["city", "global"]),
    publicConsent: z.literal(true),
    image: z.string().max(3000000).optional(),
    language: z.string().max(35).default("und"),
  })
  .strict()
  .refine((v) => v.feeling || v.caption || v.image, "Empty moment");
export interface PublicMoment {
  id: string;
  city_id: string;
  prompt_id: number;
  feeling: Feeling | null;
  caption: string;
  language: string;
  visibility: Visibility;
  submitted_at: string;
  expires_at: string;
  moderation_state: ModerationState;
  media_id: string | null;
  demo?: boolean;
  cover?: number;
}
export const DAY = 86400000;
export function dailyPrompt(date = new Date()) {
  const day = Math.floor(date.getTime() / DAY);
  const index = ((day % prompts.length) + prompts.length) % prompts.length;
  return {
    id: index + 1,
    text: prompts[index],
    date: date.toISOString().slice(0, 10),
    nextChange: new Date((day + 1) * DAY).toISOString(),
    version: "curated-1",
  };
}
export function isPublicNow(
  moment: PublicMoment,
  now = new Date(),
  scope: "city" | "global" = "city",
) {
  return (
    moment.moderation_state === "approved" &&
    new Date(moment.expires_at) > now &&
    new Date(moment.submitted_at) <= now &&
    (scope === "city" || moment.visibility === "global")
  );
}
export const feelingSignals: Record<
  Feeling,
  Partial<
    Record<
      "valence" | "energy" | "calmness" | "tension" | "connection" | "fatigue",
      number
    >
  >
> = {
  peaceful: { valence: 4, calmness: 5, tension: 1 },
  alive: { valence: 4, energy: 5 },
  connected: { valence: 4, connection: 5 },
  heavy: { valence: 2, energy: 2 },
  tired: { energy: 2, fatigue: 4 },
  hopeful: { valence: 4 },
  restless: { calmness: 1, tension: 4 },
  calm: { calmness: 5, tension: 1 },
  excited: { valence: 5, energy: 5 },
  drained: { energy: 1, fatigue: 5 },
  warm: { valence: 4, connection: 4 },
  chaotic: { calmness: 1, tension: 5 },
};
export interface Pulse {
  cityId: string;
  sampleCount: number;
  dimensions: Record<string, number | null>;
  dimensionCounts: Record<string, number>;
  windowStart: string;
  windowEnd: string;
  version: string;
  confidence: "insufficient" | "limited";
  label:
    | "insufficient"
    | "calm"
    | "energetic"
    | "connected"
    | "tired"
    | "restless"
    | "warm"
    | "mixed";
}
export function pulseLabel(
  sampleCount: number,
  means: Record<string, number | null>,
  counts: Record<string, number>,
): Pulse["label"] {
  if (sampleCount < 20) return "insufficient";
  const high = (key: string) =>
    (counts[key] ?? 0) >= 20 && (means[key] ?? 0) >= 4;
  return high("calmness")
    ? "calm"
    : high("energy")
      ? "energetic"
      : high("connection")
        ? "connected"
        : high("fatigue")
          ? "tired"
          : high("tension")
            ? "restless"
            : high("valence")
              ? "warm"
              : "mixed";
}
export function calculatePulse(
  cityId: string,
  observations: { person: string; feeling: Feeling | null; at: string }[],
  now = new Date(),
): Pulse {
  const latest = new Map<string, (typeof observations)[number]>();
  for (const o of observations) {
    const time = new Date(o.at).getTime();
    if (time > now.getTime() || time <= now.getTime() - DAY) continue;
    const old = latest.get(o.person);
    if (!old || old.at < o.at) latest.set(o.person, o);
  }
  const sums: Record<string, number> = {},
    counts: Record<string, number> = {};
  for (const o of latest.values())
    if (o.feeling)
      for (const [key, value] of Object.entries(feelingSignals[o.feeling])) {
        sums[key] = (sums[key] ?? 0) + value;
        counts[key] = (counts[key] ?? 0) + 1;
      }
  const dimensions = Object.fromEntries(
    Object.keys(sums).map((key) => [key, sums[key] / counts[key]]),
  );
  const sampleCount = latest.size;
  return {
    cityId,
    sampleCount,
    dimensions:
      sampleCount >= 20
        ? Object.fromEntries(
            Object.entries(dimensions).filter(([key]) => counts[key] >= 20),
          )
        : {},
    dimensionCounts:
      sampleCount >= 20
        ? Object.fromEntries(
            Object.entries(counts).filter(([, count]) => count >= 20),
          )
        : {},
    windowStart: new Date(now.getTime() - DAY).toISOString(),
    windowEnd: now.toISOString(),
    version: "pulse-1",
    confidence: sampleCount < 20 ? "insufficient" : "limited",
    label: pulseLabel(sampleCount, dimensions, counts),
  };
}
export interface ModerationProvider {
  review(input: {
    caption: string;
    feeling: Feeling | null;
    image?: Uint8Array;
  }): Promise<{
    state: ModerationState;
    provider: string;
    version: string;
    reason: string;
  }>;
}
export interface CaptionTranslator {
  translate(
    caption: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<{ original: string; translated: string; provider: string }>;
}
export interface BodyCycleEvent {
  id: string;
  personId: string;
  type: "period-start" | "period-end";
  recordedAt: string;
  localDate: string;
  timezone: string;
  source: "SELF_REPORTED";
  consentPurpose: "PRIVATE_BODY_CYCLE";
  visibility: "private";
  schemaVersion: 1;
}
export const productEvents = [
  "world_opened",
  "city_opened",
  "moment_viewed",
  "daily_prompt_viewed",
  "moment_started",
  "moment_published",
  "moment_saved_private",
  "same_tide_reacted",
  "account_created",
  "personal_checkin_completed",
  "patterns_viewed",
  "share_created",
  "city_searched",
] as const;
// In-memory aggregate diagnostics only: no IDs, payloads, persistence, or network.
// Replace the adapter only after reviewing collection purpose and consent.
export interface WorldAnalytics {
  track(event: (typeof productEvents)[number]): void;
}
const sessionCounts: Partial<Record<(typeof productEvents)[number], number>> =
  {};
export const worldAnalytics: WorldAnalytics = {
  track: (event) => {
    if (typeof window !== "undefined")
      sessionCounts[event] = (sessionCounts[event] ?? 0) + 1;
  },
};
export function worldMetricSnapshot() {
  return { ...sessionCounts };
}
