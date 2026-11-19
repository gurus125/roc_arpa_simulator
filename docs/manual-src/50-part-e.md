%% PART E | Reference | The limits of the simulator, the figures the institute must set or check, what to do when something does not work, the abbreviations, and the sources.

# Limits of the simulator {#limits}

<p class="lead">A simulator is useful only to someone who knows where it stops being like the real thing. This chapter gathers every limit in one place.</p>

## Approval and review {#limits-approval}

- The simulator has not been approved by the Directorate General of Shipping, certified by a classification society, or approved by anyone else.
- At the date of this edition no radar instructor has reviewed it: not the picture, not the exercises, not the answer keys, not the marking.
- It was compared by its makers with the IMO performance standards for radar and ARPA, with the international standards for shipborne radar and for the presentation of navigation information, and with standard textbooks ({ref:sources}). That is a list of simulated functions and checked calculations, not a certificate.

## What is not simulated {#limits-missing}

- **No view from the bridge windows.** Visibility is told in words. A vessel is "in sight" when her range is not more than the visibility; the look-out reports vessels only, not buoys, land or lights, and says nothing of a vessel's aspect.
- **No chart.** There are no depths, lights or buoys other than the targets of a scenario. The route, the traffic separation scheme and the charted coastline are lines on the radar, as a radar map is. A separation scheme can only be straight.
- **No echo sounder and no voice radio.** Messages are typed.
- **No 24-hour history of alerts.**

## The radar picture {#limits-picture}

- The picture is simplified compared with a real set. Beamwidths and pulse lengths are those of one maker's published specification, taken as typical.
- The shape of an echo, how its strength changes with aspect, the depth of a land echo, the automatic clutter settings and the strength of false echoes are estimates.
- In the four real areas the coastline is from open map data (about 250 m accuracy) and the land heights from an open elevation model (90 m cells). How strongly land returns is set by one figure that an instructor should check against a real set.
- The four radar signal faults all have the same effect. On a real set the loss of the heading marker or of the azimuth signal may look different.
- Mirror images in a quay or bridge and the echo of a power line are seen on the picture but cannot be acquired by the ARPA. Multiple, side-lobe and indirect echoes can.

## Own ship and the other ships {#limits-ships}

- Three of the six ship types are fitted to published turning figures; the other three are estimates.
- Roll, pitch, heave and the yaw a sea gives are simple wave motions whose size is an estimate. The sea does not slow the ship or set her.
- Every figure of the target catalogue is typical for the type, not the data of a ship.
- A plain target (no catalogue type) is given its course and speed over the ground and changes them at once.
- Random traffic is placed without regard to land.

## The ARPA and the AIS {#limits-arpa}

- The ARPA tracks 40 targets, and the display holds 40 activated AIS targets and 240 in all: the figures of the performance standard for the largest class of ship.
- The ARPA's measurement errors follow the figures of the radar standard, and its tracking was run against that standard's tracking scenarios. This was done by the project, not by a test house.
- Automatic acquisition leaves out an echo 800 m or more across or deep, as land. Sets differ.
- Interference from another radar gives the ARPA a fixed number of false plots a turn unless interference rejection is on: a placeholder.

## Exercises, marking and assessment {#limits-marking}

- Every tolerance, every number of points, every safe distance and every time limit is a placeholder until the institute sets its own.
- The answer keys of the questions on the collision regulations and on search patterns have not been checked by an instructor.
- The simulator marks what it can measure. It does not judge the timing of an action, reporting or teamwork.
- The simulator records who was named at the controls, not whose hand was on the mouse.
- The attention flags, the measured facts beside the checklist, the check of a decision against the record and the debrief questions are helps made by fixed rules. They can be wrong about what matters in a given exercise.
- The measured facts come only in the 31 marked exercises, not in the ROC exercises or in free practice.
- A display cannot be taken back in time in an ROC exercise, and a time limit cannot be set for one. The self-test does not include the ROC exercises.

## The classroom {#limits-classroom}

