import { Vec2, add, angleDiffDeg, bearingOf, length, rotateVec, scale, sub, velocityOf } from "../core/vec";
import { CpaResult, computeCpa } from "../core/cpa";
import { TrialResult, trialManoeuvre } from "../core/trial";
import { inSectorZone } from "../core/zones";
import { World, ownCogSog, ownGroundVelocity, targetTypeById } from "../engine/index";
import { ArpaSystem, capacityCautionAt } from "../arpa/index";

/**
 * Nominal reporting interval of a Class A AIS station, seconds (IEC 62388:2013 Table 27, from ITU-R
 * M.1371): at anchor or moored and not faster than 3 kn, 3 minutes; 0 to 14 kn, 10 s (3 1/3 s when
 * changing course); 14 to 23 kn, 6 s (2 s when changing course); over 23 kn, 2 s.
 */
export function aisReportIntervalSec(sogKn: number, anchored: boolean, turning: boolean): number {
  if (anchored && sogKn <= 3) return 180;
  if (sogKn > 23) return 2;
  if (sogKn > 14) return turning ? 2 : 6;
  return turning ? 10 / 3 : 10;
}

/**
 * Time without a report after which a Class A target is lost, seconds (IEC 62388:2013 Table 27,
 * "lost target maximum interval"): at anchor or moored and not faster than 3 kn, 18 minutes; up to
 * 14 kn, 60 s; 14 to 23 kn, 36 s; over 23 kn, 30 s. It does not depend on changing course.
 */
export function aisLostAfterSec(sogKn: number, anchored: boolean): number {
  if (anchored && sogKn <= 3) return 18 * 60;
  if (sogKn > 23) return 30;
  if (sogKn > 14) return 36;
  return 60;
}

/** AIS station class: A, or B with carrier-sense ("CS") or self-organised ("SO") access. */
export type AisClass = "A" | "B-CS" | "B-SO";

/**
 * Nominal reporting interval of a Class B station, seconds (IEC 62388:2013 Table 27): not faster than
 * 2 kn, 3 minutes; otherwise 30 s for "CS", and for "SO" 30 s up to 14 kn, 15 s from 14 to 23 kn and
 * 5 s above. A change of course does not change a Class B rate.
 */
export function aisClassBIntervalSec(sogKn: number, cls: "B-CS" | "B-SO"): number {
  if (sogKn <= 2) return 180;
  if (cls === "B-CS" || sogKn <= 14) return 30;
  return sogKn <= 23 ? 15 : 5;
}

/**
 * Time without a report after which a Class B target is lost, seconds (IEC 62388:2013 Table 27): not
 * faster than 2 kn, 18 minutes; otherwise 180 s for "CS", and for "SO" 180 s up to 14 kn, 90 s from 14
 * to 23 kn and 30 s above.
 */
export function aisClassBLostAfterSec(sogKn: number, cls: "B-CS" | "B-SO"): number {
  if (sogKn <= 2) return 18 * 60;
  if (cls === "B-CS" || sogKn <= 14) return 180;
  return sogKn <= 23 ? 90 : 30;
}

/**
 * A valid-looking IMO number for a simulated ship: six digits and a check digit (the digits times 7, 6,
 * 5, 4, 3 and 2 added, last digit of the sum). The number is invented.
 */
export function simulatedImo(id: number): string {
  const six = String(910000 + ((id * 3797) % 89999)).slice(0, 6);
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Number(six[i]) * (7 - i);
  return six + String(sum % 10);
}

/** AIS ship type for the catalogue vessels (the type groups of ITU-R M.1371). */
const AIS_SHIP_TYPE: Record<string, string> = {
  vlcc: "Tanker", aframax: "Tanker", "product-tanker": "Tanker", "chemical-tanker": "Tanker", lng: "Tanker", lpg: "Tanker",
  "container-ul": "Cargo", "container-pp": "Cargo", "container-feeder": "Cargo", "bulk-cape": "Cargo", "bulk-panamax": "Cargo",
  "bulk-handy": "Cargo", "general-cargo": "Cargo", coaster: "Cargo", roro: "Cargo", "car-carrier": "Cargo",
  cruise: "Passenger", ferry: "Passenger", "high-speed": "High speed craft", frigate: "Military ops", "offshore-supply": "Other type",
  dredger: "Dredging", tug: "Tug", "tug-tow": "Towing", trawler: "Fishing", "fishing-boat": "Fishing", "pilot-boat": "Pilot vessel",
  yacht: "Sailing",
};

