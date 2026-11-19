import { describe, expect, it } from "vitest";
import { fromPolar } from "../src/core/vec";
import { Scenario, createWorld, inSight, stepWorld, vesselsInSight, visibilityNm } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import {
  ARPA_EXERCISES, ArpaExSession, BACKUP_KIND, Batch, CHART, ExerciseResult, FOG_AT_SEC, FOG_VISIBILITY_NM, LOST_MARGIN, Lookout, MAX_RECORDS, PLACEHOLDER_SCORING, RADAR_EXERCISES, ResultItem, SessionRecord, Store,
  attentionFlags, batchMatrix, batchMatrixHtml, chartX, chartY, checkLogin, exerciseProgress, hasPin, judgeAction, parseTrackText, pinDigest, pinMatches, progressHtml, progressSummary, progressSvg, recordMark,
  relativeCall, traineeKeys, scenarioFromJson, scenarioToJson, sha256Hex, textMark, traineeAttempts, traineeFileHtml, validStudentPin,
} from "../src/train/index";

/*
 * The work of 18 Nov 2026 (third round) that completed four things built only in part: taking back and resetting
 * a trainee's display from the station, visibility, trainee accounts, and the performance history.
 * The expected values are worked by hand in the comments, or come from an independent source that is named.
 */

type Tgt = Scenario["targets"][number];
const ship = (id: number, name: string, brg: number, rng: number, course = 0, speed = 0): Tgt => ({ id, name, kind: "ship", pos: fromPolar(brg, rng), course, speed, rcs: 1, height: 20, events: [] });
const scene = (targets: Tgt[], env: Scenario["env"] = { seaState: 0 }, heading = 0): Scenario => ({ id: "t", name: "t", description: "", own: { heading, speed: 0 }, env, coasts: [], targets });

describe("a track typed for a target on a trainee's display", () => {
  it("reads bearing and range pairs in the order given", () => {
    expect(parseTrackText("045/6, 090/8.5")).toEqual([{ bearing: 45, rangeNm: 6 }, { bearing: 90, rangeNm: 8.5 }]);
    expect(parseTrackText("045 6; 370 2\n-10/1")).toEqual([{ bearing: 45, rangeNm: 6 }, { bearing: 10, rangeNm: 2 }, { bearing: 350, rangeNm: 1 }]);
  });
  it("refuses what it cannot read, a range of nothing, and more than twenty points", () => {
    expect(parseTrackText("")).toBeNull();
    expect(parseTrackText("north/6")).toBeNull();
    expect(parseTrackText("045/0")).toBeNull();
    expect(parseTrackText("045")).toBeNull();
    expect(parseTrackText(Array.from({ length: 21 }, () => "045/6").join(","))).toBeNull();
    expect(parseTrackText(Array.from({ length: 20 }, () => "045/6").join(","))).toHaveLength(20);
  });
});

