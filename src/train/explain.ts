import { ArpaSystem } from "../arpa/index";
import { computeCpa } from "../core/cpa";
import { rangeBearing } from "../core/nav";
import { Vec2, courseSpeedOf, scale, sub, velocityOf } from "../core/vec";
import { World, measuredHeading, ownGroundVelocity } from "../engine/index";
import { MALABAR_POINT } from "./port-exercises";
import { PlotWork, ReasonCtx, RobotWhy, arpaTrialRows, choiceWhy, readNumber } from "./robot-reasons";
import type { ArpaExercise, ArpaTask, TaskCtx } from "./session";

/**
 * The reasons behind each item of an exercise, for the trainee's own debrief: after Finish, every item of the result
 * can show why the correct answer is what it is, where on the screen it is found, the rule behind it and the working
 * with the numbers that were on the screen when the trainee answered (or, for an item not answered, when Finish was
 * pressed). The same reasons the robot student gives (train/robot-reasons.ts), worked from the trainee's own display:
 * the ARPA's data as it was then, the own ship data, and for what the trainee measures or plots by hand, a perfect
 * EBL and VRM or a perfect plot.
 */

const targetName = (w: World, id: number): string => w.targets.find((t) => t.id === id)?.name ?? `target ${id}`;

/** The most dangerous target of a plotting exercise: the smallest CPA still to come (as the exercise marks it). */
function plottingWorst(w: World): number | null {
  let best: { id: number; cpa: number } | null = null;
  for (const t of w.targets) {
    if (t.kind !== "ship") continue;
    const r = computeCpa(sub(t.pos, w.own.pos), sub(velocityOf({ course: t.course, speed: t.speed }), ownGroundVelocity(w)));
    if (r.tcpaMinutes === null || r.tcpaMinutes <= 0) continue;
    if (!best || r.cpa < best.cpa) best = { id: t.id, cpa: r.cpa };
  }
  return best?.id ?? null;
}

/** A perfect plot of a target: her exact positions now and six minutes ago (or since the start), own ship as steered. */
function perfectPlot(w: World, id: number): PlotWork | null {
  const t = w.targets.find((x) => x.id === id);
  if (!t) return null;
  const rel = sub(t.pos, w.own.pos);
  const relVel = sub(velocityOf({ course: t.course, speed: t.speed }), ownGroundVelocity(w));
  const dt = Math.min(360, Math.max(60, w.time));
  const before = sub(rel, scale(relVel, dt / 3600));
  const rbNow = rangeBearing({ e: 0, n: 0 }, rel), rbBefore = rangeBearing({ e: 0, n: 0 }, before);
  return {
    id, name: t.name,
    first: { t: w.time - dt, bearing: rbBefore.bearing, range: rbBefore.range },
    last: { t: w.time, bearing: rbNow.bearing, range: rbNow.range },
    rel, relVel,
    own: { course: measuredHeading(w), speed: w.own.speedThroughWater },
    trueCS: courseSpeedOf(velocityOf({ course: t.course, speed: t.speed })),
  };
}

/** The point a question asks to be measured with the EBL and VRM, where there is one. */
function markOf(ex: ArpaExercise, w: World): Vec2 | null {
  if (ex.id === "radar-23") return MALABAR_POINT;
  if (ex.id === "radar-11") return w.targets.find((t) => t.id === 1)?.pos ?? null;
  return null;
}

/** What the trainee's display could show: the same view the robot student has, with a perfect EBL, VRM and plot. */
export function traineeReasonCtx(ex: ArpaExercise, w: World, a: ArpaSystem): ReasonCtx {
  const mark = markOf(ex, w);
  const rb = mark ? rangeBearing(w.own.pos, mark) : null;
  return {
    ex, w, a,
    name: (id) => targetName(w, id),
    track: (id) => a.tracks.find((t) => t.truthId === id && t.state === "tracking"),
    measured: rb ? { bearing: Math.round(rb.bearing * 10) / 10, range: Math.round(rb.range * 100) / 100 } : null,
    plot: () => {
      const id = plottingWorst(w);
      return id === null ? null : perfectPlot(w, id);
    },
    trial: (course, speed, delayMin) => arpaTrialRows(w, a, (id) => targetName(w, id), course, speed, delayMin),
  };
}

