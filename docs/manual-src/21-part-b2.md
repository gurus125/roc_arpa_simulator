# Alerts {#alerts}

<p class="lead">The radar draws attention to what matters with alerts of three priorities. Each is shown and sounded in its own way, and each is acknowledged one at a time.</p>

## The three priorities {#alerts-priorities}

@cols 13 29 34 24
| Priority | When | Shown | Sound |
|---|---|---|---|
| **ALARM** | A dangerous target: CPA and TCPA inside the limits, for a tracked target or an AIS target | Red, flashing until acknowledged, then steady until the danger has gone | Three short signals, repeated every 8 seconds until acknowledged |
| **WARNING** | A lost target, a new target in a guard zone, capacity exceeded, a sensor failure, and the rest of the list below | Orange, flashing until acknowledged | Two short signals; again every 5 minutes if left unacknowledged |
| **CAUTION** | The tracker or the AIS display is nearly full (38 of 40) | Yellow, steady | None. Nothing to acknowledge |

## Where alerts are shown {#alerts-where}

- **In the header:** a green light and `No Alarms`, or the number waiting: `3 ALARM` in red, or a count of warnings in orange.
- **In the VRM / ARPA panel:** the alert box beside [[ALARM ACK]] shows the alert that is next to be acknowledged, and how many there are ({fig:panel-arpa-alarm}). The box is red for an alarm, orange for a warning and yellow for a caution. [[ALARM ACK]] flashes while an alert is waiting.
- **On the picture:** the target itself turns red (dangerous) or orange with a cross (lost) and flashes.
- **Under [[MENU]], [[CPA/ALARM]]:** the list of all alerts with their times.

@fig panel-arpa-alarm | 42 | The VRM / ARPA panel with alerts waiting: the alert box names the first, ALARM ACK is lit.

## Acknowledging {#alerts-ack}

[[ALARM ACK]] (or the space bar) acknowledges the alert shown, one at a time: alarms first, then the oldest warning. Acknowledging stops the flashing and the sound of that alert. It does not remove the danger: an acknowledged alarm stays shown, steady, until its cause has gone.

Under [[MENU]], [[CPA/ALARM]]:

- [[Acknowledge next]] is the same as ALARM ACK.
- [[Silence sound 30 s]] stops all sound for 30 seconds without acknowledging anything. An alarm then sounds again.
- **Lost target warning (tracked targets)**: unticked, a lost tracked target gives no warning; `LOST TGT WARNING OFF` is then shown in the VRM / ARPA panel, and a lost target's symbol goes after a minute.

Understand an alert before acknowledging it. An instructor watching the display is told when an alert has been left unacknowledged for a minute, and how the trainees deal with alerts is one of the things observed.

## Every alert, and what to do {#alerts-list}

