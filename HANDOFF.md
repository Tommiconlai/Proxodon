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
| `src/App.jsx` | Root: state (images, format incl. `custom`, sheetUnit/sheetW/sheetH, bleed, bleedStyle, dpi, cardType/cardW/cardH, cropMarks/cropStyle, import + art-picker modals), derives `customSheet` (mm) for custom sheets, header (logo + `?` **help tooltip**, `.help` **click-toggle** popover (`helpOpen` state + `.help.open`, click-outside closes) with the 4-step how-to, replaced the old tagline) / sidebar / main layout, `react-dropzone` (full-area drag&drop + `open()`). Settings persisted to `localStorage` (`ip:format`/`ip:bleed`/`ip:bleedStyle`/`ip:dpi`/`ip:cardType`/`ip:cardW`/`ip:cardH`/`ip:cropMarks`/`ip:cropStyle`/`ip:sheetUnit`/`ip:sheetW`/`ip:sheetH`/`ip:quality`/`ip:colorMode`/`ip:renderIntent`/`ip:iccProfileId`; the uploaded ICC bytes are **not** persisted (only the selected profile id); `ip:cardlist` lives in the import modal). Image items carry a `bleedMode` (`none`/`stretch`/`mirror`/`full`). Handlers: add / remove / clearAll / toggleBleed (**per-card 3-state cycle** none→stretch→full→none via `nextBleedMode`) / duplicate / replaceArt (updates edition) / saveProject (Scryfall cards → `.txt`). Scryfall image items carry `{name,set,collector,primary}` for the save; manual uploads don't (→ excluded). Sidebar = scrolling `.sidebar-scroll` (PageSettings) + fixed `.sidebar-export` footer (flex column): **Add cards** (`.btn-add`, green, opens the upload/Scryfall `.add-menu`) → **Generate PDF** → row [**Save list** · **Delete all**]. Save/Delete are always rendered, `disabled` when `images.length === 0` (Save list hovers green, Delete hovers red). The `addMenuOpen` state + click-outside live here (moved out of the preview footer) |
| `src/components/PageSettings.jsx` | Sidebar settings in **2 group cards**: "Foglio & carta" (format presets + custom sheet W×H with mm/inch toggle · card type presets + custom W×H · bleed) and "Stampa" (bleed-style **auto/mirror/stretch/black/`full`="Bleed in art"**, `full` forces every card edge-to-edge for pre-bled art, with a `.field-hint` · **Output RGB/CMYK** (CMYK rivela: **ICC profile select** = 3 ECI inclusi + "Upload custom .icc…" con validazione DeviceLink/CMYK · avviso mismatch profilo nativo · rendering intent · tag PDF/X-1a · avviso soft-proof) · dpi · **Compression** (slider `range` 30–100% = qualità JPEG export RGB; `accent-color` oro; nota "non si applica al CMYK lossless") · crop marks: show checkbox + style Linee/Squadrette) + "Riepilogo" info box. Above the dpi field, a **low-res warning** (`.lowres-warn`, prop `lowResCount`) appears only when ≥1 placed card is below the chosen DPI, explains the red `!` preview marker. `SelectField` helper = label + `aria-label`ed select |
| `src/components/PagePreview.jsx` | Preview: one large centered page (`PageCanvas`) + per-card overlay. Each card is a full-area `.card-surface` `<button>` (`aria-label`=card name). **Desktop click model:** click (with or without Ctrl/⌘, or Enter/Space) = **toggle** that card in the selection (select, deselect, multi in one gesture), Shift-click = range, click on empty sheet/stage = clear. **Hover/selected look = `CardFrame`** (SVG HUD frame from the user's Figma "Portfolio-TG": 3px outside the trim, 4 corner brackets 9×8.5px + 4 side segments, magenta top/bottom + cyan sides, 2px round stroke, no veil/outline; **selected segments glow** in their own colour via the SVG filter `#px-seg-glow` (blur + merge, defined once in a 0×0 `.svg-defs` svg in `PagePreview`, applied by CSS to the `.segs` group, never to single lines: a 0-height line bbox empties the filter region). Segments are drawn at the **selected** shape (node 4021:2397: centred, top/bottom 13.5→86.5%, sides 15→85%); on **hover** (node 4021:2411) CSS shortens them with `scale` from one end (`transform-box: fill-box`) into the clockwise-rotated short form, so selecting animates them growing. Rest = opacity 0. Footer: pager on top, then `.preview-status` = bulk bar and count/hint stacked in one grid cell (inactive one `visibility:hidden`) so selecting never changes footer height or moves the sheet; **actions only via the `CardMenu` context menu** (right-click, or Shift+F10 / ContextMenu key). Right-click outside the selection selects that card alone. One card → Change art · Duplicate · Bleed: <resolved label> (cycles, menu stays open) · Remove. A multi-selection → Change art (only if all share `artName`, else `aria-disabled` + "different cards"; the pick goes to every copy via App `editingIds`) · Duplicate all · Bleed on/off for all (`onBleedMany`, stays open) · Remove all (undo). `CardMenu` takes `{title, items}`. Portal to `body` (animated ancestors break `position:fixed`), clamped to the viewport, ↑/↓ nav, Esc/Tab/outside-click/resize close, focus restored to the card via `useOverlayDismiss`. Styled with `.add-menu` (shared rules) + `.card-menu-title` (card name). Desktop only; mobile keeps `CardActionSheet`. **Empty state** = bare white sheet, no overlay (the sidebar/mobile **Add cards** button is the only entry point; `.preview-empty-cta` now only hosts the "No cards fit this sheet" warning). **Desktop drag-to-reorder** (`dndOn = selectMode && onMove`): hotspots are HTML5 `draggable`; drop on another card → `onMove(id, globalIndex)` (App `handleMove`, **swap** semantics: the two cards trade places, the rest stay put; order = print order). Ghost = the card cropped from the page `<canvas>` (hotspots are transparent). `.dragging` veils the source, `.drop-target` = cyan outline. Keyboard: **Alt+arrows** on a card (swap with the neighbour / the card one row up or down, `moveTo`, follows the card across pages, refocuses via `data-card-id`). Visible page only for mouse drag. **Desktop selection** (`selectMode = !onCardTap`): click/Ctrl/Shift as above drive `selected` (local `Set`, pruned to `selectedIds`); selected = gold outline+wash; **bulk bar** in footer (Bleed/Delete/Clear → `onBleedMany`/`onRemoveMany`); keys Del/Esc/Ctrl+A (window listener, ignores inputs). A11y: `.sr-only` sheet summary + per-card low-res text. `PageCanvas` draws cards + bleed + crop marks + a **low-res warning** triangle (source < ½ the px the chosen DPI needs). Footer: pager + count, or the bulk bar when selecting |
| `src/components/MpcImportModal.jsx` | Modal: pick a **MPCFill `.xml`** order file → `parseMpcXml` lists cards → `fetchMpcImages` downloads each from Google Drive → `onImport` (= App `addItems`). File input is a hidden `<input>` inside a `.mpc-file` label. Shows count, progress, and failed-download names |
| `src/utils/mpcfill.js` | **XML import only, contacts no MPCFill server.** `parseMpcXml(text)` (DOMParser → `{cards:[{id,name,count}]}`, fronts then backs; comma-separated `<slots>` = copies; name from `<query>`) + `fetchMpcImages(cards,onProgress)` (downloads via **`lh3.googleusercontent.com/d/<id>=w2000`**, the only Drive endpoint that sends CORS headers, so the blob is readable/not tainted; `drive.google.com/uc` + `/thumbnail` 403 even through a proxy). Each card → `{file, bleedMode:'full'}`, one entry per copy (same `File` reused); no `name` so MPC art counts as custom in "Save list". (The live MPCFill art-search was removed. See "Done recently".) |
| `src/components/ScryfallImportModal.jsx` | Modal: paste a card list **or a deck link** (URL field + "Carica" → `fetchDeckList` fills the textarea) → fetch from Scryfall → add to images. Pasted text persisted to `localStorage` (`ip:cardlist`). Accepts `(SET) collector` to pin a printing |
| `src/components/ArtPickerModal.jsx` | **Scryfall-only** art box. Click a placed card → `fetchPrints` lists every Scryfall printing → pick downloads the PNG to a `File` (`downloadAsFile`) and calls `onPick(file, {bleedMode, set, collector})`, `bleedMode` = `mirror` for full-art/borderless else `stretch` (mirrors the import path). Card name from the **filename**; remounted via `key={id}` |
| `src/components/Toast.jsx` | Transient feedback toast (`aria-live`), rendered in both App trees; centered above the mobile action bar, auto-dismiss (3.5 s, set in App) + tap-to-close. Driven by App `toast` state `{kind:'success'\|'error', msg}`; used by `handleSaveProject` (replaced the old `notice` box) |
| `src/components/ConfirmDialog.jsx` | Themed confirm for destructive actions (reuses `.modal`; `.modal.modal-confirm` overrides the mobile full-screen modal so it stays small/centered). Driven by App's `confirm` state `{message,confirmLabel,onConfirm}`; rendered in both App trees. Used by `handleClearAll` ("Delete all") |
| `src/components/CookieBanner.jsx` | Cookie-consent banner (fixed bottom, centered, matches the modal surface/shadow). Self-contained: shows until the user chooses, persists `ip:cookieConsent` = `accepted`\|`declined` in localStorage. **Settings always live in localStorage (technical)**; this flag only gates any *future* analytics cookies (read the flag before loading them, none today). Rendered once in each App tree (desktop + mobile); on mobile it sits above the bottom-tab bar. Centered via `left:0;right:0;margin-inline:auto` (not `translateX`, which the `fade-up` animation would override) |
| `src/hooks/useIsMobile.js` | `matchMedia('(max-width: 768px)')` via `useSyncExternalStore` → boolean. App renders the desktop tree above 768px, `MobileLayout` at/below |
| `src/hooks/useOverlayDismiss.js` | Shared overlay a11y: `useOverlayDismiss(onClose, active=true, {focusContainer=true})` → a `ref`. Esc-to-close (document keydown), moves focus into the overlay container on open, restores to the trigger on close. `active` lets always-mounted modals (`if(!open) return null`) gate it; `focusContainer:false` keeps an internal `autoFocus` (ConfirmDialog→Cancel). Used by every modal/sheet/dialog. **No full focus-trap on Tab** (deliberate, `ponytail:` note in-file) |
| `src/components/MobileLayout.jsx` | Mobile shell (≤768px): compact header (Logo + `?` tap-tooltip) + the always-on **Cards** view (`PagePreview`; `onCardTap` → `CardActionSheet`). **No tab bar** (removed `BottomTabBar`). Bottom **action bar** `.cards-toolbar` (`space-between`): **Settings** nav (left, icon+label) · `.ct-cluster` [Delete all · ＋ Add (FAB, primary) · Save list] · **Export** nav (right). ＋ opens the add bottom-sheet; **Settings/Export open a full-screen `MobilePage` overlay** (slide-up, header + close): Settings = `PageSettings`, Export = count/missing + low-res warn + Generate PDF (Save/Delete moved to the bar). Presentational; consumes `settingsProps`/`previewProps`/`actions`/`addMenu`. Local state: addOpen, sel, helpOpen, page(`null`/`settings`/`export`). Inline `IconSliders` + `MobilePage` helpers |
| `src/components/CardActionSheet.jsx` | Mobile bottom sheet for a tapped card: Change art · Duplicate · **Bleed: <mode>** (cycles none/generated/in-art, sheet stays open) · Remove. Bleed label via `bleedLabel` (pdfGenerator) |
| `src/utils/iccProfiles.js` | **Bundled ICC registry.** `BUNDLED_PROFILES` (id/label/`?url`/`condition`/`info`) for the 3 ECI output profiles in `src/assets/icc/` (FOGRA39 default, FOGRA51, FOGRA52) + `DEFAULT_PROFILE_ID`/`UPLOAD_ID`/`getProfileMeta`/`loadBundledProfileBytes` (fetch+cache on demand). `info` = exact lcms description (drives OutputIntent Info + mismatch compare) |
| `src/utils/vendor/jpegCmykDecoder.selfcheck.js` | `node`-runnable self-check (no framework) for the CMYK decoder: decodes the synthetic CMYK fixture, asserts non-inverted DeviceCMYK + paper-white tripwire, prints APP14 transform. Run: `node src/utils/vendor/jpegCmykDecoder.selfcheck.js` |
| `src/utils/cmykEngine.js` | **CMYK colour engine** (lazy). `readProfileInfo` now also returns `deviceClass` (ICC header bytes; for DeviceLink rejection). Wrapper su `lcms-wasm`: `instantiate()` singleton col WASM via `import wasmURL from 'lcms-wasm/dist/lcms.wasm?url'` (Vite emette `dist/assets/lcms-*.wasm`, base `./` → Pages-safe). `readProfileInfo(bytes)` → `{space,name}` (valida che sia CMYK); `makeRgbToCmyk(iccBytes, intentKey)` → `{convert(rgbaBytes,nPixels), close()}` (sorgente = sRGB built-in, dest = profilo tipografia; `cmsDoTransform` accetta il buffer RGBA di `getImageData` diretto, output CMYK 8-bit 0=no ink). Intenti: `relative` (RelCol+BPC) / `perceptual` |
| `src/utils/pdfGeneratorCmyk.js` | **CMYK / PDF-X-1a:2003 exporter** (lazy), additivo, il path jsPDF RGB resta intatto. Riusa `getGridInfo`/`cropMarkSpan`/`drawCardWithBleed` da `pdfGenerator.js`. Per carta: render cella su canvas RGB (stessa pipeline RGB, sfondo nero dietro i PNG) → `getImageData` → `cmykEngine` → bytes CMYK → image XObject **raw FlateDecode `/DeviceCMYK`** (`doc.context.flateStream`+`register`, posizionato con `newXObject`+`pushOperators(concatTransformationMatrix…drawObject)`). Aggiunge **OutputIntent** `/GTS_PDFX` con ICC incorporato (`/N 4`), Info `GTS_PDFXVersion`+`Trapped /False`, `TrimBox`=`BleedBox`=`MediaBox`=foglio, crocini vettoriali in `cmyk(0,0,0,1)`. **Salva con `useObjectStreams:false`** (xref classico, niente ObjStm/XRef-stream = feature 1.5+ vietate in X-1a) e **patch del byte minor header `%PDF-1.7`→`1.4`** (pdf-lib hardcoda 1.7, nessuna API). `buildCmykPdfBytes(...)` ritorna i byte (testabile); `generatePDFCmyk(...)` li scarica. **Routing per-carta:** JPEG CMYK nativo (rilevato da `isCmykJpeg`) → `decodeCMYK`+`cmykCellBuffer`, **passthrough senza conversione** (numeri preservati esatti); tutto il resto → RGB su canvas + lcms. `getConv` è lazy (set di soli CMYK non carica il WASM lcms) |
| `src/utils/cmykRaster.js` | **Fase 2**, `isCmykJpeg(bytes)` (sniff marker SOFn → Nf===4; PNG/non-JPEG → false) + `cmykCellBuffer(dec, cardWmm, cardHmm, bleedMm, mode)`: genera l'abbondanza sui **canali grezzi CMYK senza canvas** (riflessione/replica di pixel, lossless). Modi full/none/black/stretch/mirror; lo scaling alla cella fisica lo fa la matrice PDF (RIP ricampiona), quindi i pixel del trim restano 1:1 |
| `src/utils/vendor/jpegCmykDecoder.js` | **Vendored** da jpeg-js (Apache-2.0, (c) 2011 notmasteryet); `eslint-disable`. jpeg-js espone solo `decode()`→RGB; qui si aggiunge `decodeCMYK(bytes)` che chiama `JpegImage.parse`+`getData` (case 4) → CMYK 8-bit interleaved in **convenzione DeviceCMYK (0=no ink)**, gestendo l'inversione Adobe (APP14) e l'eventuale YCCK. Browser-safe (solo `Uint8Array`, niente `Buffer`) |
| `src/utils/pdfGenerator.js` | Grid math (`getGridInfo(formatKey, bleedMm, cardW=63, cardH=88, customSheet=null)`; `formatKey==='custom'` uses `customSheet` mm dims, else `PAPER_FORMATS`) + `generatePDF(items, formatKey, bleedMm, dpi, bleedStyle, cardW, cardH, cropMarks, cropStyle, customSheet)` (jspdf, dynamically imported) + `drawCardWithBleed` (stretch/mirror/black bleed) + `resolveBleedMode` (per-card mode × global style) + `drawCropMarks(…, style)` (`lines`/`corners`) + `cropMarkSpan` (clamped crop marks) |
| `src/utils/scryfall.js` | `parseCardList` (text → `{qty,name,set,collector}`; collector keeps **original case**. Scryfall `/cards/collection` is case-sensitive on it, e.g. The List `TMP-294`) + `fetchScryfallImages` (`/cards/collection` batched, printing-pinned via name\|set\|collector keys, downloads PNGs as `File`; DFC → both faces) + `fetchPrints` + `downloadAsFile` + `fetchDeckList` (deck link → text, via `fetchViaProxy` = `CORS_PROXIES` fallback chain: allorigins → codetabs → corsproxy.io) + `scryfallFetch` (retry 429/5xx + network, clear error on Scryfall outage) + `deckLine(qty,name,set,cn)` (builds `qty Name (SET) cn` so deck links pin the **edition chosen in the deck**) + `buildDeckList(items)` (placed cards → deck-list text for "Save list"; front faces only, custom uploads excluded) |
| `src/utils/scryfall.selfcheck.js` | `node`-runnable assert check for `parseCardList` (no framework). Run: `node src/utils/scryfall.selfcheck.js` |
| `src/components/icons.jsx` | Custom lucide-style SVG icon set (currentColor), incl. `IconPlus`, `IconDownload`, `IconList` (Save list, distinct from the download/export arrows), `IconCopy`, `IconFrame` + `Logo` (Proxoteca brandmark: four rotated chevrons, `LOGO_ARMS` in logo-source px, viewBox ±208, clockwise from the top arm coloured **magenta `#ff2d95` / cyan `#00e5ff` alternating**; same geometry + colours as `public/favicon.svg`) |
| `src/index.css` | All styling + design tokens |
| `public/` (favicons) | Proxoteca icon set: `favicon.svg/.ico`, `favicon-16/32/48/192/512.png`, `apple-touch-icon.png`, `site.webmanifest`. Linked in `index.html` with root-absolute paths → Vite rewrites to `./` via `base:'./'` (Pages-safe); manifest icon `src`s are relative. All icons = **magenta/cyan chevron mark on black** (same colour order as `Logo`): `favicon.svg` + 16/32/48/192/512 PNG + `.ico` (16/32/48) use a rounded square (`rx` 112 of 532, mark ~78% wide); `apple-touch-icon.png` is a full square with more padding (iOS rounds it). Rasters made with **Pillow** (8x supersample, lines + round caps/joins drawn from the same coordinates as `LOGO_PATH`, stroke 39). Manifest colours `#08070f`. |

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
  number inputs, summary values, cmyk-tag, help `?`).
