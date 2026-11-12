import { CourseSpeed, Vec2, angleDiffDeg, fromPolar, length, sub, velocityOf, add } from "../core/vec";
import { CpaResult, computeCpa } from "../core/cpa";
import { distanceToSegment, crossTrackError, pointInPolygon } from "../core/nav";
import { classifyEncounter, ColregHint } from "../core/colreg";
import { Target, World } from "../engine/types";
import { ownGroundVelocity } from "../engine/world";
import { ExerciseDef } from "./exercises";

export interface TruthSnapshot {
  time: number;
  ownPos: Vec2;
  ownGround: CourseSpeed;
  /** Position and ground course/speed of the identified target, if any. */
  targetPos: Vec2 | null;
  targetCourse: number;
  targetSpeed: number;
}

export interface RocObservation {
  id: number;
  /** Fix number (1, 2, ...) for the position fixing exercises. */
  group: number;
  timeSec: number;
  /** True bearing and range, as the student read them. */
  bearing: number;
  range: number;
  /** Echo matched to this target (or charted object). Null if no echo was near the measured point. */
  objectId: number | null;
  ownHeading: number;
  ownSpeedWater: number;
  truth: TruthSnapshot;
}

export interface ChartedObject {
  id: number;
  name: string;
  pos: Vec2;
}

export function chartedObjects(world: World): ChartedObject[] {
  return world.targets
    .filter((t) => (t.kind === "beacon" || t.kind === "buoy") && t.speed === 0)
    .map((t) => ({ id: t.id, name: t.name, pos: { ...t.pos } }));
}

/** Matching tolerance when the student sets the EBL/VRM on an echo: 3 degrees of bearing or 0.15 NM. */
export function matchTolerance(range: number): number {
  return Math.max(0.15, range * Math.tan((3 * Math.PI) / 180));
}

