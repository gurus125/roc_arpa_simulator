# Phase 2: instructor check sheet (radar display)

Open `dist/radar-simulator.html`. Please judge whether the picture teaches what your course teaches.
Everything below is a TEACHING MODEL tuned to show the effects in the ROC handout. The numbers
are placeholders until you confirm or correct them.

## Model values to confirm

| Item | Value in the simulator |
|------|------------------------|
| Range scales | 0.5, 1.5, 3, 6, 12, 24 NM |
| Ring spacing | 0.1, 0.25, 0.5, 1, 2, 4 NM (one per scale) |
| Antenna speed | 24 rpm |
| Antenna height | 18 m |
| Radar horizon | 2.2 x (sqrt of antenna height + sqrt of target height), doubled in ducting |
| Large ship (tuned, gain 50) detected out to | about 17 NM |
| Lighthouse / coast | about 13 NM / 11 NM |
| Small craft (reflectivity 0.05) | about 4 NM |
| Buoy (reflectivity 0.015) | about 2 NM |
| Minimum range | 0.03 NM on 3 NM scale and below, 0.07 NM above |
| Blind sector (mast or funnel) | 176 to 184 degrees relative, 5 percent of normal signal |
| Multiple echoes | large, close ships (under 1.5 NM) show repeats at 2x and 3x range |
| Side-lobe echoes | very strong ships within 3 NM show weak echoes 9 degrees either side |
| Own ship turn rate / acceleration | 2 degrees per second / 0.1 knot per second |

## What to try, and what you should see

1. Gain: 0 shows almost nothing, 100 fills the screen with noise.
2. Tuning: watch the meter. A badly tuned set loses weak echoes.
3. Sea state 6, STC 0: a patch of clutter round own ship. Raise STC: the clutter goes,
   and small close targets (buoy, yacht) go with it if you overdo it.
4. Rain squall, then FTC: rain speckle goes, genuine echoes weaken slightly.
5. Head-up, north-up, course-up: does the bearing scale read correctly in each?
6. True motion: own ship moves across the screen and resets at about two thirds of the radius.
7. Sea against ground stabilised in the coastal scenario (current 045 at 1.5 kn): fixed objects
   slide on a sea-stabilised true-motion display and stay still on a ground-stabilised one.
8. Trails: relative trails of a crossing ship should be a straight line toward or past own ship.
9. Coastal scenario: headlands hide the coast and objects behind them.
10. Click on a target: EBL and VRM jump to it, and the readout gives range and bearing.

## Questions for you

1. Are the ranges, ring spacings and 24 rpm what your simulator uses?
2. Is a head-up display unstabilised (swings with yaw) in your equipment? Here it is.
3. Detection ranges: too long or too short for the targets above?
4. Is the shadow sector astern a realistic teaching example, or should it be elsewhere?
5. Are the multiple-echo and side-lobe conditions reasonable?

## Not in phase 2 yet (on purpose)

- Gyro and speed-log faults (phase 4, with ARPA).
- Ducting only extends the detection horizon. Echoes at wrong ranges, bending and other
  anomalies are not modelled yet.
- Indirect (reflected) echoes and second-trace echoes beyond multiple echoes.
- Plotting board and manual plotting tools (phase 3), ARPA vectors and tracking (phase 4).
- Only one EBL and one VRM.
- Real-browser testing: the page was checked by drawing it on a test canvas and driving every
  control in a simulated browser, but not yet on your screen. Tell me what looks wrong.
