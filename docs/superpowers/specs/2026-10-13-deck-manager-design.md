# Proxoteca, Deck manager design

Date: 2026-10-13
Status: approved (design), pending spec review and implementation plan

## Goal

Add a Magic: The Gathering **deck manager** to Proxoteca: keep your deck lists, edit them
with Scryfall card search, pick editions, see deck statistics and format checks, then send a
deck to the existing print flow with one click. Decks sync between PC and phone through
Firebase. Mainly for the owner today, built so other users can sign up later.

## Decisions (from brainstorming)

- Users: the owner now, other users possible later. UI in English, like the rest of the app.
- Storage and sync: **Firebase** (Auth with Google + Firestore with offline cache), chosen
  over Google Drive (hourly re-auth, hand-written sync) and Supabase (pauses after 7 idle
  days, no built-in offline).
- The Decks area requires Google sign-in. The print area stays usable without an account.
- One Firestore document per deck. Concurrent offline edits of the same deck on two devices:
  last write wins (accepted).
- Magic only (Scryfall). Default format Commander, with Scryfall legality plus basic
  Commander checks.
- Deck view grouped **by type** by default, switchable to **mana value**, **color** or
  **custom** sections (create a section, drag cards into it).
- Card search: by name with autocomplete, plus **advanced filters** that build a Scryfall
  query (raw Scryfall syntax also accepted).
- Edition chosen **per row**; a row can be split to give copies different editions.
  English prints only.
- Stats: mana curve, colors (cost pips vs mana sources), types, average mana value,
  legality. **No prices.**
- Boards: a **Commander** block (1 or 2 commanders) and a **Maybeboard** (excluded from count
  and print). No sideboard.
- "Print deck" imports the whole deck (basic lands included, maybeboard excluded) into the
  existing print queue, **replacing** it after confirmation; the user then edits it there as
  today.
- Import from pasted list and deck links (existing parser and Moxfield / Archidekt /
  Tappedout fetchers), export as text, JSON backup of all decks.
- Header tabs "Decks | Print". Full editor on phone too. Design proposed by Claude in the
  current cyberpunk identity (no Figma).

## Out of scope

Prices, collection tracking, sideboard, sharing / public deck links, Partner / Background
pairing validation, draw probabilities and sample hands, non-English prints, other card
games, Firebase App Check.

## Architecture

### Firebase project (manual, done by the user with a guide)

1. Create a Firebase project.
2. Authentication: enable the **Google** provider.
3. Firestore: create the database in an **EU** location.
4. Authentication > Settings > Authorized domains: add the GitHub Pages domain (and keep
   `localhost` for development).
5. Register a Web app and copy its config object into `src/decks/firebaseConfig.js`. The
   config is public by design; access is protected by the security rules and the authorized
   domains.
6. Publish `firestore.rules` (from the repo) in the console, or with the Firebase CLI.

### Loading

- New dependency: `firebase` (modular SDK, only `app`, `auth`, `firestore`).
- The whole Decks area is a `React.lazy` chunk (`src/decks/DecksView.jsx`), so Firebase and
  the deck code load only when the Decks tab is opened. The print bundle does not grow.
- Firestore is initialised with `persistentLocalCache({ tabManager:
  persistentMultipleTabManager() })`: offline reads and writes, automatic sync when online,
  safe with several tabs open.

### Auth

- `GoogleAuthProvider` + `signInWithPopup`. On `auth/popup-blocked` or
  `auth/operation-not-supported-in-this-environment`, fall back to `signInWithRedirect`.
- Default persistence (`browserLocalPersistence`): the session survives reloads, no hourly
  reconnect.
- Account menu: user name / photo, Sign out, Privacy, Delete account and data.
- Delete account: delete every doc under `users/{uid}/decks`, then `user.delete()`; on
  `auth/requires-recent-login`, `reauthenticateWithPopup` and retry.

### Data model

Path: `users/{uid}/decks/{deckId}`, one document per deck.

