# Records, replay and reports {#records}

<p class="lead">Every finished exercise leaves a record. The RECORDS page lists them, replays them, prints them, and is where the assessor works.</p>

## The list {#records-list}

RECORDS, **Records, replay and reports** lists every finished exercise, from every display that reached the station and from the station's own radar: when, the trainees, the exercise and the score ({fig:st-records}).

- [[Open]] shows the record.
- [[×]] deletes it. If the records are kept on the classroom server, it is deleted there too.
- [[Export all (CSV)]] saves the whole list as a file a spreadsheet opens.

A display sends its record when Finish is pressed, and again when the trainees save their debrief notes. What the assessor has entered stays when the record arrives again.

@fig st-records | 100 | The RECORDS page: the list of finished exercises, the choice of a trainee, and the keeping of the records.

## The replay {#replay}

An opened record starts with the replay ({fig:st-record-replay}).

- **The track plot.** Own ship's track in green and the targets' in yellow, with their names, up to the time shown.
- **The radar picture as the trainee saw it**, below the plot: one picture every 15 seconds, in step with the slider.
- [[Play]] runs the replay. The slider moves to any moment; the time is shown beside it.
- **Replay speed**: from 0.25x (slow motion) through 1x (real time) to 60x. Positions are recorded every 10 seconds, and the replay moves the ships smoothly between them.
- **Bookmarks**: one key for each moment that was flagged on the display during the exercise ({ref:flags}). A click takes the replay to ten seconds before it.
- **The events**: every acquisition, alert, answer, injection by the instructor, whistle signal and VHF message, with its time.

@fig st-record-replay | 70 | The replay of an exercise: own ship's track and the targets'.

!!! note "Where the radar pictures are"
    The radar pictures of the replay are kept in the browser of the display that recorded them and are not sent to the station. A record that arrived from a display on another computer, or was brought from another computer in a backup, has the track plot and everything else, but no pictures: the page says so. To show the pictures in a debrief, open the station on that display's computer, or debrief at the display.

## The result and the notes {#record-result}

Below the replay:

- the result, item by item: the trainee's answer, the correct answer, right or wrong, the points; the total and the percentage;
- the debrief questions of the exercise;
- **Each trainee**, when more than one name was logged in ({ref:each-trainee});
- the trainees' own review, the comments of their partners and their goals, as they typed them;
- who was at the controls, and for how long;
- the **instructor's observations**: each tick of the checklist with its time and whom it was about, and the notes.

## Reports and files {#record-exports}

At the foot of an opened record:

@cols 34 66
| Key | Gives |
|---|---|
| [[Result (CSV)]] | The result as a file a spreadsheet opens |
| [[Report (print or save as PDF)]] | The report of the exercise on paper: the result, the evidence, the observations, the decision, room for signatures |
| [[Record (JSON)]] | The whole record as one file, to keep or to move to another station |

Every "print or save as PDF" key opens the paper in a new browser window and offers to print it. To keep it as a file, choose "Save as PDF" as the printer. The browser must be allowed to open pop-up windows for the page.

## How many records the station holds {#records-capacity}

The station's browser keeps the newest 60 exercises in full, with their replay. When one is dropped to make room, what the trainee files and the comparisons need is kept without the replay, for up to 300 more. To keep everything, with the replays, for as long as the institute needs, use the classroom server's store and the backup ({ref:keeping-records}).

# Assessment {#assessment}

<p class="lead">The simulator sets out the evidence and holds everyone to one form. It does not decide competence: the assessor does. This chapter is about deciding fairly, for a group and for each trainee in it.</p>

Four difficulties are often raised about assessment on a simulator: one trainee is hard to assess inside a group; the evaluation depends on the instructor; exercise sheets do not give the same criteria every time; and the debrief is as good as the instructor who gives it. The answer built here is the one a study of ARPA simulator training recommends ({ref:sources}): stated objectives, one sheet of them ticked during the exercise, and a structured debrief.

