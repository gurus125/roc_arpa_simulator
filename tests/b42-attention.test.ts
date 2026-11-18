import { describe, expect, it } from "vitest";
import { fromPolar } from "../src/core/vec";
import { Scenario, createWorld, stepWorld } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import {
  ARPA_EXERCISES, ATTENTION_LIMITS, ArpaExSession, AttentionInput, PLACEHOLDER_SCORING, RADAR_EXERCISES, Recorder, SessionRecord, Store, TSS_28, attentionFlags, bookmarks, controlsShare,
  progressReport, rankFlags, DEFAULT_OBSERVATION_ITEMS,
} from "../src/train/index";

/*
 * What the instructor should look at (the work of 18 Nov 2026 on monitoring several displays at once).
 * The expected values are worked by hand in the comments.
 */

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};
type Tgt = Scenario["targets"][number];
const ship = (id: number, name: string, brg: number, rng: number, course: number, speed: number): Tgt => ({ id, name, kind: "ship", pos: fromPolar(brg, rng), course, speed, rcs: 1, height: 20, events: [] });
const scene = (targets: Tgt[], extra: Partial<Scenario> = {}): Scenario => ({ id: "t", name: "t", description: "", own: { heading: 0, speed: 12 }, env: { seaState: 0 }, coasts: [], targets, ...extra });
const input = (sc: Scenario, more: Partial<AttentionInput> = {}): AttentionInput => {
  const w = createWorld(sc, 62);
  w.radar.controls.tuning = 62;
  return { w, a: new ArpaSystem(w), session: null, running: true, idleSec: 0, pausedSec: 0, route: [], ...more };
};
const keys = (i: AttentionInput): string[] => attentionFlags(i).map((f) => f.key);

describe("vessels about to pass too close", () => {
  it("head on at 1.2 NM, both at 12 kn: closing at 24 kn, so 3 minutes to a passing at 0 NM: look now", () => {
    const f = attentionFlags(input(scene([ship(1, "Tanker", 0, 1.2, 180, 12)])));
    expect(f[0]).toEqual({ key: "risk:1", level: 3, text: "Tanker will pass at 0.00 NM in 3 min" });
  });
  it("the same ship 0.3 NM off is inside the safe distance of 0.5 NM", () => {
    const f = attentionFlags(input(scene([ship(1, "Tanker", 0, 0.3, 180, 12)])));
    expect(f[0]!.key).toBe("inside:1");
    expect(f[0]!.level).toBe(3);
    expect(f[0]!.text).toBe("Tanker is 0.30 NM off, inside the safe distance of 0.5 NM");
  });
  it("head on at 4 NM is 10 minutes off: not urgent yet, but she should be tracked by now", () => {
    const i = input(scene([ship(1, "Tanker", 0, 4, 180, 12)]));
    expect(attentionFlags(i)).toEqual([{ key: "untracked:1", level: 2, text: "Tanker will pass at 0.00 NM in 10 min and is not tracked" }]);
    // Acquired and tracked for a minute: 3.6 NM to go, 9 minutes: nothing to flag.
    const rng = seeded(1);
    i.a!.step(i.w, rng);
    i.a!.acquire(i.w, fromPolar(0, 4));
    while (i.w.time < 60) {
      stepWorld(i.w, 0.5);
      i.a!.step(i.w, rng);
    }
    expect(i.a!.tracks.some((t) => t.truthId === 1 && t.state === "tracking")).toBe(true);
    expect(keys(i)).toEqual([]);
  });
  it("a ship passing 2 NM clear, one going away, and a buoy close by are not flagged", () => {
    // East of own ship by 2 NM on a parallel opposite course: passes 2 NM abeam. Astern and going away. A buoy 0.2 NM off.
    const i = input(scene([ship(1, "Clear", 90, 2, 180, 12), ship(2, "Away", 180, 1, 180, 12), { ...ship(3, "Buoy", 45, 0.2, 0, 0), kind: "buoy" }]));
    expect(keys(i)).toEqual([]);
  });
  it("in a marked exercise the flag says whether action has been taken", () => {
    const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
    const sc = scene([ship(1, "Tanker", 0, 1.2, 180, 12)]);
    const w = createWorld(sc, 62);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession({ ...def, scenario: sc, safeNm: 1 }, w, a);
    const i: AttentionInput = { w, a, session: s, running: true, idleSec: 0, pausedSec: 0, route: [] };
    expect(attentionFlags(i)[0]!.text).toBe("Tanker will pass at 0.00 NM in 3 min: no action taken");
    w.own.ordered.course = 40;
    s.step(w, a);
    expect(attentionFlags(i)[0]!.text).toBe("Tanker will pass at 0.00 NM in 3 min: the action taken is not enough");
    s.finish(w, a);
    expect(attentionFlags(i)).toEqual([]);
  });
});

