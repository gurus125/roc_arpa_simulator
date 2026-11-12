# Gap analysis: what separates this simulator from an approved institute simulator

Date: 11 Nov 2026. Training and study use only; nothing here is a claim of approval.

## What this analysis is based on

- Read in full or in part in this project: IMO A.823(19), MSC.192(79), Model Courses 1.07 and 1.08,
  STCW Code A-I/12, Model Course 6.10 (chapters 7-8), the ARI Radar/ARPA specification V1.2,
  Subramaniam's radar/ARPA textbook. Line-by-line results are in `COMPLIANCE-MATRIX.md`.
- An audit of the present code (about 10,000 lines, 245 tests).
- NOT read (web search is switched off for this account, so nothing could be looked up online):
  the DG Shipping simulator guideline, STCW B-I/12, DNV-ST-0033 (the simulator class standard
  ARI is certified to), IEC 62388 (radar tests), IEC 62288 / SN.1/Circ.243 (symbols),
  MSC.302(87) (alert management), any maker's radar operator manual. Statements about these
  below come from general knowledge and must be checked against the documents themselves.

## Research update (web search now on), 11 Nov 2026

Read:
- DG Shipping Training Circular No. 5 of 2004 (ARPA course; the ROSC text refers to the same annexures)
  and No. 7 of 2004 (RANSCO): https://betadgs.dgshipping.gov.in/download/1758280393_68cd3ac98b895_training-circular-no-5-of-2004.pdf ,
  https://dgma.gov.in/download/1758280393_68cd3ac98c5ba_training-circular-no-7-of-2004.pdf
- STCW Code section B-I/12, paragraphs 2-35 (it was inside the STCW 2017 PDF already supplied).
- DGMA page on the web-based digital simulator (LVSF): https://dgma.gov.in/it-e-governance/it-e-governance-web-based-digital-simulator
- DNV news on the August 2025 revision of DNV-ST-0033: https://www.dnv.com/news/2025/dnv-revises-maritime-simulator-standard-to-support-safer-and-more-adaptable-training/
- A RINA compliance checklist for another maker's bridge simulator (shows what a class society checks).

Found but the sites refuse automated reading (must be downloaded by hand and attached):
- DGS draft circulars of May 2020 for the ROC and ARPA courses (newer than 2004):
  https://www.dgshipping.gov.in/writereaddata/News/202005050510036254036DraftDGSCircular_ROC.pdf ,
  https://www.dgshipping.gov.in/writereaddata/News/202005050511492028894DraftDGS_Circular_ARPACOURSE.pdf
- DNV Standard for Certification 2.14 (older edition of the simulator standard, with the radar/ARPA requirement tables):
  https://rules.dnv.com/docs/pdf/dnvpm/stdcert/2007-10/Standard2-14.pdf ; the current DNV-ST-0033 is free from DNV's Rules & Standards page.

What DG Shipping requires (Circular 5 of 2004):
- "The Radar Simulator equipment for this course shall be of a type approved or accepted by the DGS."
  So the software itself needs DGS approval or acceptance; meeting the syllabus is not enough.
- Each radar set in a soundproof cubicle ("own ship") of at least 4 sq m with chart table; at most 3 students
  per radar display; at most 24 per class; one Master Mariner per three own ships.
- ARPA course 33 hours: 7 lecture, 23 simulator, 3 review and assessment. Assessment: objective test, manual
  plotting test, simulator demonstration (display set-up, own-ship position plotting, parallel indexing, target
  information from ARPA), oral on ARPA operation and the collision rules.
- Facilities the student must demonstrate include: stabilised relative and true motion; echo-referencing in true
  motion; log and gyro inputs; manual and automatic acquisition; exclusion areas; vector time scale; sea and
  ground stabilisation; true and relative vectors; PPC and PAD graphics; target history; trial manoeuvre;
  operational warnings; self-test against known solutions; checks by manual plotting; parallel indexing.

New gaps found from DGS 5/2004 and STCW B-I/12 (not in the table below):

