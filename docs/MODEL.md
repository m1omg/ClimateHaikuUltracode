# Climate Forge model: equations, calibration and limits

This file describes `js/model.js`. Physical rates are in planetary years. The
clock only sets how many model years pass per wall-clock second. Where a value
is chosen rather than taken from the brief, its basis is given. Numbers marked
[FC] in `docs/climate-research-brief.md` are not treated as confirmed.

## 1. State variables

| Field | Meaning |
|---|---|
| `tYears` | model time (yr) |
| `Ts`, `Td` | mixed-layer (surface) and deep-ocean temperature (K) |
| `iceFraction` | sea-ice fraction of the open ocean, relaxing toward equilibrium |
| `oceanDepthM` | liquid ocean-equivalent depth (m) |
| `waterOED` | total water inventory (m OED); vapour = `waterOED - oceanDepthM` |
| `co2Bar`, `ch4Bar`, `n2Bar`, `o2Bar`, `h2Bar` | gas inventories, bar at Earth gravity |
| `last` | rates from the last step, used for diagnostics |

Configuration fields are `massEM`, `coreMassFraction`, `waterOED_m`,
`landFraction`, `S`, `evolveStar`, `ageGyr`, `rotationDays`, `cloudOffset`,
the five gas inventories, `volcanicTmolYr` and `weatheringFactor`.

## 2. Equations

### 2.1 Stellar flux and luminosity

- Gough (1981): `L/L0 = 1 / (1 + 0.4 (1 - t/4.57))`, t in Gyr. The
  future extrapolation has a stated ±20–30% uncertainty (brief, Game decision 3).
- Effective flux: `S_eff(t) = S * L(age + t) / L(age)` when `evolveStar` is on,
  otherwise `S`.
- Absorbed sunlight: `A_abs = (1 - albedo) * S_eff * 1361 / 4` W m^-2.

### 2.2 Albedo

`albedo = land * 0.25 + open * [(1 - f_ice) * a_open + f_ice * 0.62]
          + 0.19 * p_H2O / (p_H2O + 0.001) + rot_cloud(P) + cloudOffset`

- `open = 1 - landFraction`, `a_open = 0.07` with liquid, `0.25` without.
- `0.19 * p/(p + 0.001)` is the clear-sky cloud allowance. It is tied to water
  vapour so that dry planets have no cloud term. It is fixed at high vapour, so
  there is no cloud feedback (see section 8).
- `rot_cloud(P) = 0.12 * smoothstep(5 d, 20 d, P)` is the slow-rotator
  substellar cloud term. Game approximation (brief Game decision 7). The brief
  suggests a larger value; 0.30 made an Earth-like 30-day rotator snowball at S = 1,
  so it was reduced.
- Albedo is clamped to [0.02, 0.95].

Earth gives 0.294, the Bond albedo target of 0.294 (brief Section 5).

### 2.3 Outgoing longwave

`OLR = min(cap(Ts), sigma Ts^4 / (1 + 0.75 tau))`, sigma = 5.670374e-8.

- `cap = 282 W m^-2 * rapidFactor(P)` for Ts ≤ 1600 K. Goldblatt et al. (2013),
  Game decision 1. `rapidFactor = 1 - 0.1 * clamp((1 - P)/0.5, 0, 1)`, so only
  rotation periods under one day lose up to 10% of the cap (game approximation).
- Above 1600 K the cap rises as `(Ts/1600)^4`. This gives a stable steam branch
  near 1600 K (Goldblatt et al. 2013, "stable steam branch at Ts ≳ 1600 K").
  Deviation: the brief formula is flat. With a flat cap, absorbed flux above 282
  has no equilibrium at any temperature, so the steam atmosphere would heat without limit.

Grey optical depth:

`tau = CO2 + N2/O2 broadening + CH4 + H2 + H2O`

