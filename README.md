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
Three robots (careful, wrong, idle) work all 21 ARPA, radar and plotting exercises and the marking is
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
Target tracks (`src/core/route.ts`, `src/engine/world.ts`): the instructor can programme a track of up to 20
waypoints for any target; 100 targets run together (scenario "Traffic: 100 ships on programmed tracks").
Replay runs from 0.25x (slow motion) to 60x.
Realism (13 Nov 2026): false echoes (`src/core/falseecho.ts`: power line, bridge, mirror images, indirect echoes),
own ship in a seaway (`src/core/seaway.ts`: roll, pitch, yaw; estimated response), true-motion picture driven by the
speed input, target tracks that allow for current. Radar beamwidths and pulse settings are from one maker's published
specification; two own-ship types are fitted to published figures (see `PUBLISHED` in `src/core/shipmodel.ts`).
`npm run test:screen` checks the built page in a headless browser (needs Playwright).
Explanatory text is hidden until HELP is pressed. The layout is our own arrangement
(`src/ui/console-ui.ts`), not a copy of any maker's screen.

## Develop

    npm install
    npm test            # 405 tests
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