!!! placeholder "Proposals, not rules"
    Every written standard, every test of a decision, every limit and every number of points in this chapter is a proposal or a placeholder written for this project. None comes from a syllabus, none has been reviewed by a radar instructor, and none has been tried with trainees. The questions an instructor should settle before relying on them are listed in {ref:placeholders-questions}.

## Each trainee of a group {#each-trainee}

In an opened record, **Each trainee** shows for each name:

- the time at the controls, and the share of the exercise;
- how many answers and actions were given while he or she had the controls, and how many were right;
- the points of those;
- the instructor's observations about him or her;
- how many moments were flagged NOW while he or she had the controls.

@fig st-record-each | 100 | "Each trainee" in the record of a group of two.

What is judged from the whole exercise, such as a safe passing or the time limit, belongs to the group. A moment flagged while one trainee had the controls may have grown from what was done, or not done, before the changeover: look at it in the replay.

## The evidence before the decision {#evidence}

Above the decision, the record sets out **The evidence before the decision** ({fig:st-record-decision}):

- the score against the pass mark that was in force;
- any safety outcome not met;
- how many moments were flagged during the exercise;
- the instructor's ticks: how many Yes, how many No;
- **Measured**: the facts the display measured, as they stood at the end: the radar settings, the range scales used, when the vessels that mattered were tracked, the risk, the first action with who took it, the closest approach, the track and the land, the alerts;
- the criteria the exercise was marked with on its day. They are kept in the record, so a later change of the limits does not change what an old result means. "The criteria" opens the full list.

@fig st-record-decision | 100 | The evidence before the decision, and the assessor's decision. Here "Competent" goes against a score below the pass mark: the station asks for a reason.

## The assessor's decision {#decision}

1. Choose the **Decision**: `Competent: task carried out safely and effectively`, or `Not yet competent`.
2. Type the **Assessor's** name and any **Remarks**.
3. For a group, choose a decision and type remarks **for each trainee**.
4. Press [[Save decision]].

**When a decision goes against the record.** The station compares the decision with the evidence and, where they disagree, says where and does not save until a reason is written in the remarks. It can still be decided either way: the reason is kept with the decision.

@cols 30 70
| Decision | The station asks for a reason when |
|---|---|
| Competent, for the group | A safety outcome was not met; a moment was flagged NOW; the score is below the pass mark; no pass mark is set and fewer than half of the marked items were right; or the instructor's ticks are more No than Yes |
| Not yet competent, for the group | None of these holds, and the score reaches the pass mark (with no pass mark: every item right) |
| Competent, for one trainee | The observations about that trainee are more No than Yes; fewer than half of his or her own answers and actions were right; or he or she was never at the controls and nothing was observed in his or her favour |
| Not yet competent, for one trainee | All of his or her own answers and actions were right and no observation is No |

!!! important "The score is a guide"
    The assessor's decision is the prime criterion. The check of a decision against the record is a help to weigh the same evidence every time. It is not a rule of competence, and it never refuses a reasoned decision.

## Assessors compared {#assessors-compared}

[[Assessors compared]], under the list of records, shows for each assessor: how many exercises were decided, how many found competent, the mean score of those found competent and of those found not yet competent, and how many decisions went against the record.

@fig st-assessors | 100 | Two assessors compared.

Like figures mean like marking. A difference is a reason to talk, not a proof: the classes may have differed.

## The trainee file {#trainee-file}

Under the list of records, choose a name under **Trainee** and press [[Trainee file (print or save as PDF)]]: one paper for one person, with every recorded exercise he or she took part in, oldest first, and the progress at the end. Two trainees of the same name in different batches are kept apart: the list shows the batch after the name.

## The progress of a trainee {#trainee-progress}

Choose the name and press [[Progress of this trainee]] ({fig:st-progress}):

