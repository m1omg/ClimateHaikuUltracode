# Climate research brief for the Climate Forge game

This brief was produced by a research sweep: five topic researchers, two independent
fact-check passes against cited sources, and a synthesis step. Items marked [FC] were
contradicted, corrected or left unverified by the fact-check. Read the flags before
citing a number. Sources are listed at the end.

## Game decisions taken on top of this brief

These decisions resolve conflicts inside the brief. The model code and tests follow them.

1. **Emission cap.** The game caps outgoing longwave radiation (OLR) at 282 W m^-2
   (Goldblatt et al. 2013, clear-sky 1-D). The brief's Section 4 row "absorbed > 282" is
   a wording error. 294 W m^-2 is the absorbed sunlight quoted at that limit and is used
   only as a reference value, not as a switch.
2. **Hydrogen loss.** The game uses the moist-greenhouse loss time of about 1 Gyr at
   stratospheric water ~3e-3 (Wolf et al. 2017 at ~355 K). It scales inversely with the
   stratospheric water fraction. The 4.6 Gyr figure in Kodama et al. (2018) is kept as a
   slower, low-water option and is not the default.
3. **Solar brightening.** Gough (1981) luminosity law, extrapolated into the future with
   a stated ±20–30% uncertainty.
4. **Time constants.** Mixed layer 10 yr, deep ocean 300 yr (two-box), sea ice 100 yr,
   weathering 2.4e5 yr. Physical rates stay in planetary years. Only the clock speed is
   accelerated in the game.
5. **Dry thick CO2 (Venus-like).** A calibrated fit, not a line-by-line model. Venus
   (92 bar CO2, S = 1.91, albedo 0.77) should give about 737 K.
6. **Classification-only states.** Titan-like hydrocarbon hydrology, hycean and
   high-pressure-ice layers, and superhabitable worlds are classified from temperature,
   pressure and water, but are not simulated dynamically.
7. **Rotation.** Slow-rotator substellar cloud albedo and the rapid-rotator threshold are
   game approximations based on Yang et al. (2013, 2014) and Kopparapu et al. (2016), and
   are labelled as such in the model documentation.

# Research brief: climate states and runaway timing for a terrestrial-planet climate game

Built from the supplied topic findings and fact-check (FC) results. Items marked [FC] were contradicted, corrected or left unverified, and the fallback is stated. "Computed" means arithmetic on standard constants or source values done for this brief, not a source value.

## 1. Physics in plain language

A planet's surface temperature is set by the balance between absorbed starlight, (1 − albedo) × S/4, and infrared radiation to space, the outgoing longwave radiation (OLR). Greenhouse gases warm the surface by making the atmosphere emit from higher, colder layers. Water vapour is the strongest feedback: air warms by about 7% more water per K (O'Gorman & Muller 2010), which adds greenhouse effect. Clouds act both ways. They reflect sunlight, which cools, and absorb infrared, which warms. Leconte et al. (2013) found clouds destabilise a 3-D runaway, while Yang et al. (2014) found substellar cloud decks on slow rotators stabilise the climate. Ice and snow raise albedo when cold, which can make a snowball state stable in both directions.

There is an upper limit on how much infrared a moist atmosphere can emit. In clear-sky line-by-line models it is about 282 W m⁻², reached when absorbed sunlight is about 294 W m⁻² (Goldblatt et al. 2013). Above that, no equilibrium exists below the critical point of water, and the ocean evaporates. Before that, a moist greenhouse can form. The surface stays liquid, but the stratosphere wets enough for hydrogen to escape, which removes water slowly, on Gyr scales at about 355 K surface temperature (Wolf et al. 2017). Once the ocean is gone, the atmosphere is steam (dry runaway). If the steam is later photolysed and the hydrogen lost, a CO2-rich, water-poor state remains, as on Venus.

Time scales span orders of magnitude. The Sun now brightens about 8.75% per Gyr (Gough 1981 approximation, Feulner 2012), averaging about 6%/Gyr over its history. The mixed layer responds in about 5–15 yr (Held et al. 2010; Hansen et al. 1985). Deep ocean and ice respond over centuries to millennia. Silicate weathering restores CO2 on about 240 kyr (Colbourn et al. 2015). Evaporating an Earth ocean once a runaway starts takes about 10⁴–10⁵ yr (computed). Diffusion-limited water loss from a moist state takes Gyr. The water inventory, not surface temperature, sets the long pace. Because the forcing is slow, the transitions are governed by the shape of the stability curve (bistability and hysteresis) and by the slowest reservoirs.

**Terminology.** No primary source defines "wet runaway" and "dry runaway" as a matched pair. The only explicit pair is a 2012 conference abstract (LPI 2012). This brief uses the game convention in Section 2: wet runaway = liquid ocean still evaporating; dry runaway = ocean gone, steam-dominated; desiccated = Venus-like CO2 after water loss.

## 2. Climate-state catalogue