@cols 34 12 54
| The alert says | Priority | What it means and what to do |
|---|---|---|
| `DANGEROUS TARGET 2: CPA 0.07 NM in 19.1 min.` | Alarm | The target will pass inside the CPA limit within the TCPA limit. Select it, read its data, check it against the radar, decide and act |
| A dangerous AIS target, by name | Alarm | The same for an AIS target. It is activated by itself |
| `Target 3 LOST.` | Warning | The ARPA has had no echo of the target for six turns of the aerial. Look for the echo: check gain and clutter; acquire it again if it is still there |
| `New target 5 acquired in guard zone.` | Warning | Automatic acquisition has taken a new target. Look at what it is |
| `Echo entering guard zone.` | Warning | An echo has entered a guard zone while automatic acquisition is off. Acquire it by hand if it matters |
| `Track capacity full (40). New target not acquired.` | Warning | Cancel targets that no longer matter |
| `Target capacity nearly full: 38 of 40 tracked.` | Caution | The same, before it is full |
| `Target 4 has changed course or speed.` | Warning | The ARPA has noticed a manoeuvre. Its data is unreliable until the track has settled again |
| `POOR GROUND REFERENCE: sea stabilisation will be used unless the reference is restored.` | Warning | The fixed target chosen for ground stabilisation is fading or lost. Choose another, or go back to sea stabilisation |
| `TRIAL: target 2 would pass inside the limits (CPA ... NM in ... min).` | Warning | The manoeuvre being tried would not clear this target. Change the trial |
| `TIME TO MANOEUVRE: 1 minute to the trial manoeuvre.` | Warning | The delay of the trial has one minute left |
| `TIME FOR ACTION: the trial manoeuvre delay has elapsed. Trial is still on.` | Warning | Make the manoeuvre, and switch the trial off |
| `WRONG ORDER: ...` | Warning | A control was used that cannot work as things are; the text says why |
| `ANCHOR WATCH: target 1 has moved 0.21 NM from its marked position.` | Warning | Own ship, or the mark, is dragging. Check the position by radar at once |
| `ANCHOR WATCH: target 1 is no longer tracked.` | Warning | The anchor watch is not working. Acquire a mark and set it again |
| `EQUIPMENT MALFUNCTION: gyro compass failure. ARPA data not valid.` | Warning | The gyro has failed. All tracks are lost and the picture is unstabilised ({ref:failures}) |
| `SPEED LOG INPUT ABSENT: ...` | Warning | The log has failed. True vectors and true courses and speeds are not valid; relative data, CPA and TCPA remain valid |
| `EPFS INPUT ABSENT: ...` | Warning | No position from the GNSS. Fix the position by radar |
| `RADAR SIGNAL LOST: VIDEO.` (or SYNC, AZIMUTH, HEADING MARKER) | Warning | No radar picture. Tracked targets will be lost; AIS targets are still shown |
| `PICTURE FREEZE: the radar picture is not being updated. Do not use it.` | Warning | The echoes on the screen are old |
| `NEW AIS TARGET ... activated in the acquisition zone.` | Warning | An AIS target has been activated by automatic acquisition |
| `AIS TARGET ... LOST (no report for ... s).` | Warning | An activated AIS target's reports have stopped. The ship may still be there: look for her echo |
| `AIS capacity exceeded: 40 targets are activated already. Put one to sleep first.` | Warning | Put an activated target back to sleep |
| `AIS capacity nearly full: ...` | Caution | 38 of 40 activated, or the display is close to 240 targets in all |

# Own ship {#own-ship}

<p class="lead">The trainee is the officer of the watch of own ship: he or she steers her, works the engine, anchors, and answers for where she goes. The controls are in the ship control window, or under SHIP in the menu when that window is not open.</p>

## The ship control window {#ship-window}

Press [[SHIP CONTROL]] in the header. A second window opens, made for a second screen ({fig:shipwin}). How to place it is in {ref:two-screens}.

@fig shipwin | 90 | The ship control window: steering, engine telegraph, anchor and MOB on the left; the exercise on the right.

@cols 24 76
| Box | What is in it |
|---|---|
| STEERING | [[AUTOPILOT]] or [[HAND STEERING]]; [[PUMP 2]] (the second steering gear pump); SET COURSE in large figures with keys [[−10]], [[−1]], [[+1]] and [[+10]] and a bar to drag; heading and rate of turn; the rudder indicator, which shows where the rudder is and what is ordered; the rudder keys for hand steering |
| ENGINE TELEGRAPH | The telegraph from [[FULL AST]] to [[SEA FULL]]; the engine order in knots with [[−]] and [[+]]; STW, SOG, COG and the relative wind; under ANCHOR AND MOB the keys [[LET GO ANCHOR]] and [[MOB]] |
| OWN SHIP DATA | Name, call sign, MMSI, IMO number, type and size; and the choice of ship |
| EXERCISE | The ARPA and radar exercises and the ROC exercises (the keys at the top of the box change between them): choose the exercise, read the briefing and how you will be assessed, answer, and press Finish. The result appears there. While an exercise runs, CHOOSE EXERCISE shows the list again |

While the window is open, the keys SHIP, ROC EX and ARPA EX of the menu and the EXERCISE tab on the radar screen bring it forward. Close the window and its controls go back into the menu of the radar screen.

## The ship {#own-ship-type}

[[MENU]], [[SHIP]], Ship (or the OWN SHIP DATA box of the ship control window) chooses what kind of ship own ship is. A large ship turns and stops slowly, and that changes every exercise.