- how many attempts at how many exercises, the mean of the latest scores, in how many the trainee was found competent, and in how many a second attempt was better or worse;
- a chart of the score at each scored attempt, oldest first, with the pass mark as a line if one is set;
- each exercise with its attempts and its first, best and latest score, the change between first and latest, and whether found competent;
- every attempt with what was the trainee's own: the answers and actions given while at the controls.

@fig st-progress | 100 | The progress of one trainee: the score at each attempt, each exercise, and every attempt.

Exercises differ in difficulty, so the line of the chart is not by itself a measure of progress. The change within one exercise is.

The trainees see the same about themselves under "My results" ({ref:my-results}). The progress of a whole batch is on the BATCHES page ({ref:batch-progress}).

# The debrief {#debrief}

<p class="lead">The debrief is where most of the learning happens, and it should not depend on which instructor gives it. The station lays out the same five steps from every record.</p>

## The guided debrief {#guided-debrief}

In an opened record, **Guided debrief** ({fig:st-record-debrief}). Tick each step as it is done.

@cols 6 26 68
| | Step | What the station lays out, and what to do |
|---|---|---|
| 1 | The trainees' own view | Their own review and their partners' comments, as they typed them. Ask the trainees to say what happened and what they would change, before anything is shown. No blame: the talk is about events, not persons |
| 2 | The key moments | One key for each flag, each change at the controls, each act of the instructor and each alarm. A click takes the replay there. Ask what the radar showed and what was decided, before saying what the record shows |
| 3 | The facts against the criteria | What was met and what was not, item by item, with the values. The criteria are the ones given at the briefing |
| 4 | The questions | Questions written from what happened in this exercise: one for each of the first three moments flagged NOW, one about the first action or the lack of one, one for each of the first two outcomes not met, one for each of the first two wrong values; then the exercise's own questions |
| 5 | Goals agreed | Agree with the trainees one or two things to do differently next time. Type them under "Goals agreed with the trainees" |

[[Save the debrief]] keeps the ticks and the goals in the record.

@fig st-record-debrief | 100 | The guided debrief of a record: the key moments as keys that move the replay, what was met and not met, the questions, the goals.

The questions are written by fixed rules from what was recorded. They do not know what the trainees said or meant: choose among them.

## The debrief pack {#debrief-pack}

[[Debrief pack (print or save as PDF)]] prints all of it on paper: the five steps with their guidance, the key moments with their times, what was met and not met, the measured facts, the questions, and room for the goals ({fig:paper-debrief-pack}).

@fig paper-debrief-pack | 62 | The debrief pack of one exercise, as printed.

## The class on this exercise {#class-on-exercise}

[[The class on this exercise]] lists every recorded attempt at the same exercise, the best score first, with the first action, the closest vessel and the flags of each. Use it to debrief the whole class on one exercise: what the groups that did well did earlier or differently.

@fig st-class-on-exercise | 100 | The class on one exercise: every recorded attempt, the best first.

# Examinations, scoring, sheets and the self-test {#exams-scoring}

<p class="lead">The EXERCISES page holds what is set up before a course: the parts of the examinations, the tolerances and the pass mark, the papers to hand out, and the test that the exercises themselves are sound.</p>

@fig st-exercises | 100 | The EXERCISES page: examinations and scoring settings; below them the exercise sheets, the marking sheets and the self-test.

## Examinations {#exam}

An examination is a list of exercises worked one after the other on a display. There are two: the ROC practical examination and the ARPA practical examination.

1. Under **Examinations**, choose the parts of each in its list. Hold Ctrl (Cmd on a Mac) and click to choose several.
2. Press [[Save the parts]]. [[Back to the proposed parts]] restores the proposal.
3. Choose the **Display** (or all displays).
4. Press [[Start the ROC examination]] or [[Start the ARPA examination]].

The display starts part 1. When the trainee presses Finish it offers the next part. Target names are switched off. Each part is recorded and marked as usual and tagged as part of that sitting. Trainees who share a display take the controls in turn, one part each.

