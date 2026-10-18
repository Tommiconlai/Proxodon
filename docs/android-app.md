# Brief: Proxodon Android app

For a new Claude Code session that builds the Android app of Proxodon. Read this first, then `HANDOFF.md`
(the full context of the web app: file map, conventions, the change log with the newest entries on top).
Written 2026-10-16, against `main` at the commit that adds this file.

## The goal

An installable Android app with the same features as the web app at https://tommiconlai.github.io/Proxoteca/:

- **Print**: load card images (files, Scryfall list, MPCFill `.xml`), lay them out on a sheet with bleed and
  crop marks, change art, AI upscale, export the PDF (RGB, or CMYK / PDF-X-1a with an ICC profile).
- **Decks** (Firebase): sign in (Google or email + password), My decks with folders and tags, deck editor,
  Community, Dilemmas with Play, profile, settings, backup / restore.

The phone UI already exists in the web app (`MobileLayout`, `.mobile`, `.deck-editor.is-mobile`, decided by
`useIsMobile`: under 768 px, or a portrait tablet up to 1024 px). The app must look and behave like it, not be
a redesign.

## Recommended approach: Capacitor around the existing build

Wrap the current Vite build in Capacitor, in this same repository (an `android/` folder plus
`capacitor.config.*`). One codebase: the web deploy keeps working, every feature comes along. A native
rewrite (Kotlin / Compose) would mean redoing the PDF engines (jsPDF, pdf-lib + lcms-wasm for CMYK), the
upscaler (TF.js) and all the UI: not worth it.