describe("visibility", () => {
  it("is good unless a figure is set, and then decides who is in sight", () => {
    const w = createWorld(scene([ship(1, "Near", 45, 0.4), ship(2, "Far", 200, 0.6), { ...ship(3, "Buoy", 90, 0.1), kind: "buoy" }]), 60);
    expect(visibilityNm(w)).toBeNull();
    expect(inSight(w, w.targets[0]!)).toBeNull();
    expect(vesselsInSight(w)).toEqual([]);
    w.env.visibilityNm = 0.5;
    // 0.4 NM is inside half a mile, 0.6 is not. A buoy is not a vessel: the look-out does not report it.
    expect(inSight(w, w.targets[0]!)).toBe(true);
    expect(inSight(w, w.targets[1]!)).toBe(false);
    expect(vesselsInSight(w).map((t) => t.name)).toEqual(["Near"]);
    w.env.visibilityNm = 1;
    expect(vesselsInSight(w).map((t) => t.name)).toEqual(["Near", "Far"]);
  });
  it("comes with a scenario, and a scenario file may give it", () => {
    expect(visibilityNm(createWorld(scene([], { seaState: 0, visibilityNm: 0.5 }), 60))).toBe(0.5);
    const round = scenarioFromJson(scenarioToJson(scene([ship(1, "A", 0, 5)], { seaState: 2, visibilityNm: 0.25 })));
    expect("scenario" in round && round.scenario.env.visibilityNm).toBe(0.25);
    for (const bad of [0, -1, 25, "fog"]) {
      const r = scenarioFromJson(JSON.stringify({ ...scene([ship(1, "A", 0, 5)]), env: { visibilityNm: bad } }));
      expect("errors" in r && r.errors.join(" ")).toContain("Visibility must be above 0");
    }
  });
  it("the bearing from the bow, as a look-out calls it", () => {
    expect(relativeCall(0)).toBe("right ahead");
    expect(relativeCall(45)).toBe("Green 45");
    expect(relativeCall(315)).toBe("Red 45");
    expect(relativeCall(-90)).toBe("Red 90");
    expect(relativeCall(180)).toBe("right astern");
    expect(relativeCall(182)).toBe("right astern");
    expect(relativeCall(120)).toBe("Green 120");
  });
  it("the look-out reports a change of visibility, each vessel as she comes into sight, and when she is lost", () => {
    const w = createWorld(scene([ship(1, "Near", 45, 0.4), ship(2, "Far", 200, 3)]), 60);
    const look = new Lookout();
    expect(look.step(w)).toEqual([]);
    w.env.visibilityNm = 0.5;
    expect(look.step(w)).toEqual([
      "BRIDGE: the visibility has closed to 0.5 NM. Rule 19 applies to vessels not in sight.",
      "LOOKOUT: a vessel in sight, bearing 045° (Green 45), about 0.4 NM.",
    ]);
    expect(look.step(w)).toEqual([]);
    // At 0.52 NM she is just beyond the visibility but within a tenth of it: not yet called lost. At 0.6 NM she is.
    expect(LOST_MARGIN).toBe(1.1);
    w.targets[0]!.pos = fromPolar(45, 0.52);
    expect(look.step(w)).toEqual([]);
    w.targets[0]!.pos = fromPolar(45, 0.6);
    expect(look.step(w)).toEqual(["LOOKOUT: the vessel bearing 045° is no longer in sight."]);
    // The visibility opens to 5 NM: both ships are inside it, the nearer first.
    w.env.visibilityNm = 5;
    expect(look.step(w)).toEqual([
      "BRIDGE: the visibility is now 5 NM.",
      "LOOKOUT: 2 vessels in sight: bearing 045° (Green 45), about 0.6 NM; bearing 200° (Red 160), about 3.0 NM.",
    ]);
    delete w.env.visibilityNm;
    expect(look.step(w)).toEqual(["BRIDGE: the visibility is good again."]);
  });
  it("the visibility at the start is in the briefing, so only the vessels in sight are reported then; bearings are called from the bow", () => {
    // Own ship heading 090°: a vessel bearing 045° is 45° on the port bow.
    const w = createWorld(scene([ship(1, "Near", 45, 0.3)], { seaState: 0, visibilityNm: 0.5 }, 90), 60);
    expect(new Lookout().step(w)).toEqual(["LOOKOUT: a vessel in sight, bearing 045° (Red 45), about 0.3 NM."]);
  });
  it("the three exercises in restricted visibility now have one", () => {
    expect(ARPA_EXERCISES.find((e) => e.id === "arpa-9")!.scenario.env.visibilityNm).toBe(0.5);
    expect(RADAR_EXERCISES.find((e) => e.id === "radar-25")!.scenario.env.visibilityNm).toBe(1);
    // Exercise 30: good at the start; the script closes it to 0.8 NM three minutes in.
    const def = RADAR_EXERCISES.find((e) => e.id === "radar-30")!;
    const w = createWorld(def.scenario, 60);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession(def, w, a);
    expect(visibilityNm(w)).toBeNull();
    while (w.time < FOG_AT_SEC + 2) {
      stepWorld(w, 1);
      s.step(w, a);
    }
    expect(FOG_VISIBILITY_NM).toBe(0.8);
    expect(visibilityNm(w)).toBe(0.8);
  });
});

