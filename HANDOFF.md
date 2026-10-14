# HANDOFF, Proxoteca

Context for the next Claude Code session.

## What it is

Vite + React single-page tool. Load images (card faces) → lay them out on a print
sheet (A3/A4/A5/Letter/Legal) with bleed + crop marks → export a print-ready PDF.
UI is in English (visible strings; **code comments stay Italian**). "Proxies" =
trading-card proxies; card size is 63×88 mm.

## Stack

- Vite 7, React 19, `react-dropzone`, `jspdf` (pulls `html2canvas`) for the RGB/screen PDF
- `pdf-lib` + `lcms-wasm` (Little-CMS WASM) for the **CMYK / PDF-X-1a** print export (both lazy-loaded);
  a **vendored** jpeg-js decoder (`src/utils/vendor/jpegCmykDecoder.js`, Apache-2.0) for native CMYK JPEGs
- `upscaler` 1.0 + `@tensorflow/tfjs` ~4.11 (its peer) + `@upscalerjs/esrgan-medium` for the in-browser
  **AI upscale 2×** (lazy chunk ~1.1 MB, model weights ~2.7 MB fetched from jsDelivr on first use)
- Vanilla CSS with design tokens in `src/index.css` (no Tailwind / CSS-in-JS)

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run lint
```

**Deploy:** GitHub Pages via Actions (`.github/workflows/deploy.yml`: `npm ci` + build →
`deploy-pages`). Repo Settings → Pages → Source must be **"GitHub Actions"** (not branch).
`vite.config.js` sets `base: './'` so assets resolve under the `/Proxoteca/` subpath.
Keep it relative (don't hardcode the repo name). Live at
`https://tommiconlai.github.io/Proxoteca/`. (Repo was renamed `Impagina-Proxy` → `Proxoteca`
on 2026-06-21; the old Pages URL 404s. Relative `base` meant no rebuild was needed.)

Preview via Claude Code: `preview_start "vite-dev"` (config in `.claude/launch.json`,
which is gitignored and auto-created if missing). Screenshot empty AND populated states.
To populate without picking files, inject test images into the hidden `<input type=file>`
with a `DataTransfer` + dispatched `change` event (the + button calls react-dropzone's
`open()`; drag&drop works on the whole preview area).

Gotcha: vite ignores the `PORT` env var, so `autoPort` assigns a port vite won't use.
Keep `port: 5173` and, if `preview_stop` leaves the vite child listening on 5173, kill it
before restarting.

## File map

