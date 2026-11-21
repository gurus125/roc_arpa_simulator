import { ArpaSystem, Track } from "../arpa/index";
import { bowCrossing } from "../core/bcr";
import { classifyEncounter } from "../core/colreg";
import { CpaWorking, cpaWorking } from "../core/cpa";
import { courseToSteer, setAndDrift } from "../core/current";
import { markFixWorking, rangeBearing } from "../core/nav";
import { CourseSpeed, Vec2, angleDiffDeg, courseSpeedOf, normalizeDeg, velocityOf } from "../core/vec";
import { World, logSpeed, measuredHeading, ownCogSog } from "../engine/index";
import { offRoute, ROUTE_27 } from "./nav-exercises";
import { PLOT_RULES } from "./plotting-exercises";
import { GOA_ANCHOR, MORMUGAO_POINT } from "./port-exercises";
import type { ArpaExercise, ChoiceTask, NumberTask } from "./session";

/**
 * Why the robot student does what it does: the reason for every answer and decision, the rule or principle behind
 * it, and the working with the numbers on the screen at that moment. Shown on the #demo display (and stepped through
 * one at a time with TEACH), so that someone watching can learn from the robot as well as watch it.
 *
 * Rules of the collision regulations are given in our own words, not quoted. Every limit the exercises use is the
 * exercise's placeholder (see the exercise files), and is called that where it is mentioned.
 */

export interface RobotWhy {
  /** What it answers or decides, in one line. */
  title: string;
  /** Why, in plain words. */
  reason: string;
  /** Where on the screen it looks, or how the value is found. */
  look?: string;
  /** The rule or principle behind it. */
  rule?: string;
  /** The working, one step a line, with the numbers on the screen. */
  working?: string[];
}

/** The robot's own manual plot of one target (manual plotting exercises). */
export interface PlotWork {
  id: number;
  name: string;
  /** First and latest plotted positions: exercise time, s; true bearing, degrees; range, NM. */
  first: { t: number; bearing: number; range: number };
  last: { t: number; bearing: number; range: number };
  /** Relative position now (NM) and relative velocity (kn) from the plot; own ship's course and speed while plotting. */
  rel: Vec2;
  relVel: Vec2;
  own: CourseSpeed;
  /** The target's true course and speed from the plot. */
  trueCS: CourseSpeed;
}

/** What the reasons can see: the same as the robot. */
export interface ReasonCtx {
  ex: ArpaExercise;
  w: World;
  a: ArpaSystem;
  name(id: number): string;
  /** The ARPA track following a target, when it is being tracked. */
  track(id: number): Track | undefined;
  /** EBL 1 bearing and VRM 1 range, when both are on. */
  measured: { bearing: number; range: number } | null;
  /** The robot's plot of the most dangerous target (manual plotting only). */
  plot(): PlotWork | null;
  /** The trial manoeuvre's closest approaches for a course and speed (nothing is changed on the ARPA). */
  trial(course: number, speed: number, delayMin: number): { name: string; cpa: number; tcpa: number }[];
}

// ---------------------------------------------------------------- formatting

export const deg3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0") + "°";
export const deg1 = (x: number): string => `${normalizeDeg(x).toFixed(1)}°`;
/** A number to 1 or 2 decimals, with a true minus sign. */
export const f1 = (x: number): string => x.toFixed(1).replace(/^-/, "−");
export const f2 = (x: number): string => x.toFixed(2).replace(/^-/, "−");
const mm = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const minLat = (lat: number): string => `${Math.floor(lat)}°${((lat - Math.floor(lat)) * 60).toFixed(1)}'N`;
const minLon = (lon: number): string => `${String(Math.floor(lon)).padStart(3, "0")}°${((lon - Math.floor(lon)) * 60).toFixed(1)}'E`;

// ---------------------------------------------------------------- reading the ARPA

/**
 * The ARPA's trial manoeuvre for a course and speed, as it would show it: each tracked target's predicted CPA and
 * TCPA (nothing on the ARPA is changed). `nameOf` names a target by its id in the scenario.
 */
export function arpaTrialRows(w: World, a: ArpaSystem, nameOf: (id: number) => string, course: number, speed: number, delayMin = 1): { name: string; cpa: number; tcpa: number }[] {
  const st = a.settings;
  const saved = { ...st.trial };
  st.trial = { on: false, course: normalizeDeg(course), speed, delayMinutes: delayMin };
  try {
    return a.trial(w).map((r) => {
      const tr = a.tracks.find((t) => t.id === r.trackId);
      return { name: tr?.truthId != null ? nameOf(tr.truthId) : `track ${r.trackId}`, cpa: r.result.cpa, tcpa: r.result.tcpaMinutes };
    });
  } finally {
    st.trial = saved;
  }
}

/** The track's data as the target data panel shows it, or null while it has none worth reading. */
function est(c: ReasonCtx, id: number): NonNullable<Track["est"]> | null {
  const t = c.track(id);
  return t && t.est && t.quality !== "acquiring" && t.state === "tracking" ? t.est : null;
}
const ground = (c: ReasonCtx): boolean => c.a.effectiveStab() === "ground";
const cseLabel = (c: ReasonCtx): string => (ground(c) ? "COG" : "CTW");
const spdLabel = (c: ReasonCtx): string => (ground(c) ? "SOG" : "STW");

/** One line of a target's data as the panel shows it. */
export function dataLine(c: ReasonCtx, id: number): string {
  const e = est(c, id);
  if (!e) return `${c.name(id)}: no data yet`;
  const k = cpaWorking(e.rel, e.relVel);
  const cp = e.cpa.opening ? "opening" : `CPA ${f1(e.cpa.cpa)} NM, TCPA ${e.cpa.tcpaMinutes === null ? "---" : f1(e.cpa.tcpaMinutes)} min`;
  return `${c.name(id)}: BRG ${deg3(k.bearingDeg)} RNG ${f1(k.rangeNm)} NM, ${cp}, ${cseLabel(c)} ${deg3(e.trueCS.course)} ${spdLabel(c)} ${f1(e.trueCS.speed)} kn`;
}

