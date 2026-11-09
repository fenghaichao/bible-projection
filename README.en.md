# Bible Projection

> An open-source Bible text projection tool for church meetings and personal study. Electron rewrite, fully offline.

[![CI](https://github.com/fenghaichao/bible-projection/actions/workflows/ci.yml/badge.svg)](https://github.com/fenghaichao/bible-projection/actions/workflows/ci.yml)

[中文](README.md) · [Architecture](docs/architecture.md) · [Data](docs/data.md)

---

## About

《语音投影圣经》(Voice Projection Bible) is a Windows study/projection app from around 2012, widely used in
church meetings. It is a natively-compiled VB6 executable backed by an Access database (`bibleNosound.dat`).

This project is a **clean-room modern rewrite** of that feature set — not a port of the original code:

- **Electron 33 + plain JavaScript** (no frontend framework, no bundler, no renderer build step)
- Verse data ships as JSON in the repository — **fully offline** after install
- UI, shortcuts and display settings redesigned; the original's crash defect is fixed

## Screenshots

Main window: top bar, the 66 books grouped into 8 categories on the left, large-type verse display on the
right (Genesis 1).

![Main window](docs/images/main-window.png)

Projection mode: one verse centred on a full screen, with the drawing toolbar (colour / width / undo / clear)
at the top right and a shortcut hint bar at the bottom right.

![Projection mode](docs/images/projection-mode.png)

## Why rewrite

The original 5.20-SP2 "no-speech" build has a fatal defect in its natively-compiled VB6 runtime:

> Typing Chinese into **any** input box (VB6 handles strings as ANSI / CP936 byte strings) raises
> **`Run-time error '5'`** and terminates the process.

That makes the single most common action in the app — searching for a Chinese keyword — a crash trigger.
The defect lives in the ANSI code-page conversion path and couples to input-method candidate handling,
so it can trigger as soon as the input box gains focus.

VB6 strings are byte-oriented ANSI strings, while Chinese Windows uses CP936 (GBK). Two-byte characters are
re-measured and truncated across every API boundary, and any mismatched assumption lands in an unhandled
runtime-error branch. VB6 has no `try/catch`, so the whole process dies.

The rewrite removes that path entirely: all text is UTF-8 inside Node/Chromium, with no code-page conversion
and no crash route.

---

## Feature comparison

The "original" column comes from the notes shipped with 《语音投影圣经》5.20-SP2 (no-speech edition).

| Original feature | This project | Notes |
| --- | --- | --- |
| Speech narration, accurate to the verse | ❌ not provided | The **no-speech edition contains no narration**; this project likewise implements none |
| Read single / multiple verses, a chapter, continuously | ❌ not provided | No speech, no reading mode |
| Speech-synced highlighting (LRC style) | ❌ not provided | — |
| Pick verses via TOC, list box, letter input | ✅ TOC + list + navigation | 66 books in 8 categories, with book / chapter / verse navigation |
| Show several passages at once (multi-window) | ⚠️ partial | Single window plus projection mode |
| Background / font / size / color / shadow / line spacing | ✅ display settings | Font, size, line spacing, text color, background color, background image, italic, underline, verse references |
| Text shadow | ❌ not provided | — |
| Remember and save visited passages | ✅ history | Up to 200 recent entries, clearable |
| Floating panel / slideshow / quick controls | ⚠️ partial | Projection mode (fullscreen + navigation shortcuts); no floating panel |
| Wireless remote control | ❌ not provided | — |
| Multi-keyword text search | ✅ multi-keyword search | "Match all" and "Match any" modes |
| Traditional and Simplified Chinese | ✅ toggle | Full text in both scripts |
| Copy verses into other programs | ✅ clipboard | One-click copy of the current passage |
| Simple drawing | ✅ simple brush annotation | Draw / erase / undo in projection mode |
| — (new) | ✅ verses per page | 1..n verses per page |
| — (new) | ✅ dark / light theme | Driven by display settings |
| — (new) | ✅ fully offline | No network requests; works disconnected |

---

## Install and run

### Requirements

- Windows 10 / 11 (x64); macOS / Linux can run from source but have no official installer
- **Node.js >= 20** for development (CI tests Node 22 and 24)

### From source

```bash
git clone https://github.com/fenghaichao/bible-projection.git
cd bible-projection
npm ci          # or npm install
npm start
```

| Script | Purpose |
| --- | --- |
| `npm start` | Launch the app (`electron .`) |
| `npm run dev` | Launch with the `--dev` flag |
| `npm test` | Run unit tests via `node --test test/*.test.js` |
| `npm run build` | Build the Windows NSIS installer into `release/` |
| `npm run pack` | Build the unpacked directory build only |

> The renderer is plain JavaScript with **no build step**: edit `src/renderer/` and reload the window.

---

## Building the Windows installer

```bash
npm run build
```

[electron-builder](https://www.electron.build/) 25 produces an **NSIS x64 installer** in `release/`:

- `release/BibleProjection Setup x.x.x.exe` — installer (choose install directory, creates a desktop shortcut)
- `release/win-unpacked/` — portable directory build

Only `src/`, `data/` and `package.json` are bundled (see `build.files` in `package.json`).

---

## Data source and licensing

### Text

This project uses the **Chinese Union Version (1919)**. The CUV was published in Shanghai in 1919; its
copyright has long expired, so the text is **public domain** and may be freely copied, modified and
redistributed.

### How the text was obtained

The Simplified and Traditional verse text and the book metadata come from the Access database
`bibleNosound.dat` bundled with the original program. `tools/extract-mdb.ps1` converts it into:

- `data/bible-simplified.json`
- `data/bible-traditional.json`

The `Bible` and `BibleF` tables hold **31,102 verses each** (the verse count of the whole CUV);
`bibleid` and `bibleidF` hold the metadata for all **66 books**. See [docs/data.md](docs/data.md)
for the field mapping and the exact extraction steps.

> The extractor only converts the original program's data into an open format. It contains none of the
> original program's code, and this repository ships no original executable, resource, or decompiled output.

### Copyright

- Source code: MIT License — see [LICENSE](LICENSE)
- CUV text: public domain
- 《语音投影圣经》 remains the property of its original authors; this project is not affiliated with or
  endorsed by them

---

## Project layout

```
bible-projection/
├── data/                   # bible-simplified.json / bible-traditional.json
├── docs/                   # architecture.md, data.md, images/
├── src/
│   ├── main/               # main process: window, IPC, clipboard, persistence
│   │   ├── main.js
│   │   ├── bible.js        # verse data access layer
│   │   └── store.js        # JSON persistence
│   ├── preload/preload.js  # contextBridge security bridge
│   ├── renderer/           # UI (plain JS, no framework, no build step)
│   └── shared/books.js     # 66 books and 8 categories metadata
├── test/                   # node --test unit tests
├── tools/extract-mdb.ps1   # reproducible extractor for the verse data
├── .github/                # CI, issue and PR templates
├── package.json
└── README.md
```

---

## Keyboard shortcuts

### Global

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `F` | Open the search panel (multiple keywords, space separated, `Enter` runs the search) |
| `Ctrl` + `H` | Open the "recently read" panel |
| `Ctrl` + `S` / `Ctrl` + `B` | Bookmark the current verse (both keys work) |
| `Ctrl` + `,` | Open the settings panel |
| `Ctrl` + `C` | Copy the text selection, or the whole current chapter (with book name and verse numbers) |
| `Ctrl` + `=` / `Ctrl` + `+` | Font size +2 |
| `Ctrl` + `-` | Font size -2 |
| `Ctrl` + `0` / `Ctrl` + `/` | Reset font size to the default 48 |
| `F5` / `F11` | Enter / leave projection mode |
| `Esc` | In order: close the open panel → leave drawing mode → leave projection mode |

### Passage navigation

Available in both normal and projection mode.

| Shortcut | Action |
| --- | --- |
| `←` `→` / `↑` `↓` | Previous / next verse |
| `Space` | Next verse |
| `PageUp` / `PageDown` | Page by "verses per page" (1 verse by default) |
| `Home` / `End` | First / last verse of the chapter |
| `Ctrl` + `←` / `→` | Previous / next book |
| `Ctrl` + `PageUp` / `PageDown` | Previous / next chapter |

> `PageUp` / `PageDown` page by the *verses per page* setting, not by whole chapters.
> The setting is adjustable in the settings panel. Use `Ctrl` + `PageUp` / `PageDown` to jump chapters.

### Projection-mode drawing

| Shortcut / gesture | Action |
| --- | --- |
| `D` / `P` | Toggle drawing mode |
| Left-drag | Draw (width and colour are adjustable in the projection-mode toolbar) |
| `Ctrl` + left-drag | Erase |
| `Z` / `Ctrl` + `Z` | Undo the last stroke |
| `Ctrl` + `Shift` + `Z` | Redo |
| `X` / `Ctrl` + `Shift` + `Delete` | Clear all annotations on the current page |

### Mouse

| Gesture | Action |
| --- | --- |
| Wheel (normal mode) | Scroll the passage area |
| Wheel (projection mode) | Next verse |
| 3 s without mouse movement (projection mode) | The pointer hides itself |

### UI notes

- The top bar provides every action above: Simplified / Traditional toggle, search, history, bookmarks,
  settings, projection mode and help.
- With the "show references" option enabled, each verse is followed by its reference (e.g. "John 3:16").

---

## Known limitations

- **No narration.** The original "no-speech" edition has no narration or LRC sync either; this project matches it.
- **Windows installer only.** `npm run build` currently configures only the NSIS x64 target; macOS / Linux
  need extra electron-builder targets or running from source.
- **Verse text is inherited from the original program's database** and has not been proofread verse-by-verse
  against a modern published electronic CUV; some characters and punctuation may differ.
- **No multi-window display** of several passages at once (the original has it); single window plus projection mode.
- **No wireless remote control** and no floating control panel.
- Switching script re-fetches the text for the current version; history and bookmarks are keyed by
  `book:chapter:verse`, so they carry across both scripts.

---

## Contributing and license

Issues and pull requests are welcome. Before submitting:

```bash
npm test        # unit tests pass
npm run dev     # app launches normally
```

Please describe the motivation for your change; for verse-data changes, also state the source and basis.

Released under the **MIT License** — see [LICENSE](LICENSE).
