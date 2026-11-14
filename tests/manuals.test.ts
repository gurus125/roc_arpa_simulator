import { describe, expect, it } from "vitest";
import user from "../docs/USER-MANUAL.md?raw";
import instr from "../docs/INSTRUCTOR-MANUAL.md?raw";
import readme from "../README.md?raw";
import consoleUi from "../src/ui/console-ui.ts?raw";
import shipWin from "../src/ui/ship-window.ts?raw";
import station from "../src/ui/station-ui.ts?raw";
import instrUi from "../src/ui/instructor-ui.ts?raw";
import page from "../src/ui/index.template.html?raw";

/**
 * The manuals and the screens kept in step. The names of the keys, tabs, panels and boxes are read from the
 * source of the screens, and every one must be in the manual that describes it; names the screens no longer
 * have must not be in the manuals. (The page itself is checked by scripts/screen-test.mjs.)
 */
const plain = (s: string): string => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

describe("the learner's manual names every key, tab, panel and box of the screens", () => {
  it("every key of the menu that a student display has", () => {
    const keys = [...consoleUi.matchAll(/\{ key: "([a-z]+)", label: "([^"]+)"[^}]*\}/g)]
      .filter((m) => !/instructor: true/.test(m[0]) && m[1] !== "instr")
      .map((m) => m[2]!);
    expect(keys.length).toBe(16);
    for (const k of keys) expect(user, `menu key ${k}`).toContain(k);
  });
  it("the six data panels beside the picture", () => {
    const panels = [...consoleUi.matchAll(/<span class="ttl">(.*?)<\/span><(?:span id|\/h3)/g)].map((m) => plain(m[1]!));
    expect(panels).toEqual(["PICTURE & RADAR CONTROL", "GAIN / CLUTTER", "EBL / CURSOR", "OWN SHIP DATA", "TARGET DATA", "VRM / ARPA"]);
    for (const p of panels) expect(user, `panel ${p}`).toContain(p);
  });
  it("the tabs of the header, and the ship control key", () => {
    const tabs = [...page.matchAll(/<button data-top="[a-z]+"[^>]*>([A-Z ]+)<\/button>/g)].map((m) => m[1]!);
    expect(tabs).toEqual(["RADAR", "ARPA", "EXERCISE"]);
    for (const t of tabs) expect(user, `tab ${t}`).toContain(`**${t}**`);
    expect(page).toContain(">SHIP CONTROL</button>");
    expect(user).toContain("**SHIP CONTROL**");
  });
  it("the boxes of the ship control window", () => {
    const boxes = [...shipWin.matchAll(/<h3><i class="ico">\$\{ICON\.[a-z]+\}<\/i>([A-Z &;]+?)(?:<|$)/gm)].map((m) => plain(m[1]!));
    expect(boxes).toEqual(["STEERING", "ENGINE TELEGRAPH", "OWN SHIP DATA", "EXERCISE"]);
    for (const b of boxes) expect(user, `ship window box ${b}`).toContain(`**${b}**`);
  });
});

describe("the instructor's manual names every tab and section of the instructor station", () => {
  const tabs = [...station.matchAll(/\{ key: "[a-z]+", label: "([A-Z ]+)", sections: \[([^\]]*)\] \}/g)];
  it("every tab", () => {
    expect(tabs.map((m) => m[1])).toEqual(["CLASSROOM", "RECORDS", "EXERCISES", "BATCHES", "SCENARIOS", "OWN RADAR"]);
    for (const t of tabs) expect(instr, `station tab ${t[1]}`).toContain(`| ${t[1]} |`);
  });
  it("every section the tabs hold exists on the station's pages", () => {
    const sections = tabs.flatMap((m) => [...m[2]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!));
    // "Send to the displays" is made by the station itself from the monitor's keys.
    for (const s of sections) expect(s === "Send to the displays" ? station : instrUi, `section ${s}`).toContain(s === "Send to the displays" ? s : `<h2>${s}</h2>`);
  });
  it("the keys and boxes the manual quotes are on the station's pages", () => {
    const quoted = ["Records, replay and reports", "Scoring settings (placeholders)", "Marking sheets", "Self-test of the exercises", "Scenario editor",
      "Batches, students and assignments", "Inject events (this display)", "Faults to send", "Set this weather on all", "Start this exercise on all displays",
      "Send these faults to all displays", "Programme a track", "Set track", "Take off track", "Undo point", "Show target tracks on this display",
      "Take exercise back 2 min", "Alter target now", "Add target now", "Start a LINKED exercise on all displays"];
    for (const q of quoted) {
      expect(instr.replace(/\s+/g, " "), `manual quotes "${q}"`).toContain(q);
      expect(instrUi, `station has "${q}"`).toContain(q);
    }
  });
});

describe("no names the screens no longer have", () => {
  const gone: [RegExp, string][] = [
    [/\b(Radar|ARPA|Instructor|ROC exercises|ARPA exercises)(\*\*)? tab\b/, "the old tabs of the side panel"],
    [/\bDISPLAY box\b/, "the old DISPLAY box"],
    [/\bINSTR key\b/, "the INSTR key on a display"],
    [/(?<!INSTR or )\bFAULTS key\b/, "the FAULTS key on a display"],
    [/\bInstructor page\b/i, "the old instructor page in the menu"],
    [/\bHELP (key|is pressed)\b|Press HELP/, "the old HELP key (now ?)"],
    [/\bcorners? of the picture\b/i, "text in the corners of the picture"],
    [/DGS approved/i, "a claim of approval"],
  ];
  for (const [name, text] of [["USER-MANUAL", user], ["INSTRUCTOR-MANUAL", instr], ["README", readme]] as const) {
    it(name, () => {
      for (const [re, what] of gone) expect(text, `${name}: ${what}`).not.toMatch(re);
    });
  }
  it("and the page says it is not type approved and not for navigation", () => {
    expect(page).toMatch(/not type approved &middot; not for navigation/);
    expect(page).not.toMatch(/DGS Approved/i);
  });
});