/** The CPA and TCPA worked as on a plotting sheet, from the range, bearing and relative motion. */
export function cpaSteps(k: CpaWorking, from = "her track"): string[] {
  const towards = normalizeDeg(k.bearingDeg + 180);
  const lines = [
    `Now: bearing ${deg3(k.bearingDeg)}, range ${f2(k.rangeNm)} NM. The line from her to own ship runs ${deg3(towards)}.`,
    `Her relative motion (from ${from}): towards ${deg3(k.relCourseDeg)} at ${f1(k.relSpeedKn)} kn.`,
    `Angle between her relative track and the line to own ship: ${f1(k.angleDeg)}°.`,
  ];
  if (k.angleDeg > 90) return [...lines, "More than 90°: she is opening, and her closest approach is already past."];
  return [
    ...lines,
    `CPA = range × sin(angle) = ${f2(k.rangeNm)} × sin ${f1(k.angleDeg)}° = ${f2(k.cpaNm)} NM.`,
    `Run to the CPA = range × cos(angle) = ${f2(k.runToCpaNm)} NM. TCPA = ${f2(k.runToCpaNm)} ÷ ${f1(k.relSpeedKn)} kn × 60 = ${k.tcpaMin === null ? "---" : f1(k.tcpaMin)} min.`,
  ];
}

/** How the true vector comes from the relative motion and own ship's motion. */
function trueSteps(c: ReasonCtx, e: NonNullable<Track["est"]>): string[] {
  const own = c.a.ownCourseSpeed(c.w);
  return [
    `Her relative motion: ${deg3(e.relCS.course)} at ${f1(e.relCS.speed)} kn.`,
    `Own ship's motion as the ARPA knows it (${ground(c) ? "over the ground, from the reference target" : "through the water, from the gyro and the log"}): ${deg3(own.course)} at ${f1(own.speed)} kn.`,
    `Her true motion = her relative motion + own ship's motion = ${deg3(e.trueCS.course)} at ${f1(e.trueCS.speed)} kn.`,
  ];
}

const SELECT = (name: string): string => `Select ${name} (click her echo or her row in the target list): the TARGET DATA panel shows her bearing, range, CPA, TCPA, course and speed.`;
const STEADY = "Read only from a steady track: while a track is PRELIMINARY its data carry a ? and can be far out.";

function readCpa(c: ReasonCtx, id: number, extra = ""): Reading | null {
  const e = est(c, id);
  if (!e || e.cpa.opening) return null;
  return {
    value: e.cpa.cpa,
    why: {
      title: "",
      reason: `CPA (closest point of approach) is the nearest she will come to own ship if both ships keep their present course and speed. The ARPA works it out from her relative motion, the way she moves across the picture.${extra}`,
      look: `${SELECT(c.name(id))} ${STEADY}`,
      working: [dataLine(c, id), ...cpaSteps(cpaWorking(e.rel, e.relVel))],
    },
  };
}
function readTcpa(c: ReasonCtx, id: number): Reading | null {
  const e = est(c, id);
  if (!e || e.cpa.opening || e.cpa.tcpaMinutes === null) return null;
  return {
    value: e.cpa.tcpaMinutes,
    why: {
      title: "",
      reason: "TCPA is the time, from now, until she reaches her closest point of approach. With the CPA it tells how close and how soon: a small CPA with a short TCPA needs action now.",
      look: `${SELECT(c.name(id))} ${STEADY}`,
      working: [dataLine(c, id), ...cpaSteps(cpaWorking(e.rel, e.relVel))],
    },
  };
}
function readCourse(c: ReasonCtx, id: number, extra = ""): Reading | null {
  const e = est(c, id);
  if (!e) return null;
  return {
    value: e.trueCS.course,
    why: {
      title: "",
      reason: `Her true course is where she is heading for ${ground(c) ? "over the ground" : "through the water"}. The ARPA cannot see it directly: it adds own ship's motion to the target's relative motion.${extra}`,
      look: `${SELECT(c.name(id))} The course is the ${cseLabel(c)} field. ${STEADY}`,
      working: [dataLine(c, id), ...trueSteps(c, e)],
    },
  };
}
function readSpeed(c: ReasonCtx, id: number): Reading | null {
  const e = est(c, id);
  if (!e) return null;
  return {
    value: e.trueCS.speed,
    why: {
      title: "",
      reason: "Her true speed is the length of her true vector: her relative motion with own ship's motion added back.",
      look: `${SELECT(c.name(id))} The speed is the ${spdLabel(c)} field. ${STEADY}`,
      working: [dataLine(c, id), ...trueSteps(c, e)],
    },
  };
}

/** Own ship's set and drift: the ground vector less the water vector, from the OWN SHIP DATA panel. */
function ownSetDrift(c: ReasonCtx): { set: number; drift: number; lines: string[] } {
  const water = { course: measuredHeading(c.w), speed: logSpeed(c.w) };
  const gnd = ownCogSog(c.w);
  const sd = setAndDrift(water, gnd);
  return {
    ...sd,
    lines: [
      `Through the water (HDG, STW): ${deg1(water.course)} at ${f1(water.speed)} kn.`,
      `Over the ground (COG, SOG, from the EPFS): ${deg1(gnd.course)} at ${f1(gnd.speed)} kn.`,
      `Current = ground vector − water vector = set ${deg3(sd.set)}, drift ${f2(sd.drift)} kn.`,
    ],
  };
}

/** Course to steer to make good a track, with the current found from own ship's data. */
function ctsReading(c: ReasonCtx, track: number, trackWords: string): Reading | null {
  const sd = ownSetDrift(c);
  const stw = Math.max(1, logSpeed(c.w));
  const cts = courseToSteer(track, stw, sd);
  if (!cts) return null;
  const across = sd.drift * Math.sin(((sd.set - track) * Math.PI) / 180);
  return {
    value: cts.heading,
    why: {
      title: "",
      reason: `To make good ${trackWords} the ship must head a little into the current, so that the current's push across the track is cancelled by her own motion through the water.`,
      look: "OWN SHIP DATA: HDG and STW (through the water) against COG and SOG (over the ground) give the current.",
      rule: "Current triangle: ground vector = water vector + current.",
      working: [
        ...sd.lines,
        `Current across the track: ${f2(sd.drift)} × sin(${deg3(sd.set)} − ${deg3(track)}) = ${f2(Math.abs(across))} kn to ${across >= 0 ? "starboard" : "port"}.`,
        `Allowance = asin(${f2(Math.abs(across))} ÷ ${f1(stw)} kn) = ${f1(Math.abs(cts.allowance))}° to ${cts.allowance < 0 ? "port" : "starboard"}, into the current.`,
        `Course to steer = ${deg3(track)} ${cts.allowance < 0 ? "−" : "+"} ${f1(Math.abs(cts.allowance))}° = ${deg1(cts.heading)}. Speed made good along the track: ${f1(cts.speedOverGround)} kn.`,
      ],
    },
  };
}

