#!/usr/bin/env python3
"""Weekly link check of every meeting calendar and statute source in politicz-data.js.

  python3 ops/link_check.py                 check every URL, write ops/link-report.{json,md}
  python3 ops/link_check.py --limit 10      check only the first 10 (a quick smoke test)

Each URL is fetched like a browser would (GET, redirects followed, two tries) and classed:

  ok           answered 2xx after redirects
  unverified   the server answered but refused an automated check (401, 403, 429, 503...)
               or timed out; usually bot protection, so it is reported, not counted as broken
  broken       404/410 and other hard errors, 5xx after retries, DNS or TLS failures

Broken entries are flagged as warnings in the Actions log and listed in ops/link-report.md.
The run only fails when the data can't be read, or when so many URLs get no answer at all that
the runner's own network is the likely problem (then no report is written). The site is never
touched, so the last good deploy stays live.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BROWSER_UA, annotate, fetch, summary  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "politicz-data.js"
REPORT_JSON = ROOT / "ops" / "link-report.json"
REPORT_MD = ROOT / "ops" / "link-report.md"
UNVERIFIED_CODES = {401, 403, 405, 406, 429, 451, 503, 999}
SYSTEMIC_SHARE = 0.4  # this share of URLs getting no answer at once points at the runner, not the data


def load_data(path: Path = DATA) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\.__PZ_DATA__\s*=\s*(\{.*?\})\s*;?\s*\n", text, re.S)
    if not m:
        raise ValueError("window.__PZ_DATA__ not found in politicz-data.js")
    return json.loads(m.group(1))


def entries(data: dict) -> list[dict]:
    names = dict(data.get("SN", {}).items()) if isinstance(data.get("SN"), dict) else {}
    out = []
    for st, law in sorted(data["LAW"].items()):
        out.append({"kind": "statute", "id": st, "name": f"{names.get(st, st)}: {law.get('n', '')}", "url": law.get("u") or ""})
    for city in data["CITY"]:
        out.append({"kind": "city calendar", "id": f"{city['s']}/{city['c']}", "name": f"{city['c']}, {city['s']}", "url": city.get("u") or ""})
    for county in data["CTY"]:
        out.append({"kind": "county calendar", "id": f"{county['s']}/{county['c']}", "name": f"{county['c']}, {county['s']}", "url": county.get("u") or ""})
    return out


def classify(status: int, error: str) -> str:
    if 200 <= status < 300:
        return "ok"
    if status in UNVERIFIED_CODES or "timed out" in error.lower() or "timeout" in error.lower():
        return "unverified"
    return "broken"


def check(entry: dict) -> dict:
    url = entry["url"]
    if not url.startswith(("http://", "https://")):
        return dict(entry, result="broken", status=0, detail="missing or malformed URL")
    status, final, _, _, err = fetch(url, ua=BROWSER_UA, timeout=25, tries=2, limit=200_000)
    result = classify(status, err)
    moved = final if final.rstrip("/") != url.rstrip("/") else ""
    return dict(entry, result=result, status=status, detail=err or (f"redirects to {moved}" if moved else ""))


def render_md(report: dict) -> str:
    s = report["summary"]
    lines = [
        "# Link report",
        "",
        f"Checked {report['checked_at']}: {s['total']} URLs from `politicz-data.js`. "
        f"{s['ok']} ok, {s['unverified']} unverified (the server refused an automated check), {s['broken']} broken.",
        "",
        "Written by `ops/link_check.py` (weekly workflow `link-check.yml`). Fix a broken entry in "
        "`politicz-data.js`; the state pages under `state/` carry the same URLs.",
        "",
    ]
    for result, title in (("broken", "Broken"), ("unverified", "Unverified")):
        rows = [e for e in report["entries"] if e["result"] == result]
        lines += [f"## {title} ({len(rows)})", ""]
        if not rows:
            lines += ["None.", ""]
            continue
        lines += ["| Kind | Entry | URL | Answer |", "|---|---|---|---|"]
        lines += [f"| {e['kind']} | {e['name']} | {e['url']} | {('HTTP ' + str(e['status'])) if e['status'] else ''} {e['detail']} |".replace("  ", " ")
                  for e in rows]
        lines.append("")
    return "\n".join(lines)


def material(report: dict) -> list:
    return sorted((e["kind"], e["id"], e["url"], e["result"]) for e in report.get("entries", []))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Check every calendar and statute URL in politicz-data.js.")
    ap.add_argument("--limit", type=int, help="check only the first N URLs")
    ap.add_argument("--no-write", action="store_true", help="don't write the report files")
    args = ap.parse_args(argv)
    try:
        todo = entries(load_data())
    except (OSError, ValueError, KeyError) as e:
        annotate("error", f"Could not read politicz-data.js: {e}")
        return 1
    if args.limit:
        todo = todo[: args.limit]

    # Spread requests across hosts so no single agenda platform gets a burst.
    todo.sort(key=lambda e: (urlsplit(e["url"]).netloc[::-1], e["id"]))
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(check, todo))
    results.sort(key=lambda e: (e["kind"], e["id"]))

    counts = {k: sum(1 for e in results if e["result"] == k) for k in ("ok", "unverified", "broken")}
    report = {"checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
              "summary": dict(counts, total=len(results)), "entries": results}
    # Refusals (403 and friends) are bot protection, not outages; only silence counts here.
    silent = sum(1 for e in results if e["status"] == 0)
    if results and silent / len(results) >= SYSTEMIC_SHARE:
        annotate("error", f"{silent} of {len(results)} URLs got no answer at all; the runner's network is the likely "
                          "cause. No report written. Re-run the workflow before editing any data.")
        return 1
    for e in results:
        if e["result"] == "broken":
            annotate("warning", f"Broken {e['kind']}: {e['name']} {e['url']} (HTTP {e['status']} {e['detail']})")
    summary(render_md(report).replace("# Link report", "## Link report", 1))
    print(f"{counts['ok']} ok, {counts['unverified']} unverified, {counts['broken']} broken of {len(results)}")

    if not args.no_write and not args.limit:
        previous = json.loads(REPORT_JSON.read_text(encoding="utf-8")) if REPORT_JSON.exists() else {}
        if material(previous) != material(report):
            REPORT_JSON.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
            REPORT_MD.write_text(render_md(report), encoding="utf-8")
            print("Results changed since the last report; report files rewritten.")
        else:
            print("Results unchanged since the last report.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
