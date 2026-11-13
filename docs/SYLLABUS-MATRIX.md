# Syllabus matrix (DRAFT): ROC and ARPA courses against the simulator's exercises

Draft of 13 Nov 2026. For each syllabus item: which exercise or function of the simulator covers it,
how the simulator marks it, and what is missing. Written from:

- **STCW Code** (2017 consolidated edition), Table A-II/1, the competence "use of radar and ARPA to
  maintain safety of navigation" (columns 2 and 4).
- **IMO Model Course 1.07**, Radar navigation at operational level (2017 edition): the course outline
  (Part B, topics 1 to 7 and the practical training sessions) and the sample assessment material
  (Part E, appendices 5 and 6).
- **DG Shipping Training Circular No. 5 of 2004**: the ARPA course annexures (topics and assessment)
  and its section on the radar observer simulator course (ROSC).

The documents are summarised, not quoted. **No instructor has reviewed this table.** It is a
starting point for the institute's own course mapping, not an approval document, and nothing here
means the simulator or a course is approved. Not read: DG Shipping's draft ROC and ARPA circulars of
May 2020, which may change the topic list. Every tolerance and limit in the exercises is a
placeholder (see the marking sheets: Instructor tab, "Marking sheets").

## How to read the tables

Exercises 1 to 26 are the marked exercises on the Exercises tab: 1 to 9 ARPA, 10, 11 and 22 to 26
radar, 12 to 21 manual plotting. "ROC: ..." is one of the six exercises on the ROC tab (plotting,
position fixing, set and drift, clearing range, blind pilotage, heavy traffic); they give a checked
report (some say passed or not passed, against placeholder limits) but no score. "Free practice" means a scenario with no marking.

How an item is marked in the simulator:

- **Q**: a question. A number checked against the real value within a tolerance, or a multiple choice.
- **A**: an action the simulator sees done (a target tracked, an index line set, an alarm acknowledged).
- **O**: an outcome judged at the end from what happened (passing distance, Rule 8 size of the action,
  Rule 19(d) in restricted visibility, track kept, distance off the land, anchor position).
- **Assessor**: not checked by the simulator. The instructor judges it (observation, written test, oral).

## 1. STCW Table A-II/1: use of radar and ARPA

### Knowledge, understanding and proficiency (column 2)

| Item (summarised) | Exercises | Marked by | Gap or note |
|---|---|---|---|
| Radar performance: factors affecting performance and accuracy | 22, 25, 11; free practice (ducting, rain, sea state, X and S band) | 22 A, O; 25 Q (low coast shows late); 11 Q (no SART on S band) | Detection ranges of the ship types are estimates |
| Radar performance: setting up and maintaining displays | 22, 1 | 22 A, O, Q; 1 A | |
| Radar performance: detecting misleading information: false echoes, sea return, racons and SARTs | 11; free practice ("False echoes" scenario) | 11 Q, O | False echoes and sea return are not marked |
| Radar use: range and bearing; course and speed of other ships; CPA and TCPA of crossing, meeting and overtaking ships | 1, 2, 5, 11, 12-21, 23, 25, 26; ROC plotting | Q | |
| Radar use: critical echoes; other ships' changes of course and speed; effect of own changes of course or speed | 3, 6, 9, 12-21, 25 | Q; A (6, trial manoeuvre); O | |
| Radar use: applying the collision regulations | 6, 9, 12-21, 25, 26; ROC heavy traffic | O | See the criteria below for timing |
| Radar use: plotting techniques; relative and true motion | 12-21, 2; ROC plotting | Q, O | No true-motion plot (see section 4) |
| Radar use: parallel indexing | 10, 24 | A (line set), O (track kept), Q (course to steer) | |
| ARPA: types, display characteristics, performance standards, dangers of over-reliance | 8, 23 | Q | Mostly theory: written test or oral |
| ARPA: performance and accuracy, tracking capabilities and limits, processing delays | 1, 3, 8 | A (track waited for until steady), Q | |
| ARPA: operational warnings and system tests | 4, 5, 8, 24 | A (alarm acknowledged, self-test run), Q | |
| ARPA: methods of acquisition and their limits | 1, 4 | A, Q | |
| ARPA: true and relative vectors; graphic presentation; danger areas | 2, 7, 26 | A (both vector modes used), Q | PPC and PAD graphics are on the ARPA but no exercise marks them |
| ARPA: deriving and analysing information; critical echoes; exclusion areas; trial manoeuvres | 4, 6, 9, 25 | A, Q, O | |

### Criteria for evaluating competence (column 4)

