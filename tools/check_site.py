#!/usr/bin/env python3
"""SEO + performance (GTmetrix) checks for the Zivora Accessories site.

Run before every commit:   python3 tools/check_site.py
Exits non-zero if any check FAILS. WARN lines are worth a look but don't block.
Uses only the Python standard library.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://zivoraaccessories.in/"

# Performance budgets (bytes) - keep the GTmetrix grade at A
BUDGET_CRITICAL = 250_000   # HTML + CSS + JS + fonts + hero image (what loads first)
BUDGET_FONTS = 110_000      # all woff2 files together
BUDGET_THUMB = 160_000      # any single responsive WebP thumbnail (-480/-800)
BUDGET_JS = 20_000
BUDGET_CSS = 40_000
MAX_PRELOADS = 3
MAX_DOM = 1000              # GTmetrix flags "excessive DOM size" well above this

fails, warns, oks = [], [], []
def ok(m): oks.append(m)
def warn(m): warns.append(m)
def fail(m): fails.append(m)
def size(p): return os.path.getsize(os.path.join(ROOT, p))
def exists(p): return os.path.isfile(os.path.join(ROOT, p))


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.stack, self.text = [], [], {}
        self.count = 0
        self.title = ""
        self._in = None
        self.jsonld = []
        self._buf = ""

    def handle_starttag(self, tag, attrs):
        self.count += 1
        a = dict(attrs)
        self.tags.append((tag, a))
        if tag in ("title", "h1") or (tag == "script" and a.get("type") == "application/ld+json"):
            self._in, self._buf = tag if tag != "script" else "ld", ""

    def handle_endtag(self, tag):
        if self._in == "title" and tag == "title":
            self.title = self._buf.strip()
        elif self._in == "h1" and tag == "h1":
            self.text.setdefault("h1", []).append(self._buf.strip())
        elif self._in == "ld" and tag == "script":
            self.jsonld.append(self._buf)
        else:
            return
        self._in = None

    def handle_data(self, data):
        if self._in:
            self._buf += data


html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
p = Page()
p.feed(html)
tags = p.tags
def find(tag, **kw):
    return [a for t, a in tags if t == tag and all(a.get(k) == v for k, v in kw.items())]
def meta(name=None, prop=None):
    m = find("meta", name=name) if name else find("meta", property=prop)
    return m[0].get("content", "") if m else None

# ---------------- SEO ----------------
t = p.title
(ok if 30 <= len(t) <= 60 else fail)(f"<title> length {len(t)} (30-60): {t!r}")
d = meta(name="description") or ""
(ok if 120 <= len(d) <= 160 else fail)(f"meta description length {len(d)} (120-160)")
h1 = p.text.get("h1", [])
(ok if len(h1) == 1 else fail)(f"exactly one <h1> (found {len(h1)})")
if h1 and "Zivora Accessories" not in h1[0]:
    warn("H1 does not contain the brand name 'Zivora Accessories'")
canon = [a for a in find("link", rel="canonical")]
(ok if canon and canon[0].get("href") == SITE else fail)("canonical URL set to " + SITE)
lang = re.search(r'<html[^>]*\blang="([^"]+)"', html)
(ok if lang else fail)(f"<html lang> set ({lang.group(1) if lang else 'missing'})")
robots = meta(name="robots") or ""
(fail if "noindex" in robots else ok)(f"robots meta allows indexing ({robots or 'not set'})")
(ok if meta(name="viewport") else fail)("viewport meta present")
for prop in ("og:title", "og:description", "og:image", "og:url", "og:type"):
    (ok if meta(prop=prop) else fail)(f"{prop} present")
(ok if meta(name="twitter:card") else warn)("twitter:card present")
ogi = meta(prop="og:image") or ""
if ogi.startswith(SITE) and not exists(ogi[len(SITE):]):
    fail(f"og:image file missing: {ogi}")

for i, block in enumerate(p.jsonld):
    try:
        json.loads(block)
        ok(f"JSON-LD block {i + 1} is valid JSON")
    except ValueError as e:
        fail(f"JSON-LD block {i + 1} invalid: {e}")
if not p.jsonld:
    fail("no JSON-LD structured data")

# Headings order: no skipping from h1 straight to h3 etc. (rough check)
levels = [int(t[1]) for t, _ in tags if re.fullmatch(r"h[1-6]", t)]
jumps = [(a, b) for a, b in zip(levels, levels[1:]) if b > a + 1]
(warn if jumps else ok)(f"heading levels don't skip ({len(jumps)} skips)")

# Images: alt, dimensions, lazy loading
imgs = find("img")
no_alt = [a.get("src") for a in imgs if a.get("alt") is None or (a.get("alt") == "" and "lightbox__img" not in a.get("class", ""))]
(ok if not no_alt else fail)(f"all <img> have alt text ({len(no_alt)} missing: {no_alt[:3]})")
no_dim = [a.get("src") for a in imgs if a.get("src") and not (a.get("width") and a.get("height"))]
(ok if not no_dim else fail)(f"all <img> have width/height (prevents layout shift) ({len(no_dim)} missing)")
eager = [a.get("src") for a in imgs if a.get("src") and a.get("loading") != "lazy"]
(ok if len(eager) <= 3 else warn)(f"{len(eager)} images load eagerly (only above-the-fold ones should): {eager}")

# Videos: must not load before the user scrolls to them, and must be described for Google
vids = find("video")
lazy_v = [a for a in vids if a.get("preload") == "none" and "autoplay" not in a]
(ok if len(lazy_v) == len(vids) else fail)(f"all <video> use preload=none and no autoplay attribute ({len(lazy_v)}/{len(vids)})")
(ok if all(a.get("width") and a.get("height") for a in vids) else fail)("all <video> have width/height")
js_v = [a for a in vids if "controls" not in a]
(ok if all("muted" in a and "playsinline" in a and a.get("data-poster") for a in js_v) else fail)(
    "scripted <video> are muted + playsinline with a deferred data-poster")
(ok if not js_v or html.count('"VideoObject"') >= len(js_v) else fail)(f"VideoObject JSON-LD for each video ({html.count('VideoObject')})")
big_v = [f for f in os.listdir(os.path.join(ROOT, "assets")) if f.endswith(".mp4") and size("assets/" + f) > 2_000_000]
(ok if not big_v else fail)(f"video files under 2 MB each ({big_v})")

# Links: no empty hrefs, external links safe
for a in find("a"):
    h = a.get("href")
    if not h or h == "#":
        fail(f"empty link href: {a}")
    if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
        fail(f"target=_blank without rel=noopener: {h}")
ids = set(a.get("id") for _, a in tags if a.get("id"))
for a in find("a"):
    h = a.get("href", "")
    if h.startswith("#") and len(h) > 1 and h[1:] not in ids:
        fail(f"in-page link points to missing id: {h}")

# robots.txt + sitemap
rb = open(os.path.join(ROOT, "robots.txt")).read() if exists("robots.txt") else ""
(ok if "Sitemap:" in rb and "Disallow: /" not in rb.replace("Disallow: /\n", "X") else fail)("robots.txt allows crawling and lists sitemap")
if exists("sitemap.xml"):
    try:
        root = ET.parse(os.path.join(ROOT, "sitemap.xml")).getroot()
        locs = [e.text for e in root.iter() if e.tag.endswith("loc")]
        missing = [l for l in locs if l.startswith(SITE) and l != SITE and not exists(l[len(SITE):])]
        (ok if not missing else fail)(f"sitemap.xml valid, {len(locs)} URLs, missing files: {missing}")
    except ET.ParseError as e:
        fail(f"sitemap.xml invalid XML: {e}")
else:
    fail("sitemap.xml missing")

# ---------------- Performance (GTmetrix) ----------------
refs = set(re.findall(r'(?:src|href|srcset|imagesrcset)="([^"]+)"', html))
local = set()
for r in refs:
    for part in r.split(","):
        u = part.strip().split(" ")[0]
        if u and not re.match(r"(https?:|mailto:|tel:|#|data:)", u):
            local.add(u.lstrip("/"))
css = open(os.path.join(ROOT, "styles.css"), encoding="utf-8").read()
local |= set(re.findall(r'url\("?([^")]+)"?\)', css))
missing = sorted(u for u in local if u and not exists(u))
(ok if not missing else fail)(f"every referenced local file exists ({len(missing)} missing: {missing[:5]})")

# The hero (LCP) must be visible at first paint: fade-in classes there make Lighthouse/GTmetrix
# fail with "Failed to find the Largest Contentful Paint"
hero_html = html[html.find('class="hero"'):html.find("<!-- MARQUEE -->")]
(ok if " reveal" not in hero_html and '"reveal' not in hero_html else fail)("hero has no fade-in (reveal) classes, so LCP is visible at first paint")
(ok if ".js .reveal" in css or ".reveal" not in css else fail)("reveal animation only hides content when JS runs (.js .reveal)")

# Third-party requests slow the page and trigger the GTmetrix CDN/request-chain audits
ext = [a.get("src") or a.get("href") for t, a in tags
       if t in ("script", "link", "img", "iframe", "source")
       and re.match(r"https?://", (a.get("src") or a.get("href") or ""))
       and a.get("rel") not in ("canonical",)]
(ok if not ext else fail)(f"no third-party scripts/styles/fonts/images loaded ({ext})")

js_b, css_b = size("script.js"), size("styles.css")
(ok if js_b <= BUDGET_JS else fail)(f"script.js {js_b / 1024:.1f} KB (budget {BUDGET_JS // 1024} KB)")
(ok if css_b <= BUDGET_CSS else fail)(f"styles.css {css_b / 1024:.1f} KB (budget {BUDGET_CSS // 1024} KB)")
fonts = [f for f in os.listdir(os.path.join(ROOT, "assets/fonts")) if f.endswith(".woff2")]
font_b = sum(size("assets/fonts/" + f) for f in fonts)
(ok if font_b <= BUDGET_FONTS else fail)(f"fonts {len(fonts)} files, {font_b / 1024:.0f} KB (budget {BUDGET_FONTS // 1024} KB)")
unused = [f for f in fonts if f not in css]
(ok if not unused else fail)(f"no unused font files ({unused})")
(ok if css.count("font-display: swap") >= len(fonts) else fail)("every @font-face uses font-display: swap")

pre = find("link", rel="preload")
(ok if len(pre) <= MAX_PRELOADS else fail)(f"{len(pre)} preloads (max {MAX_PRELOADS}; too many compete with the hero image)")
hero = [a for a in pre if a.get("as") == "image"]
(ok if hero else warn)("hero (LCP) image is preloaded")

big = []
for f in os.listdir(os.path.join(ROOT, "assets")):
    if re.search(r"-(480|800)\.webp$", f) and size("assets/" + f) > BUDGET_THUMB:
        big.append(f)
(ok if not big else fail)(f"responsive thumbnails under {BUDGET_THUMB // 1024} KB ({big})")
pics = html.count("<picture>")
srcs = len(re.findall(r'<source srcset="[^"]*480w', html))
(ok if srcs >= pics else warn)(f"{srcs}/{pics} <picture> elements offer a 480w WebP")
heavy_png = [a.get("src") for a in imgs if (a.get("src") or "").endswith(".png") and size(a["src"]) > 50_000]
(ok if not heavy_png else fail)(f"no heavy PNGs used as <img> ({heavy_png})")

crit = len(html.encode()) + css_b + js_b
crit += sum(size("assets/fonts/" + f) for f in fonts)
if hero:
    first = hero[0].get("imagesrcset", hero[0].get("href", "")).split(",")[0].strip().split(" ")[0]
    if exists(first):
        crit += size(first)
(ok if crit <= BUDGET_CRITICAL else warn)(f"first-load weight ~{crit / 1024:.0f} KB (budget {BUDGET_CRITICAL // 1024} KB)")
(ok if p.count <= MAX_DOM else warn)(f"DOM elements: {p.count} (GTmetrix warns when large)")
(ok if exists("vercel.json") and "Cache-Control" in open(os.path.join(ROOT, "vercel.json")).read() else warn)(
    "long cache headers for /assets in vercel.json")

# ---------------- Report ----------------
for m in oks:
    print("  OK   ", m)
for m in warns:
    print("  WARN ", m)
for m in fails:
    print("  FAIL ", m)
print(f"\n{len(oks)} ok, {len(warns)} warnings, {len(fails)} failures")
sys.exit(1 if fails else 0)
