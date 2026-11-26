# Aakarshan AI

AI-enabled ad campaign generation and analysis for fashion brands (PES University, UE23CS441A Capstone Phase 3, team 191).

A brand enters a few campaign details. The platform writes the headline, copy, call-to-action and hashtags with a large language model, creates three alternative campaign photographs, composes each into a platform-sized ad, and publishes a share link. Real viewers open that link; their views, likes, shares, comments and clicks are stored and turned into a benchmark-based performance score, a comment-sentiment summary, an A/B test result and plain-language recommendations.

## How it fits together

```
React (Vite) ──HTTPS/JSON──> Express API ──> Groq (gpt-oss-120b)         ad copy
   /ad/:id public page            │       ──> Pollinations (Flux)         3 campaign photos
   /performance/:id dashboard     │       ──> @napi-rs/canvas             ad composition
   /admin console                 │       ──> Python (scikit-learn)       score, sentiment, A/B
                                  └─────────> Supabase                    Postgres, Auth, Storage
```

| Folder | What is in it |
|---|---|
| `Backend/server.js`, `routes/`, `services/`, `middleware/` | REST API: auth, campaigns, performance, admin; request-log buffer |
| `Backend/ml_artifacts/` | `train.py`, `inference.py`, `evaluate.py`, `test_ml.py`, dataset, trained model and metrics, `evaluation/` figures |
| `Backend/tests/` | API test suites with an in-memory Supabase fake (no network needed) |
| `Backend/*.sql` | Database set-up, run in order 0 → 1 → 2 → 3 (see below) |
| `Frontend/` | React 18 + Vite + Tailwind single-page app |
| `docs/` | `openapi.yaml` (API reference) and `ML_EVALUATION.md` |
| `Dockerfile`s, `docker-compose.yml`, `render.yaml`, `.github/workflows/ci.yml` | Packaging, deployment and CI |

## Quick start

1. **Database.** Create a free Supabase project. In the SQL editor run, in this order:
   `Backend/supabase_migration_0_base_schema.sql` (new projects only), `supabase_migration.sql`,
   `supabase_migration_2_ab_testing.sql`, `supabase_migration_3_roles.sql`.
2. **Keys.** Copy `Backend/.env.example` to `Backend/.env` and fill in the Supabase URL and service-role key, a Groq key and a Pollinations key. Copy `Frontend/.env.example` to `Frontend/.env` (Supabase URL, anon key, API URL). Never commit these files.
3. **Backend.** `cd Backend && npm install && pip install -r requirements.txt && npm run train && npm start`
4. **Frontend.** `cd Frontend && npm install && npm run dev` and open http://localhost:5173
5. **First admin.** Register in the app, then run in the SQL editor:
   `update public.users set role = 'admin' where email = 'you@example.com';` An **Admin** tab appears in the navigation.

Or run everything with Docker: `cp .env.example .env && cp Backend/.env.example Backend/.env && docker compose up --build` (app on :8080, API on :5000).

## Scripts (in `Backend/`)

| Command | Purpose |
|---|---|
| `npm run train` | Re-train the sentiment model and rebuild the benchmark from `dataset.csv` |
| `npm run test:ml` | 15 checks on the ML artifacts |
| `npm run test:api` | 79 checks across four API suites (auth, generation, A/B, events, trends, admin, reports) |
| `npm run evaluate` | Reproduce every figure and number used in the report (`ml_artifacts/evaluation/`) |
| `npm run demo:seed` | Fill a campaign with synthetic viewer traffic for demos |

## Main API routes

Full reference: `docs/openapi.yaml`.

| Route | Access | Purpose |
|---|---|---|
| `POST /api/auth/register`, `/login`, `GET /api/auth/me` | public / token | Accounts and profile role |
| `POST /api/campaign/generate` | token | Copy + three composed images |
| `POST /api/campaign/:id/select-image`, `/start-ab` | token | Choose a variant or start an A/B test |
| `GET /api/campaign/public/:id`, `POST .../event` | public | What viewers see; records one viewer action |
| `POST /api/performance/analyze/:id` | token | Score, tier, range, sentiment, recommendations |
| `GET /api/performance/ab/:id`, `/timeline/:id`, `/dashboard`, `/trends`, `/insights` | token | Analytics views |
| `GET /api/performance/report/:id?format=csv\|json` | token | Downloadable campaign report |
| `GET /api/admin/overview`, `/users`, `/logs`, `PATCH /users/:id/role` | admin | Monitoring and role management |

## What the analytics do (and do not) claim

* **Performance score** = percentile of the ad's engagement rate among 11,837 benchmark posts on the same platform, with small-sample shrinkage so that a few lucky views cannot give a top score. A score range and a confidence label are always shown.
* **Sentiment** = TF-IDF + logistic regression: 93.2 % accuracy on the held-out dataset comments, 72.7 % (16 of 22) on hand-written fashion comments the model never saw.
* **A/B test** = Bayesian comparison; a winner needs a 97.5 % probability of being best and at least 30 views per variant.
* **Pre-launch prediction was tested and rejected.** A random forest on content and timing features scored R² = −0.006 in 5-fold cross-validation, so the app does not show a pre-launch prediction.
* The benchmark is a public social-media dataset, not fashion-specific; the UI says so.

Details and figures: `docs/ML_EVALUATION.md`.

## Security notes

Service-role and API keys exist only in `Backend/.env` on the server. The public anon key is the only secret-like value in the browser. Row-level security is enabled on all tables with no public policies; the API (service role) is the only writer. Rotate any key that was ever committed or shared.

## Limitations

Viewer data come from share links, so volumes in a student demo are small. The language model and image provider are third-party services; their latency dominates ad generation. Still images only. The in-memory log buffer resets on restart.

## Version history

| Version | Summary |
|---|---|
| 3.x (Phase 2) | React/Express/Supabase prototype, Llama 3.3 70B copy, Imagen 4.0 image, one composed ad |
| 5.0.0 (Phase 3) | Three image variants, public share page, real events, benchmark scorer, sentiment model, Bayesian A/B, trend feed, Docker/Render/Vercel deployment |
| 5.1.0 (final) | Admin console with roles, request logs, CSV/JSON report export, base schema and role migrations, evaluation script and figures, docker-compose, CI, OpenAPI and README |
