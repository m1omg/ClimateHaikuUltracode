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
| `escapedOED` | water lost by escape so far (m OED). `waterOED + escapedOED` is the inventory, the water ledger tested in R1c and R1d |
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
| H2O over liquid | `2.51 p^0.3` for `p ≤ 0.01 bar`; `2.51 × 0.01^0.3 × (p/0.01)^0.47` for `0.01 < p ≤ 0.1 bar`; held at its 0.1 bar value above (section 2.3.1) | Calibrated to Earth (288 K, 240 W m^-2) and to the moist-first ordering (section 2.3.1). |
| H2O without liquid (steam) | `2.51 p^0.3 + 0.02 p^2`, with `p` capped at 300 bar | Steam branch (see below). |
| H2O vapour column over liquid | `2.51 p_col^0.3 + 0.02 p_col^2`, where `p_col` is the vapour left by evaporation (`waterOED - oceanDepthM`), capped at 300 bar | Zero for a full ocean. Its opacity is set by the column, not by temperature. |

- `p` is the partial pressure: inventory × gravity factor (section 2.5).
- Water partial pressure (section 2.6): `p_H2O`.
- The water opacity is capped at 300 bar, so a very deep steam atmosphere
  cannot exceed about 1700 K. Over liquid, the water opacity has no quadratic
  term and is held above 0.1 bar, so OLR does not fall with temperature
  (section 2.3.1, deviation 16, resolved).

Earth calibration: Ts = 287.9 K and OLR = 240.1 W m^-2 (target 288 K and 239 W m^-2).

### 2.3.1 Water opacity over liquid, and the moist-first ordering

Over an ocean the vapour pressure follows saturation, which rises by about
0.05 per K near 330 K. Two requirements constrain the opacity that this creates.

- **Monotone OLR.** If the optical depth rises with `p` faster than `p^0.46` (for
  example with the `p^2` steam term, or a single power above about 0.45), the
  grey OLR falls with temperature near 340–390 K for an ocean planet. The old model
  dipped by 15 W m^-2 near 549 K this way (deviation 16). The energy chart then had
  a second balance point.
- **Moist first.** For the 330 K moist threshold to come before the cap binds, the
  grey OLR at 330 K must be below 282 W m^-2 at fixed CO2. That needs a vapour
  opacity that rises from 288 K to 330 K by a factor of about 3, while the Earth OLR
  stays at 240 W m^-2.

The model meets both with a broken power law over liquid:
`p^0.3` (the original law) up to the Earth surface vapour pressure, 0.01 bar; `p^0.47`
above it; and a hold at 0.1 bar, the value reached at about 330 K for an Earth ocean.
The hold keeps the OLR from falling. Monotonicity is tested on a 3001-point grid over
150–2000 K for Earth gases, steam and thick CO2 (test R3).

Measured results (Earth gases, liquid, CO2 fixed at 4.2e-4 bar):
- grey OLR at 330 K = 265.1 W m^-2 (before 321.2, uncapped);
- the cap binds at about 340 K, where the flux balance gives S ≈ 1.20.

With the carbon cycle on, weathering draws CO2 down during the ramp (to about 1.5e-8 bar
by the moist onset, section 2.11). Since less CO2 raises the grey OLR at 330 K, the ramp
moist onset is S = 1.167. The runaway label fires at S = 1.198 (section 4).

