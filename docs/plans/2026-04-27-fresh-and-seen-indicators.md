# Fresh & Seen Indicators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a pulsing-dot fresh badge (≤7 days, with Hungarian relative-time adjective) and a muted-title seen state (after 2 s of viewing) to the newtab comic display.

**Architecture:** Small additive feature. `js/api.js` learns to keep the API's `Datum` field as a `pubDate` ms timestamp (RSS already provides one). `js/storage.js` gains `isSeen`/`markSeen` backed by a `chrome.storage.local` object map. `js/newtab.js` renders a new title-row element and runs a single cancellable 2 s timer to mark the current comic as seen. CSS handles all visual states.

**Tech Stack:** Vanilla JS (no build step), Chrome extension MV3, `chrome.storage.local`, Patrick Hand font, accent `#2ea2cc`.

**Design doc:** `docs/plans/2026-04-27-fresh-and-seen-indicators-design.md`

**Testing posture:** This repo has no automated test runner. Each task ends with a **manual verification** step performed by reloading the unpacked extension in `chrome://extensions` and observing behaviour or `chrome.storage.local` contents in DevTools. The one pure function (`freshAdjective`) gets a quick console-based assertion in Task 5.

---

## Task 1: Carry `pubDate` from random API into the normalised comic

**Why:** The random endpoint returns `Datum` as `"YYYY-MM-DD"` strings, but the current `normalizeComic` discards them. Without this, fresh badges only ever appear in Legújabb mode.

**Files:**
- Modify: `js/api.js`

**Step 1 — Read `js/api.js` to confirm current shape**

Run:
```bash
grep -n "Datum\|normalizeComic\|searchComics" js/api.js
```
Expected: `normalizeComic` returns `{url, pageUrl, title, dialogue}`; `Datum` is not referenced.

**Step 2 — Add a `parseDatum` helper near the top of the IIFE**

Insert before `function normalizeComic(raw)`:

```js
function parseDatum(s) {
  if (!s || typeof s !== 'string') return null;
  // API uses YYYY-MM-DD. Treat as local-midnight; close enough for "days old".
  const ms = Date.parse(`${s}T00:00:00`);
  return Number.isFinite(ms) ? ms : null;
}
```

**Step 3 — Extend the `normalizeComic` return**

Change the return inside `normalizeComic` from:
```js
return {
  url: entry.URL || '',
  pageUrl: entry.LapURL || entry.URL || '',
  title: entry.Cim || '',
  dialogue: entry.Parbeszed || '',
};
```
To:
```js
return {
  url: entry.URL || '',
  pageUrl: entry.LapURL || entry.URL || '',
  title: entry.Cim || '',
  dialogue: entry.Parbeszed || '',
  pubDate: parseDatum(entry.Datum),
};
```

**Step 4 — Apply the same field to `searchComics`**

Change the inline mapping in `searchComics`:
```js
return Object.values(data).map((entry) => ({
  url: entry.URL || '',
  pageUrl: entry.LapURL || entry.URL || '',
  title: entry.Cim || '',
  dialogue: entry.Parbeszed || '',
  pubDate: parseDatum(entry.Datum),
}));
```

**Step 5 — Manual verification**

