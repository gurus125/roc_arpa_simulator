%% PART C | Exercises | How an exercise is done and marked, and what each of the 31 marked exercises and the six ROC exercises asks for.

# Doing an exercise {#doing-an-exercise}

<p class="lead">An exercise is a scenario with a briefing, things to do, questions to answer and a result. The simulator checks what it can measure; the instructor judges the rest.</p>

## Choosing an exercise {#ex-choose}

There are three ways in:

- the [[EXERCISE]] tab in the header, or [[MENU]], [[ARPA EX]]: the list of the 31 ARPA, radar and plotting exercises;
- [[MENU]], [[ROC EX]]: the six radar observer exercises ({ref:ex-roc});
- the EXERCISE box of the ship control window, which has both.

Or the instructor starts the exercise on your display from the station: a message says so.

If the instructor has assigned exercises to your batch, those are marked with a star (`★ assigned to your batch`) and only those can be started. With nothing assigned, every exercise is open.

@cols 16 22 62
| Numbers | Group | What they cover |
|---|---|---|
| 1 to 9 | ARPA | Acquisition, vectors, past positions, guard zones, limits and alarms, trial manoeuvre, stabilisation, sensor errors, collision avoidance in restricted visibility |
| 10, 11 | Radar | Parallel index navigation; homing on a SART |
| 12 to 21 | Manual plotting | Ten situations plotted by hand, with the ARPA and AIS off |
| 22 | Radar | Switching on and setting up |
| 23 to 26 | Radar, real areas | Mumbai, Goa, Kochi, Gulf of Kutch |
| 27 to 30 | Radar | A planned route, a traffic separation scheme, man overboard, safe speed |
| 31 | ARPA | A timed test |

## The briefing and how you will be assessed {#ex-briefing}

Choosing an exercise loads its scenario and stops the clock. The exercise page then shows ({fig:exercise-brief}):

- the title and the aim;
- the **briefing**: what to do, step by step;
- `Exercise time 00:00 (paused: press Run)`;
- **How you will be assessed**: every item the simulator will mark, the criterion for each, and its points.

Read all of it before pressing [[RUN]]. Take the planning time you need: the clock is stopped.

@fig exercise-brief | 100 | Exercise 1 just chosen: the briefing, and the table "How you will be assessed" with the criterion and points of each item.

## Working the exercise {#ex-working}

1. Press [[RUN]] in the header.
2. Do what the briefing asks. Close the menu to see the whole screen; open the exercise page again with the [[EXERCISE]] tab.
3. Answer the questions under **Tasks and questions** as the work goes on ({fig:exercise-answers}).
4. When the work is done, press [[Finish exercise]].

Under **Tasks and questions** there are four kinds of line:

@cols 24 76
| Line | What to do |
|---|---|
| `To do: ...` | An action, such as acquiring the targets or switching on a guard zone. When the simulator sees it done, the line shows `✓ done`. Nothing is typed |
| A box for a number, with [[Answer]] | Type the value and press Answer. The line then shows what was recorded and when: `Recorded at 03:52: 0.6 NM` |
| A list of choices, with [[Answer]] | Choose and press Answer |
| `Judged at the end: ...` | An outcome, such as "every ship passed at 2 NM or more". It is judged from what happened in the whole exercise |

A number is compared with the true value **at the moment you press Answer**, because CPA, TCPA, bearing and range change with time. Read the value and answer at once. You can answer again; the last answer counts. If a question cannot be answered yet, because the event it asks about has not happened, the line says so.

@fig exercise-answers | 100 | The tasks and questions of exercise 1 with answers recorded.

## The result {#ex-result}

The result appears at once ({fig:exercise-result}):

- every item with your answer, the correct answer, right or wrong, and the points;
- when more than one trainee answered, who was at the controls for each item;
- the total and the percentage, and `Passed`, `Not yet passed`, or `No pass mark has been set by the instructor`;
- the debrief questions of the exercise.

Under it are three boxes for **your debrief notes**: what went well and what you would do differently; comments from your partner or the trainees who watched (facts, not blame); your goals for next time. Write them and press [[Save notes to the record]]. The record, with the notes, goes to the instructor's station.

@fig exercise-result | 100 | The result of exercise 1: each item, the answer given, the correct answer and the points, then the debrief questions and the trainees' own notes.

!!! important "What the score means"
    The score is a guide. The tolerances and points are placeholders until the institute sets its own, and the simulator cannot see everything that matters: whether the action was taken in good time, how the trainees reported and worked together. The assessor's decision that the task was carried out safely and effectively is what counts.

## Time limits {#ex-time}

Some exercises have a time allowed: exercise 31 has its own 8 minutes, and the instructor can set one for any of the 31 exercises. The time left is shown beside the exercise time, and "Finished within the time allowed" is one of the marked items. The limit is exercise time: it stands still while the exercise is paused.

## An examination {#ex-exam}

The instructor can start a practical examination on your display: several exercises one after the other. When you press Finish on a part, a message offers the next part: click it to start. Target names are switched off. Every part is recorded and marked as usual. Trainees sharing a display take the controls in turn, one part each ({ref:at-controls}).

## If the instructor takes the exercise back or resets it {#ex-back}

A message says so. After the exercise has been taken back in time, the ships are where they were then and the ARPA is empty: acquire the targets again. After a reset the exercise starts from the beginning, and what was done so far is not kept.

## My results {#my-results}

