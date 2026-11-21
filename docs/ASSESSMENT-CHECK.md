# Assessment: what was built on 18 Nov 2026, and what an instructor must check

Four difficulties of assessment on a simulator were raised for this project on 18 Nov 2026:

1. individual trainees are hard to assess when they work in groups;
2. the instructor's evaluation can become subjective;
3. exercise sheets do not always give consistent assessment criteria;
4. the debrief depends on the quality of the instructor.

The remedy follows what T. Karlsson recommends in *The importance of structured briefings and
debriefings for objective evaluation of ARPA simulator training* (Chalmers University of
Technology, 2011): stated objectives, one sheet of them ticked during the exercise, and a
structured debrief. Code: `src/train/assess.ts`, `src/train/roc-score.ts`. Tests:
`tests/b43-assess.test.ts`. How to use it: `INSTRUCTOR-MANUAL.md`, sections 6a, 8a and 9c.

**Read this first.** The simulator sets out evidence and holds everyone to one form. It does not
decide competence: the assessor does (STCW Code A-I/12, paragraph 8). Every written standard, every
test of a decision, every limit and every number of points below is a proposal or a placeholder
written for this project. None comes from a syllabus, none has been reviewed by a radar instructor,
and none has been tried with trainees.

## What was built

| Difficulty | What the simulator now does |
|------------|------------------------------|
| 1 Individuals in a group | Every answer, every action and the first alteration of course or speed carries the name of the trainee at the controls. Each trainee has a result in the group's record and a file across all recorded exercises. The controls can change over by the clock, so that each gets a like share |
| 2 Subjective evaluation | Each of the twelve checklist items has a written standard for Yes and for No. Eight of them show what the display has measured beside them. The record sets out the evidence before the decision, keeps the criteria that were in force, and asks for a written reason when a decision goes against the evidence. Assessors can be compared |
| 3 Inconsistent sheets | One exercise sheet of a fixed form for all 33 exercises and the six ROC exercises, made from the same data that does the marking. The six ROC exercises now have marked items and points |
| 4 Debrief depends on the instructor | A debrief in five fixed steps laid out from the record, with the key moments, the facts against the criteria and questions written from what happened; a printed debrief pack; a comparison of the class on one exercise |

## What stays a human judgement

- Whether a trainee is competent. The check of a decision only asks for a reason; it never refuses
  a reasoned decision.
- Reporting, teamwork, cross-checking and keeping the limits of the equipment in mind: the
  simulator measures nothing about these four checklist items.
- Whose work an answer was. "At the controls" is the name chosen on the display: a partner may have
  worked the answer out.
- Which debrief questions to ask, and what the trainees meant by what they did.

## The proposals to check

1. **The twelve checklist items and their standards.** Print any exercise sheet (station,
   EXERCISES, Exercise sheets): section 4 lists every item with what Yes and what No look like.
   The text is in `OBSERVATION_STANDARDS`. The instructor can replace any line at the station.
2. **The tests of a decision** (`decisionConflicts`). "Competent" asks for a reason when a safety
   outcome was not met, when a moment was flagged NOW, when the score is below the pass mark, when
   no pass mark is set and fewer than half of the marked items were right, or when the instructor's
   ticks are more No than Yes. "Not yet competent" asks for a reason when none of these holds and
   the score reaches the pass mark (with no pass mark: every item right). For one trainee of a
   group (`traineeConflicts`): more No than Yes about that trainee, fewer than half of the own
   answers right, or never at the controls with nothing observed.
3. **The points of the ROC exercises** (`rocCriteria`): a value or a choice 10, an action 10, an
   outcome 20, as in the other exercises; the limits are those of `ROC_PLACEHOLDERS`. The first
   check of the answers counts, and a fix is marked when first completed with two charted objects.
4. **The debrief questions** (`debriefPack`): one for each of the first three moments flagged NOW,
   one about the first action or the lack of one, one for each of the first two outcomes not met,
   one for each of the first two wrong values, then the exercise's own questions. The six ROC
   exercises were given two or three questions each (`ROC_DEBRIEF`).
5. **The five debrief steps** (`DEBRIEF_STEPS`): the trainees' own view, the key moments, the facts
   against the criteria, the questions, the goals agreed.

## Questions for an instructor

1. Are the twelve items the right ones for the institute's courses, and do the standards say what
   you would accept and refuse?
2. Should a fix be marked when the second object is observed, or should the trainee say when the
   fix is complete (which needs one more key)?
3. In a group, is "what was done while at the controls" a fair share of the individual result, or
   should some exercises be worked alone for assessment?
4. Is a changeover by the clock wanted during a collision-avoidance exercise, where it can fall at
   the worst moment, or only between exercises?
5. Is "fewer than half of the items right" a sensible point at which to ask for a reason when the
   institute has set no pass mark?
6. Which of the measured facts would you rather not see while ticking, so that the tick stays your
   own observation?

## Limits

- The measured facts beside the checklist come only in the 33 marked exercises, not in the ROC
  exercises or in free practice.
- The trainee file and the comparisons hold what is in the station's browser: the newest 60
  exercises in full and up to 300 older ones without their replay. Export the records to keep more.
- The first action, the closest vessel and the measured facts are kept in records made from this
  version on; older records show a dash.
- The comparison of assessors does not allow for different classes: it shows a difference, not its
  cause.