| Item | Source | Now |
|------|--------|-----|
| PPC (potential point of collision) and PAD (predicted area of danger) graphics | DGS 5/2004 syllabus; B-I/12 para 30 | BUILT 11 Nov 2026 (PAD is a simplified hexagon) |
| Manual speed input, and the effect of a wrong manual speed on true motion | B-I/12 para 8.2, 8.3, 32.4 | BUILT for the ARPA (wrong speed gives wrong true vectors). The true-motion PICTURE still moves at the real speed: not done |
| Unstabilised head-up display (picture smears when the ship yaws) | B-I/12 para 8.1, 12 | Head-up already was unstabilised (relative bearing scale, no gyro); now labelled so. The ship does not yaw, so no smear |
| Target aspect and composition changing the echo | B-I/12 para 5.4, 7 | BUILT 12 Nov 2026: echo strength and shape change with aspect (placeholder curve); composition not modelled |
| Ship motion in a seaway affecting the picture | B-I/12 para 5.5 | Missing |
| False echoes from large structures, bridges and power lines; indirect echoes | B-I/12 para 6 | Missing (multiple, side-lobe and second-trace exist) |
| Effects of pulse length and beamwidth on the picture; land shape from topography | B-I/12 para 7 | BUILT 12 Nov 2026: echoes painted from beamwidth and pulse length; land paints inland by height. No terrain model |
| Centre and heading-marker misalignment as bearing errors | B-I/12 para 9.5 | Heading marker only |
| Receiver noise saturation with gain too high | B-I/12 para 8.3 | To be checked on screen |

## Where the simulator stands

Strong: collision-avoidance maths and its tests; ARPA tracker behaviour (acquisition delay,
preliminary/steady vectors, lost target, target swap, errors from gyro/log faults, trial
manoeuvre, guard zones) tested against A.823(19) scenarios; instructor functions; records.

Weak, in order of how much they matter for a standard simulator:

| # | Gap | Now | What a standard simulator does |
|---|-----|-----|-------------------------------|
| 1 | Radar picture | Each echo is a dot of fixed size from a hit list; coast is sampled points with one height | Picture built per bearing and range cell: echo width follows beamwidth, depth follows pulse length, so range and bearing discrimination, target shape with aspect, and land shape with terrain height appear by themselves |
| 2 | Own ship behaviour | Fixed 2 deg/s turn and 0.1 kn/s speed change, set by sliders | Ship models with rudder and engine orders, turning circle, speed loss in a turn, stopping distance, wind and current effect; several ship types |
| 3 | Target behaviour | Four target kinds; echo strength does not change with aspect | Many ship types with size, aspect-dependent echo, realistic manoeuvres |
| 4 | Symbols and alerts | Our own symbols and alarm list | Symbols to IEC 62288 / SN.1/Circ.243; alerts by priority (alarm, warning, caution) with standard acknowledgement |
| 5 | Regression safety | 245 tests on the maths and engine; none on the screen | Every release checked on the real screen. The last layout change hid controls and no test caught it |
| 6 | Exercises and marking | 9 ARPA + 2 radar + ROC exercises, placeholder tolerances, no pass mark | The academy's exercise sheets and marking scheme |
| 7 | Stations | Link code exists, tested on one machine only | Instructor + 4 student stations proven on the academy network |
| 8 | Controls | Mouse and keyboard | Usually a radar keyboard/trackball panel (optional by class) |
| 9 | Validation | Headless browser checks only | Run on the academy PCs; signed off by a qualified radar instructor; checked against the DG Shipping guideline |

## Proposed order of work

0. PPC/PAD graphics, manual speed input, unstabilised head-up (named in the DGS syllabus and B-I/12; small jobs).
1. (Screen tests BUILT: `npm run test:screen`, 3 screen sizes.) Screen tests in `npm test` (every menu key shows its controls; course, speed, scenario, EBL/VRM,
   acquire, trial, exercises work) and a check after every delivery that the files arrived.
2. Radar picture rebuilt on range/bearing cells (beamwidth, pulse length, terrain height for land).
3. Own ship models with rudder and engine orders; wind.
4. Target types with aspect-dependent echo.
5. Symbols and alerts to the standards, once those documents are available.
6. Exercises and marking from the academy's own sheets.
7. Multi-computer test; instructor sign-off; DG Shipping checklist.

## Documents needed

DG Shipping guideline/circular for Radar/ARPA (ROC, ARPA) simulator courses; DNV-ST-0033;
the academy's exercise sheets and marking scheme; one radar operator manual the academy
trains on. Turning on web search for this account would let the public ones be found directly.

