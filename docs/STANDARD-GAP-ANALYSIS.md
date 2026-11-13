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
  (The textbook "Radar and ARPA Manual", Bole and Dineley, 1990, was compared with the simulator
  on 13 Nov 2026: see `BOOK-CHECK-RADAR-ARPA-MANUAL.md`.)
  (Read since then, see the later sections: the DG Shipping order, STCW B-I/12, DNV-ST-0033,
  SN.1/Circ.243/Rev.2 and MSC.302(87); and, supplied by the user on 13 Nov 2026, IEC 62388:2013 and
  IEC 62288:2014: see `IEC-CHECK.md`.)

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
| Manual speed input, and the effect of a wrong manual speed on true motion | B-I/12 para 8.2, 8.3, 32.4 | BUILT: a wrong speed gives wrong true vectors, and (12 Nov 2026) the sea-stabilised true-motion picture moves own ship by the speed input, so fixed objects slide when it is wrong |
| Unstabilised head-up display (picture smears when the ship yaws) | B-I/12 para 8.1, 12 | Head-up is unstabilised; since 12 Nov 2026 the ship yaws in a seaway, so the head-up picture smears |
| Target aspect and composition changing the echo | B-I/12 para 5.4, 7 | BUILT 12 Nov 2026: echo strength and shape change with aspect (placeholder curve); composition not modelled |
| Ship motion in a seaway affecting the picture | B-I/12 para 5.5 | BUILT 12 Nov 2026 (simplified): roll, pitch, heave and yaw from sea state and sea direction; rolling tips the beam and weakens echoes abeam; yaw smears a head-up picture. The size of the motions is an estimate |
| False echoes from large structures, bridges and power lines; indirect echoes | B-I/12 para 6 | BUILT 12 Nov 2026: single echo of an overhead cable, mirror images in a quay wall or bridge, bridge repeated beyond itself, indirect echo in the shadow sector; scenario "False echoes". Strengths are estimates; the ARPA cannot acquire them |
| Effects of pulse length and beamwidth on the picture; land shape from topography | B-I/12 para 7 | BUILT 12 Nov 2026: echoes painted from beamwidth and pulse length; land paints inland by height. No terrain model |
| Centre and heading-marker misalignment as bearing errors | B-I/12 para 9.5 | Heading marker only |
| Receiver noise saturation with gain too high | B-I/12 para 8.3 | To be checked on screen |

## DGS Order 05 of 2016: how DG Shipping approves an institute and a course (read 12 Nov 2026)

Read in full: DGS Order No. 05 of 2016, F.No. TR/Pol/8(5)/2015, dated 01.11.2016 ("Guidelines and
procedure for approval for the conduct of DG Shipping approved modular, simulator and post sea
competency courses"), 83 pages with Schedule I and Annexures I to IX-A, and its corrigendum dated
02.12.2016. Both were supplied by the user as scans; paragraph numbers below are from the order.
The corrigendum only changes Schedule I paragraphs 4.2, 4.3 and 7.5 (safety courses and the High
Voltage course). It does not touch simulators, ROC or ARPA.

The main point: DG Shipping approves the INSTITUTE and each COURSE at that institute. The order has
no procedure by which a piece of simulator software is approved on its own, and it contains no
technical specification for a radar simulator. For that it points to "the specific course
guidelines" (para 2.8.4, 4.4, 4.5), which for these courses is Training Circular 5 of 2004 (above).

Who may apply
- Only a Central or State Government body, a registered non-profit public trust or society, or a
  company under section 8 of the Companies Act 2013, with management support of shipping
  professionals (1.3.2). A software company cannot be the applicant.
- For ROC and ARPA specifically, the institute must already conduct a pre-sea Diploma in Nautical
  Science / B.Sc. Nautical Science and/or a competency course for deck officers (Schedule I, 7.1).
  Exceptions: an institute promoted by a ship-owning or ship-management company with at least 25
  ships (10.1), or by a manning company holding an RPSL with an audited record of 1,000 officers
  placed on ships in the last 12 months (10.2). These must still be a trust, society or section 8
  company (10.3). RANSCO needs ROC and ARPA, or the Chief Mate course, running first (8.1).

Steps
1. In-principle approval of the institute: application in Annexure I with trust deed or
   registration, business plan and project feasibility report, layout, proposed courses, Principal's
   CV, faculty numbers; non-refundable fee Rs 1,00,000 (1.4.1, 1.4.2). Lapses if no course
   application follows within two years (1.4.7).
2. Own premises, or a registered lease of at least 3 years renewable for 3 more (1.4.8).
3. One application per course in Annexure III with the processing fee (1.5). The form asks for the
   list of equipment and publications and whether they are shared with other courses (items 16, 17),
   the faculty and instructors with documents, the course manual with syllabus, timetable and
   "procedure for evaluation, criteria for passing" (item 24), the certificate sample and the
   examination process (items 41, 42).
4. The institute tells DGS it is ready; DGS orders an inspection by the jurisdictional MMD with an
   approved external inspector (1.5.1, 1.5.2, 5.2.1). Major and minor deficiencies must be closed.
5. DGS grants approval. All approvals are provisional (1.6).

What the inspection report asks about the simulator (Annexure IX, item 20(f)), in full:
"Simulator Center (whether the simulator center is well equipped and complies with DGS guidelines
for the specific course) (i) Name of Courses: (ii) Type Approval of Simulator Obtained: (iii) Area".
The order does not say who issues that type approval. Circular 5 of 2004 says "approved or accepted
by the DGS"; a 2018 DGS circular for another course says "type-approved by an IACS member or DG
Shipping". Which of these DGS accepts for a new ROC/ARPA simulator today must be asked of the DGS
Training Branch or the MMD in writing; it cannot be settled from these documents.

