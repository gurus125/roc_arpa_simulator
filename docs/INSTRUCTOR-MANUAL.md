# ROC / ARPA radar simulator: operation manual for the instructor and assessor

Training and study use only. Not for navigation. This simulator holds no approval or certificate.
The learner's manual is `USER-MANUAL.md`; read that first for the radar and ARPA controls. This
manual covers what only the instructor does.

## 1. Starting: the student displays and the instructor station

The instructor works at an **instructor station** of his or her own. The trainees' displays have no
instructor pages at all: no INSTR or FAULTS key and no PIN box.

1. **Student displays.** Open `radar-simulator.html` in Chrome or Edge on each display. At the first
   screen the trainees choose their batch and names, or "Free practice without names".
2. **Instructor station.** On the instructor's PC open the same file with `#instructor` after it:
   `radar-simulator.html#instructor` (with the classroom server, the address it prints followed by
   `/instructor`). It asks for the instructor PIN. The first PIN is 0000: change it under BATCHES,
   "Instructor access" ("New PIN", 4 to 8 digits). The PIN only keeps trainees out of the station in
   class; it is not real security. The person icon at the top right logs out.
   On a copy of the simulator hosted on a web site (for example on Vercel), the station is the site's
   address followed by `#instructor` (or `/instructor`); see section 7 for what a hosted copy cannot do.
3. The station's tabs:

| Tab | What is there |
|-----|---------------|
| CLASSROOM | Every display that is reporting, with a small picture and its state, and for each: Pause, Run, Start exercise, Send faults, Clear faults. Beside it, what goes to all displays: pause and run, an exercise to start, the faults to send, the weather, a linked exercise, a typed message |
| RECORDS | The records of every display's finished exercises (each display sends its record to the station when an exercise is finished, and again when the trainees save their debrief notes), with the replay, the reports and the assessor's decision |
| EXERCISES | Scoring settings, marking sheets, the self-test of the exercises |
| BATCHES | Batches, students and assigned exercises; display limits; the instructor PIN |
| SCENARIOS | The scenario editor |
| OWN RADAR | The station's own radar, as a trainee's: to try a scenario, programme target tracks (MENU, INSTR), set faults on it (MENU, FAULTS) and start a linked exercise with it |

4. The station sends its batches, assignments and scoring settings to every display every few
   seconds, so the displays' login lists and their marking follow the station's. Keep them on the
   station: changes made on a display are replaced by the station's.
5. The station and the displays find each other by themselves: through the browser on one PC, or
   through the classroom server for several PCs (section 7). The station is not a ship: it does not
   report as a display and its own ship is never a target on a trainee's radar.

A newly opened simulator starts in this state: radar ON, X band, 6 NM range, north-up, relative
motion, gain 50, sea and rain clutter 0, ARPA on with no targets acquired, simulation running at
1x. Loading a scenario puts gain, clutter, brilliance, EBL, VRM and parallel index lines back to
this state. Day or night colours stay as last chosen.

## 2. Running an exercise

