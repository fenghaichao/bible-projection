# Bible Projection

> An open-source Bible text projection tool for church meetings and personal study. Electron rewrite, fully offline.

[![CI](https://github.com/fenghaichao/bible-projection/actions/workflows/ci.yml/badge.svg)](https://github.com/fenghaichao/bible-projection/actions/workflows/ci.yml)

[中文](README.md) · [Architecture](docs/architecture.md) · [Data](docs/data.md) · [Feature audit](docs/feature-audit.md)

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

Settings panel: font / size / line height / text and background colour / background image and background music /
text shadow / title font and title colour / verse-number colour / padding / verses per page / simplified–traditional /
floating panel, and more.

![Settings panel](docs/images/settings-panel.png)

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

Legend: ✅ implemented and covered by the end-to-end smoke tests · ⚠️ partial / deliberate deviation · ❌ deliberately not implemented

| Original feature | This project | Notes |
| --- | --- | --- |
| Speech narration, accurate to the verse; continuous reading; playback bar | ❌ not implemented | The **no-speech edition contains no narration**, so this project implements none either |
| Speech-synced highlighting (LRC style) and `+` / `-` playback speed | ❌ not implemented | Same reason: no speech, no LRC sync |
| Pick verses via TOC, list box, letter input | ✅ TOC + list + letter bar | 66 books in 8 categories; the quick-pick bar takes letters for a book (`CSJ`), digits for a chapter (`CSJ34`), `CSJ4:14` for a verse, `CSJ2:1-10` for a verse span (1–10 shown together), `CSJ4Z` / `CSJ4:14Z` for a whole chapter or chapter-to-end, auto-inserts separators on space, deletes with Backspace and cancels with `Esc` (needs an English IME) |
| Show several passages at once (multi-window) | ⚠️ partial | Up to 4 passages side by side in one window (`Ctrl` + `1`…`4` switches the active group); no separate multi-window display |
| Background / font / size / color / shadow / line spacing | ✅ display settings | Font, size, line spacing, text color, background color, background image (local path, browse dialog, clear), italic, underline, verse references |
| Text shadow | ✅ text shadow | Shadow colour, blur radius and offset are adjustable |
| Independent title font / title colour / verse-number colour / padding | ✅ independent typography settings | Title font and title colour can be set on their own (empty = follow the body text), the verse-number colour can be set on its own (empty = follow the theme accent colour), and the padding can be 0–120 px on all four sides (the background image still fills the screen) |
| Remember and save visited passages | ✅ history | Up to 200 entries; nothing is written on startup, every verse in a multi-verse run is recorded, entries carry the verse text, clearable |
| Floating panel / slideshow / quick controls | ✅ floating panel + auto-advance | A dedicated `float.html` window with 5 tabs (passage, search, format, New Testament, Old Testament — the last two list all 27 / 39 books and jump to chapter 1 on click), revealed by hovering the left edge, with a master switch in the top bar; the slideshow auto-advances on the configured interval |
| Wireless remote control | ⚠️ partial | No dedicated remote support, but the keyboard media keys (previous / next track) work as a page-turner |
| Multi-keyword text search | ✅ multi-keyword search | "Match all" and "Match any" modes; hits are highlighted, results are paged with a "showing N / M" hint and the keywords are kept |
| Traditional and Simplified Chinese | ✅ toggle | Full text in both scripts; book names and category names are fully localised to the selected script |
| Copy verses into other programs | ✅ clipboard | Same names as the original: **copy verse text** (chapter title + verses, flowing) / **copy verse text (per verse)** / **copy verse text (per verse, one per line)**; **copy chapter** = title only (`Alt` + `C`); search results can be copied per column (chapter only / chapter + verse text) |
| Simple drawing | ✅ brush annotation | Freehand, rectangle, circle, line and text notes (double-click to type), with eraser, undo and redo; strokes are saved per `book:chapter` into `userData/annotations.json` |
| Bookmarks | ✅ my bookmarks | `Ctrl` + `S` bookmarks the current verse, up to 500 entries |
| Continuous display across chapters / verse ranges | ✅ ranges | Verses can be shown continuously across chapter boundaries or as an explicit range |
| Projection / slideshow mode | ✅ projection mode | `F5` enters and leaves, `F6` leaves projection, `F11` is the system fullscreen; drawer panels no longer interrupt projection, text is not clipped and `Esc` leaves projection in one step |
| Original window shapes: transparent window (`F7`), desktop extension (`F9`) | ❌ not implemented in this version | Both need extra main-process `BrowserWindow` capabilities that this version does not implement; `F5` for projection and `F11` for native fullscreen cover the common cases |
| Original `Ctrl` + `0`…`4` "hide all comparison panes" | ⚠️ deliberate deviation | Replaced by `Ctrl` + `1`…`4` to switch the active comparison group and `Ctrl` + `0` to reset the font size (see [docs/feature-audit.md](docs/feature-audit.md)) |
| — (new) | ✅ verses per page | 1..20 verses per page, `Shift` + `>` / `<` adjusts |
| — (new) | ✅ multi-column comparison | Up to 4 passages compared side by side, added with the "+ pane" button |
| — (new) | ✅ background music | Optional looping local audio with a volume control (unrelated to narration) |
| — (new) | ✅ context menu on the passage area | Same structure as the original 5.20 SP2: fullscreen_F5 / Copy ▸ / slideshow progress ▸ / hide verses / open pen_Ctrl+P / pen colour ▸ / pen width ▸ / white pen_Ctrl+B / eraser_E / clear pen_Ctrl+E / extend desktop_F9 / theme settings ▸ |
| — (new) | ✅ click-to-advance in projection | Clicking the projected text advances one verse; can be switched off in the settings |
| — (new) | ✅ remote-style navigation | Jump to a chapter by number, media keys, space to advance |
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
├── docs/                   # architecture.md, data.md, feature-audit.md, images/
├── src/
│   ├── main/               # main process: window, IPC, clipboard, persistence
│   │   ├── main.js
│   │   ├── bible.js        # verse data access layer
│   │   └── store.js        # JSON persistence
│   ├── preload/preload.js  # contextBridge security bridge
│   ├── renderer/           # UI (plain JS, no framework, no build step)
│   │   ├── index.html      # main window
│   │   ├── float.html      # floating control panel (second window)
│   │   └── js/             # ES module renderer code
│   └── shared/books.js     # 66 books and 8 categories metadata
├── test/                   # node --test unit tests
├── tools/extract-mdb.ps1   # reproducible extractor for the verse data
├── .github/                # CI, issue and PR templates
├── package.json
└── README.md
```

---

## Keyboard shortcuts

The table below matches the in-app help panel (**Help** → shortcuts) and is grouped by feature.

### Picking and locating passages

| Shortcut / input | Action |
| --- | --- |
| Letter abbreviation | Jump to a book, e.g. `CSJ` / `CAJ` / `LWJ` |
| Letters + digits | Locate a chapter, e.g. `CSJ4` or `CSJ 4` |
| `CSJ4:14` | Locate chapter 4, verse 14 |
| `CSJ2:1-10` | Locate chapter 2, verses 1–10 (the whole span is shown) |
| `CSJ4Z` / `CSJ4:14Z` | Whole chapter / from that verse to the end of the chapter |
| Digits | Chapter N of the current book |
| Space | Inserts a separator while typing; with an empty input it means "next verse" |
| `Enter` / `Backspace` / `Esc` | Jump / delete / cancel (needs the English input method) |

### Paging and display

| Shortcut | Action |
| --- | --- |
| `←` `→` / `↑` `↓` | Previous / next verse |
| `Space` | Next verse |
| `PageUp` / `PageDown` | Page by "verses per page" (1 = whole chapter) |
| `Home` / `End` | First / last verse of the chapter |
| `Ctrl` + `←` / `→` | Previous / next book |
| `Ctrl` + `PageUp` / `PageDown` | Previous / next chapter |
| `Shift` + `>` / `<` | Grow / shrink the displayed verse span (original method 5): with a picked range it extends that range (e.g. `CSJ2:1-10` → verses 1-11), without one it changes "verses per page" |
| `Ctrl` + `1`…`4` | Switch the active column-comparison group |
| `F5` | Enter / leave projection mode (fullscreen) |
| `F6` | Leave projection mode |
| `F11` | System fullscreen (the projection look follows automatically) |
| `Esc` | Close panel / leave drawing / leave projection |

> `PageUp` / `PageDown` page by the *verses per page* setting, not by whole chapters.
> Use `Ctrl` + `PageUp` / `PageDown` to jump chapters.

### Text and copying

> Same wording as the original: a **chapter** is the passage-area title, a **verse text** is title + verses. What gets copied is what is currently **displayed** (respecting the quick-jump range and verses-per-page).

| Shortcut / action | Action |
| --- | --- |
| `Ctrl` + `C` | Copy verse text: chapter title + **the verses currently displayed** (one flowing paragraph by default; the format can be switched in Settings → copy format: flowing / per verse / per verse one per line) |
| `Ctrl` + `Shift` + `C` | Copy the current verse only |
| `Alt` + `C` | Copy the chapter: title only |
| Right-click | Copy ▸ copy verse text_Ctrl+C / copy verse text (per verse) / copy verse text (per verse, one per line) / copy chapter_Alt+C |
| Right-click | fullscreen_F5 / Copy ▸ / slideshow progress ▸ / hide verses / open pen_Ctrl+P / pen colour ▸ / pen width ▸ / white pen_Ctrl+B / eraser_E / clear pen_Ctrl+E / extend desktop_F9 / theme settings ▸ (dark, light) |
| `Ctrl` + `C` inside the search panel | Copy the search results (chapter + verse text) |
| Search panel "copy verse text / copy chapter" | Copy the ticked results: chapter + verse text / chapter only |
| `Ctrl` + `=` / `Ctrl` + `-` | Increase / decrease font size |
| `Ctrl` + `0` / `Ctrl` + `/` | Reset the font size |
| `Ctrl` + `D` | Cycle the passage font |
| `Ctrl` + `T` | Show / hide verse references |
| Top bar "简 / 繁" | Switch between Simplified and Traditional text |

### Search and bookmarks

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `F` / `F3` | Open the search panel (multiple keywords, space separated, `Enter` runs the search) |
| `Ctrl` + `H` / `F4` | Open the "recently read" panel |
| `Ctrl` + `S` | Bookmark the current verse |
| `Ctrl` + `,` | Open the settings panel |

### Drawing and annotation (inside projection mode)

| Shortcut / gesture | Action |
| --- | --- |
| `Ctrl` + `B` / `Ctrl` + `P` / `D` | Toggle the canvas (drawing mode) |
| Left-drag | Freehand line |
| `Shift` + drag | Rectangle |
| `Ctrl` + drag | Circle |
| `Alt` + drag | Straight line segment |
| `E` | Toggle the eraser |
| `1`…`6` | Brush width |
| `W` / `G` / `L` / `B` / `Y` / `R` | Brush colour |
| Double-click the canvas | Add a text note (HeiTi 30pt · yellow background, dark red text, up to 30 characters) |
| `Z` / `Ctrl` + `Z` | Undo the last stroke |
| `Ctrl` + `Shift` + `Z` | Redo |
| `Ctrl` + `E` / `X` | Clear the annotations of the current chapter |

> **Single-letter keys only work in projection / drawing mode**: `E`, `1`…`6`,
> `W` / `G` / `L` / `B` / `Y` / `R`, `Z`, `X` and `D` are taken by the letter quick-pick bar in normal
> mode (the original also prioritises letter input). Use `Ctrl` + `B` or `Ctrl` + `P` to toggle the
> canvas in normal mode.

### Projection and remote control

| Action | Action |
| --- | --- |
| Media keys (previous / next track) | Previous / next verse |
| Click the stage while projecting | Next verse (can be switched off in the settings) |
| Double-click the stage | Open "recently read" (normal mode) |
| Triple-click the stage | Clear screen: hide the verses, keep the background |
| Auto-advance | Turns the page automatically at the configured interval |
| Floating control panel | Hover the left edge of the stage or use the top-bar button |

### Original audio features (not applicable to the no-speech edition)

The original `Insert` / `Delete` narration control, `Ctrl` + `Enter` / `Ctrl` + `End` narration
positioning, `+` / `-` playback speed, the playback bar and LRC lyric sync **do not exist in the
no-speech edition** and are not provided here either.

### UI notes

- The top bar provides every action above: Simplified / Traditional toggle, search, history,
  bookmarks, settings, projection mode, floating panel and help.
- With the "show references" option enabled, each verse is followed by its reference (e.g. "John 3:16").
- The wheel scrolls the passage area in normal mode; while projecting the wheel turns to the next verse,
  and the pointer hides itself after 3 s without mouse movement.

### Differences from the original key bindings

| Key | Original | This project |
| --- | --- | --- |
| `Ctrl` + `S` | Change the font | Bookmark the current verse |
| `Ctrl` + `←` / `→` | Switch between remembered passages | Previous / next book |
| `Ctrl` + `B` | Bookmark | Toggle the canvas (drawing mode) |
| `Ctrl` + `0` | Hide all comparison columns | Reset the font size |

---

## Known limitations

- **No narration.** The original "no-speech" edition has no narration or LRC sync either; this project matches it.
- **Windows installer only.** `npm run build` currently configures only the NSIS x64 target; macOS / Linux
  need extra electron-builder targets or running from source.
- **Verse text is inherited from the original program's database** and has not been proofread verse-by-verse
  against a modern published electronic CUV; some characters and punctuation may differ.
- **No multi-window display** of several passages at once (the original has it); a single window with
  up to 4 compared passages plus one floating control panel.
- **No hardware support for a wireless remote**, but the keyboard media keys (previous / next track)
  can be used as a page-turner.
- **The original transparent window (`F7`) and desktop extension (`F9`) are not implemented**: both rely on
  extra main-process `BrowserWindow` capabilities this version does not have; use `F5` for projection and
  `F11` for the native system fullscreen.
- **The original `Ctrl` + `0`…`4` "hide all comparison panes" semantics were replaced**: `Ctrl` + `1`…`4`
  now switches the active comparison group and `Ctrl` + `0` resets the font size.
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