/** Rate of turn at or above which a vessel counts as changing course, and its turn indicator is drawn, degrees a minute (this simulator's choice). */
export const AIS_TURNING_ROT = 2;
/**
 * AIS capacity of the display (IEC 62388:2013 Table 26, category 3, the same category as the
 * tracker's 20 targets): activated targets, and all targets and data reports together. A caution is
 * given at a nominal 95% and a warning when the capacity is exceeded (11.5.2.1).
 */
export const AIS_CAPACITY = { activated: 20, total: 120 };
/** Past positions of activated AIS targets are taken from samples this far apart, seconds (this simulator's choice). */
export const AIS_PAST_SAMPLE_SEC = 30;
/** A vessel's beam as a share of its length, when only the length is known (the same placeholder as the echo shapes). */
export const AIS_BEAM_SHARE = 1 / 7;

/**
 * AIS reported targets on the radar display (IMO MSC.192(79) 5.26 to 5.30), simplified.
 * Ships transmit; small craft, buoys and beacons do not (unless the scenario says otherwise).
 * Reporting intervals and the time after which a target is lost follow IEC 62388:2013 Table 27
 * (Class A); the association limits below are PLACEHOLDERS.
 */
export const AIS_PLACEHOLDERS = {
  /** Association with a radar tracked target: within this distance and this difference of relative velocity. */
  assocDistanceNm: 0.25,
  assocSpeedKn: 3,
};

export interface AisReport {
  id: number;
  mmsi: string;
  name: string;
  cls: AisClass;
  /** Static and voyage data. Null: not sent (Class B sends none of the voyage data), shown as MISSING. */
  imo: string | null;
  shipType: string | null;
  destination: string | null;
  draughtM: number | null;
  eta: string | null;
  posAccuracy: "high" | "low";
  navStatus: string;
  /** Position, course and speed over the ground and heading, as transmitted. */
  pos: Vec2;
  cog: number;
  sog: number;
  heading: number;
  /** Simulation time of the report, seconds. */
  time: number;
  intervalSec: number;
  /** Time without a report after which the target counts as lost (Table 27), seconds. */
  lostAfterSec: number;
  /** Rate of turn, degrees a minute (positive to starboard), or null when the vessel does not report it. */
  rot: number | null;
  callSign: string;
  /** Length and beam, metres, when known. */
  lengthM: number | null;
  beamM: number | null;
}

/**
 * Filter for sleeping AIS targets (IEC 62388 11.5.3.1: by class only together with other factors).
 * A sleeping target of the chosen classes is left off the picture when any criterion that is set
 * says it is of no interest: further off than `rangeNm`; passing wider than `cpaNm` (or opening, or
 * with its CPA more than `tcpaMin` ahead); slower than `minSpeedKn`. Null criteria are not used.
 */
export interface AisSleepFilter {
  classes: "all" | "B";
  rangeNm: number | null;
  cpaNm: number | null;
  tcpaMin: number | null;
  minSpeedKn: number | null;
}
export const AIS_FILTER_OFF: AisSleepFilter = { classes: "all", rangeNm: null, cpaNm: null, tcpaMin: null, minSpeedKn: null };

/** Whether the filter is doing anything: at least one criterion besides the class is set. */
export function aisFilterOn(f: AisSleepFilter): boolean {
  return f.rangeNm !== null || f.cpaNm !== null || f.tcpaMin !== null || f.minSpeedKn !== null;
}

/** The filter status for the picture, for example "RNG>6 CPA>2 B ONLY"; empty when the filter is off. */
export function aisFilterLabel(f: AisSleepFilter): string {
  if (!aisFilterOn(f)) return "";
  const parts: string[] = [];
  if (f.rangeNm !== null) parts.push(`RNG>${f.rangeNm}`);
  if (f.cpaNm !== null) parts.push(`CPA>${f.cpaNm}`);
  if (f.tcpaMin !== null) parts.push(`TCPA>${f.tcpaMin}`);
  if (f.minSpeedKn !== null) parts.push(`SOG<${f.minSpeedKn}`);
  if (f.classes === "B") parts.push("CLASS B ONLY");
  return parts.join(" ");
}