export interface Reading {
  value: number;
  why: RobotWhy;
}

// ---------------------------------------------------------------- number answers

type NumReader = (c: ReasonCtx, t: NumberTask) => Reading | null;

const NUM: Record<string, NumReader> = {
  "arpa-1:cpaA": (c) => readCpa(c, 1),
  "arpa-1:tcpaA": (c) => readTcpa(c, 1),
  "arpa-1:crsB": (c) => readCourse(c, 2),
  "arpa-2:crsD": (c) => readCourse(c, 1, " Ship D's relative vector points at own ship, but her true vector shows where she is really going."),
  "arpa-2:spdD": (c) => readSpeed(c, 1),
  "arpa-3:newcrs": (c) => {
    const r = readCourse(c, 1, " After a target alters, the ARPA needs a few minutes of new plots before its vector shows the new course: an answer taken while the dots are still bending would be between the old and the new course.");
    return r && { ...r, why: { ...r.why, look: `Past positions: Ship H's dots bent and then ran straight again, evenly spaced. ${r.why.look ?? ""}` } };
  },
  "arpa-3:cpaH": (c) => readCpa(c, 1, " Ship H has altered, so her old CPA no longer holds: read it again from the settled track."),
  "arpa-5:bcr": (c) => {
    const e = est(c, 1);
    if (!e) return null;
    const own = c.a.ownCourseSpeed(c.w);
    const b = bowCrossing(e.rel, e.relVel, own.course);
    if (!b) return null;
    return {
      value: b.rangeNm,
      why: {
        title: "",
        reason: "BCR (bow crossing range) is how far ahead of own ship the target will cross own ship's course line, and BCT when. Two ships with the same CPA can pass ahead or astern of us: the BCR tells which, and passing close ahead is the more dangerous.",
        look: `${SELECT(c.name(1))} BCR and BCT are the last two fields.`,
        working: [
          dataLine(c, 1),
          `Her relative track is followed forward until it crosses own ship's course line (${deg3(own.course)}).`,
          `It crosses ${f2(b.rangeNm)} NM ahead, in ${f1(b.minutes)} min: BCR ${f2(b.rangeNm)} NM, BCT ${f1(b.minutes)} min.`,
        ],
      },
    };
  },
  "arpa-6:alt": (c) => {
    const own = c.w.own.ordered;
    const rows: string[] = [];
    for (let k = 10; k <= 120; k += 10) {
      const tr = c.trial(own.course + k, own.speed, 0);
      const worst = tr.filter((r) => r.tcpa > 0.01).sort((p, q) => p.cpa - q.cpa)[0];
      const ok = tr.every((r) => r.cpa >= 2 || r.tcpa <= 0.01);
      rows.push(`${String(k).padStart(3)}° to starboard, course ${deg3(own.course + k)}: ${tr.map((r) => `${r.name} ${f1(r.cpa)}`).join(", ")} NM ${ok ? "→ all 2 NM or more" : `→ ${worst ? worst.name : "a ship"} too close`}`);
      if (ok) {
        return {
          value: k,
          why: {
            title: "",
            reason: "The trial manoeuvre shows, before anything is changed, the CPA every tracked ship would have if own ship altered to a trial course now. Trying 10° steps to starboard, the first one that clears every ship by 2 NM is the answer.",
            look: "ARPA: TRIAL on, set the trial course (speed unchanged, no delay). The picture shows TRIAL and the predicted CPAs; then trial off.",
            rule: "Every ship must be checked, not only the dangerous one: an alteration for one ship can bring another one close.",
            working: rows,
          },
        };
      }
    }
    return null;
  },
  "arpa-7:seaC": (c) => readCourse(c, 2, " Sea stabilised, the ARPA uses own ship's gyro and log, so true vectors show motion through the water: Ship T's heading, her aspect."),
  "arpa-7:gndC": (c) => readCourse(c, 2, " Ground stabilised on the light float, the float's apparent drift (the current) is taken out: true vectors now show motion over the ground."),
  "arpa-7:set": (c) => setReading(c, "a fixed light float sea stabilised seems to move with the reverse of the current; own ship's data give the same answer"),
  "arpa-7:drift": (c) => driftReading(c),
  "arpa-8:gyro": (c) => {
    const hdg = measuredHeading(c.w);
    const cog = ownCogSog(c.w).course;
    const err = angleDiffDeg(hdg, cog);
    return {
      value: err,
      why: {
        title: "",
        reason: "There is no current here, so the ship's heading should equal her course over the ground. The gyro heading now reads more than the course the EPFS measures: the gyro reads high by the difference.",
        look: "OWN SHIP DATA: HDG (gyro) against COG (EPFS). The fixed Beacon W also shows a true vector it should not have.",
        rule: "The ARPA gives no alarm for a wrong but working gyro or log: only the watchkeeper's checks find it.",
        working: [`HDG ${deg1(hdg)} − COG ${deg1(cog)} = ${err >= 0 ? "+" : ""}${f1(err)}° (+ when the gyro reads high).`, "The difference has stopped changing, so the error has settled."],
      },
    };
  },
  "radar-10:cts": (c) => ctsReading(c, 0, "the planned track 000°"),
  "radar-11:rng": (c) => measuredReading(c, "range", "the dot of the line nearest own ship (the SART)"),
  "radar-11:brg": (c) => measuredReading(c, "bearing", "the dot of the line nearest own ship (the SART)"),
  "radar-23:rng": (c) => measuredReading(c, "range", "Malabar Point, the west tip of Malabar Hill"),
  "radar-23:brg": (c) => measuredReading(c, "bearing", "Malabar Point, the west tip of Malabar Hill"),
  "radar-23:lat": (c) => fixReading(c, "lat"),
  "radar-23:lon": (c) => fixReading(c, "lon"),
  "radar-24:cts": (c) => ctsReading(c, 90, "the planned track 090° to the anchorage"),
  "radar-24:vrm": () => {
    const rb = rangeBearing(GOA_ANCHOR, MORMUGAO_POINT);
    return {
      value: rb.range,
      why: {
        title: "",
        reason: "When own ship is at the planned anchor position, Mormugao Point will be this far away. Set the VRM to it now: on the approach the point's echo slides along the index line, and the anchor goes down where the echo meets the VRM ring.",
        look: "From the chart: the distance from the anchor position to the point.",
        working: [
          "Anchor position 15°24.0'N 073°42.0'E; Mormugao Point 15°24.5'N 073°47.0'E.",
          `North: ${f2(MORMUGAO_POINT.n - GOA_ANCHOR.n)} NM; east: ${f2(MORMUGAO_POINT.e - GOA_ANCHOR.e)} NM (minutes of longitude × cos latitude).`,
          `Distance = √(${f2(MORMUGAO_POINT.n - GOA_ANCHOR.n)}² + ${f2(MORMUGAO_POINT.e - GOA_ANCHOR.e)}²) = ${f2(rb.range)} NM, bearing ${deg3(rb.bearing)} from the anchor position.`,
        ],
      },
    };
  },
  "radar-25:cpa1": (c) => readCpa(c, 1),
  "radar-25:tcpa1": (c) => readTcpa(c, 1),
  "radar-25:cpa2": (c) => readCpa(c, 2),
  "radar-26:set": (c) => setReading(c, "the tanker at anchor is fixed over the ground, so sea stabilised her vector shows the stream reversed; own ship's data give the same answer"),
  "radar-26:rate": (c) => driftReading(c),
  "radar-26:cpa": (c) => readCpa(c, 2, " CPA and TCPA come from the relative motion, so they are the same whether the ARPA is sea or ground stabilised."),
  "radar-26:tcpa": (c) => readTcpa(c, 2),
  "radar-27:cts": (c) => {
    const o = offRoute(ROUTE_27, c.w.own.pos);
    return ctsReading(c, o.track, `the track of leg ${o.leg + 1} (${deg3(o.track)})`);
  },
  "radar-28:cpa": (c) => readCpa(c, 1, " This is the CPA if nobody acts: read it before any action is taken."),
  "radar-29:recip": () => ({
    value: 170,
    why: {
      title: "",
      reason: "The Williamson turn brings the ship back along her own track, on the reciprocal of the course she was on when the person fell.",
      working: ["Reciprocal = 350° − 180° = 170°."],
    },
  }),
  "arpa-31:cpa": (c) => readCpa(c, 1),
  "arpa-31:tcpa": (c) => readTcpa(c, 1),
  "arpa-31:brg": (c) => targetRB(c, 6, "bearing"),
  "arpa-31:rng": (c) => targetRB(c, 6, "range"),
  "plot:cpa0": (c) => plotReading(c, "cpa"),
  "plot:tcpa0": (c) => plotReading(c, "tcpa"),
  "plot:crs0": (c) => plotReading(c, "crs"),
  "plot:spd0": (c) => plotReading(c, "spd"),
};

