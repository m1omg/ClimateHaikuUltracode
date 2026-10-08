/*
 * Climate Forge controls and readouts. The panel is built from ClimateModel.PRESETS and
 * the config fields; the HUD and lag meters are filled from the diagnosis. Nothing here
 * changes the physics: user changes go out through handlers and main.js applies them.
 *
 * window.ClimateUI
 *   init(rootEl, handlers)
 *     handlers: onEdit(patch), onPreset(id), onSpeed(yearsPerSecond), onPause(), onReset()
 *   update(diag, state, config, history, run)
 *     run: { paused, yearsPerSecond, ratio }  ratio = share of the selected speed actually run
 *   SPEEDS, SPEED_NAMES: the ten clock tiers, one decade apart
 */
const ClimateUI = (function () {
  'use strict';

  const M = window.ClimateModel;
  const RD = window.ClimateRender;

  const SPEEDS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
  const SPEED_NAMES = ['1 yr/s', '10 yr/s', '100 yr/s', '1 kyr/s', '10 kyr/s',
    '100 kyr/s', '1 Myr/s', '10 Myr/s', '100 Myr/s', '1 Gyr/s'];
  // Slider positions for log-scaled fields run 0..POS_MAX.
  const POS_MAX = 1000;
  const MINUS = '−';
  const DEG = '°';
  const SUP_MINUS_2 = 'W m⁻²';

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // Significant figures without exponent notation (for planet-scale numbers).
  function sig(x, n) {
    if (!isFinite(x)) return '–';
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= n) return String(Math.round(x));
    return x.toFixed(Math.max(0, n - 1 - e));
  }
  const ppm = (bar) => ' (' + sig(bar * 1e6, 3) + ' ppm)';

  // Field definitions. kind: 'lin' (linear slider), 'log' (log slider over the range),
  // 'logzero' (log slider with an exact zero at the far left), 'bool' (checkbox).
  const GROUPS = [
    { title: 'Planet', fields: [
      { key: 'massEM', label: 'Planet mass', kind: 'log', min: 0.1, max: 5,
        fmt: (x) => sig(x, 3) + ' Earth masses',
        help: 'Sets gravity and the thickness of the air layer. Radius follows the Zeng et al. (2016) mass-radius law.' },
      { key: 'waterOED_m', label: 'Water inventory (ocean-equivalent depth)', kind: 'logzero', min: 0.01, max: 25000,
        fmt: (x) => x >= 1000 ? (x / 1000).toFixed(2) + ' km' : sig(x, 3) + ' m',
        help: 'All the water spread evenly over the planet. Earth has about 2.7 km. Liquid water lasts only while it remains.' },
      { key: 'landFraction', label: 'Land fraction', kind: 'lin', min: 0, max: 1, step: 0.01,
        fmt: (x) => Math.round(x * 100) + '% land, ' + Math.round((1 - x) * 100) + '% ocean',
        help: 'Land weathers CO2 and reflects differently from ocean. Fewer oceans means less water to evaporate.' }
    ] },
    { title: 'Star', fields: [
      { key: 'S', label: 'Stellar flux S', kind: 'lin', min: 0.3, max: 2, step: 0.01,
        fmt: (x) => sig(x, 3) + ' x Earth (' + Math.round(x * 1361) + ' ' + SUP_MINUS_2 + ')',
        help: 'Starlight at the planet, with present Earth = 1. Sets how much energy the planet absorbs.' },
      { key: 'evolveStar', label: 'Star brightens over time', kind: 'bool',
        fmt: (x) => x ? 'on' : 'off',
        help: 'Sun-like brightening (Gough 1981). S is then the flux at the star’s starting age.' },
      { key: 'ageGyr', label: 'Star age at start', kind: 'lin', min: 0, max: 10, step: 0.01,
        fmt: (x) => x.toFixed(2) + ' Gyr',
        help: 'Only matters when brightening is on. The Sun is 4.57 Gyr old.' }
    ] },
    { title: 'Spin and air', fields: [
      { key: 'rotationDays', label: 'Rotation period', kind: 'log', min: 0.5, max: 365,
        fmt: (x) => sig(x, 3) + ' days',
        help: 'Length of a day. Very slow rotation (above about 20 days) lets a cloud deck on the day side cool the planet.' },
      { key: 'co2Bar', label: 'Carbon dioxide', kind: 'log', min: 1e-5, max: 100,
        fmt: (x) => RD.formatBar(x) + (x < 0.1 ? ppm(x) : ''),
        help: 'A long-lived greenhouse gas. Weathering removes it over about 240 kyr.' },
      { key: 'ch4Bar', label: 'Methane', kind: 'logzero', min: 1e-8, max: 1e-3,
        fmt: (x) => RD.formatBar(x) + ppm(x),
        help: 'A stronger greenhouse gas than CO2 by mass, but present only in trace amounts here.' },
      { key: 'n2Bar', label: 'Nitrogen', kind: 'log', min: 1e-4, max: 10,
        fmt: (x) => RD.formatBar(x),
        help: 'Background gas. It broadens the infrared absorption of the other gases.' },
      { key: 'o2Bar', label: 'Oxygen', kind: 'lin', min: 0, max: 0.5, step: 0.001,
        fmt: (x) => RD.formatBar(x),
        help: 'Little radiative effect in this model.' },
      { key: 'h2Bar', label: 'Hydrogen', kind: 'logzero', min: 1e-3, max: 10,
        fmt: (x) => RD.formatBar(x),
        help: 'Hydrogen traps heat strongly. It escapes to space when the stratosphere is wet.' }
    ] },
    { title: 'Carbon cycle and albedo', fields: [
      { key: 'volcanicTmolYr', label: 'Volcanic outgassing', kind: 'log', min: 0.5, max: 20,
        fmt: (x) => sig(x, 3) + ' Tmol C per yr',
        help: 'CO2 supply from volcanoes. Balanced against weathering, which speeds up when the planet warms.' },
      { key: 'weatheringFactor', label: 'Weathering strength', kind: 'log', min: 0.3, max: 3,
        fmt: (x) => sig(x, 2) + ' x default',
        help: 'A slow thermostat. Warmer, wetter land takes more CO2 out of the air.' },
      { key: 'cloudOffset', label: 'Albedo offset (clouds)', kind: 'lin', min: -0.2, max: 0.5, step: 0.01,
        fmt: (x) => (x >= 0 ? '+' : MINUS) + Math.abs(x).toFixed(2),
        help: 'Added to the albedo. Positive reflects more sunlight and cools the surface; negative warms it.' }
    ] }
  ];

  // ---- Slider mapping ----------------------------------------------------
  function toPos(f, v) {
    if (f.kind === 'lin') return v;
    const x = Math.log(clamp(v, f.min, f.max) / f.min) / Math.log(f.max / f.min);
    if (f.kind === 'log') return Math.round(x * POS_MAX);
    if (v <= 0) return 0;
    return 1 + Math.round(x * (POS_MAX - 1));
  }
  function fromPos(f, p) {
    if (f.kind === 'lin') {
      const dec = String(f.step).split('.')[1];
      const q = Math.round(p / f.step) * f.step;
      return Number(q.toFixed(dec ? dec.length : 0));
    }
    if (f.kind === 'log') return f.min * Math.pow(f.max / f.min, p / POS_MAX);
    if (p <= 0) return 0;
    return f.min * Math.pow(f.max / f.min, (p - 1) / (POS_MAX - 1));
  }
  function sliderRange(f) {
    if (f.kind === 'lin') return { min: f.min, max: f.max, step: f.step };
    return { min: 0, max: POS_MAX, step: 1 };
  }

  // ---- Module state ------------------------------------------------------
  let root = null;
  let handlers = {};
  let fieldRefs = [];
  let presetBtns = [];
  let presetBlurb = null;
  let pauseBtn = null;
  let speedSel = null;
  let simTimeEl = null;
  let ratioEl = null;
  let hudEls = {};
  let lagEls = {};
  let badgeList = null;
  let badgeKey = '';
  let planetCanvas = null;

  function el(tag, attrs, kids) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'class') node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (k) {
      node.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return node;
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  // ---- Build -------------------------------------------------------------
  function buildClock(parent) {
    pauseBtn = el('button', { type: 'button', class: 'btn', text: 'Pause' });
    pauseBtn.addEventListener('click', function () { if (handlers.onPause) handlers.onPause(); });
    const resetBtn = el('button', { type: 'button', class: 'btn', text: 'Reset' });
    resetBtn.addEventListener('click', function () { if (handlers.onReset) handlers.onReset(); });
    speedSel = el('select', { id: 'speed', 'aria-label': 'Simulation speed' });
    SPEED_NAMES.forEach(function (name, i) {
      speedSel.appendChild(el('option', { value: String(i), text: name }));
    });
    speedSel.addEventListener('change', function () {
      if (handlers.onSpeed) handlers.onSpeed(SPEEDS[Number(speedSel.value)]);
    });
    simTimeEl = el('output', { id: 'sim-time', 'aria-live': 'off' });
    ratioEl = el('p', { class: 'clock-ratio', role: 'status' });
    parent.appendChild(el('fieldset', { class: 'group' }, [
      el('legend', { text: 'Clock' }),
      el('div', { class: 'clock-row' }, [pauseBtn, resetBtn]),
      el('div', { class: 'field' }, [
        el('div', { class: 'field__head' }, [el('label', { for: 'speed', text: 'Speed' }), speedSel])
      ]),
      el('p', { class: 'clock-time' }, ['Simulated time ', simTimeEl]),
      ratioEl
    ]));
  }

  function buildPresets(parent) {
    const grid = el('div', { class: 'preset-grid', role: 'group', 'aria-label': 'Presets' });
    presetBtns = [];
    M.PRESETS.forEach(function (p, i) {
      const btn = el('button', { type: 'button', class: 'btn btn--preset', 'data-id': p.id,
        'aria-pressed': 'false' }, [
        el('span', { class: 'btn__key', 'aria-hidden': 'true', text: String(i + 1) }),
        ' ' + p.name
      ]);
      btn.addEventListener('click', function () { if (handlers.onPreset) handlers.onPreset(p.id); });
      presetBtns.push(btn);
      grid.appendChild(btn);
    });
    presetBlurb = el('p', { class: 'blurb', 'aria-live': 'polite' });
    parent.appendChild(el('fieldset', { class: 'group' }, [
      el('legend', { text: 'Presets' }), grid, presetBlurb
    ]));
  }

  function buildField(f) {
    const id = 'f-' + f.key;
    const helpId = id + '-help';
    if (f.kind === 'bool') {
      const input = el('input', { type: 'checkbox', id: id, 'aria-describedby': helpId });
      const out = el('output', { for: id, class: 'field__out' });
      input.addEventListener('change', function () {
        if (handlers.onEdit) handlers.onEdit({ evolveStar: input.checked });
      });
      fieldRefs.push({ f: f, input: input, out: out });
      return el('div', { class: 'field field--check' }, [
        el('div', { class: 'field__head' }, [
          el('label', { for: id, class: 'check' }, [input, ' ' + f.label]),
          out
        ]),
        el('p', { class: 'field__help', id: helpId, text: f.help })
      ]);
    }
    const r = sliderRange(f);
    const input = el('input', { type: 'range', id: id, min: String(r.min), max: String(r.max),
      step: String(r.step), 'aria-describedby': helpId });
    const out = el('output', { for: id, class: 'field__out' });
    input.addEventListener('input', function () {
      const v = fromPos(f, Number(input.value));
      if (handlers.onEdit) {
        const patch = {};
        patch[f.key] = v;
        handlers.onEdit(patch);
      }
    });
    fieldRefs.push({ f: f, input: input, out: out });
    return el('div', { class: 'field' }, [
      el('div', { class: 'field__head' }, [el('label', { for: id, text: f.label }), out]),
      input,
      el('p', { class: 'field__help', id: helpId, text: f.help })
    ]);
  }

  function buildFields(parent) {
    fieldRefs = [];
    GROUPS.forEach(function (g) {
      parent.appendChild(el('fieldset', { class: 'group' }, [
        el('legend', { text: g.title })
      ].concat(g.fields.map(buildField))));
    });
  }

  function cacheHud() {
    hudEls = {};
    lagEls = {};
    const hud = document.getElementById('hud');
    if (!hud) return;
    hud.querySelectorAll('[data-field]').forEach(function (n) { hudEls[n.getAttribute('data-field')] = n; });
    hud.querySelectorAll('[data-lag]').forEach(function (n) {
      const key = n.getAttribute('data-lag');
      lagEls[key] = { meter: n, fill: n.querySelector('.meter__fill'),
        status: hud.querySelector('[data-lag-status="' + key + '"]') };
    });
    badgeList = hud.querySelector('[data-field="badges"]');
    badgeKey = '';
    planetCanvas = document.getElementById('planet-canvas');
  }

  function init(rootEl, h) {
    if (!rootEl) throw new Error('ClimateUI.init: no controls container');
    root = rootEl;
    handlers = h || {};
    root.textContent = '';
    buildClock(root);
    buildPresets(root);
    buildFields(root);
    cacheHud();
  }

  // ---- Update ------------------------------------------------------------
  function sameConfig(a, b) {
    return Object.keys(b).every(function (k) {
      const x = a[k];
      const y = b[k];
      if (typeof y === 'number') return typeof x === 'number' && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));
      return x === y;
    });
  }

  function nearestSpeedIndex(yps) {
    let best = 0;
    for (let i = 1; i < SPEEDS.length; i++) {
      if (Math.abs(Math.log(SPEEDS[i] / yps)) < Math.abs(Math.log(SPEEDS[best] / yps))) best = i;
    }
    return best;
  }

  function updateClock(state, run) {
    setText(simTimeEl, RD.formatYears(state.tYears));
    setText(pauseBtn, run.paused ? 'Play' : 'Pause');
    const idx = String(nearestSpeedIndex(run.yearsPerSecond));
    // Synced even while focused: a select has no drag to fight, and a focused select
    // must show the speed that keys such as plus and minus have just set.
    if (speedSel.value !== idx) speedSel.value = idx;
    const slow = !run.paused && run.ratio !== undefined && run.ratio < 0.97;
    setText(ratioEl, slow
      ? 'Running at ' + Math.round(run.ratio * 100) + '% of the selected speed. This device cannot keep up.'
      : '');
  }

  function updatePresets(config) {
    let active = null;
    for (let i = 0; i < M.PRESETS.length; i++) {
      if (sameConfig(config, M.PRESETS[i].config)) { active = M.PRESETS[i]; break; }
    }
    presetBtns.forEach(function (btn) {
      const on = String(!!active && btn.getAttribute('data-id') === active.id);
      if (btn.getAttribute('aria-pressed') !== on) btn.setAttribute('aria-pressed', on);
    });
    setText(presetBlurb, active ? active.blurb
      : 'Custom settings. Pick a preset to start again from its values.');
  }

  function updateFields(config) {
    fieldRefs.forEach(function (ref) {
      const f = ref.f;
      const v = config[f.key];
      if (f.kind === 'bool') {
        const on = !!v;
        setText(ref.out, f.fmt(on));
        if (ref.input.checked !== on) ref.input.checked = on;
        return;
      }
      const text = f.fmt(v);
      setText(ref.out, text);
      const pos = toPos(f, v);
      if (document.activeElement !== ref.input && Math.abs(Number(ref.input.value) - pos) > 1e-9) {
        ref.input.value = String(pos);
      }
      if (ref.input.getAttribute('aria-valuetext') !== text) ref.input.setAttribute('aria-valuetext', text);
    });
  }

  function depthText(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
  }

  function noteText(diag) {
    const f = diag.flags;
    if (f.hasLiquidWater && diag.absorbedWm2 > diag.olrCapWm2) {
      return 'No equilibrium with liquid water: absorbed sunlight (' + diag.absorbedWm2.toFixed(0) + ' ' +
        SUP_MINUS_2 + ') is above the ' + diag.olrCapWm2.toFixed(0) + ' ' + SUP_MINUS_2 +
        ' cap, so the ocean is evaporating.';
    }
    if (!f.hasLiquidWater && diag.absorbedWm2 > diag.olrCapWm2) {
      return 'No liquid: absorbed sunlight is above the cap at this temperature, so the surface keeps warming ' +
        'until the steam branch (near 1600 K) can radiate it.';
    }
    if (f.moistGreenhouse) {
      return 'Moist greenhouse: the surface is above 330 K. Water vapour reaches the stratosphere, and hydrogen escapes slowly.';
    }
    return '';
  }

  const LAG_STATUS = {
    mixedLayer: ['settled', 'adjusting', 'far from equilibrium'],
    deepOcean: ['settled', 'adjusting', 'far from equilibrium'],
    iceCover: ['settled', 'adjusting', 'far from equilibrium'],
    carbonate: ['settled', 'adjusting', 'far from equilibrium'],
    waterLoss: ['not evaporating', 'evaporating', 'evaporating fast']
  };
  const LAG_NAMES = {
    mixedLayer: 'Mixed layer',
    deepOcean: 'Deep ocean',
    iceCover: 'Sea ice',
    carbonate: 'Carbonate cycle',
    waterLoss: 'Water loss'
  };

  function badgeLabels(diag, config) {
    const f = diag.flags;
    const out = [];
    if (f.hasLiquidWater) out.push('Liquid water');
    if (f.hasIce) out.push('Sea ice');
    if (f.moistGreenhouse) out.push('Moist greenhouse');
    if (f.runawayActive) out.push('Runaway');
    if (f.hasSteamAtmosphere) out.push('Steam atmosphere');
    if (f.hot) out.push('Above 100 ' + DEG + 'C');
    if (diag.rotationDays >= 20) out.push('Slow rotator');
    if (config.evolveStar) out.push('Brightening star');
    return out;
  }

  function updateHud(diag, config) {
    const f = diag.flags;
    setText(hudEls.stateName, diag.state.name);
    setText(hudEls.stateSummary, diag.state.summary);
    setText(hudEls.note, noteText(diag));
    setText(hudEls.ts, diag.Ts.toFixed(1) + ' K (' + diag.TsC.toFixed(1) + ' ' + DEG + 'C)');
    setText(hudEls.pressure, RD.formatSurfaceBar(diag.surfacePressureBar));
    setText(hudEls.co2, RD.formatBar(diag.pCO2Bar) + (diag.pCO2Bar < 0.1 ? ppm(diag.pCO2Bar) : ''));
    setText(hudEls.ocean, f.hasLiquidWater
      ? Math.round(diag.oceanFraction * 100) + '% of surface, ' + depthText(diag.oceanDepthM) + ' deep'
      : 'No liquid water');
    setText(hudEls.ice, f.hasLiquidWater
      ? Math.round(diag.iceFraction * 100) + '% of the ocean is ice'
      : 'No sea ice');
    setText(hudEls.albedo, diag.albedo.toFixed(3));
    setText(hudEls.absorbed, diag.absorbedWm2.toFixed(0) + ' ' + SUP_MINUS_2);
    setText(hudEls.olr, diag.olrWm2.toFixed(0) + ' ' + SUP_MINUS_2 + ' (cap ' + diag.olrCapWm2.toFixed(0) + ')');
    setText(hudEls.net, (diag.netWm2 >= 0 ? '+' : MINUS) + Math.abs(diag.netWm2).toFixed(1) + ' ' + SUP_MINUS_2);
    setText(hudEls.escape, escapeTimeText(diag.hydrogenLossTimescaleGyr) +
      ' (stratospheric H2O ' + diag.stratosphericH2O.toExponential(1) + ')');

    const labels = badgeLabels(diag, config);
    const key = labels.join('|');
    if (badgeList && key !== badgeKey) {
      badgeKey = key;
      badgeList.textContent = '';
      labels.forEach(function (text) { badgeList.appendChild(el('li', { text: text })); });
    }

    Object.keys(lagEls).forEach(function (key) {
      const ref = lagEls[key];
      const v = diag.lag[key] || 0;
      const level = v < 0.1 ? 0 : (v < 0.4 ? 1 : 2);
      const status = LAG_STATUS[key][level];
      const w = Math.round(v * 100) + '%';
      if (ref.fill && ref.fill.style.width !== w) ref.fill.style.width = w;
      if (ref.meter.getAttribute('aria-valuenow') !== v.toFixed(2)) {
        ref.meter.setAttribute('aria-valuenow', v.toFixed(2));
        ref.meter.setAttribute('aria-valuetext', status);
        ref.meter.setAttribute('aria-label', LAG_NAMES[key] + ' lag');
      }
      setText(ref.status, status);
    });
  }

  // Hydrogen-loss time in a readable form: three significant figures, Myr below 1 Gyr,
  // and a cap label above 100 Gyr (the value is set by an assumed escape rate).
  function escapeTimeText(gyr) {
    if (!isFinite(gyr)) return '–';
    if (gyr > 100) return 'over 100 Gyr';
    if (gyr < 1) return RD.formatYears(gyr * 1e9);
    return String(Number(gyr.toPrecision(3))) + ' Gyr';
  }

  function update(diag, state, config, history, run) {
    if (!root || !diag) return;
    const r = run || { paused: false, yearsPerSecond: SPEEDS[4], ratio: 1 };
    updateClock(state, r);
    updatePresets(config);
    updateFields(config);
    updateHud(diag, config);
    if (planetCanvas) {
      const label = 'Planet view: ' + diag.state.name + ', surface ' + diag.TsC.toFixed(0) + ' ' + DEG + 'C';
      if (planetCanvas.getAttribute('aria-label') !== label) planetCanvas.setAttribute('aria-label', label);
    }
  }

  return {
    init: init,
    update: update,
    SPEEDS: SPEEDS,
    SPEED_NAMES: SPEED_NAMES
  };
})();

if (typeof window !== 'undefined') window.ClimateUI = ClimateUI;