[[EXERCISE]], My results, [[Show my results]] lists your own recorded exercises: a chart of the score at each attempt, each exercise with its first, best and latest score, and the assessor's decisions.

- If you logged in with a PIN, the list comes from the instructor's station and covers every display you have worked at.
- Otherwise it shows what this display has recorded under your name.

## The exercise sheet {#ex-sheet}

The instructor can give you a printed sheet for each exercise: its objective, the briefing, every item the simulator marks with its limit and points, what the instructor will look for and the standard for each item ({ref:exercise-sheets}). It is the same list as "How you will be assessed" on the screen.

# The ARPA exercises: 1 to 9 and 31 {#ex-arpa}

<p class="lead">Ten exercises that build the use of the ARPA in order, from the first acquisition to a full collision-avoidance problem in restricted visibility, and a timed test.</p>

In every table of this chapter and the next two, an **action** is something to do (10 points), a **value** is a number to report (10 points, within the tolerance shown), a **choice** is a question (10 points) and an **outcome** is judged at the end from what happened (20 points). All points and tolerances are placeholders ({ref:marking}).

## Exercise 1: Setting up and manual acquisition {#ex-1}

**Aim.** Set up the display, acquire targets by hand, wait for the data to settle and read it.

**The situation.** Open water, own ship 000° at 12 knots, three ships. Range scale 12 NM.

**What to do.** Check the picture first: range scale, gain and tuning. Acquire each of the three echoes. Do not use the data while a track is preliminary: wait about three minutes. Select each target, read its data and answer.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| All three ships acquired and tracked until steady | Action | |
| CPA of Ship A from the ARPA data | Value | ±0.5 NM |
| TCPA of Ship A | Value | ±2 min |
| Ship B: true course | Value | ±7° |
| Which ship will pass closest? | Choice | |

Total 50 points.

## Exercise 2: True and relative vectors, vector time {#ex-2}

**Aim.** Use both vector modes and the vector time, and understand what each one shows.

**The situation.** Own ship 040° at 14 knots, four ships.

**What to do.** Acquire all four and let the tracks settle. With relative vectors, lengthen the vector time until the vectors reach own ship's position: a vector that points at own ship means risk of collision. Change to true vectors: they show each ship's course and speed, and own ship gets one too. Notice which targets have no vector in each mode, and why.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| All four ships tracked | Action | |
| Relative vectors used | Action | |
| True vectors used | Action | |
| Whose relative vector points at own ship? | Choice | |
| Which ship has no true vector, and what does that mean? | Choice | |
| Which ship has no relative vector, and what does that mean? | Choice | |
| Ship D: true course | Value | ±7° |
| Ship D: true speed | Value | ±1.5 kn |

Total 80 points.

## Exercise 3: Past positions and a target's manoeuvre {#ex-3}

**Aim.** Use the history display to see what a target has been doing, and see how late the ARPA shows a manoeuvre.

**What to do.** Acquire the three ships. When the tracks are steady, switch on past positions (true, one minute apart). One ship alters course during the exercise: watch how long the vector takes to show the new course. A warning tells you when the ARPA has noticed.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| All three ships tracked | Action | |
| Past positions displayed | Action | |
| Which ship altered course? | Choice | |
| New course of the ship that altered (answer when its vector has settled again) | Value | ±7° |
| CPA of Ship H after its alteration | Value | ±0.5 NM |

Total 50 points.

## Exercise 4: Automatic acquisition, guard zones and exclusion areas {#ex-4}

**Aim.** Set guard zones and automatic acquisition in coastal waters, and keep rocks, small pieces of land and clutter out with exclusion areas.

**The situation.** Coastal waters, own ship 000° at 10 knots, a current setting 045° at 1.5 knots. Safe distance 0.5 NM.

**What to do.** Switch Guard 1 on as a ring from 5.5 to 6 NM and tick automatic acquisition. The coast itself is not acquired, but the two rocks to the north-east (bearing 032° and 039° at 5.8 NM) are, as if they were ships. Set an exclusion area over them, cancel the false targets and watch the difference. A target that first appears inside the guard ring is not acquired: acquire it by hand. Acknowledge the new-target warnings.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Guard zone switched on | Action | |
| Automatic acquisition used | Action | |
| Exclusion area set | Action | |
| Coaster G and Bulk carrier H tracked | Action | |
| Alarms acknowledged | Action | |
| A small boat appears for the first time between own ship and the guard ring. What happens? | Choice | |

Total 60 points.

## Exercise 5: CPA/TCPA limits, alarms and bow crossing {#ex-5}

**Aim.** Set safe limits, respond to the dangerous-target alarm and use the bow crossing data.

**The situation.** Own ship 000° at 15 knots, four ships. Safe distance 2 NM.

**What to do.** Set the CPA limit to 2.0 NM and the TCPA limit to 20 minutes. Acquire all four ships. A target that will pass inside both limits gives the dangerous-target alarm. Acknowledge it, then read that target's data, including bow crossing range and time.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Limits set to CPA 2.0 NM and TCPA 20 min | Action | |
| All four ships tracked | Action | |
| Dangerous-target alarm acknowledged | Action | |
| Which ship gives the dangerous-target alarm (inside both limits)? | Choice | |
| Bow crossing range (BCR) of Ship L | Value | ±0.5 NM |
| Ship N is overtaking from astern with CPA near zero but gives no alarm yet. Why? | Choice | |

