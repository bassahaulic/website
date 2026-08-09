# Bassahaulic Website

Website and shop tools for Bassahaulic.

## Enclosure Pricing Tool

`index.html` — a self-contained subwoofer enclosure quoting tool for the shop. No build step, no dependencies; open the file in a browser or host it on any static host.

Features:

- Spec out a build: sub size/count, sealed / ported / bandpass, external dimensions (with an auto-size helper), sheet stock, double baffle, bracing, kerfed port, finish, and add-ons.
- Live net-volume check against recommended airspace for the selected subs.
- Itemized quote: sheet count, labor hours, finish materials, hardware, shop margin, rush surcharge, minimum-job floor, and a 50% deposit line.
- **Shop rates** panel (top right) — edit labor rate, sheet prices, margin, and hardware pricing. Rates persist in the browser via `localStorage`, so pricing can be tuned without touching code.
- Print stylesheet renders a clean customer-facing quote; **Copy** puts a plain-text summary on the clipboard.
