# ROC / ARPA radar simulator: user manual for learners

For training and study only. This is not a radar and must not be used for navigation.

## 1. Starting

Open `radar-simulator.html` in Chrome or Edge. Choose your batch and enter your name, or press
"Free practice without names". Press F11 for full screen.

The screen has the radar picture in the middle, as large as the window allows, with three data
panels down each side of it, laid out the way ships' radars in general present their data (it is
not a copy of any one maker's screen):

| Left | Right |
|---|---|
| PICTURE: range, rings, band, AIS, mode, pulse length (top) | OWN SHIP (top) |
| GAIN / CLUTTER, brilliance and trails (middle) | TARGET DATA of the selected target (middle) |
| EBL / CURSOR, and the PI / MAP key (bottom) | VRM / ARPA: VRMs, vectors, alarms, target keys and MENU (bottom) |

Nothing is written on the picture itself. The **MENU** key at the bottom right opens the menu over
the right-hand side of the screen, with its keys along the bottom; **CLOSE**, MENU again or Esc
closes it. The strip at the very top of the page holds the keys
that work the simulator and not the radar: PAUSE / RUN, the speed of the clock, DAY / NIGHT and
HELP. HELP shows a short explanation under every control; press it again to hide them.

## 2. RADAR key, alarms and own ship

| Control | What it does |
|---|---|
| RADAR key (top left, in the heading of the PICTURE panel) | Switches the radar on from cold (RADAR: OFF), and between standby and transmit. Switched on from cold it warms up first (WARM UP and a countdown; about one and a half minutes here, never more than 4 minutes on a real set), then waits in STANDBY: press again to transmit. In standby there is no picture. SETTINGS, RADAR POWER OFF switches it off. |
| ALARM ACK (VRM / ARPA panel, bottom right) | Acknowledges the alert shown beside it, one at a time: alarms first, then the oldest warning. It flashes while an alert is waiting. The alert box beside it is red for an alarm, orange for a warning and yellow for a caution. |
| PAUSE / RUN, 1x-10x (top strip) | Stops and starts the exercise clock, and sets how fast it runs. |
| DAY / NIGHT (top strip) | Display colours for day or for a dark bridge (also under SETTINGS). |

Own ship's data is in the OWN SHIP panel at the top right:

| Shown | Meaning |
|---|---|
| HDG, with GYRO | Heading from the gyro compass |
| STW, with LOG | Speed through the water from the speed log |
| COG, SOG, with EPFS | Course and speed over the ground from the position-fixing system (GPS) |
| LAT, LON | Own ship's position |
| RUD, ROT, STEER | Rudder angle (P port, S starboard), rate of turn, and AUTO (autopilot) or HAND steering |
| WIND | Relative wind (R045 is 45° on the starboard bow) |
| TIME (in the heading of the panel) | The exercise clock |

The small box after a value names the sensor it comes from. It turns red when that sensor has failed.

Own ship on the picture is drawn as on a radar: the heading line with a short beam line across it
at the ship's position, and on the shortest range scales the ship's outline to scale. The bearing
scale round the picture has a mark every 5° and a number every 30°.

If the gyro compass fails, the picture changes by itself to head-up (unstabilised) with relative
motion, "HDG FAIL: UNSTAB, REL BRG ONLY" is shown in the PICTURE panel, and the EBLs read relative
bearings only. That is what a real radar does when it loses its heading input.

The settings are not written over the picture but kept in the panels beside it: the PICTURE panel
shows the range scale, ring interval, band, orientation, motion and stabilisation, and the pulse
length in use (SP short, MP medium, LP long); the VRM / ARPA panel shows the vector mode and time,
the CPA / TCPA limits, the past positions setting, and the ARPA's status lines (its stabilisation
and speed input, ARPA STANDBY, LOST TGT WARNING OFF, AIS FILTER, ANCHOR WATCH, TRIAL).

## 3. PICTURE panel (top left)

The settings are boxes that are clicked; each shows the setting in use by its standard abbreviation.

- **RANGE − / +**: range scale, 0.25 to 96 NM. **RINGS**: fixed range rings on or off.
- **X BAND / S BAND**: the 3 cm or 10 cm radar. S band sees through rain better; X band gives a
  sharper picture and is the only band a SART answers. **AIS ON / OFF** beside them shows or hides
  the AIS targets.
