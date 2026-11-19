%% PART D | The instructor station | Preparing a class, running it, following what the trainees do, and afterwards the records, the assessment and the debrief.

# The station at a glance {#station}

<p class="lead">The instructor works at a station of his or her own. A trainee's display has no instructor pages at all: no fault keys, no PIN box, nothing to find.</p>

## Opening the station {#station-open}

@cols 34 66
| The simulator is opened | The station's address |
|---|---|
| From the file | The file's address with `#instructor` added: `radar-simulator.html#instructor` |
| From the classroom server | The address the server prints, followed by `/instructor` |
| From a copy on a web site | The site's address followed by `/instructor` or `#instructor` |

The station asks for the **instructor PIN** ({fig:st-login}). The first PIN is `0000`. Change it at once ({ref:instructor-pin}). The person icon at the top right logs out.

@fig st-login | 60 | The station asks for the instructor PIN.

!!! note "What the PIN is"
    The PIN keeps trainees out of the station in class. It is not real security: anyone with the file can read how it works. Do not use a PIN that matters elsewhere.

## The six pages {#station-pages}

The tabs along the top of the station:

@cols 18 82
| Tab | What is there |
|---|---|
| [[CLASSROOM]] | Every display that is reporting, with a small picture and its state, and the keys that act on it; the list of what needs attention; the class table; and what goes to all displays: pause and run, an exercise to start, faults, weather, targets, a linked exercise, a typed message |
| [[RECORDS]] | The record of every finished exercise, with its replay, its reports, the guided debrief, the evidence and the assessor's decision; the trainee files, the progress of a trainee, the comparison of assessors; keeping the records on the server and in a backup |
| [[EXERCISES]] | Examinations, scoring settings and time limits, exercise sheets, marking sheets, the self-test of the exercises |
| [[BATCHES]] | Batches, trainees and assigned exercises; the trainees' accounts; the progress of a batch; limits for the displays; the changeover time; the instructor PIN |
| [[SCENARIOS]] | The scenario editor |
| [[OWN RADAR]] | The station's own radar, worked like a trainee's, with two more menu keys: [[INSTR]] to change targets and [[FAULTS]] to set faults on it |

## What the station does by itself {#station-auto}

- **It finds the displays.** Tabs of the same browser on one computer are found at once; displays on other computers are found through the classroom server. The line under "Monitor other displays" says which: `Link: same computer only`, `Link: server`, or `no classroom server at this address (a hosted copy)`.
- **It sends the class to every display.** The batches, the assignments, the scoring settings and the limits go to every display every few seconds, so the displays' login lists and their marking follow the station's. Make changes at the station: a change made on a display is replaced by the station's.
- **It receives the records.** Each display sends its record when an exercise is finished, and again when the trainees save their debrief notes.
- **It is not a ship.** The station does not report as a display, and its own ship is never a target on a trainee's radar.

## How a display starts {#station-start-state}

A newly opened display starts in this state: radar on, X band, 6 NM range scale, north-up, relative motion, gain 50, sea and rain clutter 0, ARPA on with no targets acquired, the clock running at 1x, in the scenario "Open sea traffic". Loading a scenario or an exercise puts gain, clutter, brilliance, the EBLs, the VRMs and the parallel index lines back to this state.

# Preparing a class {#preparing-class}

<p class="lead">Before the trainees arrive: make the batch, decide whether they log in with PINs, assign the exercises, and set the limits. All of it is on the BATCHES page.</p>

## Batches, trainees and assignments {#batches}

@fig st-batches | 100 | The BATCHES page with a batch of four trainees, their accounts, and the progress of the batch.

1. Type a name under **New batch name** and press [[Add batch]].
2. Type the trainees' names under **Students**, one name per line. Use the names you want on the reports.
3. Under **Assigned exercises**, tick the exercises this batch is to do: ARPA 1 to 9 and 31, Radar 10, 11 and 22 to 30, Plotting 12 to 21, and the six ROC exercises. With any ticked, the trainees of this batch can start only those, and they are marked with a star in their lists. With none ticked, every exercise is open.
4. Press [[Save batch and limits]].

[[Delete batch]] removes the batch chosen. A trainee taken off the list loses his or her account with it. The records of exercises already done are not removed.

