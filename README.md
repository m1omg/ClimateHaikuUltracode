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

On a phone the controls come straight after the planet, in a drawer that starts
closed, so the clock is one tap below the planet.

## How the clock runs in the page

Simulated time moves only through `ClimateModel.Clock.advance`. Each frame's
wall-clock time is clamped to 0.25 s, so a stall does not make time catch up.
That time is spent in slices of at most 2 ms of wall time, and each slice ends
exactly on the next history sample time, so the trajectory does not depend on
the frame rate. Each frame may spend about 12 ms on the model. Wall time that
the budget does not cover in a frame is dropped. On a slow device the clock then
runs below the selected speed, and the readout says what share is running.
Time already passed to the clock is kept when the speed changes.

History samples sit on a simulated-time grid, and the grid doubles when the
buffer (600 samples) is full. Spin and cloud drift follow the continuous
simulated time. At very high speeds the planet turns many times between frames,
so its spin shows as aliasing; the phase is still exact simulated time. A
fixed 30-per-second tick drives twinkling. Reduced motion slows spin and drift
to a fifth and turns off twinkling. It does not change the physics.

## Running the tests

Requires Node.js. There are no dependencies.

    npm test

This runs `node --test tests/*.test.js`. `node --test tests/` runs the same tests:
on Node 22 a directory argument is read as a module path, so `tests/index.js`
loads the suite. The physics tests are in `tests/model.test.js`.

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
- Water vapour does not condense back into the ocean. A planet that has lost water
  to the air keeps it when it cools, and dry steam persists. This is the largest
  known gap (`docs/MODEL.md`, section 7, deviation 15).
- Above about 520 K the grey outgoing infrared falls for a wet planet, so the
  energy chart shows a second crossing (deviation 16).
- Weathering is held at its 330 K value above 330 K and scales linearly with
  land area (section 2.11). Both are game choices and are documented.
- The grey optical depth and the thick-CO2 term are calibrated fits, not line-by-line
  radiation. Calibration constants and their basis are listed in `docs/MODEL.md`.
- With these choices the runaway onset sits near 1.19 times the present sunlight and the
  moist-greenhouse onset near 1.20. These are higher than the 1-D estimates and at the
  upper end of the 3-D range.
- With Earth gases the cold, frozen state stays stable over a wide range of
  sunlight (about 0.905 to 1.25 times the present), so the starting state can decide
  the outcome (section 2.8).
- The runaway and moist onsets come in the opposite order to the brief's
  expected sequence. This is discussed in `docs/MODEL.md`, section 7.
- Some climate states are classified from the model's output but their physics is
  not simulated (Titan-like hydrocarbons, hycean ice layers, eyeball geometry,
  hadean magma oceans). See `docs/MODEL.md`, section 5.
- The source of every number and the list of deviations from the research brief are in
  `docs/MODEL.md` and `docs/climate-research-brief.md`.