- The link between station and displays, and the server's store, have been proved with separate browsers on one computer, not yet on separate computers over a network.
- A copy on a web site has no classroom server.
- Nothing on the classroom network is encrypted. A trainee's PIN, the instructor PIN and the station key keep a class in order; they do not keep out someone who means to get in.
- The radar pictures of a replay stay in the browser of the display that recorded them.
- The live picture of a display at the station is a small copy every two seconds: enough to follow, not to measure.
- A track for a target on a trainee's display is typed as bearings and ranges, not clicked on a picture.
- The hardware control panel has been tried with simulated inputs only.
- Two screens and kiosk mode have been checked in a test browser, not on a classroom's own computers.

# Placeholders: figures to set or check {#placeholders}

<p class="lead">A placeholder is a figure this project chose so that the simulator could work. None comes from a rule, a syllabus or an approved marking scheme. Before a score is relied on, the institute should set each one or accept it knowingly.</p>

## Set at the station {#placeholders-station}

These can be changed without a programmer.

@cols 38 24 38
| Figure | Starts at | Where |
|---|---|---|
| Tolerances of reported values | See {ref:marking-tolerances} | EXERCISES, Scoring settings |
| Points: question, action, outcome | 10, 10, 20 | The same |
| Pass mark | None | The same |
| "Large enough" action | A turn of 30°, or speed to 50% | The same |
| Limits of exercise 22 | Speckle 0.02 to 0.25, tuning within 6, brilliance 40, clutter zero up to 5 | The same |
| Time limit of any of the 31 exercises | None (exercise 31: 8 minutes) | EXERCISES, Time limit |
| Parts of the two examinations | ROC: 22, 13, 15, position fixing, 10. ARPA: 1, 5, 6, 8, 31 | EXERCISES, Examinations |
| The observation checklist and its standards | Twelve items | CLASSROOM, Observe, Checklist items |
| Students per display, hours per pair, changeover time | 2, none, none | BATCHES |

## Fixed in the program {#placeholders-program}

These need a developer to change. The name in the last column is where it is in the program.

@cols 40 30 30
| Figure | Value | In the program |
|---|---|---|
| Safe passing distance of each exercise | 0.2 to 2 NM, stated in each briefing | `safeNm` of each exercise |
| Track limit of exercises 10, 24 and 27 | 0.25 NM | The exercise files |
| Exercise 23: distance off the land | 1 NM | `port-exercises.ts` |
| Exercise 24: anchored within | 0.3 NM | `port-exercises.ts` |
| Exercise 28: time allowed in the zone or against the flow | 30 s | `NAV_LIMITS` |
| Exercise 29: MOB key within; back to within; at not more than | 30 s; 0.1 NM; 5 kn | `NAV_LIMITS` |
| Exercise 30: "safe speed", reached within | 8 kn, 8 min | `NAV_LIMITS` |
| With the flow, against the flow in a lane | Within 45°; beyond 135° | `TSS_LIMITS` |
| ROC plot tolerances | Course 3°, speed 0.5 kn, CPA 0.2 NM, TCPA 1.5 min, aspect 5° | `ROC_PLACEHOLDERS` |
| ROC fix error; angle of cut | 0.15 NM; 30° | `ROC_PLACEHOLDERS` |
| ROC set and drift tolerances | 10°, 0.3 kn | `ROC_PLACEHOLDERS` |
| ROC pilotage: off the track | 0.4 NM | `ROC_PLACEHOLDERS` |
| ROC traffic: large enough; in ample time | 30°; 4 NM or 12 min | `ROC_PLACEHOLDERS` |
| Attention flags | Urgent within 6 min; tracked by 12 min; land 0.3 NM; alert 60 s; route 0.3 NM; idle and paused 3 min; time left 2 min; gain 15, clutter 85 | `ATTENTION_LIMITS` |
| "In sight" | Range not more than the visibility | `visibility.ts` |
| Radar warm-up | 90 s | `RADAR_WARM_UP_SEC` |
| Echo left out by automatic acquisition, as land | 800 m | `landEchoMinM` |
| False plots from interference | 120 a turn | `interferencePlotsPerScan` |
| How strongly land returns | 10 | `LAND_REFLECTIVITY` |
| Anchor: let go below; drags at | 1 kn; 0.5 kn | `world.ts` |
| Detection range in sub- and super-refraction | About 80% and 140% | `signal.ts` |
| Loss of echo in rain | By band and intensity | `signal.ts` |
| Ship handling of three ship types; the target catalogue; the response to the sea | Estimates | `shipmodel.ts`, `targets.ts`, `seaway.ts` |
| The robot student's levels: the chance and size of each mistake | Chosen for the demonstration ({ref:robot-levels}) | `ROBOT_LEVELS` |