## Trainee accounts {#accounts}

Tick **Trainees log in with their own name and PIN** and press [[Save batch and limits]]. From then on:

- a display accepts only a name chosen from the batch, together with that trainee's own PIN. Names can no longer be typed;
- each trainee chooses the PIN at the first login: 4 to 8 digits, typed twice;
- **Trainee accounts of this batch** lists each trainee with `set` or `none yet: chosen at the first login`;
- [[Reset PIN]] beside a name takes a forgotten PIN away. The trainee chooses a new one at the next login;
- a trainee can see his or her own results from the station, on any display ({ref:my-results}). The station answers only for a trainee who logged in with the right PIN;
- "Free practice without names" stays open. It records no names.

Each batch keeps its own PINs.

!!! important "What a trainee's PIN does not protect against"
    A PIN keeps one trainee from logging in as another in a classroom, so that a record and a result belong to the person named. It is not real security. Only a digest of each PIN is kept, but a short PIN can be found from its digest by trying every value; the digests go to every display with the batches; and nothing on the classroom network is encrypted. Do not rely on it for more than classroom order, and tell the trainees not to use a PIN that matters elsewhere.

## Limits for the displays {#display-limits}

@cols 40 60
| Box | Effect |
|---|---|
| Students per display | How many names the login box of a display offers: 1 to 4. It starts at 2 |
| Hours per pair (blank = not set) | A target for the time each group of trainees should have at a display. The station lists the display time each group has had; the display shows it beside the names. Nothing is stopped when the target is reached |
| Change over at the controls every ... minutes | See {ref:changeover} |

These are the institute's limits to set. Nothing is enforced unless entered.

## Timed changeovers at the controls {#changeover}

When two or more trainees share a display, the record keeps who was "at the controls" ({ref:at-controls}). Left to themselves, one trainee may keep them.

Type a number of minutes under **Change over at the controls every** and press [[Save batch and limits]] (it saves with or without a batch chosen). A display with two or more trainees then gives the controls to the next one each time that many minutes of exercise time have passed, with a message on the screen, so that each gets a like share. A change made by hand in between is kept: the turn passes on from whoever has the controls. Blank: the trainees change by hand.

Think about where the changeover will fall. In a collision-avoidance exercise it can come at the worst moment.

## The instructor PIN {#instructor-pin}

Under **Instructor access**: type a new PIN of 4 to 8 digits and press [[Change PIN]]. [[Log out (student view)]] leaves the station.

## The progress of a batch {#batch-progress}

[[Progress of this batch]] shows a table: each trainee against the exercises assigned to the batch (or, with none assigned, those attempted), with the best score in each. A score is bold where the assessor found the trainee competent; a dash means not attempted. The last column counts how many are done ({fig:st-batches}).

# Running a class {#running-class}

<p class="lead">The CLASSROOM page is where a class is run: one card for each display, and beside the cards everything that can be sent to one display or to all.</p>

@fig st-classroom | 100 | The CLASSROOM page with two displays reporting. Left: what needs attention, the class table and a card for each display. Right: what is sent to the displays.

## The card of a display {#class-card}

Each display that is reporting has a card with a small picture of its radar, refreshed every two seconds, and its state: the names logged in and their batch, the exercise and its time, the heading and speed with what is ordered, how many targets are tracked, how many items are answered, and any alert. The keys on the card act on that display alone:

@cols 22 78
| Key | What it does |
|---|---|
| [[Pause]], [[Run]] | Stops and starts that display's exercise clock |
| [[Start exercise]] | Starts the exercise chosen under "Exercise" (in "Send to the displays") on that display. It loads paused, with a message to the trainees to read the briefing and press RUN |
| [[Send faults]], [[Clear faults]] | Sends the faults set under "Faults to send"; puts every instrument back to normal ({ref:faults}) |
| [[Watch]] | Opens that display's own radar picture and settings ({ref:watch}) |
| [[Observe]] | Opens the observation checklist for that display ({ref:obs-checklist}) |
| [[Back 2 min]], [[Back 5 min]] | Takes that display's exercise back in time ({ref:back-in-time}) |
| [[Reset]] | Starts that display's exercise again from the beginning. It asks first: what the trainees have done so far is not kept |

## To all displays {#class-all}

Under **Send to the displays**:

