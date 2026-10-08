/*
 * Climate Forge page driver. Owns the single state object, the clock and the history,
 * and runs the animation loop and keyboard. The model is advanced only through
 * ClimateModel.Clock.advance, fed with clamped wall-clock time. Render and UI calls
 * read the state and never change it.
 *
 * Clock details:
 *  - Each frame's wall time is clamped to WALL_CLAMP_S (no catch-up after a stall).
 *    It is spent in slices of at most CHUNK_S. Each slice ends exactly on the next
 *    history sample time, so the sample times depend only on simulated time.
 *  - Spending stops after BUDGET_MS of model work per frame. Wall time not spent in
 *    that frame is dropped, so a slow device runs below the chosen speed instead of
 *    falling behind. The trajectory against simulated time is the same either way.
 *  - Simulated time passed to the clock but not yet run (clock.acc) is kept, never
 *    discarded, including across speed changes.
 */
(function () {
  'use strict';

  const WALL_CLAMP_S = 0.25;    // largest wall-clock delta accepted for one frame
  const CHUNK_S = 0.002;        // wall slice per Clock.advance call
  const BUDGET_MS = 12;         // model time allowed per frame
  const TICKS_PER_S = 30;       // fixed-rate ticks that drive twinkling (matches render.js)
  const HISTORY_CAP = 600;      // samples kept; when full, every other one is dropped
  const ENERGY_POINTS = 200;
  const DEFAULT_SPEED = 4;      // index into the speed list: 10 kyr/s

  let M = null;
  let R = null;
  let U = null;
  let errorEl = null;
  let config = null;
  let state = null;
  let clock = null;
  let history = null;
  let speedIndex = DEFAULT_SPEED;
  let paused = false;
  let ratio = 1;
  let ratioWall = 0;
  let ratioSim = 0;
  let ticks = 0;
  let ticksAcc = 0;
  let lastMs = null;
  let motion = 1;
  let reducedMotion = false;
  let rafId = 0;
  let stopped = false;

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  function speedYps() {
    return U.SPEEDS[speedIndex];
  }

  // Time delivered to the clock: model time plus the part of the accumulator not yet run.
  function clockTime() {
    return state.tYears + clock.acc;
  }

  // Values at the current model state, stamped with the grid time t.
  function snapshot(t) {
    return {
      t: t,
      Ts: state.Ts,
      depth: state.oceanDepthM,
      co2: state.co2Bar,
      ice: state.iceFraction
    };
  }

  function resetRun() {
    state = M.createState(config);
    clock = M.Clock.create();
    history = { samples: [snapshot(0)], interval: 1, next: 1 };
    ratio = 1;
    ratioWall = 0;
    ratioSim = 0;
  }

  // Store one sample at the grid point history.next. When the buffer is full, keep every
  // other sample and double the spacing, so the history always spans the whole run.
  function recordSample(clockT) {
    history.samples.push(snapshot(history.next));
    if (history.samples.length >= HISTORY_CAP) {
      history.samples = history.samples.filter(function (s, i) { return i % 2 === 0; });
      history.interval *= 2;
      history.next = (Math.floor(clockT / history.interval + 1e-6) + 1) * history.interval;
    } else {
      history.next += history.interval;
    }
  }

  function advance(wall) {
    const yps = speedYps();
    const before = clockTime();
    const budgetEnd = performance.now() + BUDGET_MS;
    let left = wall;
    let guard = 0;
    while (left > 1e-12 && guard++ < 1e6) {
      const clockT = clockTime();
      const gap = history.next - clockT;
      if (gap <= 1e-9 * Math.max(1, history.next)) {
        recordSample(clockT);
        continue;
      }
      if (performance.now() >= budgetEnd) break;
      const w = Math.min(left, CHUNK_S, gap / yps);
      M.Clock.advance(clock, w, yps, state, config);
      left -= w;
    }
    // Wall time left over here is dropped: the budget decides what is not run.
    // Share of the selected speed actually run, measured over half-second windows.
    ratioWall += wall;
    ratioSim += clockTime() - before;
    if (ratioWall >= 0.5) {
      ratio = clamp(ratioSim / (ratioWall * yps), 0, 1);
      ratioWall = 0;
      ratioSim = 0;
    }
  }

  function setSpeed(i) {
    speedIndex = clamp(i, 0, U.SPEEDS.length - 1);
    // Time already passed to the clock stays in clock.acc and runs at the new speed.
    ratio = 1;
    ratioWall = 0;
    ratioSim = 0;
  }

  function togglePause() {
    paused = !paused;
  }

  function applyPreset(id) {
    const p = M.PRESETS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    config = JSON.parse(JSON.stringify(p.config));
    resetRun();
  }

  function toggleHelp() {
    const help = document.getElementById('help');
    if (help) help.open = !help.open;
  }

  const handlers = {
    onEdit: function (patch) { M.editConfig(state, config, patch); },
    onPreset: applyPreset,
    onSpeed: function (yps) { setSpeed(U.SPEEDS.indexOf(yps)); },
    onPause: togglePause,
    onReset: resetRun
  };

  // Keys: space pauses, minus and plus change speed, R resets, 1 to 9 pick presets, H toggles help.
  // Focused controls keep their own keys: buttons, summaries and selects keep space; a focused
  // slider or select does not also apply a preset on a digit key. Plus and minus always work.
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target || {};
    const tag = t.tagName || '';
    const k = e.key;
    const isSpace = k === ' ' || k === 'Spacebar';
    const isDigit = /^[1-9]$/.test(k);
    if (tag === 'TEXTAREA') return;
    if (tag === 'INPUT' && t.type !== 'range') return;
    if ((tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'SELECT') && isSpace) return;
    if (tag === 'BUTTON' && k === 'Enter') return;
    if (tag === 'SELECT' && !(k === '-' || k === '_' || k === '+' || k === '=')) return;
    if ((tag === 'INPUT' || tag === 'SELECT') && isDigit) return;
    if (isSpace) {
      e.preventDefault();
      togglePause();
    } else if (k === '-' || k === '_') {
      setSpeed(speedIndex - 1);
    } else if (k === '+' || k === '=') {
      setSpeed(speedIndex + 1);
    } else if (k === 'r' || k === 'R') {
      resetRun();
    } else if (k === 'h' || k === 'H') {
      toggleHelp();
    } else if (isDigit) {
      const p = M.PRESETS[Number(k) - 1];
      if (p) applyPreset(p.id);
    }
  }

  function frame() {
    if (stopped) return;
    rafId = requestAnimationFrame(frame);
    try {
      const ms = performance.now();
      const wall = lastMs === null ? 0 : clamp((ms - lastMs) / 1000, 0, WALL_CLAMP_S);
      lastMs = ms;
      if (!paused) advance(wall);
      ticksAcc += wall;
      while (ticksAcc >= 1 / TICKS_PER_S) {
        ticks++;
        ticksAcc -= 1 / TICKS_PER_S;
      }
      const diag = M.diagnose(state, config);
      const energy = M.energyCurve(state, config, ENERGY_POINTS);
      R.draw(diag, state, config, history, {
        energy: energy, ticks: ticks, motion: motion, reducedMotion: reducedMotion,
        simTime: clockTime()
      });
      U.update(diag, state, config, history, {
        paused: paused, yearsPerSecond: speedYps(), ratio: ratio
      });
    } catch (err) {
      fail(err);
    }
  }

  function fail(err) {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    const msg = err && err.message ? err.message : String(err);
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = 'Climate Forge stopped: ' + msg + '. Reload the page to start again.';
    }
    if (window.console) console.error(err);
  }

  function boot() {
    errorEl = document.getElementById('error');
    M = window.ClimateModel;
    R = window.ClimateRender;
    U = window.ClimateUI;
    if (!M || !R || !U) {
      throw new Error('a script did not load (check that the js/ folder sits next to index.html)');
    }
    config = M.defaultConfig();
    resetRun();
    U.init(document.getElementById('controls'), handlers);
    R.init({
      planet: document.getElementById('planet-canvas'),
      energy: document.getElementById('energy-canvas'),
      series: document.getElementById('series-canvas')
    });

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const applyMotion = function (on) {
        reducedMotion = on;
        motion = on ? 0.2 : 1;
      };
      applyMotion(mq.matches);
      if (mq.addEventListener) mq.addEventListener('change', function (ev) { applyMotion(ev.matches); });

      const narrow = window.matchMedia('(max-width: 719px)');
      const drawer = document.getElementById('drawer');
      if (drawer && narrow.matches) drawer.open = false;
    }

    window.addEventListener('keydown', onKey);
    rafId = requestAnimationFrame(frame);
  }

  try {
    boot();
  } catch (err) {
    fail(err);
  }
})();