/** Whether the filter leaves this target off the picture. The selected target is always drawn. */
export function aisFilteredOut(v: AisTargetView, f: AisSleepFilter, selectedId: number | null): boolean {
  if (!aisFilterOn(f) || v.state !== "sleeping" || v.dangerous || v.lost || v.report.id === selectedId) return false;
  if (f.classes === "B" && v.report.cls === "A") return false;
  if (f.rangeNm !== null && v.range > f.rangeNm) return true;
  const c = v.cpa;
  if (f.cpaNm !== null && (c.opening || c.tcpaMinutes === null || c.cpa > f.cpaNm)) return true;
  if (f.tcpaMin !== null && (c.opening || c.tcpaMinutes === null || c.tcpaMinutes > f.tcpaMin)) return true;
  if (f.minSpeedKn !== null && v.report.sog < f.minSpeedKn) return true;
  return false;
}

/**
 * Own ship's AIS data (IMO MSC.192(79) 5.28.6: presented on request): what own ship's AIS sends. The
 * identities are invented; position, course and speed come from the GNSS, heading from the gyro.
 */
export function ownShipAisData(w: World): { mmsi: string; callSign: string; cls: AisClass; navStatus: string; pos: Vec2; cog: number; sog: number; heading: number } {
  const cs = ownCogSog(w);
  return {
    mmsi: "419000001", callSign: "SIMOWN", cls: "A", navStatus: w.own.speedThroughWater < 0.2 ? "At anchor" : "Under way using engine",
    pos: { ...w.own.pos }, cog: cs.course, sog: cs.speed, heading: w.own.heading,
  };
}

export interface AisTargetView {
  report: AisReport;
  /** Reported position run on at the reported course and speed to now. */
  pos: Vec2;
  ageSec: number;
  state: "sleeping" | "activated";
  lost: boolean;
  dangerous: boolean;
  cpa: CpaResult;
  range: number;
  bearing: number;
  /** ARPA track id this AIS target is judged to be the same vessel as, or null. */
  associatedTrack: number | null;
  /** The result of the trial manoeuvre for an activated target while the trial is on (IEC 62388 11.9.2.1). */
  trial?: { result: TrialResult; dangerous: boolean };
}

export interface AisAlarm {
  key: string;
  text: string;
  raisedAt: number;
  acked: boolean;
}

export class AisSystem {
  /**
   * `sleepFilter`: which sleeping targets are left off the picture (IEC 62388 11.5.3.1). See
   * `aisFilteredOut`. Activated, dangerous and lost targets are always drawn, and no single target can
   * be taken off the picture.
   */
  settings = {
    on: true, lostAlarm: true, sleepFilter: { ...AIS_FILTER_OFF } as AisSleepFilter,
    /** Sleeping targets closer than this are activated automatically (IEC 62288 5.5.6.1). Null: off. */
    autoActivateNm: null as number | null, /** For an associated target show the AIS symbol (default) or the radar symbol. */ associatedShows: "ais" as "ais" | "radar" };
  reports = new Map<number, AisReport>();
  activated = new Set<number>();
  alarms: AisAlarm[] = [];
  selected: number | null = null;
  private lostKnown = new Set<number>();
  /** Heading of each vessel at the last step, for its rate of turn. */
  private lastHeading = new Map<number, { h: number; t: number; rot: number }>();
  /** Samples for past positions: target positions, and own ship's position at the same times. */
  private history = new Map<number, { t: number; pos: Vec2 }[]>();
  private ownHistory: { t: number; pos: Vec2 }[] = [];
  private lastSample = -Infinity;
  /** Targets already activated by entering an activation zone, so that the warning is given once. */
  private zoneActivated = new Set<number>();