The rules of the manual plotting exercises (plot for 12 minutes, 1 NM, 80%, 30° a minute and 3 knots a minute) follow the plotting trainer the institute supplied as a reference.

## Questions for an instructor {#placeholders-questions}

1. Are the tolerances wide enough for values read from a settled ARPA track, and narrow enough to mean something?
2. What is the pass mark, and is it the same for every exercise?
3. Is a turn of 30°, or a cut to half speed, the right test of "large enough to be readily apparent" for these ships?
4. Are the safe passing distances right for each situation: 2 NM in open sea, 1 NM off a coast, 0.5 NM in a lane?
5. Are the twelve checklist items the right ones for the institute's courses, and do the standards say what you would accept and refuse?
6. Should a fix be marked when the second object is observed, or should the trainee say when the fix is complete?
7. In a group, is "what was done while at the controls" a fair share of the individual result, or should some exercises be worked alone for assessment?
8. Is a changeover by the clock wanted during a collision-avoidance exercise, or only between exercises?
9. Is "fewer than half of the items right" a sensible point at which to ask for a reason when no pass mark is set?
10. Which of the measured facts would you rather not see while ticking, so that the tick stays your own observation?
11. Does land show at the right range in the four real areas, compared with a real set?
12. Are the answer keys of the questions on the collision regulations, on the Williamson turn and on search patterns what you teach?
13. Which exercises make up each practical examination?

# Troubleshooting {#troubleshooting}

<p class="lead">What to check when something does not work, by where it happens.</p>

## Starting {#trouble-start}

@cols 34 66
| What happens | What to check |
|---|---|
| The page does not open, or opens blank | Use a current Chrome or Edge. Open the file itself, not a shortcut to an old copy |
| The display starts empty: no batches, no records | A different browser, Windows user or address has its own store ({ref:installing-files}). Open it the way it was opened before |
| No sound | Click once anywhere on the page: a browser lets sound start only after a click. Check that "Audible alarms" is ticked ([[MENU]], [[ARPA]]) and that the computer's sound is on |
| The ship control window does not open; a "print or save as PDF" key does nothing | The browser has blocked a pop-up window. Click the icon at the right of the address bar and allow pop-ups for this page |
| The clock stops when another program or tab is in front | A browser stops a page it is not showing. Keep the simulator's window in view. The ship control window keeps the clock running while it is in front |
| An exercise was lost when the page was reloaded | Reloading starts the display afresh: an unfinished exercise is not kept. Do not reload during an exercise |

## The radar {#trouble-radar}

@cols 34 66
| What happens | What to check |
|---|---|
| No picture at all | The RADAR key: off, warming up or standby. The brilliance. A radar signal fault (`NO RADAR PICTURE`) |
| Few or no echoes | Gain too low; sea or rain clutter too high; the tuning; a longer pulse for distant targets. In rain, try S band. The instructor may have reduced the radar's performance: use the performance monitor |
| The picture swings and smears | Head-up in a seaway, or the gyro has failed. Use north-up or course-up |
| Everything slides across a true-motion picture | The speed input is wrong or missing ({ref:presentation-stab}) |
| An EBL or VRM cannot be moved | It is locked. Untick and tick its box |
| Bearings end in R | The EBLs are set to relative ([[EBL BRG]]), or the gyro has failed |
| `PICTURE FREEZE` | The echoes are old. Do not use the picture until it is back |