- [[Pause all]], [[Run all]], [[Take all back 2 min]], [[Reset all]].
- **Exercise**: choose one, then [[Start this exercise on all displays]]. The list has the 31 exercises and the six ROC exercises.
- **Message to all displays**: type it and press [[Send]]. It appears in the orange box under each display's header. The trainees answer with VHF/SIGNAL, typed.

A trainee can also start exercises at the display, pause and run it, and set the clock to 2x, 5x or 10x. If that is not wanted during an assessment, say so; the record shows the exercise time, and a display paused for three minutes is flagged.

## Going back in time {#back-in-time}

Every display keeps one state of its exercise a minute for the last 40 minutes. [[Back 2 min]] or [[Back 5 min]] on a card, or [[Take all back 2 min]], returns that display to the state of that moment: the ships, the weather and the faults are as they were, its ARPA starts empty, and the trainees are told on the screen. With less than that behind it, a display goes back to its earliest state.

Use it to let trainees meet the same situation again after a mistake, without starting the whole exercise over. It does not work in an ROC exercise, which can only be reset.

## Weather and visibility {#class-weather}

Under **Set this weather**: sea state, rain squall and its intensity, abnormal propagation, radar interference, and, when filled in, the wind (from, speed) and the current (set, drift). **Visibility**: `no change`, `good`, or 5, 2, 1, 0.5, 0.25 or 0.1 NM. **Send the weather to** chooses all displays or one of them. [[Set this weather]] acts at once, during an exercise too.

What a visibility does on a display is in {ref:visibility}: the bridge reports the change, a look-out reports each vessel as she comes into sight, and rule 19(d) is applied in the marking to a vessel that was not in sight when the avoiding action was taken. Every report is written in the record.

## A linked exercise {#linked-exercise}

In a linked exercise every display is a ship in the same water, and each sees the others on its radar.

1. Load a scenario on the station's OWN RADAR ([[MENU]], [[SCENARIO]]).
2. On the CLASSROOM page press [[Start a LINKED exercise on all displays with the scenario loaded here]].

Every display loads the scenario at the same moment. Each own ship starts at a different position 5 NM from the scenario's start, and every own ship is a target with AIS on the others' radar. A linked exercise runs at 1x. Nothing is marked: it is for working together in the same water, with the instructor watching.

# Following the trainees {#following}

<p class="lead">One instructor cannot watch four displays at once. So each display watches itself and tells the station what to look at; the station ranks it, and keeps it for afterwards.</p>

## Needs attention {#flags}

**Needs attention**, at the top of the CLASSROOM page, is one list for all displays: the most urgent first, and among equals the one that has waited longest. [[Watch]] beside a line opens that display.

@cols 12 88
| Level | Raised when |
|---|---|
| **NOW** | A vessel is about to pass inside the safe distance within 6 minutes (the line says whether action has been taken); a vessel is already inside it; land is within 0.3 NM while under way |
| **SOON** | A vessel will pass too close within 12 minutes and is not tracked; the ship is more than 0.3 NM off her route; she is in a separation zone or going against the flow of a lane; an alert has been left unacknowledged for a minute; a turn to port in a plotting exercise; the radar is not transmitting while under way; the time allowed is up |
| **NOTE** | Two minutes of the time allowed are left; the gain is very low (15 or less) or a clutter control very high (85 or more); no control has been touched for three minutes; the display has been paused for three minutes; no fog signal is being sounded under way in restricted visibility |

Every flag of the NOW and SOON kinds is also written into the display's record as a **bookmark**, so that what was missed live can be found afterwards in the replay.

!!! important "The flags are for the instructor only"
    The flags use the real positions of the ships, which the trainee does not have. They are a help to the instructor and take no part in the marking. Their limits are placeholders; they can be wrong about what matters in a given exercise; and they do not see what the trainees say to each other.

## The class table {#class-table}

Under the list, one row for each display: the trainee at the controls, the exercise and its time, the items done, the points so far (the final percentage when finished), the vessel that has come closest and how close, when own ship first altered course or speed, and the number of flags.

## Watching one display {#watch}

[[Watch]] on a card, or beside a line of the list, opens that display's own radar picture, sent every two seconds, with the settings in use (range scale, band, pulse, gain and clutter, presentation, ARPA and AIS) and that display's flags ({fig:st-watch}). [[Stop watching]] ends it; it also ends by itself if the station is closed.