```
Deck {
  v: 1,                          // schema version
  name: string,
  format: 'commander' | 'standard' | 'pioneer' | 'modern' | 'legacy'
        | 'vintage' | 'pauper' | 'casual',
  groupBy: 'type' | 'mv' | 'color' | 'custom',
  sections: [{ id: string, name: string }],   // custom sections, display order
  cards: Row[],
  createdAt: Timestamp,
  updatedAt: Timestamp                        // serverTimestamp() on every save
}

Row {
  id: string,                    // stable random row id
  qty: number,                   // 1..99
  board: 'main' | 'maybe',
  commander: boolean,            // only meaningful on board 'main'
  section: string | null,        // custom section id, null = main list
  card: Snapshot
}

Snapshot {                       // Scryfall data copied at add time, refreshed on open
  sid: string,                   // Scryfall print id
  oid: string,                   // oracle id (same card across prints)
  name: string,                  // full name ("A // B" for DFC / split)
  mana: string,                  // front face mana cost, e.g. "{2}{G}{U}"
  mv: number,                    // cmc
  type: string,                  // front face type line
  colors: string[],              // front face colors
  ci: string[],                  // color identity
  produced: string[],            // produced_mana ([] when none)
  legal: { [format]: 'legal' | 'not_legal' | 'banned' | 'restricted' },  // the 7 non-casual formats
  set: string, cn: string,       // edition (set code, collector number)
  img: string,                   // front face "normal" image URL
  art: string,                   // front face "art_crop" URL (deck tile cover)
  limit: number | null           // copy limit from oracle text: null = format default,
                                 // 0 = any number, N = up to N
}
```

Size: about 0.6 to 0.8 KB per row, about 80 KB for a 100-card deck, far below the 1 MiB
document limit. Hard cap: 500 rows per deck (message when reached).

### Security rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/decks/{deckId} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.cards.size() <= 500;
    }
  }
}
```

### Saving and sync state

- The editor keeps the deck in React state and writes the whole document with `setDoc`
  800 ms after the last change, plus an immediate flush on `visibilitychange` to hidden.
- Remote changes arrive through `onSnapshot`; local pending writes are not overwritten by
  the echo.
- Sync label next to the deck name, from snapshot metadata: "Saved", "Saving…", or
  "Offline, saved on this device" (pending writes while `navigator.onLine` is false).
- Spark daily quota exceeded (`resource-exhausted`): writes stay pending in the local cache
  and sync after the reset; a toast explains it. No data loss.

### Snapshot refresh

On deck open, the rows' `sid`s are fetched with Scryfall `/cards/collection` (75 per call,
2 calls for 100 cards) and the snapshots are rebuilt. The deck is written back only if
something changed (bans, image URLs). Unknown ids keep their old snapshot.

### Navigation

- Hash routes: `#/print` (default when the hash is empty, the current app), `#/decks`,
  `#/decks/:id`. A tiny `useHashRoute()` hook (`useSyncExternalStore` on `hashchange`), no
  router library.
- Header tabs "Decks | Print" on desktop and in the mobile header. Print state lives in
  `App` and survives tab switches (the print area remounts with the same `images`).
- The mobile bottom action bar belongs to the print area only.

### Code layout

```
src/decks/
  firebaseConfig.js     public Firebase config
  firebase.js           init (app, auth, firestore with persistent cache), sign-in helpers
  deckStore.js          list / subscribe / create / save (debounced) / delete decks, delete account
  deckModel.js          pure logic: snapshot from Scryfall card, grouping, stats, validation,
                        deck -> print entries, text import/export, backup JSON
  deckModel.selfcheck.js  node-runnable asserts for deckModel.js
  scryfallSearch.js     autocomplete, search (with paging), named lookup, query builder
  DecksView.jsx         lazy root: auth gate, routes #/decks and #/decks/:id
  DeckList.jsx          deck tiles, new / import / backup, tile menu
  DeckEditor.jsx        top bar, search column, deck area, stats view
  CardSearch.jsx        search box, autocomplete, advanced filters, results grid
  DeckSections.jsx      grouped sections, rows, row menu, drag between custom sections
  DeckStats.jsx         SVG charts and lists
firestore.rules
```

`App.jsx` gains only the tabs, the hash route switch, and `importDeckToPrint(entries)`.
Existing pieces reused: `scryfallFetch` / `fetchScryfallImages` / `parseCardList` /
`fetchPrints` / `fetchDeckList` (`src/utils/scryfall.js`), `ArtPickerModal` (Change
edition), `CardMenu` and `useOverlayDismiss` (menus), `ConfirmDialog`, `Toast`,
`MobilePage` pattern (mobile full-screen sheets).

