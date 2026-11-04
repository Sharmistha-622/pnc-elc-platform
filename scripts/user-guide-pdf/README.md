# User guide PDF

Rebuilds `docs/user-guide/ELC-Platform-User-Guide.pdf` from the Markdown
chapters in `docs/user-guide/`.

```bash
pip install markdown-it-py mdit-py-plugins
python3 scripts/user-guide-pdf/build.py docs/user-guide /tmp/guide.html
node scripts/user-guide-pdf/render.js /tmp/guide.html docs/user-guide/ELC-Platform-User-Guide.pdf
```

`render.js` needs Playwright with Chromium, and prints any broken internal
links before writing the PDF.
