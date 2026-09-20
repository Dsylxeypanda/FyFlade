import { mockIPC, mockWindows, mockConvertFileSrc } from "@tauri-apps/api/mocks";
import * as channelSettingsTest from "../../src/features/channels/channelSettings";
import * as globalSearchTest from "../../src/features/search/globalSearch";
import * as profilesTest from "../../src/features/profiles/profiles";
import * as layoutTest from "../../src/features/layout/layout";
const searchCalls: string[] = [];
Object.assign(window, { channelSettingsTest, globalSearchTest, profilesTest, layoutTest, searchCalls });

// This entry only runs in the isolated Playwright browser context.
mockWindows("main");
mockConvertFileSrc("windows");
mockIPC((command) => {
  searchCalls.push(command);
  if (command === "load_search_chat_history") {
    return [{ platform: "twitch", channel: "fixtureone", timestampMs: Date.now() - 2000, payloadJson: JSON.stringify({ id: "saved-search-fixture", kind: "chat", userId: "987654", userLogin: "xxpandagaming92xx", username: "xXPandaGaming92Xx", text: "fy flade search fixture rainbow", color: "#aabbcc" }) }];
  }
  if (command.startsWith("plugin:http|")) throw new Error("External HTTP disabled in isolated UI test");
  if (command === "plugin:app|version") return "1.0.0";
  if (command === "plugin:app|name") return "FyFlade";
  if (command.includes("load_") && command.includes("token")) return null;
  if (command.includes("history")) return [];
  if (command.includes("scale_factor")) return 1;
  if (command.includes("size")) return { width: 800, height: 600 };
  if (command.includes("position")) return { x: 0, y: 0 };
  if (command.includes("is_")) return false;
  return null;
}, { shouldMockEvents: true });
await import("../../src/main.tsx");
