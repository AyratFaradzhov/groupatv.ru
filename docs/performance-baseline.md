# Performance baseline & audit

Foundation document for ATV-GROUP555 before heavy refactors. Use this for DevTools verification and budget tracking.

---

## 1. DevTools verification checklist

### Network

- [ ] **Cache headers**  
  - Open DevTools → Network, reload.  
  - For static assets (JS, CSS, images): check response headers for `Cache-Control` (e.g. `max-age`).  
  - Ensure HTML has appropriate cache policy (e.g. short or no-cache if dynamic).  
- [ ] **Compression**  
  - Check that responses use `Content-Encoding: gzip` or `br` where applicable.  
- [ ] **Unused requests**  
  - Identify 4xx/redirects or duplicate requests; fix or remove.

### Performance (DevTools → Performance)

- [ ] Record a load (and optionally an interaction).  
- [ ] Confirm no long tasks (> 50 ms) blocking main thread on initial load.  
- [ ] Check for layout thrashing or excessive reflows.  
- [ ] Verify no obvious memory leaks after navigation / repeated actions.

### Lighthouse

- [ ] Run Lighthouse (Desktop + Mobile) for: Performance, Accessibility, Best Practices, SEO.  
- [ ] Save reports (e.g. `lighthouse-YYYY-MM-DD.json`) for baseline comparison.  
- [ ] Compare against budgets below (LCP, CLS, TBT).

### Rendering

- [ ] **Paint / layout**  
  - Use “Rendering” → “Paint flashing” / “Layout shift regions” to spot CLS sources.  
- [ ] **Scrolling**  
  - Ensure no jank during scroll (e.g. sticky search, long lists).  
- [ ] **Cross-browser**  
  - Spot-check Chrome, Firefox, Safari, Edge for same layout and no console errors.

---

## 2. Budgets

Use these as targets; alert when exceeded.

| Resource / metric      | Budget (target)     | Notes |
|------------------------|---------------------|--------|
| **Total JS (all scripts)** | ≤ 500 KB (gzipped) | Sum of all script payloads; exclude third-party if tracked separately. |
| **Total CSS (all stylesheets)** | ≤ 150 KB (gzipped) | Sum of all CSS payloads. |
| **Total image weight (above-the-fold)** | ≤ 500 KB (per page) | LCP image + critical images; prefer WebP/AVIF. |
| **LCP (Largest Contentful Paint)** | ≤ 2.5 s | 75th percentile (mobile). |
| **CLS (Cumulative Layout Shift)** | ≤ 0.1 | 75th percentile. |
| **TBT (Total Blocking Time)** | ≤ 200 ms | 75th percentile (mobile). |

- Measure with Lighthouse or WebPageTest; re-check after major changes.  
- If a budget is exceeded, document the reason and plan a follow-up (e.g. lazy-load, code-split, image optimization).

---

## 3. Baseline checks (npm scripts)

- **`npm run audit:routes`**  
  Lists all root-level HTML pages and reports missing `<title>`, meta viewport, and meta description.  
  Does not modify files.

- **`analyze:bundle`** / **`lint:js`**  
  Added only when a bundler or linter is introduced; not required for current static + Express setup.

---

## 4. Safe refactor rules

- Do not break existing UI/UX, animations, or layouts (including Product mobile sticky glass search).  
- Do not rename or remove classes/IDs used by JS.  
- Do not change JS logic unless explicitly required.  
- Do not remove or edit: `/data/backup-products.json`, `/data/musor.json`.  
- Keep design intact; focus on optimization and cross-browser consistency.