  /** Call after every simulation step: vessels with AIS transmit when their interval has run. */
  step(w: World): void {
    for (const t of w.targets) {
      const carries = t.ais ?? t.kind === "ship";
      if (!carries) continue;
      // Rate of turn: only a vessel steered by the ship model (a catalogue type) has a heading that turns
      // gradually, so only such a vessel reports one; the others report it as not available.
      let rot: number | null = null;
      if (t.motion) {
        const prev = this.lastHeading.get(t.id);
        const dt = prev ? w.time - prev.t : 0;
        rot = prev && dt > 0 ? (angleDiffDeg(t.motion.heading, prev.h) / dt) * 60 : prev?.rot ?? 0;
        this.lastHeading.set(t.id, { h: t.motion.heading, t: w.time, rot });
      }
      const cls: AisClass = t.aisClass ?? (t.kind === "ship" ? "A" : "B-CS");
      const anchored = t.speed < 0.2;
      const turning = rot !== null && Math.abs(rot) >= AIS_TURNING_ROT;
      const last = this.reports.get(t.id);
      const iv = cls === "A" ? aisReportIntervalSec(t.speed, anchored, turning) : aisClassBIntervalSec(t.speed, cls);
      if (last && w.time - last.time < Math.min(iv, last.intervalSec) - 1e-9) continue;
      const type = t.typeId ? targetTypeById(t.typeId) : undefined;
      const lengthM = type?.lengthM ?? t.lengthM ?? null;
      const st = t.aisStatic ?? {};
      const a = cls === "A";
      // What is not set by the scenario: invented identities, the type of a catalogue vessel (else
      // "Cargo" for a ship), no voyage data. Class B sends no navigational status, rate of turn, IMO
      // number or voyage data at all.
      const pick = <T,>(v: T | null | undefined, dflt: T | null): T | null => (v === undefined ? dflt : v);
      this.reports.set(t.id, {
        id: t.id, mmsi: String(419000000 + t.id * 1117), name: t.name.toUpperCase(), cls,
        navStatus: a ? pick(st.navStatus, anchored ? "At anchor" : "Under way using engine") ?? "" : "",
        pos: { ...t.pos }, cog: t.course, sog: t.speed, heading: t.motion?.heading ?? t.course, time: w.time, intervalSec: iv,
        lostAfterSec: a ? aisLostAfterSec(t.speed, anchored) : aisClassBLostAfterSec(t.speed, cls), rot: a ? rot : null,
        callSign: `SIM${String(t.id).padStart(3, "0")}`, lengthM, beamM: lengthM === null ? null : lengthM * AIS_BEAM_SHARE,
        imo: a ? pick(st.imo, simulatedImo(t.id)) : null,
        shipType: pick(st.shipType, (t.typeId ? AIS_SHIP_TYPE[t.typeId] : undefined) ?? (t.kind === "ship" ? "Cargo" : null)),
        destination: a ? pick(st.destination, null) : null,
        draughtM: a ? pick(st.draughtM, null) : null,
        eta: a ? pick(st.eta, null) : null,
        posAccuracy: st.posAccuracy ?? (a ? "high" : "low"),
      });
    }
    // Samples for the past positions of activated targets.
    if (w.time - this.lastSample >= AIS_PAST_SAMPLE_SEC - 1e-9) {
      this.lastSample = w.time;
      const keep = 130;
      this.ownHistory.push({ t: w.time, pos: { ...w.own.pos } });
      if (this.ownHistory.length > keep) this.ownHistory.shift();
      for (const r of this.reports.values()) {
        const age = w.time - r.time;
        if (age > r.lostAfterSec) continue;
        const h = this.history.get(r.id) ?? [];
        h.push({ t: w.time, pos: add(r.pos, scale(velocityOf({ course: r.cog, speed: r.sog }), age / 3600)) });
        if (h.length > keep) h.shift();
        this.history.set(r.id, h);
      }
    }
  }

  /**
   * Past positions of an activated target, as positions relative to own ship now: "true" gives where
   * the target was over the ground; "relative" where it was relative to own ship at the time.
   */
  pastPositions(w: World, id: number, mode: "off" | "relative" | "true", points: number, intervalMin: number): Vec2[] {
    if (mode === "off" || !this.activated.has(id)) return [];
    const h = this.history.get(id) ?? [];
    const out: Vec2[] = [];
    for (let k = 1; k <= points; k++) {
      const want = w.time - k * intervalMin * 60;
      const s = h.find((x) => Math.abs(x.t - want) <= AIS_PAST_SAMPLE_SEC / 2 + 1e-9);
      if (!s) break;
      if (mode === "true") out.push(sub(s.pos, w.own.pos));
      else {
        const o = this.ownHistory.find((x) => Math.abs(x.t - s.t) < 1e-6);
        if (!o) break;
        out.push(sub(s.pos, o.pos));
      }
    }
    return out;
  }