@cols 44 56
| Ship | Her handling in the simulator |
|---|---|
| Container ship, 230 m (KCS benchmark hull) | Fitted to published model tests of a benchmark hull |
| VLCC, loaded, 350 m (published sample ship) | Fitted to a classification society's published sample ship |
| Training ship, 105 m (sea-trial turning circle) | Fitted to a published sea-trial turning circle |
| Bulk carrier, loaded, 225 m | An estimate |
| Product tanker, 180 m | An estimate |
| Coaster, 90 m | An estimate |
| Exercise ship (30°/min, 3 kn/min) | No ship model: she turns at 30° a minute and changes speed at 3 knots a minute, and is not moved by the sea. The manual plotting exercises use her, so that a plotted manoeuvre can be checked by hand |

Press [[?]] to see on the screen which figures are published and which are estimates. An exercise chooses its own ship when it starts.

## Steering {#own-ship-steering}

- **Autopilot.** Press [[AUTOPILOT]] and set the course: drag the bar, or use the course keys of the ship control window. The ship steers to it with up to 20° of rudder.
- **Hand steering.** Press [[HAND STEERING]], then a rudder angle: [[-35]] to [[+35]] in steps of 5. Minus is port, plus is starboard. The [[−]] and [[+]] keys at the ends change the order by 1°. The rudder takes time to move: the bar under the keys shows where it is. The ship keeps turning until the rudder is put back to [[0]].
- **The steering gear.** With one pump running (telemotor 1) the rudder takes 28 seconds from hard over to hard over. With the second running as well ([[PUMP 2]], or [[SETTINGS]], [[TELEMOTOR 2]]) it takes 18 seconds. Every new scenario starts on one.

OWN SHIP DATA always shows the heading, the rudder angle (`P` port, `S` starboard, `MID` amidships), the rate of turn and `AUTO` or `HAND` ({fig:panel-bOwn}).

@fig panel-bOwn | 42 | The OWN SHIP DATA panel. The box after a value names the sensor it comes from.

## The engine {#own-ship-engine}

The telegraph keys give the engine order: [[FULL AST]], [[HALF AST]], [[SLOW AST]], [[DS AST]], [[STOP]], [[D.SLOW]], [[SLOW]], [[HALF]], [[FULL]], [[SEA FULL]]. [[−]] and [[+]] beside Engine order change the ordered speed by a knot.

The ship gains and loses speed slowly, loses speed in a turn, and runs on a long way with the engine stopped. Allow for it: reduce speed in good time.

## In a sea {#own-ship-seaway}

With a sea running, a ship with a ship model rolls, pitches and yaws. SHIP and the ship control window show `ROLL` and `PITCH`. The sea comes from the direction of the wind (from the west if no wind is set).

- Heavy rolling in a beam sea tips the radar beam, so echoes abeam fade and come back.
- Yawing smears a head-up picture. That is why north-up or course-up is used in a seaway.

The sea does not slow the ship or set her; the wind gives her leeway, and the current and the tidal stream carry her.

## Anchoring {#anchor}

[[LET GO ANCHOR]] anchors the ship where she is. It works only when she is making less than 1 knot over the ground: take the way off first, with the engine astern if need be. At anchor the engine is stopped, own ship's AIS sends "At anchor", and the key reads [[WEIGH ANCHOR]].

The anchor can drag: in exercise 24 it does so by itself, and an instructor can make it. Set the ARPA's anchor watch on a fixed echo as soon as the ship is brought up ({ref:anchor-watch}).

## Man overboard {#mob}

[[MOB]] (beside the anchor key) marks the ship's position at that moment on the radar with a red mark fixed to the ground. The mark becomes the datum offered for a search pattern ({ref:search-pattern}).

- A person in the water gives no radar echo. The mark is all there is.
- The mark needs a position from the position-fixing system. If that has failed, a message says that no mark can be placed: note the time, heading and speed.

## When the position-fixing system fails {#own-ship-epfs}

If the GNSS (EPFS) fails there is no position anywhere: the position reads `NO FIX`, the cursor gives no latitude and longitude, COG and SOG are blank, own ship's AIS sends no position, and the ARPA warns `EPFS INPUT ABSENT`. Fix the position by radar. Exercise 23 starts this way.

## At the controls {#at-controls}

When two or more names are logged in at a display, [[MENU]], [[SHIP]] shows **At the controls**: choose who is working the radar, and change it when you change over.

It is written in the record so that each trainee can be assessed. Every answer, every action and the first alteration of course or speed carries the name of whoever was at the controls then, and the result shows it.

- In an examination the trainees take the controls in turn, one part each. The message at the start of each part says whose turn it is.
- The instructor can set a changeover time. The controls then pass to the next trainee each time that many minutes of the exercise have gone, with a message: `Change over: ... takes the controls now.`

