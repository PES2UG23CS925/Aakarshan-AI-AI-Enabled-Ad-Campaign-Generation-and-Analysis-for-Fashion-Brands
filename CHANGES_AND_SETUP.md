# Aakarshan AI - what changed and how to run it

## 1. One-time setup (do these in order)
1. **Rotate your keys.** `.env.example` (committed to git) contained your real Supabase service-role key,
   Groq key and JWT secret. Regenerate all three in their dashboards and put new values in `Backend/.env`
   (never in `.env.example`). Old keys remain in git history.
2. **Supabase > SQL Editor:** run `Backend/supabase_migration.sql`, THEN `Backend/supabase_migration_2_ab_testing.sql` (both safe to re-run).
   Optional: uncomment the last block to zero out the fake counters from the old `/simulate` endpoint.
3. `cd Backend && pip install -r requirements.txt && npm install && npm run train && npm run test:ml && npm run test:api && npm start`
4. `cd Frontend && npm install && npm run dev`
(If Python isn't found, set `PYTHON_BIN=` in `Backend/.env`.)

## 2. Views bug: causes and fixes
| Cause | Fix |
|---|---|
| Every like/share/comment/CTA click called `/simulate`, which added +1 **view** and used `Math.random()` for likes/shares/comments (fake numbers) | Real events: `POST /api/campaign/public/:id/event` with type view/like/share/comment/click |
| Refresh = new view; one person could like repeatedly; CTA button also counted as a like | Server de-dupes per anonymous visitor id: view 1/30min, like 1, share 1, click 1/10min, comment 5/hr |
| Read-then-write counters lost updates when visitors overlapped | One atomic Postgres function (`record_ad_event`) with row lock. Tested: 60 parallel visitors = exactly 60 views |
| Dashboard/report only loaded once | Auto-refresh every 10s (dashboard) / 15s (report) + on tab focus |
| Public endpoint returned the whole campaign row incl. `user_id` | Returns display fields only |
| `python3` hard-coded (fails on Windows) | Auto-detect / `PYTHON_BIN` |

## 3. ML: what was wrong and what replaced it
**Old model:** target `engagement_rate` = (likes+shares+comments)/impressions exactly (verified, max diff 1e-5),
but likes/shares/comments/impressions were also input features. The 89.9% accuracy and R2 0.994 were the
forest re-learning a formula (target leakage). Also, the categorical "best platform/day" tips came from
differences of <1 point out of 100 (noise), and sentiment/emotion were hard-coded at inference.

**New pipeline (`ml_artifacts/train.py`, results in `metrics.json`):**
1. Data audit: 163 impossible rows (>3 engagements per view) removed.
2. **Benchmark scorer**: campaign engagement rate -> percentile vs per-platform benchmark, with small-sample
   shrinkage; Gamma-Poisson posterior gives a score range, confidence and tier probabilities.
3. **Sentiment classifier** (TF-IDF + Logistic Regression) on real viewer comments.
4. **Honest experiment**: content/timing features -> engagement, 5-fold CV R2 = -0.006 (baseline 0). The dataset
   has no learnable signal there, so no pre-launch prediction is shown.

| Metric | Value | Note |
|---|---|---|
| Sentiment accuracy, dataset hold-out (n=2,400) | 93.2% (macro-F1 0.926), majority baseline 40.5% | dataset text is templated, so optimistic |
| Sentiment accuracy, unseen fashion comments (n=22) | 72.7% (macro-F1 0.714), majority baseline 36.4% | small set, treat as rough |
| Pre-launch CV R2 | -0.006 | no signal; reported, not used |

**Limitations to state in your report/viva:** the benchmark dataset is generic social-media data (10 tech/consumer
brands), not fashion ads; the fashion sentiment test set is only 22 hand-written comments; scores are relative
to that benchmark, not a prediction of future sales.

## 4. Version 4 additions
**A/B testing of ad variants** (closes the "ML feedback and optimization loop" module)
- Generate page > "A/B test all 3 with real viewers". Visitors are split evenly and deterministically (same person always sees the same variant; assignment is computed on the server, never trusted from the browser).
- Report page shows per-variant views, engagement, CTR and the probability each variant is best (Bayesian, same Gamma-Poisson model as the scorer, so tiny samples cannot "win" by luck).
- A winner is declared only at >=97.5% probability AND >=30 views per variant. Measured by simulation: false-winner rate 3.8% (2 identical variants) and ~0.2% (3 identical variants); detects a real 10% vs 14% engagement gap 74% of the time at 1,000 views per variant (25% at 300), so tell users to keep collecting data.
- "Use this variant" ends the test and locks in the chosen ad.

**Reliability:** ad-copy generator now uses JSON mode, low reasoning effort and 2,000 tokens (gpt-oss is a reasoning model whose thinking counted against the old 512-token limit), retries up to 3 times, cleans hashtags, and the template fallback now includes hashtags.

**Security:** helmet headers; rate limits (auth 30/15min, generate 20/hour, public endpoints 120/min per IP); CORS allowlist via `ALLOWED_ORIGINS`; 100kb body limit; password >= 8 chars and email validation; A/B image URLs must come from your own storage.

**Tests:** `npm run test:ml` (15 model checks incl. false-positive simulation), `npm run test:api` (24 API checks: Groq retry paths, CORS, rate limits, A/B split evenness, winner detection).

## 5. Version 4.1: variant preview links
The single A/B share link intentionally shows each visitor only ONE variant (that's what makes it
a real, unbiased test) — so there was no way to look at, or hand a reviewer, "the other ad".
Fixed with a preview mode that never touches the real stats:
- Report page > each variant card > "Preview link" copies `/ad/<id>?preview=1&v=<index>`, which always
  shows that exact variant. A dark banner on the page reminds you it's a preview.
- Liking, sharing, commenting and the CTA are disabled while previewing, and the view itself is not counted.
- The real, stat-collecting link is still the one link from "Copy & Share Ad Link" — keep using that to
  actually run the test; only use preview links to look at or demo a specific variant yourself.

## 6. Version 4.2: understanding the A/B link, and a demo-traffic seeder

**The one-link design, explained:** the single A/B share link intentionally sends each unique
visitor (by a browser-persisted id) to ONE variant via a consistent hash — that's what makes it a
real, unbiased split. It also means *your own browser* will always land on the same variant, and
that variant is the only one that gets real events from you. To get real coverage of every variant,
you need genuinely different visitors: incognito windows, other browsers/devices, or actual traffic
from your share link. The "chance it's best" number is meaningless with 0-1 real views per variant —
it's just the model's starting prior, not a verdict.

**New: `npm run demo:seed <campaignId> [visitors] [apiBase]`** — simulates many independent visitors
hitting your real, running server (via the same public endpoints a real browser would use), so your
A/B report has a believable, evenly-split dataset for a demo or viva. It is clearly fake seeded
traffic for demoing your own local project — never point it at a production deployment or someone
else's campaign, and don't present its numbers as real ad performance in your report.
```
cd Backend
npm run demo:seed <campaignId> 150
```
Get `<campaignId>` from the URL of the report page (`/performance/<campaignId>`).

**Fixed while building this:** the public endpoints' rate limiter (120 requests/min per IP) was
also being applied a second time by a catch-all `/api` limiter (300/min), so ~100 simulated visitors
was enough to trip it — and any real launch day with a burst of visitors from the same office/campus
Wi-Fi could have hit it too. Both limits are now relaxed automatically outside `NODE_ENV=production`;
a real deployment (which should set `NODE_ENV=production`) keeps the strict limits.

## 7. Version 5.0 (Phase 3 completion)
- **Live trend feed** (`services/trendService.js`, `GET /api/performance/trends?category=`): fashion-news headlines from Google News RSS (no key), scored with the same sentiment model as viewer comments, keyword frequencies = trending themes. 30-min cache; labelled offline snapshot if the feed is down. Optional "Use these trends in my ad copy" injects the themes into the LLM prompt.
- **Customer segments:** one-click persona chips on the Generate page fill the audience.
- **Speed:** image variants render in parallel when `POLLINATIONS_API_KEY` is set (`IMAGE_CONCURRENCY` overrides); per-stage timings (`copy_ms`, `image_ms`) are returned.
- **Pollinations fix:** moved to `gen.pollinations.ai` with Bearer key; clear errors for 401/402.
- **Deployment:** `Backend/Dockerfile`, `render.yaml`, `Frontend/vercel.json`; see DEPLOYMENT.md.
- **Tests:** `npm run test:api` now also runs `tests/trends_and_images.test.js` (18 checks). Total 15 ML + 50 API checks.


---
## Version 5.1.0 - final release
New in this release (all covered by tests; run `npm run test:api` and `npm run test:ml` in `Backend/`):

1. **Role-based admin console.** `users.role` (`user` | `admin`, migration 3), `middleware/adminMiddleware.js`, `routes/admin.js` (`/overview`, `/users`, `PATCH /users/:id/role`, `/logs`) and `Frontend/src/pages/AdminPage.jsx`. An admin cannot demote themselves.
2. **Request log buffer.** `middleware/requestLogger.js` and `services/logBuffer.js` keep the last 300 requests (method, path without query string, status, duration) in memory for the Logs tab.
3. **Report export (FR-14).** `GET /api/performance/report/:id?format=csv|json` and a **Download report (CSV)** button on the performance page. CSV cells that start with `=`, `+`, `-` or `@` are neutralised against spreadsheet formula injection.
4. **`GET /api/auth/me`** returns the profile and role; the navigation uses it to show the Admin link.
5. **Base schema** (`supabase_migration_0_base_schema.sql`) so a new Supabase project can be set up from the repository alone. All four migrations were run on a clean PostgreSQL 16 and re-run to confirm they are idempotent; `record_ad_event` was exercised for duplicate handling, bad input and 60 concurrent visitors.
6. **Evaluation script** `ml_artifacts/evaluate.py` regenerates every figure and number quoted in the report into `ml_artifacts/evaluation/`. `train.py` now exposes `make_sentiment_pipeline()` and `prelaunch_matrix()` for reuse (results unchanged).
7. **Packaging and docs:** `docker-compose.yml`, `Frontend/Dockerfile` + `nginx.conf`, GitHub Actions CI, `README.md`, `docs/openapi.yaml`, `docs/ML_EVALUATION.md`; server banner and `/` endpoint now report the version from `package.json`.
8. **Secrets:** the shipped archive no longer contains `Backend/env` or `Frontend/.env`. Create them from the `.env.example` files, and rotate any keys that were in the earlier archive.


## v5.2.0 - report cleanup and production hardening
- Performance report: removed "Engagement vs benchmark", "What's driving the score", "Audience sentiment" and "Last 14 days" cards.
- A/B: every variant has its own tracked link (`/ad/<id>?v=N`); preview links (`&preview=1`) are not counted.
- ML runs in one long-lived Python worker (fast reports); all rates are capped at 100%.
- Server: fails fast on missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, graceful SIGTERM shutdown, crash handlers, keep-alive tuned for load balancers.
- Docker: backend runs as non-root with a HEALTHCHECK. nginx: gzip, no-cache index.html, Permissions-Policy.
- Frontend: error boundary, network-safe API client, Dashboard retry banner.

### Production checklist
1. Run the four `supabase_migration*.sql` files in order in the Supabase SQL editor.
2. Set env vars (see Backend/.env.example); set `NODE_ENV=production` and `ALLOWED_ORIGINS` to your frontend URL(s).
3. Build the frontend with `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Never commit `.env`; rotate any key that was ever shared.
5. CI (`.github/workflows/ci.yml`) must be green before deploying.
