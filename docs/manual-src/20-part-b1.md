%% PART B | The radar display | Every control on a trainee's display: the picture, the measuring tools, the ARPA, the AIS, the alerts, own ship and the weather. The instructor's own radar works the same way.

# The screen {#the-screen}

<p class="lead">The radar picture is in the middle, as large as the window allows. Three panels stand on each side of it and are always in view. Everything else is in a menu that opens over the right-hand side and closes again.</p>

## The layout {#screen-layout}

@fig display-annotated | 100 | The radar display with its parts numbered. The numbers are used in the table below.

@cols 7 30 63
| No. | Part | What it is for |
|---|---|---|
| 1 | Tabs [[RADAR]], [[ARPA]], [[EXERCISE]] | Open the radar's menu, the ARPA's menu, or the list of exercises. The lit tab pressed again closes the menu. With the menu closed, RADAR is lit |
| 2 | [[SHIP CONTROL]] | Opens the ship control window for a second screen ({ref:ship-window}) |
| 3 | [[PAUSE]] / [[RUN]], the speed box, [[DAY]] / [[NIGHT]] | The keys that work the simulator and not the radar: stop and start the exercise clock, make it run at 1x, 2x, 5x or 10x, and change the colours of the display |
| 4 | Clock | The ship's clock (UTC) with the date |
| 5 | State of the alerts | A green light and `No Alarms`, or the number of alerts waiting: orange for a warning, red and flashing for an alarm |
| 6 | Gear, [[?]], person | Settings; help (a short explanation under every control: press again to hide); change the names logged in |
| 7 | PICTURE & RADAR CONTROL | Radar on, standby or off; range scale; band; AIS on or off; orientation, motion and stabilisation; range rings; pulse length; resets |
| 8 | GAIN / CLUTTER | Gain, sea clutter, rain clutter, tuning, brilliance, the tuning meter, echo trails; the letters that show which signal processing is on |
| 9 | EBL / CURSOR | The two electronic bearing lines; where the cursor is (bearing, range, latitude and longitude); the [[PI / MAP]] key |
| 10 | The radar picture | Echoes, own ship, the bearing scale, range rings, and the symbols of tracked and AIS targets |
| 11 | OWN SHIP DATA | Heading, speed, course and speed over the ground, position, rudder, rate of turn, steering mode, wind; the exercise clock |
| 12 | TARGET DATA | The list of tracked targets, and the data of the selected target |
| 13 | VRM / ARPA | The two variable range markers; vector mode and time; PPC or PAD; the CPA and TCPA limits; the ARPA's status; [[ALARM ACK]] and the alert; the target keys |
| 14 | [[MENU]] | Opens the menu of everything else |
| 15 | The foot of the page | "Training simulator · not type approved · not for navigation", and the legend of the symbols |

No settings are written over the picture itself. The only text on it is the data label of a target you have clicked ({ref:arpa-label}), and messages that matter at once, such as `PICTURE FREEZE`.

## The header messages {#screen-banner}

A message from the instructor, from the bridge or from the look-out appears in an orange box under the header: for example `Instructor: exercise 5 started. Read the briefing, then press RUN.` Click the box to close it.

## The menu {#screen-menu}

[[MENU]] at the bottom right opens a drawer over the right-hand side of the screen ({fig:menu}). Its keys are along the bottom; press one and only that key's controls are shown. [[CLOSE]], [[MENU]] again or the Esc key closes the drawer. The three right-hand panels are covered while it is open; the picture and the left-hand panels stay in view.

@fig menu | 86 | The menu open on the SHIP key. The menu keys are along the bottom of the drawer.

@cols 20 80
| Menu key | What is under it | 
|---|---|
| [[SHIP]] | The choice of ship, autopilot or hand steering, the course, the engine telegraph, the anchor and the MOB key, the rudder keys; "At the controls" when more than one name is logged in ({ref:own-ship}) |
| [[PI / MAP]] | Offset EBL, parallel index lines, off-centre, navigation lines and marks, saved maps, a route, search patterns, the charted coastline ({ref:measuring}) |
| [[RADAR]] | Pulse length, PRF, echo stretch, echo averaging, interference rejection, performance monitor ({ref:picture}) |
| [[TGT LIST]] | The full list of tracked targets with bow crossing range and time ({ref:arpa}) |
| [[CPA/ALARM]] | CPA and TCPA limits, acknowledge and silence, the lost target warning switch, anchor watch ({ref:arpa-limits}) |
| [[PAST POS]] | Vectors of dangerous targets only, sea or ground stabilisation, past positions ({ref:arpa-vectors}) |
| [[GUARD]] | Two guard zones and two exclusion areas ({ref:guard}) |
| [[TRIAL]] | The trial manoeuvre ({ref:trial}) |
| [[AIS LIST]] | AIS targets and their settings ({ref:ais}) |
| [[ARPA]] | ARPA on or standby, self-test, speed input, ARPA data on the picture, ARPA brilliance, audible alarms |
| [[SETTINGS]] | Radar power off, default settings, two stored user settings, day or night, the steering gear, own ship's data, the hardware control panel ({ref:settings}) |
| [[VHF/SIGNAL]] | Typed VHF messages; whistle signals and the automatic fog signal ({ref:vhf}) |
| [[WEATHER]] | Sea state, rain, propagation, interference, visibility, wind, current and tide ({ref:weather}) |
| [[SCENARIO]] | The free-practice scenarios, linked own ships, study aids ({ref:scenarios}) |
| [[ROC EX]] | The six radar observer exercises ({ref:ex-roc}) |
| [[ARPA EX]] | The 31 ARPA, radar and plotting exercises ({ref:doing-an-exercise}) |

