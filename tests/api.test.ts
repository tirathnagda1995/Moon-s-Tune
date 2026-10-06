import { it, expect, vi, afterEach } from "vitest";
import { POST } from "../src/app/api/interpret/route";
import { DELETE } from "../src/app/api/account/route";
import { CompatibleLanguageProvider } from "../src/lib/llm";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("rejects cross-origin AI and deletion requests", async () => {
  expect(
    (
      await POST(
        new Request("https://app.test/api/interpret", {
          method: "POST",
          headers: { origin: "https://evil.test" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await DELETE(
        new Request("https://app.test/api/account", {
          method: "DELETE",
          headers: { origin: "https://evil.test" },
        }),
      )
    ).status,
  ).toBe(403);
});
it("degrades without AI credentials", async () => {
  vi.stubEnv("LLM_API_KEY", "");
  expect(
    (
      await POST(
        new Request("https://app.test/api/interpret", {
          method: "POST",
          headers: { origin: "https://app.test" },
        }),
      )
    ).status,
  ).toBe(503);
});
it("requires authentication for account deletion", async () => {
  expect(
    (
      await DELETE(
        new Request("https://app.test/api/account", {
          method: "DELETE",
          headers: { origin: "https://app.test" },
        }),
      )
    ).status,
  ).toBe(401);
});
it("rejects hallucinated dimensions, invalid JSON and provider errors", async () => {
  vi.stubEnv("LLM_BASE_URL", "https://llm.test/v1");
  const provider = new CompatibleLanguageProvider();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    signals: [
                      { dimension: "diagnosis", value: 5, confidence: 1 },
                    ],
                    language: "en",
                    reflection: "x",
                    safety: "normal",
                  }),
                },
              },
            ],
          }),
        ),
      ),
  );
  await expect(provider.interpret("test", "en")).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
  );
  await expect(provider.interpret("test", "en")).rejects.toThrow();
});
it("accepts minimal multilingual output without filling null dimensions", async () => {
  vi.stubEnv("LLM_BASE_URL", "https://llm.test/v1");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    signals: [
                      {
                        dimension: "emotional_valence",
                        value: 4,
                        confidence: 0.9,
                      },
                    ],
                    language: "hi",
                    reflection: "आज अच्छा लगा।",
                    safety: "normal",
                  }),
                },
              },
            ],
          }),
        ),
      ),
  );
  const result = await new CompatibleLanguageProvider().interpret(
    "आज happy हूँ",
    "hi",
  );
  expect(result.signals).toHaveLength(1);
  expect(result.language).toBe("hi");
});
import { boundedBody, sameOrigin } from "../src/lib/server";
it("bounds request bodies independently of Content-Length", async () => {
  await expect(
    boundedBody(
      new Request("https://app.test", {
        method: "POST",
        body: "x".repeat(20001),
      }),
    ),
  ).rejects.toThrow("Too large");
});
it("matches public host behind a proxy and rejects a foreign origin", () => {
  expect(
    sameOrigin(
      new Request("http://localhost:3000", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).toBe(true);
  vi.stubEnv("APP_URL", "https://moon.example");
  expect(
    sameOrigin(
      new Request("http://localhost:3000", {
        headers: { host: "evil.test", origin: "https://evil.test" },
      }),
    ),
  ).toBe(false);
});
