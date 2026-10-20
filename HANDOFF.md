# HANDOFF, Proxodon

The app was called Proxoteca until 2026-10-16; the Firebase project id stays `proxoteca` (ids cannot be renamed).

Context for the next Claude Code session.

Android app: the brief for the session that builds it is `docs/android-app.md` (approach, WebView gaps, milestones, rules).

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
  **AI upscale 2×** (lazy chunk ~1.1 MB, model weights ~2.7 MB served by the site from `public/models/esrgan-medium-x2/`)
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
`vite.config.js` sets `base: './'` so assets resolve under the `/Proxoteca/` subpath, and in the build only adds a
`<meta http-equiv="Content-Security-Policy">` right after the charset (hosts listed there: a new fetch, image or
script host must be added, or it is blocked).
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

### Android app (Capacitor 8)

Same build wrapped by Capacitor: `capacitor.config.json` (id `com.tommiconlai.proxodon`, name Proxodon,
`webDir: dist`) and the native project in `android/` (committed; `build/`, `assets/public`, the copied config
and `local.properties` are gitignored by `android/.gitignore`). Min SDK 24 (Android 7), target / compile 36,
AGP 8.13, Gradle 8.14.3. Debug APK for the user's phone, no Play Store yet.

```bash
npm run build && npx cap sync android        # web build into android/app/src/main/assets/public
cd android && ./gradlew assembleDebug        # → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- Toolchain on this PC: SDK in `%LOCALAPPDATA%\Android\Sdk` (export `ANDROID_HOME` to it for Gradle, there is
  no `local.properties`), `adb` in its `platform-tools` (not on PATH), JDK 23 on PATH (Gradle 8.14 does not run
  on JDK 25, the JBR of Android Studio). Emulator: AVD `Pixel_10_Pro` (API 37, Play services);
  `Pixel_9_2` has no `.ini` and does not start.
- Test: `adb exec-out screencap -p > shot.png`; taps with `adb shell input tap x y` (device pixels). WebView
  DevTools: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` (pid from
  `adb shell cat /proc/net/unix`), then `http://localhost:9222/json` / CDP `Runtime.evaluate`.
- Icon and splash: sources in `assets/` (rendered from the `public/favicon.svg` glyph: adaptive foreground on
  black, splash on `#08070f`), generated into `android/app/src/main/res` with
  `npx @capacitor/assets generate --android --iconBackgroundColor '#000000' --splashBackgroundColor '#08070f'`
  (plus the `Dark` variants of both flags).
- Edge-to-edge: `MainActivity` calls `EdgeToEdge.enable` **after** `super.onCreate` (before it, the decor view
  is built with the launch theme and shows a title bar), SystemBars `insetsHandling: native`, `style: DARK`
  (light icons), `viewport-fit=cover` in `index.html`. The web then gets real `env(safe-area-inset-*)`
  (52 px top, 24 px bottom on the emulator): the deck pages' `.decks-root` (top), the X menu
  `.mnav` (bottom), `.mobile-page-header` and the phone full-screen `.modal` add the insets (the modal both). On the web these are 0.
- App-only behaviour is gated with `Capacitor.isNativePlatform()`: back button listener (`main.jsx`), Google
  sign-in (`decks/firebase.js`), saves through the share sheet (`utils/download.js`), picked images copied
  into memory (`App.jsx` `handleImagesAdded`), ICC input without `accept` (`PageSettings.jsx`). Plugins:
  `@capacitor/app`, `filesystem`, `share`, `@capgo/capacitor-social-login`. External `target="_blank"` links
  open the system browser by themselves.
- `npm run lint` (`eslint .`) also scans `android/app/src/main/assets/public`: `eslint.config.js` needs
  `globalIgnores(['dist', '.claude', 'android'])` (a hook blocks Claude from editing it); meanwhile
  `npx eslint src`.

## File map