| State | Entry criteria | Exit / hysteresis | Surface T | Surface P | Water | Timescale to enter |
|---|---|---|---|---|---|---|
| Hard snowball | Global ice incl. tropics; ice-albedo feedback; low CO2. Ice threshold near 89.5–92% S0 (Fujii 2026 snippet, unverified) | Escape needs CO2 build-up. Hoffman et al. (1998) 0.12 bar in 4–30 Myr [FC: contested, timing is an outside estimate]; later models 0.01–0.3 bar (secondary). Hysteresis model-dependent | <273 K (not verified) | CO2-rich, not sourced | Sealed under ice | 40–300 yr after threshold (Horner et al. 2022, secondary); ~1.3 kyr after dimming to 94% S0 (unverified). Glaciations lasted 5–58 Myr (Hoffman et al. 2017) |
| Slushball / waterbelt | Ice to about 30° lat; open tropical ocean. Multiple equilibria in coupled models (secondary) | CO2 hysteresis; metastable in some models; depends on sea-ice scheme | Global <273 K; tropics near 273 K (not verified) | Not verified | Ice plus tropical open band | 100–1000 yr for 5–10° ice-edge retreat; ~1.5 kyr to full deglaciation (secondary) |
| Eyeball / Jormungand | Equatorial ice-free band; sea-ice edge near 10° in aquaplanet runs (Abbot et al. 2011) | CO2 hysteresis 1750–15,000 ppmv (original CAM3/ECHAM5); 2500–7000 ppmv (ICON-A, secondary). Contested | Equator near or above 273 K | Not verified | Equatorial open ocean | Not constrained |
| Temperate, Earth-like | Solar System habitable zone 0.99–1.70 AU (Kopparapu et al. 2013); S_eff below moist limit | Brightening drives moist onset (Section 3). No hysteresis established | ~288 K (Earth) | ~1 bar | ~2.7 km ocean-equivalent depth | Moist onset ~0.16 Gyr (1-D) to ~1.2–1.8 Gyr (3-D) |
| Desert / land-dominated | Exposed land when water mass fraction <~0.2% (Cowan & Abbot 2014). Ocean-equivalent depth (OED) 0.55–1.4 km for carbon-cycle balance (White-Gianella & Krissansen-Totton 2026, model type unverified). Aqua/land boundary ~10% of Earth ocean, ~270 m (Kodama et al. 2019, computed) | Runaway threshold rises to ~155% S0 (uniform land) and ~180% (extreme land) (Kodama et al. 2018, 2019) | Not verified | ~1 bar | Polar and basin water; ~3 cm global-equivalent (Abe et al. 2011, secondary) | Not constrained. Less prone to runaway than ocean worlds |
| Waterworld (aqua) | Water fraction >~0.2–0.3% with no exposed land; no weathering feedback (Komacek & Abbot 2016) | Lowest runaway threshold, ~130% S0 (Kodama et al. 2018). Waterworld self-arrest lets it exit moist phase (Abbot et al. 2012) | Warmer than Earth at equal flux | ~1 bar | Global ocean, ~23 km OED at 0.2% of Earth mass (computed) | Not constrained |
| Moist greenhouse | 1-D: S_eff 1.014, Ts 340 K (Kopparapu 2013). 3-D: Ts >330 K (Wolf et al. 2017); ~280 K for Teff >3000 K, 1-bar N2 (Kopparapu et al. 2017). Stratospheric H2O ~1e-3 to 3e-3 by volume [FC: criterion conflicts] | Exit to runaway at higher flux. Hysteresis not established. 3-D solutions to ~370 K (Kasting et al. 2015) | 330–355 K | ~1 bar N2 + CO2 | Liquid ocean losing water by escape | 1-D ~0.16 Gyr (computed). 3-D 1.2–1.8 Gyr (unvalidated extrapolation). Ocean loss ~1 Gyr at 355 K (Wolf 2017) |
| Cold-trap-limited moist (sub-state) | Cold tropopause removes most water. Stratospheric H2O rises ~x1.5 per 10 K near 290–300 K (Goldblatt & Watson 2012, simple model) | Weakens as Ts rises; water reaches stratosphere above ~350 K (Kasting et al. 2015) | 280–350 K | Not verified | Liquid, slowly lost | Not constrained |
| Wet runaway (game definition) | Absorbed sunlight above OLR limit: 282 W m⁻² clear-sky 1-D (Goldblatt et al. 2013); 375 W m⁻² incident 3-D (Leconte et al. 2013); 350–450 W m⁻² by N2/CO2 (Chaverot et al. 2023) | Hysteretic: recondenses at ~350 W m⁻² for 1 bar N2 (Chaverot 2023). Kasting (1988) defines runaway at critical point (647 K, 220 bar); net-imbalance definitions differ | Onset ~340 K (Chaverot 2023); rises toward ~1400 K as ocean goes (Goldblatt & Watson 2012) | Steam-rich; not sourced | Liquid ocean evaporating | After moist onset. Evaporation 3×10⁴ yr at 10 W m⁻² net imbalance (computed). Not measured in any source |
| Dry runaway (steam) | Ocean fully evaporated; OLR capped by pure-steam limit ~282 W m⁻² (LPI 2012 abstract). Stable steam branch at Ts ≳1600 K (Goldblatt et al. 2013) | Reversible only at lower flux after cooling | 1400–1500 K [FC: sources disagree] | Steam, bars to tens of bars (not sourced) | Vapour only | 10⁴–10⁵ yr after evaporation starts (computed). Vapour removal Myr–Gyr |
| Desiccated CO2 (Venus-like) | Water lost by photolysis and escape. Present S_eff 1.91 (NSSDC) | Needs CO2 removal or cooling below runaway threshold. No carbonate cycle | 737 K | 92 bar | ~20–30 ppmv vapour | Past event. Type-II magma-ocean desiccation up to ~100 Myr (Hamano et al. 2013) |
| Mars-like thin CO2 | Low pressure; CO2 condensation; S = 0.43 S0 (NSSDC) | CO2 collapse near 2–3 bar (Kasting 1991, secondary) | 214 K mean | 6.36 mbar (seasonal 4.0–8.7) | Ice; transient liquid only | Present state. Warm episodes 4.5–3.5 Ga (secondary) |
| Early-Mars H2-CO2 warm | 1.3–4 bar CO2 + 5–20% H2 gives >273 K (Ramirez et al. 2014, 1-D). 1.25–2 bar + 2–10% H2/CH4 reaches 273 K (Wordsworth et al. 2017, snippet) | Transient; cools when reducing gas removed | ≥273 K | 1.25–4 bar | Liquid episodes | Episode duration not constrained |
| Titan-like (N2 + CH4 hydrology) | ~95% N2, ~5% CH4 (NASA); surface ~94 K | CH4 photolysis lifetime 10–100 Myr without resupply (secondary) | 93.65 K (Huygens site) | 1.47 bar (Huygens) [FC: "60% above Earth" implies ~1.6 bar] | CH4/ethane lakes; water-ice bedrock | Needs resupply |
| Hycean | 1–10 M_E; water 10–90% by mass; H2/He envelope ≤0.1% of mass (Madhusudhan et al. 2021) | Not analysed. Inner-edge equilibrium 210–430 K; dark-hycean limit ~510 K | 273–395 K liquid | 1–1000 bar at ocean base | Global ocean, no land | Not constrained |
| High-pressure-ice ocean | Deep ocean over ice VI/VII/X. Ice VI near 1 GPa (Journaux et al. 2020, secondary) | Ice may melt from below episodically (Noack et al. 2016, low) | Not verified | GPa at base | Deep ocean over ice | Not constrained. Madhusudhan 2021 does not model ice layers [FC] |
| Slow rotator (P ≳20 d) | P >~20 d for M/K-host habitable zone (Haqq-Misra et al. 2018). Tolerates ~2× 1-D flux (Yang et al. 2013, 2014) | At 2615 W m⁻²: 32-d rotation runs away, 48-d stays ~287 K (low confidence) | 287 K (48 d); 306 K (Venus rotation, −243 d) [FC]; GCM crash ~310 K | 1 bar N2 model | Ocean under substellar cloud, albedo 0.63–0.65 | Not constrained. Nightside CO2 freeze-out ~30 mbar (Joshi et al. 1997, secondary) |
| Rapid rotator (P ≲5 d) | Coriolis-dominated zonal flow, banded clouds; regime edge near 5–10 d (Kopparapu et al. 2016) | Runaway at about half the flux tolerated by slow rotators (Yang 2014) | Lower than slow rotator at equal flux | 1 bar | Ocean with equatorial cloud band | Not constrained. Weathering peak near 4 d (Jansen et al. 2019) |
| Hadean hot early Earth | Silicate vapour, then steam, then liquid after impact (Sleep et al. 2001) | Monotonic cooling | ~200 °C near 4 Ga (talk summary, unverified) | ~200 bar CO2 (unverified) | Steam first, then liquid | Steam magma ocean ~1 Myr (Lebrun et al. 2013, secondary); ocean formation 0.1–10 Myr |
| Magma ocean / lava world | Equilibrium T above ~1500–2000 K (secondary). Type I/II split by water (Hamano et al. 2013) | Solidification set by heat loss; steam delays it | >1500 K | Not verified | Type I: ocean forms after cooling. Type II: dry | Few kyr (no atmosphere), ~1 Myr (steam), up to ~100 Myr (type II) |
| Pure-water multistate | Habitable width only 0.07 S0. Bands: ice <245 K; cold-damp 270–290 K; hot-moist 350–550 K; hot-dry to ~900 K (Goldblatt 2015) | Discontinuous jumps; no stable state 290–350 K or 550–900 K | As listed | Pure H2O | Pure H2O atmosphere | Not constrained |
| Icy body, direct jump | Snowball to moist or runaway without a habitable phase when flux melts ice (Yang et al. 2017) | Abrupt in flux space; Europa-like OLR ceiling ~238 W m⁻² | n/a | n/a | Ice to vapour | Billion-year claim unverified [FC] |