# Weather, visibility and signals {#weather}

<p class="lead">The sea, the rain, the air and the current all change what the radar shows and where the ship goes. In free practice the trainee sets them; in a class the instructor does.</p>

## The WEATHER page {#weather-page}

[[MENU]], [[WEATHER]]. Every change acts at once.

@cols 32 68
| Control | Effect |
|---|---|
| Sea state | Sea clutter round the ship, more of it to windward; rolling, pitching and yawing of a ship with a ship model. A small target in the clutter that is weaker than the clutter round it is not shown at any setting of the controls |
| Rain squall near own ship, and Rain intensity (% of heavy) | A rain area. Its clutter fades with range, and the rain weakens every echo whose path crosses it, far more on X band than on S band. 100 is heavy rain (16 mm an hour), 25 light rain (4 mm an hour) |
| Abnormal propagation (ducting) | The beam is carried much further and brings second-trace echoes ({ref:second-trace}) |
| Refraction | `Standard atmosphere`; `Sub-refraction (shorter ranges)`: targets detected at about 80% of the usual range; `Super-refraction (longer ranges)`: at up to about 140% |
| Interference from another ship's radar | Spirals of dots over the picture, and false plots for the ARPA. Use interference rejection |
| Visibility (NM; blank = good) | See {ref:visibility} |
| Wind from (°), Wind speed (kn) | The relative wind readout, leeway, and the side the sea clutter is heavier on |
| Current set, Current drift (kn) | A steady current: it sets own ship and every ship with a ship type |
| Tidal stream: max rate, Flood runs towards (°), Hours after slack at start | A stream that changes with time, added to the steady current. It is zero at slack water, strongest about 3.1 hours later, slack again at 6.2 hours, and then runs the other way |

The line at the foot of the page, `Water movement now`, gives the set and rate of current and stream together at this moment.

!!! placeholder "Placeholder"
    The figures for how much rain weakens an echo and for the range of detection in each kind of refraction are this project's, to be checked by an instructor against experience.

## Visibility and the look-out {#visibility}

The simulator has no view from the bridge windows, so visibility is not something seen. It is a condition of the exercise, and you are told what the bridge would see.

When the visibility is restricted:

- OWN SHIP DATA shows `VIS` with the distance, for as long as one is set;
- the bridge reports each change in the orange box under the header: `BRIDGE: the visibility has closed to 0.5 NM. Rule 19 applies to vessels not in sight.`;
- the look-out reports each vessel as she comes into sight: `LOOKOUT: a vessel in sight, bearing 045° (Green 45), about 0.4 NM.` Green is on the starboard side and Red on the port side, counted from the bow. The look-out reports again when she is lost to sight ({fig:visibility}).

A vessel that has not been reported is not in sight. For her, rule 19 of the collision regulations applies, and the marking of your avoiding action follows it ({ref:marking-rule19}). Sound the fog signal ({ref:vhf}).

In free practice you can set a visibility yourself: [[MENU]], [[WEATHER]], Visibility. Leave it blank for good visibility.

@fig visibility | 100 | The visibility has closed to 5 NM: the bridge reports it, and the look-out reports the three vessels within it.

!!! placeholder "Placeholder"
    A vessel is taken to be in sight when her range is not more than the visibility. That leaves out her size, her lights, daylight and anything between. The look-out reports vessels only, not buoys, land or lights, and says nothing of a vessel's aspect. The radar picture does not change with the visibility.

## VHF and sound signals {#vhf}

[[MENU]], [[VHF/SIGNAL]].

**Communications (VHF, typed).** Type a message and press [[Send]]: it goes to the instructor and to the other displays, and theirs appear in the log above the box. There is no voice channel in this simulator. Every message is written in the exercise record.

**Sound signals.** The whistle signals of the collision regulations:

@cols 24 76
| Key | Meaning |
|---|---|
| [[1 SHORT]] | I am altering my course to starboard |
| [[2 SHORT]] | I am altering my course to port |
| [[3 SHORT]] | I am operating astern propulsion |
| [[5 SHORT]] | In doubt about your intentions or action |
| [[1 PROLONGED]] | Restricted visibility: a power-driven vessel making way |
| [[2 PROLONGED]] | Restricted visibility: under way but stopped |