function setReading(c: ReasonCtx, how: string): Reading {
  const sd = ownSetDrift(c);
  return {
    value: sd.set,
    why: {
      title: "",
      reason: `The set is the direction the current flows towards. ${how[0]!.toUpperCase()}${how.slice(1)}.`,
      look: "OWN SHIP DATA: HDG and STW (through the water) against COG and SOG (over the ground).",
      rule: "Current triangle: ground vector = water vector + current.",
      working: sd.lines,
    },
  };
}
function driftReading(c: ReasonCtx): Reading {
  const sd = ownSetDrift(c);
  return {
    value: sd.drift,
    why: {
      title: "",
      reason: "The drift (rate) is the speed of the current: the length of the difference between own ship's ground vector and her water vector.",
      look: "OWN SHIP DATA: HDG and STW against COG and SOG.",
      rule: "Current triangle: ground vector = water vector + current.",
      working: sd.lines,
    },
  };
}
function measuredReading(c: ReasonCtx, what: "range" | "bearing", of: string): Reading | null {
  const m = c.measured;
  if (!m) return null;
  return {
    value: what === "range" ? m.range : m.bearing,
    why: {
      title: "",
      reason: `Measured on the radar, with the VRM for the range and the EBL for the bearing, both on ${of}.`,
      look: "EBL / CURSOR panel and VRM: put the EBL through the echo and the VRM ring on its nearest edge, then read BRG and RNG.",
      rule: "Range and bearing taken at the same moment, so that they fix one position.",
      working: [`EBL ${deg1(m.bearing)} true, VRM ${f2(m.range)} NM.`],
    },
  };
}
/** Malabar Point's charted position, as the briefing gives it: 18°56.9'N 072°47.5'E. */
const MALABAR_CHART = { lat: 18 + 56.9 / 60, lon: 72 + 47.5 / 60 };