The instructor station's own radar has two more keys, [[FAULTS]] and [[INSTR]] ({ref:own-radar}). A trainee's display does not have them.

## Colours {#screen-colours}

@cols 28 72
| Colour | Meaning |
|---|---|
| Deep navy | The panels and the background of the picture |
| Light blue | Whatever is selected or switched on; own ship and her vector |
| Green | A normal state: a steady tracked target, a working sensor |
| Orange | A warning; a lost target |
| Red | An alarm; a dangerous target |
| Yellow | A caution; a value that is still preliminary (a yellow `?` after it) |
| Amber | Radar echoes. Land is painted in a deeper, dimmer amber so that the coast does not glare |
| Light green-blue (teal) | AIS targets |

[[DAY]] / [[NIGHT]] in the header (also under [[SETTINGS]], and key F8) changes between the day colours and a night display: a black picture with everything dimmed, so that a display on a dark bridge does not spoil night vision ({fig:night}).

@fig night | 56 | The night colours.

## The small box after a value {#screen-sensors}

In OWN SHIP DATA a small box after a value names the sensor it comes from: `GYRO` after the heading, `LOG` after the speed through the water, `EPFS` after the course and speed over the ground. The box is green while the sensor works and turns red when that sensor has failed ({ref:failures}).

# Switching on and setting up the picture {#picture}

<p class="lead">A radar picture is only as good as its setting up. This chapter covers the power states, the range scale and band, the pulse, and the four controls that make or spoil the picture: gain, sea clutter, rain clutter and tuning.</p>

## On, standby and off {#picture-power}

The [[RADAR]] key is in the heading of the PICTURE & RADAR CONTROL panel ({fig:panel-bDisp}). It shows the state of the radar and changes it.

@cols 24 76
| The key reads | Meaning, and what pressing it does |
|---|---|
| `RADAR: OFF` | The radar is switched off. Press to switch on: the warm-up starts |
| `WARM UP 1:28` | The transmitter is warming up, with the time left. It takes one and a half minutes of exercise time here. Nothing can be done but wait |
| `RADAR: STANDBY` | Ready, not transmitting. There is no picture. Press to transmit |
| `RADAR: ON` | Transmitting. Press to go back to standby |

Every free-practice scenario and almost every exercise starts with the radar transmitting. Exercise 22 starts with it switched off ({fig:warmup}). [[SETTINGS]], [[RADAR POWER OFF]] switches the radar off; key F2 is the same as the RADAR key.

!!! placeholder "Placeholder"
    The warm-up of 90 seconds is this project's figure. The performance standard allows a radar up to 4 minutes from cold.

@fig panel-bDisp | 42 | The PICTURE & RADAR CONTROL panel.

@fig warmup | 80 | Switching on from cold in exercise 22: the picture area shows the time left, and the ARPA is in standby.

## Range scale {#picture-range}

[[−]] and [[+]] beside Range change the range scale; the box between them opens the list. The scales are 0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24, 48 and 96 NM. Keys Page Up and Page Down do the same.

Choose the scale for the work in hand: a short scale to see detail and small targets near the ship, a long one for early warning. Look at a longer scale at intervals even when working on a short one. The ARPA goes on tracking out to 24 NM whatever scale is shown, and tracked and AIS targets are shown on every scale.

## Band {#picture-band}

[[X]] and [[S]] choose the transmitter.

@cols 16 22 62
| Band | In this simulator | Use |
|---|---|---|
| X | 9.41 GHz, 3.2 cm, beam 1.23° wide | A sharper picture, better bearing discrimination, smaller targets detected further off in clear weather. The only band a SART answers, and the band of the racon in the scenarios |
| S | 3.05 GHz, 9.8 cm, beam 1.8° wide | Sees through rain and sea clutter much better. Small craft and buoys are detected at shorter range |

In rain or a rough sea, when small targets may be hidden, compare the two bands. The beamwidths and pulse lengths are those of one maker's published specification, taken as typical.

## Pulse length and PRF {#picture-pulse}

[[AUTO]], [[SHORT]], [[MED]] and [[LONG]] set the pulse length. With AUTO the range scale chooses it. The pulse in use is written at the foot of the panel: `SP`, `MP` or `LP` with its length in microseconds, and the pulse repetition frequency (PRF).

@cols 16 18 18 48
| Pulse | Length | PRF | Chosen by AUTO on |
|---|---|---|---|
| Short (SP) | 0.07 µs | 3000 a second | Range scales up to 1.5 NM |
| Medium (MP) | 0.3 µs | 1500 a second | 3 and 6 NM |
| Long (LP) | 1.2 µs | 600 a second | 12 NM and above |

A long pulse puts more energy on a target, so weak and distant targets show better; but two targets close together on the same bearing merge into one echo, the minimum range is larger, and rain and sea return more clutter. A short pulse does the reverse.

The **PRF** can also be chosen by hand, under [[MENU]], [[RADAR]]: `Auto (by pulse length)`, 600, 1000, 1500 or 3000. This is for study: on most real sets the PRF is not a control of its own. A lower PRF puts fewer pulses on each target, so weak echoes are lost sooner; it also lengthens the range that can be measured without ambiguity (150,000 km divided by the PRF: about 81 NM at 1000 a second), so second-trace echoes move or disappear ({ref:second-trace}). A PRF too high for the pulse length in use is greyed out.

## Gain, clutter, tuning and brilliance {#picture-gain}

