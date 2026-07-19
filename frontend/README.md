# RentAgentGhana frontend (Next.js)

Primary product UI for renters and claimed agents. Django remains the API + admin.

## Setup

```powershell
copy .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — Django API should be running at `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`).

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm start` — serve production build

## Routes

- `/search`, `/agents/[id]`, `/login`, `/access` — discovery + paywall
- `/messages` — renter inbox (redirects agents to `/dashboard`)
- `/dashboard`, `/dashboard/profile` — agent inbox + profile edit
- `/agents/claim` — claim an agent listing via OTP

Authenticated browser calls go through `/api/bff/*` (httpOnly JWT cookies). Multipart uploads (chat attachments) are forwarded with the original `Content-Type` boundary.