function fixReading(c: ReasonCtx, which: "lat" | "lon"): Reading | null {
  const m = c.measured;
  if (!m) return null;
  const mark = MALABAR_CHART;
  const f = markFixWorking(mark, m.bearing, m.range);
  const value = which === "lat" ? (f.lat - 18) * 60 : (f.lon - 72) * 60;
  return {
    value,
    why: {
      title: "",
      reason: "Own ship lies on the reciprocal of the bearing, at the measured range from the mark. Worked by plane sailing from the mark's charted position (or plotted on the chart).",
      look: "The range and bearing of Malabar Point just measured; its position from the chart (the briefing gives it).",
      rule: "One mark gives a fix from range and bearing together; check it with a second position line that cuts the first at a good angle.",
      working: [
        `Malabar Point ${minLat(mark.lat)} ${minLon(mark.lon)}; it bears ${deg1(m.bearing)} at ${f2(m.range)} NM.`,
        `d.lat = −range × cos(bearing) = −${f2(m.range)} × cos ${deg1(m.bearing)} = ${f2(f.dLatMin)}' → latitude 18°56.9' ${f.dLatMin < 0 ? "−" : "+"} ${f2(Math.abs(f.dLatMin))}' = ${minLat(f.lat)}.`,
        `departure = −range × sin(bearing) = ${f2(f.depNm)} NM; d.long = departure ÷ cos ${f1(mark.lat)}° = ${f2(f.dLonMin)}' → longitude 072°47.5' ${f.dLonMin < 0 ? "−" : "+"} ${f2(Math.abs(f.dLonMin))}' = ${minLon(f.lon)}.`,
        which === "lat" ? `Answer: minutes north of 18° = ${f1(value)}.` : `Answer: minutes east of 072° = ${f1(value)}.`,
      ],
    },
  };
}
function targetRB(c: ReasonCtx, id: number, what: "bearing" | "range"): Reading | null {
  const e = est(c, id);
  if (!e) return null;
  const k = cpaWorking(e.rel, e.relVel);
  return {
    value: what === "bearing" ? k.bearingDeg : k.rangeNm,
    why: {
      title: "",
      reason: `The ${what} now, as the ARPA tracks her echo. (The EBL and VRM on her echo give the same.)`,
      look: SELECT(c.name(id)),
      working: [dataLine(c, id)],
    },
  };
}
function plotReading(c: ReasonCtx, what: "cpa" | "tcpa" | "crs" | "spd"): Reading | null {
  const p = c.plot();
  if (!p) return null;
  const k = cpaWorking(p.rel, p.relVel);
  const dtMin = (p.last.t - p.first.t) / 60;
  const run = (cs: CourseSpeed): string => `${f2((cs.speed * dtMin) / 60)} NM towards ${deg3(cs.course)}`;
  const relCS = courseSpeedOf(p.relVel);
  const plotLines = [
    `O, first plot at ${mm(p.first.t)}: ${deg1(p.first.bearing)} ${f2(p.first.range)} NM. A, plot at ${mm(p.last.t)}: ${deg1(p.last.bearing)} ${f2(p.last.range)} NM.`,
    `O to A in ${f1(dtMin)} min: ${run(relCS)}, so her relative motion is ${deg3(relCS.course)} at ${f1(relCS.speed)} kn.`,
  ];
  if (what === "cpa" || what === "tcpa") {
    return {
      value: what === "cpa" ? k.cpaNm : (k.tcpaMin ?? 0),
      why: {
        title: "",
        reason: what === "cpa"
          ? `${p.name} has the smallest CPA of the plotted targets, so she is the most dangerous. Her plotted positions, joined and extended past own ship, are her relative track: the CPA is the shortest distance from own ship (the centre) to that line.`
          : `The TCPA is the time she takes, at her relative speed, to run along her relative track from where she is now to the CPA.`,
        look: "The plotting sheet: plots taken with EBL 1 and VRM 1 every 6 minutes.",
        working: [...plotLines, ...cpaSteps(k, "the plot")],
      },
    };
  }
  const wo = velocityOf({ course: p.own.course, speed: p.own.speed });
  return {
    value: what === "crs" ? p.trueCS.course : p.trueCS.speed,
    why: {
      title: "",
      reason: "On the plotting sheet her true motion is found with the triangle O, A, W: W to O is own ship's run in the plotting interval, O to A is her relative motion, and W to A, the sum, is her own run through the water.",
      look: "The plotting sheet: own ship's course and speed laid off backwards from O gives W.",
      rule: "True vector = own ship's vector + relative vector (W→A = W→O + O→A).",
      working: [
        ...plotLines,
        `W to O: own ship ${deg3(p.own.course)} at ${f1(p.own.speed)} kn, ${run(courseSpeedOf(wo))} in ${f1(dtMin)} min.`,
        `W to A = W to O + O to A: ${run(p.trueCS)} in ${f1(dtMin)} min, so her course is ${deg3(p.trueCS.course)} and her speed ${f2((p.trueCS.speed * dtMin) / 60)} NM × 60 ÷ ${f1(dtMin)} min = ${f1(p.trueCS.speed)} kn.`,
      ],
    },
  };
}

/** What the robot reads for a number question, and why; null when it cannot be read from the screen now. */
export function readNumber(c: ReasonCtx, t: NumberTask): Reading | null {
  const key = c.ex.group === "Plotting" ? `plot:${t.id}` : `${c.ex.id}:${t.id}`;
  return NUM[key]?.(c, t) ?? null;
}

// ---------------------------------------------------------------- choices

/** A table of the tracked ships' CPA and TCPA, smallest CPA first. */
function cpaTable(c: ReasonCtx, ids: number[]): string[] {
  return ids
    .map((id) => ({ id, e: est(c, id) }))
    .sort((p, q) => (p.e && !p.e.cpa.opening ? p.e.cpa.cpa : 99) - (q.e && !q.e.cpa.opening ? q.e.cpa.cpa : 99))
    .map(({ id, e }) => {
      if (!e) return `${c.name(id)}: no data`;
      if (e.relCS.speed < 0.5) return `${c.name(id)}: almost no relative motion (${f1(e.relCS.speed)} kn): she keeps her distance`;
      return e.cpa.opening ? `${c.name(id)}: opening` : `${c.name(id)}: CPA ${f1(e.cpa.cpa)} NM, TCPA ${e.cpa.tcpaMinutes === null ? "---" : f1(e.cpa.tcpaMinutes)} min`;
    });
}

type ChoiceReason = (c: ReasonCtx, t: ChoiceTask, right: number) => Omit<RobotWhy, "title">;

const SMALLEST_CPA = (ids: number[], extra = ""): ChoiceReason => (c) => ({
  reason: `The ship that will pass closest is the one with the smallest CPA still to come.${extra}`,
  look: "The target list (or each target's data in turn), once every track is steady.",
  working: cpaTable(c, ids),
});