[[Examination results (print or save as PDF)]] prints one page for each examination taken: the parts with their points, the total, the pass mark if one is set, and room for the assessor's decision.

!!! placeholder "The proposed parts"
    The parts proposed are: ROC, exercises 22, 13 and 15, the ROC position fixing exercise and exercise 10; ARPA, exercises 1, 5, 6, 8 and 31. This is only a proposal: no syllabus read for this project lists the parts of either examination.

## Scoring settings {#scoring-settings}

**Scoring settings (placeholders)**: the tolerances, the points and the pass mark the simulator marks with ({ref:marking-tolerances}). Type the institute's own values and press [[Save scoring]]. [[Reset to placeholders]] puts the starting values back.

- Leave **Pass mark %** blank to report scores without pass or fail.
- "Radar bearing / course to steer tolerance" applies to the bearings and courses to steer of exercises 10, 11, 23 and 24.
- The five **Set-up** fields are the limits of exercise 22: the lightest and the heaviest noise speckle that count as a light speckle, how far from the best the tuning may be, the least brilliance, and the sea and rain settings that count as zero.
- Tolerances that are fixed in an exercise, such as the 0.25 NM track limit of exercises 10 and 24, are listed on the sheets and can be changed in the program only.

The settings go to every display within a few seconds. Each record keeps the criteria that were in force when it was made. Run the self-test after any change.

## Time limits {#time-limit}

Under the scoring settings, **Time limit for the exercise**: choose an exercise, type the minutes allowed, and press [[Set this time limit]]. The exercise then has one more marked item, "Finished within the time allowed", worth an outcome's points, and the trainee sees the time left. Blank takes the limit away (exercise 31 then keeps its own 8 minutes). The limit is exercise time and does not run while the exercise is paused. It is not offered for the six ROC exercises.

## Exercise sheets {#exercise-sheets}

**Exercise sheets**: choose one exercise or all of them (37 pages) and press [[Print exercise sheet (or save as PDF)]].

Every sheet has the same form, for all 31 exercises and the six ROC exercises ({fig:paper-exercise-sheet}):

1. the objective;
2. the briefing;
3. what the simulator measures: every item, its kind, how it is judged, its points, the total; the time allowed and the safe passing distance;
4. what the instructor observes: the checklist with the standard for Yes and for No;
5. the standard: the pass mark, and how the assessor decides;
6. the debrief questions.

The sheet is made from the same data that does the marking, so the sheet and the marking cannot differ. Give it out at the briefing: trainees who know the criteria can be held to them.

@fig paper-exercise-sheet | 62 | The exercise sheet of exercise 6, as printed.

## Marking sheets {#marking-sheets}

**Marking sheets** are a different paper, for the institute to write in its own limits. Choose one exercise or all of them (31 pages) and press [[Print marking sheet (or save as PDF)]]. Each is one A4 page:

- the items the simulator checks, how it judges each, and the value it uses now, with empty boxes for the institute's own tolerance or limit and points;
- the items the assessor judges that the simulator does not: the timing of the action, resuming course, communication, use of the controls;
- the pass mark; the assessor's decision, name, signature and date;
- a line for whoever approves the marking scheme.

@fig paper-marking-sheet | 52 | The marking sheet of exercise 6, as printed: the simulator's values, and empty boxes for the institute's own.

When the institute has filled the sheets in, enter its tolerances and pass mark under Scoring settings. The syllabus references printed on each sheet come from a draft table in the project's notes which no instructor has reviewed.

## The self-test of the exercises {#self-test}

**Self-test of the exercises**, [[Run self-test]]. It takes from half a minute to a minute. Three robots work every one of the 31 exercises ({fig:st-selftest}):

@cols 20 80
| Robot | What it does, and what must happen |
|---|---|
| Careful | Follows the briefing and answers correctly. It must be credited with every item: 100% |
| Wrong | Gives wrong answers. Every one must be rejected |
| Idle | Does nothing. It must be credited with no action and no answer, and must not pass every outcome |

