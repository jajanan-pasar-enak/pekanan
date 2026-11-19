# Design: Pekanan

The locked system. Every later design task reads this first; pages share it. Change it on purpose — the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: app screen (dashboard workspace, not a marketing page)
- Theme: custom (vibe: "quiet neutral ledger, no brand hue yet")
- Axes: pure white paper / one neutral sans (Geist) / ink-only accent · posture: utilitarian, dense

## Tokens
Source of truth: `src/app/globals.css` (`@theme inline` + `:root`). If a `tokens.css` split is ever made, move these values there — do not fork them.

```css
:root {
  --color-paper: oklch(1 0 0);            /* --background */
  --color-paper-2: oklch(0.97 0 0);       /* --muted, --secondary, --accent */
  --color-ink: oklch(0.145 0 0);          /* --foreground */
  --color-ink-2: oklch(0.556 0 0);        /* --muted-foreground */
  --color-rule: oklch(0.922 0 0);         /* --border */
  --color-field: oklch(0.62 0 0);         /* --input */
  --color-primary: oklch(0.205 0 0);      /* primary action, near-black */
  --color-primary-ink: oklch(0.985 0 0);
  --color-danger: oklch(0.577 0.245 27.325);
  --color-focus: oklch(0.55 0 0);         /* --ring */
  --font-display: Geist, "Geist Fallback", system-ui, sans-serif;
  --font-body: Geist, "Geist Fallback", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;   /* code, never labels */
  --radius-control: 0.625rem;             /* 10px */
  --radius-card: 0.875rem;                /* 14px */
  --rule-hair: 1px;
  --shadow-card: ring 1px oklch(0.145 0 0 / 10%), no blur;
}
```

## Type
- One family for UI: Geist. Mono only for code or figures that must align, never for labels, captions or table heads.
- Scale: page title 24/600; card title 16/500; body 16/400; table and meta 14; small 12–13. No fluid heads.
- Sentence case everywhere. No uppercase, no small caps, no letter-spacing on labels or table heads.
- Body ≥16px; functional text ≥12px; tabular numerals for every count, amount and fraction.

## Layout and density
- Container: `max-w-6xl` (1152px), centred, `px-6`; at 1440 the gutters grow to 144px, the measure does not.
- Page rhythm: `main` gap 24px, padding 32px 24px. Sticky top bar 53px, hairline under, content scrolls beneath.
- Tables before cards for lists: 14px cells, 38–45px rows, numeric columns right-aligned. Cards are for one object, not for one row of a table.
- Dense ledgers (one row per person, one column per period) cap at 70vh with a sticky header and a sticky first column; the period head may drop to 12px, the row label never does. Cells are 32px controls, 44px on coarse pointers.
- Every page: title + one sentence of context, then the work. No hero, no section rhythm.

## Controls
- Primary: ink fill (`--color-primary`), 10px radius, 32px high, white text. One primary per screen.
- Secondary: outline or ghost, same radius and height.
- Inputs and selects: 32px high, constant 1px border, focus = 3px ring, never a border-width change.
- Minimum 32px for every control, including row actions; 44px hit target on coarse pointers. Nothing smaller ships.
- Focus: instant 3px ring on buttons, inputs, badges, nav links and text links.

## State and motion
- Character: calm. Transitions on colour, background, border, box-shadow and transform only; 150–200ms. Never `transition: all`, never animate width, height, top or left.
- Active press: 1px translate. No lifts, scales or bounces.
- Every data region has four states: loading (skeleton in the shape of the content), empty (what belongs there), full, and error. Route errors land on `src/app/error.tsx`, missing records on `src/app/not-found.tsx`.
- Global `prefers-reduced-motion` fallback is mandatory and already declared.
- State lives in the URL (filters, month, tabs); destructive actions are confirmed.

## Status semantics
- `Terkirim`: ink fill. `Draf`: secondary grey. `Dikoreksi`: outline. Overdue draft: `destructive`.
- Colour never carries meaning alone; the word is always present. Keep destructive red for errors and irreversible actions; revisit it for overdue drafts.

## Copy
- Indonesian (`id-ID`), the domain nouns from `CONTEXT.md` (Pekan, Laporan Pekan, Anggota Langsung, Iuran…). Sentence case, no eyebrows, no middle-dot meta strings, no arrows glued to labels.
- Dates: user-facing dates belong in short Indonesian form ("8–14 Nov 2026"), not raw ISO. ISO stays in data and sort keys only.

## Open items
- Dark mode is not supported: the `.dark` token block was removed; the `dark:` utilities inside UI primitives are inert until a token set and a toggle are added together.
- No accent hue exists. The first brand accent should replace `--color-primary` for the primary action and the active state, not add a second colour layer.
- Structural backlog, not allowed at polish depth: the dashboard member list has no search, filter or cap. `/iuran` is one 12-month ledger (58 rows); `/klien` has URL-backed search (`q`), a no-follow-up filter (`belum=1`) and 25-row pages (`hal`).
- The profile byline on `/akun` still joins name and email with a middle dot; tolerate one dot as a byline, never two in a meta line.

## Exports
Source: `src/app/globals.css` plus `src/components/ui/*` (shadcn v4, radix-nova, Tailwind v4). Tailwind, DTCG or shadcn blocks are added here on request.
