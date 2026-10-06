import type { Interpretation, Signal } from "./domain";
export interface LanguageProvider {
  interpret(text: string, locale: string): Promise<Interpretation>;
}
export type TemporalWindow =
  | "instantaneous"
  | "5-minute"
  | "hourly"
  | "sleep-session"
  | "workout-session"
  | "daily"
  | "weekly"
  | "monthly"
  | "lunar-cycle"
  | "seasonal"
  | "yearly";
export interface Measurement {
  id: string;
  provider: string;
  device: string | null;
  originalType: string;
  originalUnit: string;
  value: number;
  canonicalMetric: string;
  canonicalUnit: string;
  measuredAt: string;
  windowStart: string;
  windowEnd: string;
  resolution: TemporalWindow;
  quality: Record<string, string>;
  schemaVersion: number;
  consentId: string;
}
export interface HealthProvider {
  id:
    | "healthkit"
    | "health-connect"
    | "garmin"
    | "fitbit"
    | "oura"
    | "whoop"
    | "samsung"
    | string;
  permissions(): Promise<string[]>;
  ingest(since: string, allowedMetrics: string[]): AsyncIterable<Measurement>;
  revoke(): Promise<void>;
}
export interface EnvironmentContext {
  id: string;
  coarsePlaceId: string;
  observedAt: string;
  provider: string;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  pressure: number | null;
  pressureChange: number | null;
  rain: number | null;
  snow: number | null;
  cloud: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylight: number | null;
  wind: number | null;
  uv: number | null;
  airQuality: number | null;
  season: string | null;
  condition: string | null;
  extreme: boolean | null;
}
export interface EnvironmentProvider {
  get(placeId: string, date: string): Promise<EnvironmentContext | null>;
}
export interface PublicEvent {
  id: string;
  headline: string;
  category: string;
  placeIds: string[];
  start: string;
  end: string | null;
  valence: "positive" | "negative" | "neutral" | "unknown";
  severity: number | null;
  prominence: number | null;
  estimatedPopulation: number | null;
  source: string;
  confidence: number;
}
export interface EventProvider {
  get(placeId: string, start: string, end: string): Promise<PublicEvent[]>;
}
export interface PatternExplainer {
  explain(statistics: Record<string, unknown>, locale: string): Promise<string>;
}
export interface AnalyticsProvider {
  track(
    event:
      | "onboarding_completed"
      | "checkin_started"
      | "checkin_completed"
      | "weekly_pattern_viewed"
      | "moon_pattern_viewed"
      | "day_edited"
      | "subscription_started",
  ): void;
}
export const analytics: AnalyticsProvider = { track: () => {} };
export const disconnectedEnvironment: EnvironmentProvider = {
  get: async () => null,
};
export const canonicalHealthMappings = {
  heart_rate: "beats/min",
  resting_heart_rate: "beats/min",
  hrv_rmssd: "ms",
  hrv_sdnn: "ms",
  sleep_duration: "minutes",
  steps: "count",
  respiratory_rate: "breaths/min",
  blood_oxygen: "percent",
  temperature: "celsius",
  active_energy: "kcal",
  blood_pressure_systolic: "mmHg",
  blood_pressure_diastolic: "mmHg",
} as const;
export type CanonicalState = Partial<Record<Signal["dimension"], Signal>>;
