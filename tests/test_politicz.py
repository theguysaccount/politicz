"""Offline checks of the committed site and the ops scripts. Run: python3 -m unittest discover -s tests"""
import re
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ops"))
import link_check  # noqa: E402

SITE = "https://politicz.org/"
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def locs(name):
    root = ET.parse(ROOT / name).getroot()
    return [el.text.strip() for el in root.iter(NS + "loc")]


def file_for(url):
    path = url[len(SITE):]
    return ROOT / (path + "index.html" if path == "" or path.endswith("/") else path)


class Sitemaps(unittest.TestCase):
    def test_robots_allows_and_lists_the_index(self):
        robots = (ROOT / "robots.txt").read_text()
        self.assertIn("User-agent: *", robots)
        self.assertIn(f"Sitemap: {SITE}sitemap-index.xml", robots)
        self.assertNotRegex(robots, r"(?m)^Disallow:\s*/\s*$")

    def test_every_sitemap_url_is_a_committed_page(self):
        index = locs("sitemap-index.xml")
        self.assertTrue(index)
        names = [u[len(SITE):] for u in index] + ["sitemap.xml"]
        for name in names:
            for url in locs(name):
                self.assertTrue(url.startswith(SITE), url)
                self.assertTrue(file_for(url).is_file(), f"{name} lists {url} but {file_for(url)} is missing")

    def test_every_state_page_is_in_the_sitemap(self):
        listed = set(locs("sitemap-states.xml"))
        for page in (ROOT / "state").glob("*.html"):
            if page.name != "index.html":
                self.assertIn(f"{SITE}state/{page.name}", listed)


class StatePages(unittest.TestCase):
    def test_one_page_per_jurisdiction(self):
        data = link_check.load_data()
        pages = {p.stem for p in (ROOT / "state").glob("*.html")} - {"index"}
        self.assertEqual(len(pages), len(data["LAW"]))

    def test_metadata(self):
        for page in sorted((ROOT / "state").glob("*.html")):
            html = page.read_text(encoding="utf-8")
            url = f"{SITE}state/" + ("" if page.name == "index.html" else page.name)
            with self.subTest(page=page.name):
                self.assertIn(f'<link rel="canonical" href="{url}"', html)
                self.assertEqual(len(re.findall(r"<h1[\s>]", html)), 1)
                self.assertRegex(html, r'<meta name="description" content="[^"]{40,}"')
                self.assertRegex(html, r"<title>[^<]{10,}</title>")


class Plumbing(unittest.TestCase):
    def test_cname_untouched(self):
        self.assertEqual((ROOT / "CNAME").read_text().strip(), "politicz.org")

    def test_indexnow_key_file(self):
        keys = [p for p in ROOT.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", p.stem)]
        self.assertEqual(len(keys), 1)
        self.assertEqual(keys[0].read_text().strip(), keys[0].stem)
        self.assertIn(keys[0].stem, (ROOT / ".github/workflows/checks.yml").read_text())
        self.assertIn(keys[0].stem, (ROOT / "ops/health.py").read_text())

    def test_jekyll_excludes_only_repo_files(self):
        config = (ROOT / "_config.yml").read_text()
        excluded = re.findall(r"^\s*-\s*(\S+)", config, re.M)
        self.assertEqual(sorted(excluded), sorted(["README.md", "OPERATIONS.md", "ops/", "tests/"]))


class LinkCheck(unittest.TestCase):
    def test_reads_every_calendar_and_statute(self):
        found = link_check.entries(link_check.load_data())
        kinds = {k: sum(1 for e in found if e["kind"] == k) for k in ("statute", "city calendar", "county calendar")}
        self.assertEqual(kinds["statute"], 51)
        self.assertEqual(kinds["city calendar"] + kinds["county calendar"], 135)
        self.assertTrue(all(e["url"].startswith(("http://", "https://")) for e in found))

    def test_classify(self):
        self.assertEqual(link_check.classify(200, ""), "ok")
        self.assertEqual(link_check.classify(403, "HTTP 403"), "unverified")
        self.assertEqual(link_check.classify(0, "timeout: The read operation timed out"), "unverified")
        self.assertEqual(link_check.classify(404, "HTTP 404"), "broken")
        self.assertEqual(link_check.classify(0, "gaierror: Name or service not known"), "broken")

    def test_incomplete_chain_is_unverified_but_expired_is_broken(self):
        from unittest import mock
        entry = {"kind": "statute", "id": "IL", "name": "IL", "url": "https://example.gov/act"}
        chain = "SSLCertVerificationError: certificate verify failed: unable to get local issuer certificate"
        answers = [(0, entry["url"], {}, b"", chain), (200, entry["url"], {}, b"ok", "")]
        with mock.patch.object(link_check, "fetch", side_effect=answers):
            self.assertEqual(link_check.check(entry)["result"], "unverified")
        expired = "SSLCertVerificationError: certificate verify failed: certificate has expired"
        with mock.patch.object(link_check, "fetch", return_value=(0, entry["url"], {}, b"", expired)):
            self.assertEqual(link_check.check(entry)["result"], "broken")

    def test_report_only_changes_with_results(self):
        a = {"entries": [{"kind": "statute", "id": "AL", "url": "u", "result": "ok", "status": 200}]}
        b = {"entries": [{"kind": "statute", "id": "AL", "url": "u", "result": "ok", "status": 204}], "checked_at": "x"}
        self.assertEqual(link_check.material(a), link_check.material(b))
        b["entries"][0]["result"] = "broken"
        self.assertNotEqual(link_check.material(a), link_check.material(b))


if __name__ == "__main__":
    unittest.main()
