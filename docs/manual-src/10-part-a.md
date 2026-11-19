%% PART A | Getting started | What the simulator is, how to put it on the classroom's computers, and how to get a radar picture on the screen in ten minutes.

# About the simulator {#about}

<p class="lead">The ROC / ARPA Radar Simulator is a training tool for radar observer (ROC) and automatic radar plotting aid (ARPA) courses. It runs in a web browser from a single file. Each trainee's computer shows a ship's radar with its ARPA and AIS; an instructor's computer runs the class.</p>

## What it does {#about-does}

A trainee's computer is called a **display**. It shows what an officer of the watch has in front of him or her at a radar: the picture, the controls that set it up, the tools that measure on it, the ARPA that tracks targets, the AIS targets, and the alerts. The trainee also steers the ship and works the engine, from the same screen or from a second window on a second screen.

The instructor's computer is called the **instructor station**. From it the instructor starts exercises on the displays, pauses and resets them, changes the weather, alters the other ships, gives the instruments faults, watches what the trainees do, and afterwards replays each exercise, assesses it and debriefs it.

@cols 30 70
| Part of the simulator | What is in it |
|---|---|
| The radar | X band and S band, ten range scales from 0.25 to 96 NM, gain, sea clutter, rain clutter, tuning, brilliance, three pulse lengths with their pulse repetition frequency, echo stretch, echo averaging, interference rejection, a performance monitor, echo trails, and the power states off, warm-up, standby and transmit |
| The picture | North-up, head-up and course-up; relative and true motion; sea and ground stabilisation; range rings; two EBLs and two VRMs; four parallel index lines; navigation lines and marks; a route with cross-track distance; search patterns; traffic separation schemes |
| The ARPA | Manual and automatic acquisition, 40 tracked targets, relative and true vectors, past positions, guard zones and exclusion areas, CPA and TCPA limits, bow crossing range and time, trial manoeuvre with delay, points of possible collision and predicted areas of danger, anchor watch, self-test |
| AIS | AIS targets on the radar, sleeping and activated, class A and class B, association with radar tracks, a filter for sleeping targets, further data on request; 40 activated targets and 240 in all |
| Alerts | Alarms, warnings and cautions, shown and sounded by priority and acknowledged one at a time |
| Own ship | Six ship types with a manoeuvring model and one simple exercise ship; autopilot and hand steering; engine telegraph; anchor; man overboard key; rolling, pitching and yawing in a sea |
| The sea and the air | Sea state, rain squalls, wind, current, tidal stream, sub- and super-refraction, ducting, interference from another radar, restricted visibility |
| The world | Twelve free-practice scenarios, four of them with the real coastline and land heights of the approaches to Mumbai, Mormugao (Goa) and Kochi and of the Gulf of Kutch; 28 vessel types, buoys and beacons; up to 100 ships on programmed tracks; SART, racon and ramark responses; false echoes |
| Exercises | 31 marked exercises (ten ARPA, eleven radar, ten manual plotting) and six ROC exercises, each with a briefing, automatic checking and debrief questions; practical examinations made of several exercises |
| The instructor station | Monitoring of every display, control of exercises, weather, targets and faults, records with replay, assessment with the evidence set out, a guided debrief, exercise sheets, trainee accounts and progress, a scenario editor |

## What it is not {#about-not}

- **Not a radar, and not for navigation.** Nothing it shows may be used on board.
- **Not approved.** It holds no type approval and no certificate from any authority or classification society. The words "Training simulator · not type approved · not for navigation" stay at the foot of the screen.
- **Not a full bridge simulator.** There is no view from the bridge windows, no chart display (ECDIS), no echo sounder and no voice radio. Visibility is told to the trainee in words ({ref:visibility}), and messages are typed.
- **Not a copy of any maker's radar.** The screen is laid out the way ships' radars in general present their data, with the standard symbols and abbreviations, but the arrangement is the project's own.
- **Not a judge of competence.** It measures and marks what it can measure. The assessor decides.

Many figures inside the simulator are estimates or placeholders, and the manual says so wherever one matters. They are gathered in {ref:placeholders}, and the limits of the simulator in {ref:limits}.

## The three ways it is opened {#about-three}

The whole simulator is one file, `radar-simulator.html`. How it is opened decides what it is.