- **Signature elements:** `[ SECTION ]` sidebar headers (h2 `::before`/`::after` mono
  brackets, cyan/magenta with glow); wordmark = solid `#f5f3ff` + **chromatic-aberration
  text-shadow** (cyan left / magenta right), deliberately NOT gradient-text, the slop
  detector is now fully clean; `Logo` = four-chevron mark (icons.jsx), arms alternating magenta/cyan clockwise;
  **Generate CTA** = animated gradient border via two-layer background
  (`padding-box`/`border-box` + `px-sweep`), dark core, acid text, no wrapper element,
  disabled = flat dark; cyan **pulsing CMYK chip** (`px-pulse`); compression slider =
  magenta glow thumb + track fill via `--fill` set inline in PageSettings; cyan
  `anim-check`; Summary = mono cyan values; ghost Save/Delete (cyan / red hovers);
  **perspective-grid floor** + radial glow behind the sheet (`.preview-stage::before/::after`);
  magenta→cyan **scrollbar**; magenta `::selection`; **scanlines** overlay (`body::before`,
  replaced film grain).
- **Empty state:** no overlay, bare white sheet; the framed `.empty-cta-box` CTA was removed
  2026-10-13 at the user's request (Add cards button bottom-left is enough).
- **Invariant:** the print sheet preview stays **pure white, never tinted** (print accuracy).

