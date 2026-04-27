# Fresh & Seen Indicators — Design

Date: 2026-04-27
Status: Approved (brainstorm). **Iteration 2 patch below supersedes the seen-indicator and Legújabb-relative-time sections.**

## Goal

Two minimalist title-row indicators on the displayed comic:

- **Fresh** — when the comic is at most 7 days old (≤168 h from `pubDate`), show a pulsing cyan dot beside the title with a Hungarian adjective: `mai`, `tegnapi`, or `N napos`.
- **Seen** — once the user has viewed a comic for ≥2 seconds in any mode, persist a "seen" mark for it. On future displays, mute the title (cyan → grey) and stop the pulse animation.

Both indicators live in the title area; nothing is overlaid on the drawing itself. They apply to **all modes** — random, latest, search results, and the cached-on-load comic.

## Non-goals

- Cross-source dedup beyond what already exists (current RSS title-dedup precedent is reused).
- A "clear seen state" UI. Storage is `chrome.storage.local` (5 MB); thousands of seen-keys is fine. Add later if asked.
- Fresh-status filtering or sorting.
- Backend or sync across devices.

## Components touched

| File | Change |
|------|--------|
| `js/api.js` | `normalizeComic()` parses `Datum` (YYYY-MM-DD) → `pubDate` ms. Random and RSS both populate `comic.pubDate`. |
| `js/storage.js` | Add `isSeen(comic)` and `markSeen(comic)`. Storage shape: `seenKeys: { [key]: true }` (object map for O(1) lookup). |
| `js/newtab.js` | In `showComic()`: render the title-side row, apply `.seen` class to title when applicable, schedule a cancellable 2 s `markSeen` timer. |
| `css/styles.css` | New rules: `.title-row`, `.pulse-dot` (with pulse keyframes), `.fresh-ago`, `#comic-title.seen`, `.pulse-dot.seen`. |
| `newtab.html` | Insert `<div id="comic-fresh-row" class="title-row" hidden></div>` between `#comic-title` and `#comic-link`. |

## Storage key

```
key(comic) = comic.pageUrl || comic.url || 'title:' + comic.title.toLowerCase().trim()
```

Same key for `isSeen` and `markSeen`. Mirrors the existing RSS dedup that uses the normalised title, so cross-source matches stay consistent with the rest of the app.

## Fresh logic

Pure function in `newtab.js`:

```js
function freshAdjective(pubDateMs, nowMs) {
  if (!pubDateMs) return null;
  const ageHours = (nowMs - pubDateMs) / 3_600_000;
  if (ageHours < 0) return 'mai';     // future date safety
  if (ageHours > 168) return null;    // > 7 days
  const days = Math.floor(ageHours / 24);
  if (days === 0) return 'mai';
  if (days === 1) return 'tegnapi';
  return `${days} napos`;
}
```

Rendered into `#comic-fresh-row`:

```html
<span class="pulse-dot" aria-hidden="true"></span>
<span class="fresh-ago">3 napos</span>
```

When `freshAdjective` returns `null`, the row stays `hidden`.

## Seen lifecycle

A single module-scope timer reference in `newtab.js`:

```js
let seenTimer = null;
```

In `showComic(comic)`:

1. Cancel any pending `seenTimer` (`clearTimeout`).
2. Compute `seen = await Storage.isSeen(comic)`. Apply `.seen` class to `#comic-title` and `.pulse-dot` accordingly.
3. Render the fresh row from `freshAdjective(comic.pubDate, Date.now())`.
4. If not already seen, schedule:
   ```js
   seenTimer = setTimeout(() => {
     Storage.markSeen(comic);
     document.getElementById('comic-title').classList.add('seen');
     const dot = document.querySelector('#comic-fresh-row .pulse-dot');
     if (dot) dot.classList.add('seen');
   }, 2000);
   ```

If `showComic` runs again before the 2 s elapses (STÉG click, mode switch, search pick), the prior timer is cancelled — fast-clicking through a stack does not mark every visited comic as seen.

## Visual treatment (CSS)

```css
.title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--color-accent);
}

.pulse-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 0 rgba(46, 162, 204, 0.55);
  animation: nr-pulse 1.6s ease-out infinite;
}
@keyframes nr-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(46, 162, 204, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(46, 162, 204, 0); }
  100% { box-shadow: 0 0 0 0   rgba(46, 162, 204, 0); }
}

.fresh-ago { color: #888; font-size: 0.9rem; }

/* Seen state — same shape, muted color, no animation */
#comic-title.seen { color: #9a9a9a; }
.pulse-dot.seen   { background: #9a9a9a; box-shadow: none; animation: none; }
.title-row:has(.pulse-dot.seen) { color: #9a9a9a; }
```

## Data flow