const CHO: Record<string, ChoiceReason> = {
  "arpa-1:danger": SMALLEST_CPA([1, 2, 3]),
  "arpa-2:coll": SMALLEST_CPA([1, 2, 3, 4], " With relative vectors, hers is the one that points at own ship: her relative track runs (almost) through the centre."),
  "arpa-2:stop": (c) => ({
    reason: "A true vector shows a target's own motion. A ship with no true vector is not moving through the water: she is stopped. She can still be a danger: own ship is moving towards her.",
    look: "TRUE vectors: every moving ship has a line ahead of her echo; one has none.",
    working: [dataLine(c, 2)],
  }),
  "arpa-2:same": (c) => ({
    reason: "A relative vector shows how a target moves across the picture. One with no relative vector keeps the same bearing and range: she has the same course and speed as own ship.",
    look: "RELATIVE vectors: one ship has no line at all.",
    working: [dataLine(c, 3), "Her true course and speed equal own ship's, so her relative motion is zero."],
  }),
  "arpa-3:who": (c) => ({
    reason: "Past positions are dots showing where each target was, a minute apart. Ship H's dots bend and her vector swings: she has altered course. The other ships' dots stay straight and evenly spaced.",
    look: "PAST: TRUE, 5 dots 1 minute apart.",
    working: [dataLine(c, 1), dataLine(c, 2), dataLine(c, 3)],
  }),
  "arpa-4:why": () => ({
    reason: "A guard zone acquires targets that ENTER its ring from outside. A boat that first shows between own ship and the ring never crosses the ring, so nothing happens: no alarm and no track. It has to be seen on the picture and acquired by hand.",
    rule: "Automatic acquisition does not replace a proper radar look-out.",
  }),
  "arpa-5:who": (c) => ({
    reason: "The dangerous-target alarm is given for a ship that will pass inside the CPA limit AND reach her CPA within the TCPA limit. Only one ship is inside both limits.",
    look: "The ship with the red, flashing triangle; or compare each ship's CPA and TCPA with the limits.",
    working: ["Limits: CPA 2.0 NM, TCPA 20 min.", ...cpaTable(c, [1, 2, 3, 4])],
  }),
  "arpa-5:ast": (c) => ({
    reason: "Ship N will pass very close, but her TCPA is longer than the 20 minute limit, so she is not inside both limits yet. The alarm will come when her TCPA drops below 20 minutes: watch her before that.",
    working: [dataLine(c, 3), "CPA under 2 NM, but TCPA over 20 min: no alarm yet."],
  }),
  "arpa-8:which": (c) => {
    const hdg = measuredHeading(c.w), cog = ownCogSog(c.w);
    return {
      reason: "With no current, the gyro heading should match the course over the ground, and the log speed the speed over the ground. The heading disagrees and the fixed beacon now shows a true vector: the gyro is wrong. The speeds agree: the log is right.",
      look: "OWN SHIP DATA: HDG against COG, STW against SOG; Beacon W's vector.",
      working: [`HDG ${deg1(hdg)}, COG ${deg1(cog.course)}: ${f1(angleDiffDeg(hdg, cog.course))}° apart.`, `STW ${f1(logSpeed(c.w))} kn, SOG ${f1(cog.speed)} kn: ${f1(logSpeed(c.w) - cog.speed)} kn apart.`],
    };
  },
  "arpa-8:cpaerr": () => ({
    reason: "The radar measures each echo's range and bearing from own ship, so the relative motion is measured directly. A steady gyro error turns every bearing by the same angle: the relative tracks turn, but how close and how soon each ship passes do not change. The true courses are wrong, because own ship's motion is added along the wrong heading.",
    rule: "CPA and TCPA come from relative motion; true vectors depend on the gyro and log inputs.",
  }),
  "arpa-9:who": SMALLEST_CPA([1, 2, 3, 4], " In restricted visibility every ship coming into close quarters must be avoided; this one comes closest."),
  "arpa-32:who": () => ({
    reason: "The ships are in sight of one another and crossing. Ship K is on our starboard side, so we are the give-way vessel: we keep out of her way, early and substantially, and avoid crossing ahead of her. A turn to starboard takes us under her stern.",
    rule: "Rule 15 (crossing situation) and Rule 16 (action by the give-way vessel). Size does not decide it.",
  }),
  "arpa-32:rule": () => ({
    reason: "Giving way does not end our duty. If the other ship keeps coming, the action is not working, so more action is taken, boldly: a large alteration, or slow down or stop. Waiting for her answer on VHF wastes the minutes that matter, and a turn to port across her bow can meet her own turn.",
    rule: "Rule 8(d) and (e): check the action until she is past and clear, and slacken speed or stop if necessary. Rule 2: the special circumstances of the case.",
  }),
  "arpa-32:sig": () => ({
    reason: "When a ship in sight fails to understand what the other is doing, or doubts that she is doing enough to avoid a collision, she says so at once with at least five short and rapid blasts (a light signal of five short flashes may go with them).",
    rule: "Rule 34(d).",
  }),
  "radar-10:why": () => ({
    reason: "The index line is where the light's echo should be when the ship is on her track (1.5 NM to starboard). If the echo moves in from the line towards the heading line, the light is closer than planned: the ship is being set towards it.",
    rule: "Parallel indexing: the echo of a fixed mark slides along the index line while the ship is on track; any movement off the line is movement off the track.",
  }),
  "radar-11:where": () => ({
    reason: "A SART answers the radar with a line of 12 dots outwards along its bearing. The dot nearest own ship marks the SART itself; the others are further out on the same bearing.",
    look: "A line of dots along one bearing, starting near the survival craft.",
  }),
  "radar-11:racon": () => ({
    reason: "A racon answers with a Morse letter drawn outwards from the beacon's echo. Here the flash reads dash dot dash: the letter K.",
    look: "The flash to the north-west, behind the racon's echo.",
  }),
  "radar-11:band": () => ({
    reason: "A radar SART answers only 9 GHz (X band) radar pulses. An S band radar (3 GHz) does not trigger it, so nothing is seen on S band.",
    rule: "Search with the X band radar for a SART.",
  }),
  "radar-22:first": () => ({
    reason: "Until the brilliance is right, neither the noise speckle nor the echoes can be seen properly, so no other control can be judged. Brilliance first, then gain, then tuning.",
    rule: "Order: brilliance; sea, rain and processing off; gain; tuning; range scale; performance check; sea clutter last.",
  }),
  "radar-22:tunejudge": () => ({
    reason: "Best tuning gives the most extensive clutter and land echoes (or the performance monitor's best response). A strong echo looks bright even when the tuning is poor, and a meter may not show the best point.",
  }),
  "radar-23:best": () => ({
    reason: "Radar ranges are accurate, and two or three position lines that cross at a good angle (near 90° for two) give a fix whose error is small and can be seen.",
    rule: "Ranges are better than radar bearings; a good angle of cut matters.",
  }),
  "radar-23:why": () => ({
    reason: "The radar beam is about a degree or two wide, so an echo is smeared in bearing; any gyro error moves every bearing too. Range is measured by timing the echo and is much more precise.",
  }),
  "radar-24:drag": () => ({
    reason: "The buoy is moored and should not move. When its echo moves away from the anchor watch mark, the likely cause is that own ship is moving: dragging her anchor. Check the position at once by other fixed marks.",
    rule: "An anchor watch alarm calls for a position check, not for re-acquiring the target.",
  }),
  "radar-25:rule": () => ({
    reason: "In restricted visibility no ship is stand-on or give-way: each acts in good time. For a ship forward of the beam, an alteration to port is to be avoided; a substantial alteration to starboard, made early, is clear on her radar and takes us away from her.",
    rule: "Rule 19(d): avoid altering to port for a vessel forward of the beam (unless she is being overtaken), and avoid altering towards a vessel abeam or abaft the beam.",
  }),
  "radar-25:coast": () => ({
    reason: "A low coast has little land above the radar horizon, and a flat shore turns little of the beam back to the radar. It shows late and weakly; a high coast shows from far off.",
  }),
  "radar-26:aspect": () => ({
    reason: "The collision regulations judge an encounter by the other ship's heading (her aspect): head-on, crossing or overtaking. Through the water (sea stabilised) her vector is along her heading; over the ground it is pushed sideways by the stream.",
    rule: "Use sea-stabilised vectors for collision avoidance; ground-stabilised vectors for navigation past fixed dangers.",
  }),
  "radar-26:refship": () => ({
    reason: "A ship at anchor swings round her anchor with the stream and the wind, and may drag. Her small movements are taken as the stream, so every true vector drifts wrong.",
    rule: "The best ground reference is a small, fixed, isolated echo: a buoy, a beacon, a rock.",
  }),
  "radar-27:side": () => ({
    reason: "Steering 040° with the current setting 110°, the current pushes the ship 70° to the right of her heading. She drifts to starboard of the track.",
    working: ["Current across the track: 1.5 × sin(110° − 040°) = 1.41 kn to starboard."],
  }),
  "radar-27:xtdmean": () => ({
    reason: "XTD is the cross-track distance: how far the ship is off the leg. S means to starboard of it. To come back, steer to port of the track for a while.",
  }),
  "radar-28:lane": () => ({
    reason: "Traffic in a scheme keeps to the lane for its direction and goes with the flow. Bound north here, that is the lane east of the separation zone, with the zone on the port side, as the arrows show.",
    rule: "Rule 10: proceed in the right lane in the general direction of traffic flow, keeping clear of the separation zone.",
  }),
  "radar-28:ferry": () => ({
    reason: "A traffic lane gives no right of way. The ferry is on our starboard side with risk of collision: own ship keeps out of her way, as in any crossing.",
    rule: "Rule 10 does not set aside any other rule; Rule 15: the vessel with the other on her starboard side keeps out of the way.",
  }),
  "radar-28:cross": () => ({
    reason: "Crossing at right angles takes the shortest time in the lanes and shows the other ships clearly that she is crossing.",
    rule: "Rule 10: a vessel crossing the lanes does so on a heading as nearly as practicable at right angles to the general flow.",
  }),
  "radar-29:rudder": () => ({
    reason: "Hard over to the side the person fell swings the stern, and the propeller, away from the person. It also starts the Williamson turn the right way.",
  }),
  "radar-29:shift": () => ({
    reason: "In a Williamson turn, when the heading has changed 60° from the original course, the rudder is put hard over the other way; the ship then comes round onto the reciprocal course, back along her track.",
  }),
  "radar-29:legs": () => ({
    reason: "An expanding square starts at the datum and spirals out: two legs of one track spacing, two of two, two of three, and so on, every turn 90° the same way.",
    working: ["Legs: S, S, 2S, 2S, 3S, 3S, ..."],
  }),
  "radar-30:factors": () => ({
    reason: "Radar does not see everything: small boats and floating objects may not be detected far enough off, especially in rain or a sea. Safe speed must allow for that.",
    rule: "Rule 6: a vessel with radar must also take into account its limits, among them that small vessels may not be detected at an adequate range.",
  }),
  "radar-30:r19": () => ({
    reason: "In restricted visibility the ship may have to stop or alter at short notice: the engines must be ready to do it at once.",
    rule: "Rule 19(b): a safe speed for the conditions, with the engines ready for immediate manoeuvre.",
  }),
  "radar-30:rain": () => ({
    reason: "On X band, rain returns its own clutter and weakens every echo inside and beyond it. A small boat's weak echo is lost in the rain clutter round it.",
    rule: "Try S band, which rain affects much less, and the rain clutter control used with care.",
  }),
  "arpa-31:which": SMALLEST_CPA([1, 2, 3, 4, 5, 6]),
};

