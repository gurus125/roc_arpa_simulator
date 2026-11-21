# ROC + ARPA radar simulator

Training and study tool. Not for navigation.

## See it running

Open `dist/radar-simulator.html` in a browser (double-click it). Nothing else is needed. It opens as a
student display: free practice, the radar and ARPA, and the exercises (EXERCISE tab, ARPA EX and ROC EX
in the menu, or the ship control window). The six ROC exercises are manual plotting, position fixing,
set and drift, clearing range, blind pilotage and heavy-traffic collision avoidance; ARPA is switched
off during them. The instructor station is the same file opened as `radar-simulator.html#instructor`. Opened as
`radar-simulator.html#demo` it is a display on which a robot student, of a level from 1 to 5, works any of the 32 exercises
with the display's own controls while the class watches (see the instructor's manual, 10a).

Hosted on a web site (Vercel: `vercel.json` builds it and serves it at `/`, and at `/instructor` for the
station): the page works the same, but a hosted copy has no classroom server, so the station and the
displays link only within one browser on one computer. For a class on several PCs run `npm run serve` on
one of them (see below).

## Screen layout

The radar picture in the middle, as tall as the window allows, with three data panels down each side
of it that are always in view. Left: PICTURE & RADAR CONTROL (radar on / standby, range, rings, band, AIS, orientation,
motion, stabilisation, resets, pulse length), GAIN / CLUTTER (gain, sea, rain, tune, each clutter
control with AUTO, the automatic settings being placeholders; brilliance; trails) and EBL / CURSOR
(tick boxes with readouts, a ticked line following the cursor until a double-click locks it; the
cursor's bearing, range and position; the PI / MAP key). Right: OWN SHIP DATA, TARGET DATA (the list of
tracked targets, then the selected ARPA or AIS target) and VRM / ARPA (VRMs, vectors, PPC / PAD, CPA / TCPA
limits, the ARPA's status, ALARM ACK and the alert, Acquire / Select / Cancel / Measure, MENU).
No settings are written over the picture (IEC 62288 4.3.3, 5.5.14); a target's data label appears beside
it only when the target is clicked, and goes when it is clicked again. MENU opens a drawer over the
right-hand side with a grid of menu keys; only the controls of the chosen key are shown, and
CLOSE or Esc closes it. SHIP CONTROL in the header opens the ship control window
(`src/ui/ship-window.ts`) for a second screen: steering (autopilot or hand, set course, rudder indicator,
pump 2), engine telegraph, engine order, anchor and MOB key, own ship's data, and the exercises (choice, briefing,
assessment, answers, finish, result, ROC worksheets). It is a view of the same page: the page's own controls
are moved into it while it is open and back when it closes, so there is one simulation and one record; and
while it is in front it keeps the clock running if the radar window is hidden. The page header has the RADAR / ARPA / EXERCISE tabs (they open those menus), the
simulator keys (pause, speed, day / night), the ship's clock (UTC), the state of the alerts, settings,
help and change students; the foot has a legend of the symbols and "training simulator, not type
approved, not for navigation". Colours (the institute's scheme of 13 Nov 2026): navy #061329 / #0A1D3A,
borders #24466F, cyan #00BFFF for what is selected or on, teal #00D6C9, amber echoes #FFC928 (land dimmer),
green #20D98A normal, orange #FF9F1C warning, red #FF3B4E alarm, text #EAF2FF / #91A8C5. The IMO symbols are kept.
PPC / PAD keys in the VRM / ARPA panel draw potential points of collision or predicted areas of danger for
steady tracks (the PAD is a simplified hexagon; makers' shapes differ). ARPA > Speed log input
has "Manual speed". Own ship has a manoeuvring model (`src/core/shipmodel.ts`): four ship types, autopilot or hand
steering with a rudder that moves at a limited rate, engine telegraph, turning circle, speed loss
in a turn, long run-on with the engine stopped, wind (leeway and relative wind readout). The
coefficients are placeholders chosen to meet the IMO manoeuvrability criteria, not trial data.
Target catalogue (`src/engine/targets.ts`): 28 vessel types plus buoy and beacon. A catalogue
target turns and changes speed gradually, is set by the current and blown by the wind. Figures
are placeholders. Scenario "Ship types" shows one of each. BAND X / S keys are in the PICTURE & RADAR CONTROL panel.
Manual plotting exercises 12 to 21 (`src/train/plotting-exercises.ts`): ARPA off, plot for 12 minutes,
then manoeuvre for a 1 NM CPA; result as a percentage of the required CPA, 80% needed. Form and marking
follow the Learnmarine plotting trainer the academy supplied as a reference; the situations are our own.
RINGS on/off and DAY/NIGHT keys; 30-minute trails.
Self-test (`src/train/robot.ts`): instructor station, EXERCISES, "Self-test of the exercises", or `npm run selftest`.
Three robots (careful, wrong, idle) work all 26 ARPA, radar and plotting exercises and the marking is
compared with what should happen. It checks that the exercises run and are marked properly, not that
the answer key is good seamanship. ROC exercises are not included.
Robot student (`src/train/robot-student.ts`, on the screen `src/ui/robot-ui.ts`): `radar-simulator.html#demo`. A robot of
level 1 to 5 works any of the 32 exercises with the display's own controls (pointer, caption, log); levels below 5 make
mistakes on purpose, each one logged; the chances are chosen for the demonstration (`ROBOT_LEVELS`). Its records are
marked and left out of every trainee's file and progress. Tests: `tests/robot-student.test.ts` (all 32 at level 5, worked
directly) and `node scripts/robot-demo-test.mjs` (all 32 through the screen, in a headless browser, after `npm run build`).
SETTINGS key: DAY / NIGHT display palettes (`src/ui/palette.ts`; day is deep navy with amber echoes,
night is black and dimmed) and Own ship data (name, call sign, IMO, MMSI, size, type; live position,
COG, SOG, heading, ROT, UTC; draught, hazardous cargo, destination, ETA). Typed-in values start as
placeholders and are kept on the computer. The position is counted from a made-up origin.
Radar picture (`src/engine/echo.ts`): echoes are painted as arcs as wide as the beam plus the target and
as deep as the pulse plus the target, so range and bearing discrimination, sideways stretch with range,
aspect, and land depth appear on the picture. Beam = length / 7, aspect curve and land depth are placeholders.
Sound signals (`src/core/signals.ts`): COLREG rule 34 and 35 whistle signals, automatic fog signal.
Learner's manual: `docs/USER-MANUAL.md`. Instructor's operation manual: `docs/INSTRUCTOR-MANUAL.md`. Both in one, with
pictures, for trainees, instructors and whoever installs it: `docs/COMPLETE-MANUAL.pdf` (source and how to build it: `docs/manual-src`).
Checked against the textbook "Radar and ARPA Manual" (Bole and Dineley, 1990, and the third edition by Bole, Wall and
Norris, 2014, chapters 1 to 9 rule by rule with the book's worked examples as tests): `docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md`.
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
2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved. Depths (approximate, about
450 m cells, below mean sea level, no tide): `src/engine/real-depths.ts`, made by `scripts/make-depths.mjs` from the
ETOPO 2022 15 Arc-Second Global Relief Model, NOAA National Centers for Environmental Information,
doi:10.25921/fd45-gt74. Buoys, beacons, lights, rocks and wrecks: `src/engine/real-seamarks.ts`, made by
`scripts/make-seamarks.mjs` from the sea marks mapped in OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0.
None of it is a chart, and the depths never ground the ship. The picture's sea clutter is spiky, rain irregular and
small echoes fade in runs (`src/engine/texture.ts`), with the calibrated averages unchanged.
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
Fourth round (13 Nov 2026): four marked exercises in the real areas (`src/train/port-exercises.ts`, tests
`tests/port-exercises.test.ts`): 23 Mumbai, radar fix with the GNSS failed; 24 Goa, parallel index approach,
anchoring and anchor watch; 25 Kochi, collision avoidance in restricted visibility off a low coast; 26 Gulf of
Kutch, tidal stream, ground stabilisation and a meeting ship. For them: a GNSS (EPFS) failure (no position
anywhere, EPFS INPUT ABSENT), anchoring (LET GO ANCHOR key, under 1 kn over the ground) with an anchor-drag fault,
ships that lie at anchor without drifting (`atAnchor` in a scenario), and the exercise script can wait for a
condition (the anchor drags ten minutes after it is let go). Printable marking sheets, one page per exercise, with
empty boxes for the institute's tolerances, points and pass mark (`src/train/marking.ts`; instructor station,
EXERCISES, Marking sheets). A draft syllabus table, STCW A-II/1, Model Course 1.07 and DG Shipping Circular 5 of 2004 against
the exercises, with the gaps: `docs/SYLLABUS-MATRIX.md` (no instructor has reviewed it). From IEC 62288 and
62388: the stern line and the antenna position mark; AIS reports repeated by a shore station, not used while the
vessel is heard directly (instructor switch); the high-speed-craft versions of TT scenarios 2 to 5, all met.
Fifth round (16 Nov 2026), after Pub. 1310 (Radar Navigation and Maneuvering Board Manual, 2001) was read chapter
by chapter (`docs/BOOK-CHECK-PUB1310.md`): automatic acquisition leaves out echoes as large as land (`landEchoMinM`
in `src/arpa/config.ts`, a placeholder; `landEchoExtentsM` in `src/arpa/plots.ts`; tests
`tests/land-acquisition.test.ts`); instructor faults for the loss of the radar's video, sync, azimuth and heading
marker signals and for a frozen picture, with the alerts of IMO MSC.192(79) 5.34 and the fall-back of 9.5 (no radar
picture, AIS targets kept; `radarSignalsLost` and `pictureFrozen` in `src/engine/types.ts`; tests
`tests/signal-failure.test.ts`); capacity raised to the largest class of MSC.192(79) Table 1 (40 tracked targets, 40
activated AIS targets, 240 AIS targets in all); and ten more of the book's worked answers as tests
(`tests/pub1310.test.ts`).
Sixth round (18 Nov 2026), after the institute's list of 171 exercises was checked (`docs/EXERCISE-COVERAGE.md`): a PRF
control (`prfChoices` in `src/engine/band.ts`); fixes from ranges only or bearings only (`fixFromPositionLines` in
`src/core/nav.ts`); a route on the radar with cross-track distance, search patterns (`src/core/search.ts`), a MOB mark,
straight traffic separation schemes (`src/core/tss.ts`, `tss` in a scenario) and the charted coastline over the picture
with a printable outline sheet (`src/ui/outline-sheet.ts`); the ARPA acquires multiple, side-lobe and indirect echoes and
is disturbed by interference (`src/arpa/plots.ts`); random traffic (`src/engine/traffic.ts`) and live control of a
trainee's targets and weather from the station (`src/ui/link.ts`); time limits, five more marked exercises (27 to 31,
`src/train/nav-exercises.ts`, every limit a placeholder in `NAV_LIMITS`) and examinations made of several exercises
(`examSheetsHtml` in `src/train/marking.ts`). Tests: `tests/b41-core.test.ts`, `tests/b41-train.test.ts`.
Seventh round (18 Nov 2026), so that one instructor can follow several displays (the difficulty reported by Karlsson,
Chalmers, 2011): each display works out what the instructor should look at (`attentionFlags` in
`src/train/attention.ts`, every limit a placeholder in `ATTENTION_LIMITS`) and reports it; the station ranks the flags of
all displays, shows a class table (`progressReport`) and, on request, one display's own radar picture and settings; the
flags are bookmarks in the record, which the replay can jump to; an observation checklist (`DEFAULT_OBSERVATION_ITEMS`, a
proposal) goes into the record; the record keeps which trainee was at the controls (`controlsShare`) and a decision for
each trainee. Tests: `tests/b42-attention.test.ts`.
Eighth round (18 Nov 2026), on four more difficulties of simulator assessment (one trainee inside a group, subjective
evaluation, exercise sheets without consistent criteria, debriefing that depends on the instructor):
`src/train/assess.ts` and `src/train/roc-score.ts`. Every answer, action and first manoeuvre carries the name of the
trainee at the controls, each trainee has a result (`traineeResults`) and a file (`traineeFileHtml`), and the
controls can change over by the clock. Each checklist item has a written standard (`OBSERVATION_STANDARDS`, a proposal)
and the measured facts beside it (`evidenceOf`); the criteria in force are kept in each record (`criteriaSnapshot`); a
decision that goes against the record needs a written reason (`decisionConflicts`); assessors can be compared
(`assessorStats`). One exercise sheet of a fixed form for every exercise, made from the data that does the marking
(`sheetHtml`). The six ROC exercises give points from their reports, on the first check (`rocResultFrom`). A guided
debrief in five steps and a debrief pack are laid out from the record (`debriefPack`), with a comparison of the class
on one exercise. Older records stay without their replay for the files and comparisons (`lightRecord`). The assessor
still decides; every standard, limit and rule is a proposal or a placeholder. Tests: `tests/b43-assess.test.ts`.
Ninth round (18 Nov 2026), completing four things that were built in part. (1) From the station a trainee's display
can be taken back in time and reset, and one of its targets given a programmed track (`parseTrackText`). (2)
Visibility (`src/engine/visibility.ts`): set by the instructor or the scenario; the simulator has no view from the
windows, so the trainee is told it and a look-out reports the vessels in sight (`src/train/lookout.ts`; "in sight" is
a placeholder: range not more than the visibility); Rule 19(d) is applied in the marking to a vessel not in sight.
(3) Trainee accounts (`src/train/accounts.ts`): a PIN for each trainee, chosen at the first login and reset by the
instructor, kept only as a SHA-256 digest; the trainee sees his or her own results. Classroom protection, not real
security. (4) Performance history (`src/train/history.ts`): each trainee's attempts, a chart, each exercise's first,
best and latest score, a batch against its exercises; and storage beyond the browser: the classroom server keeps the
records and the class as files in `data/` for a station that gives its station key (`server/server.mjs`,
`src/ui/server-store.ts`), and a backup file can be saved and restored. `data/` is in `.gitignore`: it holds trainees'
names and results. Tests: `tests/b44-classroom.test.ts`, `tests/server.test.mjs`.