## Screens

### Deck list (`#/decks`)

- Signed out: a panel with "Sign in with Google" and one line on why (decks sync between
  your devices).
- Signed in: grid of deck tiles: cover (commander `art_crop`, else the first card), name,
  format, main count ("98/100", warning color when the format count is not met), color
  identity pips. Sorted by `updatedAt` descending.
- Actions: **New deck** (name + format), **Import** (paste list or deck link), **Backup**
  (export all decks as JSON, import a JSON backup as new decks).
- Tile context menu (right-click, long-press on touch): Rename, Duplicate, Export text,
  Delete (confirm).

### Editor (`#/decks/:id`), desktop

- **Top bar:** back to Decks, inline-editable name, format select, sync label, count chip,
  issue chips (clicking one highlights the offending rows), **Print deck** on the right.
- **Search column** (left, in place of the print sidebar): name search with autocomplete
  (Scryfall `/cards/autocomplete`, 250 ms debounce, previous request aborted).
  "Advanced filters" expands: colors (include / exactly / at most), "within commander
  identity", type, mana value from/to, rarity, set, rules text, legal in the deck format.
  Filters build a Scryfall query; the raw query is editable. Every query adds `game:paper`.
  Results: image grid (first page of `/cards/search?unique=cards`, "Load more" for the
  next), **+** adds one copy to main, Alt+click adds to maybeboard, click opens the large
  image. Adding uses the search result data, no extra request.
- **Deck area:** "Group by" (Type / Mana value / Color / Custom) and a "Deck / Stats" switch.
  Commander block on top, sections in responsive columns, Maybeboard at the bottom
  (collapsed). Row: quantity, name, mana cost symbols (Scryfall symbol SVGs), set code. Hover
  shows the card image and +/- quantity buttons.
- **Row selection:** click toggles a row in the selection (same model as print cards);
  Shift-click range; Esc clears.
- **Row menu** (right-click or Shift+F10 / ContextMenu key): Change edition, Split row, Set
  as commander / Remove as commander, Move to maybeboard / main, Move to section… (custom
  mode), Remove. Acts on the whole selection when the row is part of it.
- **Custom mode:** "Create section"; drag selected rows onto a section; rename and delete a
  section from its header (deleting returns its rows to the main list).

### Editor, phone (≤768px)