Total 60 points.

## Exercise 6: Trial manoeuvre {#ex-6}

**Aim.** Use the trial manoeuvre to find an alteration that clears every target, then carry it out.

**The situation.** Good visibility, the ships in sight. Own ship 000° at 14 knots. Ship Q is crossing from starboard on a collision course: own ship gives way. Safe distance 2 NM.

**What to do.** Acquire all three ships. Switch the trial on. Try alterations to starboard until every target clears by 2 NM or more, and check that the new course does not make a problem with Ship R. Answer the question, switch the trial off, then make the alteration. Resume course when Ship Q is past and clear.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| All three ships tracked | Action | |
| Trial manoeuvre used | Action | |
| Smallest alteration to starboard, to the nearest 10°, made now, that clears every ship by 2 NM | Value | ±10° |
| Action taken, large enough to be readily apparent (the timing is for the assessor) | Outcome | A turn of at least 30°, or a cut to half speed or less |
| Every ship passed at 2 NM or more | Outcome | |

Total 70 points.

## Exercise 7: Sea and ground stabilisation in a current {#ex-7}

**Aim.** See the difference between movement through the water and over the ground, and find the set and drift.

**The situation.** Own ship 000° at 10 knots; a current setting 070° at 2.5 knots; a light float and Ship T.

**What to do.** The ARPA starts sea stabilised. Acquire the light float and Ship T: the float seems to move, and its true vector is the reverse of the set and drift. Select the float and choose ground stabilisation: it becomes the fixed reference, and true vectors now show movement over the ground.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Light float and Ship T tracked | Action | |
| Ship T: course through the water (sea stabilised) | Value | ±7° |
| Light float designated as the ground reference | Action | |
| Ship T: course over the ground (ground stabilised) | Value | ±7° |
| Set of the current | Value | ±15° |
| Drift of the current | Value | ±0.7 kn |

Total 60 points.

## Exercise 8: Sensor errors and ARPA limitations {#ex-8}

**Aim.** Recognise wrong gyro and log inputs and a lost target, and know what the ARPA cannot tell you.

**The situation.** Own ship 000° at 12 knots on the 6 NM range scale; a ship, a fishing boat with a weak echo, and a beacon.

**What to do.** Acquire all three and note the heading, the log and the beacon's data while everything is correct. During the exercise a sensor input goes wrong. The ARPA gives **no** alarm for a wrong gyro or log: compare readouts. The fishing boat's echo is weak and she is opening: watch for `FADE` and `LOST`, and acknowledge the warning. Run the ARPA self-test once.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Ship U and Beacon W tracked | Action | |
| Self-test run | Action | |
| An alarm acknowledged (lost target) | Action | |
| Which input is wrong now? | Choice | |
| Gyro error (+ if the gyro reads high); answer when it has stopped changing | Value | ±1° |
| With a steady gyro error, which ARPA data stays correct? | Choice | |

Total 60 points.

## Exercise 9: Collision avoidance in restricted visibility {#ex-9}

**Aim.** Make a full appraisal of several ships by ARPA and take action that complies with rule 19.

**The situation.** Visibility 0.5 NM, a rain area, own ship 000° at 12 knots, four ships. No ship is in sight: every decision is made on radar information alone. Safe distance 2 NM.

**What to do.** Acquire all ships and make a full appraisal: CPA, TCPA, course, speed and aspect of each. Use the trial manoeuvre before acting. Take action in ample time, large enough to be seen on another ship's radar. Keep checking until all ships are past and clear, then resume course.

@cols 46 12 42
| Marked | Kind | How it is judged |
|---|---|---|
| All four ships tracked | Action | |
| With which ship is a close-quarters situation developing? | Choice | |
| Trial manoeuvre used before acting | Action | |
| Action complied with rule 19(d) and was large enough (rule 8) | Outcome | A turn of at least 30° or a cut to half speed or less; no turn to port for a vessel forward of the beam other than one being overtaken; no turn towards a vessel abeam or abaft the beam |
| Every ship passed at 2 NM or more | Outcome | None is still closing inside that distance at the end |

Total 70 points.

## Exercise 31: Timed test: acquire, assess and report {#ex-31}

**Aim.** Against the clock: acquire every target, wait for steady data, and report the most dangerous one.

**The situation.** Own ship 020° at 14 knots, six ships, 8 minutes of exercise time. The time left is shown with the questions.

**What to do.** Acquire all six ships. Do not report from preliminary data: a track needs about three minutes. Report the target with the smallest CPA, then press Finish before the time is up.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| All six targets acquired and tracked steadily | Action | |
| All six targets being tracked when Finish was pressed | Outcome | |
| Which ship has the smallest CPA? | Choice | |
| Ship A: CPA | Value | ±0.5 NM |
| Ship A: TCPA | Value | ±2 min |
| Ship F: true bearing now | Value | ±3° |
| Ship F: range now | Value | ±0.5 NM |
| Finished within the time allowed (8 min) | Outcome | |

Total 100 points.

# The radar exercises: 10, 11 and 22 to 30 {#ex-radar}

<p class="lead">Eleven exercises on the radar as a navigation instrument: setting it up, keeping to a track, fixing the position, anchoring, finding a survival craft, and navigating in traffic, in a separation scheme and in restricted visibility.</p>

## Exercise 10: Parallel index navigation and radar map {#ex-10}

