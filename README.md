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

### Project structure

```
python/
├── accounts/     # Auth, phone OTP
├── agents/       # Search, profiles, claim flow
├── messaging/    # Chat and notifications
├── feedback/     # Renter feedback forms
├── config/       # Django settings
└── templates/
```
