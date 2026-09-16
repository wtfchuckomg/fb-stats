# Source parts for index.html

`index.html` at the repo root is the whole site — page, styles and script in one
file, because that is what GitHub Pages serves. It is **built**, not edited.
The parts it is built from live here.

```bash
python3 build.py           # rebuild index.html from pb/
python3 build.py --check   # build and compare only, writes nothing
```

Change a part, run the build, then commit the part **and** `index.html`
together. If they ever drift, `--check` says so and the parts win — rebuild.

Two things to know:

- Every `.js` part is concatenated into one `<script>`, so they all share one
  scope. Declaring the same top-level name in two parts is a SyntaxError that
  blanks the whole page; the build prints a warning when it sees one.
- `PARTS_JS` in `build.py` is the build order and is authoritative. The number
  in a filename is only a label — `7-sample.js` is built last on purpose,
  because it boots the page after everything it calls exists.

These parts were recovered on 2026-09-16 by splitting the deployed
`index.html` back apart, after the originals were lost with a temp directory.
The split is exact — the rebuilt file matches the deployed one byte for byte —
but a few filenames are reconstructions rather than the originals.
