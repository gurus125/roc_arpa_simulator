#!/usr/bin/env python3
"""
Makes the figures of the complete manual from the raw screen pictures.

    python3 docs/manual-src/assets.py [raw-folder] [figure-folder]

The raw pictures are taken by the scripts in docs/manual-src/shots (they drive the built simulator in a
headless browser). The figures are JPEG files cut and sized for an A4 page. Nothing here changes the
simulator.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "manual-img" / "raw"
FIG = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "manual-img" / "fig"
FIG.mkdir(parents=True, exist_ok=True)

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for f in FONT_CANDIDATES:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def load(name: str) -> Image.Image:
    return Image.open(RAW / f"{name}.png").convert("RGB")


def save(im: Image.Image, name: str, width: int | None = None, quality: int = 88) -> None:
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(FIG / f"{name}.jpg", quality=quality, optimize=True, progressive=True)


def whole(name: str, width: int = 1800, out: str | None = None) -> None:
    save(load(name), out or name, width)


def padded(name: str, width: int, pad: int = 28, out: str | None = None) -> None:
    """A picture of one part of a page, with a margin of its own background round it so that nothing touches the edge."""
    im = load(name)
    bg = im.getpixel((3, 3))
    big = Image.new("RGB", (im.width + 2 * pad, im.height + 2 * pad), bg)
    big.paste(im, (pad, pad))
    save(big, out or name, width)


def crop(name: str, box: tuple[int, int, int, int], out: str, width: int | None = None) -> None:
    save(load(name).crop(box), out, width)


def marker(d: ImageDraw.ImageDraw, x: int, y: int, text: str, r: int = 30) -> None:
    d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 201, 40), outline=(6, 19, 41), width=4)
    f = font(int(r * 1.15))
    w = d.textlength(text, font=f)
    d.text((x - w / 2, y - r * 0.72), text, fill=(6, 19, 41), font=f)


# ---------------------------------------------------------------- the radar display, with numbered parts
def annotated_display() -> None:
    src = load("display")
    s = src.width / 1440  # the picture was taken at 1440 x 900 CSS pixels
    strip = round(38 * s)  # a strip above the header for the header's markers
    im = Image.new("RGB", (src.width, src.height + strip), (6, 19, 41))
    im.paste(src, (0, strip))
    d = ImageDraw.Draw(im)
    r = round(13 * s)
    # Markers in the strip, each above its part of the header, with a short line down to it.
    for t, x in [("1", 510), ("2", 775), ("3", 958), ("4", 1125), ("5", 1252), ("6", 1372)]:
        cx = round(x * s)
        d.line((cx, strip // 2, cx, strip + round(6 * s)), fill=(255, 201, 40), width=max(2, round(1.5 * s)))
        marker(d, cx, strip // 2, t, r)
    # Markers on the screen itself, each in a place where nothing is written (x, y in CSS pixels of the screen).
    for t, x, y in [("7", 303, 70), ("8", 303, 406), ("9", 303, 700), ("10", 560, 205), ("11", 1137, 70), ("12", 1137, 330),
                    ("13", 1137, 587), ("14", 1290, 847), ("15", 470, 886)]:
        marker(d, round(x * s), strip + round(y * s), t, r)
    save(im, "display-annotated", 2000, quality=90)


# ---------------------------------------------------------------- cuts of the opened record
# Where each part of the opened record begins, in CSS pixels from the top of its section. shots/station.mjs
# prints these ("record parts"): if the record view changes, put the new figures here.
RECORD = {"title": 618, "pic": 1244, "by": 2416, "debrief": 2815, "evidence": 3570}


def record_parts() -> None:
    im = load("st-record-full")
    w = im.width
    k = 2  # the picture has twice the pixels
    r = RECORD
    save(im.crop((0, r["title"] * k, round(w * 0.56), r["pic"] * k)), "st-record-replay", 1500)
    # Each part begins a little above its mark, with its heading; the cuts fall between two parts.
    save(im.crop((0, (r["by"] - 3) * k, w, (r["by"] + 93) * k)), "st-record-each", 1800)
    save(im.crop((0, (r["debrief"] - 35) * k, w, (r["evidence"] - 34) * k)), "st-record-debrief", 1800)
    save(im.crop((0, (r["evidence"] - 34) * k, w, im.height)), "st-record-decision", 1800)


def main() -> None:
    annotated_display()
    # Whole screens.
    for n in ["display", "menu", "measure", "alarm", "truevec", "trial", "night", "route", "exercise-brief", "exercise-answers",
              "exercise-result", "roc-plot", "warmup", "shipwin", "menu-pimap", "menu-ais", "menu-alarm",
              "st-classroom", "st-records", "st-exercises", "st-ownradar-instr", "st-ownradar-faults"]:
        whole(n)
    # The robot student on the #demo display.
    for n in ["robot-trial", "robot-plot"]:
        whole(n)
    whole("robot-bar", 1800)
    # The picture alone.
    for n in ["pad-ppi", "ais-ppi", "goa-ppi", "sar-ppi", "false-ppi", "tss-ppi", "heavy-ppi"]:
        whole(n, 1000)
    # Panels (small: kept at full size).
    for n in ["panel-bDisp", "panel-bGain", "panel-bCur", "panel-bOwn", "panel-bTd", "panel-bArpa", "panel-arpa-alarm"]:
        whole(n, 1400)
    # Cuts.
    crop("login", (600, 580, 2280, 1520), "login", 1300)
    crop("login-batch", (300, 180, 1140, 720), "login-batch", 1300)
    crop("visibility", (0, 0, 2880, 620), "visibility", 1800)
    crop("st-login", (640, 370, 2240, 1230), "st-login", 1300)
    crop("st-classroom-full", (1740, 1640, 2880, 3300), "st-classroom-targets", 1200)
    crop("st-batches", (0, 0, 2880, 2110), "st-batches", 1800)
    crop("st-scenarios", (0, 0, 2880, 940), "st-scenarios", 1800)
    padded("st-watch", 1400)
    padded("st-observe", 1600)
    padded("st-progress", 1800)
    padded("st-assessors", 1800)
    padded("st-class-on-exercise", 1800)
    padded("st-selftest", 1250)
    padded("st-keeping", 1800)
    record_parts()
    # Printed papers: on white, with a thin frame so that the page edge is seen.
    for n in ["paper-exercise-sheet", "paper-debrief-pack", "paper-marking-sheet", "paper-trainee-file"]:
        im = load(n)
        im = im.crop((0, 0, im.width, min(im.height, round(im.width * 1.42))))
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, im.width - 1, im.height - 1), outline=(150, 160, 170), width=3)
        save(im, n, 1400)
    print(f"{len(list(FIG.glob('*.jpg')))} figures in {FIG}")


if __name__ == "__main__":
    main()
