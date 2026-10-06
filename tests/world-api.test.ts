import { beforeEach, it, expect, vi } from "vitest";
import sharp from "sharp";
const mock = vi.hoisted(() => ({
  authenticated: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../src/lib/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  authenticated: mock.authenticated,
}));
vi.mock("../src/lib/world/server", () => ({
  worldAdmin: () => ({ rpc: mock.adminRpc }),
  mediaStorage: () => ({ put: mock.put, remove: mock.remove }),
}));
vi.mock("../src/lib/world/moderation", () => ({
  moderationProvider: () => ({ review: mock.review }),
}));
import { POST } from "../src/app/api/moments/route";
const input = {
  cityId: "tokyo-jp",
  feeling: "calm",
  caption: "A quiet cup.",
  visibility: "global",
  publicConsent: true,
};
function request(value: unknown) {
  return new Request("https://app.test/api/moments", {
    method: "POST",
    headers: { origin: "https://app.test", "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.authenticated.mockResolvedValue({
    user: { id: "owner-from-verified-token" },
    client: { rpc: mock.rpc },
  });
  mock.rpc.mockResolvedValue({ data: true });
  mock.adminRpc.mockResolvedValue({ data: "moment-id" });
  mock.put.mockResolvedValue(undefined);
  mock.remove.mockResolvedValue(undefined);
  mock.review.mockResolvedValue({
    state: "pending",
    provider: "test",
    version: "1",
    reason: "pending",
  });
});
it("creates authenticated public submissions pending without a publish call", async () => {
  const r = await POST(request(input));
  expect(r.status).toBe(201);
  expect(await r.json()).toEqual({ id: "moment-id", state: "pending" });
  expect(mock.adminRpc).toHaveBeenCalledTimes(1);
  expect(mock.adminRpc).toHaveBeenCalledWith(
    "create_world_moment",
    expect.objectContaining({
      owner_id: "owner-from-verified-token",
      entry: expect.objectContaining(input),
    }),
  );
});
it("only publishes after moderation approves, and fails closed on review-write failure", async () => {
  mock.review.mockResolvedValue({
    state: "approved",
    provider: "test",
    version: "1",
    reason: "reviewed",
  });
  mock.adminRpc
    .mockResolvedValueOnce({ data: "moment-id" })
    .mockResolvedValueOnce({ error: new Error("unavailable") });
  const r = await POST(request(input));
  expect((await r.json()).state).toBe("pending");
  expect(mock.adminRpc).toHaveBeenCalledWith(
    "review_world_moment",
    expect.objectContaining({ decision: "approved", mid: "moment-id" }),
  );
});
it("strips metadata before upload and moderation and does not put bytes in the public row", async () => {
  const original = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#abc" },
  })
    .withExif({ IFD0: { Artist: "PRIVATE METADATA" } })
    .jpeg()
    .toBuffer();
  const r = await POST(
    request({ ...input, image: original.toString("base64") }),
  );
  expect(r.status).toBe(201);
  const bytes = mock.put.mock.calls[0][1];
  expect((await sharp(bytes).metadata()).exif).toBeUndefined();
  expect(mock.review.mock.calls[0][0].image).toBe(bytes);
  expect(mock.adminRpc.mock.calls[0][1].entry).not.toHaveProperty("image");
});
it("quota denial happens before storage or moderation", async () => {
  mock.rpc.mockResolvedValue({ data: false });
  expect((await POST(request(input))).status).toBe(429);
  expect(mock.put).not.toHaveBeenCalled();
  expect(mock.review).not.toHaveBeenCalled();
});
it("rejects private fields and missing explicit consent before doing work", async () => {
  expect(
    (await POST(request({ ...input, privateJournal: "secret" }))).status,
  ).toBe(400);
  expect((await POST(request({ ...input, publicConsent: false }))).status).toBe(
    400,
  );
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("removes an uploaded orphan when the database creation fails", async () => {
  mock.adminRpc.mockResolvedValue({ error: new Error("database down") });
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#abc" },
  })
    .webp()
    .toBuffer();
  expect(
    (await POST(request({ ...input, image: bytes.toString("base64") }))).status,
  ).toBe(400);
  expect(mock.remove).toHaveBeenCalledWith([mock.put.mock.calls[0][0]]);
});