  /**
   * Activate a sleeping target. Refused, with a warning, when the activated targets already fill the
   * capacity (IEC 62388 11.5.2.1). Returns whether the target is activated.
   */
  activate(id: number, w?: World): boolean {
    if (!this.reports.has(id)) return false;
    if (this.activated.has(id)) return true;
    if (this.activated.size >= AIS_CAPACITY.activated) {
      if (!this.alarms.some((x) => x.key === "ais-cap-act")) {
        this.alarms.push({ key: "ais-cap-act", text: `AIS capacity exceeded: ${AIS_CAPACITY.activated} targets are activated already. Put one to sleep first.`, raisedAt: w?.time ?? 0, acked: false });
      }
      return false;
    }
    this.activated.add(id);
    return true;
  }

  sleep(id: number): void {
    this.activated.delete(id);
    if (this.selected === id) this.selected = null;
  }

  ack(key: string): void {
    const a = this.alarms.find((x) => x.key === key);
    if (!a) return;
    a.acked = true;
    // A warning about a moment that has passed goes once it is acknowledged.
    if (key === "ais-cap-act" || key.startsWith("ais-new-")) this.alarms = this.alarms.filter((x) => x !== a);
    if (key.startsWith("ais-lost-")) {
      const id = Number(key.slice(9));
      this.alarms = this.alarms.filter((x) => x !== a);
      this.reports.delete(id);
      this.activated.delete(id);
      this.lostKnown.delete(id);
      if (this.selected === id) this.selected = null;
    }
  }

