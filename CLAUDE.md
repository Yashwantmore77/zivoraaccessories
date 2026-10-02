# Zivora Accessories website

Static site (no build step) deployed on Vercel from `main`: `index.html`, `styles.css`, `script.js`, images and fonts in `assets/`.
Work on a branch and open a PR. Merging to `main` deploys to production.

## Required on EVERY change: SEO + GTmetrix check

The owner tracks Google ranking and the GTmetrix grade, so every change must stay SEO friendly and fast. Before committing:

1. **Run the checker:** `python3 tools/check_site.py`. It must end with **0 failures**. Fix any FAIL, and look at every WARN.
2. **Check in a real browser** (Playwright with Chromium at `/opt/pw-browsers/chromium`):
   - Desktop 1366px and phone 390px: no horizontal scroll and no JS errors.
   - Header: every nav item, including the "DM to Order" button, stays on one line at every width from 1181px to 2560px. Below 1180px the ☰ menu is used. When adding a nav link, re-check this, and raise the breakpoint in `styles.css` if needed.
   - LCP under a throttled network (about 5 Mbps, 150 ms RTT) stays under about 1s locally. The LCP element is the hero image.
   - Anything below the fold loads lazily: no new requests before the user scrolls to it.
   - Also run Lighthouse (the engine behind GTmetrix) against a local server: `python3 -m http.server 8765`, then `CHROME_PATH=/opt/pw-browsers/chromium npx lighthouse http://127.0.0.1:8765/ --preset=desktop --chrome-flags="--headless=new --no-sandbox"`. Run it again without `--preset` for mobile. There must be no runtime error, desktop performance/SEO/accessibility/best-practices should stay at 100, and CLS must stay under 0.1.
3. **Say in the PR** that both checks were run, and give the key numbers (LCP, page weight, checker result).

### Rules that keep the grade at A
- **No third-party requests.** No Google Fonts, CDNs, embeds or trackers without asking first. Fonts are self-hosted and subset in `assets/fonts/`.
- **Every image:**
  - descriptive, keyword-rich `alt` text
  - `width` and `height` set
  - `loading="lazy"` unless it is above the fold
  - wrapped in `<picture>` with 480w/800w WebP `srcset` and `sizes`. Generate the variants with Pillow, quality about 78.
  - File names start with `zivoraaccessories-`.
- **Never hide the hero.** Nothing above the fold may start at `opacity: 0` or rely on JS to appear, or Lighthouse/GTmetrix fails with "Failed to find the Largest Contentful Paint". Fade-ins (`.reveal`) are for below-the-fold sections only and are gated on the `js` class.
- **Media must never depend on JS to become visible** (iPhones on slow data showed an empty gallery). No `.reveal` on the gallery slider or video reels. A 3-second `reveal-all` safety net in `<head>` shows all sections if `script.js` is late. Size media boxes with a padding ratio (`height:0; padding-top:…%`), not `aspect-ratio` on `<button>`. iPhone browsers all use WebKit, which isn't available here, so be conservative with newer CSS.
- **No layout shift from fonts:** keep the metric-matched fallback `@font-face` rules ("DM Sans Fallback", "Cormorant Fallback") in front of the generic fallbacks.
- **Contrast:** small text must reach at least 4.5:1. Use `--muted` (#7a5f53) and `--gold-text` (#8c6224) for text, and keep `--gold` for lines and decoration.
- **Preloads:** at most 3, and the hero image keeps `fetchpriority="high"`. Don't preload anything that competes with it.
- **Fonts:** only the faces in use. Subset with `pyftsubset`, keep `font-display: swap`, and keep the total under about 110 KB.
- **Budgets** (enforced by the checker): JS under 20 KB, CSS under 40 KB, first load under about 250 KB.
- **Large collections** (gallery, products) go in sliders or paginated views. Don't add long grids that grow the DOM and page height.

### SEO rules
- One `<h1>`; heading levels don't skip.
- Title 30–60 characters, meta description 120–160 characters, canonical `https://zivoraaccessories.in/`, `lang="en-IN"`.
- Keep the Open Graph/Twitter tags and the JSON-LD (Organization, WebSite, WebPage) valid and up to date.
- Add new pages and important new images to `sitemap.xml`, and update `<lastmod>`.
- Keywords and hashtags are listed in `SEO.md`.

## Brand
- Always write the full name **"Zivora Accessories"**, never "Zivora" alone (trademark caution). The domain and handle form is `zivoraaccessories`.
- Instagram links currently go to `https://www.instagram.com/zivora_accessories_/`. The logo shows `@zivoraaccessories`; the owner still needs to confirm which handle is correct.
- Palette: cream `#fbf6ef`, brown `#5a2e1f`, rose `#c96a7b`, gold `#b8893b`. Fonts: Cormorant Garamond (headings), DM Sans (body), Great Vibes (script accents).