/** Why the right choice is right. */
export function choiceWhy(c: ReasonCtx, t: ChoiceTask, right: number): Omit<RobotWhy, "title"> {
  return CHO[`${c.ex.id}:${t.id}`]?.(c, t, right) ?? { reason: `"${t.choices[right]}" is the answer the exercise's briefing explains.` };
}

// ---------------------------------------------------------------- encounters

/** The encounter with a tracked ship in words, for in-sight situations; the reminder of Rule 19 otherwise. */
export function encounterLine(c: ReasonCtx, id: number, restricted: boolean): string {
  const e = est(c, id);
  if (!e) return `${c.name(id)}: no data`;
  const own = c.a.ownCourseSpeed(c.w, "sea");
  const rb = normalizeDeg(cpaWorking(e.rel, e.relVel).bearingDeg - measuredHeading(c.w));
  const side = rb < 5 || rb > 355 ? "dead ahead" : rb < 90 ? "on the starboard bow" : rb <= 180 ? "on the starboard quarter" : rb < 270 ? "on the port quarter" : "on the port bow";
  const where = `${c.name(id)} bears ${f1(rb)}° relative, ${side}`;
  if (restricted) return `${where}${rb < 90 || rb > 270 ? ", forward of the beam: no alteration to port for her" : ", abeam or abaft: no alteration towards her"}.`;
  const hint = classifyEncounter(e.rel, own, e.trueCS);
  return `${where}: ${hint.note}`;
}

// ---------------------------------------------------------------- how the robot works each exercise

const PLOTTING_PLAN: string[] = [
  "The ARPA and AIS are off: everything comes from my own plot.",
  "EBL 1 and VRM 1 on every target at 0, 6 and 12 minutes; the bearing and range go on the plotting sheet.",
  "From the plot: each target's relative track (CPA, TCPA) and the triangle O, A, W (her course and speed).",
  "Answer for the most dangerous target (the smallest CPA) before manoeuvring.",
  `At ${PLOT_RULES.manoeuvreAtMin} minutes, not before: the smallest alteration to starboard (with a speed reduction if needed) that gives every target at least ${PLOT_RULES.requiredCpaNm} NM, aiming a little over it.`,
  "Keep plotting every 6 minutes until every target is past and clear, then Finish.",
];