Tenth round (20 Nov 2026), six improvements. (1) The trainee's debrief explains every item: why the correct answer
is right, where on the screen it is, the rule and the working with the numbers on the trainee's own screen at the
moment of the answer (`src/train/explain.ts`, the robot's reasons reused; not shown to the trainee in an
examination). (2) Other ships can keep the collision regulations towards own ship, or one can get it wrong by
turning to port: an instructor's choice, "hold" by default (`src/engine/traffic-rules.ts`; every figure a
placeholder). (3) Approximate depths, an echo sounder reading and an area map with depth contours, buoys, beacons,
lights, rocks and wrecks in the four real areas; the marks in the water give echoes and racons answer
(`src/engine/depth.ts`, `src/engine/seamarks.ts`). (4) Spiky sea clutter that changes from scan to scan, irregular
rain and small echoes that fade in runs, with the calibrated averages unchanged (`src/engine/texture.ts`). (5) The
classroom server keeps a backup a day (the last 14), can be put back to one, exports everything to one file and
imports such a file, and has instructors' own accounts (salted scrypt hashes), an audit log and a station key that
can be switched off (`server/server.mjs`). (6) The robot student's code split into four files, and the tests that
run whole exercises about a quarter faster (the ARPA looks only at the coastline near its tracks and zones; the
results are the same to the last digit). Tests: `tests/b48-*.test.ts`, `tests/server.test.mjs`.
Then a ship that keeps coming: an instructor's choice of a "careless" ship (no proper look-out) that edges back
towards own ship after she has given way, or a "hunting" ship (a drill), and a marked exercise 32 on the careless
ship: act again when she comes back, with five short blasts recorded and marked (`KEEPS_COMING` in
`src/engine/traffic-rules.ts`, every figure a placeholder). Tests: `tests/b48-keeps-coming.test.ts`.
Hardware control panel: keys for every radar function, changeable, and knob-box (game controller) inputs
(`src/ui/panel-map.ts`, `src/ui/panel.ts`; SETTINGS > Control panel). No real panel has been tried.
`npm run test:link` starts the classroom server and checks the instructor station and four student displays in separate
browsers (needs Playwright). Separate PCs on a network have not been tried.
`npm run test:screen` checks the built page in a headless browser (needs Playwright).
Explanatory text is hidden until ? (help) is pressed. The data panels (`src/ui/console-ui.ts`, styles in
`src/ui/index.template.html`) is laid out the way ships' radars in general present their data: heading and
speed in large figures with their sensor, position, cursor and target data as label, value and unit, settings in
boxes that are clicked, gain and clutter as bars, status lines in the panels beside the picture, and the
standard abbreviations of IMO SN.1/Circ.243/Rev.2. It is drawn larger on a large screen. It is a generic
arrangement of our own, not a copy of any maker's screen, and no radar instructor has reviewed it.