## 3. Runaway-greenhouse timing

### 3.1 Slow ramp (natural solar brightening)

Times are from the Gough (1981) formula L/L0 = 1/(1 − 0.4τ/4.57), τ in Gyr from present. The formula is fitted to the past and is extrapolated here, so treat the times as ±20–30%.

| Threshold | Forcing | Time from present | Source / status |
|---|---|---|---|
| 1-D moist onset (Ts 340 K) | S_eff 1.014 (+1.4%) | ~0.16 Gyr | Kopparapu 2013; computed |
| 1-D runaway, 2013 table | S_eff 1.0512 (+5.1%) | ~0.56 Gyr | Kopparapu 2013 |
| 1-D runaway, 2014 correction | S_eff 1.107 (+10.7%) | ~1.10 Gyr | Kopparapu 2014 [FC: replaces +6%] |
| "+6% 1-D runaway" | +6% | ~0.65 Gyr | Attribution not confirmed [FC: contradicted] |
| 3-D moist onset (abrupt) | +12.5% | ~1.27 Gyr | Wolf & Toon 2015 [FC: conflicts with 119%] |
| 3-D significant water loss | +19% (1.19) | ~1.8 Gyr | Wolf & Toon 2015 (secondary) |
| 3-D runaway, Leconte | 375 W m⁻² (~1.10 × 341) | ~1.0 Gyr | Leconte 2013 [FC: normalisation unverified] |
| 3-D runaway, 1 bar N2 | 400 W m⁻² (~1.17) | ~1.7 Gyr | Chaverot et al. 2023 |
| 3-D stability ceiling | +21% | ~2.0 Gyr | Wolf & Toon 2015 [FC: partial] |

Other anchors: Goldblatt et al. (2013) state a runaway ~1.5 Gyr hence if water is the only greenhouse gas. A 2020 secondary source gives +10% at ~1.2 Gyr, against 1.04 Gyr here. Moist-to-runaway gap in 1-D is ~0.4–0.9 Gyr. Ocean loss after moist onset is slow: ~4.6 Gyr at stratospheric H2O 3×10⁻³ (Kodama et al. 2018), ~1 Gyr at 355 K (Wolf 2017), and a few hundred Myr for energy-limited loss (Watson et al. 1981, as quoted by Goldblatt & Watson 2012).

**Slow-ramp sequence for Earth-like planets:** temperate → moist (0.2 Gyr in 1-D, 1.2–1.8 Gyr in 3-D) → runaway (0.6–1.7 Gyr) → steam once the ocean is gone (10⁴–10⁵ yr later, computed) → slow water loss (Gyr).

### 3.2 Step change

- **Step above threshold:** no equilibrium exists. The mixed layer warms in ~10 yr, the deep ocean in ~300–1000 yr, and the surface runs away within the evaporation time of 3×10⁴ yr (F_net = 10 W m⁻²) to 3×10⁵ yr (1 W m⁻²) (computed). Popp et al. (2016) and Leconte et al. (2013) report equilibria only. No transient step-response study for runaway was found.
- **Step below threshold after steam:** hysteresis. Chaverot et al. (2023) find steam persists between ~350 and ~400 W m⁻² for 1 bar N2.
- **Popp et al. (2016) bistable window:** warm and Earth-like states coexist. Earth-like to warm at TSI 1.03–1.05; warm to Earth-like at 1.00–1.03 [FC: confirmed]. Width of ~0.01–0.05 S0 is an inference, and the runs were fixed-forcing steady states.
- **Step to 94% S0:** snowball onset in ~1.3 kyr (Fujii 2026, unverified).

Under a step, the planet passes through a fast thermal adjustment (10 yr to 10³ yr) before the slow ocean-loss stage. Under a natural ramp, the same fast stages are quasi-static, so the visible transition is set by where the equilibrium curve folds.

### 3.3 Pace-setting timescales

