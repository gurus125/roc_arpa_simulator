# ROC / ARPA radar simulator: user manual for learners

For training and study only. This is not a radar and must not be used for navigation.

## 1. Starting

Open `radar-simulator.html` (or the address your instructor gives you) in Chrome or Edge. Choose your
batch and your names, or press "Free practice without names". Press F11 for full screen. The person
icon at the top right changes the names later.

**Logging in with a PIN.** Your instructor may have set the class so that each trainee logs in with
a PIN of his or her own. Then you choose your batch and your name from the list (names cannot be
typed) and type your PIN. At your first login you choose the PIN yourself: 4 to 8 digits, typed
twice. Keep it to yourself: it is what makes a record and a result yours. If you forget it, the
instructor can reset it, and you choose a new one at your next login. Two trainees at one display
each give their own PIN.

The screen has the radar picture in the middle, as large as the window allows, with three data
panels down each side of it, laid out the way ships' radars in general present their data (it is
not a copy of any one maker's screen):

| Left | Right |
|---|---|
| PICTURE & RADAR CONTROL: range, band, AIS, mode, rings, pulse, resets (top) | OWN SHIP DATA (top) |
| GAIN / CLUTTER, brilliance and trails (middle) | TARGET DATA: the list of tracked targets, and the selected target (middle) |
| EBL / CURSOR, and the PI / MAP key (bottom) | VRM / ARPA: VRMs, vectors, alarms, target keys and MENU (bottom) |

No settings are written on the picture itself; the only text on it is the data label of a target you
have clicked (see section 6). The **MENU** key at the bottom right opens the menu over the
right-hand side of the screen, with its keys along the bottom; **CLOSE**, MENU again or Esc closes it.

The header along the top of the page has:

- the tabs **RADAR** (the radar's menu: pulse, echo processing and the rest), **ARPA** (the ARPA's
  menu) and **EXERCISE** (choose and run an exercise). The lit tab pressed again closes the menu.
  With the menu closed RADAR is lit;
- **SHIP CONTROL**: opens the ship control window, for a second screen (section 7);
- the keys that work the simulator and not the radar: PAUSE / RUN, the speed of the clock and
  DAY / NIGHT;
- the ship's clock (UTC) with the date;
- the state of the alerts: a green light and "No Alarms", or the number of alerts waiting, orange
  for a warning and red (flashing) for an alarm;
- the gear (SETTINGS), **?** (help: a short explanation under every control; press it again to hide
  them) and the person (change students).

The foot of the page explains the symbols on the picture, and says that this is a training
simulator: not type approved and not for navigation.

The colours: deep navy panels; light blue for whatever is selected or switched on; green for a
normal state (a steady tracked target, a working sensor); orange for a warning; red for an alarm or a
dangerous target; amber for radar echoes. Land is painted in a deeper, dimmer amber than other
echoes so that the coast does not glare.

## 2. RADAR key, alarms and own ship

| Control | What it does |
|---|---|
| RADAR key (top left, in the heading of the PICTURE & RADAR CONTROL panel) | Switches the radar on from cold (RADAR: OFF), and between standby and transmit. Switched on from cold it warms up first (WARM UP and a countdown; about one and a half minutes here, never more than 4 minutes on a real set), then waits in STANDBY: press again to transmit. In standby there is no picture. SETTINGS, RADAR POWER OFF switches it off. |
| ALARM ACK (VRM / ARPA panel, bottom right) | Acknowledges the alert shown beside it, one at a time: alarms first, then the oldest warning. It flashes while an alert is waiting. The alert box beside it is red for an alarm, orange for a warning and yellow for a caution. |
| PAUSE / RUN, 1x-10x (header) | Stops and starts the exercise clock, and sets how fast it runs. |
| DAY / NIGHT (header) | Display colours for day or for a dark bridge (also under SETTINGS). |

Own ship's data is in the OWN SHIP DATA panel at the top right:

| Shown | Meaning |
|---|---|
| HDG, with GYRO | Heading from the gyro compass |
| STW, with LOG | Speed through the water from the speed log |
| COG, SOG, with EPFS | Course and speed over the ground from the position-fixing system (GPS) |
| LAT, LON | Own ship's position |
| RUD, ROT, STEER | Rudder angle (P port, S starboard), rate of turn, and AUTO (autopilot) or HAND steering |
| WIND | Relative wind (R045 is 45° on the starboard bow) |
| VIS | The visibility in NM, shown only when it is restricted (see "Visibility" in section 9) |
| TIME (in the heading of the panel) | The exercise clock |

The small box after a value names the sensor it comes from. It turns red when that sensor has failed.

Own ship on the picture is drawn as on a radar: the heading line with a short beam line across it
at the ship's position, and on the shortest range scales the ship's outline to scale. The bearing
scale round the picture has a mark every 5° and a number every 30°.

