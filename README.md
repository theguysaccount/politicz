# Politicz

A free, no-account guide to your local government: which body decides, when it meets, and
whether state law lets you speak. Live at **https://politicz.org/**.

| Page | What it does |
|---|---|
| `index.html` | Address lookup. The browser asks the US Census geocoder which state, place and county an address is in, and the 5 Calls API who represents it. Politicz stores nothing. Browsing by state and city works without either API. |
| `law.html` | "Know your rights": the open-meetings law of all 50 states and DC, with statute, citation, notice hours, public-comment status and the primary source. |
| `state/` | One indexable page per jurisdiction ("Can you speak at a city council meeting in Texas?"), plus the `/state/` hub. |
| `thesis.html`, `test.html` | The essay on starting local, and a local-knowledge quiz. |
| `politicz-data.js` | The data behind every page: the 51-jurisdiction legal directory, 125 city and 10 county meeting calendars. |

It's plain HTML, CSS and JavaScript with no build step and no backend.

## Run, test, deploy

```bash
python3 -m http.server 8000                 # then open http://localhost:8000
python3 scripts/build.py                    # landmarks, local links, anchors, JS syntax (needs node), CNAME
python3 -m unittest discover -s tests       # sitemaps, state pages, plumbing, link-check parser
python3 ops/health.py                       # live check of politicz.org
python3 ops/link_check.py --no-write        # check every calendar and statute link
```

GitHub Pages builds straight from `main` and serves it at politicz.org (the `CNAME` file).
Whatever lands on `main` goes live within a minute or two, so change things through a pull
request and merge only when the **Checks** workflow is green.

Scheduled jobs, how they fail safely and what to watch: [OPERATIONS.md](OPERATIONS.md).

## Data and caveats

The legal directory is a research snapshot, not a live legal feed and not legal advice. Each
entry links its primary source; check it, and the body's own rules of procedure, before relying
on it. Corrections are welcome as issues or pull requests.