const PLANS: Record<string, string[]> = {
  "arpa-1": ["Start the clock. Acquire Ships A, B and C by clicking their echoes.", "Wait about 3 minutes until each track is steady (no ? on the data).", "Select each ship and read her data.", "Answer, then Finish."],
  "arpa-2": ["Acquire the four ships.", "RELATIVE vectors: which one points at own ship, and which has none?", "TRUE vectors: which one has none?", "Read Ship D's course and speed.", "Answer, then Finish."],
  "arpa-3": ["Acquire the three ships and let them settle.", "Past positions on: true, 5 dots a minute apart.", "Watch for dots that bend or change spacing: a ship altering.", "Wait until her vector settles again, then read her new course and CPA."],
  "arpa-4": ["Guard 1 on: ships entering the ring are acquired automatically.", "Automatic acquisition on.", "Exclusion area over the rocks, so they are not tracked as ships.", "Acquire by hand what the guard zone cannot catch.", "Acknowledge the new-target alarms; answer; Finish."],
  "arpa-5": ["Set the CPA and TCPA limits first (2 NM, 20 min), so the alarm works from the start.", "Acquire the four ships and let them settle.", "Read Ship L's bow crossing range.", "Wait for the dangerous-target alarm, acknowledge it, and name the ship.", "Explain why Ship N gives no alarm yet."],
  "arpa-6": ["Acquire the three ships and let them settle.", "Find with the trial manoeuvre the smallest alteration to starboard that clears every ship by 2 NM.", "Check it with the trial, then make it with the Course control.", "Watch until every ship is past and clear."],
  "arpa-7": ["Acquire the light float and Ship T.", "Sea stabilised: read Ship T's course through the water.", "Make the light float the ground reference.", "Ground stabilised: read Ship T's course over the ground; work out the set and drift."],
  "arpa-8": ["Acquire the ship, the fishing boat and the beacon; run the self-test.", "Keep comparing HDG with COG, STW with SOG, and watch the fixed beacon's vector.", "When an input goes wrong: which one, and by how much, once it stops changing.", "Acknowledge the lost-target alarm."],
  "arpa-9": ["Restricted visibility: Rule 19 applies; there is no stand-on ship.", "Acquire all four ships and make a full appraisal.", "Name the ship coming into close quarters.", "Find with the trial a substantial alteration that keeps to Rule 19(d), in ample time.", "Watch until all are past and clear, then resume the course."],
  "radar-10": ["Parallel index line: 000°, 1.5 NM to starboard, through Point Light.", "A navigation line along the planned track.", "Work out the course to steer for the current.", "Steer it, and correct whenever the light's echo leaves the index line.", "Finish when past the light."],
  "radar-11": ["Find the SART's line of dots and the racon.", "Measure the SART's range and bearing.", "Steer for the dot nearest own ship.", "Slow down inside 3 NM; close the craft slowly."],
  "radar-22": ["RADAR key: warm-up, then standby; RADAR key again: transmit.", "Brilliance first.", "Sea and rain clutter to zero, processing off.", "Gain to a light speckle.", "Tuning for the most clutter and land.", "12 NM scale; performance monitor; sea clutter last."],
  "radar-23": ["Identify Malabar Point and measure its range and bearing at the same moment.", "Work the fix by plane sailing.", "Answer; keep at least 1 NM off the land."],
  "radar-24": ["Parallel index line 090°, 0.54 NM to port, through Mormugao Point.", "Course to steer for the current; VRM set to the point's range from the anchor position.", "Follow the line, slow down in good time, let go where the echo meets the VRM.", "Anchor watch on the buoy; answer when it alarms."],
  "radar-25": ["Restricted visibility: Rule 19.", "Acquire every ship; appraise CPA and TCPA.", "A substantial alteration to starboard, in good time, checked with the trial.", "Watch until every vessel is past and clear."],
  "radar-26": ["Acquire the tanker at anchor, the container ship and the VLCC.", "Make the tanker the ground reference; read the stream.", "Appraise the meeting container ship; act early to starboard.", "Watch until all are past and clear."],
  "radar-27": ["Find the current from own ship's data.", "Course to steer for each leg; keep the XTD small.", "Alter in good time at each waypoint.", "Finish when the last waypoint is passed."],
  "radar-28": ["Keep in the northbound lane, with the flow.", "Acquire the crossing ferry and the slow ship ahead.", "The ferry is on our starboard side: we give way. Slowing down keeps us in our lane.", "Resume speed when the ferry is past and clear."],
  "radar-29": ["Keep a look-out.", "At the report: MOB key at once.", "Williamson turn: hard a-starboard; at 60° hard a-port; steady on 170°.", "Reduce speed; lay an expanding square from the MOB mark; close the mark slowly."],
  "radar-30": ["Answer the questions on safe speed.", "When the visibility closes: reduce to a safe speed at once.", "Keep watching the boats on the radar; Finish when they are past and clear."],
  "arpa-31": ["Acquire all six ships quickly, the nearest and closing ones first.", "Wait for steady data.", "Compare the CPAs; report; read Ship F's bearing and range.", "Finish within the time."],
  "arpa-32": ["Acquire the three ships and appraise them.", "Ship K crosses from starboard: give way early, to starboard, with the trial.", "Keep watching her: CPA, TCPA, vector and bearing.", "When she comes back: five short blasts, then a bold second action (more to starboard, slow down).", "Watch until she is past and clear."],
};

/** How the robot means to work the exercise, before it starts. */
export function planWhy(ex: ArpaExercise): RobotWhy {
  const steps = ex.group === "Plotting" ? PLOTTING_PLAN : (PLANS[ex.id] ?? []);
  return {
    title: `My plan for exercise ${ex.number}`,
    reason: ex.aim,
    working: steps.map((s, i) => `${i + 1}. ${s}`),
  };
}

/** The current triangle and course to steer, for a steering explanation. */
export function ctsLines(c: ReasonCtx, track: number): string[] {
  return ctsReading(c, track, deg3(track))?.why.working ?? [];
}
