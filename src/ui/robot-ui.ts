import { Vec2 } from "../core/vec";
import { ROBOT_EXERCISES, ROBOT_LEVELS, RobotAction, RobotHost, RobotLogEntry, RobotRun, RobotView, robotLevel, runRobotStudent } from "../train/index";
import { AppState } from "./app";
import { alertRows } from "./alerts-view";
import { $, esc, mmss } from "./dom";

/**
 * The robot student on the #demo display (radar-simulator.html#demo): it works the ARPA EX exercises with
 * this display's own controls, so that every step can be watched. A pointer moves to each control and
 * presses it; the caption says what it is doing and why; the log keeps every step and every mistake made
 * on purpose. The brain is train/robot-student.ts; this file is only its hands and eyes on the screen.
 *
 * While the robot has the controls, a person's clicks and keys on the display are held back (the robot
 * bar still works): PAUSE stops the clock, STOP ends the run, TAKE OVER hands the exercise to the person.
 */
export interface RobotUiApi {
  getApp: () => AppState;
  /** Where a point of the scenario (NM) is on the screen, in client pixels. */
  clientOf: (p: Vec2) => { x: number; y: number };
  /** Mark the record of the exercise just started as the robot's. */
  markRecord: (robot: { level: number; seed: number; takenOverAt?: number }, label: string) => void;
  /** Someone is working the controls (the display is not left idle). */
  touched: () => void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const frame = (): Promise<void> => new Promise((r) => {
  let done = false;
  const go = (): void => {
    if (!done) {
      done = true;
      r();
    }
  };
  requestAnimationFrame(go);
  setTimeout(go, 60);
});
const fire = (el: HTMLElement): void => {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
const KIND_LABEL: Record<RobotLogEntry["kind"], string> = { read: "READS", think: "THINKS", do: "DOES", answer: "ANSWERS", mistake: "MISTAKE", result: "RESULT" };

export function initRobotUi(api: RobotUiApi): void {
  document.body.classList.add("demo");
  // ---- the bar at the foot of the screen
  const legend = $("legend");
  legend.innerHTML = `<div id="robotBar">
    <div class="rbL">
      <div class="rbTitle"><b>ROBOT STUDENT</b><span>works the ARPA EX exercises</span></div>
      <div class="rbRow"><select id="rbEx" title="The exercise the robot works">${ROBOT_EXERCISES.map((e) => `<option value="${e.id}">${e.number}. ${esc(e.title)}</option>`).join("")}<option value="all">All ${ROBOT_EXERCISES.length} exercises, one after another</option></select></div>
      <div class="rbRow"><select id="rbLevel" title="How good the robot is">${ROBOT_LEVELS.map((l) => `<option value="${l.level}" ${l.level === 5 ? "selected" : ""}>Level ${l.level}: ${l.name}</option>`).join("")}</select>
        <label class="rbSeed" title="The same seed and level give the same mistakes">Seed <input id="rbSeed" type="number" min="1" max="9999" step="1" value="1"></label>
        <select id="rbSpeed" title="How fast the clock runs while the robot waits (its actions are always at normal speed)"><option value="1">Wait 1x</option><option value="2">Wait 2x</option><option value="5">Wait 5x</option><option value="10" selected>Wait 10x</option><option value="20">Wait 20x</option></select></div>
      <div class="rbRow rbKeys"><button id="rbStart" class="rbGo">START</button><button id="rbPause" disabled>PAUSE</button><button id="rbStop" disabled>STOP</button><button id="rbTake" disabled title="Stop the robot and carry on the exercise yourself">TAKE OVER</button></div>
    </div>
    <div class="rbM"><div id="rbCap">Choose an exercise and a level, then press START. The robot works the exercise with the controls of this display.</div><div id="rbAbout"></div><div id="rbStat"></div><div class="tu">Training simulator &middot; not type approved &middot; not for navigation</div></div>
    <div class="rbR"><div id="rbLog" aria-live="polite"></div></div>
  </div>`;
  const pointer = document.createElement("div");
  pointer.id = "rbPointer";
  pointer.hidden = true;
  pointer.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2v17l4.6-4.3 3.3 7.3 3-1.4-3.3-7.1H17z" fill="#ffc928" stroke="#061329" stroke-width="1.4" stroke-linejoin="round"/></svg><span>ROBOT</span>`;
  document.body.appendChild(pointer);

  // The clock's speed key at the top shows the speed the robot runs it at (20x is added for it).
  const clockSel = $<HTMLSelectElement>("speed");
  if (![...clockSel.options].some((o) => o.value === "20")) clockSel.add(new Option("20x", "20"));
  const showClock = (x: number): void => {
    if ([...clockSel.options].some((o) => o.value === String(x))) clockSel.value = String(x);
  };
  const exSel = $<HTMLSelectElement>("rbEx");
  const lvSel = $<HTMLSelectElement>("rbLevel");
  const seedIn = $<HTMLInputElement>("rbSeed");
  const speedSel = $<HTMLSelectElement>("rbSpeed");
  const showAbout = (): void => {
    const l = robotLevel(Number(lvSel.value));
    $("rbAbout").textContent = `Level ${l.level}, ${l.name}: ${l.about}`;
  };
  lvSel.addEventListener("change", showAbout);
  showAbout();

  // ---- the run
  let running = false;
  let paused = false;
  let stop = false;
  let takeOver = false;
  let current: { id: string; level: number; seed: number } | null = null;
  const logEl = $("rbLog");
  const log = (e: RobotLogEntry): void => {
    const div = document.createElement("div");
    div.className = `rbE ${e.kind}`;
    div.innerHTML = `<span class="rbT">${mmss(e.t)}</span><span class="rbK">${KIND_LABEL[e.kind]}</span>${esc(e.text)}`;
    logEl.appendChild(div);
    while (logEl.childElementCount > 400) logEl.firstElementChild?.remove();
    logEl.scrollTop = logEl.scrollHeight;
    if (e.kind !== "read" || $("rbCap").dataset["kind"] === undefined) {
      $("rbCap").textContent = e.text;
      $("rbCap").className = e.kind;
      $("rbCap").dataset["kind"] = e.kind;
    }
  };
  const setButtons = (): void => {
    $<HTMLButtonElement>("rbStart").disabled = running;
    $<HTMLButtonElement>("rbPause").disabled = !running;
    $<HTMLButtonElement>("rbStop").disabled = !running;
    $<HTMLButtonElement>("rbTake").disabled = !running;
    $("rbPause").textContent = paused ? "CONTINUE" : "PAUSE";
    for (const el of [exSel, lvSel, seedIn]) el.disabled = running;
    document.body.classList.toggle("robot-on", running);
    pointer.hidden = !running;
  };
  setInterval(() => {
    if (!running || !current) return;
    const app = api.getApp();
    const s = app.arpaEx;
    const items = s ? `${s.answers.size + s.actionsDone.size} of ${s.def.tasks.filter((t) => t.kind !== "outcome").length} items` : "";
    $("rbStat").textContent = `Exercise ${ROBOT_EXERCISES.find((e) => e.id === current!.id)?.number ?? ""} · level ${current.level} · seed ${current.seed} · exercise time ${mmss(app.world.time)}${paused ? " · PAUSED" : ""}${s ? ` · ${items}` : ""}`;
  }, 400);

  // A person's input is held back while the robot has the controls (its own synthetic events pass).
  const robotBar = $("robotBar");
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "keydown", "keyup", "wheel", "touchstart", "contextmenu"]) {
    window.addEventListener(type, (ev) => {
      if (!running || !ev.isTrusted) return;
      const t = ev.target as Node | null;
      if (t && robotBar.contains(t)) return;
      ev.stopPropagation();
      if (type !== "wheel" && type !== "touchstart") ev.preventDefault();
    }, { capture: true, passive: false });
  }