| Process | Timescale | Basis |
|---|---|---|
| Mixed layer (50–70 m) | 5–15 yr | Held et al. 2010; Hansen et al. 1985; 5–7 yr computed |
| Deep ocean, two-box e-fold | ~300 yr (200–600) | Two-box fits, low confidence (Stouffer 2004) |
| Deep-ocean equilibration | 500–1500 yr | Stouffer 2004; Yang et al. 2011 (snippets) |
| Sea ice / ice-albedo runaway | 40–300 yr | Horner et al. 2022 (secondary) |
| Ice sheets (step) | 1.5–10 kyr (disputed) | Low confidence |
| Silicate weathering | 240 kyr (170–380) | Colbourn et al. 2015 |
| Atmospheric CO2 turnover, no weathering | ~7 kyr at present Earth (computed) | 7 Tmol/yr, 4×10⁻⁴ bar |
| Ocean evaporation (runaway) | 3×10⁴ yr at 10 W m⁻²; scales as OED/F_net | Computed (latent + sensible, 1.07×10¹³ J m⁻² per Earth OED) |
| Diffusion-limited H escape | 4.6 Gyr at f_H2O = 3×10⁻³; ~1 Gyr at 355 K; scales as 1/f_H2O | Kodama 2018; Wolf 2017; scaling computed |
| Energy-limited H escape | Few hundred Myr per Earth ocean | Watson 1981, via Goldblatt & Watson 2012 |
| Photolysis-limited loss | 0.3 Gyr per Earth ocean at present UV | Wordsworth & Pierrehumbert 2013 [FC: not an upper bound] |
| Snowball CO2 build-up | 4–30 Myr (contested) | Hoffman 1998 [FC] |
| Snowball deglaciation once started | 10–100 kyr (low) | Habitable snowball studies |
| Solar brightening | 8.75%/Gyr now (1% per ~114 Myr) | Feulner 2012; computed |

### 3.4 Recommended game rule

1. **Reservoirs and time constants (planetary years).** Mixed layer τ = 10; deep ocean τ = 300 (two-box); sea ice τ = 100; ice sheet τ = 2000; CO2 and weathering τ = 2.4×10⁵; ocean-evaporation reservoir driven by (absorbed − OLR) flux; water-loss reservoir τ_H = 4.6 Gyr × (3×10⁻³ / f_H2O).
2. **Accelerated clock.** Let A = planetary years per game year for the solar ramp only. Physical rates stay in planetary years. Ramp rate in S0 per planetary year is 8.75×10⁻¹¹ × A.
3. **Quasi-static criterion.** A reservoir tracks equilibrium if 8.75×10⁻¹¹ × A × τ ≤ 0.1 × ΔS_w, with ΔS_w = 0.03 S0. This gives A_max ≈ 3×10⁶ (mixed layer), 10⁵ (deep ocean), 2×10⁴ (sea ice), 10³ (evaporation), and 1.4×10² (weathering).
4. **Two modes.** "Analysis" mode: A ≤ 10³, so all reservoirs except weathering are quasi-static. "Play" mode: A = 10⁶, so 1 Gyr takes ~17 min and the 0.02–0.05 S0 hysteresis window takes ~4–10 min to cross. At this rate the evaporation lag covers ~0.003 S0 per evaporation time (~9% of the window), so the runaway still reads as gradual, with a visible overshoot. Show a lag indicator for each reservoir.
5. **Numerics.** Use exact exponential updates for linear relaxation reservoirs, so step size is not limited by the shortest τ. Use a fixed planetary-time step with an accumulator, decoupled from frame rate (requestAnimationFrame delta is never used as physics time).
6. **Near folds.** The lag grows as the fold is approached. A standard normal-form argument gives a delay that scales roughly as rate^(−1/3) in units of the fast time. This was not checked for these models and is a design hint only.

## 4. Model equations and coefficients

