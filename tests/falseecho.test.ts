import { describe, expect, it } from "vitest";
import { footOfPerpendicular, mirrorPoint, reflectionPoint, sideOfLine } from "../src/core/falseecho";
import { FALSE_ECHOES, SCENARIOS, createWorld, scanWedge } from "../src/engine/index";
import { scenarioFromJson, scenarioToJson } from "../src/train/scenario-io";

/*
 * Hand-worked geometry.
 * Cable from (-1, 3) to (1, 3): the perpendicular from (0, 0) meets it at (0, 3); from (2, 0) it meets the
 * line at (2, 3), which is beyond the end of the cable.
 * Wall along e = 0.7 from n = 1 to n = 2.5: the mirror image of (0.4, 2) is (1.0, 2). The line from (0, 0)
 * to (1.0, 2) crosses e = 0.7 at n = 1.4, which is on the wall. For a target at (0.4, 6) the image is
 * (1.0, 6) and the crossing is at n = 4.2, off the wall.
 */
describe("false echo geometry (core)", () => {
  const a = { e: -1, n: 3 }, b = { e: 1, n: 3 };
  const w1 = { e: 0.7, n: 1 }, w2 = { e: 0.7, n: 2.5 };
  it("foot of the perpendicular on a cable", () => {
    const f = footOfPerpendicular({ e: 0, n: 0 }, a, b);
    expect(f.point.e).toBeCloseTo(0, 9);
    expect(f.point.n).toBeCloseTo(3, 9);
    expect(f.onSegment).toBe(true);
    const g = footOfPerpendicular({ e: 2, n: 0 }, a, b);
    expect(g.point.e).toBeCloseTo(2, 9);
    expect(g.onSegment).toBe(false);
  });
  it("mirror image in a wall", () => {
    const m = mirrorPoint({ e: 0.4, n: 2 }, w1, w2);
    expect(m.e).toBeCloseTo(1.0, 9);
    expect(m.n).toBeCloseTo(2, 9);
  });
  it("reflecting point: on the wall, off its end, and none from the far side", () => {
    const q = reflectionPoint({ e: 0, n: 0 }, { e: 0.4, n: 2 }, w1, w2)!;
    expect(q.e).toBeCloseTo(0.7, 9);
    expect(q.n).toBeCloseTo(1.4, 9);
    expect(reflectionPoint({ e: 0, n: 0 }, { e: 0.4, n: 6 }, w1, w2)).toBeNull();
    expect(reflectionPoint({ e: 0, n: 0 }, { e: 1.5, n: 2 }, w1, w2)).toBeNull();
    expect(sideOfLine({ e: 0, n: 0 }, w1, w2)).toBe(-sideOfLine({ e: 1.5, n: 2 }, w1, w2));
  });
});

const ship = (id: number, e: number, n: number, rcs = 1) => ({ id, name: `S${id}`, kind: "ship" as const, pos: { e, n }, course: 0, speed: 0, rcs, height: 20, events: [] });
const base = { id: "f", name: "f", description: "", own: { heading: 0, speed: 0 }, coasts: [], env: { seaState: 0 } };
// One turn of the antenna, starting just off the bow so that an echo dead ahead (relative bearing 0) is inside it.
const sweep = (w: ReturnType<typeof createWorld>) => scanWedge(w, 1, 360.5, () => 0.5);
const near = (p: { e: number; n: number }, e: number, n: number, tol = 0.02): boolean => Math.hypot(p.e - e, p.n - n) < tol;