Single column. A **+** button opens the search as a full-screen sheet. Group by and
Deck / Stats at the top. Long-press on a row opens the row menu (including "Move to
section…", no drag on touch). Print deck in the top bar.

### Print deck

1. If the print queue is not empty: confirm "Replace the N cards in the print queue?".
2. Build entries from main-board rows (commanders included, maybeboard excluded):
   `{ qty, name, set, collector }`, so the chosen edition is kept.
3. Download images with the existing `fetchScryfallImages` and its progress UI, replace the
   queue, go to `#/print`.

## Grouping rules

- **Type:** a row goes to the first match of Land, Creature, Planeswalker, Battle, Artifact,
  Enchantment, Instant, Sorcery, else Other (on the front face type line). Display order:
  Creatures, Planeswalkers, Battles, Instants, Sorceries, Artifacts, Enchantments, Lands,
  Other.
- **Mana value:** non-land rows in buckets 0, 1, ..., 6, 7+; lands in a Lands group.
- **Color:** White, Blue, Black, Red, Green (mono), Multicolor, Colorless, Lands (by front
  face colors).
- **Custom:** main list ("Deck", rows with `section: null`) first, then sections in order.
- Inside a group: by mana value, then name. Group headers show the summed quantity.

## Stats (Stats view)

Hand-written SVG, no chart library; built following the dataviz skill.

- **Mana curve:** main-board non-land rows by mana value 0..7+, weighted by qty. Clicking a
  bar highlights those rows.
- **Average mana value** of non-land cards.
- **Colors:** per W, U, B, R, G, C: cost pips (from `mana`; hybrid counts for each of its
  colors, Phyrexian for its color, generic and X ignored) next to mana sources (rows whose
  `produced` contains the color, weighted by qty).
- **Types:** Creature, Instant, Sorcery, Artifact, Enchantment, Planeswalker, Battle, Land;
  a multi-type card counts in each.
- **Legality:** rows not `legal` (or `restricted` in Vintage) in the deck format.

## Validation (issue chips, never blocking)

- **Commander:** main count (commanders included, maybeboard excluded) exactly 100; 1 or 2
  commanders; each commander is a legendary creature or says it can be your commander;
  singleton by oracle id except basic lands (`type` contains "Basic Land") and rows with
  `limit` (0 = any number, N = up to N); every card's `ci` within the commanders' combined
  identity; legality.
- **Standard, Pioneer, Modern, Legacy, Vintage, Pauper:** main count at least 60; at most 4
  copies by oracle id (same exceptions); legality (Vintage `restricted` = at most 1 copy).
- **Casual:** no checks.
- `limit` is read at add time from the oracle text: "A deck can have any number of cards
  named" gives 0, "up to seven" / "up to nine" give 7 / 9.

## Editions and rows

- Adding a card already in the deck with the **same print** (`sid`) increments that row;
  a different print creates a new row.
- **Change edition** opens `ArtPickerModal` with `fetchPrints(name)` (paper prints) and
  rewrites the row snapshot (set, cn, sid, images).
- **Split row** moves one copy into a new row right after it (same board and section).

## Import, export, backup

- **Text import:** `parseCardList`, resolved through `/cards/collection` (set + collector
  number when present, else name); unresolved lines listed in the result.
- **Link import:** `fetchDeckList` extended to also return the commanders when the source
  provides them (Moxfield `commanders` board, Archidekt "Commander" category); they are
  marked `commander: true`.
- **Export text:** `qty Name (SET) cn` per line, commanders first, main board only (same
  format the importers read).
- **Backup JSON:** `{ app: 'proxoteca', kind: 'decks', v: 1, exportedAt, decks: [...] }`
  with timestamps as ISO strings. Importing adds every deck as a new deck (new ids), never
  overwrites.

## Errors and edge cases

- Scryfall: existing retry in `scryfallFetch`; debounced autocomplete; search requests only
  from user input, staying well under 10 requests per second.
- Sign-in popup blocked: redirect fallback. iOS Safari sign-in must be tested on a real
  device (known third-party storage limits for apps not hosted on Firebase Hosting).
- 500-row cap per deck.
- A deck deleted on another device while open: the editor shows "This deck was deleted" and
  returns to the list.
- Double-faced cards: grouping and stats use the front face; printing prints both faces
  (existing behaviour of `fetchScryfallImages`).

## Privacy

- "Privacy" panel from the account menu: what is stored (Google account id, name, email
  and photo held by Firebase Auth; your decks), where (Firebase, Firestore in the EU), why
  (sync your decks), how to delete (Delete account and data).
- Cookie banner text updated: signing in stores a session in the browser's local storage
  (technical, required for the feature).

## Testing

- `src/decks/deckModel.selfcheck.js` (run: `node src/decks/deckModel.selfcheck.js`, same
  pattern as `src/utils/scryfall.selfcheck.js`): grouping rules, curve and pips (hybrid,
  Phyrexian), Commander validation (count, singleton exceptions, identity), deck to print
  entries (qty, edition, maybeboard excluded), text export / import round trip, backup JSON
  round trip.
- Live in the browser pane after the user signs in once: create, search (simple and
  advanced), add, quantities, group modes, custom sections with drag, change edition,
  split, Print deck, phone viewport, offline (Firestore `disableNetwork`) then back online.
- Security rules: a read of another uid's path must be denied.
- `npm run lint` and `npm run build` on every change; HANDOFF updated per change.

## Phases (each shipped and usable)

1. Firebase setup, tabs and routes, sign-in, deck list (new, rename, duplicate, delete),
   editor base (name search, add, quantities, group by type, commander, maybeboard), sync
   label, Print deck, text import / export, JSON backup, privacy panel, delete account.
2. Advanced search filters, Change edition, Split row, group by mana value / color / custom
   with drag and drop.
3. Stats view and validation chips.

## Risks

- Sign-in on iOS Safari (popup / redirect limits): test early in phase 1.
- Last write wins on concurrent offline edits of the same deck.
- Firebase Spark daily quotas: fine for the owner and hundreds of daily users; beyond that,
  the Blaze plan (pay as you go, card required).
- Scryfall availability: the deck stays usable from snapshots when Scryfall is down; only
  search, refresh and printing need it.