**Aim.** Keep the ship on a planned track past a headland by parallel indexing, in a cross current.

**The situation.** Planned track 000°, to pass Point Light 1.5 NM off to starboard. A shoal lies 0.9 NM to port of the track abeam of the light. Own ship 000° at 10 knots; a current setting 090° at 1.5 knots. Range scale 6 NM.

**What to do.** Switch on a parallel index line, bearing 000°, distance 1.5 NM to starboard. On track, the echo of the light slides down the line. Work out the course to steer for the current, apply it, and keep correcting by the index line. Draw a navigation line 0.5 NM to port of the track as a limit towards the shoal. Use a ground-stabilised, north-up picture.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Parallel index line set: 000°, 1.5 NM to starboard | Action | |
| A navigation line drawn on the radar picture | Action | |
| Course to steer to make good 000° at the present speed | Value | ±3° |
| Kept within 0.25 NM of the track until past the light | Outcome | |
| The echo of the light moves from the index line towards the heading line. What is happening? | Choice | |

Total 60 points.

## Exercise 11: Search and rescue: homing on a SART {#ex-11}

**Aim.** Recognise SART and racon responses and use the radar to close a survival craft safely.

**The situation.** A distress alert has been received. Own ship 020° at 14 knots, sea state 3.

**What to do.** Use the 12 NM range scale on X band. Find the line of 12 dots: the SART is at the dot nearest own ship. Do not use the rain clutter control heavily; reduce the gain if the dots smear. Steer for the first dot and slow down in good time: inside about 1 NM the dots widen into arcs and then rings. The flash to the north-west is a racon: read its Morse letter.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| On the line of 12 dots, where is the survival craft? | Choice | |
| Range of the SART now | Value | ±0.5 NM |
| True bearing of the SART now | Value | ±3° |
| Which Morse letter does the racon show? | Choice | |
| Why is nothing seen of the SART on S band? | Choice | |
| Closed the survival craft to 0.5 NM or less, at 6 kn or less when closest | Outcome | |

Total 70 points.

## Exercise 22: Switching on and setting up the radar {#ex-22}

**Aim.** Switch the radar on from cold and set it up for the best picture, in the right order, then check its performance.

**The situation.** The radar is switched off and its controls are badly set. Own ship 000° at 10 knots, sea state 3, wind from 045° at 18 knots.

**What to do.** Follow the order of {ref:picture-order}: switch on, wait, transmit; brilliance; sea and rain to zero and the processing off; gain to a light speckle; tune; judge the picture on the 12 NM scale; check with the performance monitor; last, the sea clutter control as the sea needs.

@cols 46 12 42
| Marked | Kind | How it is judged |
|---|---|---|
| Radar switched on, warmed up and put to transmit | Action | |
| Brilliance raised so that the picture can be seen | Action | Brilliance 40 or more |
| Gain set to a light speckle of noise with sea and rain at zero and the processing off | Action | Speckle over 2% to 25% of the picture; sea and rain at 5 or less |
| Tuned for the best picture | Action | Within 6 of the best, on the scale of 0 to 100 |
| Picture judged on the 12 NM range scale | Action | |
| Performance checked with the performance monitor | Action | |
| At the end: transmitting, gain giving a light speckle, tuning right | Outcome | |
| Once the radar is transmitting, which control is set first? | Choice | |
| What should the tuning be judged on? | Choice | |

Total 100 points. The instructor can change these limits ({ref:scoring-settings}).

## Exercise 23: Mumbai: radar fix with the GNSS failed {#ex-23}

**Aim.** Fix the ship's position by radar range and bearing when the GNSS has failed, close to a real coast, and keep clear of the land.

**The situation.** The GNSS has failed from the start: no position anywhere. Own ship is closing Mumbai on 060° at 8 knots, about 6 NM off the coast, with a current.

**What to do.** Identify Malabar Point (18°56.9'N 072°47.5'E, the west tip of the high ground north of Back Bay), which gives a strong echo. Measure its range with the VRM and its bearing with the EBL at the same moment. Plot the fix, or work it: latitude = 18°56.9' − range × cos(bearing), in minutes; longitude = 072°47.5' − range × sin(bearing) ÷ cos(18.9°), in minutes. Check the fix with a second position line that crosses the first well. Fix again at intervals: the ship is closing the land.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Range of Malabar Point now | Value | ±0.5 NM |
| True bearing of Malabar Point now | Value | ±3° |
| Own ship's latitude now (minutes north of 18°) | Value | ±0.5' |
| Own ship's longitude now (minutes east of 072°) | Value | ±0.53' |
| Which gives the most reliable radar fix? | Choice | |
| Why is a fix by radar ranges usually better than one by radar bearings? | Choice | |
| Kept at least 1 NM off the land | Outcome | |

Total 80 points. The simulator has no depths: the 1 NM is a placeholder margin, not a safe distance off that coast.

## Exercise 24: Goa: parallel index approach, anchoring and anchor watch {#ex-24}

**Aim.** Approach the Mormugao anchorage on a planned track by parallel indexing, anchor in the planned position, and keep an anchor watch with the ARPA.

**The situation.** Planned track 090° to the anchor position 15°24.0'N 073°42.0'E. Mormugao Point (15°24.5'N 073°47.0'E, a strong echo) lies ahead, 0.54 NM to port of the track line. A current sets 160° at 0.5 knots. A buoy has been laid for the exercise about 0.9 NM south-west of the anchor position.

