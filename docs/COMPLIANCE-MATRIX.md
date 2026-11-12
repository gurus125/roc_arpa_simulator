# Compliance matrix: ROC + ARPA radar simulator

Checked against the four documents supplied by the academy:

- IMO resolution **A.823(19)**, Performance standards for ARPA
- IMO resolution **MSC.192(79)**, Revised performance standards for radar equipment
- IMO **Model Course 1.07**, Radar navigation at operational level (2017 edition)
- IMO **Model Course 1.08**, Radar navigation at management level (draft HTW 5/3/11/Add.1)
- **STCW Code section A-I/12**, Standards governing the use of simulators (2017 consolidated edition)
- IMO **Model Course 6.10**, Train the simulator trainer and assessor (chapters 7 and 8 only; the copy supplied is a scan and ends at page 98)

**Read this first.** This is a simulator for a training institute, not ship's equipment. The two
resolutions are standards for shipborne equipment; Model Course 1.07 asks that the simulator be
"capable of simulating the operational capabilities" of radar that meets them. This matrix says
which of those capabilities are simulated. Nothing here is a
certificate, a type approval or an approval by DG Shipping. Not checked, because the documents
were not supplied: the DG Shipping guideline, and the academy's own exercise sheets and marking
scheme. STCW section B-I/12 (guidance) was not checked.

Status words: **Yes** = simulated and tested. **Partly** = simulated with the limits stated.
**No** = not built. **n/a** = hardware, installation or documentation matter, not a simulator function.

## 1. A.823(19): ARPA

| Para | Requirement (short) | Status | Where / note |
|------|---------------------|--------|--------------|
| 3.2.1 | Manual and automatic acquisition; manual cancel; suppress acquisition in areas, area shown | Yes | ARPA tab: Acquire / Cancel, guard zones, exclusion areas drawn on the picture |
| 3.2.1 | Acquisition up to 100 kn relative speed | Partly | No speed limit in the tracker; not tested at 100 kn |
| 3.3.1 | Track and display at least 20 targets | Yes | Capacity 20; test with 25 targets on screen |
| 3.3.2 | Tracked targets clearly marked | Yes | Symbols and numbers |
| 3.3.3 | Keep tracking a target seen on 5 of 10 scans | Yes | Lost only after 8 missed scans in a row (placeholder) |
| 3.3.4 | Tracking errors and target swop minimised and explained | Partly | Swop, fading and delay are simulated and shown to the instructor; explanation is in the check sheets, not a manual |
| 3.3.5 | At least four equally spaced past positions; time scale shown | Yes | Past positions 1 to 10, interval shown on the screen |
| 3.4.3 | ARPA on at least 3, 6 and 12 NM scales; scale indicated | Yes | 3, 6, 12, 24 NM |
| 3.4.5 | North-up and course-up, relative motion; true motion optional; mode indicated | Yes | |
| 3.4.6 | True and relative vectors, mode shown, sea/ground shown, adjustable time, time shown | Yes | |
| 3.4.6.5 | Ground reference target marked with a symbol | Yes | "R" beside the target number |
| 3.4.7 | ARPA data must not hide targets; cancel unwanted ARPA data within 3 s | Yes | "ARPA data on the picture" switch |
| 3.4.8 | Independent brilliance of ARPA data, down to extinction | Yes | ARPA brilliance 0 to 100 |
| 3.4.10 | Quick range and bearing of any object | Yes | Cursor readout, EBL, VRM |
| 3.4.11 | Motion trend within 1 min, prediction within 3 min | Yes | Vector after 60 s (marked preliminary), steady after 180 s |
| 3.4.12 | Full data within one scan after changing range | Yes | Tracking does not depend on the display range |
| 3.5.1 | Guard zone warning, visual and audible, target marked | Yes | Flashing box on the echo |
| 3.5.2 | CPA/TCPA warning, visual and audible, target marked | Yes | |
| 3.5.3 | Lost target indicated at its last position | Yes | |
| 3.5.4 | Audible warning can be switched off | Yes | |
| 3.6.1-3.6.2 | Select a target; range, bearing, CPA, TCPA, true course, true speed outside the radar area | Yes | Target data table |
| 3.6.3 | Course and speed labelled sea or ground stabilised | Yes | Line under the table and on the screen |
| 3.7.1 | Trial manoeuvre with or without delay, tracking not interrupted, indicated | Yes | Flashing TRIAL; present CPA shown beside trial CPA |
| 3.7.3 | Trial can be cancelled at any time | Yes | |
| 3.8.2 | Accuracy after 1 min, four scenarios, 95% | Partly | 11 of the 12 figures are met. Scenario 2 (200 m target at 1 NM): relative speed about 0.8 kn against 0.6 kn. With the glint of appendix 3 (30 m along the target) and one plot per antenna turn, a one-minute fit cannot do better; for the simulator's ordinary 120 m ships the glint, and so the error, is smaller |
| 3.8.3 | Accuracy after 3 min, four scenarios, 95% | Yes | `tests/imo-arpa.test.ts`, 120 runs per scenario |
| 3.8.4 | Trend within 1 min and prediction within 3 min after a manoeuvre | Partly | Fixed 3-minute window: prediction within 3 min; no faster manoeuvre filter |
| App. 3 | Sensor errors | Partly | Bearing 0.2°, range 15 m to 22 m, glint 30 m along a 200 m target (in proportion for other lengths), taken from appendix 3. Roll and pitch, gyro and log calibration errors are not modelled separately (the instructor injects gyro and log errors) |
| 3.9.2 | Indicate an absent sensor input | Yes | Gyro failure and speed log failure alarms |
| 3.10 | Malfunction warnings and a test programme against a known solution | Yes | Self-test with two test targets |
| 3.11.1 | Sea and ground stabilisation | Yes | |
| 3.11.3 | Ground input from log, EPFS or tracked stationary targets | Yes | Bottom-track log, EPFS (GNSS), reference target |
| 3.11.4 | Input and stabilisation in use displayed | Yes | For example "GND STAB (REF TGT 3)" |
| App. 1 | PAD, predicted points of collision, map lines | No | Optional facilities in the resolution |

