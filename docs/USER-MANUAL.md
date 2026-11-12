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
| ALARM ACK | Acknowledges all alarms. It flashes red while an alarm is waiting; the alarm text is beside it. |
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
2. After about one minute a broken (preliminary) vector appears. After about three minutes the
   vector is steady and the data is reliable.
3. Press **Select** and click a target to see its data in the TARGET DATA box: bearing, range,
   CPA, TCPA, course, speed, BCR and BCT.
4. **Cancel** drops one target; **Cancel all** drops them all. **Auto** acquires targets that
   enter a guard zone.

A target inside both the CPA limit and the TCPA limit is DANGEROUS: its symbol turns red and an
alarm sounds. Limits are set under **CPA/ALARM**.

Other ARPA keys: **PAST POS** (past positions), **GUARD** (guard zones and exclusion areas),
**TRIAL** (trial manoeuvre with delay), **TGT LIST** (all tracked targets), **AIS LIST**
(AIS targets), **ARPA** (standby, self-test, speed input: log, bottom track, GNSS or manual).

Remember what the ARPA cannot do: it needs time after acquisition and after a target alters;
it can lose a weak target and can swap two close targets; with a wrong gyro or log input the
true data is wrong while CPA and TCPA stay correct.

## 7. Own ship

Press **SHIP**.

- **Ship**: choose the ship type. Large ships turn and stop slowly.
- **AUTOPILOT**: set the course; the ship steers to it.
- **HAND STEERING**: press a rudder angle in the Hand steering box. Minus is port, plus is
  starboard; the − and + keys change it by 1°. The rudder takes time to move: the bar under the
  keys shows where it is. Put it back to 0 to stop the turn.
- **Telegraph keys**: engine orders from full astern to sea full. The ship gains and loses speed
  slowly.

The OWN SHIP box always shows heading, speed, course and speed made good, rudder, rate of turn
and relative wind.

## 8. Other keys

- **VHF/SIGNAL**: typed VHF messages to the instructor and other stations; whistle signals of the
  collision regulations, and an automatic fog signal.
- **WEATHER**: sea state, rain, abnormal propagation, interference, wind, current and tide.
- **SCENARIO**: free-practice scenarios; show target names (a study aid).
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
- Ship and target figures are typical values, not data of real ships.
- The radar picture is simplified compared with a real set.
- Positions are not on a real chart.