describe("Rule 19(d) in the marking, for a vessel not in sight", () => {
  const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
  const start = () => {
    const w = createWorld(def.scenario, 62);
    const a = new ArpaSystem(w);
    return { w, a, s: new ArpaExSession(def, w, a) };
  };
  it("the first action keeps the visibility and whether each threatening vessel was in sight", () => {
    // Exercise 1: Ship A is 6 NM off, Ship B 9 NM, Ship C 4 NM. With 5 NM of visibility only Ship C is in sight.
    const { w, a, s } = start();
    w.env.visibilityNm = 5;
    s.step(w, a);
    w.own.ordered.course = 40;
    s.step(w, a);
    const m = s.obs.manoeuvre!;
    expect(m.visibilityNm).toBe(5);
    expect(Object.fromEntries(m.threats.map((t) => [t.id, t.inSight]))).toEqual({ 1: false, 2: false, 3: true });
    // In good visibility nothing is said about sight.
    const g = start();
    g.s.step(g.w, g.a);
    g.w.own.ordered.course = 40;
    g.s.step(g.w, g.a);
    expect(g.s.obs.manoeuvre!.visibilityNm).toBeUndefined();
    expect(g.s.obs.manoeuvre!.threats.every((t) => t.inSight === undefined)).toBe(true);
  });
  it("a turn to port for a vessel forward of the beam is a fault only when she was not in sight", () => {
    // A vessel 30° on the starboard bow; own ship turns 40° to port (large enough by Rule 8).
    const judge = (sight: boolean | undefined, restricted: boolean) => {
      const { w, a, s } = start();
      s.obs.manoeuvre = { time: 60, turnDeg: -40, speedFrom: 12, speedTo: 12, threats: [{ id: 1, relBearing: 30, ...(sight === undefined ? {} : { inSight: sight }) }] };
      s.obs.maxTurnDeg = -40;
      return judgeAction(restricted)({ w, a, obs: s.obs, cfg: PLACEHOLDER_SCORING });
    };
    expect(judge(undefined, false).ok).toBe(true);
    expect(judge(true, false).ok).toBe(true);
    const unseen = judge(false, false);
    expect(unseen.ok).toBe(false);
    expect(unseen.detail).toContain("Alteration to port for a vessel forward of the beam (Rule 19(d)(i)).");
    // An exercise that is in restricted visibility throughout judges every vessel by Rule 19(d), as before.
    expect(judge(true, true).ok).toBe(false);
    expect(judge(undefined, true).ok).toBe(false);
  });
  it("with a visibility set and no fog signal sounding, the instructor is told", () => {
    const w = createWorld({ ...scene([]), own: { heading: 0, speed: 12 } }, 60);
    const base = { w, a: new ArpaSystem(w), session: null, running: true, idleSec: 0, pausedSec: 0, route: [] };
    w.env.visibilityNm = 0.5;
    expect(attentionFlags({ ...base, fogSignalOn: false })).toEqual([{ key: "fog-signal", level: 1, text: "Visibility 0.5 NM and no fog signal is being sounded" }]);
    expect(attentionFlags({ ...base, fogSignalOn: true })).toEqual([]);
    expect(attentionFlags(base)).toEqual([]);
    delete w.env.visibilityNm;
    expect(attentionFlags({ ...base, fogSignalOn: false })).toEqual([]);
  });
});

