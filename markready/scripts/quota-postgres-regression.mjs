// Run from markready: node scripts/quota-postgres-regression.mjs
// Starts ONLY a new loopback Postgres cluster from the already installed binaries.
// Applies repository migrations to synthetic data. No production connection or model.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runInThisContext } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tools = path.resolve(root, "../.codex/reliability-tools-20260914/node_modules");
const binaries = path.join(tools, "@embedded-postgres/windows-x64/native/bin");
const { Client } = require(path.join(tools, "pg"));
const { build } = require("esbuild");
const run = promisify(execFile);
const cluster = await mkdtemp(path.resolve(root, "../.codex/reliability-pg-"));
const portServer = createServer();
await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const command = (binary, args) => run(path.join(binaries, `${binary}.exe`), args, { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
const clients = [];
let started = false;
let passed = 0;
async function connect(role) {
  const client = new Client({ host: "127.0.0.1", port, database: "postgres", user: "postgres", connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  clients.push(client);
  if (role) await client.query(`set role ${role}`);
  return client;
}
const call = async (client, name, args) => {
  assert.ok(["scoring_usage", "reserve_scoring", "complete_scoring", "release_scoring"].includes(name));
  const result = await client.query(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as value`, args);
  return result.rows[0].value;
};
const reserve = (client, user) => call(client, "reserve_scoring", [user, "TASK2", "Synthetic question", "Synthetic essay"]);
const complete = (client, user, id) => call(client, "complete_scoring", [user, id, { test: "saved" }, 6.5]);
const release = (client, user, id) => call(client, "release_scoring", [user, id]);
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }

try {
  await command("initdb", ["-D", cluster, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  await command("pg_ctl", ["start", "-D", cluster, "-l", path.join(cluster, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w"]);
  started = true;
  const admin = await connect();
  console.log(`Local ${((await admin.query("select version()")).rows[0].version).split(" on ")[0]}`);
  await admin.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  for (const file of ["0001_init.sql", "0002_target_band.sql", "0003_cohorts.sql", "0004_daily_free_mark.sql"]) {
    await admin.query(await readFile(path.join(root, "supabase/migrations", file), "utf8"));
  }
  const newUser = async (cohort = "user") => {
    const id = randomUUID();
    await admin.query("insert into auth.users (id,email) values ($1,$2)", [id, `${id}@example.test`]);
    await admin.query("update public.profiles set cohort=$2, referral_source='reddit' where id=$1", [id, cohort]);
    return id;
  };
  const historicalUser = await newUser();
  const historical = (await admin.query("insert into public.submissions (user_id,task_type,scores,overall_band) values ($1,'TASK2','{\"legacy\":true}',7) returning id", [historicalUser])).rows[0].id;
  const unfinished = (await admin.query("insert into public.submissions (user_id,task_type) values ($1,'TASK2') returning id", [historicalUser])).rows[0].id;
  await admin.query("begin");
  await admin.query(await readFile(path.join(root, "supabase/migrations/20260914125956_leased_scoring_reservations.sql"), "utf8"));
  await admin.query("commit");
  // Supabase's existing table grants, with service-role RLS bypass.
  await admin.query("grant select,insert,update,delete on all tables in schema public to service_role; grant select on all tables in schema public to authenticated");
  const [a, b] = await Promise.all([connect("service_role"), connect("service_role")]);

  await check("additive migration preserves completed history and ignores legacy unfinished rows", async () => {
    const rows = (await admin.query("select id,scores,reservation_expires_at from public.submissions where user_id=$1", [historicalUser])).rows;
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.find((row) => row.id === historical).scores, { legacy: true });
    assert.equal(rows.find((row) => row.id === unfinished).reservation_expires_at, null);
    assert.equal((await call(a, "scoring_usage", [historicalUser])).active, false);
    assert.equal((await reserve(a, historicalUser)).code, "quota_exhausted");
    assert.equal((await complete(a, historicalUser, unfinished)).code, "reservation_expired");
  });

  await check("two independent connections grant exactly one simultaneous reservation", async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const user = await newUser();
      const slots = await Promise.all([reserve(a, user), reserve(b, user)]);
      assert.equal(slots.filter((slot) => slot.id).length, 1);
      assert.equal(slots.filter((slot) => slot.code === "request_active").length, 1);
      const winner = slots.find((slot) => slot.id);
      assert.equal(await release(a, user, winner.id), true);
      assert.ok((await reserve(b, user)).id);
    }
  });

  await check("completed marks consume quota and conditional release cannot delete them", async () => {
    const user = await newUser();
    const slot = await reserve(a, user);
    assert.ok((await complete(a, user, slot.id)).submission);
    assert.equal(await release(b, user, slot.id), false);
    assert.equal((await reserve(b, user)).code, "quota_exhausted");
    assert.equal((await call(a, "scoring_usage", [user])).used_successful, 1);
    assert.deepEqual((await admin.query("select scores from public.submissions where id=$1", [slot.id])).rows[0].scores, { test: "saved" });
  });

  await check("expired workers cannot complete after replacement or affect another account", async () => {
    const user = await newUser();
    const other = await newUser();
    const stale = await reserve(a, user);
    await admin.query("update public.submissions set reservation_expires_at=clock_timestamp()-interval '1 second' where id=$1", [stale.id]);
    const replacement = await reserve(b, user);
    assert.ok(replacement.id);
    assert.equal((await complete(a, user, stale.id)).code, "reservation_expired");
    assert.equal((await complete(a, other, replacement.id)).code, "reservation_expired");
    assert.equal(await release(a, other, replacement.id), false);
    assert.equal(await release(a, user, stale.id), true);
    assert.ok((await complete(b, user, replacement.id)).submission);
  });

  await check("cross-midnight active work blocks overlap and completed work belongs to its start day", async () => {
    const user = await newUser();
    const slot = await reserve(a, user);
    await admin.query("update public.submissions set created_at=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC' - interval '1 second' where id=$1", [slot.id]);
    await a.query("set timezone='Pacific/Honolulu'");
    const before = await call(a, "scoring_usage", [user]);
    assert.equal(before.used_successful, 0);
    assert.equal(before.active, true);
    assert.equal(new Date(before.reset_at).getUTCHours(), 0);
    assert.equal((await reserve(b, user)).code, "request_active");
    assert.ok((await complete(a, user, slot.id)).submission);
    assert.equal((await call(a, "scoring_usage", [user])).used_successful, 0);
    assert.ok((await reserve(b, user)).id);
  });

  await check("staff remain unlimited even with concurrent work", async () => {
    const user = await newUser("staff");
    const slots = await Promise.all([reserve(a, user), reserve(b, user)]);
    assert.ok(slots.every((slot) => slot.id));
    await complete(a, user, slots[0].id);
    assert.ok((await reserve(b, user)).id);
  });

  await check("all four RPCs are invoker functions executable only by the service role", async () => {
    const functions = (await admin.query("select oid::regprocedure::text as signature, prosecdef from pg_proc where pronamespace='public'::regnamespace and proname in ('scoring_usage','reserve_scoring','complete_scoring','release_scoring')")).rows;
    assert.equal(functions.length, 4);
    for (const fn of functions) {
      assert.equal(fn.prosecdef, false);
      for (const role of ["anon", "authenticated", "service_role"]) {
        const allowed = (await admin.query("select has_function_privilege($1,$2,'execute') as allowed", [role, fn.signature])).rows[0].allowed;
        assert.equal(allowed, role === "service_role");
      }
    }
    const anonymous = await connect("anon");
    await assert.rejects(call(anonymous, "scoring_usage", [historicalUser]), { code: "42501" });
  });

  // Real route code calls the real SQL functions. Only auth and the paid model
  // are synthetic; the small transport adapter replaces PostgREST with pg.
  const score = { exam: "IELTS", criteria: Object.fromEntries(["task_response", "coherence_cohesion", "lexical_resource", "grammatical_range_accuracy"].map((key) => [key, { band: 6.5 }])), weakest_criterion: "task_response", weaknesses: [], vocabulary_upgrades: [], model_paragraph: { original: "Original", rewrite: "Revision" } };
  const state = { user: await newUser(), calls: 0, gate: null, started: null, modelFailure: false, loseCompletion: false, completionFailure: false, usageFailure: false };
  const connections = [a, b];
  let nextConnection = 0;
  const service = () => {
    const db = connections[nextConnection++ % connections.length];
    return {
      rpc(name, args) { return { abortSignal: async () => {
        if (name === "complete_scoring" && state.completionFailure) throw new Error("synthetic completion failure");
        if (name === "scoring_usage" && state.usageFailure) throw new Error("synthetic usage outage");
        const keys = { reserve_scoring: ["p_user_id", "p_task_type", "p_question", "p_essay"], complete_scoring: ["p_user_id", "p_id", "p_scores", "p_overall_band"], release_scoring: ["p_user_id", "p_id"], scoring_usage: ["p_user_id"] };
        const data = await call(db, name, keys[name].map((key) => args[key]));
        if (name === "complete_scoring" && state.loseCompletion) throw new Error("synthetic lost response after commit");
        return { data, error: null };
      } }; },
      from(table) {
        assert.ok(["profiles", "submissions"].includes(table));
        const filters = [];
        return { select() { return this; }, eq(key, value) { assert.ok(["id", "user_id"].includes(key)); filters.push([key, value]); return this; }, abortSignal() { return this; }, async maybeSingle() {
          const result = await db.query(`select * from public.${table} where ${filters.map(([key], index) => `${key}=$${index + 1}`).join(" and ")}`, filters.map(([, value]) => value));
          return { data: result.rows[0] ?? null, error: null };
        } };
      },
    };
  };
  globalThis.__quotaHarness = { service, getUser: () => ({ data: { user: { id: state.user } } }), model: async () => {
    state.calls++;
    state.started?.();
    if (state.gate) await state.gate;
    if (state.modelFailure) throw new Error("synthetic model failure");
    return { choices: [{ message: { content: JSON.stringify(score) }, finish_reason: "stop" }] };
  } };
  const bundled = await build({ absWorkingDir: root, stdin: { contents: "export { POST } from './src/app/api/score/route';", resolveDir: root }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "synthetic-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(openai|@\/lib\/supabase\/(server|service))$/ }, ({ path }) => ({ path, namespace: "mock" }));
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: path === "openai" ? "export default class OpenAI { constructor() { this.chat = { completions: { create: (...args) => globalThis.__quotaHarness.model(...args) } }; } }" : path.endsWith("/service") ? "export const createServiceClient = () => globalThis.__quotaHarness.service();" : "export const createClient = async () => ({ auth: { getUser: () => globalThis.__quotaHarness.getUser() } });", loader: "js" }));
  } }] });
  const routeModule = { exports: {} };
  runInThisContext(`(function(require,module,exports){${bundled.outputFiles[0].text}\n})`)(require, routeModule, routeModule.exports);
  const post = () => routeModule.exports.POST({ json: async () => ({ question: "Synthetic question", essay: "Synthetic response words", taskType: "TASK2" }) });

  await check("two concurrent real route calls produce one model call and one saved score", async () => {
    let releaseModel;
    state.gate = new Promise((resolve) => { releaseModel = resolve; });
    const startedModel = new Promise((resolve) => { state.started = resolve; });
    const requests = [post(), post()];
    try {
      await startedModel;
      const rejected = await Promise.race(requests);
      assert.equal(rejected.status, 409);
      assert.equal((await rejected.json()).code, "request_active");
      assert.equal(state.calls, 1);
    } finally { releaseModel(); }
    assert.deepEqual((await Promise.all(requests)).map((response) => response.status).sort(), [200, 409]);
    assert.equal((await call(a, "scoring_usage", [state.user])).used_successful, 1);
    state.gate = null;
    state.started = null;
  });

  await check("terminal model and persistence failures release actual reservations", async () => {
    for (const failure of ["modelFailure", "completionFailure"]) {
      state.user = await newUser();
      state[failure] = true;
      const response = await post();
      assert.equal(response.status, failure === "modelFailure" ? 502 : 503);
      const usage = await call(a, "scoring_usage", [state.user]);
      assert.equal(usage.active, false);
      assert.equal(usage.used_successful, 0);
      state[failure] = false;
      assert.ok((await reserve(a, state.user)).id);
    }
  });

  await check("a lost completion response recovers the actual saved score without deletion", async () => {
    state.user = await newUser();
    state.loseCompletion = true;
    const response = await post();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).overall_band, 6.5);
    assert.equal((await call(a, "scoring_usage", [state.user])).used_successful, 1);
    state.loseCompletion = false;
  });

  await check("quota outage after commit preserves the saved result with unavailable allowance", async () => {
    state.user = await newUser();
    state.usageFailure = true;
    const response = await post();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.overall_band, 6.5);
    assert.equal(body.allowance_unavailable, true);
    assert.equal(Object.hasOwn(body, "remaining"), false);
    assert.equal((await call(a, "scoring_usage", [state.user])).used_successful, 1);
  });
  console.log(`${passed} local Postgres regressions passed.`);
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
  if (started) await command("pg_ctl", ["stop", "-D", cluster, "-m", "fast", "-w"]);
  delete globalThis.__quotaHarness;
  console.log(`Stopped test cluster retained for inspection: ${cluster}`);
}