**What to do.** Set a parallel index line 090°, 0.54 NM to port (bearing 090, distance −0.54). Work out the course to steer and keep correcting it by the index line. Work out the range of Mormugao Point from the anchor position and set the VRM to it. Reduce speed in good time and let go the anchor, below 1 knot over the ground, where the point's echo meets the VRM on the index line. At anchor, acquire the buoy and set the anchor watch on it. Ten minutes after the anchor is let go it drags: the anchor watch gives its warning.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Parallel index line set: 090°, 0.54 NM to port | Action | |
| Course to steer to make good 090° at your present speed | Value | ±3° |
| Range of Mormugao Point from the anchor position (the VRM setting) | Value | ±0.1 NM |
| Kept within 0.25 NM of the planned track, and anchored | Outcome | |
| Anchored within 0.3 NM of the planned position | Outcome | |
| At anchor, anchor watch set on the anchorage buoy | Action | |
| Anchor watch alarm acknowledged | Action | |
| The anchor watch alarm sounds: the buoy's echo has moved from its mark. What is most likely, and what do you check? | Choice | |

Total 100 points.

## Exercise 25: Kochi: collision avoidance in restricted visibility off a low coast {#ex-25}

**Aim.** Use radar and ARPA to avoid close-quarters situations in restricted visibility, with small craft in rain and a low coast ahead.

**The situation.** Visibility about 1 NM. Own ship 090° at 12 knots. A container ship nearly ahead, an LNG carrier on the starboard bow, fishing boats (one in a rain squall), a tanker at anchor.

**What to do.** Acquire the container ship and the LNG carrier, and the fishing boats when they show. Use the rain clutter control with care. Find each ship's CPA and TCPA. Use the trial manoeuvre before you act. Take action in good time, substantial, and in line with rule 19(d). Watch when the low coast first shows.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Container ship and LNG carrier tracked | Action | |
| CPA of the container ship | Value | ±0.5 NM |
| TCPA of the container ship | Value | ±2 min |
| CPA of the LNG carrier | Value | ±0.5 NM |
| The container ship is fine on the bow and closing. In restricted visibility you should ... | Choice | |
| The low coast ahead shows late compared with a high coast. Why? | Choice | |
| Action substantial and in line with rule 19(d) | Outcome | As in exercise 9 |
| Every vessel passed at 1 NM or more | Outcome | |

Total 100 points.

## Exercise 26: Gulf of Kutch: tidal stream, ground stabilisation and a meeting ship {#ex-26}

**Aim.** Find the tidal stream with a fixed echo as the ARPA's ground reference, tell movement through the water from movement over the ground, and pass a meeting ship safely.

**The situation.** Own ship 080° at 12 knots. The flood stream runs 075° into the gulf and is getting stronger. A tanker at anchor, a container ship meeting nearly end on, a VLCC.

**What to do.** Acquire the three ships. Sea stabilised, the tanker at anchor shows the stream reversed: read the set and rate from her true vector. Then select her and choose ground stabilisation. Compare the vectors in the two modes. Act in time for the container ship, as the collision regulations require.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Tanker at anchor, container ship and VLCC tracked | Action | |
| Tanker at anchor made the ground reference | Action | |
| Set of the tidal stream now | Value | ±15° |
| Rate of the tidal stream now | Value | ±0.7 kn |
| CPA of the container ship | Value | ±0.5 NM |
| TCPA of the container ship | Value | ±2 min |
| Which true vectors show another ship's heading (her aspect)? | Choice | |
| Why is a ship at anchor not an ideal ground reference for long? | Choice | |
| Action large enough to be readily apparent | Outcome | As in exercise 6 |
| Every vessel passed at 1 NM or more | Outcome | |

Total 120 points.

In exercises 23 to 26 the ships, the current and the stream are invented, the buoy in exercise 24 is laid for the exercise, and the positions of the reference points come from the coastline data (about 250 m accuracy), not from a chart.

## Exercise 27: Monitoring a planned route on the radar {#ex-27}

**Aim.** Keep the ship on a planned route of three legs with the radar: the route on the picture, the distance off the track, and the course to steer in a current.

**The situation.** A route of three legs, 040° for 3 NM, 090° for 2.5 NM and 030° for 2.5 NM, past two buoys, with a current setting 110° at 1.5 knots across it. Own ship 040° at 12 knots. Range scale 6 NM.

**What to do.** The route is already on the radar. Steer so that XTD stays small, and alter course in good time at each waypoint: a ship does not turn at once. Check the route against the radar: buoy No. 1 should pass close to starboard at the first waypoint and buoy No. 2 close to starboard at the second. Press Finish when the last waypoint is passed.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Course to steer now to make good the track of the leg you are on | Value | ±7° |
| On the first leg, with the current setting 110°, where does the ship go if she steers 040°? | Choice | |
| The panel shows XTD 0.20 S. What does it mean? | Choice | |
| Kept within 0.25 NM of the route | Outcome | |
| Route completed: the last waypoint passed | Outcome | |

Total 70 points.

## Exercise 28: Traffic separation scheme with dense traffic {#ex-28}

**Aim.** Take the ship through a traffic separation scheme in dense traffic: the correct lane, the flow of traffic, a crossing vessel and a slower ship ahead.

