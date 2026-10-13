# Task 5 Report

## Status: DONE

## Files edited

- `src/index.css`, appended `@media (max-width: 768px)` block at end of file
- `src/components/MobileLayout.jsx`, added `helpOpen` state + `?` help block in header

## What changed

### Step 1, full-screen modals (`src/index.css`)

Appended a new `@media (max-width: 768px)` block (after all existing mobile CSS) overriding:

| Selector | Property overridden | Old value | New value |
|---|---|---|---|
| `.modal` | `max-width` | `520px` | `100%` |
| `.modal` | `height` | _(not set)_ | `100dvh` |
| `.modal` | `max-height` | _(not set)_ | `100dvh` |
| `.modal` | `border-radius` | `var(--radius-lg)` | `0` |
| `.modal-overlay` | `padding` | `24px` | `0` |
| `.art-grid` | `grid-template-columns` | `repeat(auto-fill, minmax(110px, 1fr))` | `repeat(auto-fill, minmax(84px, 1fr))` |

Also added `.help.open .help-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }` inside the same block.

Desktop rules are untouched. All overrides are scoped to `@media (max-width: 768px)`.

### Step 2, `?` help tap toggle (`src/components/MobileLayout.jsx`)

- Added `const [helpOpen, setHelpOpen] = useState(false)`.
- Rendered `<div className={\`help${helpOpen ? ' open' : ''}\`}>` in `.mobile-header` after `<h1>`.
- `.help-btn` has `onClick={() => setHelpOpen((o) => !o)}` for tap-toggle.
- Tooltip markup and copy are verbatim from `App.jsx`'s desktop header.

## Concerns

None. Desktop hover path (`CSS :hover/:focus`) on `.help-tooltip` is unchanged; the `.open` class is purely additive.