Other exponents were tried: a single power law with 0.45 gave a dip of 0.27 W m^-2 near
384 K, and 0.48 gave a dip of 0.6 W m^-2 near 375 K. With exponent 0.42 the 330 K
margin falls to 1 W m^-2. The broken law with a hold at 0.1 bar is the best of those
checked. It is still a fit, and its margins are small (section 7, deviation 1).

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
- Condensation (section 2.9). Vapour above the saturation pressure at the
  surface temperature condenses into the ocean below the critical point (647.1 K).
  Water is conserved (section 2.9).

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
A third exception is the critical-point cap on condensation (section 2.9), where
the latent heat that would take the surface past 647.1 K is not booked.

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
  - **Superseded.** The pinned-CO2 window in the previous version of this section
    (frozen from S 0.905 to 1.25, loop left near 1.26 S0) was measured before the
    repair round and has not been rerun. It is not a current result.
  - Re-measured in this round, with CO2 free to evolve (`createState` warm start, and a
    cold start at 235 K run for 1 Myr at 1000-yr steps):

    | S | warm start | cold start after 1 Myr |
    |---|---|---|
    | 0.90 | hard snowball, 235 K | temperate, 312 K (CO2 build-up melts it) |
    | 0.95 | temperate, 283 K | temperate, 285 K |
    | 1.00 | temperate, 288 K | temperate, 288 K |
    | 1.10 | temperate, 309 K | temperate, 299 K |
    | 1.20 | wet runaway at the cap, 336 K | wet runaway at the cap, 333 K |
    | 1.25–1.30 | none (wet runaway at 300 K) | dry runaway, about 1340–1350 K |

  - The cold snowball is not held at S = 0.9 once CO2 can build up. The dry-runaway
    temperature at S = 1.25–1.4 is 1284–1321 K after 1.5 Myr, from steam that has lost
    about 22% of its water (2700 to 2103 m) to escape. This value is unchanged from before.
  - The snowball preset is frozen at 1 Myr and stays in the range 222–247 K.
    Test 4 passes only because the state is hard snowball or slushball.

### 2.9 Runaway and evaporation

- Wet runaway label (`flags.runawayActive`): liquid is present and either
  absorbed sunlight exceeds the cap by more than 1 W m^-2 (no equilibrium
  exists), or the grey OLR is within 1 W m^-2 of the cap and absorbed sunlight is
  within 1 W m^-2 of it (the cap-limited edge). The tolerance keeps the label from
  flipping on tiny differences at the neutral equilibrium. Applying it to the grey
  OLR as well as the absorbed flux cut the label changes on the Gough ramp to 14 in
  total (deviation 20).
- Liquid is present while absorbed sunlight is above the cap, and the planet
  heats toward the cap. Once OLR reaches the cap, the surplus evaporates (section 2.7).
  Where the grey OLR never reaches the cap, the planet heats to the critical
  point and the critical-point clamp evaporates the ocean.
