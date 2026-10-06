import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const a = "00000000-0000-4000-8000-000000000011",
  b = "00000000-0000-4000-8000-000000000012";
async function role(name: string, id = "") {
  await db.exec(
    `reset role;set role ${name};select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function create(
  owner = a,
  visibility = "global",
  feeling = "calm",
  media = false,
) {
  await role("service_role");
  const result = await db.query<{ id: string }>(
    "select create_world_moment($1,$2::jsonb,$3::jsonb,$4::jsonb) id",
    [
      owner,
      JSON.stringify({
        cityId: "tokyo-jp",
        feeling,
        caption: "A little quiet.",
        visibility,
        publicConsent: true,
      }),
      media
        ? JSON.stringify({
            path: crypto.randomUUID() + ".webp",
            width: 100,
            height: 100,
            bytes: 500,
          })
        : null,
      JSON.stringify({ provider: "test", reason: "test" }),
    ],
  );
  return result.rows[0].id;
}
async function approve(id: string) {
  await role("service_role");
  await db.query("select review_world_moment($1,$2,$3,$4)", [
    id,
    "approved",
    "test-reviewer",
    "1",
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${a}'),('${b}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/001_moon_pattern.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/002_world_moments.sql", "utf8"),
  );
  await db.exec(
    "create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
  );
  await db.exec(
    readFileSync("supabase/migrations/003_media_bucket.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("keeps pending records and owner mappings hidden, and prevents client approval", async () => {
  const id = await create();
  await role("anon");
  expect((await db.query("select * from public_moments")).rows).toHaveLength(0);
  await expect(db.query("select * from moment_ownership")).rejects.toThrow();
  await role("authenticated", b);
  expect((await db.query("select * from public_moments")).rows).toHaveLength(0);
  await expect(
    db.query("select review_world_moment($1,$2,$3,$4)", [
      id,
      "approved",
      "attacker",
      "1",
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "update public_moments set moderation_state='approved' where id=$1",
      [id],
    ),
  ).rejects.toThrow();
  await role("authenticated", a);
  expect((await db.query("select * from public_moments")).rows).toHaveLength(1);
  await expect(
    db.query("select create_world_moment($1,$2,$3,$4)", [a, "{}", null, "{}"]),
  ).rejects.toThrow();
  await approve(id);
  await role("anon");
  expect((await db.query("select * from world_feed()")).rows).toHaveLength(1);
  await expect(db.query("select * from private_journals")).rejects.toThrow();
});
it("keeps city-only contributions out of global discovery and enforces expiry", async () => {
  const id = await create(a, "city");
  await approve(id);
  await role("anon");
  expect(
    (await db.query("select * from world_feed() where id=$1", [id])).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from world_feed('tokyo-jp') where id=$1", [id]))
      .rows,
  ).toHaveLength(1);
  await role("service_role");
  await db.query(
    "update public_moments set submitted_at=now()-interval '3 days',expires_at=now()-interval '1 day' where id=$1",
    [id],
  );
  await role("anon");
  expect(
    (await db.query("select * from public_moments where id=$1", [id])).rows,
  ).toHaveLength(0);
});
it("reactions toggle without exposing reactors and reports quarantine after three distinct users", async () => {
  const id = await create();
  await approve(id);
  await role("authenticated", b);
  expect(
    (
      await db.query<{ reacted: boolean }>(
        "select react_world_moment($1) reacted",
        [id],
      )
    ).rows[0].reacted,
  ).toBe(true);
  expect(
    (
      await db.query<{ reacted: boolean }>(
        "select react_world_moment($1) reacted",
        [id],
      )
    ).rows[0].reacted,
  ).toBe(false);
  await db.query("select report_world_moment($1,$2)", [id, "privacy"]);
  await db.query("select report_world_moment($1,$2)", [id, "spam"]);
  await role("anon");
  expect(
    (await db.query("select * from public_moments where id=$1", [id])).rows,
  ).toHaveLength(1);
  await expect(db.query("select * from content_reports")).rejects.toThrow();
  for (let i = 20; i < 22; i++) {
    const user = `00000000-0000-4000-8000-0000000000${i}`;
    await role("postgres");
    await db.query("insert into auth.users values($1)", [user]);
    await role("authenticated", user);
    await db.query("select report_world_moment($1,$2)", [id, "harmful"]);
  }
  await role("anon");
  expect(
    (await db.query("select * from public_moments where id=$1", [id])).rows,
  ).toHaveLength(0);
});
it("uses one contributor per city, gates aggregates, and matches deterministic dimensions", async () => {
  const before = await create();
  await approve(before);
  await role("anon");
  const small = (
    await db.query<{ p: { sampleCount: number; dimensions: unknown }[] }>(
      "select world_pulses() p",
    )
  ).rows[0].p;
  expect(small[0].dimensions).toEqual({});
  for (let i = 100; i < 120; i++) {
    const user = `00000000-0000-4000-8000-000000000${i}`;
    await role("postgres");
    await db.query("insert into auth.users values($1)", [user]);
    const id = await create(user);
    await approve(id);
  }
  await role("anon");
  const rows = (
    await db.query<{
      p: {
        sampleCount: number;
        dimensions: { calmness: number };
        dimensionCounts: { calmness: number };
      }[];
    }>("select world_pulses() p")
  ).rows[0].p;
  expect(rows[0].sampleCount).toBe(21);
  expect(rows[0].dimensions.calmness).toBe(5);
  expect(rows[0].dimensionCounts.calmness).toBe(21);
});
it("enforces posting quotas, author deletion and account-media cascades", async () => {
  await role("authenticated", a);
  for (let i = 0; i < 5; i++)
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select claim_world_action('submit') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "select claim_world_action('submit') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
  const id = await create(a, "global", "warm", true);
  await approve(id);
  await role("authenticated", b);
  await expect(
    db.query("select delete_world_moment($1)", [id]),
  ).rejects.toThrow();
  await role("authenticated", a);
  await db.query("select delete_world_moment($1)", [id]);
  await role("service_role");
  expect(
    (await db.query("select * from moment_media where moment_id=$1", [id]))
      .rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from media_deletion_queue")).rows,
  ).toHaveLength(1);
  const second = await create(a, "global", "warm", true);
  await role("postgres");
  await db.query("delete from auth.users where id=$1", [a]);
  expect(
    (await db.query("select * from public_moments where id=$1", [second])).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from media_deletion_queue")).rows,
  ).toHaveLength(2);
});

it("creates a private WebP-only storage bucket", async () => {
  await role("postgres");
  const row = (
    await db.query<{
      public: boolean;
      allowed_mime_types: string[];
      file_size_limit: number;
    }>("select * from storage.buckets where id='moment-quarantine'")
  ).rows[0];
  expect(row.public).toBe(false);
  expect(row.allowed_mime_types).toEqual(["image/webp"]);
  expect(Number(row.file_size_limit)).toBe(3000000);
});
