# Design: Pekanan

The locked system. Every later design task reads this first; pages share it. Change it on purpose — the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: app screen (dashboard workspace, not a marketing page)
- Theme: custom (vibe: "warm ledger sheet, serif masthead, one teal signal")
- Axes: warm paper (chroma ≤0.012) / serif display for titles, Geist for UI / one signal accent · posture: utilitarian, bookish

## Tokens
Source of truth: `src/app/globals.css` (`@theme inline` + `:root`). If a `tokens.css` split is ever made, move these values there — do not fork them.

```css
:root {
  --color-paper: oklch(0.976 0.009 85);   /* --background: warm desk */
  --color-paper-2: oklch(0.945 0.012 82); /* --muted, --secondary, --accent */
  --color-sheet: oklch(1 0 0);            /* --card, --popover, top bar: white sheet on the desk */
  --color-ink: oklch(0.19 0.012 70);      /* --foreground */
  --color-ink-2: oklch(0.5 0.015 72);     /* --muted-foreground */
  --color-rule: oklch(0.885 0.012 80);    /* --border */
  --color-field: oklch(0.58 0.01 75);     /* --input */
  --color-primary: oklch(0.24 0.014 70);  /* primary action, warm near-black */
  --color-primary-ink: oklch(0.99 0.004 85);
  --color-danger: oklch(0.542 0.204 27.325);
  --color-signal: oklch(0.47 0.08 195);   /* --signal: one accent, progress and settled state */
  --color-focus: oklch(0.5 0.012 70);     /* --ring */
  --font-display: "Source Serif 4", Georgia, serif;  /* page titles, summary head, wordmark */
  --font-body: Geist, "Geist Fallback", system-ui, sans-serif;  /* UI, labels, controls */
  --font-mono: "Geist Mono", ui-monospace, monospace;   /* code, never labels */
  --radius-control: 0.375rem;             /* 6px */
  --radius-card: 0.525rem;                /* 8.4px, rounded-xl under --radius 6px */
  --rule-hair: 1px;
  --shadow-card: ring 1px oklch(0.19 0.012 70 / 10%), no blur;
}
```

## Type
- Two families, two roles. Display: Source Serif 4 (400/600) for `h1`, the current-week summary head, the figure that sits with it, and the wordmark. UI: Geist for everything else, including card titles, labels, table heads, captions and controls. Mono only for code or figures that must align, never for labels.
- Scale: page title 24/600 serif; summary head 30/600 serif with a 25.6/600 serif figure; card title 16/500 sans; body 16/400; table and meta 14; small 12–13. No fluid heads.
- Sentence case everywhere. No uppercase, no small caps, no letter-spacing on labels or table heads.
- Body ≥16px; functional text ≥12px; tabular numerals for every count, amount and fraction.

## Layout and density
- Container: `max-w-6xl` (1152px), centred, `px-6`; at 1440 the gutters grow to 144px, the measure does not.
- Page rhythm: `main` gap 24px, padding 32px 24px. Sticky top bar 53px, hairline under, content scrolls beneath. The wordmark is the display face at 18px; navigation stays sans. Every screen opens with a page head closed by a hairline (`main > header`), so the title reads as a masthead over the work.
- Surfaces: the top bar is a white masthead, the page below it is warm paper, and cards are white sheets with a 1px ink/10 ring and no blur. One radius per nesting level; controls 6px, cards 8px.
- Tables before cards for lists: 14px cells, 38–45px rows, numeric columns right-aligned. Cards are for one object, not for one row of a table.
- Dense ledgers (one row per person, one column per period) cap at 70vh with a sticky header and a sticky first column; the period head may drop to 12px, the row label never does. Cells are 32px controls, 44px on coarse pointers.
- Every page: title + one sentence of context. A single summary block may follow when the page has one urgent figure (current week or month, progress, next action): heading, key figure, one progress line, one action. It is not a marketing hero — no imagery, no oversized display copy, no section rhythm. Pages without such a figure go straight to the work.

## Controls
- Primary: ink fill (`--color-primary`), 6px radius, 32px high (36px for the summary block's single action), white text. One primary per screen.
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
- `Terkirim`: signal tint (`border-signal/25 bg-signal/10 text-signal`). `Draf`: secondary grey. `Dikoreksi`: outline. Overdue draft: `destructive`.
- Colour never carries meaning alone; the word is always present. Keep destructive red for errors and irreversible actions.

## Signal accent
- One accent only: `--signal` (teal). It marks progress and settled state — the progress bar of the current period, the marked current column in a ledger, paid ledger cells, and the `Terkirim` badge. Nothing else.
- Never use it for primary actions (those stay ink), navigation, page backgrounds, large surfaces, body text or card borders. Never add a second accent hue.
- Every signal mark is paired with text: "Terkirim", "2/3 sudah membayar", a `sr-only` label on a paid check. Colour never carries meaning alone.
- Fills: `bg-signal` for the progress fill; `bg-signal/10` + `text-signal` for badges, cells and status text; the current-period header adds `border-b-signal` (2px). Tints stay at or below 25% opacity.
- In `globals.css` the token is declared as `--signal` in `:root` and mapped as `--color-signal` in `@theme inline`.

## Copy
- Indonesian (`id-ID`), the domain nouns from `CONTEXT.md` (Pekan, Laporan Pekan, Anggota Langsung, Iuran…). Sentence case, no eyebrows, no middle-dot meta strings, no arrows glued to labels.
- Dates: user-facing dates belong in short Indonesian form ("8–14 Nov 2026"), not raw ISO. ISO stays in data and sort keys only.

## Open items
- Dark mode is not supported: the `.dark` token block was removed; the `dark:` utilities inside UI primitives are inert until a token set and a toggle are added together.
- One accent exists: `--signal` (teal), limited to progress and settled state. A future brand accent may replace it; do not run two accents side by side.
- Dense lists are server-paged and URL-backed. `/iuran` is one 12-month ledger (one row per supervisor plus Anggota Langsung); `/klien` has search (`q`), a no-follow-up filter (`belum=1`) and 25-row pages (`hal`); the dashboard's Anggota Langsung card has name search (`q`) and 10-row pages (`hal`).
- The profile byline on `/akun` still joins name and email with a middle dot; tolerate one dot as a byline, never two in a meta line.

## Exports
Source: `src/app/globals.css` plus `src/components/ui/*` (shadcn v4, radix-nova, Tailwind v4). Tailwind, DTCG or shadcn blocks are added here on request.
