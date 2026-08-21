# 🌌 Night Sky

A pocket planetarium for your Android phones — a Progressive Web App (PWA), so
there's nothing to sideload and no app store involved. Open it in Chrome, add it
to your home screen, and it behaves like a native app (full screen, its own icon,
works offline).

## What it does

- **Live sky map** — 5,000+ real stars (Hipparcos catalog, down to magnitude 6),
  all 88 constellations with figures and names, the Moon with its correct phase,
  the Sun, all seven planets, and 32 bright deep-sky objects (Andromeda Galaxy,
  Orion Nebula, Pleiades…), all computed for your exact location and time.
- **🧭 Point-at-sky mode** — hold your phone up and aim it at the sky; the map
  follows using the phone's compass and tilt sensors, so you can answer
  "what is *that* bright thing?" by pointing at it.
- **Tap to identify** — tap any star, planet, or the Moon for its name,
  brightness, direction, altitude, and rise/set times.
- **🔍 Search** — find anything by name and get a guidance arrow (or an
  automatic fly-to) leading you to it.
- **✨ Tonight panel** — sunset, true darkness hours, moon phase,
  moonrise/moonset, and which planets are visible tonight and where to look.
- **🕐 Time travel** — scrub ±12 hours or jump to any date to plan an evening.
- **🔴 Night vision mode** — turns the whole app deep red so your
  dark-adapted eyes stay that way.
- **Offline** — after the first visit everything is cached; it works in the
  middle of nowhere (which is where the good skies are).

## Install it on your phones

1. Host this folder anywhere that serves static files over **HTTPS**
   (see below), or try it locally first.
2. On each phone, open the URL in **Chrome**.
3. Allow location access, or type in coordinates manually.
4. Menu (⋮) → **Add to Home screen** → **Install**.

> HTTPS is required for geolocation, compass access, and offline caching —
> that's a browser rule, not ours.

### Easiest hosting: GitHub Pages

This repo is a fully static site — no build step.

1. In the GitHub repo: **Settings → Pages**.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick `main`
   and `/ (root)`, and save.
3. Your app appears at `https://<user>.github.io/website/` in a minute or two.
   (A custom domain configured in the same settings page works too.)

### Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

(Compass mode needs HTTPS or localhost; geolocation too.)

## Tips for actual stargazing

- Turn on **🔴 night mode** and drop your screen brightness all the way down.
- Phone compasses drift: wave the phone in a **figure-8** to calibrate, and
  expect the map to be off by a few degrees (compasses point at *magnetic*
  north). Fine-tune by dragging, then re-enable 🧭.
- The **Tonight** panel is the planning tool: check "truly dark" hours and
  where the planets will be before heading out.

## Tech notes

- Pure static HTML/CSS/JS — no frameworks, no build, no tracking, no network
  calls after first load. Location never leaves the phone.
- Astronomy engine implements algorithms from Meeus, *Astronomical
  Algorithms* (2nd ed.): solar position (~0.01°), lunar position (truncated
  ELP-2000 series, ~0.05°), planetary positions from the JPL approximate
  Keplerian elements (valid 1800–2050), precession, sidereal time, and
  rise/set/twilight iteration.
- Rendering is a stereographic projection on a single `<canvas>`.

## Data attribution

Star, constellation, and deep-sky data are derived from
[d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn
(BSD-3-Clause), which in turn builds on the Hipparcos catalogue and other
public astronomical sources.
