# Proxoteca, Mobile UX design

Date: 2026-06-21
Status: approved (design), pending implementation plan

## Goal

Add a distinct mobile experience (not just responsive squish) with **full feature
parity**, including PDF generation/download, for viewports `≤768px`. Desktop layout
(sidebar + main preview) is unchanged above the breakpoint.

## Problem with the current UI on mobile

- The sidebar is a fixed ~300px column, doesn't fit a phone.
- Per-card controls (change art / duplicate / bleed / remove) reveal on **hover**. Touch
  devices have no hover, so they're unreachable (known gap in HANDOFF).
- The `?` help tooltip is hover-only.
- Layout is a two-column grid (sidebar | preview) that doesn't reflow usefully.

## Chosen approach: bottom-tab shell

A mobile shell with a bottom tab bar splitting the three concerns; the live preview stays
the hero. Chosen over a draggable bottom-sheet (more custom code, edge cases) and a
single-scroll page (least distinctive, more scrolling).

## Architecture

### Activation
- `useIsMobile()` hook wrapping `window.matchMedia('(max-width: 768px)')` (with listener +
  cleanup; SSR-safe default false). Returns a boolean.
- `App` renders the existing desktop tree when not mobile, and `<MobileLayout …/>` when mobile.
- **All state and handlers stay in `App`** (images, formatKey, bleed, dpi, cardType, crop,
  sheet, modals, `addItems`, `handleRemove`, `handleClearAll`, `handleToggleBleed`,
  `handleDuplicate`, `handleReplaceArt`, `handleGenerate`, `handleSaveProject`, `lowResCount`,
  `missing`, the dropzone `open`). `MobileLayout` receives them as props, no duplicated logic,
  single source of truth. Desktop and mobile share one state.

### The three tabs (bottom `BottomTabBar`)
1. **Cards**, full-width preview (reuses `PageCanvas`) + pager + per-card tap targets.
   A floating `＋` FAB (bottom-right) opens the add menu as a bottom sheet
   (Upload files → dropzone `open()`; Import from Scryfall → opens `ScryfallImportModal`).
2. **Settings**, the entire `PageSettings` component as-is, vertical scroll. Includes the
   low-res warning above the dpi field.
3. **Export**, a "ready to print?" review screen: card count + missing count, the low-res
   warning, then **Generate PDF** (primary), **Save list**, **Delete all**.

### Touch interactions (replace hover)
- Tap a placed card → **bottom action sheet** (`CardActionSheet`) with: Change art ·
  Duplicate · Bleed on/off · Remove. Change art opens `ArtPickerModal`; the others call the
  existing handlers immediately and close the sheet.
- Modals (`ScryfallImportModal`, `ArtPickerModal`) render **full-screen** on mobile via
  responsive CSS (same components).
- The `?` help tooltip toggles on tap on mobile (currently `:hover`/`:focus-within`, add a
  tap toggle that doesn't regress desktop hover).

### Component changes
- **New**: `MobileLayout.jsx` (shell: header, active tab content, `BottomTabBar`),
  `BottomTabBar` (3 tabs), `CardActionSheet` (bottom sheet of card actions). A small add-menu
  bottom sheet (can live inside `MobileLayout`).
- **Reused unchanged**: `PageCanvas`, `PageSettings`, `ScryfallImportModal`, `ArtPickerModal`,
  all `App` handlers, the PDF/bleed/grid engine.
- **Parameterized**: `PagePreview` gains an optional `onCardTap` prop. When set (mobile), the
  per-card hotspot's click calls `onCardTap(id)` and the hover buttons are not rendered; the
  pager stays. Desktop behavior (hover buttons) unchanged when `onCardTap` is absent.
  - Alternatively the Cards tab composes `PageCanvas` + its own tap layer directly; decide in
    the plan based on how much of `PagePreview` (stage sizing, pager, page math) is reusable.
- **CSS**: a mobile section in `index.css` under the `≤768px` media query for the tab bar,
  FAB, action/add sheets, full-screen modals, and the tab content scroll areas. Reuse existing
  tokens; keep the gold/green/red affordances.

## Data flow

Unchanged from desktop. `MobileLayout` is a pure presentational re-arrangement over the same
props. Tab state (`'cards' | 'settings' | 'export'`) and sheet open/close are local to
`MobileLayout`. Opening modals still flips `App`'s `importOpen` / `editingId`.

## Non-goals (v1)

- No change to the PDF generator, bleed math, grid, or Scryfall pipeline.
- No pinch-zoom; the preview page fits to width.
- No PWA/offline, no separate mobile route/URL.
- Desktop drag-and-drop stays desktop-only; mobile adds via `＋` / Import.

## Verification

- Live preview at a phone viewport (`preview_resize` to ~390×844): each tab renders; FAB opens
  the add sheet; tapping a card opens the action sheet; each action works (change art,
  duplicate, bleed toggle stays 63×88, remove); Export tab generates a PDF and saves a list;
  modals are full-screen.
- Desktop unchanged above 768px (regression check at a desktop width).
- `npm run lint` + `npm run build` green; `scryfall.selfcheck.js` still passes.

## Open implementation choices (resolve in the plan)

- Whether to parameterize `PagePreview` vs compose `PageCanvas` directly on the Cards tab.
- Exact tab icons/labels and whether the header shows the tagline-less compact form.
- Action sheet vs inline overlay for card actions (spec assumes action sheet).