## DNV Standard for Certification 2.14 (October 2007), Class C (NAV), line by line

Read from the PDF supplied on 11 Nov 2026. This is the OLD edition; the current one is DNV-ST-0033
(revised August 2025), which must be checked before any claim. Class C (NAV) is "a limited task
simulator ... for limited (instrumentation or blind) navigation and collision avoidance": the class a
radar/ARPA simulator falls in. It covers STCW A-II/1.3 and A-II/2.6 (radar and ARPA), plus
A-II/1.4, 1.5 and 1.8 (emergencies, distress, manoeuvre the ship).

| Ref | Class C requirement | Now |
|-----|---------------------|-----|
| C1 c | Controls of propulsion plant operations | BUILT on screen: engine telegraph keys and engine order (no hardware lever) |
| C1 f | Steering console: hand steering and automatic steering with switch-over; rudder angle and rate-of-turn indicators | BUILT on screen: autopilot / hand steering with switch-over, rudder angle and rate-of-turn readouts (no hardware wheel) |
| C1 h | Steering compass | Partial: heading readout |
| C1 i | Radar/ARPA unit; 10 cm and 3 cm; stabilised relative motion; sea and ground stabilised true motion | Met |
| C1 k | At least one VHF radio | Partial: typed messages, no voice |
| C1 n | GPS, echo sounder, speed log through the water | Partial: log and COG/SOG; no position readout, no echo sounder |
| C1 o | Relative wind direction and force indicator | BUILT: relative wind direction and speed readout |
| C1 p | Sound panel according to the rules of the road | BUILT 12 Nov 2026: whistle signals of rules 34 and 35, automatic fog signal (own ship only; targets make no sound) |
| C2 b | Own ship on a mathematical model with at least 3 degrees of freedom | BUILT: surge, sway, yaw model (Nomoto steering). Coefficients are placeholders tested against the IMO manoeuvrability criteria, not trial data |
| C2 c | Own ship hydrodynamics in open water with wind, waves, tidal stream and current | Partial: wind, current and tidal stream; no wave forces |
| C2 f | At least three types of own ship | BUILT: four types (container ship, bulk carrier, product tanker, coaster) |
| C2 i | Radar: weather, tidal streams, current, shadow sectors, spurious and false echoes, propagation effects, coastlines, buoys, SART | Met |
| C2 j | ARPA: manual and automatic acquisition, past track, exclusion areas, vector/graphic time scale and data display, trial manoeuvre | Met |
| C3 a | At least 10 types of target ship, each with a model that reacts to current, wind and waves | BUILT: 28 vessel types that turn gradually and react to current and wind (not waves). Figures are placeholders. Targets in the older scenarios keep the plain motion |
| C3 c | At least 100 target ships at the same time, each with a route the instructor can programme | NOT PROVEN: never run with 100; targets have timed course/speed changes, not routes |
| C3 p | Current pattern changing in time according to the charts; tidal waters | Partial: one uniform current plus a tidal cycle |
| C3 q | Depth according to the charts, with tide level | MISSING |
| Sec.2 A104 | User manual available to the learners | BUILT 12 Nov 2026: docs/USER-MANUAL.md |
| Sec.2 B102 | Instructor: start, halt, reset, restart; change environment; communicate; follow the exercise; plot tracks; inject failures | Met on one machine (communication typed) |
| Sec.2 B104 | Replay of a full exercise, also faster and slower than real time | To be checked |
| Sec.2 B105 | Scoring or grading method | Met in form; values are placeholders |
| Sec.2 B106 | Set the exercise to any point of the replay and restart from there | Partial: take back 2, 5 or 10 minutes |

Consequence for the work order: the own-ship model (rudder, engine telegraph, autopilot, 3 degrees
of freedom, three ship types, wind) and ten target types are explicit Class C requirements, so they
move ahead of the radar-picture rebuild.

Also supplied: DGS Training Manual Vol IV. It is an index of DGS orders and circulars, with no
requirements in it. The one that matters here is DGS Order 05 of 2016 (procedure for approval of
simulator courses); it has not been read. The two May 2020 draft circulars (ROC, ARPA) are still not read.