A row reads `PASS` when all three behaved as they must, and the heading says how many of the 31 passed. For a plotting exercise the careful robot's column also shows the manoeuvre it found.

The self-test checks that every exercise runs, can be completed and is marked properly. It does not check that the answer key is good seamanship, and the six ROC exercises are not included. Run it after any change of the scoring settings, and before a course.

@fig st-selftest | 62 | The self-test: every exercise worked by three robots.

# The robot student {#robot-student}

<p class="lead">On a display opened with <code>#demo</code> after its address, a robot student works any of the 31 exercises with the display's own controls while the class watches. Choose the exercise and a level from 1 to 5. Use it to show what an exercise asks for, what full marks look like, and how the marking answers to poorer work.</p>

@fig robot-trial | 100 | The robot student at work: exercise 6 at level 5. The yellow pointer marked ROBOT has just set a trial manoeuvre in the TRIAL menu. The bar at the foot of the screen says what the robot is doing and keeps its log.

## Opening the demonstration display {#robot-open}

Add `#demo` to the address of the simulator:

- from the file: `radar-simulator.html#demo`;
- from the classroom server or a web site: the address of the display followed by `/#demo`.

The display opens with no login box. The header says "robot student demonstration", and the legend at the foot of the screen gives way to the robot bar. The bar keeps the statement that this is a training simulator, not type approved and not for navigation. The demonstration display needs no classroom server; with one, its records go to the instructor station as a display's do.

It suits the classroom projector or the instructor's own screen: open the station in one window and the demonstration display in another.

## The robot bar {#robot-bar}

@fig robot-bar | 100 | The robot bar after a run at level 2: the controls on the left, the caption in the middle, the log on the right with the mistakes in amber.

@cols 24 76
| Control | What it does |
|---|---|
| Exercise | Any of the 31 exercises of the ARPA EX list, or all of them one after another. After all of them, the log lists each score and the mean |
| Level | 1 Beginner, 2 Weak, 3 Average, 4 Good, 5 Excellent ({ref:robot-levels}) |
| Seed | A number that fixes the robot's chances. The same exercise, level and seed give the same mistakes |
| Wait 1x to 20x | How fast the clock runs while the robot waits for something: for the tracks to settle, the ship to come round, a target to pass. The robot's own actions always run at normal speed, so each one can be followed |
| [[START]] | The robot opens the exercise from the ARPA EX list and begins |
| [[PAUSE]] | Stops the clock and the robot. [[CONTINUE]] goes on |
| [[STOP]] | Ends the run. The exercise stays as it is |
| [[TAKE OVER]] | Stops the robot and leaves the exercise to you: carry on and press Finish yourself. The record says when the robot handed over |

The **caption** in the middle says what the robot is doing now and why: white for what it does, blue for its reasoning, amber for a mistake, green for a result. Under it are the level and the exercise time. The **log** on the right keeps every step with its exercise time, marked READS, THINKS, DOES, ANSWERS, MISTAKE or RESULT.

While the robot has the controls, clicks and keys on the display are held back, so that nobody upsets its work by accident. The bar itself always works.

## What the robot does {#robot-what}

It works the controls described in Part B, in the order of each briefing. It opens the exercise, reads the briefing and presses RUN. At the end it presses Finish, then writes its debrief notes and saves them.

