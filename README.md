# Meri Seva, Mera Sankalp — Reel Competition Portal

> **Project status: PENDING (handed over on 16 Sep 2026).** Development continues on another system.
> Start with **HANDOVER.md** for the current state, next steps and decisions to preserve.

Online registration & submission portal for the **"Meri Seva, Mera Sankalp"** student reel-making
competition under **Seva Sankalp Abhiyan** (Directorate of Education, Govt. of NCT of Delhi, 17 Sep – 17 Oct 2026).
Schools register (State/UT → District → School), submit student reels (theme, title, message, consent,
video), and mark school-level shortlists. District/State evaluation, judges and reports are next —
see **BLUEPRINT.md** for the full phase-wise plan mapped to the RFP.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

`npm run dev` restarts the server automatically when you edit files.

## Project layout

```
server.js          Express API + serves the frontend and uploaded videos
src/store.js       Data layer (JSON file at data/db.json). Swap this one file to move to a real DB.
public/            Frontend (index.html, style.css, app.js) — plain HTML/CSS/JS, no build step
uploads/           Uploaded video files (served at /uploads/<file>, supports seeking)
data/db.json       Schools + entries (created on first run)
```

## Districts, schools & campaign settings

- `config/zones.json` — master list of districts (Delhi's 13 DoE education districts + one entry per other
  State/UT) with the schools in each. On registration a school picks **State/UT -> District**, then types its
  school name (the district's known schools are offered as suggestions); a new name is added to that
  district's suggestion list (kept in `data/db.json`). To bulk-load
  schools from the DoE list, paste names into the matching district's `schools` array.
- `config/settings.json` — campaign name/dates, **themes**, **status pipeline**
  (submitted → school_shortlisted → district_selected → state_selected) and reel rules. Edit without code changes.

## API

| Method | Path              | Body / notes                                              |
|--------|-------------------|-----------------------------------------------------------|
| POST   | /api/register     | `{userId, password, name, zoneId, city, state, nodalOfficer, phone, email, udise}` — only userId + password required |
| POST   | /api/login        | `{userId, password}`                                      |
| POST   | /api/logout       |                                                           |
| GET    | /api/me           | logged-in school                                          |
| PUT    | /api/me           | update school profile                                     |
| GET    | /api/zones        | zones with their school lists (public)                    |
| GET    | /api/videos       | entries of the logged-in school                           |
| GET    | /api/videos/all   | every school's entries; `?zone=<zoneId>&q=<text>` filters (text searches title/caption, description, student, roll no., class, school, zone) |
| GET    | /api/settings     | campaign settings: themes, languages, statuses, reel rules (public) |
| POST   | /api/videos       | multipart: `studentName, rollNo, class, section, caption (title), description, theme, language, durationSec, status, consentOriginal, consentParental, consentMusic, videoUrl, video(file)` — all optional |
| PUT    | /api/videos/:id   | same fields, any subset; new `video` file replaces the old |
| DELETE | /api/videos/:id   |                                                           |

## Evaluation Desk (`/staff`)

Officials log in at `/staff` (no self-registration). Roles:
- **State Admin** — everything: create/remove officials, participation report, CSV export, final "Selected for Grand Showcase".
  First run seeds `admin / admin123` (override with env `ADMIN_USER` / `ADMIN_PASS`; change it from the Officials tab).
- **District Nodal Officer** — sees their district's reels, moves them Submitted → Shortlisted → Selected for State/UT.
- **Judge** — district-level judges score their district's reels; state-level judges score district-selected reels.
  Rubric lives in `config/settings.json` (`rubric`), totals to 100; averages shown per level.

| Method | Path | Notes |
|---|---|---|
| POST | /api/staff/login · GET /api/staff/me · PUT /api/staff/me/password | official session |
| GET/POST/DELETE | /api/staff/users | admin: manage officials |
| GET | /api/eval/reels?zone=&status=&q= | reels visible to this official, with score summaries |
| POST | /api/eval/reels/:id/score | judge/admin: `{criteria:{...}, remarks}` |
| POST | /api/eval/reels/:id/status | district/admin: `{status}` (history kept in `statusHistory`) |
| GET | /api/admin/stats · /api/admin/export.csv | admin/district: participation report + CSV |

## Registration email (Brevo / Resend)

On registration the school's contact email gets a confirmation (portal link, User ID, next steps — never the password).
- **Brevo** (recommended, free 300/day): sign up at brevo.com → *Senders* → add & verify your sender email (any Gmail works) →
  *SMTP & API* → create an API key → set `BREVO_API_KEY` and `MAIL_FROM="Meri Seva Mera Sankalp <that-email>"`.
- **Resend**: set `RESEND_API_KEY`; used only when no Brevo key. Needs a verified domain to email real schools.
Without any key, emails are skipped and registration still works.

## Config

Copy `.env.example` → `.env` (or set env vars): `PORT`, `SESSION_SECRET`, `MAX_UPLOAD_MB` (default 200).

## Moving to the cloud later

- **Database:** replace `src/store.js` with Postgres (Supabase free tier) / MongoDB — the function signatures stay the same.
- **Videos:** replace multer's disk storage with S3 / Supabase Storage / Cloudinary and store the returned URL in `videoFile`.
- **Hosting:** Render, Railway or any Node host. Google Drive is not recommended as a video backend
  (OAuth setup, API quotas, no reliable streaming/seeking).
