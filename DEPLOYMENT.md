# Deployment (free tiers)

## Backend -> Render
1. Push this project to GitHub (make sure `Backend/.env` and `Backend/env` are NOT committed).
2. render.com > New > Blueprint > pick the repo (it reads `render.yaml`) — or New > Web Service > Docker, root `Backend`.
3. Fill the environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `POLLINATIONS_API_KEY`, `ALLOWED_ORIGINS` (your Vercel URL, set after step 5).
4. Open `https://<service>.onrender.com/api/health` -> `{"status":"healthy"}`.

## Frontend -> Vercel
5. vercel.com > New Project > same repo, Root Directory `Frontend`, framework Vite. Environment variables:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` = the Render URL.
6. Deploy, copy the Vercel URL into Render's `ALLOWED_ORIGINS`, and redeploy the backend.

## Smoke test
Register > Generate (3 images) > share link in incognito > like/click > Report page updates > A/B test.
Note: Render free tier sleeps after inactivity; open the health URL a minute before a demo.

## Final-release additions (v5.1)
* **Fresh Supabase project?** Run `supabase_migration_0_base_schema.sql` first (it creates `users`, `campaigns` and the public `campaign-images` bucket), then the other three migrations in order.
* **Admin access:** after registering, run `update public.users set role = 'admin' where email = 'you@example.com';` in the SQL editor.
* **Local full stack:** `docker compose up --build` (see `docker-compose.yml`). The frontend image bakes in the three `VITE_*` values at build time.
* **CI:** `.github/workflows/ci.yml` retrains the model, runs the ML and API tests, builds the frontend and uploads the evaluation figures.
* **Keys:** rotate the Supabase service-role key, Groq key and Pollinations key if they were ever stored in a shared file or repository.
