import { CourseSpeed, Vec2, angleDiffDeg, bearingOf, normalizeDeg } from "./vec";

export type Situation = "overtaking" | "overtaken" | "head-on" | "crossing";
export type Role = "give-way" | "stand-on" | "both-give-way";

export interface ColregHint {
  situation: Situation;
  ownRole: Role;
  /** Rule number from COLREGs 1972 that the hint is based on. */
  rule: 13 | 14 | 15 | 16 | 17;
  /** Short teaching note. */
  note: string;
}

/** Sector limit for Rule 13: more than 22.5 degrees abaft the beam = 112.5 degrees from ahead. */
const ABAFT_BEAM = 112.5;
/** "End-on or nearly end-on" tolerance for Rule 14, degrees either side of the bow. */
export const HEAD_ON_TOLERANCE_DEG = 6;

/**
 * Teaching hint for a two-vessel encounter in sight of one another (Rules 13-17).
 *
 * This is a decision hint only. It does NOT cover restricted visibility (Rule 19),
 * traffic separation schemes (Rule 10), narrow channels (Rule 9), vessels restricted in
 * their ability to manoeuvre (Rule 18), or any special circumstances. Students must
 * still apply judgement, and the instructor decides the official answer.
 */
export function classifyEncounter(
  relPosOfTarget: Vec2,
  own: CourseSpeed,
  target: CourseSpeed,
  headOnToleranceDeg: number = HEAD_ON_TOLERANCE_DEG,
): ColregHint {
  const bearingToTarget = bearingOf(relPosOfTarget);
  const bearingToOwn = normalizeDeg(bearingToTarget + 180);

  /** Target's bearing as seen from own bow, 0..360 clockwise. */
  const targetFromOwnBow = normalizeDeg(bearingToTarget - own.course);
  /** Own ship's bearing as seen from the target's bow, 0..360 clockwise. */
  const ownFromTargetBow = normalizeDeg(bearingToOwn - target.course);

  const inSternSector = (rb: number): boolean => rb > ABAFT_BEAM && rb < 360 - ABAFT_BEAM;

  if (inSternSector(ownFromTargetBow)) {
    return {
      situation: "overtaking",
      ownRole: "give-way",
      rule: 13,
      note: "Own ship is coming up on the target from more than 22.5° abaft its beam. Own ship is the overtaking vessel and keeps clear (Rule 13).",
    };
  }
  if (inSternSector(targetFromOwnBow)) {
    return {
      situation: "overtaken",
      ownRole: "stand-on",
      rule: 13,
      note: "The target is coming up from more than 22.5° abaft own beam. Own ship stands on, and the target keeps clear (Rules 13 and 17).",
    };
  }

  const aheadOwn = Math.abs(angleDiffDeg(targetFromOwnBow, 0));
  const aheadTgt = Math.abs(angleDiffDeg(ownFromTargetBow, 0));
  if (aheadOwn <= headOnToleranceDeg && aheadTgt <= headOnToleranceDeg) {
    return {
      situation: "head-on",
      ownRole: "both-give-way",
      rule: 14,
      note: "Meeting end-on or nearly end-on. Each vessel alters course to starboard to pass port to port (Rule 14).",
    };
  }

  if (targetFromOwnBow < 180) {
    return {
      situation: "crossing",
      ownRole: "give-way",
      rule: 15,
      note: "Crossing, with the target on own starboard side. Own ship gives way and avoids crossing ahead of the target if possible (Rules 15 and 16).",
    };
  }
  return {
    situation: "crossing",
    ownRole: "stand-on",
    rule: 17,
    note: "Crossing, with the target on own port side. Own ship stands on, keeping course and speed, and watches for the target's action (Rules 15 and 17).",
  };
}


export interface Rule19Finding {
  ok: boolean;
  /** Plain-language reasons when not ok. */
  faults: string[];
}

/**
 * Rule 19(d) check for an avoiding ALTERATION OF COURSE made on radar information alone
 * (restricted visibility, vessels not in sight of one another). So far as possible avoid:
 *  (i) an alteration to PORT for a vessel forward of the beam, other than one being overtaken;
 *  (ii) an alteration TOWARDS a vessel abeam or abaft the beam.
 *
 * `turnDeg` is the alteration (+ starboard, - port). Each entry of `targets` is a vessel with
 * which a close-quarters situation is developing: its relative bearing from own bow (0 to 360)
 * and whether own ship is overtaking it. A speed change alone (turnDeg = 0) is never a fault here.
 */
export function rule19Check(turnDeg: number, targets: { relBearing: number; beingOvertaken?: boolean }[]): Rule19Finding {
  const faults: string[] = [];
  if (Math.abs(turnDeg) < 1e-9) return { ok: true, faults };
  for (const t of targets) {
    const rb = ((t.relBearing % 360) + 360) % 360;
    const forward = rb < 90 || rb > 270;
    if (forward) {
      if (turnDeg < 0 && !t.beingOvertaken) faults.push("Alteration to port for a vessel forward of the beam (Rule 19(d)(i)).");
    } else {
      const onStarboard = rb >= 90 && rb <= 180;
      const towards = onStarboard ? turnDeg > 0 : turnDeg < 0;
      if (towards) faults.push("Alteration towards a vessel abeam or abaft the beam (Rule 19(d)(ii)).");
    }
  }
  return { ok: faults.length === 0, faults: [...new Set(faults)] };
}
