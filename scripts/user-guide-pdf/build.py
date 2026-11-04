"""Renders docs/user-guide/*.md into one print-ready HTML file."""
import pathlib, re, sys
from markdown_it import MarkdownIt
from mdit_py_plugins.anchors import anchors_plugin

DOCS = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
REPO = "https://github.com/Sharmistha-622/pnc-elc-platform/blob/main/docs/"

def slug(s):
    s = re.sub(r"[^\w\s-]", "", s.lower(), flags=re.UNICODE)
    return re.sub(r"\s", "-", s.strip())

md = (MarkdownIt("commonmark", {"html": False, "typographer": False})
      .enable("table").enable("strikethrough")
      .use(anchors_plugin, min_level=1, max_level=4, slug_func=slug))

chapters = sorted(p for p in DOCS.glob("[0-9][0-9]-*.md"))
keys = {p.name: f"ch{p.name[:2]}" for p in chapters}

def rewrite(html, key):
    def fix_href(m):
        href = m.group(1)
        if href.startswith("http"):
            return m.group(0)
        if href.startswith("#"):
            return f'href="#{key}-{href[1:]}"'
        file, _, frag = href.partition("#")
        name = file.split("/")[-1]
        if file.startswith("../") or name not in keys:
            target = REPO + file.replace("../", "")
            return f'href="{target}"'
        k = keys[name]
        return f'href="#{k}-{frag}"' if frag else f'href="#{k}"'
    html = re.sub(r'href="([^"]+)"', fix_href, html)
    html = re.sub(r'id="([^"]+)"', lambda m: f'id="{key}-{m.group(1)}"', html)
    return html

toc, body = [], []
for p in chapters:
    key = keys[p.name]
    text = p.read_text()
    title = text.split("\n", 1)[0].lstrip("# ").strip()
    html = rewrite(md.render(text), key)
    # Callouts: a blockquote opening with "In this chapter" gets its own style.
    html = html.replace("<blockquote>\n<p><strong>In this chapter.</strong>",
                        '<blockquote class="intro">\n<p><strong>In this chapter.</strong>', 1)
    num, _, name = title.partition(". ")
    toc.append(f'<li><a href="#{key}"><span class="n">{num}</span>{name}</a></li>')
    body.append(f'<section class="chapter" id="{key}">{html}</section>')

# The README supplies the "what the platform is" and reading-order pages.
readme = DOCS / "README.md"
intro_md = readme.read_text().split("\n", 1)[1]
intro_html = rewrite(md.render(intro_md), "intro")

css = (pathlib.Path(__file__).parent / "guide.css").read_text()
OUT.write_text(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>ELC Platform User Guide</title><style>{css}</style></head><body>
<section class="cover">
  <div class="brand">NavGurukul · People &amp; Culture</div>
  <h1>ELC Platform<br>User Guide</h1>
  <p class="sub">How the Employee Life Cycle platform works, what it contains,
  and where to go to do what. For the PnC, Finance and leadership teams,
  managers and employees.</p>
  <div class="meta">Platform version 2.04.00 · October 2026</div>
</section>
<section class="contents"><h2>Contents</h2><ol class="toc">
<li><a href="#intro"><span class="n">0</span>About this guide</a></li>
{''.join(toc)}</ol></section>
<section class="chapter" id="intro"><h1>About this guide</h1>{intro_html}</section>
{''.join(body)}
</body></html>""")
print("wrote", OUT)