**Automatic fog signal every 2 minutes** sounds the signal for restricted visibility by itself. A short blast is about one second and a prolonged blast four to six seconds. Each signal is written in the exercise record. If no fog signal is being sounded while the ship is under way in restricted visibility, the instructor is told.

# What the radar shows besides ships, and when equipment fails {#not-ships}

<p class="lead">A radar observer must know an echo that is not a ship when he or she sees one, and must know at once when the picture can no longer be trusted. The simulator shows both.</p>

## Sea and rain clutter {#clutter}

- **Sea clutter** is the amber speckle round the centre. It reaches further to windward, grows with the sea state, and is stronger with a longer pulse. The SEA control takes it off, and small targets with it.
- **Rain** paints a solid patch and weakens everything beyond it. On X band a small target inside rain may not be seen at all. Try S band, a shorter pulse, the RAIN control used lightly, and a shorter range scale.

A target weaker than the clutter round it cannot be brought out by any setting. It will show when it is closer, or clear of the clutter.

## Land as the radar sees it {#land}

In the four real areas the radar sees the land as it is: ray by ray, with the curve of the Earth and the land heights ({fig:goa-ppi}).

- Far off, only the high ground shows. The coast seems to come towards the ship as low land rises above the radar horizon. A low coast shows late.
- Hills cast radar shadow: what lies behind them is not painted.
- A ship behind an island or a headland disappears from the picture and from the ARPA until she comes out again.

So a radar picture does not look like the chart. Compare the two with the charted coastline ({ref:measuring-coast}).

@fig goa-ppi | 46 | The approaches to Mormugao on the 12 NM range scale: the land paints by the face it shows the radar, with shadow behind high ground.

## SART, racon and ramark {#sart}

The scenario "Search and rescue (SART and racon)" and exercise 11 show them ({fig:sar-ppi}).

- A **SART** (search and rescue transponder) answers an X-band radar with a line of 12 dots along one bearing. The survival craft is at the dot **nearest** own ship. Inside about 1 NM the dots widen into arcs and then rings. A SART does not answer S band. Heavy use of the rain clutter control can remove the dots.
- A **racon** answers with a flash that reads as a Morse letter, starting just beyond the beacon.
- A **ramark** paints a line along its bearing and gives no range.

@fig sar-ppi | 46 | A SART to the north-east: twelve dots along one bearing, the nearest at the survival craft.

## Second-trace echoes {#second-trace}

In abnormal propagation a very distant, very large target can return its echo after the next pulse has been sent. The radar then paints it at a false, short range on the right bearing. In the scenario "Second-trace echo (abnormal propagation)" a very large ship 29.5 NM away appears at about 2.5 NM with the short pulse.

The test: change the pulse length, and so the PRF. A second-trace echo moves or goes; a real echo stays.

## False echoes {#false-echoes}

The scenario "False echoes: power line, bridge and quay" shows all of these ({fig:false-ppi}):

- An **overhead power line** paints one echo, where the beam meets the cable at right angles. It stays on a steady bearing and closes, like a ship on a collision course.
- A **quay wall** or another large flat face mirrors a ship and paints a false one behind the wall.
- A strong ship close by is painted again in the funnel's shadow sector astern, at the same range: an **indirect echo**.
- Close to a **bridge**, the bridge is painted a second time beyond itself.
- A strong ship close by also gives **multiple echoes** (beyond her on the same bearing, at multiples of her range) and **side-lobe echoes** (on either side of her, at her range).

A false echo lies on land, in a shadow sector, or square to a cable, and it moves or vanishes when own ship alters course. The ARPA can acquire multiple, side-lobe and indirect echoes as a real one can. The study aid **Show blind sector astern** ([[MENU]], [[SCENARIO]]) draws the shadow sector of the funnel.

@fig false-ppi | 46 | A river with a power line and a bridge across it. The echo ahead on the heading line is the power line, not a vessel.

## When equipment fails {#failures}

The instructor can give the instruments faults without telling the trainees ({ref:faults}), and some exercises do it by themselves. This is what each looks like on the display.

