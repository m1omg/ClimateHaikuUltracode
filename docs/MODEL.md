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
| `iceFraction` | sea-ice fraction of the open ocean, relaxing toward equilibrium (zero without liquid) |
| `oceanDepthM` | liquid ocean-equivalent depth (m) |
| `waterOED` | total water inventory (m OED); vapour = `waterOED - oceanDepthM` |
| `co2Bar`, `ch4Bar`, `n2Bar`, `o2Bar`, `h2Bar` | gas inventories, bar at Earth gravity |
| `last` | rates from the last step (`netWm2`, `evapWm2`, `carbonRatio`), used for diagnostics |

Configuration fields are `massEM`, `coreMassFraction`, `waterOED_m`,
`landFraction`, `S`, `evolveStar`, `ageGyr`, `rotationDays`, `cloudOffset`,
the five gas inventories, `volcanicTmolYr` and `weatheringFactor`.

Inputs are kept physical by `editConfig` and by the geometry: inventories and
flux are non-negative, and the mass has a floor of 0.01 Earth masses.

## 2. Equations

### 2.1 Stellar flux and luminosity

- Gough (1981): `L/L0 = 1 / (1 + 0.4 (1 - t/4.57))`, t in Gyr. The
  future extrapolation has a stated ±20–30% uncertainty (brief, Game decision 3).
- Effective flux: `S_eff(t) = S * L(age + t) / L(age)` when `evolveStar` is on,
  otherwise `S`. The diagnostic `luminosityRel` reports `S_eff`.
- Absorbed sunlight: `A_abs = (1 - albedo) * S_eff * 1361 / 4` W m^-2.

### 2.2 Albedo

`albedo = land * 0.25 + open * [(1 - f_ice) * a_open + f_ice * 0.62]
          + 0.19 * p_H2O / (p_H2O + 0.001) + rot_cloud(P) + cloudOffset`

- `open = 1 - landFraction`, `a_open = 0.07` with liquid, `0.25` without.
- `f_ice` is the sea-ice fraction when liquid is present, and zero otherwise.
  Dry planets and land-only planets have no ice term.
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
  cannot exceed about 1700 K. The quadratic water term makes OLR fall with
  temperature above about 520 K for a wet planet (section 7, deviation 16).

Earth calibration: Ts = 287.9 K and OLR = 240.1 W m^-2 (target 288 K and 239 W m^-2).

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
- There is no condensation. Vapour that has left the ocean stays in the column
  whatever the temperature. Section 2.9 and section 8 state the consequences.

### 2.7 Thermal balance: mixed layer and deep ocean

Mixed-layer heat capacity from the 10-yr time constant:
`C_mix = 10 yr × 3.3 W m^-2 K^-1 = 1.04e9 J m^-2 K^-1` (3.3 is the feedback
used to size the mixed layer; Game decision 4).

Deep ocean: heat capacity from the liquid column, `C_deep = 4.2e6 J m^-3 K^-1 × oceanDepthM`,
and coupling `K = C_deep / 300 yr`. With no liquid, `K = 0`.

Two-box equations, with a linearised feedback `lam = dOLR/dTs` (≥ 0 in the solve):

`C_mix dTs/dt = A_abs - OLR - K (Ts - Td)`
`C_deep dTd/dt = K (Ts - Td)`

The 2×2 linear system is solved exactly with its two real eigenvalues. Two
passes of linearisation are used: the first is about the start temperature, and
the second about the predicted end temperature. A negative feedback is set to
zero inside the solve. The step controls below bound the linear error.

Evaporation branch. It is chosen once per internal step, from the state's own
flux at the start of the step. If liquid is present, OLR is at the cap
(`g ≥ cap`), and absorbed sunlight exceeds the cap, the surplus
`absorbed - cap` is spent on evaporation and the mixed layer is not heated.
Otherwise the mixed layer takes `absorbed - OLR`. The booked evaporation and the
thermal solve use the same flux. An earlier version chose the branch from the
predicted end temperature, which booked energy the solve did not use.