## The ARPA and the AIS {#trouble-arpa}

@cols 34 66
| What happens | What to check |
|---|---|
| A click does not acquire | [[ACQUIRE]] must be lit. The click must be on an echo. The ARPA may be in standby, or off in an ROC exercise. The target may be beyond 24 NM, or the tracker full (40) |
| A target has no vector | It is still being acquired; "Vectors of dangerous targets only" is on; or, with relative vectors, it is on own ship's course and speed |
| Values followed by a yellow `?` | The track is preliminary. Wait |
| The dangerous-target alarm keeps sounding | Acknowledge it. If it keeps coming for targets that do not matter, the limits are too wide for these waters |
| No alarm for a target on a collision course | Both limits must be broken: it may still be outside the TCPA limit |
| A target was lost | A weak echo, clutter, or a fault. Check gain and clutter and acquire it again |
| The AIS key is greyed out | A manual plotting exercise: AIS is locked off until Finish |
| An AIS target shows `MISSING` | The ship does not send that item; a class B set sends little |

## Own ship {#trouble-ship}

@cols 34 66
| What happens | What to check |
|---|---|
| The ship does not answer the helm keys | Press [[HAND STEERING]] first. In autopilot she steers the set course |
| [[LET GO ANCHOR]] does nothing | She must be making less than 1 knot over the ground |
| [[MOB]] places no mark | The position-fixing system has failed |
| The position reads `NO FIX` | The GNSS has failed: fix by radar |

## Exercises {#trouble-exercises}

@cols 34 66
| What happens | What to check |
|---|---|
| An exercise cannot be started: its key is greyed | It is not assigned to your batch |
| Nothing moves after choosing an exercise | An exercise starts paused. Press [[RUN]] |
| "This cannot be answered yet" | The event the question asks about has not happened |
| An answer was marked wrong though it was read from the ARPA | It is checked at the moment Answer is pressed: values change with time, and a preliminary track is not yet right |
| No pass or fail is shown | The instructor has set no pass mark |
| "My results" shows little | Without a PIN login it shows only what this display recorded under the name |

## The instructor station and the classroom {#trouble-station}

@cols 34 66
| What happens | What to check |
|---|---|
| The station does not accept the PIN | The first PIN is 0000. It is kept in that browser: another browser or address has its own |
| The instructor PIN is forgotten | There is no key that shows it. Removing the page's stored data in the browser puts the PIN back to 0000 and removes the class and the records held in that browser. If they are kept on the classroom server, type the station key afterwards and take them back ({ref:station-key}) |
| A display has no card on the CLASSROOM page | Read the link line. `same computer only`: the station was opened from the file; open it from the server's address. Is the display open at the same address as the station? Is the server's command window still open? Does the firewall of the server computer let the others in? |
| `no classroom server at this address (a hosted copy)` | The page comes from a web site. Use the classroom server for a class |
| A display shows `server out of reach (trying again)` | The server has stopped or the network is down. Start the server again: the displays link up by themselves |
| The address no longer works after a restart | The server computer has been given a new network address. Open the new one the server prints |
| A display's batch list is empty | The display has not heard from the station yet: open the station, wait a few seconds. Has a batch been made? |
| A change made on a display has gone | The station's batches and settings replace a display's every few seconds. Make changes at the station |
| A trainee has forgotten the PIN | BATCHES, Trainee accounts, [[Reset PIN]] |
| A record has no radar pictures | The pictures stay in the browser of the display that recorded them ({ref:replay}) |
| An old record has no replay | The browser keeps 60 in full. With the server's store, bring it back from "On the server" |
| The station asks for the server key again, or says the key is wrong | Type the key from the server's start-up lines or from the file `data/station-key.txt` on the server computer |
| A finished exercise has not arrived on the RECORDS page | Was Finish pressed? Was the display linked at that moment? The record is also sent again when the trainees save their debrief notes |