@cols 28 72
| What has failed | What you see, and what to do |
|---|---|
| The gyro compass | The warning `EQUIPMENT MALFUNCTION: gyro compass failure`. The ARPA loses every track. The picture goes to head-up, unstabilised, relative motion, with `HDG FAIL: UNSTAB, REL BRG ONLY`; bearings are relative only. The `GYRO` box turns red |
| The speed log | `SPEED LOG INPUT ABSENT`. True vectors and true data are not valid. CPA and TCPA stay valid. Give the ARPA another speed input, or type one |
| The GNSS (EPFS) | `NO FIX`, no cursor position, COG and SOG blank, `EPFS INPUT ABSENT`. Fix by radar |
| One of the radar's own signals: video, sync, azimuth or heading marker | The warning `RADAR SIGNAL LOST` names it. The echoes fade and the picture reads `NO RADAR PICTURE`. The tracked targets are lost within a few turns of the aerial. The AIS targets are still shown, with their data, CPA and TCPA: use them, your position and a look-out until the radar is back. When it is, acquire the targets again |
| The picture stops being updated | `PICTURE FREEZE` is written across it, with a warning. The echoes on the screen are old and must not be used. The ARPA symbols and the AIS go on moving, away from the frozen echoes: that is the sign to notice |
| The anchor drags | Nothing says so. The anchor watch gives its warning once the mark has moved the set distance |

**Errors without any alarm.** A gyro that reads a few degrees wrong, a log that reads high or low, a heading marker painted off the ship's head, a VRM that reads wrong, a radar that has lost performance: none of these gives an alert. They are found only by checking:

- the heading against the course steered and against a bearing of a known object;
- the log against the speed expected and against the speed over the ground;
- the true vector of a fixed mark, which should be zero when ground stabilised;
- the VRM against the range rings;
- the performance monitor.

# Settings and the control panel {#settings}

<p class="lead">The gear at the top right, or SETTINGS in the menu, holds the things that are set once: the default state, two stored settings, the colours, own ship's particulars and the keys of a hardware panel.</p>

## Default settings {#settings-default}

[[SETTINGS]], [[DEFAULT SETTINGS]] puts the radar and ARPA controls, after a confirmation, to a known starting state:

X band · 6 NM · range rings off · one EBL and one VRM (0.25 NM) on · true motion, north-up, ground stabilised · trails of 6 minutes · relative vectors of 6 minutes · automatic acquisition off · AIS on · CPA limit 2 NM · TCPA limit 12 minutes.

Gain, clutter and tuning are left as they are. Use it when taking over a display from someone else.

## Stored user settings {#settings-user}

**User setting 1** and **User setting 2**: [[Store]] keeps the present settings of the radar and ARPA controls (range, band, presentation, trails, vectors, gain and clutter, pulse, processing, alarm limits, AIS) under that number on this computer. [[Recall]] puts them back. Both ask you to confirm.

## Own ship's data {#own-ship-data}

[[SETTINGS]], [[OWN SHIP DATA]]: the name, call sign, IMO number, MMSI, size and type; the draught, hazardous cargo, destination and ETA; and where the radar antenna is on the ship (metres ahead of and to starboard of the reference point). They are typed in, as on a ship's AIS, and kept on this computer. The position, COG, SOG, heading, rate of turn and UTC come from the simulation.

The starting values are placeholders, not a real ship. Except in the four real areas, the position is counted from a made-up starting point: the scenarios are not tied to a chart.

## The hardware control panel and the keyboard {#control-panel}

[[SETTINGS]], Control panel lists a key for every main radar function. They work from the ordinary keyboard, and a hardware panel that acts as a keyboard works the radar with them. The keys do nothing while you are typing in a box.

@cols 36 14 36 14
| Function | Key | Function | Key |
|---|---|---|---|
| Gain up / down | Q / A | EBL 1 on or off | Z |
| Sea clutter up / down | W / S | VRM 1 on or off | X |
| Rain clutter up / down | E / D | Alarm acknowledge | Space bar |
| Brilliance up / down | R / F | Act at the cursor (acquire, select or cancel) | Enter |
| Range scale longer / shorter | Page Up / Page Down | Cursor mode: acquire / select / cancel | 1 / 2 / 3 |
| EBL 1 clockwise / anticlockwise | Right / Left arrow | Radar on or standby | F2 |
| VRM 1 out / in | Up / Down arrow | X band / S band | F3 / F4 |
| Heading line and graphics off, while held | H | Range rings on or off | F7 |
| | | Day or night | F8 |

To give a function another key, press [[Set]] beside it and then the key (or turn the knob one click); Esc leaves it unchanged. [[Put all keys back to the starting keys]] undoes every change.