const fmt = (v: number, unit: string): string => `${Math.round(v * 100) / 100}${unit === "°" || unit === "'" ? "" : " "}${unit}`;

/** Reasons for the things the trainee does (action items), by task id. */
const ACTION_WHY: Record<string, Omit<RobotWhy, "title">> = {
  acq: { reason: "The ARPA gives a target's CPA, TCPA, course and speed, and alarms for her, only while it tracks her. Every ship that could come close is acquired and tracked until her data are steady (about three minutes).", rule: "Rule 7: proper use of radar, with systematic observation of the ships detected." },
  all: { reason: "Every target must be acquired and tracked steadily before reporting: a target that is not tracked gives no data and no alarm.", rule: "Rule 7: systematic observation of the ships detected." },
  trk: { reason: "The crossing ferry and the slower ship ahead are the ships that decide what own ship must do: they are tracked so that their CPA and TCPA are known.", rule: "Rule 7." },
  ships: { reason: "Ships that enter the guard ring are acquired automatically; a ship already inside it is not, and has to be acquired by hand.", rule: "Automatic acquisition does not replace the look-out on the radar picture." },
  rel: { reason: "Relative vectors show at a glance which ship is on a collision course: her vector points at own ship." },
  tru: { reason: "True vectors show each ship's own course and speed (her aspect), which the collision rules need, and show a stopped ship as having none." },
  past: { reason: "Past positions show what each ship has been doing: a bend or a change of spacing shows a manoeuvre before her vector has caught up." },
  guard: { reason: "A guard zone catches ships that enter its ring from outside and sounds the new-target alarm." },
  auto: { reason: "With automatic acquisition the ships the guard zone catches are tracked as well, not only alarmed." },
  excl: { reason: "Small rocks are acquired as if they were ships. An exclusion area over them keeps false targets out of the list." },
  ack: { reason: "An alarm calls the watchkeeper to look at once; acknowledging it shows it has been seen. Then deal with what raised it." },
  lim: { reason: "The CPA and TCPA limits decide which ships give the dangerous-target alarm. They are set first, so the alarm works from the start." },
  trial: { reason: "The trial manoeuvre shows, before anything is changed, the CPA every tracked ship would have with the new course and speed: it checks that an action works for every ship, not only the dangerous one." },
  ref: { reason: "A fixed echo made the ground reference lets the ARPA take out the current: true vectors then show motion over the ground. The reference must be fixed, small and isolated." },
  test: { reason: "The self-test checks the ARPA's own tracking and calculation against known test targets. It cannot check the gyro and log: the watchkeeper must." },
  pi: { reason: "A parallel index line through a fixed mark shows any drift off the planned track at a glance: the mark's echo slides along the line while the ship is on track." },
  nav: { reason: "A navigation line on a ground-stabilised picture marks the track or a limit, so a drift towards danger is seen early." },
  watch: { reason: "The anchor watch alarms when a fixed mark's range or bearing changes: that is own ship moving, dragging her anchor." },
  on: { reason: "The radar is switched on, allowed to warm up in STANDBY, then put to transmit." },
  brill: { reason: "Brilliance first: until the picture can be seen, the gain and tuning cannot be judged." },
  gain: { reason: "The gain is set to a light, even speckle of noise with the clutter controls at zero and the processing off: sensitive enough for weak echoes, not hiding them in noise." },
  tune: { reason: "Tuned for the greatest extent of sea clutter and land (or the performance monitor's best): the receiver then matches the transmitter." },
  range: { reason: "A medium range scale (12 NM) shows the coast, the ships and the noise together, so the set-up can be judged." },
  pm: { reason: "The performance monitor proves the radar is working at full performance, which an empty picture in open water cannot." },
  pattern: { reason: "A search pattern laid from the MOB mark is ready if the person is not found on the way back." },
};