1. Open `chrome://extensions`, reload "Napirajz Newtab".
2. Open a new tab, click STÉG a few times.
3. Open DevTools (Cmd+Opt+I) → Application → Storage → Extension storage → `local` → `cachedComic`.
   Expected: object now includes a numeric `pubDate` (or `null` for entries the API didn't date).
4. Console:
   ```js
   await chrome.storage.local.get('cachedComic')
   ```
   Expected: `{cachedComic: {…, pubDate: 1234567890000}}` or `pubDate: null`.

**Step 6 — Commit**

```bash
git add js/api.js
git commit -m "feat(api): preserve Datum as pubDate ms in normalizeComic"
```

---

## Task 2: Storage `isSeen` / `markSeen`

**Why:** Need a stable, O(1) seen-set keyed by the comic's most stable identifier.

**Files:**
- Modify: `js/storage.js`

**Step 1 — Add the storage key**

In the `KEYS` object near the top, add:
```js
SEEN_KEYS: 'seenKeys',
```
Final shape:
```js
const KEYS = {
  MODE: 'mode',
  SEARCH_ENGINE: 'searchEngine',
  CACHED_COMIC: 'cachedComic',
  HIGH_SCORE: 'highScore',
  SEEN_KEYS: 'seenKeys',
};
```

**Step 2 — Add `keyOf` helper inside the IIFE (above `getMode`)**

```js
function keyOf(comic) {
  if (!comic) return null;
  if (comic.pageUrl) return comic.pageUrl;
  if (comic.url) return comic.url;
  if (comic.title) return 'title:' + comic.title.toLowerCase().trim();
  return null;
}
```

**Step 3 — Add `isSeen` and `markSeen`**

After `setHighScore`, before the `return`:

```js
async function isSeen(comic) {
  const k = keyOf(comic);
  if (!k) return false;
  const map = (await get(KEYS.SEEN_KEYS)) || {};
  return Boolean(map[k]);
}

async function markSeen(comic) {
  const k = keyOf(comic);
  if (!k) return;
  const map = (await get(KEYS.SEEN_KEYS)) || {};
  if (map[k]) return; // already marked, skip write
  map[k] = true;
  await set(KEYS.SEEN_KEYS, map);
}
```

**Step 4 — Export them in the public surface**

Change the final `return` block to include the two new methods:
```js
return {
  getMode,
  setMode,
  getSearchEngine,
  setSearchEngine,
  cacheComic,
  getCachedComic,
  getHighScore,
  setHighScore,
  isSeen,
  markSeen,
};
```

**Step 5 — Manual verification (DevTools console on a newtab)**

```js
await Napirajz.Storage.isSeen({pageUrl: 'https://example/test'})
// expected: false

await Napirajz.Storage.markSeen({pageUrl: 'https://example/test'})
// expected: undefined (no return)

await Napirajz.Storage.isSeen({pageUrl: 'https://example/test'})
// expected: true

await chrome.storage.local.get('seenKeys')
// expected: {seenKeys: {'https://example/test': true}}

// Cleanup so the test entry doesn't pollute real data:
await chrome.storage.local.set({seenKeys: {}})
```

**Step 6 — Commit**

```bash
git add js/storage.js
git commit -m "feat(storage): add isSeen/markSeen for seen tracking"
```

---

## Task 3: HTML container for the fresh row

**Why:** `showComic()` needs a stable element to populate. Adding it to HTML (rather than building it in JS each call) keeps the DOM diff minimal.

**Files:**
- Modify: `newtab.html`

**Step 1 — Insert the container**

Find the line:
```html
<h2 id="comic-title"></h2>
```
Insert directly after it:
```html
<div id="comic-fresh-row" class="title-row" hidden>
  <span class="pulse-dot" aria-hidden="true"></span>
  <span class="fresh-ago"></span>
</div>
```

**Step 2 — Manual verification**

1. Reload the extension and open a new tab.
2. DevTools → Elements → search for `comic-fresh-row`.
   Expected: element exists, has the `hidden` attribute, no visible effect on the page.

**Step 3 — Commit**

```bash
git add newtab.html
git commit -m "feat(html): add fresh-row container under comic title"
```

---

## Task 4: CSS for title-row, pulse-dot, and seen state

**Why:** Style the new element + define the muted-grey seen state for the title and dot. Keeps all visual logic in one place.

**Files:**
- Modify: `css/styles.css`

**Step 1 — Append to `css/styles.css` (end of file)**

```css
/* ===== Fresh + Seen indicators ===== */
.title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--color-accent);
  margin: -8px 0 0;
}

.pulse-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 0 rgba(46, 162, 204, 0.55);
  animation: nr-pulse 1.6s ease-out infinite;
  flex-shrink: 0;
}

@keyframes nr-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(46, 162, 204, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(46, 162, 204, 0); }
  100% { box-shadow: 0 0 0 0   rgba(46, 162, 204, 0); }
}

.fresh-ago {
  color: #888;
  font-size: 0.9rem;
}

#comic-title.seen {
  color: #9a9a9a;
}

.pulse-dot.seen {
  background: #9a9a9a;
  box-shadow: none;
  animation: none;
}

.title-row:has(.pulse-dot.seen) {
  color: #9a9a9a;
}
```

**Step 2 — Manual verification**

1. Reload extension, open a new tab.
2. DevTools → Elements → select `#comic-fresh-row` → uncheck the `hidden` attribute.
3. Inside, set `<span class="fresh-ago">3 napos</span>` text.
   Expected: cyan dot pulsing on the left, "3 napos" in grey on the right, centred under the title.
4. Add the class `seen` to `#comic-title` and `.pulse-dot`.
   Expected: title fades to grey; dot turns grey, stops pulsing.
5. Re-check the `hidden` attribute when done.

**Step 3 — Commit**

```bash
git add css/styles.css
git commit -m "feat(css): pulse-dot, fresh-ago, seen muted state"
```

---

## Task 5: `freshAdjective` + render in `showComic`

**Why:** Compute the fresh state and populate the row. After this task, fresh badges visibly work end-to-end.

**Files:**
- Modify: `js/newtab.js`

**Step 1 — Add `freshAdjective` near the top of the IIFE**

After `randomButtonText()`:

```js
function freshAdjective(pubDateMs, nowMs) {
  if (!pubDateMs) return null;
  const ageHours = (nowMs - pubDateMs) / 3_600_000;
  if (ageHours < 0) return 'mai';
  if (ageHours > 168) return null;
  const days = Math.floor(ageHours / 24);
  if (days === 0) return 'mai';
  if (days === 1) return 'tegnapi';
  return `${days} napos`;
}
```

**Step 2 — Test the pure function in DevTools console**

(Paste the function definition into the console first, then run.)
```js
const HOUR = 3_600_000, DAY = 24 * HOUR, NOW = Date.now();
console.assert(freshAdjective(null, NOW) === null, 'null pub');
console.assert(freshAdjective(NOW, NOW) === 'mai', 'today');
console.assert(freshAdjective(NOW - 1*DAY, NOW) === 'tegnapi', 'yesterday');
console.assert(freshAdjective(NOW - 3*DAY, NOW) === '3 napos', '3 days');
console.assert(freshAdjective(NOW - 7*DAY, NOW) === '7 napos', '7 days exact');
console.assert(freshAdjective(NOW - 8*DAY, NOW) === null, '>7 days');
console.assert(freshAdjective(NOW + 1*HOUR, NOW) === 'mai', 'future fallback');
console.log('freshAdjective ok');
```
Expected: `freshAdjective ok` printed, no assertion errors.

**Step 3 — Render the fresh row inside `showComic(comic)`**

Inside `showComic`, after `link.href = comic.pageUrl || comic.url || '#';` and before `img.classList.add('loading');`, insert:

```js
const freshRow = document.getElementById('comic-fresh-row');
const ago = freshAdjective(comic.pubDate, Date.now());
if (ago) {
  freshRow.querySelector('.fresh-ago').textContent = ago;
  freshRow.hidden = false;
} else {
  freshRow.hidden = true;
}
```

**Step 4 — Manual verification**

1. Reload extension, open a new tab. Click "Legújabb" → click STÉG a couple of times until you land on a comic published within the last week (today's drawing usually qualifies).
   Expected: pulsing cyan dot + adjective ("mai" / "tegnapi" / "N napos") visible under the title.
2. Click "Véletlenül" → click STÉG repeatedly. Most random comics are old; the fresh row should stay hidden for those.
   Expected: no fresh row when `pubDate` is `null` or > 7 days old.
3. Force-test an old date: in console, run `Napirajz.Storage.cacheComic({title:'X', url:'', pageUrl:'', pubDate: Date.now() - 200*3_600_000});` then reload tab. Expected: cached comic shows but no fresh row.

**Step 5 — Commit**

```bash
git add js/newtab.js
git commit -m "feat(newtab): show fresh badge with relative-time adjective"
```

---

## Task 6: Seen lifecycle (timer + muted styling)

**Why:** Apply the seen state on display, persist after 2 s, cancel on rapid navigation.

**Files:**
- Modify: `js/newtab.js`

**Step 1 — Add a module-scope timer reference**

Near the top of the IIFE (next to `let latestList = []`), add:
```js
let seenTimer = null;
```

**Step 2 — Wire seen state into `showComic`**

`showComic` becomes `async` (it already calls async storage indirectly; we'll await `isSeen`). Replace the function signature and add the seen logic.

Change:
```js
function showComic(comic) {
```
To:
```js
async function showComic(comic) {
```

Inside `showComic`, **at the very start** (before `hideEl(...)`), add:
```js
if (seenTimer) {
  clearTimeout(seenTimer);
  seenTimer = null;
}
```

After the existing `title.textContent = comic.title || '';` line, add:
```js
const seen = await window.Napirajz.Storage.isSeen(comic);
title.classList.toggle('seen', seen);
```

After the fresh-row block from Task 5, add:
```js
const dot = freshRow.querySelector('.pulse-dot');
dot.classList.toggle('seen', seen);

if (!seen) {
  seenTimer = setTimeout(async () => {
    seenTimer = null;
    await window.Napirajz.Storage.markSeen(comic);
    title.classList.add('seen');
    dot.classList.add('seen');
  }, 2000);
}
```

**Step 3 — Update callers if needed**

`showComic` is called from:
- `loadComic` (already inside `async`)
- `loadNextLatest` (currently sync — change to `await window.Napirajz.Storage.cacheComic(comic);` then `await showComic(comic);` and add `async` to the function)
- The cached-comic path inside `DOMContentLoaded` (already inside `async`)
- `Search.init` callback: `(comic) => { showComic(comic); }` — no `await` needed, fire-and-forget is fine because the function self-handles its async.

Update `loadNextLatest` to:
```js
async function loadNextLatest() {
  if (latestList.length === 0) return;
  latestIndex = (latestIndex + 1) % latestList.length;
  const comic = latestList[latestIndex];
  await window.Napirajz.Storage.cacheComic(comic);
  await showComic(comic);
}
```

And the random-button click handler that calls it:
```js
randomBtn.addEventListener('click', async () => {
  randomBtn.textContent = randomButtonText();
  if (currentMode === 'latest' && latestList.length > 1) {
    await loadNextLatest();
  } else {
    await loadComic('random');
  }
});
```

**Step 4 — Manual verification**

1. Reload extension. Open DevTools console: `await chrome.storage.local.set({seenKeys: {}})` to start clean.
2. Open a new tab. Comic appears with cyan title (and pulse dot if fresh). Wait at least 2 s.
3. `await chrome.storage.local.get('seenKeys')` — expected: an entry for the current comic's `pageUrl`.
4. Reload tab. The same comic (if cached) shows up *muted grey* immediately; if a different one shows, click STÉG until the seen one returns or pick the cached one.
5. Click STÉG fast 5× within 2 s. Inspect `seenKeys` — expected: only the **last** one was added.
6. Switch mode (Random ↔ Legújabb) — same seen logic applies in both modes.

**Step 5 — Commit**

```bash
git add js/newtab.js
git commit -m "feat(newtab): mark comic seen after 2s, apply muted styling"
```

---

## Task 7: Full smoke test

**Why:** Sanity-check the five user scenarios from the design doc end-to-end before declaring done.

**Files:** none

**Step 1 — Reset state**

DevTools console on a newtab:
```js
await chrome.storage.local.set({seenKeys: {}})
location.reload()
```

**Step 2 — Run the five scenarios from the design doc**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open new tab → wait 2 s → reload | Title fades from cyan to grey on reload (or stays cyan if API gave no `pubDate` → still tracks seen via title fade). |
| 2 | Click STÉG 5× within 2 s | Only the last comic is in `seenKeys`. |
| 3 | Switch to Legújabb → click STÉG | At least one of today's comics shows `mai` + cyan pulse. |
| 4 | `await chrome.storage.local.get('seenKeys')` after browsing for ~30 s | Object map grows monotonically; one entry per unique comic visited. |
| 5 | Search a known recent comic (e.g. type a word from `Egyeb` of a recent entry, click result) → mark seen → reopen via search | Muted on second open. |

**Step 3 — Visual regression spot-check**

- The neni side characters still appear (left and right at desktop widths).
- The telex badge (bottom-right of image) still shows on telex-sourced comics — unaffected.
- Search dropdown still works.
- Offline game easter egg still triggers (click fox nose on neni2).

**Step 4 — If everything passes, no commit needed**

If smoke testing surfaces a regression, fix in a separate task and commit independently.

---

---

## Task 8: Pivot — eye icon + always-show in Legújabb

**Why:** Mid-implementation design change after Task 6 landed. (1) Replace muted-grey "seen" fade with a sketchy SVG eye icon that has a hover tooltip. (2) In Legújabb mode, render the relative-time line for every comic; pulse-dot only pulses when ≤7 days old, otherwise it's a static muted dot. See the "Iteration 2" section in the design doc for rationale and full visual treatment.

**Files:**
- Modify: `newtab.html`
- Modify: `css/styles.css`
- Modify: `js/newtab.js`

### Step 1 — HTML: add the eye-icon span

In `newtab.html`, find:
```html
<h2 id="comic-title"></h2>
<div id="comic-fresh-row" class="title-row" hidden>
```

Replace with a wrapper that contains both the title and the eye span (the eye starts `hidden`):
```html
<div class="comic-title-wrap">
  <h2 id="comic-title"></h2>
  <span
    id="seen-eye"
    class="seen-eye"
    title="Megnézted már"
    aria-label="Megnézted már"
    hidden
  >
    <svg viewBox="0 0 28 18" aria-hidden="true">
      <path d="M2 9 C 6 3, 14 1, 22 4 C 25 5, 27 8, 26 10 C 22 16, 14 17, 7 14 C 4 13, 2 11, 2 9 Z"/>
      <circle cx="14" cy="9" r="3.2"/>
      <circle cx="14" cy="9" r="1.2" fill="currentColor"/>
    </svg>
  </span>
</div>
<div id="comic-fresh-row" class="title-row" hidden>
```

### Step 2 — CSS: remove old seen rules, rename, add eye styles

In `css/styles.css`, in the "Fresh + Seen indicators" section:

- **Remove** the rule block `#comic-title.seen { color: #9a9a9a; }`.
- **Remove** the rule block `.title-row:has(.pulse-dot.seen) { color: #9a9a9a; }`.
- **Rename** `.pulse-dot.seen` to `.pulse-dot.stale` (keep its body identical):
  ```css
  .pulse-dot.stale {
    background: #9a9a9a;
    box-shadow: none;
    animation: none;
  }
  ```

Then **append** these new rules at the end of the section (before the `@media (prefers-reduced-motion: reduce)` block):

```css
.comic-title-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.seen-eye {
  display: inline-flex;
  align-items: center;
  color: #9a9a9a;
  cursor: help;
  transition: color 0.15s ease;
  flex-shrink: 0;
}

.seen-eye:hover {
  color: var(--color-text);
}

.seen-eye svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: rotate(-2deg);
}
```

### Step 3 — JS: replace `freshAdjective`, take `mode` arg, manage eye + stale

In `js/newtab.js`:

**Step 3a — Replace `freshAdjective` with `ageInDays` + `dayAdjective`**

Delete the existing `freshAdjective` function (currently around lines 14–23) and insert in its place:

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

**Step 3b — Change `showComic` signature and update the render**

Change `async function showComic(comic) {` to `async function showComic(comic, mode) {`.

Replace the **entire fresh-row + seen render block** (currently the `freshRow`/`ago`/`if (ago)`/`else` block plus the `dot` toggle plus the `setTimeout` that adds `.seen` classes) with:

```js
const freshRow = document.getElementById('comic-fresh-row');
const seenEye = document.getElementById('seen-eye');
const days = ageInDays(comic.pubDate, Date.now());
const fresh = days !== null && days <= 7;
const showRow = days !== null && (fresh || mode === 'latest');

if (showRow) {
  freshRow.querySelector('.fresh-ago').textContent = dayAdjective(days);
  freshRow.hidden = false;
} else {
  freshRow.hidden = true;
}

const dot = freshRow.querySelector('.pulse-dot');
dot.classList.toggle('stale', showRow && !fresh);

seenEye.hidden = !seen;

if (!seen) {
  seenTimer = setTimeout(async () => {
    seenTimer = null;
    await window.Napirajz.Storage.markSeen(comic);
    if (showToken !== myToken) return;
    seenEye.hidden = false;
  }, 2000);
}
```

Keep the existing `const seen = await window.Napirajz.Storage.isSeen(comic);` line (above) — only the `title.classList.toggle('seen', seen)` line that follows it must be **deleted**, since the title no longer carries the `seen` class.

**Step 3c — Update all four `showComic` call sites to pass `mode`**

| Site | Before | After |
|------|--------|-------|
| `loadComic` (in async function, currently fire-and-forget) | `showComic(comic);` | `showComic(comic, mode);` |
| `loadNextLatest` | `await showComic(comic);` | `await showComic(comic, 'latest');` |
| `DOMContentLoaded` cached path | `showComic(cached);` | `showComic(cached, currentMode);` |
| `Search.init` callback | `showComic(comic);` | `showComic(comic, 'random');` |

### Step 4 — Substitute manual verification

- `node --check js/newtab.js` — exit 0.
- `grep -nE "freshAdjective|\.seen[^-]|classList\.toggle\('seen'" js/newtab.js` — must return **no matches** (everything renamed/removed).
- `grep -nE "ageInDays|dayAdjective|stale|seenEye|seen-eye" js/newtab.js css/styles.css newtab.html` — must show all five tokens present in the expected files.
- `grep -nE "showComic\(" js/newtab.js` — every call site should pass two args (comic, mode).

Smoke pure-function test (paste into a `node -e` invocation):
```bash
node -e "
function ageInDays(p,n){if(!p) return null;const h=(n-p)/3600000;if(h<0) return 0;return Math.floor(h/24);}
function dayAdjective(d){if(d===0) return 'mai';if(d===1) return 'tegnapi';return d+' napos';}
const D=86400000, N=Date.now();
console.assert(ageInDays(null,N)===null,'null');
console.assert(ageInDays(N,N)===0,'today');
console.assert(ageInDays(N-1*D,N)===1,'1d');
console.assert(ageInDays(N-30*D,N)===30,'30d');
console.assert(ageInDays(N+3600000,N)===0,'future');
console.assert(dayAdjective(0)==='mai');
console.assert(dayAdjective(1)==='tegnapi');
console.assert(dayAdjective(14)==='14 napos');
console.log('ageInDays/dayAdjective ok');
"
```
Expected: `ageInDays/dayAdjective ok`.

### Step 5 — Commit

Recommend three commits to keep the diff reviewable:

```bash
git add newtab.html
git commit -m "feat(html): wrap title with seen-eye sketchy SVG icon"

git add css/styles.css
git commit -m "feat(css): replace seen fade with eye icon, rename .stale dot"

git add js/newtab.js
git commit -m "feat(newtab): always show relative-time in Legújabb, eye on seen"
```

Or one combined commit if the implementer prefers. Either is fine.

---

## Out of scope (for this plan)

- "Clear seen state" UI button.
- Pruning the `seenKeys` map.
- Cross-source dedup beyond what RSS already does.
- Showing seen/fresh indicators inside the search dropdown's individual result rows (the active comic still gets the indicator after selection).
