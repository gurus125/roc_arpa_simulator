# ROC / ARPA radar simulator: operation manual for the instructor and assessor

Training and study use only. Not for navigation. This simulator holds no approval or certificate.
The learner's manual is `USER-MANUAL.md`; read that first for the radar and ARPA controls. This
manual covers what only the instructor does.

## 1. Starting and the normal starting state

1. Open `radar-simulator.html` in Chrome or Edge on each display. For several computers working
   together, see section 7.
2. At the first screen, enter the trainees' names and batch, or choose "Free practice without names".
3. A newly opened simulator starts in this state: radar ON, X band, 6 NM range, north-up, relative
   motion, gain 50, sea and rain clutter 0, ARPA on with no targets acquired, simulation running
   at 1x. Loading a scenario puts gain, clutter, brilliance, EBL, VRM and parallel index lines back
   to this state. Day or night colours stay as last chosen.
4. Press the INSTR key (bottom right) and enter the instructor PIN. The first PIN is 0000: change it
   after logging in ("New PIN", 4 to 8 digits). The PIN only keeps trainees out of the instructor
   pages in class. It is not real security.
5. "Log out (student view)" returns the display to what a trainee sees. Do this before a trainee
   uses a display you have logged in on.

After logging in, the FAULTS key also appears at the bottom, and the instructor sections open
under the INSTR key.

## 2. Running an exercise

| To do this | Use |
|------------|-----|
| Choose what the trainees work on | SCENARIO key (free practice), ROC EX key (radar observer exercises), ARPA EX key (ARPA and manual plotting exercises) |
| Halt and continue | PAUSE / RUN key in the strip at the top of the page |
| Run faster | The speed box beside PAUSE: 1x, 2x, 5x, 10x |
| Start again from the beginning | "Restart" in the SCENARIO key, or open the exercise again |
| Go back in time | INSTR key, "Take exercise back 2 min", "Back 5 min", "Back 10 min". The ships, weather and faults return to that moment so that the trainees can try again. The simulator keeps one state a minute for the last 40 minutes |

Batches and assignments (INSTR key, "Batches, students and assignments"): add a batch, type the
trainees' names one per line, tick the exercises assigned to the batch, and save. "Students per
display" and "Hours per pair" are the academy's limits to set; nothing is enforced unless entered.

## 3. Changing the environment during an exercise

WEATHER key: sea state, rain squall and its intensity, abnormal propagation (ducting, which brings
second-trace echoes), refraction (standard, sub-refraction with detection ranges of about 80%, or
super-refraction with about 140%), interference from another radar, wind direction and speed, current set and
drift, and a tidal stream (maximum rate, direction of the flood, hours after slack at the start).
Changes act at once.

To set the weather on every linked display together, use INSTR key, "Monitor other displays",
"Set this weather on all displays".

## 4. Targets

All of this is under INSTR key, "Inject events (this display)". Every injection is written to the
exercise record.

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
only on a display logged in as instructor, never on a trainee's.

Each of up to 100 targets can have its own track. The scenario "Traffic: 100 ships on programmed
tracks" shows 100 ships running together. The ARPA tracks 20 targets at a time.

## 5. Faults (FAULTS key)

| Fault | What the trainee sees |
|-------|-----------------------|
| Gyro error (degrees) | Heading, bearings, picture and ARPA all use the wrong heading. Nothing says so |
| Log error (knots) | Speed and sea-stabilised vectors are wrong |
| Heading marker error (degrees) | The heading line is painted off the ship's head |
| VRM error (per cent) | The variable range marker reads wrong |
| Radar performance (per cent) | Weak echoes are lost; the performance monitor shows it |
| Speed log FAILED | The ARPA shows SPEED LOG INPUT ABSENT |
| Gyro compass FAILED | The ARPA gives an equipment malfunction warning and loses all tracks; the picture goes to unstabilised head-up with relative motion, and bearings are relative only |

Positive values mean the instrument reads high. The ship's real motion does not change. An error
comes on gradually; while it is changing the ARPA vectors are disturbed, so allow one tracking
window (3 minutes) after it stops before judging the effect.

"Show truth" lists, for each tracked target, the real target behind the track and its real CPA,
TCPA, course and speed, and counts target swaps. It is shown only on this display.

## 6. Following the trainees

On one computer the instructor watches the same screen. With linked displays (section 7), INSTR
key, "Monitor other displays" shows a small picture and the state of every display, with Pause,
Run, "Gyro +3°" (a gyro error on that display) and "Clear fault" for each, and Pause and Run for all. "Message to all displays" sends a typed message. Trainees answer with the
VHF/SIGNAL key (typed messages; there is no voice channel in this simulator).

