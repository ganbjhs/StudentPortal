# Meri Seva, Mera Sankalp — Reel Competition Portal
## Product Blueprint & Phase-wise Plan

**Client:** Directorate of Education, Govt. of NCT of Delhi (DoE, GNCTD) — via the selected Event/Production Agency
**Campaign:** Seva Sankalp Abhiyan, 17 Sep 2026 → 17 Oct 2026 (Grand Showcase: Jansevak Mahakumbh, 17 Oct 2026, Chhatarsal Stadium)
**Source:** RFP "Selection of Event Management/Production Agency for Seva Sankalp Abhiyan" (issued 07.09.2026)
**Repo:** github.com/ganbjhs/StudentPortal · **Live:** studentportal-production-9d28.up.railway.app
**Status:** PENDING — development paused on 16 Sep 2026 and handed over for continuation on another system (see HANDOVER.md). v1 (school registration + reel submission + evaluation desk) delivered 15 Sep 2026

---

## 1. What the RFP asks the portal to do

The RFP has three initiatives; the portal serves mainly **A. Meri Seva, Mera Sankalp** and the common **E/F** (dashboards, documentation) sections. Relevant scope, mapped to portal features:

| RFP section | Requirement | Portal feature |
|---|---|---|
| A.1 Concept & Framework | Themes/sub-themes, guidelines, eligibility, submission formats, consent & declaration templates | Theme list, guidelines page, consent checkbox + downloadable templates |
| A.2 Digital Submission & Registration | Online registration & submission; student registration & reel submission; tech support; **centralised database**; categorisation at School/District/State level; records of shortlisted & selected entries | School accounts, reel entries, district/state tagging, status pipeline (Submitted → School-shortlisted → District-selected → State-selected → Grand Showcase) |
| A.3 School-level | Guidelines dissemination, collection & preliminary screening, school-level evaluation, compilation of shortlist, submission to district | School dashboard: add/edit reels, mark "Shortlisted for District", school shortlist export |
| A.4 District-level | District screening, evaluation panels, **standardised evaluation sheets & scoring**, compile results, forward to State | District Nodal Officer login, judge scoring form (rubric), district leaderboard, forward-to-state action |
| A.5 State/UT-level | State screening, jury engagement, consolidated score sheets, quality check, curation, final list for Directorate approval | State jury login, consolidated scores, curation list, approval workflow |
| A.6 / A.7 Post-production & Grand Showcase | Editing, captions, screening packages, digital archive | Download/export of selected reels, archive bucket, screening playlist |
| E.9–10 Digital support | Participation statistics, dashboards & progress reports | Admin dashboard: schools, districts, reels received, per-day counts, exports |
| F. Documentation | No. of schools, district-wise & state-wise participation, reels received, evaluation records, selected participants | Reports page + CSV/Excel export |
| G. Rights & Consent | Parental consent, originality, no copyrighted music, PII handled appropriately | Consent/declaration on each reel, private data (no public listing), role-based access |
| B. Seva Geet (later) | School → District → State auditions, participant lists & schedules | Reuse the same pipeline with entry type = "Seva Geet audition" |
| C. Kahani Badlav Ki (later) | Content tracker, daily packages, approval mechanism, master files | Agency-side content tracker (separate module) |

**Theme list (from RFP):** Seva · Jan Bhagidari · Social Responsibility · Public Service · Nation Building · Viksit Bharat @2047 · Unity in Diversity (Seva Geet)

**Competition structure:** School → District → State/UT → Grand Showcase. Delhi DoE has **13 education districts** (North, North West-A, North West-B, West-A, West-B, South West-A, South West-B, South, South East, Central, East, North East, New Delhi). "Nationwide" = other States/UTs may join; they select State/UT and type their district.

---

## 2. Roles (final target)

