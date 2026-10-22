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
