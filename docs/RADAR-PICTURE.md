# The radar picture: land, echo sizes and the real areas

Written 13 Nov 2026. How the simulator builds the land on the picture, where the data comes from,
what is a placeholder, and what is still missing. No radar instructor has yet compared the picture
with a real set on these coasts; until one has, treat it as a careful model, not a verified one.

## Real areas

Four areas have their real coastline and real land heights:

| Scenario | Area (box) | Origin of the frame | Highest ground |
|----------|------------|---------------------|----------------|
| Approaches to Mumbai | 18.45-19.35 N, 72.3-73.1 E | 18°50'N 072°30'E | 484 m |
| Approaches to Mormugao, Goa | 15.0-15.8 N, 73.35-74.15 E | 15°25'N 073°30'E | 843 m |
| Approaches to Kochi | 9.55-10.35 N, 75.75-76.55 E | 09°58'N 075°55'E | 664 m |
| Gulf of Kutch: Mundra and Kandla | 22.35-23.2 N, 69.2-70.45 E | 22°36'N 069°36'E | 429 m |

Positions on the console (latitude and longitude) are worked from the scenario's own origin. The
ships, wind, current and tidal stream in these scenarios are invented. There are no depths, lights,
buoys or traffic separation schemes: none of this is a chart, and none of it is for navigation.

**Data and credit.**

- Coastlines and land/water: the geo-maps "earth-coastlines-250m" data set, made from OpenStreetMap.
  © OpenStreetMap contributors, Open Database License (ODbL) 1.0. About 250 m accuracy.
- Land heights: Copernicus DEM GLO-90 (3 arc-seconds, about 90 m). © DLR e.V. 2010-2014 and © Airbus
  Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all
  rights reserved. Free to use, also commercially, with this credit. It is a *surface* model: the
  heights include buildings and trees, which is what a radar sees.

The credit is shown in each real-area scenario's description. `src/engine/real-coasts.ts` is made by
`scripts/make-coast.mjs` and `src/engine/real-terrain.ts` by `scripts/make-terrain.mjs` (both explain
how to run them; the download of the height tiles is in the instructor manual). The heights are
resampled to a grid of 0.1 NM, each node taking the highest ground within half a cell; land and water
come from the coastline polygons on a grid of 0.05 NM. Packed, the four areas add about 460 KB to the
simulator file.

## How the land is painted

For an area with heights, the picture is worked out ray by ray, every 0.25° of bearing, outward from
own ship (`src/engine/terrain.ts`, `terrainLandHits` in `src/engine/scan.ts`):

1. **Earth's curve and refraction.** A point of height h at distance d is seen at the elevation
   angle (h - d²/2Re - ha)/d, with ha the antenna height and Re the effective Earth radius: 4/3 of the
   real one in the standard atmosphere. Sub-refraction, super-refraction and ducting change Re to
   match the detection-range factors already used for targets (0.8, 1.4 and 2 on the horizon).
2. **Radar shadow.** Land seen at a lower angle than nearer land is in its shadow and paints
   nothing. So a headland hides the bay behind it, a low coast behind high islands is not seen, and
   the back slopes of hills are dark.
3. **What shows first.** Far off, only high ground shows above the horizon; low land comes up as
   the ship closes. This is the effect the Radar and ARPA Manual (3rd edition, 3.8.1) warns about:
   the first land seen is often high ground inland, not the coastline, and the coast seems to come
   towards the ship.
4. **How strongly each piece returns.** In proportion to the face it shows the radar: its exposed
   height (the whole height for land rising from the water; for land behind other land, only the part
   above the line that grazes the nearer land) times the width of the beam at that range. A cliff
   facing the radar returns strongly; flat land far off shows almost no face and returns little. This
   is the constant-gamma model of land clutter. The pieces within one pulse length return together,
   so a longer pulse paints land more strongly.
5. **Calibration.** IEC 62388 Table D.7 gives the reference shorelines' radar cross-sections (2 500,
   5 000 and 50 000 m² for shorelines rising to 3, 6 and 60 m: 833 m² per metre of height) and Table 2
   their ranges of first detection (6, 8 and 20 NM). A piece of land's range of first detection is the
   reference shoreline's of the same height, scaled by the fourth root of the ratio of the
   cross-sections (the radar equation). With a reflectivity of 1, a 60 m cliff at 20 NM comes out at
   19.8 NM, which is Table 2.
6. **Land reflectivity: PLACEHOLDER = 10.** Table 2 is the least a radar with the smallest antenna
   must do. The simulator's larger ships are already detected close to their radar horizon, so land is
   given ten times the reference reflectivity, which brings substantial land close to its horizon too.
   This one figure (`LAND_REFLECTIVITY` in `src/engine/terrain.ts`) sets how far off land is first seen
   and should be set by an instructor who knows how these coasts paint on a real set.

The receiver controls act on land as on any echo: gain, sea clutter (STC), rain clutter (FTC), the
seaway's tilt of the beam, rain attenuation and the shadow sectors.

**Ships behind land.** A ship is now hidden when land between is seen at least as high as the ship's
top (with the Earth's curve). This applies to the real areas and also to the drawn coastlines of the
other scenarios, each coast at its own height. Before, ships were painted through land. The ARPA
gets no plot from a hidden ship, so a ship that goes behind an island is lost and must be
re-acquired, as on a real set.

**Sea clutter** is no longer painted on land, nor on water in the shadow of land.

**Drawn coastlines** (the invented scenarios) are painted as before: from points along the
shoreline at the coast's stated height, with land behind them hiding what lies further back.

## Echo sizes

- **Width of a vessel.** Each catalogue type now has the typical beam of its class (`TYPICAL_BEAM_M`
  in `src/engine/targets.ts`: for example 32.3 m for a Panamax bulk carrier, 60 m for a VLCC, 4 m for a
  12 m fishing boat). The echo of a vessel end-on and its AIS outline use it. A target of no type keeps
  a beam of a seventh of its length (a placeholder).
- **Aspect.** How much more a ship returns beam-on than end-on now follows the measured ships of IEC
  62388 Table D.1: the median of their ratios of largest to smallest cross-section is 12 (11 dB). In the
  simulator's echo strengths that is a factor of 3.46 between end-on (0.39) and beam-on (1.35),
  averaging 1. Before, the factor was 0.6 to 1.4, a guess.
- **Detection ranges of the catalogue types** are still estimates, between the IEC 62388 Table 2
  minimums and the radar horizon.

## Still missing or simplified

- Land cover: towns, port cranes, tank farms and forest return more than open ground of the same
  shape, and mudflats and sand less. The surface model gives buildings and trees their height, but at
  90 m cells tall single buildings are averaged down. There is no separate land-cover data.
- Only four real areas. Others need their coastline and height tiles and a run of the two scripts.
- Beyond the edge of an area's box there is no land.
- The real areas have no buoys, lights, racons, port structures or charted depths.
- Multipath (the lobing of the beam over the sea) is in the Table 2 calibration only, not modelled
  as such.
- Placeholders: `LAND_REFLECTIVITY` (10), the beam of untyped vessels (a seventh of the length), the
  aspect curve's shape between end-on and beam-on.
