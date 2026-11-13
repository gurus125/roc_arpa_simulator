# ROC / ARPA radar simulator: user manual for learners

For training and study only. This is not a radar and must not be used for navigation.

## 1. Starting

Open `radar-simulator.html` in Chrome or Edge. Choose your batch and enter your name, or press
"Free practice without names". Press F11 for full screen.

The screen has the radar picture on the left and the data area on the right, laid out the way
ships' radars in general present their data (it is not a copy of any one maker's screen). The
keys at the bottom right open more controls. The strip at the very top of the page holds the keys
that work the simulator and not the radar: PAUSE / RUN, the speed of the clock, DAY / NIGHT and
HELP. HELP shows a short explanation under every control; press it again to hide them.

## 2. Top of the data area, and the corners of the picture

| Control | What it does |
|---|---|
| RADAR: ON / STANDBY | Switches the transmitter on or to standby. In standby there is no picture. |
| ALARM ACK | Acknowledges the alert shown beside it, one at a time: alarms first, then the oldest warning. It flashes while an alert is waiting. The alert box beside it is red for an alarm and amber for a warning. |
| PAUSE / RUN, 1x-10x (top strip) | Stops and starts the exercise clock, and sets how fast it runs. |
| DAY / NIGHT (top strip) | Display colours for day or for a dark bridge (also under SETTINGS). |

Own ship's data is under the top keys:

| Shown | Meaning |
|---|---|
| HDG, with GYRO | Heading from the gyro compass |
| STW, with LOG | Speed through the water from the speed log |
| COG, SOG, with EPFS | Course and speed over the ground from the position-fixing system (GPS) |
| LAT, LON | Own ship's position |
| RUD, ROT, STEER | Rudder angle (P port, S starboard), rate of turn, and AUTO (autopilot) or HAND steering |
| WIND, TIME | Relative wind (R045 is 45° on the starboard bow) and the exercise clock |

The small box after a value names the sensor it comes from. It turns red when that sensor has failed.

The corners of the picture carry the settings in short lines, as on a radar screen: top left the
range scale in large figures, the ring interval, the orientation and motion (N UP RM) and the
stabilisation of the picture; top right the band and pulse length (SP short, MP medium, LP long)
and the ARPA's vector mode and time, speed input and CPA / TCPA limits.

## 3. DISPLAY box

The settings are boxes that are clicked; each shows the setting in use by its standard abbreviation.

- **RANGE − / +**: range scale, 0.25 to 96 NM. **RINGS**: fixed range rings on or off.
- **X BAND / S BAND**: the 3 cm or 10 cm radar. S band sees through rain better; X band gives a
  sharper picture and is the only band a SART answers.
- **MODE**, three boxes: orientation **N UP** (north-up), **H UP** (head-up, unstabilised: bearings
  are relative) or **C UP** (course-up); motion **RM** (relative motion, own ship fixed) or **TM**
  (true motion, own ship moves across the screen); stabilisation of the picture **GND** (ground) or
  **SEA**.
- **TRAILS**: echo trails OFF, REL (relative) or TRUE, and their length.
- **VECTOR**: REL (relative) or TRUE vectors of tracked targets, and the vector time.
- **DANGER**: PPC (points of possible collision) or PAD (predicted areas of danger) graphics.
  **C-UP RST** takes the present heading as the new course-up reference; **TM RST** puts own ship
  back to the start of its run across the screen in true motion.

## 4. Measuring: EBL and VRM (bottom-left of the picture)

Tick EBL 1 or VRM 1. The line follows the cursor over the picture and shows MOVE. Double-click
the picture to lock it (LOCK). Untick and tick again to move it. EBL 2 and VRM 2 work the same
way. The CURSOR box shows the true bearing (BRG), relative bearing (REL) and range (RNG) of the
cursor at all times, and under them the latitude and longitude of the point it is on.

More tools are under **PI / MAP**: four parallel index lines, an offset EBL origin, off-centre,
heading line off, navigation lines and marks.

## 5. GAIN / CLUTTER box

Each control is a bar: click or drag along it. The figure beside it is the setting, 0 to 100.

- **GAIN**: receiver gain. Too low loses weak echoes; too high fills the picture with noise.
- **SEA**: sea clutter control. It works close to the ship. Too much removes small targets nearby.
  Sea clutter reaches further on the side the wind and sea come from (to windward) than on the
  other side. A shorter pulse length (under **RADAR**) returns less clutter.
- **RAIN**: rain clutter control. Too much weakens all echoes.
- **TUNE**: tune for the highest METER reading.
- **AUTO**: the set chooses the setting. Like a real automatic control it is a compromise.

More under **RADAR**: pulse length, echo stretch, echo averaging, interference rejection,
performance monitor.

## 6. ARPA: tracking targets

The target keys are along the bottom-left edge of the picture.

1. Press **Acquire**, then click an echo. A broken circle appears.
2. After about one minute a faint (preliminary) vector appears. After about three minutes the
   vector is at full strength and the data is reliable.
3. Press **Select** and click a target to see its data in the TARGET DATA box: target number,
   bearing (BRG), range (RNG), course (CSE), speed (SPD), CPA, TCPA, and the bow crossing range
   and time (BCR, BCT), each with its unit. TT after the heading means a tracked (radar) target,
   AIS an AIS target. A yellow ? after a value means it is still preliminary. The line under the
   data shows the CPA and TCPA limits, the ARPA's speed input and the past positions setting.
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

Alerts (after IMO resolution MSC.302(87)): an ALARM (a dangerous target) sounds until it is
acknowledged and stays shown until the danger has gone. A WARNING (lost target, new target, guard
zone, input failure and the rest) gives one short signal, flashes until acknowledged and is
announced again every 5 minutes if it is left. Alerts are acknowledged one at a time. Under
**CPA/ALARM**, "Silence sound 30 s" stops the sound without acknowledging anything.

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

The OWN SHIP box always shows heading, speed, course and speed made good, rudder, rate of turn
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
- **SCENARIO**: free-practice scenarios (one has 100 ships at once; one is on the real coastline
  of the approaches to Mumbai); show target names (a study aid).
- **SETTINGS**: day or night display; telemotor 2 (faster rudder); own ship data.
- **ROC EX**: radar observer exercises (plotting, position fixing, set and drift, clearing range,
  blind pilotage, traffic).
- **ARPA EX**: ARPA exercises 1-9, radar exercises 10-11, manual plotting exercises 12-21.
- **INSTR**: instructor pages (PIN needed).

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
- Positions are not on a real chart. One scenario uses a real coastline (OpenStreetMap data, about
  250 m accuracy) with no depths, lights or buoys; the others use invented coasts.
