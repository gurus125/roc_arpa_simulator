# ROC / ARPA radar simulator: user manual for learners

For training and study only. This is not a radar and must not be used for navigation.

## 1. Starting

Open `radar-simulator.html` in Chrome or Edge. Choose your batch and enter your name, or press
"Free practice without names". Press F11 for full screen.

The screen has the radar picture on the left and the control panel on the right. The keys at the
bottom right open more controls. HELP (next to Pause) shows a short explanation under every
control; press it again to hide them.

## 2. Top of the panel

| Control | What it does |
|---|---|
| RADAR: ON / STANDBY | Switches the transmitter on or to standby. In standby there is no picture. |
| ALARM ACK | Acknowledges the alert shown beside it, one at a time: alarms first, then the oldest warning. It flashes while an alert is waiting. |
| Pause / Run, 1x-10x | Stops and starts the exercise clock, and sets how fast it runs. |
| DAY / NIGHT | Display colours for day or for a dark bridge (also under SETTINGS). |

## 3. DISPLAY box

- **RANGE − / +**: range scale, 0.25 to 96 NM. **RINGS**: fixed range rings on or off.
- **X BAND / S BAND**: the 3 cm or 10 cm radar. S band sees through rain better; X band gives a
  sharper picture and is the only band a SART answers.
- **ORIENT**: north-up, head-up (unstabilised: bearings are relative) or course-up.
- **MOTION**: relative motion (own ship fixed) or true motion (own ship moves across the screen).
- **STAB**: ground or sea stabilisation of the picture.
- **TRAILS**: echo trails, relative or true, and their length.
- **VECTORS**: relative or true vectors of tracked targets, and the vector time.
- **DANGER**: PPC (potential point of collision) or PAD (predicted area of danger) graphics.

## 4. Measuring: EBL and VRM (bottom-left of the picture)

Tick EBL 1 or VRM 1. The line follows the cursor over the picture and shows MOVE. Double-click
the picture to lock it (LOCK). Untick and tick again to move it. EBL 2 and VRM 2 work the same
way. The CURSOR box shows the range and bearing of the cursor at all times.

More tools are under **PI / MAP**: four parallel index lines, an offset EBL origin, off-centre,
heading line off, navigation lines and marks.

## 5. GAIN / CLUTTER box

- **GAIN**: receiver gain. Too low loses weak echoes; too high fills the picture with noise.
- **SEA**: sea clutter control. It works close to the ship. Too much removes small targets nearby.
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
3. Press **Select** and click a target to see its data in the TARGET DATA box: bearing, range,
   CPA, TCPA, course, speed, BCR and BCT.
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
- **WEATHER**: sea state, rain, abnormal propagation, interference, wind, current and tide.
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

## 10. Limits of this simulator

- The marking tolerances are placeholders until your academy sets its own.
- Ship and target figures are estimates, except where the SHIP page names a published source. The
  ship's response to the sea is an estimate.
- The radar picture is simplified compared with a real set. Beamwidths and pulse lengths are those
  of one maker's set, taken as typical.
- False echoes can be seen but the ARPA cannot acquire them; on a real ARPA they can be acquired.
- Positions are not on a real chart. One scenario uses a real coastline (OpenStreetMap data, about
  250 m accuracy) with no depths, lights or buoys; the others use invented coasts.
