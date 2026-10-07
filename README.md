# Climate Forge

Climate Forge is a browser game about a terrestrial planet's climate. You set
the planet's mass, water, land, starlight, rotation and atmosphere, then run
time forward from one year per second up to one gigayear per second. The planet
moves between climate states: snowball, temperate, moist greenhouse, runaway,
steam, Venus-like, Mars-like and others.

## Opening the game

Open `index.html` in a modern browser. No server, build step or network access
is needed. The page loads plain classic scripts in this order: `js/model.js`,
`js/render.js`, `js/ui.js`, `js/main.js`.

## Playing

The page has three parts. The planet view shows the surface, clouds, halo and
star. The climate state panel gives the classification, readouts and reservoir
lag meters. The energy diagram and the history chart show the balance and how
the planet has moved.

- **Presets** set the whole planet. Editing any slider afterwards makes the
  settings custom, and the state carries on from where it is.
- **Planet, star, air, carbon** sliders change one parameter each. Gas and water
  inventories take effect at once. The others change the forcing and the model
  responds over time.
- **Clock**: pause or play, reset, and a speed from 1 yr/s to 1 Gyr/s in decade
  steps. The sub-step size depends only on the speed.
- **Keys**: space pauses, `-` and `+` change speed, `R` resets, `1` to `9` pick
  presets, `H` opens the help and glossary.

On a phone the controls sit in a drawer below the readouts. It starts closed.

## How the clock runs in the page

Simulated time moves only through `ClimateModel.Clock.advance`. Each frame's
wall-clock time is clamped to 0.25 s and added to a short debt. The debt is
spent in slices of at most 2 ms of wall time, and each slice ends exactly on the
next history sample time, so the trajectory does not depend on the frame rate.
Samples are kept on a simulated-time grid, and the grid doubles when the buffer
(600 samples) is full. Unspent debt is capped at 0.1 s. Each frame may spend
about 12 ms on the model. At the top speed a slow device can run below the
selected speed. The clock readout then says what share of the speed is running.
Animation is driven by simulated time (spin, cloud drift) and by a fixed
30-per-second tick for twinkling. Reduced motion slows spin and drift to a fifth
and turns off twinkling. It does not change the physics.

## Running the tests

Requires Node.js. There are no dependencies.

    npm test

This runs `node --test tests/*.test.js`. On Node 22 the form `node --test tests/`
does not find the test files, so the glob is used. The physics tests are in
`tests/model.test.js`.

## Physics

The model is a zero-dimensional energy balance. A mixed layer and a deep
ocean are coupled with exact relaxation. Sea ice relaxes toward a
temperature-dependent equilibrium, with a 100-year time constant. Outgoing
infrared is capped at 282 W m^-2 (the clear-sky moist limit), and a grey
optical depth tracks CO2, water vapour, methane, hydrogen and nitrogen
broadening. Starlight brightens following the Gough (1981) law. Carbon is drawn
down by silicate weathering, which speeds up with temperature. Hydrogen and water escape
slowly in a moist atmosphere, on Gyr timescales.

Caveats:

- The model has no latitude structure and no heat transport. Cloud feedback is not represented.
- The grey optical depth and the thick-CO2 term are calibrated fits, not line-by-line
  radiation. Calibration constants and their basis are listed in `docs/MODEL.md`.
- With these choices the moist-greenhouse and runaway thresholds sit near 1.19 to 1.21
  times the present sunlight, which is higher than the 1-D estimates and at the upper end of the 3-D range.
- The runaway and moist onsets come in the opposite order to the brief's
  expected sequence. This is discussed in `docs/MODEL.md`, section 7.
- Some climate states are classified from the model's output but their physics is
  not simulated (Titan-like hydrocarbons, hycean ice layers, eyeball geometry,
  hadean magma oceans). See `docs/MODEL.md`, section 5.
- The source of every number and the list of deviations from the research brief are in
  `docs/MODEL.md` and `docs/climate-research-brief.md`.