| Role | Who | Can do |
|---|---|---|
| **School** | Nodal teacher / principal (one login per school) | Register school, add/edit/delete reels, tick consent, mark school-level shortlist, view own stats |
| **District Nodal Officer** | DoE DDE / district coordinator | See all reels of their district, assign judges, view scores, select entries for State |
| **Judge / Jury** | Panel member (district or state) | Score assigned reels on rubric, add remarks; cannot edit entries |
| **State Admin (Directorate)** | DoE HQ + agency | See everything, dashboards, reports/exports, approve final list, manage districts/schools/themes/judges |
| **Agency Admin** | Production agency ops team | Same as State Admin + content tracker for Seva Geet / Kahani Badlav Ki |

---

## 3. Data model (target)

```
schools      id, userId, passwordHash, name, schoolCode (School ID), udise, stateUT, districtId, districtName,
             city, nodalOfficerName, phone, email, createdAt
reels        id, schoolId, participantType (student|teacher), entryType (reel|drawing),
             designation, studentName, rollNo, class, section, title, description,
             theme, durationSec, videoFile | videoUrl, mediaType (video|image),
             originalName, sizeBytes,
             consentOriginal (bool), consentParental (bool),
             status: submitted | school_shortlisted | district_selected | state_selected | showcase,
             createdAt, updatedAt
districts    id, name, stateUT, schools[] (seed from config/zones.json; grows on registration)
users        id, role (district | judge | state | agency), name, email, passwordHash, districtId?
scores       id, reelId, judgeId, level (district|state), criteria{...}, total, remarks, createdAt
settings     themes[], rubric[], dates{...}, guidelinesUrl, consentTemplateUrl
```

Scoring rubric (proposed, editable by admin — to be confirmed with DoE): Relevance to theme (25) · Creativity & storytelling (25) · Message clarity & impact (20) · Technical quality (15) · Originality & authenticity (15) = **100**.

---

## 4. Phase-wise plan

### ✅ Phase 0 — Prototype (done 14 Sep)
- School register/login, reel upload (file up to 200 MB or YouTube/Drive link), edit/delete, search
- Node + Express, JSON file DB, videos on disk; deployed on Railway with persistent volume
- Zone → School dropdown on registration; "All entries" view with zone filter + search