Other requirements that touch the simulator room and its staff
- Classrooms, labs and simulators of DGS courses must not be shared with non-DGS courses (1.7.4).
- Alternate power for computers, UPS, simulators and their air-conditioners where power fails
  often (2.12.3). Air-conditioning where the room would exceed 30 deg C (2.8.2).
- A simulator instructor must have had guidance in instructional techniques with simulators and
  "practical operational experience of a particular type of simulator being used"; an assessor
  must have practical assessment experience on that type of simulator under an experienced
  assessor (3.2.1.3, 3.2.1.8; the wording is that of STCW Code section A-I/6).
- Faculty: as the course guideline says, otherwise Master (FG) certificate of competency (3.4.1);
  TOTA course within 6 months of joining (3.4.2); at least half of all lectures and practicals by
  full-time faculty (3.1.1); at most 26 teaching hours a week on simulator courses (3.6.4); age
  limits 65 / 70 / 72 (3.5).
- Syllabus and hours of the course guideline "must be strictly adhered to" (4.4, 4.5). Final
  examination by the institute; assessment records kept at least twelve months (4.10).
- Quality system to the applicable ISO standard within six months of the first course (1.8);
  returns on e-Samudra (1.11); 1% of fees to DGS each year, minimum Rs 10,000 (4.13); trainee
  feedback form with a score for "Simulator arrangement / Computer programs" (Annexure VIII).
- Approval lapses if the course is not run for a year (5.1).

What this means for this simulator
- Nothing in the software can obtain DGS approval by itself. Approval happens when an eligible
  institute installs it, applies for the ROC or ARPA course and passes the MMD inspection.
- At that inspection the software has to answer two questions: is it type-approved (by whom is not
  stated here), and does the simulator centre meet Circular 5 of 2004 (cubicles, number of own
  ships, the syllabus functions). The second is partly a software matter and is tracked above; the
  first is a certificate this project does not have.