@cols 26 34 40
| Opened as | How | What you get |
|---|---|---|
| A trainee's display | The file itself, or the address of the classroom server | The radar, the ARPA, own ship's controls, free practice and the exercises. No instructor pages at all |
| The instructor station | The same file with `#instructor` after its name, or the server's address followed by `/instructor` | The six instructor pages, after the instructor PIN is typed |
| The ship control window | The [[SHIP CONTROL]] key at the top of a display | A second window for a second screen: steering, engine telegraph, anchor, own ship's data and the exercise |
| The robot student's display | The file with `#demo` after its name, or the server's address followed by `/#demo` | A display on which a robot student works any of the 31 exercises while you watch ({ref:robot-student}) |

## Words used in this manual {#about-words}

@cols 24 76
| Word | Meaning |
|---|---|
| Display | A trainee's computer running the simulator, or the simulator on it |
| Instructor station | The instructor's computer running the simulator's instructor pages |
| Classroom server | A small program run on one computer of the classroom so that the station and the displays on different computers can reach each other ({ref:classroom-server}) |
| Free practice | Working the radar in a scenario without an exercise: nothing is marked |
| Exercise | A scenario with a briefing, tasks and questions, checked by the simulator |
| Record | What is kept of a finished exercise: the result, the track of every ship, the events, the trainees' notes, the instructor's observations and decision |
| Batch | A class: a name and a list of trainees |
| Exercise time | The time on the exercise clock. It stops while the simulator is paused and runs faster at 2x, 5x and 10x |
| Placeholder | A figure the project chose so that the simulator could work, which the institute must set or accept ({ref:placeholders}) |

## How the simulator has been checked {#about-checked}

The program is tested by programs: 844 tests of its calculations, 354 checks of the screen in a browser at three window sizes, and 34 checks of an instructor station and four displays working through the classroom server. The calculations were compared with worked examples in standard textbooks of radar plotting and with the tracking tests of the radar standard, and the list of functions with the IMO performance standards for radar and ARPA. These documents are named in {ref:sources}.

All of this shows that the program does what its makers intended. It does not show that the simulator is fit for an approved course: that is for the institute, its instructors and the authority to judge.

# Installing and starting {#installing}

<p class="lead">On one computer there is nothing to install: open one file in a browser. For a classroom of several computers, one of them runs a small server program and the others open its address.</p>

## What you need {#installing-need}

@cols 28 72
| | |
|---|---|
| Browser | Google Chrome or Microsoft Edge, a current version. Other browsers have not been tried |
| Screen | The screen has been checked at 1366 x 768, 1280 x 600 and 1920 x 1080. It is drawn larger on a large screen. Use full screen (F11) |
| Second screen | Optional, for the ship control window ({ref:two-screens}) |
| Mouse and keyboard | Needed. The keyboard also works the radar's main controls ({ref:control-panel}) |
| Sound | Loudspeakers or headphones, for the alerts and the whistle. The browser lets sound start only after the first click on the page |
| Internet | Not needed. The file contains everything; nothing is fetched from the internet |
| For a classroom | One computer with Node.js (version 18 or later; the project is built and tested with version 22) to run the classroom server, and a network that joins the computers |

## The files {#installing-files}

The simulator is the single file `radar-simulator.html`, about 1.1 MB, in the folder `dist` of the project. It can be copied alone to any computer or to a memory stick.

Everything a display or a station remembers (the batches, the settings, the records of finished exercises, saved radar maps, stored user settings) is kept by the browser on that computer, for that address. It is not in the file. Two consequences:

- A different browser, a different Windows user or a different address starts empty.
- Clearing the browser's stored data for the page removes it. Keep the records as {ref:keeping-records} describes.

## One computer {#installing-one}

1. Double-click `radar-simulator.html`, or drag it into Chrome or Edge. The login box appears ({fig:login}).
2. Press [[Free practice without names]]. The radar is transmitting on the 6 NM range scale in the scenario "Open sea traffic".
3. Press F11 for full screen.

To open the instructor station on the same computer, open a second browser tab and add `#instructor` to the end of the address in the address bar, for example `file:///C:/radar/radar-simulator.html#instructor`. Type the instructor PIN. Tabs of the same browser on the same computer find each other by themselves: the display appears on the station's CLASSROOM page within a few seconds.

This is the quickest way to learn the instructor station and to show the simulator to someone.

@fig login | 62 | The first screen of a display. Choose the batch and names, or press Free practice without names.

## A classroom of several computers {#classroom-server}

Displays on different computers cannot see each other by themselves. One computer runs the **classroom server**, a small program that serves the simulator's page to the others and passes short messages between them. It needs Node.js and nothing else: no database and no installation.