# Abbreviations and terms {#terms}

<p class="lead">The abbreviations on the screen are the standard ones for navigation displays. Terms that the manual uses in a particular sense are here too.</p>

@cols 18 82
| | Meaning |
|---|---|
| AIS | Automatic identification system: ships transmit their identity, position, course and speed |
| ARPA | Automatic radar plotting aid |
| Aspect | The angle between a target's course and the line from the target to own ship, Red (her port side) or Green (her starboard side), 0° to 180° |
| BCR, BCT | Bow crossing range and bow crossing time: where and when a target will cross ahead of own ship |
| BRG | Bearing |
| COG, SOG | Course over the ground, speed over the ground |
| COLREG | The International Regulations for Preventing Collisions at Sea, 1972: "the collision regulations" |
| CPA, TCPA | Closest point of approach, and the time to it |
| CTW, STW | Course through the water, speed through the water |
| C UP, H UP, N UP | Course-up, head-up, north-up |
| EBL | Electronic bearing line |
| ENH | Echo stretch (enhancement) |
| EPFS | Electronic position-fixing system: a GNSS receiver such as GPS |
| GND, SEA | Ground stabilised, sea stabilised |
| GNSS | Global navigation satellite system |
| HDG | Heading |
| IR | Interference rejection |
| LP, MP, SP | Long, medium and short pulse |
| MMSI | Maritime mobile service identity: a ship's radio number |
| MOB | Man overboard |
| NM, kn | Nautical mile; knot |
| PAD | Predicted area of danger |
| PI | Parallel index line |
| PPC | Point of possible collision |
| PRF | Pulse repetition frequency: pulses a second |
| Racon | A radar beacon that answers a radar's pulse with a coded flash on the picture |
| Ramark | A radar beacon that transmits continuously and paints a line of bearing |
| REL, TRUE | Relative, true |
| RM, TM | Relative motion, true motion |
| RNG | Range |
| ROC | Radar observer course |
| ROT | Rate of turn |
| RUD | Rudder angle |
| SART | Search and rescue transponder |
| SC/SC | Scan-to-scan correlation: echo averaging |
| Set and drift | The direction a current runs towards, and its rate |
| STCW | The convention and code on standards of training, certification and watchkeeping for seafarers |
| TGT, TT | Target; tracked target |
| TSS | Traffic separation scheme |
| UTC | Coordinated universal time |
| VIS | Visibility |
| VRM | Variable range marker |
| WPT | Waypoint |
| XTD | Cross-track distance: how far the ship is off the leg she is sailing |

# Sources, standards named and data credits {#sources}

<p class="lead">These are the documents the project read to build and check the simulator. They are named here; none of their text is reproduced in this manual or in the program.</p>

!!! important "Naming a document is not a claim of compliance"
    That a standard or a syllabus is named below means that the project read it and compared the simulator with it. It does not mean that the simulator has been tested, approved or certified against it by anyone.

## Performance standards and regulations {#sources-standards}

- International Maritime Organization, resolution MSC.192(79): performance standards for radar equipment.
- International Maritime Organization, resolution A.823(19): performance standards for automatic radar plotting aids.
- International Maritime Organization, resolution MSC.302(87): performance standards for bridge alert management.
- International Maritime Organization, circular SN.1/Circ.243/Rev.2: navigation-related symbols, terms and abbreviations.
- International Electrotechnical Commission, IEC 62388:2013: shipborne radar, performance requirements and methods of testing.
- International Electrotechnical Commission, IEC 62288:2014: presentation of navigation-related information on shipborne navigational displays.
- The International Regulations for Preventing Collisions at Sea, 1972: rules 6, 8, 10, 13, 14, 15, 19, 34 and 35.
- The International Aeronautical and Maritime Search and Rescue Manual, volume III: search patterns.

## Training and assessment {#sources-training}