Alternative: a Trusted Web Activity (Bubblewrap) around the GitHub Pages site. Less work (Google sign-in and
downloads behave as in Chrome), but the Digital Asset Links file must sit at
`https://tommiconlai.github.io/.well-known/assetlinks.json` (the user's root Pages site, a separate repo),
there is no service worker or offline start today, and every native gap below stays out of reach.

**Before scaffolding, confirm with the user:** Capacitor or TWA; the application id (suggestion:
`com.tommiconlai.proxodon`, it can never change once on Play); app name "Proxodon"; whether v1 goes to the
Play Store (needs their developer account) or is an APK for themselves; minimum Android version. Use the
current stable Capacitor and check its docs for the matching JDK / Android Gradle Plugin / target SDK; do not
trust remembered version numbers.

## What breaks inside an Android WebView, and the fix for each

Verify each one on a device or emulator; do not assume.

1. **Google sign-in.** `src/decks/firebase.js` uses `signInWithPopup` (falling back to
   `signInWithRedirect`) and `reauthenticateWithPopup` (account deletion). Popups and redirects do not work in
   the WebView. Native path: `@capacitor-firebase/authentication` (native Google Sign-In, `skipNativeAuth`
   true), then `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` on the existing web SDK,
   so Firestore, `watchUser` and the rest stay as they are. Same for re-authentication. Gate it with
   `Capacitor.isNativePlatform()`, so the web keeps the popup. Needs an Android app in the Firebase console
   (project id `proxoteca`) with the SHA-1 / SHA-256 of the debug and release keys, and `google-services.json`.
   The user does the console steps; give them the exact fingerprints and clicks. Email + password sign-in
   should work unchanged; check that `localhost` (the WebView origin `https://localhost`) is still in Firebase
   Auth's authorized domains.
2. **Downloads.** `<a download>` on a blob URL saves nothing in the WebView. Every save goes through one of these:
   - `src/utils/download.js` `downloadText` (deck export `.txt`, decks backup `.json` from `SettingsPage`);
   - `src/App.jsx` `handleSaveProject` (`proxodon.txt`, own anchor);
   - `src/utils/pdfGenerator.js` `doc.save(...)` (RGB PDF, jsPDF);
   - `src/utils/pdfGeneratorCmyk.js` (CMYK PDF, own anchor).

   Make one helper (for example `saveFile(name, blob)`): on the web it is today's anchor; on native it writes
   with `@capacitor/filesystem` (cache dir) and opens `@capacitor/share` so the user can open the PDF or save
   it to Files or Drive. PDFs can be tens of MB: avoid one giant base64 string if the plugin allows chunked or
   blob writes, and test an A3 CMYK export.
3. **File pickers.** `react-dropzone` `open()` and the hidden `<input type=file>`:
   - images, multiple (`App.jsx`, `MobileLayout.jsx`);
   - MPCFill `.xml` (`MpcImportModal.jsx`);
   - ICC `.icc/.icm` (`PageSettings.jsx`);
   - profile photo (`PhotoDialog.jsx`);
   - backup `.json` (`SettingsPage.jsx`).

   Capacitor's WebView handles the file chooser; check that `multiple` works and that `.xml`, `.icc` and
   `.json` are selectable (Android filters by MIME; an extension-only `accept` may hide them).
4. **Back button.** Overlays push same-URL history entries (`src/hooks/useBackClose.js`, used by
   `useOverlayDismiss`); folders are a route (`#/decks/folder/:id`), deck pages too (hash routing,
   `useHashRoute`). Capacitor's default Android back calls `history.back()` while possible, then exits, which
   matches. Verify: dialog open, then back closes it; deck, then back goes to the list; at the root, back
   leaves the app.
5. **Safe areas and edge-to-edge.** The CSS already uses `env(safe-area-inset-*)` (bottom bars, floating
   buttons). Recent target SDKs force edge-to-edge: add `viewport-fit=cover` to the viewport meta in
   `index.html` (harmless on the web), set the status bar (`@capacitor/status-bar`, `#08070f`, light icons),
   and check the header and the bottom buttons with a gesture bar and a notch.
6. **Fonts offline.** Chakra Petch, Space Grotesk and JetBrains Mono come from Google Fonts in `index.html`.
   For the app, bundle them (all OFL) so a first launch offline still looks right; the web can use the same
   files.
7. **Long press and images.** Long press opens the card menus (`useLongPress`); under `(hover: none)` card
   images have `pointer-events: none` and no touch callout so the system "save image" menu stays away. Check
   in the WebView that long press opens the app menu, not Android's.
8. **External links.** `target="_blank"` links (Credits, privacy) must open the system browser, not inside
   the app.
9. **Network and heavy work.** These hosts must stay reachable:
   - Scryfall: `api.scryfall.com`, `cards.scryfall.io`, `svgs.scryfall.io`;
   - Drive images: `lh3.googleusercontent.com`; keep that host, `uc` and `thumbnail` give 403;
   - the upscaler weights: now served by the app itself (`public/models`);
   - Firebase.

   Firestore uses `persistentLocalCache` (IndexedDB): check offline edits and the sync when back online.
   TF.js (WebGL) and lcms-wasm must run in the WebView. Watch memory on a mid-range phone with many
   high-res cards.
10. **Copy to clipboard** (`navigator.clipboard`, deck export) needs a secure context; `https://localhost` is
    one. If it fails, use `@capacitor/clipboard`.

## Suggested milestones

1. **Scaffold.** Capacitor, `android/` project, the bundled `dist/` loads, name and adaptive icon (from
   `public/favicon-512.png` / `favicon.svg`, for example with `@capacitor/assets`), splash, status bar.
   `npm run build` and the GitHub Pages workflow (`.github/workflows/deploy.yml`) unchanged.
2. **Accounts.** Native Google sign-in plus email; decks load and sync; offline edit then sync.
3. **Files.** Every picker in point 3 and every save in point 2, through the share sheet.
4. **Polish.** Back button, safe areas, bundled fonts, external links, long press, performance on a real
   device.
5. **Release** (only if the user wants Play). Release keystore created and kept by the user (never committed,
   never typed by Claude), `versionCode` / `versionName`, signed AAB. The user does the Play Console steps.

Each milestone: build a debug APK, install it, test the flows it touches, then commit and push.

## Project rules that apply to this work too

From the user's standing instructions (memory) and `HANDOFF.md`:

- **UI and code style:**
  - UI strings in English; code comments in Italian.
  - Never write the em-dash character (U+2014) anywhere: code, docs, commits, chat. Use a comma or a
    period.
  - Every button is icon-only, with `aria-label` and `title`, unless the user says otherwise for that button.
  - Design identity: cyberpunk, magenta `#ff2d95` and cyan `#00e5ff` on violet-black `#08070f`; fonts
    Chakra Petch, Space Grotesk, JetBrains Mono; the print sheet stays pure white. No redesign on the way.
- **Before and after each change:**
  - Run `/ecc:code-review` on the uncommitted changes before each commit.
  - Commit and push to `main` after each change unless the user says to wait. A push to `main` deploys
    the web app, so the web build must stay green.
  - Update `HANDOFF.md` in the same turn as any change to behaviour, files or architecture: a new entry on
    top of the log, marked "most recent", and the file map.
- **Testing:**
  - Verify live, not just the build.
  - Web desktop checks at 1440x900, mobile at the 375x812 preset.
  - For the app, test on an emulator or device. Screenshots with
    `adb exec-out screencap -p > shot.png`, then read the image. WebView debugging via `chrome://inspect`
    in debug builds.
- **Firestore rules:** the user publishes `firestore.rules` by hand. Whenever you change it, paste the whole
  file in chat, ready to replace everything in Firestore > Rules.
- **Lint:** `npm run lint` currently fails on `.claude/worktrees/*/dist`; use `npx eslint src`. The
  `android/` folder must be ignored by ESLint too, but a hook blocks edits to `eslint.config.js`. Ask the
  user to add `globalIgnores(['dist', '.claude', 'android'])` themselves.
- **Safety:** never commit keystores, passwords or tokens; never create accounts or enter credentials
  (Firebase console, Play Console, Google Cloud). Tell the user exactly what to do and wait.
- **The user:** writes in Italian and short; answer in their language and keep it brief.

## Environment

Windows 11, PowerShell and Git Bash. Node and npm are installed (Vite 7, React 19, Firebase 13). Android
Studio, the Android SDK and a JDK are probably not: check with `java -version`, `adb version` and
`sdkmanager --list`, and tell the user what to install (Android Studio brings the SDK, an emulator and a
JDK). Firebase web config is in `src/decks/firebaseConfig.js` (public by design, project `proxoteca`).

## Where to look in the code

- `src/App.jsx`: root of the print tool; desktop and mobile trees, dropzone, save project.
- `src/components/MobileLayout.jsx`: phone shell (header, tabs, add sheet, help).
- `src/decks/DecksView.jsx`: decks area routing (`#/decks`, `#/decks/folder/:id`, `#/decks/:id`, `#/community`,
  `#/dilemmas`, `#/profile`, `#/settings`).
- `src/decks/firebase.js`: auth (the Google sign-in to make native), Firestore init.
- `src/decks/deckStore.js`: all Firestore reads and writes.
- `src/utils/download.js`, `src/utils/pdfGenerator.js`, `src/utils/pdfGeneratorCmyk.js`: the saves to route
  through the native helper.
- `src/hooks/useBackClose.js`, `useHashRoute.js`, `useIsMobile.js`, `useLongPress.js`: navigation and touch.
- `src/index.css`: design tokens and every mobile rule (`.mobile`, `.is-mobile`, `@media (hover: none)`).
