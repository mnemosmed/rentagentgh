# RentAgentGhana — Python (Django) rebuild

Django 5 app with **PostgreSQL** and **Arkesel SMS**.

## Quick start

```powershell
cd python
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Start PostgreSQL
docker compose up -d

# Configure environment
copy .env.example .env
# Add your ARKESEL_API_KEY to .env when ready

python manage.py migrate
python manage.py seed_agents
python manage.py createsuperuser
python manage.py runserver
```

Open http://127.0.0.1:8000/

## PostgreSQL

Local database via Docker Compose:

```powershell
docker compose up -d
```

Default connection (matches `.env.example`):

```
postgres://rentagentgh:rentagentgh@localhost:5432/rentagentgh
```

Set `DATABASE_URL` in `.env` for other PostgreSQL hosts (e.g. Neon, Railway).

## Arkesel SMS

Used for:

- **Phone OTP** — sign-in and agent profile claim (`accounts/services.py`)
- **Agent notifications** — when a renter sends a message or contact request (`messaging/notifications.py`)

Configure in `.env`:

```
ARKESEL_API_KEY=your-api-key-from-arkesel-dashboard
ARKESEL_SENDER_ID=RentAgent
SMS_ENABLED=True
```

| Variable | Description |
|----------|-------------|
| `ARKESEL_API_KEY` | API key from [Arkesel SMS dashboard](https://sms.arkesel.com) |
| `ARKESEL_SENDER_ID` | Registered sender ID (default: `RentAgent`) |
| `SMS_ENABLED` | `True` to send via Arkesel; `False` prints messages to the console |

When `SMS_ENABLED=False`, OTP codes and notification text appear in the terminal:

```
>>> SMS to 233542569695:
Your RentAgentGhana verification code is: 123456. Valid for 10 minutes.
```

API endpoint: `POST https://sms.arkesel.com/api/v2/sms/send` with header `api-key`.

## Environment variables

```
SECRET_KEY=
DEBUG=True
SITE_URL=http://127.0.0.1:8000
DATABASE_URL=postgres://rentagentgh:rentagentgh@localhost:5432/rentagentgh
ARKESEL_API_KEY=
ARKESEL_SENDER_ID=RentAgent
SMS_ENABLED=False
```

## Project structure

```
python/
├── config/              # Settings & URLs
├── accounts/            # Auth, OTP, Arkesel client
├── agents/              # Search, profiles, claim
├── messaging/           # Chat + agent SMS notifications
├── feedback/
├── docker-compose.yml   # PostgreSQL
└── templates/
```

## Original codebase

The React + Supabase app remains in the repo root for reference.