**The situation.** The scheme runs north and south and is drawn on the radar. Own ship is bound north at 12 knots. A ferry is crossing the lanes from the east on a collision course; a slower ship is ahead in the lane; a faster one is coming up astern; there is southbound traffic and a fishing boat in the separation zone.

**What to do.** Stay in the lane for northbound traffic and go with the flow. Keep out of the separation zone. Acquire the ships. Rule 10 does not take away any other rule: decide who gives way in each case and act in good time, staying in your lane if you can. Press Finish when the ferry and the slow ship are past and clear.

@cols 46 12 42
| Marked | Kind | How it is judged |
|---|---|---|
| The crossing ferry and the slow ship ahead tracked | Action | |
| Ferry: CPA if nobody acts | Value | ±0.5 NM |
| Bound north in this scheme, which lane does own ship use? | Choice | |
| The ferry is crossing from own ship's starboard side with risk of collision. Who keeps out of the way? | Choice | |
| How should a vessel that has to cross the lanes do it? | Choice | |
| Kept in the northbound lane with the flow, clear of the separation zone | Outcome | Not more than 30 seconds in all in the separation zone or against the flow |
| Every vessel passed at a safe distance | Outcome | 0.5 NM or more |

Total 90 points.

## Exercise 29: Man overboard {#ex-29}

**Aim.** Mark a man overboard at once, bring the ship back to the position, and lay a search pattern on the radar from the datum.

**The situation.** Own ship 350° at 14 knots in open water. Two minutes after the start the look-out reports a man overboard, in a message on the display. The person gives no radar echo.

**What to do.** At the report, press [[MOB]] at once. Turn back: a Williamson turn brings the ship onto the reciprocal of her course, back along her own track. Reduce speed as you come back to the mark. Then lay a search pattern from the MOB mark, as you would if the person were not sighted.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| MOB key pressed within 30 s of the report | Outcome | |
| The person fell from the starboard side. What is the first rudder order? | Choice | |
| In a Williamson turn, when is the rudder put hard over the other way? | Choice | |
| Course to steady on after the turn (the reciprocal of 350°) | Value | ±2° |
| An expanding square search has a track spacing S. How long are its first four legs? | Choice | |
| Back to within 0.1 NM of the person at 5 kn or less | Outcome | |
| A search pattern laid on the radar | Action | |

Total 90 points.

## Exercise 30: Safe speed in restricted visibility {#ex-30}

**Aim.** Judge a safe speed when the visibility closes in rain with small craft about: what the radar can and cannot show, and how far the ship needs to stop.

**The situation.** Own ship 000° at 16 knots, sea speed. A rain area lies ahead with three fishing boats in it. Three minutes after the start the bridge reports that the visibility has closed to 0.8 NM.

**What to do.** From the report on, rule 19 applies. Bring the speed down. Use the radar to find the boats: try S band, a shorter pulse, the rain clutter control and a shorter range scale. Press Finish when the fishing boats are past and clear.

@cols 60 14 26
| Marked | Kind | Tolerance |
|---|---|---|
| Which of these must a vessel with radar take into account in deciding her safe speed (rule 6)? | Choice | |
| In restricted visibility a power-driven vessel shall have her engines: ... | Choice | |
| Why may a fishing boat inside the rain not be seen on X band? | Choice | |
| Speed down to 8 kn or less within 8 min of the visibility closing | Outcome | |
| Every vessel passed at 0.5 NM or more | Outcome | |

Total 70 points.

!!! placeholder "Placeholder"
    The "safe speed" of 8 knots in exercise 30 is only a figure to mark against. On board it is the master's judgement of the ship, the traffic and how far the radar can be relied on. Every limit of exercises 27 to 31 is a placeholder, and the questions on the collision regulations and on search patterns should be checked by an instructor.

# The manual plotting exercises: 12 to 21 {#ex-plotting}

<p class="lead">Ten situations to be plotted by hand on a plotting sheet, from the radar alone. The ARPA is in standby and the AIS display is locked off until Finish is pressed.</p>

## How they work {#plotting-how}

All ten have the same form.

1. Own ship is the **exercise ship**: she turns at 30° a minute and changes speed at 3 knots a minute, so that a plotted manoeuvre can be checked by hand.
2. Take the range and bearing of each target with EBL 1 and VRM 1 at regular intervals, for example every 6 minutes, and plot them on a plotting sheet. Relative trails may be used.
3. From the plot, find each target's CPA, TCPA, course and speed. Enter the answers for the **most dangerous target** before you manoeuvre.
4. **At 12 minutes, not before**, alter course or speed, or both, so that every target passes at 1 NM. Turns to port are generally not allowed.
5. Run until every target is past and clear, then press Finish.

## The ten situations {#plotting-list}

@cols 12 16 40 32
| Exercise | Plotting no. | Targets | Own ship at the start |
|---|---|---|---|
| 12 | 01 | 1 target | 330° at 17 kn |
| 13 | 02 | 2 targets | 000° at 12 kn |
| 14 | 03 | 2 targets | 045° at 15 kn |
| 15 | 04 | 2 targets, restricted visibility | 090° at 10 kn |
| 16 | 05 | 3 targets | 180° at 14 kn |
| 17 | 06 | 3 targets, restricted visibility | 270° at 12 kn |
| 18 | 07 | 3 targets | 020° at 16 kn |
| 19 | 08 | 1 target | 135° at 13 kn |
| 20 | 09 | 2 targets, restricted visibility | 225° at 11 kn |
| 21 | 10 | 4 targets | 300° at 15 kn |