If the gyro compass fails, the picture changes by itself to head-up (unstabilised) with relative
motion, "HDG FAIL: UNSTAB, REL BRG ONLY" is shown in the PICTURE & RADAR CONTROL panel, and the EBLs read relative
bearings only. That is what a real radar does when it loses its heading input.

If the display loses one of the radar's own signals (video, sync, azimuth or heading marker), the
warning RADAR SIGNAL LOST names it, the echoes fade and the picture reads NO RADAR PICTURE. The
tracked targets are lost within a few turns of the aerial. The AIS targets are still shown, with their data, CPA and
TCPA: use them, your position and a look-out until the radar is back. If the picture stops being
updated, PICTURE FREEZE is written across it and a warning is given: the echoes on the screen are
old and must not be used.

The settings are not written over the picture but kept in the panels beside it: the PICTURE & RADAR
CONTROL panel shows the range scale, ring interval, band, orientation, motion and stabilisation, and the pulse
length in use (SP short, MP medium, LP long); the VRM / ARPA panel shows the vector mode and time,
the CPA / TCPA limits, the past positions setting, and the ARPA's status lines (its stabilisation
and speed input, ARPA STANDBY, LOST TGT WARNING OFF, AIS FILTER, ANCHOR WATCH, TRIAL).

## 3. PICTURE & RADAR CONTROL panel (top left)

The settings are boxes that are clicked; each shows the setting in use by its standard abbreviation.

- **RANGE − / +**: range scale, 0.25 to 96 NM.
- **BAND X / S**: the 3 cm or 10 cm radar. S band sees through rain better; X band gives a
  sharper picture and is the only band a SART answers. **AIS ON / OFF** beside them shows or hides
  the AIS targets. AIS targets are shown on every range scale, and whether the ARPA is on or in
  standby: only this key takes them off. In a manual plotting exercise it reads **AIS OFF**, is greyed
  out and cannot be switched on until you press Finish.
- **RINGS**: fixed range rings ON or OFF; the interval between them is written beside the key.
- **PULSE**: AUTO (chosen by the range scale), SHORT, MED or LONG. The pulse in use is written at the
  foot of the panel (SP, MP or LP and its length in microseconds).
- **MODE**, three boxes, each opening a short list: orientation **N UP** (north-up), **H UP** (head-up, unstabilised: bearings
  are relative) or **C UP** (course-up); motion **RM** (relative motion, own ship fixed) or **TM**
  (true motion, own ship moves across the screen); stabilisation of the picture **GND** (ground) or
  **SEA**. Head-up is used only with relative motion: choosing H UP changes TM to RM, and choosing TM
  while in H UP changes the picture to C UP.
- **RESET**: **C-UP RST** takes the present heading as the new course-up reference; **TM RST** puts own ship
  back to the start of its run across the screen in true motion: half the radius out, on the reciprocal of
  her course, so that the picture shows the most ahead. The same happens by itself when she has run two
  thirds of the radius from the centre, and when the range scale is changed.
- Under **SCENARIO**, Study aids: **Stern line** draws a thin dotted line from own ship
  astern to the edge of the picture. **Antenna position on own ship's outline** marks the radar
  antenna with a small cross, on the short range scales where own ship's outline is drawn. Where the
  antenna is on the ship is entered under Own ship data (metres ahead of and to starboard of the
  reference point); the picture and every measurement stay referenced to the reference point.

## 4. Measuring: EBL (bottom left) and VRM (bottom right)