- **MODE**, three boxes: orientation **N UP** (north-up), **H UP** (head-up, unstabilised: bearings
  are relative) or **C UP** (course-up); motion **RM** (relative motion, own ship fixed) or **TM**
  (true motion, own ship moves across the screen); stabilisation of the picture **GND** (ground) or
  **SEA**.
- **RESET**: **C-UP RST** takes the present heading as the new course-up reference; **TM RST** puts own ship
  back to the start of its run across the screen in true motion.
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

## 5. GAIN / CLUTTER panel (middle left)

Each control is a bar: click or drag along it. The figure beside it is the setting, 0 to 100.

- **GAIN**: receiver gain. Too low loses weak echoes; too high fills the picture with noise.
- **SEA**: sea clutter control. It works close to the ship. Too much removes small targets nearby.
  Sea clutter reaches further on the side the wind and sea come from (to windward) than on the
  other side. A shorter pulse length (under **RADAR**) returns less clutter.
- **RAIN**: rain clutter control. Too much weakens all echoes.
- **TUNE**: tune for the highest METER reading.
- **AUTO**: the set chooses the setting. Like a real automatic control it is a compromise.
- **BRILL**: brightness of the radar picture.
- **TRAILS**: echo trails OFF, REL (relative) or TRUE, and their length.

The small letters in the heading of the box light up when a signal processing function is in use:
IR (interference rejection), ENH (echo stretch), SC/SC (echo averaging from scan to scan), MON
(performance monitor). Switch them under **RADAR**.

More under **RADAR**: pulse length, echo stretch, echo averaging, interference rejection,
performance monitor.

## 6. ARPA: tracking targets

The target keys are in the VRM / ARPA panel at the bottom right, under ALARM ACK and the alert box.
The same panel has **VECTOR** (REL or TRUE vectors of tracked targets, and the vector time) and
**DANGER** (PPC, points of possible collision, or PAD, predicted areas of danger).

1. Press **Acquire**, then click an echo. A broken circle appears.
2. After about one minute a faint (preliminary) vector appears. After about three minutes the
   vector is at full strength and the data is reliable.
3. Press **Select** and click a target to see its data in the TARGET DATA panel (middle right): target number,
   bearing (BRG), range (RNG), course (CSE), speed (SPD), CPA, TCPA, and the bow crossing range
   and time (BCR, BCT), each with its unit. The course and speed are named CTW and STW (through
   the water) when the ARPA is sea stabilised, and COG and SOG (over the ground) when it is ground
   stabilised. TT after the heading means a tracked (radar) target, AIS an AIS target; for an AIS
   target the box also shows its MMSI, navigational status, reported position and heading, and
   MISSING for anything its report does not carry. A yellow ? after a value means it is still preliminary. The VRM / ARPA
   panel shows the CPA and TCPA limits, the past positions setting and the ARPA's speed input.
4. **Cancel** drops one target; **Cancel all** drops them all. **Auto** acquires targets that
   enter a guard zone.

A target inside both the CPA limit and the TCPA limit is DANGEROUS: its symbol turns red and bold
and an alarm sounds. Limits are set under **CPA/ALARM**.

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
| CAUTION | The tracker is nearly full (19 of 20 targets) | Yellow, steady | None; nothing to acknowledge |

Alerts are acknowledged one at a time. Under **CPA/ALARM**, "Silence sound 30 s" stops the sound
without acknowledging anything, and the lost target warning for tracked targets can be switched
off ("LOST TGT WARNING OFF" is then shown in the VRM / ARPA panel, and a lost target's symbol goes after
a minute).

Other ARPA keys: **PAST POS** (past positions), **GUARD** (guard zones and exclusion areas),
**TRIAL** (trial manoeuvre with delay), **TGT LIST** (all tracked targets), **AIS LIST**
(AIS targets), **ARPA** (standby, self-test, speed input: log, bottom track, GNSS or manual).

Three more ARPA aids:

- **Trial alarm.** While the trial manoeuvre is on, a warning names each target that the manoeuvre
  being tried would not clear by the CPA and TCPA limits. Change the trial until it goes.
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

Press **SHIP**.

