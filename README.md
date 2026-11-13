# ROC + ARPA radar simulator

Training and study tool. Not for navigation.

## See it running

Open `dist/radar-simulator.html` in a browser (double-click it). Nothing else is needed.
The **Radar** tab is free practice. The **ROC exercises** tab has the six exercises: manual plotting,
position fixing, set and drift, clearing range, blind pilotage and heavy-traffic collision avoidance.
The **ARPA** tab adds target acquisition (manual and automatic), vectors, guard zones, exclusion
areas, CPA/TCPA alarms, the trial manoeuvre and instructor fault injection (gyro and log errors).
ARPA is switched off during ROC exercises.

## Screen layout

Console style: the radar picture on the left; on the right a data panel that is always in view
(range, rings, heading, speeds, mode, band and pulse, vectors, stabilisation, CPA/TCPA limits,
past positions, trails, EBL/VRM, cursor, targets, simulator time, alarm), then Run / speed /
radar standby, then a grid of menu keys. Only the controls of the chosen key are shown.
Always in view as separate boxes: DISPLAY (range, rings, orientation, motion, stabilisation,
trails), OWN SHIP, CURSOR, EBL / VRM (tick boxes with readouts; a ticked line follows the cursor,
double-click locks it), GAIN / CLUTTER (gain, sea, rain, tune, each clutter control with AUTO;
the automatic settings are placeholders), TARGETS (Acquire / Select / Cancel / Measure),
VECTORS (buttons, no typing), TARGET DATA for the selected ARPA target and AIS TARGET DATA for
the selected AIS target (Select, then click the AIS symbol).
PPC / PAD keys in VECTORS draw potential points of collision or predicted areas of danger for
steady tracks (the PAD is a simplified hexagon; makers' shapes differ). ARPA > Speed log input
has "Manual speed". Own ship has a manoeuvring model (`src/core/shipmodel.ts`): four ship types, autopilot or hand
steering with a rudder that moves at a limited rate, engine telegraph, turning circle, speed loss
in a turn, long run-on with the engine stopped, wind (leeway and relative wind readout). The
coefficients are placeholders chosen to meet the IMO manoeuvrability criteria, not trial data.
Target catalogue (`src/engine/targets.ts`): 28 vessel types plus buoy and beacon. A catalogue
target turns and changes speed gradually, is set by the current and blown by the wind. Figures
are placeholders. Scenario "Ship types" shows one of each. X BAND / S BAND keys are in the DISPLAY box.
Manual plotting exercises 12 to 21 (`src/train/plotting-exercises.ts`): ARPA off, plot for 12 minutes,
then manoeuvre for a 1 NM CPA; result as a percentage of the required CPA, 80% needed. Form and marking
follow the Learnmarine plotting trainer the academy supplied as a reference; the situations are our own.
RINGS on/off and DAY/NIGHT keys; 30-minute trails.
Self-test (`src/train/robot.ts`): Instructor page > "Self-test of the exercises", or `npm run selftest`.
Three robots (careful, wrong, idle) work all 22 ARPA, radar and plotting exercises and the marking is
compared with what should happen. It checks that the exercises run and are marked properly, not that
the answer key is good seamanship. ROC exercises are not included.
SETTINGS key: DAY / NIGHT display palettes (`src/ui/palette.ts`; day is dark blue with yellow echoes,
night is black and dimmed) and Own ship data (name, call sign, IMO, MMSI, size, type; live position,
COG, SOG, heading, ROT, UTC; draught, hazardous cargo, destination, ETA). Typed-in values start as
placeholders and are kept on the computer. The position is counted from a made-up origin.
Radar picture (`src/engine/echo.ts`): echoes are painted as arcs as wide as the beam plus the target and
as deep as the pulse plus the target, so range and bearing discrimination, sideways stretch with range,
aspect, and land depth appear on the picture. Beam = length / 7, aspect curve and land depth are placeholders.
Sound signals (`src/core/signals.ts`): COLREG rule 34 and 35 whistle signals, automatic fog signal.
Learner's manual: `docs/USER-MANUAL.md`. Instructor's operation manual: `docs/INSTRUCTOR-MANUAL.md`.
Checked against the textbook "Radar and ARPA Manual" (Bole and Dineley, 1990): `docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md`.
From that check: the target's aspect in the plot report (`aspectOf` in `src/core/plot.ts`), sub- and super-refraction
and the 2.21 radar horizon (`src/engine/signal.ts`), sea clutter stronger to windward and with a longer pulse, and the
ARPA's anchor watch, safe limit vector suppression and trial alarm (`src/arpa/tracker.ts`). Tests: `tests/bole.test.ts`.
Target tracks (`src/core/route.ts`, `src/engine/world.ts`): the instructor can programme a track of up to 20
waypoints for any target; 100 targets run together (scenario "Traffic: 100 ships on programmed tracks").
Replay runs from 0.25x (slow motion) to 60x and shows the trainee's radar picture, recorded every 15 seconds
(`src/train/record.ts`, `src/ui/picture-store.ts`; pictures are kept in the browser's IndexedDB).
Realism (12 Nov 2026): false echoes (`src/core/falseecho.ts`: power line, bridge, mirror images, indirect echoes),
own ship in a seaway (`src/core/seaway.ts`: roll, pitch, yaw; estimated response), true-motion picture driven by the
speed input, target tracks that allow for current. Radar beamwidths and pulse settings are from one maker's published
specification; three own-ship types are fitted to published turning figures (see `PUBLISHED` in `src/core/shipmodel.ts`).
Real areas (13 Nov 2026): Mumbai, Mormugao (Goa), Kochi and the Gulf of Kutch (Mundra, Kandla) have their real
coastline and real land heights. The radar sees the land ray by ray with the Earth's curve and refraction: radar
shadow behind high land, high ground showing first and low coast later, each piece returning by the face it shows the
radar, calibrated to IEC 62388 Tables 2 and D.7 (`src/engine/terrain.ts`; one placeholder, `LAND_REFLECTIVITY`).
Ships behind land are hidden, from the radar and the ARPA, on drawn coastlines too, and there is no sea clutter on
land. Vessels paint with their class's typical beam, and beam-on against end-on follows IEC 62388 Table D.1. See
`docs/RADAR-PICTURE.md`. Coastlines: `src/engine/real-coasts.ts`, made by `scripts/make-coast.mjs` from the geo-maps
"earth-coastlines-250m" data set, (c) OpenStreetMap contributors, Open Database License (ODbL) 1.0,
https://www.openstreetmap.org/copyright, about 250 m accuracy. Land heights: `src/engine/real-terrain.ts`, made by
`scripts/make-terrain.mjs` from Copernicus DEM GLO-90, (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH
2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved. No depths, lights or buoys.
None of it is a chart.
Symbols follow IMO SN.1/Circ.243/Rev.2 (`src/ui/arpa-view.ts`) and alerts follow IMO MSC.302(87)
(`src/arpa/alerts.ts`: alarm, warning and caution priorities, acknowledged one at a time).
Checked against IEC 62388:2013 (shipborne radar) and IEC 62288:2014 (presentation) on 13 Nov 2026: see
`docs/IEC-CHECK.md` for what was changed (own ship's symbol, bearing scale, graphics-off key, EBL true/relative,
brilliance and AIS as primary controls, processing status, CTW/STW and COG/SOG, capacity caution, alert signals and
colours, lost target warning switch, heading-failure fallback, default settings, AIS filter and data) and for what
is still not met. Tests: `tests/iec.test.ts` (with the standard's TT scenario 1) and `tests/pub1310.test.ts`.
Second round from the same standards: radar power states (off, 90 s warm-up, standby, transmit: `src/engine/power.ts`),
radar exercise 22 "Switching on and setting up the radar" (`src/train/radar-exercises.ts`, limits in `SETUP_LIMITS`),
parallel index lines cut short and set parallel to the heading, EBL origin carried or fixed, two stored user settings,
and AIS: Table 27 reporting and lost times, rate of turn and turn indicator, capacity, automatic activation, past
positions, outlines to scale and the trial manoeuvre (`src/ais/index.ts`; tests `tests/ais-iec.test.ts`,
`tests/setup-exercise.test.ts`).
Third round: the ARPA's measurement errors are the IEC 62388 Annex E figures, with the bearing error from the
antenna tilting as own ship rolls and pitches (`src/arpa/plots.ts`); TT scenario 1 now meets every limit; TT
scenarios 2 to 5 run as tests (`tests/iec-tt.test.ts`), met after the tracker was given an adaptive window that
drops old plots when a target manoeuvres (`src/arpa/tracker.ts`, `manoeuvreTestSec` in `src/arpa/config.ts`); a
fading target (`paint` in a scenario); AIS class B with its Table 27 rates; further AIS data on request (MORE in
the target data: class, IMO number, type, destination, ETA, draught, size, position accuracy, MISSING where not
sent); own ship's AIS data; the sleeping-target filter by range, CPA, TCPA, speed and class; and the setting-up
exercise's limits set by the instructor.
Hardware control panel: keys for every radar function, changeable, and knob-box (game controller) inputs
(`src/ui/panel-map.ts`, `src/ui/panel.ts`; SETTINGS > Control panel). No real panel has been tried.
`npm run test:link` starts the classroom server and checks an instructor and four student displays in separate
browsers (needs Playwright). Separate PCs on a network have not been tried.
`npm run test:screen` checks the built page in a headless browser (needs Playwright).
Explanatory text is hidden until HELP is pressed. The data area (`src/ui/console-ui.ts`, styles in
`src/ui/index.template.html`) is laid out the way ships' radars in general present their data: heading and
speed in large figures with their sensor, position, cursor and target data as label, value and unit, settings in
boxes that are clicked, gain and clutter as bars, short status lines in the corners of the picture, and the
standard abbreviations of IMO SN.1/Circ.243/Rev.2. It is drawn larger on a large screen. It is a generic
arrangement of our own, not a copy of any maker's screen, and no radar instructor has reviewed it.

## Develop

    npm install
    npm test            # 508 tests
    npm run typecheck
    npm run build       # rebuilds dist/radar-simulator.html

- `src/core`    navigation maths (phase 1)
- `src/engine`  world simulation, radar signal model, display frames, scenarios (phase 2)
- `src/roc`     ROC exercises, sessions and scoring (phase 3)
- `src/arpa`    ARPA plot extractor, tracker, alarms and trial manoeuvre (phase 4)
- `src/ui`      the PPI screen, control panel, ROC exercise tab and ARPA tab

See `PLAN.md` for the full build plan.

## Added in phases 5 to 8

- **ARPA exercises** tab: nine exercises with automatic checking and debrief questions.
- **Instructor** tab (PIN 0000 at first): batches, assignments, event injection, monitoring,
  records, replay, CSV and printable reports, scoring settings, scenario editor.
- `npm run serve` starts a small classroom server so the instructor can monitor other PCs.
  Open the address it prints on every display. Classroom network only: it has no security.

See `docs/PHASE5-8-INSTRUCTOR-CHECK.md`. Nothing here is certified or approved for navigation.

## Checked against the IMO documents

`docs/COMPLIANCE-MATRIX.md` lists every function of IMO A.823(19) (ARPA), MSC.192(79) (radar)
and Model Courses 1.07 and 1.08 against what the simulator does. It is a list of simulated
functions, not a certificate. Added from that check: AIS targets on the radar, racon and SART,
second EBL and VRM, offset EBL, parallel index lines, off-centring, all eight range scales,
X/S band, ARPA data on/off and brilliance, EPFS ground stabilisation, speed log failure, and a
test of ARPA accuracy in the four IMO scenarios.
