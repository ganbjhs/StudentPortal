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
 *   BREVO_API_KEY   Brevo key for registration emails (free 300/day; verify the sender email in Brevo) — optional
 *   RESEND_API_KEY  alternative provider (needs verified domain); emails skipped if neither key is set
 *   MAIL_FROM       sender, e.g. "Meri Seva Mera Sankalp <you@gmail.com>" (must be verified with the provider)
 *   PORTAL_URL      public URL used inside emails
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const store = require("./src/store");
const mail = require("./src/mail");

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
    // Reels = video, Drawings = image
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only video files (reel) or image files (drawing) are allowed."));
  },
});
const mediaKind = (file) => (file && file.mimetype.startsWith("image/") ? "image" : "video");

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
    schoolCode: clean(b.schoolCode, 30),
    udise: clean(b.udise, 20),
    nodalOfficer: clean(b.nodalOfficer, 120),
    phone: clean(b.phone, 20),
    email: clean(b.email, 120),
  });
  if (zone && school.name) store.addSchoolToZone(zone.id, school.name);
  req.session.schoolId = school.id;
  res.status(201).json({ school: publicSchool(school), emailSent: !!(school.email && mail.mailEnabled()) });
  mail.sendRegistrationEmail(school); // fire-and-forget: never blocks or fails the registration
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
  req.session.schoolId = school.id; req.session.userId = null;
  res.json({ school: publicSchool(school) });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", requireLogin, (req, res) => res.json({ school: publicSchool(req.school) }));

app.put("/api/me", requireLogin, (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ["name", "city", "state", "schoolCode", "udise", "nodalOfficer", "phone", "email"]) if (k in b) patch[k] = clean(b[k], 200);
  if ("zoneId" in b) { const z = store.findZone(clean(b.zoneId, 40)); patch.zoneId = z ? z.id : ""; patch.zoneName = z ? z.name : ""; }
  res.json({ school: publicSchool(store.updateSchool(req.school.id, patch)) });
});

// ---------- Videos / entries ----------
app.get("/api/videos", requireLogin, (req, res) => {
  res.json({ videos: store.listVideosForSchool(req.school.id).map(withSchool) });
});

// (A school only ever sees its own entries. District-wide / all-district views live in
// the Evaluation Desk for officials — see /api/eval/reels below.)

// Attach the owning school's name/zone to an entry for display and search.
function withSchool(v) {
  const s = store.findSchoolById(v.schoolId);
  return {
    ...v,
    schoolName: s ? s.name || s.userId : "",
    schoolCode: s ? s.schoolCode || s.udise || s.userId || "" : "", // School ID shown on every card
    zoneId: s ? s.zoneId || "" : "",
    zoneName: s ? s.zoneName || "" : "",
  };
}

const STATUS_IDS = () => store.getSettings().statuses.map((s) => s.id);
const PARTICIPANT_IDS = () => (store.getSettings().participantTypes || []).map((p) => p.id);
const ENTRY_TYPE_IDS = () => (store.getSettings().entryTypes || []).map((e) => e.id);
const yes = (v) => v === true || v === "true" || v === "1" || v === "on";
function entryFields(b) {
  const status = clean(b.status, 40);
  const participantType = clean(b.participantType, 20);
  const entryType = clean(b.entryType, 20);
  return {
    // who is entering: student or teacher/faculty (nodal officer can enter their own work)
    participantType: PARTICIPANT_IDS().includes(participantType) ? participantType : "student",
    // what the entry is: reel (video) or drawing (artwork)
    entryType: ENTRY_TYPE_IDS().includes(entryType) ? entryType : "reel",
    designation: clean(b.designation, 120), // teacher entries: designation / subject
    studentName: clean(b.studentName, 120), // participant name (student or teacher)
    rollNo: clean(b.rollNo, 20),
    class: clean(b.class, 20),
    section: clean(b.section, 10),
    caption: clean(b.caption, 200),          // reel title
    description: clean(b.description, 2000), // reel message / description
    theme: clean(b.theme, 60),
    durationSec: Number(b.durationSec) > 0 ? Math.round(Number(b.durationSec)) : 0,
    consentOriginal: yes(b.consentOriginal),
    consentParental: yes(b.consentParental),
    consentMusic: yes(b.consentMusic),
    status: STATUS_IDS().includes(status) ? status : "submitted",
    videoUrl: clean(b.videoUrl, 500), // external link (YouTube / Drive) — optional
  };
}

