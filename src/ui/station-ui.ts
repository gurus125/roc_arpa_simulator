import { Store } from "../train/index";
import { $ } from "./dom";
import { Link } from "./link";

/**
 * The instructor station: the same page opened as `radar-simulator.html#instructor` (or `/instructor` from the
 * classroom server), on the instructor's own PC. It has no student login: it asks for the instructor PIN, then
 * shows the instructor's pages full screen, under their own tabs:
 *
 *   CLASSROOM  every display reporting, with pause, run, messages, weather, faults and exercises sent to them
 *   RECORDS    exercise records, sent by each display when an exercise is finished; replay, reports, assessment
 *   EXERCISES  scoring settings, marking sheets, the self-test of the exercises
 *   BATCHES    batches, students and assignments; the instructor PIN
 *   SCENARIOS  the scenario editor
 *   OWN RADAR  the station's own radar, to prepare a scenario, programme target tracks and start a linked exercise
 *
 * The student displays have no instructor pages at all. The station sends its batches and scoring settings to every
 * display every few seconds, so that the displays' login lists and marking follow the instructor's.
 */
export interface StationUi {
  /** Show the PIN screen (at the start, and after logging out). */
  showLogin: () => void;
}

export interface StationOpts {
  store: Store;
  link: Link;
  role: () => "student" | "instructor";
  setRole: (r: "student" | "instructor") => void;
}

const TABS: { key: string; label: string; sections: string[] }[] = [
  { key: "class", label: "CLASSROOM", sections: ["Monitor other displays", "Send to the displays"] },
  { key: "recs", label: "RECORDS", sections: ["Records, replay and reports"] },
  { key: "ex", label: "EXERCISES", sections: ["Scoring settings (placeholders)", "Marking sheets", "Self-test of the exercises"] },
  { key: "batch", label: "BATCHES", sections: ["Batches, students and assignments", "Instructor access"] },
  { key: "scen", label: "SCENARIOS", sections: ["Scenario editor"] },
  { key: "radar", label: "OWN RADAR", sections: [] },
];

/** How often the station sends its batches and scoring to the displays. */
const CONFIG_EVERY_MS = 5000;

export function initStationUi(o: StationOpts): StationUi {
  document.body.dataset["station"] = "instructor";
  document.title = "Instructor station: ROC / ARPA radar simulator";
  const sub = document.querySelector<HTMLElement>("#brand .sub");
  if (sub) sub.firstChild!.textContent = "Instructor station ";
  $("shipWinKey").hidden = true;

  // The tabs in the header take the place of RADAR / ARPA / EXERCISE.
  const tabs = $("topTabs");
  tabs.innerHTML = TABS.map((t) => `<button data-st="${t.key}">${t.label}</button>`).join("");
  const page = document.createElement("div");
  page.id = "stationPage";
  page.innerHTML = TABS.filter((t) => t.key !== "radar").map((t) => `<div class="stTab" id="stTab_${t.key}" hidden></div>`).join("");
  document.body.insertBefore(page, document.querySelector("footer"));

  // The instructor's sections, from the INSTR menu, into the tabs. "Inject events" stays there: it works on the
  // station's own radar (OWN RADAR, then MENU, INSTR).
  for (const sec of $("paneInstr").querySelectorAll<HTMLElement>("section")) {
    const title = sec.querySelector(":scope > h2")?.textContent?.trim() ?? "";
    const tab = TABS.find((t) => t.sections.includes(title));
    if (tab) $(`stTab_${tab.key}`).appendChild(sec);
  }
  // The classroom: the displays reporting on the left; what can be sent to them (pause and run, an exercise,
  // faults, weather, a linked exercise, a message) in a section of its own beside them.
  {
    const mon = document.getElementById("inStations")?.closest("section");
    const first = document.getElementById("inAllPause")?.closest(".btns");
    if (mon && first) {
      const send = document.createElement("section");
      send.id = "stSend";
      send.innerHTML = "<h2>Send to the displays</h2>";
      for (let el: Element | null = first; el; ) {
        const next: Element | null = el.nextElementSibling;
        send.appendChild(el);
        el = next;
      }
      mon.after(send);
      mon.id = "stDisplays";
    }
  }
  // In each tab the sections keep the order given above.
  for (const t of TABS) {
    const box = document.getElementById(`stTab_${t.key}`);
    if (!box) continue;
    for (const title of t.sections) {
      const sec = [...box.children].find((c) => c.querySelector(":scope > h2")?.textContent?.trim() === title);
      if (sec) box.appendChild(sec);
    }
  }

  let current = "class";
  const show = (key: string): void => {
    current = key;
    for (const b of tabs.querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["st"] === key);
    page.hidden = key === "radar";
    for (const t of TABS) {
      const box = document.getElementById(`stTab_${t.key}`);
      if (box) box.hidden = t.key !== key;
    }
    page.scrollTop = 0;
  };
  tabs.addEventListener("click", (ev) => {
    const key = (ev.target as HTMLElement).closest<HTMLElement>("button")?.dataset["st"];
    if (key) show(key);
  });

  // The PIN screen.
  const login = $("stLogin");
  const pin = $<HTMLInputElement>("stPin");
  const sendConfig = (): void => {
    if (o.role() !== "instructor") return;
    const d = o.store.data;
    o.link.sendConfig({ batches: d.batches, scoring: d.scoring, maxStudentsPerDisplay: d.maxStudentsPerDisplay, targetHoursPerPair: d.targetHoursPerPair });
  };
  const tryLogin = (): void => {
    if (o.store.checkPin(pin.value)) {
      $("stLoginMsg").textContent = "";
      o.setRole("instructor");
      login.hidden = true;
      show(current === "radar" ? "class" : current);
      sendConfig();
    } else $("stLoginMsg").textContent = "Wrong PIN.";
    pin.value = "";
  };
  $("stLoginBtn").addEventListener("click", tryLogin);
  pin.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") tryLogin();
  });
  setInterval(sendConfig, CONFIG_EVERY_MS);

  return {
    showLogin: () => {
      login.hidden = false;
      page.hidden = true;
      pin.focus();
    },
  };
}