  /**
   * Everything the display needs. Also raises the alarms: CPA/TCPA (same limits as for radar
   * tracked targets; a dangerous sleeping target is activated) and, if enabled, lost AIS target.
   */
  targets(w: World, arpa: ArpaSystem | null, limits: { cpaNm: number; tcpaMin: number }): AisTargetView[] {
    if (!this.settings.on) return [];
    const ownV = ownGroundVelocity(w);
    const out: AisTargetView[] = [];
    // Capacity: a caution at 95% of the activated and of the total capacity; a warning when the total is exceeded.
    const setAlert = (key: string, on: boolean, text: string): void => {
      const a = this.alarms.find((x) => x.key === key);
      if (on && !a) this.alarms.push({ key, text, raisedAt: w.time, acked: false });
      else if (on && a) a.text = text;
      else if (!on && a) this.alarms = this.alarms.filter((x) => x !== a);
    };
    setAlert("ais-cap-near-act", this.activated.size >= capacityCautionAt(AIS_CAPACITY.activated), `AIS capacity nearly full: ${this.activated.size} of ${AIS_CAPACITY.activated} targets activated.`);
    setAlert("ais-cap-near-all", this.reports.size >= capacityCautionAt(AIS_CAPACITY.total) && this.reports.size <= AIS_CAPACITY.total, `AIS capacity nearly full: ${this.reports.size} of ${AIS_CAPACITY.total} targets.`);
    setAlert("ais-cap-all", this.reports.size > AIS_CAPACITY.total, `AIS capacity exceeded: ${this.reports.size} targets, the display holds ${AIS_CAPACITY.total}.`);
    const trialOn = !!arpa && arpa.settings.trial.on;
    const trialLeft = trialOn ? arpa!.trialRemainingMin(w) : 0;
    const trialKeys = new Set<string>();
    for (const r of this.reports.values()) {
      const age = w.time - r.time;
      const lost = age > r.lostAfterSec;
      const v = velocityOf({ course: r.cog, speed: r.sog });
      const pos = lost ? r.pos : add(r.pos, scale(v, age / 3600));
      const rel = sub(pos, w.own.pos);
      const cpa = computeCpa(rel, sub(v, ownV));
      const dangerous = !lost && cpa.tcpaMinutes !== null && cpa.tcpaMinutes >= 0 && cpa.tcpaMinutes <= limits.tcpaMin && cpa.cpa < limits.cpaNm;
      // A dangerous target is always activated, even beyond the capacity: its alarm must be seen.
      if (dangerous) this.activated.add(r.id);
      // Automatic activation (IEC 62288 5.5.6.1): sleeping targets inside the set range, and sleeping targets in the
      // ARPA's acquisition zones when automatic acquisition is on (the zones are the same for radar and AIS targets).
      if (!lost && !this.activated.has(r.id)) {
        if (this.settings.autoActivateNm !== null && length(rel) <= this.settings.autoActivateNm) this.activate(r.id, w);
        else if (arpa && arpa.settings.autoAcquire && !this.zoneActivated.has(r.id) && arpa.settings.guardZones.some((z) => z.on && inSectorZone(rel, w.own.heading, z))) {
          if (this.activate(r.id, w)) {
            this.zoneActivated.add(r.id);
            this.alarms.push({ key: `ais-new-${r.id}`, text: `NEW AIS TARGET ${r.name} activated in the acquisition zone.`, raisedAt: w.time, acked: false });
          }
        }
      }
      // Trial manoeuvre on activated targets, over the ground (AIS gives course and speed over the ground).
      let trial: AisTargetView["trial"];
      if (trialOn && this.activated.has(r.id) && !lost) {
        const tr = arpa!.settings.trial;
        const result = trialManoeuvre(rel, ownCogSog(w), { course: r.cog, speed: r.sog }, { course: tr.course, speed: tr.speed, delayMinutes: trialLeft });
        const tDanger = result.cpa < limits.cpaNm && result.tcpaMinutes >= 0 && result.tcpaMinutes <= limits.tcpaMin;
        trial = { result, dangerous: tDanger };
        if (tDanger) {
          const key2 = `ais-trial-${r.id}`;
          trialKeys.add(key2);
          const text2 = `TRIAL: AIS target ${r.name} would pass inside the limits (CPA ${result.cpa.toFixed(2)} NM in ${result.tcpaMinutes.toFixed(1)} min).`;
          const a2 = this.alarms.find((x) => x.key === key2);
          if (a2) a2.text = text2;
          else this.alarms.push({ key: key2, text: text2, raisedAt: w.time, acked: false });
        }
      }
      const key = `ais-cpa-${r.id}`;
      if (dangerous) {
        const text = `DANGEROUS AIS TARGET ${r.name}: CPA ${cpa.cpa.toFixed(2)} NM in ${cpa.tcpaMinutes!.toFixed(1)} min.`;
        const a = this.alarms.find((x) => x.key === key);
        if (a) a.text = text;
        else this.alarms.push({ key, text, raisedAt: w.time, acked: false });
      } else this.alarms = this.alarms.filter((x) => x.key !== key);
      if (lost && !this.lostKnown.has(r.id)) {
        this.lostKnown.add(r.id);
        if (this.settings.lostAlarm && this.activated.has(r.id)) this.alarms.push({ key: `ais-lost-${r.id}`, text: `AIS TARGET ${r.name} LOST (no report for ${Math.round(age)} s).`, raisedAt: w.time, acked: false });
      }
      if (!lost) this.lostKnown.delete(r.id);
      // Association with a radar tracked target: close together and moving alike (relative motion, so the stabilisation does not matter).
      let associatedTrack: number | null = null;
      if (arpa && !lost) {
        const relGyro = rotateVec(rel, w.sensors.gyroErrorDeg);
        const relVGyro = rotateVec(sub(v, ownV), w.sensors.gyroErrorDeg);
        let best: number = AIS_PLACEHOLDERS.assocDistanceNm;
        for (const t of arpa.tracks) {
          if (t.state !== "tracking" || !t.est || t.quality === "acquiring") continue;
          const d = length(sub(t.est.rel, relGyro));
          if (d <= best && length(sub(t.est.relVel, relVGyro)) <= AIS_PLACEHOLDERS.assocSpeedKn) {
            best = d;
            associatedTrack = t.id;
          }
        }
      }
      const view: AisTargetView = { report: r, pos, ageSec: age, state: this.activated.has(r.id) ? "activated" : "sleeping", lost, dangerous, cpa, range: length(rel), bearing: bearingOf(rel), associatedTrack };
      if (trial) view.trial = trial;
      out.push(view);
    }
    // Trial warnings go when the trial is changed to clear the target, or switched off.
    this.alarms = this.alarms.filter((x) => !x.key.startsWith("ais-trial-") || trialKeys.has(x.key));
    return out;
  }
}