## 7. Several displays working together

Other browser tabs on the same computer link by themselves. For several computers:

1. On one PC, in the simulator's folder, run `npm run serve`.
2. Open the address it prints in the browser of every display.
3. Load a scenario on the instructor's display, then press "Start a LINKED exercise on all displays
   with the scenario loaded here". Every display loads the scenario at the same moment, each own
   ship starts at a different position 5 NM from the scenario start, and every own ship is a target
   on the others' radar. A linked exercise runs at 1x.

This has been proved with five separate browsers going through the server on one machine
(`npm run test:link`): monitoring, a linked exercise, pause and run, messages, and finding the
server again after it has been stopped and started. It has not been tried on separate PCs over a
classroom network: do that before a class. If the server stops, each display shows "server out of
reach (trying again)" and links up again by itself when the server is back.

## 8. Records, replay and assessment

INSTR key, "Records, replay and reports" lists every finished exercise with the trainees, the
exercise and the score. "Open" shows:

- the replay: own ship's track in green and the targets' in yellow, with the events and alarms up
  to the time shown. "Play" runs it; the slider moves to any moment. "Replay speed" goes from 0.25x
  (slow motion) through 1x (real time) to 60x. Positions are recorded every 10 seconds and the
  replay moves the ships smoothly between them. Below the track plot is the radar
  picture as the trainee saw it, one picture every 15 seconds, in step with the slider. Pictures
  are kept in this browser on this computer; a record brought from another computer has none;
- the result, item by item, and the trainees' own debrief notes and radio log;
- the assessor's decision: "Competent" or "Not yet competent", the assessor's name and remarks. The
  score is a guide only; the assessor's decision is the prime criterion (STCW Code A-I/12,
  paragraph 8);
- "Result (CSV)", "Report (print or save as PDF)" and "Record (JSON)". "Export all (CSV)" saves the
  whole list. Records are kept in this browser on this computer: export them to keep them.

## 9. Scoring settings

INSTR key, "Scoring settings (placeholders)". None of the values comes from an approved marking
scheme. Enter the academy's own tolerances and pass mark, or leave the pass mark blank to report
scores without pass or fail. The "Set-up" fields are the limits of radar exercise 22 (switching on
and setting up): the lightest and heaviest noise speckle that count as a light speckle, how far
from the best the tuning may be, the least brilliance, and the sea and rain settings that count as
zero.

## 10. Checking the exercises: the self-test

INSTR key, "Self-test of the exercises", "Run self-test". Three robots work every ARPA, radar and
plotting exercise, the setting-up exercise 22 included. The careful robot follows the briefing and must score 100%; the wrong robot
gives wrong answers, which must all be rejected; the idle robot does nothing and must not be
credited. This checks that every exercise runs, can be completed and is marked properly. It does
not check that the answer key is good seamanship, and the ROC exercises are not included. Run it
after any change of scoring settings.

## 11. Making scenarios

INSTR key, "Scenario editor": start from an existing scenario, set own ship's heading and speed,
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
tried on the academy's PCs; try it before relying on it.

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
  not slow the ship or set her. Three ship types are fitted to published turning figures (SHIP page, HELP);
  the others are estimates.
- Linked displays have been proved through the server with separate browsers on one computer, not
  yet on separate PCs.
- A hardware control panel is supported by keys and by knob-box inputs (SETTINGS, Control panel),
  but no real panel has been plugged in: only simulated inputs have been tried.
- Symbols follow IMO SN.1/Circ.243/Rev.2 and IEC 62288 Annex A; alerts follow IMO MSC.302(87) and
  IEC 62288 Table 2. Not done: a 24-hour alert history.
- The ARPA tracks 20 targets. It cannot acquire a false echo; a real ARPA can.
- The simulator was compared with the radar standards IEC 62388:2013 and IEC 62288:2014: see
  `IEC-CHECK.md` for what was changed and what is still not met (among others: the antenna's
  position on own ship, AIS reports repeated by shore stations, and the high-speed-craft versions of
  the tracking scenarios). The standard's tracking scenarios 1 to 5 for ordinary ships are run as
  tests and met.
- The simulator was compared with the textbook "Radar and ARPA Manual" (Bole and Dineley, 1990):
  see `BOOK-CHECK-RADAR-ARPA-MANUAL.md`. Its largest gap, a marked exercise on switching on and
  setting up the radar, is now radar exercise 22 (its limits are placeholders, which you can change
  under Scoring settings).
- A target on a programmed track allows for current and leeway and stays on the line; a plain
  target (no catalogue type) is not moved by the current at all.