| Model element | Form and coefficients | Validity | Source / status |
|---|---|---|---|
| Energy balance | (1 − A)S/4 = σT_e⁴; Earth T_e = 255 K (A = 0.294, S = 1361) | Single zone; no heat transport | Pierrehumbert & Gaidos 2011 Eq. 1 (read); computed |
| Solar luminosity | L/L0 = 1/(1 + 0.4(1 − t/4.57)), t in Gyr; future: 1/(1 − 0.4τ/4.57) | Good except first ~0.2 Gyr; future extrapolation unvalidated | Gough 1981; Feulner 2012 |
| OLR cap, clear sky | Runaway if absorbed (1 − A)S/4 > 282 W m⁻²; absorbed limit 294 W m⁻² | Pure water, clear sky, 1 bar, Earth gravity; clouds excluded | Goldblatt et al. 2013 (read) |
| Simpson–Nakajima grey / spectral | 290 (grey) and 310 (spectral) W m⁻²; ~280 for Earth gravity | Historical; differs by method | Goldblatt & Watson 2012; Innes et al. 2023 |
| Komabayashi–Ingersoll limit | ~385 W m⁻² (stratosphere τ ~0.1) | Theoretical; not reached in practice | Goldblatt & Watson 2012 |
| Grey radiative equilibrium | σT⁴(τ) = ½F(1 + 3τ/2); T⁴ = ¾T_e⁴(τ + 2/3), τ from top | Stratosphere optically thin (τ ≲ 0.1) | Goldblatt & Watson 2012 Sec. 2.2 |
| Surface OLR (grey) | OLR = σT_s⁴/(1 + 3τ/4), commonly quoted. Boundary convention unresolved | Calibrate τ so OLR reaches 282 and Earth OLR is ~239 | Low confidence; Pierrehumbert 2010 not retrieved |
| S_eff | S_eff = S0 + aT* + bT*² + cT*³ + dT*⁴, T* = Teff − 5780 K. Runaway, 1 M_E: S0 = 1.107, a = 1.332×10⁻⁴, c = −8.308×10⁻¹² (b, d not extracted) | Teff 2600–7200 K; 0.1–5 M_E | Kopparapu 2014 Table 1 (partly read) |
| Orbital distance | d = (L/S_eff)^½ AU | As above | Kopparapu 2014 Eq. 5 |
| Water-loss criterion | Stratospheric H2O f ≈ 3×10⁻³ (1-D, Kopparapu 2013; Kodama 2018) or ~10⁻³ (3-D, Kopparapu 2017). τ_H ≈ 4.6 Gyr × (3×10⁻³/f) (computed scaling) | 1-D sensitive to stratospheric T. Kasting 2015 suggests 150 K for low-CO2 | Kopparapu 2013, 2017; Kodama 2018; Kasting et al. 2015 [FC: units conflict] |
| Saturation vapour, liquid | e_s = 6.1121 exp[(18.678 − T/234.5)·T/(257.14 + T)] hPa, T in °C | T ≥ 0 °C; accurate −80 to 50 °C | Buck 1996 (via Wikipedia; not independently checked) |
| Saturation vapour, ice | e_i = 6.1115 exp[(23.036 − T/333.7)·T/(279.82 + T)] hPa | T < 0 °C | Same |
| Clausius–Clapeyron | d ln e_s/dT = L/(R_v T²) = 0.065 K⁻¹ at 15 °C (computed) | Ideal gas | Held & Soden 2000 |
| CO2 forcing, simple | ΔF = 5.35 ln(C/C0); 3.71 W m⁻² per doubling | Simplest; ~9–10% high at 2000 ppm vs Etminan | Myhre et al. 1998 (via Etminan 2016) |
| CO2 forcing, refined | ΔF = [a1(C−C0)² + b1|C−C0| + c1N̄ + 5.36] ln(C/C0); a1 = −2.4×10⁻⁷, b1 = 7.2×10⁻⁴, c1 = −2.1×10⁻⁴ (ppm, ppb) | 180–2000 ppm; superscripts partly garbled | Etminan et al. 2016 Table 1 (read; not in FC) |
| CH4 forcing | ΔF = [a3M̄ + b3N̄ + 0.043](√M − √M0); a3 = −1.3×10⁻⁶, b3 = −8.2×10⁻⁶ | 340–3500 ppb. 722→1803 ppb gives 0.61 W m⁻² (computed) | Etminan et al. 2016 |
| N2 broadening | CO2 needed for 80% faint Sun at 2.8 Gyr: 0.32, 0.20, 0.11 bar at 0.5, 1, 2 bar N2 | Single case | Byrne & Goldblatt 2014 |
| CO2 frost point | T_c = −3167.8/[ln(0.01p) − 23.23] for p <518 kPa; T_c = 684.2 − 92.3 ln p + 4.32(ln p)² above; p in Pa | Triple point 518 kPa, ~216.6 K. 610 Pa → 148 K (computed) | Forget et al. 2013 (read) |
| Mass–radius, rocky | R/R_E = (1.07 − 0.21·CMF)(M/M_E)^0.27; g/g_E = (M/M_E)/(R/R_E)² | 1–8 M_E; CMF 0–0.4; ±0.01 R_E | Zeng et al. 2016 (read) |
| Mass–radius, water/ice | log10 R_s = k1 + ⅓log10 M_s − k2 M_s^k3; H2O ice: m1 = 5.52, r1 = 4.43, k1 = −0.209396, k2 = 0.0807, k3 = 0.375 | M_s <4 by text; caption conflicts | Seager et al. 2007 (read) |
| Surface pressure | P_s = M_atm g/(4πR²); Earth 5.15×10¹⁸ kg gives 99 kPa (computed) | Standard | Hydrostatic |
| Escape (Jeans) | λ = G M m/(k T (r + h)); Jeans regime λ > 2.8 | Use escaping species' mass | Pierrehumbert & Gaidos 2011 |
| Diffusion-limited H2 escape | φ = b·f_H2·(1/H_a − 1/H_H2); b = 3×10²¹ (CO/CO2), 1.7×10²¹ (N2) | Upper limit for light species. Units inconsistent in source | Hunten 1973, as quoted in arXiv 2009.14599 |
| Silicate weathering (WHK) | W ∝ pCO2^0.3 exp[(T − 285)/13.7]; runoff alternative exp[(T − 285)/14.1] | Not checked in FC (PDF unreadable) | Walker et al. 1981 [FC: unverifiable]. Use with GEOCARB cross-check |
| Weathering (GEOCARB) | f_B(T) = exp(0.090ΔT)·(1 + 0.038ΔT)^0.65 | Read directly | Berner 1995 |
| Ice albedo | Budyko–Sellers: 0.32 ice-free, 0.62 ice-covered, switch at −10 °C. Field: fresh snow 0.75–0.87, sea glacier 0.55–0.66, bare sea ice 0.47–0.52 | Low confidence; secondary | Budyko 1969 not read; Yang et al. 2012 (snippet) |

**Recommended model:** a 0-D two-reservoir energy balance (mixed layer plus deep ocean) with a Simpson–Nakajima OLR cap at 282 W m⁻², a grey optical depth scaled by e_s(T) and calibrated to Earth's OLR, Etminan CO2 and CH4 forcing up to 2000 ppm, and a WHK/GEOCARB-type weathering sink calibrated to outgassing at present Earth.

## 5. Parameter table

| Parameter | Game default | Game range | Basis |
|---|---|---|---|
| Planetary mass | 1.0 M_E | 0.1–5 M_E (radius law valid 1–8) | Kopparapu 2014; Zeng 2016 |
| Radius and gravity | R = (1.07 − 0.21·CMF)·M^0.27 R_E, CMF 0.33 → 1.00 R_E; g = g_E·M/R². Range: 0.3 M_E → 0.72 R_E, 0.58 g_E; 5 M_E → 1.55 R_E, 2.1 g_E (extrapolated below 1 M_E) | As mass | Zeng 2016 (computed) |
| Water inventory (OED) | 2700 m | 0–25,000 m. Desert edge 300–1400 m; 0.2% mass fraction ~23 km | Earth ocean (computed from 1.4×10²¹ kg); Cowan & Abbot 2014; Kodama 2019 |
| CO2 partial pressure | 4.2×10⁻⁴ bar (420 ppm) | 10⁻⁵ to 90 bar. Efficient loss at 0.1–1 bar (Wordsworth & Pierrehumbert 2013). Forcing formula valid to 2000 ppm | NASA Earth fact sheet; Etminan 2016 |
| CH4 | 1.8×10⁻⁶ bar (1.8 ppm) | 0 to 10⁻³ bar. 100 ppmv ~7 W m⁻² at 1 bar N2 | Etminan 2016; Byrne & Goldblatt 2014 |
| N2 (background) | 0.78 bar (1 bar total) | 0.1–10 bar | Kopparapu 2014; Chaverot 2023; Byrne & Goldblatt 2014 |
| O2 | 0 (abiotic) or 0.21 bar (present Earth) | 0–0.5 bar. Radiative effect unquantified | No CIA coefficient found [FC gap] |
| H2 | 0 | 0–10% by volume (warm-Mars type); up to tens of bar for H2 worlds (speculative above 20 bar) | Ramirez 2014; Wordsworth 2017; Pierrehumbert & Gaidos 2011 |
| SO2 | 0 (Venus: 150 ppm) | 0–500 ppmv. Radiative effect unreliable | Johnson et al. and Tian et al. conflict; low confidence |
| Stellar flux S (relative to Earth) | 1.0 (1361 W m⁻²) | 0.3–2.0 (Venus ~1.91; runaway S_eff 1.107) | NASA; Kopparapu 2014 |
| Rotation period | 1.0 d | 0.5–365 d. Regime edges 5 d, 10 d, 20 d; weathering peak 4 d | Yang et al. 2014; Haqq-Misra et al. 2018; Kopparapu et al. 2016; Jansen et al. 2019 |
| Albedo modifiers | Bond albedo 0.294 (Earth); Mars 0.25 | Ocean 0.07 (Chaverot 2023) to 0.65 (slow-rotator cloud deck). Ice 0.32–0.62 (low) | NASA; Yang 2014; Budyko (secondary) |
| Land fraction | 0.29 | 0–1.0. Weathering insensitive above 0.01 (Abbot et al. 2012). Runaway 130% S0 (aqua) to 155–180% (land) | Abbot 2012; Kodama 2018, 2019 |
| Volcanic outgassing | 7 Tmol C/yr (≈ 58 bar/Gyr; 1 bar CO2 ≈ 1.2×10²⁰ mol, computed) | 0.5–20 Tmol/yr. Secondary spread 6–10.5 | Marty & Tolstikhin 1998; Catling & Kasting 2017 (secondary) |
| Weathering strength | Calibrate W0 so W = outgassing at 288 K, 4×10⁻⁴ bar. Exponent 0.3 on pCO2. Combined e-fold 13.7 K. τ_w ≈ 240 kyr | 0.3–3× default. Alternative e-fold 14.1 K (runoff) | Walker et al. 1981 [FC: unverified]; Colbourn et al. 2015 |

