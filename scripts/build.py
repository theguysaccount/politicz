"""Validate and stage Politicz's plain HTML, CSS, JS and assets. No framework required."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index.html', 'law.html', 'test.html', 'thesis.html']

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.links, self.headings, self.main, self.desc = [], [], 0, 0, 0
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag == 'h1': self.headings += 1
        if tag == 'main': self.main += 1
        if tag == 'meta' and a.get('name') == 'description': self.desc += 1
        if tag in ['a', 'link', 'script', 'img']:
            u = a.get('href') or a.get('src')
            if u: self.links.append(u)

pages = {name: Page((ROOT/name).read_text()) for name in PAGES}
for name, page in pages.items():
    assert page.headings == 1 and page.main == 1 and page.desc == 1, f'{name}: invalid landmarks or metadata'
    duplicates = [key for key, n in Counter(page.ids).items() if n > 1]
    assert not duplicates, f'{name}: duplicate IDs {duplicates}'
    for link in page.links:
        url = urlsplit(link)
        if url.scheme or url.netloc: continue
        target = (url.path.lstrip('/') or (name if not url.path else 'index.html'))
        if url.path == '/': target = 'index.html'
        assert (ROOT/unquote(target)).is_file(), f'{name}: missing local target {link}'
        if url.fragment and target in pages:
            assert url.fragment in pages[target].ids, f'{name}: missing anchor {link}'
for js in ['politicz.js', 'politicz-data.js']:
    subprocess.run(['node', '--check', str(ROOT/js)], check=True)
assert (ROOT/'CNAME').read_text().strip() == 'politicz.org'
output = ROOT/'dist'
output.mkdir(exist_ok=True)
for name in PAGES + ['politicz.css','politicz.js','politicz-data.js','CNAME','robots.txt','sitemap.xml','og.jpg','apple-touch-icon.png','favicon-32.png','favicon-64.png']:
    shutil.copy2(ROOT/name, output/name)
for path in ROOT.glob('co-*.png'): shutil.copy2(path, output/path.name)
shutil.copytree(ROOT/'assets',output/'assets',dirs_exist_ok=True,ignore=shutil.ignore_patterns('README.md'))
print('PASS: all 4 pages, local links, anchors, unique IDs, landmarks, metadata, JavaScript syntax and domain. Static site staged in dist/.')