| File | Role |
|------|------|
| `src/App.jsx` | Root: state (images, format incl. `custom`, sheetUnit/sheetW/sheetH, bleed, bleedStyle, dpi, cardType/cardW/cardH, cropMarks/cropStyle, import + art-picker modals), derives `customSheet` (mm) for custom sheets, header (logo + `?` **help tooltip**, `.help` **click-toggle** popover (`helpOpen` state + `.help.open`, click-outside closes) with the 4-step how-to, replaced the old tagline) / sidebar / main layout, `react-dropzone` (full-area drag&drop + `open()`). Settings persisted to `localStorage` (`ip:format`/`ip:bleed`/`ip:bleedStyle`/`ip:dpi`/`ip:cardType`/`ip:cardW`/`ip:cardH`/`ip:cropMarks`/`ip:cropStyle`/`ip:sheetUnit`/`ip:sheetW`/`ip:sheetH`/`ip:quality`/`ip:colorMode`/`ip:renderIntent`/`ip:iccProfileId`; the uploaded ICC bytes are **not** persisted (only the selected profile id); `ip:cardlist` lives in the import modal). Image items carry a `bleedMode` (`none`/`stretch`/`mirror`/`full`). Handlers: add / remove / toggleBleed (**per-card 3-state cycle** none→stretch→full→none via `nextBleedMode`) / duplicate / replaceArt (updates edition). Scryfall image items carry `{name,set,collector,primary}`. Sidebar = scrolling `.sidebar-scroll` (PageSettings) + fixed `.sidebar-export` footer (flex column): **Add cards** (`.btn-add`, green, opens the upload/Scryfall `.add-menu`) → **Generate PDF** (Save list and Delete all removed 2026-10-19: decks keep the lists, cards are removed from the selection or the card menu). The `addMenuOpen` state + click-outside live here (moved out of the preview footer). **Deck manager:** hash routes via `useHashRoute()` (`#/print` default, `#/decks`, `#/decks/:id`, `#/profile`, which also counts as the Decks area), `NavTabs` (Decks | Print) after the wordmark (help `?` only on Print), `DecksView` lazy-loaded (`React.lazy` + `Suspense`, own chunk) and rendered instead of `.app-body` on deck routes; `notify(msg, kind)` (stable `useCallback`, toasts from the deck area); `handlePrintDeck(entries)` downloads images with `fetchScryfallImages` (progress toast), then **replaces** the print queue (old previews revoked) and navigates to `#/print`; the old queue stays if the download fails or no image comes back |
| `src/components/PageSettings.jsx` | Sidebar settings in **2 group cards**, **no explanatory text** (user request 2026-10-13: labels + controls only; the only conditional texts left are the uploaded ICC filename and the native-CMYK profile-mismatch warning, which has no other surface): "Foglio & carta" (format presets + custom sheet W×H with mm/inch toggle · card type presets + custom W×H · bleed) and "Stampa" (bleed-style **auto/mirror/stretch/black/`full`="Bleed in art"**, `full` forces every card edge-to-edge for pre-bled art, with a `.field-hint` · **Output RGB/CMYK** (CMYK rivela: **ICC profile select** = 3 ECI inclusi + "Upload custom .icc…" con validazione DeviceLink/CMYK · avviso mismatch profilo nativo · rendering intent · tag PDF/X-1a · avviso soft-proof) · dpi · **Compression** (slider `range` 30–100% = qualità JPEG export RGB; `accent-color` oro; nota "non si applica al CMYK lossless") · crop marks: show checkbox + style Linee/Squadrette) + "Riepilogo" info box. No low-res text in the sidebar any more: the explanation lives in the expandable `!` chip on each card (see `PagePreview`). `SelectField` helper = label + `aria-label`ed select |
| `src/components/PagePreview.jsx` | Preview: one large centered page (`PageCanvas`) + per-card overlay. Each card is a full-area `.card-surface` `<button>` (`aria-label`=card name). **Desktop click model:** click (with or without Ctrl/⌘, or Enter/Space) = **toggle** that card in the selection (select, deselect, multi in one gesture), Shift-click = range, click on empty sheet/stage = clear. **Marquee (area) selection** (desktop mouse only, `marqueeHandlers` on `.preview-stage`): press on empty space (stage background, sheet margins, gaps, empty cells; not on cards, where drag = swap, nor on the pager) and drag past 4px → `.marquee` rectangle (cyan dashed + faint cyan fill + glow, absolute in the stage, clamped to it, pointer capture); cards whose hotspot rect **intersects** it are **added** to the selection live (never deselects the rest, like the click; user request). The click that ends a marquee is swallowed (`swallowClickRef`, reset on the next pointerdown) so it does not clear. **Hover/selected look = `CardFrame`** (SVG HUD frame from the user's Figma "Portfolio-TG": 3px outside the trim, 4 corner brackets shaped like the logo chevrons (one arm 10px, the other 5px, the long arm pointing clockwise: TL→right, TR→down, BR→left, BL→up) + 4 side segments, magenta top/bottom + cyan sides, 2px round stroke, no veil/outline; **selected segments glow** in their own colour via the SVG filter `#px-seg-glow` (blur + merge, defined once in a 0×0 `.svg-defs` svg in `PagePreview`, applied by CSS to the `.segs` group, never to single lines: a 0-height line bbox empties the filter region). Segments are drawn at the **selected** shape (node 4021:2397: centred, top/bottom 13.5→86.5%, sides 15→85%); on **hover** (node 4021:2411) CSS shortens them with `scale` from one end (`transform-box: fill-box`) into the clockwise-rotated short form, so selecting animates them growing. Rest = opacity 0. **Pager:** desktop = absolutely positioned `.nav-side` groups beside the sheet, vertically centred (`« ‹N` left, `N› »` right: the number inside the prev/next button is the **target page**, so on page 2 it reads 1 on the left and 3 on the right, empty at the ends; `IconChevron` = the logo chevron, long arm twice the short one like the selected-card corners, the right-hand ones are the left ones **rotated 180°** (not mirrored) = the logo's left arm); `SIDE_NAV`=96px each side is always reserved in the page-size calc so the sheet never jumps when page 2 appears; clicks on `.preview-nav` don't clear the selection. Touch keeps a bottom pager (`.nav-foot`) with the same chevrons and target-page numbers (`‹ 1   3 ›`). Footer: (touch pager), then `.preview-status` = bulk bar and count stacked in one grid cell (inactive one `visibility:hidden`) so selecting never changes footer height or moves the sheet; **actions only via the `CardMenu` context menu** (right-click, or Shift+F10 / ContextMenu key). Right-click outside the selection selects that card alone. One card → Change art · Duplicate · Bleed: <resolved label> (cycles, menu stays open) · Remove. A multi-selection → Change art (only if all share `artName`, else `aria-disabled` + "different cards"; the pick goes to every copy via App `editingIds`) · Duplicate all · Bleed on/off for all (`onBleedMany`, stays open) · Remove all (undo). `CardMenu` takes `{title, items}`. Portal to `body` (animated ancestors break `position:fixed`), clamped to the viewport, ↑/↓ nav, Esc/Tab/outside-click/resize close, focus restored to the card via `useOverlayDismiss`. Styled with `.add-menu` (shared rules) + `.card-menu-title` (card name). Same on mobile (`touch` prop): **tap = click, long-press (500ms, cancelled if the finger moves >10px or lifts) = right-click** → `showMenu` at the finger, the click after release is swallowed (`suppressClickRef`, reset on the next `pointerdown`), `navigator.vibrate(10)`; menu items ~44px ≤768px; no `draggable`; hover frame only under `@media (hover: hover)` (sticky :hover on touch); `.card-surface` disables touch-callout/user-select. (`CardActionSheet` was deleted.) `CardMenu` now lives in `src/components/CardMenu.jsx`. **Empty state** = bare white sheet, no overlay (the sidebar/mobile **Add cards** button is the only entry point; `.preview-empty-cta` now only hosts the "No cards fit this sheet" warning). **Desktop drag-to-reorder** (`dndOn = selectMode && onMove`): hotspots are HTML5 `draggable`; drop on another card → `onMove(id, globalIndex)` (App `handleMove`, **swap** semantics: the two cards trade places, the rest stay put; order = print order). Ghost = the card cropped from the page `<canvas>` (hotspots are transparent). `.dragging` veils the source, `.drop-target` = cyan outline. Keyboard: **Alt+arrows** on a card (swap with the neighbour / the card one row up or down, `moveTo`, follows the card across pages, refocuses via `data-card-id`). Visible page only for mouse drag. **Desktop selection** (`selectMode = !onCardTap`): click/Ctrl/Shift as above drive `selected` (local `Set`, pruned to `selectedIds`); selected = gold outline+wash; **bulk bar** in footer (Bleed/Delete/Clear → `onBleedMany`/`onRemoveMany`); keys Del/Esc/Ctrl+A (window listener, ignores inputs). A11y: `.sr-only` sheet summary + per-card low-res text. `PageCanvas` draws cards + bleed + crop marks + a **low-res warning** triangle (source < ½ the px the chosen DPI needs). Footer: count + cards missing to fill the page, or the bulk bar when selecting. The old click/right-click/drag hint now lives in the header `?` help as `.help-controls` |
| `src/components/MpcImportModal.jsx` | Modal: pick a **MPCFill `.xml`** order file → `parseMpcXml` lists cards → `fetchMpcImages` downloads each from Google Drive → `onImport` (= App `addItems`). File input is a hidden `<input>` inside a `.mpc-file` label. Shows count, progress, and failed-download names |
| `src/utils/mpcfill.js` | **XML import only, contacts no MPCFill server.** `parseMpcXml(text)` (DOMParser → `{cards:[{id,name,count}]}`, fronts then backs; comma-separated `<slots>` = copies; name from `<query>`) + `fetchMpcImages(cards,onProgress)` (downloads via **`lh3.googleusercontent.com/d/<id>=w2000`**, the only Drive endpoint that sends CORS headers, so the blob is readable/not tainted; `drive.google.com/uc` + `/thumbnail` 403 even through a proxy). Each card → `{file, bleedMode:'full'}`, one entry per copy (same `File` reused; at most 99 copies per card and 1000 cards per file, ids only `[\w-]{10,100}`); no `name` so MPC art counts as custom in "Save list". (The live MPCFill art-search was removed. See "Done recently".) |
| `src/components/ScryfallImportModal.jsx` | Modal: paste a card list (no deck links: removed by the user) → fetch from Scryfall → add to images. Pasted text persisted to `localStorage` (`ip:cardlist`). Accepts `(SET) collector` to pin a printing |
| `src/components/ArtPickerModal.jsx` | **Scryfall-only** art box. "Change art" in the card menu → `fetchPrints` lists every Scryfall printing (each with `set`, `setName`, `collector`, `artist`, `year`) → a **search box** (`type=search`, `.import-link-input` look, placeholder "Search set, code, artist or year, e.g. Secret Lair, M21, 2021") filters them locally: every word must appear in set name/code/number/artist/year/"full art"/"borderless"; "N of M" counter, empty-result hint, tile tooltip shows set #, year, artist → pick downloads the PNG to a `File` (`downloadAsFile`) and calls `onPick(file, {bleedMode, set, collector})`, `bleedMode` = `mirror` for full-art/borderless else `stretch` (mirrors the import path). Card name from the **filename**; remounted via `key={id}`. Deck editor reuse: optional `name`, `title`, `current` ({ set, cn }, `.art-cell.current` cyan) and `onPickPrint(print)` (gets the chosen print instead of a downloaded file; the caller closes the box) |
| `src/components/Toast.jsx` | Transient feedback toast (`aria-live`), rendered in both App trees; centered above the mobile action bar, auto-dismiss (3.5 s, set in App) + tap-to-close. Driven by App `toast` state `{kind:'success'\|'error', msg}`; used by `handleSaveProject` (replaced the old `notice` box) |
| `src/components/ConfirmDialog.jsx` | Themed confirm for destructive actions (reuses `.modal`; `.modal.modal-confirm` overrides the mobile full-screen modal so it stays small/centered). Each caller keeps its own open state (account, decks, dilemmas, help requests, profile); App has none since Delete all went (2026-10-19) |
| `src/components/CookieBanner.jsx` | Cookie-consent banner (fixed bottom, centered, matches the modal surface/shadow). Self-contained: shows until the user chooses, persists `ip:cookieConsent` = `accepted`\|`declined` in localStorage. **Settings always live in localStorage (technical)**; this flag only gates any *future* analytics cookies (read the flag before loading them, none today). Rendered once in each App tree (desktop + mobile); on mobile it sits above the bottom-tab bar. Centered via `left:0;right:0;margin-inline:auto` (not `translateX`, which the `fade-up` animation would override) |
| `src/hooks/useIsMobile.js` | `matchMedia('(max-width: 768px)')` via `useSyncExternalStore` → boolean. App renders the desktop tree above 768px, `MobileLayout` at/below |
| `src/hooks/useOverlayDismiss.js` | Shared overlay a11y: `useOverlayDismiss(onClose, active=true, {focusContainer=true})` → a `ref`. Esc-to-close (document keydown), moves focus into the overlay container on open, restores to the trigger on close. `active` lets always-mounted modals (`if(!open) return null`) gate it; `focusContainer:false` keeps an internal `autoFocus` (ConfirmDialog→Cancel). Does not steal focus from an element already focused inside; an element marked `data-autofocus` always gets it (survives the StrictMode remount); the opener is captured at first render (`useState` initializer) so focus returns to the trigger even after an inner autoFocus (phone "Add cards" sheet → search box, close → + button). Used by every modal/sheet/dialog. **No full focus-trap on Tab** (deliberate, `ponytail:` note in-file) |
| `src/components/MobileNav.jsx` | The X menu of phones and portrait tablets (Figma 57:116). `NavMenu({ items, current, onItem, open, onToggle, children })`: fixed at the bottom over a dark fading gradient (225 px, black, 70%, multiply); the logo X (`Wordmark mark`) in a 42 px round button at 32 px from the bottom, centred, `aria-expanded`; open = the V's flip (`.mnav.open .x-v`, the logo hover) and the items come out of the X onto a wide, flat arc above it (since 2026-10-19, user: "ingrandisci i tasti e prova a scrivere cosa sono": 48 px circles and icon 22 px on tablets, 40 / 20 on phones under 600 px (user: "una via di mezzo"), the page name under each on a dark backdrop `.mnav-label`, Chakra Petch `clamp(0.52rem, 2.6vw, 0.6rem)`; `arc(n)` gives `--k` = place from the centre and `--y` = 72 px at the ends to 102 in the middle, the x is `--k` times `--step` = `min(70px, (100vw - 24px) / 5)`, so names never touch down to 320 px; 25 ms stagger, spring-like ease), `?` at the bottom left and the profile at the bottom right (`children` in `.mnav-extras`, `.header-slot` is `display: contents`). All round buttons share the `?` style (cyan 40% border, 5% cyan veil) on a solid #05030c; current item lit. Closed = items and corners `inert` and hidden. `MobileNav({ route, children })` (default, in `MobileLayout`): the same five page links everywhere (`navItems`); links go through `navigate()` (the page takes the menu's history entry; the link default plus the menu's `history.back()` undid the change on phones; the page already open just closes the menu); closes on item, X, Esc (only when no card menu, `?` panel or dialog is open), system back (`useBackClose`) or a tap outside (not in `.card-menu`, the avatar menu portal). `NavMenu` is also used by the tours (demo copies) |
| `src/components/navItems.js` | Items of the X menu, the same on every page (2026-10-19, user: changing items confused): Community, Dilemmas, Help, My decks, Print, `[key, label, href, Icon]` with the Iconify icons of icons.jsx (`IconNav*`). `navItems(route)` lights the area of the route (a deck = My decks, a Community deck = Community, profile and settings none) |
| `src/components/MobileLayout.jsx` | Mobile shell (phones and portrait tablets, `useIsMobile`), since 2026-10-19 **without a header**: at the bottom the X menu (`MobileNav`, see its row) with the pages, the `?` and the profile. Print body: `.print-top` (safe area on top) with the title `[ PRINT ]` (`.decks-title`) and `.print-actions` = **Add cards** / **Settings** / **Export**, icon-only, styled as the deck search bar's buttons (`.decks-filter-btn`, equal widths), then the always-on **Cards** view (`<PagePreview touch />`: tap = toggle, long-press = `CardMenu`). Add cards opens the add bottom-sheet (`.sheet-overlay`, z-index 75 so it covers the X, opacity-only fade so `.mobile-body` does not scroll); **Settings/Export open a full-screen `MobilePage` overlay** (Settings = `PageSettings`, Export = count/missing + low-res warn + Generate PDF). The print `?` (tap tooltip, texts point at the top bar) and `account` go into the menu. Props: `settingsProps`/`previewProps`/`actions`/`addMenu`, `route` (for the menu), `altBody` (deck area: replaces the print body) and `headerSlot` (ref setter of the portal target inside the menu, where `DecksView` puts `DeckHelp` and `AccountMenu`; on desktop `.header-slot` is the right end of the header). Exports `MobilePage` (also the deck editor's Advanced search page) |
| `src/utils/iccProfiles.js` | **Bundled ICC registry.** `BUNDLED_PROFILES` (id/label/`?url`/`condition`/`info`) for the 3 ECI output profiles in `src/assets/icc/` (FOGRA39 default, FOGRA51, FOGRA52) + `DEFAULT_PROFILE_ID`/`UPLOAD_ID`/`getProfileMeta`/`loadBundledProfileBytes` (fetch+cache on demand). `info` = exact lcms description (drives OutputIntent Info + mismatch compare) |
| `src/utils/vendor/jpegCmykDecoder.selfcheck.js` | `node`-runnable self-check (no framework) for the CMYK decoder: decodes the synthetic CMYK fixture, asserts non-inverted DeviceCMYK + paper-white tripwire, prints APP14 transform. Run: `node src/utils/vendor/jpegCmykDecoder.selfcheck.js` |
| `src/utils/cmykEngine.js` | **CMYK colour engine** (lazy). `readProfileInfo` now also returns `deviceClass` (ICC header bytes; for DeviceLink rejection). Wrapper su `lcms-wasm`: `instantiate()` singleton col WASM via `import wasmURL from 'lcms-wasm/dist/lcms.wasm?url'` (Vite emette `dist/assets/lcms-*.wasm`, base `./` → Pages-safe). `readProfileInfo(bytes)` → `{space,name}` (valida che sia CMYK); `makeRgbToCmyk(iccBytes, intentKey)` → `{convert(rgbaBytes,nPixels), close()}` (sorgente = sRGB built-in, dest = profilo tipografia; `cmsDoTransform` accetta il buffer RGBA di `getImageData` diretto, output CMYK 8-bit 0=no ink). Intenti: `relative` (RelCol+BPC) / `perceptual` |
| `src/utils/pdfGeneratorCmyk.js` | **CMYK / PDF-X-1a:2003 exporter** (lazy), additivo, il path jsPDF RGB resta intatto. Riusa `getGridInfo`/`cropMarkSpan`/`drawCardWithBleed` da `pdfGenerator.js`. Per carta: render cella su canvas RGB (stessa pipeline RGB, sfondo nero dietro i PNG) → `getImageData` → `cmykEngine` → bytes CMYK → image XObject **raw FlateDecode `/DeviceCMYK`** (`doc.context.flateStream`+`register`, posizionato con `newXObject`+`pushOperators(concatTransformationMatrix…drawObject)`). Aggiunge **OutputIntent** `/GTS_PDFX` con ICC incorporato (`/N 4`), Info `GTS_PDFXVersion`+`Trapped /False`, `TrimBox`=`BleedBox`=`MediaBox`=foglio, crocini vettoriali in `cmyk(0,0,0,1)`. **Salva con `useObjectStreams:false`** (xref classico, niente ObjStm/XRef-stream = feature 1.5+ vietate in X-1a) e **patch del byte minor header `%PDF-1.7`→`1.4`** (pdf-lib hardcoda 1.7, nessuna API). `buildCmykPdfBytes(...)` ritorna i byte (testabile); `generatePDFCmyk(...)` li scarica. **Routing per-carta:** JPEG CMYK nativo (rilevato da `isCmykJpeg`) → `decodeCMYK`+`cmykCellBuffer`, **passthrough senza conversione** (numeri preservati esatti); tutto il resto → RGB su canvas + lcms. `getConv` è lazy (set di soli CMYK non carica il WASM lcms) |
| `src/utils/cmykRaster.js` | **Fase 2**, `isCmykJpeg(bytes)` (sniff marker SOFn → Nf===4; PNG/non-JPEG → false) + `cmykCellBuffer(dec, cardWmm, cardHmm, bleedMm, mode)`: genera l'abbondanza sui **canali grezzi CMYK senza canvas** (riflessione/replica di pixel, lossless). Modi full/none/black/stretch/mirror; lo scaling alla cella fisica lo fa la matrice PDF (RIP ricampiona), quindi i pixel del trim restano 1:1 |
| `src/utils/vendor/jpegCmykDecoder.js` | **Vendored** da jpeg-js (Apache-2.0, (c) 2011 notmasteryet); `eslint-disable`. jpeg-js espone solo `decode()`→RGB; qui si aggiunge `decodeCMYK(bytes)` che chiama `JpegImage.parse`+`getData` (case 4) → CMYK 8-bit interleaved in **convenzione DeviceCMYK (0=no ink)**, gestendo l'inversione Adobe (APP14) e l'eventuale YCCK. Browser-safe (solo `Uint8Array`, niente `Buffer`) |
| `src/utils/pdfGenerator.js` | Grid math (`getGridInfo(formatKey, bleedMm, cardW=63, cardH=88, customSheet=null)`; `formatKey==='custom'` uses `customSheet` mm dims, else `PAPER_FORMATS`) + `generatePDF(items, formatKey, bleedMm, dpi, bleedStyle, cardW, cardH, cropMarks, cropStyle, customSheet)` (jspdf, dynamically imported) + `drawCardWithBleed` (stretch/mirror/black bleed) + `resolveBleedMode` (per-card mode × global style) + `drawCropMarks(…, style)` (`lines`/`corners`) + `cropMarkSpan` (clamped crop marks) |
| `src/utils/scryfall.js` | `parseCardList` (text → `{qty,name,set,collector}`; lines cut at 200 characters; `MAX_LINES` 1000 per import, checked by the Scryfall import and `parseDeckText`; collector keeps **original case**. Scryfall `/cards/collection` is case-sensitive on it, e.g. The List `TMP-294`) + `fetchScryfallImages` (`/cards/collection` batched, printing-pinned via name\|set\|collector keys, downloads PNGs as `File`; DFC → both faces) + `fetchPrints(name, unique = 'prints')` (also `art` = `art_crop`) + `downloadAsFile` + `fetchDeckList` removed (no more deck-link import: the user dropped it, the sites block third-party reads) + `scryfallFetch` (retry 429/5xx + network, clear error on Scryfall outage) + `deckLine(qty,name,set,cn)` (builds `qty Name (SET) cn` so deck links pin the **edition chosen in the deck**). **Deck manager additions:** `scryfallFetch` is exported (AbortError rethrown at once, 4xx errors carry `.status`), `lookupCards(list)` (the `/cards/collection` resolution extracted from `fetchScryfallImages`, returns a finder; names in `not_found` are retried one by one with `/cards/named?exact` (+ `&set`), which also knows alternate names such as `flavor_name`, and cards are keyed by `flavor_name` too), `fetchDeckBoards(url)` → `{ name, rows: {qty,name,set,collector,board,commander}[] }` (Moxfield commanders/main/side/maybe boards, Archidekt categories, Tappedout as main); `fetchDeckList` now derives from it (main + commanders, as before) |
| `src/utils/upscale.js` | **AI upscale 2×** in the browser. `upscaleFile(file, onProgress)` lazy-imports `upscaler` + `@upscalerjs/esrgan-medium/2x` (one `Upscaler` instance, WebGL, weights from `models/esrgan-medium-x2/model.json` on the site), tiles 128/pad 8 with `awaitNextFrame`, then re-applies the original alpha scaled 2× (`destination-in`) so Scryfall's transparent rounded corners don't turn black; returns `{ file: PNG same base name, width }`. `canUpscale(item, dpi, cardW)` = RGB (not `colorKind:'cmyk'`) and rounded effective DPI < chosen DPI. Measured on an RTX 4070: ~7 s per Scryfall PNG, first run ~16 s (shader compile + weights). Used by App `handleUpscale` (dedupes shared `File`s across duplicates, updates `file`/`preview`/`w`, persistent `kind:'progress'` toast with % then success/error) and the card menu item "Upscale 2× (AI)" (single + multi, disabled with a note: running / CMYK file / sharp at N DPI) |
| `src/decks/SettingsPage.jsx` | `#/settings`, from the avatar menu (Profile, Settings, Privacy, Sign out, Delete). First Account (email + verified badge, sign-in method) and Password (`PasswordForm`: `changePassword` = reauth with the current password, then `updatePassword`; Google accounts get a note); then cards of `Choice` (label + select bound to a settings key; true / false options are stored as booleans) and `Toggle` (checkbox): Decks (format and group of new decks, view and sort of every deck), Print deck (replace or add to the queue, include the sideboard), Card language, Import (printing not found: default printing or skip; same printing on more lines: merge or separate rows), Appearance (hover preview off / small / medium / large, list density, reduce motion), Prices (EUR Cardmarket / USD TCGplayer / off), then Backup (all decks as one JSON) and Restore (file → `fromBackup` → `createDeck`, added next to the existing decks). `App` counts `/settings` as part of the decks area Since 2026-10-20, under the grid at full width: the "Delete account" card (`.profile-card.settings-danger`, red border and title, faint red top), a note on what is deleted and a red `btn-secondary settings-delete` "Delete account and data" that opens `ConfirmDialog` (portaled to the body; Cancel focused) and then `deleteAccount(deleteUserData)`, toast "Account and decks deleted" or the error. The tour copy (`SettingsStage`) shows the same card. |
| `src/utils/settings.js` | Settings store saved on this device (`localStorage` `ip:settings`, legacy `ip:deckView` / `ip:deckSort` as initial values): `DEFAULTS`, `getSettings`, `setSetting`, `useSettings` (`useSyncExternalStore`); toggles the `reduce-motion` class on `<html>` (imported in `main.jsx`). Not synced between devices: that needs a profile field and a Firestore rule |
| `src/decks/cardLang.js` + `CardImg.jsx` | Card images in the Settings language: `useCardImg(card, side)` / `<CardImg side>` (side 1 = back of a double-faced card: cache key with `/b`, fallback `card.back`; one localized lookup stores both faces) return the localized print (same set and number, `localizedCard` in `utils/scryfall.js`, one request every 110 ms, prints without a real scan count as missing) or the English snapshot image; results cached on the device (`ip:locimg:v2`, "" = not in that language); `cachedImg` for the hover preview. Used by the deck rows, the hover preview and the sample hand; Print deck asks `fetchScryfallImages(..., { lang })` for the same prints. Names and search stay English |
| `src/utils/timeAgo.js` | `timeAgo(ms)`: "10 minutes ago" / "yesterday" / "just now" (`Intl.RelativeTimeFormat`), used by the editor's Saved label and the deck tiles |
| `capacitor.config.json` + `android/` + `assets/` | Android app (Capacitor 8): app id / name / `webDir`, dark background, SystemBars (`native` insets, `DARK` style); native project (`MainActivity` = `BridgeActivity` + `EdgeToEdge.enable` after `super.onCreate`; `res/values/styles.xml` dark launch and window theme); icon and splash sources. See "Run > Android app" |
| `src/utils/download.js` | The one save path. `saveFile(filename, blob)`: web = temporary `<a download>`; Android app = written in 3 MB base64 chunks (`Filesystem.writeFile` then `appendFile`, so a 95 MB CMYK PDF never becomes one giant string) to `cache/exports/` and opened in the share sheet (`@capacitor/share`; closing the sheet is not an error). `downloadText(filename, text, type)` wraps it. Used by the RGB and CMYK PDF export, Save list (`proxodon.txt`), the deck export `.txt` and the decks backup `.json` |
| `src/utils/scryfall.selfcheck.js` | `node`-runnable assert check for `parseCardList` (no framework). Run: `node src/utils/scryfall.selfcheck.js` |
| `src/decks/deckModel.js` | Deck manager pure logic (no React/Firebase). Phase 1 core: `snapshotFromCard` (Scryfall card → row snapshot; cost/type/colors/images from the **front face** for DFC/split, `legal` for 7 formats, `limit` from oracle text: 0 any number, N up to N), rows (`addCard` same print+board = +qty, `MAX_ROWS` 500, `MAX_QTY` 99, `setQty`/`bumpQty`/`removeRows`/`setCommander`/`moveToBoard` merging equal rows), `boardCounts`, `countTarget`/`countOk` (Commander exactly 100, others min 60, Casual none), `copiesToAdd` (Shift = 4 except singleton Commander, basic lands and "any number" exempt), `illegalIn(format, card)` (`banned` / `not_legal` or null; missing data = not legal; Casual null; raw Scryfall card via `{ legal: c.legalities }`) + `legalityLabel(status, format)`, `maxCopies(format, card)` (Infinity for Casual, basic lands, "any number"; Vintage `restricted` = 1; "up to N" = N; else Commander 1, others 4) and `overLimit(deck)` (copies per oracle id, prints together, main + sideboard, sideboard not in Commander, maybeboard never → `[{ oid, name, count, max }]`). Views and I/O: `primaryType`/`groupMain` (main board by `deck.groupBy`, see `GROUP_MODES`: `type` = primary type, priority Land > Creature > Planeswalker > Battle > Artifact > Enchantment > Instant > Sorcery; `typeAdv` = every card type of the type line as its own group, "Artifact Creatures" apart from "Creatures", ordered inside the family of the primary type, single type first; `mv` = 0..6, 7+ and Lands; `custom` = "Deck" (rows with no known section) then `deck.sections` in order, each group carries `section`; rows sorted by mana value then name), sorting `SORT_MODES` (`groupMain(deck, sort)`, `boardRows(deck, board, sort)`: `mv` = mana value then name, `name`), sections `addSection` (returns `{ deck, id }`, name trimmed to 40, switches `groupBy` to `custom`) / `renameSection` / `deleteSection` (rows back to Deck, merged; deleting the last one switches back to `type`) / `splitRow(deck, rowId)` (one copy into a new row right after, not merged; no-op for 1 copy or at `MAX_ROWS`) / `changeEdition(deck, ids, snapshot)` (rows take the chosen print, equal rows merge) / `placeRows(deck, ids, board, section?, { one })` (drag and drop: board, optional section, commander cleared; `one` = Alt, one copy per row split off and merged at the destination, a 1-copy row moves whole; no-op past `MAX_ROWS`) / `moveToSection` (merges equal rows), `commanderRows`/`boardRows`, `deckIdentity` (commanders, else main) / `coverRow` + `deckCover` (`deck.cover` = chosen oracle id, follows edition changes; removed card = automatic: first commander, else first main card), `scryfallImg` (https on `cards.scryfall.io` / `svgs.scryfall.io` only, returns the encoded `href`, else `''`) + `withScryfallImgs` (same on every row's `img` / `back` / `art`, for other accounts' decks), `toPrintEntries` (front-face name + set + collector, commanders first, sideboard optional, maybeboard never), `exportText(deck, { specs })` (MTGA headers Commander / Deck / Sideboard only when needed; `specs: false` drops "(SET) num") / `parseDeckText` (headers in any case, `//` and `:` tolerated), `toBackup`/`fromBackup` (`{app, kind, v:1}`, bad rows dropped, unknown format = Casual, tags filtered), `duplicateDeck`, tags `DECK_TAGS` / `MAX_TAGS` / `deckTags`, `refreshSnapshots` (key-order-insensitive compare, same object when unchanged), `packPiles(heights, gap)` (stack view: piles in group order, each into the first column where it fits under the tallest pile's height, else a new column; returns pile indices per column), sample hand `libraryCards(deck)` (one entry per main-board copy, commanders out), `shuffle(list, rng)` (Fisher-Yates on a copy), `mulliganBottom(format, mulls)` (London; Commander's first mulligan free). Self-check: `node src/decks/deckModel.selfcheck.js`. `contentSig(cards)`: FNV-1a of the cards by oracle id with quantities summed per board, section and commander flag (edition changes, split / merged rows and deck fields do not change it). Snapshot field `back` = normal image of the second face, only when the faces have their own images (transform / modal DFC; split and adventure have one image, so ''), filled into old decks by the refresh on open. Phase 3: snapshot field `cmdr` (legendary creature or "can be your commander"; old snapshots fall back to the type until the refresh adds it), `manaPips(cost)` (per color: hybrid counts each color, Phyrexian its color, {C} colorless, generic / X / snow ignored), `deckStats(deck)` (main board incl. commanders: `cards`, `lands`, `library` (no commanders), `avgMv` / `medianMv` of non-lands and `avgAll` / `medianAll` with lands, `totalMv`, `curve` 0..7+ with `perm` / `spell`, row ids and `groups` by type, `colors` W U B R G C with `pips`, `byMv`, `sources`, `landSources`, totals `pips` / `sources`), `drawTypes` (copies per type in the library, lands first, multi-type counted in each), `hyperAtLeast(N, K, n, k)` (hypergeometric chance of at least k successes), `validateDeck(deck)` (never blocking, each issue `{ key, level, label, ids }`: Commander = no commander / more than 2 / can't be a commander / outside the commanders' color identity / sideboard rows; 60-card = sideboard over 15; all = copy limit, legality; Casual none; the card count stays in the top bar) Since 2026-10-18 the snapshot also has `gc` (Scryfall `game_changer`) and `searchIdentity(deck)` gives the commander identity the card search respects (null outside Commander or without a commander). Commander bracket (2026-10-20): `BRACKETS` (Exhibition, Core, Upgraded, Optimized, cEDH), `gameChangers(d)` (distinct `card.gc` in the main board, commander included; side and maybe do not count), `autoBracket(d)` (0 = 2, 1 to 3 = 3, 4+ = 4), `deckBracket(d)` (null outside Commander or when `bracket === 0`, else the manual 1-5 or the auto one), `bracketField(b)` (`{ bracket }` only for an int 0-5); `indexFields` adds `bracket: deckBracket(d)`, `cleanIndex` keeps 1-5 else null, `cleanPublicDeck`, `duplicateDeck`, `toBackup` and `fromBackup` carry `bracket`. |
| `src/decks/scryfallSearch.js` | Deck editor Scryfall calls: `autocompleteUrl`/`namedUrl`/`searchUrl(q, order = 'name')` (always `game:paper`, `unique=cards`), `withLegal(q, format)` (adds `legal:<format>`, Casual untouched), `advancedQuery(filters)` (filters → Scryfall syntax, quotes stripped, colorless wins, identity uses `id`), `autocomplete` (≥2 chars), `namedCard` (exact), `searchCards(q, signal, pageUrl, order)` (page + `next`, 404 = empty), `cardsByIds` (75 per batch, 100 ms apart), `resolveEntries` (parsed/link rows → `{ items: {card: Snapshot, qty, board, commander}[], notFound }`, DFC looked up by front face) |
| `src/components/CardMenu.jsx` | Context menu extracted from `PagePreview` (same behaviour: portal to body, clamped to viewport, ↑/↓, Esc/Tab/outside/resize/blur close, focus restored). `items: {key, Icon, label, run, keepOpen?, danger?, disabled?, note?}`. Used by print cards, deck tiles, deck rows, account menu Since 2026-10-20: `Icon` is optional, `checked` (true / false) makes an item a `menuitemradio` with `aria-checked` and focuses it on open (arrows use `[role^="menuitem"]`), `className` adds a variant (`bracket-menu`). |
| `src/hooks/useLongPress.js` | `useLongPress()` → `{ bind(onLong(x, y)), consumed() }`: 500 ms touch/pen press opens a menu, cancelled by >10 px moves; `consumed()` in the click swallows the click that ends a long press |
| `src/decks/Mana.jsx` | `ManaCost({cost})` and `ManaPips({colors})` from Scryfall symbol SVGs (`svgs.scryfall.io/card-symbols/{2W,WUP,...}.svg`) |
| `src/hooks/useHashRoute.js` | `useHashRoute()` (path without `#`, empty = `/print`, `useSyncExternalStore` on `hashchange`), `navigate(path)` and `goBack(fallback)`: each page's history entry carries `history.state.idx` (0 = first page opened in the tab, +1 on every new hash, read back on back / forward; overlay entries copy it); `goBack` does `history.back()` when idx > 0, else `navigate(fallback)`, one tick after the click and after a closing overlay's own back (`closingBack()` from `useBackClose`); one at a time (`leaving`) |
| `src/components/NavTabs.jsx` | Header tabs "Decks / Print" (hash links, `aria-current="page"` on the active one: cyan, with the Figma "roof" `assets/figma/nav-roof.svg` above it; the others white 50%). The header line under them (step under the logo) is a data-URI SVG in `.app-header::after`, built in the restyle block at the end of `index.css` |
| `src/decks/DecksView.jsx` | Lazy root of the Decks area (props `route, notify, printQueueCount, onPrintDeck, headerSlot`; `#/decks/folder/:id` = My decks with that folder open (`DeckList folder`); once signed in it portals `DeckHelp` (editor only) and `AccountMenu` into the app header's `headerSlot` node): waits for the user from `useAccount` (`decks/useAccount.js`: `watchUser`, the profile doc (`profile`, `photo`) once verified, `rerender`), shows `SignInPanel` when signed out (Sign in with Google, or an email + password form: sign in / create account toggle, "Forgot password?" sends the Firebase reset email, errors mapped by `authMessage`); an email account not yet confirmed gets `VerifyEmailPanel` instead ("I verified it", "Send the link again", "Use another account", re-checks on window focus; `rerender` reducer because `reload()` mutates the user in place), else `#/profile` → `ProfilePage`, `#/settings` → `SettingsPage`, `#/community/:id` → `CommunityDeck` (no `DeckHelp`), `#/decks/:id` → the editor, `#/decks` and `#/community` → `DeckList` (`community` prop; App's `inDecks` includes `/community`). Once verified it listens to the profile doc and passes `photo` to `AccountMenu` and `ProfilePage`. Wrapped in App by `ErrorBoundary` (chunk/Firebase failure shows "Couldn’t load Decks" + Retry instead of unmounting the app) |
| `src/decks/firebase.js` + `firebaseConfig.js` | Firebase init (`firebase` 13): `auth`, `db` = `initializeFirestore` with `persistentLocalCache` + `persistentMultipleTabManager` (offline + multi-tab) and `ignoreUndefinedProperties`; `signIn` (popup, redirect fallback when blocked), `signInEmail` / `signUpEmail` (sends the verification email, a failed send does not block) / `resetPassword` / `sendVerification` / `needsVerification(u)` (not verified and no Google provider, same condition as the rules) / `checkVerified()` (reload + forced token refresh so the rules see `email_verified`) (Email/Password provider) + `authMessage(e)` (readable text per auth error code), `updateNickname`, `changePassword`, `signOut`, `watchUser`, `deleteAccount(deleteData)` (data first, then user; reauth popup on `requires-recent-login`). Config is public (rules + authorized domains protect data). Android app (`Capacitor.isNativePlatform()`): `signIn` and the delete re-auth use native Google sign-in (`@capgo/capacitor-social-login`, Credential Manager, lazy import, initialized once with `googleWebClientId` from `firebaseConfig.js`) and pass its `idToken` to `signInWithCredential` / `reauthenticateWithCredential`, so Firestore and `watchUser` are unchanged; `USER_CANCELLED` = no error; `signOut` also logs out of the plugin so the next sign-in can pick another account. `signOut` and `deleteAccount` set `ip:clearCache` in localStorage; the next start clears the Firestore IndexedDB cache before any read (top-level await + `clearIndexedDbPersistence`; with other tabs open it fails and is retried at the following start). App Check (`initializeAppCheck`, `ReCaptchaEnterpriseProvider`) starts only when `appCheckSiteKey` in `firebaseConfig.js` is set |
| `firestore.rules` | Only the owner reads/writes `users/{uid}/decks/{deckId}`, and only with `email_verified` in the token or a Google session (`owner(uid)`); the profile doc `users/{uid}` has the same owner check and `validProfile(uid, d)` (keys `photo`, `banner`, `nickname`, `updatedAt` only; photo a string of at most 200k chars, banner at most 600k; a nickname must be the user's in `usernames/` after the write, checked with `getAfter`); `usernames/{lowercase name}` = `{ uid }`: `get` for any verified account (never `list`), `create` by the owner when the name matches `^[a-z0-9._-]{3,24}$`, `delete` by the owner; deck create/update need `cards.size() <= 500`; `publicDecks/{deckId}` (Community copies): `read` for any verified account, create/update only with `uid` = the caller (update also needs the stored `uid` to be theirs), `cards` at most 500, `words` at most 200, `owner` null or a nickname whose `usernames` doc is the caller's (`get`); `delete` by the owner or when the doc does not exist; `publicDecks/{id}/dilemmas/{d}`: read verified, create / delete by the public deck's owner (`validDilemma`: keys, question 1-280, two cards); `.../votes/{uid}`: create as yourself, never on your own dilemma (`validVote`: pick 0 / 1, why up to 500, owner null or your nickname), update only `why`, delete by the voter or the dilemma owner; `users/{uid}/answered/{id}`: own only, created only with its vote in the same batch (`existsAfter`) and id `{deck}_{dilemma}`; `publicDecks/{id}/likes/{uid}`: read for verified accounts (the count is a list query), create only as yourself with keys `at`, never on your own deck (`get` of the parent), delete your own. **Published by hand** in the Firebase console (Firestore → Rules) Help requests: `publicDecks/{deck}/helps/{id}` (`validHelp`; create by the public deck's owner, later only `status` / `applied` / `seenAt`), `.../replies/{uid}` (`validReply`; one per account, never on one's own request, only while open; deleted by its author or the request owner), `users/{uid}/replied/{deck}_{help}` (written with the reply, `existsAfter`), read-only collection group `{path=**}/helps`. Since 2026-10-19 (review H1, H4, M1, M3, L5; see the log): private decks `validDeck` (`hasOnly` of the 17 client fields, short name / format / `ver` / `base`, folder `{ id, name }`), update needs `rev` + 1 and `ver` unchanged or `base` == the saved `ver`; card lists of dilemmas, help requests and replies checked per position (`card()`: exactly 7 keys, all strings, 1400 chars together); public copies check `groupBy`, `cover`, `sig`, `public`, dates and each tag, and on update `createdAt` can only stay or move earlier; dilemmas / help requests only on a non-retired copy (`'cards' in`); `applied` grows by one short key at a time; `users/{uid}` delete only with the nickname already freed; reserved nicknames (`admin`, `proxodon`, ...); a full public copy only while the private deck is public (`stillPublic`, review M2). Rows and sections of public copies are still unchecked per element (rules have no loops, `join` refuses maps); `words` is capped with `join`. Since 2026-10-19 also `publicIndex/{id}` (`validIndex`, `ownCopy`, `stillPublic`): the light Community index, see the log. `bracket(d)` (2026-10-20): `bracket` is allowed in `validDeck` and `validPublic` as an int 0-5 (absent = auto) and in `validIndex` as null or an int 1-5. |
| `src/decks/AccountMenu.jsx` | Exports `Avatar` (custom photo, else Google photo, else the initial of nickname or email) and `HeaderAccount` (print header, lazy in App: `AccountMenu` when signed in, else a sign-in icon to `#/decks`). Avatar button (in the app header) → `CardMenu` titled with the nickname (`displayName`, else email): Profile (`#/profile`), Settings (`#/settings`), Privacy, Credits (`CreditsPanel`), Sign out (since 2026-10-20 no Delete account item: it is at the bottom of `SettingsPage`, and the `onDeleteData` prop is gone); Privacy, Credits and the sign-out confirm are portaled to the body |
| `src/decks/DeckHelp.jsx` | The `?` of **every** Decks page in the app header (`DecksView` renders it always; `editor` = the deck editor, `#/decks/:id`, not the folder route): `.help` tooltip (click toggles, outside click or Esc closes); in the editor the desktop text (search keys, select, drag, right-click menu, toolbar, cover) or touch text, elsewhere just the "This page" title; always ends with the `HelpTour` row (tutorial of the page). Touch: close button |
| `src/decks/deckStore.js` | Firestore I/O, one doc per deck at `users/{uid}/decks/{deckId}`: `listenDecks` (client-side sort by `updatedAt` desc, `serverTimestamps: estimate`), `listenDeck` (with metadata → `hasPendingWrites`), `createDeck` → `{ id, done }` (writes are not awaited by the UI: offline they queue), `saveDeck` (`setDoc` merge, `updatedAt` server time; the payload carries `public`; a public deck is also written to `publicDecks/{id}` as a separate write, so a rejected copy never loses the deck), `setDeckPublic(uid, deck, on)` (off also deletes the copy), `unpublishDeck(id)`, `deleteDeck(uid, deck)` (plus the copy when public), Community: the copy = deck payload + `uid`, `owner` (profile nickname kept in a module variable by `listenProfile`, else null) and `words` (every prefix up to 20 letters of each name word, for `array-contains`, no index), `createdAt` of the deck; "Last update" = `changedAt` (`changedMs`, falls back to `updatedAt`): `saveDeck` / `createDeck` write `sig` = `contentSig(cards)` and move `changedAt` only when it differs (added / removed cards, quantities, boards, sections, commander), so Public, name, format, Group by, cover, edition / art changes and the Scryfall refresh only touch `updatedAt`; `fromDoc` fills a missing `sig` from the loaded cards, and an older deck without `changedAt` gets its old `updatedAt` on the next unchanged save; the list is sorted by `changedMs`. Public copy written with merge, `owner` only once the profile has loaded (`ownerName` undefined before, so a save then keeps the copy's signature instead of turning it anonymous). Dilemmas: `publicDecks/{deck}/dilemmas/{id}` = `{ uid, question, cards: [2 snapshots: name, img, back, sid, oid, set, cn], createdAt }` (`listenDilemmas`, `createDilemma`, `deleteDilemma` = votes then dilemma in one batch, `deleteDilemmasOf` on deck delete and account delete); votes `.../votes/{uid}` = `{ pick, why, owner, at }` (`listenVotes`, `voteDilemma` = vote + `users/{uid}/answered/{deck}_{id}` in one batch, `explainVote`), `countAnswered` for the profile; `deleteUserData` first removes the account's votes (from `answered`) and the dilemmas of its public decks. `listenCommunity(word)` = latest 60 by `createdAt`, or 60 with `words` containing the word, sorted newest first (filters and other words run on the client: no composite index; add indexes when the community grows), `listenPublicDeck(id)`; likes = `publicDecks/{id}/likes/{uid}` = `{ at }`, no counter field (the author's republish would overwrite it): `countLikes(id)` (`getCountFromServer`, one read), `hasLiked(id, uid)`, `setLiked(id, uid, on)`; `deleteUserData` (decks in batches of 200 with their public copies, the nickname's `usernames` doc, then the profile doc); `claimNickname` also re-signs the user's public decks afterwards (best effort); profile doc `users/{uid}` = `{ photo, banner, nickname, updatedAt }` (followers / following will come with public profiles, the client never writes them): `listenProfile`, `saveProfile(uid, { photo } or { banner })` (null removes), `claimNickname(uid, name, old)` = transaction: error `taken` when another uid owns `usernames/{key}`, else create it, delete the old key, write `nickname` to the profile; `nicknameKey`, `NICKNAME_RE` Since 2026-10-19 the Community feed reads `publicIndex` (`listenCommunity`, `cleanIndex` entries); since 2026-10-20 only the index (no fallback to full copies), and `deckOnce` (Dilemmas and Help feeds) reads the index entry too (`{ ...entry, cover: entry.art }`, null when the deck is not in the index), never the full copy; `publish` / `unpublishDeck` / `claimNickname` / `deleteUserData` keep the index in step and `ensureIndexed` (called by My decks) backfills public decks from before the index. `payload(d, merge = true)` writes `bracket` only when set by hand or off (`bracketField`); when auto, merged writes (`saveDeck`, `publish`) send `deleteField()` and `createDeck` passes `merge = false` (no field). `ensureIndexed` also rewrites an index entry that has no `bracket` key (once per session), so old public decks get it on the tile. |
| `src/decks/SampleHand.jsx` | Sample hand under the deck: `libraryCards(deck)` shuffled (`shuffle`), 7 drawn, cards side by side (wrap on narrow screens, `--w` clamp(110px, 9.5vw, 200px)). New hand, Mulligan (London, `mulliganBottom(format, mulls)`: click the cards to put on the bottom, first free in Commander; bottomed cards count in the library but are not drawn again), Draw. Outside the mulligan choice a click plays the card: `leaving` → `card-play` animation (slides down 70 px and fades, 0.34 s; 1 ms with reduced motion so `animationend` still fires) → `played`, and a land adds 1 to the "Lands on battlefield" counter. Non-land cards with mana value above the lands on the battlefield are faded (`.uncastable`, opacity 0.45; colors and lands already used are not checked). Status line (the opening-hand average moved under the Draw odds chart) |
| `src/decks/DeckStats.jsx` | (Since 2026-10-19: every panel is a `StatFrame`, the deck card shape: measured `CutFrame` with a dark fill, the gradient border at 35% and a top-left pocket 4 px wider than its `.stat-pill`, which holds the tile name, the colour symbol + name or the chart title; sagoma and border at z-index -1 in an isolated box; summary tiles at least 150 px so the long names fit; the `sr-only` data tables sit in a `div.sr-only` because a table does not shrink to 1 px and widened the phone page.) Stats under the deck, laid out like Moxfield's (user screenshot) in the site style, hand-written SVG: row 1 = mana curve (viewBox 400, plot max 600 px wide, grid + axis titles, stacked columns permanents `--chart-1` / spells `--chart-2`, tooltip, the picked bar full and the others faded; default = the tallest bar; click / Enter picks), the picked mana value's cards grouped by type as a list only (`curve[i].groups`, row click = select it in the deck, Select in deck = the whole bar); then a summary sentence (cards, lands, nonlands, average and median mana value with and without lands, total); then one card per color W U B R G C (share of all cost symbols, symbols by mana value mini curve, sources bar = cards making that color / all mana-making cards, lands among them; faded when no cost uses the color); then `DrawOdds`: line chart as wide as the section (plot width measured with `ResizeObserver`, viewBox = real pixels so text stays 11 px), y ticks 0 to 100% and x ticks T1, T2... only (no axis titles; alternate labels counted back from the last turn when they get narrower than 34 px). Options in one wrapping row: Draw (Copies of a card, or a type from `deckStats().drawTypes` shown as "Lands (36)"), Copies (only for copies of a card, default 4), At least (default 1, clamped to 1..count), Turns (default 10, 2 to 20). On the play (7 + T - 1 cards, `--chart-1`) and on the draw (7 + T, `--chart-2`), `hyperAtLeast(library, count, draws, atLeast)`, 2 px lines, dots with a surface ring, end labels, dashed crosshair + tooltip per turn, hidden table; values with one decimal, ">99.9%" / "<0.1%" near the ends without touching them (y ticks stay whole). Under the chart: "Average <type> in an opening hand: X.XX" for the picked type (or "copies of the card (N)"), 7 x count / library. Curve row: 2 columns, 1 under 1000 px |
| `src/decks/PhotoDialog.jsx` | `kind` `photo` (circle, 256 px JPEG, at most 200k chars) or `banner` (5:1, width of the crop up to 1500 px, at most 600k chars; JPEG quality drops from 0.85 by 0.1 until it fits); title, crop heading, Save and Remove labels per kind; `onRemove` (only when a custom one exists) adds "Remove current photo / background" under the source picker. New image in two steps. Source: upload a file, or a card art (card name with native `datalist` suggestions from Scryfall autocomplete, then `fetchPrints(name, 'art')` = one tile per illustration, `art_crop` images, artist as caption). Crop: a rectangle of aspect `a` in source px (`rect`: the largest that fits, `/ zoom`, around `cx, cy`, clamped inside the image by `fit`), so `CropView` renders it at any size: the 280 px circle `.crop-area` (outside of the circle dimmed by a `::after` box-shadow) with 72 / 34 px previews (profile, menu), or a 580 px wide `.crop-wide` strip for the banner (no previews). Drag (pointer capture), wheel (native non-passive listener so the modal does not scroll), two-finger pinch, zoom slider 1 to 4, arrows move, + / - zoom. Save draws the crop from the `ImageBitmap` into the canvas (dark fill for transparent PNGs) |
| `src/decks/ProfilePage.jsx` | `#/profile` (props `user, profile, notify, onChange`), content in a centered 1240 px column (`.decks-root.profile-page > *`, shared with Settings). Hero (since 2026-10-19 like the deck tiles): a `CutFrame` panel as big as the section (measured with a `ResizeObserver`, viewBox = its pixels, so the corners stay round at any width), gradient border, the background filling it under a dark veil: the custom `profile.banner`, else the `art_crop` of the most recently updated deck with a cover, else a magenta / cyan glow. Pockets: wide = the 128 px avatar bottom-left (`bl` 136) with name and stats to its right, narrow (`.small`, under 600 px) = the 88 px avatar top-left (`tl` 96) with name and stats under it; always a round Change background button top-right (`tr` 44, icon-only). "Member since" is a mono caps callout with the blurred cyan dot at the top (out of the stats). Avatar and Change background open `PhotoDialog` (`kind` banner / photo; data URLs saved with `saveProfile`, no Firebase Storage since it needs the paid plan; Remove falls back to the Google photo / the deck art). Nickname in Chakra Petch with the wordmark's cyan / magenta aberration, pencil = inline form (3 to 24 of letters, digits, `.` `_` `-`, native `pattern`, hint, Esc cancels): `claimNickname` then `updateNickname` (Auth `displayName`); taken = toast "This nickname is taken." Stats row Last sign-in, Decks, Dilemmas answered, Followers, Following (the last two `profile.followers ?? 0`, placeholders for public profiles). Below, "[ DECKS ]" with the 4 most recent decks as `DeckTile`s that open the editor (wrench = open help request) and a See all `GhostTile` to `#/decks`, then "[ DILEMMAS ]" with the dilemmas of the public decks (5, See all shows the rest in place); next to that title an icon-only Delete all dilemmas (`IconTrash`, only when there are some; 44x44 on phones) opens a `ConfirmDialog` ("Delete all N of your dilemmas and their votes?"), then `deleteDilemma` on each (`Promise.allSettled`, toast "N dilemmas deleted" or "Could not delete X of N"). Phone: everything centered, stats wrap centered. Email, sign-in method and password are in `SettingsPage` |
| `src/decks/CutFrame.jsx` | `CutFrame({ w, h, r = 14, cuts, dashed, children })`: a w x h viewBox panel (rounded rect) with pockets cut out of the chosen corners, `cuts = { tl, tr, br, bl: [w, h] }`; the pocket's inner corner is round (h / 2), the corners next to it shrink to fit (`ra`). One path for both the CSS mask over `children` (`.cut-shape`, real holes: the page shows through) and the SVG gradient border (`.cut-frame`, `vector-effect` non-scaling-stroke, per-instance gradient id; dashed = cyan dashes). Used by the deck tiles (209x208), `DilemmaTile` and `HelpItem` (both 209x208 like the decks since 2026-10-19: votes / suggestions pill top-left, `.tile-go` arrow bottom-right, the text in `.dilemma-tile-body` inside at the bottom; `.dilemma-list` / `.help-list` share the `.deck-grid` layout). Contents sit in the pockets as siblings of `.cut-shape`, sized with `--u` (1 px of the tile at full size, `calc(100cqi / base)` on the container), so they scale with the tile on phones; pill widths come from the text length (mono 0.6em) |
| `src/decks/DeckList.jsx` | **Since the Figma 52:275 restyle (2026-10-19, see the log):** desktop tabs = `ListBand` (trapezoid links on the full-width line), search 776 px wide with the two cyan bars and the icon-only Filters (`IconDeckFilter`, count badge) or the format select, Play in the search row (`.decks-actions`), filters panel on one line with an icon-only Clear (`.decks-clear`); `DeckTile` / `FolderTile` / `GhostTile` share `TileFrame` = `CutFrame` 209x208 (see its row; since 2026-10-19 the deck tile has pockets: identity pill top-left, round magenta wrench top-right only with an open help request (`.deck-tile-help`; no Export button on tiles any more, Export… is in the tile menu), likes pill bottom-right; format + blurred cyan dot on the art, globe (public) at the right inside the border, at the format's height (under the wrench pocket when there is one; after the name in the DOM), big uppercase name, tags, by, Updated at the bottom; folders and the dashed + have no pockets). The older notes below describe the previous tiles. Deck list page, centered 1240 px column (`.decks-root.decks-page > *`, same rule as Profile and Settings). Header: tabs `[ COMMUNITY ]` / `[ MY DECKS ]` (links to `#/community` and `#/decks`, same component so search and filters survive the switch; brackets only on the active tab). Under it the name search (`searchTerms`) and a Filters button (count badge) that opens a panel: Format (Any + `FORMATS`), Contains card (text found in a card name outside the maybeboard) and color toggles W U B R G C (`deckMatches`: every chosen color in the identity, C = colorless), Clear filters. My decks filters `listenDecks` on the client; `CommunityGrid` shows the first 20 of `listenCommunity` (first search word, 300 ms debounce) that pass `deckMatches`, tile `by` = owner nickname or "a player", own decks are left out (they are in My decks), tiles open `#/community/:id`; listener error (rules not published) = "Community is not available" + message. Grid: flex wrap centered (last row too), each tile `(100% - gaps) / --cols`, 5 per row, 4 under 1100 px, 3 under 820, 2 under 560. Tabs: Community (other players only), Dilemmas (`DilemmaFeed`, search + format, Play; routes `#/dilemmas`, `#/dilemmas/:deck/:dilemma`, `#/dilemmas/play`), My decks. Tiles like the Figma frame "Proxoteca" 35:208 (1 px gradient border #FF2E96 → #AB61ED → #00E5FF at 50%, left to right, via a transparent border and two background layers: `--bg-surface` on padding-box, the gradient on border-box; 10 px radius; `art_crop` cover fading into the body over its last quarter); `container-type: inline-size`, so text sizes in `cqi` (with clamps) scale with the tile; on the art top-left, under a black top-down gradient (`::before`), the name (2 lines max, cyan globe right after it when public, not in Community; magenta wrench when the deck has an open help request, `countOpenHelps`, everywhere) and below it the format and the likes received (magenta heart + count, `useCount(countLikes, …)` in `decks/useCount.js`: server count for public decks, 0 for private ones); body: identity pips (no price: it is only in Stats), then by (Community) and "Updated <time ago>", no card count; markup in the exported `DeckTile` (also used by `ProfilePage`; cover art through `scryfallImg`, so a non-Scryfall URL leaves the art blank); hover = magenta glow and lift; an icon-only Export button (`IconExport`, `.deck-tile-export`) sits on the art's top-right corner, a sibling of the tile button inside `.deck-tile-wrap` so buttons are not nested, it opens `ExportDeckDialog`), no header actions in My decks: the + tile at the end of the grid (`GhostTile`, also the profile's See all) opens `NewDeckDialog` (name, format, Public, optional list to import); folders (`FolderTile`, `#/decks/folder/:id`, drag and drop, see the most recent log entry); Backup / Restore moved to `SettingsPage`, tile menu via right-click / Shift+F10 / long-press: Rename, Share in Community / Make private (`setDeckPublic`), Duplicate (keeps the folder), Move to "<folder>" / Move to a new folder / Remove from folder, Export… (same dialog), Delete (confirm) |
| `src/components/CardFrame.jsx` | `CardFrame` (HUD card frame from the Figma "Portfolio-TG" 4021:2397 / 4021:2411: corner chevrons + side segments, magenta / cyan; short on hover, full and glowing when selected, CSS `.card-frame`) and `CardFrameDefs` (the `#px-seg-glow` filter, once per view). Moved out of `PagePreview` so the print sheet and the deck cards share it; height `calc(var(--frame-h, 100%) + 6px)` |
| `src/decks/DeckTabs.jsx` | (No tabs on phones since 2026-10-19: the deck page shows cards, Stats, Dilemmas and Help in a row.) `DeckCount({ deck })`: total cards chip fixed at the bottom-left of the deck view (Deck tab only, editor and Community; `.deck-count` absolute in `.deck-editor`, outside `.deck-scroll`, so it stays put): two stacked chips, "N main" (incl. commanders) on top and "N side" below in every format but Commander (only the main chip there); the main number is cyan when `countOk` (Commander exactly 100, others at least 60), amber otherwise; tooltip "Main deck 60 (at least 60), sideboard 15" / "Main deck 100 of 100", `role=status`. `DeckTagList({ deck })`: the deck's tags as `.deck-tag` chips in the hero (nothing when there are none). `DeckBand({ tab, onTab, format })` (desktop, Figma 47:108): the band under the hero (`.deck-band`, 47 px, `margin-top: -11px`, sticky at 62 px under the stuck bar, `.solid` = page background once stuck): the gradient line (data-URI SVG in `::after`, above the tabs as in the design) opening into a notch on the left that holds `format` (the editor's select, Community's text), and in the middle the 4 trapezoid tabs (one inline SVG: path, drop-shadow filter and inner-stroke mask copied from the design; each slot has its own gradient shifted by its step, so the colours match the design at any width; open tab = gradient fill drawn last, others dark with the 50% gradient border; buttons clipped to the trapezoid, left over right; SVG after the buttons so `.decks-tab:nth-child(n)` is tab n for the tour; ids per instance because the tour renders a second band). Under 980 px the tabs start after the notch (x 210), under 800 they scale to 92%. `DeckTitle({ children, by })`: name row (name + heart) and "by" under it, in the desktop top bar. `DeckCount` on desktop: 58x40 chips (number Mono 20 bold over the label), magenta glow bar on the left edge (`glow-magenta.svg`), 8 px from the left and 62 px from the bottom. `DeckTopBar({ deck, scrollRef, search, onFilters, filtersOpen })` (phones and portrait tablets): sticky bar right under the hero (`.solid` once stuck, wraps in two rows, 115 px): the card search always open on the whole first row (`search`, editor only, `CardSearch noAdvanced`), then the count without chips on the left and on the right Back to top (after 600 px) and the filters button (`.decks-filter-btn` as in the lists, editor only: `onFilters` opens Advanced search in a `MobilePage`). `DeckDilemmas`: empty Dilemmas tab ("Nothing here yet.") `DeckBracket({ deck, update })` (2026-10-20): Commander decks only, a `.deck-bracket` pill "Bracket N" next to the name (desktop `DeckTitle`, phone `.deck-hero-title`, where it wraps under the name); with `update` (own deck) the pill is a button (44 px hit area via `::after`, downwards only on phones) that opens `CardMenu` with `className="bracket-menu"`: BRACKET 1-5 and NONE as the same pills in a column (current one filled with a cyan glow, NONE dashed grey); picking the bracket the Game Changers give goes back to auto, the others are fixed, NONE = off (since 2026-10-20, was a native select with Auto / names / Off); off = dashed grey "No bracket" pill, only on the own deck. Without `update` (Community) a static pill, nothing when off. |
| `src/decks/Dilemmas.jsx` | `DilemmaFeed` (deck list Dilemmas tab, `#/dilemmas` and `#/dilemmas/:deck/:dilemma`, see Done recently). Dilemmas tab of a deck (editor: `mine`; Community view), public decks only (private: hint to share). `DeckDilemmas`: list (`listenDilemmas`, newest first; thumbnails, question, "A or B"), owner adds with + (`NewDilemmaDialog`: two slots filled from "From this deck" or `CardSearch` with its success toasts muted, question 1-280, icon-only check to create). `DilemmaView` (user sketch): back, Delete (owner, confirm, votes deleted first), the two cards tilted -4 / +4 deg (hover: that one scales 1.1 and straightens, the other `brightness(0.5)`), deck name, question, then: voters (not the owner) click a card (`voteDilemma`), after that both cards show their % chip bottom-right, the pick gets the print `CardFrame` (selected), "N% chose X like you", `WhyBox` (optional explanation, 500, `explainVote`) and "Why they chose" (nickname, pick, text); the owner sees % and explanations without voting; `DeckListText`: fixed list, by name, grouped by type (commander, type groups, sideboard outside Commander). Card images through `scryfallImg` |
| `src/decks/HelpRequests.jsx` | Help requests (see Done recently, "Help requests" and "Help request page for helpers"). `DeckHelps` = the Help tab of a deck (editor: `mine` + `update`, the owner opens a request inline in `HelpView` with Apply; others go to `#/help/:deck/:id`); `HelpFeed` = the deck list Help tab (`#/help`); `HelpQuestion` (the question in the deck hero) and `HelpReply` / `ReplyDraft` (Cuts and Suggestions zones, Why?, other suggestions, then `DeckSections` readOnly with `onCut`) for that page, rendered by `CommunityDeck` with `helpId`. Inside also `HelpItem` (tile), `CardChips` (+ cyan, − magenta), `ReplyCard`, `NewHelpDialog`. |
| `src/decks/CommunityDeck.jsx` | `#/community/:id`, read-only Community deck: `listenPublicDeck` (through `withScryfallImgs`: non-Scryfall image URLs become placeholders; error or gone = "This deck is not available" + link back), editor-like `.deck-hero` (art as a span, `h2.deck-name-static`, format chip, Copy to my decks (icon-only) = `createDeck` of `duplicateDeck` with the original name then opens it, Export (icon-only), price, "by owner"), a like button next to the name (`.deck-like`, outline heart, filled magenta when liked, with the count; `hasLiked` / `countLikes` on open, optimistic toggle with `setLiked`, reverted with a toast on error), `DeckSections` with `readOnly` and a local `update` (Sort / View / Group by work on screen, nothing is saved); one Scryfall `refreshSnapshots` on open, on screen only (e.g. back faces for copies published before `back` existed); under the deck an empty "Dilemmas" section ("Nothing here yet.", content to come) |
| `src/decks/NewDeckDialog.jsx` | New deck panel (was ImportDeckDialog; opened by the + tile at the end of My decks): name, format (default from Settings), "Public, shared in Community" checkbox, optional pasted list (`parseDeckText` with board headers) → `resolveEntries` → `addEntries(newDeck(...))`; empty list = empty deck. Icon-only submit (Create deck / Import deck by content). `onCreate(deck, notFound)`: DeckList creates it (in the open folder, if any), toasts the not-found cards and opens it |
| `src/decks/hoverPreview.js` | `PREVIEW` (preview widths for Settings › preview) and `previewAt(rect, card, w)`: where the floating card preview goes (right of the element if it fits, else left; two-faced cards side by side). Drawn by `HoverCard` (DeckSections) in the deck view and in the dilemma decklist. |
| `src/decks/useDeck.js` | Editor hook `useDeck(uid, id, onError)` → `{ deck (undefined loading / null deleted), update(fn), saving, synced }` (since 2026-10-19 no `error`: read and save errors go to `onError`, DeckEditor's `syncError` that calls the app's `notify`, so a save rejected after the editor closed still shows a toast; a rejection that is not the Community copy's resets to the last snapshot and drops the waiting edits; each write sends a fresh `ver` and `base` = the `ver` it was built on, see the log): local state, whole-document save 800 ms after the last change and at once on tab hide / unmount; incoming snapshots are ignored while a local change waits; `update` returning the same object writes nothing Since 2026-10-18 also `synced` (a server snapshot arrived; DeckEditor's Scryfall refresh waits for it), `rev` advanced locally on each write (the rules reject a write whose `rev` is not the saved one + 1), and an `alive` ref (no `update` after unmount). |
| `src/decks/DeckEditor.jsx` | **Desktop since the Figma restyle (2026-10-18, see the log):** top bar = `DeckTitle` (inline name, heart with the likes received when public, "by" `owner` = the profile nickname from DecksView) + search; hero = cover on the left (art_crop 572x353 at -25/18, 80%, `mask` with `assets/figma/deck-art-mask.svg`), tags / sync / icons bottom right; `DeckBand` under it with the format select. Phone unchanged. Older notes: Editor shell: bar (back, inline name, format select, sync label Saved N minutes ago / Saving… / Offline / Offline, saved on this device, **Print deck**: no dialog when the queue is empty and there is no sideboard, else `PrintDeckDialog`; then `onPrintDeck(toPrintEntries(...))`), body with `DeckSections`; one Scryfall refresh of snapshots on open (`cardsByIds` + `refreshSnapshots`, writes only if changed); deck deleted elsewhere → toast + back to list; `resource-exhausted` → daily-quota toast. Header = `.deck-hero` (user request): the cover art (`coverRow`) on the left, an unmasked blurred layer under a sharp layer that fades out by mask, then a gradient to `--bg-surface` so the right edge always matches the background (masking a blurred child left a hard edge in Chrome); a veil (`.deck-hero::before`, strong at the bottom, light at the top) keeps text readable; on top, left-aligned, the name at the top (sized to its text with `field-sizing: content` where supported) and format, Print deck, Export (`ExportDeckDialog`), Print deck, Export and the Public toggle are icon-only 36 px squares (`.deck-hero-meta .deck-icon-btn`, dark translucent fill over the art, name in `aria-label` and `title`); the Public toggle (`aria-pressed`, filled cyan when public, so the state is not colour only: `update` sets `public`, turning it off also calls `unpublishDeck`), then the sync label at the bottom (no card count; "Saved 10 minutes ago" from `deck.updatedAt` via `Intl.RelativeTimeFormat`, re-rendered every 30 s; Saving… / Offline as before); no back arrow (the Decks tab goes back). Clicking the art (the content lets clicks through) opens `CoverDialog`; only the pointer cursor hints it (user choice). Scrolling: one container `.deck-scroll` (column flex) scrolls the header and the deck together; only the app header and the search stay put. Desktop: the name search sits in `.deck-sticky` (sticky, height 0, z-index 6) → `.deck-sticky-bar`, transparent over the header's right side and click-through; past the header (`onScroll`: scrollTop > hero height - `STUCK_AT` 72 px, fixed so the shorter stuck bar cannot flip the state) it gets `.stuck` (Advanced search and the empty status line hidden): opaque bar, the deck name input (always in the bar on desktop, smaller when stuck; on the phone it stays in the header) on the left, and controls the advanced search, which opens as `.deck-adv-panel` at the top of `.deck-main` (close button); no left search column any more. Phone: + FAB → `MobilePage` with `CardSearch` (advanced inline) as before |
| `src/decks/DeckSections.jsx` | Props `tab` (`deck` = toolbar, checks and cards; `stats` = only Stats + Sample hand, root class `tab-stats` instead of `view-*`; `all` = phones, the cards and Stats under them, no Sample hand (desktop Stats tab only); on phones New section is the last option of the Group by select, `NEW_SECTION`, and the three selects share the toolbar width, desktop keeps the + button) and `onTab`: picking from a chart switches to Deck, then scrolls to the card. Selection and hover in grid and stack views use the print sheet's `CardFrame` (rules `.deck-row:hover / .selected .card-frame`; the old magenta outline and the stack tint are gone); a layout effect after each render sets `--frame-h` on covered cards (next card in the same column, by `offsetLeft` / `offsetTop`), so the frame wraps only the visible strip (O(n²), fine up to 500 rows). Card menu (not read-only) starts with **Print** (`onPrint(rows)`): the editor sends the chosen rows (also maybeboard) to the print queue with `toPrintEntries`, always adding, never replacing. Grid and stack cards: one row at the top centre (`.deck-row-qty`, sibling of the card button) with the copies chip in the middle (only when more than 1, always visible, also read-only) and − / + round chips in the same cyan style on its sides, shown on hover or focus (touch: on the selected card); a single copy shows just − and +, centred; list view keeps the qty column and +/- at the row end. Commander: no + (only −) unless `maxCopies('commander', card) > 1`, i.e. basic lands and "any number" cards. Grid view: rows overlap by half a card (`margin-bottom: -69.67%` on the items, a percentage of the cell width = half the 488:680 height, row gap 0; a `::after` in column 1 adds a half-card row under the last one); the marquee counts only the visible part of each card (the next card in the same column covers the rest, same rule for stacks). Hover preview in every view (before: not in the grid). Double-faced cards (`card.back`): in grid and stack views a round flip button on the card's top-left (`.deck-card-flip`, sibling of the card button, also in read-only; the ban / over-limit chips move 26 px right; icon turns 180° on hover in 0.4 s), front and back back to back in `.deck-card-flipper` (`preserve-3d`, `backface-visibility: hidden`, back face pre-rotated 180°), state `flipped` = Map row id → half turns, each click adds 180° (`perspective(1000px) rotateY(n × 180deg)`, 0.55 s), so the card always turns the same way; screen only; hover preview shows front left and back right (`.deck-hover-pair`, each face `previewW` or narrower to fit), also in the grid where single-faced cards have no preview. `readOnly` (Community view): no card menu, drag and drop, +/- buttons, section rename / delete or New section; `update` then only changes the shown copy. No Deck / Stats switch any more: under the whole deck (after the Maybeboard) `.deck-analysis` holds "Stats" (`DeckStats`) and "Sample hand" (`SampleHand`), like Moxfield; `width: 0; min-width: 100%` so in stacks it takes the piles' width without widening the grid column, and it is excluded from the empty-space marquee. Format checks: `validateDeck` → a row of chips above the cards (amber warn, red legality, icon + text), click = those rows selected and the first scrolled into view (`pick`, also used by the chart bars); they replaced the copy-limit and legality banners. Toolbar of dropdowns, in this order: Sort by, View by, Group by, then an icon-only "+" New section button (square, as tall as the selects via `align-self: stretch`; `.deck-tool` drops the global `label` 6 px margin so the row is the select height). Group by (`GROUP_MODES`; "Custom sections" listed only while the deck has sections, you get there by creating one), Sort by (`SORT_MODES` mana value or name, inside every group and board), View by (List / Grid / Stacks / Stacks, every copy), plus "+" New section in every mode. Sort and view are per device (`usePref(key, modes, fallback)` → `localStorage` `ip:deckSort` / `ip:deckView`, defaults Name and Stacks, blocked storage = session only; a device with a saved choice keeps it); group by is saved on the deck. Commander block, main groups (list: CSS columns; grid: groups stacked, images in an auto-fill grid, min 176 px; stacks: piles from 200 to 400 px wide (`--stack-w` on `.deck-columns`: columns counted at 200 px, then widened to fill the measured area width, `ResizeObserver` on `.deck-sections`, and packed again) where each card covers the previous one except its name row, `margin-top: -125.3%` of the width (14% of the width stays visible); commander, main groups and sideboard are piles packed into `.deck-stack-col` columns by `packPiles` (first fit, see deckModel) with heights computed from the card count and the pile width (`pileHeight(n, w)`, `PILE_HEAD` 34 = group head + margin), so no column is taller than the tallest pile; `split` = one card per copy, CSS `layout` = stacks, no qty badge), Sideboard, Maybeboard (`<details>`, shown while dragging even when empty). One `row(r, copy)` renders every view. Hover preview (desktop, list and stacks, `PREVIEW_W` 320 px): the card next to the row, right side or left when there is no room, hidden on any scroll. +/- (`bumpQty`) on mouse hover only (user choice; also visible when keyboard focus is on + or - itself, so no invisible focused button), on touch only for the selected card in grid and stacks. Empty space (`onEmpty`: not a row, the toolbar, section actions, a dialog or a control): click clears the selection, a mouse drag past 4 px draws a `.marquee` (same look and rules as the print preview: adds the touched rows live, never removes, the click that ends it is swallowed); in stacks a card counts only by its visible strip (up to the next card's top). `.deck-sections` spans the deck area edge to edge with `min-height: 100%`, so the whole editor area counts as empty space; its side padding is 13% per side (percentage so it follows the screen: 333 px at 2560, 251 at 1920; the phone keeps 14 px) (list: 300 px columns, 0.95rem rows with 16 px mana symbols, 0.9rem group heads, Moxfield-like readability); in stacks it is a single `minmax(0, max-content)` grid column centered (same padding) and `align-content: start` (toolbar aligned with the columns; without it the auto rows stretch to the `min-height`). Legality: rows that count and are banned / not legal in the deck format (imported, added before the check, or after a format change) get a red ban chip (`.deck-card-ban`, same clipped-corner look as the print low-res "!") in `.deck-card-flags` top-left on grid / stacks cards, a ban icon after the name in list, and a red banner "Not allowed in <format>: Name (banned), ...". Copy limit: `overLimit` → amber banner + icon on the row or round badge on the card, only on rows that count. Selection like print cards (click toggle, Shift range, Esc); in stacks an inner border + tint so only the strip shows. Desktop drag and drop (HTML5, the whole selection when the row is in it, Alt at dragstart = one copy per row, `dragIds` = `{ ids, one }`, in image views a custom ghost via `setDragImage` (an off-screen `.deck-ghost` with a clone of the card image, 140 px, badge with the copies moved when more than one, removed on the next tick; the default ghost of a stacked row also captured the cards lying over it), hint "Drag to move · Alt+drag moves one copy" in the toolbar, dashed cyan drop target): onto a main group (its section in custom mode), the Sideboard or the Maybeboard → `placeRows` (a dropped commander stops being one); `endDrag` also runs on drop because the moved row can unmount before its dragend. Section header rename (`NameFormatDialog`) / delete. Row menu (right-click / Shift+F10 / long-press): Change edition (rows of the same card: `ArtPickerModal` with `name`, `title`, `current` highlighted and `onPickPrint` → `cardsByIds([id])` → `snapshotFromCard` → `changeEdition`), Split row (one row with 2+ copies), Set as commander (only if the commanders stay at most 2 counting the ones already set) / Remove as commander, Move to "<section>" (custom), Move to a new section (any mode), Move to main / side / maybe, Remove **Drop zones while dragging** (editor only, desktop): `dragging` = `{ ids, host, x }` set in `onDragStart` (host = the `.deck-editor`, x = the centre of `.deck-sections`, the selection area, inside it); a `.deck-drop-zones` panel is portaled into the host, 24 px from the bottom, centred on x: "Move to", then a row (wrapping) with Main (custom grouping: Main + each section), Sideboard where the format has one, Maybeboard, each with its card count, and Remove (red, trash icon: `removeWithUndo` of the dragged rows, all copies, Undo in the toast). Every zone is shown; the one all the dragged rows already sit in is inactive (`.from`: dimmed, no drop handlers), except Main for a commander (dropping there unsets it). Each zone uses the same `dropProps` as the groups (`data-zone` = its key, `.drop-target` under the drag), so a card goes anywhere without scrolling; `aria-hidden` (mouse-only gesture, the menu has Move to) |
| `src/decks/CardSearch.jsx` | Search column (desktop) / "Add cards" `MobilePage` (phone, + FAB). Name search = only the autocomplete dropdown (user choice: no results list under the bar): Scryfall autocomplete (250 ms, previous request aborted); outside Casual the names go through one `lookupCards` request and the banned / not legal ones are dropped (if it fails, all stay and `add()` blocks them); none left = "No playable card with this name." (`emptyFor`). Arrows choose, Enter adds the active one; modifiers on Enter and click: Shift = 4 (`copiesToAdd`), Alt = sideboard (maybeboard in Commander). Esc closes the dropdown for that text (`hideFor`). `add()` re-checks legality (`illegalIn`) on every path. "Advanced search" toggles `AdvancedSearch` (the column gets `.adv-open`). Adding goes through `useAddCard` (shared with `AdvancedSearch`). Props `advanced` / `onAdvanced`: when given, the toggle only reports and the parent renders the panel |
| `src/decks/useAddCard.js` | `useAddCard(format, onAdd, notify)` → `{ add }`: modifiers (Shift 4, Alt side / maybe), snapshot, legality check, `copiesToAdd`; "Added N name" and errors go to the app toast (`notify`, threaded DeckEditor → CardSearch / AdvancedSearch), nothing under the search bar |
| `src/decks/AdvancedSearch.jsx` | Filters → `advancedQuery` + `withLegal` → `searchCards(…, order)`: card name, oracle text, type (datalist of common types), mana cost (`{2}{R}`), mana value / power / toughness with = < <= > >=, rarity, colors W U B R G + colorless as mana-symbol toggles (colorless clears the colors and vice versa) with Including / Exactly / At most and "Color identity", keyword, set code, artist, raw Scryfall syntax, "Can be your commander" (Commander only), sort Name / Mana value / Popularity (edhrec) / Newest; Reset; "Set at least one filter." when empty. Results: image grid with + (and Enter on a tile) through its own `useAddCard` (status and errors shown in the panel), click on the image = `CardZoom`. Desktop: `.deck-body:has(.adv-open)` widens the column to `min(640px, 52vw)`; phone: one column |
| `src/decks/dialogs.jsx` | `PrivacyPanel` (what is stored, where, who can read it incl. the nickname reservation list, how to delete), `CreditsPanel` (`CREDITS`: Cards = Scryfall, Wizards of the Coast Fan Content Policy notice, MPC Autofill; Print = ECI profiles, Little CMS / lcms-wasm, jsPDF and pdf-lib, jpeg-js, UpscalerJS + ESRGAN + TensorFlow.js; Look = Fontsource (Chakra Petch, Space Grotesk, JetBrains Mono, OFL, bundled since the Android app), Lucide icons; Built with = Firebase, React / Vite / react-dropzone; links open in a new tab), `NameFormatDialog` (new deck name + format, rename, custom sections; `placeholder` and `maxLength` props), `CoverDialog` (deck cover: "Automatic" + one art per card, maybeboard excluded, name filter, current highlighted), `TagsDialog` (deck tags from `DECK_TAGS`, up to `MAX_TAGS`, filter, toggle chips), `PrintDeckDialog` ("Replace the N cards in the print queue?" when the queue is not empty + "Include sideboard (N)" checkbox, unchecked, only when there is a sideboard), `ExportDeckDialog` (Plain text / With set and number toggle in the `.deck-mode` style, default plain, read-only mono textarea that selects all on focus, Download .txt and Copy (clipboard, button turns "Copied")) |
| `src/components/ErrorBoundary.jsx` | Error boundary around the lazy Decks area. Optional `fallback` (rendered instead of the Decks message, e.g. `null`) and `onError` (called from `componentDidCatch`): the tutorial uses both, so a broken tutorial switches itself off |
| `src/components/icons.jsx` | Custom lucide-style SVG icon set (currentColor); plus the deck header icons copied from the Figma frame 47:108 (`IconDeckTag`, `IconDeckPrint`, `IconDeckExport`, `IconDeckPublic`, `IconDeckSearch` in `CardSearch`, `IconDeckHeart` with `filled`), incl. `IconPlus`, `IconDownload`, `IconList` (Save list, distinct from the download/export arrows), `IconCopy`, `IconGlobe` (public deck), `IconFilter` (deck Filters), `IconFrame` + `Wordmark` (header lockup "PROXODON", final logo from the user's Figma file "Proxoteca" `M8c1qKltd3Wxh3Ii42zn0v` node 41:104, paths copied verbatim from its SVG export (inline, not `<img>`, so the V parts can animate): filled cyan `#00e5ff` letters with rounded corners, the **X is the brandmark in 3 parts**: cyan filled centre (two chevrons fused), `.x-v` = magenta `#ff2d95` V above and below (stroke 3 round); viewBox `0 0 132 31`, X centre (57.5, 15.75); `role=img aria-label="Proxodon"` inside `<h1 className="brand">`; 30px tall desktop, 26px mobile). **Hover animation** (`.wordmark`, `@media (hover: hover)`): the centre stays still, the **top/bottom V rotate 180° on the vertical axis through the X centre** (`rotateY(180deg)`, `transform-box: view-box; transform-origin: 57.5px 15.75px`, 0.4s ease-in-out transition) and rotate back on leave. `IconChevron` (pager) = the right half of the X centre (long arm up, 2:1) with the V's rounded apex. The standalone mark only lives in `public/favicon.svg` now (the `Logo` component was removed) |
| `src/tutorial/control.js` | Tutorial on/off store: `startTutorial()` (stores the current hash route), `stopTutorial()`, `useTutorial()` (route or null); `touches(rect, el)` for the area-selection gestures |
| `src/tutorial/HelpTour.jsx` | Last row of every `?` popover (print desktop in `App`, print phone in `MobileLayout`, Decks in `DeckHelp`): one line of text + the icon-only play button "Start the tutorial" (`onStart` closes the popover) |
| `src/tutorial/Tutorial.jsx` | The engine. Portal on `body`: `.tut-stage` (the demo page, `inert` + `aria-hidden`, below the app header, remounted on every step and Replay), `.tut-spot` (the hole: a box with a 200vmax shadow, follows the step target every frame), `.tut-fx` (fake cursor, gesture label, ripples, drag ghost, marquee box, drop glow, `FxMenu` = look-only copy of `CardMenu`), `.tut-card` (`role=dialog aria-modal`, tour name + step n/N, title, text in an `aria-live` region, progress ticks, icon-only Close / Replay / Back / Next-Finish). While open `#root` is `inert` (the real page stays mounted, untouched); keys are caught on `window` in capture (Esc closes, ← → steps, Tab cycles in the card) so the page shortcuts (Delete, Ctrl+A, Esc) never fire; system back closes (`useBackClose`); focus goes back to the `?`. Step = `{ target, title, text, side?, play? }`; `play(g)` gets the gesture kit `makeKit`: `move`, `click(t, label, effect)`, `menu(t, spec, { hold, effect })`, `drag(from, to, { ghost, over, effect })`, `marquee(a, b, { effect })`, `type(t, text, set)`, `spot(sel)` (moves the hole mid-step), `say`, `wait`; targets = selector in the demo, element or `{x, y}`; scrolls the target into view; Reduce motion (OS or Settings) = no tweens. Changing step aborts the running gesture (AbortController) The step card follows the step target only until the gesture starts (`hold`, 450 ms), then stays still for the whole animation (moves only on window resize or text change); `g.spot` moves only the hole. Step `side`: preferred card side on desktop, `above` / `below` docks it top / bottom on phones. `drag` takes `arrive(zone)` and waits a frame after `over(true)` (the demo opens its own zones) |
| `src/tutorial/demo.js` | Demo data, memory only: `C` = 28 real card snapshots (Scryfall images on cards.scryfall.io, `cn` empty so `useCardImg` never looks up or caches a language), `printImages(n, from)`, `demoDeck()` (Commander "Tidal Bloom"), `myDecks()` (folder Brews), `communityDecks()` + `LIKES`, `dilemmas()` + `DILEMMA_VOTES`, `helps()` + `HELP_REPLIES`, `demoUser` |
| `src/tutorial/PrintTour.jsx` | Print tour (lazy chunk): `PrintStage` = the print page with demo queue and demo settings (real `PageSettings`, `PagePreview`, `ExportProgress`; phone: `.mobile-cards` with the `.print-top` bar + add sheet + a closed `NavMenu` copy). Desktop steps: sheet, drop images on the sheet, Add cards menu, sheet setup (crop marks toggle), select (click), area selection, card menu, swap (drag), export. Phone: sheet, + sheet (taps Add cards in the top bar), tap select, long-press menu, Settings and Export (the top bar buttons). Export step: Generate PDF only |
| `src/tutorial/DeckTour.jsx` | Decks tours (lazy chunk), picked from the route like `DecksView`: My decks (also the folder route), Community, Dilemmas (also open dilemma and Play), Help, deck editor, public deck, help request page, Profile, Settings. Stages: `ListStage` (tabs, search, Filters, real `DeckTile` / `FolderTile` / `GhostTile` / `DilemmaTile` / `HelpItem` with fixed counts, `DilemmaDemo` vote), `DeckStage` (editor / Community / help request copies with the real `DeckSections`, `DeckTabs`, `DeckCount`, `DeckTopBar`, `DemoNav` (the X menu; `api.nav` opens it in the list stage, closed in the deck stage), `HelpQuestion`; `HelpReplyDemo` with Cuts / Suggestions / why), `ProfileStage`, `SettingsStage` (copies with default values). Gestures per page: search, filters, drag deck on deck = folder, deck menu, add a card from the search, select, area selection, drag to maybeboard, new section + drag into it, card menu, group by, Stats tab, like, drag into Cuts, suggest a card, vote. Phone variants use tap and long-press (no drag) Editor desktop: 16 steps (deck, search a card, add it, Shift+Enter copies, select, area, drag a card onto the drop zones, move a selection, Alt+drag one copy, new section + drag into its zone, card menu, group by, Stats, Sample hand, Dilemmas tab, Help tab); the drags are real `DragEvent`s on the demo `DeckSections` (`realDrag`), so its drop-zone panel opens and the drop moves the rows. Dilemmas: open and vote are two steps; lists: Search and Filters are two steps. `AccountStages.jsx` holds `ProfileStage`, `SettingsStage` and `Shell` |
| `src/index.css` | All styling + design tokens |
| `public/` (favicons) | Proxoteca icon set: `favicon.svg/.ico`, `favicon-16/32/48/192/512.png`, `apple-touch-icon.png`, `site.webmanifest`. Linked in `index.html` with root-absolute paths → Vite rewrites to `./` via `base:'./'` (Pages-safe); manifest icon `src`s are relative. All icons = the **3-part header mark on black** (cyan centre + magenta V above/below, the `Wordmark` X paths): `favicon.svg` (the Figma paths under `scale(13.6) translate(-56.5 -15.25)`) + 16/32/48/192/512 PNG + `.ico` (16/32/48) use a rounded square (`rx` 112 of 532, mark ~78% tall); `apple-touch-icon.png` is a full square with more padding (mark ~63%, iOS rounds it). Rasters made with **Pillow** (8x supersample: cubic paths flattened, centre filled, V stroked 3 with a round dot on every vertex for caps/joins). Manifest colours `#08070f`. |

## Design system, "Proxoteca Cyberpunk" (since 2026-07-04)

Tokens at the top of `src/index.css`. Implemented from the user's claude.ai/design spec
(`Proxoteca Cyberpunk.dc.html`, project 16e043bc-…, fetched via DesignSync; decoded copy
was session-scratch). **Replaced** the earlier warm-gold OLED theme. Don't restore gold
`#d4923f`, Bricolage/Hanken, or the green add-affordance. Memory `design-identity` updated.

- **Palette:** `--bg-base #0b0b14` (Figma "Proxodon" 47:108, 2026-10-18; was `#08070f`) under a violet-tinted 155deg gradient (body) + radial
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
  magenta→cyan **scrollbar**; magenta `::selection`. No scanlines: the `body::before` overlay (which had replaced
  the film grain) and the profile banner's lines were removed on 2026-10-19 (user: "togli l'effetto delle righe da
  tutto il sito").
- **Empty state:** no overlay, bare white sheet; the framed `.empty-cta-box` CTA was removed
  2026-10-13 at the user's request (Add cards button bottom-left is enough).
- **Invariant:** the print sheet preview stays **pure white, never tinted** (print accuracy).

## Done recently

- **Security follow-ups (most recent, 2026-10-20):** side session started by the security review session, to finish
  what it left open in code. Each step is its own commit.
  - CSP: `connect-src` lists the exact Google hosts instead of `https://*.googleapis.com` (which also covers anyone's
    Storage bucket): `identitytoolkit` and `securetoken` (Auth), `firestore`, and `content-firebaseappcheck` (the
    only host the App Check SDK calls, kept with App Check off so turning it on breaks nothing; the bundle has no
    App Check code while `appCheckSiteKey` is empty). `www.googleapis.com/oauth2/v3/tokeninfo` in the bundle belongs
    to the web side of the social login plugin, never used (the app signs in natively). Checked on `vite preview`
    (1440x900): My decks and a Community deck load, the page reaches exactly securetoken, identitytoolkit,
    firestore, lh3, Scryfall; no CSP violation; a fetch to `storage.googleapis.com` is blocked; the sign-in page on a
    signed-out origin loads with an empty console. Not tested: the Google popup (needs the user).
  - `useDeck` no longer treats every refused save (`permission-denied`, not of the public copy) as a conflict: it
    re-reads the deck with `deckFromServer` (`getDocFromServer`) and compares rev / ver with `base`, the server version
    the save started from (one object shared by queued saves, advanced when one is confirmed, reset when a snapshot
    without pending writes is adopted). Different (or deck gone) = conflict, as before: back to the server version,
    "This deck changed on another device or tab". Same, or the re-read fails (offline, App Check) = the refusal was
    something else: the edits stay, rebased on the server rev / ver, snapshots do not overwrite them (`held`), the sync
    label says "Not saved" and the toast offers Retry (only while the editor is open); the next edit, hiding the tab or
    closing the editor saves again. Only the newest save decides (`seq`). Checked on `vite preview` with a public deck:
    a 214-character name (rules allow 200) stays with "Not saved" and Retry (Retry refused again, toast again), the
    original name then saves; two tabs, tab A renames while tab B keeps editing, B's save is refused and B shows A's
    name with the conflict toast; the original name was restored and saved from B.
  - Unverified email accounts (they only see `VerifyEmailPanel`, Settings is out of reach) can delete themselves: a
    red trash icon button ("Delete this account", 36 px, 44 px on phones, `settings-delete` look) next to "Use another
    account", `ConfirmDialog` ("Delete the account x? It has no decks yet."), then `deleteUnverifiedAccount`: reloads
    the user and refuses if it is verified by now (it could have decks, so Settings with the data), else plain
    `deleteUser` (no Firestore data: the rules give unverified accounts nothing). A stale sign-in gets
    `auth/requires-recent-login`, now mapped to "For safety, sign out, sign in again and repeat within 5 minutes." On
    success the toast says "Account deleted" and the sign-in panel comes back. Checked in the dev server with a
    temporary switch that showed the panel for my signed-in Google account (removed before the commit): 1440x900 and
    375x812, button red and centred, confirm in the body with Cancel focused, Cancel and Esc close it. Confirm was not
    pressed (it would have hit the verified guard, but an account deletion is not something to test on a real one):
    the deletion itself is untested.
- **Security review and fixes (2026-10-20):** user: "fai un check sulla sicurezza del codice, usa le
  skill o agenti necessari. Sii scrupoloso, non tralasciare niente", then "Sistema il gruppo 1 e prepara anche le
  regole Firestore del gruppo 2". Three `ecc:security-reviewer` agents (rules and data layer, with ~150 probes on
  the local emulator; client code; platform, deps and secrets) found no CRITICAL or HIGH issue: no authorization
  bypass, no XSS sink, no secret ever committed, none of the 18 npm audit advisories ships (grpc is Node only,
  braces / micromatch / wireit / argparse / uuid are build or CLI tooling). Fixed in code (group 1):
  - A public deck with a negative `mv` crashed Stats (and the whole deck page on phones): `cleanSnap` clamps `mv` to
    0-1000, `mvBin` keeps every curve index in 0-7 (groupMain, deckStats, pips by mv), and `DeckStats` sits in its
    own `ErrorBoundary` ("Stats could not be computed for this deck.").
  - Feeds no longer read full public copies (up to 1 MiB each, 40 per Dilemmas open): `deckOnce` reads `publicIndex`,
    `listenCommunity` reads only the index.
  - Delete account asks for a recent sign-in BEFORE deleting data (`metadata.lastSignInTime` under 5 minutes, read
    synchronously so the Google popup still follows the click; Google = reauth popup or native, email = "sign out,
    sign in again", nothing deleted). Google sign-in always shows the account picker (`prompt: select_account`).
    `authMessage` maps unknown SDK codes to "Something went wrong (code). Try again." (app errors keep their text),
    `auth/user-disabled` like a wrong password, `auth/user-mismatch` explained.
  - `deleteUserData` no longer swallows a failed `publicIndex` listing (orphan tiles signed by a freed nickname).
  - `ManaCost` draws only plausible symbols (`{2}`, `{W/U/P}`, `{1000000}`, `{½}`...), at most 16, so a foreign
    mana string cannot steer image paths; `localizedCard` refuses odd set / number / language (no `..` in Scryfall
    paths); the language image cache keeps at most 3000 entries, writes once per 500 ms and re-checks cached URLs
    with `scryfallImg`.
  - Frame guard in `main.jsx`: inside a frame the app shows "Proxodon cannot run inside a frame" (no headers on
    Pages, `frame-ancestors` does not work in a meta CSP).
  - `.gitignore` covers `.env*`, keystores, `keystore.properties`, `google-services.json`, service accounts, keys.
  - Hardening: doc id wins over a stored `id` field (`fromDoc`, `publicOf`, `indexOf`, `plainDoc`); `scryfallImg`
    refuses credentials and ports; `cleanCards` / `cleanDeckInfo` pass images through `scryfallImg`; bidi control
    characters stripped by the cleaners' `str`; `CSS.escape` on the row selector.
  Rules (group 2, to publish): `ownCopy` wants a real copy (`cards`), also on index update; `autoId` (20 letters and
  digits) on new public copies, index entries, dilemmas and help requests; `v == 1` on decks and copies; private
  deck `createdAt` and profile `updatedAt` must be timestamps. Checked first, read-only, on the live data: all
  existing ids are auto ids, all 15 index entries have a copy with cards, `v` is 1 everywhere. Emulator test (21
  cases, scratchpad rulestest/new_test.mjs): the client flows pass (create, save with and without bracket, publish,
  index, placeholder, dilemma, help, profile) and the new refusals hold. Self-checks added (mv clamp, Stats with odd
  mv, bidi, card images, scryfallImg credentials and port, localizedCard odd paths). Checked in the dev server:
  Community tiles from the index, Dilemmas and Help feeds show deck names, Aesi Stats (16 panels) and mana symbols,
  the app framed in a test iframe shows only the notice. Not done (console or bigger work, listed for the user):
  custom domain (the github.io origin is shared), App Check and API key restrictions, budget alert, password
  policy, CSP host list without `*.googleapis.com`, Dependabot and GitHub security toggles, release signing for
  Android, rate limits on dilemmas / helps, `useDeck` treating every permission-denied as a conflict, a delete
  button for unverified accounts, split-view render cap.
- **Delete account moved to Settings (2026-10-20):** user: "togli l'opzione delete account dal menu
  profilo, mettilo in fondo alle settings con un bordo rosso". The account menu now has Profile, Settings, Privacy,
  Credits, Sign out. `SettingsPage` ends with a full-width "Delete account" card with a red border, a note on what
  goes (account, decks with their Community copies, dilemmas and help requests, votes, replies, likes) and a red
  "Delete account and data" button with the same confirm and `deleteAccount(deleteUserData)` as before. The Privacy
  panel says where it is now; the tour copy of Settings has the card. Checked at 1440x900 and on the pane (card
  last, 1240 px, red border; the confirm opens in the body with Cancel focused and I pressed Cancel) and 375x812
  (full width, no sideways scroll). Then, on the user's yes, the Privacy text was fixed: it said the likes you gave
  stay in the counts, but `deleteUserData` removes them (and the likes your public decks received go with them), so
  it now says so.
- **Bracket menu with pills (2026-10-20):** user: "cambia il menu a tendina che appare quando clicchi sul
  bracket, le opzioni devono avere solo "BRACKET X" o "NONE" e cambia l'aspetto, fallo simile al bracket attuale".
  The native select (its open list cannot be styled) is now a button that opens `CardMenu` (`bracket-menu`):
  BRACKET 1 to 5 and NONE, the same mono cyan pills in a column, the current one filled with a glow, NONE dashed
  grey like the off pill; 30 px pills on desktop, 40 px on phones. There is no Auto item any more: picking the
  bracket the Game Changers give returns to auto (follows the cards), any other is fixed (my call). `CardMenu` got
  optional icons, `checked` radio items and `className`. Checked at 1440x900 and on the pane (menu under the pill,
  focus on the current item, arrows, Esc closes and gives focus back) and 375x812 (menu under the wrapped pill,
  picking BRACKET 4 on Aesi, already its auto value, closes it and keeps auto); the account menu still renders its
  icons.
- **Commander bracket (2026-10-20):** user: "aggiungi un modo per calcolare il bracket dei mazzi
  commander: 1. se è presente almeno 1 e fino a 3 game changer viene direttamente classificato come bracket 3 2.
  nessun game changer bracket 2 3. da 4 in su bracket 4 4. l'utente può cambiare manualmente il bracket o
  disattivarlo 5. visualizzalo di fianco il nome del mazzo nella schermata mazzo e sotto il formato nelle card".
  `deck.bracket`: absent = auto from the Game Changers (`card.gc`, the Scryfall `game_changer` flag already in the
  snapshots; distinct cards in the main board, commander included), 1-5 = set by hand, 0 = off; only Commander decks
  show it (`deckBracket`). Brackets 1 and 5 are manual only (my call: the rules given cover 2, 3 and 4). Deck page:
  `DeckBracket` pill next to the name (editor: native select Auto / 1-5 / Off over the pill; Community: static).
  Tiles: "Bracket N" in cyan under the format (`.deck-tile-bracket` inside `.deck-tile-callout`, which wraps); My
  decks compute it from the rows, Community tiles read `bracket` from `publicIndex`. Storage: written only when set
  or off, `deleteField()` on merged writes in auto, so saves keep working with the old rules; the index always
  carries the bracket to show (null = none), and `ensureIndexed` rewrites old entries without it. **Rules changed**
  (`bracket(d)` in `validDeck` / `validPublic`, null or 1-5 in `validIndex`): until they are published a manual
  bracket is refused (the deck goes back to the saved version) and index writes fail silently. Help text (both
  lists) explains it. Self-checks for the rules, index, copy, backup and public copy. Checked in the dev server:
  My decks 1440x900 and 375x812 (Aesi tile "Bracket 4" under COMMANDER, 4 Game Changers), Aesi editor (pill next
  to the name, stuck bar, select options and labels read without changing them; on phones the pill wraps under
  the name, hit area clear of the name field), a Community Commander deck (static "Bracket 3", 1 Game Changer).
  The select was not changed on the real account (the old rules would refuse it).
- **Import finds alternate card names (2026-10-20):** user: "c'è un errore d'importazione delle carte:
  quando cerco una carta come "Farseek" però col nome alternativo "Newfound Adventure" viene ignorata e non aggiunta al
  mazzo". Cause: Scryfall `/cards/collection` matches only the oracle name, so "Newfound Adventure" (the
  `flavor_name` of Farseek FCA 45) came back in `not_found`. `lookupCards` (`src/utils/scryfall.js`, used by the deck
  import, the Print import and the search legality filter) now retries each `not_found` name with
  `/cards/named?exact` (+ `&set` when the line has one), one request per `slot()`, and keys every card by its
  `flavor_name` and by the name asked, so "Newfound Adventure", "Newfound Adventure (FCA)" and "Newfound Adventure
  (FCA) 45" all give Farseek FCA 45; an error or 404 leaves the card among the not found. Self-check in
  `scryfall.selfcheck.js` (mocked fetch); checked live with `resolveEntries` against Scryfall. Not changed: the
  editor search box, since Scryfall autocomplete does not index alternate names.
- **Someone else's deck: no selection, tap opens the card (2026-10-20):** user: "quando guardo un mazzo
  non mio non devo poter selezionare le carte, disattiva la selezione sinngola e ad area. Su mobile tieni la singola e
  apri la preview della carta selazionata, lasciando lo spazio per fare tap fuori e chiuderla". `DeckSections`
  `noSelect` = `readOnly && !onCut` (the Community deck view; a help request page keeps selection, it feeds Suggest
  cut): desktop click and area selection do nothing and the menu no longer selects the row; on phones a tap selects
  that one card and opens `CardView`, closing it (tap outside, ✕, Esc, Back) clears the selection. `CardView` on
  phones and tablets is at most 78vw x 70vh (was 92vw x 86vh), so there is room around it to tap. The Community tour
  text says so. Checked: Community deck at 1440x900 (click and drag select nothing), 375x812 (tap opens Arbor Elf
  292x407 with about 200 px above and below, tap outside closes, still on the deck); own deck still selects.
- **Deck hero art without visible edges (2026-10-20):** user, with two crops (the art ending in a line
  under the header and above the band): "puoi allargare l'immagine? si vede il taglio". The blurred Figma mask
  (`deck-art-mask.svg`, stdDeviation 25) was still at about 4% at the top edge of the 572x353 box and was cut by the
  hero's `overflow: hidden` at the bottom (412, the mask fades to 419). Desktop `.deck-hero-img` now has `inset: -30px`
  (632x413, the art about 10% bigger, still `cover`) with the mask moved by 30, 30 so it stays in place, and the hero
  clips only sideways (`overflow-x: clip; overflow-y: visible`). Checked at 800x600 and 1440x900 (editor Aesi, a
  Community deck): soft fade at top and bottom, no sideways scroll.
- **Desktop deck bar: search on the name line (2026-10-19; the cover art in the stuck bar was tried and removed):** user: "allinea la
  search bar col nome mazzo, in modo che siano già in posizione quando parte lo scroll. Inoltre lascia l'immagine della
  testata durante lo scroll, centrala nella porzione". The desktop `.deck-sticky-bar` now has the stuck geometry from
  the start (height 62, padding 28, `align-items: center`): name and search share one centre line (y 87 at 1440x900,
  the same before, during and after the scroll), "by" and Advanced search sit absolutely under them. Stuck changes
  only the fill: the cover (`--deck-art`, set on the bar by DeckEditor, CommunityDeck and the tour copy). First as a
  full-width `cover` under a veil; then, user: "l'immagine non allargarla, lascia le dimennsioni di quando si vede in
  testata": a `.stuck::before` with the hero's own geometry (image 572 px wide at -25, the 572x353 box centred on the
  bar's centre, the same `deck-art-mask.svg` at 16, -151.5 and opacity 0.8), so the bar shows the middle strip of the
  hero art at hero size. Then, user: "niente non viene coe lo avevo in mente. torna a prima", and asked how far:
  "Solo l'immagine": `--deck-art` and the `::before` are gone, the stuck bar is the plain `--bg-base` again; the
  search on the name line stays. Checked at 1440x900 (name and search at y 87 before and after sticking, no image).
- **Wider deck search on desktop (2026-10-19):** user: "allarga la search bar nella vista mazzo, 30%".
  `.deck-hero-search` 227 -> 295 px (the Figma 227 + 30%), the cyan glow bar on its right edge moved with it (left
  293); same width in the stuck bar. Phones keep the full-width search of `DeckTopBar`. Checked at 1440x900 (295 px,
  6 px from the right edge, stuck bar too).
- **One background for neutral buttons, site-wide (2026-10-19):** user, pointing at the Print Settings
  button (a `.decks-filter-btn`): "adatta tutti gli sfondi dei button come questo, in tutto il sito". A rule at the end
  of index.css gives `.btn-secondary`, `.bulk-btn` and `.btn-icc` the filter button look (black 25% veil, cyan 10%
  border, radius 10), icon-only `.btn-secondary.deck-icon-btn` a cyan icon, and the round `.nav-btn`,
  `.profile-icon-btn`, `.profile-bg-btn` the same fill and border (shape kept); the deck hero icons (desktop 30 px,
  radius 8; phone) and the deck top bar lost their own dark fills. Then, asked "Sì, uniforma anche i pulsanti magenta
  (Add cards, Play, Confirm) e Generate PDF": `.btn-add` and `.btn-generate` take the same fill, border and radius,
  cyan text, no glow, no animated gradient border (a disabled Generate PDF stays grey). Still apart: Danger, the ghost
  Clear of the selection bar, the X menu and `?` circles. Checked at 1440x900 (deck hero, Export dialog, Settings,
  Profile, Print sidebar, Generate PDF enabled in the Print tour) and 375x812 (deck hero over the art, top bar).
- **Dilemmas on phones: Play in the header, no search (2026-10-19):** user: "dilemmas mobile: 1. sposta
  il tasto play in alto a destra e rendilo squadrato col bordo blu come gli altri 2. rimuovi la searchbar". Done for
  phones and tablets (`phoneDilemmas` in DeckList): Play is a `.decks-filter-btn` (72x44, cyan border, like the deck
  filters button) at the right of `[ DILEMMAS ]` (`.decks-play`), no longer the round button fixed above the menu; the
  search box is gone, the format menu takes the row, and the query is ignored there (a search left from another tab
  cannot hide dilemmas). Tour copy and the Play step follow; desktop keeps search and Play in the row. Checked at
  375x812 (Play opens `#/dilemmas/play`, Back returns), 768x1024, 1440x900.
- **Stats in the deck card style (2026-10-19):** user: "prova a
  riadattare le stats con lo stile delle card dei mazzi". Every stats panel (summary tiles, mana curve, mana value
  list, colour cards, draw odds) is now a `StatFrame` (see the DeckStats row): the `CutFrame` shape and gradient border
  of the deck tiles, with the title in a pill in the top-left pocket (colour cards: small symbol + name, the big symbol
  is gone, "Sources" without the colour). Fixed on the way: the phone deck page scrolled sideways by 14 px (the hidden
  data tables were 389 px wide; now in a `div.sr-only`) and the curve row used `1fr` under 1000 px, so the mana value
  list could push it to 426 px (now `minmax(0, 1fr)`). Checked at 375x812 (no sideways scroll, every panel), 768x1024
  and 1440x900 (6 tiles per row, Price on the second row, because the long pill names need 150 px); lint and build.
- **Phone deck page: sections closer, no sample hand (2026-10-19):** user: "Mobile e tablet: 1. ho
  notato che le sezioni dilemmas e help sono molto più in basso delle stats, portale più sù 2. rimuovi la mano di prova,
  non è pratica". Cause of the gap: every `.deck-sections` (cards + Stats, Dilemmas, Help) kept `min-height: 100%` (the
  desktop area-selection space) and a 110 px bottom pad, about 690 px of nothing before Dilemmas. On phones and tablets
  `.deck-sections` is now `padding: 14px 14px 0; min-height: 0` (`.deck-body` keeps the 120 px for the menu) and
  `.deck-part` 30 px, so Stats, Dilemmas and Help are 44 px apart like the parts of Stats. Sample hand renders only on
  the desktop Stats tab; the mobile tour lost its step. Checked at 375x812 and 768x1024 (44 px, no sample hand), 1440x900
  (Stats tab with the sample hand, `min-height` 100% kept).
