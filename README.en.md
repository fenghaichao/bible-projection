# Bible Projection

> An open-source Bible text projection tool for church meetings and personal study. Electron rewrite, fully offline.

[![CI](https://github.com/fenghaichao/bible-projection/actions/workflows/ci.yml/badge.svg)](https://github.com/fenghaichao/bible-projection/actions/workflows/ci.yml)

[中文](README.md) · [Architecture](docs/architecture.md) · [Data](docs/data.md) · [Translations](docs/versions.md) · [Feature audit](docs/feature-audit.md)

---

## About

《语音投影圣经》(Voice Projection Bible) is a Windows study/projection app from around 2012, widely used in
church meetings. It is a natively-compiled VB6 executable backed by an Access database (`bibleNosound.dat`).

This project is a **clean-room modern rewrite** of that feature set — not a port of the original code:

- **Electron 33 + plain JavaScript** (no frontend framework, no bundler, no renderer build step)
- Verse data ships as JSON in the repository — **fully offline** after install
- **Three public-domain translations ship with the app** — the Chinese Union Version (Simplified / Traditional)
  and the Lü Zhenzhong Translation; four further copyrighted translations are **downloadable on demand** from
  inside the app, after confirming you have obtained the necessary authorisation (see [docs/versions.md](docs/versions.md))
- UI, shortcuts and display settings redesigned; the original's crash defect is fixed

## Screenshots

Main window: top bar, the 66 books grouped into 8 categories on the left, large-type verse display on the
right (Genesis 1).

![Main window](docs/images/main-window.png)

Projection mode: one verse centred on a full screen, with the drawing toolbar (colour / width / undo / clear)
at the top right and a shortcut hint bar at the bottom right.

![Projection mode](docs/images/projection-mode.png)

Settings panel: font / size / line height / text and background colour / background image and background music /
text shadow / title font and title colour / verse-number colour / current-verse highlight colour / padding / verses per page / simplified–traditional /
floating panel, and more.

![Settings panel](docs/images/settings-panel.png)
Multiple translations: the "Get translations" panel lists all 7 translations with their source and copyright,
tagged "installed / bundled / licence confirmation required"; the Chinese Union Version (Simplified / Traditional)
and the Lü Zhenzhong Translation ship with the app, the other four can be downloaded after a licence
confirmation, and a local JSON file can be imported.

![Translations panel](docs/images/versions-panel.png)

Multi-version comparison: after ticking 2–4 installed translations and pressing "compare current passage",
**every verse is followed by the same verse from each ticked translation** (no side-by-side columns) —
here Genesis 1:1–1:2 in CUV (Simplified), the Lü Zhenzhong Translation and CUV 2010.

![Multi-version comparison](docs/images/compare-versions.png)

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
| Show several passages at once (multi-window) | ❌ not implemented | The original could show different passages in several windows; this version is single-window. Use the per-verse multi-version comparison to compare translations |
| Background / font / size / color / shadow / line spacing | ✅ display settings | Font, size, line spacing, text color, background color, background image (local path, browse dialog, clear), italic, underline, verse references |
| Text shadow | ✅ text shadow | Shadow colour, blur radius and offset are adjustable |
| Independent title font / title colour / verse-number colour / padding | ✅ independent typography settings | Title font and title colour can be set on their own (empty = follow the body text), the verse-number colour can be set on its own (empty = follow the theme accent colour), and the padding can be 0–120 px on all four sides (the background image still fills the screen) |
| Current-verse highlight | ✅ smart verse stepping + mouse click + configurable highlight colour | `↓` / `↑` **or clicking a verse with the mouse** switches the current verse and highlights it in the **highlight colour** (theme gold by default, pick your own; empty = follow the theme); the screen stays still while the verse sits in the comfortable reading zone and only glides up slowly when it drifts too low; clicking a verse never moves the "verses per page" window |
| Remember and save visited passages | ✅ history | Up to 200 entries; nothing is written on startup, every verse in a multi-verse run is recorded, entries carry the verse text, clearable |
| Floating panel / slideshow / quick controls | ✅ floating panel + auto-advance | A dedicated `float.html` window with 5 tabs (passage, search, format, New Testament, Old Testament — the last two list all 27 / 39 books and jump to chapter 1 on click), revealed by hovering the left edge, with a master switch in the top bar; the slideshow auto-advances on the configured interval |
| Wireless remote control | ⚠️ partial | No dedicated remote support, but the keyboard media keys (previous / next track) work as a page-turner |
| Multi-keyword text search | ✅ multi-keyword search | "Match all" and "Match any" modes; hits are highlighted, results are paged with a "showing N / M" hint and the keywords are kept |
| Traditional and Simplified Chinese | ✅ translation switching | **CUV (Simplified)** and **CUV (Traditional)** are two *separate* translation entries, switched from the top-bar dropdown; book and category names are localised to the selected script |
| — (new) | ✅ 7 Chinese translations (3 bundled, the rest on demand) | The **Chinese Union Version (Simplified / Traditional)** and the **Lü Zhenzhong Translation** ship with the app (both public domain); **CUV 2010**, **Chinese Standard Bible**, **Today's Chinese Version 2019** and **New Chinese Version** are copyrighted and therefore **not shipped** — download them in the "Get translations" panel after confirming you have obtained the necessary authorisation (data comes from the FHL API) or import a local JSON file; see [docs/versions.md](docs/versions.md) |
| — (new) | ✅ per-verse translation comparison | In the "Get translations" panel, tick **2–4 installed translations** and press "compare current passage": **every verse is followed by the same verse from each ticked translation** (no side-by-side columns); each line is prefixed with a small "translation chapter:verse" label; the data refreshes automatically when you page or change chapter; press "stop comparison" to return to the single-translation view |
| Copy verses into other programs | ✅ clipboard | Same names as the original: **copy verse text** (chapter title + verses, flowing) / **copy verse text (per verse)** / **copy verse text (per verse, one per line)**; **copy chapter** = title only (`Alt` + `C`); search results can be copied per column (chapter only / chapter + verse text) |
| Simple drawing | ✅ brush annotation | Freehand, rectangle, circle, line and text notes (double-click to type), with eraser, undo and redo; strokes are saved per `book:chapter` into `userData/annotations.json` |
| Bookmarks | ✅ my bookmarks | `Ctrl` + `S` bookmarks the current verse, up to 500 entries |
| Continuous display across chapters / verse ranges | ✅ ranges | Verses can be shown continuously across chapter boundaries or as an explicit range |
| Projection / slideshow mode | ✅ projection mode | `F5` enters and leaves, `F6` leaves projection, `F11` is the system fullscreen; drawer panels no longer interrupt projection, text is not clipped and `Esc` leaves projection in one step |
| Original window shapes: transparent window (`F7`), desktop extension (`F9`) | ⚠️ partly implemented | **Desktop extension is implemented as "project to a second screen"**: `F9` (or the right-click entry "extend desktop_F9") opens a frameless fullscreen window on the second monitor showing the same passage as the main window (font size, colours, background image and shadow follow the main window settings); press it again to close. The transparent window (`F7`) is still not implemented |
| Original `Ctrl` + `0`…`4` "hide all comparison panes" | ⚠️ deliberate deviation | This version has **no comparison panes** (the feature was removed on request); `Ctrl` + `0` resets the font size (see [docs/feature-audit.md](docs/feature-audit.md)) |
| — (new) | ✅ verses per page | 1..20 verses per page, `Shift` + `>` / `<` adjusts |
| — (new) | ✅ multi-column comparison | Up to 4 passages compared side by side, added with the "+ pane" button |
| — (new) | ✅ background music | Optional looping local audio with a volume control (unrelated to narration) |
| — (new) | ✅ context menu on the passage area | Same structure as the original 5.20 SP2: fullscreen_F5 / Copy ▸ / slideshow progress ▸ / hide verses / open pen_Ctrl+P / pen colour ▸ / pen width ▸ / white pen_Ctrl+B / eraser_E / clear pen_Ctrl+E / extend desktop_F9 / theme settings ▸ |
| — (new) | ✅ click-to-advance in projection | Clicking the projected text advances one verse; can be switched off in the settings |
| — (new) | ✅ remote-style navigation | Jump to a chapter by number, media keys, space to advance |
| — (new) | ✅ dark / light theme | Driven by display settings |
| — (new) | ✅ fully offline | Verses and every feature run locally; only an explicit translation download needs the network, and everything works disconnected |

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

### Translations and copyright

This project supports **7 Chinese translations**. **Three of them are public domain and ship with the app**;
the other **four are under copyright and downloaded on demand** (after a licence confirmation):

| Translation | id | Bundled | Copyright holder |
| --- | --- | --- | --- |
| Chinese Union Version (Simplified) | `simplified` | ✅ yes (`data/bible-simplified.json`) | public domain (CUV, 1919) |
| Chinese Union Version (Traditional) | `traditional` | ✅ yes (`data/bible-traditional.json`) | public domain (CUV, 1919) |
| Lü Zhenzhong Translation | `lcc` | ✅ yes (`data/versions/lcc.json`) | public domain (per FHL's copyright page: past China's 50-year copyright term) |
| Chinese Union Version 2010 | `rcuv` | ❌ on demand (licence confirmation) | © 香港圣经公会 |
| Chinese Standard Bible | `csb` | ❌ on demand (licence confirmation) | © 全球圣经促进会 GBI |
| Today's Chinese Version 2019 | `tcv2019` | ❌ on demand (licence confirmation) | © 联合国圣经翻译中文委员会 |
| New Chinese Version | `ncv` | ❌ on demand (licence confirmation) | © 环球圣经公会 |

**Several translations can be compared verse by verse**: tick the installed translations
at the bottom of the "Get translations" panel and press "compare current passage" — every verse is then
followed by the same verse from each ticked translation;
the details are in the "multi-version comparison" section of [docs/versions.md](docs/versions.md).

#### The three bundled translations (public domain)

- The **Chinese Union Version** was published in 1919; its copyright has long expired, so the
  text is **public domain** and may be freely copied, modified and redistributed.
- The **Lü Zhenzhong Translation**: FHL's copyright page
  (<https://www.fhl.net/main/fhl/fhl8.html>) records that the New Testament revision was published by
  the Hong Kong Bible Society in 1952 and the full Bible in 1970, so it is **past China's 50-year
  copyright term and in the public domain**; FHL's module list (`abv.php`) marks it `candownload = 1`
  (offline download permitted). Its text (`data/versions/lcc.json`, 31,081 verses) therefore **ships
  with the repository and the installer** — which grows `data/` from about 7.2 MB to about 11.2 MB.

#### The four translations downloaded on demand

- **CUV 2010** (© 香港圣经公会), **Chinese Standard Bible** (© 全球圣经促进会 GBI, a registered
  trademark), **Today's Chinese Version 2019** (© 联合国圣经翻译中文委员会) and **New Chinese Version**
  (© 环球圣经公会) are **still under copyright**; their text is **not redistributed here**.
  Two ways to get them:
  1. **Download inside the app**: top bar → "Get translations" → pick a translation → "Download and install".
     The app fetches the text verse by verse from the **信望愛 FHL API**
     (<https://bible.fhl.net/api/qb.php>) and stores it on this machine
     (`%APPDATA%\BibleProjection\versions\`); after that one download everything works offline.
  2. **Import a local JSON file**: "Get translations" → "Import from a local file…", choosing a JSON file
     holding an array of `[book, chapter, verse, text]`.
- For these four, FHL's module list marks `candownload = 0` (no offline download licence granted), so the
  app tags them **"licence confirmation required"** and asks you to confirm that you have obtained the
  necessary authorisation before the download starts.
- The text belongs to its respective copyright holders; **downloading and using it means you have obtained
  the necessary authorisation yourself** — check each translation's terms before use.

#### Copyright notice and compliance

- The **FHL API page states** (<https://bible.fhl.net/api/>):

  > 注意，信望愛站上各個聖經譯本，有些僅授權給信望愛站使用，請查閱版權說明
  > （<https://www.fhl.net/main/fhl/fhl8.html>），請勿任意使用，以免違法。

  In other words: some translations are licensed **to the FHL site only** — *do not use them arbitrarily*.
  FHL's copyright page lists the terms per translation (for example the New Chinese Version requires the
  source to be credited, and written permission from 环球圣经公会 before any commercial use),
  so **check them one by one before you use a translation**.
- Translations differ in how they **number verses** (31,061 – 31,102 verses). The app therefore does
  **not** address verses across translations by verse number — history and bookmarks only record the
  book / chapter / verse position.

See [docs/versions.md](docs/versions.md) for the full list, the manifest fields and the acquisition
workflow, and [data/versions/README.md](data/versions/README.md) for the directory layout.

### How the text was obtained

The Simplified and Traditional verse text and the book metadata come from the Access database
`bibleNosound.dat` bundled with the original program. `tools/extract-mdb.ps1` converts it into:

- `data/bible-simplified.json`
- `data/bible-traditional.json`
- `data/versions/lcc.json` — the Lü Zhenzhong Translation (public domain, shipped with the repository and installer)

The `Bible` and `BibleF` tables hold **31,102 verses each** (the verse count of the whole CUV);
`bibleid` and `bibleidF` hold the metadata for all **66 books**. See [docs/data.md](docs/data.md)
for the field mapping and the exact extraction steps.

> The extractor only converts the original program's data into an open format. It contains none of the
> original program's code, and this repository ships no original executable, resource, or decompiled output.

The four translations that are downloaded on demand are fetched from the **信望愛 FHL API** with
`tools/fetch-versions.py` and cleaned with `tools/clean-versions.js`; where you keep them is up to you
(**neither the repository nor the installer ships them**):

```bash
python tools/fetch-versions.py                      # re-fetch every translation (needs network)
python tools/fetch-versions.py --versions rcuv,csb  # only the listed ones
python tools/fetch-versions.py --out D:\vers        # fetch somewhere else
node tools/clean-versions.js D:\vers                # clean the fetched files
node tools/verify-versions.js D:\vers               # validate the translation files
```

> `tools/fetch-versions.py` is a **user-side** helper (Python 3 + network). It is not bundled with the
> installer and does not run in CI. Fetched files default to `%APPDATA%\BibleProjection\versions\`, the same
> place the in-app download writes to.

### Copyright

- Source code: MIT License — see [LICENSE](LICENSE)
- CUV text: public domain, ships with the app
- Lü Zhenzhong Translation: public domain per FHL's copyright page (past China's 50-year copyright term),
  ships with the app
- The other 4 translations remain the property of their respective copyright holders; they are **not
  redistributed with this repository or the installer**, and you must obtain the authorisation yourself
- 《语音投影圣经》 remains the property of its original authors; this project is not affiliated with or
  endorsed by them

---

## Project layout

```
bible-projection/
├── data/                   # bible-simplified.json / bible-traditional.json / versions/{manifest.json, lcc.json, README.md}
├── docs/                   # architecture.md, data.md, versions.md, feature-audit.md, images/
├── src/
│   ├── main/               # main process: window, IPC, clipboard, persistence
│   │   ├── main.js
│   │   ├── bible.js        # verse data access layer
│   │   ├── versions.js     # translation registry (manifest / resolve / download / import)
│   │   └── store.js        # JSON persistence
│   ├── preload/preload.js  # contextBridge security bridge
│   ├── renderer/           # UI (plain JS, no framework, no build step)
│   │   ├── index.html      # main window
│   │   ├── float.html      # floating control panel (second window)
│   │   └── js/             # ES module renderer code
│   └── shared/books.js     # 66 books and 8 categories metadata
├── test/                   # node --test unit tests
├── tools/
│   ├── extract-mdb.ps1     # reproducible extractor for the verse data
│   ├── fetch-versions.py   # user-side fetcher for the non-public-domain translations
│   ├── verify-data.js      # validation of the bundled CUV data
│   ├── verify-versions.js  # structural validation of translation files (offline)
│   └── clean-versions.js   # text cleanup for downloaded translations
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
| Top-bar translation dropdown | Switch translation (CUV Simplified / Traditional, Lü Zhenzhong, CUV 2010, Chinese Standard, Today's Chinese 2019, New Chinese Version — 7 in total); the CUV pair and the Lü Zhenzhong Translation ship with the app, the other four must be downloaded or imported first, and a translation that is not installed shows "XXX (not installed)" — picking it does **not** switch, it only points you to the "Get translations" panel |
| Top bar "Get translations" | Open the translation panel: use / download & install / import from a local file / view the copyright |
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
| `F5` | Enter / leave projection mode (fullscreen) |
| `F6` | Leave projection mode |
| `F9` | Project to a second screen (show the current passage on the second monitor; press again to close) |
| `F11` | System fullscreen (the projection look follows automatically) |
| `Esc` | Close panel / leave drawing / leave projection |

> `PageUp` / `PageDown` page by the *verses per page* setting, not by whole chapters.
> Use `Ctrl` + `PageUp` / `PageDown` to jump chapters.

### Text and copying

> Same wording as the original: a **chapter** is the passage-area title, a **verse text** is title + verses. What gets copied is what is currently **displayed** (respecting the quick-jump range and verses-per-page).

| Shortcut / action | Action |
| --- | --- |
| `Ctrl` + `C` | Copy verse text: **【创1:10-11】** chapter reference + the verses currently displayed (one flowing line by default; the format can be switched in Settings → copy format: flowing / numbered verses / numbered verses one per line) |
| `Ctrl` + `Shift` + `C` | Copy the current verse only |
| `Alt` + `C` | Copy the chapter reference only, e.g. **【创1:10-11】** |
| Right-click | Copy ▸ copy verse text_Ctrl+C / copy verse text (per verse) / copy verse text (per verse, one per line) / copy chapter_Alt+C |
| Right-click | fullscreen_F5 / Copy ▸ / slideshow progress ▸ / show current verses ("hide verses" when they are already hidden) / open pen_Ctrl+P / pen colour ▸ / pen width ▸ / white pen_Ctrl+B / eraser_E / clear pen_Ctrl+E / extend desktop_F9 / theme settings ▸ (dark, light) |
| `Ctrl` + `P` | Open / close the brush (the original used `Ctrl` + `F`; here `Ctrl` + `F` opens the search) |
| `Ctrl` + `B` | White pen (also enters projection and opens the brush) |
| `Ctrl` + `=` / `Ctrl` + `-` | Increase / decrease font size |
| `Ctrl` + `0` / `Ctrl` + `/` | Reset the font size |
| `Ctrl` + `D` | Cycle the passage font |
| `Ctrl` + `T` | Show / hide verse references |

### Search and bookmarks

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `F` / `F3` | Open the search panel (multiple keywords, space separated, `Enter` runs the search) |
| `Ctrl` + `H` / `F4` | Open the "recently read" panel |
| `Ctrl` + `S` | Bookmark the current verse |
| `Ctrl` + `,` | Open the settings panel |
| `Ctrl` + `C` inside the search panel | Copy the search results (chapter + verse text) |
| Search panel "copy verse text / copy chapter" | Copy the ticked results: chapter + verse text / chapter only |

### Drawing and annotation (inside projection mode)

| Shortcut / gesture | Action |
| --- | --- |
| `Ctrl` + `P` / `D` | Toggle the canvas (drawing mode) |
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
> mode (the original also prioritises letter input). Use `Ctrl` + `P` to toggle the canvas in normal
> mode, or `Ctrl` + `B` to call up the white pen directly.

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

- The top bar provides every action above: search, history, bookmarks, settings, projection mode,
  floating panel and help.
- The top bar carries a **translation dropdown** listing all 7 translations. The CUV (Simplified / Traditional)
  pair and the Lü Zhenzhong Translation ship with the app, so picking one switches to it immediately; the other
  four have to be downloaded or imported first and show "XXX (not installed)" until then — picking such an entry
  does not switch anything and only points you to the "Get translations" panel.
- The top bar **"Get translations"** button opens the "Get translations" panel in the right drawer: it
  lists every translation with a "bundled / installed / not installed / licence confirmation required" tag,
  the source and the copyright. Installed translations get a "use this translation" button (the current one
  reads "current translation" and is disabled), a missing one gets a "download & install" button with a
  progress bar and a "stop tracking" action; for the four copyrighted translations the download first asks
  you to confirm that you have obtained the necessary authorisation; the bottom of the panel offers
  "import from a local file…" and "refresh list". Downloaded text is written to this machine only
  (`%APPDATA%\BibleProjection\versions\`) and is not redistributed with the app.
- **There is no separate "Simplified / Traditional" button** — pick "CUV (Traditional)" in the
  translation dropdown for Traditional text.
- With the "show references" option enabled, each verse is followed by its reference (e.g. "John 3:16").
- The wheel scrolls the passage area in normal mode; while projecting the wheel turns to the next verse,
  and the pointer hides itself after 3 s without mouse movement.

### Differences from the original key bindings

| Key | Original | This project |
| --- | --- | --- |
| `Ctrl` + `S` | Change the font | Bookmark the current verse |
| `Ctrl` + `←` / `→` | Switch between remembered passages | Previous / next book |
| `Ctrl` + `0` | Hide all comparison columns (this version has none) | Reset the font size |
| Simplified / Traditional switching | Two built-in texts switched directly | Replaced by the translation dropdown — CUV (Simplified) and CUV (Traditional) are two separate translation entries |

---

## Known limitations

- **No narration.** The original "no-speech" edition has no narration or LRC sync either; this project matches it.
- **Windows installer only.** `npm run build` currently configures only the NSIS x64 target; macOS / Linux
  need extra electron-builder targets or running from source.
- **Verse text is inherited from the original program's database** and has not been proofread verse-by-verse
  against a modern published electronic CUV; some characters and punctuation may differ.
- **No multi-window display** of several passages at once (the original has it); a single window plus one
  floating control panel. Use the per-verse multi-version comparison to compare translations.
- **No hardware support for a wireless remote**, but the keyboard media keys (previous / next track)
  can be used as a page-turner.
- **The original transparent window (`F7`) is not implemented**: it relies on extra main-process
  `BrowserWindow` capabilities this version does not have; use `F5` for projection, `F11` for the native
  system fullscreen and **`F9` to project to a second screen**.
- **The original `Ctrl` + `0`…`4` "hide all comparison panes" semantics were replaced**: this version has
  **no comparison panes** (the feature was removed on request); `Ctrl` + `0` resets the font size.
- **Apart from the three bundled translations (CUV Simplified / Traditional and the Lü Zhenzhong
  Translation), the other four must be downloaded once over the network** (from the top bar,
  "Get translations" → "Download and install", after confirming you have obtained the necessary
  authorisation); after that download the app works fully offline again.
- **The download entry points at a third-party API** (the SigFHL / FHL service). Its availability and
  behaviour are **not guaranteed by this project**; the same goes for the authorisation terms of the
  downloaded text.
- Switching translation re-fetches the text for the current version; translations differ in how they
  **number verses** (31,061 – 31,102 verses), so the app does **not** address verses across translations
  by verse number — history, bookmarks and annotations only record the book / chapter / verse position
  (the wording follows the translation in use).

---

## Contributing and license

Issues and pull requests are welcome. Before submitting:

```bash
npm test        # unit tests pass
npm run dev     # app launches normally
```

Please describe the motivation for your change; for verse-data changes, also state the source and basis.

Released under the **MIT License** — see [LICENSE](LICENSE).