- The STCW Code, section A-I/12 (use of simulators) and table A-II/1.
- IMO Model Courses 1.07 and 1.08 (radar navigation at the operational level and at the management level).
- Directorate General of Shipping, India: Circular 5 of 2004.
- DNV standard DNV-ST-0033, maritime simulator systems: read to see what each class of simulator asks for.
- T. Karlsson, *The importance of structured briefings and debriefings for objective evaluation of ARPA simulator training*, Chalmers University of Technology, 2011.
- The plotting trainer the institute supplied as a reference for the form and marking of the manual plotting exercises.

## Textbooks {#sources-books}

- A. Bole and W. Dineley, *Radar and ARPA Manual* (1990), and the third edition by A. Bole, A. Wall and A. Norris (2014).
- *Radar Navigation and Maneuvering Board Manual*, Pub. 1310 (2001).

The worked examples of these books were used as tests of the simulator's calculations.

## Ship data {#sources-ships}

Three own-ship types are fitted to published turning figures: a benchmark container ship hull used in research on ship manoeuvring, a classification society's published sample VLCC, and the sea-trial turning circle of a training ship. The radar's beamwidths and pulse lengths are from one maker's published specification.

## Data credits {#sources-data}

The four real areas use open data, with these credits:

- **Coastlines:** © OpenStreetMap contributors, Open Database License (ODbL) 1.0, from a derived data set of the world's coastlines at 250 m.
- **Land heights:** Copernicus DEM GLO-90, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.

Neither is a chart. There are no depths, lights or buoys.

# For the developer {#developer}

<p class="lead">The simulator is a TypeScript project built into one HTML file. This chapter is the short map; the project's own notes are in the folder <code>docs</code>.</p>

## The folders {#developer-folders}

@cols 22 78
| Folder | What is in it |
|---|---|
| `src/core` | All the navigation mathematics: vectors, CPA, plotting, routes, search patterns, traffic separation schemes, the ship model. The screens and the server import from here and never work these out again |
| `src/engine` | The world: the ships, the radar signal, the picture, the scenarios, the real coasts and land heights, visibility |
| `src/roc` | The six ROC exercises and their reports |
| `src/arpa`, `src/ais` | The plot extractor, the tracker, the alerts, the trial manoeuvre; AIS |
| `src/train` | The 31 exercises, marking, records, the store, attention flags, assessment, accounts, history |
| `src/ui` | The radar screen and its panels, the ship control window, the instructor station, the link between displays |
| `server` | The classroom server |
| `tests`, `scripts` | The tests; the build, the screen test, the link test, and the scripts that make the coast and land data |
| `docs` | The project's notes: the comparison with the standards and the books, the syllabus table, the checks for an instructor; and this manual's source in `docs/manual-src` |
| `dist` | The built simulator: `radar-simulator.html` |

## The commands {#developer-commands}

```
npm install          once, to fetch the tools
npm test             the 844 tests of the calculations
npm run typecheck    the TypeScript check
npm run build        builds dist/radar-simulator.html
npm run test:screen  354 checks of the built page in a browser (needs Playwright)
npm run test:link    34 checks of a station and four displays through the server
npm run selftest     the three robots, from the command line
npm run serve        the classroom server
```

## The rules of the project {#developer-rules}

- TypeScript in strict mode. Run the tests and the type check before finishing any change.
- All navigation mathematics lives in `src/core`.
- Units: NM, knots and hours in the core; degrees true; an east and north frame with own ship at the origin.
- New mathematics needs tests whose expected values come from an independent calculation, not from the function being tested.
- Do not invent pass marks or accuracy limits: use the placeholder settings and flag them.
- Never present the simulator as certified or fit for navigation.
- Never put the classroom server's `data` folder in the repository.
- Do not copy the text of a standard or a book into the program or its notes.

## Rebuilding this manual {#developer-manual}

The manual's text is in `docs/manual-src` as Markdown files, with a style sheet and a build script. Its pictures are taken from the built simulator by the scripts in `docs/manual-src/shots`, cut to size by `assets.py`, and the PDF is made by `build.py`. The file `README.md` in that folder gives the steps. After a change to the simulator, take the pictures again, correct the text, and build.