| File | Role |
|------|------|
| `src/App.jsx` | Root: state (images, format incl. `custom`, sheetUnit/sheetW/sheetH, bleed, bleedStyle, dpi, cardType/cardW/cardH, cropMarks/cropStyle, import + art-picker modals), derives `customSheet` (mm) for custom sheets, header (logo + `?` **help tooltip**, `.help` **click-toggle** popover (`helpOpen` state + `.help.open`, click-outside closes) with the 4-step how-to, replaced the old tagline) / sidebar / main layout, `react-dropzone` (full-area drag&drop + `open()`). Settings persisted to `localStorage` (`ip:format`/`ip:bleed`/`ip:bleedStyle`/`ip:dpi`/`ip:cardType`/`ip:cardW`/`ip:cardH`/`ip:cropMarks`/`ip:cropStyle`/`ip:sheetUnit`/`ip:sheetW`/`ip:sheetH`/`ip:quality`/`ip:colorMode`/`ip:renderIntent`/`ip:iccProfileId`; the uploaded ICC bytes are **not** persisted (only the selected profile id); `ip:cardlist` lives in the import modal). Image items carry a `bleedMode` (`none`/`stretch`/`mirror`/`full`). Handlers: add / remove / clearAll / toggleBleed (**per-card 3-state cycle** none→stretch→full→none via `nextBleedMode`) / duplicate / replaceArt (updates edition) / saveProject (Scryfall cards → `.txt`). Scryfall image items carry `{name,set,collector,primary}` for the save; manual uploads don't (→ excluded). Sidebar = scrolling `.sidebar-scroll` (PageSettings) + fixed `.sidebar-export` footer (flex column): **Add cards** (`.btn-add`, green, opens the upload/Scryfall `.add-menu`) → **Generate PDF** → row [**Save list** · **Delete all**]. Save/Delete are always rendered, `disabled` when `images.length === 0` (Save list hovers green, Delete hovers red). The `addMenuOpen` state + click-outside live here (moved out of the preview footer). **Deck manager:** hash routes via `useHashRoute()` (`#/print` default, `#/decks`, `#/decks/:id`, `#/profile`, which also counts as the Decks area), `NavTabs` (Decks | Print) after the wordmark (help `?` only on Print), `DecksView` lazy-loaded (`React.lazy` + `Suspense`, own chunk) and rendered instead of `.app-body` on deck routes; `notify(msg, kind)` (stable `useCallback`, toasts from the deck area); `handlePrintDeck(entries)` downloads images with `fetchScryfallImages` (progress toast), then **replaces** the print queue (old previews revoked) and navigates to `#/print`; the old queue stays if the download fails or no image comes back |
| `src/components/PageSettings.jsx` | Sidebar settings in **2 group cards**, **no explanatory text** (user request 2026-10-13: labels + controls only; the only conditional texts left are the uploaded ICC filename and the native-CMYK profile-mismatch warning, which has no other surface): "Foglio & carta" (format presets + custom sheet W×H with mm/inch toggle · card type presets + custom W×H · bleed) and "Stampa" (bleed-style **auto/mirror/stretch/black/`full`="Bleed in art"**, `full` forces every card edge-to-edge for pre-bled art, with a `.field-hint` · **Output RGB/CMYK** (CMYK rivela: **ICC profile select** = 3 ECI inclusi + "Upload custom .icc…" con validazione DeviceLink/CMYK · avviso mismatch profilo nativo · rendering intent · tag PDF/X-1a · avviso soft-proof) · dpi · **Compression** (slider `range` 30–100% = qualità JPEG export RGB; `accent-color` oro; nota "non si applica al CMYK lossless") · crop marks: show checkbox + style Linee/Squadrette) + "Riepilogo" info box. No low-res text in the sidebar any more: the explanation lives in the expandable `!` chip on each card (see `PagePreview`). `SelectField` helper = label + `aria-label`ed select |
| `src/components/PagePreview.jsx` | Preview: one large centered page (`PageCanvas`) + per-card overlay. Each card is a full-area `.card-surface` `<button>` (`aria-label`=card name). **Desktop click model:** click (with or without Ctrl/⌘, or Enter/Space) = **toggle** that card in the selection (select, deselect, multi in one gesture), Shift-click = range, click on empty sheet/stage = clear. **Marquee (area) selection** (desktop mouse only, `marqueeHandlers` on `.preview-stage`): press on empty space (stage background, sheet margins, gaps, empty cells; not on cards, where drag = swap, nor on the pager) and drag past 4px → `.marquee` rectangle (cyan dashed + faint cyan fill + glow, absolute in the stage, clamped to it, pointer capture); cards whose hotspot rect **intersects** it are **added** to the selection live (never deselects the rest, like the click; user request). The click that ends a marquee is swallowed (`swallowClickRef`, reset on the next pointerdown) so it does not clear. **Hover/selected look = `CardFrame`** (SVG HUD frame from the user's Figma "Portfolio-TG": 3px outside the trim, 4 corner brackets shaped like the logo chevrons (one arm 10px, the other 5px, the long arm pointing clockwise: TL→right, TR→down, BR→left, BL→up) + 4 side segments, magenta top/bottom + cyan sides, 2px round stroke, no veil/outline; **selected segments glow** in their own colour via the SVG filter `#px-seg-glow` (blur + merge, defined once in a 0×0 `.svg-defs` svg in `PagePreview`, applied by CSS to the `.segs` group, never to single lines: a 0-height line bbox empties the filter region). Segments are drawn at the **selected** shape (node 4021:2397: centred, top/bottom 13.5→86.5%, sides 15→85%); on **hover** (node 4021:2411) CSS shortens them with `scale` from one end (`transform-box: fill-box`) into the clockwise-rotated short form, so selecting animates them growing. Rest = opacity 0. **Pager:** desktop = absolutely positioned `.nav-side` groups beside the sheet, vertically centred (`« ‹N` left, `N› »` right: the number inside the prev/next button is the **target page**, so on page 2 it reads 1 on the left and 3 on the right, empty at the ends; `IconChevron` = the logo chevron, long arm twice the short one like the selected-card corners, the right-hand ones are the left ones **rotated 180°** (not mirrored) = the logo's left arm); `SIDE_NAV`=96px each side is always reserved in the page-size calc so the sheet never jumps when page 2 appears; clicks on `.preview-nav` don't clear the selection. Touch keeps a bottom pager (`.nav-foot`) with the same chevrons and target-page numbers (`‹ 1   3 ›`). Footer: (touch pager), then `.preview-status` = bulk bar and count stacked in one grid cell (inactive one `visibility:hidden`) so selecting never changes footer height or moves the sheet; **actions only via the `CardMenu` context menu** (right-click, or Shift+F10 / ContextMenu key). Right-click outside the selection selects that card alone. One card → Change art · Duplicate · Bleed: <resolved label> (cycles, menu stays open) · Remove. A multi-selection → Change art (only if all share `artName`, else `aria-disabled` + "different cards"; the pick goes to every copy via App `editingIds`) · Duplicate all · Bleed on/off for all (`onBleedMany`, stays open) · Remove all (undo). `CardMenu` takes `{title, items}`. Portal to `body` (animated ancestors break `position:fixed`), clamped to the viewport, ↑/↓ nav, Esc/Tab/outside-click/resize close, focus restored to the card via `useOverlayDismiss`. Styled with `.add-menu` (shared rules) + `.card-menu-title` (card name). Same on mobile (`touch` prop): **tap = click, long-press (500ms, cancelled if the finger moves >10px or lifts) = right-click** → `showMenu` at the finger, the click after release is swallowed (`suppressClickRef`, reset on the next `pointerdown`), `navigator.vibrate(10)`; menu items ~44px ≤768px; no `draggable`; hover frame only under `@media (hover: hover)` (sticky :hover on touch); `.card-surface` disables touch-callout/user-select. (`CardActionSheet` was deleted.) `CardMenu` now lives in `src/components/CardMenu.jsx`. **Empty state** = bare white sheet, no overlay (the sidebar/mobile **Add cards** button is the only entry point; `.preview-empty-cta` now only hosts the "No cards fit this sheet" warning). **Desktop drag-to-reorder** (`dndOn = selectMode && onMove`): hotspots are HTML5 `draggable`; drop on another card → `onMove(id, globalIndex)` (App `handleMove`, **swap** semantics: the two cards trade places, the rest stay put; order = print order). Ghost = the card cropped from the page `<canvas>` (hotspots are transparent). `.dragging` veils the source, `.drop-target` = cyan outline. Keyboard: **Alt+arrows** on a card (swap with the neighbour / the card one row up or down, `moveTo`, follows the card across pages, refocuses via `data-card-id`). Visible page only for mouse drag. **Desktop selection** (`selectMode = !onCardTap`): click/Ctrl/Shift as above drive `selected` (local `Set`, pruned to `selectedIds`); selected = gold outline+wash; **bulk bar** in footer (Bleed/Delete/Clear → `onBleedMany`/`onRemoveMany`); keys Del/Esc/Ctrl+A (window listener, ignores inputs). A11y: `.sr-only` sheet summary + per-card low-res text. `PageCanvas` draws cards + bleed + crop marks + a **low-res warning** triangle (source < ½ the px the chosen DPI needs). Footer: count + cards missing to fill the page, or the bulk bar when selecting. The old click/right-click/drag hint now lives in the header `?` help as `.help-controls` |
| `src/components/MpcImportModal.jsx` | Modal: pick a **MPCFill `.xml`** order file → `parseMpcXml` lists cards → `fetchMpcImages` downloads each from Google Drive → `onImport` (= App `addItems`). File input is a hidden `<input>` inside a `.mpc-file` label. Shows count, progress, and failed-download names |
| `src/utils/mpcfill.js` | **XML import only, contacts no MPCFill server.** `parseMpcXml(text)` (DOMParser → `{cards:[{id,name,count}]}`, fronts then backs; comma-separated `<slots>` = copies; name from `<query>`) + `fetchMpcImages(cards,onProgress)` (downloads via **`lh3.googleusercontent.com/d/<id>=w2000`**, the only Drive endpoint that sends CORS headers, so the blob is readable/not tainted; `drive.google.com/uc` + `/thumbnail` 403 even through a proxy). Each card → `{file, bleedMode:'full'}`, one entry per copy (same `File` reused); no `name` so MPC art counts as custom in "Save list". (The live MPCFill art-search was removed. See "Done recently".) |
| `src/components/ScryfallImportModal.jsx` | Modal: paste a card list (no deck links: removed by the user) → fetch from Scryfall → add to images. Pasted text persisted to `localStorage` (`ip:cardlist`). Accepts `(SET) collector` to pin a printing |
| `src/components/ArtPickerModal.jsx` | **Scryfall-only** art box. "Change art" in the card menu → `fetchPrints` lists every Scryfall printing (each with `set`, `setName`, `collector`, `artist`, `year`) → a **search box** (`type=search`, `.import-link-input` look, placeholder "Search set, code, artist or year, e.g. Secret Lair, M21, 2021") filters them locally: every word must appear in set name/code/number/artist/year/"full art"/"borderless"; "N of M" counter, empty-result hint, tile tooltip shows set #, year, artist → pick downloads the PNG to a `File` (`downloadAsFile`) and calls `onPick(file, {bleedMode, set, collector})`, `bleedMode` = `mirror` for full-art/borderless else `stretch` (mirrors the import path). Card name from the **filename**; remounted via `key={id}`. Deck editor reuse: optional `name`, `title`, `current` ({ set, cn }, `.art-cell.current` cyan) and `onPickPrint(print)` (gets the chosen print instead of a downloaded file; the caller closes the box) |
| `src/components/Toast.jsx` | Transient feedback toast (`aria-live`), rendered in both App trees; centered above the mobile action bar, auto-dismiss (3.5 s, set in App) + tap-to-close. Driven by App `toast` state `{kind:'success'\|'error', msg}`; used by `handleSaveProject` (replaced the old `notice` box) |
| `src/components/ConfirmDialog.jsx` | Themed confirm for destructive actions (reuses `.modal`; `.modal.modal-confirm` overrides the mobile full-screen modal so it stays small/centered). Driven by App's `confirm` state `{message,confirmLabel,onConfirm}`; rendered in both App trees. Used by `handleClearAll` ("Delete all") |
| `src/components/CookieBanner.jsx` | Cookie-consent banner (fixed bottom, centered, matches the modal surface/shadow). Self-contained: shows until the user chooses, persists `ip:cookieConsent` = `accepted`\|`declined` in localStorage. **Settings always live in localStorage (technical)**; this flag only gates any *future* analytics cookies (read the flag before loading them, none today). Rendered once in each App tree (desktop + mobile); on mobile it sits above the bottom-tab bar. Centered via `left:0;right:0;margin-inline:auto` (not `translateX`, which the `fade-up` animation would override) |
| `src/hooks/useIsMobile.js` | `matchMedia('(max-width: 768px)')` via `useSyncExternalStore` → boolean. App renders the desktop tree above 768px, `MobileLayout` at/below |
| `src/hooks/useOverlayDismiss.js` | Shared overlay a11y: `useOverlayDismiss(onClose, active=true, {focusContainer=true})` → a `ref`. Esc-to-close (document keydown), moves focus into the overlay container on open, restores to the trigger on close. `active` lets always-mounted modals (`if(!open) return null`) gate it; `focusContainer:false` keeps an internal `autoFocus` (ConfirmDialog→Cancel). Does not steal focus from an element already focused inside; an element marked `data-autofocus` always gets it (survives the StrictMode remount); the opener is captured at first render (`useState` initializer) so focus returns to the trigger even after an inner autoFocus (phone "Add cards" sheet → search box, close → + button). Used by every modal/sheet/dialog. **No full focus-trap on Tab** (deliberate, `ponytail:` note in-file) |
| `src/components/MobileLayout.jsx` | Mobile shell (≤768px): compact header (Logo + `?` tap-tooltip) + the always-on **Cards** view (`<PagePreview touch />`: same selection model as desktop, tap = toggle, **long-press = the `CardMenu`**, no drag). **No tab bar** (removed `BottomTabBar`). Bottom **action bar** `.cards-toolbar` (`space-between`): **Settings** nav (left, icon+label) · `.ct-cluster` [Delete all · ＋ Add (FAB, primary) · Save list] · **Export** nav (right). ＋ opens the add bottom-sheet; **Settings/Export open a full-screen `MobilePage` overlay** (slide-up, header + close): Settings = `PageSettings`, Export = count/missing + low-res warn + Generate PDF (Save/Delete moved to the bar). Presentational; consumes `settingsProps`/`previewProps`/`actions`/`addMenu`. Local state: addOpen, sel, helpOpen, page(`null`/`settings`/`export`). Inline `IconSliders` + `MobilePage` helper (`MobilePage` is exported, reused by the deck editor search sheet). Deck manager props: `tabs` (rendered in the header after the wordmark) and `altBody` (when set, replaces the print body and bottom bar, help `?` hidden) |
| `src/utils/iccProfiles.js` | **Bundled ICC registry.** `BUNDLED_PROFILES` (id/label/`?url`/`condition`/`info`) for the 3 ECI output profiles in `src/assets/icc/` (FOGRA39 default, FOGRA51, FOGRA52) + `DEFAULT_PROFILE_ID`/`UPLOAD_ID`/`getProfileMeta`/`loadBundledProfileBytes` (fetch+cache on demand). `info` = exact lcms description (drives OutputIntent Info + mismatch compare) |
| `src/utils/vendor/jpegCmykDecoder.selfcheck.js` | `node`-runnable self-check (no framework) for the CMYK decoder: decodes the synthetic CMYK fixture, asserts non-inverted DeviceCMYK + paper-white tripwire, prints APP14 transform. Run: `node src/utils/vendor/jpegCmykDecoder.selfcheck.js` |
| `src/utils/cmykEngine.js` | **CMYK colour engine** (lazy). `readProfileInfo` now also returns `deviceClass` (ICC header bytes; for DeviceLink rejection). Wrapper su `lcms-wasm`: `instantiate()` singleton col WASM via `import wasmURL from 'lcms-wasm/dist/lcms.wasm?url'` (Vite emette `dist/assets/lcms-*.wasm`, base `./` → Pages-safe). `readProfileInfo(bytes)` → `{space,name}` (valida che sia CMYK); `makeRgbToCmyk(iccBytes, intentKey)` → `{convert(rgbaBytes,nPixels), close()}` (sorgente = sRGB built-in, dest = profilo tipografia; `cmsDoTransform` accetta il buffer RGBA di `getImageData` diretto, output CMYK 8-bit 0=no ink). Intenti: `relative` (RelCol+BPC) / `perceptual` |
| `src/utils/pdfGeneratorCmyk.js` | **CMYK / PDF-X-1a:2003 exporter** (lazy), additivo, il path jsPDF RGB resta intatto. Riusa `getGridInfo`/`cropMarkSpan`/`drawCardWithBleed` da `pdfGenerator.js`. Per carta: render cella su canvas RGB (stessa pipeline RGB, sfondo nero dietro i PNG) → `getImageData` → `cmykEngine` → bytes CMYK → image XObject **raw FlateDecode `/DeviceCMYK`** (`doc.context.flateStream`+`register`, posizionato con `newXObject`+`pushOperators(concatTransformationMatrix…drawObject)`). Aggiunge **OutputIntent** `/GTS_PDFX` con ICC incorporato (`/N 4`), Info `GTS_PDFXVersion`+`Trapped /False`, `TrimBox`=`BleedBox`=`MediaBox`=foglio, crocini vettoriali in `cmyk(0,0,0,1)`. **Salva con `useObjectStreams:false`** (xref classico, niente ObjStm/XRef-stream = feature 1.5+ vietate in X-1a) e **patch del byte minor header `%PDF-1.7`→`1.4`** (pdf-lib hardcoda 1.7, nessuna API). `buildCmykPdfBytes(...)` ritorna i byte (testabile); `generatePDFCmyk(...)` li scarica. **Routing per-carta:** JPEG CMYK nativo (rilevato da `isCmykJpeg`) → `decodeCMYK`+`cmykCellBuffer`, **passthrough senza conversione** (numeri preservati esatti); tutto il resto → RGB su canvas + lcms. `getConv` è lazy (set di soli CMYK non carica il WASM lcms) |
| `src/utils/cmykRaster.js` | **Fase 2**, `isCmykJpeg(bytes)` (sniff marker SOFn → Nf===4; PNG/non-JPEG → false) + `cmykCellBuffer(dec, cardWmm, cardHmm, bleedMm, mode)`: genera l'abbondanza sui **canali grezzi CMYK senza canvas** (riflessione/replica di pixel, lossless). Modi full/none/black/stretch/mirror; lo scaling alla cella fisica lo fa la matrice PDF (RIP ricampiona), quindi i pixel del trim restano 1:1 |
| `src/utils/vendor/jpegCmykDecoder.js` | **Vendored** da jpeg-js (Apache-2.0, (c) 2011 notmasteryet); `eslint-disable`. jpeg-js espone solo `decode()`→RGB; qui si aggiunge `decodeCMYK(bytes)` che chiama `JpegImage.parse`+`getData` (case 4) → CMYK 8-bit interleaved in **convenzione DeviceCMYK (0=no ink)**, gestendo l'inversione Adobe (APP14) e l'eventuale YCCK. Browser-safe (solo `Uint8Array`, niente `Buffer`) |
| `src/utils/pdfGenerator.js` | Grid math (`getGridInfo(formatKey, bleedMm, cardW=63, cardH=88, customSheet=null)`; `formatKey==='custom'` uses `customSheet` mm dims, else `PAPER_FORMATS`) + `generatePDF(items, formatKey, bleedMm, dpi, bleedStyle, cardW, cardH, cropMarks, cropStyle, customSheet)` (jspdf, dynamically imported) + `drawCardWithBleed` (stretch/mirror/black bleed) + `resolveBleedMode` (per-card mode × global style) + `drawCropMarks(…, style)` (`lines`/`corners`) + `cropMarkSpan` (clamped crop marks) |
| `src/utils/scryfall.js` | `parseCardList` (text → `{qty,name,set,collector}`; collector keeps **original case**. Scryfall `/cards/collection` is case-sensitive on it, e.g. The List `TMP-294`) + `fetchScryfallImages` (`/cards/collection` batched, printing-pinned via name\|set\|collector keys, downloads PNGs as `File`; DFC → both faces) + `fetchPrints(name, unique = 'prints')` (also `art` = `art_crop`) + `downloadAsFile` + `fetchDeckList` removed (no more deck-link import: the user dropped it, the sites block third-party reads) + `scryfallFetch` (retry 429/5xx + network, clear error on Scryfall outage) + `deckLine(qty,name,set,cn)` (builds `qty Name (SET) cn` so deck links pin the **edition chosen in the deck**) + `buildDeckList(items)` (placed cards → deck-list text for "Save list"; front faces only, custom uploads excluded). **Deck manager additions:** `scryfallFetch` is exported (AbortError rethrown at once, 4xx errors carry `.status`), `lookupCards(list)` (the `/cards/collection` resolution extracted from `fetchScryfallImages`, returns a finder), `fetchDeckBoards(url)` → `{ name, rows: {qty,name,set,collector,board,commander}[] }` (Moxfield commanders/main/side/maybe boards, Archidekt categories, Tappedout as main); `fetchDeckList` now derives from it (main + commanders, as before) |
| `src/utils/upscale.js` | **AI upscale 2×** in the browser. `upscaleFile(file, onProgress)` lazy-imports `upscaler` + `@upscalerjs/esrgan-medium/2x` (one `Upscaler` instance, WebGL), tiles 128/pad 8 with `awaitNextFrame`, then re-applies the original alpha scaled 2× (`destination-in`) so Scryfall's transparent rounded corners don't turn black; returns `{ file: PNG same base name, width }`. `canUpscale(item, dpi, cardW)` = RGB (not `colorKind:'cmyk'`) and rounded effective DPI < chosen DPI. Measured on an RTX 4070: ~7 s per Scryfall PNG, first run ~16 s (shader compile + weights). Used by App `handleUpscale` (dedupes shared `File`s across duplicates, updates `file`/`preview`/`w`, persistent `kind:'progress'` toast with % then success/error) and the card menu item "Upscale 2× (AI)" (single + multi, disabled with a note: running / CMYK file / sharp at N DPI) |
| `src/utils/scryfall.selfcheck.js` | `node`-runnable assert check for `parseCardList` (no framework). Run: `node src/utils/scryfall.selfcheck.js` |
| `src/decks/deckModel.js` | Deck manager pure logic (no React/Firebase). Phase 1 core: `snapshotFromCard` (Scryfall card → row snapshot; cost/type/colors/images from the **front face** for DFC/split, `legal` for 7 formats, `limit` from oracle text: 0 any number, N up to N), rows (`addCard` same print+board = +qty, `MAX_ROWS` 500, `MAX_QTY` 99, `setQty`/`bumpQty`/`removeRows`/`setCommander`/`moveToBoard` merging equal rows), `boardCounts`, `countTarget`/`countOk` (Commander exactly 100, others min 60, Casual none), `copiesToAdd` (Shift = 4 except singleton Commander, basic lands and "any number" exempt), `illegalIn(format, card)` (`banned` / `not_legal` or null; missing data = not legal; Casual null; raw Scryfall card via `{ legal: c.legalities }`) + `legalityLabel(status, format)`, `maxCopies(format, card)` (Infinity for Casual, basic lands, "any number"; Vintage `restricted` = 1; "up to N" = N; else Commander 1, others 4) and `overLimit(deck)` (copies per oracle id, prints together, main + sideboard, sideboard not in Commander, maybeboard never → `[{ oid, name, count, max }]`). Views and I/O: `primaryType`/`groupMain` (main board by `deck.groupBy`, see `GROUP_MODES`: `type` = primary type, priority Land > Creature > Planeswalker > Battle > Artifact > Enchantment > Instant > Sorcery; `typeAdv` = every card type of the type line as its own group, "Artifact Creatures" apart from "Creatures", ordered inside the family of the primary type, single type first; `mv` = 0..6, 7+ and Lands; `custom` = "Deck" (rows with no known section) then `deck.sections` in order, each group carries `section`; rows sorted by mana value then name), sorting `SORT_MODES` (`groupMain(deck, sort)`, `boardRows(deck, board, sort)`: `mv` = mana value then name, `name`), sections `addSection` (returns `{ deck, id }`, name trimmed to 40, switches `groupBy` to `custom`) / `renameSection` / `deleteSection` (rows back to Deck, merged; deleting the last one switches back to `type`) / `splitRow(deck, rowId)` (one copy into a new row right after, not merged; no-op for 1 copy or at `MAX_ROWS`) / `changeEdition(deck, ids, snapshot)` (rows take the chosen print, equal rows merge) / `placeRows(deck, ids, board, section?, { one })` (drag and drop: board, optional section, commander cleared; `one` = Alt, one copy per row split off and merged at the destination, a 1-copy row moves whole; no-op past `MAX_ROWS`) / `moveToSection` (merges equal rows), `commanderRows`/`boardRows`, `deckIdentity` (commanders, else main) / `coverRow` + `deckCover` (`deck.cover` = chosen oracle id, follows edition changes; removed card = automatic: first commander, else first main card), `toPrintEntries` (front-face name + set + collector, commanders first, sideboard optional, maybeboard never), `exportText` (MTGA headers Commander / Deck / Sideboard only when needed) / `parseDeckText` (headers in any case, `//` and `:` tolerated), `toBackup`/`fromBackup` (`{app, kind, v:1}`, bad rows dropped, unknown format = Casual), `duplicateDeck`, `refreshSnapshots` (key-order-insensitive compare, same object when unchanged). Self-check: `node src/decks/deckModel.selfcheck.js`. Phase 3: snapshot field `cmdr` (legendary creature or "can be your commander"; old snapshots fall back to the type until the refresh adds it), `manaPips(cost)` (per color: hybrid counts each color, Phyrexian its color, {C} colorless, generic / X / snow ignored), `deckStats(deck)` (main board incl. commanders: `cards`, `lands`, `avgMv` of non-lands to 2 decimals, `curve` 0..7+ with row ids, `colors` pips vs sources W U B R G C, `types` present with row ids, multi-type counted in each), `validateDeck(deck)` (never blocking, each issue `{ key, level, label, ids }`: Commander = no commander / more than 2 / can't be a commander / outside the commanders' color identity / sideboard rows; 60-card = sideboard over 15; all = copy limit, legality; Casual none; the card count stays in the top bar) |
| `src/decks/scryfallSearch.js` | Deck editor Scryfall calls: `autocompleteUrl`/`namedUrl`/`searchUrl(q, order = 'name')` (always `game:paper`, `unique=cards`), `withLegal(q, format)` (adds `legal:<format>`, Casual untouched), `advancedQuery(filters)` (filters → Scryfall syntax, quotes stripped, colorless wins, identity uses `id`), `autocomplete` (≥2 chars), `namedCard` (exact), `searchCards(q, signal, pageUrl, order)` (page + `next`, 404 = empty), `cardsByIds` (75 per batch, 100 ms apart), `resolveEntries` (parsed/link rows → `{ items: {card: Snapshot, qty, board, commander}[], notFound }`, DFC looked up by front face) |
| `src/components/CardMenu.jsx` | Context menu extracted from `PagePreview` (same behaviour: portal to body, clamped to viewport, ↑/↓, Esc/Tab/outside/resize/blur close, focus restored). `items: {key, Icon, label, run, keepOpen?, danger?, disabled?, note?}`. Used by print cards, deck tiles, deck rows, account menu |
| `src/hooks/useLongPress.js` | `useLongPress()` → `{ bind(onLong(x, y)), consumed() }`: 500 ms touch/pen press opens a menu, cancelled by >10 px moves; `consumed()` in the click swallows the click that ends a long press |
| `src/decks/Mana.jsx` | `ManaCost({cost})` and `ManaPips({colors})` from Scryfall symbol SVGs (`svgs.scryfall.io/card-symbols/{2W,WUP,...}.svg`) |
| `src/hooks/useHashRoute.js` | `useHashRoute()` (path without `#`, empty = `/print`, `useSyncExternalStore` on `hashchange`) and `navigate(path)` |
| `src/components/NavTabs.jsx` | Header tabs "Decks / Print" (hash links, `aria-current="page"` on the active one, cyan→magenta underline) |
| `src/decks/DecksView.jsx` | Lazy root of the Decks area (props `route, notify, printQueueCount, onPrintDeck`): waits for `watchUser`, shows `SignInPanel` when signed out (Sign in with Google, or an email + password form: sign in / create account toggle, "Forgot password?" sends the Firebase reset email, errors mapped by `authMessage`); an email account not yet confirmed gets `VerifyEmailPanel` instead ("I verified it", "Send the link again", "Use another account", re-checks on window focus; `rerender` reducer because `reload()` mutates the user in place), else `#/profile` → `ProfilePage`, the deck list or the editor. Once verified it listens to the profile doc and passes `photo` to `AccountMenu` and `ProfilePage`. Wrapped in App by `ErrorBoundary` (chunk/Firebase failure shows "Couldn’t load Decks" + Retry instead of unmounting the app) |
| `src/decks/firebase.js` + `firebaseConfig.js` | Firebase init (`firebase` 13): `auth`, `db` = `initializeFirestore` with `persistentLocalCache` + `persistentMultipleTabManager` (offline + multi-tab) and `ignoreUndefinedProperties`; `signIn` (popup, redirect fallback when blocked), `signInEmail` / `signUpEmail` (sends the verification email, a failed send does not block) / `resetPassword` / `sendVerification` / `needsVerification(u)` (not verified and no Google provider, same condition as the rules) / `checkVerified()` (reload + forced token refresh so the rules see `email_verified`) (Email/Password provider) + `authMessage(e)` (readable text per auth error code), `updateNickname`, `changePassword`, `signOut`, `watchUser`, `deleteAccount(deleteData)` (data first, then user; reauth popup on `requires-recent-login`). Config is public (rules + authorized domains protect data) |
| `firestore.rules` | Only the owner reads/writes `users/{uid}/decks/{deckId}`, and only with `email_verified` in the token or a Google session (`owner(uid)`); the profile doc `users/{uid}` has the same owner check and `validProfile` (keys `photo`, `updatedAt` only, photo a string of at most 200k chars); create/update need `cards.size() <= 500`. **Published by hand** in the Firebase console (Firestore → Rules) |
| `src/decks/AccountMenu.jsx` | Exports `Avatar` (custom photo, else Google photo, else the initial of nickname or email). Avatar button → `CardMenu`: Profile (`#/profile`), Privacy, Sign out, Delete account and data (`ConfirmDialog`, then `deleteAccount(onDeleteData)`) |
| `src/decks/deckStore.js` | Firestore I/O, one doc per deck at `users/{uid}/decks/{deckId}`: `listenDecks` (client-side sort by `updatedAt` desc, `serverTimestamps: estimate`), `listenDeck` (with metadata → `hasPendingWrites`), `createDeck` → `{ id, done }` (writes are not awaited by the UI: offline they queue), `saveDeck` (`setDoc` merge, `updatedAt` server time), `deleteDeck`, `deleteUserData` (decks in batches of 400, then the profile doc); profile doc `users/{uid}` = `{ photo, updatedAt }`: `listenProfile`, `saveProfilePhoto(uid, dataUrl or null)` |
| `src/decks/DeckStats.jsx` | Stats view of the main board, hand-written SVG following the dataviz skill: tiles (cards, lands, spells, average mana value), mana curve (columns 0..7+, 4 px rounded data end, value on the cap), colors (paired columns per color, mana symbols in costs `--chart-1` vs mana sources `--chart-2`, legend, Scryfall symbol under each pair), types (horizontal bars). Hover / focus = tooltip (`useTip`, positioned from the closest `.stat-plot` at event time, no ref); hit areas are the whole band; click / Enter on a curve or type bar = `onSelect(ids)` (Deck view with those rows selected). Every chart has an `sr-only` table |
| `src/decks/PhotoDialog.jsx` | New profile photo in two steps. Source: upload a file, or a card art (card name with native `datalist` suggestions from Scryfall autocomplete, then `fetchPrints(name, 'art')` = one tile per illustration, `art_crop` images, artist as caption). Crop: the crop is a square in source px (`side = min(w,h)/zoom` around `cx, cy`, clamped inside the image by `fit`), so `CropView` renders it at any size: the 280 px `.crop-area` (outside of the circle dimmed by a `::after` box-shadow) and the 72 / 34 px circle previews (profile, menu). Drag (pointer capture), wheel (native non-passive listener so the modal does not scroll), two-finger pinch, zoom slider 1 to 4, arrows move, + / - zoom. Save draws the square from the `ImageBitmap` into a 256 px canvas (dark fill for transparent PNGs), JPEG 0.85 (about 40 KB for an art crop) |
| `src/decks/ProfilePage.jsx` | `#/profile`: photo + nickname card (Change photo opens `PhotoDialog`, its 256 px JPEG data URL is saved in the profile doc, no Firebase Storage since it needs the paid plan; Remove photo falls back to the Google photo; nickname = Auth `displayName` via `updateNickname`, 40 chars), account summary (email + verified badge, sign-in method, member since, last sign-in, deck and card count from `listenDecks`), password change for email accounts (`changePassword` = reauth with the current password, then `updatePassword`; Google accounts get a note) |
| `src/decks/DeckList.jsx` | "[ YOUR DECKS ]" page: tiles (commander `art_crop` cover fading into the body, name, format · main count with warning colour, identity pips), Import (`ImportDeckDialog`), Backup (JSON download) / Restore (file → `fromBackup` → new decks), New deck (`NameFormatDialog`), tile menu via right-click / Shift+F10 / long-press: Rename, Duplicate, Export text (.txt), Delete (confirm) |
| `src/decks/ImportDeckDialog.jsx` | Import deck from a pasted list only (`parseDeckText` with board headers; links removed by the user) + optional name + format → `resolveEntries` → `addEntries(newDeck(...))`; not-found cards reported in a toast, the new deck opens |
| `src/decks/useDeck.js` | Editor hook `useDeck(uid, id)` → `{ deck (undefined loading / null deleted), update(fn), saving, error }`: local state, whole-document save 800 ms after the last change and at once on tab hide / unmount; incoming snapshots are ignored while a local change waits; `update` returning the same object writes nothing |
| `src/decks/DeckEditor.jsx` | Editor shell: bar (back, inline name, format select, sync label Saved / Saving… / Offline / Offline, saved on this device, main count vs target, **Print deck**: no dialog when the queue is empty and there is no sideboard, else `PrintDeckDialog`; then `onPrintDeck(toPrintEntries(...))`), body with `DeckSections`; one Scryfall refresh of snapshots on open (`cardsByIds` + `refreshSnapshots`, writes only if changed); deck deleted elsewhere → toast + back to list; `resource-exhausted` → daily-quota toast. Header = `.deck-hero` (user request): the cover art (`coverRow`) on the left, an unmasked blurred layer under a sharp layer that fades out by mask, then a gradient to `--bg-surface` so the right edge always matches the background (masking a blurred child left a hard edge in Chrome); a veil (`.deck-hero::before`, strong at the bottom, light at the top) keeps text readable; on top, left-aligned, the name at the top (sized to its text with `field-sizing: content` where supported) and format, sync, count, Print deck at the bottom; no back arrow (the Decks tab goes back). Clicking the art (the content lets clicks through) opens `CoverDialog`; only the pointer cursor hints it (user choice). Desktop: the name search sits in the header on the right (`.deck-hero-search`, the header has `z-index: 5` and only the art clips, so the dropdown opens over the deck) and controls the advanced search, which opens as `.deck-adv-panel` at the top of `.deck-main` (close button); no left search column any more. Phone: + FAB → `MobilePage` with `CardSearch` (advanced inline) as before |
| `src/decks/DeckSections.jsx` | Deck / Stats switch at the start of the toolbar (Stats renders `DeckStats`; group, sort, view and new section hide). Format checks: `validateDeck` → a row of chips above the cards (amber warn, red legality, icon + text), click = Deck view with those rows selected (`pick`); they replaced the copy-limit and legality banners. Toolbar of dropdowns: Group by (`GROUP_MODES`; "Custom sections" listed only while the deck has sections, you get there by creating one), Sort by (`SORT_MODES` mana value or name, inside every group and board), View by (List / Grid / Stacks / Stacks, every copy), plus "New section" in every mode. Sort and view are per device (`usePref(key, modes, fallback)` → `localStorage` `ip:deckSort` / `ip:deckView`, defaults Name and Stacks, blocked storage = session only; a device with a saved choice keeps it); group by is saved on the deck. Commander block, main groups (list: CSS columns; grid: groups stacked, images in an auto-fill grid; stacks: 160 px columns where each card covers the previous one except its name strip, `margin-top: -118%` of the width; `split` = one card per copy, CSS `layout` = stacks, no qty badge), Sideboard, Maybeboard (`<details>`, shown while dragging even when empty). One `row(r, copy)` renders every view. Hover preview (desktop, list and stacks): the card next to the row, right side or left when there is no room, hidden on any scroll. +/- (`bumpQty`) on mouse hover only (user choice; also visible when keyboard focus is on + or - itself, so no invisible focused button), on touch only for the selected card in grid and stacks. Empty space (`onEmpty`: not a row, the toolbar, section actions, a dialog or a control): click clears the selection, a mouse drag past 4 px draws a `.marquee` (same look and rules as the print preview: adds the touched rows live, never removes, the click that ends it is swallowed); in stacks a card counts only by its visible strip (up to the next card's top). `.deck-sections` carries the padding and `min-height: 100%` so the whole editor area counts as empty space. Legality: rows that count and are banned / not legal in the deck format (imported, added before the check, or after a format change) get a red ban chip (`.deck-card-ban`, same clipped-corner look as the print low-res "!") in `.deck-card-flags` top-left on grid / stacks cards, a ban icon after the name in list, and a red banner "Not allowed in <format>: Name (banned), ...". Copy limit: `overLimit` → amber banner + icon on the row or round badge on the card, only on rows that count. Selection like print cards (click toggle, Shift range, Esc); in stacks an inner border + tint so only the strip shows. Desktop drag and drop (HTML5, the whole selection when the row is in it, Alt at dragstart = one copy per row, `dragIds` = `{ ids, one }`, in image views a custom ghost via `setDragImage` (an off-screen `.deck-ghost` with a clone of the card image, 140 px, badge with the copies moved when more than one, removed on the next tick; the default ghost of a stacked row also captured the cards lying over it), hint "Drag to move · Alt+drag moves one copy" in the toolbar, dashed cyan drop target): onto a main group (its section in custom mode), the Sideboard or the Maybeboard → `placeRows` (a dropped commander stops being one); `endDrag` also runs on drop because the moved row can unmount before its dragend. Section header rename (`NameFormatDialog`) / delete. Row menu (right-click / Shift+F10 / long-press): Change edition (rows of the same card: `ArtPickerModal` with `name`, `title`, `current` highlighted and `onPickPrint` → `cardsByIds([id])` → `snapshotFromCard` → `changeEdition`), Split row (one row with 2+ copies), Set as commander (only if the commanders stay at most 2 counting the ones already set) / Remove as commander, Move to "<section>" (custom), Move to a new section (any mode), Move to main / side / maybe, Remove |
| `src/decks/CardSearch.jsx` | Search column (desktop) / "Add cards" `MobilePage` (phone, + FAB). Name search = only the autocomplete dropdown (user choice: no results list under the bar): Scryfall autocomplete (250 ms, previous request aborted); outside Casual the names go through one `lookupCards` request and the banned / not legal ones are dropped (if it fails, all stay and `add()` blocks them); none left = "No playable card with this name." (`emptyFor`). Arrows choose, Enter adds the active one; modifiers on Enter and click: Shift = 4 (`copiesToAdd`), Alt = sideboard (maybeboard in Commander). Esc closes the dropdown for that text (`hideFor`). `add()` re-checks legality (`illegalIn`) on every path. "Advanced search" toggles `AdvancedSearch` (the column gets `.adv-open`). Adding goes through `useAddCard` (shared with `AdvancedSearch`). Props `advanced` / `onAdvanced`: when given, the toggle only reports and the parent renders the panel |
| `src/decks/useAddCard.js` | `useAddCard(format, onAdd)` → `{ add, status, error }`: modifiers (Shift 4, Alt side / maybe), snapshot, legality check, `copiesToAdd`, "Added N name" |
| `src/decks/AdvancedSearch.jsx` | Filters → `advancedQuery` + `withLegal` → `searchCards(…, order)`: card name, oracle text, type (datalist of common types), mana cost (`{2}{R}`), mana value / power / toughness with = < <= > >=, rarity, colors W U B R G + colorless as mana-symbol toggles (colorless clears the colors and vice versa) with Including / Exactly / At most and "Color identity", keyword, set code, artist, raw Scryfall syntax, "Can be your commander" (Commander only), sort Name / Mana value / Popularity (edhrec) / Newest; Reset; "Set at least one filter." when empty. Results: image grid with + (and Enter on a tile) through its own `useAddCard` (status and errors shown in the panel), click on the image = `CardZoom`. Desktop: `.deck-body:has(.adv-open)` widens the column to `min(640px, 52vw)`; phone: one column |
| `src/decks/dialogs.jsx` | `PrivacyPanel` (what is stored, where, who can read it, how to delete), `NameFormatDialog` (new deck name + format, rename, custom sections; `placeholder` and `maxLength` props), `CoverDialog` (deck cover: "Automatic" + one art per card, maybeboard excluded, name filter, current highlighted), `PrintDeckDialog` ("Replace the N cards in the print queue?" when the queue is not empty + "Include sideboard (N)" checkbox, unchecked, only when there is a sideboard) |
| `src/components/ErrorBoundary.jsx` | Error boundary around the lazy Decks area |
| `src/components/icons.jsx` | Custom lucide-style SVG icon set (currentColor), incl. `IconPlus`, `IconDownload`, `IconList` (Save list, distinct from the download/export arrows), `IconCopy`, `IconFrame` + `Wordmark` (header lockup from the user's Figma "Portfolio-TG" node 4025:2465, group 4034:2496: "PRO" + "OTECA" as filled cyan `#00e5ff` letter paths, the **X is the brandmark in 3 parts**: cyan filled centre (two chevrons fused), `.x-v` = magenta `#ff2d95` V above and below (stroke 3 round); viewBox `0 0 143 30.5`, X centre (56.5, 15.25); `role=img aria-label="Proxoteca"` inside `<h1 className="brand">`; 30px tall desktop, 26px mobile). **Hover animation** (`.wordmark`, `@media (hover: hover)`): the centre stays still, the **top/bottom V rotate 180° on the vertical axis through the X centre** (`rotateY(180deg)`, `transform-box: view-box; transform-origin: 56.5px 15.25px`, 0.4s ease-in-out transition) and rotate back on leave. `IconChevron` (pager) = the right half of the X centre (long arm up, 2:1) with the V's rounded apex. The standalone mark only lives in `public/favicon.svg` now (the `Logo` component was removed) |
| `src/index.css` | All styling + design tokens |
| `public/` (favicons) | Proxoteca icon set: `favicon.svg/.ico`, `favicon-16/32/48/192/512.png`, `apple-touch-icon.png`, `site.webmanifest`. Linked in `index.html` with root-absolute paths → Vite rewrites to `./` via `base:'./'` (Pages-safe); manifest icon `src`s are relative. All icons = the **3-part header mark on black** (cyan centre + magenta V above/below, the `Wordmark` X paths): `favicon.svg` (the Figma paths under `scale(13.6) translate(-56.5 -15.25)`) + 16/32/48/192/512 PNG + `.ico` (16/32/48) use a rounded square (`rx` 112 of 532, mark ~78% tall); `apple-touch-icon.png` is a full square with more padding (mark ~63%, iOS rounds it). Rasters made with **Pillow** (8x supersample: cubic paths flattened, centre filled, V stroked 3 with a round dot on every vertex for caps/joins). Manifest colours `#08070f`. |

## Design system, "Proxoteca Cyberpunk" (since 2026-07-04)

Tokens at the top of `src/index.css`. Implemented from the user's claude.ai/design spec
(`Proxoteca Cyberpunk.dc.html`, project 16e043bc-…, fetched via DesignSync; decoded copy
was session-scratch). **Replaced** the earlier warm-gold OLED theme. Don't restore gold
`#d4923f`, Bricolage/Hanken, or the green add-affordance. Memory `design-identity` updated.

- **Palette:** `--bg-base #08070f` under a violet-tinted 155deg gradient (body) + radial
  glows. Primary **magenta `--accent #ff2d95`** (actions, selection, slider, drag overlay,
  Add-cards). Secondary **cyan `--cyan #00e5ff`** (focus rings, hovers on inputs/ghosts,
  checkmarks, CMYK chip, chevrons, Save hover, toast-success). **Violet** `rgba(124,92,255,…)`
  = borders/glass tint. **Acid `--acid #cfff56`** ONLY as Generate-CTA text. Danger `#ff4d6d`.
- **Fonts:** Chakra Petch (`--font-display`: h1/h2/h3, CTA/Add buttons, letterspaced
  uppercase) + Space Grotesk (`--font`) + **JetBrains Mono** (`--font-mono`: selects,
  number inputs, summary values, help `?`).
- **Signature elements:** `[ SECTION ]` sidebar headers (h2 `::before`/`::after` mono
  brackets, cyan/magenta with glow); wordmark = the Figma "PRO[X]OTECA" lockup (`Wordmark`,
  cyan letter paths, the X = cyan centre + magenta V above/below, flips on hover), replacing the old
  text wordmark with chromatic text-shadow; never gradient-text;
  **Generate CTA** = animated gradient border via two-layer background
  (`padding-box`/`border-box` + `px-sweep`), dark core, acid text, no wrapper element,
  disabled = flat dark; compression slider =
  magenta glow thumb + track fill via `--fill` set inline in PageSettings; cyan
  `anim-check`; Summary = mono cyan values; ghost Save/Delete (cyan / red hovers);
  **perspective-grid floor** + radial glow behind the sheet (`.preview-stage::before/::after`);
  magenta→cyan **scrollbar**; magenta `::selection`; **scanlines** overlay (`body::before`,
  replaced film grain).
- **Empty state:** no overlay, bare white sheet; the framed `.empty-cta-box` CTA was removed
  2026-10-13 at the user's request (Add cards button bottom-left is enough).
- **Invariant:** the print sheet preview stays **pure white, never tinted** (print accuracy).

## Done recently

- **Search in the header, deck centered (most recent, 2026-10-14):** user request. Profile back arrow removed; on desktop the search bar moved into the deck header on the right (where format / saved used to be), the left search column is gone, Advanced search opens a full-width panel above the deck; the deck view is centered (`.deck-sections` max 1320 px; in stacks it shrinks to its content and the commander and sideboard become columns of the same row). Verified live: dropdown over the deck, advanced panel open / close, list 24 px margins each side, stacks centered, phone unchanged (FAB sheet with inline advanced search), no horizontal scroll.
- **Deck header tweaks (2026-10-14):** user request: back arrow removed (the Decks tab is enough), name moved to the top of the header with the controls at the bottom, "Change cover" chip removed (the hand cursor says it). Verified live desktop and 375px.
- **Deck header with cover art (2026-10-14):** user request. The editor header is taller and shows the deck cover on the left, fading and blurring to the right, with name and controls (format, saved, count, Print deck) on the left on top of it; clicking the image opens a picker of the deck's cards (or Automatic), saved as `deck.cover` (Firestore payload, backup, duplicate) and also used by the deck list tile. Self-check RED first. Verified live: Esper Affinity (Ancient Den art, no hard edge after the layer fix), picker with 28 cards, Glint Hawk chosen (hero and list tile updated, Saved), back to Automatic; phone 375px with the chip always visible.
- **Link import removed + single-slash double-faced names (2026-10-14):** user decision: no import from other sites' links, only pasted lists (deck and print dialogs); `fetchDeckBoards`, `fetchDeckList`, the Worker and `deckProxy.js` deleted. Double-faced / split names: "A // B" already worked everywhere; the single slash written by MTGO and other exports ("Fire/Ice", "Delver of Secrets/Insectile Aberration") was not found: `parseCardList` now keeps the front face for any slash, and the advanced-search name turns "/" into Scryfall's " // ". Self-checks RED first. Verified live: both dialogs without a link field, "Fire/Ice", "Delver/Insectile", "Valki / Tibalt (KHM) 114", "Brazen Borrower // Petty Theft" all resolved in the deck import, the print lookup finds the single-slash lines, advanced name "Fire/Ice" returns Fire // Ice.
- **Three minors fixed (2026-10-14):** user request. (1) Link import: our Cloudflare Worker replaces the dead public CORS proxies (Archidekt works, Moxfield may be blocked by its bot protection with a clear paste fallback, Tappedout refused with advice; see Known issues for the one-time deploy). (2) Phone: the "Add cards" sheet now focuses the search box and returns focus to + on close (`useOverlayDismiss` + `data-autofocus`; the StrictMode remount was undoing it). (3) "Set as commander" is offered only if the commanders stay at most 2. Verified live: focus input / + on the phone; with 1 commander the menu offers Set on one row, not on two; Archidekt deck through the local Worker; not-set-up / Moxfield 403 / Tappedout messages.
- **User-side checks passed (2026-10-14):** the user tested on real devices: Google sign-in on Safari (iPad) OK, offline edits then back online OK (sync), mouse drag and drop with Alt OK. No open user-side checks left for the deck manager.
- **Phase 3: Stats view + format checks (2026-10-14):** from the spec. Deck / Stats switch: tiles, mana curve, colors (symbols in costs against mana sources), types; click a bar to select those cards. Issue chips replace the two banners: no commander, more than 2, can't be a commander, outside the color identity, sideboard in Commander, sideboard over 15, copy limit (Vintage restricted = 1), legality. Chart colors validated with the dataviz script on the dark surface (`--chart-1: #009cbd`, `--chart-2: #ff2d95`; pure `--cyan` fails the lightness band). Self-check RED first. Verified live: Esper Affinity stats (60 cards, 19 lands, avg 2.9, curve, colors, types) and its real "Sideboard 19/15" chip, hover tooltip "14 cards mana value 2", click selects the 4 rows (14 copies) in Deck view; Imported deck (Commander) 100/100 with no issues; phone 375px no overflow. Not built: Commander pairing rules beyond "1 or 2 commanders" (partner / background compatibility), draw probabilities.
- **Phase 2 completed: Change edition + Split row (2026-10-14):** from the spec. Row menu "Change edition" opens the print picker (current print highlighted) and rewrites the row snapshot; "Split row" moves one copy to its own row so it can get another edition. Self-check RED first. Verified live: Glint Hawk (one paper print) split then re-merged by picking its print; Seat of the Synod (12 prints) split 3 + 1, the single copy moved EOC → SLD, then back to EOC merged into 4; deck 60/60, Saved. Phase 2 of the spec is now done except "group by color" (left out on purpose: the user's group modes are Type / Type advanced / Mana value / custom sections).
- **Name search = dropdown only (2026-10-14):** user clarification: the results list under the bar and the lens button are gone; the bar only shows the suggestions dropdown (filtered by legality, arrows + Enter / Shift / Alt), with "No playable card with this name." when everything matching is illegal. Verified live: "Gitaxian Probe" shows the message, "elemental" 7 suggestions, arrows move, no list below. (During the check an Enter added Elementalist Adept: removed right away.)
- **Search rework + advanced search (2026-10-14):** user request. Banned / not legal cards never show in search (suggestions filtered via `lookupCards`, results via `legal:<format>`); name-search results are a text list without images, navigable with the arrows (Enter 1, Shift+Enter 4, Alt to side); "Advanced search" opens filters (name, oracle, type, mana cost, mana value, colors with colorless exclusive, identity, rarity, power, toughness, keyword, set, artist, Scryfall syntax, commander, sort) with an image grid and +. Self-check RED first (query builder, `withLegal`, order). Verified live (Pauper): "Gitaxian" no longer lists Gitaxian Probe, "elemental" = 34 results as text, arrow + Enter added Ardent Elementalist (then removed: deck back to 61/60, Saved), late suggestions no longer reopen over the results, advanced Goblin + red + mv <= 2 = 142 image results, colorless / red toggles exclusive, column 640 px, phone one column.
- **Format legality in search and deck (2026-10-14):** user request. The card search checks the deck format: banned or not legal cards cannot be added (disabled suggestion with a chip, disabled + on results, error on Enter). Cards already in the deck that are not allowed (import, format change) get a ban chip and a red summary. Decision: "not legal" blocks too (e.g. Sol Ring in Modern), not only the banlist; restricted (Vintage) is allowed. Self-check RED first. Verified live on Esper Affinity (Pauper): "Gitaxian" suggestions mark Gitaxian Probe Banned and a DFC Not legal, Enter refused; results grid disables + on both; format switched to Modern for the check (banned artifact lands, not legal Baleful Strix / Utrom Monitor / Blue Elemental Blast with chips and banner), then back to Pauper (Saved; Primeval Titan, added by the user, now flagged).
- **Deck area selection (2026-10-14):** user request. Click on empty space clears the selection, mouse drag on empty space selects by area like the print preview, +/- only on mouse hover. Verified live with the real mouse: stacks area inside the Goldmire Bridge strip selects only it (not the card underneath nor the next), a larger area adds Lands and Artifacts keeping the first, the click that ends an area does not clear, a click on empty space clears; list view area over two rows selects those two.
- **Drag ghost and sticky +/- fixes (2026-10-14):** user report. Dragging in stacks showed the cards lying over the dragged one in the ghost (now a custom ghost with only the card and the moved copies count); after a click the +/- stayed visible because `:focus-within` matched the focused button (now keyboard focus only). Verified live: `setDragImage` receives one 140x195 card with badge 4 (none with Alt), the ghost is removed; after a real click and moving the mouse away +/- are hidden (opacity 0), with Tab focus they show (1).
- **Alt+drag one copy, new defaults (2026-10-14):** user request. Holding Alt when the drag starts moves a single copy (the row keeps the rest); defaults for a device without a saved choice are Sort by Name and View by Stacks (Group by Type already came from `newDeck`). Self-check RED first. Verified live: defaults after clearing the pane's saved prefs, Alt-drag Glint Hawk 4 → 3 main + 1 side, then back to 4; deck 60/60, Saved.
- **Toolbar dropdowns, sort, drag between boards (2026-10-14):** user request. View icons became a "View by" dropdown next to Group by; new "Sort by" (mana value or name) inside every group; "Custom" left the Group by list: "New section" is always there and creating a section switches the deck to custom (deleting the last one goes back to Type); drag and drop now also moves cards between main groups, Sideboard and Maybeboard (an empty Maybeboard appears while dragging). Self-check RED first. Verified live on Esper Affinity: dropdown options, sort by name, drags main to side, side to an empty maybeboard and back (synthetic DragEvents), new section from Type and its deletion; deck back to 60/60, Saved.
- **Every-copy stacks + copy limit warning (2026-10-14):** user request. New view "Stacks, every copy" (4 copies = 4 cards in the stack). Warning when a card goes over the copy limit: 4 in 60-card formats (main + sideboard, prints of the same card counted together), 1 in Commander; cards that allow more are exempt automatically (basic lands, "any number of cards named", "up to N" raises the limit to N), Casual and maybeboard never warn. Self-check RED first then green. Verified live on Esper Affinity: split view 19 cards for 19 copies; format switched to Commander for the check (banner + 19 flagged rows, the 1-copy card and the sideboard not flagged, badges in stacks), then back to Pauper (60/60, Saved, no warning).
- **Deck grouping and views (2026-10-14):** user request. Editor toolbar: Group by Type / Type, advanced (dual types like Artifact Creature in their own group) / Mana value / Custom (sections you create, drag cards in or use the row menu), and View List / Grid / Stacks. In list (and stacks) the card image appears next to the hovered row. Self-check covers the new groupings and the section functions (RED first). Verified live on Esper Affinity: typeAdv splits Artifact Creatures and Artifact Lands, mv 1/2/4/5/7+/Lands, grid, stacks with preview, custom section created, drag (synthetic DragEvents: the agent's mouse drag does not start HTML5 DnD), Move to "Deck" from the menu, delete section, phone 375px with 2 stack / grid columns and +/- only on the selected card. The deck was put back to Type and the view to List.
- **Profile photo from a card art + crop editor (2026-10-14):** user request. Change photo now opens a dialog: upload an image or search a card and pick one of its illustrations (Scryfall `unique=art`, `art_crop`), then center it in the circle with drag, zoom (slider, wheel, pinch, keys) and live circle previews at profile and menu size. `fetchPrints` takes `unique` and returns `art`. Verified live: Lightning Bolt 33 arts, Sol Ring 74, crop view, wheel zoom without modal scroll, drag, arrows, + / -, pinch via synthetic two-finger pointer events (80 to 160 px = zoom 2, closing = min 1), canvas not tainted (art crop to 256 px JPEG = 40k chars, under the 200k rule), 375px layout. Not saved from the agent (it would replace the user's real photo).
- **Profile page (2026-10-14):** user request. Account menu, Profile opens `#/profile`: change or remove the profile photo, set a nickname, account summary, change password (email accounts). Verified live with the Google account: menu item, page data (method, dates, 2 decks / 175 cards), desktop and 375px layout with no horizontal scroll, no new console errors. Not exercised live (they would change the real account): saving a nickname, uploading a photo (needs the new rules published), changing a password.
- **Email verification (2026-10-14):** user request. Sign-up sends a Firebase verification email; until it is confirmed the Decks area shows a "Verify your email" panel and the Firestore rules refuse the account (Google sessions pass). Verified: lint, build, Google account still sees its deck list with no console errors. The verify panel itself is untested live (needs a real email sign-up, which the agent must not do).
- **Email + password sign-in (2026-10-14):** user request. The sign-in panel adds an email + password form under the Google button (sign in, create account, reset link); account deletion for email-only users asks for a fresh sign-in when Firebase wants a recent login (the decks are already deleted at that point). Privacy panel copy updated. Verified live on a clean origin: layout desktop + 375px, mode toggle, empty-email reset error, no console errors; no real sign-in sent from the agent. Also verified live now that the pane is signed in: the editor sync label goes Saved, Offline, Saved on offline/online events.
- **Deck manager phase 1 complete (2026-10-14):** all 12 plan tasks shipped. Wrap-up: self-checks (`deckModel`, `scryfall`), `eslint src` and build green, DecksView in its own lazy chunk; phone layout and tile long-press verified at 375px; the offline label logic was checked in code (`navigator.onLine` events + Firestore `hasPendingWrites` via `includeMetadataChanges`), not live, because the pane session was signed out. Still on the user: real offline round trip (phone in airplane mode, then PC sees the change), iOS Safari sign-in on the deployed site, link import once a CORS proxy answers. Next: plans for phases 2 and 3 (spec). Earlier detail: Firebase sign-in gate, account menu, privacy panel, error boundary, synced deck list with backup/restore and import from link or list, deck editor (debounced sync, type groups, boards, row menu), card search with add shortcuts, Print deck, cookie banner mentions the sign-in session (Firebase project `proxoteca` live; tasks 6-11 verified live after the user signed in: list ops, backup/restore, import from list, rules deny other uids, two-tab sync, editor, search shortcuts, Print deck, phone layout). Open: link import untested live (public CORS proxies hang; now 15 s timeout per proxy), offline + iOS sign-in checks by the user, final review; Decks | Print tabs with hash routes, lazy Decks chunk, print hand-off (verified live: queue kept across tab switches, reload on #/decks, mobile header tabs at 375px); shared CardMenu / long press / mana symbols / deck icons (print menu re-verified live); deck model core, views and I/O + self-check; Scryfall search helpers and deck boards from links (print import re-verified live: Sol Ring + Delver DFC = 3 images; link import not verified live, the public CORS proxies were down) (plan `docs/superpowers/plans/2026-10-13-deck-manager-phase1.md`).
- **Deck manager spec:** user wants deck lists with
  Scryfall search, editions, stats and a one-click hand-off to print, synced PC/phone via
  Firebase (Auth Google + Firestore offline cache, chosen over Drive and Supabase). Design
  approved in chat; spec in `docs/superpowers/specs/2026-10-13-deck-manager-design.md`,
  reviewed (sideboard for 60-card formats and Enter / Alt / Shift add shortcuts added). Phase 1
  plan: `docs/superpowers/plans/2026-10-13-deck-manager-phase1.md` (12 tasks), awaiting review.
- **Marquee selection:** user request. Drag on empty preview space draws a cyan
  dashed rectangle; touched cards are added to the selection live, never deselecting the rest.
  Desktop mouse only (touch drag = scroll). Verified live with 12 cards: drag over 4 cards
  → those 4, a second drag adds to them, click on empty clears, card drag-swap and card click unchanged,
  no console errors, lint + build.
- **3-part logo X:** user request, Figma node 4025:2465 redrawn. The X is now a
  cyan filled centre + magenta V above and below (was four chevrons), letters re-exported at the
  new `0 0 143 30.5` viewBox. Hover = centre still, the two V rotate 180° on the vertical axis
  through the X centre and back on leave (user's pick after trying centre + V flips, an in-plane
  720° spin, a flat and a perspective 720° rotateY; perspective inside an svg is unreliable in
  Chrome, it needed an overlay svg, dropped with that variant). Favicons (svg + all rasters + ico) redrawn with the new
  mark; pager `IconChevron` got the V's rounded apex. Verified live: part bboxes match the Figma SVG (core centred at
  56.5, 15.25), transform sampling shows the centre done at ~0.4s and the V at ~0.7s, lint + build.
- **Pager arrows = logo chevrons, numbers = target pages:** user request.
  `IconChevron` (single + double) redrawn as the brandmark chevron (one arm twice the other,
  like the selected-card corners); the "next/last" side rotates it 180° so it is the logo's other
  side arm. The pager numbers now show where each button goes: previous page on the left, next
  page on the right (page 2: 1 | 3; page 1: _ | 2; last: N-1 | _), inside the buttons (clicking the
  number navigates; aria-label "Previous page, 1"). Same on the mobile footer pager, which dropped
  "n/N". Verified live: 40 cards / 3 pages, numbers at p1/p2/p3 and back, 4× zoom of the shapes,
  mobile at 375px.
- **Side pager + hint moved to help (2026-10-13):** desktop page navigation now sits
  beside the sheet, vertically centred, as in the user's mockup: `« ‹ 1` on the left (first, prev,
  current page) and `3 › »` on the right (total pages, next, last), bare cyan chevrons + bold page
  numbers. The footer under the sheet only keeps "N cards · add M to fill this page". The gesture
  hint (click / right-click / drag, mobile tap / long-press) moved into the `?` help tooltip as a
  compact `.help-controls` row; the "Tweak" step no longer repeats it. Mobile keeps the bottom pager.
  Verified live: 20 cards / 2 pages, next/first work, selection survives page change, help shows the
  row, mobile unchanged; lint + build green.
- **Dependency security pass (2026-10-13):** `jspdf` 4.2.0 → **4.2.1** (`^4.2.1`), plus
  `npm audit fix` (no `--force`): transitive `dompurify` 3.3.1 → 3.4.17, `fflate` 0.8.2 → 0.8.3,
  `brace-expansion` 1.1.12 → 1.1.21, plus in-range dev bumps (vite 7.3.7, esbuild 0.28, babel).
  Triage: none of the fixed advisories hit our code paths. The jspdf critical (GHSA-7x6v, PDF object
  injection) needs `createAnnotation({color})` and the HTML-injection one (GHSA-wfv2) needs
  `output('*newwindow', opts)`; `pdfGenerator.js` only calls `addImage`/`line`/`addPage`/`save`.
  dompurify is only loaded by jspdf's `html()` plugin (never called), fflate is used by jspdf only
  for `zlibSync` compression, never `unzipSync` (the ZIP64 loop). Updated anyway for defense in depth.
  Verified: lint clean, build green, dev export of 2 cards (A3, RGB) → valid `%PDF-1.3`, 1 page,
  2 images, `%%EOF`, jspdf reports 4.2.1, no console errors.
- **AI upscale 2×:** new "Upscale 2× (AI)" in the card context menu (one card or
  the selection): ESRGAN-medium via UpscalerJS/TF.js runs in the browser (WebGL), no server.
  Scryfall PNG 744×1040 → 1488×2080 (~600 DPI at 63 mm), text/symbol edges visibly crisper than
  the bilinear scaling the PDF did; transparent corners kept. Only offered for RGB cards under
  the chosen DPI. Verified live: 2 cards in 16 s incl. model load with a live % toast, `w`
  updated so the item turns "all sharp at 600 DPI"; entry bundle +3.4 kB, TF in a lazy chunk.
  Picked medium over slim (same speed here, better model).
- **Sidebar without explanations:** removed every `.field-hint` under the sidebar
  controls (Bleed, Output RGB, ICC upload help, rendering intent x2, Bleed in art, Resolution,
  Compression, crop marks), the `PDF/X-1a:2003 · DeviceCMYK · embedded ICC` tag (+ its
  `.cmyk-tag` CSS and the now unused `px-pulse` keyframes) and the "sheet smaller than the card"
  warning (the preview already shows "No cards fit this sheet"). Kept: all controls, the
  "✓ file.icc" confirmation and the profile-mismatch warning (only place it is reported).
  Verified live in RGB and CMYK: zero hint/tag/warning nodes, all selects present.
- **Logo-style frame corners:** the card frame's corner brackets were near-square
  (9×8.5); now one arm is twice the other (10/5px) like the brandmark chevrons, long arm
  clockwise, so the frame shares the logo's rotational symmetry. Verified live (path boxes
  10×5 / 5×10 alternating) + 4× zoom of a selected card.
- **Header wordmark from Figma:** the header (desktop + mobile) now shows the
  "PROXOTECA" lockup from the user's Figma frame 4025:2465 (exact letter paths, the X drawn as
  the four-chevron mark) instead of logo + text title. The hover flip carries over to the X,
  mirrored around the X centre. `Logo`/`LOGO_ARMS` and the old `.app-header h1` /
  `.mobile-header h1` text styles were removed; favicons unchanged. Verified live: 146×30 desktop,
  126×26 mobile next to the "?", accessible name "Proxoteca", flipped arm boxes mirrored about
  the X centre, `transitionstart` 0→3 in ~42ms steps, ends at ~0.45s.
- **Logo flip on hover:** hovering the header logo flips the top and bottom
  chevrons horizontally and the right and left ones vertically, each mirrored around the logo
  centre so the vertices stay put and the pinwheel reverses its spin; leaving reverses it.
  Clockwise 45ms stagger in, counter-clockwise out. CSS transitions only (interrupting
  mid-way reverses from the current point; reduced-motion makes it instant via the global
  rule). Verified live: end transforms `matrix(-1,0,0,1)` / `matrix(1,0,0,-1)`, arm boxes
  mirrored about the centre, `transitionstart` order 0→3 in and 3→0 out.
- **Low-res explanation moved into the chip:** user request. The sidebar warning
  above Resolution is gone (`lowResCount` no longer passed to `PageSettings`; App still computes
  it for the mobile Export page). Hovering the `!` chip widens it to the card's width and reveals
  the text inside; leaving restores the icon. Text fades in after the widening and out before
  the shrink. Verified live: rest 17×17, hover 80×81 on an 88px card (stays inside it) and full
  width single line on an A5 card, back to 17×17 on exit, keyboard focus expands, click on the
  chip selects the card.
- **Low-res "!" restyled to the design system:** user request, done with the taste
  skill as an audit-first "preserve" pass. Before: red `#ef4444` triangle drawn on the canvas
  with a sans "!" (off-token, a shape used nowhere else), and a solid `#ef4444` square in the
  sidebar/mobile export warning. Now one HUD chip for both (`.lowres-badge`, `.lowres-mark`):
  17px dark glass plate, `--danger` 1px border, mono "!" in `--danger` with glow, 45° chamfer
  top-left (a gradient redraws the border along the chamfer since `clip-path` cuts the inset
  shadow; no outer shadow for the same reason). The card chip is DOM inside the hotspot, top-left
  of the trim, `pointer-events: none`; `PageCanvas` no longer takes `dpi`. `.lowres-warn` tint
  moved to `--danger` too. Verified live (4 low-res cards at 600 DPI) + 6× zoom clones on red,
  white and panel backgrounds.
- **Search in the change-art box:** cards with many printings (Sol Ring: 134)
  get a search field above the grid with an example placeholder. Local, no extra requests;
  `fetchPrints` now also maps `artist` and `year` (`released_at`). Verified live: "secret lair"
  34/134, "C21" 2, "2021" 7, "commander 2021" 5 (multi-word AND), "zzzz" → empty hint, clear
  restores 134.
- **Mobile: tap = click, long-press = right-click:** the mobile preview now uses
  the desktop selection model. Tap toggles selection; long-press opens the same `CardMenu`
  (single or multi-card actions) at the finger. `onCardTap`/tap mode and `CardActionSheet`
  (+ `.sheet-ic`/`.sheet-danger` CSS) removed; `MobileLayout` passes `touch`. Footer hint and
  mobile help text updated. Verified at 375px with synthetic touch pointer events: tap toggle,
  long-press on a selected card → "2 cards selected", on an unselected card → selects it alone,
  moving finger cancels, the click after release is ignored, next tap works, menu in viewport,
  items 44px; desktop unchanged (right-click menu, drag, hover frame).
- **Add-cards menu above sticky headers:** the "Upload / Scryfall / MPCFill"
  menu opened under the sticky sidebar `h2`s ("[ SUMMARY ]"). `.sidebar-export` has
  `backdrop-filter`, which makes it a stacking context at level 0, so the menu's `z-index: 20`
  only counted inside it and the sticky `h2` (`z-index: 1`) won. Fix: `.sidebar-export
  { position: relative; z-index: 2 }`. Verified live by sampling `elementFromPoint` over the
  open menu with "Summary" behind it: 132 covered points before, 0 after.
- **Glow on selected segments:** user request. Selected cards' four side segments
  now glow in their own colour (magenta/cyan) through an SVG blur filter on the `.segs`
  group; corner brackets and hover stay unglowed. Verified live (computed filter + zoom).
- **Selected frame per Figma 4021:2397:** selected cards now show the long centred
  segments from the user's second Figma frame; hover keeps the short rotated ones (4021:2411).
  One SVG, hover = CSS `scaleX(0.67)`/`scaleY(0.5)` from the right end, selected = `none`
  with a 0.22s ease-out. Hover is now full opacity and the selected glow is gone (neither is in
  the design; the shape difference already tells them apart). Verified live with measured
  segment spans matching both frames.
- **Figma card frame + toggle click + no layout jump:** hover/selected outline now
  follows the user's Figma example (node 4021:2411): `CardFrame` SVG per hotspot, segments in %
  so it scales, brackets/stroke fixed px; hover dimmer than selected so a deselecting click
  is visible under the cursor. Left click toggles selection (Ctrl not needed). Selecting used to
  shift the sheet ~8px (footer went 60px → 43px when the bulk bar replaced count + hint);
  both now share one grid cell, footer height constant (verified: canvas top unchanged across
  select/deselect). Help/hint/tooltip copy updated.
- **Click selects, right-click acts on the selection:** left click no longer opens
  change-art, it selects; Ctrl/⌘-click adds. The right-click menu adapts: one card = the single
  actions; several = Change art (enabled only when they are the same card, `artName` =
  filename sans extension, now shared from `utils/scryfall.js` with `ArtPickerModal`), Duplicate
  all, Bleed on/off for all, Remove all. App: `editingIds` array (picked art applied to every
  id, one object URL each), `handleDuplicate` takes an id or an array (+ toast for >1),
  `ArtPickerModal` `count` prop shows "(N cards)". Verified live: select/ctrl/empty-click,
  disabled art on mixed cards, real Scryfall reprint applied to 2 Sol Ring copies, duplicate
  all, remove all, right-click outside selection; lint + build green.
- **Card context menu replaces the corner icons:** the hover icons on each preview
  card (duplicate, bleed toggle, delete) are gone; right-click a card (or Shift+F10 / menu key)
  for Change art, Duplicate, Bleed (cycles in place), Remove. Their CSS was deleted; the
  always-on "bleed on" icon indicator went with them. Hint, tooltip and help text updated.
  Verified live: mouse + keyboard open, bleed cycle, arrow nav, Esc restores focus, duplicate,
  remove (undo toast), change art, outside click; lint + build green.
- **Drag-to-reorder cards:** desktop preview cards can be dragged onto another
  card to **swap** the two (others stay put, changed from shift-insert on user request);
  Alt+arrow keys swap with the neighbour from the keyboard (up/down = one row, crosses pages). New App `handleMove(id, to)` → `onMove` in `previewProps`. Custom
  MIME `application/x-proxoteca-card` keeps react-dropzone's file overlay out of it. Hint +
  title + help tooltip mention it. Mobile (tap mode) unchanged. Verified live in Chromium:
  real mouse drag slot 1↔slot 4 (middle cards unchanged), drop highlight, Alt+Left keeps focus and doesn't navigate back,
  no console errors, lint + build green.
- **Logo in page colours:** the four chevrons now alternate **magenta, cyan,
  magenta, cyan** clockwise from the top arm (was all white + fringe filter, filter removed).
  Applied to `Logo`, `favicon.svg` and all rasters/`.ico` (Pillow, per-arm colour).
- **New logo + favicons:** user supplied a new brandmark (white, four 90°-rotated
  chevrons with round caps, on black). Rebuilt as vector by fitting a parametric model to the
  PNG (IoU 0.96): centre-to-vertex 51, long arm 137, short arm 74, stroke 39 (units = px of the
  736 source). `Logo` (header desktop + mobile) now draws that path in `currentColor`; favicon
  svg + all rasters + `.ico` regenerated (Pillow), manifest colours fixed (`#16181D` → `#08070f`).
  Replaces the cyberpunk crosshair and the stale gold favicons. Verified live: header renders,
  all icon URLs 200 with right MIME.
- **Em-dash purge:** every U+2014 in the repo (src UI copy + comments, HANDOFF,
  docs/, .impeccable/) replaced by a period (new sentence, next word capitalised) or a comma,
  decided per case. UI strings changed accordingly, e.g. card sizes `Standard, 63×88`, sheet
  options `A3, 297×420 mm`, toasts/errors `PDF ready. Check your downloads.` Only hit left is
  inside the binary `ISOcoated_v2_eci.icc` (profile metadata, editing it corrupts the file).
- **Sticky sidebar headers flush:** the sticky `.sidebar-section h2` had `top:0`,
  but sticky respects the scroller's 24px `padding-top` → it parked 24px down and scrolled
  content showed in the gap above it (plus through its 0.92-alpha bg). Now `top:-24px`
  (= `.sidebar-scroll` padding, keep in sync) + opaque `rgb(10,9,18)` bg. Verified live:
  stuck h2 top == scroller top.
- **Removed empty-state CTA:** user asked to drop the centered "No cards yet"
  box and keep only the bottom-left **Add cards** button. Deleted the overlay JSX in
  `PagePreview.jsx`, the now-dead `onAdd` prop (App `previewProps`, MobileLayout), the
  `IconPlus` import, and the `.empty-cta-box`/`.empty-cta-btn` CSS. `.preview-empty-cta` +
  title/sub styles stay for the "No cards fit this sheet" warning. Verified live (empty
  desktop), lint + build green.
- **Cyberpunk re-skin:** implemented the user's claude.ai/design spec
  "Proxoteca Cyberpunk.dc.html", full token + component restyle, zero functional changes
  (see the "Design system" section above for the complete language). Touched:
  `index.html` (fonts, theme-color), `src/index.css` (tokens + ~all component styles),
  `src/components/icons.jsx` (new crosshair `Logo`), `PageSettings.jsx` (slider `--fill`
  inline var), `PagePreview.jsx` (`.empty-cta-box` wrapper for the framed empty state).
  Both gradient-text wordmarks replaced by solid+chromatic-shadow → **slop detector now
  returns `[]`** (was 2 accepted hits). Verified live with screenshots (desktop empty +
  populated, mobile 375px); contrast sweep 5.8–17:1 all AA+; lint + build green.
- **Post-sweep code review:** 10-angle multi-agent `/code-review` of the 4-batch range
  (34 raw candidates → 5 confirmed after refute-by-default verify + gap sweep). Fixed:
  - **MpcImportModal 0-import read as success**. The "✓ 0 images imported" bug fixed in Scryfall was
    missed in MPC; now 0 downloads + failures → error box (same logic).
  - **Desktop add-menu now closes on Esc** (App.jsx effect gained a keydown listener beside click-outside).
  - **Mobile stacked-Esc**. The MobileLayout inline Esc effect for addOpen/helpOpen now bails when a
    `page`/`sel` overlay is on top, so one Esc closes only the topmost layer (verified: help stays open
    when Esc closes the Settings page; second Esc closes help).
  - **`ExportProgress` component** (`src/components/ExportProgress.jsx`), the duplicated Generate/progress/
    Cancel block extracted from App.jsx + MobileLayout.jsx (single source).
  - **Sticky h2 overflow on mobile**. The sticky `.sidebar-section h2` (-20px margins sized to
    `.sidebar-scroll`'s 20px padding) leaked 6px per side inside `.mobile-page-body` (14px padding);
    rule now scoped to `.sidebar-scroll .sidebar-section h2`, mobile headers are plain/static.
  - Refuted (not bugs, with proof): disabled-loading parity on Generate (branch renders only when !loading);
    "hooks before early return" claims (that IS the rule); conv double-close on abort (throw skips the outer
    close); AbortError wrapping; post-unmount double-revoke (spec'd no-op). Deferred by choice: options-object
    refactor of the 13/16-param export signatures; `:has()` fallback; toast glyph→SVG icon.
- **Fifth critique → full 4-batch sweep:** a fresh multi-agent `/impeccable critique` (6 isolated
  lenses + adversarial verify of every finding; **41 raw → 29 confirmed, 12 refuted**) scored **30/40** "Good"
  and is the **first persisted snapshot** (`.impeccable/critique/2026-06-25T13-02-03Z__src-app-jsx.md`; earlier
  HANDOFF critiques were never saved to `.impeccable/`, so the score isn't directly comparable). Detector clean
  on JSX; live contrast sweep all-pass. User chose **all 29, P1-first, CMYK = keep power + add glosses.** All four
  batches shipped, live-verified, lint + build green:
  - **Batch 1, a11y (P1):** new **`src/hooks/useOverlayDismiss.js`** (Esc-to-close + focus-into-overlay on open +
    restore-to-trigger on close) wired into **every** overlay: Scryfall/MPC/ArtPicker modals, ConfirmDialog,
    CardActionSheet, mobile MobilePage (Settings/Export), mobile add-sheet + help popover, desktop help tooltip.
    Plus: ConfirmDialog `autoFocus` moved off the destructive button → **Cancel**; help button's
    `aria-haspopup="dialog"` dropped (mismatch with `role="tooltip"`). (Modals with `if(!open) return null` pass
    the open flag as the hook's `active` arg. Hooks can't run after the early return.)
  - **Batch 2, export + CMYK copy (P1):** `generatePDF` + `buildCmykPdfBytes` take `onProgress(done,total)` +
    an `AbortSignal`; both loops report per-card progress and bail cooperatively (typed `AbortError`). App +
    MobileLayout show a **determinate bar (`.gen-bar`/`.gen-bar-fill`, scaleX not width) + "Cancel export"**;
    abort → neutral "Export canceled." toast. CMYK copy (kept all controls, added plain glosses): actionable ICC
    error pointing to the sidebar control + naming Coated FOGRA39; **BPC decoded** (Black Point Compensation);
    intents differentiated + default marked; ICC-upload hint (where to get a profile); profile-mismatch warning
    rewritten plain; DPI/low-res hints explain the half-the-pixels threshold (~745px @300DPI).
  - **Batch 3, P2:** per-card bleed button now shows the **resolved** bleed (`resolveBleedMode(mode, bleedStyle)`)
    so the label matches what prints (desktop + mobile CardActionSheet, which now gets `bleedStyle`); Scryfall
    import with **0 imported + some not-found → error** (was a green "✓ 0 imported"); not-found lists cap at 8
    (+N more) and scroll (Scryfall + MPC); mobile help tooltip = centered fixed panel + max-height scroll + close
    ✕; mobile bottom cluster got visible **Delete / Add / Save** micro-labels; duplicate→delete **object-URL leak**
    fixed (`pendingRevokesRef` Set flushed on unmount).
  - **Batch 4, P3:** `.sidebar-section h2` is **sticky** (full-width bg via `margin/padding -20px`, no overflow);
    **Toast** got a semantic ✓/! badge (`.toast-ic`, color by kind); mm↔inch conversion bumped to 3/2-decimal
    precision so repeated toggles don't drift.
  - **Still open** (not in this sweep): full focus-**trap** on Tab inside modals (Esc + focus-in/restore done;
    `ponytail:` note in the hook); a CORS-proxy retry for deck links; Acrobat preflight (user-side, doc §7).
    The 2 detector gradient-text hits remain the deliberate **"Proxoteca" wordmark** (brand, not slop).
- **Fourth critique → regressions + push for Excellent:** fourth multi-agent `critique` scored
  **34/40** (up from 33; #5 + #10 reached a genuine 4). It found 3 regressions from the previous batch + the
  loudest pre-existing P2s. All 6 fixed + live-verified; lint + build green; console clean.
  - **Regression: mobile error box lost the dismiss ×** (added to desktop only). Threaded `onClearError`
    into the `actions` bundle ([App.jsx](src/App.jsx)) + the same `IconX` dismiss in `MobileLayout`, parity
    restored (this was the sole thing capping #9 at 3). Verified live: mobile error shows + clears.
  - **Regression: new `.field-hint`s failed WCAG AA**. `.field-hint` was `--text-muted` #767e93 at 11.5px
    (~4.0–4.46:1 on the glass-over-surface bg), the exact pattern already rejected at `.sidebar-section h2`.
    Switched `.field-hint` → `--text-secondary` (#8b92a8) and `.field-hint b` → `--text-primary`. One CSS rule.
  - **Regression: card W/H = 0 bypassed the degenerate guard** (incl. a latent `bleed=0 + card=0` →
    `Array.from({length: Infinity})` RangeError). `calcGrid` ([utils/pdfGenerator.js](src/utils/pdfGenerator.js))
    now returns a 0×0 grid when `cardW/cardH/cellW/cellH <= 0`, so `perPage===0` → the existing `fits` handling
    (warning + suppressed chrome) kicks in. Verified: card-0 shows "No cards fit", finite canvas, no crash.
  - **Shift-click range-select** (was a false affordance, aliased to ctrl): `handleCardClick` now tracks an
    `anchorRef` and shift-click selects the contiguous range on the current page (Finder/Linear-style), making
    the "Shift-click to select multiple" copy true. Verified: ctrl-click anchor + shift-click → 5-card range.
  - **Keyboard Delete on the card grid**: the bail-on-`BUTTON` guard over-fired on the card buttons (focus sits
    there after selecting). Now Delete also fires when `e.target.closest('.preview-card-hotspot')`, still
    suppressed on nav/bulk/sidebar. Verified: Delete on a focused card → undo toast.
  - **SR announce of the selection count**: a second `.sr-only aria-live` region announces
    "N cards selected[, spanning multiple pages]" (the bulk-bar count is visual-only). Verified live.
  - **Still open** (verified P2/P3, not done): help-button `aria-haspopup="dialog"`→`role="tooltip"` mismatch +
    no Esc-to-close; CMYK ICC-upload label keyboard-unreachable (`hidden` input); Bleed-style dropdown has no
    default hint; advanced CMYK/rendering-intent jargon; per-page select-all; single toast slot; ICC-clear raw
    `×` glyph vs IconX. Deferred features: drag-reorder, mobile batch.
- **Third critique → push for Excellent:** third multi-agent `critique` scored **33/40** (up from 31;
  #1 Visibility + #3 Control reached a genuine 4). It flagged 3 regressions from the prior batches + caps on
  heuristics 5/9/10. All fixed + live-verified; lint + build green.
  - **Regression: bulk Bleed flattened mirror/full → stretch** ([App.jsx](src/App.jsx) `handleBleedMany`): turning
    bleed ON in bulk now only promotes `none`→`stretch` and **preserves `mirror`/`full`** (Scryfall full-art = mirror);
    no silent print-fidelity downgrade. OFF still sets all `none`.
  - **Regression: degenerate-sheet footgun** ([PagePreview.jsx](src/components/PagePreview.jsx)): when no card fits
    (`info.perPage===0`), the pager/count/hint/bulk-bar are now gated on a new `fits` flag and the Ctrl+A/Delete
    keyboard handler early-returns, no phantom "1/45" pager, no "delete what you can't see". Only the "No cards fit
    this sheet" alert shows.
  - **Regression: undo toast under-lived its window**: action-bearing toasts now auto-dismiss at **5000ms** (was a
    flat 3500) and the deferred revoke moved to **5300ms**, so the Undo button stays reachable for its full window.
  - **#5 input validation**: custom sheet/card numeric inputs go through `toNum` (empty/invalid → 0, never NaN, kills
    the "NaN×NaN" grid), plus an inline `.field-hint-warn` "Sheet smaller than the W×H mm card" at the source.
  - **#9 error recovery**: the sidebar error box got a **dismiss ×** (`setError(null)`) so a failed generate/ICC can
    be cleared directly, not only as a side-effect of the next action.
  - **#10 help/docs**: plain-language `field-hint`s added to the always-visible print terms, **Bleed**, **Output**
    (RGB vs CMYK steer), **Resolution/DPI**, **crop marks**, extending the existing hint pattern.
  - **Bonus (found via console during verify):** a zero-dimension sheet made `scale = previewW/0 = Infinity` →
    invalid CSS height. Guarded `ratio`/`scale`/`previewH` in both PagePreview and PageCanvas (fallback to the card
    ratio) so the degenerate state renders a clean blank sheet with no console errors.
  - **Verify killed 2 false positives** (a phantom "no keyboard path to corner buttons"; a "footer text fails AA" that
    used the wrong bg. It's on `--bg-base`, computes 4.73:1, passes). **Still open** (P2/P3, not done): jargon for the
    advanced CMYK/intent fields, SR announce of the selection count, Shift-click range-select, help-tooltip role.
- **Re-critique P3 polish, 5 fixes:** all live-verified, lint + build green.
  - **Refresh-loss guard** ([App.jsx](src/App.jsx)): a `beforeunload` listener (only while `images.length>0`)
    fires the browser's native "leave site?" prompt. Images aren't persisted (blobs revoked on unmount), so a
    reload no longer silently drops a layout. Verified: `beforeunload` event is `defaultPrevented` with cards present.
  - **Keyboard skip-link** ([PagePreview.jsx](src/components/PagePreview.jsx)): the desktop grid is 4 tab-stops
    per card; a `.skip-cards-link` (hidden until `:focus-visible`, top-left of the preview) focuses the footer
    (`footerRef`, `tabIndex={-1}`) so keyboard users jump past the grid. Verified: activating it moves focus to
    `.preview-footer`.
  - **Friendlier count copy**: "N img · N to fill the page" → **"N cards · add N to fill this page"** (matches the
    sr-only summary's "card(s)" wording).
  - **`Clear` is now a ghost button** (transparent border/bg, muted → primary on hover) so it reads as a tertiary
    "dismiss" vs the bordered Bleed/Delete pills.
  - **`.bulk-btn:active`** press feedback (translateY) to match `.btn-add`/`.btn-generate`.
  - **Deliberately skipped** (confirmed P3, low value / risk): mobile cluster labels (would crowd the centered FAB
    cluster; a11y already covered by aria-labels + help) and the low-res SR/canvas measurement race (self-healing,
    transient). **Still deferred as features** (not polish): drag-reorder, mobile batch ops.
- **Re-critique P2 backlog, 8 fixes:** cleared the deferred P2s from the re-`critique`. All
  live-verified + an independent reviewer pass found no bugs; lint + build green.
  - **Generate-PDF success toast** ([App.jsx](src/App.jsx) `handleGenerate`): the primary export was silent;
    now emits `{kind:'success', msg:'PDF ready. Check your downloads.'}` (Toast infra already existed).
  - **Undo for delete** (single + bulk): new `removeWithUndo(ids)`, captures items+indices (pure, from current
    `images`), defers `URL.revokeObjectURL` to a 5 s timer that **only fires if not undone**, and shows a toast
    with an **Undo** action that re-inserts at original indices. `Toast` gained an optional `action:{label,onClick}`
    button (`.toast-action`, `stopPropagation` so it doesn't trigger the toast's tap-to-close). `handleRemove` +
    `handleRemoveMany` both route through it. (Clear-all keeps its confirm.)
  - **Bulk-Bleed converges + feedback** (`handleBleedMany`): replaced the per-card `nextBleedMode` cycle (which
    never made a mixed selection uniform) with an **absolute target**, if any selected card is `none` → all
    `stretch`, else all `none`, plus a toast "Bleed on/off for N cards".
  - **Ctrl+A scope label**: the bulk-count shows **"N selected · spans pages"** when the selection includes
    off-page cards (`selectedSpansPages` memo), so a blind Ctrl+A→Delete is signalled.
  - **Multi-select discoverability**: a persistent `.preview-hint` ("Ctrl/⌘ or Shift-click to select multiple")
    under the count when >1 card and nothing selected, + a line in the desktop `?` help dialog.
  - **Keyboard selection**: `Space` on a focused card toggles selection (Enter still changes art); `aria-pressed`
    now always set in select mode (was only-when-selected). Verified Space toggles without firing change-art.
  - **Card label = real Scryfall name**: per-card `aria-label`s now use `img.name` (the Scryfall card name, already
    stored) and fall back to the filename; corner buttons (dup/bleed/delete) use the same `name`.
  - **Degenerate-sheet warning**: when `info.perPage === 0` (sheet too small / card bigger than sheet) with cards
    present, a `.preview-warn-cta` "No cards fit this sheet" overlay replaces the silent blank page.
  - Also removed a stale "(⬇)" from the mobile help (Save list is the list glyph now). **Still deferred** (P3 +
    explicit): drag-reorder, mobile batch, per-card tab-order weight, `.bulk-btn:active` polish, `Clear` icon.
- **Re-critique P1 regressions, multi-select rough edges:** an impeccable re-`critique`
  (multi-agent: 6 lenses + adversarial verify of every finding) scored **31/40** (up from 29) but flagged that
  the desktop multi-select feature shipped with **2 P1 regressions**, both fixed here in `PagePreview.jsx`:
  - **Trapped pager:** the bulk bar and the pager were the two branches of one footer ternary, so selecting any
    card on a multi-page sheet **removed the pager + page indicator**. You couldn't change page or build a
    cross-page selection by clicking. Now the bulk bar is its own footer row and the pager **always renders**
    when `totalPages>1` (the plain count hides while the bulk bar shows, since the bar has its own count). The
    `selected` Set is id-keyed so it survives page changes. Verified live (24 cards / 2 pages): select → pager
    stays, Next → page 2 with selection intact.
  - **Backspace wiped the selection:** the window keydown guard bailed on INPUT/TEXTAREA/SELECT but **not BUTTON**,
    so a keyboard user tabbing through cards who hit Backspace (the "go back" reflex) wiped the whole selection.
    Now **Backspace is dropped** (only `Delete` deletes) and `Delete` fires **only when focus is not on a
    BUTTON/A**. Tabbing through cards can't trigger it; the explicit path is the bulk-bar Delete button (Esc /
    Ctrl+A unchanged). Verified live: Backspace/Delete on a focused card = no wipe; Delete from background = deletes.
  - Adversarial verify also **killed 3 false-positive findings** (a non-existent `img.file` crash, a "no escape"
    claim refuted by the visible Clear button, a "double outline" refuted by CSS cascade). **Deferred P2 backlog**
    (acknowledged, not done): Generate-PDF success toast, undo for delete, Ctrl+A all-pages scope, bulk-Bleed
    convergence+feedback, multi-select discoverability hint, keyboard selection, card label = real Scryfall name,
    degenerate-sheet warning. Lint + build green.
- **UX critique P3, Save-list icon disambiguation:** the mobile action bar had **two adjacent
  down-arrow glyphs**, Save list (`IconDownload` ⬇) next to Export (`IconFile`, whose path includes a download
  arrow), and the cluster buttons are icon-only, so "which one makes the PDF?" was ambiguous. Added a distinct
  **`IconList`** (elenco/list glyph) and swapped it into **Save list** on both mobile (`MobileLayout` `.ct-save`)
  and desktop (`App` `.btn-save`, keeps its text label too). `IconDownload` stays for "Import from Scryfall"
  (download = fetch, correct). Also dropped a now-stale "⬇" from the mobile Export-page hint. Verified live (375px):
  Save list reads as a list, clearly separate from Export; lint + build green.
- **UX critique P2s, multi-select batch ops + canvas a11y:** from the same impeccable `critique`.
  - **Desktop multi-select** in `PagePreview`: **Ctrl/Cmd/Shift-click** a card toggles selection (plain click stays
    "change art" → novices unaffected). Selected cards get a gold outline + `accent-dim` wash. A **bulk bar** replaces
    the preview footer when ≥1 selected: **N selected · Bleed · Delete · Clear**. Keys: **Del/Backspace** = delete
    selected, **Esc** = deselect, **Ctrl/Cmd+A** = select all (window listener, ignores inputs). Selection state is
    local to `PagePreview`; `selectedIds` is pruned against current `images`. New App handlers `handleRemoveMany`/
    `handleBleedMany` (single `setImages` pass, revoke URLs on delete) threaded via `previewProps`
    (`onRemoveMany`/`onBleedMany`). **Gated to desktop** (`selectMode = !onCardTap`); mobile keeps the per-card action
    sheet. **Deferred:** drag-reorder (order is cosmetic on a cut sheet) + mobile batch.
  - **Canvas a11y:** the per-card click target is now a real full-area `.card-surface` `<button>` (was a `div`+onClick)
    → **change-art is keyboard-reachable** + announces the card name (`aria-label`, `aria-pressed` when selected).
    Added a visually-hidden `.sr-only` sheet summary (`aria-live`) + per-card low-res `.sr-only` text (the `!` marker
    was canvas-only). Card-hover outline went red→neutral (`--border-hover`) since the whole surface is now "change
    art", not "delete". Verified live (desktop): ctrl-click selects, bulk Bleed/Delete mutate, Ctrl+A/Esc/Del work,
    empty CTA returns after delete-all; lint + build + detector green (only the deliberate wordmark gradients remain).
- **UX critique fixes, empty-state CTA + "missing" copy:** from an impeccable `critique`
  (29/40, "Good"). Two P1s: (1) the placed/empty footer said **"N missing"** for empty grid slots, overloaded
  with the real "unresolved card" badge and read as data loss. `PagePreview` footer now says **"N to fill the
  page"** (matches the mobile `export-summary` copy; the `missing` var = empty slots on the current page, see
  [App.jsx](src/App.jsx) `missing`). (2) the empty preview was a bare white canvas with no guidance. Added a
  centered **`.preview-empty-cta`** overlay ("No cards yet" + drop/import hint + an **Add cards** button) over the
  sheet, shown when `images.length===0 && !isDragActive`. Wired a new `onAdd` prop into `previewProps`: desktop =
  react-dropzone `open()`, mobile = open the add sheet (`setAddOpen(true)`). Button reuses `.btn-add` (green) with
  `width:auto` since the sidebar one is full-width. Also fixed a **leftover Italian string**: the drag overlay
  `.preview-root.drag-active::after` said "Rilascia le immagini qui" → **"Drop images here"**. Verified live
  (desktop + 375px): empty CTA centered/sized, footer reads "to fill the page", build + lint green. (The 2
  `gradient-text` detector hits are the deliberate "Proxoteca" wordmark, left as brand.)
- **Save-list feedback toast:** "Save list" gave feedback only via the old `notice` box (desktop
  sidebar / Export page), invisible from the mobile Cards bar. Replaced `notice` with a global **`Toast`**
  (`{kind,msg}` state, auto-dismiss 3.5 s, tap-to-close, `aria-live`), rendered in both App trees, centered above
  the mobile action bar. `handleSaveProject` now emits success/error toasts (the only `notice` user; `error` stays
  for generate/import). Verified live (390px): error toast on upload-only save, positioned above the bar, dismisses.
  Lint + build green.
- **Mobile nav redesign, tab bar → bottom action bar:** removed the 3-item `BottomTabBar`
  (file deleted). **Cards is now the always-on view**; the bottom bar (`.cards-toolbar`, `space-between`) is
  **Settings** (left, icon+label) · **[🗑 Delete · ＋ Add (FAB) · ⬇ Save]** (centered `.ct-cluster`) · **Export**
  (right, icon+label). **Settings and Export open a full-screen `MobilePage` overlay** (slide-up, header + close X)
  instead of switching tabs, Settings = `PageSettings`, Export = count/missing + low-res warn + Generate PDF
  (Save list / Delete all live on the bar now). Built per the **ui-ux-pro-max** skill: 5 targets max, ≥44pt /
  ≥8px spacing, one primary CTA (green ＋), labeled nav items, safe-area bottom margin, border-top separation.
  Verified live (390px): tab bar gone, bar order, Settings/Export pages open + close, desktop unaffected.
  Lint + build green.
- **Mobile Cards action toolbar + Delete-all confirm:** the Cards tab's lone bottom-right ＋ FAB
  is now a **centered bottom toolbar** `.cards-toolbar` = **[🗑 Delete all · ＋ Add (FAB, center) · 🖾 Save list]`**
  (`MobileLayout`). `.mobile-cards` became a flex column so the toolbar sits below the preview + pager (no overlap;
  `.mobile-cards .preview-root` min-height override). **Delete all now asks for confirmation everywhere**. New
  themed `ConfirmDialog` (reuses `.modal`; `.modal.modal-confirm` stays small/centered even on mobile). `handleClearAll`
  opens it (one wrapper → desktop sidebar + mobile Export tab + mobile Cards toolbar all get the "Delete all cards?
  This can't be undone." guard); `ConfirmDialog` rendered in both App trees. Verified live (390px + 1280px): toolbar
  order/enabled-state, confirm Cancel keeps cards / Delete clears, desktop Delete-all also guarded. Lint + build green.
- **Mobile Upload button fix:** the mobile add-sheet "Upload files" called react-dropzone's
  `open()` after `setAddOpen(false)`. Mobile browsers block a programmatic file-input `.click()` (no trusted
  gesture after the re-render), so nothing opened. Replaced it with a **native `<label><input type=file multiple
  accept="image/*">`** (`.sheet-upload`) in `MobileLayout`, wired to `addMenu.onFiles` = `handleImagesAdded`.
  Tapping the label opens the picker via a real gesture (same pattern as the ICC upload). Desktop still uses
  react-dropzone `open()`. Verified live (390px): picker structure + file → card added, sheet closes.
- **Import resilience: CORS-proxy fallback + Scryfall retry:** the deck-link import used a single
  `corsproxy.io` which started returning 403 (now key-gated) → "Failed to fetch". Replaced with a **fallback chain**
  (`CORS_PROXIES`: allorigins → codetabs → corsproxy.io) via `fetchViaProxy` (first proxy that responds ok wins).
  The direct Scryfall import was also failing with a CORS/`Failed to fetch` error caused by `api.scryfall.com`
  returning **503 error pages without CORS headers** (a Scryfall-side outage, not an app bug): added `scryfallFetch`
  (retry 429/5xx + network with backoff, clear "Scryfall may be busy or down" message). **Not live-tested from the
  agent sandbox** (its network egress is blocked, that's why the agent's own probes 503'd); verify in a real
  browser. Lint + build + parser self-check green.
- **CMYK export, Phase 3 (bundled profiles, validation, mismatch warning, decoder self-check):**
  - **Bundled ICC profiles** (`utils/iccProfiles.js`): three ECI output profiles in `src/assets/icc/`
    (`ISOcoated_v2_eci.icc`=FOGRA39 **default**, `PSOcoated_v3.icc`=FOGRA51, `PSOuncoated_v3_FOGRA52.icc`=FOGRA52),
    imported `?url` (emitted to `dist/assets/`, fetched on demand, **not** inlined). The "Stampa" group now has an
    **ICC profile select** = bundled list + "Upload custom .icc…". **CMYK export works out-of-box (no upload).**
    Selection persisted (`ip:iccProfileId`); uploaded bytes still not persisted. Registry `info` = exact lcms
    description per file → drives the OutputIntent `Info` and the mismatch compare.
  - **OutputIntent follows the profile:** `buildCmykPdfBytes(…, condition)`, `OutputConditionIdentifier` =
    FOGRA39/51/52 (or `CUSTOM` for uploads), `Info` = the profile description (was hardcoded FOGRA39).
  - **§1e upload validation** (`cmykEngine.readProfileInfo` now returns `deviceClass` from the ICC header bytes,
    lcms-wasm has no `cmsGetDeviceClass`): rejects **DeviceLink/abstract/named-color** profiles (CMYK space but not
    a destination) with a clear message; still requires CMYK colour space.
  - **§2 native profile-mismatch warning:** `cmykRaster.extractIccFromJpeg` pulls the embedded ICC from APP2
    (`ICC_PROFILE`, multi-chunk). On add, native CMYK JPEGs get `embeddedIccName` read via lcms; if it differs from
    the selected target a **non-blocking** warning shows in the CMYK box (export unaffected, still passthrough).
  - **§3 decoder self-check** (`utils/vendor/jpegCmykDecoder.selfcheck.js`, `node`-runnable): asserts non-inverted
    DeviceCMYK on **two real CMYK JPEGs** covering **both APP14 branches**, `synthetic_cmyk.jpg` (transform 0, Pillow)
    and `photoshop_cmyk.jpg` (**transform 2 / YCCK**, real Adobe export, 500×400), incl. the **paper-white inversion
    tripwire**; prints each detected transform. (The first `photoshop_cmyk.jpg` supplied was RGB; the user replaced it
    with a correct CMYK YCCK file, both branches now covered.) Verified live: bundled default generates PDF/X-1a with
    no upload; switching profile changes the OutputIntent identifier; custom upload accepted; mismatch warning fires
    only on a real mismatch; the **real YCCK card** runs end-to-end (passthrough → 1 DeviceCMYK image, %PDF-1.4,
    OutputIntent, no RGB). Lint + build + self-check green; the 3 `.icc` + `lcms.wasm` emit to `dist/assets/`.
- **Compression slider:** Print group has a **Compression** range slider (30–100%, default 85%,
  `ip:quality`) driving the RGB export's JPEG quality, `generatePDF(…, quality)` → `compressImage` →
  `toDataURL('image/jpeg', q)`. Lower = smaller PDF (verified: 100%→550KB vs 40%→45KB on the same card).
  **Does not affect CMYK** (FlateDecode is lossless); the hint says so when Output=CMYK. Styled with native
  `accent-color` (gold). Lint + build green.
- **CMYK export, Phase 2: native CMYK JPEG files:** native CMYK JPEGs (Photoshop/
  Illustrator/`magick`) now pass through to the PDF **without an RGB round-trip**, exact ink numbers,
  already in the shop's profile, no lcms conversion. New `utils/cmykRaster.js` (`isCmykJpeg` SOFn sniff +
  raw-channel bleed `cmykCellBuffer`, no canvas) + a **vendored** jpeg-js decoder
  (`utils/vendor/jpegCmykDecoder.js`) exposing `decodeCMYK` (jpeg-js only gives RGB; `getData` case-4 yields
  DeviceCMYK, handling the **Adobe APP14 inversion**). The CMYK exporter routes per-card: CMYK JPEG →
  decode+raw-bleed passthrough; everything else → the Phase-1 RGB→canvas→lcms path. `getConv` (lcms) is now
  lazy, so an all-native-CMYK set never loads the colour WASM. jpeg-js is **vendored, not a dependency**
  (no `node_modules` import). **Verified:** minted a real Adobe-style CMYK JPEG (Pillow, known C/M/Y/K
  swatches); `decodeCMYK` returns them **exactly** (Cyan→[255,0,0,0], …, white→0), and end-to-end through
  the real exporter the **inflated DeviceCMYK image in the output PDF preserves those values byte-for-byte**
  (200×280×4, no inversion); raw-bleed modes unit-checked; mixed RGB+CMYK sheet → 2 DeviceCMYK images, still
  %PDF-1.4 / OutputIntent / no RGB / no ObjStm. Lint + build green. (YCCK transform=2 later covered in Phase 3
  by a real Adobe fixture; **Acrobat Preflight / print-shop proof** remains user-side.)
- **CMYK / PDF-X-1a print export, Phase 1:** new **Output: RGB (screen) / CMYK (print)**
  toggle in the "Print" group. CMYK produces a **press-ready PDF/X-1a:2003** (DeviceCMYK images, one
  embedded ICC as OutputIntent). The RGB/jsPDF path is **untouched** (additive). New deps `pdf-lib` +
  `lcms-wasm`, both **lazy-loaded** (separate chunks + `lcms.wasm`), so RGB-only users don't pay.
  - **Engine:** `utils/cmykEngine.js` (lcms-wasm) converts the canvas RGBA → CMYK with the shop's ICC
    (sRGB source, chosen intent + black-point compensation). `utils/pdfGeneratorCmyk.js` assembles the
    PDF/X-1a via pdf-lib low-level (see file map).
  - **UI:** Output select reveals an ICC **upload** (`.icc/.icm`, validated as CMYK, name shown), a
    **rendering intent** select (RelCol+BPC default / Perceptual), a PDF/X-1a tag, and a soft-proof
    caveat (preview is RGB; saturated colours print less vivid). ICC choice is **not persisted** (binary,
    re-pick per session, like images); `ip:colorMode`/`ip:renderIntent` are. Flows to mobile via the
    shared `PageSettings`/`settingsProps`.
  - **Verified (this environment):** lcms in-browser gives correct CMYK (white→0 ink, red→C0/M95/Y92,
    rich black); generated PDF **passes every structural PDF/X-1a check programmatically**, header
    %PDF-1.4, classic xref (no ObjStm), OutputIntent `/GTS_PDFX` + ICC `/N 4`, `GTS_PDFXVersion`,
    `Trapped /False`, DeviceCMYK images, TrimBox/BleedBox, and **zero** RGB/ICCBased-CS/transparency.
    Tested end-to-end through the real UI handler with FOGRA39. Lint + build green.
  - **NOT verified / known gaps:** no **Acrobat Preflight** or **print-shop proof** was possible here.
    That sign-off (the real acceptance gate, doc §12) is still the user's. (**Phase 2** native CMYK JPEG
    files are now done. See the entry above.)
    **No bundled profiles** (licensing): upload-only; bundling free **ECI** profiles is a follow-up.
    Soft-proof preview (§9) deferred to a warning. WASM/ICC load on the **live Pages URL** uses the same
    relative-`base` lazy-chunk mechanism as jspdf (works in dev) but wasn't tested on the deployed site.
- **Help tooltip is now click-to-open:** the header `?` how-to popover opened on
  **hover** (`:hover`/`:focus-within`) on desktop. Now it's **click-toggle** on both layouts: a shared
  `helpOpen` state drives a `.help.open` class (visibility CSS), the `?` button toggles it (`aria-expanded`,
  `cursor:pointer`), and a click-outside `mousedown` listener (mirrors the sidebar add-menu) closes it.
  Removed the `.help:hover`/`.help:focus-within` CSS triggers. **Fixed the mobile bug** ("`?` non sparisce
  mai"): `:focus-within` kept the tooltip pinned after the tap-toggle set `helpOpen` false, so it never
  hid. Gone now. Dropped the redundant mobile-media `.help.open` rule (global covers it). Verified live:
  desktop click opens / second click + click-outside close; mobile (375px) tap opens / second tap hides;
  lint + build green.
- **"Bleed in art" support for pre-bled custom cards:** for custom (non-Scryfall) cards
  exported with bleed already baked in (e.g. 2 mm). Two ways:
  - **Global**. A new **Bleed style → "Bleed in art"** option (`full`). `resolveBleedMode` returns `full`
    when `style === 'full'`, forcing **every** card edge-to-edge (overrides even `none`); a `.field-hint`
    reminds to set Bleed to the baked amount so crop marks land on the trim.
  - **Per-card**. The per-card bleed control is a 3-state cycle (`nextBleedMode`: none → stretch → full →
    none) with a `bleedLabel` on the desktop hover button and mobile action sheet (sheet stays open to cycle),
    so any card can be set to/from "Bleed in art" after upload.
  Uploads import as `none`. (Earlier this was a separate "Uploads already include bleed" checkbox +
  `ip:preBled` state, **removed**, folded into Bleed style.) Verified live: Bleed style `full` → upload
  fills the cell; per-card cycle reaches full; lint + build green.
- **Cookie consent banner:** `CookieBanner` (bottom, centered, site style) shown until
  the user picks Accept/Decline; choice persisted in `localStorage` (`ip:cookieConsent`). Settings always
  use localStorage (technical); the flag only gates *future* analytics cookies (none today, read the flag
  before loading any). Rendered in both App trees; on mobile it clears the bottom-tab bar. Verified live
  (desktop centered + mobile stacked; Accept dismisses + persists across reload). Gotcha noted: centered via
  margins, not `translateX`, since the `fade-up` animation overrides `transform`.
- **Removed the live MPCFill art-search:** by request, Proxoteca no longer contacts
  `mpcfill.com` at all. Deleted `searchMpcPrints` + the sources cache (`/2/editorSearch/`, `/2/cards/`,
  `/2/sources/`, the `[[pk,true]]` tuples) and the `corsproxy.io` usage from `utils/mpcfill.js`; deleted
  `ArtSourceModal` and its CSS (`.modal-source-tag`, the two source buttons). **Change-art is Scryfall-only
  again:** clicking a card opens `ArtPickerModal` directly (no source chooser), on desktop and mobile.
  `handleReplaceArt(file, {bleedMode,set,collector})` keeps only the Scryfall path (set/collector updated,
  card stays in "Save list"); the `mirror`/`stretch` bleedMode logic stays. **Kept untouched:** the MPCFill
  `.xml` import (`MpcImportModal` + `parseMpcXml`/`fetchMpcImages`, lh3 Drive download, `bleedMode:'full'`,
  the `_wasFull` bleed toggle) and `corsproxy.io` in `utils/scryfall.js` (deck-link import). Verified live:
  XML import → full-bleed cards; change-art opens the Scryfall picker directly; **zero `mpcfill.com` requests**
  (Network: only lh3 + scryfall); lint + build green.
- **(superseded) Change-art source picker:** an earlier pass added a Scryfall/MPCFill chooser + live
  MPC search; removed in the entry above. Kept here only as history.
- **MPCFill XML import:** the `+` menu got a third option, **Import from MPCFill**
  (desktop add-menu + mobile add-sheet). `MpcImportModal` takes a MPCFill `.xml` order file;
  `utils/mpcfill.js` parses it (`<id>` = Google Drive file, `<slots>` count = copies, `<query>`
  = card name) and downloads each image. **Key finding:** Drive images are only CORS-fetchable
  via `https://lh3.googleusercontent.com/d/<id>=w<N>`, `drive.google.com/uc?export=download`
  and `/thumbnail` return 403 even through `corsproxy.io`. The lh3 blob is readable (not tainted)
  → PDF export works with no proxy. MPC images are **already full-bleed (~3 mm, aspect 0.735)**, so
  they import with a new **`bleedMode:'full'`** (added to `resolveBleedMode` + `drawCardWithBleed`
  in `pdfGenerator.js`): the image fills the entire cell (trim+bleed), no bleed generation, and the
  global bleed-style never overrides it. The modal hints to set **Bleed = 3 mm** so crop marks land
  on the real trim. Verified live: 3-card/4-copy XML → 4 full-bleed cards drawn on the sheet; lint +
  build green.
- **Bigger change-art thumbnails on touch:** the mobile `.art-grid` track
  (base `minmax(84px,1fr)`) is now **126px on phones (+50%)** and **210px on portrait tablets
  (+150%)**. Phone value lives in the shared full-screen-modal `@media`; a dedicated
  `@media (min-width:769px) and (max-width:1024px) and (orientation:portrait)` overrides the
  track for tablets. (`1fr` still stretches each track to fill, so rendered cells are a bit
  larger than the min.) Desktop stays the fixed 168px. Verified live: 375px → 158px cells/2 cols,
  820px → 249px cells/3 cols.
- **Mobile layout on portrait tablets:** `MobileLayout` now also renders on
  **tablets held vertically**, not just phones. `useIsMobile` QUERY went from `(max-width:768px)`
  to `(max-width:768px), (max-width:1024px) and (orientation:portrait)`; the `index.css`
  full-screen-modal `@media` was changed to the **same** condition (keep the two in sync). Tablet
  *landscape* and laptops stay desktop (the portrait clause excludes them). Verified live: 820px &
  1024px portrait → bottom-tab shell + full-screen modal; 1180×820 landscape → desktop sidebar.
- **Change-art modal sizing:** the box was `.modal` `max-width:520px`,
  a small, resolution-dependent fraction on wider/hi-dpi monitors. New `.modal-art`
  modifier (in `ArtPickerModal`) sets a **fixed `width:820px` (`max-width:94vw` guard)**
  so it's the same CSS size on every desktop resolution and ~58% bigger. `.art-grid`
  desktop cells went from `minmax(110px,1fr)` to a **fixed `168px`** (gap 12, `max-height:64vh`)
  so thumbnails are larger and the grid fills the wider box. The mobile `@media(max-width:768px)`
  `.modal` reset gained `width:100%;min-width:0` so the full-screen mobile modal is unaffected.
  (`fit-content` was tried first but `auto-fill` collapses to one column under intrinsic
  sizing.) Verified live: 820px at 1481px & 1920px viewports (identical), mobile 375px full-screen
  no overflow; lint + build green.
- **Mobile UX, bottom-tab shell:** at `≤768px` (`useIsMobile`), `App` renders
  `MobileLayout` instead of the desktop sidebar/preview; all state + handlers stay in `App` and
  flow through `settingsProps`/`previewProps`/`actions`/`addMenu` bundles (shared by both layouts,
  DRY). Three bottom tabs: **Cards** (`PageCanvas` preview + ＋ FAB → add bottom-sheet; tap a card
  → `CardActionSheet` with change-art/duplicate/bleed/remove), **Settings** (reuses `PageSettings`),
  **Export** (count/missing + low-res warn + Generate/Save/Delete). `PagePreview` gained an
  `onCardTap` prop: in tap mode it hides the hover buttons and a tap calls `onCardTap`; **desktop
  (no `onCardTap`) is byte-identical**. Modals go full-screen ≤768px; the `?` help toggles on tap
  (desktop stays hover). Spec + plan in `docs/superpowers/`; verified live at 375px + desktop
  regression at 927px; lint + build + selfcheck green.
- **Save project / deck list:** sidebar "Save list" button → downloads a `.txt`
  deck list (`qty Name (SET) cn`) of the placed **Scryfall** cards. It's the *same* format the
  Scryfall import reads, so reloading a project = paste the `.txt` back into "Import from Scryfall"
  (no separate load path built). Import now attaches `{name, set, collector, primary}` to each
  image item (was dropped after import); `primary` marks the front face so DFCs aren't double-
  counted. `buildDeckList(items)` (in `utils/scryfall.js`) groups front faces → `deckLine`, and
  returns `{text, cards, custom}`. **Custom uploads can't be saved to text** (no metadata): they're
  counted and excluded with a neutral notice, not blocked. Change-art updates the item's
  set/collector (`fetchPrints` now also returns `collector`) so the save follows the chosen
  printing. Verified live (2× pinned + 1 DFC → `2 Sol Ring (C21) 263` / `1 Fable of the Mirror-
  Breaker`, DFC counted once); self-check covers grouping + round-trip.
- **Mirror-bleed seam fix:** some full-art cards (bright edges) showed a thin dark line at
  the card↔bleed join in `mirror`. Cause: the Scryfall PNG's outermost 1-3 px are a darker
  antialias **fringe**. `drawCardWithBleed` now (a) draws the card from an `inset` (`≈iw/370`,
  ~2 px) so the trim edge samples real art, not the fringe, and (b) samples every mirror/stretch
  band from the same inset so the join pixel matches, plus the earlier `ov = 1` px inward
  overlap to hide the AA hairline. Measured on the real SLD Exotic Orchard PNG: seam dip went
  ~35% → ~5% (gone); dark-edged cards (SPG Verdant Catacombs) stay flat. `black` mode only gets
  the cleaner inset trim edge.
- **UI translated to English:** all visible strings (sidebar, preview, both modals, errors,
  `index.html`); code comments stay Italian. Verified live.
- **Deck-link import pins the deck's edition:** `moxfieldList`/`archidektList`
  emitted only `qty Name`, so Scryfall returned the *default* printing, not the one chosen in
  the deck. They now emit `qty Name (SET) cn` via a shared `deckLine` helper (Moxfield card →
  `set`/`cn`; Archidekt → `edition.editioncode`/`collectorNumber`), and the existing
  `(SET) collector` pin pipeline does the rest. **Fixed a latent bug it exposed:** `parseCardList`
  lowercased the collector, but `/cards/collection` is **case-sensitive** on it, alphanumeric
  collectors (The List `TMP-294`, `PCY-45`) returned not-found. Collector now keeps original case;
  Map keys stay case-insensitive. Verified live on the test deck: 100/100 cards resolve to the
  exact edition, 0 not-found (was 2). Self-check + `deckLine` round-trip added. Tappedout left as-is
  (`?fmt=txt` already passes any `(SET)` tail through; untested).
- **DFC back-face change-art fix:** `fetchPrints` extracted `card_faces[0]`
  (front) for every printing, so changing a back face's art showed/applied the front. It now
  picks the face whose `name` matches the searched name (the back filename → back face). The
  search already matches by face name, so no import-chain change was needed. Verified live
  (Harnfel back → back-face prints).
- **DFC name fix:** deck lists give double-faced cards as `Front // Back`, but
  Scryfall `/cards/collection` only matches the **front** face name (the full `A // B` returns
  not-found). `parseCardList` now keeps the part before `//`; `imageFaces` still emits both
  faces. Fixes the "non trovate" on transform/MDFC cards (also safe for split cards, whose
  front name matches too). Verified live (Birgi, Ral → 4 faces, 0 missing).
- **Import deck list from a link:** the Scryfall modal got a URL field +
  "Carica". `fetchDeckList(url)` (in `utils/scryfall.js`) detects the site, fetches the
  decklist, and fills the textarea as `qty Name` lines → the existing parse/import pipeline
  takes over. Sites: **Moxfield / Archidekt / Tappedout**. These send no CORS headers and the
  app is static, so requests go through a **public CORS proxy** (`corsproxy.io`); only the
  proxy URL constant needs changing if it dies. **Archidekt and Moxfield verified live
  end-to-end** (real decks); Tappedout uses its documented `?fmt=txt` shape (proxy forwarding
  confirmed, not tested with a real deck). Manabox was left out. Its API is CORS-OK but the web
  URL/JSON shape couldn't be verified.
- **Animated "Mostra crocini" checkbox:** native input hidden-but-focusable +
  an SVG (`.anim-check`) that morphs a circle into a checkmark on `:checked` (adapted Uiverse
  snippet, green swapped for the gold `--accent`, light ripple/base for the dark theme).
- **Sidebar redesign (from a design critique):**
  - *Fixed export footer:* `.app` is now `height: 100dvh` (was `min-height`), so the sidebar
    splits into a scrolling `.sidebar-scroll` (the settings) + a non-scrolling `.sidebar-export`
    footer. **Genera PDF is always visible**. Before it sat below the fold. (Sticky-bottom was
    tried first but the trailing content peeked under it; a flex footer is clean.)
  - *Grouped controls:* the 6 separate carded sections collapsed into **2 group cards**
    ("Foglio & carta", "Stampa") of stacked `.field`s + a trimmed "Riepilogo" box, far less
    scroll. `SelectField` helper renders label + select.
  - *Contrast:* section `h2` lightened `--text-muted` → `--text-secondary` (was ~4.4:1 at 11px,
    failed AA; now ~5.9:1).
  - *A11y:* every `<select>` got an `aria-label` (no more reliance on the `<h2>` as the only name).
  - Info box no longer duplicates DPI; renamed "Layout" → "Riepilogo". Verified live (default fits
    without scroll; custom sheet scrolls with the footer pinned).
- **Crop-mark style + checkbox + custom sheet:**
  - *Crop-mark styles:* `cropStyle` = `'lines'` (the original edge-aligned marks, clamped by
    `cropMarkSpan`) | `'corners'` (squadrette, L-brackets offset into the gutter at each trim
    corner, opening toward the card). `drawCropMarks` (PDF) + `drawCropMarksCanvas` (preview)
    both take a `style` arg.
  - *Show-crop is now a checkbox* (`.checkbox-row`, `accent-color` gold) instead of a select;
    the style select shows only when checked.
  - *Custom sheet:* "Personalizzato" option in the format select reveals W×H inputs + an
    **mm / inch** toggle (`.unit-toggle`). `sheetW`/`sheetH` are stored in the chosen unit;
    `App` derives `customSheet` in mm and threads it through `getGridInfo(…, customSheet)` and
    `generatePDF(…, customSheet)`. Toggling units converts the shown values. Persisted. Verified live.
- **Card type + crop-mark toggle:**
  - *Tipo carta:* sidebar preset select (Standard 63×88, Piccola/JP 59×86, Mini USA 41×63,
    Tarot 70×120) + "Personalizzata" with free W×H inputs. `CARD_W`/`CARD_H` are now just
    defaults, `getGridInfo(formatKey, bleedMm, cardW, cardH)` and `generatePDF(…, cardW, cardH, …)`
    take real dims, threaded through `App` state (`cardType`/`cardW`/`cardH`, persisted) into
    `PageSettings`, `PagePreview`/`PageCanvas`, crop marks, and the low-res check.
  - *Crocini di taglio:* Mostra/Nascondi select gates crop marks in both the PDF
    (`generatePDF` `cropMarks` arg) and the canvas preview (`PageCanvas` `showCrop`).
  - Layout info box relabelled: Foglio (sheet) / Carta (card) / Cella (cell). Verified live.
- **Five usability features:**
  - *Persistence:* settings (`formatKey`/`bleedMm`/`bleedStyle`/`dpi`) + the pasted
    Scryfall list survive reload via `localStorage`. Images (blobs) are not persisted.
    Re-import is one click. Corrupt `ip:format` falls back to A3 (guards a crash in `getGridInfo`).
  - *Bleed on manual uploads:* per-card hover button toggles `bleedMode` none↔stretch.
    Before this, uploads were locked to object-fit cover and the bleed feature never touched
    them. Cards with bleed show a persistent gold frame indicator. Global "Stile abbondanza"
    can still force mirror/black on top.
  - *Duplicate card:* hover button inserts a copy right after the original (fresh object URL).
  - *Pin printing at import:* `parseCardList` now captures the `(SET) collector` tail instead of
    stripping it; `/cards/collection` uses the most precise identifier (set+collector → name+set →
    name). Resolved cards are registered under `name|set|collector` keys so mixed pinned/unpinned
    lists match back without collisions.
  - *Low-res warning:* `PageCanvas` draws a red "!" triangle on a card whose source image can't
    supply half the px the chosen DPI needs (Scryfall PNGs ≈300 DPI → clean up to 600 DPI).
  - Self-check for the parser in `scryfall.selfcheck.js`. Verified live; build + lint green.
- **Change-art picker:** click a placed card → `ArtPickerModal` lists every Scryfall printing
  (`/cards/search?unique=prints`) → pick one → swaps the image in place (keeps id/bleedMode).
  Name is read from the card's filename, so renamed/DFC files may find no prints.
- **Bleed generation for Scryfall imports:** Scryfall cards arrive at trim size (no bleed).
  Items carry a `bleedMode` (`'stretch'` | `'mirror'` for Scryfall, `'none'` for manual
  uploads). `pdfGenerator.drawCardWithBleed` draws the card 1:1 in the trim area and fills
  the bleed margin: `stretch` extends the outermost row/column (corners replicated, ideal
  for black-bordered cards), `mirror` reflects the outer band (better for full-art). The
  Scryfall import auto-picks `mirror` when the resolved card is `full_art` / `border_color:
  borderless`, else `stretch` (note: `/cards/collection` returns the default printing, so
  mirror only fires when that printing is itself full-art/borderless). Shared by the canvas
  preview and `compressImage`/PDF, follows the bleed slider (`bleed=0` → card fills the
  cell). **`bleedMode: 'none'` draws the card at trim (63×88), bleed margin left blank**.
  Toggling bleed off no longer resizes the card up to the full cell (preview + PDF; was
  fill-cell/cover before). (mpc-autofill itself is desktop MPC-order automation, not embeddable;
  this replicates the print-ready bleed in-browser.)
- **Scryfall import:** the green "+" is now a menu, "Carica file" (existing picker) or
  "Importa da Scryfall". The Scryfall option opens a modal (`ScryfallImportModal`) where you
  paste a `1x Card Name` list; `utils/scryfall.js` resolves names via `/cards/collection`
  (batched 75), downloads the PNGs as `File`s, and feeds them through the normal pipeline.
  Double-faced cards import both faces; missing names are listed. Images arrive as blob
  object URLs (same-origin) so the canvas/PDF export is not tainted. After a successful
  import the modal's "Importa" button becomes "Finito" (closes). Verified live.
- **Preview image cache:** `PageCanvas` keeps a `src → HTMLImageElement` cache so redraws
  (delete, resize, format change) no longer re-decode every image. Deleting a card is now
  0 re-decodes (was N) and the preview no longer "reloads from scratch"/flashes. Cache is
  rebuilt from the current page each draw (bounded memory; removed images dropped). Page
  navigation still decodes the newly-shown page once.
- **Crop-mark fix:** crop marks no longer overflow into adjacent cards at small bleed.
  New pure `cropMarkSpan(limit, gap, len)` in `pdfGenerator.js` clamps each mark's outward
  reach to the available space, inner edges to `bleed` (the midline between ganged cards),
  outer edges to `bleed + offset` (page margin, also prevents off-page marks); `bleed = 0`
  → no inner marks. Shared by the PDF (`drawCropMarks`) and the canvas preview
  (`drawCropMarksCanvas`).
- **Interactive preview redesign:** one large centered page (replaces the 4-up small
  grid), pagination moved to a bottom-center `‹ n/N ›` pager (step 1), green **+**
  add-photos button + full-area drag&drop. Per-card delete: hover a card → red border +
  corner × removes that image. Removed the bottom filename list; **Elimina tutte** is now
  in the sidebar Esporta section. Sidebar Layout keeps only the info box (mini-preview
  dropped). `ImageUploader` deleted (dropzone moved into `App`); added `IconPlus`.
- **Bug/perf fixes:** restored JPEG quality 0.85 in `pdfGenerator` (was 0.97, defeated
  compression); removed `setState`-in-effect in `PagePreview` (offset derived in render);
  memoized grid info + page images; cancel stale async canvas draws; revoke object URLs on
  unmount; deleted unused `VirtualThumbGrid`.
- Earlier: full design pass, contrast/empty-state/responsive/focus fixes, custom SVG icons
  + branded favicon, depth/light-table, Bricolage+Hanken type, code-split PDF libs
  (jspdf/html2canvas lazy), warm-gold rebrand + grain.

All verified live + `npm run lint` clean + `npm run build` green.

## Known issues / TODO

- **AI upscale:** weights come from jsDelivr (fallback unpkg) at first use: no CDN = no upscale.
  Self-host by copying `node_modules/@upscalerjs/esrgan-medium/models/x2/*` into `public/` and
  passing `path` to the model definition. Slow on phones / integrated GPUs (no cancel button
  yet).
- **Remaining `npm audit` items (11: 6 high, 5 moderate, as of 2026-10-13), all accepted:** only the
  tfjs/upscaler chain is left. `sprintf-js` via `argparse@1` via `@tensorflow/tfjs` (only its
  `tfjs-custom-module` CLI bin uses it; no upstream fix) and `braces` via `chokidar`/`micromatch`/
  `fast-glob` via `wireit` (a build-script runner that `upscaler` wrongly lists as a runtime dep).
  All Node CLI tooling: grep of `dist/assets/*.js` finds none of them in the browser bundle. The
  only "fix" is `npm audit fix --force`, which downgrades `upscaler` to 0.12.3 (breaking). Don't.

- **CMYK export: Phases 1+2+3 done; remaining follow-ups** (spec in user's `CMYK-PRINT-EXPORT.md` Phase 3+):
  - **§4 live-deploy smoke UNRUN**. Confirm `lcms.wasm` + the 3 `.icc` load (200/correct MIME) on
    `https://tommiconlai.github.io/Proxoteca/` after deploy and a CMYK export runs end-to-end. Emit verified in
    local `dist/assets/`; live not checked.
  - **§7 Acrobat preflight + contract proof = the acceptance gate, still user-side** (structural checks pass here).
  - **Decoder both APP14 branches now covered**, transform 0 (`synthetic_cmyk.jpg`) + transform 2 / YCCK
    (`photoshop_cmyk.jpg`, real Adobe). Self-check + live e2e green on both.
  - **§5 soft-proof** (CMYK→monitor) and **§6 CMYK-JPEG/DCTDecode** size path are **optional**, not built (preview
    keeps the RGB warning; raw-Flate DeviceCMYK stays the lossless default, heavy at high DPI). Confirm the shop's
    preferred default profile + intent (spec §14), default = FOGRA39 + RelCol+BPC.
- **Email/Password provider must be enabled** in the Firebase console (Authentication, Sign-in method)
  or the form answers "Email sign-in is not enabled for this site yet." The updated `firestore.rules`
  (email verified or Google, plus the profile doc) must be **republished by hand** (Firestore, Rules);
  until then only the client gate stops unverified accounts and saving a profile photo fails with
  "Missing or insufficient permissions".
- **Scryfall direct import can fail when Scryfall is degraded**, `api.scryfall.com` 503/Cloudflare error pages
  carry no CORS header, so the browser shows "blocked by CORS policy / Failed to fetch". `scryfallFetch` now
  retries 429/5xx + network errors with backoff and surfaces a clear "Scryfall may be busy or down" message.
  Not app-fixable beyond that. It's a Scryfall outage; retry later. (Could not be live-tested from the agent
  sandbox: its egress is blocked, so external fetch checks must be done in a real browser.)
- **A11y:** sidebar `<select>`s now carry `aria-label`s (field text is a decorative `<span>`);
  custom W/H inputs are wrapped in `<label>`. Remaining gap: no full keyboard/focus-visible audit.
- **Touch on a wide screen (desktop layout):** long-press works there too (it keys on
  `pointerType`), but the hotspots stay `draggable`, so a browser that starts HTML5 drag on
  long-press (some Android tablets) may begin a drag instead of opening the menu. Untested.
- **Low-res warning:** the per-card `!` is a DOM chip `.lowres-badge` in the hotspot (plus
  sr-only text) shown when `item.w` < `dpi*0.5*cardW/25.4` (dims decoded once on add, stored
  as `item.w`). On hover (only `@media (hover: hover)`) or when the card has keyboard focus it
  grows to the card width (`calc(100% - 8px)`, height via `grid-template-rows` 0fr→1fr) and shows
  "LOW RES" + "~N DPI here, X set. May print soft."; mouse out shrinks it back to the 17px "!".
  Click/right-click/long-press on the chip act on the card. The sidebar text was removed; the
  mobile Export page keeps its count warning (no hover on touch). Preview only, never printed. `replaceArt` doesn't re-decode `w` (Scryfall prints are all
  745×1040, so it stays valid).
- **Tests:** only `scryfall.selfcheck.js` (parseCardList). No component/integration tests.

## Conventions

- Commit + push to `main` after every change unless told to wait (user pref, 2026-06-19).
  Repo is solo, history is direct-to-`main`. Write the commit message to a temp file and use
  `git commit -F <tmpfile>`. PowerShell mangles multi-line `-m` here-strings.
- After UI edits: run the app, screenshot empty + populated, then `npm run build`.
- Treat "AI-default" looks (Inter, generic purple, emoji icons) as signals to diverge.
- **No em-dash (U+2014) anywhere** (code, UI copy, comments, docs; user rule 2026-10-13). Use a
  period or a comma, chosen per case. En-dash in number ranges (`0.5–1.0`) is fine.
