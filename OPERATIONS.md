# Operations

Politicz runs unattended on GitHub Pages at https://politicz.org/ (branch deploy from `main`,
custom domain from the `CNAME` file). Nothing here needs a person day to day. This file covers
every automated job, how it fails safely, what to watch, and the keys a human can turn later.

## Automated jobs

| Workflow | When | What it does | How it fails safely |
|---|---|---|---|
| **Checks** (`checks.yml`) | Every pull request and push to `main` | `scripts/build.py` (landmarks, local links, anchors, JS syntax, CNAME) and the unit tests (sitemaps map to real pages, state-page metadata, IndexNow key, Jekyll excludes, link-check parser) | A red check on a pull request blocks nothing by itself, so **merge only green pull requests**: Pages deploys whatever reaches `main`. |
| **Checks → live** | After each push to `main` | Waits for the Pages build of that exact commit, runs the live health check, then pings IndexNow with every sitemap URL | If the build errors, GitHub keeps serving the previous build. The health check fails loudly; IndexNow is pinged only after it passes. |
| **Health** (`health.yml`) | Daily 05:23 UTC | `ops/health.py`: the five core pages, every sitemap URL (56), `robots.txt`, the IndexNow key file, the TLS certificate's remaining life, the HTTP→HTTPS redirect, and the Census geocoder and 5 Calls APIs the address lookup uses | Read-only: it never changes the site. Any failure turns the run red with `::error::` annotations naming the problem. 5 Calls failures are warnings, because the page falls back to state/city browsing. |
| **Health → keepalive** | Daily, same workflow | Commits `.github/keepalive` after 30 days without a commit, and re-enables any workflow GitHub disabled for inactivity | GitHub disables scheduled workflows in a public repo after 60 quiet days; the heartbeat keeps the schedules alive. The heartbeat triggers a Pages rebuild of unchanged content. |
| **Link check** (`link-check.yml`) | Mondays 07:41 UTC | `ops/link_check.py`: fetches all 135 meeting calendars and 51 statute sources in `politicz-data.js` like a browser, classes each as ok / unverified / broken, and commits `ops/link-report.md` and `.json` when the results change | Never touches the site. Broken entries are warnings, not failures, so one dead link doesn't page anyone. The run fails only if the data can't be read or most URLs get no answer at all (the runner's network), and then it writes no report. |

`ops/`, `tests/`, `README.md` and this file are excluded from the Jekyll build (`_config.yml`),
so they never appear on politicz.org.

## What to watch

- **Actions tab.** A red **Health** run means the live site, its certificate or the Census API has a problem.
  The run summary lists every check. A red **Checks** run on `main` means a bad commit reached the live site.
- **`ops/link-report.md`.** The current list of broken and unverified links. *Unverified* almost always means
  bot protection (Justia and several city sites answer automated requests with 403); the link usually works
  in a browser.
- **Failure emails.** GitHub emails the account owner when a scheduled workflow fails. Nothing else alerts.

## Common fixes

- **A calendar or statute link broke.** Fix the URL in `politicz-data.js`. The state pages under `state/` carry
  the same calendar and source links in their HTML, so update the matching `state/<state>.html` too. Open a pull
  request; merge when Checks is green.
- **The TLS check warns.** GitHub Pages renews the politicz.org certificate by itself about 30 days before
  expiry. A warning under 21 days means the renewal is late; under 10 days the check fails. The usual cause is
  DNS no longer pointing at GitHub Pages. That is a DNS matter: see the keys below.
- **The Census geocoder check fails.** The lookup on the home page can't place addresses until the API is back.
  Browsing by state and city still works. Nothing to deploy; the next daily run re-checks.

## Keys a human can turn later

None of these is needed for the site to keep running.

1. **Money slot (donation or grant link).** Politicz has no money flow. To add one, put a link in the site footer:
   in every page's `<div class="footer-bottom">` block (`index.html`, `law.html`, `thesis.html`, `test.html` and
   the pages under `state/`), add `<a href="https://YOUR-DONATION-OR-GRANT-URL">Support Politicz</a>` next to
   "Open source ↗". Use a fiscal sponsor's or grant page's URL; Pages must stay non-commercial (no checkout).
2. **Search Console sitemap submission.** The site is already verified for Google (`google6a4e35cb8c4a23e4.html`).
   Signed in as the owner, submit `https://politicz.org/sitemap-index.xml` in Search Console. Google no longer
   accepts sitemap pings, so this is the only direct way to ask Google; Bing, Yandex and others get IndexNow.
3. **Privacy-friendly analytics** (needs an account): GoatCounter or Plausible. Add their one-line script tag to
   the pages, and a sentence to the privacy note on the home page.
4. **Domain and DNS.** politicz.org already points at GitHub Pages. Don't change DNS or the Pages custom-domain
   setting; the `CNAME` file and the tests guard it. If the certificate ever stops renewing, check that the apex
   A records are 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153, and that `www` is a
   CNAME to `theguysaccount.github.io`.

## Needs a human decision

- **The Election.org logo in the coalition footer.** The venture brief flags it: Election.org is described as a
  campaign operator, which undercuts a nonpartisan evidence tool. Removing it is a content change, so it was
  left as is.

## Scheduled Claude routine (for later)

Recurring research and writing can't run inside Actions (no model API key). When a Claude scheduled task is
available, run this monthly in a clone of this repo:

> Read `ops/link-report.md`. For each broken calendar link, find the city's or county's current official meeting
> calendar (the government's own agenda system) and update `politicz-data.js` and the matching `state/*.html`.
> Every January and July, re-verify each statute summary in `politicz-data.js` against its primary source and fix
> anything that changed, noting the date in the entry. Open one pull request per run, run
> `python3 scripts/build.py` and `python3 -m unittest discover -s tests`, and merge only when Checks is green.

The next content step in the venture plan is indexable city pages ("[city] council meeting calendar"),
generated from `politicz-data.js` and added to the sitemap index. They were deliberately not generated yet: today
each city has only a name, a population and one calendar link, so 135 pages would differ by a single link and
read as thin, near-duplicate pages. Generate them once each city also carries its meeting cadence, how to sign
up to speak and the speaking time limit (the routine above can research these), and link each one from its
state page.