/** Reasons for what is judged from the whole exercise (outcome items), by task id. */
const OUTCOME_WHY: Record<string, Omit<RobotWhy, "title">> = {
  act: { reason: "The action must be large enough to be readily apparent to the other ship watching by radar, taken in good time; in restricted visibility it must keep to Rule 19(d).", rule: "Rule 8(a) and (b); Rule 19(d): no alteration to port for a vessel forward of the beam (other than one being overtaken), none towards a vessel abeam or abaft the beam." },
  action: { reason: "The action must be substantial and in good time, so that it is clear on the other ship's radar and gives a safe passing distance.", rule: "Rule 8; Rule 19(d) in restricted visibility." },
  safe: { reason: "Every ship must pass at the exercise's safe distance or more, and the action is checked until each is finally past and clear.", rule: "Rule 8(d)." },
  result: { reason: "The closest any target came, as a share of the required passing distance; passing much wider is marked down too, so the aim is a little over the requirement." },
  time: { reason: "The plot runs for 12 minutes before the manoeuvre, so that each target's motion is known well enough to act on." },
  port: { reason: "A turn to port for a ship forward of the beam can meet her own turn to starboard; the exercise does not allow it.", rule: "Rule 19(d)(i); Rules 14, 15 and 17 in sight." },
  manual: { reason: "This is manual plotting: the targets are worked from bearings and ranges by hand, with the ARPA off." },
  xte: { reason: "The ship is kept on the planned track by parallel indexing: the light's echo held on the index line." },
  track: { reason: "The ship is kept on the planned track by parallel indexing, and the anchor let go." },
  anchored: { reason: "The anchor goes down where the point's echo meets the VRM ring on the index line: that is the planned position." },
  kept: { reason: "The ship is kept within the limit of the planned route (or in her lane with the flow): the distance off track (XTD) is watched and corrected." },
  done: { reason: "The route is sailed to its end, the last waypoint passed." },
  close: { reason: "The survival craft is closed slowly, so that own ship can stop close to it and people in the water are not run down." },
  key: { reason: "The MOB key marks the position at the moment of the report; every second of delay moves the mark away from the person, who gives no radar echo." },
  back: { reason: "The Williamson turn brings the ship back along her track to the mark, at low speed near the person." },
  speed: { reason: "When the visibility closes, the speed must come down at once to one at which the ship can stop in time.", rule: "Rule 6; Rule 19(b)." },
  clear: { reason: "With no GNSS, the position comes from radar fixes, so a wide margin is kept from the land." },
  final: { reason: "At the end the radar must be transmitting with the gain giving a light speckle and the tuning right: a radar badly set up loses weak echoes." },
  held: { reason: "Every target must still be tracked when the report is made; a lost track means no data for that ship." },
};

/**
 * Why the right answer to a task is right, with the working from the screen now (`c`: the session's context at the
 * moment of the answer, or of Finish). Null when there is nothing to say.
 */
export function explainTask(ex: ArpaExercise, t: ArpaTask, c: TaskCtx): RobotWhy | null {
  const rc = traineeReasonCtx(ex, c.w, c.a);
  if (t.kind === "number") {
    const truth = t.truth(c);
    const reading = readNumber(rc, t);
    if (reading) {
      return {
        ...reading.why,
        title: `${t.prompt}: ${fmt(reading.value, t.unit)}`,
        working: [...(reading.why.working ?? []), ...(truth !== null ? [`The value checked: ${fmt(truth, t.unit)}, credited within ±${t.tol(c.cfg)} ${t.unit}.`] : [])],
      };
    }
    if (truth === null) return null;
    return {
      title: `${t.prompt}: ${fmt(truth, t.unit)}`,
      reason: "The screen did not show this when the answer was given: the target was not tracked with steady data, or the mark was not measured. Acquire the target and wait for steady data (about three minutes), or measure with the EBL and VRM, then read the value.",
      working: [`The value checked: ${fmt(truth, t.unit)}, credited within ±${t.tol(c.cfg)} ${t.unit}.`],
    };
  }
  if (t.kind === "choice") {
    const right = t.correct(c);
    return { ...choiceWhy(rc, t, right), title: `${t.prompt} ${t.choices[right] ?? ""}`.trim() };
  }
  if (t.kind === "action") {
    const w = ACTION_WHY[t.id];
    return w ? { ...w, title: t.prompt } : null;
  }
  const w = OUTCOME_WHY[t.id];
  return w ? { ...w, title: t.prompt } : null;
}