@cols 22 78
| Exercises | What it does |
|---|---|
| 1 to 5, 7, 8, 31 | Acquires by clicking each echo, waits for steady data, then reads the target data. Sets the limits, the guard and exclusion zones, past positions, the ground reference or the self-test as the briefing asks. Acknowledges each alert, answers, and finishes. In 31 it works against the clock |
| 6, 9, 25, 26 | Appraises every ship, then looks for the smallest alteration to starboard of at least 30° that the trial manoeuvre shows clearing every tracked ship by the safe distance and 0.3 NM more. In restricted visibility it keeps to Rule 19(d). It shows that alteration with the trial, orders the course on the autopilot and watches the ships pass. Once own ship is steady and the tracks have settled again, it does more if a ship would still pass too close. In 9 it resumes course when all are past and clear |
| 10, 24, 27 | Sets the parallel index line (10 and 24) and draws the planned track as a navigation line (10), then steers by the distance off the track. In 24 it reduces speed in steps, takes the way off, lets go the anchor, sets the anchor watch on the buoy, and acknowledges the alarm when the anchor drags |
| 11 | Homes on the SART at the dot nearest own ship, slowing down as it closes |
| 12 to 21 | With the ARPA off, puts EBL 1 and VRM 1 on each target at 0, 6 and 12 minutes and works the plot: relative motion, CPA, TCPA, true course and speed. It answers for the most dangerous target. At 12 minutes it makes the alteration that, by its plot, passes the closest target at about 1.15 NM (the result is marked down for passing wide as well as close) |
| 22 | Switches on, waits for the warm-up and transmits. Then: brilliance; sea, rain and the signal processing off; gain to a light speckle; tuning for the greatest extent of clutter; gain again; the 12 NM range; the performance monitor; sea clutter as the sea needs |
| 23 | Puts EBL and VRM on Malabar Point, works the fix, and alters away before closing the land |
| 28 | Gives way to the ferry by slowing down (checked with the trial), keeping to its lane, then resumes speed |
| 29 | Presses MOB at the report and makes a Williamson turn by hand steering. It steadies on the reciprocal course, lays an expanding square from the MOB mark, and closes the mark slowly |
| 30 | Comes down to a safe speed when the visibility closes in |

@fig robot-plot | 100 | Exercise 16 at level 5: with the ARPA off, the robot has put EBL 1 and VRM 1 on a target and written the plot in its log.

Its answers are the values the exercise checks against, rounded as they would be read off the display: CPA to 0.1 NM, courses and bearings to the whole degree. In the manual plotting exercises it answers from its own EBL and VRM readings.

## The levels {#robot-levels}

At level 5 the robot makes no mistakes. At levels 4 to 1 it makes mistakes on purpose, by chance. Each one is written in the log in amber, so the marks lost can be laid beside what it did.

@cols 30 14 14 14 14 14
| Mistake | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|
| Misreads a value (typed 1.6 to 3 tolerances off) | none | 7% | 18% | 32% | 50% |
| Wrong choice | none | 7% | 18% | 30% | 45% |
| Forgets a step of the briefing | none | 3% | 10% | 22% | 35% |
| Avoiding action too small, to port, or late | none | 5%, none, 5% | 20%, 4%, 20% | 35%, 12%, 35% | 45%, 25%, 45% |
| Leaves an alert unacknowledged for | 3 to 8 s | 5 to 15 s | 10 to 30 s | 20 to 60 s | 40 to 110 s |
| Leaves the gain or tuning wrong (exercise 22) | none | 5% | 20% | 40% | 60% |

At levels 1 and 2 it may also read the data while the vectors are still preliminary, press MOB late, steer sloppily (it looks at the steering less often and corrects less), and in the plotting exercises alter before the 12 minutes. Worked directly on the simulation, over all 31 exercises with three seeds each, its mean scores with the placeholder scoring were about 58% at level 1, 72% at level 2, 85% at level 3, 94% at level 4 and 100% at level 5.

!!! placeholder "The levels are invented"
    The chances and sizes of the mistakes were chosen for the demonstration. They were not measured from trainees, and they have no part in any marking scheme.

## Its records {#robot-records}

Each run is recorded like any exercise, with the replay, the evidence and the debrief notes. The notes are the robot's own: what was not credited, and every mistake it made on purpose. The record goes to the instructor station under the name "Robot student (level n)" and is marked as the robot's, with the seed and the moment of a take-over.

A robot's record is never a trainee's. It is left out of every trainee's file and progress chart, out of the batch progress, and out of the class comparison of an exercise. It stays in the list of records, so it can be replayed and opened like any other.

