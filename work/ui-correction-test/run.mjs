import { build } from "vite";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { testProfiles } from "./profiles.mjs";
import { testLayouts } from "./layouts.mjs";

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(taskDir, "../..");
const bundledRequire = createRequire("C:/Users/stigm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json");
const { chromium } = bundledRequire("playwright");
const report = { cases: [], errors: [] };
const output = path.join(taskDir, "results");
await mkdir(output, { recursive: true });
let server;
let browser;
try {
  const built = path.join(taskDir, "built");
  await build({ root, configLoader: "runner", clearScreen: false, build: { outDir: built, emptyOutDir: true, rollupOptions: { input: [path.join(taskDir, "index.html"), path.join(taskDir, "status.html")] } } });
  server = createServer(async (request, response) => {
    const relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1:1435").pathname).replace(/^\/+/, "");
    const target = path.resolve(built, relative);
    if (!target.startsWith(`${built}${path.sep}`)) { response.writeHead(403).end(); return; }
    try {
      const bytes = await readFile(target);
      response.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" })[path.extname(target)] || "application/octet-stream" }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(1435, "127.0.0.1", resolve));
  browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 25000 });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "1435") return route.continue();
    return route.abort();
  });
  await context.addInitScript(() => {
    window.WebSocket = class extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 3; close() {} send() {}
    };
    if (localStorage.getItem("ui-fixture-seeded")) return;
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    const fixture = {
      "ui-fixture-seeded": "true",
      "fyflate.onboarding.completed.v1": "true",
      "fyflate.onboarding.lastSeenVersion.v1": "1.0.0",
      "fyflate.onboarding.tutorialEnabled.v1": "false",
      "fyflate.startupIntro.enabled.v1": "false",
      "chatnest.general.autoUpdate.enabled.v1": "false",
      "chatnest.general.language.v1": "en",
      "chatnest.appearance.channelTabPosition.v1": "right",
      "chatnest.appearance.channelTabSize.v1": "compact",
      "chatnest.twitch.channels.v1": JSON.stringify(["fixtureone", "fixturetwo"]),
      "chatnest.twitch.channelCache.v1": JSON.stringify([{ login: "fixtureone", displayName: "Fixture One", profileImageUrl: "" }, { login: "fixturetwo", displayName: "Fixture Two", profileImageUrl: "" }]),
      "fyflate.users.nicknames.v1": JSON.stringify({ "twitch:987654": { platform: "twitch", userId: "987654", userLogin: "xxpandagaming92xx", nickname: "Panda", updatedAt: Date.now() }, "kick:555": { platform: "kick", userId: "555", userLogin: "localonly", nickname: "LocalFriend", updatedAt: Date.now() } }),
      "chatnest.channels.favorites.v1": JSON.stringify(["cached:fixtureone"]),
      "chatnest.channels.manualOrder.v1": JSON.stringify(["cached:fixturetwo", "cached:fixtureone"]),
      "chatnest.youtube.quotaTracker.v1": JSON.stringify({ dayKey: `${parts.year}-${parts.month}-${parts.day}`, usedUnits: 123, exhausted: false, lastAction: "Isolated UI fixture", updatedAt: Date.now() }),
    };
    for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, value);
  });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto("http://127.0.0.1:1435/work/ui-correction-test/index.html", { waitUntil: "domcontentloaded" });
  await page.locator('[data-tutorial-id="settings-button"]').waitFor({ timeout: 25000 });
  await page.waitForTimeout(800);
  report.fixtureInitial = await page.evaluate(() => ({ logins: localStorage.getItem("chatnest.twitch.channels.v1"), channelMarkup: [...document.querySelectorAll("[data-channel-tab-id]")].map(node => node.getAttribute("data-channel-tab-id")) }));
  await page.screenshot({ path: path.join(output, "main-initial.png") });
  report.initial = await page.locator("body").innerText();
  report.buttons = await page.getByRole("button").evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, label: node.getAttribute("aria-label"), title: node.getAttribute("title") })));
  const openChannelSettings = async (id = "cached:fixtureone") => {
    await page.locator(`[data-channel-tab-id="${id}"]`).click({ button: "right" });
    await page.getByRole("button", { name: "Channel Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Channel Settings", exact: true });
    await dialog.waitFor();
    return dialog;
  };
  let channelDialog = await openChannelSettings();
  assert.match(await channelDialog.innerText(), /Fixture One/);
  assert.equal(await channelDialog.getByLabel("Save live chat", { exact: true }).inputValue(), "global");
  await channelDialog.getByLabel("Save live chat", { exact: true }).selectOption("on");
  await channelDialog.getByLabel("Twitch", { exact: true }).selectOption("off");
  await page.screenshot({ path: path.join(output, "channel-settings.png") });
  assert.equal(await channelDialog.getByLabel("Kick", { exact: true }).isDisabled(), true);
  await channelDialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem("chatnest.channels.manualOrder.v1", JSON.stringify(["cached:fixtureone", "cached:fixturetwo"]));
    localStorage.setItem("chatnest.chat.saveLiveHistory.enabled.v1", "false");
  });
  await page.reload();
  channelDialog = await openChannelSettings();
  assert.equal(await channelDialog.getByLabel("Save live chat", { exact: true }).inputValue(), "on");
  assert.equal(await channelDialog.getByLabel("Twitch", { exact: true }).inputValue(), "off");
  await channelDialog.getByLabel("Save live chat", { exact: true }).selectOption("global");
  assert.match(await channelDialog.innerText(), /Global: off/);
  await channelDialog.getByRole("button", { name: "Done", exact: true }).click();
  channelDialog = await openChannelSettings("cached:fixturetwo");
  assert.equal(await channelDialog.getByLabel("Twitch", { exact: true }).inputValue(), "global");
  await channelDialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() => localStorage.setItem("chatnest.chat.saveLiveHistory.enabled.v1", "true"));
  await page.reload();
  channelDialog = await openChannelSettings();
  assert.match(await channelDialog.innerText(), /Global: on/);
  page.once("dialog", dialog => dialog.accept());
  await channelDialog.getByRole("button", { name: "Reset channel settings", exact: true }).click();
  assert.equal(await channelDialog.getByLabel("Twitch", { exact: true }).inputValue(), "global");
  await channelDialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  channelDialog = await openChannelSettings();
  assert.equal(await channelDialog.getByLabel("Twitch", { exact: true }).inputValue(), "global");
  await channelDialog.getByRole("button", { name: "Done", exact: true }).click();
  report.cases.push({ test: "channel right-click, override, global changes, reset, restart, reorder and isolation", result: "passed" });
  await page.evaluate(() => {
    const api = window.channelSettingsTest;
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const settings = { "cached:fixtureone": { saveLiveChat: true, platforms: { twitch: false, kick: true, youtube: false } }, "kick:123": { notifications: false }, "youtube-channel:UC123": { highlights: false } };
    const authenticated = { broadcasterId: "123", login: "fixtureone", platform: "twitch" };
    const next = api.reconcileChannelIdentities(settings, {}, [authenticated]);
    check(next.settings["123"].saveLiveChat === true, "cached overrides migrate on authentication");
    check(!next.settings["cached:fixtureone"], "obsolete cached record removed");
    check(api.channelSettingsId({ ...authenticated, broadcasterId: "cached:fixtureone" }, next.identities) === "123", "restart before authentication resolves stable ID");
    check(api.channelSettingsId({ ...authenticated, login: "renamed" }, next.identities) === "123", "numeric ID survives rename");
    check(next.settings["kick:123"].notifications === false && next.settings["youtube-channel:UC123"].highlights === false, "platform IDs remain separate");
    check(api.channelPlatformValue(next.settings, "123", "twitch") === false && api.channelPlatformValue(next.settings, "123", "kick") === true && api.channelPlatformValue(next.settings, "123", "youtube") === false, "mixed channel platform filters stay independent");
    check(api.channelSettingValue(next.settings, "123", "saveLiveChat", false) === true, "override wins over global off");
    delete next.settings["123"];
    check(api.channelSettingValue(next.settings, "123", "saveLiveChat", false) === false && api.channelSettingValue(next.settings, "123", "saveLiveChat", true) === true, "reset follows current global value");
    const oldSettings = localStorage.getItem(api.CHANNEL_SETTINGS_KEY);
    const oldIdentities = localStorage.getItem(api.CHANNEL_IDENTITIES_KEY);
    try {
      api.writeChannelSettings(next.settings);
      localStorage.setItem(api.CHANNEL_IDENTITIES_KEY, JSON.stringify(next.identities));
      check(api.readChannelSettings()["kick:123"].notifications === false, "persist false override");
      check(api.readChannelIdentities()["cached:fixtureone"] === "123", "persist identity alias");
    } finally {
      for (const [key, value] of [[api.CHANNEL_SETTINGS_KEY, oldSettings], [api.CHANNEL_IDENTITIES_KEY, oldIdentities]]) {
        if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
      }
    }
  });
  report.cases.push({ test: "channel identity migration, platform separation, per-platform filters and persisted inheritance", result: "passed" });
  const channelCount = await page.locator('[data-channel-tab-id]').count();
  const persistedBeforeSearch = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
  const openGlobalSearch = async () => {
    await page.getByRole("button", { name: "Search FyFlade", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search FyFlade", exact: true });
    await dialog.waitFor();
    await dialog.getByText("Local search.", { exact: false }).waitFor();
    return dialog;
  };
  let searchDialog = await openGlobalSearch();
  let searchInput = searchDialog.getByRole("combobox", { name: "Search FyFlade", exact: true });
  await searchInput.fill("fIxTuRe OnE");
  await searchDialog.getByRole("group", { name: "Channels", exact: true }).getByRole("option").first().click();
  assert.equal(await page.locator('[data-channel-tab-id]').count(), channelCount);
  report.cases.push({ test: "global search case-insensitive channel selection does not duplicate tab", result: "passed" });
  searchDialog = await openGlobalSearch();
  searchInput = searchDialog.getByRole("combobox", { name: "Search FyFlade", exact: true });
  const readsBeforeTyping = await page.evaluate(() => window.searchCalls.filter(command => command === "load_search_chat_history").length);
  const networkBeforeTyping = await page.evaluate(() => window.searchCalls.filter(command => command.startsWith("plugin:http|")).length);
  await searchInput.fill("pAnDa");
  let userGroup = searchDialog.getByRole("group", { name: "Users and nicknames", exact: true });
  assert.match(await userGroup.innerText(), /Panda/);
  assert.match(await userGroup.innerText(), /xXPandaGaming92Xx/);
  assert.equal(await userGroup.getByRole("option").count(), 1);
  await searchInput.fill("xxpandagaming92xx");
  assert.equal(await userGroup.getByRole("option").count(), 1);
  await searchInput.fill("rainbow");
  const messageGroup = searchDialog.getByRole("group", { name: "Messages", exact: true });
  assert.match(await messageGroup.innerText(), /Panda.*xXPandaGaming92Xx/);
  assert.match(await messageGroup.innerText(), /Fixture One.*Twitch/);
  assert.equal(await page.evaluate(() => window.searchCalls.filter(command => command === "load_search_chat_history").length), readsBeforeTyping);
  assert.equal(await page.evaluate(() => window.searchCalls.filter(command => command.startsWith("plugin:http|")).length), networkBeforeTyping);
  await messageGroup.getByRole("option").first().click();
  assert.match(await page.getByRole("region", { name: "Message from search" }).innerText(), /rainbow/);
  assert.equal(await page.locator('[data-channel-tab-id]').count(), channelCount);
  await page.getByRole("button", { name: "Close message context" }).click();
  report.cases.push({ test: "nickname and real username resolve same user; saved messages show context; typing causes no history rereads or HTTP", result: "passed" });
  searchDialog = await openGlobalSearch();
  searchInput = searchDialog.getByRole("combobox", { name: "Search FyFlade", exact: true });
  await searchInput.fill("LocalFriend");
  await searchDialog.getByRole("group", { name: "Users and nicknames", exact: true }).getByRole("option").first().click();
  await page.getByText("Local profile", { exact: false }).first().waitFor();
  // Reuse the existing profile; a nickname with no channel does not add a tab.
  assert.equal(await page.locator('[data-channel-tab-id]').count(), channelCount);
  await page.keyboard.press("Escape");
  report.cases.push({ test: "nickname-only user opens existing local profile without creating a channel", result: "passed" });
  // Reload also verifies search has not changed the saved channels or nicknames.
  await page.reload();
  searchDialog = await openGlobalSearch();
  searchInput = searchDialog.getByRole("combobox", { name: "Search FyFlade", exact: true });
  await searchInput.fill("obs");
  const firstActive = await searchInput.getAttribute("aria-activedescendant");
  await searchInput.press("ArrowDown");
  assert.notEqual(await searchInput.getAttribute("aria-activedescendant"), firstActive);
  await searchInput.press("ArrowUp");
  assert.equal(await searchInput.getAttribute("aria-activedescendant"), firstActive);
  await page.screenshot({ path: path.join(output, "global-search.png") });
  await searchInput.fill("quota");
  await searchInput.press("Enter");
  await page.locator('[data-tutorial-id="settings-shell"]').waitFor();
  assert.match(await page.locator('[data-tutorial-id="settings-shell"]').innerText(), /123/);
  assert.match(await page.locator('[data-tutorial-id="settings-shell"]').innerText(), /Quota/);
  await page.reload();
  searchDialog = await openGlobalSearch();
  searchInput = searchDialog.getByRole("combobox", { name: "Search FyFlade", exact: true });
  await searchInput.fill("no-results-xyzxyz");
  await searchDialog.getByText("No results", { exact: true }).waitFor();
  await searchInput.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Search FyFlade", exact: true }).count(), 0);
  for (const key of ["chatnest.twitch.channels.v1", "chatnest.channels.manualOrder.v1", "fyflate.users.nicknames.v1", "fyflate.channels.settings.v1"]) {
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), persistedBeforeSearch[key] ?? null);
  }
  report.cases.push({ test: "global search arrows, Enter settings navigation, empty state, Escape and persistence", result: "passed" });
  await page.evaluate(() => {
    const api = window.globalSearchTest;
    const now = Date.now();
    const channel = { broadcasterId: "123", login: "tester", displayName: "Tester", platform: "twitch", messages: [] };
    const makeRow = (id, timestampMs, text = "uniqueretentionfixture") => ({ platform: "twitch", channel: "tester", timestampMs, payloadJson: JSON.stringify({ id, kind: "chat", username: "Tester", userLogin: "tester", userId: "123", text }) });
    const index = api.buildGlobalSearchIndex([channel], [makeRow("old", now - api.SEARCH_HISTORY_AGE_MS - 1), makeRow("future", now + 60_000), makeRow("valid", now - 1)], {}, "en", now);
    const hits = api.searchGlobalIndex(index, "uniqueretentionfixture", "all", "all", 8, now);
    if (hits.length !== 1 || hits[0].target.message.id !== "valid") throw new Error("history retention or future-date filtering failed");
    if (api.searchGlobalIndex(index, "uniqueretentionfixture", "all", "all", 8, now + api.SEARCH_HISTORY_AGE_MS + 1).length) throw new Error("expired snapshot remained searchable");
    for (const query of ["highl", "markering", "yt", "accessibility"]) if (!api.searchGlobalIndex(index, query).some(result => result.category === "settings")) throw new Error(`Missing settings alias ${query}`);
    if (!api.searchGlobalIndex(index, "obs").some(result => result.category === "help")) throw new Error("Missing tutorial result");
    const many = api.buildGlobalSearchIndex([channel], Array.from({ length: 30 }, (_, i) => makeRow(`recent-${i}`, now - i, "Tester")), {}, "en", now);
    if (api.searchGlobalIndex(many, "Tester").filter(result => result.category === "messages").length !== 8) throw new Error("category limit failed");
    if (api.searchGlobalIndex(many, "Tester")[0].category !== "channels") throw new Error("channel priority failed");
  });
  report.cases.push({ test: "global index retention, bounded categories, priority, Norwegian/English aliases and help", result: "passed" });
  searchDialog = await openGlobalSearch();
  await searchDialog.getByRole("combobox", { name: "Search FyFlade", exact: true }).fill("obs");
  await searchDialog.getByRole("group", { name: "Help", exact: true }).getByRole("option").first().click();
  await page.getByRole("dialog", { name: "Chat on stream", exact: true }).waitFor();
  await page.reload();
  await page.evaluate(() => localStorage.setItem("chatnest.general.language.v1", "no"));
  await page.setViewportSize({ width: 420, height: 520 });
  await page.reload();
  await page.getByRole("button", { name: "Søk i FyFlade", exact: true }).click();
  const narrowSearch = page.getByRole("dialog", { name: "Søk i FyFlade", exact: true });
  await narrowSearch.getByRole("combobox", { name: "Søk i FyFlade", exact: true }).fill("highl");
  await narrowSearch.getByRole("group", { name: "Innstillinger", exact: true }).waitFor();
  const searchBounds = await narrowSearch.boundingBox();
  await page.screenshot({ path: path.join(output, "global-search-narrow-no.png") });
  assert.ok(searchBounds.x >= 0 && searchBounds.x + searchBounds.width <= 420 && searchBounds.y + searchBounds.height <= 520, JSON.stringify(searchBounds));
  await page.keyboard.press("Escape");
  await page.evaluate(() => localStorage.setItem("chatnest.general.language.v1", "en"));
  await page.setViewportSize({ width: 800, height: 600 });
  await page.reload();
  report.cases.push({ test: "global help opens existing tutorial; Norwegian search and narrow layout", result: "passed" });
  const openPalette = async () => {
    await page.locator('[data-tutorial-id="settings-button"]').waitFor();
    await page.locator('[data-channel-tab-id="cached:fixtureone"]').waitFor();
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Quick Commands", exact: true });
    await palette.waitFor();
    return palette;
  };
  let palette = await openPalette();
  let commandInput = palette.getByRole("combobox", { name: "Filter commands" });
  const initialCommand = await commandInput.getAttribute("aria-activedescendant");
  await commandInput.press("ArrowDown");
  assert.notEqual(await commandInput.getAttribute("aria-activedescendant"), initialCommand);
  await commandInput.press("ArrowUp");
  assert.equal(await commandInput.getAttribute("aria-activedescendant"), initialCommand);
  await commandInput.press("Escape");
  assert.equal(await palette.count(), 0);
  report.cases.push({ test: "Ctrl+K opens palette; Up/Down and Escape work", result: "passed" });
  for (const [query, title, expected] of [["INNSTILLINGER", "Open Settings", "General"], ["obs", "Open OBS / Stream", "OBS"], ["ignore", "Open Ignores", "Ignores"], ["kvote", "Open Quota & Usage", "123"], ["accessibility", "Open Accessibility", "Higher contrast"], ["privacy", "Open Data & Privacy", "Local chat history"]]) {
    palette = await openPalette();
    await palette.getByRole("combobox", { name: "Filter commands" }).fill(query);
    await palette.getByRole("option", { name: title, exact: !title.includes("Privacy") }).click();
    assert.equal(await palette.count(), 0);
    const shell = page.locator('[data-tutorial-id="settings-shell"]');
    await shell.waitFor();
    assert.ok((await shell.innerText()).includes(expected), title);
    if (query === "accessibility") {
      const focus = "accessibility";
      await page.waitForFunction(focus => document.activeElement?.getAttribute("data-command-target") === focus, focus);
    }
    if (query === "privacy") {
      const anonymousUsage = page.getByRole("checkbox", { name: "Share anonymous daily usage", exact: true });
      assert.equal(await anonymousUsage.isChecked(), false);
      await anonymousUsage.check();
      assert.equal(await page.evaluate(() => localStorage.getItem("fyflate.privacy.anonymousUsage.enabled.v1")), "true");
      await anonymousUsage.uncheck();
      assert.equal(await page.evaluate(() => localStorage.getItem("fyflate.privacy.anonymousUsage.enabled.v1")), "false");
      assert.equal(await page.evaluate(() => localStorage.getItem("fyflate.privacy.anonymousUsage.lastSentDay.v1")), null);
    }
    await page.reload();
  }
  report.cases.push({ test: "command bilingual aliases and case-insensitive settings, OBS, ignores, quota, accessibility and privacy destinations", result: "passed" });
  report.cases.push({ test: "anonymous usage is opt-in, persists locally and clears its local day marker when disabled", result: "passed" });
  palette = await openPalette();
  commandInput = palette.getByRole("combobox", { name: "Filter commands" });
  await commandInput.fill("Open Fixture One");
  await palette.getByRole("option", { name: "Open Fixture One", exact: true }).waitFor();
  const beforeChannelCommand = await page.locator('[data-channel-tab-id]').count();
  await commandInput.press("Enter");
  await palette.waitFor({ state: "hidden" });
  assert.equal(await palette.count(), 0);
  assert.equal(await page.locator('[data-channel-tab-id]').count(), beforeChannelCommand);
  await page.reload();
  palette = await openPalette();
  assert.match(await palette.getByRole("group", { name: "Recent", exact: true }).innerText(), /Open Fixture One/);
  assert.ok(await palette.getByRole("group", { name: "Recent", exact: true }).getByRole("option").count() <= 5);
  await palette.getByRole("combobox", { name: "Filter commands" }).fill("global search");
  await palette.getByRole("combobox", { name: "Filter commands" }).press("Enter");
  await page.getByRole("dialog", { name: "Search FyFlade", exact: true }).waitFor();
  assert.equal(await palette.count(), 0);
  await page.keyboard.press("Escape");
  palette = await openPalette();
  await page.keyboard.press("Control+Shift+f");
  await page.getByRole("dialog", { name: "Search FyFlade", exact: true }).waitFor();
  assert.equal(await palette.count(), 0);
  await page.keyboard.press("Escape");
  report.cases.push({ test: "Enter activates channel without duplicates; recent commands persist; Global Search command and Ctrl+Shift+F keep dialogs separate", result: "passed" });
  palette = await openPalette();
  await palette.getByRole("combobox", { name: "Filter commands" }).fill("start fyflade tutorial");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Channels", exact: true }).waitFor();
  await page.reload();
  palette = await openPalette();
  await palette.getByRole("combobox", { name: "Filter commands" }).fill("diagnostics");
  await page.keyboard.press("Enter");
  await page.locator('[data-settings-result-id="system-check"]').waitFor();
  palette = await openPalette();
  await palette.getByRole("combobox", { name: "Filter commands" }).fill("run system check");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.searchCalls.includes("check_chat_history_storage"));
  await page.reload();
  report.cases.push({ test: "tutorial, diagnostics navigation and Run System Check reuse existing implementations", result: "passed" });
  palette = await openPalette();
  await palette.getByRole("combobox", { name: "Filter commands" }).fill("youtube account");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-command-target") === "account-youtube");
  const originalSettingsSearch = page.getByRole("textbox", { name: "Search settings", exact: true });
  await originalSettingsSearch.fill("unchanged draft");
  await originalSettingsSearch.press("Control+k");
  assert.equal(await page.getByRole("dialog", { name: "Quick Commands", exact: true }).count(), 0);
  assert.equal(await originalSettingsSearch.inputValue(), "unchanged draft");
  await page.reload();
  await page.setViewportSize({ width: 420, height: 520 });
  palette = await openPalette();
  const paletteBounds = await palette.boundingBox();
  assert.ok(paletteBounds.x >= 0 && paletteBounds.x + paletteBounds.width <= 420 && paletteBounds.y + paletteBounds.height <= 520);
  await page.screenshot({ path: path.join(output, "quick-commands-narrow.png") });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 800, height: 600 });
  report.cases.push({ test: "account command focuses existing card; Ctrl+K preserves text fields; narrow palette fits", result: "passed" });
  await testProfiles(page, openPalette, report, output);
  await testLayouts(page, openPalette, report, output);
  await page.locator('[data-tutorial-id="settings-button"]').click();
  await page.screenshot({ path: path.join(output, "settings-initial.png") });
  const settingsInput = page.getByRole("textbox", { name: "Search settings", exact: true });
  await settingsInput.fill("quota");
  const settingsShell = page.locator('[data-tutorial-id="settings-shell"]');
  await settingsShell.getByRole("button", { name: /Quota & Usage.*View recorded/ }).click();
  assert.equal(await settingsInput.inputValue(), "");
  assert.match(await settingsShell.innerText(), /123/);
  report.cases.push({ test: "existing Settings search still opens correct section independently", result: "passed" });
  report.settings = await page.locator('[data-tutorial-id="settings-shell"]').innerText();
  const seedKeys = ["chatnest.channels.favorites.v1", "chatnest.channels.manualOrder.v1", "chatnest.twitch.channels.v1", "chatnest.youtube.quotaTracker.v1"];
  const snapshot = () => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), seedKeys);
  const before = await snapshot();
  for (const language of ["en", "no"]) {
    if (language === "no") {
      await page.evaluate(() => localStorage.setItem("chatnest.general.language.v1", "no"));
      await page.reload();
      await page.locator('[data-channel-tab-id="cached:fixtureone"]').waitFor();
      await page.locator('[data-tutorial-id="settings-button"]').click();
    }
    const nav = page.locator(`[aria-label="${language === "no" ? "Innstillingssider" : "Settings pages"}"]`);
    const buttons = nav.getByRole("button");
    assert.equal(await buttons.count(), 14, `${language}: all existing settings routes plus Profiles reachable`);
    const labels = await buttons.allTextContents();
    for (let index = 0; index < labels.length; index++) {
      await buttons.nth(index).click();
      assert.equal(await buttons.nth(index).getAttribute("aria-current"), "page");
    }
    const advanced = page.getByRole("checkbox", { name: language === "no" ? "Avansert" : "Advanced", exact: true });
    await advanced.check();
    assert.equal(await buttons.count(), 14);
    await advanced.uncheck();
    assert.equal(await buttons.count(), 14);
    await nav.getByRole("button", { name: language === "no" ? "Kvote og bruk" : "Quota & Usage" }).click();
    const quota = await page.locator('[data-tutorial-id="settings-shell"]').innerText();
    assert.match(quota, /123\s*\/\s*10[ ,.\u00a0]?000/);
    assert.match(quota, /Isolated UI fixture/);
    await page.screenshot({ path: path.join(output, `quota-${language}.png`) });
    report.cases.push({ test: "settings navigation and real quota source", language, routes: labels.map(label => label.trim()), measuredUnits: 123, result: "passed" });
  }
  await page.reload();
  await page.locator('[data-channel-tab-id="cached:fixtureone"]').waitFor();
  assert.deepEqual(await snapshot(), before, "Fixture quota, favorites, order, saved channels survive reload");
  report.cases.push({ test: "isolated saved data survives reload", result: "passed" });

  const bounds = async (locator) => locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  const fits = (r, label) => assert.ok(r.x >= -0.5 && r.y >= -0.5 && r.right <= r.viewportWidth + 0.5 && r.bottom <= r.viewportHeight + 0.5, `${label}: ${JSON.stringify(r)}`);
  for (const position of ["right", "left", "top", "bottom"]) {
    await page.setViewportSize({ width: 420, height: 520 });
    await page.evaluate(position => { localStorage.setItem("chatnest.appearance.channelTabPosition.v1", position); localStorage.setItem("chatnest.general.language.v1", "en"); }, position);
    await page.reload();
    await page.locator('[data-channel-tab-id="cached:fixtureone"]').waitFor();
    const controls = page.getByTestId("connection-settings-controls");
    const status = controls.getByRole("group", { name: "Connection status", exact: true });
    const gear = controls.locator('[data-tutorial-id="settings-button"]');
    const trigger = status.getByRole("button").first();
    assert.equal(await status.getByRole("button").count(), 3);
    const statusBounds = await bounds(status);
    const gearBounds = await bounds(gear);
    fits(statusBounds, `${position} group`); fits(gearBounds, `${position} settings`);
    assert.ok(Math.abs(statusBounds.right - gearBounds.x) <= 3, "Indicators directly beside Settings");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Connection status", exact: true });
    await dialog.waitFor();
    fits(await bounds(dialog), `${position} popover`);
    await page.screenshot({ path: path.join(output, `main-${position}-narrow.png`) });
    await page.keyboard.press("Escape");
    assert.equal(await dialog.count(), 0);
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    await gear.click();
    assert.equal(await page.locator('[data-tutorial-id="settings-shell"]').count(), 1);
    report.cases.push({ test: "narrow App footer and popover", position, statusBounds, gearBounds, result: "passed" });
  }
  const expected = { connected: ["Connected", "rgb(87, 199, 111)"], connecting: ["Connecting…", "rgb(228, 189, 85)"], reconnecting: ["Reconnecting…", "rgb(228, 189, 85)"], "sign-in": ["Sign in again", "rgb(255, 130, 122)"], unavailable: ["Service unavailable", "rgb(255, 130, 122)"], disconnected: ["Connection lost", "rgb(133, 138, 148)"], offline: ["No internet connection", "rgb(255, 130, 122)"], "not-connected": ["Not connected", "rgb(133, 138, 148)"] };
  for (const position of ["right", "left", "top", "bottom"]) {
    for (const states of [["connected", "reconnecting", "sign-in"], ["unavailable", "offline", "not-connected"], ["connecting", "disconnected", "connected"]]) {
      await page.goto(`http://127.0.0.1:1435/work/ui-correction-test/status.html?position=${position}&states=${states.join(",")}`);
      const buttons = page.getByRole("group", { name: "Connection status", exact: true }).getByRole("button");
      await buttons.first().waitFor();
      for (let index = 0; index < 3; index++) {
        assert.ok((await buttons.nth(index).getAttribute("aria-label")).includes(expected[states[index]][0]));
        const color = await buttons.nth(index).locator("span[style*='border-radius: 50%']").evaluate(element => getComputedStyle(element).backgroundColor);
        assert.equal(color, expected[states[index]][1]);
      }
      await buttons.first().click();
      const dialog = page.getByRole("dialog", { name: "Connection status", exact: true });
      fits(await bounds(dialog), `${position} standalone dialog`);
      await page.keyboard.press("Escape");
      assert.equal(await buttons.first().evaluate(element => element === document.activeElement), true);
      report.cases.push({ test: "isolated status labels/colors, bounds and keyboard", position, states, result: "passed" });
    }
  }
  assert.deepEqual(report.errors, [], "No uncaught browser runtime errors");
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.fatal = error.stack || String(error);
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.error(report.fatal);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