A box of knobs that acts as a game controller needs no setting up: it is found when it is plugged in and one of its buttons is pressed, and its first four knobs are gain, sea clutter, rain clutter and brilliance.

!!! note "Not yet tried with a real panel"
    The starting keys are this simulator's own choice, not those of any maker's radar. No real panel has been plugged in: only simulated inputs have been tried.

# Free practice scenarios {#scenarios}

<p class="lead">Free practice is the radar without an exercise: nothing is asked and nothing is marked. Twelve scenarios are built in, and the instructor can add more.</p>

## Choosing a scenario {#scenarios-choose}

[[MENU]], [[SCENARIO]], Scenario. The description under the list says what is in it. [[Restart]] starts it again from the beginning. Loading a scenario puts gain, clutter, brilliance, the EBLs, the VRMs and the parallel index lines back to their starting state; day or night colours stay as chosen.

@cols 33 67
| Scenario | What it is for |
|---|---|
| Open sea traffic | Own ship 000° at 12 knots. A cargo ship crosses from starboard, a tanker approaches nearly head-on, a ferry overtakes from astern; a fishing boat, a yacht and a buoy test the controls. The place to start |
| Coastal waters | A coast to starboard with headlands that cast radar shadow, an island to port, a lighthouse and buoys, and a current setting north-east, so that sea and ground stabilised pictures differ |
| Search and rescue (SART and racon) | A survival craft with a SART about 7 NM to the north-east, a racon buoy to the north-west, a ramark beacon ({ref:sart}) |
| Second-trace echo (abnormal propagation) | Super-refraction, a very large ship far outside the picture, and interference from another radar ({ref:second-trace}) |
| Heavy traffic (22 ships) | Twenty-two ships on crossing and reciprocal courses within 12 NM, with a tidal stream. Decide which targets matter |
| Ship types (28 vessels) | One vessel of each of the 28 catalogue types at its usual speed, with a current and a fresh wind. Large ships show further off and turn slowly; small craft show late |
| Traffic: 100 ships on programmed tracks | One hundred ships within 24 NM, each steering its own track. Practise picking out the ships that matter and setting sensible limits: the ARPA tracks 40 |
| False echoes: power line, bridge and quay | Up a river towards a bridge ({ref:false-echoes}) |
| Approaches to Mumbai (real coastline) | Own ship 18 NM west of the harbour, steering in. Use the 12 and 24 NM range scales to pick up the land |
| Approaches to Mormugao, Goa (real coast and land) | Own ship 15 NM west of Mormugao. Ore carriers at anchor off the headland, fishing boats along the coast, high ground behind it |
| Approaches to Kochi (real coast and land) | Own ship 16 NM west of the entrance. A low coast: at first the radar sees the higher ground and the trees behind the beach, not the water's edge |
| Gulf of Kutch: Mundra and Kandla (real coast and land) | Entering the gulf with a tidal stream. Low land on both sides, islands and reefs to the south |

!!! important "The real areas are not charts"
    In the four real areas the coastline is real, to about 250 m, and so are the land heights the radar sees. The ships, wind, current and stream are invented, and there are no depths, lights or buoys. They are not charts and not for navigation. The data credits are in {ref:sources}.

## Study aids {#scenarios-aids}

On the same page:

@cols 36 64
| Tick box | What it shows |
|---|---|
| Show blind sector astern | The shadow sector of the funnel |
| Show target names | The name of every target beside its echo. An aid for study, never available on a real radar; it is switched off in an examination |
| Stern line | A dotted line astern of own ship |
| Antenna position on own ship's outline | A cross at the antenna, on the short range scales |

## Linked own ships {#scenarios-linked}

**Join the shared exercise**: every display that ticks this box and has the same scenario loaded sees the others' own ships as radar targets with AIS. Give each display a different start, with "Start bearing from scenario start" and "Start distance", and press [[Move own ship to that start]], so that the ships do not begin on top of each other. Linked exercises run at 1x. Displays in tabs of one browser link at once; other computers need the classroom server.

The instructor can start a linked exercise on all displays in one action ({ref:linked-exercise}).

## Scenarios the instructor has made {#scenarios-own}

Scenarios made in the instructor station's scenario editor and saved to the library appear at the end of the same list ({ref:making-scenarios}).
