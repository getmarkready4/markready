// Run from markready: node scripts/score-ui-regression.mjs
// Uses the installed Edge binary, an isolated profile and synthetic auth only.
// The real score page, report and charts are bundled; Next navigation and auth
// are replaced at the bundle boundary. No application server or credentials.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = require("esbuild");
const { chromium, expect } = require(process.env.PLAYWRIGHT_TEST_PATH ?? path.join(root, "../.codex/reliability-browser-tools-20260914/node_modules/@playwright/test"));
const auth = `
  const listeners = new Set();
  let user = { id: 'alice', email: 'alice@example.test' };
  const change = (id) => {
    user = id ? { id, email: id + '@example.test' } : null;
    for (const listener of listeners) listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
  };
  window.changeAccount = (id) => { change(id); localStorage.setItem('synthetic-account', JSON.stringify({ id, nonce: Math.random() })); };
  window.addEventListener('storage', (event) => { if (event.key === 'synthetic-account') change(JSON.parse(event.newValue).id); });
  export const createClient = () => ({ auth: {
    getUser: async () => ({ data: { user } }),
    onAuthStateChange: (callback) => {
      listeners.add(callback);
      queueMicrotask(() => { if (listeners.has(callback)) callback('INITIAL_SESSION', user ? { user } : null); });
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    signOut: async () => window.changeAccount(null),
  } });
`;
const bundle = await build({
  absWorkingDir: root, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  stdin: { contents: `import { createRoot } from 'react-dom/client'; import Page from './src/app/score/page'; createRoot(document.getElementById('root')).render(<Page />);`, resolveDir: root, loader: "tsx" },
  plugins: [{ name: "synthetic-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|@\/lib\/supabase\/client)$/ }, ({ path }) => ({ path, namespace: "mock" }));
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({
      loader: "jsx", resolveDir: root,
      contents: name === "next/link" ? `export default function Link({ children, ...props }) { return <a {...props}>{children}</a>; }` : name === "next/navigation" ? `export const useRouter = () => ({ push: (url) => { window.lastNavigation = url; } });` : auth,
    }));
  } }],
});
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/bundle.js" ? bundle.outputFiles[0].text : '<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
const available = (extra = {}) => ({ cohort: "user", remaining: 1, used_successful: 0, active: false, lease_expires_at: null, reset_at: new Date(Date.now() + 86400000).toISOString(), ...extra });
const spent = () => available({ remaining: 0, used_successful: 1 });
const score = {
  exam: "IELTS", word_count: 250, overall_band: 6, weakest_criterion: "task_response",
  criteria: Object.fromEntries(["task_response", "coherence_cohesion", "lexical_resource", "grammatical_range_accuracy"].map((key) => [key, { band: 6, strengths_noted: "Clear", rationale: "Synthetic test" }])),
  weaknesses: [{ criterion: "task_response", issue: "Develop ideas", quoted_example: "Example", explanation: "Explain", fix: "Support your main idea." }],
  vocabulary_upgrades: [], model_paragraph: { target_band: 8, criterion_improved: "task_response", original: "Example", rewrite: "Example improved", changes_explained: "More detail" }, examiner_summary: "Synthetic saved report",
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
async function run(name, test) {
  const context = await browser.newContext();
  const state = { profile: available(), profileStatus: 200, profileDelay: 0, profileCalls: 0, scoreCalls: [], scoreStatus: 403, scoreBody: { code: "quota_exhausted" }, scoreDelay: 0 };
  const errors = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/profile") {
      state.profileCalls++;
      const body = JSON.stringify(state.profile);
      const status = state.profileStatus;
      await delay(state.profileDelay);
      await route.fulfill({ status, contentType: "application/json", body }).catch(() => {});
    } else if (url.pathname === "/api/score") {
      state.scoreCalls.push(route.request().postDataJSON());
      const body = JSON.stringify(state.scoreBody);
      const status = state.scoreStatus;
      await delay(state.scoreDelay);
      await route.fulfill({ status, contentType: "application/json", body }).catch(() => {});
    } else if (url.hostname === "127.0.0.1") await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => errors.push(error.message));
  const open = () => page.goto(`http://127.0.0.1:${server.address().port}/score`);
  try {
    await test({ page, context, state, open });
    assert.deepEqual(errors, []);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally { await context.close(); }
}
const essay = (page) => page.locator('textarea[rows="16"]');
const submit = (page) => page.getByRole("button", { name: "Get my band score" });
try {
  browser = await chromium.launch({ executablePath: process.env.EDGE_EXECUTABLE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });

  await run("allowance loading, zero, error, malformed and staff stay distinct", async ({ page, state, open }) => {
    state.profileDelay = 250;
    state.profile = spent();
    await open();
    await essay(page).fill("Draft remains editable");
    await expect(submit(page)).toBeDisabled();
    await expect(page.getByText(/Today’s free mark is used/)).toBeVisible();
    state.profileStatus = 500;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "Retry allowance check" })).toBeVisible();
    await expect(submit(page)).toBeDisabled();
    state.profileStatus = 200;
    state.profile = available({ remaining: null });
    await page.getByRole("button", { name: "Retry allowance check" }).click();
    await expect(page.getByRole("button", { name: "Retry allowance check" })).toBeVisible();
    state.profile = available({ cohort: "staff", remaining: null });
    await page.getByRole("button", { name: "Retry allowance check" }).click();
    await expect(submit(page)).toBeEnabled();
    await expect(page.getByText("Staff: unlimited scoring.")).toBeVisible();
  });

  await run("draft reload, task switching and custom chart preserve pairing", async ({ page, open }) => {
    await open();
    await essay(page).fill("Task two draft");
    await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
    await page.locator("select").selectOption("__custom__");
    await page.locator('textarea[rows="4"]').fill("My chart question");
    await essay(page).fill("My chart response");
    await page.locator('input[type="file"]').setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JYQAAAAASUVORK5CYII=", "base64") });
    await expect(page.getByAltText("Attached chart")).toBeVisible();
    await page.reload();
    await expect(essay(page)).toHaveValue("My chart response");
    await expect(page.locator('textarea[rows="4"]')).toHaveValue("My chart question");
    await expect(page.getByAltText("Attached chart")).toBeVisible();
    await page.getByRole("button", { name: "Task 2", exact: true }).click();
    await expect(essay(page)).toHaveValue("Task two draft");
  });

  await run("account changes and same-user reauthentication fence delayed scores", async ({ page, context, state, open }) => {
    await open();
    await essay(page).fill("Alice private draft");
    await expect(submit(page)).toBeEnabled();
    state.scoreStatus = 200;
    state.scoreBody = score;
    state.scoreDelay = 700;
    await submit(page).click();
    await expect.poll(() => state.scoreCalls.length).toBe(1);
    const other = await context.newPage();
    await other.goto(page.url());
    await other.evaluate(() => window.changeAccount("bob"));
    await expect(essay(page)).toHaveValue("");
    await essay(page).fill("Bob private draft");
    await delay(800);
    await expect(page.getByText("Synthetic saved report")).toHaveCount(0);
    await expect(essay(page)).toHaveValue("Bob private draft");
    await page.evaluate(() => window.changeAccount(null));
    await expect(essay(page)).toHaveCount(0);
    await page.evaluate(() => window.changeAccount("alice"));
    await expect(essay(page)).toHaveValue("Alice private draft");
    await page.evaluate(() => window.changeAccount("bob"));
    await expect(essay(page)).toHaveValue("Bob private draft");
  });

  await run("stale profile never grants the next account staff access", async ({ page, state, open }) => {
    state.profile = available({ cohort: "staff", remaining: null });
    state.profileDelay = 650;
    await open();
    await expect.poll(() => state.profileCalls).toBe(1);
    state.profile = spent();
    state.profileDelay = 0;
    await page.evaluate(() => window.changeAccount("bob"));
    await essay(page).fill("Bob draft");
    await expect(page.getByText(/Today’s free mark is used/)).toBeVisible();
    await delay(750);
    await expect(submit(page)).toBeDisabled();
    await expect(page.getByText("Staff: unlimited scoring.")).toHaveCount(0);
  });

  await run("quota rejection stays inline and refreshes allowance", async ({ page, state, open }) => {
    await open();
    await essay(page).fill("Preserve rejected response");
    await expect(submit(page)).toBeEnabled();
    state.profile = spent();
    await submit(page).click();
    await expect(page.getByRole("alert")).toContainText("Today’s free mark has been used");
    await expect(essay(page)).toHaveValue("Preserve rejected response");
    await expect(submit(page)).toBeDisabled();
    assert.equal(await page.evaluate(() => window.lastNavigation), undefined);
    await page.reload();
    await expect(essay(page)).toHaveValue("Preserve rejected response");
  });

  await run("UTC reset, lease expiry and visibility return refresh without losing drafts", async ({ page, state, open }) => {
    await page.clock.install({ time: new Date("2026-09-14T23:59:58Z") });
    state.profile = spent();
    state.profile.reset_at = "2026-09-15T00:00:00Z";
    await open();
    await essay(page).fill("Tomorrow’s draft");
    await expect(page.getByText(/Today’s free mark is used/)).toBeVisible();
    state.profile = available({ reset_at: "2026-09-16T00:00:00Z" });
    await page.clock.runFor(2200);
    await expect(submit(page)).toBeEnabled();
    state.profile = available({ remaining: 0, active: true, lease_expires_at: "2026-09-15T00:00:03Z", reset_at: "2026-09-16T00:00:00Z" });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByText(/A response is already being scored/)).toBeVisible();
    await expect(submit(page)).toBeDisabled();
    state.profile = available({ reset_at: "2026-09-16T00:00:00Z" });
    await page.clock.runFor(3200);
    await expect(submit(page)).toBeEnabled();
    await expect(essay(page)).toHaveValue("Tomorrow’s draft");
  });

  await run("duplicate chart clicks send one chart and repeat practice keeps the draft", async ({ page, state, open }) => {
    state.scoreStatus = 200;
    state.scoreBody = score;
    await open();
    await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
    await essay(page).fill("Chart response to revise");
    await expect(submit(page)).toBeEnabled();
    const question = await page.locator("select").inputValue();
    state.profile = spent();
    await submit(page).evaluate((button) => { button.click(); button.click(); });
    await expect(page.getByRole("button", { name: "Return to my drafts" })).toBeVisible();
    assert.equal(state.scoreCalls.length, 1);
    assert.match(state.scoreCalls[0].image, /^data:image\/jpeg;base64,/);
    assert.equal(state.scoreCalls[0].question, question);
    await page.getByRole("button", { name: "Return to my drafts" }).click();
    await expect(essay(page)).toHaveValue("Chart response to revise");
    await expect(page.locator("select")).toHaveValue(question);
    await expect(page.locator("svg").first()).toBeVisible();
    await expect(submit(page)).toBeDisabled();
  });

  await run("storage failures keep in-memory work and warn visibly", async ({ page, open }) => {
    await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error("Storage full"); }; });
    await open();
    await essay(page).fill("Do not erase this");
    await expect(page.getByRole("alert")).toContainText("copy your response");
    await page.getByRole("button", { name: /Task 1.*General/ }).click();
    await page.getByRole("button", { name: "Task 2", exact: true }).click();
    await expect(essay(page)).toHaveValue("Do not erase this");
  });

  await run("active rejection and expired session preserve the draft inline", async ({ page, state, open }) => {
    await open();
    await essay(page).fill("Pending response");
    await expect(submit(page)).toBeEnabled();
    state.scoreStatus = 409;
    state.scoreBody = { code: "request_active" };
    await submit(page).click();
    await expect(page.getByRole("alert")).toContainText("already being scored");
    await expect(essay(page)).toHaveValue("Pending response");
    await expect(submit(page)).toBeEnabled();
    state.scoreStatus = 401;
    await submit(page).click();
    await expect(page.getByRole("alert")).toContainText("session expired");
    await expect(essay(page)).toHaveValue("Pending response");
    assert.equal(await page.evaluate(() => window.lastNavigation), undefined);
  });

  const holdImages = (page) => page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    const pending = [];
    Object.defineProperty(HTMLImageElement.prototype, "src", { ...descriptor, set(value) { pending.push(() => descriptor.set.call(this, value)); } });
    window.releaseImages = () => {
      Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
      pending.forEach((release) => release());
    };
  });

  for (const existingImage of [false, true]) {
    await run(`same-account delayed upload blocks scoring (${existingImage ? "replacing chart" : "first chart"})`, async ({ page, state, open }) => {
      state.scoreStatus = 200;
      state.scoreBody = score;
      await open();
      await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
      await page.locator("select").selectOption("__custom__");
      await page.locator('textarea[rows="4"]').fill("Selected chart prompt");
      await essay(page).fill("Response about the selected chart");
      await expect(submit(page)).toBeEnabled();
      const file = page.locator('input[type="file"]');
      if (existingImage) {
        await file.setInputFiles({ name: "old.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JYQAAAAASUVORK5CYII=", "base64") });
        await expect(page.getByAltText("Attached chart")).toBeVisible();
      }
      const previous = existingImage ? await page.getByAltText("Attached chart").getAttribute("src") : null;
      const png = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 2;
        const context = canvas.getContext("2d");
        context.fillStyle = "blue";
        context.fillRect(0, 0, 2, 2);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await holdImages(page);
      await file.setInputFiles({ name: "selected.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
      await expect(submit(page)).toBeDisabled();
      await expect(page.getByText(/Preparing your chart/)).toBeVisible();
      await submit(page).evaluate((button) => button.click());
      assert.equal(state.scoreCalls.length, 0);
      await page.evaluate(() => window.releaseImages());
      await expect(submit(page)).toBeEnabled();
      const selected = await page.getByAltText("Attached chart").getAttribute("src");
      assert.notEqual(selected, previous);
      await submit(page).click();
      await expect(page.getByRole("button", { name: "Return to my drafts" })).toBeVisible();
      assert.equal(state.scoreCalls.length, 1);
      assert.equal(state.scoreCalls[0].image, selected);
    });
  }

  await run("sample chart conversion failure releases the submission lock for retry", async ({ page, state, open }) => {
    state.scoreStatus = 200;
    state.scoreBody = score;
    await open();
    await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
    await essay(page).fill("Keep this chart response after conversion fails");
    await expect(submit(page)).toBeEnabled();
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = () => null;
      window.restoreCanvas = () => { HTMLCanvasElement.prototype.getContext = original; };
    });
    await submit(page).click();
    await expect(page.getByRole("alert")).toContainText("Could not attach the chart");
    await expect(essay(page)).toHaveValue("Keep this chart response after conversion fails");
    assert.equal(state.scoreCalls.length, 0);
    await page.evaluate(() => window.restoreCanvas());
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();
    await expect(page.getByRole("button", { name: "Return to my drafts" })).toBeVisible();
    assert.equal(state.scoreCalls.length, 1);
    assert.match(state.scoreCalls[0].image, /^data:image\/jpeg;base64,/);
  });

  await run("account transition discards delayed chart conversion before any score call", async ({ page, state, open }) => {
    await open();
    await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
    await essay(page).fill("Alice chart");
    await expect(submit(page)).toBeEnabled();
    await holdImages(page);
    await submit(page).click();
    await page.evaluate(() => window.changeAccount("bob"));
    await expect(essay(page)).toHaveValue("");
    await page.evaluate(() => window.releaseImages());
    await delay(200);
    assert.equal(state.scoreCalls.length, 0);
    await expect(essay(page)).toHaveValue("");
  });

  await run("account transition discards delayed custom image upload", async ({ page, open }) => {
    await open();
    await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
    await page.locator("select").selectOption("__custom__");
    await holdImages(page);
    await page.locator('input[type="file"]').setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JYQAAAAASUVORK5CYII=", "base64") });
    await page.evaluate(() => window.changeAccount("bob"));
    await expect(essay(page)).toHaveValue("");
    await page.getByRole("button", { name: /Task 1.*Academic/ }).click();
    await page.locator("select").selectOption("__custom__");
    await page.evaluate(() => window.releaseImages());
    await delay(200);
    await expect(page.getByAltText("Attached chart")).toHaveCount(0);
  });
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
if (failures.length) throw new Error(`${failures.length} rendered regression(s) failed: ${failures.join(", ")}`);