describe("trainee accounts", () => {
  it("SHA-256 gives the published test values, and the same as the platform's own for other texts", async () => {
    // FIPS 180-4 examples: the empty message, "abc", and the 448-bit message that needs two blocks.
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    // Lengths round the block boundaries, a long text, and names in other scripts (two, three and four bytes a character).
    const own = async (t: string): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((x) => x.toString(16).padStart(2, "0")).join("");
    for (const t of ["a".repeat(55), "a".repeat(56), "a".repeat(63), "a".repeat(64), "a".repeat(65), "x".repeat(1000), "José Ñandú", "प्रिया शर्मा", "李小龙", "a😀b"]) expect(sha256Hex(t), t.slice(0, 12)).toBe(await own(t));
  });
  it("a PIN is 4 to 8 digits", () => {
    expect(["1234", "12345678", "0000"].every(validStudentPin)).toBe(true);
    expect(["123", "123456789", "12a4", "", " 1234"].some(validStudentPin)).toBe(false);
  });
  const batch = (pins?: Record<string, string>): Batch => ({ id: "b1", name: "ROC 12", students: ["Asha", "Ravi"], assigned: [], ...(pins ? { pins } : {}) });
  it("only a digest is kept, and it is different for each trainee and batch", () => {
    const d = pinDigest("b1", "Asha", "1234");
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    expect(d).not.toContain("1234");
    expect(pinDigest("b1", "Ravi", "1234")).not.toBe(d);
    expect(pinDigest("b2", "Asha", "1234")).not.toBe(d);
    const b = batch({ Asha: d });
    expect([hasPin(b, "Asha"), hasPin(b, "Ravi")]).toEqual([true, false]);
    expect([pinMatches(b, "Asha", "1234"), pinMatches(b, "Asha", "1235"), pinMatches(b, "Ravi", "1234")]).toEqual([true, false, false]);
  });
  it("a login: the right PIN, a wrong one, and a first login that chooses one", () => {
    const b = batch({ Asha: pinDigest("b1", "Asha", "1234") });
    expect(checkLogin(b, [{ name: "Asha", pin: "1234", again: "" }])).toEqual({ ok: true, newPins: [] });
    expect(checkLogin(b, [{ name: "Asha", pin: "9999", again: "" }])).toEqual({ ok: false, message: "Wrong PIN for Asha. If it is forgotten, the instructor can reset it." });
    // Ravi has no PIN yet: he chooses 4321, typed twice.
    expect(checkLogin(b, [{ name: "Asha", pin: "1234", again: "" }, { name: "Ravi", pin: "4321", again: "4321" }])).toEqual({ ok: true, newPins: [{ name: "Ravi", digest: pinDigest("b1", "Ravi", "4321") }] });
    expect(checkLogin(b, [{ name: "Ravi", pin: "4321", again: "4322" }])).toEqual({ ok: false, message: "Ravi: the two PINs are not the same." });
    expect(checkLogin(b, [{ name: "Ravi", pin: "12", again: "12" }])).toEqual({ ok: false, message: "Ravi: first login. Choose a PIN of 4 to 8 digits." });
    expect(checkLogin(b, [{ name: "Meera", pin: "1234", again: "1234" }])).toEqual({ ok: false, message: "Meera is not in this batch." });
    expect(checkLogin(b, [{ name: "Asha", pin: "1234", again: "" }, { name: "Asha", pin: "1234", again: "" }])).toEqual({ ok: false, message: "The same name is chosen twice." });
    expect(checkLogin(undefined, [{ name: "Asha", pin: "1234", again: "" }])).toEqual({ ok: false, message: "Choose your batch." });
    expect(checkLogin(b, [])).toEqual({ ok: false, message: "Choose your name." });
  });
  it("the store keeps the digest, the instructor's reset takes it away, and a trainee taken off the list loses the account", () => {
    const st = new Store(null);
    const b = st.addBatch("ROC 12")!;
    st.setStudents(b.id, ["Asha", "Ravi"]);
    expect(st.setStudentPin(b.id, "Asha", pinDigest(b.id, "Asha", "1234"))).toBe(true);
    expect(st.setStudentPin(b.id, "Nobody", "x")).toBe(false);
    expect(pinMatches(st.data.batches[0]!, "Asha", "1234")).toBe(true);
    st.setStudentPin(b.id, "Asha", null);
    expect(hasPin(st.data.batches[0]!, "Asha")).toBe(false);
    st.setStudentPin(b.id, "Ravi", pinDigest(b.id, "Ravi", "4321"));
    st.setStudents(b.id, ["Asha"]);
    expect(st.data.batches[0]!.pins).toEqual({});
  });
});

// ---------------------------------------------------------------- records for the history
const item = (id: string, ok: boolean, by?: string): ResultItem => ({ id, label: id, kind: "number", student: "", correct: "", ok, points: ok ? 10 : 0, max: 10, ...(by ? { by } : {}) });
const scored = (percent: number, items: ResultItem[] = []): ExerciseResult => ({ exerciseId: "x", title: "x", simSeconds: 600, items, score: 0, max: 0, percent, passed: null, debrief: [], placeholderNote: "" });
const rec = (id: string, day: string, exerciseId: string, title: string, students: string[], more: Partial<SessionRecord> = {}): SessionRecord => ({
  id, exerciseId, title, kind: "arpa", students, batch: "ROC 12", startedIso: `2026-11-${day}T10:00:00.000Z`, simSeconds: 600, names: {}, coasts: [], frames: [], events: [], result: null, summary: [], ...more,
});
const RECORDS: SessionRecord[] = [
  rec("d", "16", "roc-fix", "ROC: Position fixing", ["Asha"]),
  rec("c", "14", "arpa-6", "ARPA 6: Trial manoeuvre", ["Asha", "Ravi"], {
    result: scored(55, [item("q1", true, "Asha"), item("q2", true, "Asha"), item("q3", false, "Asha"), item("q4", true, "Ravi")]),
    controls: [{ t: 0, name: "Asha" }, { t: 300, name: "Ravi" }], events: [{ t: 400, text: "ATTENTION: x.", instructor: true, flag: 3 }],
    assessor: { decision: "not-yet", name: "Rao", remarks: "" }, assessorBy: { Asha: { decision: "competent", remarks: "" }, Ravi: { decision: "", remarks: "" } },
  }),
  rec("a", "10", "arpa-1", "ARPA 1: Setting up", ["Asha"], { result: scored(40) }),
  rec("b", "12", "arpa-1", "ARPA 1: Setting up", ["Asha"], { result: scored(70), assessor: { decision: "competent", name: "Rao", remarks: "" }, events: [{ t: 100, text: "ATTENTION: x.", instructor: true, flag: 3 }] }),
];