## 2. MSC.192(79): radar

| Para | Requirement (short) | Status | Where / note |
|------|---------------------|--------|--------------|
| 5.1.2 | X and S band, band indicated | Yes | Band switch; band shown on the screen. Rain and sea clutter factors and the beamwidth and pulse figures are typical values, not from the resolution |
| 5.2 | Range and bearing accuracy | n/a | The simulator's ranges and bearings are exact apart from injected errors |
| 5.3.1 | Detection ranges (table 2) | Yes | Table 2 is entered as printed and the echo strengths are calibrated to it: every X-band row and the ship and shoreline rows on S band are reproduced to 0.1 NM; the other S-band small targets to within 0.6 to 0.8 NM (one factor per kind of target). `tests/band.test.ts`. The built-in scenarios keep their own echo strengths (their buoys are weaker than the table's typical buoy) |
| 5.3.2 | Gain, manual anti-clutter sea and rain, status shown | Partly | Manual controls. No automatic anti-clutter |
| 5.3.4 | Racons and SARTs detected | Yes | "Search and rescue" scenario. SARTs answer X band only; a racon can be set to X, S or both |
| 5.4-5.5 | Minimum range 40 m; range discrimination 40 m; bearing discrimination 2.5° | Partly | Short pulse: minimum range 37 m, range discrimination from the pulse length. The ARPA merges echoes closer than 2° (X) or 3.3° (S). The picture itself does not merge close echoes |
| 5.7 | Tuning indication; performance monitor | Yes | Tuning meter; performance monitor plume, with an instructor fault that reduces performance |
| 5.9 | Consistent common reference point, own ship outline | No | Measurements are from the antenna position |
| 5.10 | Range scales 0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24 NM | Yes | |
| 5.11 | Fixed range rings | Yes | |
| 5.12 | At least two VRMs with readout | Yes | VRM 1 and VRM 2 |
| 5.13 | Bearing scale | Yes | |
| 5.14 | Heading line; temporary suppression | Yes | "Hold: heading line off" |
| 5.15 | At least two EBLs; true and relative; offset origin | Partly | EBL 1 and 2; EBL 1 origin can be moved to a fixed point. Readout is true (relative shown for EBL 1) |
| 5.16 | Four independent parallel index lines | Partly | Four lines by bearing and distance. No truncation |
| 5.17 | Offset measurement of range and bearing | Partly | Offset EBL only |
| 5.18 | User cursor with range and bearing readout | Yes | |
| 5.19 | Azimuth stabilisation, heading shown | Yes | |
| 5.20 | True motion; north-up and course-up; mode indicated | Yes | Head-up as well |
| 5.21 | Manual off-centring | Yes | Up to 66% of the radius, relative motion |
| 5.22 | Ground and sea stabilisation, source indicated | Yes | |
| 5.23 | Target trails of variable length; past positions | Yes | |
| 5.25 | Target tracking: capacity, acquisition, accuracy, ground reference | Yes | See part 1 |
| 5.26-5.28 | AIS targets: sleeping, activated, selected; data; capacity | Partly | Sleeping / activated / selected / lost, data field, "missing" for rate of turn. No capacity limit or filtering of sleeping targets, no own-ship AIS data |
| 5.29 | CPA/TCPA alarm for tracked and activated AIS targets, same limits; lost alarm, AIS lost alarm can be disabled | Yes | |
| 5.30 | AIS and radar target association, choice of symbol | Partly | Association by distance and motion (placeholder limits); no alert when they diverge |
| 5.31 | Trial manoeuvre | Yes | |
| 5.32 | Maps, navigation lines and routes | Partly | Navigation lines and nav marks placed by clicking, fixed to the ground, saved and loaded by name. No routes |
| 5.33 | Chart display | No | Optional in the resolution |
| 5.34 | Picture freeze alert; sensor failure alarms | Partly | Gyro and log failure. No picture-freeze alert |
| 5.35, 6-9 | Multiple radars, ergonomics, installation, interfaces, back-up | n/a | |

## 3. Model Course 1.07 (operational level)

Facilities (page 5): a radar simulator with an instructor station and at least two own-ship
stations, simulating radar that meets the IMO standards.

| Item | Status | Note |
|------|--------|------|
| Instructor station and at least two own-ship stations | Yes | Any number of displays. The instructor starts a linked exercise on all of them: same scenario, same moment, each own ship shown to the others as a radar target with AIS. Linked exercises run at 1x; each display keeps its own copy of the scenario traffic, started together |
| Plotting table and charts beside each station | n/a | Classroom equipment. A plotting board is on screen |
| 2-1 Radar setting up and adjustment | Yes | Tuning, gain, clutter, brilliance, range scales |
| 2.2 Accurate measurement of ranges and bearings | Yes | EBL, VRM, cursor, range rings |
| 3-1 Radar position fixing | Yes | ROC exercise |
| 3.2 Radar navigation aids (racon, SART) | Yes | |
| 3-2 Parallel index line navigation | Yes | Exercise 10, marked on the index line set and on track keeping |
| 3-3 Radar maps, navigation lines and routes | Partly | Navigation lines (exercise 10). No routes on the radar |
| 3.5 Electronic chart overlay | No | Lecture topic in the course |
| 4-1 to 4-4 Manual plotting: triangle, CPA/TCPA, effects of course and speed changes, plotting report | Partly | Plotting exercise and collision avoidance exercise. No separate marked report sheet |
| 5 and 6 ARPA / target tracking operation, errors, tests, over-reliance | Yes | Nine ARPA exercises |
| 5.2, 5.3, 6.2 AIS display and association | Partly | See MSC.192(79) 5.26 to 5.30 |
| 7-1 Collision avoidance with COLREGs | Yes | ARPA exercises 6 and 9, ROC traffic exercise. Rule 19(d) is checked automatically |
| Part E assessment | Partly | Automatic marking with placeholder tolerances; no pass mark set |

## 4. Model Course 1.08 (management level)

| Item | Status | Note |
|------|--------|------|
| Practical 1 Awareness of radar working conditions | Yes | Picture controls, errors, limitations |
| Practical 2 Use of radar in navigation (voyage plan, parallel indexing, blind pilotage) | Partly | Blind pilotage, clearing range and position fixing exercises; parallel index tool. No voyage-plan route on the radar |
| Practical 3 Use of radar in collision avoidance | Yes | |
| Practical 4 Use of radar in search and rescue | Partly | Exercise 11: recognise the SART and racon, home on the SART and close it at slow speed. No search-pattern exercise, no on-scene co-ordination |
| Bridge teamwork | Partly | Two students per display and linked own ships. No team roles, communications or shared own ship |

## 4a. STCW Code section A-I/12

| Para | Requirement (short) | Status | Note |
|------|---------------------|--------|------|
| 1.1-1.3 | Suitable for the objectives; simulates the equipment's capabilities, limitations and possible errors; enough behavioural realism | Partly | Functions, limitations and errors are simulated. Whether the realism is "appropriate" is for the assessor and the administration to judge |
| 1.4 | Controlled environment with a variety of conditions, including hazardous or unusual situations | Yes | Weather, current, tidal stream, abnormal propagation, faults, injected targets |
| 1.5 | Interface to the equipment, the environment and the instructor | Yes | On-screen controls; typed communications with the instructor and other stations |
| 1.6, 2.6 | Instructor or assessor can control, monitor and record exercises for debriefing and assessment | Yes | Monitoring, injection, records, replay, taking the exercise back in time |
| 4.1 | Stabilised relative motion; sea- and ground-stabilised true motion | Yes | |
| 4.2 | Weather, tidal streams, current, shadow sectors, spurious echoes and other propagation effects; coastlines, buoys, SARTs | Yes | Tidal stream is a simple rectilinear stream on a 12.42 hour cycle |
| 4.3 | At least two own-ship stations able to change course and speed | Yes | Linked own ships; not yet tested across several computers |
| 4.3 | Parameters for at least 20 target ships | Yes | "Heavy traffic (22 ships)" scenario; no limit in the scenario editor |
| 4.3 | Appropriate communication facilities | Partly | Typed messages between all stations; the instructor can speak as any vessel. No voice |
| 5.1-5.5 | ARPA: manual and automatic acquisition, past track, exclusion areas, vector and data display, trial manoeuvres | Yes | |
| 7.1 | Trainees briefed on objectives and tasks, with planning time | Yes | Briefing and "How you will be assessed" shown before the exercise, which starts paused |
| 7.2 | Familiarisation time before training or assessment | Yes | Free practice scenarios |
| 7.4 | Exercises monitored; pre- and post-exercise evaluation reports | Partly | Monitoring and a post-exercise report. No pre-exercise evaluation form |
| 7.5-7.6 | Effective debriefing; peer assessment encouraged | Yes | Replay, debrief questions, the trainees' own review, peer comments and goals, kept on the record |
| 7.7 | Exercises designed and tested for their objectives | Partly | Tested by automated tests; not yet tried by an instructor with trainees |
| 8.1, 8.3 | Performance and assessment criteria explicit and available to candidates | Yes | Shown before each exercise |
| 8.2 | Criteria reliable, uniform and objective | Partly | Automatic checks are uniform; the tolerances are placeholders |
| 8.5 | Scoring used with caution until validated | Yes | The score is marked provisional everywhere it appears |
| 8.6 | Prime criterion: the assessor is satisfied the task was done safely and effectively | Yes | Assessor's decision, name and remarks on each record and report |
| 9 | Instructors and assessors appropriately qualified | n/a | A matter for the institute |

## 5. Against the ARI Radar/ARPA simulator specification (V1.2, 1+4 stations)

ARI's simulator is also software on ordinary computers. Every feature named in its specification
is listed here.

| ARI feature | Ours |
|-------------|------|
| Standby / on | Yes (radar and ARPA) |
| Alter pulse length | Yes: auto, short, medium, long |
| Tuning, gain, brilliance, range scale, rings, VRM, EBL, heading marker, anti-clutter | Yes |
| True motion; relative motion stabilised and unstabilised; north-up, course-up, head-up | Yes |
| Verify compass and log input | Yes: heading and log readouts, instructor errors and failures |
| Centre offset and reset | Yes |
| Manual plotting: course, speed, aspect, CPA, TCPA | Partly: aspect is not asked for or marked |
| Position fixing by radar | Yes |
| Aids to radar navigation: racon, ramark, SART | Yes |
| Parallel indexing, more than one PI line | Yes (four) |
| Collision avoidance by radar and ARPA, COLREGs | Yes |
| Effect of precipitation; blind and shadow areas; clutter masking targets | Yes |
| ARPA set-up, acquisition zones, deleting targets, processing delay | Yes |
| Target data: course, speed, CPA, TCPA, BCR | Yes |
| True and relative vectors, history, trails | Yes |
| Warnings and alarms; ARPA errors and limitations | Yes |
| Performance monitor | Yes |
| Nav marks, nav lines | Yes |
| Trial manoeuvre | Yes |
| Errors: heading marker error, VRM error, gyro error | Yes |
| Interference, side echoes, multiple echoes, second-trace echoes | Yes |
| AIS target data; radar and AIS association | Yes |
| Echo stretching and averaging | Yes (simple) |
| Echo referencing; ground and sea stabilisation | Yes |
| Conning window (alter course and speed) | Yes (course and speed sliders) |
| Instructor: launch, pause, stop, resume | Yes |
| Instructor: environmental conditions | Yes, including from the instructor to all displays |
| Instructor: control target vessels | Yes on the instructor's own display; not yet on another display remotely from the page |
| Instructor: record and replay | Yes |
| Instructor: errors and malfunctions of radar, ARPA and sensors | Yes |
| Trainees interact in one exercise | Yes (linked own ships), not tested across several computers |
| Chart table, radar keyboard, touch screen | n/a: classroom equipment |
| DNV statement of compliance, ISO 9001, "complies with DGMA guidelines" | No: these are certificates held by ARI |

## 6. What is still needed before any claim is made

1. The DG Shipping simulator requirements, checked line by line like this.
2. A search-pattern exercise; routes on the radar; bridge team roles and communications.
3. A test of linked exercises on the academy's own network with several computers.
4. The academy's marking scheme in place of the placeholder tolerances.
5. A qualified radar instructor's sign-off on the behaviour, on the academy's own computers.
