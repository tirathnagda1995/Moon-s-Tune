import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { makeSignal } from "../src/lib/domain";
let db: PGlite;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const oid = "10000000-0000-4000-8000-000000000001";
async function asUser(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  return db.query(sql, params);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}'),('${b}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/001_moon_pattern.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("executes migrations; isolates two users across reads, writes, vault and deletion", async () => {
  const entry = {
    id: oid,
    personId: a,
    localDate: "2026-01-01",
    createdAt: "2026-01-01T12:00:00Z",
    timezone: "UTC",
    revision: 1,
    schemaVersion: 1,
    language: "en",
    reflectionCode: "recorded",
    signals: [
      makeSignal("energy_arousal", 4, 1, "SELF_REPORTED", "2026-01-01", "UTC"),
    ],
    lunar: { phase: 0, illumination: 0, age: 0, cycle: 1, version: "test" },
    journal: { version: 1, iv: "iv", salt: "salt", data: "ciphertext" },
  };
  await asUser(a, "select save_observation($1::jsonb)", [
    JSON.stringify(entry),
  ]);
  expect((await asUser(a, "select * from private_journals")).rows).toHaveLength(
    1,
  );
  expect((await asUser(b, "select * from private_journals")).rows).toHaveLength(
    0,
  );
  expect((await asUser(b, "select * from derived_signals")).rows).toHaveLength(
    0,
  );
  expect(
    (await asUser(b, "select list_observations() as entries")).rows,
  ).toEqual([{ entries: [] }]);
  await expect(
    asUser(b, "select save_observation($1::jsonb)", [
      JSON.stringify({ ...entry, revision: 2 }),
    ]),
  ).rejects.toThrow("Unauthorized");
  await asUser(b, "delete from daily_observations where id=$1", [oid]);
  expect(
    (await asUser(a, "select * from daily_observations")).rows,
  ).toHaveLength(1);
  await expect(
    asUser(
      b,
      "insert into private_journals(observation_id,ciphertext) values($1,$2)",
      [oid, "{}"],
    ),
  ).rejects.toThrow();
  await asUser(a, "select save_observation($1::jsonb)", [
    JSON.stringify({ ...entry, revision: 2, journal: null }),
  ]);
  expect((await asUser(a, "select * from private_journals")).rows).toHaveLength(
    0,
  );
  expect(
    (await asUser(a, "select * from observation_revisions")).rows,
  ).toHaveLength(2);
  await asUser(a, "select delete_history()");
  expect((await asUser(a, "select * from derived_signals")).rows).toHaveLength(
    0,
  );
  expect(
    (await asUser(a, "select * from observation_revisions")).rows,
  ).toHaveLength(0);
});
it("enforces consent, durable quotas and withdrawal", async () => {
  expect(
    (await asUser(a, "select claim_ai_request() as allowed")).rows,
  ).toEqual([{ allowed: false }]);
  await asUser(a, "select record_consent($1::jsonb)", [
    JSON.stringify({
      id: crypto.randomUUID(),
      purpose: "OPTIONAL_AI_TEXT_PROCESSING",
      granted: true,
      region: "unspecified",
    }),
  ]);
  for (let i = 0; i < 20; i++)
    expect(
      (await asUser(a, "select claim_ai_request() as allowed")).rows,
    ).toEqual([{ allowed: true }]);
  expect(
    (await asUser(a, "select claim_ai_request() as allowed")).rows,
  ).toEqual([{ allowed: false }]);
  await asUser(a, "select record_consent($1::jsonb)", [
    JSON.stringify({
      id: crypto.randomUUID(),
      purpose: "OPTIONAL_AI_TEXT_PROCESSING",
      granted: false,
      region: "unspecified",
    }),
  ]);
  expect(
    (await asUser(a, "select claim_ai_request() as allowed")).rows,
  ).toEqual([{ allowed: false }]);
});
it("anonymous users cannot access private tables or privileged RPCs", async () => {
  await db.exec("reset role;set role anon;");
  await expect(db.query("select * from daily_observations")).rejects.toThrow();
  await expect(
    db.query("select save_observation($1::jsonb)", ["{}"]),
  ).rejects.toThrow();
});
it("account removal cascades identity, consent and operational quota without affecting another user", async () => {
  await asUser(b, "select record_consent($1::jsonb)", [
    JSON.stringify({
      id: crypto.randomUUID(),
      purpose: "CORE_APP",
      granted: true,
      region: "unspecified",
    }),
  ]);
  await db.exec("reset role;");
  await db.query("delete from auth.users where id=$1", [a]);
  expect(
    (await db.query("select * from profiles where user_id=$1", [a])).rows,
  ).toHaveLength(0);
  expect((await db.query("select * from ai_usage")).rows).toHaveLength(0);
  expect((await asUser(b, "select * from consents")).rows).toHaveLength(1);
});