Critical point. A step that predicts a temperature above `CRITICAL_T` (647.1 K)
is held at `CRITICAL_T`, and the flux surplus there, `absorbed - OLR` at 647.1 K,
is booked as evaporation. Booking from the flux rather than from the overshoot
of the linear solve makes the drain rate independent of the step length.

Step control (`substep`). An internal step is shortened, by halving down to
0.5 yr, while either:
- the predicted surface change exceeds 3 K (`MAX_DT_K`), or
- evaporation in the step would remove more than half the remaining liquid.

Trial results are applied only once accepted. The temperature after a step is
floored at 2 K (`TS_FLOOR`), a numerical guard that the physics does not reach.
Internal steps never exceed 5000 yr. A negative feedback (possible where OLR
falls with Ts) limits the step to `2 C_mix / |lam|`.

Energy accounting is consistent within a step, with two exceptions. The first
is the crossing of the critical point inside a step, where the storage in the
overshoot is not booked. The second is an ocean that is fully evaporated within
one step, where energy beyond the remaining liquid is not carried over (section 7).

### 2.8 Sea ice

- Equilibrium: `f_eq(Ts) = 1 / (1 + exp((Ts - 269)/2.5))`, a transition band
  of about 263–275 K (brief Section 4, Budyko–Sellers form). It applies only
  where liquid is present; without liquid the ice fraction is zero.
- Relaxation: `f ← f_eq + (f - f_eq) exp(-dt/100 yr)`, exact, with τ = 100 yr (brief Game decision 4).
- Start state: `createState` sets `f = f_eq(Ts0)` for a wet planet, so the start
  is in radiative balance with the ice albedo it uses.
- Hysteresis. The cold stable branch is held by the ice–albedo feedback, which
  is a static fold in the equilibrium curve, not an effect of ice lag. Earth
  gases with CO2 held at 4.2e-4 bar (physics review, rerun with this code):
  - The warm (temperate) branch exists only for S ≥ 0.9075.
  - A cold start is frozen (hard snowball) for every S from 0.905 to 1.25, and its
    surface temperature rises from 235 K to 260 K over that range. The frozen
    state is held by the ice albedo (0.62), so it persists even where it is the
    only equilibrium.
  - At S = 1.27 the cold start jumps to dry steam at about 1420 K with no ocean.
  - A warm start falls to 277 K at S = 0.91 (temperate, ice 0.03) and to a
    frozen state at S = 0.905. The loop is entered near 0.906 S0 and left near
    1.26 S0, with the exit going to dry runaway rather than to temperate.
  - With CO2 free to evolve, a cold start melts by volcanic build-up. The time
    to leave hard snowball from 230 K was 1.9 Myr at S = 0.72, 1.0 Myr at 0.9
    and 0.6 Myr at 1.0 (physics review, not rerun after the final changes).
  - The snowball preset is frozen at 1 Myr and stays in the range 222–247 K.
    Test 4 passes only because the state is hard snowball or slushball.

### 2.9 Runaway and evaporation

- Wet runaway label (`flags.runawayActive`): liquid is present and either
  absorbed sunlight exceeds the cap by more than 1 W m^-2 (no equilibrium
  exists), or OLR is at the cap with absorbed sunlight within 1 W m^-2 of it
  (the cap-limited edge). The tolerance keeps the label from flipping on tiny
  differences at the neutral equilibrium.
- Liquid is present while absorbed sunlight is above the cap, and the planet
  heats toward the cap. Once OLR reaches the cap, the surplus evaporates (section 2.7).
  Where the grey OLR never reaches the cap, the planet heats to the critical
  point and the critical-point clamp evaporates the ocean.