- **New section inside Group by on phones (2026-10-19):** user, pointing at the + next to the deck
  toolbar: "questo button mettilo come ultima opzione di group by e riadatta alla larghezza tutti i filtri". Done for
  phones and tablets (`touch`): Group by ends with "New section…" (opens the New section dialog, the select stays on
  the current grouping), the + is gone there and Sort by / View by / Group by take a third each (110 px at 375); the
  deck `?` text and the mobile tour step say where it is; desktop keeps the + button. Checked at 375x812 (the option
  opens the dialog, Cancel leaves the deck as it was, "Saved 3 days ago") and 1440x900.
- **Deck top bar: wide search, count and filters below (2026-10-19):** user, on the Esper Affinity
  editor with a drawing: "questo tasto sembra messo a caso [Advanced search], allarga la search bar, mettici sotto a
  sinistra i numeri e a destra il tasto filtri come nella pagina community". Done (phones and tablets; desktop keeps the
  link under its search): the search takes the whole first row of `DeckTopBar`, under it the count left and the
  filters button right (opens Advanced search), Back to top next to it when scrolled; `showCount` dropped (always on).
  The tour copy matches; Help scroll margin 130 px for the taller bar. Checked at 375x812 (filters opens and Back
  closes the page, stuck bar, suggestions over the cards; I typed and cleared a query, nothing added) and 1440x900.