- The software should keep assessment records that an institute can retain for twelve months
  (exercise records already export as CSV, JSON and a printable report; keeping them is the
  institute's job).

Still unread: the two May 2020 draft circulars for ROC and ARPA, and Training Circular 7 of 2017.
The scan was read through its text layer, which is poor in places; figures quoted above were
checked against the surrounding text, and one figure (the size of the Principal's room, 2.13.4)
was left out because it could not be read with certainty.

## Where the simulator stands

Strong: collision-avoidance maths and its tests; ARPA tracker behaviour (acquisition delay,
preliminary/steady vectors, lost target, target swap, errors from gyro/log faults, trial
manoeuvre, guard zones) tested against A.823(19) scenarios; instructor functions; records.

Weak, in order of how much they matter for a standard simulator:

| # | Gap | Now | What a standard simulator does |
|---|-----|-----|-------------------------------|
| 1 | Radar picture | BUILT: echoes are painted as arcs as wide as the beam plus the target and as deep as the pulse plus the target (beamwidths and pulse lengths from one maker's published specification). Since 13 Nov 2026: four real areas (Mumbai, Goa, Kochi, Gulf of Kutch) with real coastline and land heights, seen ray by ray with the Earth's curve, radar shadow and face-on return calibrated to IEC 62388 Tables 2 and D.7; ships hidden behind land; vessels at their class's typical beam; aspect spread from Table D.1 (`RADAR-PICTURE.md`). Still estimates: land reflectivity (one placeholder), land cover, the drawn coasts of the invented scenarios | Picture built per bearing and range cell: echo width follows beamwidth, depth follows pulse length, so range and bearing discrimination, target shape with aspect, and land shape with terrain height appear by themselves |
| 2 | Own ship behaviour | BUILT: six ship types on a manoeuvring model with rudder and engine orders, turning circle, speed loss in a turn, stopping, wind and current. Three types are fitted to published turning figures; the other three are estimates | Ship models with rudder and engine orders, turning circle, speed loss in a turn, stopping distance, wind and current effect; several ship types |
| 3 | Target behaviour | BUILT: 28 catalogue types with size and aspect-dependent echo, gradual turns and speed changes, programmed tracks. Figures are estimates | Many ship types with size, aspect-dependent echo, realistic manoeuvres |
| 4 | Symbols and alerts | BUILT 12 Nov 2026 as far as the two IMO documents go: symbols follow SN.1/Circ.243/Rev.2; alerts follow MSC.302(87) (alarm and warning priorities, acknowledged one at a time, 30-second silence, an unacknowledged warning repeated after 5 minutes). Checked against IEC 62288 and IEC 62388 on 13 Nov 2026 (`IEC-CHECK.md`): the alert priorities are the standard's, and the caution priority, the alert signal patterns and colours, the AIS turn indicator and the AIS outline to scale were added. Not done: alert history list | Symbols to IEC 62288 / SN.1/Circ.243; alerts by priority (alarm, warning, caution) with standard acknowledgement |
| 5 | Regression safety | 541 unit tests; 278 checks of the built page at three screen sizes (`npm run test:screen`); 15 checks of five linked displays (`npm run test:link`) | Every release checked on the real screen. The last layout change hid controls and no test caught it |
| 6 | Exercises and marking | 26 marked exercises (9 ARPA, 7 radar of which 4 on the real coasts, 10 manual plotting) + 6 ROC exercises; placeholder tolerances, no pass mark. Since 13 Nov 2026: printable marking sheets with boxes for the academy's own tolerances, points and pass mark, and a draft syllabus table against STCW A-II/1, Model Course 1.07 and DGS Circular 5/2004 with its gaps (`SYLLABUS-MATRIX.md`), not yet reviewed | The academy's exercise sheets and marking scheme |
| 7 | Stations | Proved 12 Nov 2026 with an instructor and four student displays in separate browsers through the server on one machine (`npm run test:link`), including the server stopping and coming back. Not tried on separate PCs | Instructor + 4 student stations proven on the academy network |
| 8 | Controls | Mouse and keyboard. Since 12 Nov 2026 every radar function has a key that can be changed, and a knob box that acts as a game controller is read (SETTINGS, Control panel). No real panel has been plugged in | Usually a radar keyboard/trackball panel (optional by class) |
| 9 | Validation | Headless browser checks only | Run on the academy PCs; signed off by a qualified radar instructor; checked against the DG Shipping guideline |

## Proposed order of work

0. PPC/PAD graphics, manual speed input, unstabilised head-up (named in the DGS syllabus and B-I/12; small jobs).
1. (Screen tests BUILT: `npm run test:screen`, 3 screen sizes.) Screen tests in `npm test` (every menu key shows its controls; course, speed, scenario, EBL/VRM,
   acquire, trial, exercises work) and a check after every delivery that the files arrived.
2. Radar picture rebuilt on range/bearing cells (beamwidth, pulse length, terrain height for land).
3. Own ship models with rudder and engine orders; wind.
4. Target types with aspect-dependent echo.
5. Symbols and alerts to the standards (BUILT 12 Nov 2026 to SN.1/Circ.243/Rev.2 and MSC.302(87); checked against IEC 62288 and IEC 62388 on 13 Nov 2026, see `IEC-CHECK.md`).
6. Exercises and marking from the academy's own sheets.
7. Multi-computer test; instructor sign-off; DG Shipping checklist.

## Documents needed

DG Shipping guideline/circular for Radar/ARPA (ROC, ARPA) simulator courses (the May 2020 drafts
are still unread); DNV-ST-0033 (supplied 12 Nov 2026, see below);
the academy's exercise sheets and marking scheme; one radar operator manual the academy
trains on. Turning on web search for this account would let the public ones be found directly.

## DNV-ST-0033, Edition April 2025: how DNV certifies, and where this simulator stands (read 12 Nov 2026)

Read from the PDF the user supplied on 12 Nov 2026 (180 pages). That copy is licensed to the person
who downloaded it and is marked "no further distribution", so it is NOT kept in this repository and
the requirements below are summarised, not copied. Read in full: Section 1 (general and
certification), Section 2 (general requirements), Section 3 (bridge operation), Appendix A
(hydrodynamic vessel models). Not read: Sections 4 to 16 (other kinds of simulator) and Appendix B
(tugs). This edition supersedes the August 2023 edition.

How certification works (Section 1)
- A manufacturer can obtain a "statement of compliance" for the product (1.5.2). A training provider
  obtains a "performance certificate" for the simulator as installed at its site (1.5.1; this was
  called the product certificate in earlier editions). Both are valid five years.
- Steps for the statement: design assessment and document evaluation, tests to a test programme that
  DNV has approved, witnessed by a DNV auditor, issue, renewal tests after five years (1.5.3.2, 1.9).
- A change that substantially alters performance needs DNV approval, and a change-log must be kept
  (1.5.3.3, 1.9.1.5). The version that is tested is the version that is certified.
- DNV assumes the user has a quality system and that the course curriculum is approved by the
  maritime administration (1.3.3). A DNV document does not replace DG Shipping course approval.

The classes for a bridge simulator (Table 3-1, 3.2)
- Class C (NAV): limited task, instructor-led, for instrument ("blind") navigation and collision
  avoidance. It must cover ALL the competences in its column of Table 3-2. That column holds radar
  and ARPA (STCW A-II/1.3, A-II/2.6) and also ECDIS (A-II/1.4, A-II/2.7), emergencies, distress,
  visual signalling, manoeuvring, steering, look-out and berthing.
- Class D (NAV): limited task, student-led (the instructor's part may be automated), for SELECTED
  competences of the same column.
- Class S (NAV): special tasks: "particular bridge instruments" or defined scenarios, for selected
  competences. Its requirements are set case by case from the equipment simulated and the
  competences defined (3.2.5, 3.3.1.1).

Class C column of Tables 3-3, 3-4 and 3-5, line by line (class D is the same list, except that it
adds 1.1.1 "displays arranged in a usable manner" and drops 3.1.10). Lines that apply only to ice,
integrated bridge or anchor-handling training are left out.

| Item | Requirement (summarised) | Now |
|------|--------------------------|-----|
| 1.1.3 | Controls of propulsion plant | Met on screen: engine telegraph keys |
| 1.1.7 | Steering and bearing compass or repeater; magnetic deviation table; gyro speed and latitude adjustment | NOT MET: heading readout only |
| 1.1.8 | Heading control system (autopilot) | Met |
| 1.1.9 | Radar/ARPA unit; 10 cm and 3 cm; stabilised relative motion; sea and ground stabilised true motion | Met |
| 1.1.11 | At least one VHF radio with DSC | NOT MET: typed messages only |
| 1.1.13 | ECDIS with electronic charts and sensor inputs | MISSING (not planned) |
| 1.1.14 | GPS, echo sounder, speed log through the water (two-axis ground speed for ships over 50,000 GRT) | Partial: position readout, STW and SOG; no echo sounder, no two-axis speed |
| 1.1.15 | Relative wind direction and force | Met |
| 1.1.16 | Sound panel to the rules of the road | Met (own-ship whistle and fog signals) |
| 2.1.1 | Own ship on a mathematical model with 6 degrees of freedom | Partly: surge, sway and yaw from the manoeuvring model; roll, pitch, heave and wave yaw added 12 Nov 2026 as simple wave motions with estimated size. Not a coupled six-degree model |
| 2.1.2 | Open-water hydrodynamics with wind, wave, tidal stream and current | Partial: wind, current and tide act on the ship; waves roll, pitch and yaw her but do not slow or set her |
| 2.1.8 | Exercise areas with correct land, depth, buoys and tidal streams, matching the charts and publications used | A small part since 12 Nov 2026: the scenario "Approaches to Mumbai" has the real coastline (OpenStreetMap data, about 250 m accuracy). No depths, lights, buoys, land heights or charted tidal streams, and the other areas are invented. Counted as not met |
| 2.1.9 | Radar: weather, tidal stream, current, shadow sectors, spurious and false echoes, propagation effects; coastlines, buoys, SART | Met by feature list (clutter, shadow sectors and land shadow, multiple, side-lobe and second-trace echoes, racon, SART). Realism not judged by a radar instructor |
| 2.1.10 | ARPA: manual and automatic acquisition, past track, exclusion areas, vector/graphic time scale and data, trial manoeuvre | Met |
| 2.1.11 | ECDIS functions | MISSING (not planned) |
| 3.1.1 | Several types of target ship, each with a model that reacts to current, wind or wave | Met for the 28 catalogue types (placeholder figures); the plain targets of older scenarios do not react |
| 3.1.4 | 100 target ships at the same time; the instructor can programme 20 voyage routes for each | BUILT 12 Nov 2026: 100 ships run together (scenario "Traffic: 100 ships on programmed tracks"; 60 frames a second in the headless test browser); the instructor can programme a track of up to 20 waypoints for every target. The standard's wording ("20 voyage routes for each target") is unclear and DNV's reading must be confirmed. The ARPA tracks 20 targets |
| 3.1.8 | Outside view on a display or projection; accurate visual bearings; magnified view | MISSING: there is no outside view |
| 3.1.10 | Learner can operate the human-machine interfaces | Met (mouse and keyboard) |
| 3.1.20 | Current pattern changing in time according to the charts; tides | Partial: one uniform current with a tidal cycle |
| 3.1.21 | Depth according to the charts, with tide level | MISSING: a scenario can hold shoal areas, but nothing reads depth |

Count for class C: 10 met (3.1.4 subject to DNV's reading of its wording), 3 partial, 8 not met or
missing, of 21. This is the project's own count, not a DNV finding.

General requirements for every class (Section 2)

| Item | Requirement (summarised) | Now |
|------|--------------------------|-----|
| 2.1.1.1 to 2.1.1.3 | Equipment works like real equipment; where it is no specific make it follows the IMO performance standard (functions); accuracy, reaction times and limitations resemble real equipment | Partly: checked against A.823(19) and MSC.192(79) in COMPLIANCE-MATRIX.md, gaps listed there; several radar values are placeholders; no instructor has reviewed it |
| 2.1.1.4 | User manual available to the learners | Met: docs/USER-MANUAL.md |
| 2.1.1.5 | Emulated instruments: realistic grouping, proportions and scales; dimming; alarm sounds like real ones | Partly: day and night palettes, brilliance, alarm and whistle sounds. Since 13 Nov 2026 the data area is laid out as ships' radars in general present their data (large heading and speed with their sensor, position, cursor and target data with units, settings in boxes, bars for gain and clutter; status lines first in the corners of the picture, and since the redesign of 13 Nov 2026 in six panels beside a centred picture, with nothing written over it). A generic arrangement, not any maker's screen; not assessed by a radar instructor |
| 2.1.1.6 | On a PC: starts easily; other programs, hot keys, closing and window controls disabled; no easy access to configuration files | Procedure written 12 Nov 2026 (INSTRUCTOR-MANUAL.md section 12): browser kiosk mode, with Windows assigned access to block Alt+F4 and Alt+Tab. Not tried on the academy's PCs |
| 2.1.1.7 | Cloud-based use: remote desktop; instructor and students plan, assign and perform exercises; runs on a personal computer | Partly: runs on any PC in a browser; exercises reach other stations only over the local link, proved with separate browsers through the server on one machine |
| 2.2.1.2 | Instructor can start, halt, reset and restart; change the environment; communicate with learners and follow their conversations; follow the exercise; plot tracks; inject failures | Mostly met (proved with separate browsers through the server on one machine, not on separate PCs): communication is typed, so there is no conversation to follow |
| 2.2.1.3 | Operation manual for instructor and assessor | BUILT 12 Nov 2026: docs/INSTRUCTOR-MANUAL.md |
| 2.2.1.4 | Replay of a full exercise showing the learner's actions, in slow motion and at rapid speed | Mostly met 12 Nov 2026: replay from 0.25x (slow motion) to 60x, ships moved smoothly between the 10-second samples, with the events and alarms; and, since later the same day, the learner's radar picture recorded every 15 seconds and shown in step with the replay. The picture is a still every 15 seconds, not a continuous recording, and is kept only in the browser that recorded it |
| 2.2.1.5 | A scoring or grading method can be set up | Met in form; the values are placeholders |
| 2.2.1.6 | (should) Restart from any point of the replay | Partial: take back 2, 5 or 10 minutes |
| 2.2.1.7 | Student-led use: automated scoring, result available to the instructor afterwards | Met in form |

Documents DNV asks for (Table 1-6, 1.8, 1.9, Appendix A)
- Simulation philosophy (one to two pages): not written.
- User interface description, including a list of all alarms and operator messages: partly in the
  learner's manual, which now explains the symbols and the alarm and warning priorities; no full
  alarm list.
- Instrument and equipment list: not written.
- Description of the software: modules with version numbers, and the mathematical and hydrodynamic
  models: not written (README and code comments only).
- Operation manual: learner's manual and, since 12 Nov 2026, the instructor's manual.
- Simulation objectives (STCW competence against exercises), operating capabilities including the
  limits and possible errors of real equipment, variety of conditions: partly, in COMPLIANCE-MATRIX.md
  and the manual.
- Test programmes with acceptance criteria and their justification: not written. The 508 unit tests,
  278 screen checks, 15 link checks and the exercise self-test are evidence, not a test programme in DNV's sense.
- Change-log: git history only.
- Appendix A, for each own-ship model: ship particulars, speed data (telegraph table, tactical
  diameter, crash stop), engine, propeller, rudder and autopilot data, all "modelled, documented and
  verified"; plus model test documentation, manoeuvring booklet, wheelhouse poster and pilot card
  (IMO A.601(15)). NOT MET. Since 12 Nov 2026 three of the six ship types are fitted to published
  turning figures (a VLCC to the sample ship in the ABS Guide for Vessel Maneuverability 2017,
  Appendix 1; a 105 m training ship to the sea-trial turning circle of MV Yukun, Sensors 20 (2020)
  3963; a 230 m container ship to the free-running model test of the KCS benchmark hull, Yasukawa
  et al. 2021 as tabulated by Kim, Tezdogan and Incecik, Ocean Engineering 2021), with the fit
  stated in tests/shipmodel.test.ts. The stopping distances of the container ship, coaster and
  tanker are tested to lie inside the typical ranges of IMO MSC/Circ.644 Appendix 3, which is a
  check against typical ships, not against one real ship. The turning of the tanker and coaster and
  everything about the bulk carrier remain estimates, and none has a manoeuvring booklet,
  wheelhouse poster or pilot card.

What to aim for
- Class C is no longer a radar-and-ARPA-only class. To claim it the product would need ECDIS, an
  outside view for visual bearings, six-degree ship motion with waves, real charted areas with depth
  and tide, VHF with DSC, an echo sounder, a compass with deviation table and 100 routed targets.
  That is a bridge simulator, a much larger product than this one. Class D has almost the same list.
- Class S (NAV), with radar/ARPA as the "particular bridge instrument" and competences A-II/1.3 and
  A-II/2.6, is the class this product fits. DNV sets the requirements case by case, so the list has
  to be agreed with DNV before work is planned. Expected to apply (the project's expectation, not
  stated in the standard): 1.1.9, 2.1.9, 2.1.10, 3.1.1, 3.1.4, all of Section 2, the documents, and
  Appendix A for the own-ship models.
- Whether DG Shipping or an institute accepts a class S statement for the ROC and ARPA courses is
  not known and must be asked before money is spent on certification.

Work for a class S application, in order: (1) agree the class S scope with DNV; (2) 100 targets at
once with programmable tracks (done 12 Nov 2026); (3) replay with slow and fast speeds, instructor's
operation manual, kiosk-mode procedure (done 12 Nov 2026); (4) own-ship models built from a real
ship's manoeuvring booklet; (5) the documents and a test programme; (6) freeze a version and keep a
change-log.

Realism work of 12 Nov 2026 (asked for by the user): target tracks allow for current; true-motion
picture follows the speed input; false echoes; seaway motion; radar set data from a maker's
published specification (Furuno FAR-21x7 series: beamwidths, pulse lengths, repetition rates); wave
heights from the WMO sea state code; three ship types fitted to published turning figures. Still
estimates: three ship types, target ship figures, response to the sea, automatic clutter, echo shapes (beam =
length / 7), land depth, strength of false echoes.

Further work of 12 Nov 2026 (asked for by the user): the replay shows the recorded radar picture;
one scenario on a real coastline (approaches to Mumbai, OpenStreetMap data); the container ship
fitted to KCS model tests and stopping distances checked against IMO typical ranges; symbols to
SN.1/Circ.243/Rev.2 and alerts to MSC.302(87); linked displays proved with five separate browsers
through the server; keys and knob-box inputs for a hardware control panel. Not done: AIS turn
indicator, AIS true-scale outline, alert history list, any trial on separate PCs or with a real
panel, and any review by a radar instructor.

Scope decided by the user on 12 Nov 2026: ROC and ARPA only. ECDIS, charts, an outside view and an
echo sounder are not to be built, so class C and class D are not targets.

## DNV Standard for Certification 2.14 (October 2007), Class C (NAV), line by line

Read from the PDF supplied on 11 Nov 2026. This is the OLD edition, kept for history. The current
one is DNV-ST-0033, Edition April 2025, checked in the section above; where the two differ, the
section above decides. In this old edition Class C (NAV) is "a limited task
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
| C3 c | At least 100 target ships at the same time, each with a route the instructor can programme | BUILT 12 Nov 2026: see 3.1.4 in the section above |
| C3 p | Current pattern changing in time according to the charts; tidal waters | Partial: one uniform current plus a tidal cycle |
| C3 q | Depth according to the charts, with tide level | MISSING |
| Sec.2 A104 | User manual available to the learners | BUILT 12 Nov 2026: docs/USER-MANUAL.md |
| Sec.2 B102 | Instructor: start, halt, reset, restart; change environment; communicate; follow the exercise; plot tracks; inject failures | Met, proved with separate browsers through the server on one machine (communication typed) |
| Sec.2 B104 | Replay of a full exercise, also faster and slower than real time | BUILT 12 Nov 2026: 0.25x to 60x, with the recorded radar picture; see 2.2.1.4 in the section above |
| Sec.2 B105 | Scoring or grading method | Met in form; values are placeholders |
| Sec.2 B106 | Set the exercise to any point of the replay and restart from there | Partial: take back 2, 5 or 10 minutes |

Consequence for the work order: the own-ship model (rudder, engine telegraph, autopilot, 3 degrees
of freedom, three ship types, wind) and ten target types are explicit Class C requirements, so they
move ahead of the radar-picture rebuild.

Also supplied: DGS Training Manual Vol IV. It is an index of DGS orders and circulars, with no
requirements in it. The one that matters here is DGS Order 05 of 2016 (procedure for approval of
simulator courses); read on 12 Nov 2026, see the section on it above. The two May 2020 draft circulars (ROC, ARPA) are still not read.
