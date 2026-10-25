#!/usr/bin/env python3
"""Live health check for politicz.org. Fails loudly (exit 1, ::error:: annotations) when the
site is broken; the deployed site itself is never touched.

  python3 ops/health.py                          check the live site
  python3 ops/health.py --wait-build <sha>       first wait for the Pages build of <sha> (needs GITHUB_TOKEN)

Checks: the core pages, every URL in the sitemaps, robots.txt, the IndexNow key file, the TLS
certificate's remaining life, the HTTP-to-HTTPS redirect, and the two public APIs the address
lookup calls from the browser (Census geocoder, 5 Calls).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Checks, fetch, sitemap_locs, tls_days_left, wait_for_pages_build  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://politicz.org/"
HOST = "politicz.org"
INDEXNOW_KEY = "0dec9501cbc566f8a7475aedcedaaac9"
CORE = ["", "law.html", "state/", "thesis.html", "test.html"]
TLS_WARN_DAYS, TLS_FAIL_DAYS = 21, 10
CENSUS = ("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address="
          "1600%20Pennsylvania%20Ave%20NW%2C%20Washington%2C%20DC%2020500"
          "&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json")
FIVE_CALLS = "https://api.5calls.org/v1/reps?location=20500"


def check_pages(c: Checks) -> None:
    for path in CORE:
        status, _, _, body, err = fetch(SITE + path, tries=3)
        if status == 200 and b"Politicz" in body:
            c.ok(f"page /{path}")
        else:
            c.fail(f"page /{path}", f"HTTP {status} {err}".strip() if status != 200 else "200 but no 'Politicz' in the page")


def check_sitemaps(c: Checks) -> None:
    status, _, _, body, err = fetch(SITE + "robots.txt", tries=3)
    text = body.decode("utf-8", "replace")
    if status != 200:
        return c.fail("robots.txt", f"HTTP {status} {err}".strip())
    if f"Sitemap: {SITE}sitemap-index.xml" not in text or "Disallow: /\n" in text + "\n":
        c.fail("robots.txt", "does not allow crawling and list the sitemap index")
    else:
        c.ok("robots.txt")

    urls = []
    status, _, _, body, err = fetch(SITE + "sitemap-index.xml", tries=3)
    kind, maps = sitemap_locs(body) if status == 200 else ("", [])
    if kind != "sitemapindex" or not maps:
        return c.fail("sitemap-index.xml", f"HTTP {status}, not a sitemap index" if status == 200 else f"HTTP {status} {err}")
    c.ok("sitemap-index.xml", f"{len(maps)} sitemaps")
    for m in maps + [SITE + "sitemap.xml"]:
        status, _, _, body, err = fetch(m, tries=3)
        kind, locs = sitemap_locs(body) if status == 200 else ("", [])
        if kind != "urlset" or not locs:
            c.fail(f"sitemap {m}", f"HTTP {status} {err}".strip() if status != 200 else "not a urlset")
            continue
        off = [u for u in locs if not u.startswith(SITE)]
        if off:
            c.fail(f"sitemap {m}", f"{len(off)} URL(s) off {SITE}, e.g. {off[0]}")
        urls += locs
    urls = sorted(set(urls))

    def probe(u):
        return u, fetch(u, tries=3, limit=300_000)

    with ThreadPoolExecutor(max_workers=8) as pool:
        bad = [(u, r[0], r[4]) for u, r in pool.map(probe, urls) if r[0] != 200]
    if bad:
        for u, status, err in bad[:20]:
            c.fail(f"sitemap URL {u}", f"HTTP {status} {err}".strip())
    else:
        c.ok("every sitemap URL answers 200", f"{len(urls)} URLs")


def check_plumbing(c: Checks) -> None:
    status, _, _, body, err = fetch(f"{SITE}{INDEXNOW_KEY}.txt", tries=3)
    if status == 200 and body.decode("utf-8", "replace").strip() == INDEXNOW_KEY:
        c.ok("IndexNow key file")
    else:
        c.fail("IndexNow key file", f"HTTP {status} {err}".strip() if status != 200 else "content does not match the key")

    try:
        days = tls_days_left(HOST)
        if days < TLS_FAIL_DAYS:
            c.fail("TLS certificate", f"expires in {days:.1f} days; GitHub Pages should have renewed it by now")
        elif days < TLS_WARN_DAYS:
            c.warn("TLS certificate", f"expires in {days:.1f} days; GitHub Pages normally renews about 30 days ahead")
        else:
            c.ok("TLS certificate", f"{days:.0f} days left")
    except Exception as e:  # handshake failure, expired or wrong-host certificate
        c.fail("TLS certificate", f"{type(e).__name__}: {e}")

    status, _, headers, _, err = fetch(f"http://{HOST}/", follow=False, tries=2)
    if status in (301, 308) and headers.get("location", "").startswith("https://"):
        c.ok("HTTP redirects to HTTPS")
    else:
        c.warn("HTTP redirects to HTTPS", f"http://{HOST}/ answered {status} {err}".strip())


def check_apis(c: Checks) -> None:
    status, _, _, body, err = fetch(CENSUS, tries=3, timeout=30)
    try:
        matches = json.loads(body)["result"]["addressMatches"] if status == 200 else []
    except (ValueError, KeyError, TypeError):
        matches = []
    if matches:
        c.ok("Census geocoder (address lookup)")
    else:
        c.fail("Census geocoder (address lookup)", f"HTTP {status} {err}; address lookup can't find jurisdictions".strip())

    status, _, _, body, err = fetch(FIVE_CALLS, tries=3, timeout=30)
    try:
        reps = json.loads(body).get("representatives") if status == 200 else None
    except ValueError:
        reps = None
    if reps:
        c.ok("5 Calls representatives API")
    else:  # the page already falls back to browsing by state and city
        c.warn("5 Calls representatives API", f"HTTP {status} {err}; lookups fall back to state/city browsing".strip())


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Live health check for politicz.org.")
    ap.add_argument("--wait-build", metavar="SHA", help="wait for the Pages build of this commit first")
    args = ap.parse_args(argv)
    c = Checks("politicz.org health")
    if args.wait_build:
        built, detail = wait_for_pages_build(os.environ.get("GITHUB_REPOSITORY", "theguysaccount/politicz"), args.wait_build)
        (c.ok if built else c.fail)("Pages build", detail)
    check_pages(c)
    check_sitemaps(c)
    check_plumbing(c)
    check_apis(c)
    return c.finish()


if __name__ == "__main__":
    sys.exit(main())