- Energy per metre of ocean: `3.96e9 J m^-2` (latent 2.5e9 + sensible 1.46e9,
  so 2.7 km is 1.07e13 J m^-2, the brief's value). A 2.7 km ocean evaporates in
  `1.07e13 / 10 W m^-2 = 3.4e4 yr` at a 10 W m^-2 surplus (brief Section 3).
- Above the critical point (647.1 K) liquid cannot exist. Warming beyond it is
  spent on evaporation and the surface is held at 647.1 K (section 2.7).
- **Condensation (deviation 15, resolved).** Vapour above the saturation pressure
  at the surface temperature, `p_H2O > e_s(Ts)`, condenses into the ocean. Below the
  critical point the condensate `m` (m OED) and the new surface temperature satisfy

  `p_H2O - m × bg = e_s(Ts + dT(m))`, with `dT(m) = m × 2.5e9 J m^-2 / (C_mix + 4.2e6 × (L + m))`

  where `bg = 0.0981 gf` bar per metre of water column and `L` is the liquid depth.
  The left side falls and the right side rises with `m`, so bisection gives one root.
  The latent heat `2.5e9 J m^-2` per metre (the latent part of 3.96e9) warms the
  surface through the mixed-layer and ocean heat capacity. It is not a separate
  flux, so the surface is not cooled by the condensate and the energy booking is
  consistent with the step. A root above 647.1 K is capped there, and the
  remaining vapour stays in the air. Condensation only moves water between vapour
  and liquid, so the inventory is unchanged (ledger, section 1).
- Consequences. Vapour that has left the ocean returns to it when the planet cools
  below the saturation curve, so an ocean can reform from a dry state (R1b). Cooling
  steam is slow, because hydrogen escape sets the pace (section 2.10).
- Ocean area. Where ocean area exists (land below 1), condensate creates the
  ocean when none was present, and the ice fraction is set to its equilibrium value
  (R1b). A planet with no ocean area (land = 1) has nowhere to condense, so its
  vapour stays in the air. None of the presets is in this case with vapour above
  saturation.
- Saturation uses the Buck (1996) fit clamped to 370 °C, which gives 147 bar at
  647 K where the real value is about 220 bar. This is a documented limit (section 7).

### 2.10 Water escape (moist greenhouse)

- Stratospheric water fraction: `f = clamp(3e-3 exp((Ts - 355)/12), 1e-6, 0.5)`.
  This rises steeply above about 320 K (brief Section 4).
- Escape time: `tau_H = 1 Gyr × (3e-3 / f)`, scaling as 1/f (brief Game decision 2).
  At 355 K it is 1 Gyr. At 400 K it is about 25 Myr, and at 1600 K steam it is
  about 6 Myr (f capped at 0.5), so steam loses its water within Myr.
- Liquid and total water both decay at this rate. Escape is slow where the
  planet is held at the cap near 333–340 K: f ≈ 6e-4 there, so τ_H ≈ 5 Gyr.
  On the Earth ramp, evaporation at the cap drains the ocean in about 60 Myr, not escape
  (section 7, deviation 1).

### 2.11 Carbon cycle

`dp_CO2/dt = F_out - F_w`, with `F_w = F_out (p/p_ref)^0.3 exp((Ts' - 288)/13.7) landF weatheringFactor`,
`landF = min(1, landFraction / 0.01)`, and `Ts' = min(Ts, 330 K)`.

- `F_out = 58e-9 bar yr^-1 × (volcanicTmolYr / 7)`, i.e. 7 Tmol C yr^-1 is 58
  bar per Gyr (brief Section 5).
- `p_ref = 4.2e-4 bar`, so Earth is at balance at 288 K.
- Weathering needs liquid water. Deviation: the brief formula has no liquid
  factor, but without liquid there is no weathering.
- Temperature cap (deviation). The WHK exponential is held at its 330 K value
  above 330 K. Without the cap, weathering at 560 K was about 5e8 times the
  present rate and removed the atmosphere's CO2 in one 5000-yr step. The brief
  gives no upper validity for the fit. The cap is a game choice.
- Land factor (resolved deviation 17). Following Abbot et al. (2012), weathering
  saturates above 1% land: `landF = min(1, landFraction / 0.01)`. A 0.05 and a 0.29
  land fraction give identical weathering (test R4). Earth's land factor is 1 under
  both the old and the new law, so the Earth carbon balance is unchanged. The
  weathering constant needed no recalibration. A planet with zero land has no
  weathering. A 1% land world (the waterworld preset) weathers at the Earth rate, and
  its CO2 falls from 2.2e-2 bar to 6.6e-8 bar in 1 Gyr (before: the linear law gave
  0.034 of Earth's rate, so CO2 stayed high). The waterworld preset text in
  `js/model.js` was changed to match.
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
| H2O over liquid | 2.51 p^0.3 to a 0.01 bar knee, then p^0.47, held at 0.1 bar | Earth 287.9 K; moist-first ordering (section 2.3.1) |
| H2O steam (no liquid) | 2.51 p^0.3 + 0.02 p^2, p ≤ 300 bar | dry runaway 1280–1320 K at S 1.25–1.4 |
| Latent heat of condensation | 2.5e9 J m^-2 per m | latent part of the 3.96e9 J m^-2 per m (brief Section 3.3) |
| Land saturation | 1% land (weathering) | Abbot et al. (2012), replaces the linear land scale |
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
| Runaway label tolerance | 1 W m^-2 | classification tolerance on the cap test and absorbed flux (section 2.9) |
| Minimum mass | 0.01 M_E | keeps the radius law finite |

## 4. Calibration results

Before is the HEAD commit (`git show HEAD:js/model.js`). After is this repair round.
Values are from `npm test` console output and direct runs.

| Target | Before | After | Status |
|---|---|---|---|
| Earth Ts (288 K) | 287.88 K | 287.88 K | within tolerance |
| Earth OLR (239–242 W m^-2) | 240.10 | 240.10 | within tolerance |
| Earth albedo (0.294) | 0.2943 | 0.2943 | |
| Mars Ts (214–225 K), pressure | 219.98 K, 0.0065 bar | 219.98 K, 0.0065 bar | within range |
| Venus Ts (737 ± 10 K) | 737.86 K, 95.1 bar | 737.86 K, 95.1 bar | within range |
| Grey OLR at 330 K, Earth gases, liquid, CO2 fixed | 321 W m^-2 (uncapped) | 265.1 W m^-2 (cap 282) | R2 |
| Cap binds, Earth gases, liquid, CO2 fixed | about 304 K (review figure) | about 340 K, S ≈ 1.20 | R2 |
| Moist onset, S ramp 1e-6 per yr, carbon cycle on | S = 1.206 at 206.5 kyr | S = 1.167 at 167.5 kyr | R2a: moist first |
| Runaway onset (label), same ramp | S = 1.1925 at 193 kyr | S = 1.198 at 198.5 kyr | R2a |
| Gough ramp (test 7): moist onset, Ts > 330 K | 1.935 Gyr | 1.594 Gyr | |
| Gough ramp (test 7): runaway label | 1.843 Gyr | 1.887 Gyr | moist first (gap 0.29 Gyr) |
| Step S = 1.22: 288 → 330 K | 2516 yr | 499 yr | |
| Step S = 1.18: 288 → 330 K (test 8) | not measured | 1492 yr | test 8 setup |
| Step S = 1.19: 288 → 330 K | not measured | 1059 yr | |
| Step S = 1.25: 288 → 330 K | 994 yr | 304 yr | |
| Step S = 1.40: 288 → 330 K | 82 yr | 37 yr | |
| S = 1.22 from 300 K: 330 K reached | 2.2e3 yr | 300 yr | |
| S = 1.22 from 300 K: ocean gone | 3.6e4 yr at about 8 W m^-2 surplus | 1.9e5 yr at about 4 W m^-2 surplus (brief 1e4–1e5 yr) | |
| S = 1.22 from 300 K: Ts at 200 kyr | 1421 K, dry_runaway | 1423 K, dry_runaway (brief 1400–1500 K) | |
| Dry steam, S = 0.3, from 906 K, 2700 m: Ts and vapour at 2 Myr | 862.8 K, 1935 m, dry | 862.8 K, 1935 m, dry (unchanged) | |
| Dry steam: Ts below 647 K | not reached in 25 Myr | 5.6 Myr | R1a |
| Dry steam: liquid returns | not reached in 25 Myr | 6.9 Myr, Ts 586 K | R1a; the 2 Myr target is not met |
| Dry-runaway steam, S = 1.25–1.4, 1.5 Myr | 1284–1321 K | 1284–1321 K (unchanged) | |
| Earth weathering factor at 288 K | 1 | 1 | R4 |
| Weathering, land 0.05 vs 0.29 | ratio 0.172 | identical, ratio 1.000 | R4 |
| Waterworld (1% land): CO2 and Ts after 1 Gyr | 2.18e-2 bar, 317.9 K | 6.6e-8 bar, 324.0 K | |
| Warm config (S 1.17): water after 1 Gyr | 2700 → 2669 m | 2700 → 1919 m (now moist greenhouse) | |
| CO2 after 1 Gyr, S 1.0 vs 1.17 (test 12) | 4.29e-4 vs 1.60e-5 bar | 4.29e-4 vs 1.54e-8 bar | warmer = more weathering |
| OLR slope over 150–2000 K, Earth gases with liquid | falls by 15.2 W m^-2 per grid step at 549 K | never falls | R3 |
| Snowball S = 0.72, 1 Myr | Ts 222.1–247.0 K, hard_snowball, CO2 0.053 bar | unchanged | |
| Speed-tier dry-out (S 1.4, 2700 m), dt 100 yr | 3800 yr | 17 000 yr | dt 500 and 2000 not rerun |
| Ts after 2 Myr, S 1.4 case | 1268.0 K | 1268.2 K | |
| Water ledger over 100 kyr (R1c, R1d) | not defined | exact, error 0 | |

Frame-rate test (test 9, speed 1000 yr/s, sub-step 5 yr, 10 s wall): 30 Hz gives
t = 10000.00 yr and Ts = 287.9017 K; 60 Hz gives the same; 144 Hz gives
t = 9995.00 yr and Ts = 287.9017 K. The difference is one sub-step.

Convergence test (test 10, ramp of 1e-6 S/yr to moist onset): 1-yr sub-step gives
166 709 yr, 500-yr sub-step gives 167 500 yr. Difference 0.5%, inside 5%. Before: 1.5%.

Robustness: test 11 (300 random configurations, 5000 yr each) passes. A further
seeded sweep of 300 random configurations, each run for 1 Myr at 5000-yr steps,
found no non-finite value, Ts outside [2, 3000] K, negative inventory, or water
ledger error (maximum 0). Condensation fired in 830 of those steps. The 2800-configuration
sweep in the previous version is superseded and was not rerun.

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

Ordering on the Earth solar ramp (CO2 free, carbon cycle on; test R2a and the
measured Gough ramp). Rule 4 precedes rule 5, so a planet pinned at the cap is a wet
runaway even above 330 K:

1. `temperate`, from the start to S ≈ 1.167;
2. `moist_greenhouse`, from 330 K at S = 1.167 (ramp) and 1.594 Gyr (Gough);
3. `wet_runaway`, from the cap test at S ≈ 1.198 and 1.887 Gyr, at 333–340 K;
   the label changes to `moist_greenhouse` and back 14 times in total, as
   Ts creeps against the cap (section 2.9 tolerance);
4. `dry_runaway`, after the ocean has evaporated at the cap, 61 Myr later
   (1.948 Gyr), at about 1000 K and rising.

The brief's sequence is temperate, then moist, then runaway (section 3.1). It is
followed here, with a gap of about 0.03 times the present sunlight (ramp) and 0.29 Gyr
(Gough). The brief's gap is 0.4–0.9 Gyr (section 7, deviation 1).

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
Node 22 a directory argument is otherwise read as a module path. Results: 30 of 30 pass
(`# tests 30, # pass 30, # fail 0`). Thirteen are the brief's tests, nine are extra
checks from earlier, and eight were added in the repair round (R1a–R4).

| # | Test | Result |
|---|---|---|
| 1 | Earth Ts, OLR, albedo, state | pass: 287.9 K, 240.1 W m^-2, 0.294, temperate |
| 2 | Mars Ts and pressure, state | pass: 220.0 K, 0.0065 bar, mars_like |
| 3 | Venus Ts, state | pass: 737.9 K, venus_like |
| 4 | Snowball cold for 1 Myr at 1000 yr | pass: hard_snowball or slushball throughout |
| 5 | Gough law values | pass |
| 6 | Mass-radius, 1 M_E | pass: R 1.0007, g 0.9986 |
| 7 | Gradualness (Gough Earth) | pass: moist onset 1.59 Gyr, runaway onset 1.89 Gyr |
| 8 | Step S = 1.18 (just above the moist threshold) takes > 1000 yr to 330 K | pass: 1492 yr. Changed from S = 1.22, see below |
| 9 | Frame-rate independence (30/60/144 Hz) | pass (see section 4) |
| 10 | Step convergence, 1 yr vs 500 yr | pass: 0.5% |
| 11 | Robustness, 300 random configs × 5000 yr | pass |
| 12 | Water loss and weathering | pass: warm CO2 falls faster (1.5e-8 vs 4.3e-4 bar) |
| 13 | Classification stability | pass |
| x1 | Speed tiers ≤ 500 Clock steps per frame | pass |
| x2 | editConfig resets gas and water state | pass |
| x3 | Surface temperature physical at a 5000-yr step (defect repro) | pass |
| x4 | `step` advances the requested time | pass |
| x5 | No wet-runaway/moist alternation at the cap | pass (config S 1.5, 25000 m, 30 d rotation) |
| x6 | No sea ice without liquid | pass |
| x7 | Snowball preset starts in radiative balance | pass |
| x8 | Non-physical inputs stay finite | pass |
| x9 | Clock keeps time it cannot run in one call | pass |
| R1a | Dry steam (S = 0.3, 906 K) goes below 647 K and recovers liquid by 8 Myr | pass: below 647 K at 5.6 Myr, liquid at 6.9 Myr. The 2 Myr target is not met |
| R1b | Vapour above saturation (500 K, 27 bar vs 24.6 bar) condenses into a new ocean; inventory unchanged | pass |
| R1c | Water budget over 100 kyr with condensation and escape: `waterOED + escapedOED` constant to 1e-9 | pass (exact) |
| R1d | No hydrogen loss near 288 K: escape under 0.1% over 100 kyr, budget closes | pass |
| R2a | Solar ramp: moist onset (Ts 330 K) at S = 1.167 comes before the runaway label at S = 1.198; grey OLR at 330 K is below the cap | pass |
| R2b | Calibration: Earth 288 ± 1 K and OLR 239–242; Mars 214–225 K; Venus 737 ± 10 K | pass |
| R3 | OLR non-decreasing from 150 to 2000 K (3001 points) for Earth gases with liquid, steam, and thick CO2; at most one balance crossing above 520 K | pass |
| R4 | Weathering identical for land 0.05 and 0.29 at 288, 300, 320 and 340 K; Earth factor 1; below 1% land it is under 1 | pass |

Test 8 changed from S = 1.22 to S = 1.18, and the new value is the one measured
to be 1492 yr. The reason is that the moist threshold moved from S ≈ 1.206 to
S ≈ 1.167 (section 4), so S = 1.22 is now 2.5% above the runaway label and the
slow approach to 330 K is at the moist threshold. The test's purpose, a
slow approach to 330 K just above a threshold, is kept. The assertion (> 1000 yr)
is unchanged.

Test 7 keeps its assertions (moist ≥ 0.1 Gyr, runaway ≥ 0.5 Gyr). Its reported
values changed, as section 4 shows.

Test R1a uses an 8 Myr limit, longer than the 2 Myr target, because the recovery time is
set by hydrogen escape (section 2.10). The test records the time it finds.

Test R2a checks the ramp ordering with the carbon cycle on. With CO2 fixed at
4.2e-4 bar the ordering also holds: the grey OLR at 330 K is 265.1 W m^-2, and the cap binds
at about 340 K.

## 7. Deviations from the brief, gaps and open problems

Status after the repair round: resolved, partly resolved, or open. Items 1, 13 and 15–17
were the repair targets. Items 19 and 20 are new and are listed for the record.

1. **Ordering of moist onset and runaway (partly resolved).** The brief expects a moist
   greenhouse (330 K) before a runaway, 0.4–0.9 Gyr apart. The moist onset now comes
   first. On the ramp it is at S = 1.167 (167.5 kyr) against a runaway label at
   S = 1.198 (198.5 kyr). On the Gough ramp it is at 1.594 Gyr against 1.887 Gyr
   (gap 0.29 Gyr). The gap is smaller than the brief's. At fixed CO2 the moist flux is
   S ≈ 1.13 and the cap binds at S ≈ 1.20. The carbon cycle lowers CO2 before the moist
   onset (item 19), which narrows the gap on the ramp. Test R2a checks the ordering on the ramp.
2. **Onset thresholds.** The moist onset S ≈ 1.167 and the runaway S ≈ 1.198 are above
   the 1-D values (1.014 and 1.107) and at or just above the 3-D range (1.10–1.19; Leconte
   2013, Wolf & Toon 2015). This is a consequence of the grey, cloud-free model. The
   previous values were moist 1.20 and runaway 1.19, in the reverse order.
3. **Step test.** The 330 K crossing time depends strongly on how far S is above the
   threshold (1492 yr at 1.18, 1059 at 1.19, 499 at 1.22, 304 at 1.25, 37 at 1.40;
   section 4). Test 8 uses S = 1.18, just above the moist threshold. This is a choice.
4. **Weathering timescale** is about 24 kyr, not the 240 kyr quoted from Colbourn et al.
   (2015). The model uses the brief's exponent of 0.3.
5. **Snowball CO2 build-up** is about 0.05 bar at 1 Myr. The brief's build-up is 4–30 Myr
   (Hoffman et al. 1998), so the model is faster. The snowball preset still stays cold,
   as test 4 requires.
6. **Early-Mars warm** is 461 K for 1.26 bar CO2 with 0.08 bar H2. Ramirez et al.
   (2014) give only about 273 K or more. The thick-CO2 fit is calibrated to
   Venus and overpredicts at about 1 bar. Not corrected, because Venus is the
   calibration target.
7. **Titan-like** surface is 116 K against 94 K. It is classification only.
8. **Cloud feedback** is absent. The cloud term is a vapour-linked allowance and
   has no temperature dependence, so the Leconte et al. (2013) cloud destabilisation is not represented.
9. **Hysteresis.** The loop is a static fold of the ice–albedo feedback (section 2.8).
   The pinned-CO2 window in earlier text was measured before this round and is superseded.
   Section 2.8 gives the re-measured table with CO2 free. A quasi-static test is not in the suite.
10. **Wet-runaway timing.** Over liquid, the planet now pins at the cap at 333–340 K, not at
    the critical point. The ocean then drains at the cap surplus. At S = 1.22 from 300 K
    this takes 1.9e5 yr at about 4 W m^-2 (before 3.6e4 yr at 8 W m^-2). The brief's
    1e4–1e5 yr is not reached at this S, because the surplus is small (section 4).
11. **Test command.** `node --test tests/` runs through `tests/index.js`
    (section 6). `npm test` runs the same suite through the `tests/*.test.js` glob.
12. **Preset starts.** The `runaway` preset (S = 1.4) has no radiative equilibrium. It
    starts at 300 K and is labelled `wet_runaway` at once, because absorbed sunlight
    exceeds the cap. `createState` starts a planet with liquid at the warmest stable
    equilibrium. For Earth gases at S ≈ 1.22 the only equilibrium is frozen, so a reset
    there starts frozen (section 2.8).
13. **Dry steam (partly resolved).** Steam now returns to the ocean once it cools below
    the saturation curve (deviation 15). From 906 K at S = 0.3 with 2700 m, Ts falls below
    647 K at 5.6 Myr and liquid returns at 6.9 Myr (test R1a). Recovery is set by hydrogen
    escape, which has a 6 Myr e-fold at steam temperatures (f capped at 0.5). Steam holds
    the p^2 optical depth that the 1280–1320 K dry runaway needs, so it cannot cool below
    647 K until escape thins it. The brief's recovery within about 2 Myr is not reached.
14. **Energy conservation (narrowed).** Energy is not conserved exactly at the crossing of
    the critical point within a step, or when an ocean is fully evaporated within one
    step (section 2.7). Condensation books its latent heat through the ocean heat
    capacity (section 2.9). The critical-point cap on condensation drops the part of the
    latent heat that would take the surface above 647.1 K.
15. **Condensation (resolved, with limits).** Vapour above saturation condenses (section
    2.9; tests R1b–R1d). Limits: (a) saturation is the Buck (1996) fit clamped at 370 °C,
    which gives 147 bar at 647 K where the real value is about 220 bar. This moves the
    condensation temperature of steam near the critical point. (b) Latent heat is booked
    through the ocean heat capacity, not through a separate surface energy budget.
    (c) A planet with no ocean area (land = 1) cannot hold condensate, so its vapour stays
    in the air. (d) Ice is part of the liquid column, since the ocean depth applies to the
    ice-covered ocean. There is no separate ice water store.
16. **OLR no longer falls with temperature (resolved; fit).** Over liquid, the water opacity
    is sub-linear, with a steeper law between 0.01 and 0.1 bar and a hold above 0.1 bar
    (section 2.3.1). The grey OLR is non-decreasing from 150 to 2000 K (test R3). The hold
    is a fit. Above 0.1 bar (about 330 K for Earth) the liquid-state optical depth does not
    rise, so the OLR there is set by the cap. The steam branch keeps the p^2 term, which
    sets the dry-runaway temperature.
17. **Weathering (resolved).** The land factor is `min(1, land/0.01)`, following Abbot et al.
    (2012). Earth's factor is 1 under both the old and the new law, so the Earth balance is
    unchanged. Consequence: a world with 1% land draws CO2 down about as fast as Earth (1 Gyr:
    2.2e-2 bar before, 6.6e-8 bar now). The brief's waterworld has no land (brief section 2,
    "no weathering feedback"). The waterworld preset has 1% land, and the preset text was
    changed to say so. With zero land there is no weathering.
18. **Speed-tier dependence** remains at the resolution of the internal step. The dry-out
    time at S = 1.4 (dt 100 yr) is now 17 000 yr (before 3800 yr). Only that dt was
    rerun, so the 500 and 2000 yr values are not current.
19. **Carbon feedback on the solar ramp (new).** Weathering at 330 K is strong, so CO2 falls
    to about 1.5e-8 bar before the planet reaches 330 K. The moist and runaway onsets on the
    ramp depend on this. At fixed CO2 they differ (section 2.3.1). The ramp values in section
    4 include the carbon cycle. A fixed-CO2 ramp is not in the suite.
20. **Classification flicker at the cap (new, small).** With the planet pinned at the cap, the
    runaway label changes to `moist_greenhouse` and back 14 times in total on the Gough ramp
    (near 333–340 K), as Ts creeps against the cap. The 1 W m^-2 tolerance (section 2.9) is applied
    to the cap test as well as the flux test, which reduced the count. Labels carry no memory
    (section 5).

## 8. Limitations

- Zero-dimensional. No latitude structure, no heat transport, no eyeball geometry.
- Grey radiation. Only the cap and the Buck saturation are physical. The optical
  depth is a fit. Over liquid its water term is held above 0.1 bar (deviation 16).
- Condensation is instantaneous at saturation, with latent heat booked through the
  ocean heat capacity (deviation 15).
- The carbon cycle uses one reservoir and one weathering law, with the
  temperature cap of section 2.11 and the saturating land factor.
- Hydrogen and water escape are single timescales, not photochemical or energy-limited models.
- Classification states are approximate (section 5).
- The brief's extrapolated luminosity has a ±20–30% uncertainty.

## References

Sources are those listed in `docs/climate-research-brief.md`. Those used
directly here: Gough (1981); Goldblatt et al. (2013); Buck (1996); Zeng et al.
(2016); Etminan et al. (2016); Wolf et al. (2017); Kopparapu et al. (2013, 2014);
Colbourn et al. (2015); Walker et al. (1981); Ramirez et al. (2014); Leconte et
al. (2013); Hoffman et al. (1998); Budyko (1969); Yang et al. (2013, 2014).
