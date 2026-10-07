'use strict';
// Tests for js/model.js. Run with: node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/model.js');

const preset = (id) => M.PRESETS.find((p) => p.id === id).config;

// Seeded PRNG (mulberry32) so the random-config sweep is repeatable.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('1. Earth preset: Ts, OLR, albedo and state', () => {
  const c = preset('earth');
  const d = M.diagnose(M.createState(c), c);
  assert.ok(d.Ts >= 282 && d.Ts <= 294, `Ts ${d.Ts}`);
  assert.ok(d.olrWm2 >= 225 && d.olrWm2 <= 250, `OLR ${d.olrWm2}`);
  assert.ok(d.albedo >= 0.27 && d.albedo <= 0.33, `albedo ${d.albedo}`);
  assert.equal(d.state.id, 'temperate');
});

test('2. Mars-like preset: Ts 200-225 K, surface pressure about 0.006 bar', () => {
  const c = preset('mars');
  const d = M.diagnose(M.createState(c), c);
  assert.ok(d.Ts >= 200 && d.Ts <= 225, `Ts ${d.Ts}`);
  assert.ok(Math.abs(d.surfacePressureBar - 0.006) < 0.0015, `P ${d.surfacePressureBar}`);
  assert.equal(d.state.id, 'mars_like');
});

test('3. Venus-like preset: Ts 700-780 K and venus_like', () => {
  const c = preset('venus');
  const d = M.diagnose(M.createState(c), c);
  assert.ok(d.Ts >= 700 && d.Ts <= 780, `Ts ${d.Ts}`);
  assert.equal(d.state.id, 'venus_like');
});

test('4. Snowball preset stays cold for 1 Myr at a 1000 yr step', () => {
  const c = preset('snowball');
  const s = M.createState(c);
  const allowed = ['hard_snowball', 'slushball'];
  for (let i = 0; i < 1000; i++) {
    M.step(s, c, 1000);
    assert.ok(s.Ts < 273.15, `Ts ${s.Ts} at ${s.tYears} yr`);
    assert.ok(allowed.includes(M.diagnose(s, c).state.id), `state at ${s.tYears} yr`);
  }
  assert.equal(s.tYears, 1e6);
});

test('5. Gough luminosity law: L(4.57) = 1, L(0) about 0.7, L(5.57) about 1.09', () => {
  assert.ok(Math.abs(M.luminosityRelative(4.57) - 1) < 1e-12);
  assert.ok(Math.abs(M.luminosityRelative(0) - 0.7) < 0.02);
  assert.ok(Math.abs(M.luminosityRelative(5.57) - 1.09) < 0.01);
});

test('6. Mass-radius: 1 M_E gives R = 1.00 R_E and g = 1', () => {
  const d = M.diagnose(M.createState(M.defaultConfig()), M.defaultConfig());
  assert.ok(Math.abs(d.radiusRel - 1) < 0.002, `R ${d.radiusRel}`);
  assert.ok(Math.abs(d.gravityRel - 1) < 0.002, `g ${d.gravityRel}`);
});

test('7. Gradualness: moist onset (Ts > 330 K) and runaway onset are gradual', () => {
  const c = M.defaultConfig();
  const s = M.createState(c);
  let moist = null;
  let runaway = null;
  for (let i = 0; i < 4e6 && (moist === null || runaway === null); i++) {
    M.step(s, c, 1000);
    if (moist === null && s.Ts > 330) moist = s.tYears;
    if (runaway === null && s.oceanDepthM > 0 && M.diagnose(s, c).flags.runawayActive) runaway = s.tYears;
  }
  const gyr = (t) => (t === null ? null : t / 1e9);
  // Actual values are reported in docs/MODEL.md.
  console.log(`      moist onset ${gyr(moist)} Gyr, runaway onset ${gyr(runaway)} Gyr`);
  assert.ok(moist !== null && moist >= 0.1e9, `moist onset ${gyr(moist)} Gyr`);
  assert.ok(runaway !== null && runaway >= 0.5e9, `runaway onset ${gyr(runaway)} Gyr`);
});