// Mandatory-field check (same rules as the form in public/app.js).
// hasMedia: an uploaded file (new or already stored) or an external link.
function validateEntry(f, hasMedia) {
  const missing = [];
  const name = f.studentName || "";
  if (name.length < 3 || !/[A-Za-z\u0900-\u097F]{2,}/.test(name)) missing.push("name (at least 3 letters)");
  if (f.participantType === "student") {
    if (!f.rollNo) missing.push("roll no.");
    if (!f.class) missing.push("class");
  } else if (!f.designation) missing.push("designation / subject");
  if (!f.caption) missing.push(f.entryType === "reel" ? "reel title" : "artwork title");
  if (!hasMedia) missing.push(f.entryType === "reel" ? "reel video (file or link)" : "drawing image (file or link)");
  if (!(f.consentOriginal && f.consentParental && f.consentMusic)) missing.push("consent & declaration (all three boxes)");
  return missing.length ? "Required: " + missing.join(", ") + "." : "";
}

// multipart: fields + "video" file (file or external link is mandatory)
app.post("/api/videos", requireLogin, (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? `Video is larger than ${MAX_UPLOAD_MB} MB.` : err.message;
      return res.status(400).json({ error: msg });
    }
    const fields = entryFields(req.body || {});
    const file = req.file;
    const problem = validateEntry(fields, !!file || !!fields.videoUrl);
    if (problem) { if (file) removeFile(`/uploads/${file.filename}`); return res.status(400).json({ error: problem }); }
    const video = store.createVideo({
      schoolId: req.school.id,
      ...fields,
      videoFile: file ? `/uploads/${file.filename}` : "",
      mediaType: file ? mediaKind(file) : "",
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
    const problem = validateEntry(patch, !!req.file || !!v.videoFile || !!patch.videoUrl);
    if (problem) { if (req.file) removeFile(`/uploads/${req.file.filename}`); return res.status(400).json({ error: problem }); }
    patch.mediaType = v.mediaType || "";
    if (req.file) {
      removeFile(v.videoFile);
      patch.videoFile = `/uploads/${req.file.filename}`;
      patch.mediaType = mediaKind(req.file);
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

// =====================================================================
//  OFFICIALS: State Admin · District Nodal Officer · Judge
// =====================================================================
// First run: seed an admin login (change via env ADMIN_USER / ADMIN_PASS, then change the password in the UI).
(async () => {
  if (store.listUsers().length === 0) {
    const u = process.env.ADMIN_USER || "admin", pw = process.env.ADMIN_PASS || "admin123";
    store.createUser({ userId: u, passwordHash: await bcrypt.hash(pw, 10), role: "admin", name: "State Admin", zoneId: "", zoneName: "", level: "state" });
    console.log(`Seeded admin login: ${u} / ${pw}`);
  }
})();

const publicUser = (u) => { const { passwordHash, ...rest } = u; return rest; };
function requireStaff(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: "Please log in as an official." });
    const user = store.findUserById(req.session.userId);
    if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: "Session expired." }); }
    if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: "Not allowed for your role." });
    req.user = user; next();
  };
}
// Which reels can this official see? admin: all · district officer/judge: their district · state judge: reels selected by districts
function visibleReels(user) {
  let list = store.listAllVideos().map(withSchool);
  if (user.role === "admin") return list;
  if (user.role === "district" || (user.role === "judge" && user.level !== "state")) return list.filter((v) => v.zoneId === user.zoneId);
  return list.filter((v) => ["district_selected", "state_selected"].includes(v.status)); // state-level judge
}
function withScores(v) {
  const scores = store.listScores({ reelId: v.id });
  const byLevel = {};
  for (const sc of scores) {
    const b = byLevel[sc.level] || (byLevel[sc.level] = { count: 0, sum: 0, judges: [] });
    b.count++; b.sum += sc.total; b.judges.push({ judgeName: sc.judgeName, total: sc.total, remarks: sc.remarks, criteria: sc.criteria, judgeId: sc.judgeId });
  }
  for (const b of Object.values(byLevel)) b.avg = Math.round((b.sum / b.count) * 10) / 10;
  return { ...v, scores: byLevel };
}

