import { courseToSteer } from "../core/current";
import { crossTrackError } from "../core/nav";
import { advanceLeg } from "../core/route";
import { williamsonHeadings } from "../core/search";
import { trialManoeuvre } from "../core/trial";
import { angleDiffDeg, bearingOf, length, normalizeDeg, sub } from "../core/vec";
import { World, measuredHeading, noiseSpeckle, ownGroundVelocity, ownTurnProfile, radarPower } from "../engine/index";
import { FOG_AT_SEC, MOB_AT_SEC, ROUTE_27 } from "./nav-exercises";
import { PLOTTING_EXERCISES, PLOT_RULES } from "./plotting-exercises";
import { GOA_ANCHOR, GOA_PI_NM, MALABAR_POINT } from "./port-exercises";
import { ArpaExercise, distanceToLandNm, truthCpa } from "./session";
import { ctsLines, dataLine, f1, f2 } from "./robot-reasons";
import { Brain } from "./robot-brain";
import { RobotHost, RobotRun, RobotStopped, pad3, robotLevel } from "./robot-types";

// ---------------------------------------------------------------- the exercises

type Script = (b: Brain) => Promise<void>;

/** Avoiding-action exercises: appraise, act with the trial, watch them pass, finish. */
const avoidance = (o: { ids: number[]; safeNm: number; restricted: boolean; before?: string[]; after?: string[]; ground?: number; resume?: boolean; maxSec?: number; turnMax?: number }): Script => async (b) => {
  await b.begin();
  await b.run();
  await b.acquire(o.ids);
  await b.waitSteady(o.ids, 300);
  if (o.ground !== undefined) {
    await b.groundRef(o.ground);
    await b.idle(60);
  }
  for (const id of o.before ?? []) await b.answer(id);
  if (o.restricted) {
    b.explain({
      title: "Restricted visibility: Rule 19",
      reason: "No ship is in sight, so the rules for ships in sight of one another (stand-on, give-way) do not apply. Each ship detected by radar alone is judged by her CPA and TCPA; if a close-quarters situation is developing, own ship acts, in ample time, whatever the other does.",
      rule: "Rule 19(d): avoid altering to port for a ship forward of the beam (unless she is being overtaken), and avoid altering towards a ship abeam or abaft the beam. Rule 19(b), (e): safe speed, engines ready.",
    }, { once: "r19" });
  }
  const resume = o.resume ? { course: b.w.own.ordered.course, speed: b.w.own.ordered.speed } : undefined;
  await b.avoid({ safeNm: o.safeNm, restricted: o.restricted, ...(o.turnMax ? { maxTurn: o.turnMax } : {}) });
  for (const id of o.after ?? []) await b.answer(id);
  await b.monitor({ safeNm: o.safeNm, maxSec: o.maxSec ?? 2400, ...(resume ? { resume } : {}), restricted: o.restricted });
  await b.finish();
};

