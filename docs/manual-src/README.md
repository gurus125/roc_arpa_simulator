# The complete manual: its source

`docs/COMPLETE-MANUAL.pdf` is one manual for trainees, instructors and whoever sets the classroom
up. It is built from the files in this folder. `docs/USER-MANUAL.md` and `docs/INSTRUCTOR-MANUAL.md`
stay as the short manuals; when the simulator changes, change all three.

| File | What it is |
|------|------------|
| `10-part-a.md` ... `50-part-e.md` | The text, in Markdown, in the order of the file names |
| `front.html` | The cover and the page "Read this first" |
| `manual.css` | The layout of the pages (A4) |
| `build.py` | Puts it together and writes the PDF. Its first lines list the few conventions used in the text (`[[KEY]]`, `@fig`, `{ref:...}`) |
| `shots/display.mjs`, `shots/station.mjs`, `shots/robot.mjs` | Take the screen pictures from the built simulator, in a headless browser |
| `assets.py` | Cuts the pictures to size and numbers the parts of the main screen |

## To build it again

    npm run build                                   # the pictures are taken from dist/radar-simulator.html
    node docs/manual-src/shots/display.mjs          # about 4 minutes; needs Playwright, as the screen test does
    node docs/manual-src/shots/station.mjs          # about 5 minutes; starts the classroom server on port 8152
    node docs/manual-src/shots/robot.mjs            # about 3 minutes: the robot student (#demo)
    python3 docs/manual-src/assets.py               # needs Pillow
    python3 docs/manual-src/build.py                # needs weasyprint and markdown; writes docs/COMPLETE-MANUAL.pdf

    pip install weasyprint markdown pillow          # once

The pictures go to `manual-img/` in the project folder, which Git leaves alone (`.gitignore`). The
names and results shown in the pictures of the instructor station are invented, and the server's
store for them is a temporary folder, never the project's `data` folder.

## When the simulator changes

1. Take the pictures again and look at them: a scene that fails is reported and the others go on.
   If a part of the opened record has moved, `station.mjs` prints where each part now is; put the
   figures into `record_parts` in `assets.py`.
2. Correct the text. A reference to a chapter or figure that no longer exists stops the build and
   names it (`MANUAL_DRAFT=1` marks it in the PDF instead).
3. Change `EDITION` at the top of `build.py`, and the build named in `front.html`.
4. Build, and look at every page.

## Rules for the text

- Say what the simulator does, not what a real radar should do, and say where it stops.
- Every figure that is this project's own choice is called a placeholder where it is used, and is
  listed in the chapter "Placeholders".
- Never say that the simulator is approved, certified or fit for navigation.
- Name a standard or a book; do not copy its text.
