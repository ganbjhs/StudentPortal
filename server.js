/**
 * Meri Seva, Mera Sankalp — Reel Competition Portal (API + static frontend).
 *
 *   npm install
 *   npm start          → http://localhost:3000
 *
 * Config via environment variables (see .env.example):
 *   PORT            default 3000
 *   SESSION_SECRET  any long random string (change in production)
 *   MAX_UPLOAD_MB   default 200
 *   DATA_DIR        folder for db.json   (default ./data)   — point both at a
 *   UPLOAD_DIR      folder for videos    (default ./uploads)  persistent disk when deployed
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const store = require("./src/store");

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-production";
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 200);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.set("trust proxy", 1); // behind Railway/Render/nginx proxy
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
  })
);

// Frontend + uploaded videos. express.static supports HTTP range requests,
// so <video> can seek/scrub while playing.
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1h" }));

// ---------- helpers ----------
const clean = (v, max = 500) => (v == null ? "" : String(v).trim().slice(0, max));
const publicSchool = (s) => {
  const { passwordHash, ...rest } = s;
  return rest;
};
function requireLogin(req, res, next) {
  if (!req.session.schoolId) return res.status(401).json({ error: "Please log in first." });
  const school = store.findSchoolById(req.session.schoolId);
  if (!school) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
  req.school = school;
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || ".mp4").toLowerCase().slice(0, 8);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    cb(new Error("Only video files are allowed."));
  },
});

// ---------- Auth ----------
app.post("/api/register", async (req, res) => {
  const b = req.body || {};
  const userId = clean(b.userId, 40).toLowerCase();
  const password = String(b.password || "");
  if (!userId) return res.status(400).json({ error: "User ID is required." });
  if (!/^[a-z0-9._-]{3,40}$/.test(userId))
    return res.status(400).json({ error: "User ID: 3–40 characters, letters, digits, . _ - only." });
  if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  if (store.findSchoolByUserId(userId)) return res.status(409).json({ error: "This User ID is already taken." });

  const zone = store.findZone(clean(b.zoneId, 40));
  const school = store.createSchool({
    userId,
    passwordHash: await bcrypt.hash(password, 10),
    name: clean(b.name, 200),
    zoneId: zone ? zone.id : "",
    zoneName: zone ? zone.name : "",
    city: clean(b.city, 100) || (zone ? zone.city : ""),
    state: clean(b.state, 100) || (zone ? zone.state : ""),
    udise: clean(b.udise, 20),
    nodalOfficer: clean(b.nodalOfficer, 120),
    phone: clean(b.phone, 20),
    email: clean(b.email, 120),
  });
  if (zone && school.name) store.addSchoolToZone(zone.id, school.name);
  req.session.schoolId = school.id;
  res.status(201).json({ school: publicSchool(school) });
});

// ---------- Districts & campaign settings (public: needed on the registration form) ----------
app.get("/api/zones", (req, res) => res.json({ zones: store.listZones() }));
app.get("/api/settings", (req, res) => res.json(store.getSettings()));

app.post("/api/login", async (req, res) => {
  const userId = clean(req.body?.userId, 40).toLowerCase();
  const password = String(req.body?.password || "");
  const school = store.findSchoolByUserId(userId);
  if (!school || !(await bcrypt.compare(password, school.passwordHash)))
    return res.status(401).json({ error: "Incorrect User ID or password." });
  req.session.schoolId = school.id;
  res.json({ school: publicSchool(school) });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", requireLogin, (req, res) => res.json({ school: publicSchool(req.school) }));

app.put("/api/me", requireLogin, (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ["name", "city", "state", "udise", "nodalOfficer", "phone", "email"]) if (k in b) patch[k] = clean(b[k], 200);
  if ("zoneId" in b) { const z = store.findZone(clean(b.zoneId, 40)); patch.zoneId = z ? z.id : ""; patch.zoneName = z ? z.name : ""; }
  res.json({ school: publicSchool(store.updateSchool(req.school.id, patch)) });
});

// ---------- Videos / entries ----------
app.get("/api/videos", requireLogin, (req, res) => {
  res.json({ videos: store.listVideosForSchool(req.school.id).map(withSchool) });
});

// Every school's entries, filterable — ?zone=<zoneId>&q=<text>. Text search covers
// caption/title, description, student, roll no., class, section, school and zone.
app.get("/api/videos/all", requireLogin, (req, res) => {
  const zone = clean(req.query.zone, 40);
  const q = clean(req.query.q, 100).toLowerCase();
  let list = store.listAllVideos().map(withSchool);
  if (zone) list = list.filter((v) => v.zoneId === zone);
  if (q) list = list.filter((v) =>
    [v.caption, v.description, v.studentName, v.rollNo, v.class, v.section, v.schoolName, v.zoneName]
      .join(" ").toLowerCase().includes(q));
  res.json({ videos: list });
});

// Attach the owning school's name/zone to an entry for display and search.
function withSchool(v) {
  const s = store.findSchoolById(v.schoolId);
  return { ...v, schoolName: s ? s.name || s.userId : "", zoneId: s ? s.zoneId || "" : "", zoneName: s ? s.zoneName || "" : "" };
}

const STATUS_IDS = () => store.getSettings().statuses.map((s) => s.id);
const yes = (v) => v === true || v === "true" || v === "1" || v === "on";
function entryFields(b) {
  const status = clean(b.status, 40);
  return {
    studentName: clean(b.studentName, 120),
    rollNo: clean(b.rollNo, 20),
    class: clean(b.class, 20),
    section: clean(b.section, 10),
    caption: clean(b.caption, 200),          // reel title
    description: clean(b.description, 2000), // reel message / description
    theme: clean(b.theme, 60),
    language: clean(b.language, 40),
    durationSec: Number(b.durationSec) > 0 ? Math.round(Number(b.durationSec)) : 0,
    consentOriginal: yes(b.consentOriginal),
    consentParental: yes(b.consentParental),
    consentMusic: yes(b.consentMusic),
    status: STATUS_IDS().includes(status) ? status : "submitted",
    videoUrl: clean(b.videoUrl, 500), // external link (YouTube / Drive) — optional
  };
}

// multipart: fields + optional "video" file
app.post("/api/videos", requireLogin, (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? `Video is larger than ${MAX_UPLOAD_MB} MB.` : err.message;
      return res.status(400).json({ error: msg });
    }
    const fields = entryFields(req.body || {});
    const file = req.file;
    const video = store.createVideo({
      schoolId: req.school.id,
      ...fields,
      videoFile: file ? `/uploads/${file.filename}` : "",
      originalName: file ? file.originalname : "",
      sizeBytes: file ? file.size : 0,
    });
    res.status(201).json({ video });
  });
});

app.put("/api/videos/:id", requireLogin, (req, res) => {
  const v = store.findVideo(req.params.id);
  if (!v || v.schoolId !== req.school.id) return res.status(404).json({ error: "Entry not found." });
  upload.single("video")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const patch = entryFields({ ...v, ...(req.body || {}) });
    if (req.file) {
      removeFile(v.videoFile);
      patch.videoFile = `/uploads/${req.file.filename}`;
      patch.originalName = req.file.originalname;
      patch.sizeBytes = req.file.size;
    }
    res.json({ video: store.updateVideo(v.id, patch) });
  });
});

app.delete("/api/videos/:id", requireLogin, (req, res) => {
  const v = store.findVideo(req.params.id);
  if (!v || v.schoolId !== req.school.id) return res.status(404).json({ error: "Entry not found." });
  removeFile(v.videoFile);
  store.deleteVideo(v.id);
  res.json({ ok: true });
});

function removeFile(videoFile) {
  if (!videoFile) return;
  const p = path.join(UPLOAD_DIR, path.basename(videoFile));
  fs.unlink(p, () => {});
}

// Fallback → frontend
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Meri Seva, Mera Sankalp portal running at http://localhost:${PORT}`));