| Criterion (summarised) | How the simulator checks it | Gap |
|---|---|---|
| Radar and ARPA information correctly interpreted and analysed, allowing for the equipment's limits and the conditions | Q items in every exercise | Tolerances are placeholders |
| Action to avoid a close-quarters situation or collision follows the collision regulations | O: passing distance; Rule 8 size of action; Rule 19(d) in restricted visibility; no turn to port in the plotting exercises | |
| Decisions to alter course or speed are timely and follow accepted practice | Plotting exercises only: the manoeuvre must not come before 12 minutes | Elsewhere the timing is for the assessor; no exercise says "too late" |
| Changes of course and speed keep the ship safe | O: track kept (10, 24), off the land (23), anchored in position (24), passing distance | Resuming course after the danger has passed is not checked |
| Communication clear, concise and acknowledged | Not checked | Assessor. Typed messages exist between stations and the instructor |
| Manoeuvring signals made at the right time | Not checked | Assessor. Sound signals are not simulated |

## 2. Model Course 1.07: course outline

| Topic | Item (summarised) | Exercises or function | Marked by | Gap or note |
|---|---|---|---|---|
| 1.1 | Principles of radar; practical 1-1 (configuration and siting on board) | Lecture; the controls can be demonstrated | Assessor | Shipboard installation is not simulated |
| 1.2, 1.3 | Magnetic safe distances; radiation hazards | Lecture | Assessor | |
| 1.4 | Equipment factors affecting detection (band, pulse length, beamwidth, antenna height) | 22; 11 (S band); free practice | A (22), Q (11) | Pulse length and beamwidth choices are not marked |
| 1.5 | External factors affecting detection (sea, rain, propagation, the target) | 25 (rain squall, low coast); free practice (ducting, sub-refraction) | Q (25) | |
| 1.6 | Factors affecting observation (shadow sectors, false echoes) | Shadow sectors in every scenario; "False echoes" scenario | Not marked | Gap |
| 1.7 | Performance standards for radar | Lecture | Assessor | |
| 2.1, 2-1 | Setting up and maintaining the best picture | 22 | A, O, Q | |
| 2.2 | Accurate range and bearing measurement | 11, 23; ROC position fixing | Q | |
| 3.1, 3-1 | Radar position fixing | 23; ROC position fixing; ROC set and drift | Q (range, bearing, latitude, longitude); O (off the land) | |
| 3.2 | Radar aids to navigation (racons, SARTs) | 11 | Q, O | |
| 3.3, 3-2 | Parallel index techniques | 10, 24; ROC blind pilotage | A, O, Q | |
| 3.4, 3-3 | Radar maps, navigation lines and routes | 10 (navigation line); ROC clearing range | A (10) | No routes on the radar |
| 3.5 | Electronic chart overlay | Not built | | Outside this simulator (no ECDIS) |
| 4.1-4.3, 4-1 | Relative motion triangle; course, speed and aspect; CPA and TCPA | 12-21; ROC plotting | Q | Aspect is not asked |
| 4.4, 4-2, 4-3 | Effect of own changes of course and of speed | 12-21 (the manoeuvre), 6 (trial manoeuvre) | O, A, Q | |
| 4.5, 4-4 | Plotting report | 12-21 (answers typed in) | Q | No separate report form |
| 5.1-5.7 | ARPA/TT and AIS: display characteristics, association, standards, acquisition and activation, tracking limits, delays | 1-5, 8 | A, Q | AIS: no marked exercise |
| 6.1 | Setting up the ARPA display | 1, 2 | A | |
| 6.2 | Setting up the AIS display | Free practice | Not marked | Gap |
| 6.3 | Obtaining target information | 1, 2, 5, 7, 25, 26 | Q | |
| 6.4 | Errors of interpretation | 2, 3, 7, 26 | Q | |
| 6.5 | Causes of errors in displayed data | 8 (gyro and log), 23 (position input lost) | Q | |
| 6.6 | System operational tests | 8 | A (self-test run) | Checking the ARPA against a manual plot is not marked |
| 6.7 | Over-reliance on ARPA and AIS | 8, 23 | Q | |
| 5 and 6-1 | Practical: operating ARPA/TT and AIS | 1-9, 24 (anchor watch), 26 (ground reference) | A, Q, O | AIS part not marked |
| 7.1 | Proper use and full interpretation of radar information | 9, 25 | Q, O | |
| 7.2 | Radar factors in safe speed | None | | Gap (Rule 6(b)) |
| 7.3 | Getting enough radar information (systematic observation) | 1 (track left to settle), 12-21 (12-minute plot) | A, O | |
| 7.4 | Avoiding action based on that information, under the collision regulations | 6, 9, 12-21, 25, 26; ROC heavy traffic | O | |
| 7.5 | When to use radar | Lecture | Assessor | |
| 7-1 | Ship handling for collision avoidance | 6, 9, 25, 26 (with the ship model) | O | |

## 3. DG Shipping Training Circular 5 of 2004

### ARPA course topics (annexures)