## 6. Uncertainties and failed checks

| Claim or item | Status | What the game should use |
|---|---|---|
| 1-D runaway at +6% (attributed to Wolf & Toon 2014) | Contradicted [FC] | S_eff 1.107 (Kopparapu 2014) as default; 1.0512 (2013) as low option |
| "~280 W m⁻² Nakajima limit" as Nakajima's own value | Misattributed (Goldblatt & Watson 2012: 290 grey, 310 spectral) | 282 (Goldblatt 2013) as cap; 290–310 as alternative |
| Wolf & Toon 2015 +21% ceiling; 362.8 K | Partial [FC]. "Exceeds 360 K"; onset conflicts (+12.5% vs 119%) | Onset band 1.125–1.19 S0; ceiling +21% labelled secondary |
| Popp et al. 2016 window 0.01–0.05 S0; "step" forcing | Partial [FC]. Bracket values confirmed; width and step are inferences | 0.02–0.05 S0 band, labelled as inferred |
| Yang et al. 2014: 128-day case at 306 K, albedo 0.65 | Contradicted [FC] | 306 K/0.65 at −243 d; 287 K/0.63 at 48 d; 128-d runs at 1365 or 3000 W m⁻²; 32-d runs away at 2615 |
| Wordsworth & Pierrehumbert 2013: 3.2 oceans/Gyr "upper bound" | Partial [FC]. Present-UV rate; higher under elevated XUV | Use 0.3 Gyr per ocean as present-UV value; scale with XUV history |
| Kodama 2018 4.6 Gyr at 3×10⁻³ (and ~10⁻³ elsewhere) | Partial [FC]. Both in same paper | 3×10⁻³ for 1-D loss; 10⁻³ for 3-D moist criterion; state which |
| Hoffman 1998: 0.12 bar in 4–30 Myr | Partial [FC]. Timing is an outside estimate; contested | Slow build-up band; alternatives 0.01–0.3 bar |
| Solar brightening 1%/100–115 Myr; moist onset 1.0–1.8 Gyr | Partial [FC]. Rate is present-day only; extrapolation unvalidated; 2020 source gives 1.2 Gyr for +10% | Gough formula with ±0.2 Gyr band |
| Leconte 2013 375 W m⁻² "incident flux" | Partial [FC]. Abstract says "insolation" | Global-mean incident, labelled as assumption |
| Kopparapu 2013 runaway 1.06 (text) vs 1.0512 (table); minimum 0.325 vs 0.343 | Internal conflict | Table values only |
| Earth "falls right on" the runaway limit (Kopparapu 2014 text) | Conflicts with table (Earth S_eff 1.0 vs limit 1.107) | Do not use as boundary |
| Walker, Hays & Kasting 1981 coefficients | Unverifiable in FC (binary PDF) | Use with GEOCARB cross-check; 13.7 K provisional |
| Stratospheric H2O 3×10⁻³ attributed to Kasting et al. 1993 | Low; 3 g/kg ≈ 4.8×10⁻³ by volume (computed) | Use 3×10⁻³, labelled |
| Diffusion-limited loss 8 Gyr at 350 K (snippet) | Not verified; breaks monotonicity (1 Gyr at 355 K, 4.6 Gyr at 340 K) | Drop |
| Snowball threshold 89.5–92% S0; 1.3 kyr dimming response | Unverified (Fujii 2026 snippet) | Placeholder with wide band |
| Dry-runaway surface 1400 K vs 1500 K | Sources disagree | 1400–1500 K band |
| Hycean linked to ice VI/VII | Madhusudhan 2021 does not model ice; Leger 2004 unverified | Hycean = liquid ocean; high-pressure ice as separate low-confidence state |
| "Wet" and "dry" runaway as matched pair | No primary definition found | Game convention in Section 1 |
| Superhabitable worlds: "2–3 Earth radii" (press) vs "slightly more massive" (abstract) | Unresolved | No numbers used |
| Titan surface pressure 1.5 bar vs 1467 hPa vs "60% above Earth" (implies ~1.6 bar) | Conflicting | 1.47 bar (Huygens site), labelled |
| Cowan & Abbot "80 times more water" press quote | Not in abstract | 0.2% mass fraction only |
| Yang et al. 2017 "billion years" frozen-planet claim | Unverified | Not used |
| Edson et al. 2011 switch at 3–5 d | Low confidence; fragments only | Use 5 d and 10 d edges (Haqq-Misra 2018; Kopparapu 2016) |
| Kopparapu 2016 flux differences (25% lower in abstract vs 20% higher in body) | Unreconciled | Use 26% (9 d vs 60 d) only, low confidence |
| Way et al. 2016 "habitable to 2 Gyr" (NASA presentation) | Secondary | 0.715 Gyr (abstract) |
| Sea-ice, ice-sheet, deep-ocean time constants | Low; disputed | Stated ranges; two-box with 10 and 300 yr modes |
| Volcanic outgassing spread 6–10.5 Tmol/yr | Secondary | 7 Tmol/yr default, computed conversion 1 bar/Gyr ≈ 0.12 Tmol/yr |
| SO2 and O2 radiative magnitudes; N2–N2 CIA | No usable per-ppm value found | Default to zero effect; flag as gap for a later HITRAN calculation |
| Byrne & Goldblatt CH4 maximum 6.66 (GRL snippet) vs ~9 W m⁻² (Clim. Past) | Conflicting | Use 9 W m⁻² (1 bar N2), labelled |
| Grey surface OLR boundary convention | Unresolved | Calibrate τ to 282 cap and Earth OLR |
| Abe et al. 2011 land inner edge 0.77 AU vs 415 W m⁻² | Mismatch; not reconciled | Not used |
| Venus water vapour 20–50 ppmv | Range across sources | 20–30 ppmv |