1. On the computer chosen as server (usually the instructor's), install Node.js once, from its own website.
2. Copy the whole project folder to that computer.
3. Open a command window in the project folder and type `npm run serve`. It prints something like this:

```
Radar simulator classroom server running.
  This computer:   http://localhost:8080/
  Other computers: http://192.168.1.20:8080/
Records and class settings are kept in: C:\radar-sim\data
Station key (type it once at the instructor station, RECORDS, "Server key"): RVQA-TC46-9BGG-4WFA
Training use only. Press Ctrl+C to stop.
```

4. On every display, open the address printed after "Other computers" in Chrome or Edge.
5. On the instructor's computer, open the same address followed by `/instructor`, for example `http://192.168.1.20:8080/instructor`, and type the instructor PIN.
6. On the station's CLASSROOM page the line under "Monitor other displays" reads `Link: server`, and each display appears as a card within a few seconds of opening.
7. If the records are to be kept on the server's disk, type the station key once at the station ({ref:station-key}).

Leave the command window open for as long as the class lasts. Closing it, or pressing Ctrl+C in it, stops the server. If the server stops, each display shows `server out of reach (trying again)` and links up again by itself when the server is back; the exercise on the display goes on meanwhile.

!!! note "Things that commonly need attention"
    - The first time the server runs, Windows may ask whether Node.js may be reached from the network. Allow it for private networks, or the other computers cannot open the address.
    - The address contains the server computer's network address. If that changes (many networks give a computer a new address after a restart), the displays must open the new one. Ask whoever looks after the network for a fixed address for the server computer.
    - The port is 8080. To use another, set the environment variable `PORT` before starting the server. To keep the records in another folder, set `RADAR_SIM_DATA`.

!!! important "Classroom network only"
    Nothing the server sends or receives is encrypted, and the station key travels in clear. Run it on the classroom's own network, never on the internet. The folder `data` holds trainees' names and results: look after it as the institute looks after its other records ({ref:keeping-records}).

The link between a station and displays has been proved with five separate browsers going through the server on one computer. At the date of this edition it has **not** been tried on separate computers over a classroom network. Try it with all the classroom's computers before the first class.

## A copy on a web site {#installing-hosted}

The page can also be put on a web site (the project's `vercel.json` does this for Vercel: the display at the site's address, the station at the address followed by `/instructor`). Such a copy serves the page only. It has no classroom server, so:

- the station and the displays find each other only when they are open in tabs of the same browser on the same computer;
- displays on other computers do not appear on the CLASSROOM page, their records do not reach the station, and the station's batches do not reach them. The station says `no classroom server at this address (a hosted copy)`;
- the records stay in each browser, and a backup file is the only way to keep them ({ref:backup}).

A hosted copy is good for showing the simulator and for a trainee's own practice. For a class on several computers, run the classroom server.

## Two screens at a display {#two-screens}

A display with two screens shows the radar on one and the ship control window on the other.

1. Press [[SHIP CONTROL]] in the header of the radar screen. A second window opens.
2. Drag it to the second screen. On a computer with two screens Chrome and Edge may ask once whether the page may place windows: allow it, and the window goes to the other screen by itself from then on.
3. If no window opens, the browser has blocked it. Click the icon at the right of the address bar, allow pop-up windows for this page, and press [[SHIP CONTROL]] again.

The two windows are one simulator: the exercise, the record and the score are the same as with one window. Close the ship control window and its controls go back into the menu of the radar screen. On a single screen the two windows can be put side by side: the simulation keeps running while either can be seen. This has been checked in a test browser, not yet on a classroom's own computers and screens.

## Locking a display to the simulator {#kiosk}

During an assessment a trainee should not be able to leave the simulator for other programs. The simulator runs in a browser, so this is done with the browser's kiosk mode. On Windows, make a shortcut with one of these as its target, with the real path of the file or the address of the classroom server in place of the example:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk "http://192.168.1.20:8080/"
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "http://192.168.1.20:8080/" --edge-kiosk-type=fullscreen
```

The browser then fills the screen with no address bar, tabs or window buttons. Alt+F4 still closes it and Alt+Tab still changes to another program: to stop those too, the computer's administrator sets up a Windows "assigned access" (kiosk) account for the trainees.

This procedure has not been tried on a classroom's computers, and how the ship control window behaves in kiosk mode has not been tried either. Try both before relying on them.

## Before the first class {#installing-checklist}

1. Start the classroom server and open the display on every trainee computer and the station on the instructor's. Check that every display has a card on the CLASSROOM page.
2. At the station, change the instructor PIN from 0000 ({ref:instructor-pin}).
3. Make the batch and type the trainees' names ({ref:batches}).
4. Type the station key so that the records are kept on the server ({ref:station-key}).
5. Start one exercise on all displays, finish it on one, and check that its record arrives on the RECORDS page.
6. Run the self-test of the exercises ({ref:self-test}).
7. Decide the pass mark and the tolerances, or decide to leave them as placeholders and to say so to the trainees ({ref:scoring-settings}).

# Logging in and the first ten minutes {#first-ten-minutes}

<p class="lead">This chapter takes a new user from the login box to a tracked target with its data on the screen. Everything it touches is explained fully in Part B.</p>

## Logging in {#login}

The first screen of a display asks who is working at it ({fig:login}).

- **Free practice without names** opens the radar at once. Nothing is recorded under a name. Use it to learn the controls.
- **Start as student**: choose the batch, then one name for each trainee at the display, and press [[Start as student]]. The names go into the record of every exercise done at this display. The instructor sets how many trainees may share a display (two unless changed).

The batches and names come from the instructor station and reach every display a few seconds after it opens. If the Batch list shows only "(no batch)", the display has not heard from the station yet, or no batch has been made: names can then be typed.

The person icon at the top right of the screen opens the login box again, to change the names.

## Logging in with a PIN {#pin-login}

The instructor may have set the class so that each trainee logs in with a PIN of his or her own. The login box then works like this:

1. Choose your batch. Then choose your name from the list. Names cannot be typed.
2. **The first time**, choose a PIN of 4 to 8 digits and type it twice. From then on it is yours.
3. **After that**, type your PIN once.
4. Two trainees at one display each choose their own name and type their own PIN.

Keep the PIN to yourself: it is what makes a record and a result yours, and it lets you see your own results from any display ({ref:my-results}). If you forget it, the instructor resets it and you choose a new one at your next login.

@fig login-batch | 58 | Logging in with a batch: the names are chosen from the list the instructor made.

!!! note "What the PIN is, and is not"
    The PIN keeps one trainee from logging in as another in a classroom. It is not real security: see {ref:accounts}.

## The first ten minutes {#ten-minutes}

Open the display, press [[Free practice without names]] and follow these steps. The scenario is "Open sea traffic": own ship on 000° at 12 knots with four vessels, a buoy and a yacht around her.

@fig display-annotated | 100 | The radar display. 1 the tabs RADAR, ARPA and EXERCISE; 2 the ship control window; 3 pause or run, the speed of the clock, day or night colours; 4 the ship's clock; 5 the state of the alerts; 6 settings, help and change of names; 7 PICTURE & RADAR CONTROL; 8 GAIN / CLUTTER; 9 EBL / CURSOR; 10 the radar picture; 11 OWN SHIP DATA; 12 TARGET DATA; 13 VRM / ARPA; 14 the MENU key; 15 the statement that this is a training simulator, and the legend of the symbols.

1. **Look at the screen** ({fig:display-annotated}). The radar picture is in the middle. Three panels on the left set the picture up; three on the right show own ship, the targets and the ARPA.
2. **Change the range scale.** In the panel PICTURE & RADAR CONTROL (top left) press [[+]] beside Range: the scale goes from 6 NM to 12 NM and more echoes come into view. Press [[−]] to go back.
3. **Find the echoes.** Echoes are amber. The amber speckle round the centre is sea clutter. AIS targets are small light green-blue triangles.
4. **Measure.** In the panel EBL / CURSOR (bottom left) tick [[EBL 1]]; in VRM / ARPA (bottom right) tick [[VRM 1]]. Move the mouse over the picture: the bearing line and the range ring follow it. Put them on an echo and double-click to lock them. Read the bearing and the range in the two panels.
5. **Acquire a target.** In the panel VRM / ARPA press [[ACQUIRE]], then click an echo. A broken circle appears on it and a row appears in the list in TARGET DATA.
6. **Wait.** After about one minute a faint vector appears; after about three minutes the vector is at full strength and the data is steady. To save time, set the clock in the header to [[10X]] for half a minute, then back to [[1X]].
7. **Read the target's data.** Press [[SELECT]] and click the target (or press its row in the list). TARGET DATA shows its bearing, range, course, speed, CPA and TCPA.
8. **Alter course.** Press [[MENU]] (bottom right), then [[SHIP]]. Drag the bar under "Autopilot course" to 040. Close the menu and watch the heading in OWN SHIP DATA come round, and the picture with it.
9. **Open the help.** Press [[?]] at the top right: a short explanation appears under every control in the menu. Press it again to hide them.
10. **Try an exercise.** Press the [[EXERCISE]] tab in the header and choose "1. Setting up and manual acquisition". Read the briefing, press [[RUN]], and do what it asks ({ref:doing-an-exercise}).
