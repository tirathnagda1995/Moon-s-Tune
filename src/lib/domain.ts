import { z } from "zod";
export const dimensions = [
  "emotional_valence",
  "energy_arousal",
  "stress_tension",
  "restfulness",
  "focus",
  "physical_vitality",
  "emotional_intensity",
  "calmness",
  "cognitive_clarity",
  "social_connectedness",
  "motivation",
] as const;
export type Dimension = (typeof dimensions)[number];
export const quickDimensions: Dimension[] = [...dimensions.slice(0, 6)];
export const sourceTypes = [
  "SELF_REPORTED",
  "DEVICE_MEASURED",
  "USER_CORRECTED",
  "ENVIRONMENTAL",
  "ASTRONOMICAL",
  "EXTERNALLY_OBSERVED",
  "MODEL_INFERRED",
  "DERIVED_STATISTICAL",
] as const;
export const signalSchema = z.object({
  dimension: z.enum(dimensions),
  value: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
});
export const interpretationSchema = z.object({
  signals: z.array(signalSchema).max(11),
  language: z.string().max(35),
  reflection: z.string().max(600),
  safety: z.enum(["normal", "urgent"]),
  provenance: z
    .object({
      provider: z.string().max(80),
      model: z.string().max(160),
      promptVersion: z.string().max(30),
    })
    .optional(),
});
export type Interpretation = z.infer<typeof interpretationSchema>;
export type Signal = z.infer<typeof signalSchema> & {
  id: string;
  sourceType: (typeof sourceTypes)[number];
  source: string;
  unit: "ordinal_1_5";
  timestamp: string;
  localDate: string;
  timezone: string;
  qualityFlags: string[];
  schemaVersion: 1;
  derivationVersion: string;
  supersedes?: string;
};
export type LunarContext = {
  phase: number;
  angle: number;
  illumination: number;
  age: number;
  cycle: number;
  nextFull: string;
  nextNew: string;
  version: string;
};
export type Cipher = { version: 1; iv: string; salt: string; data: string };
export type Observation = {
  id: string;
  personId: string;
  createdAt: string;
  localDate: string;
  timezone: string;
  schemaVersion: 1;
  revision: number;
  signals: Signal[];
  lunar: LunarContext;
  language: string;
  reflectionCode: "recorded" | "positive" | "low" | "urgent";
  journal: Cipher | null;
  feedback?: "helpful" | "unhelpful";
};
export type ConsentPurpose =
  | "CORE_APP"
  | "OPTIONAL_AI_TEXT_PROCESSING"
  | "WEARABLE_HEALTH_ANALYSIS"
  | "LOCATION_CONTEXT"
  | "ENVIRONMENT_CONTEXT"
  | "RESEARCH"
  | "AGGREGATED_RESEARCH"
  | "MARKETING";
export type Consent = {
  id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  timestamp: string;
  version: "1";
  region: string;
};
export function localDate(
  date = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function makeSignal(
  dimension: Dimension,
  value: number,
  confidence: number,
  sourceType: Signal["sourceType"],
  date: string,
  timezone: string,
  source = "quick-checkin",
  supersedes?: string,
): Signal {
  return {
    id: crypto.randomUUID(),
    dimension,
    value,
    confidence,
    sourceType,
    source,
    unit: "ordinal_1_5",
    timestamp: new Date().toISOString(),
    localDate: date,
    timezone,
    qualityFlags:
      sourceType === "MODEL_INFERRED" ? ["user-review-required"] : [],
    schemaVersion: 1,
    derivationVersion: "1",
    supersedes,
  };
}
export function effectiveSignals(signals: Signal[]): Signal[] {
  const map = new Map<Dimension, Signal>();
  for (const s of signals) {
    const prev = map.get(s.dimension);
    if (
      !prev ||
      s.sourceType === "USER_CORRECTED" ||
      (prev.sourceType !== "USER_CORRECTED" &&
        (s.sourceType !== "MODEL_INFERRED" ||
          prev.sourceType === "MODEL_INFERRED"))
    )
      map.set(s.dimension, s);
  }
  return [...map.values()];
}
export function reflectionCode(
  signals: Signal[],
  urgent = false,
): Observation["reflectionCode"] {
  if (urgent) return "urgent";
  const mood = effectiveSignals(signals).find(
    (s) => s.dimension === "emotional_valence",
  );
  return mood && mood.value >= 4
    ? "positive"
    : mood && mood.value <= 2
      ? "low"
      : "recorded";
}