## Develop

    npm install
    npm test            # 913 tests
    npm run typecheck
    npm run build       # rebuilds dist/radar-simulator.html

- `src/core`    navigation maths (phase 1)
- `src/engine`  world simulation, radar signal model, display frames, scenarios (phase 2)
- `src/roc`     ROC exercises, sessions and scoring (phase 3)
- `src/arpa`    ARPA plot extractor, tracker, alarms and trial manoeuvre (phase 4)
- `src/ui`      the radar screen and its panels (`console-ui.ts`, `view.ts`, `arpa-view.ts`), the ship control
                window (`ship-window.ts`), the instructor station (`station-ui.ts`, `instructor-ui.ts`), the
                exercises (`train-ui.ts`, `roc-ui.ts`) and the link between displays (`link.ts`)

See `PLAN.md` for the full build plan.

## Added in phases 5 to 8

- **Exercises** (EXERCISE tab, ARPA EX, or the ship control window): 32 exercises with automatic checking and
  debrief questions: ten ARPA, eleven radar (four of them in the real areas) and ten manual plotting.
- **Instructor station** (`radar-simulator.html#instructor`, or `/instructor` from the classroom server; PIN 0000
  at first; `src/ui/station-ui.ts`): CLASSROOM (every display reporting, with pause and run, an exercise to start,
  faults, weather, linked exercise and messages sent to one display or all), RECORDS (each display sends its record
  when an exercise is finished; replay, CSV and printable reports, the assessor's decision), EXERCISES (scoring
  settings, marking sheets, self-test), BATCHES (batches, assignments, PIN; sent to every display every few seconds),
  SCENARIOS (editor), OWN RADAR (the station's own radar, with event injection and faults). The student displays
  have no instructor pages: no INSTR or FAULTS key and no PIN box.
- `npm run serve` starts a small classroom server so the instructor station can reach other PCs.
  Open the address it prints on every display, and that address followed by `/instructor` on the
  instructor's PC. It also keeps the station's records and class as JSON files in `data/` (or the folder
  named in `RADAR_SIM_DATA`), for a station that gives the station key it prints at start, or for an
  instructor logged in with an account of his or her own. It backs itself up every day in `data/backups`
  (the last 14 kept) and writes who did what in `data/audit.log`. Classroom network only: nothing is
  encrypted, and the key and passwords travel in clear.

See `docs/PHASE5-8-INSTRUCTOR-CHECK.md`. Nothing here is certified or approved for navigation.

## Checked against the IMO documents

`docs/COMPLIANCE-MATRIX.md` lists every function of IMO A.823(19) (ARPA), MSC.192(79) (radar)
and Model Courses 1.07 and 1.08 against what the simulator does. It is a list of simulated
functions, not a certificate. Added from that check: AIS targets on the radar, racon and SART,
second EBL and VRM, offset EBL, parallel index lines, off-centring, all eight range scales,
X/S band, ARPA data on/off and brilliance, EPFS ground stabilisation, speed log failure, and a
test of ARPA accuracy in the four IMO scenarios.