| Term | Form | Calibration |
|---|---|---|
| CO2 | `0.057 ln(1 + p/1e-4 bar) + 15.6 sqrt(p) p/(p + 0.3 bar)` | Log term: at Earth, 0.057 ln(9.4/5.2) = 0.0337 per doubling of CO2. With dOLR/dτ ≈ 110 W m^-2 this is about 3.7 W m^-2 per doubling. The second term is the thick-CO2 fit (section 2.4). |
| N2 + O2 | `0.1 p` | Pressure broadening, a documented choice. The brief gives no coefficient. |
| CH4 | `3.6e-4 sqrt(p_ppb)` | Scaled to Etminan et al. (2016): 0.61 W m^-2 for 722→1803 ppb (brief Section 4). |
| H2 | `5 p^2` | Collision-induced absorption, simple p^2 scaling (brief Section 4). Documented. |
| H2O | `2.51 p^0.3 + 0.02 p^2`, with `p` capped at 300 bar | Sub-linear term calibrated to Earth; quadratic term for steam (see below). |

- `p` is the partial pressure: inventory × gravity factor (section 2.5).
- Water partial pressure (section 2.6): `p_H2O`.
- The water opacity is capped at 300 bar, so a very deep steam atmosphere
  cannot exceed about 1700 K.

Earth calibration: Ts = 287.9 K and OLR = 240.2 W m^-2 (target 288 K and 239 W m^-2).

### 2.4 Thick CO2 (Venus-like), a fit

The term `15.6 sqrt(p) p/(p + 0.3)` is a sub-linear fit in CO2 partial pressure,
and it is not a line-by-line model (brief Game decision 5). It is calibrated so
that Venus (92 bar CO2, S = 1.91, albedo 0.77, no ocean) gives 737.9 K (target
about 737 K). It is negligible at Earth and Mars pressures.

### 2.5 Pressure and geometry

- `R/R_E = (1.07 - 0.21 CMF) M^0.27`, CMF = 0.33 (Zeng et al. 2016). Mass 1 gives R = 1.0007.
- `g/g_E = M / R^2`.
- Gravity factor `gf = M/R^4`: surface partial pressure = inventory × `gf`.
  This is the brief formula `inventory × (g/g_E)(R_E/R)^2`.
- Water column: 1 m OED = 0.0981 bar at Earth gravity, scaled by `gf`.

### 2.6 Water vapour

- Buck (1996): `e_s` (bar), liquid above 0 C, ice below. Temperature is clamped
  to -80…370 C.
- With liquid: `p_H2O = min( max(e_s × open × 0.8, p_evaporated), p_total )`,
  where `open = (1 - land)(1 - f_ice)`, the availability factor 0.8 is
  documented, `p_evaporated` is the vapour from water already evaporated, and
  `p_total` is the total water inventory as a pressure.
- Without liquid: `p_H2O` equals the whole water inventory (steam).

### 2.7 Thermal balance: mixed layer and deep ocean

Mixed-layer heat capacity from the 10-yr time constant:
`C_mix = 10 yr × 3.3 W m^-2 K^-1 = 1.04e9 J m^-2 K^-1` (3.3 is the feedback
used to size the mixed layer; Game decision 4).

Deep ocean: heat capacity from the liquid column, `C_deep = 4.2e6 J m^-3 K^-1 × oceanDepthM`,
and coupling `K = C_deep / 300 yr`. With no liquid, `K = 0`.

Two-box equations, with a linearised feedback `lam = dOLR/dTs` (≥ 0 in the solve):

`C_mix dTs/dt = A_abs - OLR - K (Ts - Td)`
`C_deep dTd/dt = K (Ts - Td)`

The 2×2 linear system is solved exactly with its two real eigenvalues, so
there is no restriction on the step for a stable feedback. Two passes of
linearisation are used. The first is about the current Ts, and the second is
about the predicted end-of-step temperature. A negative feedback is set to zero
inside the solve, because its exponential growth would overshoot. The cap and
the step limiter bound the response instead.

Step limiter: where `lam < 0.5 W m^-2 K^-1`, the step is limited so the
temperature changes by at most 3 K. Internal steps never exceed 5000 yr.

### 2.8 Sea ice

- Equilibrium: `f_eq(Ts) = 1 / (1 + exp((Ts - 269)/2.5))`, a transition band
  of about 263–275 K (brief Section 4, Budyko–Sellers form).
