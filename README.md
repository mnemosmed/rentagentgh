# RentAgentGhana

Finding an apartment in Accra is harder than it should be. Renters chase agents across TikTok, WhatsApp, and word of mouth — repeating the same budget, room count, and move-in date to people who may not even cover their area.

**RentAgentGhana** solves that. Renters search by neighborhood, browse agents who serve that area (sorted by ratings), and unlock contacts + messaging with a weekly or monthly pass.

## Architecture

Monorepo with two apps:

| App | Stack | Role |
|-----|--------|------|
| `frontend/` | Next.js 15 (App Router) + Tailwind | Modern renter UI |
| `python/` | Django 5 + DRF + SimpleJWT | API + legacy HTML UI |

```
Browser → Next.js (Vercel) → JWT Bearer → Django API (Render) → Postgres / Paystack / Arkesel
```

Phase 1 Next.js pages: landing, search, agent profile, phone login, access purchase.
Messaging and agent dashboard still use the Django templates for now.

## Local development

### 1. Django API

```powershell
cd python
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

docker compose up -d
copy .env.example .env

python manage.py migrate
python manage.py seed_agents
python manage.py runserver
```

API health: http://127.0.0.1:8000/api/health/

### 2. Next.js frontend

```powershell
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000/

### Environment

**Django** (`python/.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `FRONTEND_URL` | Next.js origin (CORS/CSRF), e.g. `http://localhost:3000` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `ARKESEL_API_KEY` | SMS for OTP |
| `SMS_ENABLED` | `False` logs SMS to console in development |
| `SITE_URL` | Public Django URL (webhooks / legacy links) |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | Payments |
| `RENTER_WEEKLY_AMOUNT_GHS` / `RENTER_MONTHLY_AMOUNT_GHS` | Plan prices (default 5 / 18) |

**Next.js** (`frontend/.env.local`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Django base URL, e.g. `http://127.0.0.1:8000` |

### Key API routes

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/phone/send/` | Send OTP |
| POST | `/api/auth/phone/verify/` | Verify OTP → JWT |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET | `/api/me/` | Current user + access status |
| GET | `/api/areas/` | Area list |
| GET | `/api/agents/search/?area=` | Auth required |
| GET | `/api/agents/<uuid>/` | Agent detail (contacts gated) |
| GET | `/api/payments/plans/` | Weekly/monthly plans |
| POST | `/api/payments/unlock/` | Start Paystack checkout |
| GET | `/api/payments/confirm/?reference=` | Verify payment |

Paystack webhook stays at `POST /payments/webhook/`.

Auth from the browser uses Next.js httpOnly cookies + a BFF proxy at `/api/bff/*`.

## Payments

- **Weekly** — GHS 5 for 7 days
- **Monthly** — GHS 18 for 30 days

Checkout returns to the Next.js page `/access/callback`, which calls `/api/payments/confirm/`.

## Deploy

**Django (Render)** — use root `render.yaml` (`rootDir: python`). Set `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` to your Vercel URL.

**Next.js (Vercel)** — import the `frontend/` directory (or root with framework preset pointing at `frontend`). Set `NEXT_PUBLIC_API_URL` to the Render API URL.

Set Paystack webhook to `https://<django>.onrender.com/payments/webhook/`.

## Project structure

```
frontend/                 # Next.js renter UI
python/
├── api/                  # DRF + SimpleJWT endpoints
├── accounts/             # Auth, phone OTP
├── agents/               # Search, profiles, claim flow
├── messaging/            # Chat and notifications
├── payments/             # AccessPass + Paystack
├── templates/            # Legacy server-rendered HTML
└── ...
render.yaml
```