describe("performance history", () => {
  it("one trainee's attempts, oldest first, with what was his or her own", () => {
    const rows = traineeAttempts(RECORDS, "Asha");
    expect(rows.map((r) => [r.recId, r.date.slice(0, 10), r.percent, r.decision])).toEqual([
      ["a", "2026-11-10", 40, ""], ["b", "2026-11-12", 70, "competent"], ["c", "2026-11-14", 55, "competent"], ["d", "2026-11-16", null, ""],
    ]);
    // Alone on the 12th: the one flag of the exercise is hers. In the group on the 14th: 2 of her 3 answers right, and the flag at 06:40 fell in Ravi's time.
    expect(rows[1]).toMatchObject({ alone: true, own: null, flagsNow: 1 });
    expect(rows[2]).toMatchObject({ alone: false, own: { right: 2, items: 3 }, flagsNow: 0 });
    // Ravi: the group's decision stands for him, as he has none of his own; the flag was in his time.
    expect(traineeAttempts(RECORDS, "Ravi")).toEqual([{ recId: "c", date: "2026-11-14T10:00:00.000Z", exerciseId: "arpa-6", title: "ARPA 6: Trial manoeuvre", percent: 55, alone: false, own: { right: 1, items: 1 }, flagsNow: 1, decision: "not-yet" }]);
    expect(traineeAttempts(RECORDS, "Meera")).toEqual([]);
  });
  it("each exercise: attempts, first, best and latest score, and the change between first and latest", () => {
    const ex = exerciseProgress(traineeAttempts(RECORDS, "Asha"));
    expect(ex).toEqual([
      { exerciseId: "arpa-1", title: "ARPA 1: Setting up", attempts: 2, first: 40, best: 70, latest: 70, change: 30, competent: true },
      { exerciseId: "arpa-6", title: "ARPA 6: Trial manoeuvre", attempts: 1, first: 55, best: 55, latest: 55, change: null, competent: true },
      { exerciseId: "roc-fix", title: "ROC: Position fixing", attempts: 1, first: null, best: null, latest: null, change: null, competent: false },
    ]);
    // Four attempts at three exercises. Latest scores 70 and 55: mean 62.5, shown as 63. Competent in two; better at one, worse at none.
    expect(progressSummary(traineeAttempts(RECORDS, "Asha"))).toEqual({ attempts: 4, exercises: 3, meanLatest: 63, competent: 2, improved: 1, fell: 0 });
    // A second attempt that is worse counts as fallen.
    const worse = [...RECORDS, rec("e", "17", "arpa-6", "ARPA 6: Trial manoeuvre", ["Asha"], { result: scored(30) })];
    expect(progressSummary(traineeAttempts(worse, "Asha"))).toMatchObject({ attempts: 5, meanLatest: 50, improved: 1, fell: 1 });
  });
  it("the chart places each scored attempt: evenly across, 0% at the foot and 100% at the head", () => {
    // 640 by 200, with 40 left, 68 right (room for the last value and the name of the pass mark), 16 above and 30 below:
    // the plot runs from x 40 to 572 and from y 16 (100%) to 170 (0%).
    expect(CHART).toEqual({ width: 640, height: 200, left: 40, right: 68, top: 16, bottom: 30 });
    expect([chartX(0, 3), chartX(1, 3), chartX(2, 3), chartX(0, 1)]).toEqual([40, 306, 572, 306]);
    expect([chartY(100), chartY(0), chartY(50)]).toEqual([16, 170, 93]);
    expect(chartY(70)).toBeCloseTo(62.2, 6);
    expect([chartY(120), chartY(-5)]).toEqual([16, 170]);
    // Asha's three scored attempts: 40, 70 and 55 per cent. y = 16 + (1 - p/100) x 154: 108.4, 62.2, 85.3. The unscored fourth is left out.
    const svg = progressSvg(traineeAttempts(RECORDS, "Asha"), 60);
    expect(svg).toContain('points="40.0,108.4 306.0,62.2 572.0,85.3"');
    expect(svg).toContain('aria-label="Score at each of 3 scored attempts, oldest first: first 40%, latest 55%."');
    expect(svg.match(/<circle [^>]*r="4"/g)).toHaveLength(3);
    // The latest value is written at the end of the line. The pass mark of 60% is a rule at y 77.6; its name would sit
    // 8 units from that value (85.3), so it is left to the words under the chart. At 90% (y 31.4) there is room for it.
    expect(svg).toContain('font-weight="600">55%</text>');
    expect(svg).toContain('y1="77.6" y2="77.6"');
    expect(svg).not.toContain(">pass 60%</text>");
    const high = progressSvg(traineeAttempts(RECORDS, "Asha"), 90);
    expect(high).toContain('y1="31.4" y2="31.4"');
    expect(high).toContain('<text x="581" y="35.4" fill="var(--muted, #52514e)">pass 90%</text>');
    expect(svg).toContain("<title>2026-11-12: ARPA 1: Setting up, 70%</title>");
    expect(svg).toContain(">2026-11-10</text>");
    expect(svg).toContain(">2026-11-14</text>");
    // No pass mark: no rule. One point: no line. Nothing scored: no chart.
    expect(progressSvg(traineeAttempts(RECORDS, "Asha"), null)).not.toContain("pass ");
    expect(progressSvg(traineeAttempts(RECORDS, "Asha"), null).match(/<line /g)).toHaveLength(3);
    expect(progressSvg(traineeAttempts(RECORDS, "Ravi"), null)).not.toContain("<polyline");
    expect(progressSvg(traineeAttempts([RECORDS[0]!], "Asha"), 60)).toBe("");
    // A title is text, never markup.
    const odd = progressSvg(traineeAttempts([rec("z", "10", "x", "A <b> & \"C\"", ["Asha"], { result: scored(50) })], "Asha"), null);
    expect(odd).toContain("A &lt;b&gt; &amp; &quot;C&quot;");
    expect(odd).not.toContain("<b>");
  });
  it("the progress of a trainee as a page: figures, chart, each exercise, each attempt", () => {
    const html = progressHtml(traineeAttempts(RECORDS, "Asha"), "Asha", 60);
    expect(html).toContain("<b>Asha</b>: 4 attempts at 3 exercises; mean of the latest scores 63%; found competent in 2; attempted again and better in 1, worse in 0.");
    expect(html).toContain("<svg class=\"viz\"");
    expect(html).toContain("Score at each attempt, oldest first; the rule across the chart is the pass mark, 60%.");
    expect(html).toContain("<td>ARPA 1: Setting up</td><td>2</td><td>40%</td><td>70%</td><td>70%</td><td>+30</td><td>yes</td>");
    expect(html).toContain("<td>55%</td><td>2 of 3 right</td><td>0</td><td>Competent</td>");
    expect(html).toContain("<td>-</td><td>worked alone</td><td>0</td><td>-</td>");
    expect(progressHtml([], "Meera", null)).toContain("No recorded exercise for Meera yet.");
    // The printed trainee file carries it.
    expect(traineeFileHtml(RECORDS, "Asha", html)).toContain("Progress</h2><p><b>Asha</b>: 4 attempts");
  });
  it("two trainees of the same name in different batches are two people", () => {
    const other = rec("z", "09", "arpa-1", "ARPA 1: Setting up", ["Asha"], { batch: "ARPA 3", result: scored(90) });
    const typed = rec("y", "08", "arpa-1", "ARPA 1: Setting up", ["Asha"], { batch: "" });
    expect(traineeKeys([...RECORDS, other, typed])).toEqual([{ name: "Asha", batch: "" }, { name: "Asha", batch: "ARPA 3" }, { name: "Asha", batch: "ROC 12" }, { name: "Ravi", batch: "ROC 12" }]);
    // The Asha of ROC 12 keeps her four attempts; the 90% belongs to the other one.
    expect(traineeAttempts([...RECORDS, other, typed].filter((r) => r.batch === "ROC 12"), "Asha")).toHaveLength(4);
    expect(traineeAttempts([...RECORDS, other, typed].filter((r) => r.batch === "ARPA 3"), "Asha").map((r) => r.percent)).toEqual([90]);
  });
  it("a batch against its exercises: the best score of each trainee, and how many are done", () => {
    const m = batchMatrix(RECORDS, ["Asha", "Ravi", "Meera"], ["arpa-1", "arpa-6", "arpa-9"]);
    expect(m).toEqual([
      { name: "Asha", cells: [{ attempts: 2, best: 70, competent: true }, { attempts: 1, best: 55, competent: true }, { attempts: 0, best: null, competent: false }], done: 2 },
      { name: "Ravi", cells: [{ attempts: 0, best: null, competent: false }, { attempts: 1, best: 55, competent: false }, { attempts: 0, best: null, competent: false }], done: 1 },
      { name: "Meera", cells: [{ attempts: 0, best: null, competent: false }, { attempts: 0, best: null, competent: false }, { attempts: 0, best: null, competent: false }], done: 0 },
    ]);
    const html = batchMatrixHtml(m, [{ id: "arpa-1", label: "ARPA 1" }, { id: "arpa-6", label: "ARPA 6" }, { id: "arpa-9", label: "ARPA 9" }]);
    expect(html).toContain("<tr><td>Asha</td><td><b>70%</b></td><td><b>55%</b></td><td>-</td><td>2 of 3</td></tr>");
    expect(html).toContain("<tr><td>Ravi</td><td>-</td><td>55%</td><td>-</td><td>1 of 3</td></tr>");
    expect(batchMatrixHtml([], [])).toContain("Choose a batch");
  });
});

