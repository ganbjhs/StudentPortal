# Project Handover — Meri Seva, Mera Sankalp Portal

**Project status:** PENDING — development paused on this machine and handed over for continuation on another system.
**Handover date:** 16 September 2026
**Handed over by:** Tilak Tiwari (ganbjhs@gmail.com)
**Repository:** https://github.com/ganbjhs/StudentPortal (branch `main`)
**Live deployment:** https://studentportal-production-9d28.up.railway.app (Railway, persistent volume at `/data`)

---

## 1. Purpose of this document

This document allows a new developer to pick up the project from its current state without prior context. It records what has been delivered, what remains, how to run the application, and the decisions that should not be reversed without consulting the client. Please read this file together with `README.md` (operational guide) and `BLUEPRINT.md` (product plan mapped to the RFP).

## 2. Project summary

The portal supports the "Meri Seva, Mera Sankalp" student reel competition under the Seva Sankalp Abhiyan campaign of the Directorate of Education, Government of NCT of Delhi (17 September – 17 October 2026, Grand Showcase on 17 October at Chhatarsal Stadium). Schools register, submit entries (reels or drawings, by students or teachers) with consent declarations, and shortlist at school level. District officers, judges and the State Admin evaluate entries through the Evaluation Desk at `/staff` following the pipeline Submitted → Shortlisted for District → Selected for State/UT → Selected for Grand Showcase.

## 3. Current state of delivery

| Phase | Scope | Status |
|---|---|---|
| Phase 0 | Prototype: registration, login, upload, edit/delete, search | Completed (14 Sep) |
| Phase 1 | RFP alignment: branding, 13 DoE districts, themes, consent, status pipeline | Completed (15 Sep) |
| Phase 2 | Evaluation pipeline: roles, judge scoring (rubric of 100), district desk, State Admin, CSV export, status history | Core completed (15 Sep) |
| Phase 2b | Participant and entry categories, School ID, school-only view, config-driven category lists | Completed (15 Sep) |
| Phase 2 remainder | Per-district selection cap, downloadable consent template PDF, guidelines page | **Pending** |
| Phase 3 | Reporting and documentation: per-day counts, Excel export, printable score sheets, bulk school import, notifications | **Pending** (target 23–27 Sep) |
| Phase 4 | Production readiness: Postgres, object storage, custom domain, rate limiting, password reset, audit log, load check | **Pending** (target 1 Oct) |
| Phase 5 | Showcase and archive: playlist builder, bulk download, final archive and report | **Pending** (10–17 Oct) |

The application is stable and deployable in its current form. The last commit on `main` is `4af9b43 — Participant & entry categories, School ID, school-only view`.

## 4. Immediate next steps for the incoming developer

1. Clone the repository (or extract this ZIP), run `npm install` and `npm start`, and confirm the portal opens at `http://localhost:3000` and the Evaluation Desk at `http://localhost:3000/staff` (default credentials `admin` / `admin123`, to be changed on first use).
2. Read the three requirement PDFs in the project root (`Portal-Service-Requirements.pdf`, `Portal-Requirements-Short.pdf`, `AWS-Deployment-Plan.pdf`) and the RFP material under `data/`. The AWS deployment plan describes the intended production hosting and should guide Phase 4.
3. Resolve the open questions in `BLUEPRINT.md` section 5 with the client (DoE / agency) before building Phase 3 reports, since quotas, rubric weights and consent requirements affect the data model.
4. Complete the Phase 2 remainder items, then proceed to Phase 3.
5. Obtain access to the Railway project and the GitHub repository from the current owner before the first deployment.

## 5. How to run

```bash
npm install
cp .env.example .env      # adjust PORT, SESSION_SECRET, MAX_UPLOAD_MB as needed
npm start                 # or: npm run dev (auto-restart on file changes)
```

Requirements: Node.js 18 or later (developed and tested on Node 22). No build step is required; the frontend is plain HTML, CSS and JavaScript served by Express.

## 6. Repository layout

```
server.js                    Express API, session handling, static serving, upload handling (multer)
src/store.js                 Data layer over data/db.json — the only file to replace when moving to Postgres
src/mail.js                  Registration email via Brevo or Resend (optional; skipped when no API key is set)
public/index.html, app.js    School portal (registration, login, entries, school-level shortlist)
public/staff.html, staff.js  Evaluation Desk (State Admin, District Nodal Officer, Judge)
public/style.css             Single-tone charcoal-on-white theme
config/settings.json         Campaign details, themes, participant/entry types, status pipeline, scoring rubric
config/zones.json            Active district list (Delhi's 13 DoE education districts + other States/UTs)
config/zones-all-india.json  Full all-India district list, kept for reference
data/db.json                 JSON database (schools, entries, officials, scores); created on first run
uploads/                     Uploaded video/image files, served at /uploads/<file>
```

## 7. Environment and credentials

- `.env` is intentionally excluded from the repository and from this ZIP. Use `.env.example` as the template.
- Do not commit real API keys. The Brevo/Resend keys and the Railway `SESSION_SECRET` are held by the current owner and must be requested separately.
- The seeded State Admin account (`admin` / `admin123`, overridable via `ADMIN_USER` / `ADMIN_PASS`) must be changed before any real use.
- `data/db.json` in this package contains only the seeded admin account; no school or student data is included.

## 8. Decisions to preserve

- Delhi's 13 DoE education districts are the active district list, as required by the tender. The all-India list is retained in `config/zones-all-india.json` but is not wired in.
- Category lists (participant types, entry types, themes, statuses, rubric) are configuration-driven in `config/settings.json`. New categories should be added there, not in code.
- Schools can see only their own entries; all cross-school views live in the Evaluation Desk.
- The language field was deliberately removed from the entry form and data model.
- The visual theme is a single-tone charcoal-on-white palette with a plain "MS" monogram; the client asked that multicolour accents not be reintroduced.

## 9. Known limitations

- The JSON-file database and disk uploads are suitable for development and pilot use only. Phase 4 moves them to Postgres and object storage; `src/store.js` and the multer storage configuration are the two swap points.
- There is no password reset flow, rate limiting or audit log yet.
- Email notifications are limited to the registration confirmation.

## 10. Contents of the handover package

The ZIP contains the complete source, configuration, documentation and requirement PDFs. It excludes `node_modules/` (restored by `npm install`), `.env`, `.git/` and any uploaded media. The Git history is available from the GitHub repository.
