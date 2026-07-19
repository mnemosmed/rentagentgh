# RentAgentGhana

Finding an apartment in Accra is harder than it should be. Renters chase agents across TikTok, WhatsApp, and word of mouth — repeating the same budget, room count, and move-in date to people who may not even cover their area. There is no simple way to discover which agents actually work in East Legon, Madina, Cantonments, or Osu, or to keep those conversations in one place.

**RentAgentGhana** solves that. Renters search by neighborhood, browse agents who serve that area (sorted by ratings), and send a structured rental request in seconds. Agents get notified by SMS and can reply on the platform — whether they have claimed their profile or not.

## What it does

- **Search by area** — find agents by the neighborhoods they cover, not random listings
- **Structured requests** — budget, bedrooms, move-in date, and notes sent in one message
- **In-platform chat** — keep renter–agent conversations in one thread
- **Agent profiles & ratings** — compare agents before you reach out
- **SMS notifications** — agents are alerted when someone contacts them
- **Profile claiming** — agents verify ownership of their listing via phone OTP

## Who it is for

- **Renters** in Accra looking for a faster, clearer way to reach rental agents
- **Rental agents** who want inquiries from people searching in areas they actually serve

## For developers

The app is a Django 5 project with PostgreSQL and Arkesel SMS, in the `python/` directory.

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

Open http://127.0.0.1:8000/

### Environment

Copy `python/.env.example` to `python/.env` and configure:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (default: `localhost:5433`) |
| `ARKESEL_API_KEY` | SMS for OTP and agent notifications |
| `SMS_ENABLED` | Set `False` to log SMS to the console in development |
| `SITE_URL` | Public URL used in SMS links |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (server-side charges + webhook signature) |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `CONTACT_UNLOCK_AMOUNT_GHS` | Fee a renter pays to unlock an agent (GHS). `0` = free |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated HTTPS origins (required in production) |

### Payments (Paystack)

Renters pay a one-time fee per agent to unlock contacting them (send a request +
see phone/WhatsApp). Flow:

1. Renter clicks **Unlock contact** → `POST /payments/unlock/<agent_id>/`
2. Server creates a `ContactUnlock` and calls Paystack `transaction/initialize`,
   then redirects to Paystack checkout.
3. Paystack redirects back to `/payments/callback/`, which verifies the charge.
4. A signed webhook at `/payments/webhook/` (HMAC-SHA512) confirms server-to-server.

Set the webhook URL in the Paystack dashboard to
`https://<your-app>.onrender.com/payments/webhook/`.

### PWA

The app is installable and works offline for cached pages:

- `/manifest.webmanifest` — app manifest (name, icons, theme)
- `/sw.js` — service worker (network-first pages, cache-first static, offline fallback)
- Icons live in `python/static/icons/`

### Deploy to Render

The repo ships a `render.yaml` blueprint (web service + free PostgreSQL).

1. Push to GitHub.
2. In Render: **New +** → **Blueprint** → select this repo.
3. Set the secret env vars (`PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`,
   `ARKESEL_API_KEY`, `SITE_URL`, `CSRF_TRUSTED_ORIGINS`) in the dashboard.
4. Render runs `python/build.sh` (collectstatic + migrate + seed) and serves via
   Gunicorn + WhiteNoise.

### Project structure

```
python/
├── accounts/     # Auth, phone OTP
├── agents/       # Search, profiles, claim flow
├── messaging/    # Chat and notifications
├── feedback/     # Renter feedback forms
├── payments/     # Paystack contact-unlock payments
├── config/       # Django settings
├── static/       # CSS, JS, PWA icons
└── templates/    # Server-rendered HTML + PWA offline page
```

Root-level files: `render.yaml` (Render blueprint), `python/build.sh`,
`python/Procfile`, `python/runtime.txt`.