- **Bigger X menu items with names (2026-10-19):** user:
  "ingrandisci i tasti e prova a scrivere cosa sono", then (with a screenshot of the menu) "intendevo questi. rimetti
  come prima gli altri" (a first try had enlarged the Print bar buttons: reverted). Menu circles 32 -> 48 px, icon 22,
  the name under each (`.mnav-label`, dark backdrop so it reads over the white sheet, current item cyan); the arc is
  wider and flatter so the names fit (see the MobileNav row). Links lost `aria-label` / `title`: the visible name is
  the accessible name. Then "per tablet va bene. Da mobile riduci solo le icone, una via di mezzo tra prima e ora": under
  600 px the circles are 40 px with 20 px icons, names unchanged. Checked at 375x812 (40 / 20), 320x640 (min 4 px
  between names), 768x1024 (48 / 22); tapping a name opens the page.
- **Fixed X menu, Print bar, one-page decks, page titles (2026-10-19):** user: "Ha poco senso cambiare i
  tasti che escono nel menù, possono creare confuzione all'utente, teniamo solo la navigazione tra pagine, profilo e ?.
  nella sezione print metti in alto i tasti tolti dal menù e dagli lo stesso stile della searchbar, mentre nei mazzi
  metti tutto in una pagina in ordine: decklist, stats, dilemmas e help. Poi in ogni pagina metti il titolo". Done (phones
  and portrait tablets; desktop unchanged): the X menu always shows Community, Dilemmas, Help, My decks, Print, with `?`
  and profile (`deckNav.js` became `navItems.js`, the deck store `setDeckNav` / `useDeckNav` and `onAction` are gone,
  `IconNavDeck` / `IconNavStats` removed, Tabler dropped from Credits). Print: `.print-top` with `[ PRINT ]` and three
  icon buttons (Add cards, Settings, Export) in the deck search bar style. Deck editor and Community deck: no tabs, the
  page is cards, Stats + Sample hand (`DeckSections tab="all"`), Dilemmas, Help (`.deck-part`, 48 px apart, scroll margin
  under the sticky top bar); `#/decks/:id/help` and Ask for help from the card menu scroll to Help (`toHelp`);
  `DeckDilemmas` / `DeckHelps` open the draft when `ask` changes while mounted (previous-render pattern, `lastAsk`). Titles
  `[ COMMUNITY ]`, `[ DILEMMAS ]`, `[ HELP ]`, `[ MY DECKS ]` (DeckList), `[ PROFILE ]`, `[ PRINT ]` (Settings already had
  one; a deck page keeps its name in the hero). Help texts and tours follow (deck tour scrolls to each section; Print
  tour taps the top bar). Checked at 375x812 (menu 5 items with My decks lit in a deck, Print bar and Settings / Add,
  deck page order and Help scroll, profile title, deck and Print tours), 1440x900 (deck tabs and Stats as before); lint
  and build.
- **X menu taps fixed (2026-10-19):** user: "Ho provato da mobile, non funziona il cambio di pagina.
  Nessun pulsante. Funziona solo se tengo premuto e apro un'altra scheda". Cause: a menu link changed the hash, then
  the menu closed and `useBackClose` did `history.go(-1)`, back to the page before. Links now `preventDefault` and
  call `navigate()` (the new page replaces the menu's entry, like the avatar menu to Profile); page actions (Add
  cards, Settings, Export) wait until the menu's entry is gone (`closingBack()` then `popstate`), otherwise the go(-1)
  removed the overlay's entry and Back left the page. The tour demo menus block the link default. Checked at
  375x812: Dilemmas and Print from the list, My decks from a deck, Stats tab, Settings and Add sheet (Back closes
  them and stays on Print), Back after a menu link returns to the previous page; build.
- **Print actions in the X menu, no Save list / Delete all (2026-10-19):** user: "sulla parte
  descktop si sono spostati profilo e ? poi togli la barra in alto nella schermata print e integra i seguenti
  pulsanti nel menù nuovo: aggiungi carte, settings ed export. Rimuovi la possibilità di salvare le liste di stampa
  ... e il delete all (teniamo solo la selezione multipla e il menù con pressione prolungata per cancellare). Le icone
  relative alla parte decks non farle apparire nella pagina print tranne my decks". Done: the desktop `.header-slot`
  rule (dropped with the mobile header) is back, so `?` and avatar sit at the right of the header again. On phones the
  print action bar is gone; the X menu on `/print` = Add cards, Settings, Export, My decks (`PRINT_PAGE` in deckNav,
  `onAction` in MobileNav, Fluent icons `add-20-filled`, `options-20-filled`, `document-pdf-20-filled`). Save list and
  Delete all removed on phone and desktop: App lost `handleSaveProject`, `handleClearAll`, its `confirm` state and
  both `ConfirmDialog`s, `buildDeckList` (scryfall.js, and its selfcheck) went with Save list; CSS lost `.cards-toolbar`, `.ct-*`, `.fab`, `.export-row`; `IconSliders` gone. Help texts
  and the Print tour follow (phone steps open the X; the Export step only shows Generate PDF). Add sheet now covers
  the X (z-index 75) and fades without translate (the translate made the print page scroll 10 px). Checked at
  375x812 (menu items, Add sheet, Settings and Export pages, `?` text, tour 6 steps), 768x1024, 1440x900 (header
  right, sidebar Add cards + Generate PDF, tour Export step); lint and build.
- **X menu on phones and tablets (2026-10-19):** user, with the Figma frame "Proxodon" 57:116: "proviamo a
  farlo così, le icone le ho prese da iconify ... Per lo stile dello sfondo delle icone usa lo stesso del ?. Poi sposta
  Profilo e ? in basso, il primo a destra e il secondo a sinistra ... Sempre visibile il logo X come button, quando lo si
  preme fa la sua animazione della X e appaiono i button delle tab, profilo e ?. Premendolo nuovamente effetto inverso.
  Nelle pagine deck sposta in alto cerca e numero carte, la barra di ricerca lasciala visibile senza tasto per aprirla".
  Answers to my questions: in a deck the menu shows the deck tabs; Print becomes an item of the menu; the Print page
  changes too; icons as in the frame. Done: new `MobileNav.jsx` and `deckNav.js` (see the file map); the mobile header
  is gone (`MobileLayout`), the print action bar moved to the top; deck pages have `DeckTopBar` (search always open,
  count, Back to top) and no more `DeckTabs` / `DeckBottomBar` / the search `MobilePage` (Advanced search still opens
  one); the list pages lost their phone tabs; in a deck the menu also has the way back to the list (My decks or
  Community), since nothing else on screen leads there. Icons: the glyphs of the Iconify icons named in the frame
  (`fluent:people-community-20-filled`, `akar-icons:chat-question`, `famicons:help-buoy-sharp`, `basil:box-solid`)
  plus `tabler:cards-filled` (Deck), `fluent:data-bar-vertical-20-filled` (Stats), `fluent:print-20-filled` (Print),
  inline in icons.jsx (`IconNav*`, currentColor); the frame's SVGs carry their own dark circle, replaced by the `?` style
  as asked. Basil is CC BY 4.0: credited in Credits (Iconify line). Dilemmas Play moved above the menu (104 px), lists
  and deck body leave the bottom free. Tours: `DemoNav` (a `NavMenu` copy, `api.nav`) in the list and deck stages; the
  mobile tab steps open the X and tap the item, the search steps use the top bar like desktop; Print tour has the
  toolbar on top and a closed menu; the tour focus returns to `.mnav .help-btn`. The unpublished trapezoid phone tabs
  (`FitTabs`) were dropped; `TabLabel` and `useBracketSlide.js` are gone (nothing used them). Checked at 375x812: list
  (closed menu as the frame, open arc of 5 with `?` and avatar, Dilemmas navigates and closes), deck (top bar with search
  and 100 MAIN, suggestions over the cards, menu My decks / Deck / Stats / Dilemmas / Help / Print, Stats switches,
  Advanced search page opens and closes; I typed and cleared a query, nothing added), Print (toolbar on top, Print lit,
  `?` panel above the menu, avatar menu inside the screen, Esc closes one layer at a time), tours (list step 1 with the
  open menu, editor Stats step opens the X and switches); 768x1024 (same, Play above the avatar row); 1440x900 desktop
  unchanged (header, bands, count, no menu); lint and build.
- **Light index for the Community feed (2026-10-19):** the rest of review H4. Firestore rules cannot
  check the card rows of a public copy one by one (no loops; `List.join`, tried on the emulator, refuses maps), so a
  copy could still weigh up to 1 MiB and the Community read 60 whole copies per visit. Now each public deck also has
  `publicIndex/{id}` (same id): `uid, name, format, owner, tags, words, ci` (identity as "WUG"), `art` (cover URL),
  `names` (card names outside the maybeboard, one per line, for Contains card), `createdAt, changedAt`. Rules
  (`validIndex`): `hasOnly`, every field capped (`words` by `join(' ').size() <= 4400`, which also rejects non-scalar
  values; `names` 16000 chars), created only by the owner of the full copy (`ownCopy`, `getAfter`) while the private
  deck is public (`stillPublic`), `createdAt` never moved later, list only with `limit <= 60` or by own `uid`. The
  same `join` cap now also bounds `words` of the full copies. Client (`deckStore.js`): `publish` writes the copy,
  then the index entry (`indexFields` from deckModel); `unpublishDeck` deletes it; `claimNickname` re-signs it;
  `deleteUserData` deletes the account's entries; a permission-denied on the index is ignored, so the app keeps
  working before the rules are published. `listenCommunity` reads the index (`cleanIndex` entries, which carry
  `ci` / `art` / `names` instead of rows: `DeckTile` and `deckMatches` use them) and falls back to the full copies
  when, at the first query of the session, the index is empty or not readable. Migration: `ensureIndexed`, called
  by My decks, writes the missing entry for each public deck once per session; decks of players who never reopen
  the app stay out of the index (and so out of the Community once it is not empty). Checked: emulator harness 125
  ok (19 new index cases plus a client-shaped publish that builds the entry with the real `indexFields` and reads it
  back through `cleanIndex`), deckModel self-check cases for `indexFields`, `cleanIndex` and the filters on an entry,
  Community / My decks / Profile at 1440x900 and 375x812 with the current (old) rules: legacy mode, 10 tiles with
  art and pips, no console errors. Rules published by the user the same day; both accounts opened My decks once
  (blazedfoot 5, tommiconlai 10: 15 entries, none missing) and the Community, checked from each account at 1440x900 and
  375x812, reads the index (entries with `names`, no rows): word search, Contains card and color filters work on the
  entries, a tile opens the full copy.
- **MPC import says how many cards it skipped (2026-10-19):** review L9. `parseMpcXml` dropped cards
  whose id is not a Google Drive file id without a word ("110 cards found" for 120). It now returns `skipped` and
  the window adds "N skipped: not a Google Drive image."; a file with none left says "No Google Drive images in
  this file." Checked in the browser: 1 good + 2 bad ids gives 1 card, 2 skipped.
- **Export deck: failed Copy or Download say so (2026-10-19):** review L11, part. In
  `ExportDeckDialog` a blocked clipboard or a failed download did nothing visible. Now a hint under the text (role
  alert) says "The browser blocked copying. Select the text above and copy it." or "Download failed (...). Copy the
  text instead." Checked with a rejecting `clipboard.writeText` on a real deck's Export (nothing written). Still
  open from L11: counters that fail show 0, Scryfall down looks like no results in CardSearch, "We sent a link"
  shown even if the verification email failed.
- **Print deck runs once at a time; PNGs skip the CMYK read (2026-10-19):** review L23. `handlePrintDeck`
  had no guard, so a double click downloaded the images twice and replaced the queue twice: a `printingDeck` ref
  now ignores a second start until the first ends (`finally`). `addItems` read every added file whole to look for
  a CMYK JPEG; it now reads the first two bytes and goes on only for a JPEG (FF D8). Checked: adding 3 Scryfall
  PNGs still works with no errors; the double click was not reproduced in the UI (one-line guard).
- **Import windows reopen clean (2026-10-19):** review L21. The Scryfall and MPCFill import windows stay
  mounted, so after an import, closing and reopening showed the old "N images imported / Done". Their `close` (also
  used by Esc, Back and the Done button) now clears the result and the error; the MPC one also forgets the file when
  an import was done (the pasted Scryfall list stays, it is a draft). Checked: imported "2 Sol Ring / 1 Xenagos"
  (3 images), Done, reopened: the button says Import again. The user's saved list draft was restored after the test.
- **Save list counts copies (2026-10-19):** review L16. `buildDeckList` returned `cards` = the number of
  distinct lines, so "Saved 2 Scryfall cards" for 2 Sol Ring + 1 Birgi, while `custom` counted copies. `cards` is
  now the sum of the quantities (3 there); the self-check case says so.
- **Print pipeline: clear errors, WASM freed on failure (2026-10-19):** review L13 and L22.
  `loadBundledProfileBytes` did not check `res.ok`, so a 404 page became the "profile" and lcms failed later with
  an obscure error; it now throws "Could not load the <profile> profile (status)...". `upscaleFile` turned a null
  `toBlob` (out of memory) into a file containing "null"; it now throws, and frees its canvas. `cmykEngine`
  memoized the instantiated WASM only after `await`, so two parallel calls instantiated it twice; it now keeps the
  promise (cleared on failure). `buildCmykPdfBytes` closed the lcms converter only at the end and on cancel; the
  page loop is now in `try / finally`, so an unreadable image also frees it. Checked in the browser: normal
  export, cancelled export (AbortError), broken file ("Cannot load x.png"), then a normal export again.
- **Icon buttons with title, named confirm, quiet sync status (2026-10-19):** review L25. 28 icon-only
  buttons had `aria-label` but no `title` (account avatar, deck help ? and its close, the row - / + and the section
  rename / delete in DeckSections, every modal close, the print page ? and error dismiss, the phone toolbar Delete /
  Add / Save, Remove ICC profile, Add in Advanced search): `title` now repeats the `aria-label` (codemod with
  `@babel/parser`; buttons with visible text or a card image left alone). `ConfirmDialog` takes its accessible name
  from the message (`aria-labelledby` + `useId`). The deck editor's sync label had `role="status"`, so screen
  readers heard "Saved N minutes ago" every time the clock ticked: the visible label lost the role and a
  `.sr-only` status announces only the state (Saving..., Saved, Offline...). Checked at 1440x900 and 375x812: the
  label still reads "Saved 2 days ago" in place, the live region says "Saved", the avatar shows "Account:
  blazedfoot" on hover.
- **Help texts no longer promise deck-link import (2026-10-19):** review L20. The import from a deck
  link was removed long ago, but the print page help (`App.jsx`), the phone help (`MobileLayout.jsx`) and two
  steps of the print tour (`PrintTour.jsx`) still said "a card list or a deck link". They now say "a card list".
- **Letter and Legal at their exact size (2026-10-19):** review L17. `PAPER_FORMATS` had Letter
  216x279 and Legal 216x356 mm; now 215.9x279.4 and 215.9x355.6 (8.5x11 and 8.5x14 in), so the PDF pages are
  exactly 612x792 and 612x1008 pt. The sheet menu shows the new numbers; the grids do not change (Letter 4x2,
  Legal 5x2 landscape with 63x88 and 2 mm bleed, checked in Node).
- **Tutorial type lines without mojibake (2026-10-19):** review L3. 11 type lines in
  `src/tutorial/demo.js` had "â€”" (the Scryfall dash read as Windows-1252) and the tour showed it. Replaced with
  the backslash-u2014 escape in the source (the project never writes the glyph itself), so the demo cards read like
  real Scryfall snapshots. Checked in Node: `C.tatyova.type` contains the dash and no "â" is left in the file.
  Note: the change landed in commit e08acb7, which by mistake carries the commit message of the M28 hover fix (a
  shell chain went on after a failed step); this entry and its commit set the record straight, history was not
  rewritten.
- **Hovering deck rows no longer re-renders the whole deck (2026-10-19):** review M28, partly. The
  hover preview was state of `DeckSections`, so every mouse enter / leave re-rendered every row and re-ran the
  no-deps layout effect of the frames (O(n²) over the rows). The preview now lives in `HoverLayer`, fed by a
  small per-instance store (`hoverStore`, read with `useSyncExternalStore`; `setHover` keeps its callers; the
  scroll-hides-it effect moved there). Measured on a 100-row deck (dev build): about 6.4 ms of work per hover
  before, about 1 ms after; preview shown on 20 of 20 hovers and gone on leave. Not done: `memo` on the rows and
  deps / per-column map for the frame effect (0.4 ms per run at 100 rows, it still runs on real re-renders).
- **Overlay focus and Esc: top layer only, focus stays in the new dialog, back to the opener (most recent,
  2026-10-19):** review M25, M26, M27, all in `useOverlayDismiss`. M25: every open overlay listened for Escape on
  the document, so one Esc closed all of them (card zoom inside the phone search); a module `layers` stack now lets
  only the top one close. M26: menu, then Rename or Delete: the dialog's `autoFocus` ran in the commit, then the
  closing menu gave focus back to the tile behind, and Enter opened the deck under the confirm; a layout effect
  now remembers the element an internal `autoFocus` focused (`mountFocus`, kept while open so the dev
  StrictMode re-run does not lose it) and the effect puts the focus back there. M27: `opener` was read once at
  mount, so an always-mounted `ConfirmDialog` returned focus to whatever had it at page load (the body); it is
  now taken at each activation (state adjusted during render when `active` flips on). Checked on My decks by
  keyboard, cancelling only: tile menu, Rename = focus in the name field, Delete = focus on Cancel, Esc = focus
  back on the tile, deck untouched. M25 not reproduced in the UI.
