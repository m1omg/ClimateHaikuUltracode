/*
 * Climate Forge physics model.
 *
 * A zero-dimensional energy balance for a terrestrial planet: a mixed layer
 * coupled to a deep ocean, a relaxing sea-ice fraction, a grey-atmosphere
 * outgoing longwave limit with a clear-sky moist cap, a slow carbon cycle and
 * a slow water-escape channel. Physical rates are in planetary years; the
 * clock only decides how many years of model time pass per wall second.
 *
 * Equations, calibration targets and deviations are in docs/MODEL.md.
 * Browser: exposes window.ClimateModel. Node: module.exports.
 */
const ClimateModel = (function () {
  'use strict';

  // ---- Constants ---------------------------------------------------------
  const SIGMA = 5.670374419e-8;      // W m^-2 K^-4
  const S_EARTH = 1361;              // W m^-2, present solar constant at 1 AU
  const YEAR_S = 3.15576e7;          // s per Julian year
  const OLR_CAP = 282;               // W m^-2, clear-sky moist limit (Goldblatt et al. 2013)
  const STEAM_T = 1600;              // K, steam-branch temperature where the cap starts to rise
  const CRITICAL_T = 647.1;          // K, critical point of water
  const BAR_PER_M_WATER = 0.0981;    // bar per metre of water column at Earth gravity
  const EVAP_J_PER_M = 3.96e9;       // J m^-2 per metre of ocean (latent + sensible)
  const P_CO2_REF = 4.2e-4;          // bar, present-Earth CO2 (weathering reference)
  const FOUT_BAR_PER_YR = 58e-9;     // 7 Tmol C/yr expressed as bar of CO2 per year
  const WEATHER_EXP = 0.3;           // exponent on pCO2 in the weathering law
  const WEATHER_E_K = 13.7;          // K, e-folding temperature of weathering
  const LAND_REF = 0.29;             // present land fraction (weathering scale)
  const TAU_MIX_YR = 10;             // mixed-layer time constant
  const TAU_DEEP_YR = 300;           // deep-ocean exchange time constant
  const TAU_ICE_YR = 100;            // sea-ice relaxation time
  const LAMBDA_REF = 3.3;            // W m^-2 K^-1, feedback used to size the mixed-layer heat capacity
  const C_MIX = TAU_MIX_YR * YEAR_S * LAMBDA_REF;   // J m^-2 K^-1
  const WATER_HEAT_PER_M = 4.2e6;    // J m^-3 K^-1, volumetric heat capacity of liquid water
  const TAU_H2_YR = 1e9;             // H2 escape time (game value, see MODEL.md)
  const TAU_H2O_LOSS_REF_YR = 1e9;   // water-escape time at the reference stratospheric fraction
  const F_STRAT_REF = 3e-3;          // reference stratospheric water fraction (about 355 K)
  const MAX_SUB_YR = 5000;           // largest internal step (years)
  const LAMBDA_TRUST = 0.5;          // W m^-2 K^-1 below which the feedback is too weak to trust a long step
  const MAX_DT_K = 3;                // K, largest temperature change per step when the feedback is weak
  const MAX_FRAME_S = 0.25;          // wall-clock clamp per advance call
  const MAX_STEPS_PER_CALL = 2000;
  const AVAIL = 0.8;                 // near-surface vapour relative to saturation over open water
  const ALB_OCEAN = 0.07;
  const ALB_LAND = 0.25;
  const ALB_ICE = 0.62;
  const CLOUD_MAX = 0.19;            // clear-sky cloud allowance, reached at high vapour
  const CLOUD_HALF_BAR = 0.001;      // bar of water vapour at half the cloud allowance
  const ROT_CLOUD_MAX = 0.12;        // substellar cloud albedo for slow rotators
  const ICE_MID_K = 269;             // K, centre of the sea-ice transition band (about 263-275 K)
  const ICE_SCALE_K = 2.5;
  const CO2_LOG_A = 0.057;           // optical depth per e-fold of CO2 at low pressure
  const CO2_LOG_PC = 1e-4;           // bar, soft onset of the CO2 log term
  const CO2_DENSE_C = 15.6;          // thick-CO2 fit amplitude (Venus calibration)
  const CO2_DENSE_PS = 0.3;          // bar, saturation scale of the thick-CO2 fit
  const N2_K = 0.1;                  // optical depth per bar of N2 + O2 (pressure broadening)
  const CH4_K = 3.6e-4;              // optical depth per sqrt(ppb) of CH4
  const H2_K = 5.0;                  // optical depth per bar^2 of H2 (collision-induced)
  const WATER_A = 2.51;              // water optical depth, sub-linear term
  const WATER_EXP = 0.3;             // exponent of the sub-linear water term
  const WATER_B = 0.02;              // water optical depth per bar^2, quadratic term (steam regime)
  const WATER_P_SAT = 300;           // bar, saturation pressure of the water optical depth

  // ---- Stellar flux and luminosity ---------------------------------------
  // Gough (1981): L/L0 = 1 / (1 + 0.4 (1 - t/4.57)), t in Gyr.
  function luminosityRelative(ageGyr) {
    const denom = Math.max(0.05, 1 + 0.4 * (1 - ageGyr / 4.57));
    return 1 / denom;
  }

  // Effective flux relative to the present Earth at model time tYears.
  function effectiveFlux(c, tYears) {
    if (!c.evolveStar) return c.S;
    return c.S * luminosityRelative(c.ageGyr + tYears * 1e-9) / luminosityRelative(c.ageGyr);
  }

  // ---- Planet geometry ---------------------------------------------------
  // Zeng et al. (2016) mass-radius law. gf = M/R^4 converts a bar inventory
  // (bar at Earth gravity) into a surface partial pressure.
  function geometry(c) {
    const R = (1.07 - 0.21 * c.coreMassFraction) * Math.pow(c.massEM, 0.27);
    return { R: R, g: c.massEM / (R * R), gf: c.massEM / Math.pow(R, 4) };
  }

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  function smoothstep(x0, x1, x) {
    const t = clamp((x - x0) / (x1 - x0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ---- Water vapour ------------------------------------------------------
  // Buck (1996) saturation vapour pressure, bar. Liquid above 0 C, ice below.
  function satVapourBar(TK) {
    const tc = clamp(TK - 273.15, -80, 370);
    const hPa = tc >= 0
      ? 6.1121 * Math.exp((18.678 - tc / 234.5) * tc / (257.14 + tc))
      : 6.1115 * Math.exp((23.036 - tc / 333.7) * tc / (279.82 + tc));
    return hPa * 1e-3;
  }

  // Water vapour partial pressure. With liquid present it is the saturation
  // pressure over the open ocean times an availability factor, limited by the
  // water inventory. Without liquid, all water is vapour (steam or trace).
  function vapourBar(s, c, geo, TK, liquid) {
    const wBar = s.waterOED * BAR_PER_M_WATER * geo.gf;
    if (!liquid) return wBar;
    // Near-surface vapour is saturated over the open ocean. Water already
    // evaporated stays in the air, so the column is at least that large.
    const open = (1 - c.landFraction) * (1 - s.iceFraction);
    const evaporated = (s.waterOED - s.oceanDepthM) * BAR_PER_M_WATER * geo.gf;
    return Math.min(Math.max(satVapourBar(TK) * open * AVAIL, evaporated), wBar);
  }

  // ---- Grey optical depth ------------------------------------------------
  // Total grey optical depth tau for the partial pressures p (bar) and the
  // water vapour pressure pH2O (bar). See MODEL.md for each term's basis.
  function greyTau(p, pH2O) {
    const co2 = CO2_LOG_A * Math.log(1 + p.co2 / CO2_LOG_PC)
      + CO2_DENSE_C * Math.sqrt(p.co2) * p.co2 / (p.co2 + CO2_DENSE_PS);
    const broadening = N2_K * (p.n2 + p.o2);
    const ch4 = CH4_K * Math.sqrt(Math.max(p.ch4, 0) * 1e9);
    const h2 = H2_K * p.h2 * p.h2;
    // Water opacity saturates above WATER_P_SAT so that very deep steam stays below about 1700 K.
    const pw = Math.min(pH2O, WATER_P_SAT);
    const water = WATER_A * Math.pow(pw, WATER_EXP) + WATER_B * pw * pw;
    return co2 + broadening + ch4 + h2 + water;
  }

  // Atmospheric state at surface temperature TK for the state s.
  function envAt(s, c, geo, TK, liquid) {
    const gf = geo.gf;
    const p = {
      co2: s.co2Bar * gf, ch4: s.ch4Bar * gf, n2: s.n2Bar * gf,
      o2: s.o2Bar * gf, h2: s.h2Bar * gf
    };
    const pH2O = vapourBar(s, c, geo, TK, liquid);
    const tau = greyTau(p, pH2O);
    const pTot = p.co2 + p.ch4 + p.n2 + p.o2 + p.h2 + pH2O;
    return { p: p, pH2O: pH2O, tau: tau, pTot: pTot };
  }

  // ---- Radiation ---------------------------------------------------------
  // Rapid rotators (P < 1 d) lose up to 10% of the moist cap (game approximation).
  function rapidFactor(P) {
    return 1 - 0.1 * clamp((1 - P) / 0.5, 0, 1);
  }

  // The OLR cap. Above STEAM_T it rises as (T/STEAM_T)^4, which gives a stable
  // steam branch near 1600 K (Goldblatt et al. 2013); see MODEL.md.
  function olrCap(c, TK) {
    const base = OLR_CAP * rapidFactor(c.rotationDays);
    return TK > STEAM_T ? base * Math.pow(TK / STEAM_T, 4) : base;
  }

  function olrRaw(TK, tau) {
    return SIGMA * TK * TK * TK * TK / (1 + 0.75 * tau);
  }

  function rotationCloud(P) {
    return ROT_CLOUD_MAX * smoothstep(5, 20, P);
  }

  function albedoOf(s, c, liquid, pH2O) {
    const land = c.landFraction;
    const open = 1 - land;
    const f = s.iceFraction;
    const aOpen = liquid ? ALB_OCEAN : ALB_LAND;
    let a = land * ALB_LAND + open * ((1 - f) * aOpen + f * ALB_ICE);
    a += CLOUD_MAX * pH2O / (pH2O + CLOUD_HALF_BAR);
    a += rotationCloud(c.rotationDays) + c.cloudOffset;
    return clamp(a, 0.02, 0.95);
  }

  // Everything the energy balance needs at surface temperature TK.
  function fluxes(s, c, geo, TK, Seff, liquid) {
    const env = envAt(s, c, geo, TK, liquid);
    const alb = albedoOf(s, c, liquid, env.pH2O);
    const absorbed = (1 - alb) * Seff * S_EARTH / 4;
    const g = olrRaw(TK, env.tau);
    const cap = olrCap(c, TK);
    const olr = Math.min(cap, g);
    return { env: env, albedo: alb, absorbed: absorbed, g: g, cap: cap, olr: olr, net: absorbed - olr };
  }

  function olrAt(s, c, geo, TK, Seff, liquid) {
    return fluxes(s, c, geo, TK, Seff, liquid).olr;
  }

  // ---- Sea ice -----------------------------------------------------------
  function iceEquilibrium(TK) {
    return 1 / (1 + Math.exp((TK - ICE_MID_K) / ICE_SCALE_K));
  }

  // ---- Escape of water ---------------------------------------------------
  // Stratospheric water fraction rises steeply above about 320 K.
  function stratFraction(TK) {
    return clamp(F_STRAT_REF * Math.exp((TK - 355) / 12), 1e-6, 0.5);
  }

  // ---- Thermal step ------------------------------------------------------
  // Solve the linear two-box system exactly for constant forcing N0 and
  // feedback lam, linearised about Tg. Mixed layer Tm, deep ocean Td:
  //   C_mix dTm/dt = N0 + lam*Tg - lam*Tm - K (Tm - Td)
  //   C_deep dTd/dt = K (Tm - Td)
  // The 2x2 matrix exponential is built from its two real eigenvalues.
  // K is the mixed-layer / deep coupling (W m^-2 K^-1) and Cd the deep heat
  // capacity (J m^-2 K^-1). With no liquid, K = 0 and the mixed layer decouples.
  function propagate(Tm0, Td0, lam0, N0, Tg, t, K, Cd) {
    // A negative feedback is not used inside the linear solve: its exponential
    // growth would overshoot. The OLR cap and the step limiter bound the response.
    const lam = Math.max(lam0, 0);
    if (K <= 0) {
      const rate = lam / C_MIX;
      const bsrc = N0 + lam * Tg;
      let Tm;
      if (Math.abs(rate) < 1e-30) {
        Tm = Tm0 + N0 * t / C_MIX;
      } else {
        const eq = bsrc / lam;
        Tm = eq + (Tm0 - eq) * Math.exp(-rate * t);
      }
      return { Tm: Tm, Td: Td0 };
    }
    const a = (lam + K) / C_MIX;
    const b = K / C_MIX;
    const cc = K / Cd;
    const d = K / Cd;
    const tr = -(a + d);
    const det = a * d - b * cc;
    const disc = Math.sqrt(Math.max(tr * tr - 4 * det, 0));
    const l1 = 0.5 * (tr + disc);
    const l2 = 0.5 * (tr - disc);
    const D1 = l1 - l2;
    const D2 = l2 - l1;
    const bx = (N0 + lam * Tg) / C_MIX;
    const phi = (l) => (Math.abs(l) < 1e-30 ? t : Math.expm1(l * t) / l);
    const e1 = Math.exp(l1 * t);
    const e2 = Math.exp(l2 * t);
    const f1 = phi(l1);
    const f2 = phi(l2);
    // M = [[-a, b], [cc, -d]]; projectors P1 = (M - l2 I)/D1, P2 = (M - l1 I)/D2
    const Mx0 = -a * Tm0 + b * Td0;
    const Mx1 = cc * Tm0 - d * Td0;
    const P1x0 = (Mx0 - l2 * Tm0) / D1;
    const P1x1 = (Mx1 - l2 * Td0) / D1;
    const P2x0 = (Mx0 - l1 * Tm0) / D2;
    const P2x1 = (Mx1 - l1 * Td0) / D2;
    const MB0 = -a * bx;
    const MB1 = cc * bx;
    const P1B0 = (MB0 - l2 * bx) / D1;
    const P1B1 = MB1 / D1;
    const P2B0 = (MB0 - l1 * bx) / D2;
    const P2B1 = MB1 / D2;
    return {
      Tm: e1 * P1x0 + e2 * P2x0 + f1 * P1B0 + f2 * P2B0,
      Td: e1 * P1x1 + e2 * P2x1 + f1 * P1B1 + f2 * P2B1
    };
  }

  // Two passes of linearisation: the feedback and cap are evaluated at the
  // predicted end-of-step temperature on the second pass.
  function thermal(s, c, geo, h, Seff) {
    const dtS = h * YEAR_S;
    const liquid = s.oceanDepthM > 0;
    const Cd = Math.max(WATER_HEAT_PER_M * s.oceanDepthM, 1e6);
    const K = liquid ? Cd / (TAU_DEEP_YR * YEAR_S) : 0;
    let Tg = s.Ts;
    let res = null;
    let evap = 0;
    for (let pass = 0; pass < 2; pass++) {
      const F = fluxes(s, c, geo, Tg, Seff, liquid);
      const lam = olrAt(s, c, geo, Tg + 0.5, Seff, liquid) - olrAt(s, c, geo, Tg - 0.5, Seff, liquid);
      let N0 = F.absorbed - F.olr;
      evap = 0;
      // Wet runaway: the cap binds and surplus energy is spent on evaporation,
      // so the mixed layer does not heat.
      if (liquid && F.g >= F.cap && N0 > 0) {
        evap = N0;
        N0 = 0;
      }
      res = propagate(s.Ts, s.Td, lam, N0, Tg, dtS, K, Cd);
      Tg = res.Tm;
    }
    // Liquid cannot exist above the critical point: any warming beyond it is
    // spent on evaporating the ocean, so the surface is held at CRITICAL_T.
    let Ts = res.Tm;
    if (liquid && Ts > CRITICAL_T) {
      evap += (Ts - CRITICAL_T) * (C_MIX + Cd) / dtS;
      Ts = CRITICAL_T;
    }
    const net = fluxes(s, c, geo, Ts, Seff, liquid).net;
    return { Ts: Ts, Td: res.Td, evap: evap, net: net };
  }

  // One internal step of h years (h <= MAX_SUB_YR, and short enough that any
  // unstable feedback is resolved).
  function substep(s, c, geo, h) {
    const Seff = effectiveFlux(c, s.tYears + 0.5 * h);
    const th = thermal(s, c, geo, h, Seff);
    const liquidBefore = s.oceanDepthM > 0;
    s.Ts = th.Ts;
    s.Td = th.Td;

    const fe = iceEquilibrium(s.Ts);
    s.iceFraction = fe + (s.iceFraction - fe) * Math.exp(-h / TAU_ICE_YR);

    // Evaporation removes liquid; escape removes water (liquid and vapour) at
    // a rate set by the stratospheric water fraction.
    let L = Math.max(0, s.oceanDepthM - th.evap * h * YEAR_S / EVAP_J_PER_M);
    const f = stratFraction(s.Ts);
    const ratio = Math.exp(-h * f / (TAU_H2O_LOSS_REF_YR * F_STRAT_REF));
    s.waterOED = Math.max(0, s.waterOED * ratio);
    L = Math.min(L * ratio, s.waterOED);
    s.oceanDepthM = L;

    s.h2Bar *= Math.exp(-h / TAU_H2_YR);
    const dCO2 = co2Step(s, c, geo, h, liquidBefore || L > 0);
    s.tYears += h;
    s.last = { netWm2: th.net, evapWm2: th.evap, carbonRatio: dCO2.ratio };
  }

  // Carbon cycle: dp/dt = F_out - F_w with F_w = F_out (p/p_ref)^0.3 exp((Ts-288)/13.7) land weathering.
  // The p^0.3 term is linearised at the start of the step and integrated exactly.
  function co2Step(s, c, geo, h, wet) {
    const gf = geo.gf;
    const G = FOUT_BAR_PER_YR * (c.volcanicTmolYr / 7) * gf;
    const landF = clamp(c.landFraction / LAND_REF, 0, 3);
    const tFac = Math.exp(clamp((s.Ts - 288) / WEATHER_E_K, -50, 50));
    const wf = wet ? landF * c.weatheringFactor * tFac : 0;
    const K = wf * G / Math.pow(P_CO2_REF, WEATHER_EXP);
    const p0 = Math.max(s.co2Bar * gf, 1e-12);
    const c0 = K * Math.pow(p0, WEATHER_EXP);
    const c1 = WEATHER_EXP * K * Math.pow(p0, WEATHER_EXP - 1);
    const A = G - c0 + c1 * p0;
    const B = c1;
    let p;
    if (B > 1e-300) {
      const eq = A / B;
      p = eq + (p0 - eq) * Math.exp(-B * h);
    } else {
      p = p0 + A * h;
    }
    p = Math.max(p, 0);
    s.co2Bar = p / gf;
    const ratio = wf * Math.pow(Math.max(p, 1e-12) / P_CO2_REF, WEATHER_EXP);
    return { ratio: ratio };
  }

  // Advance by dtYears. Long steps are split so that no internal step exceeds
  // MAX_SUB_YR, and so that a negative feedback rate times the step stays small.
  function step(state, config, dtYears) {
    const geo = geometry(config);
    let remaining = dtYears;
    let guard = 0;
    while (remaining > 1e-12 && guard < 1e6) {
      guard++;
      let h = Math.min(remaining, MAX_SUB_YR);
      const liquid = state.oceanDepthM > 0;
      const Seff = effectiveFlux(config, state.tYears);
      const lam = olrAt(state, config, geo, state.Ts + 0.5, Seff, liquid)
        - olrAt(state, config, geo, state.Ts - 0.5, Seff, liquid);
      // Where the feedback is weak or negative (cap binding, near a fold), the
      // linear solve is only trusted for a few kelvin per step.
      const liquidCap = liquid ? Math.max(WATER_HEAT_PER_M * state.oceanDepthM, 1e6) : 0;
      const Ceff = C_MIX + liquidCap;
      const net = Math.abs(fluxes(state, config, geo, state.Ts, Seff, liquid).net);
      if (lam < 0) {
        h = Math.min(h, Math.max(0.5, 2 * C_MIX / (-lam * YEAR_S)));
      }
      if (lam < LAMBDA_TRUST && net > 0) {
        h = Math.min(h, Math.max(0.5, MAX_DT_K * Ceff / (net * YEAR_S)));
      }
      substep(state, config, geo, h);
      remaining -= h;
    }
  }

  // ---- Configuration -----------------------------------------------------
  function defaultConfig() {
    return {
      massEM: 1.0,
      coreMassFraction: 0.33,
      waterOED_m: 2700,
      landFraction: 0.29,
      S: 1.0,
      evolveStar: true,
      ageGyr: 4.57,
      rotationDays: 1.0,
      cloudOffset: 0,
      co2Bar: 4.2e-4,
      ch4Bar: 1.8e-6,
      n2Bar: 0.78,
      o2Bar: 0.21,
      h2Bar: 0,
      volcanicTmolYr: 7,
      weatheringFactor: 1
    };
  }

  const GAS_KEYS = ['co2Bar', 'ch4Bar', 'n2Bar', 'o2Bar', 'h2Bar'];
  const PLANET_KEYS = ['massEM', 'coreMassFraction', 'landFraction', 'S', 'evolveStar',
    'ageGyr', 'rotationDays', 'cloudOffset', 'volcanicTmolYr', 'weatheringFactor'];

  // Apply a user change. Gas inventories and the water inventory also reset
  // the matching state values at once.
  function editConfig(state, config, patch) {
    Object.keys(patch || {}).forEach(function (k) {
      const v = patch[k];
      if (PLANET_KEYS.indexOf(k) >= 0) {
        config[k] = v;
      } else if (GAS_KEYS.indexOf(k) >= 0) {
        config[k] = v;
        state[k] = v;
      } else if (k === 'waterOED_m') {
        config.waterOED_m = v;
        state.waterOED = v;
        state.oceanDepthM = (config.landFraction < 1 && state.Ts < CRITICAL_T) ? v : 0;
      }
    });
  }

  // ---- Initial state -----------------------------------------------------
  // Scan for the first sign change of OLR - absorbed (stable low-T branch),
  // then bisect. Returns null if there is none on the scanned range.
  function findEquilibrium(base, c, geo, Seff, liquid, tLo, tHi, nScan) {
    const f = (T) => {
      const F = fluxes(base, c, geo, T, Seff, liquid);
      return F.olr - F.absorbed;
    };
    let prevT = tLo;
    let prevF = f(prevT);
    for (let i = 1; i <= nScan; i++) {
      const T = tLo + (tHi - tLo) * i / nScan;
      const fv = f(T);
      if (prevF < 0 && fv >= 0) {
        let a = prevT;
        let b = T;
        for (let k = 0; k < 60; k++) {
          const m = 0.5 * (a + b);
          if (f(m) < 0) a = m; else b = m;
        }
        return 0.5 * (a + b);
      }
      prevT = T;
      prevF = fv;
    }
    return null;
  }

  // Initial state at radiative equilibrium for the config (or opts.Ts0).
  // Ocean-bearing planets start wet; if no equilibrium exists (absorbed flux
  // above the cap), the planet starts at 300 K and runs away.
  function createState(config, opts) {
    const c = config;
    const geo = geometry(c);
    const Seff = effectiveFlux(c, 0);
    const wetPossible = c.landFraction < 1 && c.waterOED_m > 0;
    const base = {
      tYears: 0,
      co2Bar: c.co2Bar, ch4Bar: c.ch4Bar, n2Bar: c.n2Bar, o2Bar: c.o2Bar, h2Bar: c.h2Bar,
      waterOED: c.waterOED_m, oceanDepthM: wetPossible ? c.waterOED_m : 0,
      Ts: 288, Td: 288, iceFraction: 0, last: { netWm2: 0, evapWm2: 0, carbonRatio: 1 }
    };
    let Ts0;
    let liquid = false;
    const o = opts || {};
    if (o.Ts0 !== undefined) {
      Ts0 = o.Ts0;
      liquid = wetPossible && Ts0 < CRITICAL_T;
    } else if (wetPossible) {
      const wet = findEquilibrium(base, c, geo, Seff, true, 40, CRITICAL_T, 120);
      if (wet !== null) {
        Ts0 = wet;
      } else {
        Ts0 = 300;
      }
      liquid = true;
    } else {
      const dry = findEquilibrium(base, c, geo, Seff, false, 40, 2000, 196);
      Ts0 = dry !== null ? dry : 288;
    }
    base.Ts = Ts0;
    base.Td = Ts0;
    base.iceFraction = iceEquilibrium(Ts0);
    base.oceanDepthM = liquid ? c.waterOED_m : 0;
    return base;
  }

  // ---- Diagnosis (pure) --------------------------------------------------
  function diagnose(s, c) {
    const geo = geometry(c);
    const Seff = effectiveFlux(c, s.tYears);
    const liquid = s.oceanDepthM > 0;
    const F = fluxes(s, c, geo, s.Ts, Seff, liquid);
    const env = F.env;
    const f = s.iceFraction;
    const fe = iceEquilibrium(s.Ts);
    const fStrat = stratFraction(s.Ts);
    const ratio = s.last && s.last.carbonRatio !== undefined ? s.last.carbonRatio : 1;
    const evap = s.last && s.last.evapWm2 ? s.last.evapWm2 : 0;
    const lag = {
      mixedLayer: clamp(Math.abs(F.net) / 20, 0, 1),
      deepOcean: clamp(Math.abs(s.Ts - s.Td) / 10, 0, 1),
      iceCover: clamp(Math.abs(f - fe) / 0.2, 0, 1),
      carbonate: clamp(Math.abs(1 - ratio), 0, 1),
      waterLoss: clamp(evap / 10, 0, 1)
    };
    const d = {
      tYears: s.tYears,
      Ts: s.Ts,
      TsC: s.Ts - 273.15,
      Td: s.Td,
      surfacePressureBar: env.pTot,
      pH2OBar: env.pH2O,
      pCO2Bar: env.p.co2,
      pCH4Bar: env.p.ch4,
      pN2Bar: env.p.n2,
      pO2Bar: env.p.o2,
      pH2Bar: env.p.h2,
      oceanFraction: 1 - c.landFraction,
      oceanDepthM: s.oceanDepthM,
      iceFraction: f,
      albedo: F.albedo,
      absorbedWm2: F.absorbed,
      olrWm2: F.olr,
      olrCapWm2: F.cap,
      netWm2: F.net,
      stratosphericH2O: fStrat,
      hydrogenLossTimescaleGyr: F_STRAT_REF / fStrat,
      gravityRel: geo.g,
      radiusRel: geo.R,
      massRel: c.massEM,
      rotationDays: c.rotationDays,
      luminosityRel: c.evolveStar ? luminosityRelative(c.ageGyr + s.tYears * 1e-9) : c.S,
      lag: lag,
      flags: {
        hasLiquidWater: liquid,
        hasIce: liquid && f > 0.02,
        moistGreenhouse: liquid && s.Ts >= 330,
        runawayActive: liquid && F.g >= F.cap && F.absorbed >= F.cap,
        hot: s.Ts > 373.15,
        hasSteamAtmosphere: !liquid && env.pH2O > 0.1
      }
    };
    d.state = classify(d, c);
    return d;
  }

  // ---- Classification ----------------------------------------------------
  const STATES = [
    { id: 'hard_snowball', name: 'Hard snowball',
      summary: 'Ice covers the whole ocean, tropics included. The ice reflects most sunlight, so the planet stays frozen unless CO2 builds up for millions of years.' },
    { id: 'slushball', name: 'Slushball / waterbelt',
      summary: 'Ice covers most of the ocean, with an open tropical band of water. The planet is cold, and ice cover is a sticky state that recovers slowly.' },
    { id: 'eyeball', name: 'Eyeball',
      summary: 'Ice caps sit over frozen poles, and an equatorial band of open ocean is the only warm spot. Sunlight there keeps a small window of water liquid.' },
    { id: 'temperate', name: 'Temperate',
      summary: 'Liquid oceans, little ice, and a surface near 288 K. Water vapour and CO2 warm the surface enough to keep oceans liquid, and weathering keeps CO2 in check.' },
    { id: 'desert', name: 'Desert',
      summary: 'Mostly land with little water. Liquid is confined to shallow basins or poles, and the planet is less exposed to runaway than an ocean world.' },
    { id: 'moist_greenhouse', name: 'Moist greenhouse',
      summary: 'Oceans stay liquid above about 330 K, and water vapour climbs high enough to let light hydrogen escape slowly, draining the ocean over about a billion years.' },
    { id: 'wet_runaway', name: 'Wet runaway',
      summary: 'Absorbed sunlight exceeds the most infrared a moist atmosphere can emit. The surface temperature stalls while the surplus evaporates the ocean.' },
    { id: 'dry_runaway', name: 'Dry runaway (steam)',
      summary: 'The ocean has evaporated into a thick steam atmosphere. Surface temperature rises until the steam can radiate the absorbed sunlight, near 1500 K.' },
    { id: 'venus_like', name: 'Venus-like desiccated',
      summary: 'A dense CO2 atmosphere, about 90 bar, with almost no water left. The thick CO2 traps heat, and the surface reaches about 740 K.' },
    { id: 'mars_like', name: 'Mars-like',
      summary: 'A thin CO2 atmosphere, a few millibars, with no liquid water. Weak greenhouse warming leaves the surface far below freezing.' },
    { id: 'early_mars_warm', name: 'Early-Mars warm',
      summary: 'A thick CO2 atmosphere with hydrogen warms the surface above freezing, but only for a while. Once the hydrogen is gone, the planet cools again.' },
    { id: 'titan_like', name: 'Titan-like',
      summary: 'A nitrogen atmosphere with methane, cold enough that methane and ethane can pool as liquid. Classification only; the model does not run methane hydrology.' },
    { id: 'waterworld', name: 'Waterworld (hycean)',
      summary: 'A planet with almost no land and a deep global ocean. Without land there is no weathering, so CO2 is not drawn down.' },
    { id: 'hadean_steam', name: 'Hadean steam',
      summary: 'A young, very hot planet with steam and thick CO2. Surface water is still in vapour form, and the planet cools toward an ocean stage.' }
  ];

  const STATE_BY_ID = {};
  STATES.forEach(function (st) { STATE_BY_ID[st.id] = st; });

  // Pure function of the diagnosis. The first matching rule wins.
  function classify(d, c) {
    const wet = d.flags.hasLiquidWater;
    const T = d.Ts;
    const f = d.iceFraction;
    let id;
    if (!wet && T < 200 && d.pCH4Bar >= 0.01 && d.pN2Bar >= 0.5) id = 'titan_like';
    else if (!wet && d.pH2OBar >= 0.5 && T >= 400) id = d.pCO2Bar >= 10 ? 'hadean_steam' : 'dry_runaway';
    else if (!wet && d.pCO2Bar >= 10 && T >= 500) id = 'venus_like';
    else if (wet && d.flags.runawayActive) id = 'wet_runaway';
    else if (wet && T >= 330) id = 'moist_greenhouse';
    else if (wet && f >= 0.9) id = 'hard_snowball';
    else if (wet && f >= 0.3) id = 'slushball';
    else if (wet && f >= 0.05 && T < 275) id = 'eyeball';
    else if (wet && d.oceanFraction >= 0.98) id = 'waterworld';
    else if (wet && d.oceanFraction <= 0.5 && d.oceanDepthM < 1000) id = 'desert';
    else if (wet) id = 'temperate';
    else if (T >= 273 && d.pCO2Bar >= 0.5 && d.pH2Bar >= 0.01) id = 'early_mars_warm';
    else if (T >= 273) id = 'desert';
    else id = 'mars_like';
    const st = STATE_BY_ID[id];
    let summary = st.summary;
    if (d.rotationDays >= 20) {
      summary += ' Slow rotator (P of 20 days or more): a substellar cloud deck adds albedo, which cools the surface.';
    }
    return { id: id, name: st.name, summary: summary };
  }

  // ---- Energy curve for the diagram --------------------------------------
  function energyCurve(state, config, n) {
    const N = Math.max(2, Math.floor(n) || 2);
    const geo = geometry(config);
    const liquid = state.oceanDepthM > 0;
    const Seff = effectiveFlux(config, state.tYears);
    const Ts = new Array(N);
    const olr = new Array(N);
    for (let i = 0; i < N; i++) {
      const T = 150 + (2000 - 150) * i / (N - 1);
      Ts[i] = T;
      olr[i] = olrAt(state, config, geo, T, Seff, liquid);
    }
    const F = fluxes(state, config, geo, state.Ts, Seff, liquid);
    return { Ts: Ts, olr: olr, absorbedWm2: F.absorbed, olrCapWm2: olrCap(config, state.Ts) };
  }

  // ---- Clock -------------------------------------------------------------
  // Speed tiers: sub-step (years) as a pure function of speed (years/s).
  // Sub-steps per frame at 60 Hz stay at or below 500 across the tiers.
  const TIER_SPEED = [0, 30, 300, 3e3, 3e4, 3e5, 3e6, 3e7, 3e8];
  const TIER_DT = [0.5, 1, 5, 25, 100, 500, 2000, 1e4, 5e4];

  function stepSizeForSpeed(yearsPerSecond) {
    let dt = TIER_DT[0];
    for (let i = 0; i < TIER_SPEED.length; i++) {
      if (yearsPerSecond >= TIER_SPEED[i]) dt = TIER_DT[i];
    }
    return dt;
  }

  const Clock = {
    create: function () {
      return { acc: 0 };
    },
    // Accumulates simulated years; runs whole sub-steps. Returns the count.
    advance: function (clock, wallSeconds, yearsPerSecond, state, config) {
      const wall = clamp(wallSeconds, 0, MAX_FRAME_S);
      const dt = stepSizeForSpeed(yearsPerSecond);
      clock.acc += wall * yearsPerSecond;
      let n = 0;
      while (clock.acc >= dt && n < MAX_STEPS_PER_CALL) {
        step(state, config, dt);
        clock.acc -= dt;
        n++;
      }
      if (clock.acc > dt) clock.acc = dt;
      return n;
    }
  };

  // ---- Presets -----------------------------------------------------------
  function withConfig(overrides) {
    const c = defaultConfig();
    Object.keys(overrides).forEach(function (k) { c[k] = overrides[k]; });
    return c;
  }

  // Mars: 0.107 M_E, gf = 1.19, so a 6.4 mbar surface needs about 0.0054 bar inventory.
  const PRESETS = [
    { id: 'earth', name: 'Present Earth',
      blurb: 'One Earth mass, 2.7 km of ocean, 29% land, present gases. The Sun brightens slowly over time.',
      config: withConfig({}) },
    { id: 'snowball', name: 'Snowball',
      blurb: 'Weaker sunlight (S = 0.72) under ice. The ice reflects most of the light and the planet stays frozen.',
      config: withConfig({ S: 0.72, evolveStar: false }) },
    { id: 'late_earth', name: 'Warm Earth (S 1.10)',
      blurb: 'Earth-like gases with 10% more sunlight. Oceans warm toward the moist greenhouse.',
      config: withConfig({ S: 1.10, evolveStar: false }) },
    { id: 'runaway', name: 'Wet runaway (S 1.4)',
      blurb: 'Strong sunlight over an ocean. The ocean evaporates while the surface temperature holds.',
      config: withConfig({ S: 1.4, evolveStar: false }) },
    { id: 'desert', name: 'Desert world',
      blurb: '60% land and a thin 300 m ocean equivalent. Less water means less runaway risk.',
      config: withConfig({ landFraction: 0.6, waterOED_m: 300, evolveStar: false }) },
    { id: 'waterworld', name: 'Waterworld',
      blurb: 'Almost no land and a deep global ocean. Without land, weathering is nearly absent.',
      config: withConfig({ landFraction: 0.005, waterOED_m: 10000, evolveStar: false }) },
    { id: 'slow_rotator', name: 'Slow rotator (30 days)',
      blurb: 'A 30-day rotation adds a substellar cloud deck that raises albedo and cools the surface.',
      config: withConfig({ rotationDays: 30, S: 1.3, evolveStar: false }) },
    { id: 'mars', name: 'Mars-like',
      blurb: 'Thin CO2 atmosphere, no ocean, 43% of Earth sunlight.',
      config: withConfig({ massEM: 0.107, S: 0.43, landFraction: 1, waterOED_m: 0,
        co2Bar: 0.00534, n2Bar: 0.00014, o2Bar: 0, evolveStar: false, cloudOffset: 0 }) },
    { id: 'venus', name: 'Venus-like',
      blurb: 'Dense CO2 (about 92 bar), almost no water, and sunlight 1.91 times Earth.',
      config: withConfig({ massEM: 0.815, S: 1.91, landFraction: 1, waterOED_m: 0.0235,
        co2Bar: 90.7, n2Bar: 3.1, o2Bar: 0, evolveStar: false, cloudOffset: 0.39 }) }
  ];

  const api = {
    PRESETS: PRESETS,
    STATES: STATES,
    defaultConfig: defaultConfig,
    editConfig: editConfig,
    createState: createState,
    step: step,
    stepSizeForSpeed: stepSizeForSpeed,
    Clock: Clock,
    diagnose: diagnose,
    classify: classify,
    energyCurve: energyCurve,
    luminosityRelative: luminosityRelative
  };
  return api;
})();

if (typeof window !== 'undefined') window.ClimateModel = ClimateModel;
if (typeof module !== 'undefined') module.exports = ClimateModel;