| Item (summarised) | Exercises or function | Marked by | Gap or note |
|---|---|---|---|
| Describing ARPA: display (vectors, graphics, PPC, PAD), performance standards, acquisition, tracking capabilities and limits, delays | 1-4, 8 | A, Q | PPC and PAD not marked |
| Setting up and maintaining displays: stabilisation modes, acquisition and exclusion areas | 1, 4, 7, 26 | A | |
| Target information in true and relative modes, with the trial manoeuvre | 2, 6 | A, Q | |
| Errors of interpretation (for example a vector read in the wrong mode) | 2, 7, 26 | Q | |
| Errors in displayed data (installation, ship's motion) | 8 | Q | Ship's motion: free practice only |
| System tests and what to do on a malfunction | 8, 23 | A, Q | |
| Over-reliance on ARPA | 8 | Q | |
| CPA, TCPA, course and speed of targets | 1, 5, 25, 26 | Q | |
| Collision regulations: avoiding close quarters, then resuming course and speed | 6, 9, 25, 26 | O | Resuming course and speed is not checked |

The circular's hours do not add up the same way in its two annexures (33 hours in one, about 41 in
the topic list); the institute will know which applies.

### Assessment (annexure) and the ROSC

| Item (summarised) | Exercises | Marked by | Gap or note |
|---|---|---|---|
| Objective (theory) test | None | Assessor | Outside the simulator |
| Manual plotting test | 12-21; ROC plotting | Q, O | |
| Simulator demonstration: display set-up | 22 | A, O, Q | |
| Simulator demonstration: plotting own ship's position | 23; ROC position fixing | Q, O | |
| Simulator demonstration: parallel indexing | 10, 24 | A, O, Q | |
| Simulator demonstration: target information from the ARPA | 1, 2, 5, 26 | Q | |
| Oral: ARPA operation and the collision regulations | None | Assessor | |
| ROSC: based on STCW A-II/1, assessed by practicals and an oral | Section 1 above | | |
| Simulator to be of a type approved or accepted by DG Shipping; own-ship cubicles; at most three trainees per display | None | | Not a software matter. The type approval is still needed and is not held |

## 4. Model Course 1.07, sample assessment material (Part E)

Appendix 5 is an example assessment of the ARPA/AIS practical. Appendix 6 has a 34-item sample
checklist for proficiency in the use of radar and ARPA, and a ten-task sample checklist for radar
plotting and simulation, scored 3, 2 or 1 per task, with a sample pass of 21 out of 30. These are
samples: the institute decides whether to use them. The simulator does not apply them.

### The ten-task plotting and simulation checklist

| Task (summarised) | Exercises | Marked by | Gap or note |
|---|---|---|---|
| 1. Relative plot: CPA, TCPA, course, speed and aspect | 12-21; ROC plotting | Q | Aspect not asked |
| 2. Relative plot after the target alters | 3 (with the ARPA) | Q | No manual plotting exercise has a target that alters |
| 3. Relative plot after own ship alters | 12-21 | O (passing distance after the manoeuvre) | The new CPA and TCPA are not asked |
| 4. Own action needed to pass at a given CPA | 12-21; 6 | O (12-21); Q (6: smallest alteration that clears every ship) | |
| 5. True plotting | None | | Gap |
| 6. Switching on the radar and ARPA correctly | 22 | A, O, Q | |
| 7. Stabilisation, orientation, vectors and trails | 2, 7, 26 | A, Q | |
| 8. Managing targets (radar and AIS) | 1, 4, 5 | A | AIS not marked |
| 9. Adjusting settings to the conditions, and as they change | 22, 25 | A, Q | A change of conditions (the rain in 25) is not marked as an action |
| 10. Manoeuvring by accepted practice and the collision regulations | 6, 9, 12-21, 25, 26 | O | Timing: see section 1 |

### The 34-item proficiency checklist, grouped

| Items | Subject (summarised) | In the simulator |
|---|---|---|
| 1-6, 34 | Installation on board, sensor connections, spares, maintenance tags, panel layout, radar log book | Not simulated: lecture, a real set, or oral |
| 7 | Starting procedure | Exercise 22 |
| 8-17 | Range scales and rings; stabilisation; orientation; true and relative motion; heading line; cursor; off-centring; heading and speed inputs; position and time; EBL and VRM | Functions present and used in 1, 2, 7, 10, 22, 23; not marked one by one. No manual set and drift input. The stern line and the antenna mark are on the Radar tab |
| 18-22, 24, 25 | CPA/TCPA limits; manual and automatic acquisition; guard zones; trial manoeuvre; vectors; trails | Exercises 1 to 6 |
| 23 | AIS: sleeping and activated targets, symbols, data, association with radar tracks | Functions present; no marked exercise |
| 26-28 | Parallel index lines; marks; alarms, including the anchor watch | Exercises 10 and 24 |
| 29-31 | Routes; maps; optional data (wind, depth, chart underlay) | Navigation lines and marks only |
| 32 | Shadow sectors (blind sector card) | Shadow sectors simulated; not marked |
| 33 | Performance monitor | Exercise 22 |