- Energy per metre of ocean: `3.96e9 J m^-2` (latent 2.5e9 + sensible 1.46e9,
  so 2.7 km is 1.07e13 J m^-2, the brief's value). A 2.7 km ocean evaporates in
  `1.07e13 / 10 W m^-2 = 3.4e4 yr` at a 10 W m^-2 surplus (brief Section 3).
- Above the critical point (647.1 K) liquid cannot exist. Warming beyond it is
  spent on evaporation and the surface is held at 647.1 K (section 2.7).
- Vapour from evaporation stays in the column and does not condense back into
  the ocean. This is a documented simplification with two consequences, both
  listed in section 7 (deviation 15). Water that leaves the ocean at high
  temperature cannot return when the planet cools, so dry steam persists, and
  a cold planet can hold tens to hundreds of bar of vapour. The brief's
  reversible dry runaway (section 2 of the brief) is not reproduced.

### 2.10 Water escape (moist greenhouse)

- Stratospheric water fraction: `f = clamp(3e-3 exp((Ts - 355)/12), 1e-6, 0.5)`.
  This rises steeply above about 320 K (brief Section 4).
- Escape time: `tau_H = 1 Gyr × (3e-3 / f)`, scaling as 1/f (brief Game decision 2).
  At 355 K it is 1 Gyr. At 400 K it is about 25 Myr, and at 1600 K steam it is
  about 6 Myr (f capped at 0.5), so steam loses its water within Myr.
- Liquid and total water both decay at this rate. On the Earth ramp this escape,
  not a wet runaway, drains the ocean once the planet is in the moist state
  (section 7, deviation 1).

### 2.11 Carbon cycle

`dp_CO2/dt = F_out - F_w`, with `F_w = F_out (p/p_ref)^0.3 exp((Ts' - 288)/13.7) landF weatheringFactor`,
`landF = clamp(landFraction / 0.29, 0, 3)`, and `Ts' = min(Ts, 330 K)`.

- `F_out = 58e-9 bar yr^-1 × (volcanicTmolYr / 7)`, i.e. 7 Tmol C yr^-1 is 58
  bar per Gyr (brief Section 5).
- `p_ref = 4.2e-4 bar`, so Earth is at balance at 288 K.
- Weathering needs liquid water. Deviation: the brief formula has no liquid
  factor, but without liquid there is no weathering.
- Temperature cap (deviation). The WHK exponential is held at its 330 K value
  above 330 K. Without the cap, weathering at 560 K was about 5e8 times the
  present rate and removed the atmosphere's CO2 in one 5000-yr step. The brief
  gives no upper validity for the fit. The cap is a game choice.
- Land scaling (deviation). The brief says weathering is insensitive to land
  above 0.01 (Abbot et al. 2012). This model scales it linearly with land up to
  three times Earth's land fraction. The linear scaling was not previously
  documented. It is kept, because a saturating law would give the 0.5% waterworld
  about half of Earth's weathering, against its "weathering is nearly absent"
  description. This needs a decision (section 7, deviation 17).
- The exponential is clamped to ±50 in the exponent.
- Integration: the `p^0.3` term is linearised about the start of the step and
  integrated exactly. CO2 never goes negative.
- Diagnostic `carbonRatio = F_w / F_out`. It is 1 at balance. The start value is
  computed for the start temperature and composition.

Weathering e-folding timescale: `turnover / 0.3 ≈ 7 kyr / 0.3 ≈ 24 kyr`. The
brief quotes 240 kyr (Colbourn et al. 2015). This is a deviation: the model uses
the brief's WHK exponent, which gives a shorter timescale. Reported as a gap.

### 2.12 Hydrogen

`H2` decays with `tau = 1 Gyr` (game value, documented). `N2` and `O2` are inert for escape.

### 2.13 Clock

`stepSizeForSpeed(yr/s)` is a pure function of speed. It is the largest tier
threshold at or below the speed:

| Speed (yr/s) from | Sub-step (yr) | Clock steps per 60 Hz frame at this tier |
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

Each Clock step is one or more internal steps (section 2.7). `step` splits a
Clock step into pieces of at most 5000 yr and shortens them further where the
state changes fast. Work per frame therefore depends on the state, and the
table counts Clock steps only.

The Clock accumulates simulated years from the wall-clock delta, and runs at
most 2000 whole Clock steps per call. Time it cannot run in one call stays in
`clock.acc`, so nothing is discarded. The delta is clamped to 0.25 s per call.

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
| Weathering temperature cap | 330 K | game choice; the fit is not calibrated above (section 2.11) |
| F_out | 58 bar Gyr^-1 at 7 Tmol yr^-1 | brief Section 5 |
| H2 escape | 1 Gyr | documented choice |
| Rotation cloud | 0.12 max, 5–20 d | game approximation (Game decision 7) |
| Rapid factor | 10% at P → 0 | game approximation |
| Max predicted change per step | 3 K | numerical trust limit (section 2.7) |
| Minimum internal step | 0.5 yr | numerical limit (section 2.7) |
| Temperature floor | 2 K | numerical guard |
| Runaway label tolerance | 1 W m^-2 | classification tolerance (section 2.9) |
| Minimum mass | 0.01 M_E | keeps the radius law finite |

## 4. Calibration results

Measured with the final code (`npm test` output and direct runs).

| Target | Result | Status |
|---|---|---|
| Earth Ts (288 K) | 287.9 K | within tolerance |
| Earth OLR (239 W m^-2) | 240.1 W m^-2 | within tolerance |
| Earth albedo (0.294) | 0.2943 | |
| Mars Ts (214 K mean) | 220.0 K, 0.0065 bar | within 200–225 K |
| Venus Ts (737 K) | 737.9 K, 95.1 bar total | within 700–780 K |
| Runaway onset, Gough ramp (test 7) | 1.843 Gyr (label first set when the cap binds, S ≈ 1.19) | see section 7 |
| Moist onset, Ts 330 K, Gough ramp (test 7) | 1.935 Gyr (S ≈ 1.20) | see section 7 |
| Moist onset, quasi-static S ramp (1e-6 per yr) | S = 1.207 | |
| Step S = 1.22 (just above threshold): 288 → 330 K (test 8) | 2516 yr (1-yr steps) | |
| Step S = 1.25: 288 → 330 K | 994 yr | |
| Step S = 1.40: 288 → 330 K | 82 yr | |
| S = 1.22 from a 300 K start: 330 K reached | 2.2e3 yr | |
| S = 1.22 from a 300 K start: ocean gone | 3.6e4 yr at about 8 W m^-2 surplus | brief 1e4–1e5 yr |
| S = 1.22 from a 300 K start: Ts at 200 kyr | 1421 K, dry_runaway | brief 1400–1500 K |
| Snowball S = 0.72, 1 Myr | Ts 222.1–247.0 K, hard_snowball, CO2 0.053 bar at 1 Myr | |
| Warm config (S 1.17) water loss | 2700 → 2669 m in 1 Gyr | |
| CO2 after 1 Gyr, S 1.0 vs 1.17 (test 12) | 4.29e-4 vs 1.60e-5 bar | warmer = more weathering |
| Speed-tier dependence of dry-out (S 1.4, 2700 m) | 3800 yr (dt 100), about 4000 yr (dt 500 and 2000) | within the sampling of the check |
| Ts after 2 Myr, same case | 1267–1268 K for dt ≤ 2000 | |

Frame-rate test (speed 1000 yr/s, sub-step 5 yr, 10 s wall): 30 Hz gives
t = 10000.00 yr and Ts = 287.9018 K; 60 Hz gives the same; 144 Hz gives
t = 9995.00 yr and Ts = 287.9018 K. The difference is one sub-step, and Ts agrees to well under 0.01 K.

Convergence test (ramp of 1e-6 S/yr to moist onset): 1-yr sub-step gives
209 577 yr, 500-yr sub-step gives 206 500 yr. Difference 1.5%, inside 5%.

Bounds sweep (2800 configurations: 8 S × 7 CO2 × 5 water × 5 mass × 2 rotation):
over 1 Myr at 5000-yr steps, 20 kyr at 50-yr steps, and 20 Myr at 5000-yr steps,
no Ts left [2, 3000] K, no NaN or infinity, no negative pressure, CO2 or water,
and no time lost from the requested step.

## 5. Classification

`classify(diagnose)` is a pure function. Rules, first match wins:

1. no liquid, Ts < 200 K, CH4 ≥ 0.01 bar, N2 ≥ 0.5 bar → `titan_like`
2. no liquid, steam ≥ 0.5 bar, Ts ≥ 400 K → `hadean_steam` if CO2 ≥ 10 bar, else `dry_runaway`
3. no liquid, CO2 ≥ 10 bar, Ts ≥ 500 K → `venus_like`
4. liquid and runaway label (section 2.9) → `wet_runaway`
5. liquid, Ts ≥ 330 K → `moist_greenhouse`
6. liquid, ice ≥ 0.9 → `hard_snowball`; ice ≥ 0.3 → `slushball`; 0.05 ≤ ice < 0.3 and Ts < 275 K → `eyeball`
7. liquid, open-ocean fraction ≥ 0.98 → `waterworld`
8. liquid, open-ocean fraction ≤ 0.5 (land ≥ 0.5) and depth < 1000 m → `desert`; otherwise `temperate`
9. no liquid, Ts ≥ 273 K: CO2 ≥ 0.5 bar and H2 ≥ 0.01 bar → `early_mars_warm`; else `desert`
10. otherwise `mars_like`

Slow rotators (P ≥ 20 d) get an extra clause in the summary text.

Thresholds and hysteresis. The rules are pure functions of the state, so a
state that sits on a threshold can flip with the tiny numerical differences
of a step. Two steps keep this out of the label: the runaway label has a
1 W m^-2 tolerance (section 2.9), and the evaporation branch no longer depends
on the predicted temperature, so a planet pinned at the cap does not alternate
between wet runaway and moist greenhouse. On the sweep grid, wet-runaway and
moist-greenhouse flips are gone. The remaining flips are one-way threshold
crossings. Labels carry no memory, so a planet that drifts back across a
boundary is relabelled.

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

`npm test` runs `node --test tests/*.test.js`. `node --test tests/` runs the same
suite: a small entry file, `tests/index.js`, loads the test module, because on
Node 22 a directory argument is otherwise read as a module path. Results: 22 of 22 pass.
Thirteen are the brief's tests, and nine are extra checks.

| # | Test | Result |
|---|---|---|
| 1 | Earth Ts, OLR, albedo, state | pass: 287.9 K, 240.1 W m^-2, 0.294, temperate |
| 2 | Mars Ts and pressure, state | pass: 220.0 K, 0.0065 bar, mars_like |
| 3 | Venus Ts, state | pass: 737.9 K, venus_like |
| 4 | Snowball cold for 1 Myr at 1000 yr | pass: hard_snowball or slushball throughout |
| 5 | Gough law values | pass |
| 6 | Mass-radius, 1 M_E | pass: R 1.0007, g 0.9986 |
| 7 | Gradualness (Gough Earth) | pass: moist onset 1.93 Gyr, runaway onset 1.84 Gyr |
| 8 | Step S = 1.22 takes > 1000 yr to 330 K | pass: 2516 yr |
| 9 | Frame-rate independence (30/60/144 Hz) | pass (see section 4) |
| 10 | Step convergence, 1 yr vs 500 yr | pass: 1.5% |
| 11 | Robustness, 300 random configs × 5000 yr | pass |
| 12 | Water loss and weathering | pass |
| 13 | Classification stability | pass |
| x1 | Speed tiers ≤ 500 Clock steps per frame | pass |
| x2 | editConfig resets gas and water state | pass |
| x3 | Surface temperature physical at a 5000-yr step (defect repro) | pass |
| x4 | `step` advances the requested time | pass |
| x5 | No wet-runaway/moist alternation at the cap | pass |
| x6 | No sea ice without liquid | pass |
| x7 | Snowball preset starts in radiative balance | pass |
| x8 | Non-physical inputs stay finite | pass |
| x9 | Clock keeps time it cannot run in one call | pass |

Test 7 reports the actual onsets to the console. Test 8 uses S = 1.22, just
above the label threshold.

## 7. Deviations from the brief, gaps and open problems

1. **Ordering of moist onset and runaway.** The brief expects a moist
   greenhouse (330 K) followed by a runaway 0.4–0.9 Gyr later. In this model
   the cap starts to bind first, at S ≈ 1.19 (1.84 Gyr), and the 330 K moist
   threshold is crossed at S ≈ 1.20 (1.93 Gyr). The gap is about −0.09 Gyr, not
   +0.4–0.9 Gyr. On the Earth ramp the planet then sits on the cap with absorbed
   sunlight equal to it. The moist state drains the ocean by escape at about
   400 K (section 2.10), and then becomes dry runaway. No wet runaway with an
   evaporating ocean is seen on this path. The grey optical depth has no cloud
   feedback. Test 7 checks only that both onsets are not too early.
2. **Onset thresholds.** The moist S ≈ 1.20 and runaway S ≈ 1.19 are higher than
   the 1-D values (1.014 and 1.107) and sit at the upper end of the 3-D range
   (1.10–1.19; Leconte 2013, Wolf & Toon 2015). This is a consequence of the
   grey, cloud-free model.
3. **Step test.** The 330 K crossing time depends strongly on how far S is above
   threshold (2516 yr at 1.22, 994 yr at 1.25, 82 yr at 1.40). Test 8
   uses S = 1.22, which is just above the threshold of about 1.19. This is a
   choice, and the other values are reported above.
4. **Weathering timescale** is about 24 kyr, not the 240 kyr quoted from Colbourn et al. (2015). The model uses the brief's exponent of 0.3.
5. **Snowball CO2 build-up** is about 0.05 bar at 1 Myr. The brief's build-up is 4–30 Myr (Hoffman et al. 1998), so the model is faster. The snowball preset still stays cold, as test 4 requires.
6. **Early-Mars warm** is 461 K for 1.26 bar CO2 with 0.08 bar H2. Ramirez et al.
   (2014) give only about 273 K or more. The thick-CO2 fit is calibrated to
   Venus and overpredicts at about 1 bar. Not corrected, because Venus is the
   calibration target.
7. **Titan-like** surface is 116 K against 94 K. It is classification only.
8. **Cloud feedback** is absent. The cloud term is a vapour-linked allowance and
   has no temperature dependence, so the Leconte et al. (2013) cloud destabilisation is not represented.
9. **Hysteresis.** The loop is a static fold of the ice–albedo feedback (section
   2.8). The earlier note attributing it to ice lag was wrong, and the loop was
   untested. Section 2.8 gives the measured fold and the window (about 0.906 to
   1.26 S0). Only the dynamic and pinned-CO2 runs are measured. A quasi-static
   test is not in the suite.
10. **Wet-runaway timing.** Above about S = 1.2 the grey optical depth stops the
    OLR from reaching the cap in some configurations. The planet then heats
    to the critical point, where the critical-point clamp evaporates the ocean.
    The ocean drains in 1e3–4e3 yr, and the drain no longer depends on the
    speed tier (section 2.7). The brief's 3e4 yr is the evaporation time at
    10 W m^-2, and the model's preset is at a larger surplus.
11. **Test command.** `node --test tests/` runs through `tests/index.js`
    (section 6). `npm test` runs the same suite through the `tests/*.test.js` glob.
12. **Preset starts.** The `runaway` preset (S = 1.4) has no radiative
    equilibrium. It starts at 300 K and is labelled `wet_runaway` at once, because
    absorbed sunlight exceeds the cap. `createState` starts a planet with
    liquid at the warmest stable equilibrium. For Earth gases at S ≈ 1.22 the
    only equilibrium is frozen, so a reset there starts frozen (section 2.8).
13. **Dry steam** persists in this model. The steam is not returned to the ocean
    when the planet cools (deviation 15). The vapour is lost to escape only at
    the escape rate (section 2.10). From 906 K at S = 0.3 with 2700 m of water, the
    model reaches 862 K after 2 Myr, still at 190 bar.
14. **Energy conservation.** Energy is not conserved exactly at the crossing of
    the critical point within a step (section 2.7), or when an ocean is fully
    evaporated within one step. The surplus beyond the remaining liquid is
    dropped.
15. **No condensation (vapour trap).** Water in the atmosphere does not condense
    back into the ocean. Two consequences: (a) water that has left the ocean
    stays in the air when the planet cools. At 250 K with 1000 m as vapour the
    model holds 98 bar, where saturation is about 1.6e-3 bar. The Earth preset at
    S = 0.8 with 1000 m as vapour reaches 1102 K (dry runaway, 189 bar) after 2 Myr,
    where the intact ocean gives 238.6 K. (b) Dry steam cools only slowly: from
    906 K at S = 0.3 with 2700 m, it reaches 862 K after 2 Myr, at 190 bar. A
    condensation or rain-out law is the fix. It changes the wet-runaway
    calibration, so it needs a design decision and is not made here.
16. **OLR falls with temperature above about 520 K for a wet planet.** The
    water term `0.02 p^2` grows faster than `sigma T^4` as the saturation
    vapour rises. For Earth gases with liquid the grey OLR is 282 W m^-2 up to
    about 520 K, then 257 at 550 K, 140 at 600 K and 86 at 643 K, and it rises
    again above about 650 K. The fall creates a second, unstable crossing with
    absorbed sunlight, which the energy chart shows. Between the crossings the
    planet heats to the critical point. A physical OLR would not fall with
    temperature. The fix would recalibrate the water optical depth, so it is not made here.
17. **Weathering scales linearly with land** up to three times Earth's land
    fraction (section 2.11). The brief says it is insensitive above 0.01 land.
    Saturating it would give the 0.5% waterworld about half of Earth's weathering,
    which conflicts with its "weathering is nearly absent" description. Needs a decision.
18. **Speed-tier dependence** remains at the resolution of the internal step.
    Dry-out and the 2 Myr endpoint agree across tiers within about 1% (section 4).

## 8. Limitations

- Zero-dimensional. No latitude structure, no heat transport, no eyeball geometry.
- Grey radiation. Only the cap and the Buck saturation are physical. The optical
  depth is a fit, and its water term gives the OLR dip in deviation 16.
- No condensation of water vapour (deviation 15).
- The carbon cycle uses one reservoir and one weathering law, with the
  temperature cap and linear land scaling of section 2.11.
- Hydrogen and water escape are single timescales, not photochemical or energy-limited models.
- Classification states are approximate (section 5).
- The brief's extrapolated luminosity has a ±20–30% uncertainty.

## References

Sources are those listed in `docs/climate-research-brief.md`. Those used
directly here: Gough (1981); Goldblatt et al. (2013); Buck (1996); Zeng et al.
(2016); Etminan et al. (2016); Wolf et al. (2017); Kopparapu et al. (2013, 2014);
Colbourn et al. (2015); Walker et al. (1981); Ramirez et al. (2014); Leconte et
al. (2013); Hoffman et al. (1998); Budyko (1969); Yang et al. (2013, 2014).