The picture is a copy 480 pixels square: enough to follow, not to measure.

@fig st-watch | 62 | Watching a display: the trainees' own radar picture, their flags and their settings.

## The observation checklist {#obs-checklist}

[[Observe]] on a card opens the checklist for what the simulator cannot judge ({fig:st-observe}).

- Tick [[Yes]] or [[No]] beside an item as you see it. Pressing a tick again takes it off.
- **About** chooses whether the tick is about the whole group or about one trainee.
- Type free text under **Notes** and press [[Save notes]].
- The ticks and notes go into the record of the exercise that display is working, with the time, and are printed in its report.

Under each item is its **standard**: what Yes looks like and what No looks like, so that every instructor ticks against the same words. For eight of the twelve items there is also what that display has **measured** so far. "Show the standard of each item" hides the standards to save room.

@fig st-observe | 84 | The observation checklist for a display, with the standard for Yes and No under each item and, where the simulator has it, what has been measured.

@cols 34 40 26
| The twelve items | The measured facts shown beside it | |
|---|---|---|
| Radar set up before use: range scale, gain, clutter and tuning checked | The range scale, gain, sea, rain and tuning now, with the best tuning | |
| Range scale changed to suit the situation, with a look at long range at intervals | The range scales used and how many changes | |
| Targets plotted or acquired in good time | For each vessel that mattered: tracked from when, at what range | |
| ARPA data checked against the radar picture before it was used | None | Observed only |
| Risk of collision judged from the information available | The most dangerous vessel now, and how close she will pass | |
| Action taken early, large enough to be seen, and in line with the collision regulations | The first action: when, who took it, what, and the risk at that moment | |
| Effect of the action checked until the other vessel was past and clear | The closest approach so far | |
| Position monitored by radar | The distance off the track and off the land | |
| Alerts understood and dealt with, not only acknowledged | How many alerts, how many not acknowledged, the longest left | |
| Reports to the master or the bridge team clear and in time | None | Observed only |
| Worked as a team: tasks shared and cross-checked | None | Observed only |
| Limits of the radar and the ARPA kept in mind: delays, errors, lost targets | None | Observed only |

**Changing the list.** "Checklist items" at the foot of the panel holds the list, one item a line. A standard may follow the item, written as `item :: what Yes looks like :: what No looks like`. Put in the objectives you gave at the briefing. An item with the title of one of the twelve and no standard of its own keeps the proposed standard.

!!! placeholder "A proposal, not a syllabus"
    The twelve items and their standards were written for this project. They do not come from a syllabus and have not been reviewed by a radar instructor. The measured facts come only in the 31 marked exercises, not in the ROC exercises or in free practice.

## Who did what in a group {#who-did-what}

The record keeps who had the controls and for how long, and every answer, every action and the first alteration of course or speed carries the name of the trainee who had the controls then. The assessor can give a decision for each trainee as well as for the group ({ref:each-trainee}).

The simulator records who was *named* at the controls, not whose hand was on the mouse. Watch for it, and use the checklist's "About" to note what you see of each trainee.

# Faults {#faults}

<p class="lead">A radar observer must notice when an instrument is wrong. The instructor can make any of them wrong, on one display or on all, without the trainees being told.</p>

## Sending faults {#faults-send}

On the CLASSROOM page, under **Faults to send**: set the faults, then press [[Send faults]] on one display's card, or [[Send these faults to all displays]]. [[Clear faults]] on a card, or [[Clear the faults on all displays]], puts every instrument back to normal.

On the station's own radar the same faults are under [[MENU]], [[FAULTS]] ({fig:st-ownradar-faults}).

## Errors: the instrument reads wrong {#faults-errors}

An error gives no alarm. A positive value means the instrument reads high. The ship's real movement does not change.

