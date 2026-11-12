import { Vec2, add, bearingOf, length, rotateVec, scale, sub, velocityOf } from "../core/vec";
import { CpaResult, computeCpa } from "../core/cpa";
import { World, ownGroundVelocity } from "../engine/index";
import { ArpaSystem } from "../arpa/index";

/**
 * AIS reported targets on the radar display (IMO MSC.192(79) 5.26 to 5.30), simplified.
 * Ships transmit; small craft, buoys and beacons do not (unless the scenario says otherwise).
 * Every number here is a PLACEHOLDER: real reporting intervals depend on speed, turn and status.
 */
export const AIS_PLACEHOLDERS = {
  /** Seconds between position reports: at anchor or stopped / under way / fast. */
  intervalStoppedSec: 180,
  intervalSec: 10,
  intervalFastSec: 6,
  fastKn: 14,
  /** A target is LOST when nothing has been received for this many reporting intervals. */
  lostAfterIntervals: 6,
  /** Association with a radar tracked target: within this distance and this difference of relative velocity. */
  assocDistanceNm: 0.25,
  assocSpeedKn: 3,
};

export interface AisReport {
  id: number;
  mmsi: string;
  name: string;
  navStatus: string;
  /** Position, course and speed over the ground and heading, as transmitted. */
  pos: Vec2;
  cog: number;
  sog: number;
  heading: number;
  /** Simulation time of the report, seconds. */
  time: number;
  intervalSec: number;
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
}

export interface AisAlarm {
  key: string;
  text: string;
  raisedAt: number;
  acked: boolean;
}

export class AisSystem {
  settings = { on: true, lostAlarm: true, /** For an associated target show the AIS symbol (default) or the radar symbol. */ associatedShows: "ais" as "ais" | "radar" };
  reports = new Map<number, AisReport>();
  activated = new Set<number>();
  alarms: AisAlarm[] = [];
  selected: number | null = null;
  private lostKnown = new Set<number>();

  private interval(sog: number): number {
    const p = AIS_PLACEHOLDERS;
    return sog < 0.2 ? p.intervalStoppedSec : sog >= p.fastKn ? p.intervalFastSec : p.intervalSec;
  }

  /** Call after every simulation step: vessels with AIS transmit when their interval has run. */
  step(w: World): void {
    for (const t of w.targets) {
      const carries = t.ais ?? t.kind === "ship";
      if (!carries) continue;
      const last = this.reports.get(t.id);
      const iv = this.interval(t.speed);
      if (last && w.time - last.time < Math.min(iv, last.intervalSec) - 1e-9) continue;
      this.reports.set(t.id, {
        id: t.id, mmsi: String(419000000 + t.id * 1117), name: t.name.toUpperCase(), navStatus: t.speed < 0.2 ? "At anchor" : "Under way using engine",
        pos: { ...t.pos }, cog: t.course, sog: t.speed, heading: t.motion?.heading ?? t.course, time: w.time, intervalSec: iv,
      });
    }
  }

  activate(id: number): void {
    if (this.reports.has(id)) this.activated.add(id);
  }

  sleep(id: number): void {
    this.activated.delete(id);
    if (this.selected === id) this.selected = null;
  }

  ack(key: string): void {
    const a = this.alarms.find((x) => x.key === key);
    if (!a) return;
    a.acked = true;
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
    for (const r of this.reports.values()) {
      const age = w.time - r.time;
      const lost = age > AIS_PLACEHOLDERS.lostAfterIntervals * r.intervalSec;
      const v = velocityOf({ course: r.cog, speed: r.sog });
      const pos = lost ? r.pos : add(r.pos, scale(v, age / 3600));
      const rel = sub(pos, w.own.pos);
      const cpa = computeCpa(rel, sub(v, ownV));
      const dangerous = !lost && cpa.tcpaMinutes !== null && cpa.tcpaMinutes >= 0 && cpa.tcpaMinutes <= limits.tcpaMin && cpa.cpa < limits.cpaNm;
      if (dangerous) this.activated.add(r.id);
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
      out.push({ report: r, pos, ageSec: age, state: this.activated.has(r.id) ? "activated" : "sleeping", lost, dangerous, cpa, range: length(rel), bearing: bearingOf(rel), associatedTrack });
    }
    return out;
  }
}