test('8. Step above the runaway threshold: Ts takes over 1000 yr to reach 330 K', () => {
  const c = M.defaultConfig();
  c.evolveStar = false;
  const s = M.createState(c);
  c.S = 1.22; // just above the runaway threshold (about 1.21 in the ramp)
  let t330 = null;
  for (let i = 0; i < 5000 && t330 === null; i++) {
    M.step(s, c, 1);
    if (s.Ts >= 330) t330 = s.tYears;
  }
  console.log(`      288 -> 330 K takes ${t330} yr at S = 1.22`);
  assert.ok(t330 !== null && t330 > 1000, `time ${t330}`);
});

test('9. Frame-rate independence at a speed where the sub-step exceeds one year', () => {
  const speed = 1000;
  const dt = M.stepSizeForSpeed(speed);
  assert.ok(dt > 1, `sub-step ${dt}`);
  const run = (hz) => {
    const c = M.defaultConfig();
    const s = M.createState(c);
    const clk = M.Clock.create();
    const frames = Math.round(10 * hz);
    for (let i = 0; i < frames; i++) M.Clock.advance(clk, 1 / hz, speed, s, c);
    return s;
  };
  const a = run(30);
  const b = run(60);
  const e = run(144);
  for (const [x, y] of [[a, b], [a, e], [b, e]]) {
    assert.ok(Math.abs(x.tYears - y.tYears) <= dt + 1e-9, `t ${x.tYears} vs ${y.tYears}`);
    assert.ok(Math.abs(x.Ts - y.Ts) < 0.01, `Ts ${x.Ts} vs ${y.Ts}`);
  }
  console.log(`      30 Hz: t=${a.tYears.toFixed(2)} Ts=${a.Ts.toFixed(4)}; 60 Hz: t=${b.tYears.toFixed(2)} Ts=${b.Ts.toFixed(4)}; 144 Hz: t=${e.tYears.toFixed(2)} Ts=${e.Ts.toFixed(4)}`);
});

test('10. Step convergence: moist-onset time of a slow ramp, 1 yr vs 500 yr sub-step, within 5%', () => {
  const rate = 1e-6; // S per year
  const onset = (dt) => {
    const c = M.defaultConfig();
    c.evolveStar = false;
    const s = M.createState(c);
    for (let i = 0; i < 1e6; i++) {
      c.S = 1 + rate * s.tYears;
      M.step(s, c, dt);
      if (s.Ts >= 330) return s.tYears;
    }
    return null;
  };
  const t1 = onset(1);
  const t500 = onset(500);
  console.log(`      moist onset: 1 yr step ${t1} yr, 500 yr step ${t500} yr`);
  assert.ok(t1 !== null && t500 !== null);
  assert.ok(Math.abs(t1 - t500) / t1 < 0.05, `${t1} vs ${t500}`);
});