```
loadComic(mode)
   └→ showComic(comic)
        ├→ clearTimeout(seenTimer)
        ├→ render image + title (existing)
        ├→ render #comic-fresh-row from comic.pubDate
        ├→ Storage.isSeen(comic) → apply/skip .seen class
        └→ if not seen: seenTimer = setTimeout(markSeen, 2000)
```

## Edge cases

| Case | Behaviour |
|------|-----------|
| `pubDate` missing | Fresh row stays hidden. No fresh badge, ever. |
| `pubDate` in the future (typo, clock skew) | Treated as `mai`. |
| Storage write fails (extension reload mid-write) | Silently ignored. Seen is best-effort and never blocks UI. |
| Cached comic shown on page load | Same flow as any other display — including the 2 s timer. If already seen, renders muted immediately. |
| Same comic appears from two sources (telex + napirajz) | Existing RSS dedup keeps one. The seen key uses `pageUrl`, so each surviving entry tracks independently — acceptable for v1. |
| `seenKeys` storage growth | Object map of strings → booleans. Storage budget is 5 MB; even tens of thousands of keys fit easily. No pruning. |

## Testing

Manual smoke test on `chrome://extensions` with the unpacked extension reloaded:

1. Open a new tab → comic appears. Title cyan, pulse-dot present if ≤7 days, else just the title. Wait 2 s; reload tab; comic now muted.
2. Click STÉG fast 5 times within 2 s → only the *last* one becomes seen.
3. Switch to Legújabb mode → at least the latest comic of the day shows `mai` and pulse.
4. Open dev-tools → `chrome.storage.local.get('seenKeys', console.log)` → keys grow as expected.
5. Search a known recent comic → fresh row shows; mark seen; reopen via search → muted.

No automated tests in this repo; visual confirmation in browser is the bar.

---

## Iteration 2 — Eye icon + always-show in Legújabb (2026-04-27)

After the original design landed in code through Task 6, two changes were requested:

### Seen indicator: sketchy SVG eye instead of muted-grey fade

- The `.seen` class no longer mutes the title or the pulse-dot.
- Instead, a small sketchy SVG eye icon appears inline next to the title once the comic is marked seen.
- Outlined stroke (currentColor), 22×22, slight `-2deg` rotation to match the hand-drawn theme.
- Default colour: `#9a9a9a`. On hover: darkens to `var(--color-text)`. Cursor `help`.
- HTML tooltip: `title="Megnézted már"` (browser-native on hover). Also `aria-label="Megnézted már"` for screen readers.
- Eye element starts `hidden`; revealed by removing `hidden` (same pattern as `#telex-badge`).

### Legújabb mode shows relative-time for every comic

- In **Legújabb** mode, the title-row renders for every comic that carries a `pubDate`, regardless of age (`14 napos`, `30 napos`, …).
- The **pulse animation** still means "fresh" — pulses only when ≤7 days old. Older comics in Legújabb get a static muted dot via `.pulse-dot.stale`.
- In **Random** and **Search** modes, behaviour is unchanged — title-row hidden for >7-day comics.
- `showComic` gains a `mode` parameter. Callers pass their current mode (`'random'`, `'latest'`, or omit/default for one-off renders).

### Helper-function refactor

`freshAdjective` is replaced by two simpler helpers, used together:

```js
function ageInDays(pubDateMs, nowMs) {
  if (!pubDateMs) return null;
  const ageHours = (nowMs - pubDateMs) / 3_600_000;
  if (ageHours < 0) return 0;
  return Math.floor(ageHours / 24);
}

function dayAdjective(days) {
  if (days === 0) return 'mai';
  if (days === 1) return 'tegnapi';
  return `${days} napos`;
}
```

`showComic` decides visibility from `days` and `mode`:

```js
const days = ageInDays(comic.pubDate, Date.now());
const fresh = days !== null && days <= 7;
const showRow = days !== null && (fresh || mode === 'latest');
```

### CSS changes

- Remove `#comic-title.seen { color: #9a9a9a; }`.
- Remove `.title-row:has(.pulse-dot.seen) { color: #9a9a9a; }`.
- Rename `.pulse-dot.seen` → `.pulse-dot.stale` (same muted + no-animation styling).
- Add `.seen-eye` rules: inline-flex layout, muted default, hover darken, slight tilt, `currentColor`-stroked SVG.

### Storage

Unchanged. `isSeen` / `markSeen` API and the `seenKeys` storage shape are kept as-is.

### Edge cases (delta only)

| Case | Behaviour |
|------|-----------|
| Comic in Legújabb mode with `pubDate === null` | Title-row stays hidden — we have nothing to show. |
| Comic in Random with `pubDate > 7 days` | Title-row hidden (unchanged). |
| Seen comic in Legújabb mode | Eye icon visible, pulse-dot may be stale or pulsing depending on age. |
| Cancellation of 2 s timer | Same behaviour — clear timer, do not reveal eye. |

