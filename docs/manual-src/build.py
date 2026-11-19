#!/usr/bin/env python3
"""
Builds the complete manual (one PDF for trainees, instructors and whoever installs the simulator).

    pip install weasyprint markdown pillow
    python3 docs/manual-src/build.py                 # writes docs/COMPLETE-MANUAL.pdf
    python3 docs/manual-src/build.py out.pdf figs/   # another file, another figure folder

The text is in the *.md files beside this script, in the order of their names. The figures are made
by assets.py from screen pictures of the built simulator (see README.md here).

Conventions in the *.md files (on top of ordinary Markdown with tables):
  %% PART A | Title | one line about it     a part: a divider page
  # Chapter title {#id}                      a chapter (numbered 1, 2, 3 ... through the whole manual)
  ## Section title {#id}                     a section (numbered 4.1, 4.2 ...)
  [[ALARM ACK]]                              a key or a control on the screen
  `TEXT`                                     words shown on the screen, a file name or a command
  @fig name | 100 | Caption                  a figure: name.jpg in the figure folder, width in per cent
  @cols 25 75                                column widths (per cent) of the table that follows
  {ref:id}                                   "chapter 4" or "section 4.2", with a link
  {fig:name}                                 "figure 4.1", with a link
  !!! note "Title"                           a box (note, tip, important, placeholder, instructor, try)
"""
import html
import os
import re
import sys
from datetime import date
from pathlib import Path

import markdown
from weasyprint import HTML

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "COMPLETE-MANUAL.pdf"
FIG = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "manual-img" / "fig"

TITLE = "ROC / ARPA Radar Simulator"
SUBTITLE = "Complete Manual"
EDITION = "Edition 2 · for simulator build rs-b46 · 19 November 2026"
STATEMENT = "Training simulator · not type approved · not for navigation"
# MANUAL_DRAFT=1: a reference to a chapter or figure not yet written is marked instead of stopping the build.
DRAFT = os.environ.get("MANUAL_DRAFT") == "1"
missing: set[str] = set()


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def md_to_html(text: str) -> str:
    return markdown.markdown(text, extensions=["tables", "attr_list", "admonition", "sane_lists", "def_list", "md_in_html"])


def inline(text: str) -> str:
    """Inline Markdown of one line (for captions and titles)."""
    out = md_to_html(text).strip()
    return re.sub(r"^<p>(.*)</p>$", r"\1", out, flags=re.S)


def keys(text: str) -> str:
    return re.sub(r"\[\[(.+?)\]\]", lambda m: f'<span class="k">{html.escape(m.group(1))}</span>', text)


