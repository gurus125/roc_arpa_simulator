import { TidalDiamond, TideHeights } from "../core/tide";
import { Vec2 } from "../core/vec";

/**
 * Tidal streams and tide heights of the four real areas, for training ONLY.
 *
 * INVENTED: the streams and heights are NOT taken from any chart or tide table (the real figures are on the
 * Admiralty and NHO charts and in the tide tables, which may not be copied here). They are believable in kind: the
 * flood running into each port or up the gulf, the ebb out, strongest about three hours either side of high water,
 * the large ranges of the Gulf of Kutch and the small ones of Kochi. The academy can replace any figure with its own
 * (Scenario env.tide). Every diamond's table is shown with the words "invented for training".
 */
export const AREA_TIDE_NOTE = "Tidal streams and heights INVENTED for training: not from any chart or tide table. Not for navigation.";

/** A rectilinear stream: running towards `flood` (degrees) before HW and the opposite way after, slack `lagH` hours after HW and HW-6. */
function diamond(id: string, pos: Vec2, flood: number, spring: number, neap: number, lagH: number): TidalDiamond {
  const hours = [];
  for (let h = -6; h <= 6; h++) {
    const f = -Math.sin((Math.PI * (h - lagH)) / 6.21);
    const r1 = (x: number): number => Math.round(Math.abs(f) * x * 10) / 10;
    hours.push({ set: f >= 0 ? flood : (flood + 180) % 360, spring: r1(spring), neap: r1(neap) });
  }
  return { id, pos, hours };
}

export interface AreaTide {
  /** Name of the reference port whose high water the tables are hours from. */
  port: string;
  diamonds: TidalDiamond[];
  heights: TideHeights;
}

export const AREA_TIDES: Record<string, AreaTide> = {
  mumbai: {
    port: "Mumbai",
    diamonds: [diamond("A", { e: 4, n: 1 }, 60, 1.6, 0.8, 0), diamond("B", { e: 10, n: -3 }, 30, 1.4, 0.7, 0.5), diamond("C", { e: 8, n: 6 }, 75, 1.8, 0.9, 0.5)],
    heights: { mhws: 4.4, mhwn: 3.3, mlwn: 1.9, mlws: 0.8 },
  },
  goa: {
    port: "Mormugao",
    diamonds: [diamond("A", { e: 5, n: 0 }, 80, 1.0, 0.5, 0), diamond("B", { e: 10, n: 3 }, 100, 0.8, 0.4, 0.5), diamond("C", { e: 9, n: -5 }, 40, 0.9, 0.4, 0.5)],
    heights: { mhws: 2.0, mhwn: 1.5, mlwn: 0.9, mlws: 0.4 },
  },
  kochi: {
    port: "Kochi",
    diamonds: [diamond("A", { e: 6, n: 1 }, 95, 0.8, 0.4, 0), diamond("B", { e: 11, n: -3 }, 340, 0.6, 0.3, 0.5), diamond("C", { e: 10, n: 5 }, 160, 0.6, 0.3, 0.5)],
    heights: { mhws: 1.0, mhwn: 0.8, mlwn: 0.5, mlws: 0.3 },
  },
  kutch: {
    port: "Kandla",
    diamonds: [diamond("A", { e: -8, n: 1 }, 70, 3.0, 1.5, 0), diamond("B", { e: 0, n: 1 }, 75, 3.2, 1.6, 0.5), diamond("C", { e: 8, n: 2 }, 80, 3.4, 1.7, 1)],
    heights: { mhws: 6.6, mhwn: 5.0, mlwn: 2.2, mlws: 0.8 },
  },
};