@cols 30 70
| Fault | What the trainee sees |
|---|---|
| Gyro error (degrees) | The heading, the bearings, the picture and the ARPA all use the wrong heading. Nothing says so. The ARPA's true courses are wrong; CPA and TCPA stay right |
| Log error (knots) | The speed and the sea-stabilised vectors are wrong |
| Heading marker error (degrees) | The heading line is painted off the ship's head |
| VRM error (per cent) | The variable range marker reads wrong. It no longer agrees with the range rings |
| Radar performance (per cent of echo power) | Weak echoes are lost, and the performance monitor shows it. 50% is a loss of 3 dB (detection ranges about 84% of normal); 10% is a loss of 10 dB (about 56%) |

An error comes on gradually: the gyro at 1° a minute, the log at 1 knot a minute. While it is changing the ARPA's vectors are disturbed, so allow one tracking window of three minutes after it stops before judging the effect.

## Failures: the instrument stops {#faults-failures}

@cols 30 70
| Fault | What the trainee sees |
|---|---|
| Speed log failed | The ARPA warns `SPEED LOG INPUT ABSENT` |
| Gyro compass failed | The ARPA gives an equipment malfunction warning and loses all tracks; the picture goes to unstabilised head-up with relative motion; bearings are relative only |
| EPFS (GNSS) failed | No position anywhere: `NO FIX`, no latitude and longitude at the cursor, COG and SOG blank, own ship's AIS sends no position, and the ARPA warns `EPFS INPUT ABSENT`. The trainee must fix by radar |
| Radar video signal lost | The warning `RADAR SIGNAL LOST: VIDEO`. The echoes fade and the picture reads `NO RADAR PICTURE`; trails stop; after six turns of the aerial every tracked target is lost. The AIS targets stay, with their data and their alarm. Clear the fault and the picture comes back; the targets must be acquired again |
| Radar sync (trigger) lost, Azimuth signal lost, Heading marker signal lost | The same effect, and the warning names the signal. With the heading marker lost the heading line is not painted either. Several can be set together: the warning names them all |
| Picture frozen | The echoes stop being updated and stay where they were, under the words `PICTURE FREEZE`, with a warning. The ARPA and the AIS go on working, so the symbols move away from the frozen echoes: that is what the trainee should notice |
| Anchor dragging | Only while own ship is at anchor: she drags at 0.5 knots with the current. An anchor watch set on a fixed echo gives its warning once she has moved the set distance |
| AIS shore station repeating | A shore station repeats every AIS report it hears, own ship's too, 30 seconds late and every 10 seconds. The display must not use them while it hears the ships directly, so the trainee sees no change. On the station's own radar a line under the faults counts the repeated reports received, used and not used |

On a real set the loss of the heading marker or of the azimuth signal may look different from the loss of the video: here the four signal faults have the same effect.

## Show truth {#show-truth}

On the station's own radar, [[MENU]], [[FAULTS]], **Show truth** lists, for each tracked target there, the real target behind the track and its real CPA, TCPA, course and speed, and counts target swaps. Use it to prepare an exercise and to check what a fault does before sending it to a class.

@fig st-ownradar-faults | 100 | The FAULTS page of the station's own radar, with a gyro error of 3° set.

# Targets, tracks and traffic {#targets}

<p class="lead">The other ships can be altered, removed and added while an exercise runs, given a track to steer by themselves, or made at random. On a trainee's display it is done by typing; on the station's own radar by clicking on the picture.</p>

## On a trainee's display, while the exercise runs {#targets-display}

On the CLASSROOM page, under **Targets on a display, while the exercise runs** ({fig:st-classroom-targets}). The trainees are not told. Each act is written into the display's record.

@fig st-classroom-targets | 52 | Targets on a display and random traffic, on the CLASSROOM page.

1. Choose the **Display** (or all displays) and one of its **Targets**. The list of targets comes from the display's last report, every two seconds.
2. To alter her: type a new course, a new speed, or both, and press [[Alter this target now]]. Blank means no change.
3. To take her away: [[Remove this target]].
4. To give her a track: type its points under "Track for this target" as true bearing / range in NM **from that own ship**, in the order she is to pass them, for example `045/6, 090/8` (at most 20 points), and press [[Set this track]]. She steers from point to point and carries on as she goes after the last. The points are fixed on the water at the moment the track is sent. [[Take off this track]] leaves her on the course and speed she has.
5. To add a new vessel, for a sudden threat: type a name, choose a type from the catalogue, give the true bearing and range from that own ship, her course and speed, and press [[Add this target now]].