describe("keeping the records beyond the browser", () => {
  it("a mark of a text: the FNV-1a values published for the empty text and for 'a'", () => {
    expect(textMark("")).toBe("811c9dc5");
    expect(textMark("a")).toBe("e40c292c");
    expect(textMark("foobar")).toBe("bf9cf968");
  });
  it("the mark of a record changes with its contents, and not with the bulk of its replay alone", () => {
    const r = RECORDS[3]!;
    const frame = { t: 0, own: { e: 0, n: 0, hdg: 0, spd: 12, ordC: 0, ordS: 12 }, tg: [], tracks: 0, alarms: [] };
    expect(recordMark({ ...r, assessor: { decision: "not-yet", name: "Rao", remarks: "" } })).not.toBe(recordMark(r));
    expect(recordMark({ ...r, frames: [frame] })).not.toBe(recordMark(r));
    expect(recordMark({ ...r, frames: [frame] })).toBe(recordMark({ ...r, frames: [{ ...frame, t: 10 }] }));
  });
  const full = (id: string, day: string): SessionRecord => rec(id, day, "arpa-1", "ARPA 1: Setting up", ["Asha"], { frames: [{ t: 0, own: { e: 0, n: 0, hdg: 0, spd: 12, ordC: 0, ordS: 12 }, tg: [], tracks: 0, alarms: [] }] });
  const station = (): Store => {
    const st = new Store(null);
    const b = st.addBatch("ROC 12")!;
    st.setStudents(b.id, ["Asha", "Ravi"]);
    st.setStudentPin(b.id, "Asha", pinDigest(b.id, "Asha", "1234"));
    st.data.requireLogin = true;
    st.data.changeoverMin = 5;
    st.data.scoring.passPercent = 60;
    st.addRecord(full("r1", "10"));
    st.addRecord(full("r2", "11"));
    return st;
  };
  it("a backup holds the class and every record; restored in a new browser it brings both, settings included", () => {
    const text = station().backup("2026-11-18T12:00:00.000Z");
    const b = JSON.parse(text) as { kind: string; savedIso: string; records: unknown[]; state: { batches: Batch[] } };
    expect([b.kind, b.savedIso, b.records.length, b.state.batches.length]).toEqual([BACKUP_KIND, "2026-11-18T12:00:00.000Z", 2, 1]);
    expect(text).not.toContain('"pin":');
    const fresh = new Store(null);
    expect(fresh.restore(text)).toEqual({ ok: true, records: 2, batches: 1, settings: true });
    expect(fresh.data.batches[0]!.students).toEqual(["Asha", "Ravi"]);
    expect(pinMatches(fresh.data.batches[0]!, "Asha", "1234")).toBe(true);
    expect([fresh.data.requireLogin, fresh.data.changeoverMin, fresh.data.scoring.passPercent]).toEqual([true, 5, 60]);
    expect(fresh.data.records.map((r) => r.id)).toEqual(["r2", "r1"]);
    // The instructor PIN of the new browser is its own.
    expect(fresh.checkPin("0000")).toBe(true);
    // Read again: nothing more to add.
    expect(fresh.restore(text)).toEqual({ ok: true, records: 0, batches: 0, settings: false });
  });
  it("on a station that has a class, a restore only adds what is missing and never deletes", () => {
    const here = new Store(null);
    const mine = here.addBatch("ARPA 3")!;
    here.data.scoring.passPercent = 75;
    here.addRecord(full("mine", "15"));
    here.addRecord(full("r1", "10"));
    expect(here.restore(station().backup("x"))).toEqual({ ok: true, records: 1, batches: 1, settings: false });
    expect(here.data.batches.map((b) => b.name)).toEqual(["ARPA 3", "ROC 12"]);
    expect(here.data.batches[0]!.id).toBe(mine.id);
    expect(here.data.scoring.passPercent).toBe(75);
    // Newest first: the 15th, the 11th (added), the 10th.
    expect(here.data.records.map((r) => r.id)).toEqual(["mine", "r2", "r1"]);
  });
  it("what is not a backup is refused and changes nothing", () => {
    const st = station();
    expect(st.restore("{not json")).toEqual({ ok: false, error: "This file is not a backup: it could not be read." });
    expect(st.restore(JSON.stringify({ kind: "something-else", state: { batches: [] } }))).toEqual({ ok: false, error: "This file is not a backup of the simulator's records." });
    expect(st.restore(JSON.stringify({ kind: BACKUP_KIND }))).toMatchObject({ ok: false });
    expect([st.data.batches.length, st.data.records.length]).toEqual([1, 2]);
  });
  it("records brought in: those not held are added, the rest and what is not a record are passed over; beyond sixty they are kept in short", () => {
    const st = station();
    expect(st.mergeRecords([full("r2", "11"), full("r3", "12"), { id: "bad" }, null, full("r3", "12")])).toBe(1);
    expect(st.data.records.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
    // A record with no replay goes to the short list.
    expect(st.mergeRecords([rec("old", "01", "arpa-1", "ARPA 1: Setting up", ["Asha"])])).toBe(1);
    expect(st.data.archive!.map((r) => r.id)).toEqual(["old"]);
    // Seventy more with a replay: sixty are kept whole (the newest), the rest in short.
    const many = Array.from({ length: 70 }, (_, i) => ({ ...full(`m${i}`, "20"), startedIso: `2026-12-01T10:${String(i).padStart(2, "0")}:00.000Z` }));
    expect(st.mergeRecords(many)).toBe(70);
    expect(st.data.records).toHaveLength(MAX_RECORDS);
    expect(st.data.records[0]!.id).toBe("m69");
    expect(st.history()).toHaveLength(74);
    expect(st.data.archive!.every((r) => r.frames.length === 0)).toBe(true);
  });
  it("a class taken from the server replaces the batches and settings, and keeps the records and the instructor PIN", () => {
    const from = station();
    const to = new Store(null);
    to.setPin("4711");
    to.addRecord(full("kept", "09"));
    expect(to.applyClassState(JSON.parse(JSON.stringify(from.classState())))).toBe(true);
    expect(to.data.batches.map((b) => b.name)).toEqual(["ROC 12"]);
    expect([to.data.requireLogin, to.data.changeoverMin]).toEqual([true, 5]);
    expect(to.data.records.map((r) => r.id)).toEqual(["kept"]);
    expect(to.checkPin("4711")).toBe(true);
    expect(to.applyClassState({ batches: "no" })).toBe(false);
    expect(to.applyClassState(null)).toBe(false);
  });
});