describe("false echoes on the picture (engine)", () => {
  it("an overhead cable paints one echo, square to the cable", () => {
    const w = createWorld({ ...base, targets: [], structures: [{ name: "cable", kind: "power-line", a: { e: -1, n: 3 }, b: { e: 1, n: 3 } }] });
    const hits = sweep(w).filter((h) => h.kind === "power-line");
    expect(hits).toHaveLength(1);
    expect(near(hits[0]!.pos, 0, 3)).toBe(true);
    // From a place whose perpendicular falls beyond the end of the cable there is no echo.
    w.own.pos = { e: 2, n: 0 };
    expect(sweep(w).some((h) => h.kind === "power-line")).toBe(false);
  });
  it("a flat face paints as a line and mirrors a ship behind it", () => {
    const w = createWorld({ ...base, targets: [ship(1, 0.4, 2)], structures: [{ name: "quay", kind: "reflector", a: { e: 0.7, n: 1 }, b: { e: 0.7, n: 2.5 } }] });
    w.radar.controls.rangeNm = 3;
    const hits = sweep(w);
    const image = hits.filter((h) => h.kind === "false");
    expect(image).toHaveLength(1);
    expect(near(image[0]!.pos, 1.0, 2)).toBe(true);
    expect(hits.filter((h) => h.kind === "coast" && Math.abs(h.pos.e - 0.7) < 1e-6).length).toBeGreaterThan(20);
    // No mirror image when the reflecting point would fall off the end of the face.
    w.targets[0]!.pos = { e: 0.4, n: 6 };
    w.radar.controls.rangeNm = 12;
    expect(sweep(w).some((h) => h.kind === "false")).toBe(false);
  });
  it("a strong ship close abeam is painted again astern, in the shadow sector, at the same range", () => {
    const w = createWorld({ ...base, targets: [ship(1, -0.5, 0, 1.5)] });
    w.radar.controls.rangeNm = 1.5;
    const ind = sweep(w).filter((h) => h.kind === "indirect");
    expect(ind).toHaveLength(1);
    expect(near(ind[0]!.pos, 0, -0.5)).toBe(true); // dead astern (the shadow sector is 176 to 184), 0.5 NM
    // A weak or distant target gives none.
    const far = createWorld({ ...base, targets: [ship(1, -8, 0, 1.5)] });
    far.radar.controls.rangeNm = 12;
    expect(sweep(far).some((h) => h.kind === "indirect")).toBe(false);
  });
  it("close to a bridge, the bridge is painted again at twice the range", () => {
    const w = createWorld({ ...base, targets: [], structures: [{ name: "bridge", kind: "bridge", a: { e: -0.9, n: 0.5 }, b: { e: 0.9, n: 0.5 } }] });
    w.radar.controls.rangeNm = 1.5;
    const again = sweep(w).filter((h) => h.kind === "multiple");
    expect(again.length).toBeGreaterThan(0);
    for (const h of again) expect(Math.abs(h.pos.n - 1.0)).toBeLessThan(0.01); // 0.5 NM off: repeated 1.0 NM off
    w.own.pos = { e: 0, n: -2 }; // 2.5 NM off: too far for the repeat
    w.radar.controls.rangeNm = 6;
    expect(sweep(w).some((h) => h.kind === "multiple")).toBe(false);
  });
  it("without structures or a strong close target there are no false echoes", () => {
    const w = createWorld({ ...base, targets: [ship(1, 0, 6)] });
    w.radar.controls.rangeNm = 12;
    expect(sweep(w).some((h) => h.kind === "false" || h.kind === "indirect" || h.kind === "power-line")).toBe(false);
  });
});

describe("the false echoes scenario", () => {
  it("is listed, shows the cable echo dead ahead at 3 NM, and its structures survive saving", () => {
    expect(SCENARIOS).toContain(FALSE_ECHOES);
    const w = createWorld(FALSE_ECHOES);
    const cable = sweep(w).filter((h) => h.kind === "power-line");
    expect(cable).toHaveLength(1);
    expect(near(cable[0]!.pos, 0, 3)).toBe(true);
    expect(sweep(w).some((h) => h.kind === "false")).toBe(true);
    const back = scenarioFromJson(scenarioToJson(FALSE_ECHOES));
    expect("scenario" in back && back.scenario.structures).toEqual(FALSE_ECHOES.structures);
    const bad = JSON.parse(scenarioToJson(FALSE_ECHOES));
    bad.structures[0].kind = "pylon";
    const r = scenarioFromJson(JSON.stringify(bad));
    expect("errors" in r && r.errors.some((e) => e.includes("structure"))).toBe(true);
  });
});