## Done recently

- **Add-cards menu above sticky headers (most recent):** the "Upload / Scryfall / MPCFill"
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
- **Deck-link import depends on public CORS proxies** for Moxfield / Archidekt / Tappedout.
  `utils/scryfall.js` now tries a **fallback chain** `CORS_PROXIES` (allorigins → codetabs → corsproxy.io)
  via `fetchViaProxy`; if all die, add/reorder entries or add a tiny backend. (`corsproxy.io` alone went to
  403/key-required, that's why it's now a chain.) The Tappedout parser uses a documented `?fmt=txt` shape but
  wasn't tested with a real deck. Fix the field path if an import comes back empty.
- **Scryfall direct import can fail when Scryfall is degraded**, `api.scryfall.com` 503/Cloudflare error pages
  carry no CORS header, so the browser shows "blocked by CORS policy / Failed to fetch". `scryfallFetch` now
  retries 429/5xx + network errors with backoff and surfaces a clear "Scryfall may be busy or down" message.
  Not app-fixable beyond that. It's a Scryfall outage; retry later. (Could not be live-tested from the agent
  sandbox: its egress is blocked, so external fetch checks must be done in a real browser.)
- **A11y:** sidebar `<select>`s now carry `aria-label`s (field text is a decorative `<span>`);
  custom W/H inputs are wrapped in `<label>`. Remaining gap: no full keyboard/focus-visible audit.
- **Touch (desktop layout):** the per-card hover buttons reveal on hover, so they're not
  reachable on touch in the *desktop* layout. Resolved on the mobile layout (≤768px). There
  `PagePreview` runs in tap mode (`onCardTap`) and a tap opens `CardActionSheet`. A touch device
  on a wide screen still gets the desktop hover buttons.
- **Low-res warning:** the per-card `!` is canvas-drawn (visual-only, no SR text), but the
  sidebar now has a DOM `.lowres-warn` above the dpi field explaining it (counts cards whose
  decoded `naturalWidth` < `dpi*0.5*cardW/25.4`, same threshold as the marker; dims are decoded
  once on add and stored as `item.w`). `replaceArt` doesn't re-decode `w` (Scryfall prints are all
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