/** Manual plotting: observations at 0, 6 and 12 minutes, answers from the plot, the manoeuvre at 12 minutes. */
const plotting: Script = async (b) => {
  await b.begin();
  await b.run();
  const ids = b.ships();
  b.think("The ARPA is off: plotting by hand with EBL 1 and VRM 1, every 6 minutes.");
  await b.observe(ids);
  await b.until(() => b.now() >= 360, 400);
  await b.observe(ids);
  const sol = ids.map((id) => ({ id, s: b.solve(id) })).filter((x) => x.s !== null) as { id: number; s: NonNullable<ReturnType<Brain["solve"]>> }[];
  for (const x of sol) b.log("read", `Plot: ${b.name(x.id)} CPA ${x.s.cpa.toFixed(2)} NM in ${x.s.tcpa.toFixed(1)} min, course ${pad3(x.s.trueCS.course)}° speed ${x.s.trueCS.speed.toFixed(1)} kn`);
  const worst = sol.filter((x) => x.s.tcpa > 0).sort((p, q) => p.s.cpa - q.s.cpa)[0];
  if (worst) {
    b.think(`${b.name(worst.id)} is the most dangerous: answering from the plot.`);
    b.explain({
      title: `The most dangerous target: ${b.name(worst.id)}`,
      reason: "From the plot, each target's relative track gives her CPA; the one that will come closest, soonest, is the most dangerous. The answers are for her.",
      working: sol.map((x) => `${b.name(x.id)}: CPA ${f2(x.s.cpa)} NM, TCPA ${f1(x.s.tcpa)} min (from the plot)`),
    });
    b.plotFocus = worst.id;
    await b.answer("cpa0");
    await b.answer("tcpa0");
    await b.answer("crs0");
    await b.answer("spd0");
  }
  // The manoeuvre: at 12 minutes, not before (a weak trainee may jump the gun).
  const early = b.chance(b.lv.lateAction * 0.6);
  await b.until(() => b.now() >= (early ? 600 : 720), 800);
  if (!early) await b.observe(ids);
  else {
    b.mistake("Manoeuvred at 10 minutes, before the 12 minutes the exercise sets.", {
      reason: "The exercise sets the manoeuvre at 12 minutes, after three plots. Acting at 10 minutes uses a shorter plot (less accurate) and loses the timing item.",
      rule: "Plot long enough to be sure of each target's motion before acting; here, the exercise's 12 minutes.",
    });
  }
  const own = { course: b.w.own.ordered.course, speed: b.w.own.ordered.speed };
  // The result is the closest passing distance as a share of the required 1 NM, and passing wide is marked down
  // too: aim for a little over 1 NM to the target that comes closest.
  const aim = PLOT_RULES.requiredCpaNm * 1.15, least = PLOT_RULES.requiredCpaNm * 1.06;
  const closest = (turn: number, speed: number): number => {
    const prof = ownTurnProfile(b.w, turn, speed - own.speed);
    let min = Infinity;
    for (const id of ids) {
      const s = b.solve(id);
      if (!s) continue;
      const r = trialManoeuvre(s.rel, { course: measuredHeading(b.w), speed: b.w.own.speedThroughWater }, s.trueCS, { course: normalizeDeg(own.course + turn), speed, delayMinutes: 0 }, prof);
      if (r.tcpaMinutes > 0.01) min = Math.min(min, r.cpa);
    }
    return min;
  };
  let plan: { turn: number; speed: number; cpa: number } | null = null;
  const rows: string[] = [];
  for (const speed of [own.speed, Math.round(own.speed * 0.75), Math.round(own.speed / 2)]) {
    for (let turn = speed === own.speed ? 20 : 0; turn <= 120; turn += 5) {
      const c = closest(turn, speed);
      if (c < least) {
        if (turn % 10 === 0) rows.push(`${turn}° to starboard${speed !== own.speed ? ` at ${speed} kn` : ""}: closest ${Number.isFinite(c) ? f2(c) : "--"} NM, under ${f2(least)} NM`);
        continue;
      }
      rows.push(`${turn}° to starboard${speed !== own.speed ? ` at ${speed} kn` : ""}: closest ${f2(c)} NM, enough`);
      // The smallest such turn, unless it passes far wider than needed while a slower speed would do better.
      if (!plan || Math.abs(c - aim) < Math.abs(plan.cpa - aim) - 0.1) plan = { turn, speed, cpa: c };
      break;
    }
    if (plan && Math.abs(plan.cpa - aim) < 0.15) break;
  }
  plan ??= { turn: 90, speed: Math.round(own.speed / 2), cpa: closest(90, Math.round(own.speed / 2)) };
  b.think(`From the plot: ${plan.turn > 0 ? `${plan.turn}° to starboard` : "no turn"}${plan.speed !== own.speed ? `${plan.turn > 0 ? " and" : ","} speed ${plan.speed} kn` : ""}: the closest target then passes at about ${Number.isFinite(plan.cpa) ? plan.cpa.toFixed(2) : "--"} NM.`);
  const rv = b.ex.title.includes("restricted");
  b.explain({
    title: `Decision at 12 minutes: ${plan.turn > 0 ? `${plan.turn}° to starboard, to ${pad3(own.course + plan.turn)}°` : "no turn"}${plan.speed !== own.speed ? `${plan.turn > 0 ? " and" : ","} speed ${plan.speed} kn` : ""}`,
    reason: `For each alteration I work, from the plot, how close every target would then pass (allowing for own ship turning at ${PLOT_RULES.turnDegPerMin}°/min and changing speed at ${PLOT_RULES.speedKnPerMin} kn/min). I take the smallest turn to starboard that passes every target at ${f2(least)} NM or more (${PLOT_RULES.requiredCpaNm} NM, and a little for the errors of a hand plot), aiming at about ${f2(aim)} NM: the result is marked down for passing closer than ${PLOT_RULES.requiredCpaNm} NM, and (half as much) for passing wider. A slower speed is tried when a turn alone passes far too wide or not wide enough.`,
    rule: rv
      ? "Rule 19(d): no alteration to port for a ship forward of the beam, none towards a ship abeam or abaft. Rule 8: large and in good time."
      : "Rules 8, 15 and 16: early and substantial action by the give-way ship, avoiding crossing ahead of the other.",
    working: [...rows, `Chosen: the closest target then passes at about ${Number.isFinite(plan.cpa) ? f2(plan.cpa) : "--"} NM (aim ${f2(aim)} NM).`],
  });
  let turn = plan.turn;
  const r = b.rand(0, 1);
  if (r < b.lv.portTurn) {
    turn = -30;
    b.mistake("Altered 30° to port.", {
      reason: `The plot called for ${plan.turn}° to starboard. A turn to port is not allowed in this exercise, and for a ship forward of the beam it can meet her own turn to starboard.`,
      rule: rv ? "Rule 19(d)(i): avoid altering to port for a vessel forward of the beam." : "Rules 14 to 17: the give-way action is to starboard.",
    });
  } else if (r < b.lv.portTurn + b.lv.smallAction && plan.turn >= 20) {
    turn = Math.max(10, plan.turn - 20);
    b.mistake(`Altered only ${turn}° instead of the ${plan.turn}° the plot called for.`, {
      reason: `The plot showed ${plan.turn}° was needed for ${PLOT_RULES.requiredCpaNm} NM. ${turn}° leaves the closest target nearer than required and is harder to see on her radar.`,
      rule: "Rule 8(b): an alteration large enough to be readily apparent.",
    });
  }
  await b.order(normalizeDeg(own.course + turn), plan.speed !== own.speed ? plan.speed : null, "the manoeuvre at 12 minutes");
  let nextObs = b.now() + 360;
  const end = b.now() + 63 * 60;
  while (!b.allPast() && b.now() < end) {
    await b.idle(30);
    if (b.now() >= nextObs) {
      nextObs += 360;
      await b.observe(ids);
    }
  }
  await b.idle(30);
  await b.finish();
};