/** Which target is nearest the measured point (bearing and range from own ship)? */
export function identify(world: World, bearing: number, range: number, onlyCharted: boolean): Target | null {
  const measured = add(world.own.pos, fromPolar(bearing, range));
  const tol = matchTolerance(range);
  let best: Target | null = null;
  let bestD = Infinity;
  for (const t of world.targets) {
    if (onlyCharted && !((t.kind === "beacon" || t.kind === "buoy") && t.speed === 0)) continue;
    const d = length(sub(t.pos, measured));
    if (d <= tol && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

export interface TargetEncounter {
  id: number;
  name: string;
  range: number;
  bearing: number;
  cpa: CpaResult;
  hint: ColregHint;
}

/** Exact encounter between own ship and a target from the simulation's true state. */
export function trueEncounter(world: World, t: Target): TargetEncounter {
  const own = world.own;
  const ownVel = ownGroundVelocity(world);
  const rel = sub(t.pos, own.pos);
  const relVel = sub(velocityOf({ course: t.course, speed: t.speed }), ownVel);
  const cpa = computeCpa(rel, relVel);
  const ownCs = { course: Math.atan2(ownVel.e, ownVel.n) * (180 / Math.PI), speed: length(ownVel) };
  const hint = classifyEncounter(rel, { course: (ownCs.course + 360) % 360, speed: ownCs.speed }, { course: t.course, speed: t.speed });
  return {
    id: t.id,
    name: t.name,
    range: length(rel),
    bearing: (Math.atan2(rel.e, rel.n) * (180 / Math.PI) + 360) % 360,
    cpa,
    hint,
  };
}

export interface ActionEvent {
  t: number;
  kind: "course" | "speed";
  from: number;
  to: number;
  encounters: { id: number; range: number; cpa: number; tcpaMinutes: number | null }[];
}

/** Records what happens during an exercise, every simulation step. */
export class RunLog {
  startTime: number;
  endTime: number;
  readonly initial: TargetEncounter[];
  readonly minRange = new Map<number, number>();
  minHazardClearance = Infinity;
  minRangeToObject = Infinity;
  grounded = false;
  groundedAt: number | null = null;
  hazardStruck = false;
  xteAbsMax = 0;
  private xteSum = 0;
  private xteCount = 0;
  reachedEnd = false;
  readonly actions: ActionEvent[] = [];
  readonly track: { t: number; pos: Vec2 }[] = [];
  readonly initialOrdered: { course: number; speed: number };
  private lastOrdered: { course: number; speed: number };
  private lastTrackSample = -Infinity;

  constructor(world: World, private readonly clearingObjectId?: number) {
    this.startTime = world.time;
    this.endTime = world.time;
    this.initial = world.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft").map((t) => trueEncounter(world, t));
    this.initialOrdered = { ...world.own.ordered };
    this.lastOrdered = { ...world.own.ordered };
  }

  get meanXte(): number {
    return this.xteCount === 0 ? 0 : this.xteSum / this.xteCount;
  }

  step(world: World): void {
    this.endTime = world.time;
    const own = world.own.pos;

    for (const t of world.targets) {
      const d = length(sub(t.pos, own));
      const prev = this.minRange.get(t.id);
      if (prev === undefined || d < prev) this.minRange.set(t.id, d);
      if (this.clearingObjectId === t.id && d < this.minRangeToObject) this.minRangeToObject = d;
    }

    for (const h of world.hazards) {
      const clearance = length(sub(h.center, own)) - h.radius;
      if (clearance < this.minHazardClearance) this.minHazardClearance = clearance;
      if (clearance < 0) this.hazardStruck = true;
    }

    if (!this.grounded) {
      let hit = false;
      for (const c of world.coasts) if (c.closed && pointInPolygon(own, c.points)) hit = true;
      if (!hit) for (const e of world.edges) if (distanceToSegment(own, e.a, e.b) < 0.04) hit = true;
      if (hit) {
        this.grounded = true;
        this.groundedAt = world.time;
      }
    }

    const route = world.route;
    if (route.length >= 2) {
      let bestD = Infinity;
      let seg = 0;
      for (let i = 0; i < route.length - 1; i++) {
        const d = distanceToSegment(own, route[i]!, route[i + 1]!);
        if (d < bestD) {
          bestD = d;
          seg = i;
        }
      }
      const x = Math.abs(crossTrackError(own, route[seg]!, route[seg + 1]!));
      this.xteAbsMax = Math.max(this.xteAbsMax, x);
      this.xteSum += x;
      this.xteCount++;
      if (length(sub(own, route[route.length - 1]!)) < 0.3) this.reachedEnd = true;
    }

    const o = world.own.ordered;
    const dc = angleDiffDeg(o.course, this.lastOrdered.course);
    if (Math.abs(dc) >= 1) {
      this.pushAction(world, "course", this.lastOrdered.course, o.course);
      this.lastOrdered.course = o.course;
    }
    if (Math.abs(o.speed - this.lastOrdered.speed) >= 0.5) {
      this.pushAction(world, "speed", this.lastOrdered.speed, o.speed);
      this.lastOrdered.speed = o.speed;
    }

    if (world.time - this.lastTrackSample >= 10) {
      this.lastTrackSample = world.time;
      this.track.push({ t: world.time, pos: { ...own } });
    }
  }

  private pushAction(world: World, kind: "course" | "speed", from: number, to: number): void {
    this.actions.push({
      t: world.time,
      kind,
      from,
      to,
      encounters: world.targets
        .filter((t) => t.kind === "ship" || t.kind === "small-craft")
        .map((t) => {
          const e = trueEncounter(world, t);
          return { id: t.id, range: e.range, cpa: e.cpa.cpa, tcpaMinutes: e.cpa.tcpaMinutes };
        }),
    });
  }
}

export class RocSession {
  observations: RocObservation[] = [];
  group = 1;
  clearing: { objectId: number; range: number } | null = null;
  finished = false;
  finishReason = "";
  readonly log: RunLog;
  private nextId = 1;
  readonly charted: ChartedObject[];

  constructor(readonly ex: ExerciseDef, world: World) {
    this.log = new RunLog(world, ex.clearingObjectId);
    this.charted = chartedObjects(world);
  }

  /** Call once per simulation step. Returns true when the exercise has just ended. */
  step(world: World): boolean {
    if (this.finished) return false;
    this.log.step(world);
    let reason = "";
    if (this.log.grounded) reason = "Own ship has run aground.";
    else if (this.log.hazardStruck) reason = "Own ship has run onto the shoal.";
    else if (this.ex.durationSec !== undefined && world.time - this.log.startTime >= this.ex.durationSec) reason = "Time is up.";
    else if (this.ex.id === "pilotage" && this.log.reachedEnd) reason = "Reached the last waypoint.";
    else if (this.ex.id === "clearing" && world.route.length > 1 && world.own.pos.n >= world.route[world.route.length - 1]!.n) reason = "Passage complete.";
    if (reason) {
      this.finish(reason);
      return true;
    }
    return false;
  }

  finish(reason: string): void {
    if (this.finished) return;
    this.finished = true;
    this.finishReason = reason;
  }

  /** Student reads the EBL bearing and VRM range off the display and logs an observation. */
  observe(world: World, bearing: number, range: number): { ok: true; obs: RocObservation } | { ok: false; message: string } {
    if (range < 0.05) return { ok: false, message: "Set the VRM on the echo first." };
    const onlyCharted = this.ex.id === "fix" || this.ex.id === "setdrift" || this.ex.id === "clearing" || this.ex.id === "pilotage";
    const t = identify(world, bearing, range, onlyCharted);
    const own = world.own;
    const ownVel = ownGroundVelocity(world);
    const obs: RocObservation = {
      id: this.nextId++,
      group: this.group,
      timeSec: world.time,
      bearing,
      range,
      objectId: t ? t.id : null,
      ownHeading: own.heading,
      ownSpeedWater: own.speedThroughWater,
      truth: {
        time: world.time,
        ownPos: { ...own.pos },
        ownGround: { course: (Math.atan2(ownVel.e, ownVel.n) * (180 / Math.PI) + 360) % 360, speed: length(ownVel) },
        targetPos: t ? { ...t.pos } : null,
        targetCourse: t ? t.course : 0,
        targetSpeed: t ? t.speed : 0,
      },
    };
    this.observations.push(obs);
    return { ok: true, obs };
  }

  deleteLast(): void {
    this.observations.pop();
  }

  clearObservations(): void {
    this.observations = [];
    this.group = 1;
  }

  nextFixGroup(): void {
    this.group++;
  }

  recordClearing(objectId: number, range: number): void {
    this.clearing = { objectId, range };
  }

  toJSON(): unknown {
    return {
      exercise: this.ex.id,
      observations: this.observations,
      clearing: this.clearing,
      finished: this.finished,
      finishReason: this.finishReason,
      minRange: [...this.log.minRange.entries()],
      actions: this.log.actions,
      groundedAt: this.log.groundedAt,
      xteAbsMax: this.log.xteAbsMax,
      meanXte: this.log.meanXte,
    };
  }
}