The GAIN / CLUTTER panel ({fig:panel-bGain}) has a bar for each control. Click or drag along the bar. The figure beside it is the setting, from 0 to 100.

@fig panel-bGain | 42 | The GAIN / CLUTTER panel.

@cols 14 86
| Control | What it does, and how to set it |
|---|---|
| GAIN | The gain of the receiver. Too low and weak echoes are lost; too high and the picture fills with noise. Set it so that a light, even speckle of noise just shows over the picture |
| SEA | The sea clutter control. It reduces the gain close to the ship, where the sea returns most. Use only as much as the sea needs: too much removes small targets near the ship. Sea clutter reaches further on the side the wind and sea come from than on the other side, and a shorter pulse returns less of it |
| RAIN | The rain clutter control. It breaks up the solid return of rain so that a target inside it may show. Too much weakens every echo |
| TUNE | The tuning of the receiver. Tune for the greatest extent of the sea clutter or of a land echo, or for the highest reading of the METER below it. The best tuning point is different each time a scenario starts |
| AUTO (beside SEA, RAIN and TUNE) | The set chooses the setting. Like a real automatic control it is a compromise: check what it has done |
| BRILL | The brightness of the picture. It does not change what is detected |
| METER | The tuning meter: longest when the receiver is in tune |

!!! placeholder "Placeholder"
    How much the automatic controls take off is this project's estimate, not the behaviour of a particular set.

Keys Q and A raise and lower the gain, W and S the sea clutter, E and D the rain clutter, R and F the brilliance ({ref:control-panel}).

## Setting up in the right order {#picture-order}

The order matters, because each control is judged on the picture the earlier ones have made. This is the order exercise 22 teaches and marks:

1. Switch on, wait for the warm-up, and put the radar to transmit.
2. Set the **brilliance** so that the picture and the graphics can be seen comfortably.
3. Put **sea** and **rain** to zero, and switch the signal processing off ([[MENU]], [[RADAR]]: echo stretch, echo averaging and interference rejection unticked; the letters IR, ENH and SC/SC in the heading of the panel go dark).
4. Set the **gain** for a light, even speckle of noise.
5. **Tune** for the greatest extent of sea clutter or of the land. Do not trust a tuning meter alone.
6. Judge the picture on a medium range scale such as 12 NM.
7. Check the performance with the **performance monitor**.
8. Last, bring in the **sea** control as the sea needs, and the **rain** control only if there is rain.

## Signal processing and the performance monitor {#picture-processing}

Under [[MENU]], [[RADAR]]:

@cols 30 70
| Tick box | What it does, and what it costs |
|---|---|
| Echo stretch | Makes target echoes larger. It can merge close targets and hide small or fast ones |
| Echo averaging | Compares one turn of the aerial with the next and keeps what stays, which suppresses random clutter. It also hides echoes that come and go, such as a small boat or buoy in a seaway |
| Interference rejection (IR) | Keeps only what successive pulses both return, which removes the spirals of dots that another radar causes. It costs very weak echoes a little: switch it on when interference is seen, not otherwise |
| Performance monitor | Paints a plume astern of own ship. Compare its length with the dashed arc, which is its length when the set was new: a shorter plume means the radar has lost performance |

The letters in the heading of the GAIN / CLUTTER panel light up when one is in use: `IR`, `ENH` (echo stretch), `SC/SC` (echo averaging, from scan to scan) and `MON` (performance monitor).

## Echo trails {#picture-trails}

Trails, at the foot of the GAIN / CLUTTER panel: [[OFF]], [[REL]] or [[TRUE]], and their length: 3, 6, 12 or 30 minutes. A trail is the afterglow of an echo: it shows where the echo has been.

- **Relative trails** show how each target is moving in relation to own ship. A trail pointing at the centre is a target on a collision course.
- **True trails** show each target's own movement. Fixed objects leave no trail when the picture is ground stabilised.

Trails need no ARPA: they are the quickest check of the ARPA's vectors against the radar itself.

# Presentation of the picture {#presentation}

<p class="lead">The same echoes can be shown with north up or the ship's head up, with own ship fixed or moving across the screen, and referred to the water or to the ground. The three MODE boxes choose.</p>

## Orientation {#presentation-orientation}

The first MODE box:

@cols 16 84
| Setting | Meaning |
|---|---|
| N UP | North-up: north at the top, like a chart. Stabilised by the gyro: when the ship alters course the heading line moves and the picture stays still. Bearings are true |
| H UP | Head-up, unstabilised: the ship's head at the top. When the ship alters course or yaws, the whole picture swings and smears. Bearings on the scale are relative |
| C UP | Course-up: the course at the top, stabilised by the gyro. When the ship yaws the heading line moves but the picture stays still |

Head-up is used only with relative motion: choosing H UP changes TM to RM, and choosing TM while in H UP changes the picture to C UP. After a large alteration in course-up, press [[C-UP RST]] to take the present heading as the new reference.

## Motion {#presentation-motion}

The second MODE box:

- **RM**, relative motion: own ship stays at one place on the screen and everything else moves in relation to her. A fixed object moves down the screen at own ship's speed.
- **TM**, true motion: own ship moves across the screen at her own speed and course, and fixed objects stay still (when the picture is ground stabilised).

In true motion own ship starts half the radius out from the centre, on the reciprocal of her course, so that the picture shows the most ahead. When she has run two thirds of the radius from the centre she is put back by herself; [[TM RST]] does it at any time, and so does a change of range scale.