## 5. Exercise index: what each exercise covers

| No. | Exercise | STCW A-II/1 (section 1) | MC 1.07 | DGS 5/2004 |
|---|---|---|---|---|
| 1 | Setting up and manual acquisition | ARPA acquisition; performance and delays | 5.5, 6.1, 6.3 | Operating ARPA; target information |
| 2 | True and relative vectors, vector time | ARPA vectors | 6.3, 6.4 | True and relative modes; errors of interpretation |
| 3 | Past positions and a target's manoeuvre | Changes of course and speed; delays | 5.6, 5.7, 6.4 | Tracking limits and delays |
| 4 | Automatic acquisition, guard zones, exclusion areas | Acquisition methods; exclusion areas | 5.5, 6.1 | Acquisition and exclusion areas |
| 5 | CPA/TCPA limits, alarms, bow crossing | Operational warnings | 6.3 | Target information |
| 6 | Trial manoeuvre | Trial manoeuvres; collision regulations | 4.4, 7.4 | Trial manoeuvre |
| 7 | Sea and ground stabilisation in a current | Vectors; interpretation | 6.4 | Stabilisation modes |
| 8 | Sensor errors and ARPA limits | System tests; over-reliance | 6.5, 6.6, 6.7 | Errors in displayed data; tests; over-reliance |
| 9 | Collision avoidance in restricted visibility | Collision regulations | 7.1, 7.4, 7-1 | Collision regulations |
| 10 | Parallel index navigation and radar map | Parallel indexing | 3.3, 3.4 | Demonstration: parallel indexing |
| 11 | Search and rescue: homing on a SART | Racons and SARTs | 3.2 | |
| 12-21 | Manual plotting (ten situations) | Plotting; CPA and TCPA; collision regulations | 4.1-4.5, 7.4 | Manual plotting test |
| 22 | Switching on and setting up the radar | Setting up displays | 2.1, 2-1 | Demonstration: display set-up |
| 23 | Mumbai: radar fix with the GNSS failed | Range and bearing; position | 2.2, 3.1, 3-1, 6.5, 6.7 | Demonstration: own ship's position |
| 24 | Goa: parallel index approach, anchoring and anchor watch | Parallel indexing; operational warnings | 3.3, 3-2, 3.4 | Demonstration: parallel indexing |
| 25 | Kochi: collision avoidance in restricted visibility off a low coast | Performance factors; collision regulations | 1.5, 6.3, 7.1, 7.4, 7-1 | Collision regulations |
| 26 | Gulf of Kutch: tidal stream, ground stabilisation and a meeting ship | Vectors; interpretation; collision regulations | 6.3, 6.4, 7.4 | Stabilisation modes; errors of interpretation |
| ROC | Plotting; position fixing; set and drift; clearing range; blind pilotage; heavy traffic | Plotting; position; parallel indexing; collision regulations | 4.1-4.3; 3.1; 3.1; 3.4; 3.3; 7.4 | Manual plotting; own ship's position |

## 6. Gaps, most important first (proposed)

1. **All tolerances, points and pass marks are placeholders.** The institute sets them (the marking
   sheets have boxes for this). Model Course 1.07 Appendix 6 offers a sample scheme the institute may
   adopt or not.
2. **AIS is not marked anywhere** (MC 1.07 5.2, 5.3, 5.5, 6.2 and practical 5 and 6-1; Appendix 5;
   Appendix 6 item 23 and task 8). The AIS functions are built; an exercise needs writing.
3. **Timing of avoiding action** is judged only in the plotting exercises (not before 12 minutes), and
   **resuming course and speed** after the danger has passed is not checked anywhere (A-II/1 column 4;
   DGS 5/2004).
4. **False echoes, sea return and shadow sectors** are simulated but not marked (A-II/1; MC 1.07 1.6;
   Appendix 6 item 32).
5. **Safe speed** (MC 1.07 7.2) is not marked.
6. **Manual plotting**: aspect is not asked; no exercise has a target that alters; no true plot
   (MC 1.07 4.2; Appendix 6 tasks 1, 2 and 5).
7. **PPC and PAD graphics** are built but not marked (DGS 5/2004).
8. **Display functions not built**: routes on the radar; manual set and drift input; chart overlay
   (MC 1.07 3.4, 3.5; Appendix 6 items 15, 29, 31).
9. **Outside the simulator**: the theory test, the oral, shipboard installation topics, the radar log
   book, communications and sound signals. These stay with the assessor.