- **Ship**: choose the ship type. Large ships turn and stop slowly. Three types are fitted to
  published turning figures (the 230 m container ship to model tests of the KCS benchmark hull, the
  350 m VLCC to a classification society's sample ship, the 105 m training ship to a sea-trial
  turning circle); the others are estimates. Press HELP to see which.
- **In a sea** the ship rolls, pitches and yaws (the SHIP page shows ROLL and PITCH). The sea comes
  from the direction of the wind. Heavy rolling in a beam sea tips the radar beam, so echoes abeam
  fade and come back; yawing smears a head-up picture, which is why north-up or course-up is used
  in a seaway.
- **AUTOPILOT**: set the course; the ship steers to it.
- **HAND STEERING**: press a rudder angle in the Hand steering box. Minus is port, plus is
  starboard; the − and + keys change it by 1°. The rudder takes time to move: the bar under the
  keys shows where it is. Put it back to 0 to stop the turn.
- **Telegraph keys**: engine orders from full astern to sea full. The ship gains and loses speed
  slowly.
- **LET GO ANCHOR**: anchors the ship where she is. It works only when she is making less than
  1 kn over the ground: take the way off first, with the engine astern if need be. At anchor the
  engine is stopped, the AIS sends "At anchor" and the key reads **WEIGH ANCHOR**. The anchor can
  drag (an instructor's fault, or in exercise 24): the ARPA's anchor watch on a fixed echo then gives
  its alarm.
- **If the GNSS (EPFS) fails** there is no position anywhere: the position reads NO FIX, the cursor
  gives no latitude and longitude, COG and SOG are blank, and the ARPA warns EPFS INPUT ABSENT. Fix
  the position by radar (exercise 23).

The OWN SHIP panel always shows heading, speed, course and speed made good, rudder, rate of turn
and relative wind.

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
  with a NEW AIS TARGET warning. At most 20 targets can be activated (a caution at 19). An activated
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
- **SETTINGS**: day or night display; telemotor 2 (faster rudder); own ship data.
- **ROC EX**: radar observer exercises (plotting, position fixing, set and drift, clearing range,
  blind pilotage, traffic).
- **ARPA EX**: ARPA exercises 1-9, radar exercises 10-11, manual plotting exercises 12-21, switching on and
  setting up 22, and radar exercises 23-26 on the real coasts (Mumbai, Goa, Kochi, Gulf of Kutch).
- **INSTR**: instructor pages (PIN needed).

- **SETTINGS**, User setting 1 and 2: Store keeps the present settings of the radar and ARPA
  controls; Recall puts them back (each asks you to confirm).

## 9. Doing an exercise

1. Press ARPA EX (or ROC EX) and choose the exercise. Read the briefing.
2. Press Run. Do what the briefing asks.
3. Type your answers where asked. A number is marked against the true value at the moment you
   enter it.
4. Press Finish. The result shows each item, your answer, the correct answer and the debrief
   questions.

For the manual plotting exercises the ARPA is off: take ranges and bearings with EBL 1 and
VRM 1 at regular times, plot them on a plotting sheet, and manoeuvre at 12 minutes.

The ROC plotting exercise asks for the full report of the plot: relative course and speed, true
course and speed, CPA, TCPA and the target's **aspect**. Aspect is the angle between the target's
course and the line from the target to your ship, as seen from the target: **Red** when your ship
is on its port side, **Green** when on its starboard side, from 0° (you are right ahead of it) to
180° (right astern). A target steering 270° that bears 050° from you has you bearing 230° from
it, 40° to the left of its course: Red 40°.

## 10. Limits of this simulator

- The marking tolerances are placeholders until your academy sets its own.
- Ship and target figures are estimates, except where the SHIP page names a published source. The
  ship's response to the sea is an estimate.
- The radar picture is simplified compared with a real set. Beamwidths and pulse lengths are those
  of one maker's set, taken as typical.
- False echoes can be seen but the ARPA cannot acquire them; on a real ARPA they can be acquired.
- Positions are not on a real chart. Four scenarios use a real coastline (OpenStreetMap data, about
  250 m accuracy) and real land heights (Copernicus DEM, 90 m) with no depths, lights or buoys; the
  others use invented coasts. How strongly land returns is set by one figure that an instructor
  should check against a real set (see RADAR-PICTURE.md).
