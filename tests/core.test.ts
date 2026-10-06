import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/lib/crypto";
import { lunarContext } from "../src/lib/lunar";
import { baseline, patterns } from "../src/lib/patterns";
import {
  effectiveSignals,
  makeSignal,
  localDate,
  interpretationSchema,
  type Observation,
} from "../src/lib/domain";
import { messages, direction, format } from "../src/lib/i18n";
function observation(
  date: string,
  value: number,
  phase = 0,
  cycle = 1,
): Observation {
  return {
    id: crypto.randomUUID(),
    personId: "guest",
    createdAt: date + "T12:00:00Z",
    localDate: date,
    timezone: "UTC",
    schemaVersion: 1,
    revision: 1,
    signals: [
      makeSignal("energy_arousal", value, 1, "SELF_REPORTED", date, "UTC"),
    ],
    lunar: {
      phase,
      cycle,
      angle: 0,
      age: 0,
      illumination: 0,
      nextFull: "",
      nextNew: "",
      version: "test",
    },
    language: "en",
    reflectionCode: "recorded",
    journal: null,
  };
}
describe("vault", () => {
  it("round trips Unicode, authenticates entry binding and rejects wrong keys", async () => {
    const text = "आज अच्छा लगा 🌙 — يوم جميل";
    const cipher = await encrypt(
      text,
      "a very long secret passphrase",
      "entry-1",
    );
    expect(JSON.stringify(cipher)).not.toContain(text);
    expect(
      await decrypt(cipher, "a very long secret passphrase", "entry-1"),
    ).toBe(text);
    await expect(
      decrypt(cipher, "a different passphrase", "entry-1"),
    ).rejects.toThrow();
    await expect(
      decrypt(cipher, "a very long secret passphrase", "entry-2"),
    ).rejects.toThrow();
  });
  it("uses fresh IVs and salts", async () => {
    const a = await encrypt("x", "a long enough passphrase", "a");
    const b = await encrypt("x", "a long enough passphrase", "a");
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
  });
});
describe("astronomy", () => {
  it("matches 2024 April eclipse new Moon", () => {
    const moon = lunarContext(new Date("2024-04-08T18:21:00Z"));
    expect(moon.phase).toBe(0);
    expect(moon.illumination).toBeLessThan(0.001);
  });
  it("matches October 2024 full Moon", () => {
    const moon = lunarContext(new Date("2024-10-17T11:26:00Z"));
    expect(moon.phase).toBe(4);
    expect(moon.illumination).toBeGreaterThan(0.999);
  });
  it("bounds age and phase across multiple years", () => {
    for (let month = 0; month < 36; month++) {
      const lunar = lunarContext(new Date(Date.UTC(2024, month, 15)));
      expect(lunar.age).toBeGreaterThanOrEqual(0);
      expect(lunar.age).toBeLessThan(30);
      expect(lunar.phase).toBeLessThan(8);
      expect(new Date(lunar.nextFull).getTime()).toBeGreaterThan(
        Date.UTC(2024, month, 15),
      );
    }
  });
});
describe("signals and patterns", () => {
  it("corrections are authoritative, including after later inference", () => {
    const a = makeSignal(
      "energy_arousal",
      1,
      0.8,
      "MODEL_INFERRED",
      "2026-01-01",
      "UTC",
    );
    const b = {
      ...a,
      id: "b",
      value: 5,
      sourceType: "USER_CORRECTED" as const,
    };
    expect(effectiveSignals([a, b, { ...a, id: "c", value: 2 }])[0].value).toBe(
      5,
    );
  });
  it("keeps unobserved dimensions unknown", () => {
    expect(
      interpretationSchema.parse({
        signals: [],
        language: "hi",
        reflection: "ठीक",
        safety: "normal",
      }).signals,
    ).toEqual([]);
    expect(() =>
      interpretationSchema.parse({
        signals: [{ dimension: "energy_arousal", value: 9, confidence: 1 }],
        language: "en",
        reflection: "",
        safety: "normal",
      }),
    ).toThrow();
  });
  it("insufficient data never generates an effect", () => {
    expect(
      patterns([observation("2026-01-01", 5)]).every(
        (p) => p.difference === null,
      ),
    ).toBe(true);
  });
  it("requires multiple cycles, computes differences in points and deduplicates days", () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      observation(
        new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
        i % 8 === 0 ? 5 : 3,
        i % 8,
        Math.floor(i / 29),
      ),
    );
    const p = patterns(rows).find(
      (p) =>
        p.variable === "moon" &&
        p.group === 0 &&
        p.dimension === "energy_arousal",
    )!;
    expect(p.difference).toBe(2);
    expect(p.confidence).toBe("exploratory");
    expect(
      patterns([...rows, ...rows]).find(
        (x) =>
          x.variable === "moon" &&
          x.group === 0 &&
          x.dimension === "energy_arousal",
      )!.n,
    ).toBe(p.n);
  });
  it("week baseline excludes old and future records", () => {
    expect(
      baseline(
        [
          observation("2026-01-01", 1),
          observation("2026-01-10", 4),
          observation("2026-01-11", 5),
        ],
        "energy_arousal",
        6,
        new Date("2026-01-10T12:00Z"),
      ),
    ).toEqual({ mean: 4, n: 1 });
  });
});
describe("localization and dates", () => {
  it("uses local dates across midnight and DST", () => {
    expect(localDate(new Date("2026-01-01T22:00:00Z"), "Asia/Kolkata")).toBe(
      "2026-01-02",
    );
    expect(
      localDate(new Date("2026-03-08T07:00:00Z"), "America/New_York"),
    ).toBe("2026-03-08");
  });
  it("falls back and supports RTL", () => {
    expect(messages("gu").save).toBe(messages("en").save);
    expect(messages("hi-IN").today).toBe("आज");
    expect(direction("ur-PK")).toBe("rtl");
    expect(format("{count} observations", { count: 7 })).toBe("7 observations");
  });
});
import { urgentLanguage } from "../src/lib/safety";
it("routes explicit imminent risk without treating ordinary sadness as an emergency", () => {
  expect(urgentLanguage("I am going to kill myself tonight")).toBe(true);
  expect(urgentLanguage("I felt sad today")).toBe(false);
});
