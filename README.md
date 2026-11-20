# Exhaust Spectrum Studio

A static, browser-local FSAE exhaust design explorer. Open `index.html` directly or use the GitHub Pages site. No build step or server-side processing is required.

## What it includes

- Four 511-bin Audacity relative-level exports supplied by the project: straight pipe, free packed muffler, cone muffler, and half-outlet taped cone muffler.
- A custom two-column frequency/level map importer and modeled CSV export.
- Sliders for pipe and housing size, packed-section length, two perforated cones, packing and perforation assumptions, and two sealed side-branch resonators.
- A logarithmic spectrum plot, low-frequency probe, and calculated resonator center frequencies and cavity volumes.

The measured observations shown in the page are 120 dBC for the untaped cone and 115 dBC for the half-outlet taped cone at 0.5 m and 45°. The design target is 110 dBC. **The model does not predict dBC or whether a design will meet that target.** The Audacity levels are relative export levels, not a calibrated sound pressure spectrum. The taped-outlet result may include changed radiation pattern, flow, and backpressure.

## Model

For each side branch, cavity volume `V = π Dᵢ² Lᵥ / 4`, neck area `Aₙ = π dₙ² / 4`, and effective neck length `Lₑ = Lₙ + 0.85 dₙ`. The estimated resonance is `f₀ = c/(2π) sqrt(Aₙ/(V Lₑ))`. The neck and cavity values shown are assumed internal dimensions based on a 2 mm wall subtracted from the OD sliders. The end correction is a rough approximation.

The frequency-dependent loss uses an idealized shunt impedance with `R = ω₀(Lₑ/Aₙ)/Q`, `X = ωLₑ/Aₙ − c²/(ωV)`, `Z₀ = c/Aₚ`, and `TL = 10 log₁₀{[(R + Z₀/2)² + X²]/[R² + X²]}`. The displayed effect of each branch is capped at 24 dB. The two branch losses are added. This assumes linear acoustics and ignores mean flow, temperature gradients, branch interaction, and engine coupling.

The high-frequency packed-section trend uses octave-band differences between the free packed muffler and straight-pipe exports. It is scaled by assumed packing, radial depth, perforation open area, and hole diameter. The cone term is a bounded frequency trend based on cone length and area ratio, **not a validated cone transmission-loss equation**. The model labels this as an estimate. For an existing muffler export, select “After current muffler” to model resonators only and avoid subtracting packing twice.

## Engineering use

Use the site to compare candidate dimensions and identify a frequency to prototype. Validate on the car at the same RPM, load, meter location, weighting, and environmental conditions. Measure exhaust pressure upstream of the muffler. A flush side branch keeps the main passage open in steady flow, but its junction and reflected pressure waves can still affect performance. Cavity temperatures and installed neck details should be measured before final tuning.

## References

- [Exhaust resonator study, Ohio State](https://mae.osu.edu/sites/default/files/2021-12/J67.pdf)
- [NACA side-branch analysis](https://ntrs.nasa.gov/api/citations/19930083819/downloads/19930083819.pdf)
- [Perforated-duct muffler study, SAE](https://saemobilus.sae.org/papers/a-basic-study-acoustic-response-non-symmetric-perforated-duct-mufflers-2011-37-0023)

The source files `index.html`, `styles.css`, `app.js`, and `data.js` are sufficient to host the site on any static web host.