describe("where the ship is", () => {
  it("0.4 NM to starboard of the route on the radar", () => {
    const i = input(scene([]), { route: [{ e: 0, n: -1 }, { e: 0, n: 10 }] });
    i.w.own.pos = { e: 0.4, n: 2 };
    expect(attentionFlags(i)).toEqual([{ key: "route", level: 2, text: "0.40 NM to starboard of the route" }]);
    i.w.own.pos = { e: 0.2, n: 2 };
    expect(keys(i)).toEqual([]);
  });
  it("in the separation zone, and against the flow of a lane", () => {
    const i = input(scene([], { tss: [TSS_28] }));
    i.w.own.pos = { e: 0.1, n: 3 };
    expect(keys(i)).toEqual(["tss-zone"]);
    // The lane west of the zone carries southbound traffic; own ship heads north in it.
    i.w.own.pos = { e: -1.5, n: 3 };
    expect(keys(i)).toEqual(["tss-against"]);
    i.w.own.pos = { e: 1.5, n: 3 };
    expect(keys(i)).toEqual([]);
  });
  it("land 0.2 NM off while under way", () => {
    const coast = { name: "Island", closed: true, points: [{ e: 0.2, n: -1 }, { e: 2, n: -1 }, { e: 2, n: 1 }, { e: 0.2, n: 1 }] };
    const i = input(scene([], { coasts: [coast] }));
    const f = attentionFlags(i);
    expect(f[0]!.key).toBe("land");
    expect(f[0]!.text).toBe("Land 0.20 NM off and the ship is under way");
  });
});

describe("the display itself", () => {
  it("an alert left unacknowledged for a minute", () => {
    const i = input(scene([]));
    i.w.time = 200;
    i.a!.alarms.push({ key: "lost-3", kind: "lost", text: "Lost target 3. Acquire it again.", raisedAt: 139, acked: false });
    expect(attentionFlags(i)).toEqual([{ key: "alarm:lost-3", level: 2, text: "Alert not acknowledged for 1 min: Lost target 3" }]);
    i.a!.alarms[0]!.acked = true;
    expect(keys(i)).toEqual([]);
  });
  it("controls that may hide echoes", () => {
    const i = input(scene([]));
    i.w.radar.controls.gain = 10;
    i.w.radar.controls.stc = 90;
    expect(keys(i)).toEqual(["gain", "clutter"]);
  });
  it("left alone or paused during an exercise, but not in free practice", () => {
    const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
    const sc = scene([]);
    const w = createWorld(sc, 62);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession({ ...def, scenario: sc }, w, a);
    const base: AttentionInput = { w, a, session: s, running: true, idleSec: ATTENTION_LIMITS.idleSec + 5, pausedSec: 0, route: [] };
    expect(attentionFlags(base).map((f) => f.key)).toEqual(["idle"]);
    expect(attentionFlags({ ...base, running: false, pausedSec: 240 })[0]!.text).toBe("Paused for 4 min");
    expect(attentionFlags({ ...base, session: null })).toEqual([]);
  });
  it("time: two minutes left is a note, time up is a flag", () => {
    const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
    const sc = scene([]);
    const w = createWorld(sc, 62);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession({ ...def, scenario: sc }, w, a, { ...PLACEHOLDER_SCORING, timeLimits: { "arpa-1": 10 } });
    const i: AttentionInput = { w, a, session: s, running: true, idleSec: 0, pausedSec: 0, route: [] };
    w.time = 7 * 60;
    expect(keys(i)).toEqual([]);
    w.time = 8.5 * 60;
    expect(attentionFlags(i)).toEqual([{ key: "time-left", level: 1, text: "2 min left of the time allowed" }]);
    w.time = 13 * 60;
    expect(attentionFlags(i)).toEqual([{ key: "time-up", level: 2, text: "Time is up (3 min over) and the exercise is not finished" }]);
  });
  it("the most urgent first, and never more than six", () => {
    const many = Array.from({ length: 9 }, (_, k) => ship(k + 1, `S${k + 1}`, 0, 0.2 + k * 0.01, 180, 12));
    const i = input(scene(many));
    i.w.radar.controls.gain = 5;
    const f = attentionFlags(i);
    expect(f.length).toBe(6);
    expect(f.every((x) => x.level === 3)).toBe(true);
  });
});

