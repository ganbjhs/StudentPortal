# Student Innovation Portal

A simple portal where schools register / log in and upload their students' invention videos
(student name, roll no., class, section, caption, description). Pilot build — judges & scoring come next.

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

## API

| Method | Path              | Body / notes                                              |
|--------|-------------------|-----------------------------------------------------------|
| POST   | /api/register     | `{userId, password, name, city, state, phone, email, udise}` — only userId + password required |
| POST   | /api/login        | `{userId, password}`                                      |
| POST   | /api/logout       |                                                           |
| GET    | /api/me           | logged-in school                                          |
| PUT    | /api/me           | update school profile                                     |
| GET    | /api/videos       | entries of the logged-in school                           |
| POST   | /api/videos       | multipart: `studentName, rollNo, class, section, caption, description, videoUrl, video(file)` — all optional |
| PUT    | /api/videos/:id   | same fields, any subset; new `video` file replaces the old |
| DELETE | /api/videos/:id   |                                                           |

## Config

Copy `.env.example` → `.env` (or set env vars): `PORT`, `SESSION_SECRET`, `MAX_UPLOAD_MB` (default 200).

## Moving to the cloud later

- **Database:** replace `src/store.js` with Postgres (Supabase free tier) / MongoDB — the function signatures stay the same.
- **Videos:** replace multer's disk storage with S3 / Supabase Storage / Cloudinary and store the returned URL in `videoFile`.
- **Hosting:** Render, Railway or any Node host. Google Drive is not recommended as a video backend
  (OAuth setup, API quotas, no reliable streaming/seeking).
