# Text to Handwriting Converter

A client-side web app that renders typed text as realistic handwriting on a virtual page, with multiple pen/paper styles and PNG/PDF export. No backend, no build step.

## Run it

Just open `index.html` in a browser, or serve the folder locally (needed if your browser blocks `file://` font loading):

```bash
cd texttohand
python3 -m http.server 8000
# then open http://localhost:8000
```

An internet connection is needed on first load to fetch the Google Fonts (Caveat, Kalam, Shadows Into Light, Homemade Apple, Patrick Hand, Reenie Beanie) and the jsPDF library from their CDNs.

## Structure

```
index.html      page shell + controls markup
css/style.css   layout, theme (light/dark), swatch/paper styling
js/app.js       state, canvas layout engine, rendering, export, drafts
```

## Notable implementation choices

- **Canvas-based rendering** at 150 DPI physical page size (A4/Letter) so on-screen preview and exported PNG/PDF are pixel-identical — no separate "render for export" path.
- **Deterministic per-character jitter**: rotation, position, opacity, ink-color and pressure variation are derived from a stateless hash of `(character index, seed)` rather than `Math.random()` on every render. This means the handwriting look stays stable while you keep typing (no flicker), but a "🎲 Re-roll natural variation" button lets you get a fresh look for the same text.
- **Physical typography**: font size is entered in points and converted at the real DPI, so sizes are meaningful across A4/Letter rather than arbitrary pixel values.
- **Ruled/notebook lines are generated at the same line-height as the text**, not overlaid separately, so text sits on the rule even on a blank page before you've typed a full page.
- **Extras beyond the base spec**: simulated pen-pressure (subtle per-glyph scale variation), aged/cream paper with soft stains + vignette, paper grain texture, light/dark UI theme (page itself always stays paper-colored), autosave to `localStorage`, named draft save/load, and browser print support.

## Known limitations

- A single very long unbroken word wider than the content area is not hyphen-broken (rare in normal use).
- Multi-page PNG export triggers one browser download per page in sequence; some browsers may prompt to allow multiple downloads.