### ✅ Phase 1 — RFP alignment, v1 delivery (15 Sep, today)
Rename & re-brand to the RFP, keep everything optional, no new heavy modules.
- Branding: "Meri Seva, Mera Sankalp" · Seva Sankalp Abhiyan · Directorate of Education, GNCTD
- "Zone" → **District** (Delhi's 13 DoE education districts + other States/UTs); State/UT select
- "Invention" → **Reel**: Reel title, message/description, **Theme** dropdown, duration
- **Consent & declaration** checkboxes on every reel (original content · parental consent · no copyrighted music)
- **Status pipeline** field (Submitted → Shortlisted for District → Selected for State → Grand Showcase); school can mark "Shortlisted for District"
- Nodal officer name on school registration
- Dashboard stats reworded: Reels submitted · Students · Shortlisted
- "All entries" tab → **District view** with district filter + search (title, description, theme, student, school, district)
- Guidelines/hint text: 9:16 vertical, ≤ 90 sec, MP4, original audio

### ✅ Phase 2 — Evaluation pipeline (started 15 Sep — core delivered)
- ✅ Roles & logins: State Admin (seeded), District Nodal Officer, Judge (district / state level) — created by admin at `/staff`
- ✅ Judge scoring form with rubric (5 criteria = 100), remarks; average + judge count per level
- ✅ District desk: own district's reels, status control Submitted → Shortlisted → Selected for State/UT
- ✅ State admin: all reels, "Selected for Grand Showcase", officials management, participation report, CSV export
- ✅ Status transitions logged (who / role / when) in `statusHistory`
- ⏳ Per-district selection cap (configurable), downloadable consent template PDF, guidelines page

### ✅ Phase 2b — Participants & entry categories (15 Sep)
- **Participant category** dropdown on every entry: `student` | `teacher` (Teacher / Faculty — the nodal officer submits their own work under this). Form follows the choice: student → Roll No. / Class / Section; teacher → Designation / subject.
- **Entry category** dropdown: `reel` (video) | `drawing` (artwork). Drawing entries upload an image (JPG/PNG/WebP); reels upload video or a YouTube/Drive link. `mediaType` (`video` | `image`) is stored per entry so cards render an `<img>` or a `<video>`; the Evaluation Desk renders both too (scoring untouched).
- **School ID** (`schoolCode`, DoE school code) captured at registration, shown in the header, under every card title, searchable, and exported as its own CSV column. Falls back to UDISE, then User ID, when blank.
- **Schools see only their own entries** — the "All districts" tab and `/api/videos/all` are gone from the school portal. Cross-school views live in the Evaluation Desk (district officer / judge / admin). A category filter (All / Reel / Drawing) plus search over title, category, theme, participant, designation, school and School ID replaces it.
- Both category lists are config-driven in `config/settings.json` (`participantTypes`, `entryTypes`) — new categories need no code change.
- **Language field dropped** from the entry form, the data model, the cards and the CSV export.
- Registration reordered: **School ID + UDISE sit above the school name**. The school-name select is gone — one free-text field with the district's known schools as type-ahead suggestions; whatever the school types is accepted and becomes a suggestion for the next school in that district.

### Phase 3 — Reporting & documentation (target: 23–27 Sep)
- Admin reports: schools registered, district-wise & state-wise participation, reels received per day, shortlisted/selected counts
- CSV/Excel export of every table; printable score sheets
- Bulk school import from DoE Excel (UDISE + district)
- Email/SMS-style notifications (optional; via free SMTP) to schools on status change

### Phase 4 — Production readiness (target: by 1 Oct)
- Move DB to Postgres (Neon/Supabase or DigitalOcean Managed PG) and videos to object storage (Cloudflare R2 / DO Spaces) — code is already split (`src/store.js`, multer storage) so this is a 1-day switch
- Custom domain (e.g. sevasankalp.edudel.nic.in or agency domain), HTTPS, backups
- Rate limiting, password reset, admin audit log, basic PII safeguards (private video URLs, no public listing)
- Load check for ~1,000+ Delhi govt schools uploading in the same week

### Phase 5 — Showcase & archive (10–17 Oct)
- Screening playlist builder for Grand Showcase (order, durations, captions)
- Bulk download of selected reels for post-production
- Final digital archive export + final participation report (RFP section F)

### Later / optional (same platform)
- **Seva Geet**: audition entries with the same School → District → State flow (entry type = audition; audio/video upload; participant list & schedule export)
- **Kahani Badlav Ki**: agency content tracker (story ID, shoot date, edit status, approval status, dissemination links) with daily package report
- Public showcase gallery of approved reels (only after Directorate approval)

---

## 5. Open questions for the client (DoE / agency)
1. Confirm district list: use DoE's 13 education districts, or the 11 revenue districts?
2. Reel rules: max duration (60 / 90 sec?), orientation (9:16), max entries per school?
3. Who evaluates at school level — the school itself (self-shortlist) or agency?
4. District → State quota (e.g. top 10 per district?) and State → Showcase quota
5. Scoring rubric and weights — accept the proposed 5 criteria?
6. Consent: is a scanned signed parental-consent upload mandatory, or a checkbox declaration enough for v1?
7. Data residency: any requirement to host on NIC/Indian cloud region?

---

## 6. Tech stack (current → target)
- **Now:** Node 18+/Express, plain HTML/CSS/JS frontend, JSON-file DB, disk uploads, Railway (volume `/data`)
- **Target:** same app + Postgres + object storage + CDN, Indian region (DigitalOcean Bangalore or AWS Mumbai), custom domain
- Everything configurable through `config/zones.json` (districts/schools), `config/settings.json` (themes, rubric, dates) — no code change for content edits
