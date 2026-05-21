# Adapta-Type — Local Development Setup

## Prerequisites

- Node.js 20+ (`node -v`)
- Python 3.12+ (`python --version`)
- A [Supabase](https://supabase.com) account (free tier is fine)
- A [Sentry](https://sentry.io) account (free tier is fine) — optional for local dev

---

## Step 1 — Clone and enter the repo

```bash
git clone <your-repo-url>
cd Adapta-type
```

---

## Step 2 — Supabase

1. Go to [supabase.com](https://supabase.com) → New project → name it `adapta-type`
2. Once created, go to **Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY` (safe for frontend)
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY` (backend only, never expose)
3. Go to **SQL Editor** → New query → paste the contents of `supabase/migrations/001_initial.sql` → Run

---

## Step 3 — Backend

```bash
cd backend

# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS/Linux
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create env file
cp .env.example .env
```

Edit `backend/.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← from Supabase Settings > API
ALLOWED_ORIGIN=http://localhost:5173
SENTRY_DSN=                        ← leave blank for local dev
ENVIRONMENT=development
```

Start the server:
```bash
uvicorn app.main:app --reload
# Running at http://localhost:8000
# Docs at  http://localhost:8000/docs
```

---

## Step 4 — Frontend

```bash
cd frontend
npm install   # already done if you followed Phase 1

cp .env.example .env.local
```

Edit `frontend/.env.local`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  ← anon key (safe)
VITE_BACKEND_URL=http://localhost:8000
VITE_SENTRY_DSN=               ← leave blank for local dev
```

Start the dev server:
```bash
npm run dev
# Running at http://localhost:5173
```

---

## Step 5 — Sentry (optional for local dev, required for production)

1. Go to [sentry.io](https://sentry.io) → New Project → **React** → copy DSN → paste into `frontend/.env.local` as `VITE_SENTRY_DSN`
2. Create a second project → **Python / FastAPI** → copy DSN → paste into `backend/.env` as `SENTRY_DSN`

---

## Verifying Everything Works

### Backend health check
```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

### Submit a test session
```bash
curl -X POST http://localhost:8000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 60,
    "wpm": 65.0,
    "raw_wpm": 70.0,
    "accuracy": 92.5,
    "wpm_history": [{"t":1,"wpm":60.0,"raw":65.0,"errors":1}],
    "ngram_mistakes": {"thr": 3, "wh": 2}
  }'
# → {"ok":true}
```

Check Supabase Table Editor → `sessions` table → you should see the row.

### Rate limit test
```bash
# Run 11 times quickly; the 11th should return 429
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/sessions \
    -H "Content-Type: application/json" \
    -d '{"duration":15,"wpm":60,"raw_wpm":65,"accuracy":90,"wpm_history":[],"ngram_mistakes":{}}'
done
```

### Frontend typing test
1. Open `http://localhost:5173`
2. Click anywhere and start typing
3. Make deliberate typos — words in the next line should skew toward patterns you struggled with
4. Let the timer expire — results screen should appear with WPM graph
5. Hover over the graph — tooltip should show per-second data

---

## Environment Variable Reference

### `frontend/.env.local`
| Variable | Description | Safe to expose? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (not secret) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes (RLS enforced) |
| `VITE_BACKEND_URL` | FastAPI base URL | Yes |
| `VITE_SENTRY_DSN` | Sentry JS project DSN | Yes (browser-only) |

### `backend/.env`
| Variable | Description | Safe to expose? |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access key | **NO — never expose** |
| `ALLOWED_ORIGIN` | CORS allowed origin | Yes |
| `SENTRY_DSN` | Sentry Python project DSN | Yes |
| `ENVIRONMENT` | `development` or `production` | Yes |
