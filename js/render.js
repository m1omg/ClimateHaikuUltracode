/*
 * Climate Forge drawing. Everything here reads the model's output and paints it;
 * nothing writes back into the physics state.
 *
 * window.ClimateRender
 *   init(canvasEls)                       canvasEls = { planet, energy, series }
 *   draw(diag, state, config, history, opts)
 *     opts.energy          ClimateModel.energyCurve output for the current state
 *     opts.ticks           fixed-rate counter (30 per wall second) that drives twinkling
 *     opts.motion          0..1 scale on planet spin and cloud drift (reduced motion uses less)
 *     opts.reducedMotion   turns off twinkling
 *   formatYears(t), formatSurfaceBar(p), formatBar(p)   text helpers shared with the UI
 */
const ClimateRender = (function () {
  'use strict';

  // ---- Constants ---------------------------------------------------------
  const TAU = Math.PI * 2;
  const TEX_W = 512;                // map width, a power of two so column masks wrap
  const TEX_H = 256;
  const TEX_MASK = TEX_W - 1;
  const DAYS_PER_YEAR = 365.25;
  const AXIS_TILT = 0.4;            // rad, spin axis tipped towards the viewer so a pole shows
  const CRITICAL_T = 647.1;         // K, liquid water cannot exist above this (model limit)
  const CAP_BASE = 282;             // W m^-2, clear-sky moist cap, drawn as a reference line
  const ENERGY_MIN_T = 150;         // K, x range of the energy diagram (matches energyCurve)
  const ENERGY_MAX_T = 2000;
  const PLANET_RADIUS = 0.3;        // planet radius as a fraction of the shorter canvas side
  const BG_STARS = 260;
  const TWINKLE_N = 40;
  const TWINKLE_TICKS_PER_S = 30;   // must match the tick rate in main.js
  const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const SEED_TERRAIN = 1993;        // fixed seeds: the same planet looks the same on every visit
  const SEED_CLOUD = 7741;
  const SEED_DETAIL = 3307;
  const SEED_STARS = 20261007;

  function unit(v) {
    const n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  }
  // Unit vector from the planet towards the star, in the view frame (x right, y up, z to viewer).
  const LIGHT = unit([-0.55, 0.5, 0.67]);

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const frac = (x) => x - Math.floor(x);
  const lerp = (a, b, t) => a + (b - a) * t;
  function smooth(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ---- Text helpers ------------------------------------------------------
  function addCommas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  // Simulated time: years below a million, then Myr, then Gyr.
  function formatYears(t) {
    if (!isFinite(t)) return '–';
    if (t < 1e6) return addCommas(Math.round(t)) + ' yr';
    if (t < 1e9) return (t / 1e6).toFixed(2) + ' Myr';
    return (t / 1e9).toFixed(3) + ' Gyr';
  }
  // Gas partial pressure in bar.
  function formatBar(p) {
    if (!isFinite(p)) return '–';
    if (p <= 0) return '0 bar';
    if (p < 0.01) return p.toExponential(2) + ' bar';
    if (p < 10) return p.toPrecision(3) + ' bar';
    return p.toFixed(1) + ' bar';
  }
  // Surface pressure: millibar for thin air.
  function formatSurfaceBar(p) {
    if (!isFinite(p)) return '–';
    if (p < 0.1) return (p * 1000).toPrecision(3) + ' mbar';
    return formatBar(p);
  }

  // ---- Colour helpers ----------------------------------------------------
  // Blackbody colour for a temperature (Tanner Helland's fit), 0..1 per channel.
  function kelvinToRgb(T) {
    const t = T / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    let b;
    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
  }
  function starColour(lum) {
    return kelvinToRgb(clamp(5772 * Math.pow(Math.max(lum, 0.05), 0.25), 2600, 12000));
  }
  // Halo colour: partial-pressure weighted mix of the gas colours.
  function atmosphereColour(diag) {
    const parts = [
      [diag.pCO2Bar, 0.92, 0.72, 0.46],                // CO2: warm tan
      [diag.pN2Bar + diag.pO2Bar, 0.55, 0.72, 1.0],    // N2 and O2: blue
      [diag.pH2Bar, 0.78, 0.66, 0.98],                 // H2: pale violet
      [diag.pH2OBar, 0.84, 0.92, 1.0],                 // steam: white-blue
      [diag.pCH4Bar, 0.9, 0.62, 0.26]                  // methane: ochre
    ];
    let sum = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < parts.length; i++) {
      const w = Math.max(0, parts[i][0] || 0);
      sum += w;
      r += w * parts[i][1];
      g += w * parts[i][2];
      b += w * parts[i][3];
    }
    if (sum <= 0) return [0.55, 0.72, 1.0];
    return [r / sum, g / sum, b / sum];
  }
  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
      Math.round(c[2] * 255) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }

  // ---- Seeded noise ------------------------------------------------------
  // Mulberry32: a small seeded PRNG, so procedural maps repeat exactly.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Value noise on a lattice. Longitude wraps (the lattice is periodic in x), so the
  // map has no seam. Each octave doubles the lattice and halves the amplitude.
  function valueNoise(L, u, v) {
    const x = u * L.nx;
    const y = v * (L.ny - 1);
    const xi = Math.floor(x);
    const yi = Math.min(Math.floor(y), L.ny - 2);
    const fx = smooth(0, 1, x - xi);
    const fy = smooth(0, 1, y - yi);
    const x0 = xi % L.nx;
    const x1 = (x0 + 1) % L.nx;
    const a = L.grid[yi * L.nx + x0];
    const b = L.grid[yi * L.nx + x1];
    const c = L.grid[(yi + 1) * L.nx + x0];
    const d = L.grid[(yi + 1) * L.nx + x1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  function fbmField(seed, baseCols, octaves) {
    const rand = mulberry32(seed);
    const layers = [];
    let amp = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      const nx = baseCols << o;
      const ny = (nx >> 1) + 1;
      const grid = new Float32Array(nx * ny);
      for (let i = 0; i < grid.length; i++) grid[i] = rand();
      layers.push({ nx: nx, ny: ny, grid: grid, amp: amp });
      total += amp;
      amp *= 0.5;
    }
    const out = new Float32Array(TEX_W * TEX_H);
    for (let j = 0; j < TEX_H; j++) {
      const v = (j + 0.5) / TEX_H;
      for (let i = 0; i < TEX_W; i++) {
        const u = (i + 0.5) / TEX_W;
        let s = 0;
        for (let k = 0; k < layers.length; k++) s += layers[k].amp * valueNoise(layers[k], u, v);
        out[j * TEX_W + i] = s / total;
      }
    }
    return out;
  }

  // Rank-normalise a field to (0, 1]. A threshold on the result covers an exact fraction
  // of the map, which lets land fraction and cloud cover match their targets.
  function equalize(src) {
    const BINS = 4096;
    const hist = new Float64Array(BINS);
    for (let i = 0; i < src.length; i++) {
      hist[clamp(Math.floor(src[i] * BINS), 0, BINS - 1)]++;
    }
    const cdf = new Float32Array(BINS);
    let acc = 0;
    for (let b = 0; b < BINS; b++) {
      acc += hist[b];
      cdf[b] = acc / src.length;
    }
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) {
      out[i] = cdf[clamp(Math.floor(src[i] * BINS), 0, BINS - 1)];
    }
    return out;
  }

  // ---- Surface maps ------------------------------------------------------
  // Static terrain, cloud and detail fields are built once. Colours are rebuilt only
  // when the quantised surface key changes (land, ice, ocean depth, glow).
  let maps = null;
  function getMaps() {
    if (maps) return maps;
    const n = TEX_W * TEX_H;
    const detail = equalize(fbmField(SEED_DETAIL, 24, 3));
    const crack = new Float32Array(n);
    for (let i = 0; i < n; i++) crack[i] = clamp(1 - Math.abs(detail[i] - 0.5) * 24, 0, 1);
    maps = {
      elev: equalize(fbmField(SEED_TERRAIN, 6, 5)),
      // Cloud features are finer than the continents, so cloud cover does not read as land.
      cloud: equalize(fbmField(SEED_CLOUD, 24, 6)),
      detail: detail,
      crack: crack,
      SR: new Float32Array(n), SG: new Float32Array(n), SB: new Float32Array(n),
      OC: new Float32Array(n),
      ER: new Float32Array(n), EG: new Float32Array(n), EB: new Float32Array(n),
      key: ''
    };
    return maps;
  }

  // Fraction of the sphere covered by ice. Sea ice is a fraction of the ocean, so it
  // is scaled by the ocean area. Dry, cold planets get a thin frost cap.
  function iceCover(diag) {
    if (diag.flags.hasLiquidWater) return clamp(diag.iceFraction * diag.oceanFraction, 0, 1);
    return diag.Ts < 240 ? 0.04 : 0;
  }
  // 0..1 glow: the surface starts to emit above about 950 K and is fully lit by 1450 K.
  function emitLevel(Ts) {
    return clamp((Ts - 950) / 500, 0, 1);
  }
  // 0..1 warmth of the surface, from 300 K (cool) to 360 K (warm): shifts ocean colour.
  function warmLevel(Ts) {
    return clamp((Ts - 300) / 60, 0, 1);
  }

  // Colour maps for the current surface. Ocean shades from turquoise (shallow) to navy
  // (deep). Low ocean fraction tints land toward desert. Ice is a latitude cap whose
  // edge is jittered so it looks organic. Hot surfaces glow along thin crack lines.
  function buildSurface(m, diag, config) {
    const liquid = diag.flags.hasLiquidWater;
    const oceanF = diag.oceanFraction;
    const landThr = 1 - clamp(config.landFraction, 0, 1);  // land where equalised elevation >= this
    const iceF = iceCover(diag);
    const iceEdge = 1 - iceF;
    const emit = emitLevel(diag.Ts);
    const dense = diag.pCO2Bar > 5;
    const desert = liquid ? clamp((0.6 - oceanF) / 0.4, 0, 1) : 0;
    const depthF = clamp(diag.oceanDepthM / 3000, 0, 1);
    const warm = warmLevel(diag.Ts);
    for (let j = 0; j < TEX_H; j++) {
      const lat = (0.5 - (j + 0.5) / TEX_H) * Math.PI;
      const sinLat = Math.abs(Math.sin(lat));
      for (let i = 0; i < TEX_W; i++) {
        const t = j * TEX_W + i;
        const e = m.elev[t];
        const d = m.detail[t];
        let r;
        let g;
        let b;
        let oc = 0;
        if (e >= landThr) {
          if (liquid) {
            const k = clamp(desert + (d - 0.5) * 0.4, 0, 1);
            r = lerp(0.24, 0.80, k);
            g = lerp(0.42, 0.66, k);
            b = lerp(0.20, 0.40, k);
          } else if (dense) {
            r = 0.27; g = 0.23; b = 0.21;        // basalt plains
          } else {
            r = 0.62; g = 0.42; b = 0.28;        // rust dust
          }
          const shade = (0.86 + 0.28 * e) * (0.92 + 0.16 * d);
          r *= shade; g *= shade; b *= shade;
        } else if (liquid) {
          r = lerp(0.14, 0.03, depthF) * (0.94 + 0.12 * d);
          g = lerp(0.55, 0.13, depthF) * (0.94 + 0.12 * d);
          b = lerp(0.62, 0.32, depthF) * (0.94 + 0.12 * d);
          // Hot oceans look murkier: a warm shift toward olive, from about 300 K up.
          r = lerp(r, 0.34, 0.5 * warm);
          g = lerp(g, 0.40, 0.5 * warm);
          b = lerp(b, 0.22, 0.5 * warm);
          oc = 1;
        } else {
          const basin = dense ? 0.2 : 0.36;
          r = basin * (0.85 + 0.3 * d);
          g = (dense ? 0.18 : 0.26) * (0.85 + 0.3 * d);
          b = (dense ? 0.17 : 0.2) * (0.85 + 0.3 * d);
        }
        // The edge jitter shrinks toward the pole, where one row of texels spans all
        // longitudes; without this the cap edge fans out in radial wedges.
        if (iceF > 0 && sinLat + (d - 0.5) * 0.12 * Math.cos(lat) >= iceEdge) {
          r = 0.92; g = 0.96; b = 1.0; oc = 0;
        }
        const glow = emit * (0.12 + 0.9 * m.crack[t] * (0.5 + 0.5 * d));
        m.SR[t] = r; m.SG[t] = g; m.SB[t] = b;
        m.OC[t] = oc;
        m.ER[t] = glow; m.EG[t] = glow * 0.42; m.EB[t] = glow * 0.12;
      }
    }
    // Near the poles one texel row spans every longitude, so nearest-texel sampling
    // draws radial spokes. Blend each polar row toward its longitudinal mean.
    for (let j = 0; j < TEX_H; j++) {
      const cosLat = Math.cos((0.5 - (j + 0.5) / TEX_H) * Math.PI);
      const w = 1 - smooth(0.35, 0.7, cosLat);
      if (w <= 0) continue;
      const mean = [m.SR, m.SG, m.SB, m.OC, m.ER, m.EG, m.EB].map(function (arr) {
        let sum = 0;
        for (let i = 0; i < TEX_W; i++) sum += arr[j * TEX_W + i];
        return sum / TEX_W;
      });
      const arrs = [m.SR, m.SG, m.SB, m.OC, m.ER, m.EG, m.EB];
      for (let i = 0; i < TEX_W; i++) {
        const t = j * TEX_W + i;
        for (let a = 0; a < arrs.length; a++) arrs[a][t] = lerp(arrs[a][t], mean[a], w);
      }
    }
  }

  function surfaceMapsFor(diag, config) {
    const m = getMaps();
    const key = [
      config.landFraction.toFixed(3),
      diag.flags.hasLiquidWater ? 1 : 0,
      Math.round(diag.oceanDepthM / 40),
      Math.round(iceCover(diag) * 60),
      Math.round(emitLevel(diag.Ts) * 30),
      Math.round(warmLevel(diag.Ts) * 10),
      diag.pCO2Bar > 5 ? 1 : 0
    ].join('|');
    if (key !== m.key) {
      buildSurface(m, diag, config);
      m.key = key;
    }
    return m;
  }

  // ---- Planet disk map (built per canvas size) ---------------------------
  // For each device pixel inside the disk we store the texel offset for the un-spun
  // longitude, the texel row, the light factor, the specular term and the edge coverage.
  // Per frame, only the longitude shift changes, so the frame loop is cheap.
  function buildDisk(Rdev) {
    const half = Math.ceil(Rdev + 2);
    const side = half * 2;
    const cosT = Math.cos(AXIS_TILT);
    const sinT = Math.sin(AXIS_TILT);
    const pos = [];
    const cb = [];
    const ro = [];
    const lit = [];
    const sp = [];
    const ea = [];
    const hx = LIGHT[0];
    const hy = LIGHT[1];
    const hz = LIGHT[2] + 1;
    const hn = Math.hypot(hx, hy, hz);
    for (let py = 0; py < side; py++) {
      for (let px = 0; px < side; px++) {
        const nx = (px + 0.5 - half) / Rdev;
        const ny = (half - py - 0.5) / Rdev;
        const r2 = nx * nx + ny * ny;
        const r = Math.sqrt(r2);
        const coverage = clamp((1 - r) * Rdev + 0.5, 0, 1);  // one-pixel anti-aliased edge
        if (coverage <= 0) continue;
        const nz = Math.sqrt(Math.max(0, 1 - r2));
        const lat = Math.asin(clamp(ny * cosT + nz * sinT, -1, 1));
        const lon = Math.atan2(nx, nz * cosT - ny * sinT);
        const col = Math.floor((lon / TAU + 1) * TEX_W) & TEX_MASK;
        const row = clamp(Math.floor((0.5 - lat / Math.PI) * TEX_H), 0, TEX_H - 1);
        const ndl = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const day = 0.05 + 0.95 * smooth(-0.2, 0.45, ndl) * (0.45 + 0.55 * clamp(ndl, 0, 1));
        const ndh = (nx * hx + ny * hy + nz * hz) / hn;
        const spec = ndl > 0 ? Math.pow(Math.max(ndh, 0), 40) * 0.55 : 0;
        pos.push((py * side + px) * 4);
        cb.push(col);
        ro.push(row * TEX_W);
        lit.push(day * (0.8 + 0.2 * nz));
        sp.push(spec);
        ea.push(coverage);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    return {
      canvas: canvas,
      ctx: ctx,
      img: ctx.createImageData(side, side),
      side: side,
      half: half,
      n: pos.length,
      pos: Int32Array.from(pos),
      cb: Int32Array.from(cb),
      ro: Int32Array.from(ro),
      lit: Float32Array.from(lit),
      sp: Float32Array.from(sp),
      ea: Float32Array.from(ea)
    };
  }

  // Background: a space gradient and a seeded starfield, rendered once per canvas size.
  // A few stars are kept apart so they can twinkle without redrawing the whole field.
  function buildStarfield(wDev, hDev, dpr) {
    const cv = document.createElement('canvas');
    cv.width = wDev;
    cv.height = hDev;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, hDev);
    bg.addColorStop(0, '#0a1020');
    bg.addColorStop(1, '#04060c');
    g.fillStyle = bg;
    g.fillRect(0, 0, wDev, hDev);
    const rand = mulberry32(SEED_STARS);
    for (let i = 0; i < BG_STARS; i++) {
      const x = rand() * wDev;
      const y = rand() * hDev;
      const r = (0.3 + 0.9 * rand() * rand()) * dpr;
      const a = 0.25 + 0.7 * rand() * rand();
      g.fillStyle = rand() < 0.2 ? 'rgba(255,226,190,' + a + ')' : 'rgba(210,225,255,' + a + ')';
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    const twinkle = [];
    for (let k = 0; k < TWINKLE_N; k++) {
      twinkle.push({
        fx: rand(), fy: rand(),
        r: 0.7 + 0.9 * rand(),
        alpha: 0.5 + 0.4 * rand(),
        rate: 0.2 + 1.2 * rand(),            // cycles per second of fixed-rate ticks
        phase: rand() * TAU
      });
    }
    return { canvas: cv, twinkle: twinkle };
  }

  let planetCache = null;
  function planetLayout(v) {
    const key = v.canvas.width + 'x' + v.canvas.height;
    if (!planetCache || planetCache.key !== key) {
      const R = Math.min(v.W, v.H) * PLANET_RADIUS;
      planetCache = {
        key: key,
        stars: buildStarfield(v.canvas.width, v.canvas.height, v.dpr),
        disk: buildDisk(R * v.dpr)
      };
    }
    return planetCache;
  }

  // ---- Planet ------------------------------------------------------------
  // Star luminosity from the diagnosis; flux from the config. Brightness of the star
  // and corona follows the flux at the planet.
  function starFlux(diag, config) {
    if (!config.evolveStar) return config.S;
    const L = window.ClimateModel.luminosityRelative;
    return config.S * L(config.ageGyr + diag.tYears * 1e-9) / L(config.ageGyr);
  }

  function cloudCover(diag) {
    return clamp((diag.albedo - 0.12) / 0.4, 0, 1) * (diag.flags.hasLiquidWater ? 1 : 0.6);
  }

  function paintDisk(disk, diag, config, motion, simTime) {
    const m = surfaceMapsFor(diag, config);
    const rot = diag.rotationDays > 0 ? diag.rotationDays : 1;
    // Rotation turns elapsed, unwrapped, from the continuous simulated time, so the
    // spin is smooth and does not depend on how the frames fell.
    const turns = (simTime === undefined ? diag.tYears : simTime) * DAYS_PER_YEAR / rot * motion;
    const shift = Math.floor(frac(turns) * TEX_W);
    const cloudShift = Math.floor(frac(turns * 0.9) * TEX_W);  // clouds drift 10% slower than the surface
    const cover = cloudCover(diag);
    const cthr = 1 - cover;
    const d = disk.img.data;
    const N = disk.n;
    const pos = disk.pos;
    const cb = disk.cb;
    const ro = disk.ro;
    const lit = disk.lit;
    const sp = disk.sp;
    const ea = disk.ea;
    const SR = m.SR;
    const SG = m.SG;
    const SB = m.SB;
    const OC = m.OC;
    const ER = m.ER;
    const EG = m.EG;
    const EB = m.EB;
    const CL = m.cloud;
    for (let i = 0; i < N; i++) {
      const t = ro[i] + ((cb[i] + shift) & TEX_MASK);
      const lf = lit[i];
      const s = sp[i] * OC[t] * 0.9;
      let r = SR[t] * lf + ER[t] + s;
      let g = SG[t] * lf + EG[t] + s;
      let b = SB[t] * lf + EB[t] + s;
      if (cover > 0) {
        const tc = ro[i] + ((cb[i] + cloudShift) & TEX_MASK);
        const ca = 0.75 * cover * smooth(cthr - 0.05, cthr + 0.05, CL[tc]);
        if (ca > 0) {
          const cl = 0.1 + 0.9 * lf;
          r += (cl - r) * ca;
          g += (cl - g) * ca;
          b += (cl - b) * ca;
        }
      }
      const o4 = pos[i];
      d[o4] = r * 255;
      d[o4 + 1] = g * 255;
      d[o4 + 2] = b * 255;
      d[o4 + 3] = ea[i] * 255;
    }
    disk.ctx.putImageData(disk.img, 0, 0);
  }

  function drawTwinkle(c, stars, W, H, opts) {
    const list = stars.twinkle;
    if (opts.reducedMotion) return;
    const secs = (opts.ticks || 0) / TWINKLE_TICKS_PER_S;
    c.fillStyle = '#e8f0ff';
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      c.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(TAU * s.rate * secs + s.phase));
      c.beginPath();
      c.arc(s.fx * W, s.fy * H, s.r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawPlanet(v, diag, config, opts) {
    const c = v.ctx;
    const W = v.W;
    const H = v.H;
    const dpr = v.dpr;
    const L = planetLayout(v);
    const R = Math.min(W, H) * PLANET_RADIUS;
    const cx = W / 2;
    const cy = H / 2;
    const motion = opts.motion === undefined ? 1 : opts.motion;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, v.canvas.width, v.canvas.height);
    c.drawImage(L.stars.canvas, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTwinkle(c, L.stars, W, H, opts);

    // Star: position follows the light direction; corona brightness follows the flux.
    const flux = starFlux(diag, config);
    const sc = starColour(diag.luminosityRel);
    const n2 = Math.hypot(LIGHT[0], LIGHT[1]);
    const starD = Math.min(W, H) * 0.42;
    const sx = cx + LIGHT[0] / n2 * starD;
    const sy = cy - LIGHT[1] / n2 * starD;
    const starR = Math.min(W, H) * 0.035;
    const glow = clamp(0.4 + 0.3 * flux, 0.3, 1.1);
    const corona = c.createRadialGradient(sx, sy, 0, sx, sy, starR * 9);
    corona.addColorStop(0, rgba(sc, 0.55 * glow));
    corona.addColorStop(0.2, rgba(sc, 0.18 * glow));
    corona.addColorStop(1, rgba(sc, 0));
    c.fillStyle = corona;
    c.beginPath();
    c.arc(sx, sy, starR * 9, 0, TAU);
    c.fill();
    c.fillStyle = rgba(sc, 1);
    c.beginPath();
    c.arc(sx, sy, starR, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.arc(sx, sy, starR * 0.5, 0, TAU);
    c.fill();

    // Atmosphere halo: colour from composition, thickness from surface pressure.
    const P = diag.surfacePressureBar;
    if (P > 1e-3) {
      const hc = atmosphereColour(diag);
      const thick = 0.02 + 0.03 * Math.log10(1 + P);
      const a = clamp(0.12 + 0.2 * Math.log10(1 + P), 0, 0.85);
      const halo = c.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * (1 + thick));
      halo.addColorStop(0, rgba(hc, a));
      halo.addColorStop(0.5, rgba(hc, a * 0.35));
      halo.addColorStop(1, rgba(hc, 0));
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, cy, R * (1 + thick), 0, TAU);
      c.fill();
    }

    // Disk: shaded surface, ocean glint, lava glow and clouds, painted per device pixel.
    paintDisk(L.disk, diag, config, motion, opts.simTime);
    const box = L.disk.side / dpr;
    c.drawImage(L.disk.canvas, cx - L.disk.half / dpr, cy - L.disk.half / dpr, box, box);
  }

  // Text with a background-coloured outline, so a label stays legible where a curve passes.
  function haloText(c, text, x, y, halo) {
    c.save();
    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.strokeStyle = halo;
    c.strokeText(text, x, y);
    c.restore();
    c.fillText(text, x, y);
  }

  // ---- Energy-balance diagram --------------------------------------------
  function wrapText(c, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (line && c.measureText(test).width > maxW) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawEnergy(v, diag, energy, pal) {
    const c = v.ctx;
    const W = v.W;
    const H = v.H;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const m = { l: 44, r: 12, t: 24, b: 40 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    if (pw < 40 || ph < 40) return;

    const absorbed = energy.absorbedWm2;
    const cap = energy.olrCapWm2;
    const yTop = Math.ceil(Math.max(340, absorbed * 1.25, cap * 1.25) / 50) * 50;
    const xOf = (T) => m.l + (T - ENERGY_MIN_T) / (ENERGY_MAX_T - ENERGY_MIN_T) * pw;
    const yOf = (F) => m.t + ph * (1 - F / yTop);

    c.font = FONT;
    c.lineWidth = 1;
    c.strokeStyle = pal.grid;
    c.fillStyle = pal.muted;
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    const step = yTop > 500 ? 100 : 50;
    for (let F = 0; F <= yTop; F += step) {
      const y = yOf(F);
      c.beginPath();
      c.moveTo(m.l, y);
      c.lineTo(m.l + pw, y);
      c.stroke();
      c.fillText(String(F), m.l - 6, y);
    }
    c.textBaseline = 'top';
    [150, 500, 1000, 1500, 2000].forEach(function (T) {
      // End labels are anchored inside the plot so they are not clipped at the canvas edge.
      c.textAlign = T === 150 ? 'left' : (T === 2000 ? 'right' : 'center');
      c.fillText(String(T), xOf(T), m.t + ph + 6);
    });
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText('Surface temperature (K)', m.l + pw / 2, H - 4);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText('W m⁻²', 4, 6);

    // Curves are clipped to the plot area.
    c.save();
    c.beginPath();
    c.rect(m.l, m.t, pw, ph);
    c.clip();
    c.setLineDash([6, 4]);
    c.strokeStyle = pal.absorbed;
    c.lineWidth = 1.75;
    c.beginPath();
    c.moveTo(m.l, yOf(absorbed));
    c.lineTo(m.l + pw, yOf(absorbed));
    c.stroke();
    c.setLineDash([2, 3]);
    c.strokeStyle = pal.cap;
    c.beginPath();
    c.moveTo(m.l, yOf(CAP_BASE));
    c.lineTo(m.l + pw, yOf(CAP_BASE));
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = pal.olr;
    c.lineWidth = 2.25;
    c.beginPath();
    for (let i = 0; i < energy.Ts.length; i++) {
      const x = xOf(energy.Ts[i]);
      const y = yOf(energy.olr[i]);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    c.restore();

    // Equilibria: where OLR crosses absorbed. Liquid water limits the scan to the critical point.
    const liquid = diag.flags.hasLiquidWater;
    const Tmax = liquid ? Math.min(CRITICAL_T, ENERGY_MAX_T) : ENERGY_MAX_T;
    const marks = [];
    for (let i = 0; i + 1 < energy.Ts.length; i++) {
      const T0 = energy.Ts[i];
      const T1 = energy.Ts[i + 1];
      if (T0 > Tmax) break;
      const f0 = energy.olr[i] - absorbed;
      const f1 = energy.olr[i + 1] - absorbed;
      if (f0 === 0 || (f0 < 0) !== (f1 < 0)) {
        const u = f0 / (f0 - f1);
        marks.push({ T: T0 + u * (T1 - T0), stable: f0 < 0 });
      }
    }
    marks.forEach(function (mk) {
      const x = xOf(mk.T);
      const y = yOf(absorbed);
      c.beginPath();
      c.arc(x, y, 4.5, 0, TAU);
      c.fillStyle = mk.stable ? pal.ink : pal.panel;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = pal.ink;
      c.stroke();
      if (mk.stable) {
        c.fillStyle = pal.ink;
        c.textAlign = 'left';
        c.textBaseline = 'bottom';
        haloText(c, 'equilibrium ' + Math.round(mk.T) + ' K', x + 8, y - 7, pal.panel);
      }
    });

    // Current state.
    const nx = xOf(clamp(diag.Ts, ENERGY_MIN_T, ENERGY_MAX_T));
    const ny = Math.max(m.t + 4, yOf(diag.olrWm2));
    c.beginPath();
    c.arc(nx, ny, 5.5, 0, TAU);
    c.fillStyle = pal.ink;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = pal.panel;
    c.stroke();

    // Reference labels and legend.
    c.font = FONT;
    c.textAlign = 'right';
    c.textBaseline = 'bottom';
    c.fillStyle = pal.absorbed;
    haloText(c, 'absorbed ' + absorbed.toFixed(0), m.l + pw - 2, yOf(absorbed) - 3, pal.panel);
    c.fillStyle = pal.cap;
    c.textAlign = 'left';
    haloText(c, 'cap 282', m.l + 4, yOf(CAP_BASE) - 3, pal.panel);
    let lx = m.l;
    const legend = [['OLR', pal.olr, []], ['absorbed', pal.absorbed, [6, 4]], ['cap', pal.cap, [2, 3]]];
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    legend.forEach(function (item) {
      c.setLineDash(item[2]);
      c.strokeStyle = item[1];
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(lx, 11);
      c.lineTo(lx + 16, 11);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = pal.muted;
      c.fillText(item[0], lx + 21, 11);
      lx += 21 + c.measureText(item[0]).width + 14;
    });

    // No equilibrium with liquid water: say so, rather than leaving an empty plot.
    if (liquid && absorbed > cap) {
      const boxW = Math.min(pw - 12, 270);
      c.font = FONT;
      const lines = wrapText(c, 'Absorbed sunlight (' + absorbed.toFixed(0) + ' W m⁻²) is above the ' +
        cap.toFixed(0) + ' W m⁻² cap. The ocean evaporates, and the surface warms only as the steam allows.', boxW - 16);
      const lineH = 15;
      const boxH = 22 + lines.length * lineH + 6;
      const bx = m.l + pw - boxW - 6;
      const by = m.t + ph - boxH - 6;
      c.fillStyle = pal.panel;
      c.globalAlpha = 0.94;
      c.beginPath();
      c.rect(bx, by, boxW, boxH);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = pal.cap;
      c.lineWidth = 1.5;
      c.strokeRect(bx, by, boxW, boxH);
      c.fillStyle = pal.ink;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.font = 'bold 12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      c.fillText('No equilibrium with liquid water', bx + 8, by + 6);
      c.font = FONT;
      lines.forEach(function (line, k) {
        c.fillText(line, bx + 8, by + 22 + k * lineH);
      });
    }
  }

  // ---- Time series -------------------------------------------------------
  function smoothPath(c, xs, ys) {
    const n = xs.length;
    c.beginPath();
    c.moveTo(xs[0], ys[0]);
    if (n === 2) {
      c.lineTo(xs[1], ys[1]);
      return;
    }
    for (let i = 1; i < n - 1; i++) {
      c.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    }
    c.lineTo(xs[n - 1], ys[n - 1]);
  }

  function drawSeries(v, history, state, pal) {
    const c = v.ctx;
    const W = v.W;
    const H = v.H;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.font = FONT;
    const samples = history.samples;
    const live = { t: state.tYears, Ts: state.Ts, depth: state.oceanDepthM, co2: state.co2Bar, ice: state.iceFraction };
    const last = samples.length ? samples[samples.length - 1] : live;
    const span = Math.max(live.t, last.t);
    if (span <= 0) {
      c.fillStyle = pal.muted;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('Press play to record the history.', W / 2, H / 2);
      return;
    }
    const m = { l: 64, r: 10, t: 4, b: 36 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    if (pw < 40 || ph < 40) return;
    const unitName = span < 1e6 ? 'yr' : (span < 1e9 ? 'Myr' : 'Gyr');
    const div = unitName === 'yr' ? 1 : (unitName === 'Myr' ? 1e6 : 1e9);
    const xOf = (t) => m.l + clamp(t / span, 0, 1) * pw;
    const n = samples.length + 1;
    const ts = new Float64Array(n);
    for (let i = 0; i < n; i++) ts[i] = (i < samples.length ? samples[i] : live).t;

    const panels = [
      { title: 'Surface temperature', unit: 'K', pick: function (s) { return s.Ts; },
        color: pal.temp, fmt: function (x) { return x.toFixed(1) + ' K'; },
        scale: 'lin' },
      { title: 'Ocean depth', unit: 'm', pick: function (s) { return s.depth; },
        color: pal.ocean, fmt: function (x) { return x >= 1000 ? (x / 1000).toFixed(2) + ' km' : x.toFixed(0) + ' m'; },
        scale: 'lin0' },
      { title: 'CO2 pressure', unit: 'bar', pick: function (s) { return s.co2; },
        color: pal.co2, fmt: function (x) { return formatBar(x); },
        scale: 'log' },
      { title: 'Sea ice cover', unit: '', pick: function (s) { return s.ice; },
        color: pal.ice, fmt: function (x) { return (x * 100).toFixed(0) + '%'; },
        scale: 'unit' }
    ];

    const panelH = ph / panels.length;
    panels.forEach(function (p, k) {
      const top = m.t + k * panelH;
      const plotTop = top + 16;
      const plotBot = top + panelH - 5;
      const raw = new Float64Array(n);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < n; i++) {
        const s = i < samples.length ? samples[i] : live;
        let y = p.pick(s);
        if (p.scale === 'log') y = Math.log10(Math.max(y, 1e-7));
        raw[i] = y;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      let yLo;
      let yHi;
      let loLabel;
      let hiLabel;
      if (p.scale === 'lin') {
        yLo = lo - 3;
        yHi = hi + 3;
        if (yHi - yLo < 10) { const mid = (yHi + yLo) / 2; yLo = mid - 5; yHi = mid + 5; }
        loLabel = yLo.toFixed(0);
        hiLabel = yHi.toFixed(0);
      } else if (p.scale === 'lin0') {
        yLo = 0;
        yHi = Math.max(hi * 1.1, 1);
        loLabel = '0';
        hiLabel = yHi >= 1000 ? (yHi / 1000).toFixed(1) + ' km' : yHi.toFixed(0) + ' m';
      } else if (p.scale === 'log') {
        yLo = lo - 0.3;
        yHi = hi + 0.3;
        if (yHi - yLo < 1) { const mid = (yHi + yLo) / 2; yLo = mid - 0.5; yHi = mid + 0.5; }
        loLabel = '1e' + Math.round(yLo);
        hiLabel = '1e' + Math.round(yHi);
      } else {
        yLo = 0;
        yHi = 1;
        loLabel = '0';
        hiLabel = '100%';
      }
      const yOf = (y) => plotBot - clamp((y - yLo) / (yHi - yLo), 0, 1) * (plotBot - plotTop);

      // Panel title and current value.
      c.textBaseline = 'top';
      c.textAlign = 'left';
      c.fillStyle = pal.ink;
      c.font = 'bold 12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      c.fillText(p.title + (p.unit ? ' (' + p.unit + ')' : ''), m.l, top + 2);
      c.font = FONT;
      c.textAlign = 'right';
      c.fillStyle = p.color;
      c.fillText(p.fmt(p.pick(live)), W - m.r, top + 2);

      // Axis labels and baseline.
      c.fillStyle = pal.muted;
      c.textAlign = 'right';
      c.textBaseline = 'top';
      c.fillText(hiLabel, m.l - 6, plotTop - 2);
      c.textBaseline = 'bottom';
      c.fillText(loLabel, m.l - 6, plotBot + 2);
      c.strokeStyle = pal.grid;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(m.l, plotBot);
      c.lineTo(m.l + pw, plotBot);
      c.stroke();

      // Smooth curve.
      const xs = new Array(n);
      const ys = new Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = xOf(ts[i]);
        ys[i] = yOf(raw[i]);
      }
      c.save();
      c.beginPath();
      c.rect(m.l, plotTop - 4, pw, plotBot - plotTop + 6);
      c.clip();
      if (n >= 2) {
        smoothPath(c, xs, ys);
        c.strokeStyle = p.color;
        c.lineWidth = 1.8;
        c.lineJoin = 'round';
        c.stroke();
      }
      c.restore();
      c.beginPath();
      c.arc(xs[n - 1], ys[n - 1], 3, 0, TAU);
      c.fillStyle = p.color;
      c.fill();
    });

    // Shared time axis, in years, Myr or Gyr chosen from the span.
    const axisY = m.t + ph;
    c.strokeStyle = pal.axis;
    c.beginPath();
    c.moveTo(m.l, axisY);
    c.lineTo(m.l + pw, axisY);
    c.stroke();
    c.fillStyle = pal.muted;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for (let k = 0; k <= 4; k++) {
      const tv = span * k / 4;
      const label = unitName === 'yr' ? addCommas(Math.round(tv)) : (tv / div).toFixed(unitName === 'Gyr' ? 2 : 1);
      c.textAlign = k === 0 ? 'left' : (k === 4 ? 'right' : 'center');
      c.fillText(label, xOf(tv), axisY + 4);
    }
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText('Simulated time (' + unitName + ')', m.l + pw / 2, H - 2);
  }

  // ---- Public API --------------------------------------------------------
  const views = { planet: null, energy: null, series: null };

  function init(canvasEls) {
    const els = canvasEls || {};
    ['planet', 'energy', 'series'].forEach(function (k) {
      if (!els[k]) throw new Error('ClimateRender.init: missing canvas ' + k);
      views[k] = { canvas: els[k], ctx: els[k].getContext('2d'), W: 1, H: 1, dpr: 1 };
    });
  }

  function fit(view) {
    const cssW = Math.max(1, view.canvas.clientWidth);
    const cssH = Math.max(1, view.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wDev = Math.round(cssW * dpr);
    const hDev = Math.round(cssH * dpr);
    if (view.canvas.width !== wDev) view.canvas.width = wDev;
    if (view.canvas.height !== hDev) view.canvas.height = hDev;
    view.W = cssW;
    view.H = cssH;
    view.dpr = dpr;
    return view;
  }

  // Colours come from the CSS custom properties, so the canvases follow the theme.
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const get = function (name, fallback) {
      return cs.getPropertyValue(name).trim() || fallback;
    };
    return {
      ink: get('--ink', '#1b222c'),
      muted: get('--muted', '#4d5866'),
      grid: get('--grid', '#e3e6eb'),
      axis: get('--line', '#d5d9e0'),
      panel: get('--card', '#ffffff'),
      temp: get('--c-temp', '#c2481d'),
      ocean: get('--c-ocean', '#1f7a9c'),
      co2: get('--c-co2', '#94630f'),
      ice: get('--c-ice', '#3f78b0'),
      olr: get('--c-olr', '#c2481d'),
      absorbed: get('--c-abs', '#1d62a8'),
      cap: get('--c-cap', '#a4262c')
    };
  }

  function draw(diag, state, config, history, opts) {
    if (!views.planet || !diag) return;
    const o = opts || {};
    const pal = palette();
    drawPlanet(fit(views.planet), diag, config, o);
    if (o.energy) drawEnergy(fit(views.energy), diag, o.energy, pal);
    drawSeries(fit(views.series), history, state, pal);
  }

  return {
    init: init,
    draw: draw,
    formatYears: formatYears,
    formatBar: formatBar,
    formatSurfaceBar: formatSurfaceBar
  };
})();

if (typeof window !== 'undefined') window.ClimateRender = ClimateRender;