  // ---- the hands: a pointer that moves to each control and presses it
  let px = window.innerWidth / 2, py = window.innerHeight / 2;
  const fast = (): number => (Number(speedSel.value) >= 10 ? 0.6 : 1);
  const place = (): void => {
    pointer.style.transform = `translate(${px}px, ${py}px)`;
  };
  place();
  const moveTo = async (x: number, y: number): Promise<void> => {
    const x0 = px, y0 = py;
    const dist = Math.hypot(x - x0, y - y0);
    const ms = Math.min(650, 160 + dist * 0.45) * fast();
    const t0 = performance.now();
    for (;;) {
      const f = Math.min(1, (performance.now() - t0) / ms);
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      px = x0 + (x - x0) * e;
      py = y0 + (y - y0) * e;
      place();
      if (f >= 1) break;
      await frame();
    }
  };
  const ripple = (x: number, y: number): void => {
    const r = document.createElement("div");
    r.className = "rbRipple";
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
  };
  const centre = (el: Element): { x: number; y: number } => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 14) };
  };
  const menuOpen = (): boolean => document.body.classList.contains("menu-open");
  /** Put the pointer on an element and press it. */
  const press = async (el: HTMLElement): Promise<void> => {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const c = centre(el);
    await moveTo(c.x, c.y);
    ripple(c.x, c.y);
    el.classList.add("rbHit");
    setTimeout(() => el.classList.remove("rbHit"), 450);
    el.click();
    await sleep(220 * fast());
  };
  /** The menu drawer, with the controls of one menu key in it. */
  const openMenu = async (key: string): Promise<void> => {
    if (!menuOpen()) await press($("menuKey"));
    const b = document.querySelector<HTMLElement>(`#cMenu button[data-key="${key}"]`);
    if (b && !b.classList.contains("on")) await press(b);
  };
  const closeMenu = async (): Promise<void> => {
    if (menuOpen()) await press($("menuClose"));
  };
  /** Close the drawer when it covers a point of the screen. */
  const uncover = async (x: number, y: number): Promise<void> => {
    if (!menuOpen()) return;
    const top = document.elementFromPoint(x, y);
    if (top && $("side").contains(top)) await closeMenu();
  };
  /** An element of the panels (not the drawer), uncovered first. */
  const pressPanel = async (id: string | HTMLElement): Promise<void> => {
    const el = typeof id === "string" ? $(id) : id;
    const c = centre(el);
    await uncover(c.x, c.y);
    await press(el);
  };
  /** Set a control in the drawer (or anywhere) the way a person would: type, slide, pick or tick. */
  const setControl = async (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string | boolean, menu?: string): Promise<void> => {
    if (menu) await openMenu(menu);
    else {
      const c0 = centre(el);
      await uncover(c0.x, c0.y);
    }
    el.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(40);
    const box = el.getBoundingClientRect();
    const c = centre(box.width > 0 && box.height > 0 ? el : (el.parentElement ?? el));
    await moveTo(c.x, c.y);
    ripple(c.x, c.y);
    el.classList.add("rbHit");
    setTimeout(() => el.classList.remove("rbHit"), 500);
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      if (el.checked !== value) el.click();
    } else if (el instanceof HTMLInputElement && el.type === "range") {
      // A radar control slides; a course is set at once (sliding it from 330 to 030 would pass through 300, 270 ...:
      // the autopilot would be ordered round to port on the way).
      const from = Number(el.value), to = Number(value);
      const slide = ["gain", "stc", "ftc", "tuning", "brill"].includes(el.id);
      const steps = slide ? Math.max(1, Math.min(10, Math.round(Math.abs(to - from) / 2))) : 0;
      for (let i = 1; i <= steps; i++) {
        el.value = String(from + ((to - from) * i) / steps);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(25 * fast());
      }
      el.value = String(to);
      fire(el);
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(value);
      fire(el);
    } else {
      // Typed, a few characters at a time.
      const text = String(value);
      el.focus({ preventScroll: true });
      el.value = "";
      const chunk = text.length > 40 ? 14 : 1;
      for (let i = 0; i < text.length; i += chunk) {
        el.value = text.slice(0, i + chunk);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(30 * fast());
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    }
    await sleep(180 * fast());
  };
  const input = <T extends HTMLElement = HTMLInputElement>(id: string): T => $<T>(id);
  /** A click on the radar picture at a point of the scenario (NM). */
  const clickPicture = async (where: () => Vec2): Promise<void> => {
    const canvas = $<HTMLCanvasElement>("ppi");
    let c = api.clientOf(where());
    await uncover(c.x, c.y);
    await moveTo(c.x, c.y);
    c = api.clientOf(where()); // the echo has moved on a little meanwhile
    px = c.x;
    py = c.y;
    place();
    ripple(c.x, c.y);
    const opts = { bubbles: true, clientX: c.x, clientY: c.y, pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0 };
    canvas.dispatchEvent(new PointerEvent("pointermove", opts));
    canvas.dispatchEvent(new PointerEvent("pointerdown", { ...opts, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", opts));
    await sleep(250 * fast());
  };
  const clickMode = async (id: "cmAcq" | "cmSel" | "cmEbl"): Promise<void> => {
    if (!$(id).classList.contains("on")) await pressPanel(id);
  };
  const targetPos = (id: number): (() => Vec2) => () => api.getApp().world.targets.find((t) => t.id === id)?.pos ?? api.getApp().world.own.pos;
  const ensureRunning = async (): Promise<void> => {
    const app = api.getApp();
    if (!app.running && !(app.arpaEx?.finished)) await pressPanel("run");
  };

  const host: RobotHost = {
    view: (): RobotView => {
      const app = api.getApp();
      return { w: app.world, a: app.arpa, s: app.arpaEx!, selected: app.arpaSelected, mob: app.mob, measured: app.ebl.on && app.vrm.on ? { bearing: app.ebl.bearing, range: app.vrm.range } : null };
    },
    wait: async (sec: number): Promise<void> => {
      const target = api.getApp().world.time + sec;
      await ensureRunning();
      while (!stop && api.getApp().world.time < target - 1e-6) {
        const app = api.getApp();
        if (paused) {
          app.running = false;
          await sleep(100);
          continue;
        }
        if (!app.running && !app.arpaEx?.finished) {
          app.running = true;
          $("run").textContent = "Pause";
        }
        app.timeScale = Number(speedSel.value);
        showClock(app.timeScale);
        await frame();
      }
      api.getApp().timeScale = 1;
      showClock(1);
    },
    act: async (a: RobotAction): Promise<void> => {
      while (paused && !stop) await sleep(100);
      if (stop) return;
      const app = api.getApp();
      app.timeScale = 1;
      showClock(1);
      api.touched();
      await doAct(a);
    },
    alerts: () => alertRows(api.getApp()).filter((r) => !r.acked && r.priority !== "caution"),
    log,
    stopRequested: () => stop,
  };

  const doAct = async (a: RobotAction): Promise<void> => {
    switch (a.k) {
      case "open": {
        await openMenu("ex");
        const b = document.querySelector<HTMLElement>(`#exList button[data-ex="${current!.id}"]`);
        if (b) await press(b);
        else return;
        api.markRecord({ level: current!.level, seed: current!.seed }, `Robot student (level ${current!.level})`);
        // Reading the briefing.
        $("exRun").scrollIntoView({ block: "start" });
        await sleep(1800 * fast());
        $("exCrit").scrollIntoView({ block: "start" });
        await sleep(900 * fast());
        return;
      }
      case "run":
        return ensureRunning();
      case "acquire":
        await clickMode("cmAcq");
        return clickPicture(targetPos(a.target));
      case "select":
        await clickMode("cmSel");
        return clickPicture(targetPos(a.target));
      case "measure":
        await clickMode("cmEbl");
        return clickPicture(a.at ? () => a.at! : targetPos(a.target ?? 0));
      case "vectors":
        return pressPanel(document.querySelector<HTMLElement>(`#vecSeg button[data-v="${a.mode}"]`)!);
      case "past":
        return setControl(input<HTMLSelectElement>("pastMode"), a.mode, "past");
      case "limits":
        await setControl(input("arpaCpaLim"), String(a.cpa), "alarm");
        return setControl(input("arpaTcpaLim"), String(a.tcpa), "alarm");
      case "zone":
        return setControl(input(a.which === "guard" ? "z_g0_on" : "z_x0_on"), a.on, "guard");
      case "autoAcquire":
        return setControl(input("arpaAuto"), a.on);
      case "trial":
        if (!a.on) return setControl(input("trialOn"), false, "trial");
        await setControl(input("trialOn"), true, "trial");
        if (a.course !== undefined) await setControl(input("trialCourse"), String(Math.round(a.course)), "trial");
        if (a.speed !== undefined) await setControl(input("trialSpeed"), String(a.speed), "trial");
        if (a.delay !== undefined) await setControl(input("trialDelay"), String(a.delay), "trial");
        return;
      case "course":
        return setControl(input("ordCourse"), String(Math.round(a.deg) % 360), "own");
      case "speed": {
        await openMenu("own");
        const shown = $("ordSpeedV");
        shown.scrollIntoView({ block: "center" });
        const c = centre(shown);
        await moveTo(c.x, c.y);
        ripple(c.x, c.y);
        shown.classList.add("rbHit");
        setTimeout(() => shown.classList.remove("rbHit"), 500);
        const el = input("ordSpeed");
        el.value = String(a.kn);
        fire(el);
        await sleep(220 * fast());
        return;
      }
      case "helm":
        await openMenu("own");
        if (!$("steerHand").classList.contains("on")) await press($("steerHand"));
        await press(document.querySelector<HTMLElement>(`#helmScale button[data-v="${Math.max(-35, Math.min(35, Math.round(a.deg / 5) * 5))}"]`)!);
        return;
      case "autopilot":
        await openMenu("own");
        await press($("steerAuto"));
        return setControl(input("ordCourse"), String(Math.round(a.course) % 360), "own");
      case "ack":
        return pressPanel("ackKey");
      case "selfTest":
        await openMenu("arpa");
        return press($("arpaTest"));
      case "groundRef":
        return setControl(input<HTMLSelectElement>("arpaStab"), "ground", "past");
      case "anchorWatch":
        await openMenu("alarm");
        return press($("anchorSet"));
      case "pi":
        await setControl(input(`pi${a.index}Brg`), String(a.bearing), "meas");
        await setControl(input(`pi${a.index}Rng`), String(Math.round(a.range * 100) / 100), "meas");
        return setControl(input(`pi${a.index}On`), a.on, "meas");
      case "navLine":
        await openMenu("meas");
        await press($("navDraw"));
        await closeMenu();
        for (const p of a.points) await clickPicture(() => p);
        await openMenu("meas");
        await press($("navDraw"));
        return;
      case "radarKey":
        return pressPanel("radarSb");
      case "control":
        return setControl(input(a.id), String(Math.round(a.value)));
      case "processing":
        return setControl(input(a.id), a.on, "gain");
      case "range":
        return setControl(input<HTMLSelectElement>("range"), String(a.nm));
      case "pm":
        return setControl(input("pmOn"), a.on, "gain");
      case "letGo":
        await openMenu("own");
        return press($("anchorKey"));
      case "mob":
        await openMenu("own");
        return press($("mobKey"));
      case "search":
        await setControl(input<HTMLSelectElement>("spKind"), "square", "meas");
        await setControl(input<HTMLSelectElement>("spDatum"), "mob", "meas");
        await setControl(input("spSize"), String(a.size), "meas");
        await setControl(input("spCourse"), String(Math.round(a.course) % 360), "meas");
        await press($("spMake"));
        return;
      case "answer": {
        const el = document.getElementById(`exIn_${a.task}`) as HTMLInputElement | HTMLSelectElement | null;
        if (!el) return;
        await setControl(el, String(a.value), "ex");
        const b = document.querySelector<HTMLElement>(`#exTaskList button[data-ans="${a.task}"]`);
        if (b) await press(b);
        return;
      }
      case "finish":
        await openMenu("ex");
        await press($("exFinish"));
        await sleep(400);
        $("exResult").scrollIntoView({ block: "start" });
        await sleep(1500 * fast());
        return;
      case "debrief":
        await setControl(input<HTMLTextAreaElement>("dbSelf"), a.text, "ex");
        await press($("dbSave"));
        return;
    }
  };

  const runOne = async (id: string, level: number, seed: number): Promise<RobotRun | null> => {
    const ex = ROBOT_EXERCISES.find((e) => e.id === id);
    if (!ex) return null;
    current = { id, level, seed };
    return runRobotStudent(ex, host, level, seed);
  };

  $("rbStart").addEventListener("click", async () => {
    if (running) return;
    running = true;
    paused = false;
    stop = false;
    takeOver = false;
    logEl.innerHTML = "";
    delete $("rbCap").dataset["kind"];
    setButtons();
    const level = Number(lvSel.value);
    const seed = Math.max(1, Math.round(Number(seedIn.value) || 1));
    const ids = exSel.value === "all" ? ROBOT_EXERCISES.map((e) => e.id) : [exSel.value];
    const results: { id: string; run: RobotRun | null }[] = [];
    try {
      for (const id of ids) {
        const run = await runOne(id, level, seed);
        results.push({ id, run });
        if (stop) break;
        await sleep(1200);
      }
    } catch (e) {
      log({ t: api.getApp().world.time, kind: "mistake", text: `The robot stopped with an error: ${e instanceof Error ? e.message : String(e)}` });
    }
    if (ids.length > 1) {
      const done = results.filter((r) => r.run?.result);
      const mean = done.length > 0 ? done.reduce((s, r) => s + r.run!.result!.percent, 0) / done.length : 0;
      log({ t: api.getApp().world.time, kind: "result", text: `All exercises, level ${level}, seed ${seed}: ${done.map((r) => `${ROBOT_EXERCISES.find((e) => e.id === r.id)?.number}: ${Math.round(r.run!.result!.percent)}%`).join(", ")}. Mean ${mean.toFixed(0)}%.` });
    }
    if (takeOver && current) {
      const app = api.getApp();
      api.markRecord({ level: current.level, seed: current.seed, takenOverAt: Math.round(app.world.time) }, `Robot student (level ${current.level}), then taken over`);
      log({ t: app.world.time, kind: "result", text: "Taken over: the exercise is yours now. The record shows when the robot handed over." });
    } else if (stop) log({ t: api.getApp().world.time, kind: "result", text: "Stopped." });
    api.getApp().timeScale = 1;
    running = false;
    paused = false;
    setButtons();
  });
  $("rbPause").addEventListener("click", () => {
    paused = !paused;
    const app = api.getApp();
    if (paused) {
      app.running = false;
      $("run").textContent = "Run";
    }
    setButtons();
  });
  $("rbStop").addEventListener("click", () => {
    stop = true;
    paused = false;
    setButtons();
  });
  $("rbTake").addEventListener("click", () => {
    stop = true;
    takeOver = true;
    paused = false;
    setButtons();
  });
  setButtons();
}
