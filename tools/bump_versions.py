#!/usr/bin/env python3
"""Add a content fingerprint (?v=<hash>) to every local file URL in index.html and styles.css.

Run after ANY change to styles.css, script.js or a file in assets/:
    python3 tools/bump_versions.py
Browsers cache these files for a year (see vercel.json); the fingerprint changes whenever
the file's content changes, so visitors always get the new version (no stale CSS on phones).
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = r"(?:css|js|webmanifest|webp|webm|jpg|jpeg|png|mp4|woff2|svg)"
URL = re.compile(r'(?<![\w/.:-])((?:assets/[\w./-]+?|styles|script|site)\.' + EXT + r')(\?v=[0-9a-f]+)?')

def fp(path):
    with open(os.path.join(ROOT, path), "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:10]

def rewrite(text, base=""):
    def sub(m):
        url = m.group(1)
        path = os.path.normpath(os.path.join(base, url))
        if not os.path.isfile(os.path.join(ROOT, path)):
            return m.group(0)
        return f"{url}?v={fp(path)}"
    return URL.sub(sub, text)

def versioned_attrs(html):
    # only rewrite URLs inside attributes the browser fetches (not JSON-LD / OG / canonical)
    attr = re.compile(r'((?:src|srcset|href|data-src|data-poster|data-full|poster|imagesrcset)=")([^"]*)(")')
    def fix(m):
        if m.group(2).startswith("http"):
            return m.group(0)
        return m.group(1) + rewrite(m.group(2)) + m.group(3)
    return attr.sub(fix, html)

def main():
    # CSS first (its own hash changes when font URLs change), then HTML
    css_p = os.path.join(ROOT, "styles.css")
    css = open(css_p, encoding="utf-8").read()
    css2 = re.sub(r'url\("([^")]+)"\)', lambda m: 'url("' + rewrite(m.group(1)) + '")', css)
    if css2 != css:
        open(css_p, "w", encoding="utf-8").write(css2)
    html_p = os.path.join(ROOT, "index.html")
    html = open(html_p, encoding="utf-8").read()
    html2 = versioned_attrs(html)
    if html2 != html:
        open(html_p, "w", encoding="utf-8").write(html2)
    print("versions updated" if (html2 != html or css2 != css) else "versions already current")

if __name__ == "__main__":
    main()