def main() -> None:
    files = sorted(HERE.glob("[0-9]*.md"))
    if not files:
        sys.exit("No chapter files found beside build.py")
    source = "\n\n".join(f.read_text(encoding="utf-8") for f in files)

    # ---- split into blocks: parts and chapters
    blocks: list[dict] = []
    current: dict | None = None
    for line in source.split("\n"):
        if line.startswith("%% "):
            letter_title, *rest = [x.strip() for x in line[3:].split("|")]
            blocks.append({"kind": "part", "label": letter_title, "title": rest[0] if rest else "", "about": rest[1] if len(rest) > 1 else "", "chapters": []})
            current = None
            continue
        m = re.match(r"^# (.+?)(?:\s*\{#([\w-]+)\})?\s*$", line)
        if m:
            current = {"kind": "chapter", "title": m.group(1).strip(), "id": m.group(2) or slug(m.group(1)), "lines": []}
            blocks.append(current)
            continue
        if current is not None:
            current["lines"].append(line)

    # ---- number the chapters, sections and figures; collect the ids
    refs: dict[str, str] = {}
    figs: dict[str, str] = {}
    n = 0
    part: dict | None = None
    for b in blocks:
        if b["kind"] == "part":
            part = b
            continue
        n += 1
        b["n"] = n
        refs[b["id"]] = f"chapter {n}"
        if part is not None:
            part["chapters"].append(b)
        sec = 0
        fig = 0
        out: list[str] = []
        b["sections"] = []
        for line in b["lines"]:
            m = re.match(r"^## (.+?)(?:\s*\{#([\w-]+)\})?\s*$", line)
            if m:
                sec += 1
                sid = m.group(2) or f"{b['id']}-{slug(m.group(1))}"
                refs[sid] = f"section {n}.{sec}"
                b["sections"].append({"id": sid, "num": f"{n}.{sec}", "title": m.group(1).strip()})
                out.append(f'<h2 id="{sid}"><span class="num">{n}.{sec}</span> {keys(inline(m.group(1).strip()))}</h2>')
                out.append("")
                continue
            m = re.match(r"^@fig\s+([\w-]+)\s*\|\s*(\d+)\s*\|\s*(.+)$", line)
            if m:
                fig += 1
                name, width, caption = m.group(1), m.group(2), m.group(3).strip()
                if not (FIG / f"{name}.jpg").exists():
                    sys.exit(f"Figure not found: {name}.jpg (chapter {n})")
                if name not in figs:
                    figs[name] = f"figure {n}.{fig}"
                out.append("")
                out.append(f'<figure id="fig-{name}-{n}-{fig}"><img src="{(FIG / (name + ".jpg")).as_uri()}" style="width:{width}%" alt=""><figcaption><b>Figure {n}.{fig}</b> &nbsp;{keys(inline(caption))}</figcaption></figure>')
                out.append("")
                b.setdefault("figids", {})[name] = f"fig-{name}-{n}-{fig}"
                continue
            m = re.match(r"^@cols\s+([\d\s.]+)$", line)
            if m:
                out.append(f"<!--cols:{','.join(m.group(1).split())}-->")
                out.append("")
                continue
            out.append(line)
        b["md"] = "\n".join(out)

    figids: dict[str, str] = {}
    for b in blocks:
        for k, v in b.get("figids", {}).items():
            figids.setdefault(k, v)

    def resolve(text: str) -> str:
        def ref(m: re.Match) -> str:
            rid = m.group(1)
            if rid not in refs:
                if DRAFT:
                    missing.add(rid)
                    return f"[?{rid}]"
                sys.exit(f"Unknown reference: {rid}")
            return f'<a class="xref" href="#{rid}">{refs[rid]}</a>'

        def figref(m: re.Match) -> str:
            name = m.group(1)
            if name not in figs:
                if DRAFT:
                    missing.add("fig:" + name)
                    return f"[?fig {name}]"
                sys.exit(f"Unknown figure reference: {name}")
            return f'<a class="xref" href="#{figids[name]}">{figs[name]}</a>'

        text = re.sub(r"\{ref:([\w-]+)\}", ref, text)
        return re.sub(r"\{fig:([\w-]+)\}", figref, text)

    # ---- the body
    body: list[str] = []
    for b in blocks:
        if b["kind"] == "part":
            items = "".join(f'<li><span class="pn">{c["n"]}</span>{html.escape(c["title"])}</li>' for c in b["chapters"])
            body.append(f'<section class="part"><div class="plabel">{html.escape(b["label"])}</div><h1 class="ptitle" data-bm="{html.escape(b["label"].title())}: {html.escape(b["title"])}">{html.escape(b["title"])}</h1><p class="pabout">{html.escape(b["about"])}</p><ul class="plist">{items}</ul></section>')
            continue
        h = md_to_html(keys(resolve(b["md"])))
        h = re.sub(r"<!--cols:([\d.,]+)-->\s*<table>", lambda m: "<table><colgroup>" + "".join(f'<col style="width:{w}%">' for w in m.group(1).split(",")) + "</colgroup>", h)
        h = h.replace("<table>", '<table class="t">')
        body.append(f'<section class="chapter"><h1 id="{b["id"]}" data-bm="{b["n"]}  {html.escape(b["title"])}"><span class="cnum">{b["n"]}</span><span class="ctitle">{html.escape(b["title"])}</span></h1>\n{h}</section>')

    # ---- the contents: two columns, each chapter kept together with its sections
    toc: list[str] = ['<section class="toc"><h1 class="toch">Contents</h1><div class="tcols">']
    for b in blocks:
        if b["kind"] == "part":
            toc.append(f'<div class="tpart"><span>{html.escape(b["label"])}</span> {html.escape(b["title"])}</div>')
        else:
            rows = [f'<a class="tch" href="#{b["id"]}"><span class="tn">{b["n"]}</span><span class="tt">{html.escape(b["title"])}</span></a>']
            for s in b["sections"]:
                rows.append(f'<a class="tsec" href="#{s["id"]}"><span class="tn">{s["num"]}</span><span class="tt">{html.escape(re.sub(r"[`*]|\[\[|\]\]", "", s["title"]))}</span></a>')
            toc.append(f'<div class="tgroup">{"".join(rows)}</div>')
    toc.append("</div></section>")

    front = (HERE / "front.html").read_text(encoding="utf-8")
    cover_img = (FIG / "display.jpg").as_uri()
    front = (front.replace("{{TITLE}}", TITLE).replace("{{SUBTITLE}}", SUBTITLE).replace("{{EDITION}}", EDITION)
             .replace("{{STATEMENT}}", STATEMENT).replace("{{COVER}}", cover_img).replace("{{YEAR}}", str(date.today().year)))
    front_cover, front_notice = front.split("<!--SPLIT-->")
    front_notice = resolve(front_notice)

    css = (HERE / "manual.css").read_text(encoding="utf-8").replace("{{RUNNING}}", f"{TITLE} · {SUBTITLE}").replace("{{STATEMENT}}", STATEMENT)
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{TITLE}: {SUBTITLE}</title>
<meta name="author" content="ROC / ARPA Radar Simulator project"><meta name="description" content="{STATEMENT}">
<meta name="keywords" content="radar, ARPA, ROC, simulator, training, manual"><style>{css}</style></head><body>
{front_cover}{front_notice}{''.join(toc)}{''.join(body)}</body></html>"""
    (FIG.parent / "_manual.html").write_text(doc, encoding="utf-8")
    rendered = HTML(string=doc, base_url=str(HERE)).render()
    rendered.write_pdf(str(OUT))
    if missing:
        print("DRAFT: references not found:", ", ".join(sorted(missing)))
    words = len(re.sub(r"<[^>]+>", " ", "".join(body)).split())
    print(f"{OUT}: {len(rendered.pages)} pages, {n} chapters, {len(figs)} figures, about {words} words, {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