!!! important "What the robot proves, and what it does not"
    The robot shows that each exercise can be worked through the screen and is marked as it should be: full marks for good work, marks lost for each mistake. It answers from the exercise's own answer key, so it proves nothing about that key. The exercises' own tests check the key, and a qualified instructor must still judge the content. It is not a model of how trainees learn or err.

!!! tip "In class"
    Run an exercise at level 5, then the same exercise at level 2. Open both records at the station and go through them with the class, item by item, beside the robot's log.

# Keeping the records safe {#keeping-records}

<p class="lead">A browser's storage is not an archive: it is limited, and clearing it loses everything. The records can be kept on the classroom server's disk, in a backup file, or both.</p>

## Where records are {#records-where}

@cols 30 70
| Place | What is there |
|---|---|
| The station's browser | The newest 60 records in full, 300 older ones without their replay, the batches and settings. Lost if the browser's data for the page is cleared |
| The classroom server's folder `data` | Every record with its replay, and the batches and settings, once the station key has been typed. As files on that computer's disk |
| A backup file | Whatever the station's browser held when the backup was made |
| The display that recorded an exercise | The radar pictures of its replay. They are not sent anywhere |

## On the classroom server {#station-key}

When the simulator is served by the classroom server, the server can keep every record with its replay, and the batches and settings, as files in the folder `data` beside it.

1. When the server starts it prints a **station key**: sixteen letters and digits in four groups. The key is also in the file `data/station-key.txt`. It is made once and stays the same.
2. At the station, RECORDS, **Keeping the records**: type the key under "Server key" and press [[Use this server key]]. It can be typed with or without the hyphens, in capitals or not.
3. The page then reads, for example, `Kept on the classroom server: 4 exercises (4 with their replay), and the batches and settings. Last sent at 11:21:47.` ({fig:st-keeping}).

From then on:

- the station sends each record to the server as it arrives, and the batches and settings when they change;
- the trainee files, the progress and the comparisons reach back over everything the server holds, however old;
- an exercise whose replay is no longer in the browser is listed under "On the server": [[Bring this exercise back with its replay]] opens it;
- deleting a record at the station deletes it on the server too.

@fig st-keeping | 100 | "Keeping the records" once the station key has been typed.

**On another computer, or after the browser's data is lost:** open the station, type the key, and press [[Take the batches and settings from the server]]. The class and the records are back.

## A backup file {#backup}

- [[Back up everything (JSON)]] saves the class and every record held in the browser in one file.
- [[Restore from a backup]] adds the records and the batches this station does not have, and on a station with no batch yet takes the settings too. It never deletes.

A backup works everywhere, also on a copy on a web site, where it is the only way to keep the records. Make one at the end of every day of a course, and keep it where the institute keeps its other records.

## Privacy and care {#records-privacy}

- The files hold trainees' names and results. Keep the `data` folder and the backups as the institute keeps its other records of trainees.
- Neither is encrypted, and the station key travels in clear on the classroom network. This keeps trainees out, not a determined intruder.
- **Never put the `data` folder in the project's Git repository** or on a web site. The project lists it in `.gitignore` so that Git leaves it alone: do not remove that line.
- A trainee's PIN is kept only as a digest, in the batches. The digests are in the backup file too.

The server's store has been tried with separate browsers on one computer, not yet on separate computers.

# Making scenarios {#making-scenarios}

<p class="lead">The instructor can make scenarios of his or her own: in the editor for the common cases, and in a scenario file for everything the editor does not offer.</p>

## The scenario editor {#scenario-editor}

SCENARIOS, **Scenario editor** ({fig:st-scenarios}).

1. **Start from** an existing scenario. To make a scenario in one of the real areas, start from that area's scenario: it keeps the coast and the land.
2. Type the **Scenario name**, the **sea state**, own ship's **heading** and **speed**, the **current** (set and drift) and, if wanted, a **visibility**.
3. List the targets, one a row:

