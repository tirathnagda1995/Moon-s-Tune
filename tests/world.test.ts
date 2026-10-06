import { describe, it, expect, vi, afterEach } from "vitest";
import sharp from "sharp";
import {
  dailyPrompt,
  calculatePulse,
  isPublicNow,
  momentInput,
  type PublicMoment,
} from "../src/lib/world/domain";
import { cities, searchCities } from "../src/lib/world/cities";
import { prompts } from "../src/locales/world/prompts";
import {
  sanitizeImage,
  imageSignature,
  MAX_IMAGE_BYTES,
} from "../src/lib/world/media";
import { moderationProvider } from "../src/lib/world/moderation";
import { shareModel, renderPersonalShare } from "../src/lib/world/share";
import { worldMessages } from "../src/lib/world/i18n";
import { POST as submit } from "../src/app/api/moments/route";
import { POST as report } from "../src/app/api/moments/report/route";
import { POST as react } from "../src/app/api/moments/react/route";
import { GET as world } from "../src/app/api/world/route";
import { GET as maintenance } from "../src/app/api/maintenance/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("world domain", () => {
  it("rotates one curated prompt per UTC day across a 64-day library", () => {
    expect(prompts).toHaveLength(64);
    expect(new Set(prompts).size).toBe(64);
    const a = dailyPrompt(new Date("2026-10-07T00:00:00Z"));
    expect(a).toEqual(dailyPrompt(new Date("2026-10-07T23:59:59Z")));
    expect(a.id).not.toBe(dailyPrompt(new Date("2026-10-08T00:00:00Z")).id);
    expect(a.id).toBe(
      dailyPrompt(new Date(new Date("2026-10-07").getTime() + 64 * 86400000))
        .id,
    );
  });
  it("searches global cities, aliases, accents, and validates timezones", () => {
    expect(cities.length).toBeGreaterThan(60);
    for (const q of [
      "Tokyo",
      "Mumbai",
      "London",
      "Edmonton",
      "Tehran",
      "Paris",
      "Sao Paulo",
      "Bangalore",
      "東京",
    ])
      expect(searchCities(q).length).toBeGreaterThan(0);
    for (const c of cities)
      expect(
        () => new Intl.DateTimeFormat("en", { timeZone: c.timezone }),
      ).not.toThrow();
    expect(new Set(cities.map((c) => c.id)).size).toBe(cities.length);
  });
  it("suppresses small groups and does not count one person multiple times", () => {
    const now = new Date("2026-10-07T12:00Z");
    const observations = Array.from({ length: 19 }, (_, i) => ({
      person: String(i),
      feeling: "calm" as const,
      at: "2026-10-07T10:00Z",
    }));
    const pulse = calculatePulse("tokyo-jp", observations, now);
    expect(pulse.label).toBe("insufficient");
    expect(pulse.dimensions).toEqual({});
    expect(
      calculatePulse("tokyo-jp", [...observations, ...observations], now)
        .sampleCount,
    ).toBe(19);
    observations.push({
      person: "20",
      feeling: "calm",
      at: "2026-10-07T10:00Z",
    });
    expect(calculatePulse("tokyo-jp", observations, now).label).toBe("calm");
  });
  it("does not invent atmosphere from captions or low dimension coverage", () => {
    const pulse = calculatePulse(
      "london-gb",
      Array.from({ length: 25 }, (_, i) => ({
        person: String(i),
        feeling: null,
        at: "2026-10-07T10:00Z",
      })),
      new Date("2026-10-07T12:00Z"),
    );
    expect(pulse.label).toBe("mixed");
    expect(pulse.dimensions).toEqual({});
  });
  it("excludes stale and future observations", () => {
    expect(
      calculatePulse(
        "london-gb",
        [
          { person: "1", feeling: "calm", at: "2026-10-01T10:00Z" },
          { person: "2", feeling: "calm", at: "2026-10-08T10:00Z" },
        ],
        new Date("2026-10-07T12:00Z"),
      ).sampleCount,
    ).toBe(0);
  });
  it("requires explicit public intent and rejects private payload keys", () => {
    const input = {
      cityId: "tokyo-jp",
      feeling: "calm",
      caption: "A little pause.",
      visibility: "global",
      publicConsent: true,
    };
    expect(momentInput.safeParse(input).success).toBe(true);
    expect(
      momentInput.safeParse({ ...input, publicConsent: false }).success,
    ).toBe(false);
    expect(
      momentInput.safeParse({ ...input, privateJournal: "secret" }).success,
    ).toBe(false);
    expect(
      momentInput.safeParse({ ...input, visibility: "private" }).success,
    ).toBe(false);
  });
  it("enforces moderation, expiry and global discovery scope", () => {
    const now = new Date("2026-10-07T12:00Z");
    const moment = {
      moderation_state: "approved",
      submitted_at: "2026-10-07T10:00Z",
      expires_at: "2026-10-09T10:00Z",
      visibility: "city",
    } as PublicMoment;
    expect(isPublicNow(moment, now)).toBe(true);
    expect(isPublicNow(moment, now, "global")).toBe(false);
    expect(isPublicNow({ ...moment, moderation_state: "pending" }, now)).toBe(
      false,
    );
    expect(isPublicNow({ ...moment, expires_at: now.toISOString() }, now)).toBe(
      false,
    );
  });
  it("share output is derived only from public identifiers and always labels preview", () => {
    const output = shareModel(
      { kind: "city", cityId: "tokyo-jp", preview: true },
      worldMessages("en"),
      new Date("2026-10-07"),
    );
    expect(output.title).toBe("Tokyo");
    expect(output.disclosure).toBe("Product preview");
    expect(Object.keys(output)).toEqual([
      "brand",
      "title",
      "body",
      "disclosure",
      "date",
      "path",
    ]);
  });
});
it("requires explicit consent before rendering a personal share", async () => {
  await expect(
    renderPersonalShare("A personal pattern", false, worldMessages("en")),
  ).rejects.toThrow("Explicit consent");
  await expect(
    renderPersonalShare("x".repeat(501), true, worldMessages("en")),
  ).rejects.toThrow();
});
it("suppresses low coverage dimensions even in a large city sample", () => {
  const p = calculatePulse(
    "tokyo-jp",
    Array.from({ length: 21 }, (_, i) => ({
      person: String(i),
      feeling: i === 20 ? ("tired" as const) : ("calm" as const),
      at: "2026-10-07T10:00Z",
    })),
    new Date("2026-10-07T12:00Z"),
  );
  expect(p.dimensions.calmness).toBe(5);
  expect(p.dimensions).not.toHaveProperty("fatigue");
  expect(p.dimensionCounts).not.toHaveProperty("fatigue");
});
describe("safe media", () => {
  it("strips EXIF, resizes and creates a static WebP derivative", async () => {
    const original = await sharp({
      create: { width: 1800, height: 1600, channels: 3, background: "#abc" },
    })
      .jpeg()
      .withExif({
        IFD0: {
          Artist: "PRIVATE PERSON",
          ImageDescription: "private location",
        },
      })
      .toBuffer();
    const clean = await sanitizeImage(original);
    const metadata = await sharp(clean.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1400);
    expect(clean.data.toString()).not.toContain("PRIVATE PERSON");
  });
  it("rejects SVG, executable bytes, fake images and oversized files", async () => {
    expect(imageSignature(Buffer.from("<svg/>"))).toBeNull();
    await expect(
      sanitizeImage(Buffer.from('<svg onload="alert(1)"/>')),
    ).rejects.toThrow();
    await expect(
      sanitizeImage(Buffer.from([255, 216, 255, 0, 1])),
    ).rejects.toThrow();
    await expect(
      sanitizeImage(new Uint8Array(MAX_IMAGE_BYTES + 1)),
    ).rejects.toThrow();
  });
});
describe("public provider boundaries", () => {
  it("unconfigured, failing or malformed moderation stays pending", async () => {
    vi.stubEnv("MODERATION_URL", "");
    expect(
      (await moderationProvider().review({ caption: "Hi", feeling: "warm" }))
        .state,
    ).toBe("pending");
    vi.stubEnv("MODERATION_URL", "https://moderator.test");
    vi.stubEnv("MODERATION_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"decision":"approved"}')),
    );
    expect(
      (await moderationProvider().review({ caption: "Hi", feeling: "warm" }))
        .state,
    ).toBe("pending");
  });
  it("only accepts a strict configured moderation decision", async () => {
    vi.stubEnv("MODERATION_URL", "https://moderator.test");
    vi.stubEnv("MODERATION_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"decision":"approved","version":"review-1"}'),
        ),
    );
    expect(
      (await moderationProvider().review({ caption: "Hi", feeling: "warm" }))
        .state,
    ).toBe("approved");
  });
  it("anonymous visitors may read an honest empty world", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await world(new Request("https://app.test/api/world"));
    expect(response.status).toBe(200);
    expect((await response.json()).moments).toEqual([]);
  });
  it("posting, reporting and reacting require authenticated access", async () => {
    for (const handler of [submit, report, react]) {
      const response = await handler(
        new Request("https://app.test/api/moments", {
          method: "POST",
          headers: { origin: "https://app.test" },
          body: "{}",
        }),
      );
      expect(response.status).toBe(401);
    }
  });
  it("cross-origin public writes and unconfigured cleanup are denied", async () => {
    expect(
      (
        await submit(
          new Request("https://app.test/api/moments", {
            method: "POST",
            headers: { origin: "https://evil.test" },
          }),
        )
      ).status,
    ).toBe(403);
    vi.stubEnv("CRON_SECRET", "");
    expect(
      (await maintenance(new Request("https://app.test/api/maintenance")))
        .status,
    ).toBe(401);
  });
});