## References

- Abbot, D. S., Voigt, A. & Koll, D. (2011). The Jormungand global climate state. JGR 116, D18103. https://doi.org/10.1029/2011JD015927
- Abbot, D. S., Cowan, N. B. & Ciesla, F. J. (2012). Indication of insensitivity of planetary weathering to land fraction. ApJ 756, 178. https://iopscience.iop.org/article/10.1088/0004-637X/756/2/178
- Abe, Y., Abe-Ouchi, A., Sleep, N. H. & Zahnle, K. J. (2011). Habitable zone limits for dry planets. Astrobiology 11, 443. https://doi.org/10.1089/ast.2010.0545
- Berner, R. A. (1995). Chemical weathering and its effect on atmospheric CO2 and climate. Rev. Mineral. 31. https://www.atmos.albany.edu/daes/atmclasses/atm551/OtherReadingMaterials/Berner1995_ChemicalWeathering.pdf
- Buck, A. L. (1996). CR-1A hygrometer manual, as summarised at https://en.wikipedia.org/wiki/Arden_Buck_equation
- Byrne, B. & Goldblatt, C. (2014). Radiative forcings for 28 potential Archean greenhouse gases. Clim. Past 10, 1779–1801. https://arxiv.org/abs/1409.1880
- Chaverot, G., Bolmont, E. & Turbet, M. (2023). First exploration of the runaway greenhouse transition with a GCM. A&A 680, A103. https://arxiv.org/abs/2309.05449
- Colbourn, G., Ridgwell, A. & Lenton, T. M. (2015). The time scale of the silicate weathering negative feedback on atmospheric CO2. GBC. https://research-information.bris.ac.uk/en/publications/the-time-scale-of-the-silicate-weathering-negative-feedback-on-at/
- Etminan, M. et al. (2016). Radiative forcing of carbon dioxide, methane, and nitrous oxide. GRL 43, 12614. https://doi.org/10.1002/2016GL071930
- Feulner, G. (2012). The faint young Sun problem. Rev. Geophys. https://ar5iv.labs.arxiv.org/html/1204.4449
- Forget, F. et al. (2013). 3D modelling of the early Martian climate under a denser CO2 atmosphere. Icarus. https://arxiv.org/abs/1210.4216
- Fujii, Y. (2026). Snowball onset review. Clim. Past 22, 845. https://cp.copernicus.org/articles/22/845/2026/ (unverified)
- Goldblatt, C. & Watson, A. J. (2012). The runaway greenhouse. Phil. Trans. R. Soc. A 370, 4197. https://arxiv.org/abs/1201.1593
- Goldblatt, C., Robinson, T. D., Zahnle, K. J. & Crisp, D. (2013). Low simulated radiation limit for runaway greenhouse climates. Nature Geoscience 6, 661. https://www.nature.com/articles/ngeo1892
- Goldblatt, C. (2015). Habitability of pure water atmospheres. Astrobiology. https://arxiv.org/abs/1503.04835
- Gough, D. O. (1981). Solar interior structure and luminosity variations. Solar Physics 74, 21. https://link.springer.com/doi/10.1007/BF00151270
- Haqq-Misra, J. et al. (2018). Demarcating circulation regimes of synchronously rotating planets. ApJ 852, 67. https://arxiv.org/abs/1710.00435
- Hansen, J. et al. (1985). Climate response times. Science 229, 857. https://www.science.org/doi/10.1126/science.229.4716.857
- Held, I. M. et al. (2010). Probing the fast and slow components of global warming. J. Clim. 23. https://journals.ametsoc.org/view/journals/clim/23/9/2009jcli3466.1.xml
- Held, I. M. & Soden, B. J. (2000). Water vapor feedback and global warming. Annu. Rev. Energy Environ. 25. https://www.gfdl.noaa.gov/bibliography/related_files/annrev00.pdf
- Hamano, K., Abe, Y. & Genda, H. (2013). Emergence of two types of terrestrial planet on solidification of magma ocean. Nature 497, 607. https://www.nature.com/articles/nature12163
- Hoffman, P. F. et al. (1998). A Neoproterozoic snowball Earth. Science 281, 1342. https://www.science.org/doi/10.1126/science.281.5381.1342
- Hoffman, P. F. et al. (2017). Snowball Earth climate dynamics and Cryogenian geology. Sci. Adv. 3, e1600983. https://doi.org/10.1126/sciadv.1600983
- Horner, J. et al. (2022). Snowball Earth initiation and the thermodynamics of sea ice. JAMES. https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2021MS002734
- Hunten, D. M. (1973). Escape of H2 from planetary atmospheres, quoted in arXiv 2009.14599. https://ar5iv.labs.arxiv.org/html/2009.14599
- Innes, H., Tsai, C.-W. & Pierrehumbert, R. T. (2023). The runaway greenhouse effect on hycean worlds. ApJ 953, 168. https://iopscience.iop.org/article/10.3847/1538-4357/ace346
- Jansen, M. et al. (2019). Climates of warm Earth-like planets II. ApJ. https://arxiv.org/abs/1810.05139
- Joshi, M. M., Haberle, R. M. & Reynolds, R. T. (1997). Simulations of synchronously rotating terrestrial planets. Icarus 129, 450. https://zenodo.org/record/1229828
- Kasting, J. F. (1988). Runaway and moist greenhouse atmospheres. Icarus 74, 472. https://ntrs.nasa.gov/citations/19880055273
- Kasting, J. F., Chen, H. & Kopparapu, R. K. (2015). Stratospheric temperatures and water loss from moist greenhouse atmospheres. ApJL 813, L3. https://arxiv.org/abs/1510.03527
- Kasting, J. F. (1991). CO2 condensation and the climate of early Mars. Icarus 94, 1.
- Kodama, T. et al. (2018). Dependence of the onset of the runaway greenhouse effect on the latitudinal surface water distribution. JGR Planets. https://arxiv.org/abs/1801.07202
- Kodama, T. et al. (2019). Inner edge of habitable zones for Earth-sized planets with various surface water distributions. JGR Planets. https://arxiv.org/abs/1908.05909
- Komacek, T. D. & Abbot, D. S. (2016). Effect of surface-mantle water exchange on exoplanet ocean depths. ApJ 832, 54. https://arxiv.org/abs/1609.04786
- Kopparapu, R. K. et al. (2013). Habitable zones around main-sequence stars: new estimates. ApJ 765, 131. https://arxiv.org/abs/1301.6674
- Kopparapu, R. K. et al. (2014). Habitable zones around main-sequence stars: dependence on planetary mass. ApJL 787, L29. https://iopscience.iop.org/article/10.1088/2041-8205/787/2/L29
- Kopparapu, R. K. et al. (2016). The inner edge of the habitable zone for synchronously rotating planets. ApJ 819, 84. https://iopscience.iop.org/article/10.3847/0004-637X/819/1/84
- Kopparapu, R. K. et al. (2017). Habitable moist atmospheres on terrestrial planets near the inner edge of the habitable zone around M dwarfs. https://arxiv.org/abs/1705.10362
- Leconte, J. et al. (2013). Increased insolation threshold for runaway greenhouse processes on Earth-like planets. Nature 504, 268. https://arxiv.org/abs/1312.3337
- LPI (2012). The runaway greenhouse: could it happen here? Comparative Climatology conference abstract. https://www.lpi.usra.edu/meetings/climatology2012/pdf/8035.pdf
- Madhusudhan, N., Piette, A. A. A. & Constantinou, S. (2021). Habitability and biosignatures of hycean worlds. ApJ. https://ar5iv.labs.arxiv.org/html/2108.10888
- Myhre, G. et al. (1998). New estimates of radiative forcing due to well mixed greenhouse gases. GRL 25. https://doi.org/10.1029/98GL01908
- Noack, L. et al. (2016). Water-rich planets. Icarus 277, 215. https://doi.org/10.1016/j.icarus.2016.05.009
- NASA NSSDC. Earth, Mars and Venus fact sheets. https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html ; /marsfact.html ; /venusfact.html
- O'Gorman, P. A. & Muller, C. J. (2010). Water vapour rate of change in models. https://pog.mit.edu/src/ogorman_muller_wv_rate_2010.pdf
- Pierrehumbert, R. T. & Gaidos, E. (2011). Hydrogen greenhouse planets beyond the habitable zone. ApJL 734, L13. https://ar5iv.labs.arxiv.org/html/1105.0021
- Popp, M., Schmidt, H. & Marotzke, J. (2016). Transition to a moist greenhouse with CO2 and solar forcing. Nat. Commun. https://pmc.ncbi.nlm.nih.gov/articles/PMC4748134/
- Ramirez, R. M. et al. (2014). Warming early Mars with CO2 and H2. Nature Geoscience 7, 59. https://doi.org/10.1038/ngeo2000
- Seager, S. et al. (2007). Mass-radius relationships for solid exoplanets. ApJ 669, 1279. https://ar5iv.labs.arxiv.org/html/0707.2895
- Sleep, N. H., Zahnle, K. J. & Neuhoff, P. S. (2001). Initiation of clement surface conditions on the earliest Earth. PNAS 98, 3666. https://pmc.ncbi.nlm.nih.gov/articles/PMC31109
- Stouffer, R. J. (2004). Time scales of climate response. J. Clim. https://www.gfdl.noaa.gov/bibliography/related_files/rjs0401.pdf
- Walker, J. C. G., Hays, P. B. & Kasting, J. F. (1981). A negative feedback mechanism for the long-term stabilization of Earth's surface temperature. JGR 86, 9776. https://courses.seas.harvard.edu/climate/eli/Courses/EPS281r/Sources/Silicate-weathering-and-CO2/James-Walker-Hays-1981.pdf
- White-Gianella, R. & Krissansen-Totton, J. (2026). Carbon cycle imbalances on arid terrestrial planets. PSJ 7, 79. https://arxiv.org/abs/2604.16846
- Wolf, E. T. & Toon, O. B. (2014). Delayed onset of runaway and moist greenhouse climates for Earth. GRL 41. https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1002/2013GL058376
- Wolf, E. T. & Toon, O. B. (2015). The evolution of habitable climates under the brightening Sun. JGR Atmos. https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2015JD023302
- Wolf, E. T. et al. (2017). Constraints on climate and habitability for Earth-like exoplanets. ApJ. https://arxiv.org/abs/1702.03315
- Wordsworth, R. & Pierrehumbert, R. (2013). Water loss from terrestrial planets with CO2-rich atmospheres. ApJ 778, 154. https://arxiv.org/abs/1306.3266
- Wordsworth, R. et al. (2017). Transient reducing greenhouse warming on early Mars. GRL 44, 665. https://people.seas.harvard.edu/~rwordsworth/papers/wordsworth2017transient.pdf
- Yang, J., Cowan, N. B. & Abbot, D. S. (2013). Stabilizing cloud feedback dramatically expands the habitable zone of tidally locked planets. ApJL 771, L45. https://arxiv.org/abs/1307.0515
- Yang, J. et al. (2014). Strong dependence of the inner edge of the habitable zone on planetary rotation rate. ApJL 787, L2. https://arxiv.org/abs/1404.4992
- Yang, J. et al. (2017). Abrupt climate transition of icy worlds from snowball to moist or runaway greenhouse. Nat. Geosci. https://arxiv.org/abs/1809.01418
- Zeng, L., Sasselov, D. D. & Jacobsen, S. B. (2016). Mass-radius relation for rocky planets based on PREM. ApJ 819, 127. https://ar5iv.labs.arxiv.org/html/1512.08827