- Relaxation: `f ← f_eq + (f - f_eq) exp(-dt/100 yr)`, exact, with τ = 100 yr (brief Game decision 4).
- Snowball memory comes from the lag of the ice behind the energy balance.
  The hysteresis loop was not tested (section 7).

Albedo uses the ice fraction over open ocean only. Dry planets have no ice term.

### 2.9 Runaway and evaporation

- When liquid is present, `OLR = cap` (`g ≥ cap`) and the absorbed flux is at
  least the cap, the surplus `A_abs - cap` is spent on evaporation. The mixed layer is pinned, so it does not heat.
- Energy per metre of ocean: `3.96e9 J m^-2` (latent 2.5e9 + sensible 1.46e9,
  so 2.7 km is 1.07e13 J m^-2, the brief's value). A 2.7 km ocean evaporates in
  `1.07e13 / 10 W m^-2 = 3.4e4 yr` at a 10 W m^-2 surplus (brief Section 3).
- Above the critical point (647.1 K) liquid cannot exist. Warming beyond it is
  spent on evaporation and the surface is held at 647.1 K.
- The water vapour from evaporation stays in the column, so the greenhouse grows
  as the ocean drains. This is a documented simplification.

### 2.10 Water escape (moist greenhouse)

- Stratospheric water fraction: `f = clamp(3e-3 exp((Ts - 355)/12), 1e-6, 0.5)`.
  This rises steeply above about 320 K (brief Section 4).
- Escape time: `tau_H = 1 Gyr × (3e-3 / f)`, scaling as 1/f (brief Game decision 2).
  At 355 K it is 1 Gyr. At 1600 K steam it is about 6 Myr (f capped at 0.5),
  so steam loses its water within Myr.
- Liquid and total water both decay at this rate.

### 2.11 Carbon cycle

`dp_CO2/dt = F_out - F_w`, with `F_w = F_out (p/p_ref)^0.3 exp((Ts - 288)/13.7) landF weatheringFactor`
and `landF = clamp(landFraction / 0.29, 0, 3)`.

- `F_out = 58e-9 bar yr^-1 × (volcanicTmolYr / 7)`, i.e. 7 Tmol C yr^-1 is 58
  bar per Gyr (brief Section 5).
- `p_ref = 4.2e-4 bar`, so Earth is at balance at 288 K.
- Weathering needs liquid water. Deviation: the brief formula has no liquid
  factor, but without liquid there is no weathering.
- The exponential is clamped to ±50 in the exponent.
- Integration: the `p^0.3` term is linearised about the start of the step and
  integrated exactly. CO2 never goes negative.

Weathering e-folding timescale: `turnover / 0.3 ≈ 7 kyr / 0.3 ≈ 24 kyr`. The
brief quotes 240 kyr (Colbourn et al. 2015). This is a deviation: the model uses
the brief's WHK exponent, which gives a shorter timescale. Reported as a gap.

### 2.12 Hydrogen

`H2` decays with `tau = 1 Gyr` (game value, documented). `N2` and `O2` are inert for escape.

### 2.13 Clock

`stepSizeForSpeed(yr/s)` is a pure function of speed. It is the largest tier
threshold at or below the speed:

| Speed (yr/s) from | Sub-step (yr) | Max sub-steps per 60 Hz frame |
|---|---|---|
| 0 | 0.5 | 1 |
| 30 | 1 | 5 |
| 300 | 5 | 10 |
| 3 000 | 25 | 20 |
| 30 000 | 100 | 50 |
| 300 000 | 500 | 100 |
| 3 000 000 | 2 000 | 250 |
| 30 000 000 | 10 000 | 500 |
| 300 000 000 | 50 000 | 333 at 1 Gyr/s |

`step` splits any sub-step into pieces no longer than 5000 yr, so a 50 000-yr
sub-step is 10 model steps. The Clock accumulates simulated years from the
wall-clock delta, clamps the delta to 0.25 s, and runs at most 2000 whole sub-steps per call.

## 3. Calibration constants and basis

| Constant | Value | Basis |
|---|---|---|
| S0 | 1361 W m^-2 | NSSDC present solar constant |
| OLR cap | 282 W m^-2 | Goldblatt et al. (2013) (Game decision 1) |
| Steam branch | 1600 K | Goldblatt et al. (2013) |
| Critical point | 647.1 K | water |
| Evaporation energy | 3.96e9 J m^-2 per m | brief Section 3.3 (1.07e13 per 2.7 km) |
| C_mix | 10 yr × 3.3 W m^-2 K^-1 | brief 10-yr mixed layer |
| Deep exchange | 300 yr | brief two-box deep ocean |
| Ice τ | 100 yr | brief Game decision 4 |
| Ice centre, width | 269 K, 2.5 K | brief band 263–275 K |
| Ice albedo | 0.62 | brief Section 4 |
| Ocean / land albedo | 0.07 / 0.25 | brief Section 5; Mars 0.25 |
| Cloud allowance | 0.19, half at 0.001 bar | calibrated so Earth albedo is 0.294 |
| Availability | 0.8 | documented; near-surface vapour over open ocean |
| CO2 log term | 0.057, pc 1e-4 bar | 3.7 W m^-2 per doubling at Earth |
| CO2 thick fit | 15.6, ps 0.3 bar | Venus 737.9 K (brief Game decision 5) |
| N2/O2 broadening | 0.1 bar^-1 | documented choice |
| CH4 | 3.6e-4 sqrt(ppb) | Etminan et al. (2016) |
| H2 CIA | 5 bar^-2 | documented choice |
| H2O | 2.51 p^0.3 + 0.02 p^2, p ≤ 300 bar | Earth 287.9 K; steam 1400–1600 K |
| Water escape | 1 Gyr at f = 3e-3 | brief Game decision 2 |
| Weathering | 0.3, 13.7 K, p_ref 4.2e-4 bar | brief Section 4 (WHK, unverified in FC) |
| F_out | 58 bar Gyr^-1 at 7 Tmol yr^-1 | brief Section 5 |
| H2 escape | 1 Gyr | documented choice |
| Rotation cloud | 0.12 max, 5–20 d | game approximation (Game decision 7) |
| Rapid factor | 10% at P → 0 | game approximation |

## 4. Calibration results

Measured with the final code.

| Target | Result | Status |
|---|---|---|
| Earth Ts (288 K) | 287.9 K | within tolerance |
| Earth OLR (239 W m^-2) | 240.2 W m^-2 | within tolerance |
| Earth albedo (0.294) | 0.294 | |
| Mars Ts (214 K mean) | 220.0 K, 0.0065 bar | within 200–225 K |
| Venus Ts (737 K) | 737.9 K, 95.1 bar total | within 700–780 K |
| Runaway onset, Gough ramp | S = 1.192 at 1.843 Gyr (cap first binds at Ts ≈ 304 K) | see section 7 |
| Moist onset, Ts 330 K, Gough ramp | S = 1.204 at 1.935 Gyr | see section 7 |
| Moist onset, quasi-static S ramp (1e-6 per yr) | S = 1.207 | |
| Step S = 1.22 (just above threshold): 288 → 330 K | 2530 yr (1-yr steps) | test 8 |
| Step S = 1.25: 288 → 330 K | 992 yr | |
| Step S = 1.40: 288 → 330 K | 78 yr | |
| S = 1.22: ocean drained | 2.9e4 yr at ~8 W m^-2 surplus | brief 1e4–1e5 yr |
| S = 1.22: steam Ts after 200 kyr | ~1420 K | brief 1400–1500 K |
| Snowball S = 0.72, 1 Myr | Ts 222.6–247.0 K, hard_snowball | |
| Warm config (S 1.17) water loss | 2700 → 2669 m in 1 Gyr | |
| CO2 after 1 Myr, S 1.0 vs 1.17 | 4.3e-4 vs 1.6e-5 bar | warmer = more weathering |

Frame-rate test (speed 1000 yr/s, sub-step 5 yr, 10 s wall): 30 Hz gives
t = 10000.00 yr and Ts = 287.9017 K; 60 Hz gives the same; 144 Hz gives
t = 9995.00 yr and Ts = 287.9017 K. The difference is one sub-step, and Ts agrees to well under 0.01 K.

Convergence test (ramp of 1e-6 S/yr to moist onset): 1-yr sub-step gives
209 557 yr, 500-yr sub-step gives 206 000 yr. Difference 1.7%, inside 5%.

## 5. Classification

`classify(diagnose)` is a pure function. Rules, first match wins:

1. no liquid, Ts < 200 K, CH4 ≥ 0.01 bar, N2 ≥ 0.5 bar → `titan_like`
2. no liquid, steam ≥ 0.5 bar, Ts ≥ 400 K → `hadean_steam` if CO2 ≥ 10 bar, else `dry_runaway`
3. no liquid, CO2 ≥ 10 bar, Ts ≥ 500 K → `venus_like`
4. liquid and runaway active → `wet_runaway`
5. liquid, Ts ≥ 330 K → `moist_greenhouse`
6. liquid, ice ≥ 0.9 → `hard_snowball`; ice ≥ 0.3 → `slushball`; 0.05 ≤ ice < 0.3 and Ts < 275 K → `eyeball`
7. liquid, open-ocean fraction ≥ 0.98 → `waterworld`
8. liquid, land ≤ 0.5 and depth < 1000 m → `desert`; otherwise `temperate`
9. no liquid, Ts ≥ 273 K: CO2 ≥ 0.5 bar and H2 ≥ 0.01 bar → `early_mars_warm`; else `desert`
10. otherwise `mars_like`

Slow rotators (P ≥ 20 d) get an extra clause in the summary text.

Thresholds are well separated, and the classification has no deadband because
each rule depends on fields that change slowly. Repeated calls are identical (test 13).

### Classification-only states

These are classified from state, but their defining physics is not simulated:

- `titan_like`: no methane hydrology. Reachable only by a configuration with
  N2 and CH4 (Ts 116 K in a test config, brief value 94 K).
- `waterworld` (hycean): a liquid-ocean world with no ice-VI layers and no
  hycean chemistry. The brief places hycean and high-pressure-ice layers in this group.
- `eyeball`: from the global ice fraction only. The model has no latitude structure.
- `hadean_steam`: from steam and CO2 only. No magma ocean.
- `early_mars_warm`: from CO2 and H2 only. No transient cooling when H2 is lost.

Superhabitable worlds are not modelled.

## 6. Tests

`npm test` runs `node --test tests/*.test.js`. Results: 15 of 15 pass. Thirteen
are the brief's tests, and two are extra checks on the speed tiers and on `editConfig`.

| # | Test | Result |
|---|---|---|
| 1 | Earth Ts, OLR, albedo, state | pass: 287.9 K, 240.2 W m^-2, 0.294, temperate |
| 2 | Mars Ts and pressure, state | pass: 220.0 K, 0.0065 bar, mars_like |
| 3 | Venus Ts, state | pass: 737.9 K, venus_like |
| 4 | Snowball cold for 1 Myr at 1000 yr | pass: hard_snowball throughout |
| 5 | Gough law values | pass |
| 6 | Mass-radius, 1 M_E | pass: R 1.0007, g 0.9986 |
| 7 | Gradualness (Gough Earth) | pass: moist onset 1.93 Gyr, runaway onset 1.84 Gyr |
| 8 | Step S = 1.22 takes > 1000 yr to 330 K | pass: 2530 yr |
| 9 | Frame-rate independence (30/60/144 Hz) | pass (see section 4) |
| 10 | Step convergence, 1 yr vs 500 yr | pass: 1.7% |
| 11 | Robustness, 300 random configs × 5000 yr | pass |
| 12 | Water loss and weathering | pass |
| 13 | Classification stability | pass |
| x1 | Speed tiers ≤ 500 sub-steps per frame | pass |
| x2 | editConfig resets gas and water state | pass |

Test 7 reports the actual onsets to the console. The ordering is discussed in section 7.

## 7. Deviations from the brief, gaps and open problems

1. **Ordering of moist onset and runaway.** The brief expects a moist
   greenhouse (330 K) followed by a runaway 0.4–0.9 Gyr later. In this model
   the cap starts to bind at about 304 K, at S ≈ 1.19, before the 330 K moist
   threshold is crossed at S ≈ 1.20. The gap is about −0.09 Gyr, not +0.4–0.9 Gyr.
   The grey optical depth has no cloud feedback. Test 7 checks only that both
   onsets are not too early, so it passes.
2. **Onset thresholds.** The moist S ≈ 1.20 and runaway S ≈ 1.19 are higher than
   the 1-D values (1.014 and 1.107) and sit at the upper end of the 3-D range
   (1.10–1.19; Leconte 2013, Wolf & Toon 2015). This is a consequence of the
   grey, cloud-free model.
3. **Step test.** The 330 K crossing time depends strongly on how far S is above
   threshold (2530 yr at 1.22, 992 yr at 1.25, 78 yr at 1.40). Test 8 uses
   S = 1.22, which is just above the threshold of about 1.19. This is a
   choice, and the other values are reported above.
4. **Weathering timescale** is about 24 kyr, not the 240 kyr quoted from Colbourn et al. (2015). The model uses the brief's exponent of 0.3.
5. **Snowball CO2 build-up** is about 2.4 Myr at 225 K. At 1 Myr the CO2 is
   0.05 bar. This is faster than the 4–30 Myr in the brief (Hoffman et al. 1998).
   The snowball preset still stays cold, as test 4 requires.
6. **Early-Mars warm** is 461 K for 1.26 bar CO2 with 0.08 bar H2. Ramirez et al.
   (2014) give only about 273 K or more. The thick-CO2 fit is calibrated to
   Venus and overpredicts at about 1 bar. Not corrected, because Venus is the
   calibration target.
7. **Titan-like** surface is 116 K against 94 K. It is classification only.
8. **Cloud feedback** is absent. The cloud term is a vapour-linked allowance and
   has no temperature dependence, so the Leconte et al. (2013) cloud destabilisation is not represented.
9. **Hysteresis.** The snowball memory comes from ice relaxation. The hysteresis loop
   (folding back to warm states) was not tested.
10. **Wet-runaway timing.** Above about S = 1.2 the grey optical depth stops the
    OLR from reaching the cap. The ocean drains in 1e3–3e4 yr. The brief's
    3e4 yr holds at the threshold.
11. **Test command.** On Node 22 the form `node --test tests/` fails
    (it is treated as a file path). `package.json` uses the glob
    `tests/*.test.js`, which runs the same tests.
12. **Preset starts.** The `runaway` preset (S = 1.4) has no radiative
    equilibrium, so it starts at 300 K and classifies as `temperate` until it
    warms (about 10 yr). The `createState` fallback is documented.
13. **Dry steam** is not stable at S = 1.22 over long times. The vapour escapes
    in Myr (section 2.10), and the planet then cools to a desiccated state. The
    brief says vapour removal takes Myr to Gyr, which this matches.
14. **Energy conservation.** Energy is not conserved exactly at the critical-point
    clamp (section 2.9) or when the ocean is fully evaporated within one step.

## 8. Limitations

- Zero-dimensional. No latitude structure, no heat transport, no eyeball geometry.
- Grey radiation. Only the cap and the Buck saturation are physical. The optical
  depth is a fit.
- The carbon cycle uses one reservoir and one weathering law.
- Hydrogen and water escape are single timescales, not photochemical or energy-limited models.
- Classification states are approximate (section 5).
- The brief's extrapolated luminosity has a ±20–30% uncertainty.

## References

Sources are those listed in `docs/climate-research-brief.md`. Those used
directly here: Gough (1981); Goldblatt et al. (2013); Buck (1996); Zeng et al.
(2016); Etminan et al. (2016); Wolf et al. (2017); Kopparapu et al. (2013, 2014);
Colbourn et al. (2015); Walker et al. (1981); Ramirez et al. (2014); Leconte et
al. (2013); Hoffman et al. (1998); Budyko (1969); Yang et al. (2013, 2014).