The EBLs are in the EBL / CURSOR panel and the VRMs in the VRM / ARPA panel. Tick EBL 1 or VRM 1. The line follows the cursor over the picture and shows MOVE. Double-click
the picture to lock it (LOCK). Untick and tick again to move it. EBL 2 and VRM 2 work the same
way. The **EBL BRG** key under the readouts changes the EBL bearings between TRUE and REL
(relative to the ship's head); every bearing ends in T or R so that you know which it is. The
cursor line in the EBL / CURSOR panel shows the true bearing (BRG), relative bearing (REL) and range (RNG)
of the cursor at all times, and under them (CURS) the latitude and longitude of the point it is on.

More tools are under **PI / MAP** (the key at the bottom of the EBL / CURSOR panel opens the menu there): four parallel index lines, an offset EBL origin, off-centre,
navigation lines and marks, and "Hold: graphics off". Each parallel index line can be cut short (Ahead and
Astern, in NM from the point abeam of own ship), put parallel to the heading (HDG), and all can be
switched on or off together. An offset EBL origin can stay fixed to the ground or be carried with
own ship. While that key is held (or key H), the
heading line and every other line and symbol are taken off, leaving only the echoes and trails,
so that a weak echo under a line can be seen.

Also under **PI / MAP**:

- **Route.** Press "Route: add waypoints", click the waypoints in order (at most 20), press again
  when done. The route is fixed to the ground: legs dashed, waypoints as numbered circles, the next
  one bold. The EBL / CURSOR panel then shows the next waypoint with its bearing and distance, and
  **XTD**, the distance off the leg being sailed: S when the ship is to starboard of it, P to port.
  The leg moves on when the ship comes abeam of its waypoint. A route is only as good as the
  ship's position and the ground stabilisation: check it against a fixed echo.
- **Search pattern.** A route made for you from a datum (own ship now, or the MOB mark): an
  expanding square (legs of 1, 1, 2, 2, 3, 3 ... times the track spacing, every turn 90° to
  starboard) or a sector search (three triangles through the datum, every turn 120° to starboard,
  nine times the radius long). Give the spacing or radius and the first course.
- **Charted coastline over the picture.** Draws the coast as the simulator has it as a thin line
  over the echoes, to compare the radar with the chart: low land far off and land in radar shadow
  paint less than the chart shows. "Outline sheet of this area" opens the same coastline with a
  latitude and longitude grid and a scale, to print and plot position lines on by hand. Neither is
  a chart.
- **Area map over the picture** (the four real areas only). Draws over the echoes the approximate
  depth contours (5, 10, 20, 30, 50 and 100 m; to 10 m solid, deeper dashed, each labelled), and the
  buoys, beacons, lights, rocks and wrecks mapped in OpenStreetMap: a red square is a port-hand mark,
  a green triangle a starboard-hand mark, a yellow diamond with its letter a cardinal mark, a yellow
  cross a special mark, a magenta star a light, a magenta flare a light on a buoy or beacon, a magenta
  ring a racon, a white cross a rock (dotted when it dries or is awash) and a white hull a wreck. On
  the 3 NM range and below each mark has its name and its light (for example "Fl(3) W 20s 85m 27M").
  With the map on, the cursor readout adds the depth under the cursor. The depths come from a world
  relief model with cells of about 450 m, below mean sea level and with no tide: banks, reefs and
  dredged channels smaller than that are not in it, and near the coast it is not reliable. The marks
  are as volunteers mapped them: some are missing and some may have changed. It is a guide for
  comparing the radar with the lie of the bottom and the marks, not a chart.
- In a scenario with a **traffic separation scheme** the scheme is drawn on the picture: the
  separation zone shaded, the outer limits of the lanes dashed, and arrows for the flow.

## 5. GAIN / CLUTTER panel (middle left)

Each control is a bar: click or drag along it. The figure beside it is the setting, 0 to 100.

- **GAIN**: receiver gain. Too low loses weak echoes; too high fills the picture with noise.
- **SEA**: sea clutter control. It works close to the ship. Too much removes small targets nearby.
  Sea clutter reaches further on the side the wind and sea come from (to windward) than on the
  other side. A shorter pulse (the PULSE keys) returns less clutter. The clutter is spiky: bright
  spots in streaks along the wave crests, different on every turn of the antenna, so a spike can
  look like a small echo for one scan. A real echo stays from scan to scan.
- **RAIN**: rain clutter control. Too much weakens all echoes. A rain squall paints as an irregular,
  woolly area with a ragged edge and a heavier core, its texture drifting with the wind.
- **TUNE**: tune for the highest METER reading.
- **AUTO**: the set chooses the setting. Like a real automatic control it is a compromise.
- **BRILL**: brightness of the radar picture.
- **TRAILS**: echo trails OFF, REL (relative) or TRUE, and their length.

The small letters in the heading of the panel light up when a signal processing function is in use:
IR (interference rejection), ENH (echo stretch), SC/SC (echo averaging from scan to scan), MON
(performance monitor). Switch them under **RADAR**.

More under the **RADAR** tab: echo stretch, echo averaging, interference rejection, the
performance monitor, and the pulse length again. Interference rejection keeps only what successive
pulses both return, so it costs very weak echoes a little: switch it on when interference is seen,
not otherwise. A long pulse puts more energy on a target (pulse length x pulses a second) and a
short pulse less.

**PRF** (pulse repetition frequency, pulses a second), beside the pulse length: normally it follows
the pulse length (short 3000, medium 1500, long 600) and the panel shows it after the pulse. It can
be chosen by hand to see what it does: a lower PRF puts fewer pulses on each target, so weak echoes
are lost sooner, and it lengthens the range that can be measured without ambiguity (150,000 km
divided by the PRF: 81 NM at 1000 a second), so second-trace echoes move or disappear. A PRF too
high for the pulse length in use is greyed out. On most real sets the PRF is not a control of its own.

## 6. ARPA: tracking targets

The target keys are in the VRM / ARPA panel at the bottom right, under ALARM ACK and the alert box.
The heading of that panel says whether the ARPA is ON, in STANDBY or OFF (during an ROC exercise).
Tracked targets are shown on every range scale, from 0.25 to 96 NM; the ARPA tracks out to 24 NM
whatever the scale.
The same panel has **VECTOR** (REL or TRUE vectors of tracked targets, and the vector time) and
**DANGER** (PPC, points of possible collision, or PAD, predicted areas of danger).

1. Press **Acquire**, then click an echo. A broken circle appears.
2. After about one minute a faint (preliminary) vector appears. After about three minutes the
   vector is at full strength and the data is reliable.
3. Press **Select** and click a target to see its data in the TARGET DATA panel (middle right): target number,
   bearing (BRG), range (RNG), course and speed, CPA, TCPA, and the bow crossing range
   and time (BCR, BCT), each with its unit. The course and speed are named CTW and STW (through
   the water) when the ARPA is sea stabilised, and COG and SOG (over the ground) when it is ground
   stabilised. TT after the heading means a tracked (radar) target, AIS an AIS target; for an AIS
   target the panel also shows its MMSI, navigational status, reported position and heading, and
   MISSING for anything its report does not carry. A yellow ? after a value means it is still preliminary. The VRM / ARPA
   panel shows the CPA and TCPA limits, the past positions setting and the ARPA's speed input.
4. **Cancel** drops one target; **Cancel all** drops them all. **Auto** acquires targets that
   enter a guard zone. It leaves out echoes as large as land (800 m or more across or deep), so the
   coast is not acquired; a small rock or a patch of clutter can be, and an exclusion area (GUARD)
   keeps those out. Anything can still be acquired by hand. The ARPA tracks 40 targets.
5. **The list of tracked targets** at the top of TARGET DATA gives each target's number, bearing,
   range, CPA, TCPA, course and speed (CTW and STW, or COG and SOG, as above) and a status light:
   green for a steady track, orange while acquiring, preliminary or lost, red for a dangerous
   target. Press a row to select that target.
6. **Data label on the picture.** Clicking a target (with Acquire or Select) puts a small label beside
   it: TGT and its number, its range, and its course and speed (an AIS target: its name, range, COG
   and SOG). Click the same target again to take the label off. Several targets can have labels at
   once. A target you acquire gets its label at once. The label is in the target's colour: green,
   red when dangerous, orange when lost, light green-blue (teal) for AIS.

A target inside both the CPA limit and the TCPA limit is DANGEROUS: its symbol turns red and bold
and an alarm sounds. Limits are set under **CPA/ALARM**.

Colours: tracked targets green, dangerous targets red, lost targets orange, AIS targets teal, own
ship and its vector light blue, echoes amber. The foot of the screen shows the main symbols.

Symbols (as in IMO circular SN.1/Circ.243/Rev.2):

| Symbol | Meaning |
|--------|---------|
| Broken circle | Target being acquired (bold, red and flashing if it was acquired automatically in a guard zone, until acknowledged) |
| Circle with a dashed vector | Tracked target |
| Bold red circle, flashing until acknowledged | Dangerous target |
| Circle with a bold cross, flashing | Lost target |
| Square shown by its corners | Selected target |
| Small triangle | AIS target, sleeping; larger with a heading line and dashed vector when activated |
| Triangle inside a circle | AIS target that is the same ship as a radar track |
| Own ship's vector with one arrowhead / two arrowheads | Stabilised through the water / over the ground |
| Large T | A trial manoeuvre is being shown |

Alerts (IMO resolution MSC.302(87), IEC 62288 and IEC 62388) have three priorities:

| Priority | When | Shown | Sound |
|----------|------|-------|-------|
| ALARM | A dangerous target (CPA and TCPA inside the limits) | Red, flashing until acknowledged, then steady until the danger has gone | Three short signals, repeated every 8 seconds until acknowledged |
| WARNING | Lost target, new target in a zone, capacity exceeded, sensor failure and the rest | Orange, flashing until acknowledged | Two short signals; again every 5 minutes if left unacknowledged |
| CAUTION | The tracker is nearly full (38 of 40 targets) | Yellow, steady | None; nothing to acknowledge |

Alerts are acknowledged one at a time. Under **CPA/ALARM**, "Silence sound 30 s" stops the sound
without acknowledging anything, and the lost target warning for tracked targets can be switched
off ("LOST TGT WARNING OFF" is then shown in the VRM / ARPA panel, and a lost target's symbol goes after
a minute).

Other ARPA keys: **PAST POS** (past positions), **GUARD** (guard zones and exclusion areas),
**TRIAL** (trial manoeuvre with delay), **TGT LIST** (all tracked targets), **AIS LIST**
(AIS targets), **ARPA** (standby, self-test, speed input: log, bottom track, GNSS or manual).

Three more ARPA aids:

- **Trial alarm.** While the trial manoeuvre is on, a warning names each target that the manoeuvre
  being tried would not clear by the CPA and TCPA limits. Change the trial until it goes. The trial
  allows for own ship's handling: she comes round and changes speed as she really would, not at once.
  With a delay, TIME TO MANOEUVRE warns a minute before the manoeuvre is due, and TIME FOR ACTION
  when it is.
- **Vectors of dangerous targets only** (under PAST POS): a target that does not violate the limits
  is still tracked but shows no vector, which makes a crowded picture easier to read. Its vector
  comes back, with the alarm, when it violates the limits. Switch this off before planning a
  manoeuvre: a "safe" target may not be safe after you alter.
- **Anchor watch** (under CPA/ALARM): at anchor, select a tracked target that you know cannot move
  (a small isolated mark), set a distance and press "On, selected target". A warning is given
  when the mark has moved further than that from where it was, which means your ship (or the
  target) is dragging.

Remember what the ARPA cannot do: it needs time after acquisition and after a target alters;
it can lose a weak target and can swap two close targets; with a wrong gyro or log input the
true data is wrong while CPA and TCPA stay correct.

## 7. Own ship

The ship's controls are in the **ship control window** (key **SHIP CONTROL** in the header), or under
**SHIP** in the menu when that window is not open.

### The ship control window (for a second screen)

Press **SHIP CONTROL** at the top of the radar screen. A second window opens with:

- **STEERING**: AUTOPILOT or HAND STEERING, PUMP 2 (the second steering gear pump: the rudder moves
  faster), SET COURSE in large figures with keys −10, −1, +1 and +10 (or drag the bar under it),
  heading and rate of turn, the rudder indicator (where the rudder is, and the order), and the rudder
  keys for hand steering.
- **ENGINE TELEGRAPH**: the telegraph from FULL AST to SEA FULL, the engine order in knots with − and +,
  STW, SOG, COG and the relative wind, LET GO ANCHOR and MOB.
- **OWN SHIP DATA**: name, call sign, MMSI, IMO number, type and size; and the choice of ship.
- **EXERCISE**: the ARPA and radar exercises and the ROC exercises (the keys at the top of the box
  change between them). Choose the exercise, read the briefing and how you will be assessed, answer,
  and press Finish: the result appears there. While an exercise runs, CHOOSE EXERCISE shows the
  list again.

Drag the window to the second screen (on a computer with two screens Chrome or Edge may ask whether
the simulator may place windows: allow it, and the window goes to the other screen by itself). If the
browser blocks the window, allow pop-up windows for this page (the icon at the right of the address
bar) and press SHIP CONTROL again.

While the window is open, SHIP, ROC EX, ARPA EX and the EXERCISE tab on the radar screen bring it
forward. Close the window and its controls go back to the menu of the radar screen, as they were.
On a single screen, keep both windows side by side: the simulation keeps running while either window
can be seen.

### The controls

Press **SHIP** (or use the ship control window).

- **Ship**: choose the ship type. Large ships turn and stop slowly. Three types are fitted to
  published turning figures (the 230 m container ship to model tests of the KCS benchmark hull, the
  350 m VLCC to a classification society's sample ship, the 105 m training ship to a sea-trial
  turning circle); the others are estimates. Press **?** (help) to see which.
- **In a sea** the ship rolls, pitches and yaws (SHIP and the ship control window show ROLL and PITCH). The sea comes
  from the direction of the wind. Heavy rolling in a beam sea tips the radar beam, so echoes abeam
  fade and come back; yawing smears a head-up picture, which is why north-up or course-up is used
  in a seaway.
- **AUTOPILOT**: set the course; the ship steers to it.
- **HAND STEERING**: press a rudder angle in the Hand steering box. Minus is port, plus is
  starboard; the − and + keys change it by 1°. The rudder takes time to move: the bar under the
  keys shows where it is. Put it back to 0 to stop the turn.
- **Telegraph keys**: engine orders from full astern to sea full. The ship gains and loses speed
  slowly.
- **MOB** (man overboard), beside the anchor key (in the menu's own ship keys, and in the ship
  control window under ANCHOR AND MOB): marks the ship's position at that moment on the
  radar with a red mark fixed to the ground, and becomes the datum offered for a search pattern.
  It needs a position from the EPFS. A person in the water gives no radar echo.
- **LET GO ANCHOR**: anchors the ship where she is. It works only when she is making less than
  1 kn over the ground: take the way off first, with the engine astern if need be. At anchor the
  engine is stopped, the AIS sends "At anchor" and the key reads **WEIGH ANCHOR**. The anchor can
  drag (an instructor's fault, or in exercise 24): the ARPA's anchor watch on a fixed echo then gives
  its alarm.
- **Depth** (OWN SHIP DATA, in the four real areas): the echo sounder's reading, the approximate depth
  of water where the ship is and, when the draught is known, the water under the keel. It comes from
  the same relief model as the area map's contours (cells of about 450 m, taken as charted depths): a
  guide only. When the instructor has the tide on, the height of the tide is added. The ship never
  touches bottom in this simulator.
- **Tide** (WEATHER): with the tide on, the water moves with the tidal streams of the tidal diamonds,
  changing by the hour and from place to place. "Tidal stream table" shows the diamonds hour by hour
  from high water (set, then the rates at springs and at neaps) and the tide heights; the row for now is
  marked. With the area map on, the diamonds appear on the picture as lettered diamonds, with an arrow
  for the stream now. The real areas' tables are invented for training, not taken from a chart.
- **Waves**: a ship slows down in a heavy sea, most when heading into it, and a sea on the beam pushes her
  sideways a little. Watch SOG and COG against STW and HDG.
- **If the GNSS (EPFS) fails** there is no position anywhere: the position reads NO FIX, the cursor
  gives no latitude and longitude, COG and SOG are blank, and the ARPA warns EPFS INPUT ABSENT. Fix
  the position by radar (exercise 23).

The OWN SHIP DATA panel always shows heading, speed, course and speed made good, rudder, rate of
turn and relative wind.

## 7a. Things the picture does that are not ships

- **True motion and the speed input.** In sea-stabilised true motion the display moves own ship by
  the heading and the speed it is given (the log, or a speed set by hand under ARPA). If that speed
  is wrong, own ship moves the wrong amount and everything else, buoys and land included, slides
  across the picture. With no speed input own ship stays still and the whole picture moves past.
- **False echoes** (scenario "False echoes: power line, bridge and quay"):
  - an overhead power line paints ONE echo, where the beam meets the cable at right angles. It
    stays on a steady bearing and closes, like a ship on a collision course;
  - a quay wall or other large flat face mirrors a ship and paints a false one behind the wall;
  - a strong ship close by is painted again in the funnel's shadow sector astern, at the same
    range (an indirect echo);
  - close to a bridge, the bridge is painted a second time beyond itself.
  A false echo lies on land, in a shadow sector, or square to a cable, and it moves or vanishes
  when own ship alters course.
- **Small echoes fade.** In a seaway (sea state 2 and above) a buoy or a small boat is lost for
  several scans together and comes back, as it drops into the troughs and rolls; it is painted as
  often as before in the long run, but not on every scan. Watch a weak echo over several scans before
  deciding it has gone. In the real areas, buoys, beacons and lights standing in the water give
  echoes of their own in the scenarios of those areas, and a racon on a light ashore paints its Morse
  letter beyond the land.

## 7b. A hardware control panel

Under **SETTINGS**, "Control panel" lists the key for every radar function (gain, sea, rain,
brilliance, range, EBL, VRM, alarm acknowledge, acquire at the cursor and others). A panel that
acts as a keyboard works the radar with these keys; press "Set" to give a function another key.
A box of knobs that acts as a game controller is found by itself: its first four knobs are gain,
sea clutter, rain clutter and brilliance. The keys do nothing while you type in a box.

## 8. Other keys

- **VHF/SIGNAL**: typed VHF messages to the instructor and other stations; whistle signals of the
  collision regulations, and an automatic fog signal.
- **WEATHER**: sea state, rain, abnormal propagation (ducting), refraction, interference, wind,
  current and tide. Refraction changes how far the radar sees: in sub-refraction targets are
  detected at about 80% of the usual range, in super-refraction at up to about 140%.
- **SETTINGS**, DEFAULT SETTINGS: after a confirmation, puts the radar and ARPA controls to the
  standard starting state every radar offers (X band, 6 NM, rings off, one EBL and one VRM on,
  true motion north-up, ground stabilised, trails and relative vectors of 6 minutes, AIS on, CPA
  limit 2 NM, TCPA limit 12 minutes). Gain, clutter and tuning stay as they are.
- **AIS LIST**: "Activate automatically" activates sleeping AIS targets within 3, 6 or 12 NM by
  themselves; with automatic acquisition on, an AIS target in an acquisition zone is activated too,
  with a NEW AIS TARGET warning. At most 40 targets can be activated (a caution at 38). An activated
  target shows its past positions (as set under PAST POS), a turn indicator on its heading line when
  it is turning, and on the shortest range scales its outline to scale. Its data gives its rate of
  turn (ROT) when it reports one, and CTW and STW when the ARPA is sea stabilised.
  The **filter for sleeping targets** thins out a crowded picture: a sleeping AIS target is left out
  when it is further off than the range chosen, passes wider than the CPA chosen (or is opening),
  has its CPA further ahead than the TCPA chosen, or is slower than the speed chosen. "Apply to"
  narrows this to class B targets (small craft); on its own it filters nothing. While the filter is
  on, "AIS FILTER" and its criteria are shown in the VRM / ARPA panel and the AIS key
  reads AIS FILT. Activated, dangerous, lost and selected targets are always shown, and no single
  target can be taken off the picture.
  **Further data**: with an AIS target selected, the MORE key in the TARGET DATA panel shows its AIS
  class, IMO number, ship type, destination, ETA, draught, size and position accuracy; LESS goes
  back. Anything the ship does not send reads MISSING: a class B set (small craft) sends no
  navigational status, rate of turn, IMO number or voyage data, and reports less often (every 30 s
  or so). "Own ship AIS data" shows what own ship's AIS is sending.
- **SCENARIO**: free-practice scenarios (one has 100 ships at once; four are real areas, with the
  real coastline and land heights: the approaches to Mumbai, Mormugao (Goa) and Kochi, and the Gulf of
  Kutch); show target names (a study aid). In a real area the land paints as a radar sees it: far off
  only the high ground shows, and the coast seems to come towards you as low land rises above the
  horizon; hills cast radar shadow; a ship behind an island or a headland disappears from the picture
  and from the ARPA until it comes out again.
- **SETTINGS**: day or night display; telemotor 2 (faster rudder); own ship data. User setting 1
  and 2: Store keeps the present settings of the radar and ARPA controls; Recall puts them back
  (each asks you to confirm).
- **ROC EX**: radar observer exercises (plotting, position fixing, set and drift, clearing range,
  blind pilotage, traffic).
- **ARPA EX** (or the EXERCISE tab): ARPA exercises 1-9, radar exercises 10-11, manual plotting
  exercises 12-21, switching on and setting up 22, radar exercises 23-26 on the real coasts
  (Mumbai, Goa, Kochi, Gulf of Kutch), 27 monitoring a planned route, 28 a traffic separation
  scheme, 29 man overboard and search patterns, 30 safe speed in restricted visibility, and 31 a
  timed ARPA acquisition test.

The instructor's pages are not on your display: the instructor has a station of his or her own, from
which he or she can pause your display, start an exercise on it, change the weather, give your
instruments faults and send you a message (it appears in a box under the header: click it to close it).
The instructor can also look at your radar picture and settings from the station.

**At the controls.** When two or more names are logged in, MENU, own ship keys shows "At the
controls": choose who is working the radar, and change it when you change over. It is written in
the record, so that each of you can be assessed: every answer you give, every action and the first
alteration of course or speed carries the name of whoever was at the controls then, and the result
shows it when more than one of you answered. In an examination you take the controls in turn, one
part each, and the message at the start of each part says whose turn it is. The instructor can also
set a changeover time: the controls then pass to the next of you each time that many minutes of the
exercise have gone, with a message on the screen ("Change over: ... takes the controls now").

## 9. Doing an exercise

1. Press ARPA EX (or ROC EX, or the EXERCISE tab), or use the EXERCISE box of the ship control
   window, and choose the exercise; or the instructor starts it on your display from the station.
   Read the briefing and "How you will be assessed".
2. Press RUN. Do what the briefing asks.
3. Type each answer and press ANSWER beside it. A number is marked against the true value at the
   moment you press ANSWER; you can answer again, and the last answer counts.
4. Press Finish. The result shows each item, your answer, the correct answer and the debrief
   questions. Under each item, "Why" (or "Why, and what is right" where you were marked down) opens
   the reason for the correct answer: where on the screen it is found, the rule behind it and the
   working with the numbers that were on your screen when you answered (for an item you did not
   answer, when you pressed Finish). In an examination this is shown to the assessor only. Write your
   debrief notes and save them: the record goes to the instructor's station.

For the manual plotting exercises the ARPA and the AIS display are off (the ships do transmit AIS,
so the AIS key is locked off until you press Finish): take ranges and bearings with EBL 1 and
VRM 1 at regular times, plot them on a plotting sheet, and manoeuvre at 12 minutes.

**Time limit.** Some exercises have a time allowed (exercise 31 has its own; the instructor can set
one for any exercise). The time left is shown beside the exercise time, and "Finished within the
time allowed" is one of the marked items. The limit is exercise time: it stands still while the
exercise is paused.

**Examination.** The instructor can start a practical examination on your display: several
exercises one after the other. When you press Finish on a part, a message offers the next part:
click it to start. Target names are switched off. Every part is recorded and marked as usual.

**Fixing by ranges or by bearings (ROC position fixing and set and drift).** "Use for the fix"
chooses what an observation gives: range and bearing, the range only (a circle of position), or
the bearing only. Put the EBL and the VRM on the object as before, so that the simulator knows
which object it is; only the reading you chose is used. Two or three ranges of well-separated
objects usually give the best radar fix. Position lines taken at different times are run on with
the ship's course and speed (a running fix). The result gives the angle of cut.

The ROC plotting exercise asks for the full report of the plot: relative course and speed, true
course and speed, CPA, TCPA and the target's **aspect**. Aspect is the angle between the target's
course and the line from the target to your ship, as seen from the target: **Red** when your ship
is on its port side, **Green** when on its starboard side, from 0° (you are right ahead of it) to
180° (right astern). A target steering 270° that bears 050° from you has you bearing 230° from
it, 40° to the left of its course: Red 40°.

**Visibility.** The simulator has no view from the bridge windows, so you are told what the bridge
would see. When the visibility is restricted, OWN SHIP DATA shows VIS with the distance, and
messages appear over the screen: "BRIDGE: the visibility has closed to 0.5 NM..." when it changes,
and "LOOKOUT: a vessel in sight, bearing 045° (Green 45), about 0.4 NM" when a vessel comes within
it (Green is on your starboard side, Red on your port side, counted from the bow), and again when
she is lost to sight. A vessel that has not been reported is not in sight: for her, rule 19
applies, and the marking of your avoiding action follows it. Sound the fog signal (VHF/SIGNAL,
"Automatic fog signal"). In free practice you can set a visibility yourself: MENU, WEATHER,
"Visibility" (blank is good).

**If the instructor takes the exercise back or resets it.** A message says so. After going back in
time the ships are where they were then and the ARPA is empty: acquire the targets again.

**My results.** EXERCISE, "My results", "Show my results": your own recorded exercises, with a
chart of the score at each attempt, each exercise with its first, best and latest score, and the
assessor's decisions. If you logged in with a PIN the list comes from the instructor's station and
covers every display you have worked at; otherwise it shows what this display has recorded under
your name.

**Points in the ROC exercises.** Each ROC exercise ends with a table of points under its report.
In the plotting exercise and in set and drift, the answers that count are those of your **first**
check: the report then shows the real values, so later checks are for learning and do not change
the points (the screen says so). A fix is marked as it stands when you first complete it, that is
when the second charted object has been observed, so choose your objects before you start.

**The exercise sheet.** Your instructor can give you a sheet for each exercise: its objective, the
briefing, every item the simulator marks with its limit and points, what the instructor will look
for and the standard for each item. It is the same list as "How you will be assessed" on the screen.

**Exercise 33, tidal streams.** Read diamond A from the tidal stream table for the hour (HW−3) and for
springs, work the course to steer that makes good the track to the fairway buoy across the stream, and
the height of tide by the rule of twelfths (1, 2, 3, 3, 2, 1 twelfths of the range in the six hours of the
rise). The stream changes as you go: after about 25 minutes find it again from own ship's data (HDG and
STW against COG and SOG) and correct the course.

**Exercise 32, a ship that keeps coming.** Ship K crosses from starboard and you give way. Her officer
is not keeping a proper look-out: after your action she edges back towards you. Keep watching her CPA
and vector after you act. When she comes back, sound five short blasts (VHF/SIGNAL, 5 SHORT) and act
again, boldly: a larger alteration, or slow down or stop.

**The robot student.** Your instructor may show an exercise worked by a robot student on a display
opened as `radar-simulator.html#demo`: a yellow pointer marked ROBOT works the controls, and the bar at
the foot of the screen says what it is doing and why. At level 5 it does everything the briefing asks;
at lower levels it makes mistakes on purpose, and each one is written in its log so that you can see
what it cost in the result.

## 10. Limits of this simulator

- The marking tolerances are placeholders until your academy sets its own.
- Ship and target figures are estimates, except where the SHIP menu names a published source. The
  ship's response to the sea is an estimate.
- The radar picture is simplified compared with a real set. Beamwidths and pulse lengths are those
  of one maker's set, taken as typical.
- Multiple, side-lobe and indirect echoes of a strong ship close by can be acquired by the ARPA as
  on a real one (since 18 Nov 2026), and interference from another radar disturbs tracking unless
  interference rejection is on. Mirror images in a quay or bridge and the echo of a power line are
  seen on the picture but still cannot be acquired.
- There are no charts: the route, the separation scheme, the charted coastline and the area map are
  lines drawn on the radar, as a radar map is. The ship never grounds.
- Positions are not on a real chart. Four scenarios use a real coastline (OpenStreetMap data, about
  250 m accuracy), real land heights (Copernicus DEM, 90 m), approximate depths (ETOPO 2022, about
  450 m cells, no tide) and the buoys, beacons and lights mapped in OpenStreetMap (none are mapped in
  the Gulf of Kutch); the others use invented coasts. How strongly land returns is set by one figure that an instructor
  should check against a real set (see RADAR-PICTURE.md).