export const SCRIPTS: Record<string, Script> = {
  "arpa-1": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    await b.waitSteady([1, 2, 3]);
    await b.answerAll(["cpaA", "tcpaA", "crsB", "danger"]);
    await b.finish();
  },
  "arpa-2": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3, 4]);
    b.explain({
      title: "Relative vectors first",
      reason: "A relative vector shows where a ship will be, relative to own ship, after the vector time. Extended, it is her relative track: if it points at own ship (the centre), she is on a collision course. This shows risk at a glance.",
      look: "VRM / ARPA panel: Vector REL; the vector time (6 min) sets how long the lines are.",
    });
    await b.act({ k: "vectors", mode: "relative" }, "Vectors: RELATIVE");
    await b.waitSteady([1, 2, 3, 4]);
    b.think("Relative vectors: the one pointing at own ship has the smallest CPA; no relative vector means she moves as we do.");
    await b.answerAll(["coll", "same"]);
    if (b.maybe("look at the true vectors", "Only true vectors show each ship's own course and speed (her aspect): which way she is heading, and whether she is stopped.")) {
      b.explain({
        title: "Now true vectors",
        reason: "A true vector shows a ship's own course and speed: where she is heading (her aspect), which the collision rules need. Own ship gets a vector too. A ship that is stopped has none.",
        look: "Vector TRUE.",
      });
      await b.act({ k: "vectors", mode: "true" }, "Vectors: TRUE");
      await b.idle(15);
      b.think("True vectors: a ship with no true vector is stopped in the water.");
    }
    await b.answerAll(["stop", "crsD", "spdD"]);
    b.explain({ title: "Back to relative vectors", reason: "For keeping watch, relative vectors show who is on a collision course; true vectors are looked at to judge each ship's aspect.", look: "Vector REL." }, { stop: false });
    await b.act({ k: "vectors", mode: "relative" }, "Back to relative vectors");
    await b.finish();
  },
  "arpa-3": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    await b.waitSteady([1, 2, 3]);
    if (b.maybe("switch on past positions", "Without past positions a ship's alteration shows only when her vector has already swung, and the history that shows it happening is lost.")) {
      b.explain({
        title: "Past positions on: true, 5 dots a minute apart",
        reason: "Past positions show where each ship was over the last minutes. Dots in a straight line, evenly spaced: steady course and speed. A bend: she is altering course. Closer or wider spacing: she is changing speed.",
        look: "VRM / ARPA panel: PAST.",
      });
      await b.act({ k: "past", mode: "true" }, "Past positions: TRUE, 5 dots 1 minute apart");
    }
    b.think("Watching the dots for a bend or a change of spacing.");
    if (await b.until(() => b.truthOf("newcrs") !== null, 1200, 10)) {
      await b.idle(60);
      b.think("Ship H's dots are bending: she has altered course. Waiting for her vector to settle again.");
      b.explain({
        title: "Ship H has altered: wait for her vector to settle",
        reason: "The ARPA smooths each track over several minutes, so after an alteration its vector swings round slowly. Her new course and CPA can only be trusted once the dots run straight again and the vector has stopped moving (a couple of minutes).",
        look: "Her past position dots and her vector.",
      });
      await b.idle(150);
    }
    await b.answerAll(["who", "newcrs", "cpaH"]);
    await b.finish();
  },
  "arpa-4": async (b) => {
    await b.begin();
    await b.run();
    b.explain({
      title: "Guard zone, automatic acquisition and an exclusion area",
      reason: "A guard ring (here 5.5 to 6 NM) catches every echo that crosses into it from outside: the ARPA acquires it and sounds a new-target alarm. The rocks to the north-east are small enough to be taken for ships, so an exclusion area over them keeps them out.",
      look: "ARPA menu: Guard 1, Auto acquisition, Exclude 1.",
      rule: "Automatic acquisition helps but does not replace the watchkeeper's look-out on the radar picture.",
    });
    if (b.maybe("switch on the guard zone", "Without the guard zone nothing is acquired automatically: ships entering the area are not tracked until someone notices them.")) await b.act({ k: "zone", which: "guard", on: true }, "Guard 1 on (ring 5.5 to 6 NM)");
    if (b.maybe("tick automatic acquisition", "The guard zone alone only alarms; with automatic acquisition the ships it catches are tracked as well.")) await b.act({ k: "autoAcquire", on: true }, "Automatic acquisition on");
    if (b.maybe("set the exclusion area over the rocks", "Without it the rocks are acquired as false targets, filling the list and hiding real ships among them.")) await b.act({ k: "zone", which: "exclusion", on: true }, "Exclude 1 on, over the rocks to the north-east");
    b.explain({
      title: `Acquire ${b.name(4)} by hand`,
      reason: "She is already inside the guard ring, so she will never cross it: the guard zone cannot acquire her. Only a look at the picture finds her.",
    });
    await b.acquire([4]);
    b.think("Waiting for ships to come into the guard ring; acknowledging the new-target alarms.");
    await b.until(() => b.done("ships") && b.done("ack"), 1000, 10);
    await b.acquire([4, 5]);
    await b.until(() => b.done("ships"), 300, 10);
    await b.answer("why");
    await b.finish();
  },
  "arpa-5": async (b) => {
    await b.begin();
    await b.run();
    await b.setLimits(2, 20);
    await b.acquire([1, 2, 3, 4]);
    await b.waitSteady([1, 2, 3, 4]);
    await b.answerWhenReady(["bcr"], 300);
    b.think("Waiting for the dangerous-target alarm.");
    await b.until(() => b.done("ack"), 900, 10);
    await b.answerAll(["who", "ast"]);
    await b.finish();
  },
  "arpa-6": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    await b.waitSteady([1, 2, 3]);
    await b.answer("alt");
    // The alteration it found with the trial (as it typed it) is where its avoiding action starts.
    const typed = parseFloat(b.s.answers.get("alt")?.text ?? "");
    await b.avoid({ safeNm: 2, restricted: false, minTurn: Math.max(30, Number.isFinite(typed) ? typed : 30) });
    await b.monitor({ safeNm: 2, maxSec: 2400 });
    await b.finish();
  },
  "arpa-7": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2]);
    await b.waitSteady([1, 2]);
    b.think("Sea stabilised: the light float has a true vector, the reverse of the set and drift.");
    b.explain({
      title: "Sea stabilised: the light float seems to move",
      reason: "Sea stabilised, the ARPA knows own ship's motion only through the water (gyro and log). The current carries everything, so a fixed float seems to drift the opposite way: its 'true' vector is the current reversed.",
      working: [
        dataLine(b.rc(), 1),
        ...(() => {
          const t = b.track(1);
          return t?.est ? [`Reversed: ${pad3(t.est.trueCS.course)}° − 180° = ${pad3(t.est.trueCS.course + 180)}° at ${f1(t.est.trueCS.speed)} kn: the set and drift of the current, as near as the float's track shows it.`] : [];
        })(),
      ],
    });
    await b.answer("seaC");
    await b.groundRef(1);
    await b.idle(150);
    b.think("Ground stabilised: the float is still; Ship T's vector now shows her course over the ground.");
    await b.answerAll(["gndC", "set", "drift"]);
    await b.finish();
  },
  "arpa-8": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    b.explain({
      title: "Run the ARPA self-test",
      reason: "The self-test checks the ARPA's own processing against known test targets. It cannot check the gyro and log that feed it: those only the watchkeeper can check.",
      look: "ARPA menu: Self-test.",
    });
    if (b.maybe("run the ARPA self-test", "The self-test is the only check that the ARPA's own tracking and calculation are working.")) await b.act({ k: "selfTest" }, "ARPA self-test");
    await b.waitSteady([1, 3]);
    b.think("Comparing the heading with the course made good and watching the beacon's true vector.");
    b.explain({
      title: "Watch the inputs: heading, speed and a fixed mark",
      reason: "A wrong gyro or log gives no alarm. With no current here, HDG should equal COG and STW should equal SOG; and Beacon W, which is fixed, should have no true vector. Any difference means a wrong input.",
      look: "OWN SHIP DATA: HDG, COG, STW, SOG; Beacon W's vector.",
    });
    if (await b.until(() => b.truthOf("gyro") !== null, 900, 10)) b.think("The fixed beacon shows a true vector and the heading disagrees: the gyro reads high.");
    await b.answerAll(["which", "gyro", "cpaerr"]);
    await b.until(() => b.done("ack"), 240, 10);
    await b.finish();
  },
  "arpa-9": avoidance({ ids: [1, 2, 3, 4], safeNm: 2, restricted: true, before: ["who"], resume: true }),
  "radar-10": async (b) => {
    await b.begin();
    const tr = b.ex.track;
    b.explain({
      title: "Parallel index line: 000°, 1.5 NM to starboard",
      reason: "On the planned track (000°) Point Light passes 1.5 NM to starboard. A line drawn parallel to the track, 1.5 NM to starboard of own ship, is where the light's echo must stay. It moves down the line as the ship goes on; if it leaves the line, the ship has left the track by the same amount.",
      look: "MENU, PI / MAP: parallel index line 1, bearing 000, distance 1.5 (starboard).",
      rule: "Parallel indexing works with a stabilised picture and a correctly identified mark; it shows cross-track error directly, without plotting fixes.",
    });
    if (b.maybe("set the parallel index line", "Without the index line the distance off track can only be found by fixing again and again; the line shows it at a glance.")) await b.act({ k: "pi", index: 0, bearing: 0, range: 1.5, on: true }, "PI 1: 000°, 1.5 NM to starboard, through Point Light");
    if (tr && b.maybe("draw a navigation line", "The navigation line marks the track (or a limit) on the radar picture, so a drift towards the shoal is seen early.")) {
      b.explain({ title: "A navigation line along the track", reason: "Drawn on a ground-stabilised, north-up picture, it stays fixed to the ground: the ship's position against it shows at once whether she is on the track or drifting towards the shoal." }, { stop: false });
      await b.act({ k: "navLine", points: b.onScreen(tr.a, tr.b) }, "Draws the planned track as a navigation line");
    }
    await b.run();
    await b.answer("cts");
    b.explain({
      title: "How I keep on the track",
      reason: `Steer the course to steer, then every ${b.lv.steerEvery} s compare the light's echo with the index line (the distance off track) and correct the course: a few degrees towards the track for each tenth of a mile off, never more than 15°.`,
      working: (() => {
        const cts = courseToSteer(0, Math.max(1, b.w.own.speedThroughWater), b.w.env.current)?.heading ?? 0;
        const k = Math.round(6 * b.lv.steerGain);
        return [
          `Course to steer for the current: ${pad3(cts)}°.`,
          `Correction: about ${k}° towards the track for each 0.1 NM off it, at most 15°.`,
          `For example, the light's echo 0.1 NM inside the index line (own ship 0.1 NM to starboard of the track): steer ${pad3(cts - k)}° until it is back on the line.`,
        ];
      })(),
    });
    b.steer(b.lv.steerEvery, async () => {
      const w = b.w;
      const cts = courseToSteer(0, Math.max(1, w.own.speedThroughWater), w.env.current)?.heading ?? 0;
      const xte = tr ? crossTrackError(w.own.pos, tr.a, tr.b) : w.own.pos.e;
      await b.order(cts - Math.max(-15, Math.min(15, xte * 60 * b.lv.steerGain)), null, "");
    });
    await b.idle(60);
    await b.answer("why");
    await b.until(() => b.s.obs.trackDone, 4200, 10);
    b.steer(null);
    await b.finish();
  },
  "radar-11": async (b) => {
    await b.begin();
    await b.run();
    b.think("A line of 12 dots: a SART. The survival craft is at the dot nearest own ship.");
    await b.answerAll(["where", "racon", "band"]);
    await b.idle(20);
    const sart = b.target(1);
    if (sart) {
      await b.rangeFor(sart.pos);
      await b.act({ k: "measure", target: 1 }, "EBL and VRM on the nearest dot of the SART");
    }
    await b.answerAll(["rng", "brg"]);
    b.explain({
      title: "Home on the SART, slowing down as I close",
      reason: "Steer straight for the dot nearest own ship and keep it on the heading line. Inside about 3 NM slow down (5 kn, then 4 inside 1 NM): the craft is small, people may be in the water, and own ship must be able to stop close to it.",
      look: "As the range closes the dots grow into arcs and then circles: own ship is very near.",
    });
    b.steer(b.lv.steerEvery / 2, async () => {
      const t = b.target(1);
      if (!t) return;
      const rel = sub(t.pos, b.w.own.pos);
      const d = length(rel);
      await b.order(bearingOf(rel), d < 1 ? 4 : d < 3 ? 5 : null, d < 3 ? "slowing down to close the craft" : "homing on the SART");
    });
    await b.until(() => (b.s.obs.minRange[1] ?? Infinity) <= 0.3, 6000, 10);
    b.steer(null);
    await b.finish();
  },
  "radar-22": async (b) => {
    await b.begin();
    await b.run();
    b.explain({
      title: "Switch on: warm-up, standby, transmit",
      reason: "The RADAR key switches the radar on; the transmitter needs to warm up before it may transmit, then waits in STANDBY. The key again starts transmitting.",
      look: "The RADAR key; the screen shows WARMING UP, then STANDBY.",
    });
    await b.act({ k: "radarKey" }, "RADAR key: switches on; it warms up");
    await b.until(() => radarPower(b.w) === "standby", 200, 5);
    await b.act({ k: "radarKey" }, "RADAR key again: transmit");
    await b.answer("first");
    if (b.maybe("raise the brilliance first", "With the brilliance low the noise and the echoes cannot be seen, so the gain and the tuning are set blind.")) await b.act({ k: "control", id: "brill", value: 70 }, "Brilliance up to 70");
    b.explain({
      title: "Sea and rain clutter to zero, signal processing off",
      reason: "The gain is set by the noise speckle. Sea and rain clutter controls, and the processing (echo stretch, averaging, interference rejection), all change what is shown, so they are taken out first; otherwise the gain is set wrongly and weak echoes are lost.",
      look: "GAIN / CLUTTER: SEA and RAIN to 0; under RADAR: ENH, SC/SC and IR off (their letters go dark).",
    });
    await b.act({ k: "control", id: "stc", value: 0 }, "Sea clutter to zero");
    await b.act({ k: "control", id: "ftc", value: 0 }, "Rain clutter to zero");
    for (const id of ["echoStretch", "echoAvg", "irOn"] as const) {
      if (id === "irOn" && !b.maybe("switch off the interference rejection", "With interference rejection on, the noise speckle is thinned out and the gain is then set too high.")) continue;
      await b.act({ k: "processing", id, on: false }, `${id === "echoStretch" ? "Echo stretch" : id === "echoAvg" ? "Echo averaging" : "Interference rejection"} off`);
    }
    const c = b.w.radar.controls;
    const opt = b.w.radar.tuningOptimum;
    const gainFor = (tuning: number, want: number): number => {
      let best = 50, err = Infinity;
      for (let g = 0; g <= 100; g++) {
        const e = Math.abs(noiseSpeckle({ ...c, gain: g, tuning }, opt) - want);
        if (e < err) {
          err = e;
          best = g;
        }
      }
      return best;
    };
    b.think("Gain up until a light, even speckle of noise just shows.");
    b.explain({
      title: "Gain to a light speckle of noise",
      reason: "A light, even speckle of noise means the receiver is just sensitive enough for the weakest echoes. With no speckle at all, weak echoes are lost; with heavy speckle they are hidden in the noise.",
      look: "The picture beyond the sea clutter, on a medium range scale.",
    });
    await b.act({ k: "control", id: "gain", value: gainFor(c.tuning, 0.1) }, "Gain to a light speckle");
    b.think("Tuning for the greatest extent of the sea clutter and the land to the east.");
    b.explain({
      title: "Tune for the most clutter and land",
      reason: "Sweep the tuning through and stop where the sea clutter and the land to the east show furthest and strongest. That is where the receiver matches the transmitter; a strong ship's echo looks bright even when the tuning is off.",
      look: "GAIN / CLUTTER: TUNE; the TUNE meter is only a guide.",
    });
    let tune = Math.round(opt);
    if (b.chance(b.lv.setupSlip)) {
      tune = Math.max(0, Math.min(100, tune + (b.rand(0, 1) < 0.5 ? -1 : 1) * Math.round(b.rand(9, 14))));
      b.mistake(`Left the tuning at ${tune}, off the best: judged it on a strong echo instead of the clutter.`, {
        reason: "A strong echo saturates and looks bright whatever the tuning, so it cannot show the best point. Mistuned, every weak echo is weaker still and may be lost.",
        rule: "Judge the tuning on the greatest extent of sea clutter, rain or land, or with the performance monitor.",
      });
    }
    await b.act({ k: "control", id: "tuning", value: Math.max(0, Math.min(100, tune + (tune > 50 ? -8 : 8))) }, "Tuning: sweeping through");
    await b.act({ k: "control", id: "tuning", value: tune }, "Tuning: best picture");
    let gain = gainFor(tune, 0.1);
    if (b.chance(b.lv.setupSlip)) {
      gain = gainFor(tune, 0.45);
      b.mistake("Set the gain too high: a heavy speckle of noise over the picture.", {
        reason: "Heavy noise hides weak echoes among the speckle, and the ARPA can take noise for targets.",
        rule: "A light, even speckle just showing: no more.",
      });
    }
    b.explain({ title: "Gain checked again", reason: "Tuning changes the strength of everything shown, so the speckle is checked once more after it." }, { stop: false });
    await b.act({ k: "control", id: "gain", value: gain }, "Gain checked again after tuning");
    if (b.maybe("go to the 12 NM range scale", "On a very short scale the picture cannot be judged: the coast and ships far off do not show.")) {
      b.explain({ title: "12 NM range scale", reason: "A medium range scale shows the coast, the ships and the noise together, so the whole set-up can be judged." }, { stop: false });
      await b.act({ k: "range", nm: 12 }, "Range 12 NM to judge the picture");
    }
    if (b.maybe("check the performance monitor", "In open water with nothing about, a picture without echoes looks the same whether the radar works or not: the monitor proves it does.")) {
      b.explain({
        title: "Performance monitor",
        reason: "The monitor sends a known test signal and shows it as arcs on the picture. If they look as they should, the transmitter and receiver are working properly; weak arcs mean lost performance.",
        look: "Under RADAR: performance monitor (MON).",
      });
      await b.act({ k: "pm", on: true }, "Performance monitor on");
      await b.idle(12);
      b.think("The performance monitor's arcs are as they should be.");
      await b.act({ k: "pm", on: false }, "Performance monitor off");
    }
    b.explain({
      title: "Sea clutter set for the sea, last",
      reason: "Only now is the sea clutter control raised, just enough to break up the clutter close round own ship while small echoes in it still show. Too much wipes out small boats near the ship.",
      look: "GAIN / CLUTTER: SEA.",
    });
    await b.act({ k: "control", id: "stc", value: 20 }, "Sea clutter set for the sea");
    const n = noiseSpeckle(b.w.radar.controls, opt);
    if (n < 0.04 || n > 0.22) await b.act({ k: "control", id: "gain", value: gainFor(b.w.radar.controls.tuning, 0.1) }, "Gain touched up");
    await b.answer("tunejudge");
    await b.idle(10);
    await b.finish();
  },
  "radar-23": async (b) => {
    await b.begin();
    await b.run();
    b.think("No GNSS: fixing by radar range and bearing of Malabar Point.");
    b.explain({
      title: "Fix by radar on Malabar Point",
      reason: "With the GNSS failed the position must come from the radar. Malabar Point is charted, high and well defined, so its echo can be identified with confidence. Its range and bearing, taken together, fix the ship.",
      look: "The high ground north of Back Bay; its west tip.",
    });
    await b.rangeFor(MALABAR_POINT);
    await b.act({ k: "measure", at: MALABAR_POINT }, "EBL and VRM on Malabar Point");
    const m = b.v.measured;
    if (m) b.log("read", `Malabar Point ${m.bearing.toFixed(1)}° ${m.range.toFixed(2)} NM`);
    await b.answer("rng");
    await b.answer("brg");
    b.think("Working the fix: latitude 18°56.9' less range × cos(bearing); longitude 072°47.5' less range × sin(bearing) ÷ cos(lat).");
    await b.answerAll(["lat", "lon", "best", "why"]);
    await b.until(() => b.now() >= 900 || distanceToLandNm(b.w) < 2.6, 1200, 10);
    b.explain({
      title: "Stand off the land: course 240°",
      reason: `The ship is closing the coast at 8 kn and is now about ${f1(distanceToLandNm(b.w))} NM off. With no GNSS, and the depths here only approximate, I turn away in good time to keep well outside the 1 NM margin.`,
      rule: "Keep a margin of safety from the land that allows for the uncertainty of a radar fix.",
    });
    await b.order(240, null, "standing off the land");
    await b.idle(300);
    await b.finish();
  },
  "radar-24": async (b) => {
    await b.begin();
    b.explain({
      title: `Parallel index line: 090°, ${GOA_PI_NM.toFixed(2)} NM to port`,
      reason: `On the planned track (090°) Mormugao Point lies ${GOA_PI_NM.toFixed(2)} NM to port of the track line. A line parallel to the track at that distance is where its echo must stay as the ship approaches; any movement off the line is the ship leaving the track.`,
      look: "MENU, PI / MAP: bearing 090, distance −0.54 (port).",
    });
    if (b.maybe("set the parallel index line", "Without the index line the distance off the planned track is not seen until a fix is worked: in an approach that is too slow.")) await b.act({ k: "pi", index: 0, bearing: 90, range: -GOA_PI_NM, on: true }, `PI 1: 090°, ${GOA_PI_NM.toFixed(2)} NM to port, through Mormugao Point`);
    await b.run();
    await b.answerAll(["vrm", "cts"]);
    b.explain({
      title: "The approach: keep on the line, slow down, let go at the VRM",
      reason: "Steer the course to steer and correct by the index line. The anchor must go down with almost no way on, so the speed comes off in steps: 6 kn inside 3 NM, 3 kn inside 1.2 NM, then astern to stop. Let go when the point's echo meets the VRM ring and the ship is below 1 kn over the ground.",
      rule: "Plan the speed reduction: a ship carries her way a long distance.",
    });
    const w = (): World => b.w;
    b.steer(Math.min(30, b.lv.steerEvery), async () => {
      const x = w();
      if (x.own.anchor) return;
      const togo = GOA_ANCHOR.e - x.own.pos.e;
      const cts = courseToSteer(90, Math.max(1, x.own.speedThroughWater), x.env.current)?.heading ?? 90;
      const course = normalizeDeg(cts + Math.max(-15, Math.min(15, (x.own.pos.n - GOA_ANCHOR.n) * 60 * b.lv.steerGain)));
      const speed = togo <= 0.25 ? (x.own.speedThroughWater > 0.5 ? -5 : 0) : togo <= 1.2 ? 3 : togo <= 3 ? 6 : null;
      await b.order(course, speed, togo <= 0.25 ? "taking the way off" : togo <= 3 ? "reducing speed for the anchorage" : "");
      if (Math.abs(togo) < 0.3 && length(ownGroundVelocity(x)) < 1) await b.act({ k: "letGo" }, "LET GO ANCHOR");
    });
    await b.until(() => !!b.w.own.anchor, 6000, 5);
    b.steer(null);
    if (b.w.own.anchor) {
      b.think("Anchored. Anchor watch on the anchorage buoy.");
      b.explain({
        title: "Anchor watch on the anchorage buoy",
        reason: "At anchor the ship should stay put. The ARPA's anchor watch marks a fixed echo and alarms if its range or bearing from own ship changes by more than a set amount: that is own ship moving, dragging her anchor. A moored buoy is a good mark; a ship at anchor is not (she swings).",
        look: "Select the buoy's track, then Anchor watch: On, selected target.",
      });
      await b.acquire([4]);
      await b.waitSteady([4], 300);
      if (b.track(4) && b.maybe("set the anchor watch", "Without the anchor watch a dragging anchor is found only at the next position check, or when the ship is already in danger.")) {
        await b.act({ k: "select", target: 4 }, `Selects ${b.name(4)}`);
        await b.act({ k: "anchorWatch" }, "Anchor watch on the selected target");
        if (b.a.settings.anchorWatch.trackId === null) {
          await b.idle(30);
          await b.act({ k: "anchorWatch" }, "Anchor watch: again");
        }
      }
      await b.until(() => b.done("ack"), 1500, 10);
      if (b.done("ack")) b.think("The buoy has moved from its mark: we are dragging. Checking by other fixed marks.");
    }
    await b.answer("drag");
    await b.finish();
  },
  "radar-25": avoidance({ ids: [1, 2, 3, 4, 5], safeNm: 1, restricted: true, before: ["cpa1", "tcpa1", "cpa2", "rule", "coast"] }),
  "radar-26": avoidance({ ids: [1, 2, 3, 4], safeNm: 1, restricted: false, ground: 1, before: ["set", "rate", "cpa", "tcpa", "aspect", "refship"] }),
  "radar-27": async (b) => {
    await b.begin();
    await b.run();
    await b.answerAll(["side", "xtdmean"]);
    b.explain({
      title: "How I keep on the route",
      reason: `For the leg I am on, work out the course to steer for the current and steer it; every ${Math.min(30, b.lv.steerEvery)} s look at the XTD and steer a little towards the track when off it. Half a mile before each waypoint, change to the next leg: a ship takes time to turn, so the turn starts early.`,
      look: "EBL / CURSOR panel: the next waypoint, its bearing and distance, and XTD (S = starboard of the leg, P = port).",
      working: ctsLines(b.rc(), 40),
    });
    b.steer(Math.min(30, b.lv.steerEvery), async () => {
      const x = b.w;
      const leg = advanceLeg(ROUTE_27, x.own.pos, 0, 0.5);
      const track = bearingOf(sub(ROUTE_27[leg + 1]!, ROUTE_27[leg]!));
      const xtd = crossTrackError(x.own.pos, ROUTE_27[leg]!, ROUTE_27[leg + 1]!);
      const cts = courseToSteer(track, Math.max(1, x.own.speedThroughWater), x.env.current)?.heading ?? track;
      await b.order(normalizeDeg(cts - Math.max(-25, Math.min(25, xtd * 150 * b.lv.steerGain))), null, "");
    });
    await b.idle(60);
    await b.answer("cts");
    await b.until(() => b.s.obs.trackDone, 3600, 10);
    b.steer(null);
    await b.finish();
  },
  "radar-28": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3, 8]);
    await b.waitSteady([1, 2], 240);
    await b.answer("cpa");
    await b.answerAll(["lane", "ferry", "cross"]);
    b.think("The ferry crosses from starboard: own ship gives way (rule 15). A turn would take us across the lane, so we slow down.");
    let speed = 5;
    const tried: string[] = [];
    for (const sp of [8, 6, 5, 4]) {
      const rows = b.trialRows(b.w.own.ordered.course, sp);
      const ok = rows.every((r) => r.cpa >= 0.8 || r.tcpa <= 0.01);
      tried.push(`${sp} kn: ${rows.filter((r) => r.tcpa > 0.01).map((r) => `${r.name} ${r.cpa.toFixed(1)}`).join(", ")} NM ${ok ? "→ every ship 0.8 NM or more" : "→ not enough"}`);
      if (ok) {
        speed = sp;
        break;
      }
    }
    b.explain({
      title: `Decision: give way to the ferry by slowing to ${speed} kn`,
      reason: "The ferry is crossing from starboard with risk of collision, so own ship keeps out of her way. A turn to starboard would take us across our lane towards the ships coming up astern and the slow ship ahead; slowing down lets the ferry cross ahead with room, and keeps us in the lane with the flow. The slowest speed tried first that clears every ship is taken.",
      rule: "Rule 15 (crossing) and Rule 16 (early and substantial action); Rule 8: a large reduction of speed is as apparent as an alteration; Rule 10: keep in the lane.",
      working: [dataLine(b.rc(), 1), ...tried],
    });
    await b.showTrial(b.w.own.ordered.course, speed);
    if (b.chance(b.lv.lateAction)) {
      b.mistake("Slowed down late.", {
        reason: "The ferry is fast (18 kn): every minute of delay brings her much closer, and a late reduction leaves her too little room to cross.",
        rule: "Rule 16: the give-way vessel takes early and substantial action.",
      });
      await b.idle(b.rand(120, 240));
    }
    await b.order(null, speed, "giving way to the ferry");
    await b.until(() => (truthCpa(b.w, 1)?.tcpaMinutes ?? 0) <= 0 && b.now() >= 900, 1200, 10);
    b.think("The ferry is past and clear: back to 12 knots, following the slow ship's progress.");
    b.explain({
      title: "Resume 12 kn",
      reason: "The ferry is past her closest approach and opening. Back to the passage speed, keeping an eye on the slow ship ahead in our lane.",
      working: [dataLine(b.rc(), 1), dataLine(b.rc(), 2)],
    });
    await b.order(null, 12, "resuming speed");
    await b.until(() => b.now() >= 1800 && b.clearOfAll(0.5), 1200, 10);
    await b.finish();
  },
  "radar-29": async (b) => {
    await b.begin();
    await b.run();
    await b.answer("recip");
    b.think("Keeping a look-out.");
    await b.until(() => !!b.target(9), MOB_AT_SEC + 60, 1);
    b.log("read", "LOOK-OUT: MAN OVERBOARD, STARBOARD SIDE!");
    const react = b.lv.level >= 4 ? b.rand(1, 4) : b.rand(b.lv.hesitate[0], b.lv.hesitate[1] * 1.6);
    await b.idle(react);
    if (react > 30) {
      b.mistake(`Pressed MOB ${Math.round(react)} s after the report.`, {
        reason: `At 14 kn the ship runs about 7 m every second: ${Math.round(react)} s puts the mark about ${Math.round(react * 7.2)} m from where the person went in, and a person in the water gives no radar echo.`,
        rule: "Mark the position the moment the report is heard.",
      });
    }
    b.explain({
      title: "MOB key at once",
      reason: "A person in the water gives no radar echo and is soon lost from sight. The MOB key marks the ship's position at that moment on the radar: it is the datum for coming back and for any search.",
      look: "SHIP CONTROL, or the own ship keys in the menu: MOB.",
    });
    await b.act({ k: "mob" }, "MOB key: the position is marked");
    const course0 = b.w.own.ordered.course;
    const wh = williamsonHeadings(course0, "starboard");
    b.explain({
      title: "Williamson turn: hard a-starboard",
      reason: `The person fell from the starboard side: hard a-starboard swings the stern and propeller away from him. The Williamson turn then brings the ship back along her own track: at ${pad3(wh.first)}° (60° off) hard a-port, then steady on the reciprocal, ${pad3(wh.reciprocal)}°.`,
      rule: "The Williamson turn is slower than some, but returns the ship to her track: good at night or in poor visibility, when the person cannot be seen.",
    });
    await b.act({ k: "helm", deg: 35 }, "Hard a-starboard (Williamson turn)");
    await b.answerAll(["rudder", "shift"]);
    await b.until(() => Math.abs(angleDiffDeg(measuredHeading(b.w), course0)) >= 60, 300, 1);
    await b.act({ k: "helm", deg: -35 }, `Heading ${pad3(wh.first)}°: hard a-port`);
    await b.until(() => Math.abs(angleDiffDeg(measuredHeading(b.w), wh.reciprocal)) <= 25, 600, 1);
    await b.act({ k: "autopilot", course: wh.reciprocal }, `Steady on ${pad3(wh.reciprocal)}°, back along the track`);
    await b.order(null, 8, "reducing speed");
    b.explain({
      title: "Lay an expanding square from the MOB mark",
      reason: "If the person is not seen on the way back, the search starts at the datum (the MOB mark) and spreads out from it. An expanding square covers the area round a datum that is known well, as here.",
      look: "MENU, PI / MAP: search pattern, datum MOB mark, expanding square, spacing 0.5 NM.",
    });
    if (b.maybe("lay a search pattern from the MOB mark", "Without a pattern ready, a search after a failed return starts late and covers the area unevenly.")) await b.act({ k: "search", size: 0.5, course: wh.reciprocal }, "Expanding square from the MOB mark, spacing 0.5 NM");
    await b.answer("legs");
    b.steer(15, async () => {
      const m = b.v.mob;
      if (!m) return;
      const rel = sub(m.pos, b.w.own.pos);
      const d = length(rel);
      const sp = d > 1 ? 8 : d > 0.4 ? 4 : d > 0.07 ? 2 : 0;
      await b.order(d > 0.05 ? bearingOf(rel) : null, sp, d > 1 ? "" : "closing the mark slowly");
    });
    await b.until(() => (b.s.obs.returnRange[9] ?? Infinity) <= 0.05 || (b.v.mob !== null && length(sub(b.v.mob.pos, b.w.own.pos)) <= 0.05), 2700, 5);
    b.steer(null);
    b.think("Back at the position. A person in the water gives no echo: the look-out searches.");
    await b.finish();
  },
  "radar-30": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([4]);
    await b.answerAll(["factors", "r19", "rain"]);
    await b.until(() => b.now() >= FOG_AT_SEC, FOG_AT_SEC + 10, 1);
    b.log("read", "The visibility has closed in.");
    b.explain({
      title: "Visibility closed: down to 5 kn",
      reason: "Fishing boats are reported in the rain ahead and the rain hides small echoes on X band. At 16 kn the ship would cover the distance at which a boat might first be seen in a few minutes, and could not stop in it. 5 kn gives time to see, to act and to stop. The exercise asks for 8 kn or less within 8 minutes (placeholders).",
      rule: "Rule 6: a safe speed, so that the ship can stop within a distance suited to the conditions; Rule 19(b): engines ready for immediate manoeuvre.",
    });
    if (b.chance(b.lv.lateAction)) {
      b.mistake("Kept the speed up for several minutes after the visibility closed.", {
        reason: "At full speed in fog with boats about that the radar may not show, the ship cannot stop or turn in the distance she can see.",
        rule: "Rule 6 and Rule 19(b): safe speed at once when the visibility closes.",
      });
      await b.idle(b.rand(300, 600));
    } else await b.hesitate();
    await b.order(null, 5, "safe speed in restricted visibility (rule 6)");
    await b.until(() => b.w.own.pos.n > 7.5 || (b.now() >= FOG_AT_SEC + 900 && b.clearOfAll(0.5) && b.allPast()), 4200, 10);
    await b.finish();
  },
  "arpa-31": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3, 4, 5, 6]);
    await b.waitSteady([1, 2, 3, 4, 5, 6], 260);
    await b.answerAll(["which", "cpa", "tcpa", "brg", "rng"]);
    await b.finish();
  },
};
for (const ex of PLOTTING_EXERCISES) SCRIPTS[ex.id] = plotting;

/** Work one exercise with the robot. Ends with Finish pressed (or stopped). */
export async function runRobotStudent(ex: ArpaExercise, host: RobotHost, level: number, seed: number): Promise<RobotRun> {
  const lv = robotLevel(level);
  const b = new Brain(ex, host, lv, seed);
  const script = SCRIPTS[ex.id];
  const run: RobotRun = { exerciseId: ex.id, level: lv.level, seed, result: null, mistakes: b.mistakes, stopped: false };
  if (!script) throw new Error(`The robot student has no plan for exercise ${ex.id}.`);
  b.log("read", `Robot student, level ${lv.level} (${lv.name}): ${lv.about}`);
  try {
    await script(b);
    run.result = host.view().s.finished;
  } catch (e) {
    if (e instanceof RobotStopped) run.stopped = true;
    else throw e;
  }
  return run;
}