In relative motion the centre can be moved: [[PI / MAP]], [[Off-centre: click a point]], then click where own ship should be. [[Centre]] puts her back.

## Stabilisation {#presentation-stab}

The third MODE box chooses what the picture is referred to:

- **SEA**: the picture is moved by the heading and the speed through the water. True trails and true motion show movement through the water.
- **GND**: the picture is moved by the course and speed over the ground from the position-fixing system. Fixed objects stay still in true motion, and a navigation line or a route stays on the ground.

This box stabilises the *picture*. The ARPA has a stabilisation of its own for its true vectors ({ref:stab}); the two are separate controls.

!!! note "True motion needs a speed"
    In sea-stabilised true motion the display moves own ship by the heading and the speed it is given. If that speed is wrong, own ship moves the wrong amount and everything else, buoys and land included, slides across the picture. With no speed input own ship stays still and the whole picture moves past.

## Range rings {#presentation-rings}

[[RINGS]] switches the fixed range rings on or off. The interval between them is written beside the key (`every 2 NM` on the 12 NM scale). Key F7 does the same.

## Own ship on the picture {#presentation-own}

Own ship is drawn as on a radar: the heading line, with a short beam line across it at the ship's position. On the shortest range scales her outline is drawn to scale. The bearing scale round the picture has a mark every 5° and a number every 30°.

Two study aids under [[MENU]], [[SCENARIO]]:

- **Stern line** draws a thin dotted line from own ship astern to the edge of the picture.
- **Antenna position on own ship's outline** marks the radar antenna with a small cross on the short range scales where the outline is drawn. Where the antenna is on the ship is typed under Own ship data ({ref:own-ship-data}). The picture and every measurement stay referenced to the ship's reference point.

## When the heading is lost {#presentation-hdgfail}

If the gyro compass fails, the picture changes by itself to head-up, unstabilised, with relative motion; `HDG FAIL: UNSTAB, REL BRG ONLY` is shown in the PICTURE & RADAR CONTROL panel; and the EBLs read relative bearings only. That is what a real radar does when it loses its heading input. See {ref:failures}.

# Measuring and navigating {#measuring}

<p class="lead">Bearings and ranges are measured with the electronic bearing lines and the variable range markers. Parallel index lines, navigation lines, a route and search patterns turn the radar into a tool for keeping the ship on her track.</p>

## EBL and VRM {#measuring-ebl}

The EBLs are in the EBL / CURSOR panel (bottom left); the VRMs are in the VRM / ARPA panel (bottom right).

1. Tick [[EBL 1]] or [[VRM 1]]. The line or the ring follows the cursor over the picture, and the panel shows `MOVE` beside its reading.
2. Double-click the picture to lock it: the panel shows `LOCK`.
3. To move it again, untick and tick the box.

@fig panel-bCur | 42 | The EBL / CURSOR panel: the two EBLs, the cursor's bearing, range and position, and the PI / MAP key.

EBL 2 and VRM 2 work the same way. With neither moving, the [[MEASURE]] key in the VRM / ARPA panel followed by a click on an echo puts EBL 1 and VRM 1 on that echo together and locks them ({fig:measure}).

Keys: Z switches EBL 1 on or off and X does the same for VRM 1; the left and right arrow keys turn EBL 1, and the up and down arrow keys move VRM 1 out and in.

@fig measure | 100 | EBL 1 and VRM 1 on a target (046.1°, 4.93 NM), and a parallel index line 2 NM to starboard of the heading (PI 1).

## True or relative bearings {#measuring-truerel}