app.post("/api/staff/login", async (req, res) => {
  const userId = clean(req.body?.userId, 40).toLowerCase();
  const password = String(req.body?.password || "");
  const user = store.findUserByUserId(userId);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Incorrect User ID or password." });
  req.session.schoolId = null; req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});
app.get("/api/staff/me", requireStaff(), (req, res) => res.json({ user: publicUser(req.user) }));
app.put("/api/staff/me/password", requireStaff(), async (req, res) => {
  const pw = String(req.body?.password || ""); if (pw.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  store.updateUser(req.user.id, { passwordHash: await bcrypt.hash(pw, 10) }); res.json({ ok: true });
});

// ---- admin: manage officials ----
app.get("/api/staff/users", requireStaff("admin"), (req, res) => res.json({ users: store.listUsers().map(publicUser) }));
app.post("/api/staff/users", requireStaff("admin"), async (req, res) => {
  const b = req.body || {};
  const userId = clean(b.userId, 40).toLowerCase(), role = clean(b.role, 20), pw = String(b.password || "");
  if (!/^[a-z0-9._-]{3,40}$/.test(userId)) return res.status(400).json({ error: "User ID: 3–40 chars, lowercase letters, digits, . _ -" });
  if (!["admin", "district", "judge"].includes(role)) return res.status(400).json({ error: "Role must be admin, district or judge." });
  if (pw.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  if (store.findUserByUserId(userId) || store.findSchoolByUserId(userId)) return res.status(409).json({ error: "This User ID is already taken." });
  const zone = store.findZone(clean(b.zoneId, 40));
  const level = clean(b.level, 20) === "state" ? "state" : "district";
  if (role !== "admin" && level === "district" && !zone) return res.status(400).json({ error: "Select a district for this official." });
  const u = store.createUser({ userId, passwordHash: await bcrypt.hash(pw, 10), role, name: clean(b.name, 120), email: clean(b.email, 120), phone: clean(b.phone, 20),
    zoneId: zone ? zone.id : "", zoneName: zone ? zone.name : "", level: role === "admin" ? "state" : level });
  res.status(201).json({ user: publicUser(u) });
});
app.delete("/api/staff/users/:id", requireStaff("admin"), (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You cannot delete your own login." });
  store.deleteUser(req.params.id); res.json({ ok: true });
});

// ---- reels for evaluation (with scores) ----
app.get("/api/eval/reels", requireStaff(), (req, res) => {
  const zone = clean(req.query.zone, 40), status = clean(req.query.status, 40), q = clean(req.query.q, 100).toLowerCase();
  let list = visibleReels(req.user);
  if (zone) list = list.filter((v) => v.zoneId === zone);
  if (status) list = list.filter((v) => (v.status || "submitted") === status);
  if (q) list = list.filter((v) => [v.caption, v.description, v.theme, v.studentName, v.rollNo, v.class, v.schoolName, v.zoneName].join(" ").toLowerCase().includes(q));
  res.json({ reels: list.map(withScores), me: publicUser(req.user) });
});

// ---- judge: submit / update a score sheet ----
app.post("/api/eval/reels/:id/score", requireStaff("judge", "admin"), (req, res) => {
  const v = store.findVideo(req.params.id);
  if (!v || !visibleReels(req.user).some((x) => x.id === v.id)) return res.status(404).json({ error: "Reel not found." });
  const rubric = store.getSettings().rubric || [];
  const criteria = {}; let total = 0;
  for (const c of rubric) {
    const n = Math.max(0, Math.min(c.max, Number(req.body?.criteria?.[c.id]) || 0));
    criteria[c.id] = n; total += n;
  }
  const level = req.user.role === "admin" ? (clean(req.body?.level, 20) === "state" ? "state" : "district") : req.user.level;
  const sc = store.upsertScore({ reelId: v.id, judgeId: req.user.id, judgeName: req.user.name || req.user.userId, level, criteria, total, remarks: clean(req.body?.remarks, 1000) });
  res.json({ score: sc });
});

// ---- district officer / admin: move a reel along the pipeline ----
app.post("/api/eval/reels/:id/status", requireStaff("district", "admin"), (req, res) => {
  const v = store.findVideo(req.params.id);
  if (!v || !visibleReels(req.user).some((x) => x.id === v.id)) return res.status(404).json({ error: "Reel not found." });
  const status = clean(req.body?.status, 40);
  if (!STATUS_IDS().includes(status)) return res.status(400).json({ error: "Unknown status." });
  if (req.user.role === "district" && status === "state_selected") return res.status(403).json({ error: "Only the State Admin can select for the Grand Showcase." });
  const hist = Array.isArray(v.statusHistory) ? v.statusHistory : [];
  hist.push({ status, by: req.user.name || req.user.userId, role: req.user.role, at: new Date().toISOString() });
  res.json({ video: store.updateVideo(v.id, { status, statusHistory: hist }) });
});

// ---- admin: participation stats + CSV export (RFP section F) ----
app.get("/api/admin/stats", requireStaff("admin", "district"), (req, res) => {
  const reels = visibleReels(req.user), schools = store.listAllSchools();
  const zones = store.listZones();
  const byDistrict = zones.map((z) => ({
    zoneId: z.id, district: z.name, state: z.state,
    schools: schools.filter((s) => s.zoneId === z.id).length,
    reels: reels.filter((v) => v.zoneId === z.id).length,
    shortlisted: reels.filter((v) => v.zoneId === z.id && v.status === "school_shortlisted").length,
    districtSelected: reels.filter((v) => v.zoneId === z.id && v.status === "district_selected").length,
    stateSelected: reels.filter((v) => v.zoneId === z.id && v.status === "state_selected").length,
  })).filter((r) => r.schools || r.reels);
  const byStatus = {}; for (const st of STATUS_IDS()) byStatus[st] = reels.filter((v) => (v.status || "submitted") === st).length;
  const byTheme = {}; for (const v of reels) { const t = v.theme || "(none)"; byTheme[t] = (byTheme[t] || 0) + 1; }
  const byDay = {}; for (const v of reels) { const d = (v.createdAt || "").slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; }
  res.json({ totals: { schools: req.user.role === "admin" ? schools.length : schools.filter((s) => s.zoneId === req.user.zoneId).length, reels: reels.length, districts: byDistrict.filter((r) => r.reels).length, consented: reels.filter((v) => v.consentOriginal && v.consentParental && v.consentMusic).length },
    byDistrict, byStatus, byTheme, byDay });
});
app.get("/api/admin/export.csv", requireStaff("admin", "district"), (req, res) => {
  const rows = visibleReels(req.user).map(withScores);
  const cols = ["id", "zoneName", "schoolCode", "schoolName", "entryType", "participantType", "studentName", "designation", "rollNo", "class", "section", "theme", "durationSec", "caption", "description", "status", "consentOriginal", "consentParental", "consentMusic", "videoFile", "videoUrl", "createdAt"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [[...cols, "districtAvg", "districtJudges", "stateAvg", "stateJudges"].join(",")];
  for (const r of rows) lines.push([...cols.map((c) => esc(r[c])), r.scores.district?.avg ?? "", r.scores.district?.count ?? 0, r.scores.state?.avg ?? "", r.scores.state?.count ?? 0].join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="reels-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("\ufeff" + lines.join("\n"));
});

app.get("/staff", (req, res) => res.sendFile(path.join(__dirname, "public", "staff.html")));
// Fallback → frontend
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Meri Seva, Mera Sankalp portal running at http://localhost:${PORT}`));