- **Play skips a deck that did not load; deckOnce retries failures (2026-10-19):** review M24.
  `deckOnce` cached the failed promise for the session, and Play showed a spinner with no way out for a dilemma
  whose deck could not be read. Now a failure is not cached (the next call retries), the Dilemmas feed stores it
  as `false` (feed shows "…", Play skips that dilemma like a deck gone private) and retries at the next update of
  the list. Checked: feed shows 5 dilemmas with deck names, Play opens a dilemma, no console errors.
- **No orphan history entries from menus and stacked overlays (2026-10-19):** review M23. Each open
  overlay pushes a history entry (`useBackClose`) and removes it on close only if it is still the current one.
  Two leaks: (1) a menu item that navigates (account menu Profile / Settings, New deck then the editor, Print deck)
  pushed the new page above the menu's entry, which stayed orphaned, so Back had to be pressed twice; (2) two
  overlays closing in the same commit called `history.back()` twice in a row, which browsers can merge into one.
  Now `navigate` replaces the overlay's entry when one is on top (`replaceRoute(path, null)`: a null state gets
  the next `idx` from the hashchange listener), and `useBackClose` collects the entries still above the page (its
  id or a higher one is current) and removes them with one `history.go(-n)` on the next tick (`pending`;
  `closingBack()` also counts it, so `goBack` waits). Checked: account menu then Profile adds one entry and one
  Back returns to `#/decks`; Esc on the menu still removes its entry. The two-overlays case was not reproduced in
  the UI.
- **Esc closes the card menu before the selection (2026-10-19):** review M22. With cards selected,
  the deck area's Escape handler cleared the selection and stopped the event, so the open card menu stayed (two
  Esc, the first one doing the wrong thing). The handler now skips while `menu` is open: the first Esc closes the
  menu (focus back on the row), the second clears the selection. Checked by keyboard on a real deck (no data
  touched): two rows selected, Shift+F10 menu "2 cards selected", Esc closes it with 2 still selected, Esc again
  clears them.
- **Back no longer loops into a deleted deck (2026-10-19):** review M21. When the open deck was
  deleted elsewhere, DeckEditor called `navigate('/decks')`, which pushes an entry: Back (also Android's) went into
  the dead deck, which bounced to `/decks` again, forever. New `replaceRoute(path)` in `useHashRoute.js`
  (`history.replaceState` keeping `idx`, then a manual `hashchange`) is used there instead. Checked: from
  `#/print`, opening `#/decks/<missing id>` lands on `#/decks` with one history entry, Back goes to `#/print`.
- **AI upscale retries a failed model load (2026-10-19):** review M20. `getUpscaler` memoized the
  load promise even when it rejected (chunk or weights not reachable), so every later Upscale 2x failed until a
  reload. A `.catch` now clears `upscalerP` and rethrows. Pattern checked in Node (second call loads again).
- **PDF export frees each card's canvas at once (2026-10-19):** review M19 ([U], cheap). Both
  generators drew every card on a new canvas and left it to the garbage collector; iOS caps total canvas memory, so
  a 100+ card export could fail. `compressImage` (RGB) and `renderCellRGBA` (CMYK) now set `canvas.width =
  canvas.height = 0` right after `toDataURL` / `getImageData` (the data is a copy). Checked a CMYK export in the
  browser; the RGB path was not run (it downloads a file); no iOS device here.
- **Downloads keep their blob URL for 60 s (2026-10-19):** review M18 ([U] in the report, cheap).
  `saveFile` revoked the object URL right after `a.click()`; Firefox and Safari may read the blob after the click,
  so a big PDF could be cut. The revoke now runs after 60 s. Not reproducible here (Chromium pane).
- **Import caps: 1000 copies, MPC files up to 5 MB (2026-10-19):** review M17. Lines were capped
  (1000) but not copies: "999 Island" on many lines, or an MPC XML with 1000 cards of 99 slots, meant tens of
  thousands of `File`s and object URLs and a frozen tab; the XML size had no cap. Now `fetchScryfallImages` throws
  "Import at most 1000 cards at a time (this list has N)." (`MAX_COPIES`; covers the Scryfall import and Print
  deck), `parseMpcXml` counts copies (slots) instead of lines for its 1000 limit, and `MpcImportModal` refuses
  files over 5 MB before parsing. Checked in the browser: "999 Island / 2 Forest" gives the error, an XML of 20
  cards x 60 slots too, a 4-slot card still parses to 4.
- **Import requests time out after 30 s (2026-10-19):** review M16, partly. No fetch of the import
  paths had a timeout, so with a stalled network the Scryfall / MPC / Change art windows spun forever (and their
  Close is disabled while busy). New `timeoutSignal(signal?)` in `utils/scryfall.js`: `AbortSignal.timeout(30000)`,
  joined with the caller's signal via `AbortSignal.any` where it exists (Safari < 17.4: the caller's signal only).
  Used by `scryfallFetch` (a `TimeoutError` is retried like a network error, then "Could not reach Scryfall..."),
  `fetchPrints`, `downloadAsFile`, the image downloads of `fetchScryfallImages` and `fetchMpcImages`. Not done:
  Close that cancels a running import (needs an AbortController through each pipeline). Checked in the browser: a
  real import of "2 Xenagos, God of Revels / 1 Sol Ring" (3 files, also H3 end to end) and `fetchPrints` work; with
  a fetch that never answers, `downloadAsFile` fails with `TimeoutError` after 30 s; aborting the caller's signal
  aborts the joined one.
- **Arena "Companion" section imports into the sideboard (2026-10-19):** review M15. `parseDeckText`
  did not know the `Companion` header of MTG Arena exports: the line became a card named "Companion" (not found)
  and, still under `Commander`, the companion became a second commander. `HEADERS` maps `companion(s)` to the side,
  where Arena keeps it. Self-check case added (`node src/decks/deckModel.selfcheck.js`).
- **CMYK export embeds each card once (2026-10-19):** review M14. Every copy in the print queue was
  converted with lcms and embedded again (30 Forest = 30 CMYK streams). `buildCmykPdfBytes` keeps an `embedded` map
  keyed by bleed mode + SHA-1 of the file bytes (copies are separate `File` objects over the same blob, and the
  bytes are read anyway to spot native CMYK JPEGs) and reuses the image XObject. Checked in the browser: 9 copies
  of one PNG + 1 other on A4 give 2 image XObjects (was 10).
- **CMYK PDF/X-1a gets a file ID (2026-10-19):** review M13, half of it. PDF/X wants an `/ID` array
  in the trailer and pdf-lib writes none: `buildCmykPdfBytes` now sets `doc.context.trailerInfo.ID` to two copies of
  a random 16-byte hex string. The other half of the finding was wrong: `GTS_PDFXConformance` belongs to the 2001
  versions only (CGATS registry); for PDF/X-1a:2003 `GTS_PDFXVersion (PDF/X-1a:2003)`, which we already write, is
  the key. Checked with a real export in the browser (one PNG, FOGRA39, A4): `%PDF-1.4`, trailer `/ID [ <...>
  <...> ]`, `GTS_PDFXVersion` present.
- **Delete account: a failure after the data is gone says so (2026-10-19):** review M12.
  `deleteAccount` deletes the data first, then the Auth user; an error there (Google window closed during the
  re-authentication, network) reached the toast raw ("Firebase: Error (auth/popup-closed-by-user)."). Every error
  after `deleteData` now becomes "Your decks were deleted, but the account was not: <authMessage> Try Delete account
  again." (`dataGone`); `AUTH_MESSAGES` maps `auth/popup-closed-by-user` / `auth/cancelled-popup-request` to "The
  Google window was closed." (sign-in still ignores those two codes). Not run (destructive on the real account).
- **Restore says how many rows it left out (2026-10-19):** review M11 (partly as reported: decks are
  never dropped, a broken one becomes an empty "Untitled deck"; rows are). `fromBackup` drops rows that do not
  validate or pass the 500 per deck, and Settings said "Restored N decks" anyway. `SettingsPage.restore` now counts
  rows in the file minus rows restored and the toast becomes "Restored N decks. M rows could not be read and were
  left out" (error style). Checked the count in Node (a deck with 1 good and 2 broken rows plus a null deck: 2
  decks, 2 rows left out); not run on the real account (it would add decks).
- **Failed listeners show a message instead of spinning forever (2026-10-19):** review M10. A
  Firestore listener that errors (rules, quota) never delivers data again, and My decks, the profile and the deck
  editor kept their loader forever. Now: My decks shows `Empty` "Could not load your decks" + the error (like the
  Community tab already did; the old toast is gone); the profile shows the same in its Decks section and hides the
  dilemmas loader; `useDeck` sets `deck` to `false` when the listener fails before the first snapshot, and
  DeckEditor shows "Could not load this deck." with an icon-only All decks button (the reason is in the
  `syncError` toast). `useAccount` keeps the last known profile on a listener error instead of nulling it: a
  null profile made the nickname look empty and the next claim started from `old = ''` (the rules now refuse
  that anyway, M1 / `nickFreed`). Retry = come back to the page (a new listener). Checked My decks and Profile
  load normally (no loaders left, no console errors); the error states were not forced on the real account.
- **Card language cache keeps only real "not in this language" answers (2026-10-19):** review M9.
  `localizedCard` returned null for any error, and `useCardImg` stored null as "" in `ip:locimg:v2`: one 429 /
  5xx / network hiccup meant English images for that print forever. Now null only for a 404 (or a print without
  scan); other errors return `undefined`, drop the in-memory promise (`LOC.delete`) so the next call retries, and
  `cardLang` does not cache them (English for now). The print import (`fetchScryfallImages`) already fell back to
  English on a falsy result. Checked in Node with a fake `fetch`: 503 gives undefined then a retry finds the card,
  404 gives null and is not fetched again.
- **Deck import says what it left out (2026-10-19):** review M8. `addEntries` drops rows past
  `MAX_ROWS` (500) and `clampQty` cuts quantities past `MAX_QTY` (99, also after merging the same print), but the
  toast still said "Deck imported". `NewDeckDialog` now counts the copies that did not land (copies asked minus
  copies in the new deck) and passes them as `onCreate(deck, notFound, left)`; DeckList's toast becomes "Imported.
  [Not found: ....] N copies left out (at most 500 rows and 99 copies per row)." (error style), else "Deck imported".
  Checked the count in Node (510 rows + 150 copies of one card: 500 rows, 62 copies left out); the toast was not
  run on the real account (it would create a deck).
- **Sign out asks before dropping unsynced changes (2026-10-19):** review M7. Sign out marks the
  Firestore cache for clearing at the next start and, once signed out, the server rejects queued writes anyway:
  deck edits made offline were lost without a word. `writesSynced(ms = 4000)` in `firebase.js` races
  `waitForPendingWrites(db)` against a 4 s timeout; the account menu's Sign out calls it and signs out at once when
  everything reached the server, otherwise a `ConfirmDialog` says "Some changes are not synced yet (no
  connection?). Signing out now loses them. Sign out anyway?" (Cancel keeps the session). Checked online:
  `writesSynced()` resolves true in 1 ms; the offline branch was not run on the real account.
- **Make private / Delete cannot be undone by a late publish (2026-10-19):** review M2. `saveDeck` of a
  public deck writes the private deck, then (after the server accepts it) the Community copy. Make private or Delete
  in between (a save still in flight, or both queued offline) wrote the `{ uid }` placeholder first and the late
  `publish` then rewrote the full copy over it: the deck was back in the Community while private. Fixed in the
  rules, so it also holds offline: a full public copy (create or update, not the placeholder) needs
  `users/{uid}/decks/{id}.public == true` (`stillPublic`, one `get`). Writes go to the server in order, so the
  normal flows (New deck with Public, Share in Community, the editor's Public switch, a nickname change re-signing
  the copies) always find the private deck public first. In the race the late publish is rejected and the editor
  shows "Community copy not updated: ..." once. No client change. Emulator: 4 new cases (105 ok). To publish with
  the same `firestore.rules`.
- **No white page without localStorage, root error boundary (2026-10-19):** review M6. `App.jsx` read
  and wrote its print settings with bare `localStorage` (also `CookieBanner`, `ScryfallImportModal`): with storage
  blocked (some private modes, disabled site data) or full, the first call threw during render and the page stayed
  white. New `lsGet(k)` / `lsSet(k, v)` in `utils/settings.js` (null on read, no-op on write when storage throws)
  replace every bare call in those three files (`cardLang`, `firebase.js`, `settings` already had try / catch).
  `main.jsx` wraps `<App>` in the existing `ErrorBoundary` with `message` "Something went wrong. Reload the page:
  your settings are kept."; the boundary got an optional `message` prop and its Retry is now icon-only
  (`IconReplay`, `aria-label` / `title` Retry). Checked: print page renders at 1440x900 and 375x812, no console
  errors; with `Storage.prototype.getItem` / `setItem` throwing, `lsGet` gives null, `lsSet` does nothing and the
  settings module still loads.