@cols 18 82
| Column | Meaning |
|---|---|
| Name | As it appears in the lists and in the record |
| Kind | A plain ship, small craft, buoy or beacon, or one of the catalogue types ({ref:target-catalogue}) |
| Brg, Rng | True bearing and range from own ship's start |
| Crs, Spd | Her course and speed |
| At min, →Crs, →Spd | One optional alteration: at that minute she alters to that course, that speed, or both |

4. [[Add target]] adds a row; [[×]] removes one.
5. [[Load in simulator]] tries the scenario on the station's own radar. [[Save to library]] keeps it: saved scenarios appear at the end of the free-practice list on every display.

[[Download JSON]] saves the scenario as a file and [[Open JSON file]] reads one, to move scenarios between computers. [[Delete from library]] removes a saved scenario.

@fig st-scenarios | 100 | The scenario editor with the scenario "Open sea traffic" loaded.

## What only a scenario file can hold {#scenario-file}

A scenario file is plain text in the JSON form. Download a scenario from the editor, change the file in a text editor, and open it again. Positions in it are in NM east (`e`) and north (`n`) of the scenario's origin.

@cols 28 72
| To have | Write, for the target or the scenario |
|---|---|
| A track for a target | `"route": { "points": [{ "e": 2, "n": 5 }, { "e": 4, "n": 8 }], "speeds": [null, 8] }` (at most 20 points; a speed of `null` keeps her speed) |
| A fading echo | `"paint": 0.5` : the ARPA sees the target on only every other turn of the aerial |
| AIS on a small craft | `"ais": true` |
| The AIS class | `"aisClass": "A"`, `"B-CS"` or `"B-SO"` |
| What the AIS sends besides the position | `"aisStatic": { "destination": "MUMBAI", "eta": "13 NOV 1800 UTC", "draughtM": 10.2, "shipType": "Tanker", "imo": null }`. `null` means not sent, shown to the trainee as MISSING. Also `"navStatus"` and `"posAccuracy"` (`"high"` or `"low"`) |
| A ship lying at anchor | `"atAnchor": true` : she does not drift |
| Structures that give false echoes | `"structures": [{ "name": "Cable", "kind": "power-line", "a": { "e": -1, "n": 3 }, "b": { "e": 1, "n": 3 } }]` with kind `"power-line"`, `"bridge"` or `"reflector"` (a quay wall or other large flat face) |
| A traffic separation scheme | `"tss": [{ "name": "Scheme", "a": { "e": 0, "n": -8 }, "b": { "e": 0, "n": 8 }, "zoneHalfWidthNm": 0.25, "laneWidthNm": 2 }]` : a straight scheme along the axis from `a` to `b`, with half the width of the separation zone and the width of each lane. Traffic bound from `a` towards `b` has the lane to starboard of the axis |
| A real area | `"terrain": "mumbai"` (or `"goa"`, `"kochi"`, `"kutch"`) with its `"origin"`, for example `"origin": { "lat": 15.4167, "lon": 73.5 }` for Goa |
| A visibility | `"visibilityNm": 0.5` in the environment |

Left out, a ship gets a made-up IMO number and a ship type from its catalogue type, and no voyage data. A file that does not have the right form is refused with a message.

Two things to know about how targets move:

- A target of a catalogue type steers a course through the water and is set by the current. A plain target is given its course and speed over the ground, so the current is already in them.
- A vessel meant to be stopped in the water and drifting with the current must therefore be given a catalogue type.

## Adding a real area {#scenario-area}

The four real areas are built into the program. Adding another is work for a developer: it needs the coastline data and the land-height tiles for the area, and two scripts of the project make the simulator's data from them ({ref:developer}).

How strongly land returns is set by one figure in the program. If an experienced radar observer finds that a coast is seen too early or too late compared with a real set, that is the figure to change ({ref:placeholders}).