test('11. Robustness: 300 random configs over 5000 yr stay finite and physical', () => {
  const r = rng(20261007);
  const pick = (lo, hi) => lo + (hi - lo) * r();
  const logPick = (lo, hi) => Math.exp(pick(Math.log(lo), Math.log(hi)));
  for (let k = 0; k < 300; k++) {
    const c = M.defaultConfig();
    c.massEM = pick(0.1, 5);
    c.coreMassFraction = pick(0, 0.4);
    c.waterOED_m = r() < 0.2 ? 0 : logPick(1, 25000);
    c.landFraction = r();
    c.S = pick(0.3, 2.0);
    c.evolveStar = r() < 0.5;
    c.rotationDays = logPick(0.5, 365);
    c.cloudOffset = pick(-0.2, 0.2);
    c.co2Bar = logPick(1e-5, 90);
    c.ch4Bar = r() < 0.5 ? 0 : logPick(1e-7, 1e-3);
    c.n2Bar = logPick(0.1, 10);
    c.o2Bar = r() < 0.5 ? 0 : pick(0, 0.5);
    c.h2Bar = r() < 0.7 ? 0 : pick(0, 10);
    c.volcanicTmolYr = pick(0.5, 20);
    c.weatheringFactor = pick(0.3, 3);
    const s = M.createState(c);
    for (let i = 0; i < 100; i++) {
      M.step(s, c, 50);
      const vals = [s.Ts, s.Td, s.iceFraction, s.oceanDepthM, s.co2Bar, s.ch4Bar, s.n2Bar, s.o2Bar, s.h2Bar, s.waterOED];
      for (const v of vals) assert.ok(Number.isFinite(v), `non-finite at config ${k}`);
      assert.ok(s.co2Bar >= 0 && s.ch4Bar >= 0 && s.n2Bar >= 0 && s.o2Bar >= 0 && s.h2Bar >= 0, `negative gas at ${k}`);
      assert.ok(s.oceanDepthM >= 0 && s.waterOED >= 0, `negative water at ${k}`);
      assert.ok(s.Ts >= 2 && s.Ts <= 3000, `Ts ${s.Ts} at config ${k}`);
    }
    const d = M.diagnose(s, c);
    assert.ok(d.surfacePressureBar >= 0 && Number.isFinite(d.surfacePressureBar), `pressure at ${k}`);
  }
});

test('12. Water loss and weathering: ocean shrinks over 1 Gyr when warm; warm CO2 falls faster', () => {
  const warm = Object.assign(M.defaultConfig(), { evolveStar: false, S: 1.17 });
  const sw = M.createState(warm);
  const oceanStart = sw.oceanDepthM;
  for (let i = 0; i < 1000; i++) M.step(sw, warm, 1e6);
  assert.ok(sw.oceanDepthM < oceanStart, `ocean ${oceanStart} -> ${sw.oceanDepthM}`);

  const cold = Object.assign(M.defaultConfig(), { evolveStar: false, S: 1.0 });
  const hot = Object.assign(M.defaultConfig(), { evolveStar: false, S: 1.17 });
  const sc = M.createState(cold);
  const sh = M.createState(hot);
  for (let i = 0; i < 1000; i++) {
    M.step(sc, cold, 1e6);
    M.step(sh, hot, 1e6);
  }
  assert.ok(sh.co2Bar < sc.co2Bar, `CO2 warm ${sh.co2Bar} cold ${sc.co2Bar}`);
});

test('13. Classification is stable on repeated calls', () => {
  const c = M.defaultConfig();
  const s = M.createState(c);
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(M.classify(M.diagnose(s, c), c).id);
  assert.deepEqual(ids, [ids[0], ids[0], ids[0]]);
  assert.equal(ids[0], 'temperate');
});

test('extra: sub-step tiers keep at most 500 sub-steps per 60 Hz frame', () => {
  const tiers = [1, 30, 300, 3e3, 3e4, 3e5, 3e6, 3e7, 3e8, 1e9];
  for (const v of tiers) {
    const dt = M.stepSizeForSpeed(v);
    assert.ok(v / 60 / dt <= 500 + 1e-9, `speed ${v}: ${v / 60 / dt} steps per frame`);
    assert.equal(M.stepSizeForSpeed(v), dt, 'pure function of speed');
  }
});

test('extra: editConfig resets gas and water state immediately', () => {
  const c = M.defaultConfig();
  const s = M.createState(c);
  M.editConfig(s, c, { co2Bar: 0.01, waterOED_m: 500, S: 1.1 });
  assert.equal(c.co2Bar, 0.01);
  assert.equal(s.co2Bar, 0.01);
  assert.equal(c.waterOED_m, 500);
  assert.equal(s.waterOED, 500);
  assert.equal(c.S, 1.1);
});