describe("the instructor's list", () => {
  it("ranks by urgency, then by how long each has waited", () => {
    const r = rankFlags([{ level: 1, since: 10, id: "a" }, { level: 3, since: 50, id: "b" }, { level: 2, since: 5, id: "c" }, { level: 3, since: 20, id: "d" }] as { level: 1 | 2 | 3; since: number; id: string }[]);
    expect(r.map((x) => x.id)).toEqual(["d", "b", "c", "a"]);
  });
  it("progress: items done, points so far, the closest vessel and when action was taken", () => {
    const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
    const w = createWorld(def.scenario, 62);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession(def, w, a);
    s.step(w, a);
    const p0 = progressReport(w, s);
    expect(p0.done).toBe(0);
    expect(p0.of).toBe(def.tasks.filter((t) => t.kind !== "outcome").length);
    expect(p0.score).toBe(0);
    expect(p0.actedAt).toBeNull();
    expect(p0.finished).toBeNull();
    // One choice answered right: the points of one question.
    const choice = def.tasks.find((t) => t.kind === "choice");
    if (choice && choice.kind === "choice") {
      s.answer(w, a, choice.id, choice.correct(s.ctx(w, a)));
      expect(progressReport(w, s).score).toBe(PLACEHOLDER_SCORING.points.question);
      expect(progressReport(w, s).done).toBe(1);
    }
    w.time = 90;
    w.own.ordered.course = w.own.ordered.course + 30;
    s.step(w, a);
    expect(progressReport(w, s).actedAt).toBe(90);
    const res = s.finish(w, a);
    expect(progressReport(w, s).finished).toBe(Math.round(res.percent));
    // Outside an exercise there are no points, only the nearest vessel.
    const free = progressReport(w, null);
    expect(free.max).toBeNull();
    expect(free.closest).not.toBeNull();
  });
});

describe("the record", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  it("who was at the controls and for how long: Asha 0 to 300 s and from 500 s, Ravi 300 to 500 s, of 600 s", () => {
    const w = createWorld(scene([]), 62);
    const rec = new Recorder({ exerciseId: "x", title: "X", kind: "arpa", students: ["Asha", "Ravi"], batch: "" }, w, "2026-11-18T10:00:00Z");
    rec.atControls(w, "Asha");
    rec.atControls(w, "Asha"); // said twice: counted once
    w.time = 300;
    rec.atControls(w, "Ravi");
    w.time = 500;
    rec.atControls(w, "Asha");
    rec.rec.simSeconds = 600;
    expect(rec.rec.controls).toEqual([{ t: 0, name: "Asha" }, { t: 300, name: "Ravi" }, { t: 500, name: "Asha" }]);
    expect(controlsShare(rec.rec)).toEqual([{ name: "Asha", seconds: 400 }, { name: "Ravi", seconds: 200 }]);
    expect(rec.rec.events.map((e) => e.text)).toEqual(["Ravi takes the controls.", "Asha takes the controls."]);
  });
  it("bookmarks are the flagged events, in time order", () => {
    const w = createWorld(scene([]), 62);
    const rec = new Recorder({ exerciseId: "x", title: "X", kind: "arpa", students: [], batch: "" }, w, "2026-11-18T10:00:00Z");
    w.time = 400;
    rec.note(w, "ATTENTION: Tanker will pass at 0.10 NM in 5 min: no action taken.", true, 3);
    w.time = 100;
    rec.note(w, "ATTENTION: Alert not acknowledged for 1 min.", true, 2);
    rec.note(w, "Something else.", false);
    expect(bookmarks(rec.rec).map((e) => [e.t, e.flag])).toEqual([[100, 2], [400, 3]]);
  });
  it("what the assessor added at the station stays when the display sends the record again", () => {
    const st = new Store(memory());
    const base = { id: "r1", exerciseId: "x", title: "X", kind: "arpa", students: ["Asha", "Ravi"], batch: "", startedIso: "2026-11-18T10:00:00Z", simSeconds: 600, names: {}, coasts: [], frames: [], events: [], result: null, summary: [] } as SessionRecord;
    st.addRecord(base);
    const kept = st.data.records[0]!;
    kept.assessor = { decision: "competent", remarks: "", name: "Capt. Rao" };
    kept.assessorBy = { Asha: { decision: "competent", remarks: "" }, Ravi: { decision: "not-yet", remarks: "slow to act" } };
    kept.observations = [{ item: DEFAULT_OBSERVATION_ITEMS[0]!, mark: "yes", t: 120, student: "" }];
    st.addRecord({ ...base, debrief: { self: "We acted late.", peer: "", goals: "" } });
    const now = st.data.records[0]!;
    expect(st.data.records.length).toBe(1);
    expect(now.debrief?.self).toBe("We acted late.");
    expect(now.assessor?.name).toBe("Capt. Rao");
    expect(now.assessorBy?.["Ravi"]?.decision).toBe("not-yet");
    expect(now.observations?.length).toBe(1);
  });
  it("the proposed checklist has a dozen distinct items", () => {
    expect(DEFAULT_OBSERVATION_ITEMS.length).toBe(12);
    expect(new Set(DEFAULT_OBSERVATION_ITEMS).size).toBe(12);
  });
  it("the exercises with a route or a scheme carry them for the flags", () => {
    expect(RADAR_EXERCISES.find((e) => e.id === "radar-27")!.route!.length).toBe(4);
    expect(RADAR_EXERCISES.find((e) => e.id === "radar-28")!.scenario.tss!.length).toBe(1);
  });
});