The [[EBL BRG]] key under the EBL readings changes them between `TRUE` and `REL` (relative to the ship's head). Every bearing ends in `T` or `R` so that it cannot be mistaken. When the gyro has failed only relative bearings are given.

## The cursor {#measuring-cursor}

The cursor line of the EBL / CURSOR panel shows at all times the true bearing (`BRG`), the relative bearing (`REL`) and the range (`RNG`) of the point the cursor is on, and under them (`CURS`) its latitude and longitude. When the position-fixing system has failed no latitude and longitude are given.

## Offset EBL {#measuring-offset}

An EBL normally starts at own ship. To measure the bearing and distance between two other points:

1. [[PI / MAP]], then [[EBL origin: own ship]]. The key changes.
2. Click the point the EBL should start from.
3. The key beside it chooses whether that origin stays fixed to the ground or is carried along with own ship.
4. Press the first key again to return the origin to own ship.

## Parallel index lines {#measuring-pi}

A parallel index line is a line on the screen parallel to the planned track, at the distance at which a chosen fixed object should pass. While the ship is on her track, the echo of the object slides along the line. If the echo leaves the line, the ship has left her track, and which side the echo is on shows which way.

Under [[PI / MAP]] there are four lines, PI 1 to PI 4 ({fig:menu-pimap}). For each:

@cols 22 78
| Box | Meaning |
|---|---|
| Tick box | The line on or off |
| Bearing ° | The true bearing of the line: the direction of the planned track |
| Distance NM | How far the line is from own ship. Plus is to starboard of that bearing, minus to port |
| Ahead NM, Astern NM | Cut the line short: how far it runs ahead of and astern of the point abeam of own ship. Blank is a full line |
| [[HDG]] | Puts the line parallel to the ship's present heading |

[[All PI lines on]] and [[All PI lines off]] switch the four together.

!!! try "Example"
    Planned track 000°, to pass a light 1.5 NM off to starboard. Set PI 1: bearing 000, distance 1.5, and tick it. Steer so that the echo of the light runs down the line. If the echo moves inside the line, towards the heading line, the ship is being set towards the light. This is exercise 10.

@fig menu-pimap | 86 | The PI / MAP page of the menu: parallel index lines, navigation lines and marks, the route, the search pattern and the charted coastline.

## Navigation lines, marks and maps {#measuring-navlines}

- **Nav lines.** [[Nav lines: draw]], click the points of a line (the edge of a channel, a limit not to cross), and press the key again to end the line. Draw as many as are needed.
- **Nav marks.** [[Nav mark: place]], then click where the mark should be.
- [[Clear lines and marks]] removes them all.
- **Maps.** Type a name and press [[Save map]] to keep the lines and marks on this computer; choose it under `Load map` to bring them back.

Lines and marks are fixed to the ground. Use them on a ground-stabilised picture, and check them against a fixed echo: they are only as good as the ship's position.

## Seeing under the graphics {#measuring-hold}

While [[Hold: graphics off]] is held down (or key H), the heading line and every other line and symbol are taken off the picture, leaving only the echoes and trails. Use it to see whether a weak echo is hidden under a line.

## A route on the radar {#route}

1. [[PI / MAP]], [[Route: add waypoints]].
2. Click the waypoints on the picture in order, at most 20. [[Undo waypoint]] removes the last one.
3. Press [[Route: add waypoints]] again when done. [[Clear route]] removes the route.

The route is fixed to the ground: its legs are dashed lines and its waypoints numbered circles, the next one bold ({fig:route}). The EBL / CURSOR panel then shows the next waypoint (`WPT`) with its bearing and distance, and **XTD**, the cross-track distance: how far the ship is off the leg she is sailing, `S` when she is to starboard of it and `P` when to port. The leg moves on to the next when the ship comes abeam of its waypoint.

A route is only as good as the ship's position and the ground stabilisation. Check it against a fixed echo.

@fig route | 100 | A route of three legs on the radar (exercise 27). The EBL / CURSOR panel gives the next waypoint and the cross-track distance XTD.

## Search patterns {#search-pattern}

A search pattern is a route made for you from a datum.

1. [[PI / MAP]]. Under Search pattern choose `Expanding square` or `Sector search`.
2. Choose the datum: `Own ship now`, or `MOB mark` when the MOB key has been pressed ({ref:mob}).
3. Type the track spacing (expanding square) or the radius (sector search), in NM, and the first course.
4. Press [[Put the search pattern on the radar]].

@cols 24 76
| Pattern | What is drawn |
|---|---|
| Expanding square | Legs of 1, 1, 2, 2, 3, 3 ... times the track spacing, every turn 90° to starboard |
| Sector search | Three triangles through the datum, every turn 120° to starboard; the whole pattern is nine times the radius long |

The pattern is then followed like any route, with the next waypoint and XTD in the panel.

## The charted coastline and the outline sheet {#measuring-coast}

- **Charted coastline over the picture** ([[PI / MAP]], tick box): draws the coast as the simulator has it as a thin line over the echoes, to compare what the radar paints with what the chart shows. Low land far off and land in radar shadow paint less than the chart shows.
- [[Outline sheet of this area (to print)]] opens the same coastline with a latitude and longitude grid and a scale, to print and plot position lines on by hand.

Neither is a chart: there are no depths, lights or buoys.

## Traffic separation schemes {#measuring-tss}

In a scenario with a traffic separation scheme, the scheme is drawn on the picture: the separation zone shaded, the outer limits of the lanes dashed, and arrows for the direction of the flow in each lane ({fig:tss-ppi}). Exercise 28 uses one.

@fig tss-ppi | 54 | A traffic separation scheme on the picture: the separation zone shaded, the lanes with their arrows.

## What the menu page also shows {#measuring-data}

At the foot of the PI / MAP page a line gives the data of the radar as it is set now: the band with its frequency, wavelength and beamwidth, the pulse length and PRF, and from them the range discrimination and the minimum range. For example: `X band: 9.41 GHz, 3.2 cm, beam 1.23°. medium pulse 0.3 µs, PRF 1500/s: range discrimination 45 m, minimum range 56 m.` Change the pulse and watch the figures change.

# ARPA: tracking targets {#arpa}

<p class="lead">The ARPA follows the echoes you give it, works out each target's course, speed, CPA and TCPA, and warns when one will pass too close. It saves the plotting; it does not replace the judgement.</p>

## The ARPA at a glance {#arpa-glance}

The target keys are in the VRM / ARPA panel at the bottom right ({fig:panel-bArpa}), under [[ALARM ACK]] and the alert box. The heading of that panel says whether the ARPA is `ARPA ON`, in `STANDBY`, or `ARPA OFF` (during an ROC exercise). A manual plotting exercise starts with the ARPA in standby: leave it there, because one of the marked items is that the ARPA was not used.

- The ARPA tracks up to **40 targets**, out to **24 NM**, whatever range scale is shown. Tracked targets are shown on every range scale.
- The heading of TARGET DATA shows how many are tracked: `4 / 40`.
- A caution is given at 38 targets; at 40 a new target is not acquired, with a warning.

@fig panel-bArpa | 42 | The VRM / ARPA panel: the VRMs, the vector keys, the CPA and TCPA limits, the ARPA's status, ALARM ACK and the target keys.

## Acquiring a target {#arpa-acquire}

1. Press [[ACQUIRE]].
2. Click the echo. A broken circle appears on it, a row appears in the list, and its data label is shown beside it.

Key 1 chooses the acquire mode, and Enter acquires at the cursor.

What then happens to the track:

@cols 18 20 62
| After about | State | What you see and may use |
|---|---|---|
| 0 to 1 minute | `ACQ` | A broken circle. No data yet |
| 1 minute | `PRELIM` | A faint, dashed vector and first data, each value followed by a yellow `?`. Do not use it |
| 3 minutes | `STEADY` | The vector at full strength; the data is reliable. The status light in the list turns green |

After the target or own ship alters course or speed, the track needs time again before its data is right. This delay is the most important limit of any ARPA.

[[CANCEL]], then a click on a target, drops it. [[CANCEL ALL]] drops every target. Putting the ARPA to standby ([[MENU]], [[ARPA]]) also clears every target.

## Automatic acquisition and guard zones {#guard}

With **Auto** ticked (beside [[CANCEL ALL]]) the ARPA acquires by itself every echo that enters a guard zone. A target acquired this way is shown bold, red and flashing, with the warning `New target ... acquired in guard zone`, until it is acknowledged. With Auto unticked, a guard zone that is switched on still watches: it gives the warning `Echo entering guard zone` and acquires nothing.

Under [[MENU]], [[GUARD]] there are two guard zones and two exclusion areas. Each has:

@cols 24 76
| Box | Meaning |
|---|---|
| Tick box | The zone on or off |
| Inner NM, Outer NM | The ring it covers, as two ranges from own ship |
| From °, To ° | The sector, as bearings relative to the bow, clockwise from "From" to "To". The same figure in both gives a full ring |

Things to know:

- A target that first appears **inside** the inner edge of a guard ring has not crossed the ring and is not acquired. Acquire it by hand.
- Automatic acquisition leaves out echoes as large as land (800 m or more across or deep), so the coast itself is not acquired. A small rock, a buoy or a patch of clutter can be.
- An **exclusion area** keeps such things out: nothing inside it is acquired automatically. Anything can still be acquired by hand.

!!! placeholder "Placeholder"
    The 800 m is the figure of one set described in a reference book. Sets differ.

## The target's data {#arpa-data}

Press [[SELECT]] and click a target, or press its row in the list. The target gets the selected symbol (a square shown by its corners) and TARGET DATA shows ({fig:panel-bTd}):

@fig panel-bTd | 42 | TARGET DATA: the list of tracked targets, and the selected target below it.

@cols 22 78
| Shown | Meaning |
|---|---|
| `TGT` | The target's number. `TT` after the heading means a tracked (radar) target; `AIS` an AIS target |
| `BRG`, `RNG` | Its bearing and range now |
| `CTW`, `STW` | Its course and speed through the water, when the ARPA is sea stabilised |
| `COG`, `SOG` | Its course and speed over the ground, when the ARPA is ground stabilised |
| `CPA` | The closest point of approach: how near it will pass if neither ship alters |
| `TCPA` | The time to that closest approach, in minutes |
| `BCR`, `BCT` | Bow crossing range and time: how far ahead of own ship the target will cross, and when. Dashes when it will not cross ahead |
| `STATE` | `ACQ`, `PRELIM`, `STEADY`, `FADE` (the echo is being missed on some turns of the aerial), `DANGER` or `LOST` |

**The list** above the data gives each target's number, bearing, range, CPA, TCPA, course and speed, and a status light: green for a steady track, orange while acquiring, preliminary or lost, red for a dangerous target. [[MENU]], [[TGT LIST]] shows the full list with BCR and BCT.

## The data label on the picture {#arpa-label}

Clicking a target with ACQUIRE or SELECT puts a small label beside it: `TGT` and its number, its range, and its course and speed (for an AIS target: its name, range, COG and SOG). Click the same target again to take the label off. Several targets can have labels at once. The label is in the target's colour: green, red when dangerous, orange when lost, teal for AIS.

## Vectors {#arpa-vectors}

The Vector keys in the VRM / ARPA panel:

- [[REL]]: **relative vectors**. Each vector shows where the target will be in relation to own ship after the vector time. A vector that points at own ship, or passes close to her, is a risk of collision. A target on the same course and speed as own ship has no relative vector.
- [[TRUE]]: **true vectors**. Each vector shows the target's own course and the distance it will run in the vector time. Own ship has a vector too. A stopped target has no true vector. Use true vectors to see what the other ship is doing: her heading, and so her aspect ({fig:truevec}).
- The box beside them is the **vector time**: 1, 2, 3, 6, 12, 15, 20, 30, 45 or 60 minutes.

Collision avoidance needs both: relative vectors to see whether there is a risk, true vectors to see what kind of situation it is.

@fig truevec | 100 | True vectors of 12 minutes, true trails and past positions. Two targets inside the CPA and TCPA limits are red.

**Past positions** ([[MENU]], [[PAST POS]]): `Off`, `Relative` or `True`; the number of dots (1 to 10) and the interval between them (0.5, 1, 2, 3 or 6 minutes). Evenly spaced dots in a straight line mean a steady course and speed. A bend, or a change of spacing, means the target has manoeuvred.

**Vectors of dangerous targets only** (the same page): a target that does not violate the limits is still tracked but shows no vector, which makes a crowded picture easier to read. Its vector comes back, with the alarm, when it violates the limits. Switch this off before planning a manoeuvre: a "safe" target may not be safe after you alter.

## Sea and ground stabilisation of the ARPA {#stab}

[[MENU]], [[PAST POS]], Stabilisation. The VRM / ARPA panel shows which is in use.

@cols 22 78
| Setting | True vectors show |
|---|---|
| `Sea (through the water)` | Courses and speeds through the water, worked from the gyro and the log. The panel reads `SEA STAB (LOG)`. A buoy seems to move: its true vector is the reverse of the set and drift. This is the data collision avoidance needs, because it shows the other ship's heading |
| `Ground (fixed reference)` | Courses and speeds over the ground. Select a small, isolated, fixed target (a buoy, a rock, a light), then choose Ground: the ARPA takes out that target's apparent movement. Use it for navigation past fixed dangers |

If the reference target is lost or fades, the warning `POOR GROUND REFERENCE` is given and sea stabilisation returns unless the reference is restored.

The **speed input** of the ARPA is under [[MENU]], [[ARPA]], Speed log input:

@cols 34 66
| Setting | Effect |
|---|---|
| `Log, through the water` | The usual input for sea stabilisation |
| `Log, bottom track (over ground)` | The log measures speed over the ground, so "sea" stabilised true vectors then show movement over the ground |
| `EPFS / GNSS (over ground)` | Ground stabilisation from the position-fixing system. If that fails: `EPFS INPUT ABSENT` |
| `Manual speed (set by hand)` | Type the speed. The panel reads `SEA STAB (MAN SPD)` |

!!! important "Relative data does not depend on the inputs"
    With a wrong gyro or log input the true courses, speeds and vectors are wrong, and nothing on the ARPA says so. The CPA and TCPA stay correct, because they come from the target's relative movement.

## CPA and TCPA limits, and the dangerous target {#arpa-limits}

[[MENU]], [[CPA/ALARM]] ({fig:menu-alarm}): type the **CPA limit** in NM and the **TCPA limit** in minutes. The VRM / ARPA panel shows them as `CPA LIM` and `TCPA LIM`.

A target that will pass inside the CPA limit **and** will do so within the TCPA limit is **dangerous**: its symbol turns red and bold and flashes, the alarm sounds, and the alert box reads `DANGEROUS TARGET` with its number, CPA and TCPA ({fig:alarm}). Both limits must be broken. A target with a CPA of zero that is still further off in time than the TCPA limit gives no alarm yet.

Choose the limits for the waters: wide and early in open sea, closer in a traffic lane, where limits too wide would keep the alarm sounding all the time.

@fig alarm | 100 | Two dangerous targets. The header counts the alerts, the alert box names the first, and ALARM ACK is flashing.

@fig menu-alarm | 86 | CPA/ALARM: the limits, acknowledge and silence, the lost target warning and the anchor watch.

## Trial manoeuvre {#trial}

The trial manoeuvre shows what the picture would be if own ship altered course or speed, before she does.

1. [[MENU]], [[TRIAL]]. Tick **Trial manoeuvre on**. It starts with the present course and speed. A large `T` and the word `TRIAL` are shown on the picture for as long as it is on ({fig:trial}).
2. Type the **trial course** and the **trial speed**.
3. Type a **delay** in minutes if the manoeuvre is to be made later.
4. Read the table: for each tracked target and each activated AIS target, the trial CPA and trial TCPA, beside the CPA as it is now. A value inside the limits is red.
5. Change the trial until every target clears. A warning (`TRIAL: target ... would pass inside the limits`) names each target that the manoeuvre being tried would not clear.
6. Untick the trial, **then** make the alteration with the ship's controls. The trial changes nothing in the ship.

[[Start from present course]] puts the trial course and speed back to what the ship is doing now.

The trial allows for own ship's handling: she comes round and changes speed as she really would, not at once. It assumes that every target holds its course and speed. With a delay, `TIME TO MANOEUVRE` warns one minute before the manoeuvre is due, and `TIME FOR ACTION` when it is.

!!! important "Never leave the trial on"
    While the trial is on, the vectors on the picture are those of a manoeuvre that has not been made. Switch it off as soon as the decision is taken.

@fig trial | 100 | A trial of an alteration to 050° after 2 minutes. The table gives each target's CPA with the trial and as it is now.

## PPC and PAD {#arpa-pad}

The **Danger** box in the VRM / ARPA panel draws, for each steady track:

- `PPC`, the point of possible collision: where own ship would collide with the target if she steered for it at her present speed;
- `PAD`, the predicted area of danger: an area round that point which own ship's heading line must not cross if the target is to pass outside the CPA limit ({fig:pad-ppi}).

Keep the heading line clear of every PAD. The PAD here is a simplified six-sided figure; makers' shapes differ.

@fig pad-ppi | 54 | A predicted area of danger (the six-sided figure) on the track of the dangerous target ahead.

## Anchor watch {#anchor-watch}

At anchor:

1. Acquire a target that you know cannot move: a small isolated mark such as a buoy or a beacon.
2. Select it.
3. [[MENU]], [[CPA/ALARM]]. Type a distance beside Anchor watch and press [[On, selected target]].

A warning is given when the mark has moved further than that distance from where it was: `ANCHOR WATCH: target ... has moved ... NM from its marked position.` Either own ship or the target is dragging. If the target is no longer tracked, the warning says that the anchor watch is not working. [[Off]] ends the watch.

## ARPA on, standby and self-test {#arpa-self-test}

[[MENU]], [[ARPA]]:

- [[ARPA: ON (press for standby)]] puts the ARPA to standby, which clears every target and switches tracking off. Press again to switch it on.
- [[Self-test]] checks the ARPA's own calculations against test targets with known answers, and checks the gyro and log inputs. The result is written under the key.
- **ARPA data on the picture** hides or shows the symbols and vectors, to see the echoes alone. **ARPA brilliance** dims them.
- **Audible alarms** switches the sound of the alerts on or off.

## What the ARPA cannot do {#arpa-limits-of}

- It needs time: about three minutes after acquisition, and again after a target or own ship alters.
- It can lose a weak target, and gives `LOST` after six turns of the aerial without an echo.
- Two targets that pass close to each other can be swapped: each track goes on with the other's echo.
- It tracks echoes, and an echo is not always a ship. It can acquire a rock, a patch of clutter, and the multiple, side-lobe and indirect echoes of a strong ship close by. Interference from another radar gives it false plots unless interference rejection is on.
- With a wrong gyro or log input its true data is wrong, with no alarm.
- It knows nothing of a target it has not been given, and nothing of a target the radar does not detect.

Check the ARPA against the radar picture itself: the movement of the echo, the trails, a quick plot.

# AIS targets {#ais}

<p class="lead">Ships fitted with AIS transmit their name, position, course and speed. The radar shows them as triangles and can work out their CPA and TCPA. AIS adds to the radar; it does not replace it.</p>

## AIS on the picture {#ais-picture}

[[AIS ON]] in the PICTURE & RADAR CONTROL panel shows or hides the AIS targets. They are shown on every range scale, and whether the ARPA is on or in standby: only this key takes them off.

@cols 34 66
| Symbol | Meaning |
|---|---|
| Small triangle | A sleeping AIS target: shown, with no vector and no data on the picture |
| Larger triangle with a heading line and a dashed vector | An activated AIS target |
| Triangle inside a circle | An AIS target that is the same ship as a radar track ("associated") |
| Red, bold, flashing | A dangerous AIS target: inside the CPA and TCPA limits. A dangerous target is activated by itself |
| An orange triangle with a bold cross and no vector | A lost AIS target: its reports have stopped |

A turn indicator on the heading line of an activated target shows that it is turning. On the shortest range scales the outline of an activated target is drawn to scale ({fig:ais-ppi}).

@fig ais-ppi | 54 | Activated AIS targets, with their names. "= R3" after a name means that the AIS target and radar track 3 are judged to be the same ship.

## The AIS list {#ais-list}

[[MENU]], [[AIS LIST]] ({fig:menu-ais}) lists every AIS target with its name, bearing, range, CPA, TCPA, COG, SOG and state. Click a row to activate that target and see its data; click again to put it back to sleep. [[Activate all]] and [[Sleep all]] do so for every target.

@fig menu-ais | 86 | The AIS LIST page of the menu.

@cols 34 66
| Setting | What it does |
|---|---|
| Show AIS reported targets | The same as the AIS key |
| Lost AIS target alarm | A warning when an activated target's reports stop |
| Activate automatically | `Off (by hand only)`, or within 3, 6 or 12 NM: sleeping targets closer than that are activated by themselves. With automatic acquisition on, an AIS target in a guard zone is activated too, with a `NEW AIS TARGET` warning |
| Filter for sleeping targets | See below |
| Associated target shows | Whether a ship seen by both radar and AIS is drawn with the AIS symbol or the radar symbol |

At most 40 targets can be activated at once: a caution comes at 38, and a further activation is refused with a warning. The display holds 240 AIS targets in all.

## The data of an AIS target {#ais-data}

Select an AIS target (SELECT and a click, or its row in the list). TARGET DATA shows `AIS` after the heading, and besides bearing, range, CPA and TCPA: the MMSI, the navigational status, the reported position and heading, COG and SOG (or CTW and STW when the ARPA is sea stabilised), the rate of turn when the ship reports one, and the age of the last report.

[[MORE]] in the heading of the panel shows further data: the AIS class, IMO number, ship type, destination, ETA, draught, size and position accuracy. [[LESS]] goes back.

Anything the ship does not send reads `MISSING`. A class B set, as small craft carry, sends no navigational status, rate of turn, IMO number or voyage data, and reports less often (every 30 seconds or so).

## The filter for sleeping targets {#ais-filter}

In crowded waters hundreds of sleeping targets hide the picture. The filter leaves out a sleeping target when any criterion that is set says it is of no interest:

@cols 36 64
| Criterion | A sleeping target is left out when |
|---|---|
| Hide beyond: 3, 6 or 12 NM | It is further off than that |
| Hide passing wider than: CPA 1, 2 or 3 NM | It will pass wider than that, or is opening |
| Hide CPA further ahead than: TCPA 12, 20 or 30 min | Its closest approach is further ahead in time than that |
| Hide slower than: SOG 0.5, 2 or 5 kn | It is slower than that |
| Apply to: Class A and B, or Class B only | Narrows the other criteria to small craft. On its own it filters nothing |

While a filter is on, `AIS FILTER` and its criteria are shown in the VRM / ARPA panel and the AIS key reads `AIS FILT`. Activated, dangerous, lost and selected targets are always shown, the list still shows every target, and no single target can be taken off the picture.

## Own ship's AIS {#ais-own}

[[Own ship AIS data]] at the foot of the AIS LIST page shows what own ship's AIS is sending: the fixed data typed under Own ship data ({ref:own-ship-data}), and the position, COG, SOG, heading and rate of turn from the simulation. At anchor it sends "At anchor". When the position-fixing system has failed it sends no position.

## What AIS cannot do {#ais-limits}

- It shows only ships that transmit. Small craft, buoys and many fishing boats have no AIS. In the scenarios, small craft have AIS only where the scenario gives it to them.
- What it shows is what the other ship sends: it can be late, wrong or missing.
- In a manual plotting exercise the AIS display is switched off and locked: the AIS key reads `AIS OFF`, is greyed out, and cannot be switched on until Finish is pressed.