## How they are marked {#plotting-marking}

@cols 46 12 42
| Marked | Kind | How it is judged |
|---|---|---|
| Most dangerous target: CPA if no action is taken | Value | ±0.5 NM |
| Most dangerous target: TCPA from now | Value | ±2 min |
| Most dangerous target: true course | Value | ±7° |
| Most dangerous target: true speed | Value | ±1.5 kn |
| Every target passed at the required 1 NM (result at least 80%) | Outcome | See below |
| Manoeuvre made at 12 minutes, not before | Outcome | The first change of course or speed not before 12 minutes |
| No turn to port | Outcome | No turn of 5° or more to port |
| Worked by manual plotting (ARPA not used) | Outcome | No target tracked by the ARPA |

Total 120 points.

**The result as a percentage.** The closest approach achieved to the vessel that came closest is set against the required 1 NM. Closer than required scores the fraction achieved: 0.87 NM is 87%. Wider than required loses half as much: 1.3 NM is 85%. At least 80% is needed.

The form and the marking of these exercises follow a plotting trainer the institute supplied as a reference. The ten situations are the project's own.

# The six ROC exercises {#ex-roc}

<p class="lead">The radar observer exercises are worked on the radar with a worksheet beside it: a plotting board, a chart and a vector triangle. The ARPA and the AIS are off throughout.</p>

## How an ROC exercise is worked {#roc-how}

1. [[MENU]], [[ROC EX]] (or the ROC key of the ship control window). Choose the exercise. Its description and steps are shown.
2. Press [[Start exercise]].
3. Work on the radar: put the EBL and the VRM on an echo (a click on the echo puts both on it), then press [[Take observation]]. The observation is added to the list with its time.
4. To let time pass, type the minutes beside the advance key and press it: the simulation runs forward by that much.
5. Use the **work area** ({fig:roc-plot}): the **Plotting board** shows the observations as a relative plot; the **Chart** shows the charted objects, your fixes and the planned track; the **Vector triangle** shows the working of a plot.
6. Type the answers and press the check key, or press [[Finish now]].
7. The report and a table of points appear. [[Download record]] saves the record as a file.

@fig roc-plot | 100 | The ROC plotting exercise: three observations of a target on the plotting board, six minutes apart.

[[Delete last]] removes the last observation and [[Clear all]] removes them all. An observation that did not match any echo is refused: the EBL and VRM were not on a target.

!!! important "The first check counts"
    In the plotting exercise and in set and drift, the answers that count are those of your **first** check. The report then shows the real values, so later checks are for learning and do not change the points. A fix is marked as it stands when you first complete it, that is, when the second charted object has been observed: choose your objects before you start.

## Fixing by ranges or by bearings {#roc-fix-how}

In position fixing and in set and drift, **Use for the fix** chooses what an observation gives:

- range and bearing;
- the range only: a circle of position;
- the bearing only.

Put the EBL and the VRM on the object as before, so that the simulator knows which object it is; only the reading you chose is used. Two or three ranges of well-separated objects usually give the best radar fix. Position lines taken at different times are run on with the ship's course and speed (a running fix). The result gives the angle of cut.

## Plotting: relative motion, CPA and TCPA {#roc-plot}

Plot a crossing ship from successive radar observations. Own ship (000° at 12 knots) must hold her course and speed while you plot; if she alters, the plot is not valid. Take three observations or more, about six minutes apart, of **one** target. The simulator accepts two, with a warning that two cannot show whether the target is steady.

The report asks for the full result of the plot:

@cols 36 20 44
| Marked | Tolerance | |
|---|---|---|
| Relative course and relative speed | ±3°, ±0.5 kn | |
| True course and true speed | ±3°, ±0.5 kn | |
| CPA and TCPA | ±0.2 NM, ±1.5 min | |
| Aspect at the last observation | ±5° | See below |
| Does risk of collision exist? | | Yes or no |
| The situation under the collision regulations | | No risk, head-on, crossing (give way), crossing (stand on), overtaking, being overtaken |

Nine items, 90 points.

**Aspect** is the angle between the target's course and the line from the target to your ship, as seen from the target: **Red** when your ship is on its port side, **Green** when on its starboard side, from 0° (you are right ahead of it) to 180° (right astern). A target steering 270° that bears 050° from you has you bearing 230° from it, 40° to the left of its course: Red 40°.

## Position fixing by radar ranges and bearings {#roc-fix}

Fix own ship's position from charted fixed objects. Take observations of at least two different objects, quickly, with bearings that differ widely. The simulator works the fix and tells you how far it is from the true position.

Marked: the fix within 0.15 NM of the true position (10 points); the position lines crossing at 30° or more (20 points). Total 30.

## Set and drift from radar fixes {#roc-setdrift}

Own ship holds a steady course and speed through the water (000° at 8 knots). Take fix 1 from two or more charted objects. Press [[Start next fix]], let about 15 minutes pass, and take fix 2. Work out the set and drift from the difference between the dead-reckoned position and the second fix. Enter the answer and check.

Marked: fix 1 and fix 2 each within 0.15 NM (10 points each); the set within ±10° and the drift within ±0.3 knots (10 points each). Total 40.

## Clearing range from a charted object {#roc-clearing}