| To do this | Use |
|------------|-----|
| Choose what the trainees work on | On the station, CLASSROOM: choose the exercise and press "Start exercise" on a display's card, or "Start this exercise on all displays". On a display: SCENARIO key (free practice), ROC EX key (radar observer exercises), ARPA EX key (ARPA and manual plotting exercises), or the ship control window |
| Keep AIS out of a plotting exercise | Nothing to do: the manual plotting exercises switch the AIS display off and lock it (the AIS key reads AIS OFF and is greyed out; the VRM / ARPA panel says AIS OFF FOR THIS EXERCISE) until the trainee presses Finish, because their ships transmit AIS. In ROC exercises both ARPA and AIS are off. Elsewhere AIS is shown on every range scale, with the ARPA on or in standby |
| Halt and continue | Station, CLASSROOM: Pause and Run on a display's card, or Pause all and Run all. On a display: PAUSE / RUN in the header |
| Run faster | On a display: the speed box beside PAUSE: 1x, 2x, 5x, 10x |
| Start again from the beginning | "Restart" in the SCENARIO key, or open the exercise again |
| Go back in time | Station, OWN RADAR, MENU, INSTR: "Take exercise back 2 min", "Back 5 min", "Back 10 min" (on the station's own radar). The ships, weather and faults return to that moment. The simulator keeps one state a minute for the last 40 minutes. Taking a trainee's display back from the station is not offered yet |

Batches and assignments (station, BATCHES, "Batches, students and assignments"): add a batch, type the
trainees' names one per line, tick the exercises assigned to the batch, and save. "Students per
display" and "Hours per pair" are the academy's limits to set; nothing is enforced unless entered.

## 3. Changing the environment during an exercise

WEATHER in the menu (on a display, or on the station's OWN RADAR): sea state, rain squall and its intensity, abnormal propagation (ducting, which brings
second-trace echoes), refraction (standard, sub-refraction with detection ranges of about 80%, or
super-refraction with about 140%), interference from another radar, wind direction and speed, current set and
drift, and a tidal stream (maximum rate, direction of the flood, hours after slack at the start).
Changes act at once.

The rain intensity is a share of IMO's "heavy rain", 16 mm an hour: 25 is its "light rain" (4 mm an hour),
100 is heavy rain. Rain clutter fades with range, and the rain weakens every echo whose path crosses it,
far more on X band than on S band, so a target beyond a squall is detected later. A small target in rain
or sea clutter that is weaker than the clutter around it is not shown at any setting of the controls: the
trainee must use S band, a shorter pulse, or wait until it is closer or clear of the clutter (Radar and
ARPA Manual, 3rd edition, 3.6.2 and 3.7). The figures for the loss in rain are placeholders: see
`BOOK-CHECK-RADAR-ARPA-MANUAL.md`.

To set the weather on the displays, use the station's CLASSROOM, "Set this weather": sea state, rain
squall and its intensity, abnormal propagation, interference and, when filled in, the wind and the
current. "Send the weather to" chooses all displays or one of them. It acts at once, during an
exercise too.

## 4. Targets

All of this is on the station, OWN RADAR, MENU, INSTR, "Inject events (this display)": it acts on the
station's own radar (for example to prepare a linked exercise). Every injection is written to the
exercise record.

**On a trainee's display, while the exercise runs** (station, CLASSROOM, "Targets on a display, while
the exercise runs"): choose the display (or all displays) and one of its targets, type a new course
and/or speed and press "Alter this target now"; "Remove this target" takes it away; "Add this
target now" puts a new vessel of any catalogue type at a true bearing and range from that own
ship, for a sudden threat. The trainees are not told; each act is written to the display's record.
The target list comes from the display's last report (every two seconds).

**Random traffic** (below it): the number of ships, how many of them are on close-quarters courses
(they pass within 0.5 NM of that own ship in 15 to 35 minutes if nobody acts), the ring they start
in, and a seed. The same seed gives the same ships, so an exercise can be repeated and every display
given the same traffic round its own ship; "New seed" draws another. It can replace the ships there
(buoys and beacons stay) or be added to them, on the chosen display or on the station's own radar.

Alter a target: choose it in "Target", type a new course and/or speed, press "Alter target now".
A ship of a catalogue type comes round and changes speed gradually; a plain target changes at once.

Remove a target, or switch its AIS on or off: the two keys beside it.

Add a target: give a name, a type (28 vessel types, buoy, beacon), an echo strength (typical for
the type, or one of the IMO table 2 reference targets), true bearing and range from own ship,
course and speed, then "Add target now".

Programme a track for a target (it then steers from point to point by itself):

1. Choose the target. Buoys and beacons cannot be given a track.
2. Press "Programme a track".
3. Click up to 20 points on the radar picture, in the order the target is to pass them. They are
   drawn in orange and numbered. "Undo point" removes the last one.
4. Optional: type a "Speed on the track". Left blank, the target keeps its speed.
5. Press "Set track".

The target steers for each point in turn. A ship of a catalogue type turns on its turning circle
and puts the wheel over early, so a large ship on a tight track cuts the corners. After the last
point it carries on as it goes. "Take off track", or altering its course by hand, ends the track.

Tick "Show target tracks on this display" to see every programmed track in blue. Tracks are drawn
only on the station's own radar, never on a trainee's display.

Each of up to 100 targets can have its own track. The scenario "Traffic: 100 ships on programmed
tracks" shows 100 ships running together. The ARPA tracks 40 targets at a time.

## 5. Faults

On the station, CLASSROOM, "Faults to send": set the faults, then "Send faults" on one display's card,
or "Send these faults to all displays"; "Clear faults" puts them all back to normal. The trainees
are not told. (On the station's own radar the same faults are under MENU, FAULTS.)

| Fault | What the trainee sees |
|-------|-----------------------|
| Gyro error (degrees) | Heading, bearings, picture and ARPA all use the wrong heading. Nothing says so |
| Log error (knots) | Speed and sea-stabilised vectors are wrong |
| Heading marker error (degrees) | The heading line is painted off the ship's head |
| VRM error (per cent) | The variable range marker reads wrong |
| Radar performance (per cent of echo power) | Weak echoes are lost; the performance monitor shows it. 50% is a loss of 3 dB (detection ranges about 84% of normal), 10% a loss of 10 dB (about 56%) |
| Speed log FAILED | The ARPA shows SPEED LOG INPUT ABSENT |
| Gyro compass FAILED | The ARPA gives an equipment malfunction warning and loses all tracks; the picture goes to unstabilised head-up with relative motion, and bearings are relative only |
| EPFS (GNSS) FAILED | No position anywhere: NO FIX in the position, no latitude and longitude at the cursor, COG and SOG blank, own ship's AIS sends no position, and the ARPA warns EPFS INPUT ABSENT. The trainee must fix by radar (exercise 23 starts this way) |
| Radar VIDEO signal LOST | The warning RADAR SIGNAL LOST: VIDEO. The echoes fade and the picture reads NO RADAR PICTURE; trails stop; after six turns of the aerial without an echo every tracked target is lost (lost target warnings). The AIS targets stay, with their data and their CPA and TCPA alarm (IMO MSC.192(79) 9.5). Clear the fault and the picture comes back; the targets must be acquired again |
| Radar SYNC (trigger) signal LOST, AZIMUTH signal LOST, HEADING MARKER signal LOST | The same effect, and the warning names the signal (IMO MSC.192(79) 5.34.2 asks for an alarm on each). With the heading marker lost the heading line is not painted either. Several can be set together: the warning names them all |
| Picture FROZEN | The echoes stop being updated and stay where they were on the screen, under the words PICTURE FREEZE, with a warning (IMO MSC.192(79) 5.34.1). The ARPA and the AIS go on working, so the symbols move away from the frozen echoes: that is what the trainee should notice |
| Own ship's anchor DRAGGING | Only while own ship is at anchor: she drags at 0.5 kn with the current. An anchor watch set on a fixed echo gives its alarm once she has moved the set distance (exercise 24 does this by itself ten minutes after anchoring) |
| AIS shore station REPEATING | A shore station repeats every AIS report it hears, own ship's too, 30 s late and every 10 s. The display must not use them while it hears the ships directly (IEC 62388 11.5.3.1), so the trainee sees no change. The line under the faults counts the repeated reports received, not used and used |

Positive values mean the instrument reads high. The ship's real motion does not change. An error
comes on gradually; while it is changing the ARPA vectors are disturbed, so allow one tracking
window (3 minutes) after it stops before judging the effect.

"Show truth" (station, OWN RADAR, MENU, FAULTS) lists, for each tracked target on the station's own
radar, the real target behind the track and its real CPA, TCPA, course and speed, and counts target
swaps.

## 6. Following the trainees

The station's CLASSROOM shows a small picture and the state of every display (exercise, time,
heading and speed, tracks, answers, alarms), with Pause, Run, Start exercise, Send faults and Clear
faults for each, and Pause and Run for all. "Message to all displays" sends a typed message. Trainees answer with the
VHF/SIGNAL key (typed messages; there is no voice channel in this simulator).

## 7. Several displays working together

Other browser tabs on the same computer link by themselves. For several computers:

1. On one PC, in the simulator's folder, run `npm run serve`.
2. Open the address it prints in the browser of every display.
3. Open the instructor station at the address followed by `/instructor`.
4. Load a scenario on the station's OWN RADAR, then in CLASSROOM press "Start a LINKED exercise on all
   displays with the scenario loaded here". Every display loads the scenario at the same moment, each own
   ship starts at a different position 5 NM from the scenario start, and every own ship is a target
   on the others' radar. A linked exercise runs at 1x.

**A copy hosted on a web site (for example on Vercel)** serves the page only: it has no classroom
server. The station and the displays then find each other only when they are open in tabs of the same
browser on the same computer (good for showing the simulator). Displays on other PCs do not appear in
CLASSROOM, their records do not reach RECORDS, and the station's batches do not reach them; the
station's CLASSROOM says "no classroom server at this address (a hosted copy)". For a class on several PCs run the
classroom server as above.

This has been proved with five separate browsers going through the server on one machine
(`npm run test:link`): monitoring, a linked exercise, pause and run, messages, an exercise started from
the station, a finished exercise's record reaching the station, a target added and altered and random
traffic sent from the station, and finding the
server again after it has been stopped and started. It has not been tried on separate PCs over a
classroom network: do that before a class. If the server stops, each display shows "server out of
reach (trying again)" and links up again by itself when the server is back.

## 8. Records, replay and assessment

Station, RECORDS, "Records, replay and reports" lists every finished exercise (from every display that
reached the station, and the station's own) with the trainees, the
exercise and the score. "Open" shows:

- the replay: own ship's track in green and the targets' in yellow, with the events and alarms up
  to the time shown. "Play" runs it; the slider moves to any moment. "Replay speed" goes from 0.25x
  (slow motion) through 1x (real time) to 60x. Positions are recorded every 10 seconds and the
  replay moves the ships smoothly between them. Below the track plot is the radar
  picture as the trainee saw it, one picture every 15 seconds, in step with the slider. Pictures
  are kept in the browser of the display that recorded them: a record sent by a display on another
  PC, or brought from another computer, has none;
- the result, item by item, and the trainees' own debrief notes and radio log;
- the assessor's decision: "Competent" or "Not yet competent", the assessor's name and remarks. The
  score is a guide only; the assessor's decision is the prime criterion (STCW Code A-I/12,
  paragraph 8);
- "Result (CSV)", "Report (print or save as PDF)" and "Record (JSON)". "Export all (CSV)" saves the
  whole list. Records are kept in the station's browser (and each display keeps its own): export
  them to keep them.

## 9. Scoring settings and marking sheets

Station, EXERCISES, "Scoring settings (placeholders)". None of the values comes from an approved marking
scheme. Enter the academy's own tolerances and pass mark, or leave the pass mark blank to report
scores without pass or fail. "Radar bearing / course to steer tolerance" applies to the radar
exercises' bearings and courses to steer (exercises 10, 11, 23 and 24).

Station, EXERCISES, "Marking sheets": choose one exercise or all of them and print (or save as PDF). Each is
one A4 page: the items the simulator checks, how it judges each, and the value it uses now (the
settings above), with empty boxes for the institute's own tolerance or limit and points; the
items the assessor judges that the simulator does not (timing of the action, resuming course,
communication, use of the controls); the pass mark; the assessor's decision, name, signature and
date; and a line for whoever approves the marking scheme. The syllabus references on each sheet
come from the draft table in `docs/SYLLABUS-MATRIX.md`, which no instructor has reviewed yet. When
the institute has filled the sheets in, enter its tolerances and pass mark here; tolerances that
are fixed in an exercise (for example the 0.25 NM track limit of exercises 10 and 24) are listed on
the sheets and can be changed in the program only. The "Set-up" fields are the limits of radar exercise 22 (switching on
and setting up): the lightest and heaviest noise speckle that count as a light speckle, how far
from the best the tuning may be, the least brilliance, and the sea and rain settings that count as
zero.

## 9a. The exercises in the real areas (23 to 26)

| No. | Exercise | What is set up | What is marked |
|-----|----------|----------------|----------------|
| 23 | Mumbai: radar fix with the GNSS failed | Own ship about 6 NM off the coast, 060° at 8 kn, GNSS failed from the start | Range and bearing of Malabar Point (18°56.9'N 072°47.5'E, from the coastline data), own ship's latitude and longitude, two questions, and at least 1 NM off the land all the time |
| 24 | Goa: parallel index approach, anchoring and anchor watch | Track 090° to an anchor position at 15°24.0'N 073°42.0'E, current 160° 0.5 kn, a buoy laid for the exercise | Index line set, course to steer, the VRM range of Mormugao Point from the anchor position, track kept within 0.25 NM, anchored within 0.3 NM, anchor watch set on the buoy, and its alarm acknowledged when the anchor drags (ten minutes after it is let go) |
| 25 | Kochi: collision avoidance in restricted visibility | A container ship nearly ahead, an LNG carrier on the starboard bow, fishing boats (one in a rain squall), a tanker at anchor | Ships tracked, CPA and TCPA, two questions, the action (Rule 8 size and Rule 19(d)), every vessel passed at 1 NM or more |
| 26 | Gulf of Kutch: tidal stream and a meeting ship | Flood stream 075° growing from 1.2 kn, a tanker at anchor, a container ship meeting nearly end on (CPA 0.4 NM) | Ships tracked, the tanker made the ground reference, set and rate of the stream, the container ship's CPA and TCPA, two questions, the action, every vessel passed at 1 NM or more |

The ships, current and stream are invented, the buoy in exercise 24 is laid for the exercise, and
the reference points' positions come from the coastline data (about 250 m accuracy), not a chart.
Every limit is a placeholder.

## 9b. Exercises 27 to 31 (added 18 Nov 2026)

| No. | Exercise | What happens | What is marked |
|-----|----------|--------------|----------------|
| 27 | Monitoring a planned route on the radar | A route of three legs (040°, 090°, 030°) past two buoys, with a current of 1.5 kn setting across it | Course to steer, two questions, never more than 0.25 NM off the route, the last waypoint passed |
| 28 | Traffic separation scheme with dense traffic | Own ship northbound in her lane; a ferry crossing from starboard on a collision course, a slower ship ahead, a faster one astern, southbound traffic, a fishing boat in the separation zone | Ferry and slow ship tracked, the ferry's CPA, three questions on rule 10, in the lane with the flow (at most 30 s in the zone or against the flow), every vessel passed at 0.5 NM or more |
| 29 | Man overboard | Two minutes after the start the look-out reports a man overboard (a message on the display); the person gives no radar echo | MOB key within 30 s, three questions, the reciprocal course, back to within 0.1 NM of the person at 5 kn or less, a search pattern laid on the radar |
| 30 | Safe speed in restricted visibility | 16 kn towards a rain area with three fishing boats in it; three minutes after the start the visibility closes (a message) | Three questions on rules 6 and 19, speed over the ground down to 8 kn within 8 minutes, every vessel passed at 0.5 NM or more |
| 31 | Timed test: acquire, assess and report | Six ships; 8 minutes of exercise time | All six tracked, the one with the smallest CPA, CPA and TCPA of ship A, bearing and range of ship F, finished within the time |

Every figure in the last column is a placeholder (`NAV_LIMITS` in `src/train/nav-exercises.ts`): none
comes from a rule or a syllabus. In exercise 30 the "safe speed" of 8 kn is only a figure to mark
against; on board it is the master's judgement. The questions are on rules 6, 10, 15 and 19 of the
collision regulations and on the search patterns of the IAMSAR Manual, volume III: check them.

## 9c. Time limits and examinations

**Time limit** (station, EXERCISES, Scoring settings, "Time limit for the exercise"): choose an
exercise, type the minutes allowed, press "Set this time limit". The exercise then has one more
marked item, "Finished within the time allowed", worth a safety outcome's points, and the trainee
sees the time left. Blank takes the limit away (exercise 31 then keeps its own 8 minutes). The
limit is exercise time and does not run while the exercise is paused. It is not offered for the
six ROC exercises.

**Examinations** (station, EXERCISES, Examinations): the ROC practical examination and the ARPA
practical examination are each a list of exercises worked one after the other. Choose the parts
(hold Ctrl or Cmd and click), "Save the parts", choose the display and press "Start the ROC
examination" or "Start the ARPA examination". The display starts part 1; when the trainee presses
Finish it offers the next part. Each part is recorded and marked as usual and tagged as part of
that sitting. "Examination results" prints one page for each examination taken: the parts with
their points, the total, the pass mark if one is set, and room for the assessor's decision. The
six ROC exercises give a report, not points: their lines are printed and they are left out of the
total. The parts proposed (ROC: 22, 13, 15, ROC position fixing, 10; ARPA: 1, 5, 6, 8, 31) are only
a proposal: no syllabus read for this project lists the parts of either examination.

## 10. Checking the exercises: the self-test

Station, EXERCISES, "Self-test of the exercises", "Run self-test". Three robots work every ARPA, radar and
plotting exercise, the setting-up exercise 22 included. The careful robot follows the briefing and must score 100%; the wrong robot
gives wrong answers, which must all be rejected; the idle robot does nothing and must not be
credited. This checks that every exercise runs, can be completed and is marked properly. It does
not check that the answer key is good seamanship, and the ROC exercises are not included. Run it
after any change of scoring settings.

## 11. Making scenarios

Station, SCENARIOS, "Scenario editor": start from an existing scenario, set own ship's heading and speed,
sea state and current, list the targets (bearing and range from own ship's start, course, speed,
one optional alteration at a given minute), then "Load in simulator" or "Save to library". Saved
scenarios appear in the free practice list. "Download JSON" and "Open JSON file" move scenarios
between computers. A track can be written into a scenario file for any target as
`"route": { "points": [{ "e": 2, "n": 5 }, ...], "speeds": [null, 8] }` (east and north in NM
from the scenario origin; at most 20 points). Structures that give false echoes are written as
`"structures": [{ "name": "Cable", "kind": "power-line", "a": { "e": -1, "n": 3 }, "b": { "e": 1, "n": 3 } }]`
with kind "power-line", "bridge" or "reflector" (a quay wall or other large flat face). The
scenario "False echoes: power line, bridge and quay" shows all of them.

For a target, `"paint": 0.5` makes a fading echo that the ARPA sees on only every other scan (the
standard's test of tracking through 5 scans in 10). `"ais": true` gives AIS to a small craft, and
`"aisClass"` sets the AIS class: "A", "B-CS" or "B-SO" (class B reports less often and sends no
status, rate of turn, IMO number or voyage data). `"aisStatic"` sets what the AIS sends besides
the position, for example
`"aisStatic": { "destination": "MUMBAI", "eta": "13 NOV 1800 UTC", "draughtM": 10.2, "shipType": "Tanker", "imo": null }`
(null: not sent, shown to the trainee as MISSING; also `"navStatus"` and `"posAccuracy"`, "high"
or "low"). Left out, a ship gets a made-up IMO number and a type from its catalogue type, and no
voyage data.

### Real areas: coastlines and land heights

Four real areas are built in: the approaches to Mumbai, Mormugao (Goa) and Kochi, and the Gulf of
Kutch. A scenario file uses one with `"terrain": "mumbai"` (or `"goa"`, `"kochi"`, `"kutch"`) and its
origin, for example `"origin": { "lat": 15.4167, "lon": 73.5 }` for Goa; positions in the file are then
NM east and north of that origin. Start from one of the four scenarios in the editor to keep both.

How land paints is set by one figure, `LAND_REFLECTIVITY` in `src/engine/terrain.ts` (now 10, a
placeholder). If an experienced radar observer finds that a coast is seen too early or too late
compared with a real set, that is the figure to change; see `docs/RADAR-PICTURE.md`.

To add an area, or to make the data again, a developer needs the land-height tiles (Copernicus DEM
GLO-90, free, with the credit given in the scenario descriptions). On a Windows PC, in PowerShell:

    $ProgressPreference = 'SilentlyContinue'
    $dir = "C:\path\to\radar-sim\terrain-src"
    New-Item -ItemType Directory -Force $dir | Out-Null
    foreach ($t in "N18_00_E072_00","N18_00_E073_00","N19_00_E072_00","N19_00_E073_00") {
      $n = "Copernicus_DSM_COG_30_${t}_DEM"
      try { Invoke-WebRequest -Uri "https://copernicus-dem-90m.s3.amazonaws.com/$n/$n.tif" -OutFile "$dir\$n.tif" } catch { "no tile $t (sea)" }
    }

(one name per whole degree of latitude and longitude the area covers). Then add the area to
`scripts/areas.mjs` and run `scripts/make-coast.mjs` and `scripts/make-terrain.mjs` as their first
lines describe. The tiles themselves are not part of the simulator and need not be kept.

## 11a. Two screens at a display

A display with two screens shows the radar on one and the ship control window (steering, engine
telegraph, anchor, own ship's data and the exercise with its briefing, answers and result) on the
other: press SHIP CONTROL in the header and drag the window across, or allow the browser to place it
(Chrome and Edge ask once on a computer with two screens). The two windows are one simulator: the
record, the score and the replay are the same as with one window. Allow pop-up windows for the page
once on each PC. This has been checked in a test browser, not yet on the academy's PCs and screens.

## 12. Locking a classroom PC to the simulator (kiosk mode)

A trainee should not be able to leave the simulator for other programs during an assessment. The
simulator runs in a browser, so this is done with the browser's kiosk mode. On Windows, make a
shortcut with one of these targets (put in the real path of the file, or the address printed by
`npm run serve`):

    "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk "file:///C:/radar/radar-simulator.html"
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "file:///C:/radar/radar-simulator.html" --edge-kiosk-type=fullscreen

The browser then fills the screen with no address bar, tabs or window buttons. Alt+F4 still closes
it and Alt+Tab still switches programs: to block those as well, use a Windows "assigned access"
(kiosk) account for the trainee, which the PC's administrator sets up. This procedure has not been
tried on the academy's PCs; try it before relying on it. How the ship control window behaves in kiosk
mode (which screen it opens on) has not been tried either.

## 13. Limits the instructor should know

- No approval: the simulator has not been approved by DG Shipping or certified by DNV or anyone
  else, and no radar instructor has reviewed it.
- Many figures are estimates, not measured data: the handling of three of the six ship types, target
  ship figures, the ship's response to the sea, automatic clutter settings, echo shapes, the
  strength of false echoes, scoring tolerances. Radar beamwidths and pulse lengths are those of one
  maker's published specification.
- Radar and ARPA only: no chart display, no outside view, no echo sounder, no voice radio.
- Own ship's ahead, sideways and turning motion come from the manoeuvring model. Roll, pitch, heave
  and the yaw a sea gives are added as simple wave motions whose size is an estimate; the sea does
  not slow the ship or set her. Three ship types are fitted to published turning figures (SHIP menu, ? help);
  the others are estimates.
- Linked displays and the instructor station have been proved through the server with separate
  browsers on one computer, not yet on separate PCs. A copy hosted on a web site has no classroom
  server (section 7).
- From the station a trainee's display cannot yet be taken back in time, and a programmed track
  cannot be given to one of its targets: those work on the station's own radar. Its targets can be
  altered, added and removed (section 4).
- There is no chart: the route, the traffic separation scheme and the charted coastline are lines
  on the radar. A separation scheme can only be straight (an axis, the width of the zone and of the
  lanes), set in a scenario file ("tss"); the scenario editor does not draw one.
- Random traffic is placed round own ship without regard to land: on a coast, look at it before
  using it.
- A hardware control panel is supported by keys and by knob-box inputs (SETTINGS, Control panel),
  but no real panel has been plugged in: only simulated inputs have been tried.
- Symbols follow IMO SN.1/Circ.243/Rev.2 and IEC 62288 Annex A; alerts follow IMO MSC.302(87) and
  IEC 62288 Table 2. Not done: a 24-hour alert history.
- The ARPA tracks 40 targets and the display holds 40 activated AIS targets and 240 AIS targets in
  all: the figures of IMO MSC.192(79) Table 1 for ships of 10,000 gt and more (until 16 Nov 2026 it
  was 20, 20 and 120, the smallest class). Since 18 Nov 2026 it can acquire the multiple, side-lobe
  and indirect echoes of a strong ship close by, and interference from another radar gives it false
  plots (120 a scan, a placeholder) unless interference rejection is on. Mirror images in a quay or
  bridge and the echo of a power line still cannot be acquired.
- Automatic acquisition leaves out an echo 800 m or more across or deep, as land. The 800 m is a
  placeholder, the figure of one set described in Pub. 1310: sets differ.
- The four radar signal faults all have the same effect (no picture, tracks lost, AIS kept; without
  the heading marker, no heading line either). On a real set the loss of the heading marker or of
  the azimuth signal may look different.
- The simulator was compared with the radar standards IEC 62388:2013 and IEC 62288:2014: see
  `IEC-CHECK.md` for what was changed and what is still not met (now only 62388 18.1.2, a target
  simulator inside a real radar, which this product as a whole is). The standard's tracking
  scenarios 1 to 5, for ordinary ships and for high-speed craft, are run as tests and met.
- The simulator was compared with the textbook "Radar and ARPA Manual" (Bole and Dineley, 1990):
  see `BOOK-CHECK-RADAR-ARPA-MANUAL.md`. Its largest gap, a marked exercise on switching on and
  setting up the radar, is now radar exercise 22 (its limits are placeholders, which you can change
  under Scoring settings).
- A target on a programmed track allows for current and leeway and stays on the line; a plain
  target (no catalogue type) is given its course and speed over the ground, so the current is
  already in them. Its bow, and the heading its AIS sends, point along its course through the
  water. A vessel meant to be stopped in the water and drifting with the current must be given a
  catalogue type.
- The third edition of the Radar and ARPA Manual (2014) has been checked rule by rule, chapters 1 to
  9, with the book's figures and worked examples as tests: see the section on the third edition in
  `BOOK-CHECK-RADAR-ARPA-MANUAL.md`, which lists what was changed, what was left and the placeholders
  for you to judge.