- **Rules round: card and field checks, createdAt, nickname hoarding, dilemma votes in chunks (2026-10-19):**
  review H4, M1, M3, M4, L5 (plus the H1 deck rule of the previous entry). One `firestore.rules` to publish by hand,
  tested on the Firestore emulator (harness in the review session's scratchpad `rulestest`: 101 ok; the rules before
  this round fail the 24 new negative cases). What changed:
  - **H4 (partly):** dilemma, help request and reply cards are checked one by one (rules have no loops: `cards(l,
    max)` checks positions 0..9; `card(c)` = exactly 7 keys and `name + img + back + sid + oid + set + cn` under 1400
    chars, so every field is a string; a check per field went over the 1000-expression limit with 10 + 10 reply
    cards). Help `cards` are checked only on create (later updates touch status / applied / seenAt). Public copies
    also check `groupBy`, `cover` (oid or null), `sig`, `public`, `updatedAt` / `changedAt` and each tag (up to 10,
    40 chars). Private decks get `validDeck`: `hasOnly` of the fields the client has ever written (checked against
    git history and the account's 6 decks), short name, format, `ver`, `base`, folder. Help `applied` grows by at
    most one key of 100 chars (`removeAll` of the old list). **Still open:** the rows (500), sections and `words` of
    a public copy have no per-element check, so a public copy can still weigh up to 1 MiB and the Community reads 60
    of them: the real fix is a light index document for the feeds.
  - **M1:** `users/{uid}` can be deleted only when its nickname is already free in the same write (or there is no
    profile / no nickname); `deleteUserData` already deletes both in one batch. Before, delete profile + create one
    with a new nickname kept the old `usernames` doc, so an account could sign with several names.
  - **M3:** on update of a public copy `createdAt` can stay or move earlier, never later (it kept a deck on top of
    the Community). The client sends the private deck's `createdAt`, which is a moment older than the copy's.
    Edge: editing a just-created public deck while its `createdAt` is still a local estimate, on a phone whose
    clock runs ahead, gives one "Community copy not updated" toast; the next save fixes it. Retiring and
    republishing a copy can still move it (the placeholder `{ uid }` keeps no date).
  - **M4:** `deleteDilemma` deletes votes in batches of 400 and the dilemma last (one batch of all votes failed past
    500 votes, and with it Make private, Delete deck and Delete account). Emulator case with 450 votes.
  - **L5 (partly):** dilemmas and help requests only on a non-retired copy (`'cards' in`); reserved nicknames
    (`admin`, `administrator`, `proxodon`, `proxoteca`, `moderator`, `support`, `staff`, `official`, `system`), also in
    `claimNickname` so the profile says "This nickname is taken.". Not done: signatures that stay after a nickname is
    freed, uids of likes / votes listable (needed by the counts).
  **Publish:** the whole `firestore.rules` in the console (Firestore, Rules, replace all). No client change depends on
  it: the clients of this round work with the old rules too.
- **Deck saves: a queued write can no longer overwrite another device, rejections after closing show (2026-10-19):**
  review H1 + H2. H1: the rules only checked `rev == saved + 1`, so with two saves queued on an offline phone
  (rev r+1, r+2) and the PC saving r+1 first, the phone's first write was rejected and the second (r+2) passed,
  overwriting the PC's cards (reproduced on the emulator with the SDK: `disableNetwork`, two `setDoc`, PC save,
  `enableNetwork`, the PC's version lost). Fix: `saveDeck(uid, deck, ver = rid())` also writes `ver` (new on each
  save) and `base` (the `ver` of the deck it was built on, null for decks saved before); `useDeck.write` advances its
  local copy with that `ver`. The deck update rule adds: `ver` unchanged (folders with `increment`, the old Android
  build) or `base` == the saved `ver`. So the whole queue falls after the first rejected write (the second's `base`
  is a version the server never had), and offline edits still queue in the cache (holding back the second write
  until the first is confirmed would have lost offline edits on close). On a rejection (`permission-denied`, not
  from the Community copy: `publish` errors get `e.publish = true`) `useDeck` clears the timer and goes back to the
  last snapshot (`snap` ref), so a stale chain does not keep writing. H2: `useDeck(uid, id, onError)` sends read and
  save errors to `onError` (DeckEditor's `syncError`, built on the app-level `notify`), so the save done on close
  (flush) still shows "This deck changed on another device or tab..." after the editor unmounted; Community copy
  errors say "Community copy not updated: ...". DeckEditor's `error` effect is gone, the sync label is unchanged
  (`saving` = waiting edit or pending write). Limit: a write queued offline and sent by the SDK after an app restart
  has no promise, so its rejection stays silent. **Rules:** `firestore.rules` changed (deck update), to be
  published in the console with the rules round of the same day; the client works under both the old and new
  rules (without the new ones H1 is not closed yet). Emulator harness: 10 new deck cases plus the SDK scenario (68
  ok; the old rules fail 5 of them, the SDK one with `saved=phone2`). Checked the editor opens with no console
  errors ("Saved 20 hours ago").
- **Import: card names starting with X (2026-10-19):** review H3. `parseCardList`
  (`src/utils/scryfall.js`) read "2 Xenagos, God of Revels" as qty 2 "enagos, God of Revels": the "2x" form took
  the X of the name because the regex allowed zero spaces after the x. Now the x needs a space after it ("2x Sol
  Ring", "2 x Sol Ring" still work; "2xSol Ring" no longer does, no export writes it). Fixes print import, deck import
  (`parseDeckText`) and Print deck. Self-check: new case with Xenagos / Xathrid (`node src/utils/scryfall.selfcheck.js`).
- **No cyan bars in the search row (2026-10-19):** user: "togli le due barrette azzurre tra la barra di
  ricerca e i filtri, in tutte le tab". The `.decks-search-box::after` with `glow-cyan-left/right.svg` is gone (the
  two SVGs deleted, nothing else used them); same row in Community, Dilemmas, Help, My decks and the tour. Checked
  the four tabs at desktop (`::after` content none) and 375x812.
- **Loaders are the logo X (2026-10-19):** user: "in tutti gli eventuali caricamenti metti il logo, solo
  la X, che compie l'animazione di flip già presente con l'aggiunta del flip del pezzo centrale". CSS only, in
  `index.css` where `.import-spinner` was: `.import-spinner` and `.spinner` (every loader in the app, ~30 call sites,
  untouched) draw the X with two layers, `::before` = the cyan centre, `::after` = the magenta V's, as data-URI SVGs
  of `WORDMARK_X_CORE` / `WORDMARK_X_V` (viewBox `42 0 31 31`, like `Wordmark mark`). Loop of 2 s: the V's flip
  (rotateY 180, the wordmark hover), then the centre, then the V's again, then the centre, ending at 360 so it
  restarts seamlessly (`x-v-flip`, `x-core-flip`; old `spin` keyframes removed). With `aria-label` or
  `role=status` (page and list loaders) it is 52 px, centred, with a cyan glow; in buttons, status lines and the
  toast 16 px (`.btn-generate .spinner` 18). `.spinner` outside the PDF button had no style before (sign-in, import
  modals, new deck): now it shows. Reduce motion (OS or Settings): still X. Checked in the dev pane with a test
  box (big and in a button; `::before` / `::after` transforms alternate as planned; `html.reduce-motion` = none).
- **Profile hero like the deck tiles (2026-10-19):** user: "adatta la testata del profilo come le card
  mazzi". See the `ProfilePage.jsx` row: `CutFrame` panel (measured), avatar in a corner pocket, round Change
  background in the top-right pocket (the hover chip and the banner-as-button are gone), Member since as the
  callout with the cyan dot, name and stats over the veiled background. `CutFrame`'s mask cache now clears past 200
  entries (one per hero size while resizing). Checked at 1440x900 and in the ~1260 px pane (pockets, viewBox =
  1207x280) and 375x812 (`.small`, 2-column stats, nickname form inside the panel, Esc closes it, no horizontal
  scroll).
- **Dilemma and help tiles as big as the deck tiles (2026-10-19):** user: "adatta le card dilemma e
  help nella stessa grandezza di quelle deck, così da avere un feed uguale per ogni pagina". `.dilemma-list` and
  `.help-list` use the `.deck-grid` rules (flex wrap centred, 209 px items at 20 px gaps, two per row under 560 px);
  `.dilemma-tile` / `.help-card` are 209x208 containers (`--u = 100cqi / 209`) with the art panel (`.dilemma-split` /
  `.help-card-art`, CutFrame 209x208) filling them and a dark veil; the question (or the request text, its cards)
  and the meta moved inside at the bottom (`.dilemma-tile-body`, padding right for the arrow pocket), question and
  text Chakra Petch 600 13 units, 3 lines (phones: at least 12 px), meta mono 8.5 (at least 10). The help kind pill
  moved to the top-left under the count pocket; the + of the deck's Dilemmas / Help tabs and the profile's See all
  are the same square, dashed. Checked at 1440x900 (Dilemmas and Help feeds, Dina's Dilemmas tab with the +, its
  Help tab: all 209x208) and 375x812 (two per row, no overflow).
- **Deck, dilemma and help tiles with corner pockets (2026-10-19):** user, with a picture of a "GLITCH"
  fashion card (black panel with cut-out corners holding pills and round buttons, product callouts, white pills):
  "Le card mazzi, dilemmi e help puoi cambiarli prendendo spunto da questa immagine?", tried locally first, then
  "Togli il long dash di fianco al nome del formato e anche il formato scritto con i contorni, mantieni il pallino
  sfocato. Poi fai il push". New `CutFrame.jsx` (see the file map) replaces `tileShape` / the identity notch. Deck
  tile: identity pill top-left, round Export top-right (`exportable`), likes pill bottom-right, art at 80% with a
  dark veil, format in mono caps with the blurred cyan dot (no line, no outlined ghost word), name 17 bold caps,
  tags, by, Updated (phones: small text at least 10 px). Dilemma and help tiles: votes / suggestions pill top-left,
  round arrow bottom-right, New / Voted / Yours / Replied as white or magenta pills, help kind as a pill; the box
  border became the shape's border and the hover glow a drop-shadow. Old `.deck-tile-head`, `.deck-tile-format`,
  `.deck-tile-shape`, `.deck-tile-frame` rules removed. Checked at 1440x900 (My decks, Community, Dilemmas, Help,
  zoomed tiles: pills at 0,0 in their pockets, arrow at the bottom right), 375x812 (tiles 168 px, Export hit area 44,
  no horizontal scroll), lint and build. Follow-up (user: "c'è qualcosa di strano nel contorno dei mazzi con help
  aperti, solo in my decks", screenshot taken with the pointer on the tile): the hover glow is a drop-shadow on the
  tile button, so it wrapped the panel and the pills inside it but not the round Export, a sibling that only My
  decks has; `.deck-tile-wrap:hover .deck-tile-export` now gets the same drop-shadow (the user then said the odd
  outline was only the app's preview pane: fine in the browser on PC and phone). Then: "quando ci sono le icone
  public e help ... mettile in alto a destra, sotto l'icona export ma sempre dentro il contorno e una sopra l'altra
  (prima il public e sotto la chiave inglese)": they sat after a 2-line name, far right at the bottom; now
  `.deck-tile-flags` is a column at 40 / 12 (tile units), icons 14 (at least 12 px). Checked at 1440 (zoom 3: globe
  then wrench under Export, name on one line) and 375x812 (flags at y +32 under the 22 px Export). Then: "togli
  l'icona export, non ha molto senso. al suo posto metti il wrench nei mazzi con help": the Export button next to
  the tiles is gone (My decks and the tour; Export… stays in the tile menu), the top-right pocket exists only on
  decks with an open help request and holds the wrench in a round magenta badge (`.deck-tile-help`, 28 tile units);
  the globe alone stays at 40 / 12. Checked in the Commander pubblici folder at 1440 (Teval, Morcant, Jetmir: no
  pocket, globe; Dina: wrench pocket, globe under it) and 375x812.
- **Delete all dilemmas on the profile (2026-10-19):** user: "metti un pulsante close all accanto alla
  sezione dilemmas nel profilo, facendo un check di conferma per cancellare tutto" (after the console script for the
  28 `[Test]` dilemmas of blazedfoot failed with "Missing or insufficient permissions": run from another account; the
  rules allow the owner's delete of dilemma + votes in one batch, checked on the emulator, 57/57). See the
  `ProfilePage.jsx` row. Checked at 1440x900 (trash 52x36 right of the title, confirm reads 28, focus on Cancel,
  closed with Cancel) and 375x812 (44x44, no horizontal scroll). Nothing was deleted by me: the button is for the user.
- **Back buttons return to the previous page (2026-10-19):** user: "quando termino un dilemma mi apre
  la pagina dilemmas anche se sono sul mio profilo, fai tornare sempre nella pagina precedente. Questo vale per tutti
  gli elementi". The ← of a dilemma opened from a link (`FeedDilemma`), of Play and of a help request page
  (`HelpReply`) called `navigate('/dilemmas')` / `navigate('/help')`; now `goBack('/dilemmas')` / `goBack('/help')`
  (see `useHashRoute.js` in the file map): profile, Dilemmas, Help, a deck's Community page or wherever the link was,
  the fixed page only when the link was opened from outside (first entry of the tab). Labels of those buttons and of
  the in-deck dilemma / help views are now "Back" (also in the tour copies). The in-deck views still close with
  `setOpenId(null)` + `useBackClose`. Delete from a dilemma opened from the profile: the confirm closes (its back),
  then `goBack` runs (waits for `closingBack()`), so it lands one page back, not two. A second click while going back is ignored (`leaving`, reset on
  popstate), so a double click never goes two pages back or out of the app. Checked in the dev pane: double click = one page;
  profile → dilemma → ← = profile; direct link → ← = `#/dilemmas`; Dilemmas → Play → ← = Dilemmas; Help → request
  → ← = Help; card modal closed with Esc and `goBack` in the same task = profile (idx 2 → 1).
- **Drop zones centred, source zone inactive, Remove zone (2026-10-19):** user: "le zone dove posso
  trascinare le carte per spostarle, centrale con la schermata del mazzo (l'area dove posso selezionare) e rendi
  inattivo la zona da cui proviene la carta. Aggiungi anche una zona che rimuove del tutto le carte". The panel moved
  from bottom left (above the count) to bottom centre of the deck area, zones in a row; all zones shown, the source one
  dimmed and not droppable (before, zones already holding every dragged card were hidden, Main always shown); new
  Remove zone (see the file map). Verified with synthetic drag events: on the real deck a drag started and cancelled
  (commander: Main active; an Instants card: Main inactive; panel centre = area centre, 24 px from the bottom; nothing
  dropped); in the tour's in-memory demo deck a drop on Remove took the main count from 43 to 42 and closed the panel.
- **Dialog backdrops full screen again (2026-10-19):** bug from the user: the dark backdrop of New deck
  (and every dialog rendered inside the deck list, profile and settings pages) stopped at the 1240 px column, because
  the column rule `.decks-root:is(.profile-page, .decks-page) > *` (max-width + auto margins) also hit the fixed
  `.modal-overlay`. The rule now skips it (`> :not(.modal-overlay)`); the list band and the 776 px search / filters
  still win (same specificity, later in the file). Checked: New deck backdrop 1440x900 and 375x812.
- **Card highlight flush inside (2026-10-19):** user: "il bordo dell'highlight mettilo a filo interno con la
  carta e in caso di view by grid o stack farlo terminare dove si incontra la carta che sta sopra". On deck cards
  (grid, stacks, split) and dilemma cards the `CardFrame` contour is now inside the card (2 px stroke from the edge
  inward, the card's corner radius 4.75% minus 1 px) instead of 3 px outside; a covered card keeps its full height but
  is clipped at `--frame-h` (`clip-path: inset(-12px -12px calc(100% - var(--frame-h)) -12px)`), so the sides stop
  where the card on top begins and there is no bottom line any more, while the glow still shows above and at the
  sides. The print sheet keeps the 3 px outside contour. Checked at 3x zoom in stacks and grid (selected Counterspell
  ends at Crop Rotation), the user's view (split) restored, selection cleared.
- **List pages restyled from the Figma frame "Proxodon" 52:275 (2026-10-19):** user request "questa è la
  pagina decks adatta questo stile anche alle altre. Le card dei mazzi sono diverse, ma mantieni tutte le informazioni
  messe finora". Done:
  - **Tabs (desktop):** `ListBand` in `DeckTabs.jsx`: the same trapezoid tabs as the deck page (`TabStrip`, now shared
    by `DeckBand` too) as links Community / Dilemmas / Help / My decks, centred 63 px under the header line, on a
    full-width gradient line that steps up near the right edge (design line 992 rotated: a fixed 204 px piece on the
    right + a stretching line, two data-URI backgrounds). The overlap rule is now "closer to the open tab = higher"
    (the deck frame has the first tab open, this one the last). Phone keeps the `[ ]` text tabs.
  - **Search row:** 776 px column; 38 px box, black 25% background, cyan 10% border, radius 10, cyan lens; the two cyan
    bars of the design between it and the icon-only Filters button (removed later on request, see the log) (72x38, magenta count
    badge) or the format select of Dilemmas / Help; Play moved into the row. Filters panel: same box, labels Chakra
    Petch 12, controls 32 px on `#020b0c` with the cyan 25% border, colour symbols 21 px at 30% when off; C and an
    icon-only Clear kept (card input 200 px instead of 223 so it all fits on one line).
  - **Deck cards (My decks, Community, profile, tour):** 209x208 at 20 px gaps (two per row under 560 px): the art at
    50% with a 20 px inner shadow (box 290x212 at -40/-2 as in the design), clipped by the design's shape, with a
    notch at the top centre sized for the identity symbols (9 px, 5 apart; the two variants in the frame, 2 and 3
    colours, give the formula), the gradient border cyan → violet → magenta; name Chakra Petch 15 bold at 12/19,
    format 10 at 70%, Export 23x23 at 12/21 with the design icon. Kept from before, at the bottom: likes and tags,
    then "by" and "Updated …"; the globe and the wrench after the name. Folders and the + / See all tiles use the
    same shape (no notch; dashed cyan for +).
  - **Dilemma and help tiles:** the same gradient border and radius 10 on their art.
  - **Then (user: "ingrandisci i simboli di mana nelle card mazzo del 100%", then "è troppo scusa, fai 50%"):**
    identity symbols 13.5 px instead of 9 (5 apart, in `cqi` of the tile so they shrink with it on phones); the
    notch is now parametric: 17.5 deep with two quarter circles of radius 8.75 per side (the design's curves, scaled
    from radius 6.5), inner half-width 9.25n - 4 for n symbols; name at 23 from the top (19 in the frame) to clear
    the deeper notch, Export still at 21 (even with 5 colours the notch ends at x 164).
  - **Then (user: "il contorno lascia al 100% solo i mazzi che hanno help attivi, gli altri mettili al 30% di
    opacità"):** the gradient border is at 30% (`stroke-opacity`), full only on decks with an open help request
    (`.deck-tile.helping`, the same flag as the wrench); folders follow the decks (30%), the dashed + / See all stay
    full.
  - Verified at 1440x900 (band at 105, search 776 at 177, filters 68 px on one line, cards 209x208 with name at +19,
    format +38, export +21, symbols +1) and in the ~1000 px pane: My decks (folder, decks, +), filters with W and G
    on, Community (notches of 1-5 colours, by / tags / likes / wrench), Dilemmas (format + Play), Help, profile (cards,
    See all); phone 375x812 (two per row, text tabs, export hit area 45 px); the tour's list stage; lint and build.
- **No more scanlines (2026-10-19):** user request "togli l'effetto delle righe da tutto il sito". Removed
  the fixed `body::before` overlay (1 px cyan lines every 3 px, screen blend, over every page) and the lines on the
  profile banner (`.profile-banner::after` keeps only its veil). Not touched: the perspective grid behind the print
  sheet and the gradient lines of the restyle. Checked: deck page, profile at desktop and 375x812.
- **Restyle from the Figma frame "Proxodon" 47:108 (2026-10-18):** user request "Ho fatto un restyle,
  segui questo frame di figma e applicalo al sito" (file M8c1qKltd3Wxh3Ii42zn0v; a 1920x1080 deck page, desktop only).
  Measures taken 1:1 from the frame, the lines stretch with the page. Done:
  - **Colours:** `--bg-base` `#0b0b14`.
  - **Header (every page):** 42 px, solid background; logo at 24 / 13.5; Decks / Print in Chakra Petch 12 bold
    spaced 0.2em, white 50%, the open one cyan with the gradient "roof" above (`assets/figma/nav-roof.svg`); the
    gradient line under the header drops 17 px under the logo with a rounded step at x 170-203 (data-URI SVG with a
    `<line x2="100%">`, so only the right part stretches; `::before` fills the notch under the logo).
  - **Deck page (editor, Community, help request page, tour copy):** top bar = name in JetBrains Mono 25 bold at 48 / 32
    with the magenta heart (editor: likes received when public; Community: the Like button) and "by <nickname>" in
    Chakra Petch 10 `#b2b2b2`; search 227x38 6 px from the right edge with the cyan glow bar on the edge
    (`glow-cyan*.svg`, mirrored); when stuck the bar is 62 px with the page background, and (user: "quando scorro la
    pagina centra bene il nome mazzo e la barra ricerca") name and search sit at y 87, halfway between the header line
    (42; 59.5 under the logo) and the band line (132; the notch at 115), not at the bar's own centre (73). Hero 370 px: the cover is
    the art_crop masked by the design's blurred trapezoid (`deck-art-mask.svg`, mask-position 41/-6) at 80%; tags,
    "Saved …" and the 30x30 icon buttons (tag, print, export, globe from the frame; Public on = cyan) bottom right,
    70 px from the edge (they rise above the band under 1100 px). `DeckBand` (see the file map): line + format notch
    + trapezoid tabs, sticky under the bar. Counters Main / Side bottom left with the magenta bars. The help request
    page has no bar / band: name top left in the hero, question and actions bottom right.
  - **Phone:** layout unchanged; it gets the colours, the header tabs style and the new icons.
  - Assets in `src/assets/figma/` (mask, roof, glow bars: the SVGs from the frame, untouched); lines, tabs and
    icons are inline with the frame's path data (lines extended to 100%, tabs with the open state, icons with
    `currentColor`). New fonts: Chakra Petch 400, JetBrains Mono 700.
  - Verified at 1440x900 by measuring against the frame (name 48/74, art -25/60, search 227x38 at 96 and 6 px from the
    edge, band 401, tabs centred, icons right edge 70 px, counters 8 px / 62 px from the bottom, nav at x 211), at the
    pane's ~1000 px and at 800 px (no overlap, no horizontal scroll), stuck state while scrolling, Stats open (on top
    of both neighbours), Community deck, help request page, Print header, deck list, the tour, phone 375x812; lint and
    build green.
- **Security, the LOW findings and App Check (2026-10-18):** the user, after the fixes below: "correggi
  anche quello che resta fuori". Done:
  - **CSP:** `vite.config.js` adds a Content-Security-Policy meta in the build only (dev needs React's inline preamble
    and the HMR websocket): scripts from the site, Google sign-in (apis.google.com) and reCAPTCHA, `wasm-unsafe-eval`
    for lcms; images from the site, blob / data, Scryfall, googleusercontent; connections to Scryfall, lh3,
    `*.googleapis.com` (Firebase), reCAPTCHA; frames authDomain, accounts.google.com, reCAPTCHA; `object-src 'none'`,
    `base-uri 'none'`. In the Android app Capacitor injects its inline script right after `<head>`, before the meta,
    and a meta policy does not cover what precedes it.
  - **Upscaler weights self-hosted** (`public/models/esrgan-medium-x2/`, 2.7 MB): no CDN without integrity checks.
  - **Sign-out leaves no decks on disk:** the Firestore cache is cleared at the next start (see `firebase.js` in the
    file map). Clearing at once would need a reload, which would lose a print layout in progress (the account menu is
    also in the Print header).
  - **Import limits:** card lists cut at 200 characters per line (the set / collector regex was quadratic on long
    space runs) and 1000 lines; MPC XML at most 99 copies per card and 1000 cards, Drive-like ids only; the draft
    list in localStorage no longer throws when the storage is full.
  - **"anonymous" → "a player":** votes, replies and likes are readable with the uid, so the UI no longer calls them
    anonymous.
  - **Rules:** every `at` (likes, liked, votes, answered, replied) must be the server time; private deck `cards` must
    be a list; profile photo and banner must be `data:image/(jpeg|png|webp);base64,` URLs. Old likes without a
    `liked` marker: `deleteUserData` now also deletes `likes/{uid}` on every public copy, 60 per page by `createdAt`.
  - **Android:** `allowBackup="false"` plus `data_extraction_rules.xml` (no cloud backup or device transfer of the
    WebView data: Firebase session, deck cache); FileProvider limited to `cache/exports/` (share sheet) and the app's
    external `Pictures/` (camera capture of a file input); keystores ignored by git. `config.xml` (`access origin *`)
    is generated by `cap sync` and gitignored, not changed. Debug APK rebuilt (the old one could not save under the
    `rev` rules).
  - **CI:** `pages: write` and `id-token: write` only on the deploy job, the build job reads; actions pinned by SHA
    within their current major.
  - **App Check:** wired but off until `appCheckSiteKey` is set (reCAPTCHA Enterprise key from Google Cloud, domains
    tommiconlai.github.io and localhost); the user creates the key, registers it in Firebase App Check, watches the
    metrics in Monitor, then turns on Enforce for Firestore. Not done: a custom domain (the github.io origin is shared
    with the user's other pages), the password policy and API key restrictions (console), a cleanup Cloud Function
    (needs the paid plan), per-element size checks on help / reply lists (the rules language has no loops).
  - Verified: rules on the emulator 55/55 (new: chosen `at` refused for likes, markers, votes, replies; non-list
    cards; non-image photo / banner; old likes removed across 2 pages); the build served on port 5173 (same origin
    as the signed-in dev session): CSP meta present, Community 10 decks, dilemma and help feeds, a community deck,
    a dilemma (147 images), profile, Scryfall import of 2 cards, the 1000-line message, upscale with the weights
    from the site, RGB and CMYK PDFs, gapi + authDomain iframe + identitytoolkit, with no CSP violation, while an
    inline script, a foreign image and a foreign fetch are blocked; `ip:clearCache` at start: the cache went from 91
    to 7 documents, still signed in, decks loaded. Android emulator (APK installed): CSP meta, Capacitor bridge,
    pages render signed out, Scryfall API, card and symbol images, local weights and WebAssembly allowed, a foreign
    image blocked. Not tested: a real Google sign-in (needs the user) and the full account deletion live.
    Then with these rules published (after fixing a wrong line in the text pasted in chat: `usernames` instead of
    `users` in the `usernames` create rule, and a lost `allow get`): like + marker with server time, unlike removes
    both; a vote + marker on another player's dilemma, then removed; the profile photo re-saved (banner rechecked)
    while a non-image URL is refused; nickname blazedfoot → blazedfoot-zz → blazedfoot frees and retakes the keys
    and re-signs the 5 public decks; a second name without the profile is refused.
- **Security fixes from the ecc audit (2026-10-18):** the user had two `ecc:security-reviewer` agents
  audit the code (rules + data layer, client), then said "Sì, correggi il problema alto e i medi. Poi mandami le regole
  intere da incollare". No XSS and no privilege escalation were found; fixed:
  - **HIGH, malformed public decks crashed Community for everyone:** `cleanPublicDeck` (deckModel, self-checked) rebuilds
    every public copy read from Firestore (`publicOf` in deckStore: `listenCommunity`, `listenPublicDeck`,
    `getPublicDeck`, so also `deckOnce`, the dilemma pages and the help page) like `snapshotFromCard` writes it: rows
    with a valid card only, right types, short strings, images only from Scryfall; a doc without a `name` string or a
    `cards` list is dropped (null). It replaces `withScryfallImgs` (removed). Rules: `validPublic` now has a key
    whitelist and type / size checks on name, format, cards, words, tags, sections, createdAt.
  - **Forged timestamps pinning feeds:** dilemmas need `createdAt == request.time`; public copies need a real
    `createdAt` not in the future (5 minutes of slack for device clocks).
  - **Squatting a public id** (create someone's freed id, block their re-publish, make their account deletion fail):
    `unpublishDeck(uid, id)` (Make private, deleteDeck) now leaves a placeholder `{ uid }` (rules `retired`) instead of
    deleting the doc, so the id stays the owner's; readers treat it as gone (cleanPublicDeck = null, and it has no
    `createdAt` / `words`, so the Community queries skip it). Cleanup errors now reach the caller's toast.
  - **Nickname squatting:** a `usernames/{name}` can only be created together with the profile `nickname` (getAfter),
    and changing the nickname must free the old key in the same write (`nickFreed`): one name per account.
  - **Foreign images on dilemma pages** (the decklist preview / full screen used unfiltered URLs): fixed by the
    cleaned public reads, and `cardLang` now passes its English fallback through `scryfallImg` too.
  - **Backup restore trusted the file:** `fromBackup` rebuilds rows with the same cleaner (`cleanRow`), caps names,
    sections and covers, and refuses more than 500 decks.
  - **Data left behind / account deletion:** likes now have a marker `users/{uid}/liked/{deck}` (same batch, required by
    the rules) and the deck owner can delete likes, so retiring a deck removes them (`deleteLikesOf`) and deleting the
    account removes the likes given; votes and replies now require their marker in the same batch, so account deletion
    always finds them. `deleteUserData` finds public copies by `uid` (also placeholders and copies without a private
    deck), keeps going when a step fails and throws the first error at the end (so the Auth account is not deleted and
    a retry works), and deletes nickname and profile in one batch. A stale save can no longer resurrect a deleted
    deck (private decks must be created with `rev` 1).
  - **Unbounded lists:** `publicDecks` lists need `limit <= 60` or a `uid == me` filter; the collection-group feeds of
    dilemmas and helps need `limit <= 60`.
  - Not done here: App Check (needs a reCAPTCHA key from the console; the user can set it up), the LOW findings (vote
    linkability, import size limits, Android backup flags, CSP, CI permissions, clearing the local cache on sign-out,
    old likes without markers). **Deployment order:** with the old rules the new client cannot like (the `liked` marker
    is refused) or make decks private (the placeholder is refused); publish the rules right after the deploy. Verified
    with the old rules: Community 10 decks, a public deck 100 cards with Scryfall images, the dilemma decklist 97
    names, dilemma and help feeds load, no console errors; self-check covers the cleaners and the backup limits.
    Then, with the new rules published (2026-10-18): 47 rules tests on the Firestore emulator all pass (a throwaway
    harness in the session scratchpad: `@firebase/rules-unit-testing` + `firebase emulators:exec`, demo project;
    likes with and without marker, retired copies, bad public copies, list limits, dilemma dates, vote and reply
    markers, rev 1 on create, nickname claim / change / squat, the account-deletion steps). Live: Like on another
    player's deck from the UI writes like + marker, Unlike removes both (back to 0); a temporary public deck with a
    dilemma: Make private left `{ uid }`, deleted the dilemma, `getPublicDeck` = null; re-publish restored the full
    copy; delete left the placeholder (then removed by hand); a second nickname without the profile is refused;
    nickname round trip blazedfoot → blazedfoot-zz → blazedfoot frees and retakes the keys and re-signs the public
    decks; a vote + marker on another player's dilemma written and removed. The full `deleteUserData` run was not done
    live (it would wipe the account): every read and delete it uses was checked on the emulator, the reads also live.
- **Deck cards on tablets (2026-10-18):** the user sent an iPad Air (2025) screenshot: "Da tablet la
  visualizzazione delle carte non è ottimale". A tablet in portrait uses the phone layout (`useIsMobile`: up to
  1024 px portrait), where stacks were always two columns of half the width and the grid two columns, so cards
  were about 390 px wide. Now, with `touch`, stacks use as many columns as fit at `TOUCH_MIN` 170 px (at least 2):
  piles in group order split into contiguous columns with the tallest as low as possible (`splitPiles(heights, n)`
  in deckModel, binary search on the max height, self-checked; it replaces the two-column `halves`). The mobile
  grid is `repeat(auto-fill, minmax(min(170px, 50% - 5px), 1fr))`, at least two columns. The mobile deck hero is
  capped at 440 px (`min(73vw, 440px)`, it was 600 px at 820 wide). Verified: 820x1180 (iPad Air 11") 4 columns of
  183 px stacks / 188 px grid; 1024x1366 (13") 5 columns of 184 px; 375x812 still 2 columns of 165 px, no
  horizontal scroll. Landscape tablets keep the desktop layout. View setting put back to Grid.
- **Card preview in the dilemma decklist (2026-10-18):** the user asked "nei dilemmi fai vedere
  l'anteprima delle carte nella decklist, hover da descktop e tap da mobile". In `DeckListText` (Dilemmas.jsx) every
  card name is a button: with the mouse over it (`pointerType === 'mouse'`) the same floating preview as the deck
  view appears next to it (size from Settings › preview, gone on scroll); click or tap opens `CardView` (full
  screen, Flip, Esc / back / tap outside). On touch screens the rows are 44 px tall. The preview code moved out of
  DeckSections: `PREVIEW` and `previewAt(rect, card, w)` in the new `src/decks/hoverPreview.js` (a component file may
  not export plain functions, react-refresh lint), `HoverCard` exported from DeckSections, which uses both as before.
  Play mode ignores its keys (arrows, digits, Enter) while a modal is open, so looking at a card cannot vote or skip.
  Verified at 1440x900 (Jetmir preview beside the row, click = full screen) and 375x812 (tap Arbor Elf = full
  screen, 44 px rows, no horizontal scroll); deck view preview unchanged (320 px right of the row); Play stayed on
  1 / 2 with the card open.
- **Drop zones while dragging cards, steadier and finer tutorial (2026-10-18):** the user asked
  "mantieni fermo il box spiegazioni, non spostarlo durante un'animazione. Fai dei segmenti di tutorial in più, ad
  esempio nel tutorial del deck: 2/9, 5/9, 9/9. Per lo spostamento carte nel mazzo fai una modifica alla feature prima
  di modificare il tutorial. Quando trascini una o più carte fai apparire a sinistra, sopra il conto delle carte main,
  le altre sezioni dove potresti spostare la carta. Quindi Main e Maybeboard per commander e side in più nei formati
  dove è presente o le sezioni custom. In questo modo la pagina non deve scrollare e puoi spostarle da qualunque punto
  tu sia". Feature: `DeckSections` drop-zone panel (see the file map), verified on a real deck with a drag started and
  cancelled (no drop, deck unchanged): Commander deck, main card = Main and Maybeboard (Main always shown, at the user's request).
  Tutorial: the step card no longer moves during the gesture (`hold`); editor tour from 9 to 16 steps (search / add /
  copies, drag / selection / one copy / sections on the new zones with real drag events, Stats / Sample hand /
  Dilemmas / Help tabs with demo tab pages), Print "Add cards" split into Drop images + Add cards menu, list Search
  and Filters split, Dilemmas Open and Vote split. Phone: tabs split the same way, Sample hand docks the card on top.
  Checked at 1440x900 and 375x812, then desktop again; lint, build and review passed.
- **Guided tutorial for every page (2026-10-18):** the user asked "crea un tutorial per il sito, sia
  print che deck. Metti nella finestra che si apre cliccando il ? un button per far partire il tutorial. Consiste nel
  fare focus sulle zone interessate e mostrare visivamente le azioni da compiere, come il drag and drop, la selezione
  ad area, ecc... Crea delle pagine di default apposite per il tutorial, non agire su ciò che possiede l'utente. Il
  tutorial deve interessare la pagina corrente dove si preme il tasto". Every `?` popover ends with `HelpTour` (text +
  icon-only play button); the Decks `?` now shows on every Decks page (`DeckHelp editor` keeps the editor text). The
  tour is the one of the current route (`App` lazy-loads `tutorial/PrintTour` or `tutorial/DeckTour`; route change
  closes it, crossing the phone breakpoint restarts it). Engine in `src/tutorial/Tutorial.jsx` (see the file map):
  a demo copy of the page sits over the real one (which stays mounted and `inert`), the rest is dimmed around the
  step's zone, a fake cursor (finger on phones) performs the gesture with a label (Click, Right-click, Long press,
  Drag, Drop images, Enter...) and the demo reacts: cards selected by real clicks on the demo, area box, drag ghost
  with drop glow, menus copied from `CardMenu`, typed searches. Demo data only in memory (`tutorial/demo.js`: real
  card snapshots with Scryfall images, invented decks, dilemmas, requests, user). To keep the demo free of server
  reads, `DeckTile` takes `stats`, `DilemmaTile` `votes`, `HelpItem` (now exported, like `CardChips` and `FolderTile`)
  `counts`. Verified in the Browser pane at 1440x900 and 375x812 on Print, My decks, Community, Dilemmas (vote), Help,
  editor, public deck, help request, Profile, Settings: localStorage (outside Firestore's own sync keys) identical
  before and after, the real deck untouched, `#root` no longer inert and focus back on the `?` after Esc / Finish.
  Keyboard: Esc, ← →, Tab trapped in the step card, Next keeps focus when a button disappears. Not done: the Android
  app (ignored for now) and the signed-out Decks page (no `?` there yet).
- **Game changers and commander identity in card search (2026-10-18):** the user asked "nelle liste dei
  mazzi commander segnala i game changer. Poi filtra le carte che non possono entrare nel mazzo in base all'identità
  di colore". The snapshot (`snapshotFromCard`) stores `gc` from Scryfall's `game_changer` (the official Commander
  bracket list); old decks get it from the refresh on open (one save per deck). `DeckSections` marks game changers in
  Commander decks only: a cyan bolt (`IconZap`, new) after the name in the list view (`.deck-gc-icon`, next to the
  ban / copies icons) and a round cyan chip in the card flags of the image views (`.deck-card-gc`), "game changer"
  in the label; also in read-only views (Community, help request page) once the deck has `gc`. Card search:
  `searchIdentity(deck)` (deckModel) = the commanders' identity in a Commander deck with a commander, else null.
  `CardSearch` and `AdvancedSearch` take `identity`: name suggestions drop cards whose `color_identity` is outside it
  (the existing /cards/collection lookup; empty = "No playable card with this name in the commander's colors."),
  advanced search adds `id<=ug` (colorless commander: `id:c`) through `withLegal(q, format, identity)`. Passed in the
  editor (both searches and the advanced panel), the help request Suggestions zone and the new dilemma dialog.
  Self-check: `withLegal` with identity, `gc`. Verified on Aesi (UG): Crop Rotation, Cyclonic Rift, Worldly Tutor,
  Glacial Chasm marked in grid and list, at 375x812 too; "Lightning Bol" gives the no-match line, "Llanowar" and
  "Sol R" suggest; advanced t:Dragon gives 82 results (426 without the identity). View setting put back to Grid.
- **Wrench on every deck tile (2026-10-18):** the user asked "l'icona rendila visibile sempre nelle card
  mazzi". `DeckTile` now finds out by itself: `useCount(countOpenHelps, …)` for public decks (new in deckStore: a
  server count of `helps` with `status == 'open'`, like the likes), so the magenta wrench shows in My decks, folders,
  Community (other players' decks too) and the profile. The `helping` prop and the profile's `listenHelps` per deck
  are gone. ponytail: counted when the list opens, not live; a request opened or solved shows on the next visit.
  Verified at 1440x900 and 375x812: Aesi in My decks and in the profile, witherbloom in Community; no console errors.
- **Profile: Dilemmas section, See all, wrench on decks with open help (2026-10-18):** the user asked
  "nel profilo utente metti la sezione dilemmas sotto decks, metti un limite al numero di questi mazzi visibili e una
  voce vedi tutti alla fine. I mazzi con degli help aperti segnali con un'icona, chiave inglese se c'è". `ProfilePage`
  shows the 4 most recent decks (`SHOWN_DECKS`) and, when there are more, a dashed "See all · N decks" tile linking to
  `#/decks` (one desktop row of 5). `AddTile` in DeckList became the exported `GhostTile` (`label`, `href` = link or
  `onClick` = button, content in the middle); the + of My decks uses it. Under the decks, "[ DILEMMAS ]": the
  dilemmas of the user's public decks (on one's own decks only the owner creates them), newest first, as `DilemmaTile`
  (now exported from Dilemmas.jsx) with the deck name, linking to `#/dilemmas/:deck/:id`; the first 5
  (`SHOWN_DILEMMAS`, two rows of 3) and a "See all · N dilemmas" tile that shows the rest in place (focus moves to the
  first new one). `DeckTile` takes `helping`: a magenta wrench (`IconWrench`, Lucide path, new in icons.jsx) right
  after the globe, title "Open help request", also read by screen readers; only the profile passes it for now.
  Dilemmas and help requests come from one `listenDilemmas` / `listenHelps` per public deck (`usePerDeck`; ponytail:
  a collection group query by uid with its index when there are many public decks). The limit is applied to both
  sections: with the user's 6 decks a limit of 9 would never show See all, and 31 dilemmas took 11 rows. Verified at
  1440x900 and 375x812: 4 decks + See all (6 decks), wrench on Aesi (open request), 5 dilemmas + See all, expand
  to 31, no horizontal scroll; My decks + tile unchanged.
- **Agent review fixes: deck revisions, safe help data, targeted Undo (2026-10-18):** the user had the
  help requests reviewed by the `ecc:code-reviewer` and `ecc:react-reviewer` agents, then said "Sì, correggi tutto e
  aggiungi anche il numero di revisione controllato dalle regole". What changed:
  - **Deck revisions (`rev`), the likely cause of the lost Castle Garenbrig:** every private deck write carries `rev`.
    `saveDeck` writes `deck.rev + 1`, `createDeck` writes 1, folders `increment(1)`, and `useDeck.write` advances its
    local copy so the next save starts from the right one. The rules accept an update only when `rev` is exactly
    the saved one + 1 (old decks without `rev` count as 0): a client holding a stale copy (another device, an old
    tab, a cache-first snapshot) is rejected, Firestore rolls its cache back to the server version, and DeckEditor
    says "This deck changed on another device or tab: your last change was not saved". `listenDeck` now passes
    `fromCache`, `useDeck` exposes `synced` (first server snapshot) and DeckEditor's Scryfall refresh-on-open waits
    for it (it used to save from a possibly stale cache snapshot). `useDeck` has an `alive` ref: after unmount
    `update` does nothing (late Scryfall answers or an Undo toast no longer save a dead copy). The public copy is
    rewritten only after the private write is accepted. **Deployment order:** old clients (the Android app bundle,
    tabs opened before the deploy) cannot save decks once the new rules are live; rebuild the Android app.
  - **Untrusted help data:** `cleanCards` / `cleanHelp` / `cleanReply` (deckModel, self-checked) normalise what the
    listeners read (cards must be objects with string name / oid / sid, strings capped, lists capped), also for the
    dilemma listeners (a dilemma with under 2 valid cards is hidden); `artCrop` tolerates a non-string `img`. A
    hand-written document can no longer crash the feed or the owner's view.
  - **Apply / Undo:** computed inside `update` on the deck of that moment (not the one captured before the Scryfall
    await); `applySuggestion` returns what changed (`added` snapshots, `cut` rows) and the new `revertSuggestion`
    undoes only that (later edits stay); a no-op Apply says so and offers no Undo. The toast lists the names
    ("Applied: −X, +Y"). In the owner's view cut chips show the deck row's name (by `oid`) and add chips Scryfall's
    name and art (by `sid`, `useScryfallCards`), marked "not in this deck" / "not found on Scryfall" when they do not
    match, so the owner sees what Apply will really do. Several Applies at once keep their own busy state.
  - **Privacy:** `unpublishDeck` (Make private, deleteDeck) also deletes the deck's dilemmas and help requests with
    votes and replies; `deleteDeck` and `deleteUserData` clean up every deck, public or not. Privacy text, the
    Public tooltip and the toast say so.
  - **Rules:** `createdAt` / `seenAt` of help requests and `at` of replies must be the server time; help requests may
    carry `deck` (`validHelpDeck`: name, owner, format, cover; the owner nickname is checked like on public decks,
    only on create).
  - **Help UI:** the help request stores `deck` (name, author, format, cover) when created, so the feed reads no
    decks (older requests still use `deckOnce`, all in one update); tile art is a lazy `<img>`; tile labels include
    deck, author and cards. Zones: "Already in Cuts" and "Cuts is full" toasts, every Suggest cut from the menu is
    announced (keyboard and screen reader path, hint mentions Shift+F10), drag highlight uses a dragenter/leave
    depth counter (Safari / Firefox), drag payload checked to be an array. The deck list under the zones is
    memoised, so typing in Why? no longer re-lays out every card. Deleting your suggestion clears the form at once
    and focuses Why?; removing a chip moves focus to the next ×, or to the zone. The owner's request can be reopened
    only if no other request of the deck is open; a stale card-menu ask no longer reopens the dialog; a rejected new
    request reopens the dialog with its text; a failing replies listener shows an error instead of an empty form;
    offline sending says it is saved on the device. `<summary>` has a chevron, the chosen kind a check mark, spinners
    `role="status"`, close button `title`; non-owner tiles in a deck's Help tab are links. `ownerOf` re-reads the
    nickname when the account changes; `deleteHelp` deletes replies in chunks of 400.
  - Verified (old rules still live): `rev` 1, 2 on two saves of Aesi (name changed and restored), 3 on a folder
    write; public copy updated after; feed tile with lazy art and full label; helper page (forced locally, reverted):
    menu cuts announced, duplicate and full toasts, focus after removing a chip. The test reply from the other
    account was gone (deleted from that account, it seems), so Apply / Undo live is still to redo; the logic is
    covered by the self-check. Then, with the new rules published by the user (2026-10-18): a save with
    an old `rev` is rejected (`permission-denied`) and a normal one accepted, cards unchanged; in the editor, an edit
    pending while another client saved first shows the conflict message and the editor returns to the saved
    version; later editor saves and a folder write keep going (Aesi at rev 10, 100 cards); a new request on Jetmir
    is accepted with `deck` {name, owner, format, cover}, shows "Jetmir by blazedfoot" in the feed without reading
    the deck, opening it (seenAt), Solved and Reopen are accepted, then it was deleted; Make private on a temporary
    public deck deleted its request and public copy (deck then deleted). Apply / Undo live on a new reply from the other account (cut Haywire Mite, Hullbreaker
    Horror, Chord of Calling): the reply came up marked Applied from the first test, because `applied` held only the
    replier's uid, so the key is now `uid@reply time` (`appliedKey`; a new or edited reply from the same person is
    no longer shown as applied; old plain-uid entries are ignored). Then: chips named from the deck rows; Apply saved
    rev 12 with 97 main cards and the toast "Applied: −Haywire Mite, −Hullbreaker Horror, −Chord of Calling"; Undo
    saved rev 13, back to 100, Applied cleared; with a rename between Apply and Undo the rename stayed and only the
    cards came back. Aesi restored (name, 100 cards, rev 14).
- **Help request page: zones always in reach, no filters (2026-10-18):** user request: "le due zone
  rendile sempre disponibili, così quando uno scorre la pagina può sempre trascinare dentro le carte / la ricerca con
  i filtri non funziona visivamente, toglila". Desktop: the Cuts / Suggestions zones sit in `.help-zones-bar`, sticky at
  the top of `.deck-scroll` (dark band like the deck tab bar, z 5) inside `.help-reply-body`, which also holds Why?,
  the other suggestions and the deck list, so they stay until the end of the list; zones 128 px tall, chips scroll
  inside them (max 72 px); the search dropdown opens over the cards. CommunityDeck drops its empty `.deck-sticky` bar
  in help mode (it would cover the zones). Phone: zones not sticky (no drag there), Suggest cut confirms with a toast
  ("X added to Cuts"). `CardSearch` gains `noAdvanced` (hides the Advanced search link and panel), used only in the
  Suggestions zone. Verified at 1440x900 (scrolled 2500 px: the bar at the top, a card dragged from mid-list lands in
  Cuts, dropdown above the cards) and 375x812, helper view forced locally then reverted; Aesi still 100 cards.
- **Help request page for helpers (2026-10-18):** user request, verbatim structure: "1. testata del
  mazzo con la domanda 2. due aree affiancate: cuts e suggestions 3. sotto la lista del mazzo come una qualsiasi altra
  lista 4. drag and drop direttamente dal mazzo alla zona cut 5. search bar nella zona suggestions e un box testo per
  lasciare una spiegazione facoltativa". `#/help/:deck/:id` now renders `CommunityDeck` with `helpId` (DecksView):
  the deck hero carries the question (`HelpQuestion`: kind, when, text, focus cards, `.deck-hero-question` panel over
  the art), no deck tabs, then `HelpReply` → `ReplyDraft`: two dashed zones side by side (phone: stacked), **Cuts**
  (magenta, lights up under a dragged card; drop = `DRAG_ROWS` row ids from DeckSections; main deck only, never the
  commander, with an error toast otherwise) and **Suggestions** (cyan, `CardSearch` legal in the format), up to 10
  each, chips with ×; under them **Why?** (optional, max 1000) and Send / Save / Delete (no `<form>`: the advanced
  search inside Suggestions has its own and its submit would bubble up); Other suggestions in a `<details>`; then the
  deck list as in Community (`DeckSections` readOnly). DeckSections gains `onCut`: in read-only mode rows become
  draggable (effect copy, no internal drop, no maybeboard drop zone) and the card menu gets **Suggest cut** (also the
  phone path, long press). The editor's own drag is unchanged (still sets `DRAG_ROWS`, harmless). The owner on that
  page gets a link to the deck's Help tab (Apply lives there); the owner's inline `HelpView` keeps the old layout.
  Removed: `ReplyForm`, `FeedHelp` and the decklist in HelpView; `HelpFeed` lost `open`; `DeckListText` private again.
  Verified at 1440x900 and 375x812 (helper view forced locally on the own request, then reverted): drag of a card
  into Cuts (synthetic DragEvent), commander rejected, Suggest cut from the menu (desktop and phone), search into
  Suggestions, sending rejected by the rules on one's own request with the draft kept, owner link, editor drag. Side
  note: during this work the private Aesi deck lost Castle Garenbrig again in a write at 17:16 local (after the
  Apply / Undo test had restored it); no step of mine was saving then, so possibly another open client with stale
  state; put back (same printing), both copies at 100.
- **Help requests (2026-10-17):** user request ("vorrei creare anche la possibilità di fare delle help
  request"), design agreed in chat: one reply per user (editable), Apply in v1, feed tab next to Dilemmas. The owner of a
  public deck asks for help (kind: Cuts / Upgrades / Budget / Mana base / Synergy / Other, `HELP_KINDS`; a question of 1-500
  characters; up to 10 focus cards, `MAX_HELP_CARDS`), from the deck's new **Help** tab (+ tile, cyan, last in the grid) or
  from the card menu (**Ask for help**, `IconLifebuoy`, the selected cards in focus; disabled on a private deck or over 10).
  One open request per deck (client side): with one open, the + is gone and Ask for help shows a dismissable notice.
  Other players reply once (editable while open): advice (max 1000), up to 10 cards to add (Scryfall search, legal in the
  format) and 10 to cut (from the main deck, no commander). The owner sees the suggestions, newest first, the ones after
  the owner's last visit marked New (`seenAt`, written when the owner opens the request); **Apply** (editor only) re-reads the add cards
  from Scryfall by id (replies are written by anyone), then `applySuggestion` (deckModel, self-checked): cuts first (one
  copy from main, never the commander), then adds (one copy in main, skipped at the format's copy limit); toast with
  Undo (restores the previous card list, un-marks `applied`); Delete for spam; Solved closes it (no new replies, out of
  the feed) and reopens it. Feed `#/help`: the open requests of all public decks (collection group `helps`, newest 60),
  own first (Yours, link to `#/decks/:id/help`, the editor opens on the Help tab via `initialTab`), Replied on the ones
  answered (`users/{uid}/replied`), search (question, kind, cards, deck, author) and format select like Dilemmas; a
  request opened from the feed (`#/help/:deck/:id`) also shows the decklist. Data and functions in deckStore
  (`listenHelps`, `listenHelpFeed`, `createHelp`, `setHelpStatus`, `seeHelp`, `setApplied`, `replyHelp`, `deleteReply`,
  `deleteHelp`, counts); `deleteDeck` and `deleteUserData` clean them up; privacy text updated. `deckOnce` moved to
  deckStore and `artCrop` to deckModel (shared with Dilemmas, keeps Fast Refresh happy). Phone: deck tabs and deck list
  tabs now 4 on one row (`repeat(4, auto)`, 0.74rem). **Needs** the new `firestore.rules` published and a collection group
  single-field index on `helps.createdAt` (descending; the first feed load gives the console link). Verified live with the
  rules published (2026-10-17, account blazedfoot, deck Aesi, a test request "Test request: I need to cut 3 cards..."
  left open): post from the + (rules accept), tile, owner view, Solved and reopen, Ask for help from the menu (with a
  request open: the notice; on Jetmir: the dialog with the card in focus and the cursor on the question),
  `#/decks/:id/help`, phone 375x812; the reply form (rendered for the owner by a temporary local change, then
  reverted): Add from search, Cut from the deck, and sending is rejected by the rules on one's own request, with the
  error toast and the draft kept (`ReplyForm` keyed on `formKey`, bumped only when one's own reply is deleted, not on
  the reply's presence, which a rejected write rolls back). Feed verified 2026-10-18 after the user enabled the
  exemption `helps.createdAt` (collection group, Descending; the first try had left the collection group scope
  disabled, the error kept saying "You can create it here"): the request shows as Yours, search (text, kind, card,
  deck, author) and format filter work, the tile opens the deck on its Help tab, back returns to the feed,
  `#/help/:deck/:id` shows deck, author and decklist, phone 375x812. Reply, Apply and Undo verified 2026-10-18 with a real
  reply from the user's other account (tommiconlai: cut Castle Garenbrig): "1 new" on the deck tile and in the feed,
  the reply marked New, Apply removed the card from the saved deck (toast "Applied: 0 in, 1 out" with Undo, reply
  flag Applied), Undo restored the same card list and cleared Applied, reopening cleared "new". The Undo window is
  the app's toast (a few seconds): the first try missed it and the card was put back by hand (same printing, no
  sections in the deck). Apply now uses `IconMerge` (two branches joining), so it no longer shares the check icon
  with Solved. The test request stays open on Aesi until the user says to delete it.
- **Android app, milestone 4: polish (2026-10-17):** back button: `@capacitor/app` alone only
  calls `goBack` and does nothing at the root, so `main.jsx` adds a `backButton` listener (app only):
  `history.back()` while there is history (overlays via `useBackClose`, hash routes), else `minimizeApp()`
  (leaves the app, loaded cards stay). Fonts: Google Fonts link removed from `index.html`, the 9 weights
  come from `@fontsource/chakra-petch`, `space-grotesk`, `jetbrains-mono` imported in `main.jsx` (bundled
  woff2, same family names; web and app; Credits now say Fontsource). Verified on the emulator: Settings
  page and Add sheet close on back, Decks back to Print, root back to the launcher; cold start in airplane
  mode with all fonts loaded; a `target="_blank"` link opens Chrome (Capacitor does it, no code); long press
  on a print card opens the app's menu, not Android's; AI upscale 2x works in the WebView (about 30 s per card
  on the emulator, about 140 MB PSS). Web: fonts load locally (no Google requests), layout unchanged.
- **Android app, milestone 3: files, plus the native Google sign-in code (2026-10-17):**
  every save now goes through `saveFile` in `utils/download.js` (see the file map): RGB PDF (`doc.output('blob')`
  instead of `doc.save`), CMYK PDF, Save list, deck export, decks backup (the backup toast now waits for the
  save and reports errors). Pickers in the app: images (Android photo picker, multiple) are copied into memory
  as soon as they are chosen (`handleImagesAdded`: the WebView `File` is a lazy `content://` reference and
  reading it again at export threw `NotReadableError`); the ICC input has no `accept` in the app (Android has
  no MIME for `.icc` / `.icm` and showed an empty list; `onIccUpload` validates the file); `.xml` and `.json`
  filter fine. Tested on the API 37 emulator: 2 photos added, RGB PDF shared, 18 Scryfall cards imported,
  A3 CMYK 600 DPI with a custom ICC = 95 MB PDF written and shared in 22 s (header, `%%EOF`, 18
  `/DeviceCMYK` images checked), Save list shared, MPCFill `.xml` parsed, `.icc` loaded and validated. Web
  still downloads through the anchor. Native Google sign-in is wired (`firebase.js`, `SocialLogin` providers
  in `capacitor.config.json`: only Google) but `googleWebClientId` in `firebaseConfig.js` is still empty: it
  needs the Web client ID from Firebase (Authentication > Sign-in method > Google > Web SDK configuration),
  and the Android app registered in the Firebase project with the debug SHA-1
  `D8:45:3A:45:A3:90:A9:2B:95:CD:5A:94:FF:24:D2:4F:06:FD:D2:67` (SHA-256
  `4F:EE:C1:1E:98:15:83:50:BB:9B:F6:35:6F:A0:68:6F:1D:45:00:4F:B5:F9:D0:58:91:08:79:8D:8C:CA:15:C0`).
  Not tested yet (need sign-in): deck export, backup / restore picker, profile photo.
  Update (milestone 2, same day): `googleWebClientId` is now set (the project's Web client, the same
  `client_id` Firebase puts in its Google redirect, read from `accounts:createAuthUri`). On the emulator the
  native sheet "Choose an account to continue to Proxodon" opens; picking the account fails with
  `[16] Account reauth failed` until the Android app with the debug SHA-1 above is registered in the Firebase
  project (that creates the Android OAuth client). Plugin errors now show "Google sign-in failed. Try again,
  or sign in with email." (details in logcat, tag `GoogleProvider`); closing the sheet (`USER_CANCELLED`)
  shows nothing.
- **Android app, milestone 1: scaffold (2026-10-17):** user choices: Capacitor, id
  `com.tommiconlai.proxodon`, personal debug APK (no Play yet), min Android 7 (API 24). Added Capacitor 8.5.3
  (`@capacitor/core`, `@capacitor/android`, dev `@capacitor/cli`), `capacitor.config.json`, the `android/`
  project, adaptive icon and splash from `assets/`, dark launch / window theme (`#08070f`, no white flash),
  edge-to-edge with light status bar icons, `viewport-fit=cover` and the top safe-area inset on the phone
  header, full-screen pages and modals. Setup, toolchain and test commands under "Run > Android app".
  Verified on the API 37 emulator (header below the status bar, toolbar above the gesture bar, Settings page)
  and the web at 375x812 and 1440x900 (unchanged). Known gap: the system back button closes the app
  (needs `@capacitor/app`, milestone 4).
- **Android app brief (2026-10-16):** user request: a file for another session that will build the Android app. `docs/android-app.md`: goal (same features as the web app), recommended approach (Capacitor around the Vite build in this repo; TWA as the lighter alternative, with its limits), decisions to confirm with the user first (approach, application id, Play or APK, min Android), the WebView gaps with the files involved (native Google sign-in instead of popup / redirect, every blob download through a Filesystem + Share helper, file pickers, back button with `useBackClose`, edge-to-edge and safe areas, bundled fonts, long press, external links, network hosts, clipboard), milestones, the project rules that still apply, the environment and where to look in the code. Linked from the top of this file. No app code changed.
- **Mobile: 3-4 card dilemmas in a 2x2 grid (2026-10-16):** user request (the fanned, wrapped cards looked crooked and big on phones). Under `.mobile`, `.dilemma-cards.n3` / `.n4` are a CSS grid `repeat(2, minmax(0, 150px))`, gap 14 px, centred; cards `transform: none` (no fan, no 1.1 zoom on tap); with 3 cards the last one spans both columns and is centred at one column's width. Desktop and 2-card dilemmas unchanged. Checked at 375x812 (4 cards 150x209 on two even rows, 3 cards 2 + 1 centred) and 1440x900 (fan -4 to 4 deg on one row).
- **Dilemma vote needs a confirm (2026-10-16):** user request (change the choice, or undo a stray click). In `DilemmaView` a click on a card only sets `pick` (selected frame, the others dimmed via `.picked`; same card again = unselect); keys 1-4 (and arrows with 2 cards) select without toggling. While a card is picked: the hint names it, and an optional "Why?" textarea (`why`) is saved together with the vote (`voteDilemma(uid, deck, d, pick, why)`; rules already accept why up to 500). Confirm: in Play the Next button (label Skip / Confirm and next / Next, Enter or the right arrow) calls `confirm()` and moves on, with a toast "N% chose X like you" (count with your vote); outside Play an icon-only check "Confirm vote" in the head (disabled until a card is picked and the votes are loaded), then the results show as before. The vote is not awaited (offline it stays queued). Not tested live: the signed-in account has voted every dilemma of other players (Play shows All caught up); checked the owner view (no check, no hint, percentages) and lint / build.
- **Community author no longer anonymous (2026-10-16):** bug from the user: 3 decks published from the New deck panel showed "by anonymous" to the other account. Their public copies had no `owner` field: `publish` wrote the signature only when the module already knew the nickname (`ownerName`, filled by `listenProfile`), and it was still undefined (page just opened, or the module reloaded by HMR after the deckStore edits). Now `publish` is async and goes through `ownerOf(uid)`: when `ownerName` is undefined it reads `users/{uid}.nickname` once (and caches it); if the profile cannot be read (offline, no cache) it stays undefined and the copy keeps its old signature, as before. Repaired the 3 copies (Teval, Morcant, Aesi) by re-saving them through a fresh module instance, which also exercised the new path: all three now `owner: blazedfoot`. Decks other players published while unsigned get fixed on their next save.
- **My decks: + tile, New deck panel, folders (2026-10-16):** user request. Both + tiles use the logo cyan and sit last in their grid: `.dilemma-add` (deck Dilemmas tab) and `AddTile` in My decks (`.deck-add`: the same art + body as a deck tile, hidden, so it is exactly as tall; dashed cyan border, + centred). The header Import and New buttons are gone: the + opens `NewDeckDialog` (name, format, Public, optional list; see the file map). `createDeck` now also writes the Community copy when `deck.public` and stores `folder`. Folders: `folder: { id, name }` on the private deck doc only (not in `payload`, so never in the public copy; no rule change, deck fields are not whitelisted); `setDeckFolder(uid, ids, folder)` writes it on several decks in one batch (move, rename; null = out). A folder exists while it holds a deck. DeckList groups them (order of the most recently changed deck): root = `FolderTile`s (2x2 mosaic of the first 4 covers via `data-n`, name on top, "N decks"), then the loose decks, then +; `#/decks/folder/:id` (route in DecksView) shows the folder's decks with a head (← to `#/decks`, folder icon, name) and + (new decks are created inside). Search or filters = one flat list, folders ignored. Desktop drag and drop (HTML5, `draggable` on the tile `li`, off on phones): deck on a loose deck = both into a new "New folder" (toast "Folder created"), deck on a deck in a folder or on a folder tile = into that folder, deck on the ← of the open folder = out; the target glows cyan (`.drop`). The deck menu adds Move to "<folder>" for each other folder, Move to a new folder, Remove from folder (phones). `FolderName`: click the name (tile or head) = inline input, Enter or blur saves (all its decks), Esc cancels, empty keeps the old one; a ref makes sure it closes once. Duplicate keeps the folder. Checked at 1440x900 (+ last and 228 px like the tiles, folder open / back from a deck / ← up, New deck panel fields and Create / Import label, menu items, rename Esc) and 375x812 (tiles 169 px, no drag). The folder already in the account was made by the user's own drag; I did not move or rename decks.
- **Dilemmas with 2 to 4 cards (2026-10-16, held back on request, pushed after the user's tests):** `MAX_DILEMMA_CARDS` 4 and `splitSlices(n)` in deckModel (tile art cut into n slices by oblique lines, top 20/n % right of the straight edge, bottom 20/n % left: 2 cards = the old 60 / 40 geometry, checked by the self-check; per slice the image box left / width and a clip-path inside it, plus the lines). `DilemmaTile` uses `.slice` with inline left / width / clip-path (the `.s0` / `.s1` CSS is gone). `DilemmaView`: counts per card, cards fanned from -4 to +4 degrees through `--r` (inline), `.n3` / `.n4` narrower (220 / 190 px), on phones 2 per row at 40vw; in the game 1-4 pick a card (2 cards: also arrows). `NewDilemmaDialog`: slots 2-4 (`.dilemma-slot-wrap`, + `.dilemma-slot-add` up to 4, × `.dilemma-slot-rm` when more than 2, after a pick the first empty slot gets active), all different ("Pick different cards."). Card menu Dilemma: 2 to 4 different cards. `firestore.rules`: `cards.size()` 2-4, vote `pick` int 0-3 and below the dilemma's card count (same `get` as the owner check). The user published these rules (full file given in chat). Checked at 1440x900 + 375x812: 2-card tiles and view unchanged, dialog with 3 / 4 slots, remove, duplicate hint, menu with 3 cards. 20 `[Test]` dilemmas created on the signed-in account's 5 public decks (Teval, Morcant, Aesi, Jetmir, Dina): 6 with 2 cards, 7 with 3, 7 with 4 (random cards of the deck); tiles with 3 and 4 slices and the 4-card view (fan -4 / -1.33 / 1.33 / 4 deg, 2 per row on phones, no overflow) checked live.
- **Mobile X logo, dilemma + tile (2026-10-16):** user request. `Wordmark({ mark })` (icons.jsx) draws only the X (letters skipped, square viewBox `42 0 31 31` around its centre); MobileLayout's header uses it at 32 px, desktop keeps the full wordmark. `DeckDilemmas`: the New dilemma + left the header and is the first tile of `.dilemma-list` (owner only, `.dilemma-add`: the `.dilemma-split` box, same 626:457 size as a dilemma's art, dashed magenta border, magenta glow on hover, icon-only with aria-label / title); the grid shows for the owner even with no dilemmas. Checked at 1440x900 (300x219 like the tiles, opens the dialog) and 375x812.
- **Dilemma from the card menu (2026-10-16):** user request: the editor's card menu (right click / long press) has "Dilemma" (new `IconScale`) after Print. `DeckSections` gets `onDilemma(cards)` (editor only, Community is read-only): active only with exactly 2 rows of different cards and a public deck, otherwise `disabled` with the note "Select 2 cards" / "Pick two different cards" / "Make the deck public first". Click: `DeckEditor` keeps the 2 snapshots in `ask` and switches to the Dilemmas tab; `DeckDilemmas({ ask, onAsked })` opens `NewDilemmaDialog` with them (`creating` is now null or the initial 2 slots, + opens it with `[null, null]`; `initial` prop, the question gets `autoFocus` when both are filled) and calls `onAsked` on close or submit so it does not reopen. Checked at 1440x900 on Dina (1 card disabled, 2 cards opens the dialog filled, closed without creating, tab switch does not reopen) and 375x812 on Esper Affiity (private: disabled with the note).
- **Deck tags + white count labels (2026-10-16):** user request. Tags: `DECK_TAGS` in `deckModel.js` (the user's list of 127, verbatim), `MAX_TAGS` 5, `deckTags(deck)` = the deck's tags that are in the list, no duplicates, capped (old decks without `tags` = []). `tags` is in `newDeck`, `payload` (deckStore, so also in the publicDecks copy), `toBackup` / `fromBackup`, `duplicateDeck` (and so Copy to my decks). The editor has a Tags icon (IconTag) first in `.deck-hero-actions` that opens `TagsDialog` (dialogs.jsx: filter box, "N of 5", toggle chips with `aria-pressed`, picked ones first in an order fixed when it opens, others disabled at 5). `DeckTagList` (DeckTabs.jsx) shows the chips above the format row in the editor and the Community deck; tiles show them as one truncated line next to the mana pips (same tile height). Search: `deckMatches` matches name + tags (placeholder "Search decks by name or tag"), and the public copy's `words` now hold name + tag prefixes, sliced to 200 (the rules' cap), so Community finds them too once the deck is saved again. Tags do not move "Updated" (not in `contentSig`). Rules unchanged (deck fields are not whitelisted; unknown tags are dropped on read). Mobile: the editor's title keeps 208 px on the right for 4 icons (`:has(.deck-hero-actions > :nth-child(4))`), Community still 156. "main" / "side" in the plain count (`DeckBottomBar`) are white, numbers stay cyan. Checked at 1440x900 and 375x812 on Esper Affiity (tags added, searched, then removed). Self-check covers filter / dedupe / cap, backup, duplicate, search.
- **Mobile deck view: no bottom bar (2026-10-16):** user request: `DeckBottomBar` keeps the count and the buttons but loses the 80% dark bar and its top border; the strip is `pointer-events: none` (children `auto`) so taps reach the cards, the count has a dark text-shadow to stay readable over the cards, Back to top and the lens have a solid dark background with `--shadow-md`. Checked at 375x812.
- **Dilemma tiles: New / Voted (2026-10-16):** Keep or mull was added and then reverted at the user's request (commit 08e3cd1 restores the previous code and rules). On `DilemmaTile` the lock is gone: top-right chips `.dilemma-flags` with New (cyan, `createdAt` within 12 hours, `NEW_MS`; the time is read once per tile with `useState(() => Date.now())` because react-hooks/purity forbids `Date.now()` in render) and Voted (magenta, you answered it; never on your own dilemmas). `IconLock` / `IconLockOpen` deleted. Checked at 1440x900: Brigid tokens = New + Voted, the other help request and the own Dina dilemmas = New.
- **Ponytail cuts (2026-10-16):** `/ponytail:ponytail-review` of all `src/`, all applied (net -200 lines: 50+ / 250-). Dead CSS (classes in no JS: slider-wrapper/row/value, preview-format-tag, preview-top-row, preview-pages-block, preview-empty-*, page-label, badge, badge-warning, empty-state, mobile-settings, deck-back, .drop-zone in the focus :where) -131 lines; `IconLayout` and `NICKNAME_RE` (never used) deleted; Dilemmas uses `deckModel.shuffle`; one `menuPoint` exported from `hooks/useLongPress.js` (DeckList + DeckSections; keyboard menu 24 px inside the element); `useLikes.js` -> `useCount.js` with `useCount(fn, a, b, enabled)` for likes (DeckTile) and votes (DilemmaTile), `useVoteCount` gone; AdvancedSearch's `CardZoom` gone, it opens `CardView` (exported from DeckSections) with `snapshotFromCard`, and CardView now shows the Scryfall large image in the chosen language; `sleep` exported once from `utils/scryfall.js`; `handleRemoveMany` alias gone (App passes `removeWithUndo`); both PDF generators load images with `createImageBitmap(file)` (closed after use, error still "Cannot load <name>") instead of the two copies of `loadImageElement`. Checked: lint, build, both self-checks, RGB export run in the page (download intercepted, nothing saved) and CMYK `buildCmykPdfBytes` with FOGRA39 (1.4 MB `%PDF-`), broken file -> "Cannot load broken.png", like / vote counts, tile menu anchor, View card and advanced-search zoom at 672 px. Kept: `pct` / `plural` / `sum` one-liners in several files and `symUrl` in DeckStats (sharing would add imports, or a non-component export in Mana.jsx that react-refresh flags).
- **Deck price only in Stats (2026-10-16):** user request: no deck price anywhere except the Price tile in Stats. Removed from `DeckTile` (My decks, Community, profile; the `currency` prop is gone from DeckTile, CommunityGrid and ProfilePage), from the editor hero and from the Community deck hero (its format chip stays); `.deck-tile-price` CSS deleted. Settings → Prices hint now says the price shows only in the deck's Stats; `priceLabel` is used only by `DeckStats`. Checked at 1440x900: no currency value on My decks, Community, profile, editor or Community deck; Stats shows it.
- **Community and Dilemmas show only other players (2026-10-16):** `CommunityGrid` drops decks with `uid === uid` before search and filters (own public decks are in My decks; tiles always open `#/community/:id`), and `DilemmaFeed` drops own dilemmas (they are in the Dilemmas tab of the deck; Play already skipped them). Empty states: "No public decks from other players yet" / "No dilemmas from other players yet". ponytail: the queries still read the latest 60 decks / 40 dilemmas and filter on the client, so a user with many own public items sees fewer; a `where('uid', '!=', uid)` would need an index. Live (blazedfoot): Community = the 8 decks of tommiconlai, feed = their 2 dilemmas.
- **UX review fixes 1-7 (2026-10-16):** from `/ui-ux-pro-max` (measured at 375x812 + 1440x900). (1) System back closes overlays: new `src/hooks/useBackClose.js` (one same-URL history entry per open overlay, pushed one tick later so StrictMode does not double it; popstate closes only the top one; closing from the UI pops the entry with `history.back()` only if it is still current). Wired into `useOverlayDismiss` (all dialogs, CardMenu, ConfirmDialog, MobilePage search / print Settings / Export, PhotoDialog, ArtPicker, import modals), MobileLayout's add sheet and help tooltip, and `DeckDilemmas` (open dilemma -> list). (2) Mobile touch targets >= 44 px: header tabs, avatar 44, ? / tile export / nickname pencil via `::after` hit area, list and deck tabs, hero icons 44 (title keeps 156 px), filters, search, Filters / format, page close, dilemma buttons, card menu rows, toast action, quality slider (44 px hit, 24 px thumb), list-view − / + 44. On grid / stack cards − / + are hidden on phones and live in `.deck-sel-bar` (DeckSections, touch, one card selected): − count + at 44 px above the bottom bar; Flip keeps 28 px with a 44x40 hit area. (3) "View card" (IconEye) first in the card menu, also read-only: `CardView` full screen in the chosen language, Flip for two faces, closes with ✕, Esc, back or a tap outside. (4) On `.mobile`, inputs / selects / textareas are 16 px (no iOS zoom), the deck name stays 20 px. (5) No text under 12 px on mobile: tile format / likes / Updated `clamp(12px, ...)`, print bar labels, Saved, settings headings, field hints, profile labels. (6) Remove (menu) and − on the last copy remove at once with "Removed X · Undo" (App `notify(msg, kind, action)` now passes an action that also closes the toast; rows come back with zone, section, commander and qty). Tested on Esper Affinity (60 -> 57 -> 60); its Updated time did not move (removal and Undo ended in one save with the same content signature). (7) DeckList keeps search, filters and scroll per tab in module memory (`memory`, `useScrollMemory`; on phones `.decks-root` is the scroller); an open dilemma or Play start at the top. Audit after: 0 targets under 44 px on decks, print, settings, dilemmas, profile; only Flip at 44x40 in the editor; no text under 12 px; no input under 16 px. Desktop unchanged except the View card menu item, Undo and back-closes-overlay.
- **React review fixes, mobile (2026-10-16):** after `/ecc:react-review` of the mobile commits. Touch targets on phones: − / + / copies chip and Flip are 28 px (were 22, under the 24 px minimum), list-view − / + 32 px; so the stack strip is now 36 px (`TOUCH_STRIP = 36`, CSS `calc(36px - 139.344%)`, chip at top 4 px ends at 32). Mobile filter labels 0.68rem (were 0.6). The lens opens a page titled "Search cards" (was "Add cards"), same as its label. `PageCanvas` reads the pixel ratio through `usePixelRatio` (matchMedia on the current `dppx`, max 2), so browser zoom or a move to another monitor redraws the preview. **Not done:** `globalIgnores(['dist', '.claude'])` in `eslint.config.js` (the ecc `config-protection` hook blocks edits to it); until then `npm run lint` reports ~1060 errors from `.claude/worktrees/*/dist`, `npx eslint src` is clean. No jsx-a11y plugin (user: not for now). `npm audit`: 10 high, all in firebase's Node grpc transport and upscaler's build tooling, none in the browser bundle.
- **Mobile stacks: 32 px strip, balanced columns (2026-10-16):** on phones each covered card in a stack shows a fixed 32 px strip (`.deck-editor.is-mobile .deck-rows.view-stacks .deck-row + .deck-row { margin-top: calc(32px - 139.344%) }`, was 14% of the width = 23 px at 165 px), so the top chip (− / count / +, 5 + 22 px) no longer sits on the next card. `DeckSections`: `TOUCH_STRIP = 32` feeds `pileHeight(n, w, strip)`; the two touch columns are cut (piles in order) where the taller column is lowest (Dina: 2304 / 2620 px instead of 2812 / 2112). Desktop unchanged (14%, `packPiles`).
- **Tile label "Updated" (2026-10-16):** `DeckTile` (My decks, Community, profile) now reads "Updated 3 hours ago" instead of "Last update ..."; same value (`changedMs`, card changes only). Older entries below still say "Last update" for the same field.
- **Mobile pass: deck view, decks page, print (2026-10-16):** checked at 375x812 (mobile preset, DPR 2) plus a 1440x900 regression. Deck view (`.deck-editor.is-mobile`, editor and Community): Print / Export / Public (Community: Copy / Export) sit top-right of the hero in `.deck-hero-actions` (desktop: `display: contents`, same row as before; mobile: absolute, the title keeps 132 px on the right); Deck / Stats / Dilemmas tabs on a 3-column grid, each label centred; Sort / View / Group (+ new section) on one row with small labels above (grid `repeat(3, 1fr) auto`, 34 px selects); grid view 2 columns; stacks 2 columns (`DeckSections` with `touch`: `stackW` = half the area, piles in order, column 1 up to half the total height); tap selects, long press opens the menu, and under `(hover: none)` card images get `pointer-events: none` + no touch callout so the system "save image" menu does not open. The FAB + is gone: `DeckBottomBar` (DeckTabs.jsx) is a full-width bar at 80% dark with the count as plain text (`DeckCount plain`, Deck tab only), Back to top (after 600 px of scroll, smooth) and the lens that opens the full-screen card search (editor only). Root cause of the first filter sitting under the hero: `.deck-tabs` (44 px, margin -44 px) shrank to 24 px inside the `.deck-scroll` flex column, now `flex: none`. Decks page: tabs on one row (3-column grid, nowrap), Import / New / Play float bottom-right as 52 px round buttons. Print: settings groups spaced 24 px like the desktop sidebar; the preview canvas renders at `devicePixelRatio` (max 2) with `setTransform`, so cards are sharp on phones (drawing still in CSS px, checked the card lands in its cell at DPR 1 and 2).
- **Card frame = gradient outline for hover and selection (2026-10-16):** the HUD segments are gone. `CardFrame` is one `rect` 3px outside the card stroked with `#px-frame-grad` (the `.deck-tile` gradient, #FF2E96 → #AB61ED → #00E5FF); `CardFrameDefs` holds that gradient and `#px-frame-glow` (blur 3.5 merged twice under the sharp stroke = a soft halo of the same gradient). Hover = `.card-frame` opacity 0.6 (`@media (hover: hover)`); selected (`.preview-card-hotspot.selected`, `.deck-row.selected`, `.dilemma-card.selected`) = opacity 1 plus the glow; hovering a selected card keeps it full, the deselect click drops it to 60% without glow. Print keeps `rx: 3px`, decks 5%. Checked at 1440x900 with real clicks in Dina and on a card sent to print. The entry below describes the step before (outline on hover, segments on selection).
- **Card hover = gradient outline (2026-10-16):** `CardFrame` (print, deck grid and stack, dilemma cards) now has a `rect.hov` 3px outside the card, stroked with `#px-hover-grad` (new `linearGradient` in `CardFrameDefs`: #FF2E96 → #AB61ED → #00E5FF left to right, the `.deck-tile` border colours at full strength), `rx` 5% on deck cards and 3px on print cards (square corners). The HUD segments and corners are grouped in `g.sel` and show only on selected cards; on hover of a card that is not selected `.hov` goes to 1 and `.sel` to 0 (`@media (hover: hover)`), so hovering a selected card changes nothing and the deselect click still shows. Covered stack and grid cards keep `--frame-h`, the outline wraps the visible part. Checked at 1440x900 in Dina and on one card sent to print (queue not persisted, gone after reload).
- **Dilemmas Play, 10 test dilemmas (2026-10-16):** the Dilemmas tab has a Play button (`IconPlay`, `btn-add` where My decks has +) that opens `#/dilemmas/play` (DecksView passes `play`; no search there). `DilemmaPlay` (Dilemmas.jsx), a "Tinder" of deck dilemmas: queue = the feed's dilemmas by other players not answered yet, shuffled once at start (`useAnswered` is now null until loaded, so the queue waits for it); one at a time in `DilemmaView` with `onNext` / `progress`: header `N / total` and an arrow button (Skip before the vote, Next in `btn-add` after), keys ← → choose a card and → or Enter go on (ignored while typing; Enter on a button stays the button's), each dilemma slides in from the right (`.dilemma-play`, off with reduced motion). `DilemmaView` sends one vote at a time (`sending`). End: "All caught up" or "That was the last one" (skipped ones come back next round). ponytail: the queue draws from the latest 40 of the feed. **Test data:** 10 dilemmas "[Test] Which ... ?" by blazedfoot, 5 on Jetmir and 5 on Dina (card pairs of the same type from the deck), plus the earlier "[Test] Assassin's Trophy or Beseech..." on Dina: delete them with the trash in the dilemma view when done. They are playable from another account (tommiconlai); for blazedfoot Play shows All caught up (all own or answered). The play flow was checked at 1440x900 with a temporary mock that queued every dilemma (skip, → after a result, ← sends the vote, animation, end screen), then reverted.
- **Dilemma tiles, search and format in Dilemmas (2026-10-16):** from the user's sketch, `DilemmaTile` (Dilemmas.jsx, used by the feed and by the deck Dilemmas tab) replaces the old `.dilemma-item` row: a 626:457 box with the two cards' `art_crop` (derived from the stored Scryfall `img` by `art()`) split on a diagonal (60% top to 40% bottom, clip-path + SVG line, black with a soft black drop-shadow, like a shade; it was magenta), top-left chip `N votes` (`useVoteCount` -> `countVotes`, one count read per tile), top-right lock (`IconLock` closed magenta = you answered, `IconLockOpen` = still to answer; none on your own dilemmas), the question (max 3 lines) under the box outside the border, and in the feed a meta line `deck by owner`. Hover lights the half under the pointer and dims the other. `.dilemma-list` is `auto-fit minmax(240px, 300px)` centred. DeckList shows the search box on the Dilemmas tab too (placeholder Search dilemmas; matches question, card names, deck name, owner) with a format select beside it (`.decks-format`, same `filters.format` as the other tabs); no search while a dilemma is open. The feed now loads the public decks at feed level (`decks` map) to filter by format. "Solved" = you answered it, confirmed by the user (owners do not close dilemmas). Live at 1440x900: Dina 1 vote, no lock (own), Brigid 1 vote, closed lock; search "tommi" leaves Brigid, Modern shows No dilemmas match; deck tab of Dina shows the tile.
- **Dilemmas feed, + / Import only in My decks (2026-10-16):** the Dilemmas tab of the deck list (`#/dilemmas`) is now a feed: `DilemmaFeed` in `Dilemmas.jsx` listens to `listenDilemmaFeed` (collection group `dilemmas`, `orderBy createdAt desc`, 40; `deckId` = parent public deck) and `listenAnswered` (ids `{deck}_{dilemma}` of `users/{uid}/answered`). Each `FeedItem` (a link, same `.dilemma-item` look plus a meta row) shows thumbs, question, "A or B", deck name and `by owner` (public deck read once per deck with `getPublicDeck`, session cache `deckOnce`; a deck no longer public hides its dilemmas), badge `Yours` or `Answered`. Click = `#/dilemmas/:deck/:dilemma` (DecksView passes `open` to DeckList; App `inDecks` uses `startsWith('/dilemmas')`), `FeedDilemma` listens to the dilemma (`listenDilemma`) and the public deck and renders `DilemmaView` with `deckHref` (deck name links to `#/decks/:id` or `#/community/:id`); back arrow = `#/dilemmas`. `.dilemma-list` is `auto-fit minmax(300px, 400px)` centred, thumbs 64 px. Import and New deck render only on the My decks tab; `.decks-head` has `min-height: 40px` so the tabs do not jump. `firestore.rules` gains read-only `match /{path=**}/dilemmas/{dId}` (**publish by hand**), and the feed query needs a **collection group single-field index on `dilemmas.createdAt` (descending)**: the first load shows "requires an index" with a console link to create it. Live (1440x900): the open route on Brigid tokens (tommiconlai) works, a real vote from blazedfoot (Adeline, 100% of 1) and an explanation ("[Test] Adeline makes a token every attack...") were saved and show under Why they chose, profile counter 1; the feed list was checked with a temporary two-deck mock (Brigid Answered, Dina Yours, open and back), then reverted; with the real query it waits for the rules. Then the user published the rules and created the collection group index (exemption `dilemmas.createdAt` descending): the real feed loads at 1440x900, newest first (Dina Yours, Brigid tokens Answered), and the Brigid one opens with its vote and explanation. Known: dilemmas of a deck made private stay in Firestore (re-publish brings them back) and are readable by any signed-in account through the collection group.
- **Dilemmas live check (2026-10-16):** the user published the new `firestore.rules`. With real data at 1440x900: Dina's Dilemmas tab reads "No dilemmas yet" (no permission error); a test dilemma "[Test] Assassin's Trophy or Beseech the Mirror for the last slot?" was created from the deck cards (toast "Dilemma created", Scryfall images, owner view "0 votes so far" with Delete), it is still there; voting on it from the Community route of the own deck is refused by the rules ("Missing or insufficient permissions"), as intended; profile "Dilemmas answered 0". A vote, the explanation and the counter going up need a second account (not tested).
- **Dilemmas, first version (2026-10-16):** user sketch: a dilemma = two cards on a public deck, deck name, the owner's question and the decklist (list, by name, by type); others pick a card, then see the percentages and an optional explanation box, and read the others' explanations; profile shows "Dilemmas answered". User choices: created from the Dilemmas tab (+, cards from the deck or Scryfall), public decks only, explanations visible to everyone who answered, many dilemmas per deck. **`firestore.rules` must be republished** (dilemmas, votes, answered): until then the tab says "Dilemmas are not available: Missing or insufficient permissions" and the counter reads 0. `/ecc:code-review`: two MEDIUM fixed in the rules (the vote update re-checked the stored nickname, so a renamed voter could not explain; `answered` could be created without a vote), LOW fixed (dilemma cleanup failure no longer reports a deleted deck as failed). Rules not testable here (no emulator). Verified at 1440x900: permission message and + on Dina; New dilemma: two cards from the deck, question, check enabled (48x42), closed without saving; with a temporary local mock (removed afterwards): owner view 67% / 33%, "3 votes so far", 2 explanations, decklist in 7 groups, hover = 1.1 scale and the other at 0.5 brightness; voter view before voting "Choose the card you would play." without % or owner buttons, after voting "67% chose Beseech the Mirror like you (3 votes)", frame on the pick, Why box, explanations; profile "Dilemmas answered 0". Nothing written to Firestore. Lint, selfcheck and build green.
- **Last update counts card changes only (2026-10-16):** user request: the time on deck tiles and the editor's "Saved N ago" ignore Public / Private, art / edition changes (and also name, format, Group by, cover, Scryfall refresh); it moves only when cards are added, removed, changed in quantity or moved between boards / sections / commander. `/ecc:code-review`: HIGH fixed (older decks without a stored signature would have missed their first real change: `fromDoc` now takes the loaded cards as the base); found while testing and fixed: a save before the profile listener filled `ownerName` (here after a module hot reload) republished Dina's public copy as "by anonymous", now the owner is left as is until the profile is known, and Dina's copy was re-signed "by blazedfoot". Verified at 1440x900: Group by changed and restored on Esper Affiity and on Dina (real writes, "Saving…"), both stayed "Last update 2 hours ago"; selfcheck covers edition, split rows, deck fields (same signature) vs quantity and board (new one). A real card change was not made on the user's decks. Lint and build green.
- **Main / side chips, Stats summary tiles (2026-10-16):** user request. The count is now two chips, "60 main" above "15 side" (Commander: main only), still bottom-left. Stats: the summary sentence became tiles like the color ones, first in the tab (Cards, Lands, Nonlands with % of the deck, Average and Median mana value without lands with the value with lands below, Total mana value, Price with sideboard and source), grid `minmax(120px, 1fr)` so the 7 fit one row at 1440; the note under the color tiles is gone ("N symbols in costs" already says it). Verified at 1440x900 on Esper Affiity: chips at 68 / 18 px from the bottom, 7 tiles in one row, order tiles, curve, colors, draw odds; lint, selfcheck and build green; `/ecc:code-review` nothing above LOW.
- **Total card count in the deck view (2026-10-16):** user request: total cards bottom-left, always visible while scrolling, only on the Deck tab of a deck (own and Community), sideboard included where the format has one. Verified at 1440x900: Dina "100 cards" cyan, 18 px from the left and the bottom, same place after scrolling 1500 px, gone on Stats; Esper Affiity and Community Esper Affinity "75 cards 60 + 15"; Jetmir 100. `/ecc:code-review`: nothing above LOW (status region announces every change; the chip covers a small corner of the content). Phone not checked (mobile on hold). Lint, selfcheck and build green.
- **Print selection frame on deck cards (2026-10-16):** user request: the print sheet's selection border (`CardFrame`, now in `components/CardFrame.jsx`) marks hovered and selected cards in the deck grid and stacks too. First try showed the side segments of a covered stack card running down the whole pile, so the frame now wraps only the visible part (`--frame-h`). Verified at 1440x900: Arcane Signet (covered) and Sol Ring (last) selected, frames 41 px (35 px strip) and 357 px (card 351), glow filter present; print sheet frame unchanged (188 on a 182 card, opacity 1 when selected). `/ecc:code-review`: nothing above LOW. Lint and build green.
- **Print from the card menu, bigger header, sliding brackets (2026-10-16):** user request. Right-click / long press on a card or a selection: Print adds those cards to the print queue and opens Print. Deck header art +30% (`min(606px, 72%)`, header `min(442px, 68.25vw)`, same 626:457 proportions; also in Community). Deck tabs 18 px apart (was 28). Tabs on the list page and in the deck view: the brackets slide, arrival side first, then the other (`useBracketSlide`). `.deck-scroll` reserves the scrollbar gutter, so the top bar no longer shifts 5 px when a short tab (Dilemmas) drops the scrollbar. Verified at 1440x900: art 606x441, header 442; tabs 526-620 / 638-740 / 758-904; Deck to Dilemmas: at 100 ms `]` moving (790), `[` still; at 300 ms `]` arrived, `[` moving; back to Deck the reverse; list My decks to Community: `[` first (200 px at 120 ms), then `]`; menu starts with Print, Print on Sol Ring opened Print with the card on the sheet (left in that preview queue). `/ecc:code-review`: nothing above LOW. Lint, selfcheck and build green.
- **Deck tabs in the top bar (2026-10-16):** user request: on desktop the Deck / Stats / Dilemmas tabs move to the top bar, centred between the deck name and the search, so they stay with them when scrolling (the stuck-bar height measuring is gone); Community view gets the same bar with the tabs only. Phone untouched (user: mobile comes later). Desktop checks now at an emulated 1440x900 (user request). Verified at 1440x900: name 22-146 px, tabs 516-914 px (centre offset 0), search 1008-1408 px, all at top 72; scrolled and stuck, tabs still in the 70 px bar; Stats 1058 px wide; Community: tabs centred, title stops at 495 px before them, stuck when scrolled. `/ecc:code-review`: no CRITICAL / HIGH / MEDIUM, two LOW fixed (named `STUCK_AT` in Community, editor header comment). Lint and build green.
- **Deck / Stats / Dilemmas tabs in the deck header (2026-10-16):** user request. Under the deck header, centred, `[ ]` on the open tab like the list page, always reachable (sticky under the name and search bar on desktop, at the top on the phone and in Community). Stats and Sample hand moved from under the deck to the Stats tab; Dilemmas is its own tab (empty) in the editor too, and replaces the section under the Community deck. The list page tabs got smaller on the phone ("My decks" still wraps under the other two next to Import / New). `/ecc:code-review`: HIGH fixed (tabs at the same z-index as the search bar, later in the DOM, would cover its suggestions: now z 5), MEDIUM fixed (`tablist` / `tab` roles without arrow keys or panels: now buttons with `aria-current`). Verified live: desktop tabs centred 17 px under the commands, Stats shows only the analysis (682 px wide), Dilemmas the placeholder, Deck back with 100 rows; scrolled, tabs stick at 70 px under the stuck bar with the background; "sol r" suggestions cover the tabs; Community: tabs from 296 px to 0 when scrolled; phone 375 px: tabs 13 px under the commands, all three inside the width; lint, selfcheck and build green.
- **Scryfall-only deck images (2026-10-16):** fixes the out-of-scope finding below. `scryfallImg(url)` in `deckModel.js` keeps only https URLs on `cards.scryfall.io` / `svgs.scryfall.io` (the only hosts the Scryfall API returns for `image_uris`, checked live) and returns the parsed `href` (quotes percent-encoded, so a URL cannot break out of `url("...")`), else `''`. `withScryfallImgs(deck)` applies it to every row's `img` / `back` / `art`. Used on `DeckTile` covers (Community, My decks, Profile) and on the deck `CommunityDeck` receives from `listenPublicDeck` (hero art, cards, hover preview, flip, and the copy made by Copy to my decks), so a foreign URL shows the existing placeholder (blank tile art, card name box). Own decks in the editor are not filtered (written by their owner; a copy made before this change can still hold foreign URLs until the editor's Scryfall refresh replaces them, cards not found keep them). Firestore rules unchanged: they cannot loop over the `cards` list to check each URL. Verified live by mounting `DeckTile` and `DeckSections` with a crafted deck on the dev page (preview not signed in): foreign tile has no background, foreign card shows its name placeholder, the Scryfall tile and card render as before, no request to the foreign host; lint, selfcheck and build green.
- **Icon-only deck header buttons (2026-10-16):** user request, now a standing rule: buttons are icon-only (name in `aria-label` + `title`) unless the user says otherwise for one. Editor: Print deck, Export, Public; Community view: Copy to my decks, Export (the like count stays, it is data). `/ecc:code-review` before the push (user request): no CRITICAL / HIGH; MEDIUM fixed (Public state was colour only once its text was gone, now a filled background); out of scope, pre-existing: public deck docs can carry any image URL (cover art, card images), so a viewer's browser may load an arbitrary host. Verified live: editor buttons 36x36 with no text, Public filled cyan `aria-pressed=true`; Community buttons 36 px, like 56 px with its count; lint, selfcheck and build green.
- **Commander +, grid overlap, preview in grid (2026-10-16):** user request. Commander decks: only − on cards (both on basic lands; "any number" cards like Relentless Rats keep + too, the format allows them). Grid view: each row covers half of the row above. Hover preview now also in the grid. Verified live on Jetmir (grid, view setting restored to stacks afterwards): + only on Forest, Mountain, Plains, 95 rows with − only; overlap 50% inside a group, last card ends at the group's bottom, next group 26 px below; hover on Cosmogrand Zenith shows the preview; lint and build green.
- **Copies and +/- at the top centre (2026-10-16):** user request with a marked-up Thoughtcast: the copies number moves from the top-right to the top centre, − and + appear around it on hover in the same chip style, a single copy shows − + centred. Verified live (Esper Affiity, stacks): 3 Baleful Strix and 1 Arms of Hadar rows centred (offset 0) 5 px from the top, buttons hidden until hover, hover on 4 Thoughtcast shows − 4 +; lint and build green.
- **Flip fixes, likes, Dilemmas placeholders (2026-10-16):** user request. Flip: the card now turns as a real 3D card that keeps going the same way (each click +180°; before, the second flip looked reversed), slower (0.55 s, icon 0.4 s), button moved to the top-left. Tiles: public globe next to the name, likes count under the format. Public deck view: heart button next to the name, Dilemmas section (empty). Decks page: Dilemmas tab between Community and My decks (empty). **`firestore.rules` must be republished** for likes: until then counts read 0 and a like shows "Could not save the like" and goes back. Likes of a deleted account stay in the counts (tied only to its id), unpublished or deleted decks keep an orphan likes subcollection (harmless, back if republished). Verified live: tabs Community / Dilemmas / My decks, Dilemmas without search; Dina tile globe after the name, "0 likes" on all tiles; Community Esper Affinity: outline heart "Like, 0 likes", filled style checked by toggling the class in the page (no like written), Dilemmas section under the deck; flip button 5 px from the card's top-left, first click 0 → 180° (mid 115°), second 180 → 360° (mid 291°), same direction. Lint and build green.
- **Final Proxodon logo (2026-10-16):** user-supplied Figma node 41:104 replaces the hand-drawn D O N: all eight letter paths, the X core and the two V strokes copied verbatim from the Figma SVG (every `d` checked against the file), viewBox 132x31, the X mark moved by (+1, +0.5) so the hover pivot is now (57.5, 15.75); the mark's shape is unchanged, so favicons stay. Verified live: header wordmark 127.7x30, render at 131 px tall matches the Figma screenshot, hover turns the V parts 180° around the new centre; lint and build green.
- **Renamed to Proxodon (2026-10-16):** user request. Title, manifest, wordmark, privacy / cookie / credits / Fan Content texts, PDF metadata, file names (`proxodon.txt`, `proxodon-decks-<date>.json`), code comments. Backups are written with `app: 'proxodon'` and old `'proxoteca'` files still restore (`BACKUP_APPS`). Not renamed: the Firebase project (`proxoteca`, `proxoteca.firebaseapp.com`), the repo / GitHub Pages path, the `docs/` plans and the Figma frame names. Firebase console steps are the user's (public-facing name for emails and the Google sign-in screen, email templates, project display name). Verified live: tab title and wordmark label Proxodon, wordmark 126x30 in the header, checked at 120 px tall; self-check, lint and build green.
- **Double-faced cards flip (2026-10-15):** user request. Flip button on DFCs in grid and stack views (editor and Community), hover preview with front left and back right; snapshot field `back`, localized back via `cardLang`. Verified live: opening Dina, Jetmir and Esper Affiity added `back` (flip buttons on Disciple of Freyalise, Jennifer Walters, Ojer Taq, Tithing Blade); flipping Tithing Blade swaps the image to `/back/`, pink pressed state, copies chip moved left, hover over it shows both faces 320 px side by side (front at left); Community Esper Affinity shows its flip button. Grid view not opened (it would change the saved view setting). Self-check, lint and build green.
- **Contains card filter (2026-10-15):** user request. Filters has a Contains card field: a deck passes when a card outside the maybeboard has the text in its name (case-insensitive, `deckMatches` `card`, counted in the Filters badge; in Community it runs on the 60 fetched decks). Verified live: "sol ring" keeps Dina and Jetmir and drops the Pauper deck in My decks, keeps Dina in Community. Rules are now published: Community lists Dina (by blazedfoot) and Esper Affinity (by tommiconlai, another account), which opens read-only (no +/-, 25 rows, Copy to my decks, Export, by line). Self-check, lint and build green.
- **Community and My decks, percent tiles (2026-10-15):** user request. Tiles: width a percentage of the row (5 / 4 / 3 / 2 per row), texts in `cqi` so the tile scales as a whole, name top-left on the art under a black top-down gradient with the format right below, bigger price and last update; grid centered (also the last row) in a 1240 px column. Decks page: tabs Community / My decks, search by name and Filters (format, colors). Community = last 20 public decks; decks are private until shared (user choice), Share in Community from the tile menu or Public in the editor; a Community deck opens read-only with Copy to my decks (user choice). **`firestore.rules` must be republished** (`publicDecks`): until then Community shows "Missing or insufficient permissions" and sharing a deck gives a sync error (the deck itself still saves). Owner name = profile nickname, "anonymous" without one. Verified live: 1440 px tiles 235 px centered (name 15 px, price 14 px, meta 10.7 px), 375 px two per row, last centered, no horizontal scroll; Red → Jetmir, Pauper → Esper Affinity, "esp" kept across tabs; Community tab shows the permissions error; read-only view tested by pointing it at an own deck for a moment (no menu, no +/-, no drag, no New section, help hidden), then reverted; Public toggle renders (not clicked: old rules, real decks); `eslint src`, selfcheck and build green.
- **Clickable profile images, unique nickname, Credits (2026-10-15):** user request. Profile: the photo button is gone, the avatar and the banner are the buttons (same `PhotoDialog`, upload or Scryfall art; banner crop 5:1, custom banner in the profile doc); Cards stat removed, Followers and Following added (0 until public profiles exist). Menu: nickname as title, new Credits entry. Nickname is unique (`usernames/` + transaction + rules). Username login was asked, then dropped by the user after the tradeoff (Firebase signs in by email only, so a public name to email lookup or a paid Cloud Function would be needed). **`firestore.rules` must be republished by hand**: until then saving a banner or a nickname fails with "Missing or insufficient permissions" (photo still works). Existing nicknames are not reserved until saved again. Verified live: avatar opens Change photo (Upload, Find art, Remove current photo), banner opens Change background, Sol Ring art crops in a 580x116 strip with Save background (nothing saved: old rules live, and it is the user's real profile), hover chip and avatar overlay, pattern rejects "a b" and "ab", accepts "Tommi_99" and "t.o-m"; menu title "tommiconlai", Credits panel 12 links; 375 px hero centered, chip visible on touch, no horizontal scroll; `eslint src` and build green.
- **Profile hero, account in Settings, price-only tiles (2026-10-15):** user request. Deck tiles drop the main count, the price moves to its spot on the pips row (`DeckTile` extracted from DeckList). Profile redesigned and centered: banner from the latest deck's art, avatar on the edge with a photo button, nickname with inline edit, Member since / Last sign-in / Decks / Cards, then the decks; Remove photo moved inside `PhotoDialog` (a trash next to the name read like deleting the profile). Account data (email, verified, sign-in method) and the password form moved to Settings as its first two cards; note now "Preferences are saved on this device." Verified live: 1440 px hero / heading / grid all 1240 wide with 100 px each side; banner = Scryfall `art_crop`; nickname edit focuses the field, Esc restores it; photo dialog lists Upload, Find art, Remove current photo (not clicked); tiles Dina €691.55, Esper Affiity €149.14, Jetmir €725.78 with no count, right-click menu still Rename / Duplicate / Export / Delete; Settings cards Account, Password, then the preferences; 375 px profile centered, no horizontal scroll; no-art banner checked by stripping the art in the DOM; `eslint src` and build green.
- **Avatar on Print, centered Settings (2026-10-15):** user request. The print header (desktop and phone) shows the avatar after its `?`: App lazy-loads `HeaderAccount` from `AccountMenu.jsx` (`AccountMenu` when signed in and verified, else a user icon linking to `#/decks` to sign in, an empty `.account-placeholder` circle while auth loads so the `?` does not jump); MobileLayout takes it as `account`. Login state + profile photo moved from DecksView into the `useAccount` hook (`decks/useAccount.js`), used by both. Settings: `.settings-page > *` capped at 1240 px with auto margins, so title, note and cards sit in one centered column. Verified live: print avatar menu opens (Profile, Settings, Privacy, Sign out, Delete) and Settings navigates; at 1800 px the column has 280 px on each side; 375 px header fits (brand, tabs, ?, avatar) with no horizontal scroll; Decks list still loads with its avatar; signed-out icon not tried live (account signed in); `eslint src` and build green.
- **More settings (2026-10-15):** user picked proposals 1, 3, 4, 6, 7, 9, 10. Settings are kept on the device (`utils/settings.js`; the Firestore rules only allow the photo in the profile doc). Added: deck defaults (format / group of new decks and imports, view / sort for all decks, the toolbar menus write the same values), Print deck (add to the queue instead of replacing, sideboard ticked by default; `PrintDeckDialog` gets `add` / `defaultSide`, `App.handlePrintDeck(entries, add)`), card language (localized images, see `cardLang.js`), import options (`resolveEntries(rows, { fallback })` retries a missing printing by name, `addEntries(deck, items, { merge })`), appearance (hover preview size or off, compact list, reduce motion), prices (`snapshotFromCard` stores `eur` / `usd` from Scryfall, `deckPrice` / `priceLabel`: main + sideboard; shown in the deck header, on the tile format line and in the stats sentence; a deck gets prices the next time it is opened and refreshed). Not done from 10: light theme (big redesign of a dark-only design system) and sign-out-everywhere (needs Firebase Admin `revokeRefreshTokens` in a Cloud Function, paid Blaze plan). Self-check RED first then green (prices, deck price, group of new deck, import rows). Verified live at 1300 px: format default modern in New deck and Import, Print queue stored as boolean; Italian: 98 lookups in about 15 s, 62 Italian images, English for the rest (3 Italian prints without a scan showed Scryfall's "Not Available" image before the fix), hover preview 400 px with the Italian image; Jetmir €725.78 in the header, on its tile and in the stats; Esper €149.14 after opening; Print deck on Esper with the sideboard ticked; reduce-motion class on `<html>`; compact list rows 3px 6px; the View by menu saves to settings; test settings removed afterwards; `eslint src`, self-checks and build green.
- **Settings page, icon-only deck actions (2026-10-15):** user request. Decks header: Backup and Restore removed, Import and New deck icon-only. Avatar menu gains Settings (`IconSettings` gear) → `#/settings` with Backup and Restore. Verified live: header actions 40x40 "Import a deck" / "New deck"; menu Profile, Settings, Privacy, Sign out, Delete account and data; Settings opens `#/settings` with the Decks tab still active; Download backup (intercepted, nothing saved) = proxoteca-decks-2026-10-15.json, kind decks, 3 decks, toast; Restore with an invalid file = "This file is not valid JSON." and no deck created (a valid restore was not run, it would have duplicated the user's decks); `eslint src` and build green.
- **Gradient tile border (2026-10-15):** user request with the Figma gradient panel: the tile outline is a linear gradient #FF2E96 0%, #AB61ED 50%, #00E5FF 100% at 50% opacity (the Figma MCP code still exports a solid stroke, so the stops come from the screenshot; direction = Figma's default left to right). Verified live: border transparent 1px, background layers padding-box `--bg-surface` + border-box gradient, pink left / violet / cyan right visible on the tiles; build green.
- **Deck tiles from Figma (2026-10-15):** user request: follow the Figma frame 35:208 (file Proxoteca), keep the background, change the outline. Read with the Figma MCP (`get_design_context`); the cover and mana symbols are data, no static assets. `timeAgo` moved out of DeckEditor into `utils/timeAgo.js`. Verified live on the user's decks: border 1px rgb(255, 45, 149), radius 10px, background rgb(13, 11, 26), art ratio 0.73 as in the frame, name 14px, Last update 8px right ("1 hour ago", "yesterday"), format 30 px below the name and pips 25 px below the format as in the frame, pips 15 px, count 10 px right; phone 375 no horizontal scroll; `eslint src` and build green.
- **Opening-hand average under Draw odds (2026-10-15):** user request. The "Average lands in an opening hand" line left the sample hand and sits under the Draw odds chart, following the Draw choice. Verified live on Jetmir: Lands 2.55 (7 x 36 / 99), Enchantments 0.85, 4 copies of a card 0.28; no line under the sample hand; `eslint src` and build green.
- **Interactive sample hand (2026-10-15):** user request. Cards side by side instead of overlapping, a "Lands on battlefield" counter, non-land cards the lands on the battlefield cannot pay are faded, a click plays the card (slides down and fades out; a land raises the counter). Verified live on Jetmir at 1300 px: 7 cards in one row with no overlap; 0 lands → 3 of 7 faded (Parallel Lives, Elvish Mystic, Second Harvest); Lush Portico played → leaving at 120 ms, then gone and counter 1, Elvish Mystic no longer faded; Elvish Mystic played → counter stays 1; New hand → counter 0, 7 cards; two mulligans → nothing faded during the choice, the click bottoms the card (93 in library, no animation, counter 0); `eslint src` and build green.
- **Draw odds decimals (2026-10-15):** user report: Esper Affity, Artifacts (41), every turn 100%. The formula was right (checked against exact BigInt hypergeometric: at least 1 of 41 in 7 of 60 = 99.987%, at least 5 = 61.1228%), the whole-percent rounding hid it. Values now have one decimal and ">99.9%" / "<0.1%" near the ends; the Esper case is in the self-check. Verified live on Esper Affity: 60 cards, Artifacts (41) at least 1 → >99.9% every turn, at least 5 → T1 61.1% / 78.9%, T3 89.8% / 95.6%; `eslint src`, self-check and build green.
- **Draw odds options and full width (2026-10-15):** user request. No "Probability" / "Turn" titles, turns labelled T1, T2...; the chart spans the whole section at any width; options Draw (copies of a card or a deck type with its count), At least, plus Turns (2 to 20, my addition). `deckStats` returns `drawTypes` (self-check RED first then green). Verified live on Jetmir: 1300 px viewBox 917 = real width, ticks T1..T10, menu Copies of a card / Lands (36) / Creatures (31) / Instants (14) / Sorceries (3) / Artifacts (5) / Enchantments (12) / Planeswalkers (1); Lands, at least 3, 6 turns: T1 50% / 61%, T6 89% / 92%; phone 375: chart 309 px, ticks T2 T4 T6 T8 T10 (T9 and T10 overlapped before the fix), Enchantments (12) at least 1 T10 90% / 91%, no horizontal scroll; `eslint src`, self-check and build green.
- **Draw odds chart, no card preview in stats (2026-10-15):** user request. The stats card list lost its image preview (list only), the lands-on-curve sentence is gone, and a Draw odds line chart sits under the color cards (see `DeckStats` row). Verified live on Jetmir at 1300 px: no preview, no sentence; 4 copies in 99: turn 1 26% on the play / 29% on the draw, turn 10 51% / 54%; 1 copy turn 1 7% (7 / 99); empty field = 1; 10 copies turn 10 84% / 86%; crosshair and tooltip on turn 3; `eslint src` and build green.
- **Toast for added cards, Saved time, Moxfield-style stats (2026-10-15):** user request with a Moxfield stats screenshot. Card added from the search bar or the advanced search = app toast that slides up from the bottom edge and stops 24 px above it on desktop (`toast-in`; still 104 px in the mobile layout above the action bar); the line under the search is gone. "Advanced search" right-aligned under the box. Header: card count removed, sync label after Export with the time since the last save. Stats rebuilt (see `DeckStats` row; `deckStats` now returns perm / spell per bar, groups, avgAll, medianMv / medianAll, totalMv, library, per-color byMv / landSources, pips / sources totals; `hyperAtLeast`; self-check RED first then green; the Types chart and the tiles are gone, the counts are in the summary sentence). Verified live on Jetmir at 1920 and 1300 px: toast "Added 1 Forest" 24 px from the bottom (the test Forest was another print: the deck was put back to 3 Forest of the original print), Advanced search right edge = search box right edge, "Saved 24 minutes ago" then "Saved just now" after an edit, curve / cards / preview in three columns, bar 4 → 9 cards, Select in deck selects 9 rows, 4 lands by turn 4 52.7% / 62.1%, summary 100 cards, 36 lands, average 1.92 / 3, median 1.5 / 3, total 192, six color cards in one row with blue, black and colorless faded; `eslint src`, self-check and build green.
- **Percent side margins (2026-10-15):** user report: on full HD the cards reached the screen edges. `.deck-sections` side padding is now 13% (the red lines of the 2560 screenshot were at about 13%), the advanced search panel 74% wide. Verified live: 2560 → margins 333 px, piles 364; 1920 → 251 px, piles 269; narrow pane 932 → 120 px; phone 14 px, no horizontal scroll; build green.
- **Deck area to 1900 px, piles fill it, lower header (2026-10-15):** user request with a 2560 px screenshot: deck area out to the red lines, header down to the blue line. Content max 1900 px (was 1600); stack piles widen (200 to 400 px) so the columns fill the area; header `min(340px, 52.5vw)` with the cover box `min(466px, 72%)`, still the whole art_crop. Verified live at 2560x1300 on Jetmir: deck block 326 to 2225 px (red lines about 338 to 2234), piles 367 px, columns no taller than Lands, header 340 with art 466x339; 1440 px: piles 262, block 28 to 1402; narrow pane: piles 200 as before, no horizontal scroll; `eslint src` and build green.
- **Taller header, stats and sample hand under the deck, wider layout (2026-10-15):** user request, inspired by Moxfield (looked at a public deck: tall header, readable list, Cost / Color analysis and Sample Hand at the bottom). Header `min-height: min(468px, 52.5vw)` (phone 73vw) = the cover box's art_crop ratio, so the whole art shows; deck name 2rem. The Deck / Stats switch is gone: Stats and Sample hand sit under everything. Sample hand (`SampleHand.jsx`, logic `libraryCards` / `shuffle` / `mulliganBottom` in deckModel, self-check RED first): 7 from the shuffled main board without commanders, fanned cards, New hand, Mulligan (London: draw 7, click the N cards to put on the bottom; the first is free in Commander), Draw, hand / library / mulligan count, average lands in an opening hand. Content up to 1600 px, bigger list rows, group heads, toolbar labels and chart text. Verified live on Jetmir: art box 640x467 (ratio 1.370), header 468; hand 7 + 92 in library, average lands 2.55 = 7x36/99; mulligan 1 keeps 7, mulligan 2 asks for 1 card, Draw disabled until chosen, then 6 + 93, Draw → 7 + 92; Types bar Planeswalker selects Elspeth and scrolls to it; list view readable with hover preview; phone 375: header 274 px, no horizontal page scroll (the hand row scrolls by itself); `eslint src`, self-check and build green.
- **Deck export, bigger hover preview (2026-10-15):** user request. Export dialog with two formats, plain text ("4 Lightning Bolt") and with set and number ("4 Lightning Bolt (M10) 146"), Copy or Download .txt; opened from an Export button next to Print deck and from an icon-only export button on each deck tile (the tile menu item opens it too). Hover preview 244 → 320 px. Self-check RED first then green. Verified live on the user's decks (signed in): Esper Affity plain and set+number lists, Copy shows Copied, download intercepted in the page (file "Esper Affiity.txt", text/plain, 30 lines, final newline, nothing saved), tile export does not open the deck, Jetmir export from the header starts with Commander / Jetmir, hover preview 320x446, phone 375 px tiles and header without horizontal scroll; `eslint src` and build green.
- **Packed stacks, toolbar order (2026-10-15):** user request with a sketch (a pile under the commander). Stacks: piles fill columns no taller than the tallest pile, keeping the group order: each pile goes into the first column where it fits (first fit, so the Instants can sit under the Commander), else it opens a new one. Heights are computed from the card count, not measured (a layout effect with setState failed the React lint). Toolbar order Sort by, View by, Group by, "+" (39x39, same height as the selects). Self-check RED first then green. Verified live on a temporary harness (deleted): every-copy view packs Commander + Instants (741) and Sorceries + Artifacts (797) under the Lands pile (810), computed heights equal the measured ones (304, 501, 416...), "+" opens New section, area selection still works inside packed columns; `eslint src` and build green.
- **Bigger deck images, name-only stacks, edge-to-edge area (2026-10-15):** user request. Stacks 160 → 200 px columns, grid min 132 → 176 px; in stacks each card now shows only its name row (`-125.3%`, was `-118%`); `.deck-sections` no longer has `max-width` / `fit-content`, so click to clear and area selection start anywhere in the deck area up to the left and right screen edges (content still centered, see `DeckSections` row). Verified live on a temporary harness (sign-in needed for real decks, harness deleted): name bars fully readable with qty chip and +/- inside the strip, area drag from the left edge (x 6) and right edge selects the touched cards, at 1920 px sections 1910 px wide with 317 px padding in grid, stacks centered 212-1708 with the toolbar aligned; `eslint src` and build green.
- **Compact sticky bar (2026-10-14):** user request: Advanced search disappears while scrolling. In `.stuck` the search foot and the empty status line are hidden (bar 108 → 70 px, 12 px bottom padding). The threshold is now fixed (`scrollTop > hero height - STUCK_AT`, 72 px) instead of using the bar height, which changes with `.stuck` and would make the state flip back and forth. Verified live: not stuck at 120 px, stuck at 130 px (header bottom = bar bottom), back to normal at the top.
- **Deck name in the search bar (2026-10-14):** user request. On desktop the deck name input moved from the header into the sticky bar, on the left of the search, so it never scrolls away: over the cover it sits where it was (1.6rem), in the opaque bar (`.stuck`) it shrinks to 1.2rem, aligned with the search box. The header keeps format, sync, count and Print deck at the bottom (`margin-top: auto`). Phone unchanged (name in the header). Verified live: name and search box both at top 72 px, stuck bar with the name at 19.2 px, phone 375 px without horizontal scroll.
- **Help and avatar in the header (2026-10-14):** user request. The deck page has no hints any more (search key line, drag line, instructions in the empty groups); a `?` in the app header (`DeckHelp`, same tooltip as the print one, touch text on phones) explains search keys, selection, drag, menu, toolbar and cover. The avatar left the deck list and lives only in the header, on every Decks page: App and MobileLayout render a `.header-slot` when on Decks and `DecksView` portals `DeckHelp` (editor only) and `AccountMenu` into it. AccountMenu portals its dialogs to the body (the header's backdrop-filter would trap `position: fixed`); `.mobile-header` got z-index 60 so the tooltip sits above the deck header and the FAB. Verified live desktop and 375px: list (avatar only), editor (? + avatar, tooltip open / outside click closes), profile, Privacy dialog full screen, Print page unchanged (its ?, no avatar), no horizontal scroll.
- **Page scroll (2026-10-14):** user request: everything scrolls except the app header and the search. The deck header now scrolls away with the deck; the search bar stays at the top and turns into an opaque bar with the deck name once the header is gone. Verified live: bar fixed at the same spot while the header moves (-64, -418 px), `.stuck` after about 115 px, the page itself never scrolls, phone (no search bar, FAB fixed) without horizontal scroll.
- **Search in the header, deck centered (2026-10-14):** user request. Profile back arrow removed; on desktop the search bar moved into the deck header on the right (where format / saved used to be), the left search column is gone, Advanced search opens a full-width panel above the deck; the deck view is centered (`.deck-sections` max 1320 px; in stacks it shrinks to its content and the commander and sideboard become columns of the same row). Verified live: dropdown over the deck, advanced panel open / close, list 24 px margins each side, stacks centered, phone unchanged (FAB sheet with inline advanced search), no horizontal scroll.
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

- **AI upscale:** the weights are a copy of `node_modules/@upscalerjs/esrgan-medium/models/x2/*` in
  `public/models/esrgan-medium-x2/` (`path` in `upscale.js`): copy them again when the package is updated.
  Slow on phones / integrated GPUs (no cancel button yet).
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
- **Name in Firebase:** emails and the Google sign-in screen show the project's **public-facing name** (Project settings, General); set it to Proxodon after the rename. The Google popup still names `proxoteca.firebaseapp.com` unless a custom auth domain is set up.
- **Email/Password provider must be enabled** in the Firebase console (Authentication, Sign-in method)
  or the form answers "Email sign-in is not enabled for this site yet." The updated `firestore.rules`
  (email verified or Google, the profile doc with photo, banner and nickname, the `usernames` collection, the `publicDecks` Community copies, their `likes` and `dilemmas` / `votes`, `users/{uid}/answered`) must be **republished by hand** (Firestore, Rules);
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