A shoal lies offshore. Find it on the chart. Work out the distance from the lighthouse to the shoal, add the shoal's radius and the margin of 0.3 NM, set the VRM to that range and press [[Record clearing range]]. Then take the ship north along the coast so that the lighthouse stays outside the VRM ring. A current is running.

Marked: the clearing range recorded is large enough (10 points); the ship never came inside the range she recorded (20); she did not ground or run onto the shoal (20). Total 50.

## Blind pilotage through a channel {#roc-pilotage}

In fog, take the ship through a channel using the radar only. The planned track runs up the middle; the chart shows the plan, and does not show where you are. Fix the position from the buoys (P on the port side, S on the starboard side) and the banks, keep to the track, and use the VRM as a clearing line against a bank if it helps. A current sets across the channel.

Marked: the last waypoint reached (10 points); never more than 0.4 NM off the track (20); the ship did not ground (20). Total 50.

## Collision avoidance in heavy traffic {#roc-traffic}

Eight ships around own ship (000° at 12 knots); several are on collision courses. Observe the traffic and plot the ships you think are a danger. Decide on an alteration that is early, large and in line with the collision regulations. Carry it out, and keep watching to confirm that the risk is reducing. The exercise ends after 40 minutes, or when Finish is pressed.

Marked: every ship passed at 1 NM or more (20 points); action in ample time, that is, while the critical ship was still 4 NM off or 12 minutes from her closest approach (20); action large enough, an alteration of 30° or more (20). Total 60. The notes the report gives about the collision regulations are advice and carry no points.

!!! placeholder "Placeholder"
    Every limit and every number of points in the six ROC exercises is a placeholder: the tolerances of the plot, the 0.15 NM of a fix, the 30° of the angle of cut, the 0.4 NM of the channel, the 4 NM and 12 minutes of "ample time". A time limit cannot be set for an ROC exercise, and the instructor cannot take one back in time (it can be reset).

# How the marking works {#marking}

<p class="lead">The simulator marks what it can measure, in the same way every time, and says how. This chapter sets the rules out in one place.</p>

## The four kinds of item {#marking-kinds}

@cols 14 14 72
| Kind | Points | How it is marked |
|---|---|---|
| Action | 10 | Done at some time during the exercise: the simulator sees it done |
| Value | 10 | The number typed is within the tolerance of the real value at the moment Answer is pressed. The last answer counts |
| Choice | 10 | The correct choice. The last answer counts |
| Outcome | 20 | Judged at the end from what happened in the whole exercise: a safe passing, a track kept, a time limit |

The score is the points gained as a percentage of the points possible. With a pass mark set, the result reads `Passed` or `Not yet passed`. With none set, it gives the score alone.

## The tolerances {#marking-tolerances}

These are the values the simulator starts with. The instructor changes them under EXERCISES, Scoring settings ({ref:scoring-settings}).

@cols 46 18 36
| Tolerance | Starts at | Used for |
|---|---|---|
| CPA | ±0.5 NM | Every CPA reported |
| TCPA | ±2 min | Every TCPA reported |
| Course | ±7° | True courses of targets; the course to steer of exercise 27 |
| Speed | ±1.5 kn | True speeds of targets |
| Range | ±0.5 NM | Ranges and bow crossing range |
| Gyro error | ±1° | Exercise 8 |
| Drift and log | ±0.7 kn | Drift of a current, rate of a stream |
| Set | ±15° | Set of a current or stream |
| Radar bearing and course to steer | ±3° | Bearings by EBL and courses to steer in exercises 10, 11, 23 and 24 |
| Substantial turn | 30° | "Large enough to be readily apparent" |
| Substantial speed cut | to 50% or less | The same, by speed |
| Pass mark | none | |

!!! placeholder "Placeholder"
    None of these comes from an approved marking scheme. They were sized so that data read from a settled ARPA track, which carries the ARPA's own small errors, is accepted. The institute must enter its own tolerances and pass mark, or accept these knowingly.

## How an avoiding action is judged {#marking-rule19}

Where an exercise marks the action taken to avoid collision, the simulator asks two things.

1. **Was it large enough?** The largest turn away from the starting course was at least 30°, or the speed was brought down to half or less. If no alteration was made at all, the item is not met. Whether the action was taken in good time is not marked: that is for the assessor.
2. **Was it in line with rule 19(d), where that rule applies?** No turn to port for a vessel forward of the beam, other than one being overtaken; no turn towards a vessel abeam or abaft the beam. This is judged for the vessels that threatened at the moment of the first alteration: the first change of course of 5° or more, or of speed of a knot or more.

When rule 19(d) applies:

- In exercises 9 and 25, which are in restricted visibility throughout, it is applied to every vessel that threatened.
- In any other exercise, when a visibility is set, it is applied to a vessel that was **not in sight** when the action was taken, that is, further off than the visibility ({ref:visibility}).
- With good visibility it is not applied.

The safe passing is a separate item: every vessel passed no closer than the exercise's safe distance, and none is still closing inside it at the end.

## What the simulator does not mark {#marking-not}

- Whether the action was taken in ample time (except in the ROC traffic exercise).
- Whether course was resumed at the right moment.
- Reports, communication and teamwork.
- Whether the radar was set up well, except in exercise 22.
- Whose work an answer was. The record carries the name at the controls; a partner may have worked the answer out.

These are observed by the instructor, who has a checklist with a written standard for each item ({ref:obs-checklist}), and they are weighed in the assessor's decision ({ref:assessment}).
