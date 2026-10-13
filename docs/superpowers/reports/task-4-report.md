# Task 4 Report, Card tap → action sheet

**Status:** DONE

## Files edited

- `src/components/PagePreview.jsx`, added `onCardTap` to props; hotspot `onClick`/`title` now branch on its presence; three hover buttons gated behind `{!onCardTap && (<>…</>)}`.
- `src/components/CardActionSheet.jsx`, created; imports `IconImage` (Change art), `IconCopy` (Duplicate), `IconFrame` (bleed toggle), `IconX` (Remove); renders sheet-overlay with four action rows.
- `src/components/MobileLayout.jsx`, added `CardActionSheet` import; added `sel`/`setSel` state; passes `onCardTap={setSel}` to `PagePreview`; renders `<CardActionSheet>` inside `.mobile-cards` after the add sheet.
- `src/index.css`, appended `.sheet-danger` and `.sheet-ic` at end of mobile section.

## Concerns

None. Desktop path (no `onCardTap` prop) is byte-identical in behavior. CSS tokens reused throughout.