A ship of a catalogue type comes round and changes speed gradually, as a real one does. A plain target changes at once.

## Random traffic {#random-traffic}

Below it, **Random traffic** makes a number of ships round an own ship:

@cols 40 60
| Box | Meaning |
|---|---|
| Ships | How many |
| Of them, on close-quarters courses | How many will pass within 0.5 NM of that own ship in 15 to 35 minutes if nobody acts |
| From (NM) to (NM) off own ship | The ring they start in |
| Seed | The same seed gives the same ships, so an exercise can be repeated, and every display given the same traffic round its own ship. [[New seed]] draws another |
| In place of the ships there now | Ticked: the ships there are replaced (buoys and beacons stay). Unticked: the new ships are added |

[[Random traffic on the display chosen above]] sends it to that display; [[On the station's own radar]] makes it there.

Random traffic is placed round own ship without regard to land. On a coast, look at it before using it.

## On the station's own radar {#own-radar}

The OWN RADAR page is a radar like a trainee's. Use it to try a scenario, to prepare a linked exercise, and to see what a fault does. [[MENU]], [[INSTR]] opens **Inject events (this display)** ({fig:st-ownradar-instr}). Every injection is written to the exercise record.

@fig st-ownradar-instr | 100 | The INSTR page of the station's own radar. A track of four points has been programmed for one target and is shown in blue.

**Alter a target.** Choose it under Target, type a new course, a new speed or both, and press [[Alter target now]]. [[Remove target]] takes it away; [[Switch its AIS on/off]] does that.

**Programme a track by clicking.**

1. Choose the target. Buoys and beacons cannot be given a track.
2. Press [[Programme a track]].
3. Click up to 20 points on the radar picture, in the order the target is to pass them. They are drawn and numbered. [[Undo point]] removes the last one.
4. Optional: type a "Speed on the track". Left blank, the target keeps her speed.
5. Press [[Set track]].

The target steers for each point in turn. A ship of a catalogue type turns on her turning circle and puts the wheel over early, so a large ship on a tight track cuts the corners. After the last point she carries on as she goes. A target on a track allows for current and leeway and stays on the line. [[Take off track]], or altering her course by hand, ends the track.

Tick **Show target tracks on this display** to see every programmed track in blue. Tracks are drawn only on the station's own radar, never on a trainee's display.

**Add a target.** Give a name, a type (28 vessel types, buoy or beacon), an echo strength (typical for the type, or one of the standard reference targets), the true bearing and range from own ship, the course and speed, then [[Add target now]].

**Take the exercise back.** [[Take exercise back 2 min]], [[Back 5 min]], [[Back 10 min]] act on the station's own radar.

Each of up to 100 targets can have a track of its own. The ARPA tracks 40 at a time.

## The catalogue of target types {#target-catalogue}

@cols 50 50
| Larger ships | Smaller ships and craft |
|---|---|
| VLCC tanker, loaded, 330 m | General cargo ship, 120 m |
| Aframax tanker, 250 m | Coaster, 90 m |
| Product tanker, 180 m | Passenger ferry, 150 m |
| Chemical tanker, 130 m | High-speed craft, 90 m |
| LNG carrier, 290 m | Naval frigate, 130 m |
| LPG carrier, 180 m | Offshore supply vessel, 80 m |
| Container ship, ultra large, 400 m | Dredger, 100 m |
| Container ship, post-Panamax, 300 m | Tug, 30 m |
| Container feeder, 140 m | Tug with tow, 200 m overall |
| Capesize bulk carrier, 290 m | Fishing trawler, 35 m |
| Panamax bulk carrier, 225 m | Small fishing boat, 12 m |
| Handysize bulk carrier, 170 m | Pilot boat, 15 m |
| Ro-ro cargo ship, 180 m | Sailing yacht with radar reflector, 12 m |
| Car carrier, 200 m | Navigation buoy with corner reflector |
| Cruise ship, 300 m | Beacon or light structure |

Each type has a size, the height of the part that reflects radar, the range at which the X-band radar first detects it in clear conditions, a usual speed, and how fast it turns and changes speed. A vessel of a catalogue type steers a course through the water, is set by the current and blown by the wind.

!!! placeholder "Placeholder"
    Every figure of the catalogue is a typical value for the type, not the data of a particular ship.
